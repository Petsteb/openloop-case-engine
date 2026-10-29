import { useSyncExternalStore } from 'react'

/* Two small localStorage-backed stores, each with a same-tab listener (a write in this tab fires no "storage" event):
   - the demo's chosen company ("Demo: viewing as ..."), key openloop-client-company, default "aurora";
   - the last-seen ledger seq per file, key openloop-seen:client:<caseId> (the messages thread writes it too). */

function store(isMine: (key: string) => boolean) {
  const subs = new Set<() => void>()
  let rev = 0
  const emit = () => { rev += 1; subs.forEach((f) => f()) }
  const subscribe = (cb: () => void) => {
    subs.add(cb)
    const on = (e: StorageEvent) => { if (e.key === null || isMine(e.key)) emit() }
    window.addEventListener('storage', on)
    return () => { subs.delete(cb); window.removeEventListener('storage', on) }
  }
  return { emit, subscribe, rev: () => rev }
}

/* ---------- chosen company ---------- */
export const COMPANY_KEY = 'openloop-client-company'
export const DEFAULT_COMPANY = 'aurora'
const companyStore = store((k) => k === COMPANY_KEY)

function readCompany(): string {
  try {
    const raw = window.localStorage.getItem(COMPANY_KEY)
    if (!raw) return DEFAULT_COMPANY
    let v: unknown = raw
    if (raw.startsWith('"')) { try { v = JSON.parse(raw) } catch { /* plain string */ } }
    return typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : DEFAULT_COMPANY
  } catch { return DEFAULT_COMPANY }
}
// kept in memory too, so the choice holds for this page when storage is unavailable; the module-level listener runs
// before the components' ones (registered later), so they read the new value
let company = readCompany()
window.addEventListener('storage', (e) => { if (e.key === COMPANY_KEY || e.key === null) company = readCompany() })

export function writeCompany(id: string) {
  if (!id || id === company) return
  company = id
  try { window.localStorage.setItem(COMPANY_KEY, id) } catch { /* storage unavailable: this page only */ }
  companyStore.emit()
}
export function useCompany(): string {
  return useSyncExternalStore(companyStore.subscribe, () => company)
}

/* ---------- last-seen seq per file ---------- */
const SEEN_PREFIX = 'openloop-seen:client:'
const seenStore = store((k) => k.startsWith(SEEN_PREFIX))
const memSeen = new Map<string, number>()   // only used when storage is unavailable
// the messages thread writes the same key in this tab and announces it with a same-tab "openloop-seen" event
window.addEventListener('openloop-seen', () => seenStore.emit())

/** The stored last-seen seq. With the file's ledger length: a value past the end is stale (the demo was reset), so 0. */
export function readSeen(caseId: string, ledgerLen?: number | null): number {
  let v: number
  try {
    v = Number(JSON.parse(window.localStorage.getItem(SEEN_PREFIX + caseId) ?? '0')) || 0
  } catch {
    v = memSeen.get(caseId) ?? 0
  }
  return typeof ledgerLen === 'number' && ledgerLen > 0 && v > ledgerLen ? 0 : v
}
/** Moves forward only (the thread writes the same key), except over a stale value past the ledger's end. */
export function markSeen(caseId: string, seq: number, ledgerLen?: number | null) {
  if (!caseId || !Number.isFinite(seq) || seq <= 0 || seq <= readSeen(caseId, ledgerLen)) return
  memSeen.set(caseId, seq)
  try { window.localStorage.setItem(SEEN_PREFIX + caseId, String(seq)) } catch { /* memory only */ }
  seenStore.emit()
}
/** Re-renders the caller whenever a last-seen value changes (this tab, the thread, or another tab). */
export function useSeenRev(): number {
  return useSyncExternalStore(seenStore.subscribe, seenStore.rev)
}
