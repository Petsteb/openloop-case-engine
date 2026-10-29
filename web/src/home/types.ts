/* Home screen (work queue) data, from contract v3. Fields are optional where an older server may leave them out. */

/** `GET /api/version`: a cheap global change detector. */
export interface GlobalVersion { cases: number; events: number }

/** `GET /api/cases?role=employee`: one row per file, already sorted needs-you first. */
export interface CaseRow {
  id: string
  title?: string
  template?: string
  template_title?: string
  company_id?: string
  company?: string
  product?: string
  status?: string
  /** Client-perspective state ("needs_you" means the client must act); the queue does not use it. */
  state?: string
  status_text?: string
  needs_you?: number
  open_decisions?: number
  waiting_on_client?: number
  day?: number
  events?: number
  last_message_seq?: number
  last_action_seq?: number
  last_activity?: string
}

/** `GET /api/notifications?role=employee`, newest first. */
export interface Note {
  case_id: string
  company?: string
  kind?: 'action' | 'message' | string
  text?: string
  seq: number
  day?: number
}

/** `GET /api/companies`. */
export interface Company {
  id: string
  name: string
  cui?: string
  city?: string
  county?: string
  product?: string
  story?: string
  /** Template ids this company has documents for; `POST /api/cases` answers 422 for any other pair. */
  templates?: string[]
}

/** `GET /api/templates`. */
export interface Template {
  id: string
  title: string
  description?: string
  requirements?: string[]
}

/** The fields contract v3 adds to `bundle.case`. */
export interface CaseExtra {
  template?: string
  template_title?: string
  company_id?: string
  company?: string
  product?: string
}
