/* Mirrors the Bundle contract in docs/design.md.
   Every object tolerates unknown fields; optional fields may be missing on older servers. */

export type ReqStatus = 'SATISFIED' | 'OPEN_WAITING' | 'CONTRADICTED' | 'NEEDS_REVIEW' | 'EXPIRED' | (string & {})
export type CaseStatus = 'OPEN' | 'READY_FOR_DECISION' | 'ON_HOLD' | (string & {})
export type TimerStatus = 'PENDING' | 'FIRED' | 'CANCELLED' | (string & {})

export interface Actor {
  type: string
  id?: string
  [k: string]: unknown
}

export interface CaseInfo {
  id: string
  title: string
  goal?: string
  /** the template's decision in the bank's words ("credit decision", "annual review sign-off"); newer servers only */
  decision?: string
  template?: string
  status: CaseStatus
  sim_now: string
  day: number
  opened_at: string
  [k: string]: unknown
}

export interface Config {
  agent_mode?: string
  agent_status?: string
  judge_mode?: string
  judge_threshold?: number
  registry_down?: boolean
  [k: string]: unknown
}

export interface Evidence {
  doc_id?: string | null
  label?: string
  field?: string
  quote?: string
  [k: string]: unknown
}

export interface Requirement {
  id: string
  title: string
  status: ReqStatus
  reason?: string
  rule_ids?: string[]
  evidence?: Evidence[]
  updated_at?: string | null
  [k: string]: unknown
}

export interface DocumentInfo {
  id: string
  type?: string
  name?: string
  received_at?: string
  issued_at?: string
  [k: string]: unknown
}

/** A snippet is a document quote; for `sequence_insider` it is a linked ledger event (`#seq`). */
export interface Snippet {
  doc_id?: string | null
  label?: string
  quote?: string
  seq?: number
  summary?: string
  sim_time?: string
  [k: string]: unknown
}

/** Independent check that must agree before a fuzzy match is accepted automatically (v2). */
export interface SecondOpinion {
  method?: string
  p_same?: number
  threshold?: number
  [k: string]: unknown
}

export interface Judge {
  question?: string
  probs?: Record<string, number>
  threshold?: number
  source?: string
  a?: string
  b?: string
  second_opinion?: SecondOpinion | null
  auto_accept?: boolean
  [k: string]: unknown
}

export interface ExceptionAction {
  id: string
  label?: string
  [k: string]: unknown
}

export interface Resolution {
  action_id?: string
  note?: string
  at?: string
  by?: Actor
  [k: string]: unknown
}

// Trailing underscore: `Exception` would shadow nothing in TS, but it reads as the JS error type.
export interface Exception_ {
  id: string
  requirement_id?: string
  status: 'OPEN' | 'RESOLVED' | (string & {})
  severity?: string
  kind?: string
  title: string
  summary?: string
  rule?: { id?: string; text?: string; [k: string]: unknown } | null
  snippets?: Snippet[]
  judge?: Judge | null
  actions?: ExceptionAction[]
  created_at?: string
  notes?: unknown[]
  resolution?: Resolution | null
  /** `sequence_insider` only: the two linked ledger events. */
  first_seq?: number
  then_seq?: number
  [k: string]: unknown
}

export interface Timer {
  id: string
  kind: string
  label: string
  due: string
  status: TimerStatus
  [k: string]: unknown
}

export interface Metrics {
  agent_steps?: number
  tool_calls?: number
  auto_resolved?: number
  sent_to_human?: number
  denied_actions?: number
  [k: string]: unknown
}

export interface LedgerEvent {
  seq: number
  type: string
  sim_time: string
  actor?: Actor
  summary?: string
  hash?: string
  prev_hash?: string
  [k: string]: unknown
}

export interface TraceStep {
  seq: number
  sim_time: string
  reason?: string
  tool: string
  input?: unknown
  output?: unknown
  gate?: string
  /** Who acted: pipeline (code) | claude | planner | safety-net; null on older events. */
  by?: string | null
  [k: string]: unknown
}

export interface ScenarioItem {
  id: string
  label: string
  delivered: boolean
  /** Bank-internal staff event rather than a client upload. */
  internal?: boolean
  [k: string]: unknown
}

/** A client email (Romanian), from EMAIL_SENT / EMAIL_FAILED events. `mode: "outbox"` means queued, never sent. */
export interface OutboxEmail {
  seq: number
  sim_time: string
  status: 'sent' | 'failed' | (string & {})
  to?: string | null
  subject?: string | null
  body?: string | null
  mode?: 'outbox' | 'gmail' | (string & {})
  error?: string | null
  [k: string]: unknown
}

export interface LearnedCheck {
  id: string
  proposal_id?: string
  promoted_by?: string
  promoted_at?: string
  description?: string
  [k: string]: unknown
}

export interface BundleLearning {
  checks?: LearnedCheck[]
  proposals?: number
  [k: string]: unknown
}

export interface Bundle {
  case: CaseInfo
  config?: Config
  requirements?: Requirement[]
  documents?: DocumentInfo[]
  exceptions?: Exception_[]
  timers?: Timer[]
  metrics?: Metrics
  events?: LedgerEvent[]
  trace?: TraceStep[]
  scenario?: ScenarioItem[]
  learning?: BundleLearning
  /** Newest first. */
  outbox?: OutboxEmail[]
  [k: string]: unknown
}

export interface VerifyResult {
  ok: boolean
  length: number
  broken_at: number | null
}

/* ---- chat (Task 4) ---- */
export type ChatRole = 'client' | 'employee'

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface Citation {
  kind: 'event' | 'doc' | (string & {})
  ref: string
  label?: string
  [k: string]: unknown
}

export interface ChatResponse {
  answer: string
  citations?: Citation[]
  tools_used?: { tool: string; input?: unknown }[]
  mode?: 'bedrock' | 'offline' | (string & {})
  [k: string]: unknown
}

/* ---- learning (Task 9) ---- */
export interface Proposal {
  id: string
  kind?: string
  support?: number
  ruled_by?: string[]
  description?: string
  [k: string]: unknown
}

export interface LearningState {
  proposals: Proposal[]
  checks: LearnedCheck[]
  [k: string]: unknown
}

export interface Backtest {
  n?: number
  auto_resolved?: number
  false_approvals?: number
  manual_review_rate?: number
  [k: string]: unknown
}

/* ---- documents + live updates (client-portal spec, API table) ---- */
export interface CaseVersion {
  length: number
  status?: string
  [k: string]: unknown
}

export type DocStatus = 'valid' | 'expired' | 'superseded' | 'quarantined' | (string & {})

export interface DocUse {
  id: string
  title?: string
  status_word?: string
  [k: string]: unknown
}

/** One row of `GET /documents?role=employee`. Days are case days (negative = before the case opened). */
export interface DocListItem {
  id: string
  type?: string
  label?: string
  name?: string
  issued_day?: number | null
  received_day?: number | null
  status?: DocStatus
  status_word?: string
  person?: string | null
  source?: string
  used_by?: DocUse[]
  extractor?: string | null
  [k: string]: unknown
}

/** `start`/`end` are exact offsets into `text` (text.slice(start, end) === quote). */
export interface DocField {
  field: string
  value?: unknown
  quote?: string
  verified?: boolean
  start?: number | null
  end?: number | null
  [k: string]: unknown
}

export interface DocHistoryItem {
  seq?: number | null
  day?: number | null
  type?: string
  what?: string
  [k: string]: unknown
}

/** `GET /documents/{id}?role=employee`. */
export interface DocDetail {
  id: string
  type?: string
  label?: string
  name?: string
  text?: string | null
  status?: DocStatus
  status_word?: string
  source?: string
  extractor?: string | null
  fields?: DocField[]
  rejected?: string[]
  injection_lines?: string[]
  /** quarantined documents only: why nothing was extracted (e.g. the tax ID belongs to another company) */
  quarantine_reason?: string | null
  used_by?: DocUse[]
  validity?: { issued_day?: number | null; expires_day?: number | null; expired?: boolean } | null
  history?: DocHistoryItem[]
  [k: string]: unknown
}
