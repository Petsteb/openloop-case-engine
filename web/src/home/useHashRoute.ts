import { useEffect, useMemo, useState } from 'react'
import { DEMO_CASE_ID } from '@/shared/demo'

/* Hash routing for the bank screen, no router library:
   `#/` is the work queue, `#/learned` the learned checks tab, `#/case/{id}` is a case. No hash goes to `#/case/demo-1`,
   so old links and the README demo work. */
export type HomeTab = 'queue' | 'learned'
export type Route = { name: 'home'; tab: HomeTab } | { name: 'case'; id: string }

const DEMO = `#/case/${DEMO_CASE_ID}`
const LEARNED = '#/learned'
const CASE_RE = /^#\/case\/([^/?#]+)\/?$/

/** `#clean` (presenter mode: no demo dock) predates routing; it still opens demo-1, with the dock hidden. */
export const STARTED_CLEAN = (() => {
  try { return window.location.hash === '#clean' || new URLSearchParams(window.location.search).has('clean') } catch { return false }
})()

const replace = (hash: string) => { try { window.history.replaceState(window.history.state, '', hash) } catch { /* sandboxed */ } return hash }

/** The current hash, rewritten in place (replaceState fires no hashchange) when it is empty, `#clean` or unknown. */
function normalize(): string {
  const h = window.location.hash
  if (h === '' || h === '#' || h === '#clean') return replace(DEMO)
  if (h === '#/' || h === LEARNED || CASE_RE.test(h)) return h
  return replace('#/')
}

export function parseRoute(hash: string): Route {
  const m = CASE_RE.exec(hash)
  if (!m) return { name: 'home', tab: hash === LEARNED ? 'learned' : 'queue' }
  let id = m[1]
  try { id = decodeURIComponent(id) } catch { /* keep it raw */ }
  return { name: 'case', id }
}

export const caseHref = (id: string) => `#/case/${encodeURIComponent(id)}`
export const HOME_HREF = '#/'
export const LEARNED_HREF = LEARNED

/** Navigates with a history entry, so the browser's back button returns to the previous screen. */
export function go(hash: string) {
  if (window.location.hash === hash) return
  window.location.hash = hash
}

export function useHashRoute(): Route {
  const [hash, setHash] = useState(normalize)
  useEffect(() => {
    const on = () => setHash(normalize())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return useMemo(() => parseRoute(hash), [hash])
}
