"""Real-browser end-to-end tests: the login, the bank app, the client portal and the learned-check panel.

They drive the built UI (web/dist) on a running server through Playwright and the installed Edge, so the normal
`python -m pytest` run skips this module unless E2E_BASE is set. Run the server offline (AGENT_MODE=scripted
JUDGE_MODE=heuristic EMAIL_MODE=outbox, a throwaway OPENLOOP_DB) and see README.md in this folder for the command.

- Every test starts from POST /api/demo/reset?all=true, sent through a signed-in staff session, in a new browser
  context (so localStorage, including the openloop-seen:* read state, starts empty).
- Any console error or uncaught page error fails the test, except the HTTP errors a test provokes on purpose.
- TOTP codes are single use and only the neighbouring 30 s steps are accepted, so each account signs in through the
  API once per run and its cookies are reused; a sign-in whose code was already used waits for the next step.
- The learned-check test runs last: a promoted check lives in the server's memory (see its docstring).
"""
from __future__ import annotations

import os
import re
import tempfile
import time
from pathlib import Path

import pytest

BASE = os.environ.get("E2E_BASE", "").rstrip("/")
if not BASE:
    pytest.skip("E2E_BASE is not set: the browser tests need a running server", allow_module_level=True)
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import Browser, BrowserContext, Page, expect, sync_playwright  # noqa: E402

CHANNEL = os.environ.get("E2E_CHANNEL", "msedge")          # the installed Edge; no browser download needed
SHOTS = Path(os.environ.get("E2E_SHOTS") or Path(tempfile.gettempdir()) / "openloop-e2e")
PASSWORD = os.environ.get("E2E_PASSWORD", "demo")
SLOW = 20_000  # ms: an agent turn in scripted mode takes well under a second, this is only headroom

ANA = "ana.pop@bank.example"                               # analyst
IOANA = "ioana.marin@bank.example"                         # supervisor
VICTOR = "victor.stan@bank.example"                        # compliance: sends the resets, so Ana's codes stay free
ADMIN = "admin@bank.example"
AURORA = "andrei.munteanu@brutaria-aurora.example"         # the client of demo-1
VERDE = "office@verde-logistic.example"                    # another company's client
INTERNAL = re.compile(r"HR-0|SR-0|GATE-|judge|insider|analyst-1|E-0317", re.I)
DESKTOP = {"width": 1440, "height": 900}
# The case screens start with both side panels folded, remembered per case in localStorage (web/src/shared/panels.ts).
# The tests click the checklist and the right-panel tabs, so each context starts with them open, unless the case
# already has a record (then a test's own folding is kept across reloads).
OPEN_PANELS = """(() => { try {
  const ids = ['demo-1'].concat(Array.from({ length: 60 }, (_, i) => 'case-' + (i + 2)));
  for (const id of ids) for (const [app, tab] of [['bank', 'ask'], ['client', 'messages']]) {
    const k = 'ol:' + app + ':panels:' + id;
    if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify({ left: true, right: true, tab }));
  }
} catch (e) { /* about:blank has no storage */ } })();"""

expect.set_options(timeout=SLOW)


# ----------------------------------------------------------------------------- browser, sessions, console guard
@pytest.fixture(scope="session")
def pw():
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(pw):
    b = pw.chromium.launch(channel=CHANNEL, headless=os.environ.get("E2E_HEADED") != "1")
    yield b
    b.close()


def api_sign_in(req, email: str) -> None:
    """Password, then the code the demo authenticator shows (GET /api/auth/demo-accounts), as the login page does."""
    r = req.post("/api/auth/login", data={"email": email, "password": PASSWORD})
    assert r.ok, f"password step for {email}: {r.status} {r.text()}"
    challenge = r.json()["challenge"]
    for _ in range(3):
        demo = req.get("/api/auth/demo-accounts").json()
        code = next(a["code"] for a in demo["accounts"] if a["email"] == email)
        r = req.post("/api/auth/mfa", data={"challenge": challenge, "code": code})
        if r.ok:
            return
        time.sleep(demo["seconds_left"] + 1)  # this account's code for the step was used already: wait for the next
    raise AssertionError(f"could not sign in {email}: {r.status} {r.text()}")


class Sessions:
    """One signed-in API context per account for the whole run; its cookies seed the browser contexts."""

    def __init__(self, pw):
        self.pw, self.api = pw, {}

    def request(self, email: str):
        if email not in self.api:
            req = self.pw.request.new_context(base_url=BASE)
            api_sign_in(req, email)
            self.api[email] = req
        return self.api[email]

    def cookies(self, email: str) -> list[dict]:
        return self.request(email).storage_state()["cookies"]

    def close(self):
        for req in self.api.values():
            req.dispose()


@pytest.fixture(scope="session")
def sessions(pw):
    s = Sessions(pw)
    yield s
    s.close()


class Console:
    """Collects console errors and uncaught exceptions from every page of the test's contexts."""

    def __init__(self):
        self.errors: list[str] = []
        self.allowed: list[re.Pattern] = []

    def watch(self, page: Page, name: str = "page") -> None:
        def on_console(m):
            if m.type == "error":
                self.errors.append(f"{name}: console error: {m.text} (at {m.location.get('url', '')})")
        page.on("console", on_console)
        page.on("pageerror", lambda e: self.errors.append(f"{name}: page error: {e}"))

    def allow(self, pattern: str) -> None:
        """An HTTP error the test provokes on purpose (Chromium logs every 4xx response as a console error)."""
        self.allowed.append(re.compile(pattern))

    def check(self) -> None:
        bad = [e for e in self.errors if not any(p.search(e) for p in self.allowed)]
        assert not bad, "console errors:\n" + "\n".join(bad)


@pytest.fixture
def console():
    c = Console()
    yield c
    c.check()


@pytest.fixture
def browse(browser: Browser, sessions: Sessions, console: Console, request):
    """open(*emails, viewport=…, scale=…) gives a new context signed in as those accounts (staff and client cookies
    can live side by side). On a failure every open page is saved as a screenshot."""
    contexts: list[BrowserContext] = []

    def open_(*emails: str, viewport: dict | None = None, scale: float = 1, mobile: bool = False) -> BrowserContext:
        ctx = browser.new_context(base_url=BASE, viewport=viewport or DESKTOP, device_scale_factor=scale,
                                  is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(OPEN_PANELS)
        for e in emails:
            ctx.add_cookies(sessions.cookies(e))
        ctx.on("page", lambda p: console.watch(p, f"page {len(ctx.pages)}"))
        contexts.append(ctx)
        return ctx

    yield open_
    failed = getattr(request.node, "rep_call", None) is not None and request.node.rep_call.failed
    for i, ctx in enumerate(contexts):
        if failed:
            for j, p in enumerate(ctx.pages):
                try:
                    shot(p, f"FAILED-{request.node.name}-{i}-{j}")
                except Exception:  # noqa: BLE001 - best effort only
                    pass
        ctx.close()


@pytest.fixture(autouse=True)
def fresh_demo(sessions: Sessions):
    r = sessions.request(VICTOR).post("/api/demo/reset?all=true")
    assert r.ok, f"reset: {r.status} {r.text()}"


def shot(page: Page, name: str) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / f"{name}.png"))


def no_internal_words(page: Page) -> None:
    text = page.locator("body").inner_text()
    hits = sorted({m.group(0) for m in INTERNAL.finditer(text)})
    assert not hits, f"internal words on the client portal: {hits}"


def overflow(page: Page) -> int:
    return page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


# ----------------------------------------------------------------------------- bank-screen helpers
def status_line(page: Page):
    return page.locator(".casehead .case-line")


def verified(page: Page):
    return page.locator(".case-meta .m").filter(has_text="checks verified").locator("b")


def dock(page: Page):
    return page.get_by_role("toolbar", name=re.compile("demo", re.I))


def next_event(page: Page, label: str) -> None:
    btn = page.get_by_test_id("dock-next")
    expect(btn).to_have_text(label)
    expect(btn).to_be_enabled()
    btn.click()


def card(page: Page, title: str):
    return page.locator("article.decision").filter(has=page.get_by_role("heading", name=re.compile(re.escape(title))))


def decide(page: Page, label: str) -> None:
    page.locator("article.decision").get_by_role("button", name=re.compile("^" + re.escape(label))).click()


def tab(page: Page, name: str) -> None:
    page.get_by_role("tab", name=re.compile("^" + name)).click()


def open_case(ctx: BrowserContext, case_id: str = "demo-1") -> Page:
    page = ctx.new_page()
    page.goto(f"/#/case/{case_id}")
    expect(page.get_by_test_id("dock-next")).to_be_visible()
    return page


# ============================================================================= 1. login
def test_login_through_demo_authenticator(browse, console):
    console.allow(r"status of 401.*/api/auth/mfa")  # the wrong code, on purpose
    page = browse().new_page()
    page.goto("/")
    expect(page).to_have_url(re.compile(r"/login/\?next=%2F$"))
    authenticator = page.get_by_role("complementary", name="Demo authenticator")
    expect(authenticator).to_be_visible()
    shot(page, "01-login")

    authenticator.get_by_role("button", name=re.compile(r"^Ana Pop")).click()
    expect(page.get_by_role("heading", name="Your one-time code")).to_be_visible()
    shown = authenticator.get_by_role("button", name=re.compile(r"^Ana Pop")).locator(".lg-acct-code").inner_text()
    wrong = f"{(int(shown.replace(' ', '')) + 1) % 1_000_000:06d}"
    page.get_by_label("6-digit code").fill(wrong)
    page.get_by_role("button", name="Verify").click()
    expect(page.get_by_role("alert")).to_contain_text("wrong or already used code")
    expect(page).to_have_url(re.compile(r"/login/"))

    page.get_by_role("button", name="Use demo code").click()
    # signing in from a bare "/" lands staff on the work queue (Login.tsx destination)
    expect(page).to_have_url(f"{BASE}/#/")
    expect(page.get_by_role("heading", name="Work queue")).to_be_visible()
    expect(page.locator(".session-who b")).to_have_text("Ana Pop")
    expect(page.locator(".q-row")).to_have_count(8)

    page.get_by_role("button", name="Sign out").click()
    expect(page).to_have_url(re.compile(r"/login/$"))
    expect(page.get_by_role("heading", name="Sign in")).to_be_visible()

    # signed out, the work queue's own URL asks for a sign-in again, and the sign-in returns to it
    page.goto("/#/")
    expect(page).to_have_url(re.compile(r"/login/\?next=%2F#/$"))
    sign_in_in_ui(page, console, re.compile(r"^Victor Stan"))
    expect(page).to_have_url(f"{BASE}/#/")
    expect(page.get_by_role("heading", name="Work queue")).to_be_visible()
    expect(page.locator(".session-who b")).to_have_text("Victor Stan")


# ============================================================================= 2. the README demo script
def test_readme_demo_script(browse):
    page = open_case(browse(ANA))
    expect(status_line(page)).to_have_text("Waiting for the client to send the application pack")

    # 1. day 0: four documents; the DSCR verifies, the agent asks for the rest
    next_event(page, "Next client event")
    expect(status_line(page)).to_contain_text("Waiting on the client for Trade register certificate")
    expect(status_line(page)).to_contain_text("Fiscal certificate")
    expect(verified(page)).to_have_text("1/6")

    # 2. three days: the reminders go out
    dock(page).get_by_role("button", name="3 days", exact=True).click()
    expect(page.locator(".case-meta .m").filter(has_text="day of the case").locator("b")).to_have_text("3")
    tab(page, "Messages")
    expect(page.get_by_role("log", name="Messages")).to_contain_text("Reamintire")

    # 3. the trade-register certificate: beneficial-owner discrepancy (AMLR clock) and an unsure address
    next_event(page, "Next client event")
    expect(status_line(page)).to_have_text("2 decisions need you")
    expect(card(page, "Beneficial-owner discrepancy")).to_be_visible()
    expect(card(page, "Registered office")).to_be_visible()
    expect(page.locator(".case-meta")).to_contain_text("days to AMLR report")
    shot(page, "03-case-mid-demo")

    # 4. the client's e-mail: the gate denies contacting the client before the analyst decides
    next_event(page, "Next client event")
    tab(page, "Reasoning")
    expect(page.locator(".gate-deny").filter(has_text="GATE-01").first).to_be_visible()

    # 5. the two rulings, by their real labels
    decide(page, "Same address, only formatting differs")
    expect(status_line(page)).to_have_text("1 decision needs you")
    decide(page, "Confirm discrepancy and request a corrected declaration")
    expect(status_line(page)).to_contain_text("Waiting on the client for a corrected UBO declaration")

    # 6. updated documents: the clock is cancelled and every check passes
    next_event(page, "Next client event")
    expect(status_line(page)).to_contain_text("File complete.")
    expect(page.get_by_role("region", name="File complete")).to_be_visible()
    expect(verified(page)).to_have_text("6/6")

    # 7. a week later the certificate is past 30 days: expired, and the file reopens
    dock(page).get_by_role("button", name="A week", exact=True).click()
    expect(status_line(page)).to_have_text(re.compile(r"Company active in trade register: expired"))
    expect(page.get_by_role("region", name="File complete")).to_have_count(0)
    expect(verified(page)).to_have_text("5/6")
    r1 = page.locator("button.row").filter(has=page.locator(".rid", has_text="R1"))
    expect(r1).to_contain_text("Expired")

    # 8. the fresh certificate: complete again, the address settled by the analyst's precedent (no new card)
    next_event(page, "Next client event")
    expect(status_line(page)).to_contain_text("File complete.")
    expect(verified(page)).to_have_text("6/6")
    expect(page.locator("article.decision")).to_have_count(0)

    # 9. the two internal events: insider pattern, escalated to compliance
    next_event(page, "Next internal event")
    expect(page.get_by_test_id("dock-next")).to_have_text("Next internal event")
    next_event(page, "Next internal event")
    expect(card(page, "Possible insider pattern")).to_be_visible()
    expect(page.get_by_test_id("dock-next")).to_have_text("All events sent")
    decide(page, "Put on hold and escalate to compliance")
    expect(status_line(page)).to_contain_text("On hold.")
    expect(page.get_by_role("heading", name=re.compile("On hold"))).to_be_visible()

    # 10. Ask: the employee's answer cites the ledger; the client's view stays plain
    tab(page, "Ask")
    ask = page.get_by_label("Ask about this case")
    ask.fill("When did we learn about Radu Pop and what did we do?")
    ask.press("Enter")
    answer = page.locator(".chat .msg.ai").last
    expect(answer.locator("button.cite").first).to_be_visible()
    page.get_by_role("radio", name="Client view").click()
    ask.fill("What do you still need from me?")
    ask.press("Enter")
    client_answer = page.locator(".chat .msg.ai").last
    expect(client_answer).not_to_be_empty()
    assert not INTERNAL.search(client_answer.inner_text()), client_answer.inner_text()

    # 11. Messages: one Romanian e-mail per step
    tab(page, "Messages")
    log = page.get_by_role("log", name="Messages")
    expect(log).to_contain_text("Documente necesare")

    # 12. the ledger's hash chain is intact
    page.get_by_role("button", name="Check ledger").first.click()
    expect(page.locator(".verify-ok").first).to_contain_text(re.compile(r"Chain intact, \d+ events"))


# ============================================================================= 3. two screens
def test_two_screens_bank_and_portal(browse):
    ctx = browse(ANA, AURORA)
    bank = open_case(ctx)
    next_event(bank, "Next client event")
    dock(bank).get_by_role("button", name="3 days", exact=True).click()
    expect(bank.locator(".case-meta .m").filter(has_text="day of the case").locator("b")).to_have_text("3")

    portal = ctx.new_page()
    portal.goto("/client/#/case/demo-1")
    expect(portal.locator(".pt-company").first).to_contain_text("Brutăria Aurora")
    expect(portal.get_by_role("button", name="Sign out")).to_be_visible()
    no_internal_words(portal)

    # consent to the credit-bureau check
    consent = portal.locator("[data-confirm=credit_check_consent]")
    consent.get_by_role("button", name="I consent").click()
    expect(consent).to_have_count(0)

    # the wrong company's file is not accepted, and the bank sees why
    portal.get_by_role("button", name="Try a wrong file (demo)").first.click()
    expect(portal.get_by_text(re.compile(r"^Not accepted: this document seems to belong to another company")).first).to_be_visible()
    tab(bank, "Docs")
    docs = bank.locator(".tabpane:visible")
    expect(docs).to_contain_text("Quarantined")
    docs.locator("button.docrow").filter(has_text="Quarantined").first.click()
    why = bank.get_by_role("dialog").get_by_role("note")
    expect(why).to_contain_text("Quarantined. Nothing was extracted from it.")
    expect(why).to_contain_text(re.compile(r"company|CUI|tax", re.I))
    bank.keyboard.press("Escape")
    expect(bank.get_by_role("dialog")).to_have_count(0)
    shot(portal, "04-portal")
    no_internal_words(portal)

    # Messages: the client writes, the bank screen shows it live
    text = f"E2E from the client {int(time.time())}"
    portal.get_by_label("Message to the bank").fill(text)
    portal.get_by_role("button", name="Send message").click()
    expect(portal.get_by_role("log", name="Messages")).to_contain_text(text)
    tab(bank, "Messages")
    expect(bank.get_by_role("log", name="Messages")).to_contain_text(text)

    # step 9 from the bank's demo menu: E-0317 changes the phone; the client says "No, I didn't"
    dock(bank).get_by_role("button", name="All scripted events and more").click()
    bank.get_by_role("menuitem", name=re.compile("changes the client.s phone")).click()
    change = portal.locator("[data-confirm=contact_change]")
    expect(change).to_be_visible()
    no_internal_words(portal)
    change.get_by_role("button", name=re.compile(r"^No, I didn.t$")).click()
    expect(portal.get_by_text("Our team will contact you").first).to_be_visible()
    expect(card(bank, "did not request the contact change")).to_be_visible()
    no_internal_words(portal)


# ============================================================================= 4. access control in the browser
def sign_in_in_ui(page: Page, console: Console, account: re.Pattern) -> None:
    """The login page's demo authenticator: pick the account, then "Use demo code". When this account already used
    the code of the coming 30 s step, the server refuses it; then wait for the next step and use the new code."""
    page.get_by_role("complementary", name="Demo authenticator").get_by_role("button", name=account).click()
    for attempt in range(3):
        page.get_by_role("button", name="Use demo code").click()
        refused = page.get_by_role("alert").filter(has_text="wrong or already used code")
        try:
            page.wait_for_url(lambda url: "/login/" not in url or "#/users" in url, timeout=5000)
            return
        except Exception:  # noqa: BLE001 - still on the login page
            if not refused.is_visible():
                raise
        console.allow(r"status of 401.*/api/auth/mfa")
        left = page.request.get("/api/auth/demo-accounts").json()["seconds_left"]
        page.wait_for_timeout((left + 1) * 1000)
        page.get_by_role("complementary", name="Demo authenticator").get_by_role("button", name=account).click()
    raise AssertionError("the demo code was refused three times")


def test_client_sees_only_its_own_company(browse, console):
    console.allow(r"status of 404.*/api/cases/demo-1/")  # another company's file answers 404, as if it did not exist
    page = browse().new_page()
    page.goto("/client/#/")
    expect(page).to_have_url(re.compile(r"/login/\?next=%2Fclient%2F&app=client#/$"))
    sign_in_in_ui(page, console, re.compile(r"^Verde Logistic"))
    expect(page).to_have_url(re.compile(r"/client/#/$"))
    expect(page.get_by_role("heading", name="Verde Logistic SRL").first).to_be_visible()
    files = page.locator(".pt-a-files")
    expect(files).to_be_visible()
    expect(page.locator("body")).not_to_contain_text("Brutăria")
    expect(page.locator("body")).not_to_contain_text("Aurora")

    page.goto("/client/#/case/demo-1")
    expect(page.get_by_role("heading", name="This file no longer exists")).to_be_visible()
    expect(page.locator("body")).not_to_contain_text("Brutăria")

    page.goto("/")
    expect(page).to_have_url(re.compile(r"/login/\?next=%2F$"))


def test_client_first_visit_lands_on_own_files(browse, console):
    """A client's first visit to /client/ opens its own files, not the demo company's file (fixed in client/main.tsx)."""
    page = browse().new_page()
    page.goto("/client/")
    sign_in_in_ui(page, console, re.compile(r"^Verde Logistic"))
    expect(page.locator(".pt-a-files")).to_be_visible(timeout=8000)
    expect(page.get_by_role("heading", name="This file no longer exists")).to_have_count(0)


# ============================================================================= 5. users page
def test_admin_adds_an_analyst_with_a_qr_code(browse, console):
    page = browse().new_page()
    page.goto("/login/")
    sign_in_in_ui(page, console, re.compile(r"^Admin"))
    expect(page.locator(".session-who b")).to_have_text("Admin")
    page.get_by_role("link", name="Users").click()
    expect(page).to_have_url(re.compile(r"/login/#/users$"))
    expect(page.get_by_role("heading", name="Users", exact=True)).to_be_visible()

    email = f"e2e.analyst.{int(time.time())}@bank.example"
    page.get_by_label("Name", exact=True).fill("E2E Analyst")
    page.get_by_label("E-mail", exact=True).fill(email)
    page.get_by_label("Role", exact=True).select_option("analyst")
    page.get_by_label("First password (8+ characters)").fill("e2e-password-1")
    page.get_by_role("button", name="Add user").click()
    qr = page.get_by_role("img", name=f"QR code for {email}")
    expect(qr).to_be_visible()
    assert qr.evaluate("img => img.complete && img.naturalWidth > 0")
    expect(page.get_by_role("region", name="All users")).to_contain_text(email)


# ============================================================================= 7. layout
LAYOUTS = [({"width": 1440, "height": 900}, 1, False), ({"width": 1333, "height": 780}, 1.5, False),
           ({"width": 390, "height": 844}, 3, True)]


@pytest.mark.parametrize("viewport,scale,mobile", LAYOUTS, ids=["1440x900", "1333x780@1.5", "390x844-phone"])
def test_no_horizontal_overflow(browse, sessions, viewport, scale, mobile):
    staff = sessions.request(ANA)
    for item in ("day0-pack", "onrc-cert"):  # a case screen with two decision cards and a full timeline
        assert staff.post("/api/cases/demo-1/inbound", data={"item_id": item}).ok
    ctx = browse(ANA, AURORA, viewport=viewport, scale=scale, mobile=mobile)
    page = ctx.new_page()
    checks = [("/#/", lambda: expect(page.get_by_role("heading", name="Work queue")).to_be_visible()),
              ("/#/case/demo-1", lambda: expect(page.locator("article.decision").first).to_be_visible()),
              ("/client/#/case/demo-1", lambda: expect(page.locator(".pt-company").first).to_be_visible()),
              ("/client/#/", lambda: expect(page.locator(".pt-a-files")).to_be_visible())]
    for url, ready in checks:
        page.goto(url)
        ready()
        page.wait_for_timeout(300)  # let fonts and late layout settle
        assert overflow(page) <= 1, f"{url} at {viewport} @{scale}: {overflow(page)} px of horizontal overflow"


# ============================================================================= 6. the learned-check panel (last)
def test_learned_panel_proposal_and_approval(browse, sessions):
    """Runs last: learner.PROMOTED is process memory that /api/demo/reset does not clear, so after this test the
    server keeps LC-1 until it restarts."""
    over = sessions.request(ANA).get("/api/learning/overview").json()
    if over["checks"]:
        pytest.fail(f"the server already has a promoted learned check ({over['checks'][0]['id']}) and "
                    "/api/demo/reset does not clear it: restart the server before running the E2E tests")
    assert over["proposals"] == []

    ana = browse(ANA)
    page = open_case(ana)
    next_event(page, "Next client event")
    next_event(page, "Next client event")
    decide(page, "Same address, only formatting differs")
    expect(status_line(page)).to_have_text("1 decision needs you")
    page.get_by_role("link", name="Work queue").click()
    page.get_by_role("link", name=re.compile("^Learned checks")).click()  # the home tab #/learned
    panel = page.get_by_role("region", name="What the agent has learned")
    expect(panel).to_be_visible()
    waiting = panel.locator(".lp-col").filter(has=page.get_by_role("heading", name=re.compile("^Waiting for a second person")))
    expect(waiting.locator(".lp-n")).to_have_text("1")
    expect(waiting).to_contain_text("A supervisor approves it.")
    expect(waiting.get_by_role("button", name="Approve check")).to_have_count(0)
    kept = panel.locator(".lp-col").filter(has=page.get_by_role("heading", name=re.compile("^Rulings it keeps")))
    expect(kept).to_contain_text("Brutăria Aurora")
    panel.scroll_into_view_if_needed()
    shot(page, "02-queue-learned-panel")

    ioana = browse(IOANA).new_page()
    ioana.goto("/#/learned")
    panel = ioana.get_by_role("region", name="What the agent has learned")
    waiting = panel.locator(".lp-col").filter(has=ioana.get_by_role("heading", name=re.compile("^Waiting for a second person")))
    waiting.get_by_role("button", name="Run backtest").click()
    expect(waiting.get_by_role("status")).to_contain_text(re.compile(r"Backtest on \d+ labelled cases"))
    waiting.get_by_role("button", name="Approve check").click()
    in_use = panel.locator(".lp-col").filter(has=ioana.get_by_role("heading", name=re.compile("^In use")))
    expect(in_use).to_contain_text("LC-1")
    expect(in_use).to_contain_text("approved by supervisor-1")
    expect(waiting.locator(".lp-n")).to_have_text("0")
