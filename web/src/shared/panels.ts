/* The case screen's side panels, remembered per case and per app in this browser (the bank's CaseView and the portal's
   case page). One record per case, `{ left, right, tab }` as JSON under `ol:bank:panels:{caseId}` or
   `ol:client:panels:{caseId}`, in raw localStorage: lib/store's helper would add its prefix and change the key.
   A case opened for the first time starts with both sides folded to their rails, so the centre column gets the full
   width. A private window or blocked storage falls back to that default and never breaks the page. */
import { useCallback, useEffect, useState, type SetStateAction } from 'react'

export type PanelApp = 'bank' | 'client'
export interface Panels<T extends string> { left: boolean; right: boolean; tab: T }

const keyFor = (app: PanelApp, caseId: string) => `ol:${app}:panels:${caseId}`

function readPanels<T extends string>(key: string, tabs: readonly T[], fallback: T): Panels<T> {
  const folded: Panels<T> = { left: false, right: false, tab: fallback }
  try {
    const raw = window.localStorage.getItem(key)
    const v: unknown = raw == null ? null : JSON.parse(raw)
    if (!v || typeof v !== 'object') return folded
    const o = v as Record<string, unknown>
    return { left: o.left === true, right: o.right === true, tab: tabs.includes(o.tab as T) ? (o.tab as T) : fallback }
  } catch {
    return folded
  }
}

/** Keeps fields this hook does not own (e.g. the portal's `phoneTab`, client/phone.ts) in the same record. */
function writePanels<T extends string>(key: string, p: Panels<T>) {
  try {
    let rest: Record<string, unknown> = {}
    try { const o: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null'); if (o && typeof o === 'object' && !Array.isArray(o)) rest = o as Record<string, unknown> } catch { /* start fresh */ }
    window.localStorage.setItem(key, JSON.stringify({ ...rest, left: p.left, right: p.right, tab: p.tab }))
  } catch { /* this page only */ }
}

function apply<V>(a: SetStateAction<V>, prev: V): V {
  return typeof a === 'function' ? (a as (p: V) => V)(prev) : a
}

/** One case's panels. The caller remounts per case (key={caseId}), so the record is read once, on mount. Every writer
 *  (the [ and ] shortcuts, the fold buttons, the rails, the stacked sections' toggles on narrow screens) goes through
 *  these setters. `showTab` also unfolds the right side, so a tab picked from elsewhere (a citation, the bell) is seen. */
export function usePanels<T extends string>(app: PanelApp, caseId: string, tabs: readonly T[], fallback: T) {
  const key = keyFor(app, caseId)
  const [p, setP] = useState<Panels<T>>(() => readPanels(key, tabs, fallback))
  useEffect(() => writePanels(key, p), [key, p])
  const setLeft = useCallback((a: SetStateAction<boolean>) => setP((s) => ({ ...s, left: apply(a, s.left) })), [])
  const setRight = useCallback((a: SetStateAction<boolean>) => setP((s) => ({ ...s, right: apply(a, s.right) })), [])
  const showTab = useCallback((tab: T) => setP((s) => (s.right && s.tab === tab ? s : { ...s, right: true, tab })), [])
  return { left: p.left, right: p.right, tab: p.tab, setLeft, setRight, showTab }
}
