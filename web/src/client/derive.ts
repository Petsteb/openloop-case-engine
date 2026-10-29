/* Pure helpers for the portal: the client copy filter, state and progress derivation, and request/document matching. */
import type {
  CaseRow, ClientDocument, ClientView, Confirmation, MissingDocument, PortalNotification, PortalState, Template, TimelineItem,
} from './types'

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
  safe(m.why, WHY_FALLBACK[docType(m.key)] ?? 'We need it to finish checking your case.')

/** Lower-case name words in a stable order: "Pop Radu" and "Radu Pop" give the same string (as the backend matches them). */
const nameWords = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ')
/** Same request key, whatever the name order: "id_card:Pop Radu" (register spelling) = "id_card:Radu Pop" (sample spelling). */
export function sameKey(a: string, b: string): boolean {
  const [ta, pa = ''] = String(a).split(':')
  const [tb, pb = ''] = String(b).split(':')
  return ta === tb && nameWords(pa) === nameWords(pb)
}

/** The short name used on the header's next-step button: "fiscal certificate", "Elena Munteanu's identity card". */
export function shortLabel(m: MissingDocument): string {
  const [type, person] = m.key.split(':')
  if (type === 'id_card' && person) return `${person}’s identity card`
  const base = safe(m.label, 'document').replace(/\s*\([^)]*\)\s*$/, '')
  // "Fiscal certificate" reads "fiscal certificate" mid-sentence; an acronym ("UBO declaration") keeps its capitals
  return /^[A-Z][a-z]/.test(base) ? base.charAt(0).toLowerCase() + base.slice(1) : base
}

/* ---------- state ---------- */
const STATES: PortalState[] = ['needs_you', 'under_review', 'complete', 'in_progress']

export function portalState(v: ClientView): PortalState {
  const s = v.overview?.state
  if (s && STATES.includes(s)) return s
  if (/hold/i.test(String(s ?? ''))) return 'under_review'   // a hold reads as a review to the client
  // older server: derive from the plain status text and what is pending
  const t = String(v.overview?.status_text ?? '').toLowerCase()
  if (t.startsWith('complete')) return 'complete'
  if (arr(v.missing_documents).length) return 'needs_you'
  if (t.includes('review') || arr(v.issues).some((i) => /under review/i.test(i.what))) return 'under_review'
  return 'in_progress'
}

/** The client's latest "No, I didn't" answer, from the server's timeline (so the notice survives a reload). */
export function latestDispute(v: ClientView): TimelineItem | undefined {
  return arr(v.timeline).filter((e) => e.type === 'CLIENT_DISPUTE').sort((a, b) => b.seq - a.seq)[0]
}

/** The pill's tone. It follows `overview.state`, with one override: a complete file with a question still open
 *  (e.g. credit-bureau consent, which stays pending by design) must not read "Complete" next to that question.
 *  The override can only lower "complete" to "needs_you"; it never makes a file look complete. */
export function pillState(state: PortalState, missing: number, confirmations: number): PortalState {
  return state === 'complete' && missing === 0 && confirmations > 0 ? 'needs_you' : state
}

export const STATE_PILL: Record<PortalState, string> = {
  needs_you: 'We need something from you',
  under_review: 'Under review by the bank',
  complete: 'Complete: the bank will contact you with the decision',
  in_progress: 'We are checking your case',
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
const docNum = (d: ClientDocument) => Number(/(\d+)$/.exec(String(d.id ?? ''))?.[1] ?? 0)

/** The newest document of the request's type received since it was asked for. While the request is still pending,
 *  its status says why: "quarantined" (not accepted) or "unreadable" (a PDF waiting for manual reading). */
/** Is this document for the request's person? ID cards are named "Identity card — <person>"; other types have no person. */
function forPerson(person: string | undefined, d: ClientDocument): boolean {
  if (!person) return true
  const words = nameWords(person).split(' ')
  const name = String(d.name ?? '').toLowerCase()
  return words.every((w) => name.includes(w))
}

export function latestFor(m: MissingDocument, docs: ClientDocument[]): ClientDocument | undefined {
  const person = m.key.split(':')[1]
  const mine = docs.filter((d) => d.type === docType(m.key) && forPerson(person, d) && (d.received_day ?? -Infinity) >= m.requested_day)
  return mine.sort((a, b) => ((b.received_day ?? 0) - (a.received_day ?? 0)) || (docNum(b) - docNum(a)))[0]
}

/** An earlier copy of this exact document (same type, same person for ID cards) that has expired. */
export function expiredFor(m: MissingDocument, docs: ClientDocument[]): boolean {
  const [type, person] = m.key.split(':')
  return docs.some((d) => d.status === 'expired' && d.type === type && forPerson(person, d))
}

/** Pending requests, newest first. */
export const sortRequests = (ms: MissingDocument[]) =>
  [...ms].sort((a, b) => (b.requested_day - a.requested_day) || ((b.seq ?? 0) - (a.seq ?? 0)))

export const confirmFallback = (c: Confirmation) =>
  c.kind === 'credit_check_consent'
    ? 'We need your consent to check your company’s credit history.'
    : 'We changed the contact details on your case. Did you request this?'

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

/* ---------- the one next action (shared by the case page and My cases) ---------- */
export const IDLE_TEXT: Record<PortalState, string> = {
  needs_you: 'Nothing to do right now.',
  under_review: 'Nothing to do right now. The bank is reviewing your case and will tell you if it needs anything.',
  in_progress: 'Nothing to do right now. We are checking your documents.',
  complete: 'Nothing to do. A bank officer will contact you with the decision.',
}

/** What the client should do next, from what is pending. Null when nothing is asked of them. */
export function needsText(state: PortalState, missing: number, confirmations: number): string | null {
  // complete, but a question is still open (credit-bureau consent stays pending by design): never "Complete" next to it
  if (pillState(state, missing, confirmations) !== state) {
    return `Your documents are complete. ${confirmations === 1 ? 'One question left.' : `${confirmations} questions left.`}`
  }
  if (missing && confirmations) return `Please send ${plural(missing, 'document', 'documents')} and answer ${plural(confirmations, 'question', 'questions')}.`
  if (missing) return missing === 1 ? 'Please send us one document.' : `Please send us ${missing} documents.`
  if (confirmations) return confirmations === 1 ? 'Please answer one question from the bank.' : `Please answer ${confirmations} questions from the bank.`
  return null
}
/* ---------- the file's decision, in its template's words ----------
   The server sends the words with the template list (`GET /api/templates`: "credit decision", "annual review sign-off")
   and writes them into its own client status line. This map is only the fallback for an older server's list. */
const DECISION_FALLBACK: Record<string, string> = { sme_loan: 'credit decision', kyb_review: 'annual review sign-off' }
/** "credit decision" / "annual review sign-off" for a template id, or '' when nothing is known (generic wording). */
export function decisionFor(templates: Template[] | null | undefined, id: string | undefined): string {
  if (!id) return ''
  const server = safe(arr(templates ?? undefined).find((t) => t.id === id)?.decision, '')
  return server || DECISION_FALLBACK[id] || ''
}
/** The pill's words for a state (used when the server's own line can't be: an override, or no line). */
export const pillText = (state: PortalState, decision?: string) =>
  state === 'complete' && decision ? `Complete: waiting for the bank’s ${decision}` : STATE_PILL[state]
/** A My cases row: the server's line (it already names the template's decision), else the pill's words. */
export const rowStatusText = (r: CaseRow, tone: PortalState, decision?: string) => safe(r.status_text, pillText(tone, decision))
export const nextText = (state: PortalState, missing: number, confirmations: number, decision?: string) =>
  needsText(state, missing, confirmations)
    ?? (state === 'complete' && decision ? `Nothing to do. The bank will contact you after its ${decision}.` : IDLE_TEXT[state])

/* ---------- files (multi-case) ---------- */
/** The client's name for a kind of file. The server's titles and descriptions are written for staff ("SME loan and KYB
 *  check") and it sends no client-worded ones, so the two known templates keep theirs here; any other template shows
 *  the server's title and description (through the copy filter). */
const CLIENT_TEMPLATES: Record<string, { title: string; eyebrow: string; about: string }> = {
  sme_loan: {
    title: 'Working-capital loan',
    eyebrow: 'Your financing case',
    about: 'Financing for your day-to-day business. We ask for your documents, check them, and a bank officer decides.',
  },
  kyb_review: {
    title: 'Annual business review',
    eyebrow: 'Your annual business review',
    about: 'Your yearly check-in with the bank: we confirm that your company, its owners and its taxes are up to date.',
  },
}
export function templateTitle(id: string | undefined, serverTitle?: string): string {
  const known = id ? CLIENT_TEMPLATES[id] : undefined
  return known ? known.title : safe(serverTitle, 'Your case')
}
/** The line above the company name on a file page. */
export const fileEyebrow = (id: string | undefined, serverTitle?: string) =>
  (id ? CLIENT_TEMPLATES[id]?.eyebrow : undefined) ?? templateTitle(id, serverTitle)
/** What a kind of file is about: the client-worded text for a known template, else the server's description or goal. */
export function templateAbout(id: string | undefined, serverText?: string, goal?: string): string {
  const known = id ? CLIENT_TEMPLATES[id] : undefined
  return known ? known.about : safe(serverText, safe(goal, 'A new case with the bank.'))
}
/** The footer's line on who decides, in the template's words when the decision is known. */
export const decidesLine = (decision?: string) =>
  decision ? `The ${decision} is made by a bank officer.` : 'A bank officer makes the final decision.'
/** The loan amount line ("Working-capital loan, 500,000 RON") only belongs to a loan file: the server sends the
 *  company's product on every file, an annual review included. */
export const productFor = (template: string | undefined, product: string | undefined) =>
  (!template || template === 'sme_loan') && product ? safe(product, '') : ''

const asState = (s: unknown): PortalState =>
  (STATES.includes(s as PortalState) ? (s as PortalState) : /hold/i.test(String(s ?? '')) ? 'under_review' : 'in_progress')
export const rowState = (r: CaseRow) => asState(r.state)
/** How many things the file asks of the client. */
export const rowNeeds = (r: CaseRow) => Math.max(0, Number(r.needs_you ?? r.waiting_on_client ?? 0) || 0)
/** The row's pill tone: like the file page, a complete file with a question still open reads "needs you". */
export const rowTone = (r: CaseRow): PortalState => {
  const s = rowState(r)
  return s === 'complete' && rowNeeds(r) > 0 ? 'needs_you' : s
}
export const STATE_SHORT: Record<PortalState, string> = {
  needs_you: 'Needs you', under_review: 'Under review', in_progress: 'In progress', complete: 'Complete',
}
/** Files that need the client first (state, then how much they ask), then the most recently active. */
export function sortRows(rows: CaseRow[]): CaseRow[] {
  const rank = (r: CaseRow) => (rowTone(r) === 'needs_you' ? 0 : rowNeeds(r) > 0 ? 1 : 2)
  return [...rows].sort((a, b) => (rank(a) - rank(b)) || (rowNeeds(b) - rowNeeds(a))
    || String(b.last_activity ?? '').localeCompare(String(a.last_activity ?? '')) || String(a.id).localeCompare(String(b.id)))
}

/** A notification line for the bell. The server sends client-safe text; a staff role written after the author
 *  ("Ana Pop (analyst): ...") is dropped, and anything else that looks internal falls back to a neutral line. */
export function notificationText(n: PortalNotification): string {
  const fallback = n.kind === 'action' ? 'Your case needs something from you.' : 'New message from the bank.'
  const raw = typeof n.text === 'string' ? n.text.replace(/^([^:()]{1,60}?)\s*\([^)]{1,40}\)\s*:/, '$1:') : ''
  return safe(raw, fallback)
}
