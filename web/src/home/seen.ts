/* Per-case "last seen" seq for the bank employee, shared with the messages thread:
   localStorage `openloop-seen:employee:<caseId>` = a ledger seq. Unread means a seq above it. */
const PREFIX = 'openloop-seen:employee:'
/** Fired on this window after a write here (the `storage` event only reaches other tabs). */
export const SEEN_EVENT = 'openloop-seen'

const key = (caseId: string) => PREFIX + caseId
const ping = () => { try { window.dispatchEvent(new Event(SEEN_EVENT)) } catch { /* no window */ } }

export function getSeen(caseId: string): number {
  try { return Number(window.localStorage.getItem(key(caseId))) || 0 } catch { return 0 }
}

/** Sets the seen seq as is (not a max): after a demo reset the ledger is shorter and new events must count as new. */
export function setSeen(caseId: string, seq: number) {
  if (!caseId || !Number.isFinite(seq)) return
  try {
    if (window.localStorage.getItem(key(caseId)) === String(seq)) return
    window.localStorage.setItem(key(caseId), String(seq))
  } catch { return }
  ping()
}

export function setSeenMany(entries: Iterable<[string, number]>) {
  let changed = false
  try {
    for (const [id, seq] of entries) {
      if (!id || !Number.isFinite(seq) || window.localStorage.getItem(key(id)) === String(seq)) continue
      window.localStorage.setItem(key(id), String(seq))
      changed = true
    }
  } catch { /* storage unavailable */ }
  if (changed) ping()
}

/** After "Reset all demo cases": seqs restart and ids like case-9 get reused, so old values would hide new items. */
export function clearSeen() {
  try {
    const ls = window.localStorage
    const keys: string[] = []
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(PREFIX)) keys.push(k) }
    keys.forEach((k) => ls.removeItem(k))
  } catch { /* storage unavailable */ }
  ping()
}

/** Every seen value in one string: the poller compares it to notice writes that came without an event. */
export function seenSignature(): string {
  try {
    const ls = window.localStorage
    const out: string[] = []
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(PREFIX)) out.push(`${k}=${ls.getItem(k)}`) }
    return out.sort().join('|')
  } catch { return '' }
}
