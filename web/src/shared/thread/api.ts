/* The thread's own request helper. A small copy of the apps' helpers (each app owns its own api.ts), so the thread
   runs unchanged in the bank screen and the client portal. Thread requests are deliberately "quiet": they never
   count towards the bank screen's in-flight counter, so its live polling keeps running while a message is sent. */
import type { CaseVersion, Mentionables, PostRef, ThreadItem, ThreadRole } from './types'

export class ThreadApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ThreadApiError'
    this.status = status
  }
}

/** 404 / 405 / 501 / a non-JSON answer: this server has no such endpoint yet. */
export const isUnavailable = (e: unknown): boolean =>
  e instanceof ThreadApiError && (e.status === 404 || e.status === 405 || e.status === 501 || e.status === -1)

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ThreadApiError(0, 'The server cannot be reached.')
  }
  const text = await res.text()
  let data: unknown = null
  let isJson = false
  if (text) {
    try { data = JSON.parse(text); isJson = true } catch { /* not JSON */ }
  }
  if (!res.ok) {
    const detail = isJson && data && typeof data === 'object' && 'detail' in data ? (data as { detail: unknown }).detail : null
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d))).join('; ')
        : `${res.status} ${res.statusText}`.trim()
    throw new ThreadApiError(res.status, msg)
  }
  if (!isJson) throw new ThreadApiError(-1, 'The server answered without data.')
  return data as T
}

const c = (id: string) => `/api/cases/${encodeURIComponent(id)}`

export const getMessages = (caseId: string, role: ThreadRole) =>
  call<ThreadItem[]>('GET', `${c(caseId)}/messages?role=${role}`)

export const postMessage = (caseId: string, body: { role: ThreadRole; author?: string; text: string; refs: PostRef[] }) =>
  call<ThreadItem[]>('POST', `${c(caseId)}/messages`, body)

export const getMentionables = (caseId: string, role: ThreadRole) =>
  call<Mentionables>('GET', `${c(caseId)}/mentionables?role=${role}`)

export const getVersion = (caseId: string) => call<CaseVersion>('GET', `${c(caseId)}/version`)

/** The bell's last-seen key for a case and role: the value is the newest seq the viewer has seen (a plain number). */
export const seenKey = (role: ThreadRole, caseId: string) => `openloop-seen:${role}:${caseId}`
