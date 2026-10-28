import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import { isUnavailable } from './api'
import type { ClientDocument, ClientView } from './types'

const POLL_MS = 2500
const FALLBACK_MS = 5000
const VERSION_RETRY_MS = 30_000

const maxSeq = (v: ClientView | null) =>
  (v && Array.isArray(v.timeline) ? v.timeline.reduce((m, e) => Math.max(m, Number(e?.seq) || 0), 0) : 0)

/**
 * Holds the client view and the client's documents, and keeps them live:
 * - polls GET /version every 2.5 s and refetches only when `length` changed;
 * - pauses while a request from this tab is in flight (`track`);
 * - falls back to refetching every 5 s when /version is not available, and asks for /version again every 30 s.
 * A mutation that returns a client view replaces the state at once, and a poll that started before it is discarded.
 * `gen` goes up when the ledger got shorter (a demo reset from the bank screen): the page remounts with clean state.
 */
export function useClientView(caseId = 'demo-1') {
  const [view, setView] = useState<ClientView | null>(null)
  const [docs, setDocs] = useState<ClientDocument[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gen, setGen] = useState(0)
  const inflight = useRef(0)
  const epoch = useRef(0)            // bumped by every mutation; stale poll results are dropped
  const lastLen = useRef<number | null>(null)
  const lastSeq = useRef(0)          // newest timeline seq on screen: a smaller one after a refetch means a reset
  const resetSeen = useRef(false)    // the poll saw the ledger get shorter; the next applied view remounts the page
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

  const apply = useCallback((cv: ClientView, d: ClientDocument[] | null) => {
    const s = maxSeq(cv)
    // a shorter ledger (seen by the poll) or an older newest event (servers without /version): remount with the new view
    if (resetSeen.current || s < lastSeq.current) setGen((g) => g + 1)
    resetSeen.current = false
    lastSeq.current = s
    setView(cv)
    setDocs(d)
    setError(null)
  }, [])

  /** Full refetch. Returns false when the client view could not be loaded or a newer mutation answered meanwhile
   *  (so the poll does not record the new ledger length as seen). */
  const refresh = useCallback(async (): Promise<boolean> => {
    const at = epoch.current
    try {
      const cv = await api.getClientView(caseId)
      const d = await loadDocs(cv)
      if (at !== epoch.current) return false   // a mutation answered meanwhile; its state is newer
      apply(cv, d)
      return true
    } catch (e) {
      if (at === epoch.current) setError(api.failureText(e))
      return false
    }
  }, [caseId, loadDocs, apply])

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
      apply(cv, d)
      return { view: cv, docs: d }
    } catch (e) {
      lastLen.current = null   // a poll may have been dropped for this request: refetch on the next tick
      throw e
    } finally {
      inflight.current -= 1
    }
  }, [loadDocs, apply])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      let delay = POLL_MS
      try {
        if (inflight.current === 0) {
          if (versionOk.current !== false) {
            try {
              const v = await api.getVersion(caseId)
              versionOk.current = true
              if (lastLen.current !== null && v.length < lastLen.current) resetSeen.current = true   // demo reset
              if (v.length !== lastLen.current) {
                if (await refresh()) lastLen.current = v.length
              } else setError(null)   // reachable again, and the view on screen matches this length
            } catch (e) {
              if (isUnavailable(e)) {
                versionOk.current = false
                retry = setTimeout(() => { versionOk.current = null }, VERSION_RETRY_MS)
              } else if (lastLen.current === null) await refresh()   // first load: surface the real error
              else setError(api.failureText(e))
            }
          }
          if (versionOk.current === false) {
            delay = FALLBACK_MS
            await refresh()
          }
        }
      } finally {
        if (!stopped) timer = setTimeout(tick, delay)
      }
    }
    void tick()
    return () => { stopped = true; if (timer) clearTimeout(timer); if (retry) clearTimeout(retry) }
  }, [caseId, refresh])

  return { view, docs, error, refresh, track, mutate, caseId, gen }
}
