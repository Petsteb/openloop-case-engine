/* Pure row -> view mapping for the work queue (no DOM, no React). */
import { arr, fDate, fTime, isComplete, isOnHold, ms, openExceptions, plural, splitTitle, statusLine } from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import type { CaseExtra, CaseRow, Note } from './types'

/** Each file sits in exactly one bucket, so the header counts add up to the number of files.
 *  `state` is not used: on employee rows it is the client's perspective ("needs_you" means the client must act). */
export type Bucket = 'needs' | 'waiting' | 'ready' | 'hold' | 'working'
export type Filter = 'all' | Exclude<Bucket, 'working'>

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function bucketOf(r: CaseRow): Bucket {
  if (r.status === 'ON_HOLD') return 'hold'
  if (r.status === 'READY_FOR_DECISION') return 'ready'
  if (n(r.open_decisions) > 0 || n(r.needs_you) > 0) return 'needs'
  if (n(r.waiting_on_client) > 0) return 'waiting'
  return 'working'
}

export const FILTERS: { id: Filter; label: string; empty: string }[] = [
  { id: 'all', label: 'All', empty: 'No open files.' },
  { id: 'needs', label: 'Needs you', empty: 'Nothing needs you right now.' },
  { id: 'waiting', label: 'Waiting on client', empty: 'No file is waiting on a client.' },
  { id: 'ready', label: 'Ready', empty: 'No file is ready for a decision yet.' },
  { id: 'hold', label: 'On hold', empty: 'No file is on hold.' },
]

export const matches = (r: CaseRow, f: Filter) => f === 'all' || bucketOf(r) === f

export function bucketCounts(rows: CaseRow[]): Record<Filter, number> {
  const c: Record<Filter, number> = { all: rows.length, needs: 0, waiting: 0, ready: 0, hold: 0 }
  for (const r of rows) { const b = bucketOf(r); if (b !== 'working') c[b]++ }
  return c
}

/** The header numerals: only the buckets that have files, needs-you first. */
export function summary(c: Record<Filter, number>): { id: Filter; value: number; label: string }[] {
  const out: { id: Filter; value: number; label: string }[] = [
    { id: 'needs', value: c.needs, label: c.needs === 1 ? 'needs you' : 'need you' },
    { id: 'waiting', value: c.waiting, label: c.waiting === 1 ? 'waiting on a client' : 'waiting on clients' },
    { id: 'ready', value: c.ready, label: 'ready' },
  ]
  if (c.hold) out.push({ id: 'hold', value: c.hold, label: 'on hold' })
  return out
}

/** The row's newest seq that can raise a notification. */
export const rowSeq = (r: CaseRow) => Math.max(n(r.last_message_seq), n(r.last_action_seq))

export const lastActivity = (r: CaseRow) => {
  const t = ms(r.last_activity)
  return t === null ? '' : `${fDate(t)} ${fTime(t)}`
}

export const rowMeta = (r: CaseRow) => {
  const t = String(r.template_title || '')
  const p = String(r.product || '')
  return { template: t, product: p && p !== t ? p : '' }
}

export const countWord = {
  needs: (v: number) => (v === 1 ? 'needs you' : 'need you'),
  decisions: (v: number) => (v === 1 ? 'decision' : 'decisions'),
  waiting: () => 'waiting on client',
}

/** Unread items for the bell, newest first. The case on screen never counts: the analyst is looking at it. */
export const unreadNotes = (notes: Note[], seen: (id: string) => number, current?: string | null) =>
  notes.filter((x) => x.case_id !== current && n(x.seq) > seen(x.case_id))

/** Older servers have no `/api/cases`: one row for demo-1, built from its bundle. */
export function rowFromBundle(b: Bundle): CaseRow {
  const c = b.case as Bundle['case'] & CaseExtra
  const { name, sub } = splitTitle(b)
  const open = openExceptions(b).length
  const waiting = arr(b.requirements).filter((r) => r.status === 'OPEN_WAITING').length
  const ev = arr(b.events)
  return {
    id: String(c?.id || 'demo-1'),
    title: String(c?.title || ''),
    template_title: c?.template_title || sub,
    company: c?.company || name,
    product: c?.product,
    status: isOnHold(b) ? 'ON_HOLD' : isComplete(b) ? 'READY_FOR_DECISION' : String(c?.status || 'OPEN'),
    status_text: statusLine(b).text,
    needs_you: open,
    open_decisions: open,
    waiting_on_client: waiting,
    day: n(c?.day),
    events: ev.length,
    last_message_seq: 0,
    last_action_seq: 0,
    last_activity: String(c?.sim_now || ''),
  }
}

export const filesWord = (v: number) => plural(v, 'open file')
