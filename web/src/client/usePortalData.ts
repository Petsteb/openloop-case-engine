import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import { isUnavailable } from './api'
import { arr, portalState, rowNeeds } from './derive'
import type { CaseRow, ClientView, Company, PortalNotification, PortalState, Template } from './types'

const POLL_MS = 3000
const FALLBACK_MS = 5000
const VERSION_RETRY_MS = 30_000
const NEXT_MAX = 6

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

/** Goes up whenever something changed on the server: GET /api/version every 3 s (only a change counts), or every 5 s
 *  when that endpoint is missing. Paused while the tab is hidden; coming back counts as a change. */
function useServerTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let last: string | null = null
    let ok: boolean | null = null
    let retryAt = 0
    const bump = () => setTick((t) => t + 1)
    const run = async () => {
      let delay = POLL_MS
      try {
        if (!hidden()) {
          if (ok !== false || Date.now() >= retryAt) {
            try {
              const v = await api.getGlobalVersion()
              ok = true
              const key = `${v?.cases}:${v?.events}`
              if (key !== last) { if (last !== null) bump(); last = key }
            } catch (e) {
              if (isUnavailable(e)) { ok = false; retryAt = Date.now() + VERSION_RETRY_MS }
            }
          }
          if (ok === false) { delay = FALLBACK_MS; bump() }
        }
      } finally {
        if (!stopped) timer = setTimeout(run, delay)
      }
    }
    void run()
    const onVis = () => { if (!hidden()) bump() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return tick
}

export interface NextInfo { state: PortalState; missing: number; confirmations: number }

export interface PortalData {
  /** null while loading; on an older server, Aurora only */
  companies: Company[] | null
  templates: Template[] | null
  /** the chosen company's files; null while loading (or after a company switch, until its list arrives) */
  rows: CaseRow[] | null
  rowsError: string | null
  /** true when /api/cases is missing: the list is demo-1 only, built from its client view */
  legacy: boolean
  /** undefined while loading; null when /api/notifications is missing (the bell shows no count) */
  notes: PortalNotification[] | null | undefined
  /** exact pending counts for the files that need the client (from their client views) */
  next: Record<string, NextInfo>
  tick: number
  refetch: () => void
}

const AURORA: Company = { id: 'aurora', name: 'Brutăria Aurora SRL', templates: ['sme_loan'] }

function legacyRow(cv: ClientView): CaseRow {
  const missing = arr(cv.missing_documents).length
  const conf = arr(cv.confirmations).length
  return {
    id: 'demo-1', template: 'sme_loan', company_id: 'aurora', company: cv.overview?.company, product: cv.overview?.product,
    state: portalState(cv), status_text: cv.overview?.status_text, day: cv.overview?.day ?? 0,
    waiting_on_client: missing + conf, needs_you: missing + conf,
  }
}

/** Everything the home screen and the bell need, kept live by one global poll. */
export function usePortalData(companyId: string): PortalData {
  const serverTick = useServerTick()
  const [manual, setManual] = useState(0)
  const tick = serverTick + manual
  const refetch = useCallback(() => setManual((m) => m + 1), [])

  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [rows, setRows] = useState<{ for: string; rows: CaseRow[] } | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [legacy, setLegacy] = useState(false)
  const [notes, setNotes] = useState<{ for: string; notes: PortalNotification[] | null } | null>(null)
  const [next, setNext] = useState<Record<string, NextInfo>>({})
  const listsDone = useRef({ companies: false, templates: false })

  /* the company and template lists rarely change: load once, and retry on a later tick after a network error */
  useEffect(() => {
    let live = true
    if (!listsDone.current.companies) {
      api.listCompanies().then((c) => {
        if (!live) return
        listsDone.current.companies = true
        setCompanies(arr(c).filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string'))
      }).catch((e) => {
        if (!live) return
        if (isUnavailable(e)) { listsDone.current.companies = true; setCompanies([AURORA]) }
      })
    }
    if (!listsDone.current.templates) {
      api.listTemplates().then((t) => {
        if (!live) return
        listsDone.current.templates = true
        setTemplates(arr(t).filter((x) => x && typeof x.id === 'string'))
      }).catch((e) => {
        if (!live) return
        if (isUnavailable(e)) { listsDone.current.templates = true; setTemplates([]) }
      })
    }
    return () => { live = false }
  }, [tick])

  /* the chosen company's files and notifications */
  useEffect(() => {
    let live = true
    void (async () => {
      const [r, n] = await Promise.allSettled([api.listCases(companyId), api.notifications(companyId)])
      if (!live) return
      if (r.status === 'fulfilled') {
        setLegacy(false)
        setRows({ for: companyId, rows: arr(r.value).filter((x) => x && typeof x.id === 'string') })
        setRowsError(null)
      } else if (isUnavailable(r.reason)) {
        // an older server: demo-1 is the only file
        setLegacy(true)
        try {
          const cv = await api.getClientView('demo-1')
          if (!live) return
          setRows({ for: companyId, rows: companyId === 'aurora' ? [legacyRow(cv)] : [] })
          setRowsError(null)
        } catch (e) {
          if (live) setRowsError(api.failureText(e))
        }
      } else {
        setRowsError(api.failureText(r.reason))
      }
      if (n.status === 'fulfilled') setNotes({ for: companyId, notes: arr(n.value).filter((x) => x && typeof x.case_id === 'string') })
      else if (isUnavailable(n.reason)) setNotes({ for: companyId, notes: null })
    })()
    return () => { live = false }
  }, [companyId, tick])

  const shown = rows && rows.for === companyId ? rows.rows : null

  /* the files that need the client: their exact pending counts, for the "Please send us 2 documents" line */
  useEffect(() => {
    if (!shown) return
    let live = true
    const need = shown.filter((r) => rowNeeds(r) > 0).slice(0, NEXT_MAX)
    void Promise.allSettled(need.map((r) => api.getClientView(r.id))).then((res) => {
      if (!live) return
      setNext((prev) => {
        const out: Record<string, NextInfo> = {}
        need.forEach((r, i) => {
          const x = res[i]
          if (x.status === 'fulfilled') {
            out[r.id] = { state: portalState(x.value), missing: arr(x.value.missing_documents).length, confirmations: arr(x.value.confirmations).length }
          } else if (prev[r.id]) out[r.id] = prev[r.id]
        })
        return out
      })
    })
    return () => { live = false }
  }, [shown])

  return {
    companies, templates,
    rows: shown,
    rowsError: shown ? null : rowsError,
    legacy,
    notes: notes && notes.for === companyId ? notes.notes : undefined,
    next, tick, refetch,
  }
}
