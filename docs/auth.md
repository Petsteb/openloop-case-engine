# Login and access control

`backend/app/auth.py` is the only place that decides who may do what. `tests/test_auth.py` checks it, with 17 tests that include the two-screen demo with login on.

## Signing in
1. **Password:** e-mail and password. Passwords are stored as PBKDF2-SHA256 hashes (240k rounds, per-user salt), in a `users` table in the same SQLite file as the ledgers.
2. **One-time code:** the 6-digit code from an authenticator app.
   - It is TOTP (RFC 6238, 30 s), the same scheme a bank's token app or Google Authenticator uses.
   - Every account has its own secret. A code is accepted once.
   - 5 wrong passwords or codes lock the account for 5 minutes, and each IP is rate-limited.
3. **Google Sign-In (optional):** set `GOOGLE_CLIENT_ID`.
   - The server checks Google's ID token: RS256 signature against Google's keys, issuer, audience, expiry and a verified e-mail.
   - The account must already exist, because the bank provisions its users.
   - The one-time code is still asked afterwards.
   - **SSO:** for a bank's own identity provider, the same OIDC check works with Entra ID or Okta (another issuer and key URL).

**Sessions** are signed HttpOnly cookies: SameSite=Lax, Secure over HTTPS, 8 hours.
- Bank staff get `ol_staff` and a client gets `ol_client`. One browser can therefore show the bank screen and the client portal side by side, as the demo does.
- Disabling a user or resetting their 2FA signs them out everywhere.

## Who sees what
| | Client | Analyst | Supervisor | Compliance | Admin |
|---|---|---|---|---|---|
| Own company's files: status, uploads, confirmations, messages, chat | ✓ | preview | preview | preview | preview |
| Upload, confirm, message *as the client* | ✓ | – | – | – | – |
| Bank screen: queue, bundle, ledger, documents, staff chat, messages | – | ✓ | ✓ | ✓ | ✓ |
| Decide a card (resolve) | – | ✓ | ✓ | ✓ | ✓ |
| Release a compliance hold | – | – | – | ✓ | ✓ |
| Promote a learned check (maker-checker) | – | – | ✓ | – | ✓ |
| Manage users (`/login/#/users`) | – | – | ✓ (not admins) | – | ✓ |
| Demo controls: events, time skip, reset, registry switch (`DEMO_MODE=1`) | – | ✓ | ✓ | ✓ | ✓ |

- **Fail closed:** an `/api` path that matches no rule in `auth.RULES` answers 404. A test checks that every route has a rule.
- **A client never reaches another company's file:** it answers 404, as if the file did not exist. `?company_id=` is replaced by the session's company, and `/api/companies` shows a client only its own company, without the bank's notes.
- **Identity comes from the session, never from the request:**
  - a staff message is signed with the staff member's name;
  - `by` on a decision, a hold release or a promotion is the signed-in staff ID.

  That is what makes maker-checker binding: the analyst whose rulings created a check cannot promote it.
- **Also enforced:**
  - a body cap of 2 MB (413);
  - writes from another site's Origin are refused;
  - 12 chat questions per user per minute, because each one may be a paid model call;
  - security headers: `nosniff`, `frame-ancestors 'none'`, `X-Frame-Options`, HSTS over HTTPS.

## Demo accounts (synthetic)
The password for every demo account is `demo`. The second factor is the code from an authenticator app: on `/login/#/users`, "New 2FA" shows an account's QR code.
- **Deployed site (Railway), local runs and the E2E tests:** `DEMO_LOGINS=1`. The login page's **demo authenticator** shows each account's live code, standing in for the bank's mobile app on a projector. Production sets `DEMO_LOGINS=0`.
- **While `DEMO_LOGINS=1`, the demo accounts never manage users:** the demo admin and supervisor do not get the Users page, so a visitor cannot change the team's real accounts. Real accounts keep it.

**Bank staff**

| Account | Role | Ledger identity | Use it for |
|---|---|---|---|
| ana.pop@bank.example | Analyst | analyst-1 | the work queue, decision cards, chat with clients |
| ioana.marin@bank.example | Supervisor | supervisor-1 | the maker-checker step: promoting a learned check |
| victor.stan@bank.example | Compliance | compliance-1 | releasing a file put on hold (SR-01 / SR-02) |
| admin@bank.example | Admin | admin-1 | the Users page: accounts, roles, 2FA |

**Clients: one login per synthetic company; each sees only its company's cases**

| Account | Company | What its case shows |
|---|---|---|
| andrei.munteanu@brutaria-aurora.example | Brutăria Aurora SRL | demo-1, the scripted demo: undeclared owner, address, expiry, insider rule |
| office@verde-logistic.example | Verde Logistic SRL | a clean loan file that completes with no human |
| contabilitate@carpatic-lemn.example | Carpatic Lemn SRL | tax debt on the fiscal certificate (HR-08) |
| contact@delta-pescaria.example | Delta Pescăria SRL | a suspended company in the trade register (HR-02) |
| office@nordconstruct.example | Nord Construct Instal SRL | repayment capacity too low: DSCR 1.06 (HR-07) |
| administrativ@medicaplus.example | Medica Plus Clinic SRL | signatory is not the administrator (JQ-02, mandate) |
| office@solaris-agro.example | Solaris Agro SRL | a registry certificate 45 days old (HR-03) |
| ana@atelier-croitorie.example | Atelier Croitorie Ana SRL | the annual business review template (kyb_review) |

## Configuration
| Env | Default | Production |
|---|---|---|
| `OPENLOOP_AUTH` | `on` | `on`; `off` gives the open demo with no login |
| `SESSION_SECRET` | random per process | a long random string (sessions survive restarts) |
| `DEMO_LOGINS` | `1` | `0` |
| `DEMO_MODE` | `1` | `0`: the demo controls answer 404 |
| `OPENLOOP_SEED_USERS` / `DEMO_PASSWORD` | `1` / `demo` | `0`; create users with `cd backend && python -m app.auth add <email> "<name>" <role> [company_id]` |
| `GOOGLE_CLIENT_ID` | unset | the OAuth web client ID; add the site URL to "Authorized JavaScript origins" |
| `TRUSTED_ORIGINS` | `http://localhost:5173` | unset |

## Limits (honest)
- **Rate limits and lockouts** live in each process's memory. Several processes need a shared store such as Redis.
- **A session is stateless:** it is checked against the user row on every request, so disabling a user takes effect at once. There is no per-device session list.
- **Demo mode is open by design:** with `DEMO_LOGINS=1`, anyone who opens the login page can sign in as any demo account. That is fine for synthetic data, but it must be off for anything real.
