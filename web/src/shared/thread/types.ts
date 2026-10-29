/* Types for the per-case messages thread (contract v3: /messages and /mentionables). Shared by the bank screen and the
   client portal, so nothing here imports from either app. */

export type ThreadRole = 'client' | 'employee'

export type RefKind = 'doc' | 'event' | 'person'

/** A reference the server validated. Event ids come back as numbers, doc ids as "doc-N", person ids as the name. */
export interface ThreadRef {
  kind: RefKind | (string & {})
  id: string | number
  label?: string | null
}

export interface ThreadAuthor {
  role: 'client' | 'employee' | 'bank' | (string & {})
  name?: string | null
}

/** One row of the thread, oldest first. Messages carry `text`; the bank's automatic emails carry `subject` + `body`. */
export interface ThreadItem {
  seq: number
  day?: number | null
  sim_time?: string | null
  kind: 'message' | 'email' | (string & {})
  author?: ThreadAuthor | null
  text?: string | null
  subject?: string | null
  /** emails only: a missing status means sent. The bank sees failed ones; the client only gets sent ones. */
  status?: 'sent' | 'failed' | (string & {}) | null
  error?: string | null
  body?: string | null
  refs?: ThreadRef[] | null
}

export interface Mentionables {
  people?: { id: string; label?: string | null }[] | null
  docs?: { id: string; label?: string | null }[] | null
  events?: { seq: number; label?: string | null; day?: number | null }[] | null
}

/** What the composer sends: refs picked from the autocomplete (typed #doc-N / #N are also parsed by the server). */
export interface PostRef { kind: RefKind; id: string | number }

export interface CaseVersion { length?: number; status?: string }
