/* Pure helpers for the portal: the client copy filter, state and progress derivation, and request/document matching. */
import type { ClientDocument, ClientView, Confirmation, MissingDocument, PortalState } from './types'

export const arr = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])

/* ---------- copy filter ----------
   The server builds client views from an allow-list; this is a second line of defence. Any string that looks internal
   (rule IDs, review scores, staff IDs, internal words) is replaced by a neutral sentence before it reaches the page. */
const INTERNAL = /\b(?:HR|JQ|GATE|SR)-\d+\b|\bEX?-\d+\b|%|discrep|judge|insider|complian|on[\s_-]?hold|\banalyst|\bstaff[\s_-]?(?:id\b|\d)|probab|\bAMLR\b|\bconfidence\b|\bthreshold\b/i

export function safe(text: unknown, fallback: string): string {
  const s = typeof text === 'string' ? text.trim() : ''
  return !s || INTERNAL.test(s) ? fallback : s
}

/** Used when `missing_documents[].why` is absent (older server). Keyed by document type. */
const WHY_FALLBACK: Record<string, string> = {
  onrc_certificate: 'It confirms your company is registered and active.',
  fiscal_certificate: 'It shows your company has no outstanding tax debts.',
  id_card: 'We must identify everyone who owns a significant share of the company.',
}
export const docType = (key: string) => key.split(':')[0]
export const whyFor = (m: MissingDocument) =>
  safe(m.why, WHY_FALLBACK[docType(m.key)] ?? 'We need it to finish checking your file.')

/** The short name used on the header's next-step button: "fiscal certificate", "Elena Munteanu's identity card". */
export function shortLabel(m: MissingDocument): string {
  const [type, person] = m.key.split(':')
  if (type === 'id_card' && person) return `${person}’s identity card`
  const base = safe(m.label, 'document').replace(/\s*\([^)]*\)\s*$/, '')
  return base.charAt(0).toLowerCase() + base.slice(1)
}

/* ---------- state ---------- */
const STATES: PortalState[] = ['needs_you', 'under_review', 'complete', 'in_progress']

export function portalState(v: ClientView): PortalState {
  const s = v.overview?.state
  if (s && STATES.includes(s)) return s
  // older server: derive from the plain status text and what is pending
  const t = String(v.overview?.status_text ?? '').toLowerCase()
  if (t.startsWith('complete')) return 'complete'
  if (arr(v.missing_documents).length) return 'needs_you'
  if (t.includes('review') || arr(v.issues).some((i) => /under review/i.test(i.what))) return 'under_review'
  return 'in_progress'
}

export const STATE_PILL: Record<PortalState, string> = {
  needs_you: 'We need something from you',
  under_review: 'Under review by the bank',
  complete: 'Complete: the bank will contact you with the decision',
  in_progress: 'We are checking your file',
}

export type StepState = 'done' | 'active' | 'needs' | 'todo'
export interface Step { name: string; state: StepState; caption: string }

/** Four derived steps. Decision is the bank's human decision and is never "done" here. */
export function progressSteps(v: ClientView, docs: ClientDocument[]): Step[] {
  const st = portalState(v)
  const pending = arr(v.missing_documents).length
  const received = docs.length > 0 || arr(v.timeline).some((e) => e.type === 'DOCUMENT_RECEIVED')
  const checks = arr(v.overview?.checks)
  const verified = checks.filter((c) => c.status_word === 'Verified').length
  const allVerified = checks.length > 0 && verified === checks.length
  const docsDone = received && pending === 0
  const complete = st === 'complete'
  return [
    {
      name: 'Documents',
      state: docsDone ? 'done' : pending ? 'needs' : 'todo',
      caption: docsDone ? 'All received' : pending ? `${pending} to send` : 'Not started',
    },
    {
      name: 'Checks',
      state: allVerified || complete ? 'done' : received ? 'active' : 'todo',
      caption: checks.length ? `${complete ? checks.length : verified} of ${checks.length} done` : 'Not started',
    },
    {
      name: 'Bank review',
      state: complete ? 'done' : st === 'under_review' ? 'active' : 'todo',
      caption: complete ? 'Done' : st === 'under_review' ? 'In progress' : 'Not yet',
    },
    {
      name: 'Decision',
      state: complete ? 'active' : 'todo',
      caption: complete ? 'A bank officer decides' : 'By a bank officer',
    },
  ]
}

/* ---------- requests and documents ---------- */
const docNum = (d: ClientDocument) => Number(/(\d+)$/.exec(d.id)?.[1] ?? 0)

/** The newest document of the request's type received since it was asked for. While the request is still pending,
 *  its status says why: "quarantined" (not accepted) or "unreadable" (a PDF waiting for manual reading). */
export function latestFor(m: MissingDocument, docs: ClientDocument[]): ClientDocument | undefined {
  const mine = docs.filter((d) => d.type === docType(m.key) && (d.received_day ?? -Infinity) >= m.requested_day)
  return mine.sort((a, b) => ((b.received_day ?? 0) - (a.received_day ?? 0)) || (docNum(b) - docNum(a)))[0]
}

/** An earlier copy of this exact document (same type, same person for ID cards) that has expired. */
export function expiredFor(m: MissingDocument, docs: ClientDocument[]): boolean {
  const [type, person] = m.key.split(':')
  return docs.some((d) => d.status === 'expired' && d.type === type
    && (!person || d.name.toLowerCase().includes(person.toLowerCase())))
}

/** Pending requests, newest first. */
export const sortRequests = (ms: MissingDocument[]) =>
  [...ms].sort((a, b) => (b.requested_day - a.requested_day) || ((b.seq ?? 0) - (a.seq ?? 0)))

export const confirmFallback = (c: Confirmation) =>
  c.kind === 'credit_check_consent'
    ? 'We need your consent to check your company’s credit history.'
    : 'We changed the contact details on your file. Did you request this?'

/* ---------- time ---------- */
const DAY_MS = 86_400_000

/** Day of the file for an ISO time: matched against a timeline event at the same time, else estimated from the
 *  earliest known (time, day) pair. Returns null when nothing is known. */
export function dayOf(iso: string, v: ClientView): number | null {
  const tl = arr(v.timeline)
  const same = tl.find((e) => e.when === iso)
  if (same) return same.day
  const t = Date.parse(iso)
  if (Number.isNaN(t) || !tl.length) return null
  const start = Math.min(...tl.map((e) => Date.parse(e.when) - e.day * DAY_MS).filter((n) => !Number.isNaN(n)))
  return Number.isFinite(start) ? Math.floor((t - start) / DAY_MS) : null
}

/** "09:00" from a sim-time ISO string (the demo clock, shown as written, like on the bank screen). */
export const hhmm = (iso: string) => (/T(\d{2}:\d{2})/.exec(iso)?.[1] ?? '')

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
