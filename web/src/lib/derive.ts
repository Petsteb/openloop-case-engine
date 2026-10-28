/* Pure Bundle -> view mapping. No DOM, no React, relative imports only (testable from a Node script). */
import type { Bundle, DocumentInfo, Evidence, Exception_, LedgerEvent, Requirement, Timer, TraceStep } from './types'

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
  const parts = s.split(/\s+\+\s+/)
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
  .replace(/\s*\(quotes verified: True\)/g, ', every quote verified')
  .replace(/\s*\(quotes verified: False\)/g, ', some quotes could not be verified')
export const cleanTitle = (s: unknown) => tidy(String(s ?? '')
  .replace(/\s*&\s*/g, ' and ')
  .replace(/\s*≥\s*/g, ' of at least ')
  .replace(/\s*≤\s*/g, ' of at most '))
export const shortHash = (h: unknown) => (h ? `${String(h).slice(0, 4)}…` : '–')

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

export type Tone = 'need' | 'done' | 'wait' | 'hold'
export function statusLine(b: Bundle): { tone: Tone; text: string } {
  const n = openExceptions(b).length
  if (n) return { tone: 'need', text: `${plural(n, 'decision')} need${n === 1 ? 's' : ''} you` }
  if (isOnHold(b)) return { tone: 'hold', text: 'On hold. The file was escalated to compliance.' }
  if (isComplete(b)) return { tone: 'done', text: 'File complete. The credit decision is yours.' }
  const reqs = arr(b.requirements)
  if (!arr(b.events).some((e) => e.type === 'DOCUMENT_RECEIVED')) return { tone: 'wait', text: 'Waiting for the client to send the application pack' }
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
  if (!arr(b.events).some((e) => e.type === 'DOCUMENT_RECEIVED')) return { tone: 'wait', text: 'Waiting for the application pack' }
  return { tone: 'wait', text: 'The agent is working the file' }
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
    return { id: r.id, title: cleanTitle(r.title), kind, reason: tidy(plain(r.reason || STATUS[kind].word)), attention: isAttention(kind), next, req: r }
  })
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
const HUMAN_STAFF = new Set(['analyst', 'employee', 'staff', 'reviewer'])
const SKIP_AGENT_LANE = new Set(['AGENT_STEP', 'SCENARIO_DELIVERED', 'CLOCK_ADVANCED', 'TIMER_SET', 'TIMER_FIRED', 'TIMER_CANCELLED', 'CHAT_TURN'])

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
  if (t === 'system') return 'Rules engine'
  return sentence(t || 'System')
}

export function timelineItems(b: Bundle, opts: { steps: boolean }): TLItem[] {
  const disp = displayTimes(b)
  const out: TLItem[] = []
  const blockedSeqs = new Set(arr(b.trace).filter((s) => gateRule(s.gate)).map((s) => s.seq))
  arr(b.events).forEach((e) => {
    const real = ms(e.sim_time)
    if (real === null || e.type === 'CHAT_TURN') return
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

/** For `sequence_insider` cards: the two linked ledger events. */
export function linkedEvents(b: Bundle, x: Exception_): { seq: number | null; text: string; when: number | null }[] {
  return arr(x.snippets).map((s) => {
    const raw = String(s.summary ?? s.quote ?? s.text ?? '')
    const seqFromText = Number((String(s.label ?? '') + ' ' + raw).match(/#(\d+)/)?.[1])
    const seq = typeof s.seq === 'number' ? s.seq : Number.isFinite(seqFromText) && seqFromText > 0 ? seqFromText : null
    const ev = seq !== null ? arr(b.events).find((e) => e.seq === seq) : undefined
    const text = tidy(plain(raw.replace(/^#\d+\s*[:,-]?\s*/, ''))) || (ev ? eventText(b, ev) : String(s.label ?? ''))
    return { seq, text, when: ms(String(s.sim_time ?? ev?.sim_time ?? '')) }
  })
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
}
export const resolveToast = (x: Exception_, actionId: string) => TOASTS[actionId] || `Decision recorded: ${actionLabel(x, actionId).toLowerCase()}.`

/* ================= decision evidence as document slips ================= */
export type LineKind = 'same' | 'diff' | 'missing' | 'gap'
export interface SlipLine { t: string; k: LineKind; marks: string[]; note?: string }
export interface Slip { src: string; doc: string | null; lines: SlipLine[] }

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
function ownershipSlips(snips: { label: string; doc: string | null; quote: string }[]) {
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
function tokenSlips(snips: { label: string; doc: string | null; quote: string }[], summary: string) {
  if (snips.length !== 2) return null
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

export function decisionEvidence(x: Exception_): { slips: Slip[]; matches: string[] } {
  const snips = arr(x.snippets).filter((s) => s.quote).map((s) => ({ label: String(s.label || s.doc_id || 'Document'), doc: s.doc_id ?? null, quote: String(s.quote) }))
  const summary = String(x.summary || '')
  try {
    const own = x.kind === 'ubo_discrepancy' || x.requirement_id === 'R2' ? ownershipSlips(snips) : null
    if (own) return own
    const tok = x.kind === 'address_uncertain' || x.kind === 'signatory_uncertain' || x.judge ? tokenSlips(snips, summary) : null
    if (tok) return tok
  } catch { /* fall back to plain lines */ }
  return {
    slips: snips.map((s) => ({ src: s.label, doc: s.doc, lines: s.quote.split(/\r?\n/).filter(Boolean).map((t) => ({ t, k: 'same' as const, marks: [] })) })),
    matches: [],
  }
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
  if (info.length !== 2 || info.some((i) => !i.d)) return info.map((i) => ({ ...i.s, role: null, meta: meta(i.d, null) }))
  const sorted = [...info].sort((x, y) => x.rec - y.rec || x.n - y.n)
  return sorted.map((i, k) => {
    const role = k === 1 ? 'new' as const : 'onfile' as const
    return { ...i.s, role, meta: meta(i.d, role) }
  })
}
