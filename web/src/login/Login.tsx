import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMe, signOut, type Me, type SessionUser } from '@/shared/session'

/* Sign-in for bank staff and clients: e-mail + password, then the 6-digit code from the authenticator app (the bank's
   app, Google Authenticator, …). Google Sign-In, when the server has a client ID, replaces the password step; the
   code is still asked. With DEMO_LOGINS=1 a "demo authenticator" lists the synthetic accounts and their live codes,
   standing in for the phone on the projector. */

type DemoAccount = SessionUser & { code: string }
type Demo = { password: string; seconds_left: number; accounts: DemoAccount[] }
type Challenge = { challenge: string; name: string; via: string }

const ROLE_WORD: Record<string, string> = { analyst: 'Analyst', supervisor: 'Supervisor', compliance: 'Compliance', admin: 'Admin' }

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail
    throw new Error(typeof d === 'string' ? d : res.status === 422 ? 'Please check what you typed.' : 'Sign-in failed. Please try again.')
  }
  return data as T
}

/** Only a same-site path (never "//host"), plus the #/route the browser kept through the redirect. */
function destination(app: 'staff' | 'client'): string {
  const q = new URLSearchParams(window.location.search)
  const next = q.get('next') ?? ''
  const fallback = app === 'client' ? '/client/' : '/'
  let path = /^\/(?!\/)[\w\-./]*$/.test(next) ? next : fallback
  if (app === 'client' && !path.startsWith('/client')) path = '/client/'  // a client never lands on the bank screen
  if (app === 'staff' && path.startsWith('/login')) path = '/'
  const hash = window.location.hash
  if (hash && /^#\/[\w\-/]*$/.test(hash)) return path + hash
  return path === '/' ? '/#/' : path  // staff land on the work queue; the portal picks the client's own files
}

declare global {
  interface Window { google?: { accounts: { id: {
    initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
  } } } }
}

export function Login() {
  const wantsClient = new URLSearchParams(window.location.search).get('app') === 'client'
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Challenge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState<Demo | null>(null)
  const [left, setLeft] = useState(30)
  const codeRef = useRef<HTMLInputElement>(null)
  const googleRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void loadMe().then((m) => setMe(m)) }, [])

  const refreshDemo = useCallback(() => {
    void fetch('/api/auth/demo-accounts').then((r) => (r.ok ? r.json() : null)).then((d: Demo | null) => {
      setDemo(d)
      if (d) setLeft(d.seconds_left)
    }).catch(() => setDemo(null))
  }, [])
  useEffect(() => { if (me?.demo_logins) refreshDemo() }, [me, refreshDemo])
  useEffect(() => {
    if (!me?.demo_logins) return
    const t = window.setInterval(() => setLeft((s) => {
      if (s <= 1) { refreshDemo(); return 30 }
      return s - 1
    }), 1000)
    return () => window.clearInterval(t)
  }, [me, refreshDemo])

  const startMfa = useCallback((c: Challenge) => {
    setStep(c); setCode(''); setError(null)
    requestAnimationFrame(() => codeRef.current?.focus())
  }, [])

  // Google Sign-In (only when the server has a client ID)
  useEffect(() => {
    const id = me?.google_client_id
    if (!id || step || !googleRef.current) return
    const render = () => {
      if (!window.google || !googleRef.current) return
      window.google.accounts.id.initialize({
        client_id: id,
        callback: (r) => {
          setBusy(true)
          post<Challenge>('/api/auth/google', { credential: r.credential }).then(startMfa)
            .catch((e: Error) => setError(e.message)).finally(() => setBusy(false))
        },
      })
      // Google draws its own button at a fixed pixel width: match the form (Google allows 200-400 px)
      const width = Math.max(200, Math.min(400, Math.floor(googleRef.current.getBoundingClientRect().width)))
      window.google.accounts.id.renderButton(googleRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width, logo_alignment: 'center', locale: 'en' })  // the page is English
    }
    if (window.google) { render(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = render
    document.head.appendChild(s)
  }, [me, step, startMfa])

  // Microsoft (Entra ID: Teams / work and school accounts, and personal accounts), loaded only when used
  const microsoftSignIn = async () => {
    const clientId = me?.microsoft_client_id
    if (!clientId) return
    setBusy(true); setError(null)
    try {
      const { PublicClientApplication } = await import('@azure/msal-browser')
      const pca = new PublicClientApplication({
        auth: { clientId, authority: 'https://login.microsoftonline.com/common', redirectUri: `${window.location.origin}/login/` },
        cache: { cacheLocation: 'sessionStorage' },
      })
      await pca.initialize()
      const r = await pca.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' })
      startMfa(await post<Challenge>('/api/auth/microsoft', { credential: r.idToken }))
    } catch (err) {
      const m = (err as Error).message || ''
      setError(/cancel|user_cancelled|popup_window_error|empty_window/i.test(m) ? 'Microsoft sign-in was cancelled.'
        : /^no OpenLoop|could not be verified|did not include/.test(m) ? m : 'Microsoft sign-in failed. Please try again.')
    } finally { setBusy(false) }
  }

  const submitPassword = async (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    setBusy(true); setError(null)
    try {
      startMfa(await post<Challenge>('/api/auth/login', override ?? { email, password }))
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const submitCode = async (e?: React.FormEvent, override?: string) => {
    e?.preventDefault()
    if (!step) return
    setBusy(true); setError(null)
    try {
      const r = await post<{ app: 'staff' | 'client' }>('/api/auth/mfa', { challenge: step.challenge, code: override ?? code })
      window.location.assign(destination(r.app))
    } catch (err) {
      setError((err as Error).message)
      if (/expired/.test((err as Error).message)) setStep(null)
      setBusy(false)
      refreshDemo()
    }
  }

  const pick = (a: DemoAccount) => {
    if (!demo) return
    setEmail(a.email); setPassword(demo.password)
    void submitPassword(undefined, { email: a.email, password: demo.password })
  }
  const stepAccount = useMemo(() => demo?.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase()), [demo, email])

  if (me === undefined) return <main className="lg-page"><p className="muted" role="status">Loading…</p></main>
  if (me && !me.auth) {
    return (
      <main className="lg-page"><section className="lg-card">
        <Brand />
        <h1 className="lg-title">Sign-in is off on this server</h1>
        <p className="lg-sub">It runs as the open demo (OPENLOOP_AUTH=off).</p>
        <div className="lg-row"><a className="btn primary" href="/">Bank screen</a><a className="btn" href="/client/">Client portal</a></div>
      </section></main>
    )
  }
  const current = wantsClient ? me?.client : me?.staff

  return (
    <main className="lg-page">
      <section className="lg-card" aria-labelledby="lg-title">
        <Brand />
        {current && !step ? (
          <>
            <h1 id="lg-title" className="lg-title">You are signed in</h1>
            <p className="lg-sub">{current.name} · {current.role === 'client' ? current.company : ROLE_WORD[current.role]}</p>
            <div className="lg-row">
              <a className="btn primary" href={destination(current.role === 'client' ? 'client' : 'staff')}>Continue</a>
              <button type="button" className="btn quiet" onClick={() => void signOut(current.role === 'client' ? 'client' : 'staff')}>Sign out</button>
            </div>
          </>
        ) : step ? (
          <form onSubmit={(e) => void submitCode(e)} className="lg-form" noValidate>
            <h1 id="lg-title" className="lg-title">Your one-time code</h1>
            <p className="lg-sub">
              {step.via === 'google' ? 'Google confirmed your e-mail. ' : step.via === 'microsoft' ? 'Microsoft confirmed your e-mail. ' : ''}
              Open your authenticator app and type the 6-digit code for OpenLoop, {step.name}.
            </p>
            <label className="lg-label" htmlFor="lg-code">6-digit code</label>
            <input id="lg-code" ref={codeRef} className="lg-input lg-code" inputMode="numeric" autoComplete="one-time-code"
              pattern="\d{6}" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
              aria-describedby={error ? 'lg-err' : undefined} />
            {error ? <p id="lg-err" className="lg-error" role="alert">{error}</p> : null}
            <div className="lg-row">
              <button type="submit" className="btn primary" disabled={busy || code.replace(/\D/g, '').length !== 6}>Verify</button>
              <button type="button" className="btn quiet" onClick={() => { setStep(null); setError(null) }}>Back</button>
              {stepAccount ? (
                <button type="button" className="btn quiet" onClick={() => { setCode(stepAccount.code); void submitCode(undefined, stepAccount.code) }}>
                  Use demo code
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => void submitPassword(e)} className="lg-form" noValidate>
            <h1 id="lg-title" className="lg-title">{wantsClient ? 'Sign in to your files' : 'Sign in'}</h1>
            <p className="lg-sub">Bank staff and clients sign in here. A one-time code from your authenticator app is always asked.</p>
            <label className="lg-label" htmlFor="lg-email">E-mail</label>
            <input id="lg-email" className="lg-input" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <label className="lg-label" htmlFor="lg-pass">Password</label>
            <input id="lg-pass" className="lg-input" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required aria-describedby={error ? 'lg-err' : undefined} />
            {error ? <p id="lg-err" className="lg-error" role="alert">{error}</p> : null}
            <div className="lg-row">
              <button type="submit" className="btn primary lg-wide" disabled={busy || !email || !password}>Continue</button>
            </div>
            {me?.google_client_id || me?.microsoft_client_id ? (
              <div className="lg-alt">
                <span className="lg-or" role="separator" aria-label="or">or</span>
                {me.google_client_id ? <div ref={googleRef} className="lg-google" /> : null}
                {me.microsoft_client_id ? (
                  <button type="button" className="btn lg-ms" onClick={() => void microsoftSignIn()} disabled={busy}>
                    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </section>

      {me?.demo_logins && demo ? (
        <aside className="lg-demo" aria-label="Demo authenticator">
          <div className="lg-demo-head">
            <div>
              <h2>Demo authenticator</h2>
              <p>Stands in for the bank's mobile app: synthetic accounts, password <code>{demo.password}</code>. Pick one to sign in.</p>
            </div>
            <span className="lg-timer" aria-label={`Codes change in ${left} seconds`}>
              <span style={{ width: `${(left / 30) * 100}%` }} />
            </span>
          </div>
          <Group title="Bank staff" items={demo.accounts.filter((a) => a.role !== 'client')} onPick={pick} active={step ? email : ''} busy={busy} />
          <Group title="Clients" items={demo.accounts.filter((a) => a.role === 'client')} onPick={pick} active={step ? email : ''} busy={busy} />
        </aside>
      ) : null}
    </main>
  )
}

function Group({ title, items, onPick, active, busy }: { title: string; items: DemoAccount[]; onPick: (a: DemoAccount) => void; active: string; busy: boolean }) {
  if (!items.length) return null
  return (
    <section className="lg-group">
      <h3>{title}</h3>
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            <button type="button" className={`lg-acct${active === a.email ? ' is-active' : ''}`} onClick={() => onPick(a)} disabled={busy}>
              <span className="lg-acct-who"><b>{a.name}</b><span>{a.role === 'client' ? 'Client' : ROLE_WORD[a.role]}</span></span>
              <span className="lg-acct-code" aria-label={`Code ${a.code.split('').join(' ')}`}>{a.code.slice(0, 3)} {a.code.slice(3)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Brand() {
  return <span className="brand lg-brand"><span className="brand-mark" aria-hidden="true" />OpenLoop</span>
}
