/* Pure Bundle -> view mapping. No DOM, no React, relative imports only (testable from a Node script). */
import type {
  Bundle, DocDetail, DocField, DocListItem, DocUse, DocumentInfo, Evidence, Exception_, LedgerEvent, Requirement, Timer, TraceStep,
} from './types'

/* ================= time ================= */
export const MIN = 6e4
export const HOUR = 36e5
export const DAY = 864e5
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

export const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const plural = (n: number, w: string, many?: string) => `${n} ${n === 1 ? w : many || w + 's'}`
// All dates in UTC by hand, so the projector laptop's locale cannot change the demo.
export const fDate = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
export const fWeekDate = (t: number) => { const d = new Date(t); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
export const fTime = (t: number) => { const d = new Date(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }

/** Day numbers count calendar days (UTC) from the day the case opened, so axis midnights line up. */
export function caseClock(b: Bundle) {
  const opened = ms(b.case?.opened_at) ?? ms(b.case?.sim_now) ?? Date.UTC(2026, 9, 28, 9)
  const now = ms(b.case?.sim_now) ?? opened
  const midnight0 = Math.floor(opened / DAY) * DAY
  const dayNo = (t: number) => Math.floor((t - midnight0) / DAY)
  const fWhen = (t: number) => `Day ${dayNo(t)}, ${fDate(t)} at ${fTime(t)}`
  return { opened, now, midnight0, dayNo, fWhen }
}
export type Clock = ReturnType<typeof caseClock>

/* ================= text ================= */
export const arr = <T,>(x: T[] | null | undefined): T[] => (Array.isArray(x) ? x : [])
export const humanize = (s: unknown) => String(s ?? '').replace(/_/g, ' ')
export const sentence = (s: unknown) => { const t = String(s ?? ''); return t ? t[0].toUpperCase() + t.slice(1) : t }
const joinPlus = (s: string) => {
  // join "A + B" lists, but keep arithmetic such as "(180,000 + 120,000)"
  const parts = s.split(/(?<!\d)\s+\+\s+|\s+\+\s+(?!\d)/)
  return parts.length < 2 ? s : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
/** Copy rules: no arrows, no "A · B" strings, no "+" joins. */
export const tidy = (s: unknown) => joinPlus(String(s ?? '')
  .replace(/\s*(→|->)\s*/g, ', ')
  .replace(/\s+·\s+/g, ', ')
  .replace(/\s+/g, ' ')
  .trim())
const CODE_WORDS: Record<string, string> = {
  SATISFIED: 'verified', OPEN_WAITING: 'waiting', CONTRADICTED: 'in conflict', NEEDS_REVIEW: 'needs review',
  EXPIRED: 'expired', READY_FOR_DECISION: 'ready for decision', ON_HOLD: 'on hold',
}
const CODES = Object.keys(CODE_WORDS).join('|')
/** Raw status codes in agent and ledger text become plain words. */
export const plain = (s: unknown) => String(s ?? '')
  .replace(new RegExp(`\\b(R\\d+|MON)\\s*(?:→|->)\\s*(${CODES})\\b`, 'g'), (_m, r: string, c: string) => `${r} now ${CODE_WORDS[c]}`)
  .replace(new RegExp(`\\bis (${CODES})\\b`, 'g'), (_m, c: string) => (c === 'NEEDS_REVIEW' ? 'needs review' : `is ${CODE_WORDS[c]}`))
  .replace(new RegExp(`\\b(${CODES})\\b`, 'g'), (m) => CODE_WORDS[m])
  .replace(/\bACTIVĂ(?=\s|$)/g, 'active')
  .replace(/\b0 h later\b/g, 'at the same time') // SR-01 summaries on the simulated clock
  .replace(/\s*\(quotes verified: True\)/g, ', every quote verified')
  .replace(/\s*\(quotes verified: False\)/g, ', some quotes could not be verified')
export const cleanTitle = (s: unknown) => tidy(String(s ?? '')
  .replace(/\s*&\s*/g, ' and ')
  .replace(/\s*≥\s*/g, ' of at least ')
  .replace(/\s*≤\s*/g, ' of at most '))
export const shortHash = (h: unknown) => (h ? `${String(h).slice(0, 4)}…` : '–')
/** Register-style names in summaries ("POP RADU", "MUNTEANU ANDREI") read as names ("Pop Radu").
 *  Only runs of two or more capitalised words change, so acronyms like UBO, AMLR, ONRC stay. Never use on document quotes. */
export const softCaps = (s: string) => s.replace(/\b[A-ZĂÂÎȘȚŞŢ]{2,}(?:\s+[A-ZĂÂÎȘȚŞŢ]{2,})+\b/g,
  (run) => run.split(/\s+/).map((w) => w[0] + w.slice(1).toLowerCase()).join(' '))

export function splitTitle(b: Bundle): { name: string; sub: string } {
  const t = String(b.case?.title || '')
  const parts = t.split(/\s+[—–]\s+/)
  if (parts.length >= 2) {
    let sub = parts[0].replace(/\s*&\s*/g, ' and ').trim()
    if (/\bKYB$/.test(sub)) sub += ' check'
    return { name: parts.slice(1).join(' '), sub }
  }
  return { name: t || 'Case', sub: String(b.case?.goal || '') }
}

/* ================= status ================= */
export type Kind = 'conflict' | 'review' | 'expired' | 'waiting' | 'verified'
export const STATUS: Record<Kind, { word: string; rank: number; icon: 'x' | 'help' | 'hourglass' | 'clock' | 'check' }> = {
  conflict: { word: 'Conflict', rank: 0, icon: 'x' },
  review: { word: 'Needs review', rank: 1, icon: 'help' },
  expired: { word: 'Expired', rank: 2, icon: 'hourglass' },
  waiting: { word: 'Waiting', rank: 3, icon: 'clock' },
  verified: { word: 'Verified', rank: 4, icon: 'check' },
}
export const STATUS_COLOR: Record<Kind, string> = {
  conflict: 'var(--conflict)', review: 'var(--review)', expired: 'var(--expired)', waiting: 'var(--muted)', verified: 'var(--ink)',
}
export const kindOf = (s: string): Kind => {
  switch (s) {
    case 'SATISFIED': return 'verified'
    case 'CONTRADICTED': return 'conflict'
    case 'NEEDS_REVIEW': return 'review'
    case 'EXPIRED': return 'expired'
    default: return 'waiting'
  }
}
export const isDecisionKind = (k: Kind) => k === 'conflict' || k === 'review'
export const isAttention = (k: Kind) => k === 'conflict' || k === 'review' || k === 'expired'

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
export const openExceptions = (b: Bundle): Exception_[] => arr(b.exceptions).filter((x) => x.status === 'OPEN')
  .sort((p, q) => (SEV_RANK[String(p.severity).toLowerCase()] ?? 9) - (SEV_RANK[String(q.severity).toLowerCase()] ?? 9)
    || String(p.id).localeCompare(String(q.id), undefined, { numeric: true }))
export const reqById = (b: Bundle, id: string | undefined) => arr(b.requirements).find((r) => r.id === id)
export const isOnHold = (b: Bundle) => b.case?.status === 'ON_HOLD'
/** READY_FOR_DECISION is trusted only while every check is verified (a certificate can expire afterwards). */
export const isComplete = (b: Bundle) => b.case?.status === 'READY_FOR_DECISION'
  && arr(b.requirements).length > 0 && arr(b.requirements).every((r) => r.status === 'SATISFIED')

/** What the file is for, in the bank's words, by template (the backend's `template.TEMPLATES[id]["decision"]`).
 *  An unknown or missing template reads as a loan file, the only kind older servers have. */
const TEMPLATE_WORDS: Record<string, { decision: string; pack: string }> = {
  sme_loan: { decision: 'credit decision', pack: 'application pack' },
  kyb_review: { decision: 'annual review sign-off', pack: 'review documents' },
}
export const templateWords = (b: Bundle) => TEMPLATE_WORDS[String(b.case?.template ?? '')] ?? TEMPLATE_WORDS.sme_loan

export type Tone = 'need' | 'done' | 'wait' | 'hold'
export function statusLine(b: Bundle): { tone: Tone; text: string } {
  const n = openExceptions(b).length
  // The hold outranks open decisions: nothing moves on the file until compliance releases it.
  if (isOnHold(b)) return { tone: 'hold', text: `On hold. The file was escalated to compliance.${n ? ` ${plural(n, 'decision')} still open.` : ''}` }
  if (n) return { tone: 'need', text: `${plural(n, 'decision')} need${n === 1 ? 's' : ''} you` }
  const words = templateWords(b)
  // "File complete." stays the exact prefix (the e2e test reads it); the rest follows the template.
  if (isComplete(b)) return { tone: 'done', text: `File complete. The ${words.decision} is yours.` }
  const reqs = arr(b.requirements)
  if (!arr(b.events).some((e) => e.type === 'DOCUMENT_RECEIVED')) return { tone: 'wait', text: `Waiting for the client to send the ${words.pack}` }
  const bad = reqs.filter((r) => isAttention(kindOf(r.status)))
  if (bad.length) {
    const r = bad[0]
    return { tone: 'wait', text: `${cleanTitle(r.title)}: ${STATUS[kindOf(r.status)].word.toLowerCase()}${bad.length > 1 ? `, and ${bad.length - 1} more` : ''}` }
  }
  const waits = [...new Set(reqs.filter((r) => r.status === 'OPEN_WAITING')
    .flatMap((r) => String(r.reason || '').replace(/^waiting for:?\s*/i, '').split(/[;,]\s*(?![^()]*\))/))
    .map((s) => tidy(s.replace(/^\s*waiting for:?\s*/i, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim())).filter((s) => s && !/discrepancy confirmed/i.test(s)))]
  if (waits.length) {
    let list = waits.slice(0, 3).join(', ')
    if (waits.length > 3) list += ` and ${waits.length - 3} more`
    return { tone: 'wait', text: `Waiting on the client for ${list}` }
  }
  if (!arr(b.events).some((e) => e.type === 'DOCUMENT_RECEIVED')) return { tone: 'wait', text: `Waiting for the ${words.pack}` }
  return { tone: 'wait', text: 'The agent is working the file' }
}

/* ================= the bank chat's suggested questions ================= */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)
/** "Ana Marin’s identity card", "the fiscal certificate", "the UBO declaration". */
function docPhrase(d: DocumentInfo): string {
  const name = String(d.name || DOC_TYPE_LABEL[String(d.type)] || d.id)
  const person = d.type === 'id_card' ? name.match(/^identity card\s*[—–-]\s*(.+)$/i) : null
  return person ? `${person[1].trim()}’s identity card` : `the ${lowerFirst(name)}`
}
/** Three questions from this case, never another case's data: what the file still needs; its first open decision
 *  (else the latest ruled one, else the first check still open); its newest document; "what happened" fills a gap. */
export function chatSuggestions(b: Bundle): string[] {
  const quoted = (t: unknown) => `“${cleanTitle(t).replace(/[?.!]+$/, '')}”`
  const out = ['What does this file still need?']
  const open = openExceptions(b)[0]
  const ruled = arr(b.exceptions).filter((x) => x.status !== 'OPEN' && x.resolution?.action_id !== 'superseded')
    .sort((p, q) => (ms(q.resolution?.at) ?? 0) - (ms(p.resolution?.at) ?? 0))[0]
  const pending = arr(b.requirements).find((r) => r.status !== 'SATISFIED')
  if (open) out.push(`What should I know before deciding ${quoted(open.title)}?`)
  else if (ruled) out.push(`When did we learn about ${quoted(ruled.title)}, and what did we do?`)
  else if (pending) out.push(`Why is ${quoted(pending.title)} not verified yet?`)
  const doc = [...arr(b.documents)].sort((p, q) => (ms(q.received_at) ?? 0) - (ms(p.received_at) ?? 0)
    || (Number(String(q.id).replace(/\D+/g, '')) || 0) - (Number(String(p.id).replace(/\D+/g, '')) || 0))[0]
  if (doc) out.push(`What does ${docPhrase(doc)} say?`)
  // a finished file has no decision or open check to ask about: always three questions
  if (out.length < 3) out.push('What has happened on this file so far?')
  return out
}

/* ================= header numbers ================= */
export function headerStats(b: Bundle) {
  const reqs = arr(b.requirements)
  const clock = caseClock(b)
  const legal = arr(b.timers).filter((t) => t.kind === 'legal_deadline' && t.status === 'PENDING')
    .map((t) => ms(t.due)).filter((t): t is number => t !== null).sort((x, y) => x - y)[0]
  return {
    verified: reqs.filter((r) => r.status === 'SATISFIED').length,
    total: reqs.length,
    day: Number.isFinite(Number(b.case?.day)) ? Number(b.case.day) : Math.max(0, Math.floor((clock.now - clock.opened) / DAY)),
    amlrDays: legal !== undefined ? Math.max(0, Math.ceil((legal - clock.now) / DAY)) : null,
  }
}

/* ================= checklist ================= */
export interface CheckItem {
  id: string
  title: string
  kind: Kind
  reason: string
  attention: boolean
  next: { type: 'decision'; text: string; exId: string } | { type: 'waiting'; text: string; days: number } | null
  req: Requirement
}
export function checklist(b: Bundle): CheckItem[] {
  const clock = caseClock(b)
  const open = openExceptions(b)
  const today = clock.dayNo(clock.now)
  return arr(b.requirements).map((r) => {
    const kind = kindOf(r.status)
    const ex = open.find((x) => x.requirement_id === r.id)
    const since = ms(r.updated_at) ?? clock.opened
    const days = Math.max(0, today - clock.dayNo(since))
    let next: CheckItem['next'] = null
    if (ex) next = { type: 'decision', text: cleanTitle(ex.title), exId: ex.id }
    else if (kind === 'expired') {
      const asked = arr(b.events).some((e) => e.type === 'DOCUMENT_REQUESTED' && (ms(e.sim_time) ?? 0) >= since)
      next = { type: 'waiting', text: asked ? 'A fresh document was requested' : 'A fresh document is needed', days }
    } else if (kind !== 'verified') next = { type: 'waiting', text: days ? `Waiting ${plural(days, 'day')}` : 'Waiting since today', days }
    return { id: r.id, title: cleanTitle(r.title), kind, reason: softCaps(tidy(plain(r.reason || STATUS[kind].word))), attention: isAttention(kind), next, req: r }
  })
}
/** The checklist's empty line must not read as all-clear while the file is held or a monitoring card is open. */
export function checklistNote(b: Bundle): { text: string; hold: boolean } | null {
  if (isOnHold(b)) return { text: 'with compliance. No check needs attention until the hold is released.', hold: true }
  const ids = new Set(arr(b.requirements).map((r) => r.id))
  const n = openExceptions(b).filter((x) => !ids.has(String(x.requirement_id))).length
  if (!n) return null
  return { text: `No check needs attention. ${n === 1 ? 'A monitoring alert needs' : `${n} monitoring alerts need`} your decision.`, hold: false }
}
export const byAttention = (a: CheckItem, b: CheckItem) => STATUS[a.kind].rank - STATUS[b.kind].rank
  || a.id.localeCompare(b.id, undefined, { numeric: true })

/* ================= timeline ================= */
export type Lane = 'client' | 'agent' | 'analyst' | 'deadline'
export type MarkKind = 'doc' | 'email' | 'agent' | 'step' | 'blocked' | 'decision' | 'staff' | 'deadline'
export interface TLItem {
  key: string
  t: number // display time (bursts with one identical sim_time are spread by seq, ending at the true time)
  real: number
  lane: Lane
  kind: MarkKind
  title: string
  detail?: string
  seq?: number
}
const SPREAD = 20 * 1000

/** Events in one burst share an identical sim_time; spread them so zooming can separate them. */
export function displayTimes(b: Bundle): Map<number, number> {
  const out = new Map<number, number>()
  const groups = new Map<string, LedgerEvent[]>()
  arr(b.events).forEach((e) => {
    const k = String(e.sim_time)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  })
  groups.forEach((list) => {
    const sorted = [...list].sort((x, y) => x.seq - y.seq)
    const last = sorted[sorted.length - 1].seq
    sorted.forEach((e) => {
      const t = ms(e.sim_time)
      if (t !== null) out.set(e.seq, t - (last - e.seq) * SPREAD)
    })
  })
  return out
}

const actorType = (e: { actor?: { type?: unknown } }) => String(e.actor?.type ?? '').toLowerCase()
const HUMAN_STAFF = new Set(['analyst', 'employee', 'staff', 'reviewer', 'compliance'])
// Chat, client emails and bank-internal staff events stay in the ledger tab, never on the rail
// (an employee's insider actions are not analyst work on the file).
const RAIL_HIDE = new Set(['CHAT_TURN', 'EMAIL_SENT', 'EMAIL_FAILED', 'CHECK_PROMOTED', 'STAFF_CONTACT_CHANGE', 'CREDIT_ACTION', 'CLIENT_CONFIRMATION',
  'CLIENT_DISPUTE', 'CLIENT_CONSENT'])
const SKIP_AGENT_LANE = new Set(['AGENT_STEP', 'SCENARIO_DELIVERED', 'CLOCK_ADVANCED', 'TIMER_SET', 'TIMER_FIRED', 'TIMER_CANCELLED', 'CHAT_TURN'])
// Routine bookkeeping stays off the agent lane (it is in the ledger tab); the lane shows what the agent did that matters.
const ROUTINE_AGENT = new Set(['FIELDS_EXTRACTED', 'REGISTRY_CHECKED', 'REQUIREMENT_UPDATED'])

export function gateRule(gate: unknown): string | null {
  const g = String(gate ?? '')
  return g.startsWith('DENY') ? g.replace(/^DENY:?\s*/, '') || 'rule' : null
}
export function parseMaybe(v: unknown): unknown {
  if (typeof v !== 'string') return v
  const t = v.trim()
  if (!/^[[{]/.test(t)) return v
  try { return JSON.parse(t) } catch { return v }
}
export function blockedWhy(s: TraceStep): string {
  const out = parseMaybe(s.output)
  if (out && typeof out === 'object') {
    const o = out as Record<string, unknown>
    const w = o.blocked ?? o.reason ?? o.error
    if (w) return String(w)
  }
  return typeof s.output === 'string' ? s.output : String(s.gate ?? '')
}

export function exceptionFromSummary(b: Bundle, summary: unknown): Exception_ | undefined {
  const id = (String(summary ?? '').match(/EX-\d+/) || [])[0]
  return id ? arr(b.exceptions).find((x) => x.id === id) : undefined
}
export function actionLabel(x: Exception_ | undefined, actionId: string | undefined): string {
  const a = x ? arr(x.actions).find((y) => y.id === actionId) : undefined
  return tidy(a?.label || sentence(humanize(actionId || 'resolved')))
}

/** One line per ledger event, in plain language. */
export function eventText(b: Bundle, e: LedgerEvent): string {
  const s = String(e.summary || humanize(e.type))
  if (e.type === 'AGENT_STEP') {
    const [tool, gate = '-'] = s.split(/\s*(?:→|->)\s*/)
    const rule = gateRule(gate)
    return `Agent step: ${humanize(tool)}${gate === 'ALLOW' ? ', allowed' : rule ? `, blocked by ${rule}` : ''}`
  }
  if (e.type === 'EXCEPTION_RESOLVED') {
    const x = exceptionFromSummary(b, s)
    const m = s.match(/(EX-\d+):\s*([a-z_]+)$/)
    if (m) {
      const who = HUMAN_STAFF.has(actorType(e)) ? 'Ruled' : 'Closed'
      return m[2] === 'superseded' ? `${m[1]} closed: superseded by newer documents` : `${who} on ${m[1]}: ${actionLabel(x, m[2]).toLowerCase()}`
    }
  }
  if (e.type === 'CHAT_TURN') return `Chat question answered (${actorType(e) === 'client' ? 'client view' : 'bank employee'})`
  return tidy(plain(s))
}

export function whoLabel(e: { actor?: { type?: unknown; id?: unknown } }): string {
  const t = actorType(e)
  if (t === 'client') return 'Client'
  if (t === 'agent') return 'Agent'
  if (t === 'analyst') return 'Analyst'
  if (t === 'employee' || t === 'staff') return `Bank employee${e.actor?.id ? ` ${String(e.actor.id)}` : ''}`
  if (t === 'compliance') return `Compliance${e.actor?.id ? ` (${String(e.actor.id)})` : ''}`
  if (t === 'system') return e.actor?.id === 'notifier' ? 'Email notifier' : 'Rules engine'
  return sentence(t || 'System')
}

/** trace[].by: which part of the agent took the step (Reasoning tab tag). */
const BY_LABEL: Record<string, { tag: string; title: string }> = {
  pipeline: { tag: 'code', title: 'Code that runs on every event' },
  claude: { tag: 'Claude', title: 'Planned by Claude on Amazon Bedrock' },
  planner: { tag: 'planner', title: 'Planned by the scripted planner' },
  'safety-net': { tag: 'safety net', title: 'Code safety net that runs after Claude' },
}
export function byTag(by: unknown): { tag: string; title: string } | null {
  if (by === null || by === undefined || by === '') return null
  const k = String(by)
  return BY_LABEL[k] ?? { tag: humanize(k), title: `Step by ${humanize(k)}` }
}

export function timelineItems(b: Bundle, opts: { steps: boolean }): TLItem[] {
  const disp = displayTimes(b)
  const out: TLItem[] = []
  const blockedSeqs = new Set(arr(b.trace).filter((s) => gateRule(s.gate)).map((s) => s.seq))
  arr(b.events).forEach((e) => {
    const real = ms(e.sim_time)
    if (real === null || RAIL_HIDE.has(e.type)) return
    const t = disp.get(e.seq) ?? real
    const who = actorType(e)
    const base = { key: `e${e.seq}`, t, real, seq: e.seq }
    if (e.type === 'AGENT_STEP') {
      if (blockedSeqs.has(e.seq)) return // drawn from the trace below, with the reason
      if (opts.steps) out.push({ ...base, lane: 'agent', kind: 'step', title: eventText(b, e), detail: 'Tool call by the agent' })
      return
    }
    if (who === 'client') {
      const email = /^email/i.test(String(e.summary || ''))
      out.push({ ...base, lane: 'client', kind: email ? 'email' : 'doc', title: eventText(b, e) })
      return
    }
    if (HUMAN_STAFF.has(who)) {
      const x = e.type === 'EXCEPTION_RESOLVED' ? exceptionFromSummary(b, e.summary) : undefined
      out.push({ ...base, lane: 'analyst', kind: e.type === 'EXCEPTION_RESOLVED' ? 'decision' : 'staff', title: eventText(b, e),
        detail: x ? cleanTitle(x.title) : whoLabel(e) })
      return
    }
    if (SKIP_AGENT_LANE.has(e.type)) return
    if (ROUTINE_AGENT.has(e.type) && !opts.steps) return
    out.push({ ...base, lane: 'agent', kind: 'agent', title: eventText(b, e), detail: who === 'system' ? 'Rules engine' : undefined })
  })
  arr(b.trace).forEach((s) => {
    const rule = gateRule(s.gate)
    if (!rule) return
    const real = ms(s.sim_time)
    if (real === null) return
    out.push({ key: `b${s.seq}`, t: disp.get(s.seq) ?? real, real, seq: s.seq, lane: 'agent', kind: 'blocked',
      title: `Blocked by ${rule}: ${humanize(s.tool)}`, detail: blockedWhy(s) })
  })
  return out.sort((x, y) => x.t - y.t || (x.seq ?? 0) - (y.seq ?? 0))
}

export interface Deadline {
  key: string
  label: string
  cls: 'legal' | 'expiry' | 'reminder' | 'other'
  state: 'pending' | 'fired' | 'cancelled'
  set: number
  due: number
  end: number
  count: number
  labels: string[]
}
const stripParens = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
function reminderSubject(label: string) {
  const m = label.match(/^Reminder if (.*) not received$/i) || label.match(/^Next reminder:\s*(.*)$/i)
  return stripParens(tidy(m ? m[1] : label))
}
export function deadlineLabel(t: Timer): string {
  const l = String(t.label || '')
  if (t.kind === 'legal_deadline') return /amlr/i.test(l) ? 'AMLR report due' : tidy(l)
  if (t.kind === 'doc_expiry') return sentence(stripParens(tidy(l)))
  if (t.kind === 'reminder') return `Reminder: ${reminderSubject(l)}`
  return sentence(stripParens(tidy(l || humanize(t.kind))))
}

/** Timers with their set and end times. The k-th TIMER_SET event created T-k (ids are sequential). */
export function deadlines(b: Bundle): Deadline[] {
  const evs = arr(b.events)
  const sets = evs.filter((e) => e.type === 'TIMER_SET')
  const cancels = evs.filter((e) => e.type === 'TIMER_CANCELLED')
  const used = new Set<number>()
  const clock = caseClock(b)
  const rows = arr(b.timers).map((t, i) => {
    const k = Number((String(t.id).match(/(\d+)$/) || [])[1]) || i + 1
    const setEv = sets[k - 1]
    const due = ms(t.due) ?? clock.now
    const set = setEv ? ms(setEv.sim_time) ?? clock.opened : clock.opened
    const state: Deadline['state'] = t.status === 'FIRED' ? 'fired' : t.status === 'CANCELLED' ? 'cancelled' : 'pending'
    let end = due
    if (state === 'cancelled') {
      const c = cancels.find((e) => !used.has(e.seq) && e.seq > (setEv?.seq ?? 0) && String(e.summary || '').endsWith(`: ${t.label}`))
      if (c) { used.add(c.seq); end = ms(c.sim_time) ?? due }
    }
    const cls: Deadline['cls'] = t.kind === 'legal_deadline' ? 'legal' : t.kind === 'doc_expiry' ? 'expiry' : t.kind === 'reminder' ? 'reminder' : 'other'
    return { t, set, due, end, state, cls }
  })
  // Reminders due together collapse into one flag ("3 reminders").
  const groups = new Map<string, typeof rows>()
  rows.forEach((r) => {
    const g = r.cls === 'reminder' ? `rem|${r.due}|${r.state}` : `one|${r.t.id}`
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(r)
  })
  return [...groups.entries()].map(([key, list]) => {
    const r0 = list[0]
    return {
      key, cls: r0.cls, state: r0.state, due: r0.due,
      set: Math.min(...list.map((r) => r.set)),
      end: Math.max(...list.map((r) => r.end)),
      count: list.length,
      label: list.length > 1 ? `${list.length} reminders` : deadlineLabel(r0.t),
      labels: list.map((r) => deadlineLabel(r.t)),
    }
  }).sort((x, y) => x.due - y.due)
}

/* ================= activity feed ================= */
export interface FeedItem { key: string; t: number; real: number; text: string; who: string; blocked: boolean; seq: number }
const FEED_SKIP = new Set(['AGENT_STEP', 'SCENARIO_DELIVERED', 'CLOCK_ADVANCED', 'CHAT_TURN', 'TIMER_SET'])
export function feedItems(b: Bundle): FeedItem[] {
  const disp = displayTimes(b)
  const out: FeedItem[] = []
  arr(b.events).forEach((e) => {
    const real = ms(e.sim_time)
    if (real === null || FEED_SKIP.has(e.type)) return
    out.push({ key: `e${e.seq}`, t: disp.get(e.seq) ?? real, real, text: eventText(b, e), who: whoLabel(e), blocked: false, seq: e.seq })
  })
  arr(b.trace).forEach((s) => {
    const rule = gateRule(s.gate)
    const real = ms(s.sim_time)
    if (!rule || real === null) return
    out.push({ key: `b${s.seq}`, t: disp.get(s.seq) ?? real, real, seq: s.seq, blocked: true,
      text: `${sentence(humanize(s.tool))} was blocked (${rule})`, who: 'Agent, blocked by the gate' })
  })
  return out.sort((x, y) => y.seq - x.seq)
}
export function latestActivity(b: Bundle): FeedItem | null {
  return feedItems(b)[0] ?? null
}

/* ================= documents ================= */
export function docQuotes(b: Bundle, docId: string): { doc: DocumentInfo | undefined; quotes: Evidence[] } {
  const doc = arr(b.documents).find((d) => d.id === docId)
  const seen = new Set<string>()
  const quotes: Evidence[] = []
  const add = (q: Evidence) => {
    if (q.doc_id !== docId || !q.quote) return
    const k = `${q.field ?? ''}|${q.quote}`
    if (seen.has(k)) return
    seen.add(k)
    quotes.push(q)
  }
  arr(b.requirements).forEach((r) => arr(r.evidence).forEach(add))
  arr(b.exceptions).forEach((x) => arr(x.snippets).forEach((s) => add(s as Evidence)))
  return { doc, quotes }
}
export const docName = (b: Bundle, id: string | null | undefined) => arr(b.documents).find((d) => d.id === id)?.name || id || 'Document'

/* ================= decisions ================= */
export const JUDGE_LABELS: Record<string, string> = {
  same_address: 'Same place', different_address: 'Different place', same_person: 'Same person', different_person: 'Different person',
}
export const noteText = (n: unknown) => (typeof n === 'string' ? n
  : n && typeof n === 'object' ? String((n as Record<string, unknown>).text ?? (n as Record<string, unknown>).note ?? '') : '')

/** For `sequence_insider` cards: the two linked ledger events, first then second (`first_seq`, `then_seq`). */
export function linkedEvents(b: Bundle, x: Exception_): { seq: number | null; text: string; when: number | null }[] {
  const order = [x.first_seq, x.then_seq].filter((n): n is number => typeof n === 'number')
  const rank = (seq: number | null) => (seq === null ? 1e9 : order.includes(seq) ? order.indexOf(seq) - 1e6 : seq)
  return arr(x.snippets).map((s) => {
    const raw = String(s.summary ?? s.quote ?? s.text ?? '')
    const seqFromText = Number((String(s.label ?? '') + ' ' + raw).match(/#(\d+)/)?.[1])
    const seq = typeof s.seq === 'number' ? s.seq : Number.isFinite(seqFromText) && seqFromText > 0 ? seqFromText : null
    const ev = seq !== null ? arr(b.events).find((e) => e.seq === seq) : undefined
    const text = tidy(plain(raw.replace(/^#\d+\s*[:,-]?\s*/, ''))) || (ev ? eventText(b, ev) : String(s.label ?? ''))
    return { seq, text, when: ms(String(s.sim_time ?? ev?.sim_time ?? '')) }
  }).sort((p, q) => rank(p.seq) - rank(q.seq))
}

/** The time between two linked events, in words ("at the same time", "3 hours later"). */
export function gapText(from: number | null, to: number | null): string | null {
  if (from === null || to === null) return null
  const d = Math.max(0, to - from)
  if (d < MIN) return 'at the same time'
  if (d < HOUR) return `${plural(Math.round(d / MIN), 'minute')} later`
  if (d < 2 * DAY) return `${plural(Math.round(d / HOUR), 'hour')} later`
  return `${plural(Math.round(d / DAY), 'day')} later`
}
export const confirmedBetween = (b: Bundle, from: number | null, to: number | null) =>
  from !== null && to !== null && arr(b.events).some((e) => e.type === 'CLIENT_CONFIRMATION' && e.seq > from && e.seq < to)

/** While ON_HOLD: the card that was escalated to compliance and the ledger event that started the hold. */
export function holdInfo(b: Bundle): { x: Exception_ | undefined; since: number | null; seq: number | null } {
  const x = arr(b.exceptions).filter((e) => e.resolution?.action_id === 'escalate_compliance')
    .sort((p, q) => (ms(q.resolution?.at) ?? 0) - (ms(p.resolution?.at) ?? 0))[0]
  const ev = [...arr(b.events)].sort((p, q) => q.seq - p.seq)
    .find((e) => e.type === 'CASE_STATUS' && /\bon hold\b/i.test(String(e.summary || '')))
  return { x, since: ms(ev?.sim_time) ?? ms(x?.resolution?.at), seq: ev?.seq ?? null }
}

const TOASTS: Record<string, string> = {
  confirm_discrepancy: 'Discrepancy confirmed. The client was asked for a corrected declaration.',
  dismiss: 'Discrepancy dismissed. The documents are treated as matching.',
  same_address: 'Address accepted as the same place. The ruling is stored as a precedent.',
  different_address: 'Address marked as different. The client was asked to clarify.',
  same_person: 'Signatory confirmed as the administrator.',
  different_person: 'Signatory marked as a different person. A mandate was requested.',
  escalate_compliance: 'File put on hold and escalated to compliance.',
  legitimate: 'Marked as legitimate. The file continues.',
  acknowledge: 'Contact change acknowledged as legitimate. The file continues.', // client_dispute
}
export const resolveToast = (x: Exception_, actionId: string) => TOASTS[actionId] || `Decision recorded: ${actionLabel(x, actionId).toLowerCase()}.`

/* ================= decision evidence as document slips ================= */
/** 'key': a line of single-document evidence that carries the value the rule read (no comparison behind it). */
export type LineKind = 'same' | 'diff' | 'missing' | 'gap' | 'key'
export interface SlipLine { t: string; k: LineKind; marks: string[]; note?: string }
export interface Slip { src: string; doc: string | null; lines: SlipLine[] }
type Snip = { label: string; doc: string | null; quote: string; field: string }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const personKey = (s: string) => fold(s).split(/[\s-]+/).filter(Boolean).sort().join(' ')
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, a: string, c: string) => a + c.toUpperCase())
const OWNER_RE = /^(.*?):\s*(.+?)\s*[—–-]\s*(\d+(?:[.,]\d+)?)\s*%\s*$/

function ownerLines(quote: string) {
  return quote.split(/\r?\n/).filter((l) => l.trim()).map((t) => {
    const m = t.match(OWNER_RE)
    return { t, name: m ? m[2].trim() : null, pct: m ? Number(m[3].replace(',', '.')) : null }
  })
}

/** Ownership: register lines vs declaration lines, matched by person (MUNTEANU ANDREI = Andrei Munteanu). */
function ownershipSlips(snips: Snip[]) {
  const regIdx = snips.findIndex((s) => /regist|onrc|certificat/i.test(s.label))
  const decIdx = snips.findIndex((s, i) => i !== regIdx && /ubo|declar|beneficiar/i.test(s.label))
  if (regIdx < 0 || decIdx < 0) return null
  const reg = ownerLines(snips[regIdx].quote)
  const dec = ownerLines(snips[decIdx].quote)
  if (!reg.some((l) => l.name) || !dec.some((l) => l.name)) return null
  const decBy = new Map(dec.filter((l) => l.name).map((l) => [personKey(l.name!), l]))
  const regBy = new Map(reg.filter((l) => l.name).map((l) => [personKey(l.name!), l]))
  const matches: string[] = []
  const regLines: SlipLine[] = reg.map((l) => {
    if (!l.name || l.pct === null) return { t: l.t, k: 'same', marks: [] }
    const d = decBy.get(personKey(l.name))
    const tail = l.t.slice(l.t.indexOf(l.name))
    if (!d) return { t: l.t, k: 'missing', marks: [tail], note: 'not in the declaration' }
    if (d.pct !== l.pct) return { t: l.t, k: 'diff', marks: [`${l.pct}%`], note: `declared as ${d.pct}%` }
    matches.push(`${d.name}, ${l.pct}% in both`)
    return { t: l.t, k: 'same', marks: [] }
  })
  const decLines: SlipLine[] = dec.map((l) => {
    if (!l.name || l.pct === null) return { t: l.t, k: 'same', marks: [] }
    const r = regBy.get(personKey(l.name))
    if (!r) return { t: l.t, k: 'diff', marks: [l.t.slice(l.t.indexOf(l.name))], note: 'not in the register' }
    if (r.pct !== l.pct) return { t: l.t, k: 'diff', marks: [`${l.pct}%`], note: `register shows ${r.pct}%` }
    return { t: l.t, k: 'same', marks: [] }
  })
  reg.filter((l) => l.name && !decBy.has(personKey(l.name))).forEach((l) => {
    decLines.push({ t: `No entry for ${titleCase(l.name!)}`, k: 'gap', marks: [] })
  })
  const out: Slip[] = snips.map((s, i) => ({ src: s.label, doc: s.doc,
    lines: i === regIdx ? regLines : i === decIdx ? decLines : s.quote.split(/\r?\n/).filter(Boolean).map((t) => ({ t, k: 'same' as const, marks: [] })) }))
  return { slips: out, matches }
}

const EQUIV: Record<string, string> = {
  jud: 'judet', judet: 'judet', judetul: 'judet', str: 'strada', strada: 'strada', nr: 'numar', numar: 'numar', numarul: 'numar',
  bd: 'bulevard', bdul: 'bulevard', bulevardul: 'bulevard', sect: 'sector', sector: 'sector', mun: 'municipiul', municipiul: 'municipiul',
}
const tokNorm = (w: string) => { const f = fold(w).replace(/[.,;:]+$/g, ''); return EQUIV[f] ?? f }
const valuePart = (line: string) => { const i = line.indexOf(':'); return i >= 0 && i < 30 ? line.slice(i + 1).trim() : line.trim() }

/** Two one-line values (an address, a name): mark the words that appear in only one of them. */
function tokenSlips(snips: Snip[], summary: string) {
  // two quotes from one document are not a comparison
  if (snips.length !== 2 || (snips[0].doc !== null && snips[0].doc === snips[1].doc)) return null
  const vals = snips.map((s) => valuePart(s.quote.split(/\r?\n/)[0] || ''))
  const toks = vals.map((v) => v.split(/[\s,]+/).filter(Boolean))
  const sets = toks.map((ts) => new Set(ts.map(tokNorm)))
  const phrases = (i: number) => {
    const other = sets[1 - i]
    const out: string[] = []
    let cur: string[] = []
    toks[i].forEach((w) => {
      if (!other.has(tokNorm(w))) cur.push(w)
      else if (cur.length) { out.push(cur.join(' ')); cur = [] }
    })
    if (cur.length) out.push(cur.join(' '))
    return out.map((p) => p.replace(/,$/, ''))
  }
  const slips: Slip[] = snips.map((s, i) => {
    const marks = phrases(i)
    const line = s.quote.split(/\r?\n/)[0] || s.quote
    return { src: s.label, doc: s.doc, lines: [marks.length
      ? { t: line, k: 'diff' as const, marks, note: `only in this document: ${marks.map((m) => `"${m}"`).join(', ')}` }
      : { t: line, k: 'same' as const, marks: [] }] }
  })
  const matches: string[] = []
  if (/postal codes? match/i.test(summary)) matches.push('Postal code matches in both')
  const shared = toks[0].filter((w) => sets[1].has(tokNorm(w)) && !EQUIV[fold(w).replace(/[.,]+$/, '')])
    .map((w) => w.replace(/[.,]+$/, ''))
  const nums = shared.filter((w) => /^\d+[a-z]?$/i.test(w))
  const words = shared.filter((w) => !/^\d/.test(w) && w.length > 2)
  if (nums.length) matches.push(`Number ${nums.join(', ')} in both`)
  if (words.length) matches.push(`${[...new Set(words)].join(', ')} in both`)
  return { slips, matches }
}

/** Fields that only date a document: shown as context, never marked as the evidence. */
const CONTEXT_FIELD = /^(issued|issued_at|issue_date|date|valid_until|expires?|expiry)$/i

/** No comparison to draw (a tax debt, a suspended company, a coverage ratio): one panel per document, in the order the
 *  snippets name them, with every quoted line. The value each line holds is marked; date lines stay plain context. */
function evidenceByDoc(snips: Snip[]): Slip[] {
  const out: Slip[] = []
  const byDoc = new Map<string, Slip>()
  snips.forEach((s) => {
    const key = s.doc ?? `label:${s.label}`
    let slip = byDoc.get(key)
    if (!slip) { slip = { src: s.label, doc: s.doc, lines: [] }; byDoc.set(key, slip); out.push(slip) }
    const context = CONTEXT_FIELD.test(s.field)
    s.quote.split(/\r?\n/).filter((t) => t.trim()).forEach((t) => {
      const v = valuePart(t)
      slip.lines.push(context ? { t, k: 'same', marks: [] } : { t, k: 'key', marks: v && v !== t.trim() ? [v] : [] })
    })
  })
  return out
}

/** `compare` is true only for a real two-document comparison (ownership, an address, a name); anything else is evidence. */
export function decisionEvidence(x: Exception_): { slips: Slip[]; matches: string[]; compare: boolean } {
  const snips: Snip[] = arr(x.snippets).filter((s) => s.quote).map((s) => ({
    label: String(s.label || s.doc_id || 'Document'), doc: s.doc_id ? String(s.doc_id) : null, quote: String(s.quote), field: String(s.field || ''),
  }))
  const summary = String(x.summary || '')
  try {
    const own = x.kind === 'ubo_discrepancy' || x.requirement_id === 'R2' ? ownershipSlips(snips) : null
    if (own) return { ...own, compare: true }
    const tok = x.kind === 'address_uncertain' || x.kind === 'signatory_uncertain' || x.judge ? tokenSlips(snips, summary) : null
    if (tok) return { ...tok, compare: true }
  } catch { /* fall back to plain evidence */ }
  return { slips: evidenceByDoc(snips), matches: [], compare: false }
}

/** Time of the n-th agent note on an exception (from EXCEPTION_ANNOTATED events). */
export function noteTimes(b: Bundle, exId: string): number[] {
  return arr(b.events).filter((e) => e.type === 'EXCEPTION_ANNOTATED' && String(e.summary || '').endsWith(exId))
    .map((e) => ms(e.sim_time)).filter((t): t is number => t !== null)
}
export const raisedSeq = (b: Bundle, exId: string) =>
  arr(b.events).find((e) => e.type === 'EXCEPTION_RAISED' && String(e.summary || '').startsWith(`${exId} `))?.seq ?? null

/* ================= on file vs new ================= */
const SOURCE_TYPE: Record<string, string> = {
  onrc_certificate: 'Official register (ONRC)',
  fiscal_certificate: 'Tax authority (ANAF)',
  ubo_declaration: 'Signed by the client',
  application: 'Filled in by the client',
  financial_statement: 'Filed by the client',
  id_card: 'Identity document',
  email: 'Client email',
}
export interface CompareSlip extends Slip { role: 'new' | 'onfile' | null; meta: string }
const docNum = (id: string | null) => Number((String(id ?? '').match(/(\d+)$/) || [])[1]) || 0

/** Two slips: the document already on file goes left, the one that triggered the check (received last) goes right. */
export function compareSlips(b: Bundle, slips: Slip[]): CompareSlip[] {
  const clock = caseClock(b)
  const info = slips.map((s) => {
    const d = arr(b.documents).find((x) => x.id === s.doc)
    return { s, d, rec: ms(d?.received_at) ?? -Infinity, n: docNum(s.doc) }
  })
  const meta = (d: DocumentInfo | undefined, role: CompareSlip['role']) => {
    if (!d) return ''
    const src = SOURCE_TYPE[String(d.type)] || 'Document'
    const rec = ms(d.received_at)
    const iss = ms(d.issued_at)
    if (role === 'new' && rec !== null) return `${src}, received day ${clock.dayNo(rec)} at ${fTime(rec)}`
    if (iss !== null && iss < clock.opened) return `${src}, on file since ${fDate(iss)} ${new Date(iss).getUTCFullYear()}`
    return rec !== null ? `${src}, on file since day ${clock.dayNo(rec)}` : src
  }
  if (info.length !== 2 || info.some((i) => !i.d) || info[0].s.doc === info[1].s.doc) return info.map((i) => ({ ...i.s, role: null, meta: meta(i.d, null) }))
  const sorted = [...info].sort((x, y) => x.rec - y.rec || x.n - y.n)
  return sorted.map((i, k) => {
    const role = k === 1 ? 'new' as const : 'onfile' as const
    return { ...i.s, role, meta: meta(i.d, role) }
  })
}

/** Evidence panels (no comparison): no on-file/new roles; the caption says where the document came from and when. */
export function evidenceSlips(b: Bundle, slips: Slip[]): CompareSlip[] {
  const clock = caseClock(b)
  return slips.map((s) => {
    const d = arr(b.documents).find((x) => x.id === s.doc)
    const rec = ms(d?.received_at)
    const src = d ? SOURCE_TYPE[String(d.type)] || 'Document' : ''
    const meta = !d ? '' : rec !== null ? `${src}, received day ${clock.dayNo(rec)} at ${fTime(rec)}` : src
    return { ...s, role: null, meta }
  })
}

/* ================= document viewer + Docs tab =================
   Server first (`/documents?role=employee`, `/documents/{id}?role=employee`); when a server has no such endpoint,
   the same view is built from the bundle (no full text there, only the quotes used as evidence). */
export const DOC_TYPE_LABEL: Record<string, string> = {
  application: 'Loan application', financial_statement: 'Financial statements', ubo_declaration: 'UBO declaration',
  id_card: 'Identity card', onrc_certificate: 'Trade register certificate (ONRC)', fiscal_certificate: 'Fiscal certificate (ANAF)',
  email: 'Client email', address_proof: 'Proof of registered office', signatory_mandate: 'Signatory mandate',
}
/** Bank policy for registry and fiscal certificates (backend template.DOC_VALIDITY_DAYS); bundle fallback only. */
const DOC_VALIDITY_DAYS = 30
const EXPIRING_DOCS = new Set(['onrc_certificate', 'fiscal_certificate'])

export type DocStatusKind = 'valid' | 'expired' | 'superseded' | 'quarantined' | 'unreadable'
/** Colour only for problems: expired, quarantined and unreadable carry a tone; superseded is muted; valid is plain ink. */
export const DOC_STATUS: Record<DocStatusKind, { word: string; cls: string }> = {
  valid: { word: 'Valid', cls: 'st-verified' },
  expired: { word: 'Expired', cls: 'st-expired' },
  superseded: { word: 'Superseded', cls: 'st-waiting' },
  quarantined: { word: 'Quarantined', cls: 'st-conflict' },
  unreadable: { word: 'Needs manual reading', cls: 'st-review' },
}
const docStatusKind = (s: unknown): DocStatusKind | null => (String(s) in DOC_STATUS ? String(s) as DocStatusKind : null)

export interface DocUseRow { id: string; title: string; kind: Kind | null; word: string }
export interface DocRow {
  id: string
  name: string
  label: string
  type: string
  person: string | null
  issuedDay: number | null
  receivedDay: number | null
  /** Exact times from the bundle, when the bundle knows the document. */
  receivedAt: number | null
  issuedAt: number | null
  status: string
  statusWord: string
  statusCls: string
  usedBy: DocUseRow[]
  extractor: string | null
  source: string | null
}
export interface DocViewField { field: string; value: string; quote: string; verified: boolean | null; start: number | null; end: number | null }
export interface DocHistoryRow { seq: number | null; day: number | null; what: string }
export interface DocView extends DocRow {
  text: string | null
  fields: DocViewField[]
  rejected: string[]
  injections: string[]
  quarantineReason: string | null
  validity: { issuedDay: number | null; expiresDay: number | null; expired: boolean } | null
  history: DocHistoryRow[]
  /** server: the documents endpoint; case: built from the bundle; missing: no such document in this case. */
  origin: 'server' | 'case' | 'missing'
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
/** A case day as a calendar time (midnight UTC of that day). */
export const dayTime = (b: Bundle, day: number) => caseClock(b).midnight0 + day * DAY
/** "day 9, 6 Nov"; days before the case opened read as a date with the year ("7 Oct 2026"). */
export function dayText(b: Bundle, day: number | null): string {
  if (day === null) return ''
  const t = dayTime(b, day)
  return day < 0 ? `${fDate(t)} ${new Date(t).getUTCFullYear()}` : `day ${day}, ${fDate(t)}`
}
export const docFieldName = (f: string) => sentence(humanize(f)).replace(/\b(cui|ubo|ebitda|cnp|dscr)\b/gi, (w) => w.toUpperCase())

/** Requirement status from the live bundle (the server's word only if the bundle does not know the check). */
function useRow(b: Bundle, u: DocUse | Requirement): DocUseRow {
  const r = reqById(b, u.id)
  const kind = r ? kindOf(r.status) : null
  const word = kind ? STATUS[kind].word : String((u as DocUse).status_word || '')
  return { id: u.id, title: cleanTitle(r?.title || u.title || u.id), kind, word }
}

/** One Docs tab row from the server list, with exact times from the bundle when it has them. */
export function docRowFromApi(b: Bundle, it: DocListItem): DocRow {
  const d = arr(b.documents).find((x) => x.id === it.id)
  const k = docStatusKind(it.status)
  return {
    id: it.id,
    name: String(it.name || d?.name || it.label || it.id),
    label: String(it.label || DOC_TYPE_LABEL[String(it.type)] || sentence(humanize(it.type || 'document'))),
    type: String(it.type || d?.type || ''),
    person: it.person ? String(it.person) : null,
    issuedDay: num(it.issued_day),
    receivedDay: num(it.received_day),
    receivedAt: ms(d?.received_at),
    issuedAt: ms(d?.issued_at),
    status: String(it.status || 'valid'),
    statusWord: k ? DOC_STATUS[k].word : sentence(it.status_word || humanize(it.status || '')),
    statusCls: k ? DOC_STATUS[k].cls : 'st-waiting',
    usedBy: arr(it.used_by).map((u) => useRow(b, u)),
    extractor: it.extractor ? String(it.extractor) : null,
    source: it.source ? String(it.source) : null,
  }
}

/** Bundle-only status: a newer document of the same kind supersedes; certificates expire after the policy window. */
function bundleStatus(b: Bundle, d: DocumentInfo): DocStatusKind {
  const key = (x: DocumentInfo) => (x.type === 'id_card' ? `id|${x.name}` : String(x.type))
  const after = (x: DocumentInfo) => {
    const r = ms(x.received_at) ?? 0
    const r0 = ms(d.received_at) ?? 0
    return r > r0 || (r === r0 && docNum(x.id) > docNum(d.id))
  }
  if (d.type !== 'email' && arr(b.documents).some((x) => x.id !== d.id && key(x) === key(d) && after(x))) return 'superseded'
  const iss = ms(d.issued_at)
  if (EXPIRING_DOCS.has(String(d.type)) && iss !== null && caseClock(b).now >= iss + DOC_VALIDITY_DAYS * DAY) return 'expired'
  return 'valid'
}

/** The extract_fields step for a document: extractor, values and rejected quotes (from the trace output). */
function extraction(b: Bundle, id: string): Record<string, unknown> | null {
  const step = [...arr(b.trace)].reverse().find((s) => {
    const inp = parseMaybe(s.input)
    return s.tool === 'extract_fields' && !!inp && typeof inp === 'object' && (inp as Record<string, unknown>).doc_id === id
  })
  const out = step ? parseMaybe(step.output) : null
  return out && typeof out === 'object' ? out as Record<string, unknown> : null
}

export function docRowFromBundle(b: Bundle, d: DocumentInfo): DocRow {
  const clock = caseClock(b)
  const k = bundleStatus(b, d)
  const rec = ms(d.received_at)
  const iss = ms(d.issued_at)
  const ex = extraction(b, d.id)
  return {
    id: d.id, name: String(d.name || d.id), label: DOC_TYPE_LABEL[String(d.type)] || sentence(humanize(d.type || 'document')),
    type: String(d.type || ''), person: null,
    issuedDay: iss !== null ? clock.dayNo(iss) : null, receivedDay: rec !== null ? clock.dayNo(rec) : null,
    receivedAt: rec, issuedAt: iss,
    status: k, statusWord: DOC_STATUS[k].word, statusCls: DOC_STATUS[k].cls,
    usedBy: arr(b.requirements).filter((r) => arr(r.evidence).some((e) => e.doc_id === d.id)).map((r) => useRow(b, r)),
    extractor: ex?.extractor ? String(ex.extractor) : null,
    source: null,
  }
}

/** Docs tab rows, newest first: the server list when there is one, else the bundle's documents. */
export function docRows(b: Bundle, list: DocListItem[] | null): DocRow[] {
  const rows = list ? list.map((it) => docRowFromApi(b, it)) : arr(b.documents).map((d) => docRowFromBundle(b, d))
  return rows.sort((x, y) => docNum(y.id) - docNum(x.id))
}

const ARROW_STATUS: Record<string, string> = { conflict: 'in conflict' }
/** History lines in plain words: "Used as evidence: R1 → Verified" reads "Used as evidence: R1 now verified". */
export function historyText(what: unknown, name?: string): string {
  let s = String(what ?? '')
  s = s.replace(/\b(R\d+|MON)\s*(?:→|->)\s*([A-Za-z][A-Za-z ]*)$/, (_m, r: string, w: string) => {
    const word = w.trim().toLowerCase()
    return `${r} now ${ARROW_STATUS[word] ?? word}`
  })
  if (name) s = s.replace(` from ${name} via `, ' via ')
  s = s.replace(/^Received \(scenario\)$/, 'Received from the client').replace(/^Received \(upload\)$/, 'Uploaded by the client')
  return tidy(plain(s))
}

/** History from the bundle: ledger events that name this document (its id, or its exact name). */
function bundleHistory(b: Bundle, d: DocumentInfo): DocHistoryRow[] {
  const clock = caseClock(b)
  const name = String(d.name || '')
  const idRe = new RegExp(`\\b${d.id}(?!\\d)`)
  const label = DOC_TYPE_LABEL[String(d.type)] || ''
  const rec = arr(b.events).find((e) => e.type === 'DOCUMENT_RECEIVED' && String(e.summary || '').split(': ').slice(1).join(': ') === name)
  const cites = new Set(arr(b.exceptions).filter((x) => arr(x.snippets).some((s) => s.doc_id === d.id)).map((x) => x.id))
  const out: DocHistoryRow[] = []
  arr(b.events).forEach((e) => {
    const s = String(e.summary || '')
    const at = ms(e.sim_time)
    let what: string | null = null
    if (e === rec) what = 'Received'
    else if (e.type === 'DOCUMENT_REQUESTED' && rec && e.seq < rec.seq && (s.endsWith(`: ${name}`) || (!!label && s.endsWith(`: ${label}`)))) what = s
    else if (e.type === 'FIELDS_EXTRACTED' && s.includes(` from ${name} via `)) what = s
    else if (e.type === 'EXCEPTION_RAISED' && cites.has((s.match(/^EX-\d+/) || [''])[0])) what = `Quoted on decision card ${s.replace(/ raised for (?:R\d+|MON):/, ':')}`
    else if (idRe.test(s)) what = s
    if (what) out.push({ seq: e.seq, day: at !== null ? clock.dayNo(at) : null, what: historyText(what, name) })
  })
  return out
}

function bundleFields(b: Bundle, id: string): { fields: DocViewField[]; rejected: string[]; injections: string[] } {
  const quotes = docQuotes(b, id).quotes
  const ex = extraction(b, id)
  const skip = new Set(['extractor', 'quotes_verified', 'rejected_unverified_quotes', 'injection_flagged'])
  const fields: DocViewField[] = []
  const used = new Set<Evidence>()
  Object.entries(ex ?? {}).forEach(([k, v]) => {
    if (skip.has(k)) return
    const many = Array.isArray(v)
    ;(many ? v : [v]).forEach((val) => {
      const q = quotes.find((x) => x.field === k && !used.has(x))
      if (q) used.add(q)
      fields.push({ field: many ? k.replace(/s$/, '') : k, value: String(val ?? ''), quote: String(q?.quote || ''), verified: true, start: null, end: null })
    })
  })
  // evidence quotes the extraction output does not name (e.g. multi-line owner blocks)
  quotes.filter((q) => !used.has(q) && !fields.some((f) => f.quote === q.quote)).forEach((q) => {
    fields.push({ field: String(q.field || 'quote'), value: '', quote: String(q.quote || ''), verified: true, start: null, end: null })
  })
  const rejected = Array.isArray(ex?.rejected_unverified_quotes) ? ex.rejected_unverified_quotes.map(String) : []
  const injections = Array.isArray(ex?.injection_flagged) ? ex.injection_flagged.map(String) : []
  return { fields, rejected, injections }
}

/** The viewer's model from the bundle alone (no full text). */
export function docViewFromBundle(b: Bundle, id: string): DocView {
  const d = arr(b.documents).find((x) => x.id === id)
  if (!d) {
    return { id, name: id, label: 'Document', type: '', person: null, issuedDay: null, receivedDay: null, receivedAt: null, issuedAt: null,
      status: '', statusWord: '', statusCls: 'st-waiting', usedBy: [], extractor: null, source: null, quarantineReason: null,
      text: null, fields: [], rejected: [], injections: [], validity: null, history: [], origin: 'missing' }
  }
  const clock = caseClock(b)
  const row = docRowFromBundle(b, d)
  const iss = ms(d.issued_at)
  const validity = EXPIRING_DOCS.has(String(d.type)) && iss !== null
    ? { issuedDay: row.issuedDay, expiresDay: clock.dayNo(iss + DOC_VALIDITY_DAYS * DAY), expired: clock.now >= iss + DOC_VALIDITY_DAYS * DAY }
    : null
  return { ...row, text: null, ...bundleFields(b, id), quarantineReason: null, validity, history: bundleHistory(b, d), origin: 'case' }
}

/** The viewer's model from `/documents/{id}`; the Docs-tab row (if any) and the bundle fill in what the detail lacks. */
export function docViewFromApi(b: Bundle, x: DocDetail, row: DocRow | undefined): DocView {
  const d = arr(b.documents).find((y) => y.id === x.id)
  const base = row ?? (d ? docRowFromBundle(b, d) : undefined)
  const k = docStatusKind(x.status)
  const v = x.validity && typeof x.validity === 'object' ? x.validity : null
  const name = String(x.name || base?.name || x.id)
  return {
    id: x.id,
    name,
    label: String(x.label || base?.label || DOC_TYPE_LABEL[String(x.type)] || 'Document'),
    type: String(x.type || base?.type || ''),
    person: base?.person ?? null,
    issuedDay: num(v?.issued_day) ?? base?.issuedDay ?? null,
    receivedDay: base?.receivedDay ?? null,
    receivedAt: base?.receivedAt ?? null,
    issuedAt: base?.issuedAt ?? null,
    status: String(x.status || base?.status || ''),
    statusWord: k ? DOC_STATUS[k].word : sentence(x.status_word || base?.statusWord || ''),
    statusCls: k ? DOC_STATUS[k].cls : base?.statusCls || 'st-waiting',
    usedBy: x.used_by ? arr(x.used_by).map((u) => useRow(b, u)) : base?.usedBy ?? [],
    extractor: x.extractor ? String(x.extractor) : base?.extractor ?? null,
    source: x.source ? String(x.source) : base?.source ?? null,
    text: typeof x.text === 'string' ? x.text : null,
    fields: arr(x.fields).map((f: DocField) => ({
      field: String(f.field || ''), value: f.value === null || f.value === undefined ? '' : String(f.value),
      quote: String(f.quote || ''), verified: typeof f.verified === 'boolean' ? f.verified : null, start: num(f.start), end: num(f.end),
    })),
    rejected: arr(x.rejected).map(String),
    injections: arr(x.injection_lines).map(String),
    quarantineReason: x.quarantine_reason ? String(x.quarantine_reason) : null,
    validity: v ? { issuedDay: num(v.issued_day), expiresDay: num(v.expires_day), expired: !!v.expired } : null,
    history: arr(x.history).map((h) => ({ seq: num(h.seq), day: num(h.day), what: historyText(h.what || humanize(h.type), name) })),
    origin: 'server',
  }
}

export type DocMark = { kind: 'field'; fields: DocViewField[] } | { kind: 'injection' }
/** Splits the full text into plain and highlighted runs. Server offsets are trusted only when
 *  text.slice(start, end) === quote; otherwise the quote is searched for. Overlapping ranges are skipped (listed as unplaced). */
export function docSegments(text: string, fields: DocViewField[], injections: string[]): { parts: { t: string; mark: DocMark | null }[]; unplaced: DocViewField[] } {
  type R = { a: number; z: number; mark: DocMark }
  const ranges: R[] = []
  const unplaced: DocViewField[] = []
  const free = (a: number, z: number) => ranges.every((r) => z <= r.a || a >= r.z)
  fields.forEach((f) => {
    if (!f.quote) return
    let a = f.start !== null && f.end !== null && text.slice(f.start, f.end) === f.quote ? f.start : -1
    if (a < 0) a = text.indexOf(f.quote)
    if (a < 0) { unplaced.push(f); return }
    const z = a + f.quote.length
    const same = ranges.find((r) => r.a === a && r.z === z)
    if (same && same.mark.kind === 'field') { same.mark.fields.push(f); return }
    if (free(a, z)) ranges.push({ a, z, mark: { kind: 'field', fields: [f] } })
    else unplaced.push(f)
  })
  injections.forEach((line) => {
    const a = line ? text.indexOf(line) : -1
    if (a >= 0 && free(a, a + line.length)) ranges.push({ a, z: a + line.length, mark: { kind: 'injection' } })
  })
  ranges.sort((p, q) => p.a - q.a)
  const parts: { t: string; mark: DocMark | null }[] = []
  let i = 0
  ranges.forEach((r) => {
    if (r.a > i) parts.push({ t: text.slice(i, r.a), mark: null })
    parts.push({ t: text.slice(r.a, r.z), mark: r.mark })
    i = r.z
  })
  if (i < text.length) parts.push({ t: text.slice(i), mark: null })
  return { parts, unplaced }
}
