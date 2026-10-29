"""Login (password + TOTP), sessions and the access policy (OPENLOOP_AUTH=on)."""
import re

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app

ANA, IOANA, VICTOR = "ana.pop@bank.example", "ioana.marin@bank.example", "victor.stan@bank.example"
AURORA, VERDE = "andrei.munteanu@brutaria-aurora.example", "office@verde-logistic.example"


@pytest.fixture(autouse=True)
def auth_on(monkeypatch):
    monkeypatch.setenv("OPENLOOP_AUTH", "on")
    monkeypatch.setenv("DEMO_LOGINS", "1")
    for limiter in (auth.LOGIN_LIMIT, auth.CHAT_LIMIT):
        limiter.hits.clear()
    for u in auth.users().all():  # earlier tests may have locked an account
        auth.users().update(u["id"], failed=0, locked_until=0)


def code_for(email: str) -> str:
    u = auth.users().by_email(email)
    return auth.totp(u["totp_secret"], max(auth.totp_step(), u["totp_last_step"] + 1))


def signed_in(email: str, password: str = "demo") -> TestClient:
    """The real two-step login. A code is single use and only the neighbouring 30 s steps are accepted, so one user
    can sign in about twice per window: the policy tests below use `session()` instead."""
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200 and r.json()["mfa_required"], r.text
    r = c.post("/api/auth/mfa", json={"challenge": r.json()["challenge"], "code": code_for(email)})
    assert r.status_code == 200, r.text
    return c


def session(email: str) -> TestClient:
    """A client holding the same signed cookie a completed login sets."""
    u = auth.users().by_email(email)
    c = TestClient(app)
    c.cookies.set(auth.CLIENT_COOKIE if u["role"] == "client" else auth.STAFF_COOKIE,
                  auth.sign({"k": "session", "u": u["id"], "v": u["session_version"], "exp": 9e9}))
    return c


@pytest.fixture(scope="module")
def fresh():
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("OPENLOOP_AUTH", "on")
        assert session(ANA).post("/api/demo/reset?all=true", json={}).status_code == 200


def own_case(company_id: str) -> str:
    from app.main import CASES
    return next(cid for cid, c in CASES.items() if c.profile["id"] == company_id)


def test_signed_out_gets_nothing(fresh):
    c = TestClient(app)
    assert c.get("/api/health").status_code == 200
    for path in ("/api/cases", "/api/cases/demo-1/bundle", "/api/cases/demo-1/client-view", "/api/version",
                 "/api/learning", "/api/cases/demo-1/messages?role=client", "/api/notifications"):
        assert c.get(path).status_code == 401, path
    for path, body in (("/api/demo/reset?all=true", {}), ("/api/cases/demo-1/advance", {"days": 1}),
                       ("/api/cases/demo-1/chat", {"role": "client", "message": "hi"}),
                       ("/api/cases/demo-1/client-confirm", {"kind": "credit_check_consent", "answer": "yes"})):
        assert c.post(path, json=body).status_code == 401, path
    assert c.get("/api/no-such-route").status_code == 404  # fail closed: unknown paths never reach a route


def test_every_api_route_has_a_policy_rule():
    """A new route without a rule would answer 404 for everyone; this catches it before a demo does."""
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith("/api/"):
            continue
        concrete = re.sub(r"\{[^}]+\}", lambda m: "disable" if m.group() == "{action}" else "x", path)
        for method in route.methods - {"HEAD"}:
            assert any(m in ("*", method) and p.fullmatch(concrete) for m, p, _ in auth._COMPILED), (method, path)


def test_login_needs_password_and_a_fresh_code():
    c = TestClient(app)
    assert c.post("/api/auth/login", json={"email": ANA, "password": "wrong"}).status_code == 401
    challenge = c.post("/api/auth/login", json={"email": ANA, "password": "demo"}).json()["challenge"]
    assert c.post("/api/auth/mfa", json={"challenge": challenge, "code": "000000"}).status_code == 401
    code = code_for(ANA)
    assert c.post("/api/auth/mfa", json={"challenge": challenge, "code": code}).status_code == 200
    me = c.get("/api/auth/me").json()
    assert me["staff"]["email"] == ANA and me["staff"]["role"] == "analyst" and me["client"] is None
    assert "totp_secret" not in me["staff"] and "password_hash" not in me["staff"]
    again = TestClient(app)
    ch2 = again.post("/api/auth/login", json={"email": ANA, "password": "demo"}).json()["challenge"]
    assert again.post("/api/auth/mfa", json={"challenge": ch2, "code": code}).status_code == 401  # single use


def test_a_password_alone_never_gives_a_session():
    c = TestClient(app)
    c.post("/api/auth/login", json={"email": ANA, "password": "demo"})
    assert c.get("/api/cases").status_code == 401


def test_lockout_after_repeated_failures():
    c = TestClient(app)
    for _ in range(auth.LOCK_AFTER):
        c.post("/api/auth/login", json={"email": VICTOR, "password": "nope"})
    assert c.post("/api/auth/login", json={"email": VICTOR, "password": "demo"}).status_code == 423


def test_forged_or_tampered_cookie_is_ignored():
    c = session(ANA)
    token = c.cookies.get(auth.STAFF_COOKIE)
    body, sig = token.split(".")
    c.cookies.set(auth.STAFF_COOKIE, body + "." + sig[:-2] + ("AA" if sig[-2:] != "AA" else "BB"))
    assert c.get("/api/cases").status_code == 401


def test_client_sees_only_its_own_company(fresh):
    c = session(VERDE)
    rows = c.get("/api/cases?role=client&company_id=aurora").json()  # asks for another company...
    assert rows and {r["company_id"] for r in rows} == {"verde"}  # ...and gets its own files only
    mine = own_case("verde")
    assert c.get(f"/api/cases/{mine}/client-view").status_code == 200
    assert c.get("/api/cases/demo-1/client-view").status_code == 404  # another company's file "does not exist"
    assert c.get(f"/api/cases/{mine}/bundle").status_code == 401  # the bank's bundle is staff-only
    assert c.get(f"/api/cases/{mine}/messages?role=employee").status_code == 401
    assert c.get(f"/api/cases/{mine}/documents?role=employee").status_code == 401
    assert c.get("/api/cases?role=employee").status_code == 401
    companies = c.get("/api/companies").json()
    assert [x["id"] for x in companies] == ["verde"] and "story" not in companies[0]


def test_client_cannot_act_on_another_companys_file(fresh):
    c = session(VERDE)
    assert c.post("/api/cases/demo-1/client-confirm",
                  json={"kind": "credit_check_consent", "answer": "yes"}).status_code == 404
    assert c.post("/api/cases/demo-1/messages", json={"role": "client", "text": "hi"}).status_code == 404
    assert c.post("/api/cases/demo-1/upload-sample", json={"key": "onrc_certificate"}).status_code == 404
    new = c.post("/api/cases", json={"template": "sme_loan", "company_id": "aurora", "role": "client"})
    assert new.status_code == 200 and new.json()["case"]["company_id"] == "verde"  # the session decides


def test_staff_cannot_act_as_the_client(fresh):
    c = session(ANA)
    assert c.get("/api/cases/demo-1/client-view").status_code == 200  # staff may preview what the client sees
    assert c.post("/api/cases/demo-1/client-confirm",
                  json={"kind": "credit_check_consent", "answer": "yes"}).status_code == 403
    assert c.post("/api/cases/demo-1/messages", json={"role": "client", "text": "I am the client"}).status_code == 403


def test_roles_limit_what_staff_may_change(fresh):
    ana = session(ANA)
    assert ana.post("/api/cases/demo-1/release-hold", json={"by": "compliance-1"}).status_code == 403
    assert ana.post("/api/learning/proposals/P-address-variant/promote", json={"by": "supervisor-1"}).status_code == 403
    assert ana.get("/api/users").status_code == 403
    victor = session(VICTOR)
    assert victor.post("/api/cases/demo-1/release-hold", json={"by": "x"}).status_code == 409  # allowed; not on hold


def test_identity_comes_from_the_session(fresh):
    ana = session(ANA)
    thread = ana.post("/api/cases/demo-1/messages",
                      json={"role": "employee", "author": "The CEO", "text": "Please send the certificate."}).json()
    assert thread[-1]["author"]["name"] == "Ana Pop (analyst)"
    case = own_case("medica")
    ex = next(x for x in ana.get(f"/api/cases/{case}/bundle").json()["exceptions"] if x["status"] == "OPEN")
    ioana = session(IOANA)
    r = ioana.post(f"/api/cases/{case}/exceptions/{ex['id']}/resolve",
                   json={"action_id": ex["actions"][0]["id"], "by": "analyst-1"})
    assert r.status_code == 200
    resolved = next(e for e in r.json()["events"] if e["type"] == "EXCEPTION_RESOLVED")
    assert resolved["actor"]["id"] == "supervisor-1"  # not the name typed in the request


def test_cross_site_post_and_huge_body_are_refused(fresh):
    c = session(ANA)
    assert c.post("/api/cases/demo-1/advance", json={"days": 1},
                  headers={"Origin": "https://evil.example"}).status_code == 403
    assert c.post("/api/cases/demo-1/messages", content=b"x" * (auth.MAX_BODY + 1),
                  headers={"Content-Type": "application/json"}).status_code == 413


def test_disabled_user_is_signed_out_everywhere(fresh):
    client = session(AURORA)
    case = own_case("aurora")
    assert client.get(f"/api/cases/{case}/client-view").status_code == 200
    admin = session("admin@bank.example")
    uid = auth.users().by_email(AURORA)["id"]
    assert admin.post(f"/api/users/{uid}/disable", json={}).status_code == 200
    assert client.get(f"/api/cases/{case}/client-view").status_code == 401
    assert admin.post(f"/api/users/{uid}/enable", json={}).status_code == 200


def test_admin_adds_a_user_who_can_then_sign_in(fresh):
    admin = session("admin@bank.example")
    r = admin.post("/api/users", json={"email": "new.analyst@bank.example", "name": "New Analyst",
                                       "role": "analyst", "password": "a-long-password"})
    assert r.status_code == 200 and r.json()["otpauth_uri"].startswith("otpauth://totp/")
    assert "password_hash" not in r.json()["user"]
    c = signed_in("new.analyst@bank.example", "a-long-password")
    assert c.get("/api/cases").status_code == 200
    supervisor = session(IOANA)
    assert supervisor.post("/api/users", json={"email": "boss@bank.example", "name": "Boss", "role": "admin",
                                               "password": "a-long-password"}).status_code == 403


def test_demo_accounts_list_live_codes_without_secrets():
    data = TestClient(app).get("/api/auth/demo-accounts").json()
    assert data["password"] == "demo" and len(data["accounts"]) >= 12
    assert all(re.fullmatch(r"\d{6}", a["code"]) and "totp_secret" not in a for a in data["accounts"])


def test_totp_matches_rfc6238_vector():
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # base32 of "12345678901234567890" (RFC 6238 appendix B)
    assert auth.totp(secret, 59 // 30) == "287082"
    assert auth.totp(secret, 1111111109 // 30) == "081804"


def test_two_screen_demo_with_login_on(fresh):
    """The README demo with login on: one browser holds the analyst's and the client's cookies (bank screen and
    portal side by side), compliance releases the hold, and the portal never shows internal words."""
    browser = session(ANA)
    aurora = auth.users().by_email(AURORA)
    browser.cookies.set(auth.CLIENT_COOKIE, auth.sign({"k": "session", "u": aurora["id"], "v": aurora["session_version"],
                                                       "exp": 9e9}))
    post = lambda path, body=None: browser.post(f"/api/cases/demo-1/{path}", json=body or {})  # noqa: E731
    assert browser.post("/api/demo/reset", json={}).status_code == 200
    assert post("inbound", {"item_id": "day0-pack"}).status_code == 200
    assert post("client-confirm", {"kind": "credit_check_consent", "answer": "yes"}).status_code == 200  # portal
    assert post("upload-sample", {"key": "onrc_certificate", "variant": "wrong_company"}).status_code == 200
    post("advance", {"days": 3})
    b = post("inbound", {"item_id": "onrc-cert"}).json()
    post("inbound", {"item_id": "client-email"})
    cards = {x["kind"]: x["id"] for x in b["exceptions"] if x["status"] == "OPEN"}
    post(f"exceptions/{cards['address_uncertain']}/resolve", {"action_id": "same_address"})
    post(f"exceptions/{cards['ubo_discrepancy']}/resolve", {"action_id": "confirm_discrepancy"})
    b = post("inbound", {"item_id": "updated-docs"}).json()
    assert b["case"]["status"] == "READY_FOR_DECISION"
    post("inbound", {"item_id": "staff-phone-change"})
    assert post("client-confirm", {"kind": "contact_change", "answer": "no"}).status_code == 200  # "No, I didn't"
    b = post("inbound", {"item_id": "staff-credit-check"}).json()
    insider = next(x for x in b["exceptions"] if x["status"] == "OPEN" and x["kind"] == "sequence_insider")
    b = post(f"exceptions/{insider['id']}/resolve", {"action_id": "escalate_compliance"}).json()
    assert b["case"]["status"] == "ON_HOLD"
    assert post("release-hold", {"by": "analyst-1", "note": "checked"}).status_code == 403  # an analyst cannot
    b = session(VICTOR).post("/api/cases/demo-1/release-hold", json={"by": "analyst-1", "note": "checked"}).json()
    released = next(e for e in reversed(b["events"]) if e["type"] == "CASE_STATUS" and e["actor"]["type"] == "compliance")
    assert released["actor"]["id"] == "compliance-1" and b["case"]["status"] != "ON_HOLD"
    view = browser.get("/api/cases/demo-1/client-view").text
    for word in ("HR-0", "SR-0", "GATE-", "analyst-1", "E-0317", "judge", "insider"):
        assert word not in view, word
    assert browser.get("/api/cases/demo-1/verify").json()["ok"]


def test_api_docs_are_for_staff_only():
    assert TestClient(app).get("/openapi.json").status_code == 404
    assert TestClient(app).get("/docs").status_code == 404
    assert session(ANA).get("/openapi.json").status_code == 200
    assert session(VERDE).get("/openapi.json").status_code == 404


def _google_token(key, claims: dict, kid: str = "k1") -> str:
    import base64
    import json as _json
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()  # noqa: E731
    head = b64(_json.dumps({"alg": "RS256", "kid": kid}).encode())
    body = b64(_json.dumps(claims).encode())
    sig = key.sign(f"{head}.{body}".encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{head}.{body}.{b64(sig)}"


def test_google_sign_in_verifies_the_token_then_asks_for_the_code(monkeypatch):
    import time as _time
    from cryptography.hazmat.primitives.asymmetric import rsa
    key, other = (rsa.generate_private_key(public_exponent=65537, key_size=2048) for _ in range(2))
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setattr(auth, "_google_key", lambda kid: key.public_key() if kid == "k1" else None)
    good = {"iss": "https://accounts.google.com", "aud": "test-client.apps.googleusercontent.com", "sub": "g-123",
            "email": VICTOR, "email_verified": True, "exp": _time.time() + 600}
    c = TestClient(app)
    r = c.post("/api/auth/google", json={"credential": _google_token(key, good)})
    assert r.status_code == 200 and r.json()["mfa_required"] and r.json()["via"] == "google"
    assert c.get("/api/cases").status_code == 401  # Google alone is not a session: the bank's code comes next
    for bad in ({**good, "aud": "someone-else"}, {**good, "exp": _time.time() - 1}, {**good, "iss": "evil.example"},
                {**good, "email_verified": False}):
        assert c.post("/api/auth/google", json={"credential": _google_token(key, bad)}).status_code == 401
    assert c.post("/api/auth/google", json={"credential": _google_token(other, good)}).status_code == 401  # forged
    stranger = {**good, "email": "nobody@gmail.example", "sub": "g-999"}
    assert c.post("/api/auth/google", json={"credential": _google_token(key, stranger)}).status_code == 403
    hijack = {**good, "sub": "g-other"}  # the account is now bound to g-123
    assert c.post("/api/auth/google", json={"credential": _google_token(key, hijack)}).status_code == 403
    auth.users().update(auth.users().by_email(VICTOR)["id"], google_sub=None)


def test_microsoft_sign_in_checks_tenant_issuer_and_binds_the_identity(monkeypatch):
    import time as _time
    from cryptography.hazmat.primitives.asymmetric import rsa
    key, other = (rsa.generate_private_key(public_exponent=65537, key_size=2048) for _ in range(2))
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", "11111111-2222-3333-4444-555555555555")
    monkeypatch.setattr(auth, "_microsoft_key", lambda kid: key.public_key() if kid == "k1" else None)
    tid = "9188040d-6c67-4c5b-b112-36a304b66dad"  # the personal-accounts tenant
    good = {"iss": f"https://login.microsoftonline.com/{tid}/v2.0", "aud": "11111111-2222-3333-4444-555555555555",
            "tid": tid, "oid": "o-1", "sub": "s-1", "preferred_username": IOANA, "exp": _time.time() + 600,
            "nbf": _time.time() - 5}
    c = TestClient(app)
    r = c.post("/api/auth/microsoft", json={"credential": _google_token(key, good)})
    assert r.status_code == 200 and r.json()["mfa_required"] and r.json()["via"] == "microsoft"
    assert c.get("/api/cases").status_code == 401  # Microsoft alone is not a session: the bank's code comes next
    other_tenant = "72f988bf-86f1-41af-91ab-2d7cd011db47"
    for bad in ({**good, "aud": "someone-else"}, {**good, "exp": _time.time() - 1},
                {**good, "iss": f"https://login.microsoftonline.com/{other_tenant}/v2.0"},  # issuer of another tenant
                {**good, "nbf": _time.time() + 3600}, {**good, "preferred_username": "no-at-sign"}):
        assert c.post("/api/auth/microsoft", json={"credential": _google_token(key, bad)}).status_code == 401
    assert c.post("/api/auth/microsoft", json={"credential": _google_token(other, good)}).status_code == 401  # forged
    # the account is now bound to tid:o-1; the same e-mail from another tenant is refused
    lookalike = {**good, "tid": other_tenant, "iss": f"https://login.microsoftonline.com/{other_tenant}/v2.0", "oid": "o-9"}
    assert c.post("/api/auth/microsoft", json={"credential": _google_token(key, lookalike)}).status_code == 403
    assert TestClient(app).get("/api/auth/me").json()["microsoft_client_id"] == "11111111-2222-3333-4444-555555555555"
    auth.users().update(auth.users().by_email(IOANA)["id"], ms_sub=None)


def test_old_user_table_gets_the_microsoft_column(tmp_path):
    import sqlite3
    db = tmp_path / "old.db"
    con = sqlite3.connect(db)
    old_schema = "\n".join(line for line in auth.SCHEMA.splitlines() if "ms_sub" not in line)
    assert "ms_sub" not in old_schema
    con.executescript(old_schema)
    con.close()
    assert "ms_sub" in {r[1] for r in auth.Users(str(db)).db.execute("PRAGMA table_info(users)")}
