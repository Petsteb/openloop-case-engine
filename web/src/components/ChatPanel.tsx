import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import * as api from '@/lib/api'
import { isUnavailable } from '@/lib/api'
import type { Bundle, ChatHistoryItem, ChatRole, Citation } from '@/lib/types'
import { arr, chatSuggestions } from '@/lib/derive'
import { failureText } from '@/hooks/useCase'
import { Icon } from './Icon'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

/** The client's questions are the same on every file; the bank's come from this case (derive.ts chatSuggestions). */
const CLIENT_SUGGESTED = ['What do you still need from me?', 'What happened so far?', 'Why is my file not finished?']

interface Msg { id: number; who: 'me' | 'ai'; text: string; citations?: Citation[]; mode?: string; error?: boolean }

/** Splits an answer on [#42] / [doc-3] markers and turns the ones the server validated into chips. */
function renderAnswer(text: string, cites: Citation[], onCite: (c: Citation) => void, b: Bundle): ReactNode[] {
  const valid = new Map(cites.map((c) => [`${c.kind === 'event' ? '#' : ''}${String(c.ref).replace(/^#/, '')}`, c]))
  const docs = new Set(arr(b.documents).map((d) => d.id))
  const events = new Set(arr(b.events).map((e) => e.seq))
  return text.split(/(\[(?:#\d+|doc-\d+)\])/g).map((part, i) => {
    const m = part.match(/^\[(#\d+|doc-\d+)\]$/)
    if (!m) return part
    const ref = m[1]
    let c = valid.get(ref)
    if (!c) {
      // trust markers that point at something in the case even if the server sent no citation list
      if (ref.startsWith('#') && events.has(Number(ref.slice(1)))) c = { kind: 'event', ref: ref.slice(1) }
      else if (docs.has(ref)) c = { kind: 'doc', ref }
    }
    if (!c) return null
    const cc = c
    return <button key={i} type="button" className="cite" onClick={() => onCite(cc)} title={cc.label ? String(cc.label) : undefined}>{ref}</button>
  })
}

interface Props {
  bundle: Bundle
  caseId: string
  onCite: (c: Citation) => void
  onAnswered: () => void
}

export function ChatPanel({ bundle, caseId, onCite, onAnswered }: Props) {
  const [role, setRole] = useState<ChatRole>('employee')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const msgsRef = useRef<HTMLDivElement | null>(null)
  const nextId = useRef(1)
  // scroll only the message list, never the page (scrollIntoView made the whole page jump on load)
  useEffect(() => { const el = msgsRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, pending])

  const switchRole = (r: string) => {
    if (r !== 'client' && r !== 'employee') return
    setRole(r)
    setMsgs([])
  }

  const ask = async (q: string) => {
    const message = q.trim().slice(0, 1000)
    if (!message || pending) return
    const history: ChatHistoryItem[] = msgs.filter((m) => !m.error).map((m) => ({ role: m.who === 'me' ? 'user' : 'assistant', content: m.text }))
    setMsgs((m) => [...m, { id: nextId.current++, who: 'me', text: message }])
    setDraft('')
    setPending(true)
    try {
      const r = await api.chat(caseId, role, message, history)
      setMsgs((m) => [...m, { id: nextId.current++, who: 'ai', text: String(r.answer ?? ''), citations: arr(r.citations), mode: r.mode ? String(r.mode) : undefined }])
      onAnswered()
    } catch (e) {
      if (isUnavailable(e)) setUnavailable(true)
      else setMsgs((m) => [...m, { id: nextId.current++, who: 'ai', text: failureText(e), error: true }])
    } finally {
      setPending(false)
    }
  }
  const send = (e: FormEvent) => { e.preventDefault(); void ask(draft) }
  const asked = new Set(msgs.filter((m) => m.who === 'me').map((m) => m.text))
  const suggested = role === 'client' ? CLIENT_SUGGESTED : chatSuggestions(bundle)

  return (
    <div className="chat">
      <ToggleGroup type="single" value={role} onValueChange={switchRole} className="seg" aria-label="Who is asking">
        <ToggleGroupItem value="client" aria-label="Client view">Client view</ToggleGroupItem>
        <ToggleGroupItem value="employee" aria-label="Bank employee">Bank employee</ToggleGroupItem>
      </ToggleGroup>
      <p className="muted tiny">
        {role === 'client'
          ? 'What the client sees: status, missing documents and next steps. Internal reviews stay hidden.'
          : 'Full access: timeline, decisions, rules, documents and the agent’s reasoning. Every answer cites the ledger.'}
      </p>
      {unavailable ? (
        <p className="unavailable" role="status">Chat is not available on this server yet.</p>
      ) : (
        <>
          <div className="msgs" aria-live="polite" ref={msgsRef}>
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.who}`}>
                {m.who === 'ai' && !m.error ? renderAnswer(m.text, m.citations ?? [], onCite, bundle) : m.text}
                {m.who === 'ai' && m.mode === 'offline' ? <div className="msg-meta"><span className="offline">offline answer</span></div> : null}
              </div>
            ))}
            {pending ? <div className="msg ai typing" aria-label="Answering"><i /><i /><i /></div> : null}
            <div ref={endRef} />
          </div>
          <div className="suggest">
            {suggested.filter((q) => !asked.has(q)).map((q) => (
              <button key={q} type="button" onClick={() => void ask(q)} disabled={pending}>{q}</button>
            ))}
          </div>
          <form className="ask" onSubmit={send}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this case" aria-label="Ask about this case" maxLength={1000} />
            <button type="submit" className="btn primary icon-only" aria-label="Send" disabled={pending || !draft.trim()}>
              {pending ? <Icon name="spinner" size={14} className="spin" /> : <Icon name="send" size={14} />}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
