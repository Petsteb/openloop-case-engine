import { useSyncExternalStore } from 'react'
import { DEMO_CASE_ID } from '@/shared/demo'

/* Hash routing for the portal, with no router library: "#/" is My files, "#/case/{id}" is a file.
   An empty hash opens the demo case (history.replaceState), so the old /client/ links still land on demo-1. */
export type Route = { name: 'home' } | { name: 'case'; id: string }

const DEFAULT_CASE = DEMO_CASE_ID
export const HOME_HREF = '#/'
export const caseHref = (id: string) => `#/case/${encodeURIComponent(id)}`

/** Rewrites an empty hash to the demo case without adding a history entry. Call before the first render. */
export function ensureHash() {
  const h = window.location.hash
  if (!h || h === '#') {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${caseHref(DEFAULT_CASE)}`)
  }
}

export function parseHash(hash: string): Route {
  const s = hash.replace(/^#/, '')
  const m = /^\/case\/([^/?#]+)\/?$/.exec(s)
  if (m) {
    try { return { name: 'case', id: decodeURIComponent(m[1]) } } catch { return { name: 'home' } }
  }
  if (!s) return { name: 'case', id: DEFAULT_CASE }
  return { name: 'home' }
}

function subscribe(cb: () => void) {
  const on = () => { ensureHash(); cb() }
  window.addEventListener('hashchange', on)
  window.addEventListener('popstate', on)
  return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on) }
}
const snapshot = () => window.location.hash

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, snapshot))
}

export function go(href: string) {
  if (window.location.hash !== href) window.location.hash = href
}
