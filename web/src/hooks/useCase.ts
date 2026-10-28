import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { ApiError } from '@/lib/api'
import type { Bundle } from '@/lib/types'

/** Turns an API failure into a sentence in the interface's voice. */
export function failureText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'The server cannot be reached. Check that the backend is running.'
    if (e.status === 409) return `That was already done: ${e.message}.`
    if (e.status === 422) return `The server refused this: ${e.message}.`
    return `Something went wrong (${e.message}).`
  }
  return 'Something went wrong.'
}

/**
 * Holds the case bundle. `act` runs one request at a time: while one is in flight, further calls are ignored
 * and `busy` is true. Every POST returns a Bundle, which replaces the whole state.
 */
export function useCase(caseId = 'demo-1') {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)

  const act = useCallback(async (label: string, fn: () => Promise<Bundle>, success?: string | ((b: Bundle) => string | null)) => {
    if (lock.current) return null
    lock.current = true
    setBusy(label)
    try {
      const b = await fn()
      setBundle(b)
      setError(null)
      const msg = typeof success === 'function' ? success(b) : success
      if (msg) toast(msg)
      return b
    } catch (e) {
      toast.error(failureText(e))
      return null
    } finally {
      lock.current = false
      setBusy(null)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const b = await api.getBundle(caseId)
      setBundle(b)
      setError(null)
    } catch (e) {
      // A fresh server may not know the case yet: create the demo case once.
      if (e instanceof ApiError && e.status === 404 && caseId === 'demo-1') {
        try { setBundle(await api.reset()); setError(null); return } catch (e2) { setError(failureText(e2)); return }
      }
      setError(failureText(e))
    }
  }, [caseId])

  /** Quiet refresh (after a chat turn appended to the ledger); skipped while an action runs. */
  const refresh = useCallback(async () => {
    if (lock.current) return
    try { setBundle(await api.getBundle(caseId)) } catch { /* keep the current bundle */ }
  }, [caseId])

  useEffect(() => { void load() }, [load])

  return { bundle, busy, error, act, load, refresh, caseId }
}
