/* Client portal API. A copy of the bank screen's request helper (src/lib/api.ts is owned by another builder),
   narrowed to the client endpoints in the spec's API table. Every function is safe to call against an older
   server: a missing endpoint throws an ApiError that isUnavailable() recognises. */
import type {
  CaseRow, ChatHistoryItem, ChatResponse, ClientDocument, ClientDocumentDetail, ClientView, Company, ConfirmKind, GlobalVersion,
  PortalNotification, SampleFile, Template, VersionInfo,
} from './types'

/** Every failed call throws this. `status` 0 means the server could not be reached; -1 means it answered without JSON. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 404 / 405 / 501 / a non-JSON answer all mean "this server has no such endpoint yet". */
export const isUnavailable = (e: unknown): boolean =>
  e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501 || e.status === -1)

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'The server cannot be reached.')
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
    throw new ApiError(res.status, msg)
  }
  if (!isJson) throw new ApiError(-1, 'The server answered without data.')
  return data as T
}

const c = (id: string) => `/api/cases/${encodeURIComponent(id)}`

export const getClientView = (id: string) => call<ClientView>('GET', `${c(id)}/client-view`)
export const getVersion = (id: string) => call<VersionInfo>('GET', `${c(id)}/version`)
export const getDocuments = (id: string) => call<ClientDocument[]>('GET', `${c(id)}/documents?role=client`)
export const getDocument = (id: string, docId: string) =>
  call<ClientDocumentDetail>('GET', `${c(id)}/documents/${encodeURIComponent(docId)}?role=client`)
/** JSON upload: `content_b64` is the file as base64 without the data-URL prefix. 422 when the key is not pending,
 *  the file is over 1 MB or it is not .txt/.pdf. */
export const upload = (id: string, key: string, filename: string, contentB64: string) =>
  call<ClientView>('POST', `${c(id)}/upload`, { key, filename, content_b64: contentB64 })
/** Demo only: uploads the prepared synthetic file for a request. `wrong_company` sends another firm's certificate. */
export const uploadSample = (id: string, key: string, variant: 'ok' | 'wrong_company' = 'ok') =>
  call<ClientView>('POST', `${c(id)}/upload-sample`, { key, variant })
/** The case's prepared sample files (keys spelled like that case's requests). An older server only has the demo-1 list. */
export async function sampleFiles(id: string): Promise<SampleFile[]> {
  try {
    return await call<SampleFile[]>('GET', `${c(id)}/sample-files`)
  } catch (e) {
    if (isUnavailable(e) && id === 'demo-1') return call<SampleFile[]>('GET', '/api/demo/sample-files')
    throw e
  }
}
/** 409 when nothing of that kind is pending. */
export const clientConfirm = (id: string, kind: ConfirmKind, answer: 'yes' | 'no') =>
  call<ClientView>('POST', `${c(id)}/client-confirm`, { kind, answer })
/** The chat with the role fixed to "client": the portal can never ask as an employee. */
export const chat = (id: string, message: string, history: ChatHistoryItem[]) =>
  call<ChatResponse>('POST', `${c(id)}/chat`, { role: 'client', message, history: history.slice(-10) })

/* ---------- multi-case: the client's home ---------- */
const q = encodeURIComponent
/** A cheap global change detector: refetch the lists when it changes. */
export const getGlobalVersion = () => call<GlobalVersion>('GET', '/api/version')
export const listCases = (companyId: string) => call<CaseRow[]>('GET', `/api/cases?role=client&company_id=${q(companyId)}`)
export const listCompanies = () => call<Company[]>('GET', '/api/companies')
export const listTemplates = () => call<Template[]>('GET', '/api/templates')
export const notifications = (companyId: string) =>
  call<PortalNotification[]>('GET', `/api/notifications?role=client&company_id=${q(companyId)}`)
/** Opens a new file. Answers with the bank's bundle: only `case.id` is read here. 422 for a pair the company has no
 *  documents for. */
export const createCase = (template: string, companyId: string) =>
  call<{ case?: { id?: string } }>('POST', '/api/cases', { template, company_id: companyId })

/** The server's limit (backend `_ingest_upload`: more than 1,000,000 bytes is refused). */
export const MAX_UPLOAD_BYTES = 1_000_000
export const UPLOAD_EXT = /\.(txt|pdf)$/i

/** Reads a file as base64 (FileReader.readAsDataURL, then the `data:...;base64,` prefix is stripped). */
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result ?? '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = () => reject(new Error('The file could not be read.'))
    r.readAsDataURL(file)
  })
}

/** Error text in the portal's voice. Server details are only shown when they pass the client copy filter. */
export function failureText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'We can’t reach the bank right now. Please try again in a moment.'
    if (e.status === 409) return 'This was already answered. Your file is up to date.'
    if (e.status === 413 || (e.status === 422 && /larger than/i.test(e.message))) return 'That file is larger than 1 MB. Please choose a smaller one.'
    if (e.status === 422) {
      if (/pending|not requested|not waiting/i.test(e.message)) return 'We are not waiting for this document any more.'
      if (/utf-?8/i.test(e.message)) return 'Please save the text file as UTF-8 and try again.'
      return 'We couldn’t accept this file. Please send a .txt or .pdf file up to 1 MB.'
    }
    if (e.status === 404 && /no sample file/i.test(e.message)) return 'No sample file is prepared for this document.'
  }
  return 'Something went wrong. Please try again.'
}
