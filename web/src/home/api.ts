/* Home-screen calls. They do not count as "in flight" for lib/api, so the case screen's live polling never waits on them. */
import { ApiError } from '@/lib/api'
import type { Bundle } from '@/lib/types'
import type { CaseRow, Company, GlobalVersion, Note, Template } from './types'

async function send<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
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
    const detail = isJson && data && typeof data === 'object' && 'detail' in data ? (data as { detail: unknown }).detail : null
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d))).join('; ')
        : `${res.status} ${res.statusText}`.trim()
    throw new ApiError(res.status, msg)
  }
  // An HTML page where JSON was expected (an SPA fallback) means the endpoint does not exist on this server.
  if (!isJson) throw new ApiError(-1, 'The server answered without data.')
  return data as T
}

export const getGlobalVersion = () => send<GlobalVersion>('GET', '/api/version')
export const getCases = () => send<CaseRow[]>('GET', '/api/cases?role=employee')
export const getNotes = () => send<Note[]>('GET', '/api/notifications?role=employee')
export const getCompanies = () => send<Company[]>('GET', '/api/companies')
export const getTemplates = () => send<Template[]>('GET', '/api/templates')
/** Older servers: the home screen falls back to a single demo-1 row built from its bundle. */
export const getDemoBundle = () => send<Bundle>('GET', '/api/cases/demo-1/bundle')
/** Opens a new file; the agent immediately asks the client for the starting documents. 422 for an unsupported pair. */
export const createCase = (template: string, companyId: string) => send<Bundle>('POST', '/api/cases', { template, company_id: companyId })
/** Wipes the database and reseeds every synthetic file (answers with demo-1's bundle). */
export const resetAll = () => send<Bundle>('POST', '/api/demo/reset?all=true', {})
