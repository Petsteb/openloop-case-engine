import type {
  Backtest, Bundle, ChatHistoryItem, ChatResponse, ChatRole, LearnedCheck, LearningState, VerifyResult,
} from './types'

/** Every failed call throws this. `status` 0 means the server could not be reached. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 404 / 405 (the static mount rejects unknown POSTs) / a non-JSON answer all mean "this server has no such endpoint yet". */
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
    throw new ApiError(0, 'The server cannot be reached. Check that the backend is running.')
  }
  const text = await res.text()
  let data: unknown = null
  let isJson = false
  if (text) {
    try { data = JSON.parse(text); isJson = true } catch { /* not JSON */ }
  }
  if (!res.ok) {
    const detail = isJson && data && typeof data === 'object' && 'detail' in data
      ? (data as { detail: unknown }).detail : null
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d))).join('; ')
        : `${res.status} ${res.statusText}`.trim()
    throw new ApiError(res.status, msg)
  }
  // An HTML page where JSON was expected (e.g. an SPA fallback) means the endpoint does not exist.
  if (!isJson) throw new ApiError(-1, 'The server answered without data.')
  return data as T
}

const c = (id: string) => `/api/cases/${encodeURIComponent(id)}`

export const getBundle = (id: string) => call<Bundle>('GET', `${c(id)}/bundle`)
export const reset = () => call<Bundle>('POST', '/api/demo/reset', {})
export const inbound = (id: string, itemId: string) => call<Bundle>('POST', `${c(id)}/inbound`, { item_id: itemId })
export const advance = (id: string, days: number) => call<Bundle>('POST', `${c(id)}/advance`, { days })
export const resolve = (id: string, exId: string, actionId: string, note = '') =>
  call<Bundle>('POST', `${c(id)}/exceptions/${encodeURIComponent(exId)}/resolve`, { action_id: actionId, note })
export const verify = (id: string) => call<VerifyResult>('GET', `${c(id)}/verify`)
export const chat = (id: string, role: ChatRole, message: string, history: ChatHistoryItem[]) =>
  call<ChatResponse>('POST', `${c(id)}/chat`, { role, message, history: history.slice(-10) })

export const getLearning = () => call<LearningState>('GET', '/api/learning')
export const backtest = (pid: string) => call<Backtest>('POST', `/api/learning/proposals/${encodeURIComponent(pid)}/backtest`, {})
export const promote = (pid: string, by: string) =>
  call<{ check: LearnedCheck }>('POST', `/api/learning/proposals/${encodeURIComponent(pid)}/promote`, { by })
