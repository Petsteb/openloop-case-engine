# Browser E2E tests

`test_ui_e2e.py` clicks through the real UI (`web/dist`) with Playwright for Python and the installed Edge: the login
with the demo authenticator, the README demo script, the two-screen moments with the client portal, access control,
the Users page, the learned-check panel, and horizontal overflow at 1440×900, 1333×780 @1.5 and 390×844.
Any console error fails a test. Without `E2E_BASE` the module is skipped, so `cd backend && python -m pytest -q`
stays offline.

```bash
# 1. a fresh offline server (scripted agent, heuristic judge, outbox e-mail, a throwaway database), from the repo root
AGENT_MODE=scripted JUDGE_MODE=heuristic EMAIL_MODE=outbox OPENLOOP_DB=/tmp/openloop-e2e.db \
  python -m uvicorn app.main:app --app-dir backend --port 8700
# 2. the tests (they reset every demo file themselves)
E2E_BASE=http://localhost:8700 python -m pytest -q backend/tests/e2e -x
```

- **Needs:** `pip install playwright` and Microsoft Edge (`E2E_CHANNEL=chrome` uses Chrome instead). No `playwright install`.
- **Options:** `E2E_SHOTS=<dir>` for the screenshots (default: `<tmp>/openloop-e2e`); `E2E_HEADED=1` shows the browser.
- **Restart the server before each run.** A promoted learned check (LC-1) stays in the server's memory, and
  `/api/demo/reset` does not clear it. The learned-panel test runs last and stops with a clear message otherwise.
- **Codes:** each account signs in about twice per 30 s (single-use TOTP). The tests reuse one session per account
  and wait for the next step when they have to, so a run takes about a minute or two.
