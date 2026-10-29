import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { filterOptions, findTrigger, fold, optionsFor, type Option } from './refs'
import type { Mentionables, PostRef, ThreadRole } from './types'
import { TIcon } from './TIcon'

interface Props {
  role: ThreadRole
  mentionables: Mentionables | null
  loadingMentions: boolean
  onNeedMentions: () => void
  sending: boolean
  onSend: (text: string, refs: PostRef[]) => Promise<boolean>
  placeholder: string
  hint: string
  label: string
}

const MAX_LEN = 2000
const isCoarse = () => { try { return window.matchMedia('(pointer: coarse)').matches } catch { return false } }

/** A typed token that is already complete ("#42 ", "@Elena Munteanu ") closes the list, so Enter sends again. */
function closedByCompleteToken(char: '@' | '#', query: string, all: Option[]): boolean {
  if (!/\s/.test(query)) return false
  if (char === '#') return /^(doc-\d+|\d+)\s/i.test(query)
  const q = fold(query.trim())
  return /\s$/.test(query) && all.some((o) => fold(o.label) === q)
}

/** The message box: Enter sends and Shift+Enter adds a line (on touch screens Enter adds a line and the button sends).
 *  Typing @ suggests people, # suggests documents and events; the pick goes in as a text token and is sent as a ref. */
export function Composer({ role, mentionables, loadingMentions, onNeedMentions, sending, onSend, placeholder, hint, label }: Props) {
  const [value, setValue] = useState('')
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const [picked, setPicked] = useState<Map<string, PostRef & { token: string }>>(() => new Map())
  // the highlighted option, remembered per trigger and query (a new query starts at the top again)
  const [act, setAct] = useState<{ k: string; i: number }>({ k: '', i: 0 })
  const [closedFor, setClosedFor] = useState<number | null>(null)
  const [popMax, setPopMax] = useState(260)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const pendingCaret = useRef<number | null>(null)
  // a tap on an option can blur the box before its click lands (some touch browsers): close the list a moment later
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(blurTimer.current), [])
  const uid = useId().replace(/:/g, '')
  const listId = `thr-list-${uid}`
  const hintId = `thr-hint-${uid}`
  const optId = (i: number) => `thr-opt-${uid}-${i}`

  const trigger = focused ? findTrigger(value, caret) : null
  const all = useMemo(() => (trigger ? optionsFor(mentionables, trigger.char) : []), [mentionables, trigger?.char]) // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => (trigger ? filterOptions(all, trigger.query) : []), [all, trigger?.query]) // eslint-disable-line react-hooks/exhaustive-deps
  const suppressed = !trigger || closedFor === trigger.start || closedByCompleteToken(trigger.char, trigger.query, all)
  const waiting = !suppressed && !mentionables && loadingMentions
  const open = !suppressed && options.length > 0
  // nothing to reference yet (a fresh file has no people until its documents arrive): say so instead of staying silent
  const none = !suppressed && !!mentionables && all.length === 0
  const tKey = trigger ? `${trigger.start}:${trigger.query}` : ''
  const activeIdx = Math.min(act.k === tKey ? act.i : 0, Math.max(0, options.length - 1))
  const setActive = (i: number) => setAct({ k: tKey, i })
  useEffect(() => { if (trigger && !suppressed) onNeedMentions() }, [trigger?.char, trigger?.start]) // eslint-disable-line react-hooks/exhaustive-deps

  // grow with the text, up to a few lines
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight + 2, role === 'client' ? 168 : 140)}px`
  }, [value, role])
  useLayoutEffect(() => {
    const ta = taRef.current
    if (ta && pendingCaret.current !== null) { ta.setSelectionRange(pendingCaret.current, pendingCaret.current); pendingCaret.current = null }
  }, [value])

  // the list opens above the box and never taller than the visible space above it (a phone keyboard shrinks that space)
  useEffect(() => {
    if (!open && !waiting && !none) return
    const fit = () => {
      const f = formRef.current
      if (!f) return
      const vv = window.visualViewport
      const top = f.getBoundingClientRect().top - (vv ? vv.offsetTop : 0)
      setPopMax(Math.max(96, Math.min(300, Math.floor(top - 12))))
    }
    fit()
    const vv = window.visualViewport
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => { vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); window.removeEventListener('resize', fit) }
  }, [open, waiting, none])

  // touch screens: keep the box above the on-screen keyboard while it grows
  useEffect(() => {
    const vv = window.visualViewport
    if (!focused || !vv || !isCoarse()) return
    const keep = () => {
      const ta = taRef.current
      if (!ta) return
      const r = ta.getBoundingClientRect()
      const bottom = vv.offsetTop + vv.height
      if (r.bottom > bottom - 8) window.scrollBy({ top: r.bottom - bottom + 16 })
    }
    vv.addEventListener('resize', keep)
    return () => vv.removeEventListener('resize', keep)
  }, [focused])

  // keep the active option visible inside the list (the list scrolls, the page never does)
  useEffect(() => {
    const ul = listRef.current
    const li = ul?.children[activeIdx] as HTMLElement | undefined
    if (!ul || !li) return
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight
  }, [activeIdx, open])

  const syncCaret = () => { const ta = taRef.current; if (ta) setCaret(ta.selectionStart ?? ta.value.length) }

  const pick = (o: Option) => {
    if (!trigger) return
    const before = value.slice(0, trigger.start)
    const after = value.slice(caret)
    const ins = o.token + (after.startsWith(' ') ? '' : ' ')
    const next = (before + ins + after).slice(0, MAX_LEN)
    const pos = Math.min(before.length + ins.length, next.length)
    setPicked((m) => new Map(m).set(o.key, { kind: o.kind, id: o.id, token: o.token }))
    setClosedFor(trigger.start)
    pendingCaret.current = pos
    setValue(next)
    setCaret(pos)
    taRef.current?.focus({ preventScroll: true })
  }

  const submit = async () => {
    const text = value.trim()
    if (!text || sending) return
    // refs whose token the user deleted again are not sent
    const refs = [...picked.values()].filter((p) => text.includes(p.token)).map(({ kind, id }) => ({ kind, id }))
    const ok = await onSend(text, refs)
    if (ok) {
      setValue('')
      setCaret(0)
      setPicked(new Map())
      setClosedFor(null)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((activeIdx + 1) % options.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((activeIdx - 1 + options.length) % options.length); return }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); pick(options[activeIdx]); return }
    }
    if (e.key === 'Escape' && (open || waiting || none) && trigger) { e.preventDefault(); e.stopPropagation(); setClosedFor(trigger.start); return }
    if (e.key === 'Enter' && !e.shiftKey && !isCoarse()) { e.preventDefault(); void submit() }
  }

  const onFormSubmit = (e: FormEvent) => { e.preventDefault(); void submit() }

  return (
    <form ref={formRef} className="thr-composer" onSubmit={onFormSubmit} aria-busy={sending || undefined}>
      {open || waiting || none ? (
        <div className="thr-pop" style={{ maxHeight: popMax }}>
          {open ? (
            <ul ref={listRef} id={listId} role="listbox" className="thr-opts" aria-label={trigger?.char === '@' ? 'People' : 'Documents and events'}
              style={{ maxHeight: popMax - 2 }}>
              {options.map((o, i) => (
                <li key={o.key} id={optId(i)} role="option" aria-selected={i === activeIdx} className={'thr-opt' + (i === activeIdx ? ' is-active' : '')}
                  onMouseDown={(e) => e.preventDefault()} onMouseMove={() => { if (i !== activeIdx) setActive(i) }} onClick={() => pick(o)}>
                  {o.code ? <span className="thr-opt-code">{o.code}</span> : <span className="thr-opt-at" aria-hidden="true">@</span>}
                  <span className="thr-opt-label">{o.label}</span>
                  <span className="thr-opt-meta">{o.meta}</span>
                </li>
              ))}
            </ul>
          ) : waiting ? <p className="thr-pop-wait" role="status">Loading suggestions…</p>
            : <p className="thr-pop-wait" role="status">
              {/* the client's word is "case"; the bank's wording is unchanged */}
              {`${trigger?.char === '@' ? 'No people on this' : 'Nothing to reference on this'} ${role === 'client' ? 'case' : 'file'} yet.${trigger?.char === '@' ? ' They appear once the documents arrive.' : ''}`}
            </p>}
        </div>
      ) : null}
      <div className="thr-box">
        <textarea
          ref={taRef}
          className="thr-input"
          rows={1}
          value={value}
          maxLength={MAX_LEN}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={hintId}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optId(activeIdx) : undefined}
          readOnly={sending}
          enterKeyHint={isCoarse() ? 'enter' : 'send'}
          onChange={(e) => {
            const v = e.target.value
            setValue(v)
            setCaret(e.target.selectionStart ?? v.length)
            // the closed trigger was deleted: a new @ or # typed in the same place opens the list again
            if (closedFor !== null && v[closedFor] !== '@' && v[closedFor] !== '#') setClosedFor(null)
          }}
          onSelect={syncCaret}
          onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') syncCaret() }}
          onClick={syncCaret}
          onFocus={() => { clearTimeout(blurTimer.current); setFocused(true); onNeedMentions() }}
          onBlur={() => { clearTimeout(blurTimer.current); blurTimer.current = setTimeout(() => setFocused(false), 150) }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="thr-send" aria-label={sending ? 'Sending' : 'Send message'} disabled={sending || !value.trim()}
          onMouseDown={(e) => e.preventDefault()}>
          {sending ? <TIcon name="spinner" className="thr-spin" /> : <TIcon name="send" />}
        </button>
      </div>
      <p id={hintId} className="thr-hint">{sending ? 'Sending…' : hint}</p>
    </form>
  )
}
