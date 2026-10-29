import { useSyncExternalStore } from 'react'
import { DEMO_CASE_ID } from '@/shared/demo'
import { DEFAULT_COMPANY, storedCompany } from './store'

/* Hash routing for the portal, with no router library: "#/" is My cases, "#/case/{id}" is a case.
   An empty hash opens the demo case (history.replaceState), so the old /client/ links still land on demo-1, unless
   this browser chose another company in "viewing as": then it opens that company's My cases. Opening demo-1 there
   would switch the picker back to the demo company (the file page adopts its file's company). */
export type Route = { name: 'home' } | { name: 'case'; id: string }

const DEFAULT_CASE = DEMO_CASE_ID
export const HOME_HREF = '#/'
export const caseHref = (id: string) => `#/case/${encodeURIComponent(id)}`

/** Where an empty hash goes: the demo case, or My cases when another company was chosen in this browser. */
function defaultHash(): string {
  const c = storedCompany()
  return c && c !== DEFAULT_COMPANY ? HOME_HREF : caseHref(DEFAULT_CASE)
}

/** Rewrites an empty hash (see defaultHash) without adding a history entry. Call before the first render. */
export function ensureHash() {
  const h = window.location.hash
  if (!h || h === '#') {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${defaultHash()}`)
  }
}

export function parseHash(hash: string): Route {
  const s = hash.replace(/^#/, '')
  const m = /^\/case\/([^/?#]+)\/?$/.exec(s)
  if (m) {
    try { return { name: 'case', id: decodeURIComponent(m[1]) } } catch { return { name: 'home' } }
  }
  if (!s) return defaultHash() === HOME_HREF ? { name: 'home' } : { name: 'case', id: DEFAULT_CASE }
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
