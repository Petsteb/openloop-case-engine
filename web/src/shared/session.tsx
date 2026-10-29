/* The signed-in user, for both apps. The server owns every decision (backend/app/auth.py); this module only
   shows who is signed in, offers "Sign out", and sends the browser to /login/ when a session ends (a 401). */
import { useEffect, useState } from 'react'
import './session.css'

export type SessionUser = {
  id: string; email: string; name: string; role: string; staff_id: string | null
  company_id: string | null; company: string | null
}
export type Me = {
  auth: boolean; demo_logins: boolean; demo_mode: boolean; google_client_id: string | null
  staff: SessionUser | null; client: SessionUser | null; perms: string[]
}
export type SessionApp = 'staff' | 'client'

let mePromise: Promise<Me | null> | null = null
/** One /api/auth/me per page load. Null when the server predates login (404) or cannot be reached. */
export function loadMe(): Promise<Me | null> {
  mePromise ??= fetch('/api/auth/me').then((r) => (r.ok ? r.json() as Promise<Me> : null)).catch(() => null)
  return mePromise
}

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => { let on = true; void loadMe().then((m) => { if (on) setMe(m) }); return () => { on = false } }, [])
  return me
}

/** Where /login/ sends the browser back to: this page, including its #/route. */
export function loginUrl(app: SessionApp): string {
  const next = window.location.pathname + window.location.hash
  return `/login/?${new URLSearchParams({ next, ...(app === 'client' ? { app: 'client' } : {}) })}`
}

/** A 401 from the API means the session ended (expired, signed out elsewhere, account disabled): sign in again. */
export function installSessionGuard(app: SessionApp) {
  const original = window.fetch.bind(window)
  let leaving = false
  window.fetch = async (input, init) => {
    const res = await original(input, init)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    if (res.status === 401 && !leaving && /^(https?:\/\/[^/]+)?\/api\//.test(url) && !url.includes('/api/auth/')) {
      leaving = true
      window.location.assign(loginUrl(app))
    }
    return res
  }
}

export async function signOut(app: SessionApp) {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app }) })
  } finally {
    window.location.assign(app === 'client' ? '/login/?app=client' : '/login/')
  }
}

const ROLE_WORD: Record<string, string> = { analyst: 'Analyst', supervisor: 'Supervisor', compliance: 'Compliance', admin: 'Admin' }

/** "Ana Pop · Analyst  [Sign out]". Renders nothing when login is off (OPENLOOP_AUTH=off) or nobody is signed in. */
export function SessionChip({ app, className = '' }: { app: SessionApp; className?: string }) {
  const me = useMe()
  // the portal shows the client when one is signed in, else the staff member previewing it
  const user = me?.auth ? (app === 'client' ? me.client ?? me.staff : me.staff) : null
  if (!user) return null
  const as: SessionApp = user.role === 'client' ? 'client' : 'staff'
  const sub = user.role === 'client' ? 'Client' : `${ROLE_WORD[user.role] ?? user.role}${app === 'client' ? ' (preview)' : ''}`
  return (
    <span className={`session-chip ${className}`.trim()}>
      <span className="session-who" title={user.email}>
        <b>{user.name}</b><span>{sub}</span>
      </span>
      <button type="button" className="btn quiet sm" onClick={() => void signOut(as)}>Sign out</button>
    </span>
  )
}
