"""Users, login (password + TOTP 2FA, optional Google Sign-In) and the access policy for every /api route.

One place decides who may do what (OPENLOOP_AUTH=on, the default):
- **Sessions** are signed, HttpOnly, SameSite=Lax cookies: `ol_staff` for bank staff and `ol_client` for a client, so a
  presenter can keep the bank screen and the client portal open side by side in one browser.
- **The policy middleware fails closed.** Every /api path must match a rule in `RULES`, otherwise it answers 404. A client
  only ever reaches its own company's files (another company's file answers 404, as if it did not exist). Bank staff
  see every file; what they may change depends on their role (`PERMS`).
- **Identity comes from the session, never from the request.** The middleware stamps it on the request before the route
  runs: a client's `company_id` is replaced by the session's company, a staff message is signed with the staff member's
  name, and `by` on a decision, a hold release or a learned-check promotion is the signed-in staff ID. That is what makes
  the maker-checker rule binding: the analyst who ruled cannot promote her own check by typing another name.
- **2FA:** every account has a TOTP secret (RFC 6238, the 6-digit codes of a bank's authenticator app). Google Sign-In
  proves the e-mail address; the bank's OTP is still asked afterwards.

OPENLOOP_AUTH=off restores the open demo (no login, every caller is a demo superuser); the test-suite uses it for the
older tests. DEMO_LOGINS=1 (default) lists the synthetic demo accounts with their live codes on the login page.
Production: DEMO_LOGINS=0, OPENLOOP_SEED_USERS=0, a fixed SESSION_SECRET, users created by an admin (`python -m app.auth`).
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import struct
import threading
import time
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode

import requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import profiles

ROOT = Path(__file__).resolve().parents[2]
STAFF_COOKIE, CLIENT_COOKIE = "ol_staff", "ol_client"
SESSION_HOURS = 8                       # one working day
MAX_BODY = 2_000_000                    # the largest legal request is a 1 MB upload as base64 (1.4 MB) plus JSON
PBKDF2_ROUNDS = 240_000
STAFF_ROLES = ("analyst", "supervisor", "compliance", "admin")
ROLES = ("client", *STAFF_ROLES)
PERMS = {  # what each staff role may change; every staff member may read every file
    "analyst": {"decide", "demo"},
    "supervisor": {"decide", "promote", "users", "demo"},
    "compliance": {"decide", "release_hold", "demo"},
    "admin": {"decide", "promote", "release_hold", "users", "demo"},
}


def enabled() -> bool:
    return os.environ.get("OPENLOOP_AUTH", "on").lower() not in ("off", "0", "false", "no")


def demo_logins() -> bool:
    return os.environ.get("DEMO_LOGINS", "1") == "1"


def demo_mode() -> bool:
    """The demo controls (time skip, scripted events, reset, registry switch). Off in production."""
    return os.environ.get("DEMO_MODE", "1") == "1"


_SECRET: bytes | None = None


def _secret() -> bytes:
    """SESSION_SECRET when set (it must be, for more than one process or across restarts); else one per process."""
    global _SECRET
    if _SECRET is None:
        env = os.environ.get("SESSION_SECRET", "")
        if env and len(env) < 16:
            raise RuntimeError("SESSION_SECRET must be at least 16 characters")
        _SECRET = env.encode() if env else secrets.token_bytes(32)
    return _SECRET


# ----------------------------------------------------------------------------- passwords and one-time codes
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str | None) -> bool:
    try:
        _, rounds, salt, digest = (stored or "").split("$")
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(got.hex(), digest)
    except ValueError:
        return False


def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode()


def totp(secret: str, step: int) -> str:
    """RFC 6238 (SHA-1, 30 s, 6 digits): what Google Authenticator and bank token apps compute."""
    mac = hmac.new(base64.b32decode(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    return f"{(struct.unpack('>I', mac[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def totp_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // 30)


def otpauth_uri(user: dict) -> str:
    label = quote(f"OpenLoop:{user['email']}")
    return f"otpauth://totp/{label}?secret={user['totp_secret']}&issuer=OpenLoop&algorithm=SHA1&digits=6&period=30"


# ----------------------------------------------------------------------------- the user store (same SQLite file as the ledgers)
USER_FIELDS = ("id", "email", "name", "role", "staff_id", "company_id", "active", "google_sub", "ms_sub")
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,     -- lower case
    name            TEXT NOT NULL,
    role            TEXT NOT NULL,            -- client | analyst | supervisor | compliance | admin
    staff_id        TEXT,                     -- staff: the identity written to the ledger (analyst-1, ...)
    company_id      TEXT,                     -- clients: the only company whose files they see
    password_hash   TEXT,
    totp_secret     TEXT NOT NULL,
    totp_last_step  INTEGER NOT NULL DEFAULT 0,   -- a code is accepted once (replay protection)
    google_sub      TEXT,
    ms_sub          TEXT,                     -- Microsoft: "<tenant id>:<object id>", bound on the first sign-in
    active          INTEGER NOT NULL DEFAULT 1,
    session_version INTEGER NOT NULL DEFAULT 1,   -- bumped to sign the user out everywhere
    failed          INTEGER NOT NULL DEFAULT 0,
    locked_until    REAL NOT NULL DEFAULT 0,
    created_at      REAL NOT NULL,
    last_login      REAL
);
"""
DEMO_STAFF = [  # synthetic bank staff; the staff IDs are the identities the demo ledgers already use
    ("ana.pop@bank.example", "Ana Pop", "analyst", "analyst-1"),
    ("ioana.marin@bank.example", "Ioana Marin", "supervisor", "supervisor-1"),
    ("victor.stan@bank.example", "Victor Stan", "compliance", "compliance-1"),
    ("admin@bank.example", "Admin", "admin", "admin-1"),
]


class Users:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        with self.lock, self.db:
            self.db.executescript(SCHEMA)
            columns = {r[1] for r in self.db.execute("PRAGMA table_info(users)")}
            if "ms_sub" not in columns:  # a database created before Microsoft sign-in
                self.db.execute("ALTER TABLE users ADD COLUMN ms_sub TEXT")

    def get(self, user_id: str) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    def by_email(self, email: str) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        return dict(row) if row else None

    def all(self) -> list[dict]:
        with self.lock:
            return [dict(r) for r in self.db.execute("SELECT * FROM users ORDER BY role != 'client', role, email")]

    def create(self, email: str, name: str, role: str, password: str | None = None, staff_id: str | None = None,
               company_id: str | None = None) -> dict:
        email = email.strip().lower()
        if role not in ROLES:
            raise ValueError(f"role must be one of {', '.join(ROLES)}")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("not an e-mail address")
        if role == "client" and company_id not in profiles.PROFILES:
            raise ValueError("a client account needs a known company_id")
        if role != "client":
            company_id = None
            staff_id = staff_id or f"{role}-{secrets.token_hex(2)}"
        user = {"id": "u-" + secrets.token_hex(6), "email": email, "name": name.strip()[:80], "role": role,
                "staff_id": None if role == "client" else staff_id, "company_id": company_id,
                "password_hash": hash_password(password) if password else None, "totp_secret": new_totp_secret(),
                "created_at": time.time()}
        with self.lock, self.db:
            try:
                self.db.execute(f"INSERT INTO users ({', '.join(user)}) VALUES ({', '.join('?' * len(user))})",
                                tuple(user.values()))
            except sqlite3.IntegrityError:
                raise ValueError("a user with this e-mail already exists")
        return self.get(user["id"])

    def update(self, user_id: str, **fields) -> None:
        with self.lock, self.db:
            self.db.execute(f"UPDATE users SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?",
                            (*fields.values(), user_id))

    def bump_session(self, user_id: str) -> None:
        with self.lock, self.db:
            self.db.execute("UPDATE users SET session_version = session_version + 1 WHERE id = ?", (user_id,))

    def seed_demo(self) -> None:
        """Synthetic demo accounts on an empty user table: 4 bank staff and one login per synthetic company."""
        with self.lock:
            if self.db.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
                return
        password = os.environ.get("DEMO_PASSWORD", "demo")
        for email, name, role, staff_id in DEMO_STAFF:
            self.create(email, name, role, password, staff_id=staff_id)
        for p in profiles.PROFILES.values():
            self.create(p["email"], p["name"], "client", password, company_id=p["id"])


_USERS: Users | None = None
_USERS_LOCK = threading.Lock()


def users() -> Users:
    global _USERS
    with _USERS_LOCK:
        if _USERS is None:
            _USERS = Users(str(os.environ.get("OPENLOOP_DB") or ROOT / "data" / "openloop.db"))
            if os.environ.get("OPENLOOP_SEED_USERS", "1") == "1":
                _USERS.seed_demo()
        return _USERS


def public(user: dict | None) -> dict | None:
    """A user as the API shows it: never the password hash or the TOTP secret."""
    if not user:
        return None
    out = {k: user.get(k) for k in USER_FIELDS if k not in ("google_sub", "ms_sub")}
    company = profiles.PROFILES.get(user.get("company_id") or "")
    return out | {"company": company["name"] if company else None, "active": bool(user.get("active"))}


# ----------------------------------------------------------------------------- signed tokens (sessions and MFA challenges)
def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign(payload: dict) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return body + "." + _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())


def unsign(token: str | None, kind: str) -> dict | None:
    try:
        body, sig = (token or "").split(".")
        if not hmac.compare_digest(_unb64(sig), hmac.new(_secret(), body.encode(), hashlib.sha256).digest()):
            return None
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    return payload if payload.get("k") == kind and payload.get("exp", 0) > time.time() else None


def session_user(token: str | None) -> dict | None:
    """The live user behind a session cookie: signature, expiry, account active and not signed out everywhere."""
    p = unsign(token, "session")
    user = users().get(p["u"]) if p else None
    if not user or not user["active"] or user["session_version"] != p.get("v"):
        return None
    return user


# ----------------------------------------------------------------------------- rate limits (in memory, per process)
class Limiter:
    """A sliding-window counter: at most `n` hits per `window` seconds per key."""

    def __init__(self, n: int, window: float):
        self.n, self.window, self.hits, self.lock = n, window, {}, threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self.lock:
            recent = [t for t in self.hits.get(key, []) if now - t < self.window]
            if len(recent) >= self.n:
                self.hits[key] = recent
                return False
            self.hits[key] = [*recent, now]
            if len(self.hits) > 50_000:  # bound the memory under a flood of distinct keys
                self.hits.clear()
            return True


LOGIN_LIMIT = Limiter(60, 60)      # login calls per IP per minute (a jury room shares one IP; 2 calls per login)
CHAT_LIMIT = Limiter(12, 60)       # chat questions per user per minute: each may be a paid model call
LOCK_AFTER, LOCK_SECONDS = 5, 300  # 5 wrong passwords or codes lock the account for 5 minutes


# ----------------------------------------------------------------------------- the access policy
CASE = r"/api/cases/(?P<case>[^/]+)"
# (method, path, rule). The first match decides; a path that matches nothing answers 404 (fail closed).
RULES = [
    ("GET", r"/api/health", "public"),
    ("*", r"/api/auth/[a-z-]+", "public"),            # the auth routes check the session themselves
    ("GET", r"/api/version", "signed_in"),
    ("GET", r"/api/templates", "signed_in"),
    ("GET", r"/api/companies", "signed_in"),          # filtered to the client's own company in the route
    ("GET", r"/api/cases", "by_role"),
    ("POST", r"/api/cases", "create_case"),
    ("GET", r"/api/notifications", "by_role"),
    ("GET", CASE + r"/(bundle|verify)", "staff"),
    ("POST", CASE + r"/(inbound|advance)", "demo"),
    ("POST", CASE + r"/exceptions/[^/]+/resolve", "decide"),
    ("POST", CASE + r"/release-hold", "release_hold"),
    ("POST", CASE + r"/chat", "chat"),
    ("GET", CASE + r"/(version|client-view|sample-files|sample-files/[^/]+)", "case_reader"),
    ("GET", CASE + r"/(documents|documents/[^/]+|messages|mentionables)", "by_role"),
    ("POST", CASE + r"/messages", "post_message"),
    ("POST", CASE + r"/(upload|upload-sample|client-confirm)", "case_client"),
    ("GET", r"/api/learning(/overview)?", "staff"),
    ("POST", r"/api/learning/proposals/[^/]+/backtest", "staff"),
    ("POST", r"/api/learning/proposals/[^/]+/promote", "promote"),
    ("POST", r"/api/demo/reset", "demo"),
    ("GET", r"/api/demo/sample-files(/[^/]+)?", "demo_case_reader"),
    ("POST", r"/api/registry", "demo"),
    ("GET", r"/api/users", "users"),
    ("POST", r"/api/users(/[^/]+/(disable|enable|reset-2fa))?", "users"),
]
_COMPILED = [(m, re.compile(p + r"/?"), rule) for m, p, rule in RULES]


class Denied(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail


class Req:
    """What the policy needs to know about one request (kept tiny so it is easy to test)."""

    def __init__(self, method: str, path: str, query: dict, body: dict | None, staff: dict | None, client: dict | None):
        self.method, self.path, self.query, self.body, self.staff, self.client = method, path, query, body, staff, client


def _staff(r: Req, perm: str | None = None) -> dict:
    if not r.staff:
        raise Denied(401, "sign in as bank staff")
    if perm and perm not in PERMS.get(r.staff["role"], set()):
        raise Denied(403, f"your role ({r.staff['role']}) may not do this")
    return r.staff


def _reader(r: Req, case_company: str | None) -> dict:
    """A client of the file's company, or any bank staff (who may preview the client's view)."""
    if r.client and case_company == r.client["company_id"]:
        return r.client
    if r.staff:
        return r.staff
    if r.client:
        raise Denied(404, "case not found")  # another company's file: as if it did not exist
    raise Denied(401, "sign in")


def _client(r: Req, case_company: str | None) -> dict:
    """The file's own client: uploads, confirmations and client messages are never made on the client's behalf."""
    if r.client and case_company == r.client["company_id"]:
        return r.client
    if r.client:
        raise Denied(404, "case not found")
    raise Denied(401 if not r.staff else 403, "only the client can do this, from the client portal")


def authorize(r: Req, case_company) -> tuple[dict | None, dict, dict | None]:
    """Decide one /api request. Returns (actor, query, body) with the identity fields stamped from the session.
    `case_company(case_id)` gives a file's company id, or None when the file does not exist."""
    for method, pattern, rule in _COMPILED:
        m = pattern.fullmatch(r.path)
        if m and method in ("*", r.method):
            break
    else:
        raise Denied(404, "Not Found")
    query, body = dict(r.query), (dict(r.body) if isinstance(r.body, dict) else r.body)
    case_id = m.groupdict().get("case") or (query.get("case_id", "demo-1") if rule == "demo_case_reader" else None)
    company = case_company(case_id) if case_id else None
    if case_id and company is None and not r.staff:
        raise Denied(404 if r.client else 401, "case not found" if r.client else "sign in")
    role = (body or {}).get("role") if r.method == "POST" else query.get("role")

    if rule == "public":
        return None, query, body
    if rule == "signed_in":
        if not (r.staff or r.client):
            raise Denied(401, "sign in")
        return r.client or r.staff, query, body
    if rule == "staff":
        return _staff(r), query, body
    if rule in ("decide", "release_hold", "promote", "users"):
        actor = _staff(r, rule)
        if rule != "users" and isinstance(body, dict):
            body["by"] = actor["staff_id"]  # the signed-in person decides, whatever the request says
        return actor, query, body
    if rule == "demo":
        if not demo_mode():
            raise Denied(404, "Not Found")
        return _staff(r, "demo"), query, body
    if rule in ("case_reader", "demo_case_reader"):
        if rule == "demo_case_reader" and not demo_mode():
            raise Denied(404, "Not Found")
        return _reader(r, company), query, body
    if rule == "case_client":
        return _client(r, company), query, body
    if rule == "by_role":  # role=employee is staff-only; role=client is the reader's own company
        if (role or ("client" if case_id else "employee")) == "employee":  # the routes' own defaults
            return _staff(r), query, body
        if case_id:
            return _reader(r, company), query, body
        if r.client:  # the company comes from the session, not from ?company_id=
            query["company_id"] = r.client["company_id"]
            return r.client, query, body
        return _staff(r), query, body  # staff previewing the portal as any company
    if rule == "create_case":
        if role == "client" and r.client:
            body["company_id"] = r.client["company_id"]
            return r.client, query, body
        return _staff(r), query, body  # staff open files, or preview "Start a new application" in the portal
    if rule == "chat":
        actor = _staff(r) if role == "employee" else _reader(r, company)
        if not CHAT_LIMIT.allow(actor["id"]):
            raise Denied(429, "too many questions; wait a minute")
        return actor, query, body
    if rule == "post_message":
        if role == "employee":
            actor = _staff(r)
            body["author"] = f"{actor['name']} ({actor['role']})"  # signed with the session's name
            return actor, query, body
        return _client(r, company), query, body
    raise Denied(404, "Not Found")


def actor(request: Request) -> dict | None:
    """The signed-in user the policy matched this request to (None for public routes or with OPENLOOP_AUTH=off)."""
    return request.scope.get("openloop.actor")


# ----------------------------------------------------------------------------- the middleware
def _cookies(scope) -> dict:
    raw = next((v.decode("latin-1") for k, v in scope.get("headers", []) if k == b"cookie"), "")
    out = {}
    for part in raw.split(";"):
        k, _, v = part.strip().partition("=")
        if k:
            out[k] = v
    return out


def _header(scope, name: bytes) -> str:
    return next((v.decode("latin-1") for k, v in scope.get("headers", []) if k == name), "")


def client_ip(scope) -> str:
    forwarded = _header(scope, b"x-forwarded-for")  # set by the platform's proxy (uvicorn --proxy-headers)
    return forwarded.split(",")[0].strip() if forwarded else (scope.get("client") or ("?",))[0]


SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),  # Google Sign-In checks the origin it sends
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"content-security-policy", b"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"),
]
PAGES = {"/": "staff", "/index.html": "staff", "/client/": "client", "/client/index.html": "client"}
API_DOCS = ("/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json")  # the API map: bank staff only


class PolicyMiddleware:
    """Pure ASGI, so the JSON body can be read, checked, stamped and replayed to the route unchanged in shape."""

    def __init__(self, app, case_company):
        self.app, self.case_company = app, case_company

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_secure(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers += SECURITY_HEADERS
                if _header(scope, b"x-forwarded-proto") == "https" or scope.get("scheme") == "https":
                    headers.append((b"strict-transport-security", b"max-age=31536000"))
                message = {**message, "headers": headers}
            await send(message)

        path = scope["path"]
        if not enabled():
            return await self.app(scope, receive, send_secure)
        cookies = _cookies(scope)
        if path in API_DOCS and not self._page_allowed("staff", cookies):
            return await _json(send_secure, 404, {"detail": "Not Found"})
        if not path.startswith("/api/"):
            need = PAGES.get(path)
            if need and login_page_built() and not self._page_allowed(need, cookies):
                target = "/login/?" + urlencode({"next": path, **({"app": "client"} if need == "client" else {})})
                return await _respond(send_secure, 302, b"", [(b"location", target.encode()),
                                                              (b"cache-control", b"no-cache")])
            return await self.app(scope, receive, send_secure)

        # read the body once (bounded), so a request can never be bigger than the largest legal upload
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > MAX_BODY:
                return await _json(send_secure, 413, {"detail": "request too large"})
            chunks.append(chunk)
            if not message.get("more_body"):
                break
        raw = b"".join(chunks)
        method = scope["method"]
        if method not in ("GET", "HEAD", "OPTIONS") and not _same_origin(scope):
            return await _json(send_secure, 403, {"detail": "cross-site request refused"})
        body = None
        if raw:
            try:
                body = json.loads(raw)
            except (json.JSONDecodeError, UnicodeDecodeError):
                body = None  # the route answers 422 for a malformed body
        query = dict(parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True))
        request = Req(method if method != "HEAD" else "GET", path.rstrip("/") or "/", query, body,
                           session_user(cookies.get(STAFF_COOKIE)), session_user(cookies.get(CLIENT_COOKIE)))
        if request.staff and request.staff["role"] == "client":
            request.staff = None  # a client token in the staff cookie never counts as staff
        if request.client and request.client["role"] != "client":
            request.client = None
        try:
            who, query2, body2 = authorize(request, self.case_company)
        except Denied as d:
            return await _json(send_secure, d.status, {"detail": d.detail})
        scope = dict(scope)
        scope["openloop.actor"] = who
        if query2 != query:
            scope["query_string"] = urlencode(query2).encode()
        if body2 != body and body2 is not None:
            raw = json.dumps(body2).encode()
            scope["headers"] = [(k, v) for k, v in scope["headers"] if k != b"content-length"] + [
                (b"content-length", str(len(raw)).encode())]
        sent = False

        async def replay():
            nonlocal sent
            if sent:
                return await receive()
            sent = True
            return {"type": "http.request", "body": raw, "more_body": False}

        return await self.app(scope, replay, send_secure)

    @staticmethod
    def _page_allowed(need: str, cookies: dict) -> bool:
        staff = session_user(cookies.get(STAFF_COOKIE))
        if staff and staff["role"] != "client":
            return True  # staff may open the portal too (preview as any company)
        client = session_user(cookies.get(CLIENT_COOKIE))
        return need == "client" and bool(client and client["role"] == "client")


def _same_origin(scope) -> bool:
    """CSRF defence in depth (the cookies are SameSite=Lax already): a browser's Origin must be this host or trusted."""
    origin = _header(scope, b"origin")
    if not origin:
        return True  # not a cross-site browser request (curl, server-to-server)
    host = _header(scope, b"x-forwarded-host") or _header(scope, b"host")
    trusted = {o.strip() for o in os.environ.get("TRUSTED_ORIGINS", "http://localhost:5173").split(",") if o.strip()}
    return origin.split("://", 1)[-1] == host or origin in trusted


async def _respond(send, status: int, body: bytes, headers: list):
    await send({"type": "http.response.start", "status": status,
                "headers": [(b"content-length", str(len(body)).encode()), *headers]})
    await send({"type": "http.response.body", "body": body})


async def _json(send, status: int, payload: dict):
    await _respond(send, status, json.dumps(payload).encode(), [(b"content-type", b"application/json")])


def login_page_built() -> bool:
    return (ROOT / "web" / "dist" / "login" / "index.html").exists()


# ----------------------------------------------------------------------------- routes: /api/auth/* and /api/users
router = APIRouter()


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class MfaIn(BaseModel):
    challenge: str = Field(min_length=10, max_length=2000)
    code: str = Field(min_length=6, max_length=10)


class GoogleIn(BaseModel):
    credential: str = Field(min_length=20, max_length=5000)


class LogoutIn(BaseModel):
    app: str = Field(default="all", pattern="^(staff|client|all)$")


class UserIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    name: str = Field(min_length=1, max_length=80)
    role: str = Field(pattern="^(client|analyst|supervisor|compliance|admin)$")
    company_id: str | None = Field(default=None, max_length=40)
    password: str | None = Field(default=None, min_length=8, max_length=200)


def _is_https(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


def _locked(user: dict) -> bool:
    return user["locked_until"] > time.time()


def _fail(user: dict) -> None:
    failed = user["failed"] + 1
    users().update(user["id"], failed=0 if failed >= LOCK_AFTER else failed,
                   locked_until=time.time() + LOCK_SECONDS if failed >= LOCK_AFTER else user["locked_until"])


def _challenge(user: dict, method: str) -> dict:
    return {"mfa_required": True, "method": "totp", "via": method, "name": user["name"],
            "challenge": sign({"k": "mfa", "u": user["id"], "via": method, "exp": time.time() + 300})}


def _limit(request: Request) -> None:
    if not LOGIN_LIMIT.allow(client_ip(request.scope)):
        raise HTTPException(429, "too many attempts; wait a minute")


@router.get("/api/health")
def health():
    return {"ok": True}


@router.get("/api/auth/me")
def me(request: Request):
    cookies = request.cookies
    staff, client = session_user(cookies.get(STAFF_COOKIE)), session_user(cookies.get(CLIENT_COOKIE))
    return {"auth": enabled(), "demo_logins": enabled() and demo_logins(), "demo_mode": demo_mode(),
            "google_client_id": os.environ.get("GOOGLE_CLIENT_ID") or None,
            "microsoft_client_id": os.environ.get("MICROSOFT_CLIENT_ID") or None,
            "staff": public(staff) if staff and staff["role"] != "client" else None,
            "client": public(client) if client and client["role"] == "client" else None,
            "perms": sorted(PERMS.get(staff["role"], set())) if staff and staff["role"] != "client" else []}


@router.post("/api/auth/login")
def login(body: LoginIn, request: Request):
    """Step 1 of 2: the password. The answer is a short-lived challenge for the one-time code, never a session."""
    _limit(request)
    user = users().by_email(body.email)
    if user and _locked(user):
        raise HTTPException(423, "too many failed attempts; try again in a few minutes")
    if not user or not user["active"] or not check_password(body.password, user["password_hash"]):
        if user:
            _fail(user)
        raise HTTPException(401, "wrong e-mail or password")
    users().update(user["id"], failed=0)
    return _challenge(user, "password")


@router.post("/api/auth/mfa")
def mfa(body: MfaIn, request: Request):
    """Step 2 of 2: the 6-digit code from the authenticator app. Sets the session cookie."""
    _limit(request)
    p = unsign(body.challenge, "mfa")
    user = users().get(p["u"]) if p else None
    if not user or not user["active"]:
        raise HTTPException(401, "the sign-in expired; start again")
    if _locked(user):
        raise HTTPException(423, "too many failed attempts; try again in a few minutes")
    code, now = re.sub(r"\D", "", body.code), totp_step()
    step = next((s for s in (now - 1, now, now + 1) if hmac.compare_digest(totp(user["totp_secret"], s), code)), None)
    if step is None or step <= user["totp_last_step"]:
        _fail(user)
        raise HTTPException(401, "wrong or already used code")
    users().update(user["id"], totp_last_step=step, failed=0, last_login=time.time())
    app = "client" if user["role"] == "client" else "staff"
    response = JSONResponse({"ok": True, "user": public(user), "app": app,
                             "next": "/client/" if app == "client" else "/"})
    response.set_cookie(CLIENT_COOKIE if app == "client" else STAFF_COOKIE,
                        sign({"k": "session", "u": user["id"], "v": user["session_version"],
                              "exp": time.time() + SESSION_HOURS * 3600}),
                        max_age=SESSION_HOURS * 3600, httponly=True, samesite="lax", secure=_is_https(request), path="/")
    return response


@router.post("/api/auth/logout")
def logout(body: LogoutIn, request: Request):
    response = JSONResponse({"ok": True})
    for app, name in (("staff", STAFF_COOKIE), ("client", CLIENT_COOKIE)):
        if body.app in (app, "all"):
            response.delete_cookie(name, path="/", httponly=True, samesite="lax", secure=_is_https(request))
    return response


GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
MICROSOFT_JWKS = "https://login.microsoftonline.com/common/discovery/v2.0/keys"  # every tenant + personal accounts
_JWKS: dict = {}  # url -> {"keys": {kid: public key}, "exp": time}


def _jwks_key(url: str, kid: str):
    """An identity provider's signing key by id, from its published key set (cached for an hour)."""
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    cached = _JWKS.get(url)
    if not cached or kid not in cached["keys"] or cached["exp"] < time.time():
        jwks = requests.get(url, timeout=5).json()
        cached = _JWKS[url] = {"keys": {k["kid"]: RSAPublicNumbers(int.from_bytes(_unb64(k["e"]), "big"),
                                                                   int.from_bytes(_unb64(k["n"]), "big")).public_key()
                                        for k in jwks.get("keys", []) if k.get("kty") == "RSA"},
                               "exp": time.time() + 3600}
    return cached["keys"].get(kid)


def _google_key(kid: str):
    return _jwks_key(GOOGLE_JWKS, kid)


def _microsoft_key(kid: str):
    return _jwks_key(MICROSOFT_JWKS, kid)


def _verified_claims(credential: str, key_for, provider: str) -> dict:
    """The claims of an RS256-signed ID token whose signature checks out against the provider's key."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    try:
        head, body, sig = credential.split(".")
        header, claims = json.loads(_unb64(head)), json.loads(_unb64(body))
        key = key_for(header.get("kid", "")) if header.get("alg") == "RS256" else None
        if key is None:
            raise ValueError("unknown signing key")
        key.verify(_unb64(sig), f"{head}.{body}".encode(), padding.PKCS1v15(), hashes.SHA256())
    except (ValueError, InvalidSignature, json.JSONDecodeError, requests.RequestException):
        raise HTTPException(401, f"{provider} sign-in could not be verified")
    return claims


def verify_google(credential: str, client_id: str) -> dict:
    """Verifies a Google ID token (RS256 against Google's published keys, issuer, audience, expiry, verified e-mail)."""
    claims = _verified_claims(credential, _google_key, "Google")
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com") or claims.get("aud") != client_id \
            or claims.get("exp", 0) < time.time() or not claims.get("email_verified"):
        raise HTTPException(401, "Google sign-in could not be verified")
    return claims


def verify_microsoft(credential: str, client_id: str) -> dict:
    """Verifies a Microsoft identity platform (Entra ID / Teams / personal account) v2.0 ID token: RS256 against
    Microsoft's keys, the issuer of the token's own tenant, audience, expiry and not-before."""
    claims = _verified_claims(credential, _microsoft_key, "Microsoft")
    tid, now = claims.get("tid", ""), time.time()
    if not re.fullmatch(r"[0-9a-f-]{36}", tid) or claims.get("iss") != f"https://login.microsoftonline.com/{tid}/v2.0" \
            or claims.get("aud") != client_id or claims.get("exp", 0) < now or claims.get("nbf", 0) > now + 60:
        raise HTTPException(401, "Microsoft sign-in could not be verified")
    email = claims.get("email") or claims.get("preferred_username") or ""
    if "@" not in email:
        raise HTTPException(401, "Microsoft sign-in did not include an e-mail address")
    return claims | {"email": email, "ms_sub": f"{tid}:{claims.get('oid') or claims.get('sub')}"}


@router.post("/api/auth/google")
def google(body: GoogleIn, request: Request):
    """Google proves the e-mail address; the account must already exist (the bank provisions its users) and the
    bank's one-time code is still asked afterwards."""
    _limit(request)
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(404, "Google sign-in is not configured")
    claims = verify_google(body.credential, client_id)
    user = users().by_email(claims["email"])
    if not user or not user["active"] or (user["google_sub"] and user["google_sub"] != claims["sub"]):
        raise HTTPException(403, "no OpenLoop account for this Google account; ask the bank to add you")
    if not user["google_sub"]:
        users().update(user["id"], google_sub=claims["sub"])
    return _challenge(user, "google")


@router.post("/api/auth/microsoft")
def microsoft(body: GoogleIn, request: Request):
    """Microsoft (Entra ID: work and school accounts such as Teams, and personal accounts) proves the e-mail address,
    as Google does. The account must exist, and the first sign-in binds it to that Microsoft identity (tenant +
    object id), so a look-alike e-mail from another tenant can't take it over later. The bank's code is still asked."""
    _limit(request)
    client_id = os.environ.get("MICROSOFT_CLIENT_ID")
    if not client_id:
        raise HTTPException(404, "Microsoft sign-in is not configured")
    claims = verify_microsoft(body.credential, client_id)
    user = users().by_email(claims["email"])
    if not user or not user["active"] or (user["ms_sub"] and user["ms_sub"] != claims["ms_sub"]):
        raise HTTPException(403, "no OpenLoop account for this Microsoft account; ask the bank to add you")
    if not user["ms_sub"]:
        users().update(user["id"], ms_sub=claims["ms_sub"])
    return _challenge(user, "microsoft")


@router.get("/api/auth/demo-accounts")
def demo_accounts():
    """Demo only (DEMO_LOGINS=1): the synthetic accounts with the code their authenticator would show right now.
    This stands in for the bank's mobile app on the projector; production sets DEMO_LOGINS=0."""
    if not (enabled() and demo_logins()):
        raise HTTPException(404, "Not Found")
    now = time.time()
    demo_emails = {e for e, *_ in DEMO_STAFF} | {p["email"] for p in profiles.PROFILES.values()}
    order = {r: i for i, r in enumerate(STAFF_ROLES)} | {p: len(STAFF_ROLES) + i for i, p in enumerate(profiles.PROFILES)}
    rows = sorted(users().all(), key=lambda u: order.get(u["company_id"] or u["role"], 99))  # analyst and demo-1 first
    return {"password": os.environ.get("DEMO_PASSWORD", "demo"), "seconds_left": 30 - int(now % 30),
            "accounts": [public(u) | {"code": totp(u["totp_secret"], max(totp_step(now), u["totp_last_step"] + 1))}
                         for u in rows if u["email"] in demo_emails]}


def _guard_admin(request: Request, role: str) -> None:
    """Supervisors manage analysts, compliance and clients; only an admin creates or changes an admin."""
    me_ = actor(request)
    if role == "admin" and me_ and me_["role"] != "admin":
        raise HTTPException(403, "only an admin can manage admin accounts")


@router.get("/api/users")
def list_users():
    return [public(u) for u in users().all()]


@router.post("/api/users")
def create_user(body: UserIn, request: Request):
    """Adds a user. The answer carries the authenticator setup link once (scan it as a QR code, or type the secret)."""
    _guard_admin(request, body.role)
    try:
        user = users().create(body.email, body.name, body.role, body.password,
                              company_id=body.company_id if body.role == "client" else None)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return {"user": public(user), "otpauth_uri": otpauth_uri(user), "totp_secret": user["totp_secret"]}


@router.post("/api/users/{user_id}/{action}")
def change_user(user_id: str, action: str, request: Request):
    user = users().get(user_id)
    if not user:
        raise HTTPException(404, "user not found")
    _guard_admin(request, user["role"])
    me_ = actor(request)
    if me_ and me_["id"] == user_id and action == "disable":
        raise HTTPException(409, "you cannot disable your own account")
    if action == "disable":
        users().update(user_id, active=0)
        users().bump_session(user_id)
    elif action == "enable":
        users().update(user_id, active=1, failed=0, locked_until=0)
    elif action == "reset-2fa":
        users().update(user_id, totp_secret=new_totp_secret(), totp_last_step=0)
        users().bump_session(user_id)
        user = users().get(user_id)
        return {"user": public(user), "otpauth_uri": otpauth_uri(user), "totp_secret": user["totp_secret"]}
    else:
        raise HTTPException(404, "Not Found")
    return {"user": public(users().get(user_id))}


def install(app, case_company) -> None:
    """Wire the policy and the auth routes into the app (call before the static mount)."""
    app.include_router(router)
    app.add_middleware(PolicyMiddleware, case_company=case_company)


if __name__ == "__main__":  # python -m app.auth add <email> <name> <role> [company_id]   (from backend/)
    import argparse
    import getpass
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    ap = argparse.ArgumentParser(description="OpenLoop users")
    sub = ap.add_subparsers(dest="cmd", required=True)
    add = sub.add_parser("add")
    add.add_argument("email")
    add.add_argument("name")
    add.add_argument("role", choices=ROLES)
    add.add_argument("company_id", nargs="?")
    sub.add_parser("list")
    args = ap.parse_args()
    if args.cmd == "list":
        for u in users().all():
            print(f"{u['email']:40} {u['role']:11} {u['company_id'] or u['staff_id'] or ''}")
    else:
        u = users().create(args.email, args.name, args.role, getpass.getpass("Password: "), company_id=args.company_id)
        print(f"created {u['email']} ({u['role']}). Add this to the authenticator app:\n{otpauth_uri(u)}")
