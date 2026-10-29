/* Shapes of the client endpoints (the portal API in docs/design.md).
   Everything optional is either new on the backend or may be absent on an older server: the UI must cope. */

export type PortalState = 'needs_you' | 'under_review' | 'complete' | 'in_progress'

export interface ClientCheck { id: string; title: string; status_word: string }

export interface ClientOverview {
  status_text: string
  state?: PortalState
  day: number
  checks: ClientCheck[]
  open_items?: number
  company?: string
  product?: string
}

export interface MissingDocument {
  key: string                     // e.g. "fiscal_certificate", "id_card:Elena Munteanu"
  label: string
  why?: string
  requested_day: number
  reminders: number
  next_reminder_day: number | null
  seq: number | null
}

export interface ClientIssue { what: string; since_day: number; seq?: number | null }

export interface TimelineItem { seq: number; day: number; when: string; type: string; what: string }

export interface ClientEmail { subject: string; body: string; sim_time: string }

export type ConfirmKind = 'contact_change' | 'credit_check_consent'
export interface Confirmation { kind: ConfirmKind | string; text: string; ref_seq?: number | null }

/** `unreadable`: a PDF that was stored but not read ("Received, waiting for manual reading"). */
export type DocStatus = 'valid' | 'expired' | 'superseded' | 'quarantined' | 'unreadable'
export interface ClientDocument {
  id: string
  type: string
  label?: string
  name: string
  issued_day?: number | null
  received_day: number | null
  status: DocStatus | string
  /** "Verified" | "Received" | "Please send a new one" | "Replaced by a newer version" | "Not accepted" */
  status_word: string
}

export interface ClientDocumentDetail {
  id: string
  name: string
  received_day: number | null
  status_word: string
  text?: string
  history: { day: number; what: string }[]
}

export interface ClientView {
  overview: ClientOverview
  missing_documents: MissingDocument[]
  issues: ClientIssue[]
  timeline: TimelineItem[]
  emails: ClientEmail[]
  confirmations?: Confirmation[]
  documents?: ClientDocument[]
}

export interface VersionInfo { length: number; status: string }

export interface SampleFile { key: string; label: string; filename: string; variant?: 'ok' | 'wrong_company' | string }

export interface Citation { kind: 'event' | 'doc' | string; ref: string | number; label?: string }
export interface ChatHistoryItem { role: 'user' | 'assistant'; content: string }
export interface ChatResponse { answer: string; citations?: Citation[]; tools_used?: unknown[]; mode?: string }

/* ---------- multi-case (contract v3) ---------- */
export interface GlobalVersion { cases: number; events: number }

/** One row of GET /api/cases?role=client&company_id=: the client wording only (no open decisions). */
export interface CaseRow {
  id: string
  title?: string
  template?: string
  template_title?: string
  company_id?: string
  company?: string
  product?: string
  status?: string
  state?: PortalState | string
  status_text?: string
  waiting_on_client?: number
  needs_you?: number
  day?: number
  events?: number
  last_message_seq?: number
  last_action_seq?: number
  last_activity?: string
}

/** GET /api/companies. `story` is a staff note for the demo: never shown on the portal. */
export interface Company {
  id: string
  name: string
  cui?: string
  city?: string
  county?: string
  product?: string
  templates?: string[]
}

/** `decision` ("credit decision", "annual review sign-off") and `goal` come from newer servers only. */
export interface Template { id: string; title: string; description?: string; requirements?: string[]; goal?: string; decision?: string }

/** GET /api/notifications?role=client&company_id=, newest first. */
export interface PortalNotification {
  case_id: string
  company?: string
  kind: 'action' | 'message' | string
  text: string
  seq: number
  day?: number
}
