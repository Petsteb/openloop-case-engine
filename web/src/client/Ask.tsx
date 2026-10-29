import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import * as api from './api'
import { isUnavailable } from './api'
import { Icon } from './Icon'
import { arr, safe } from './derive'
import type { ChatHistoryItem, Citation } from './types'

/* Adapted from the bank screen's ChatPanel: the role is fixed to "client", and citations open things on this page. */
const SUGGESTED = ['What do you still need from me?', 'What happened so far?', 'Why isn’t my case finished?']
const LEAK_FALLBACK = 'I can’t share that here. A bank officer can tell you more.'

interface Msg { id: number; who: 'me' | 'ai'; text: string; citations?: Citation[]; error?: boolean }

const refOf = (c: Citation) => {
  const r = String(c.ref).replace(/^#/, '')
  return c.kind === 'event' ? `#${r}` : r
}

/** Splits an answer on [#42] / [doc-3] markers and turns the ones that point at something on this page into chips. */
function renderAnswer(text: string, cites: Citation[], known: { seqs: Set<number>; docs: Set<string> }, onCite: (c: Citation) => void): ReactNode[] {
  const valid = new Map(cites.map((c) => [refOf(c), c]))
  return text.split(/(\[(?:#\d+|doc-\d+)\])/g).map((part, i) => {
    const m = /^\[(#\d+|doc-\d+)\]$/.exec(part)
    if (!m) return part
    const ref = m[1]
    let c = valid.get(ref)
    if (!c) {
      if (ref.startsWith('#') && known.seqs.has(Number(ref.slice(1)))) c = { kind: 'event', ref: ref.slice(1) }
      else if (known.docs.has(ref)) c = { kind: 'doc', ref }
    }
    if (!c) return null
    const cc = c
    const label = cc.label ? safe(cc.label, '') : ''
    return (
      <button key={i} type="button" className="pt-cite" onClick={() => onCite(cc)} title={label || undefined}
        aria-label={label ? `Show ${ref}: ${label}` : `Show ${ref}`}>{ref}</button>
    )
  })
}

interface Props {
  caseId: string
  known: { seqs: Set<number>; docs: Set<string> }
  track: <T>(p: Promise<T>) => Promise<T>
  onCite: (c: Citation) => void
}

export function Ask({ caseId, known, track, onCite }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const nextId = useRef(1)
  // scroll only the message list, never the page
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, pending])

  const ask = async (q: string) => {
    const message = q.trim().slice(0, 1000)
    if (!message || pending) return
    const history: ChatHistoryItem[] = msgs.filter((m) => !m.error).map((m) => ({ role: m.who === 'me' ? 'user' : 'assistant', content: m.text }))
    setMsgs((m) => [...m, { id: nextId.current++, who: 'me', text: message }])
    setDraft('')
    setPending(true)
    try {
      const r = await track(api.chat(caseId, message, history))
      setMsgs((m) => [...m, { id: nextId.current++, who: 'ai', text: safe(String(r.answer ?? ''), LEAK_FALLBACK), citations: arr(r.citations) }])
    } catch (e) {
      if (isUnavailable(e)) setUnavailable(true)
      else setMsgs((m) => [...m, { id: nextId.current++, who: 'ai', text: api.failureText(e), error: true }])
    } finally {
      setPending(false)
    }
  }
  const send = (e: FormEvent) => { e.preventDefault(); void ask(draft) }
  const asked = new Set(msgs.filter((m) => m.who === 'me').map((m) => m.text))
  const left = SUGGESTED.filter((q) => !asked.has(q))

  if (unavailable) return <p className="pt-empty" role="status">Questions are not available on this server yet.</p>

  return (
    <div className="pt-chat">
      {msgs.length || pending ? (
        <div className="pt-msgs" aria-live="polite" ref={listRef}>
          {msgs.map((m) => (
            <div key={m.id} className={`pt-msg ${m.who}${m.error ? ' is-error' : ''}`}>
              {m.who === 'ai' && !m.error ? renderAnswer(m.text, m.citations ?? [], known, onCite) : m.text}
            </div>
          ))}
          {pending ? <div className="pt-msg ai pt-typing" role="status"><span className="sr-only">Answering…</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div> : null}
        </div>
      ) : (
        <p className="pt-chat-intro">Ask anything about your case. Answers use only what the bank has on your case, and point to where it came from.</p>
      )}
      {left.length ? (
        <div className="pt-suggest" aria-label="Suggested questions">
          {left.map((q) => <button key={q} type="button" onClick={() => void ask(q)} disabled={pending}>{q}</button>)}
        </div>
      ) : null}
      <form className="pt-ask" onSubmit={send}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about your case" aria-label="Ask about your case" maxLength={1000} />
        <button type="submit" className="btn icon-only pt-send" aria-label="Send" disabled={pending || !draft.trim()}>
          {pending ? <Icon name="spinner" size={14} className="spin" /> : <Icon name="send" size={14} />}
        </button>
      </form>
    </div>
  )
}
