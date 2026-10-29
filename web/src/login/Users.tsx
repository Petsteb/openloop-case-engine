import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { loadMe, type Me, type SessionUser } from '@/shared/session'

/* /login/#/users: supervisors and admins add bank staff and client logins, disable them, or reset their 2FA.
   Every new account gets its own authenticator secret, shown once as a QR code. The server enforces who may do this
   (backend/app/auth.py, "users" permission; only an admin manages admins). */

type User = SessionUser & { active: boolean }
type Created = { user: User; otpauth_uri: string; totp_secret: string }
type Company = { id: string; name: string }

const ROLES = [['analyst', 'Analyst'], ['supervisor', 'Supervisor'], ['compliance', 'Compliance'], ['admin', 'Admin'], ['client', 'Client']] as const

async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? 'Please check the fields (password: 8 characters or more).' : `Error ${res.status}`)
  }
  return data as T
}

export function Users() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [list, setList] = useState<User[] | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', name: '', role: 'analyst', company_id: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [moving, setMoving] = useState<{ id: string; role: string; company_id: string } | null>(null)

  const reload = useCallback(() => {
    api<User[]>('GET', '/api/users').then(setList).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    void loadMe().then((m) => {
      setMe(m)
      if (m?.perms.includes('users')) {
        reload()
        api<Company[]>('GET', '/api/companies').then(setCompanies).catch(() => setCompanies([]))
      }
    })
  }, [reload])
  useEffect(() => {
    if (!created) { setQr(null); return }
    QRCode.toDataURL(created.otpauth_uri, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(null))
  }, [created])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      // no password: the user signs in with Google or Microsoft (then the code)
      const body = { ...form, company_id: form.role === 'client' ? form.company_id : null, password: form.password || null }
      setCreated(await api<Created>('POST', '/api/users', body))
      setForm({ email: '', name: '', role: form.role, company_id: '', password: '' })
      reload()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const act = async (u: User, action: 'disable' | 'enable' | 'reset-2fa') => {
    setError(null)
    try {
      const r = await api<Partial<Created>>('POST', `/api/users/${encodeURIComponent(u.id)}/${action}`, {})
      if (action === 'reset-2fa' && r.otpauth_uri && r.user && r.totp_secret) setCreated(r as Created)
      reload()
    } catch (err) { setError((err as Error).message) }
  }

  const saveRole = async () => {
    if (!moving) return
    setError(null)
    try {
      await api('POST', `/api/users/${encodeURIComponent(moving.id)}/role`,
        { role: moving.role, company_id: moving.role === 'client' ? moving.company_id : null })
      setMoving(null)
      reload()
    } catch (err) { setError((err as Error).message) }
  }

  if (me === undefined) return <main className="lg-page"><p className="muted" role="status">Loading…</p></main>
  if (!me?.staff) {
    return <main className="lg-page"><section className="lg-card"><h1 className="lg-title">Users</h1>
      <p className="lg-sub">Sign in as bank staff first.</p><div className="lg-row"><a className="btn primary" href="/login/?next=%2Flogin%2F%23%2Fusers">Sign in</a></div></section></main>
  }
  if (!me.perms.includes('users')) {
    return <main className="lg-page"><section className="lg-card"><h1 className="lg-title">Users</h1>
      <p className="lg-sub">Only a supervisor or an admin manages users. You are signed in as {me.staff.name}.</p>
      <div className="lg-row"><a className="btn" href="/">Back to the work queue</a></div></section></main>
  }

  return (
    <main className="lg-page lg-users">
      <section className="lg-card">
        <a className="case-back" href="/">Work queue</a>
        <h1 className="lg-title">Users</h1>
        <p className="lg-sub">Bank staff see every file and act within their role. A client sees only its own company. Every account signs in with a password and a one-time code.</p>
        <form className="lg-form" onSubmit={(e) => void add(e)}>
          <label className="lg-label" htmlFor="u-name">Name</label>
          <input id="u-name" className="lg-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label className="lg-label" htmlFor="u-email">E-mail</label>
          <input id="u-email" className="lg-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <label className="lg-label" htmlFor="u-role">Role</label>
          <select id="u-role" className="lg-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          {form.role === 'client' ? (
            <>
              <label className="lg-label" htmlFor="u-company">Company</label>
              <select id="u-company" className="lg-input" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} required>
                <option value="" disabled>Choose a company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          ) : null}
          <label className="lg-label" htmlFor="u-pass">First password (8+ characters; leave empty for Google / Microsoft sign-in only)</label>
          <input id="u-pass" className="lg-input" type="password" autoComplete="new-password" minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error ? <p className="lg-error" role="alert">{error}</p> : null}
          <div className="lg-row"><button type="submit" className="btn primary" disabled={busy}>Add user</button></div>
        </form>
        {created ? (
          <div className="lg-enrol" role="status">
            <h2>Authenticator for {created.user.name}</h2>
            <p>Scan this once with the authenticator app (it is not shown again). Or type the key: <code>{created.totp_secret}</code></p>
            {qr ? <img src={qr} alt={`QR code for ${created.user.email}`} width={220} height={220} /> : null}
            <div className="lg-row"><button type="button" className="btn quiet sm" onClick={() => setCreated(null)}>Done</button></div>
          </div>
        ) : null}
      </section>

      <section className="lg-demo lg-userlist" aria-label="All users">
        <h2>{list ? `${list.length} users` : 'Users'}</h2>
        {list === null ? <p className="muted">Loading…</p> : (
          <ul>
            {list.map((u) => (
              <li key={u.id} className={u.active ? '' : 'is-off'}>
                <span className="lg-acct-who"><b>{u.name}</b><span>{u.email} · {u.role === 'client' ? u.company : `${u.role}, ${u.staff_id}`}{u.active ? '' : ' · disabled'}</span></span>
                <span className="lg-user-tools">
                  {u.id === me.staff?.id ? null : (
                    <button type="button" className="btn quiet sm" aria-expanded={moving?.id === u.id}
                      onClick={() => setMoving(moving?.id === u.id ? null : { id: u.id, role: u.role, company_id: u.company_id ?? '' })}>
                      Change role
                    </button>
                  )}
                  <button type="button" className="btn quiet sm" onClick={() => void act(u, 'reset-2fa')}>New 2FA</button>
                  {u.id === me.staff?.id ? null : u.active
                    ? <button type="button" className="btn quiet sm" onClick={() => void act(u, 'disable')}>Disable</button>
                    : <button type="button" className="btn sm" onClick={() => void act(u, 'enable')}>Enable</button>}
                </span>
                {moving?.id === u.id ? (
                  <span className="lg-move">
                    <select className="lg-input" aria-label={`New role for ${u.name}`} value={moving.role}
                      onChange={(e) => setMoving({ ...moving, role: e.target.value })}>
                      {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    {moving.role === 'client' ? (
                      <select className="lg-input" aria-label={`Company for ${u.name}`} value={moving.company_id}
                        onChange={(e) => setMoving({ ...moving, company_id: e.target.value })}>
                        <option value="" disabled>Choose a company</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : null}
                    <button type="button" className="btn primary sm" onClick={() => void saveRole()}
                      disabled={moving.role === 'client' && !moving.company_id}>Save</button>
                    <span className="muted small">They are signed out, so the new role applies at once.</span>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
