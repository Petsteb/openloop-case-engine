import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import { isUnavailable } from './api'
import type { ClientDocument, ClientView } from './types'

const POLL_MS = 2500
const FALLBACK_MS = 5000

/**
 * Holds the client view and the client's documents, and keeps them live:
 * - polls GET /version every 2.5 s and refetches only when `length` changed;
 * - pauses while a request from this tab is in flight (`track`);
 * - falls back to refetching every 5 s when /version is not available.
 * A mutation that returns a client view replaces the state at once, and a poll that started before it is discarded.
 */
export function useClientView(caseId = 'demo-1') {
  const [view, setView] = useState<ClientView | null>(null)
  const [docs, setDocs] = useState<ClientDocument[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef(0)
  const epoch = useRef(0)            // bumped by every mutation; stale poll results are dropped
  const lastLen = useRef<number | null>(null)
  const versionOk = useRef<boolean | null>(null)
  const docsOk = useRef<boolean | null>(null)

  const loadDocs = useCallback(async (cv: ClientView | null): Promise<ClientDocument[] | null> => {
    if (cv && Array.isArray(cv.documents)) return cv.documents
    if (docsOk.current === false) return null
    try {
      const d = await api.getDocuments(caseId)
      docsOk.current = true
      return Array.isArray(d) ? d : null
    } catch (e) {
      if (isUnavailable(e)) docsOk.current = false
      return null
    }
  }, [caseId])

  /** Full refetch. Returns false when the client view could not be loaded. */
  const refresh = useCallback(async (): Promise<boolean> => {
    const at = epoch.current
    try {
      const cv = await api.getClientView(caseId)
      const d = await loadDocs(cv)
      if (at !== epoch.current) return true   // a mutation answered meanwhile; its state is newer
      setView(cv)
      setDocs(d)
      setError(null)
      return true
    } catch (e) {
      if (at === epoch.current) setError(api.failureText(e))
      return false
    }
  }, [caseId, loadDocs])

  /** Marks a request as in flight so polling pauses until it settles. */
  const track = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    inflight.current += 1
    try { return await p } finally { inflight.current -= 1 }
  }, [])

  /** Runs a POST that answers with a client view and applies it. Throws on failure (the caller words the toast). */
  const mutate = useCallback(async (fn: () => Promise<ClientView>): Promise<{ view: ClientView; docs: ClientDocument[] | null }> => {
    inflight.current += 1
    epoch.current += 1
    try {
      const cv = await fn()
      const d = await loadDocs(cv)
      epoch.current += 1
      setView(cv)
      setDocs(d)
      setError(null)
      return { view: cv, docs: d }
    } finally {
      inflight.current -= 1
    }
  }, [loadDocs])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      let delay = POLL_MS
      if (inflight.current === 0) {
        if (versionOk.current !== false) {
          try {
            const v = await api.getVersion(caseId)
            versionOk.current = true
            if (v.length !== lastLen.current && (await refresh())) lastLen.current = v.length
          } catch (e) {
            if (isUnavailable(e)) versionOk.current = false
            else if (lastLen.current === null) await refresh()   // first load: surface the real error
          }
        }
        if (versionOk.current === false) {
          delay = FALLBACK_MS
          await refresh()
        }
      }
      if (!stopped) timer = setTimeout(tick, delay)
    }
    void tick()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [caseId, refresh])

  return { view, docs, error, refresh, track, mutate, caseId }
}
