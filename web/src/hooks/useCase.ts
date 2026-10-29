import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { ApiError, isUnavailable } from '@/lib/api'
import type { Bundle } from '@/lib/types'

/** Live updates: poll `/version` this often and refetch the bundle only when the ledger length changed. */
const POLL_MS = 2500
/** Servers without `/version`: refetch the bundle this often instead (it is re-rendered only if it changed). */
const FALLBACK_MS = 5000
/** How long to wait before asking a server without `/version` again (it may be upgraded while the page is open). */
const VERSION_RETRY_MS = 30000

const lastSeq = (b: Bundle | null) => { const ev = b?.events; return Array.isArray(ev) && ev.length ? ev[ev.length - 1].seq : 0 }
const evLen = (b: Bundle | null) => (Array.isArray(b?.events) ? b.events.length : 0)
/** Same ledger, same clock, same status: nothing on screen would change. */
const sameBundle = (a: Bundle | null, b: Bundle) => !!a && evLen(a) === evLen(b) && lastSeq(a) === lastSeq(b)
  && a.case?.status === b.case?.status && a.case?.sim_now === b.case?.sim_now

/** Turns an API failure into a sentence in the interface's voice. */
export function failureText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'The server cannot be reached. Check that the backend is running.'
    if (e.status === 409) return `That was already done: ${e.message}.`
    if (e.status === 422) return `The server refused this: ${e.message}.`
    return `Something went wrong (${e.message}).`
  }
  return 'Something went wrong.'
}

/**
 * Holds the case bundle. `act` runs one request at a time: while one is in flight, further calls are ignored
 * and `busy` is true. Every POST returns a Bundle, which replaces the whole state.
 * Live updates: another window (the client portal, a second bank screen) can change the case, so the hook polls
 * `/version` and refetches only when the ledger length changed; see the effect at the end.
 * One hook instance serves one case: App mounts the case screen with `key={caseId}`, so switching cases starts fresh.
 */
export function useCase(caseId: string) {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The server does not know this case id (only demo-1 is created on demand). */
  const [missing, setMissing] = useState(false)
  const lock = useRef(false)
  // Every bundle that lands bumps `gen`, so a slower poll answer can never overwrite a newer bundle.
  const gen = useRef(0)
  const current = useRef<Bundle | null>(null)
  const setB = useCallback((b: Bundle) => {
    gen.current++
    current.current = b
    setBundle(b)
  }, [])

  const act = useCallback(async (label: string, fn: () => Promise<Bundle>, success?: string | ((b: Bundle) => string | null)) => {
    if (lock.current) return null
    lock.current = true
    setBusy(label)
    gen.current++ // a poll that started before this action must not land after it
    try {
      const b = await fn()
      setB(b)
      setError(null)
      const msg = typeof success === 'function' ? success(b) : success
      if (msg) toast(msg)
      return b
    } catch (e) {
      toast.error(failureText(e))
      return null
    } finally {
      lock.current = false
      setBusy(null)
    }
  }, [setB])

  const load = useCallback(async () => {
    try {
      const b = await api.getBundle(caseId)
      setB(b)
      setError(null)
      setMissing(false)
    } catch (e) {
      // A fresh server may not know the case yet: create the demo case once.
      if (e instanceof ApiError && e.status === 404 && caseId === 'demo-1') {
        try { setB(await api.reset()); setError(null); return } catch (e2) { setError(failureText(e2)); return }
      }
      if (e instanceof ApiError && e.status === 404) { setMissing(true); setError('This case does not exist on this server. It may have been removed by a demo reset.'); return }
      setError(failureText(e))
    }
  }, [caseId, setB])

  /** Quiet refresh (after a chat turn appended to the ledger); skipped while an action runs. */
  const refresh = useCallback(async () => {
    if (lock.current) return
    const g = gen.current
    try {
      const b = await api.getBundle(caseId)
      if (g === gen.current && !lock.current) setB(b)
    } catch { /* keep the current bundle */ }
  }, [caseId, setB])

  useEffect(() => { void load() }, [load])

  // Live updates. One timeout chain (never overlapping), quiet on failure, paused while this tab has a request in
  // flight or is hidden. A refetch only replaces the bundle when something changed, so nothing re-renders for nothing;
  // components keep their own state (chat draft and scroll, selection, timeline view) across a new bundle.
  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    let versionDownUntil = 0
    const tick = async () => {
      let delay = POLL_MS
      try {
        if (lock.current || api.requestsInFlight() > 0 || document.hidden || !current.current) return
        const g = gen.current
        let refetch = false
        if (Date.now() >= versionDownUntil) {
          try {
            const v = await api.getVersion(caseId)
            // `!==`, not `>`: a demo reset from another window makes the ledger shorter.
            refetch = Number(v?.length) !== evLen(current.current)
          } catch (e) {
            if (!isUnavailable(e)) return // server unreachable: just try again on the next tick
            versionDownUntil = Date.now() + VERSION_RETRY_MS
          }
        }
        if (Date.now() < versionDownUntil) { delay = FALLBACK_MS; refetch = true }
        if (!refetch || stopped || lock.current || api.requestsInFlight() > 0) return
        const b = await api.pollBundle(caseId)
        if (stopped || g !== gen.current || lock.current || sameBundle(current.current, b)) return
        setB(b)
        setError(null)
      } catch { /* quiet: the next tick tries again */ } finally {
        if (!stopped) timer = window.setTimeout(() => void tick(), delay)
      }
    }
    timer = window.setTimeout(() => void tick(), POLL_MS)
    return () => { stopped = true; window.clearTimeout(timer) }
  }, [caseId, setB])

  return { bundle, busy, error, missing, act, load, refresh, caseId }
}
