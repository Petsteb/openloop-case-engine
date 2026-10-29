import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { isUnavailable, seenKey } from './api'
import { Composer } from './Composer'
import { refKey, splitRefs } from './refs'
import { TIcon } from './TIcon'
import type { Mentionables, PostRef, ThreadItem, ThreadRef, ThreadRole } from './types'

export interface ThreadProps {
  caseId: string
  role: ThreadRole
  /** employee messages only; the server defaults to "Bank team" */
  author?: string
  onOpenDoc?: (id: string) => void
  onOpenEvent?: (seq: number) => void
  /** false while the thread is mounted but off screen (a hidden tab): it keeps polling but marks nothing as seen */
  active?: boolean
  /** called with the list the server returned after this viewer posted */
  onPosted?: (items: ThreadItem[]) => void
  className?: string
}

const POLL_MS = 2500
const FALLBACK_MS = 5000
const arr = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])
const maxSeq = (items: ThreadItem[]) => items.reduce((m, i) => (Number(i.seq) > m ? Number(i.seq) : m), 0)

function when(it: ThreadItem): string {
  const t = /T(\d{2}:\d{2})/.exec(String(it.sim_time ?? ''))?.[1] ?? ''
  return typeof it.day === 'number' ? `Day ${it.day}${t ? ` ${t}` : ''}` : t
}

/** The per-case conversation between the client and the bank, with the bank's automatic emails in the same list.
 *  Remounts per case and role, so nothing (draft, scroll, open emails) leaks from one case to another. */
export function Thread(p: ThreadProps) {
  return <ThreadView key={`${p.caseId}:${p.role}`} {...p} />
}

function ThreadView({ caseId, role, author, onOpenDoc, onOpenEvent, active = true, onPosted, className = '' }: ThreadProps) {
  const [items, setItems] = useState<ThreadItem[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [sending, setSending] = useState(false)
  const [ments, setMents] = useState<Mentionables | null>(null)
  const [mentsLoading, setMentsLoading] = useState(false)
  const [pill, setPill] = useState(false)

  const alive = useRef(true)
  const gen = useRef(0)                       // a list answer older than the newest request is dropped
  const lastLen = useRef<number | null | undefined>(undefined)
  const mentLen = useRef<number | null | undefined>(undefined)
  const mentBusy = useRef(false)
  const sendingRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLOListElement | null>(null)
  const atBottom = useRef(true)
  const forceBottom = useRef(false)
  const prevMax = useRef<number | null>(null)

  const load = useCallback(async () => {
    const g = ++gen.current
    try {
      const list = await api.getMessages(caseId, role)
      if (!alive.current || g !== gen.current) return
      setItems(arr(list))
      setStatus('ready')
    } catch (e) {
      if (!alive.current || g !== gen.current) return
      if (isUnavailable(e)) setStatus('unavailable')
      else setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [caseId, role])

  /* ---------- seen: the newest seq on screen, for the bell (openloop-seen:<role>:<caseId>) ---------- */
  const markSeen = useCallback(() => {
    if (!items?.length || !active || document.visibilityState !== 'visible') return
    const el = listRef.current
    if (!el || el.getClientRects().length === 0) return
    const max = maxSeq(items)
    const key = seenKey(role, caseId)
    try {
      const prev = Number(window.localStorage.getItem(key))
      const len = lastLen.current
      // a reset shortens the ledger: a stored seq past its end is stale
      if (Number.isFinite(prev) && prev >= max && !(typeof len === 'number' && prev > len)) return
      window.localStorage.setItem(key, String(max))
      window.dispatchEvent(new CustomEvent('openloop-seen', { detail: { role, caseId, seq: max } }))
    } catch { /* storage unavailable */ }
  }, [items, active, role, caseId])
  const markSeenRef = useRef(markSeen)
  useEffect(() => { markSeenRef.current = markSeen; markSeen() }, [markSeen])

  /* ---------- live: poll the case version, refetch the thread when the ledger changed ---------- */
  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const tick = async () => {
      let delay = POLL_MS
      if (document.visibilityState === 'visible' && !sendingRef.current) {
        try {
          const v = await api.getVersion(caseId)
          const len = typeof v?.length === 'number' ? v.length : null
          if (len !== lastLen.current) { lastLen.current = len; await load() }
        } catch (e) {
          delay = FALLBACK_MS
          if (isUnavailable(e)) await load()
          else setStatus((s) => (s === 'loading' ? 'error' : s))
        }
        markSeenRef.current()
      }
      if (!stopped) timer = setTimeout(() => void tick(), delay)
    }
    void tick()
    const onVis = () => { if (document.visibilityState === 'visible') markSeenRef.current() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; alive.current = false; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [caseId, load])

  /* ---------- scroll: only the list's own scrollTop, never scrollIntoView (that moves the whole page) ---------- */
  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const at = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    atBottom.current = at
    if (at) setPill(false)
  }
  const toBottom = () => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    atBottom.current = true
    setPill(false)
  }
  useLayoutEffect(() => {
    if (!items) return
    const max = maxSeq(items)
    if (forceBottom.current || atBottom.current) { forceBottom.current = false; toBottom() }
    else if (prevMax.current !== null && max > prevMax.current) setPill(true)
    prevMax.current = max
  }, [items])
  // pinned to the bottom while the list grows, an email opens, or a hidden tab is shown again
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (atBottom.current) el.scrollTop = el.scrollHeight })
    ro.observe(el)
    if (contentRef.current) ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [status, items === null]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- mentionables for @ / #, refetched when the ledger moved since the last fetch ---------- */
  const mentsRef = useRef<Mentionables | null>(null)
  const needMentions = useCallback(() => {
    if (mentBusy.current || (mentsRef.current && mentLen.current === lastLen.current)) return
    mentBusy.current = true
    setMentsLoading(true)
    const len = lastLen.current
    api.getMentionables(caseId, role)
      .then((m) => {
        if (!alive.current) return
        const v = m && typeof m === 'object' ? m : {}
        mentsRef.current = v
        mentLen.current = len
        setMents(v)
      })
      .catch(() => {
        if (!alive.current || mentsRef.current) return
        mentsRef.current = { people: [], docs: [], events: [] }
        setMents(mentsRef.current)
      })
      .finally(() => { mentBusy.current = false; if (alive.current) setMentsLoading(false) })
  }, [caseId, role])

  /* ---------- send ---------- */
  const send = useCallback(async (text: string, refs: PostRef[]): Promise<boolean> => {
    if (sendingRef.current) return false
    sendingRef.current = true
    setSending(true)
    ++gen.current
    try {
      const list = await api.postMessage(caseId, { role, ...(role === 'employee' && author ? { author } : {}), text, refs })
      if (alive.current) {
        ++gen.current
        forceBottom.current = true
        setItems(arr(list))
        setStatus('ready')
        onPosted?.(arr(list))
      }
      return true
    } catch (e) {
      // the client never sees server wording; the bank sees the reason
      if (role === 'client') toast.error('Your message was not sent. Please try again.')
      else toast.error(`Message not sent: ${e instanceof Error ? e.message : 'please try again'}`)
      return false
    } finally {
      sendingRef.current = false
      if (alive.current) setSending(false)
    }
  }, [caseId, role, author, onPosted])

  const client = role === 'client'
  if (status === 'unavailable') {
    return <div className={`thr is-${role} ${className}`.trim()}><p className="thr-empty" role="status">Messages are not available on this server yet.</p></div>
  }
  const list = items ?? []
  return (
    <div className={`thr is-${role} ${className}`.trim()}>
      <div className="thr-listwrap">
        <div ref={listRef} className="thr-list" role="log" aria-label="Messages" aria-live="polite" tabIndex={0} onScroll={onScroll}>
          {status === 'loading' && !items ? <p className="thr-empty" role="status"><TIcon name="spinner" className="thr-spin" />Loading messages…</p>
            : status === 'error' && !items ? <p className="thr-empty" role="status">Messages can’t be loaded right now. This updates when the connection is back.</p>
              : !list.length ? (
                <p className="thr-empty">{client
                  ? 'No messages yet. Ask the bank a question or tell them about a change.'
                  : 'No messages yet. Write to the client here; their replies and the bank’s automatic emails appear in this thread.'}</p>
              ) : null}
          <ol ref={contentRef} className="thr-items">
            {list.map((it) => (
              <li key={it.seq}>
                {it.kind === 'email'
                  ? <EmailRow it={it} role={role} />
                  : <MessageRow it={it} role={role} onOpenDoc={onOpenDoc} onOpenEvent={onOpenEvent} />}
              </li>
            ))}
          </ol>
        </div>
        {pill ? (
          <button type="button" className="thr-pill" onClick={toBottom}>New messages<TIcon name="down" size={13} /></button>
        ) : null}
      </div>
      <Composer
        role={role}
        mentionables={ments}
        loadingMentions={mentsLoading}
        onNeedMentions={needMentions}
        sending={sending}
        onSend={send}
        label={client ? 'Message to the bank' : 'Message to the client'}
        placeholder={client ? 'Write to the bank' : 'Write to the client'}
        hint={client ? 'Type @ to mention a person or # for one of your documents.' : 'The client sees this thread. @ people, # documents and events.'}
      />
    </div>
  )
}

/* ---------- rows ---------- */
function who(it: ThreadItem, role: ThreadRole): { name: string; tag: string } {
  const a = it.author ?? { role: 'bank' }
  const name = String(a.name ?? '').trim()
  if (a.role === 'client') return role === 'client' ? { name: 'You', tag: '' } : { name: name || 'Client', tag: 'Client' }
  if (a.role === 'employee') return { name: name || 'Bank team', tag: 'Bank' }
  return { name: 'The bank', tag: '' }
}

function EmailRow({ it, role }: { it: ThreadItem; role: ThreadRole }) {
  const [open, setOpen] = useState(false)
  const bodyId = `thr-mail-${it.seq}`
  const failed = it.status === 'failed'
  return (
    <article className={'thr-mail' + (failed ? ' is-failed' : '')}>
      <button type="button" className="thr-mail-head" aria-expanded={open} aria-controls={open ? bodyId : undefined} onClick={() => setOpen((v) => !v)}>
        <TIcon name="chevron" size={13} className="thr-chev" />
        <span className="thr-tag">Email</span>
        {/* subject and body are the client's Romanian email, shown verbatim */}
        <span className="thr-mail-subj">
          {failed ? <span className="thr-tag is-failed">Failed</span> : null}
          <span lang="ro">{String(it.subject || it.text || '').trim() || '(fără subiect)'}</span>
        </span>
        <time className="thr-when" dateTime={it.sim_time ?? undefined}>{when(it)}</time>
      </button>
      {open ? (
        <div id={bodyId} className="thr-mail-body">
          {failed ? <p className="thr-mail-err">{String(it.error || '').trim() || 'The email could not be sent.'}</p> : null}
          <div lang="ro">{String(it.body || it.text || '').trim() || 'This email has no text.'}</div>
          <p className="thr-mail-from">{role === 'client' ? 'Automatic email from the bank' : 'Automatic email to the client'}</p>
        </div>
      ) : null}
    </article>
  )
}

interface RowProps { it: ThreadItem; role: ThreadRole; onOpenDoc?: (id: string) => void; onOpenEvent?: (seq: number) => void }

function MessageRow({ it, role, onOpenDoc, onOpenEvent }: RowProps) {
  const w = who(it, role)
  const side = it.author?.role === 'client' ? 'client' : 'bank'
  const mine = (role === 'client') === (side === 'client')
  const refs = arr(it.refs).filter((r) => r && r.id !== undefined && r.id !== null && r.id !== '')
  const { parts, rest } = splitRefs(String(it.text ?? ''), refs)
  const client = role === 'client'
  // on the portal, inline refs are text and documents get a full-size button row underneath (44px touch targets)
  const docButtons = client && onOpenDoc ? dedupe(refs.filter((r) => r.kind === 'doc')) : []
  const trailing = client ? rest.filter((r) => !(onOpenDoc && r.kind === 'doc')) : rest
  return (
    <article className={`thr-msg is-${side}${mine ? ' is-mine' : ''}`}>
      <header className="thr-meta">
        <span className="thr-who">{w.name}</span>
        {w.tag ? <span className="thr-role">{w.tag}</span> : null}
        <time className="thr-when" dateTime={it.sim_time ?? undefined}>{when(it)}</time>
      </header>
      <p className="thr-text">
        {parts.map((pt, i) => (pt.t === 'text' ? pt.text : <RefChip key={i} r={pt.ref} role={role} onOpenDoc={onOpenDoc} onOpenEvent={onOpenEvent} />))}
      </p>
      {trailing.length || docButtons.length ? (
        <div className="thr-refrow">
          {trailing.map((r) => <RefChip key={refKey(r)} r={r} role={role} onOpenDoc={onOpenDoc} onOpenEvent={onOpenEvent} />)}
          {docButtons.map((r) => (
            <button key={refKey(r)} type="button" className="thr-docbtn" onClick={() => onOpenDoc?.(String(r.id))}>
              <TIcon name="doc" size={15} /><span>{String(r.label || 'Document')}</span>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

const dedupe = (rs: ThreadRef[]) => { const s = new Set<string>(); return rs.filter((r) => { const k = refKey(r); if (s.has(k)) return false; s.add(k); return true }) }

function RefChip({ r, role, onOpenDoc, onOpenEvent }: { r: ThreadRef; role: ThreadRole; onOpenDoc?: (id: string) => void; onOpenEvent?: (seq: number) => void }) {
  const id = String(r.id).replace(/^#/, '')
  const label = String(r.label ?? '').trim()
  if (r.kind === 'person') return <span className="thr-person">@{label || id}</span>
  const client = role === 'client'
  let code = ''
  let onClick: (() => void) | undefined
  if (r.kind === 'doc') {
    code = id
    if (onOpenDoc && !client) onClick = () => onOpenDoc(id)
  } else if (r.kind === 'event') {
    code = `#${id}`
    const seq = Number(id)
    if (onOpenEvent && Number.isFinite(seq)) onClick = () => onOpenEvent(seq)
  } else return <span>{label || id}</span>
  // the client sees the plain label (no internal ids); the bank sees the mono id first
  const inner: ReactNode = client
    ? <span className="thr-ref-label">{label || (r.kind === 'doc' ? 'Document' : 'Update on your file')}</span>
    : <><span className="thr-ref-code">{code}</span>{label ? <span className="thr-ref-label">{label}</span> : null}</>
  const title = client ? undefined : label ? `${code}: ${label}` : code
  if (onClick) {
    return (
      <button type="button" className={`thr-ref is-${r.kind}`} onClick={onClick} title={title}
        aria-label={r.kind === 'doc' ? `Open document ${code}${label ? `, ${label}` : ''}` : `Open ledger event ${code}${label ? `, ${label}` : ''}`}>
        {inner}
      </button>
    )
  }
  return <span className={`thr-ref is-${r.kind} is-static`} title={title}>{inner}</span>
}
