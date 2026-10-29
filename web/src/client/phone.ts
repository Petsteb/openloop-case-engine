/* Phones (≤ 640 px, the portal's phone breakpoint): the case page is one tab bar, Pending | Documents | Chat | Ask AI,
   instead of the stacked sections. The picked tab is remembered per case in the same record as the panels
   (`ol:client:panels:{caseId}`, shared/panels.ts) under its own field, `phoneTab`, so the desktop `tab` keeps its meaning.
   A record without the field (written before this, or by the bank's hook) reads as 'pending'. */
import { useEffect, useState, useSyncExternalStore } from 'react'

export type PhoneTab = 'pending' | 'docs' | 'chat' | 'ask'
export const PHONE_TABS: readonly PhoneTab[] = ['pending', 'docs', 'chat', 'ask']
const PHONE_QUERY = '(max-width: 640px)'

let list: MediaQueryList | null | undefined
const media = () => {
  if (list === undefined) { try { list = window.matchMedia(PHONE_QUERY) } catch { list = null } }
  return list
}
const subscribe = (cb: () => void) => {
  const m = media()
  m?.addEventListener('change', cb)
  return () => m?.removeEventListener('change', cb)
}
const isPhoneNow = () => media()?.matches ?? false

/** True on a phone-width screen; follows the window across the breakpoint (a rotated phone, a resized window). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhoneNow, () => false)
}

const keyFor = (caseId: string) => `ol:client:panels:${caseId}`
function readRecord(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key)
    const v: unknown = raw == null ? null : JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The phone tab of one case. Call it after usePanels: that hook writes only `{left, right, tab}` and so drops
 *  `phoneTab` on every write, and this effect (no deps: after every commit, declared later, so it runs later in the
 *  same commit) puts the field back, keeping the rest of the record as it is. */
export function usePhoneTab(caseId: string) {
  const key = keyFor(caseId)
  const [tab, setTab] = useState<PhoneTab>(() => {
    const v = readRecord(key)?.phoneTab
    return PHONE_TABS.includes(v as PhoneTab) ? (v as PhoneTab) : 'pending'
  })
  useEffect(() => {
    const o = readRecord(key)
    if (o?.phoneTab === tab) return
    try { window.localStorage.setItem(key, JSON.stringify({ ...(o ?? {}), phoneTab: tab })) } catch { /* this page only */ }
  })
  return [tab, setTab] as const
}
