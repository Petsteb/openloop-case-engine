/* The work queue and the bell share one poller: `GET /api/version` every 3 s, and `/api/cases` + `/api/notifications`
   are refetched only when it changes. It runs while any screen subscribes and pauses while the tab is hidden. */
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { isUnavailable } from '@/lib/api'
import { failureText } from '@/hooks/useCase'
import * as homeApi from './api'
import { rowFromBundle } from './queue-derive'
import { SEEN_EVENT, clearSeen, seenSignature } from './seen'
import type { CaseRow, Note } from './types'

const POLL_MS = 3000
/** Servers without `/api/version`: refetch this often instead. */
const FALLBACK_MS = 5000
/** How long to wait before asking a server without `/api/version` again. */
const VERSION_RETRY_MS = 30000

export interface QueueState {
  /** null until the first answer. */
  rows: CaseRow[] | null
  /** True when the server has no `/api/cases` and the list is demo-1 alone, built from its bundle. */
  fallback: boolean
  /** null when the server has no notifications endpoint (the bell then shows no count). */
  notes: Note[] | null
  /** The last load failure, in the interface's voice; cleared by the next good answer. */
  error: string | null
  /** Bumped when any seen value changes, so unread dots and the bell count re-render. */
  seenRev: number
}

let state: QueueState = { rows: null, fallback: false, notes: null, error: null, seenRev: 0 }
const listeners = new Set<() => void>()
const set = (p: Partial<QueueState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()) }

let chain = 0
let timer: number | undefined
let lastKey = ''
let versionDownUntil = 0
let sig = ''
/** True while "Reset all demo cases" runs: the database is wiped and reseeded, so a list read then would be partial. */
let paused = false

/** Loads the list and the notifications. The answer is dropped if a newer chain started meanwhile (a slow, stale
 *  answer must never overwrite a fresh one). Returns whether it was applied. */
async function refetch(my: number): Promise<boolean> {
  const [cases, notes] = await Promise.allSettled([homeApi.getCases(), homeApi.getNotes()])
  const p: Partial<QueueState> = {}
  let demo: CaseRow | null = null
  if (cases.status === 'rejected' && isUnavailable(cases.reason)) {
    try { demo = rowFromBundle(await homeApi.getDemoBundle()) } catch (e) { p.error = failureText(e) }
  }
  if (my !== chain || paused) return false
  if (cases.status === 'fulfilled') {
    p.rows = Array.isArray(cases.value) ? cases.value : []
    p.fallback = false
    p.error = null
  } else if (isUnavailable(cases.reason)) {
    if (demo) { p.rows = [demo]; p.fallback = true; p.error = null }
  } else {
    p.error = failureText(cases.reason)
  }
  if (notes.status === 'fulfilled') p.notes = Array.isArray(notes.value) ? notes.value : []
  else if (isUnavailable(notes.reason)) p.notes = null
  set(p)
  return true
}

function checkSeen() {
  const s = seenSignature()
  if (s !== sig) { sig = s; set({ seenRev: state.seenRev + 1 }) }
}

async function tick(my: number) {
  let delay = POLL_MS
  try {
    if (document.visibilityState === 'hidden' || paused) return
    checkSeen()
    let refresh = false
    let key = ''
    if (Date.now() >= versionDownUntil) {
      try {
        const v = await homeApi.getGlobalVersion()
        key = `${v?.cases}:${v?.events}`
        refresh = key !== lastKey
      } catch (e) {
        if (my !== chain) return
        if (!isUnavailable(e)) { if (state.rows === null) await refetch(my); return } // unreachable: show why, retry next tick
        versionDownUntil = Date.now() + VERSION_RETRY_MS
      }
    }
    // a chain that was replaced meanwhile (StrictMode remount, tab shown again) must not consume the change
    if (my !== chain) return
    if (Date.now() < versionDownUntil) { delay = FALLBACK_MS; refresh = true }
    if (refresh) {
      // remembered only after a good, current answer, so a failed or dropped list is asked for again on the next tick
      if (await refetch(my) && key && !state.error) lastKey = key
    }
  } catch { /* quiet: the next tick tries again */ } finally {
    if (my === chain && listeners.size) timer = window.setTimeout(() => void tick(my), delay)
  }
}

/** Starts a fresh timeout chain (an older one stops at its next step). */
function kick() {
  window.clearTimeout(timer)
  const my = ++chain
  void tick(my)
}

const onVisible = () => { if (document.visibilityState === 'visible' && listeners.size) kick() }
const onSeen = () => checkSeen()

function subscribe(l: () => void) {
  listeners.add(l)
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(SEEN_EVENT, onSeen)
    window.addEventListener('storage', onSeen)
    kick()
  }
  return () => {
    listeners.delete(l)
    if (!listeners.size) {
      chain++
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(SEEN_EVENT, onSeen)
      window.removeEventListener('storage', onSeen)
    }
  }
}

const getSnapshot = () => state

/** Forget the last version and ask again now (after creating a case or reseeding the demo). */
export function invalidateQueue() {
  lastKey = ''
  if (listeners.size) kick()
}

export function useQueue(): QueueState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** "Reset all demo cases": wipe and reseed every synthetic file, then forget every seen value (seqs restart and new ids
 *  like case-9 get reused, so old values would hide new items). The caller has already left the case screen. */
export async function resetAllDemo() {
  paused = true
  chain++ // drop any list request already in flight
  // the reseed takes a few seconds; one toast says so and is then replaced by the outcome
  const id = toast('Reseeding every demo case…', { duration: 60000 })
  try {
    await homeApi.resetAll()
    clearSeen()
    toast('Every demo case was reseeded.', { id, duration: 4000 })
  } catch (e) {
    toast.error(failureText(e), { id, duration: 6000 })
  } finally {
    paused = false
    invalidateQueue()
  }
}
