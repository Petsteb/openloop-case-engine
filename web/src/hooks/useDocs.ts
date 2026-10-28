import { useEffect, useState } from 'react'
import * as api from '@/lib/api'
import { isUnavailable } from '@/lib/api'
import type { Bundle, DocDetail, DocListItem } from '@/lib/types'

/** `?mock` on the dev server adds fixture documents (see lib/mock-docs.ts). Always false in production builds. */
const isMock = () => {
  try { return new URLSearchParams(window.location.search).has('mock') } catch { return false }
}

const evCount = (b: Bundle | null) => (Array.isArray(b?.events) ? b.events.length : 0)

/**
 * The Docs tab list from `GET /documents?role=employee`, refetched whenever the ledger grows.
 * `null` means "build it from the bundle": the server has no such endpoint (404/405/501).
 * Lives in App (not in the tab) so opening the tab never flips from derived to server statuses.
 */
export function useDocList(caseId: string, bundle: Bundle | null): DocListItem[] | null {
  const [list, setList] = useState<DocListItem[] | null>(null)
  const n = evCount(bundle)
  const ready = bundle !== null
  useEffect(() => {
    if (!ready) return undefined
    let live = true
    void (async () => {
      let items: DocListItem[] | null
      try {
        const r = await api.getDocuments(caseId)
        items = Array.isArray(r) ? r : null
      } catch (e) {
        if (!isUnavailable(e)) return // a passing failure: keep what is on screen
        items = null
      }
      if (import.meta.env.DEV && isMock()) items = (await import('@/lib/mock-docs')).mockList(items)
      if (live) setList(items)
    })()
    return () => { live = false }
  }, [caseId, n, ready])
  return list
}

/**
 * One document from `GET /documents/{id}?role=employee`, refetched when the ledger grows.
 * `loading` is true only until the first answer for this id; later refetches keep the previous answer on screen.
 * `detail` null after loading means: use the bundle fallback (no endpoint, unknown id or a failure).
 */
export function useDocDetail(caseId: string, docId: string | null, bundle: Bundle): { detail: DocDetail | null; loading: boolean } {
  const [res, setRes] = useState<{ id: string; detail: DocDetail | null } | null>(null)
  const n = evCount(bundle)
  useEffect(() => {
    if (!docId) return undefined
    let live = true
    void (async () => {
      let d: DocDetail | null = null
      let keep = false
      try {
        d = await api.getDocument(caseId, docId)
      } catch (e) {
        // 404 for an unknown id or a missing endpoint both fall back to the bundle; other failures keep what is shown
        keep = !isUnavailable(e)
      }
      if (import.meta.env.DEV && isMock()) d = (await import('@/lib/mock-docs')).mockDocument(docId, d)
      if (!live) return
      setRes((prev) => (keep && !d && prev?.id === docId ? prev : { id: docId, detail: d && typeof d === 'object' ? d : null }))
    })()
    return () => { live = false }
  }, [caseId, docId, n])
  // while the sheet closes (docId null) the last answer stays, so the content does not change as it slides out
  const mine = res && res.id === (docId ?? res.id) ? res : null
  return { detail: mine?.detail ?? null, loading: !!docId && !mine }
}
