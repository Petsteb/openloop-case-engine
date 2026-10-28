import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { ApiError, isUnavailable } from './api'
import { Ask } from './Ask'
import { DocSheet, Documents, type DetailState } from './Documents'
import { Icon } from './Icon'
import { Messages, mailId } from './Messages'
import { ConfirmCard, DisputeNotice, RequestCard, type CardState } from './Needs'
import {
  arr, plural, portalState, progressSteps, safe, shortLabel, sortRequests, STATE_PILL, type Step,
} from './derive'
import type { Citation, ClientDocument, ClientView, ConfirmKind, MissingDocument, PortalState, SampleFile } from './types'
import { useClientView } from './useClientView'

/* ---------- theme: shares the bank screen's stored choice (openloop-theme), else follows the system ---------- */
type Theme = 'dark' | 'light'
const THEME_KEY = 'openloop-theme'
function savedTheme(): Theme | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(THEME_KEY) ?? 'null')
    return v === 'dark' || v === 'light' ? v : null
  } catch { return null }
}
export function initialTheme(): Theme {
  const s = savedTheme()
  if (s) return s
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' } catch { return 'dark' }
}
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    // the bank screen in the other window toggles the theme: follow it
    const on = (e: StorageEvent) => { if (e.key === THEME_KEY) { const s = savedTheme(); if (s) setTheme(s) } }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])
  const toggle = () => setTheme((t) => {
    const n = t === 'dark' ? 'light' : 'dark'
    try { window.localStorage.setItem(THEME_KEY, JSON.stringify(n)) } catch { /* storage unavailable */ }
    return n
  })
  return [theme, toggle]
}

const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

/* ---------- header pieces ---------- */
function StatusPill({ state }: { state: PortalState }) {
  return <span className={`pt-pill is-${state}`}><i aria-hidden="true" />{STATE_PILL[state]}</span>
}

function Progress({ steps }: { steps: Step[] }) {
  return (
    <ol className="pt-steps" aria-label="Progress of your file">
      {steps.map((s) => (
        <li key={s.name} className={`pt-step is-${s.state}`} aria-current={s.state === 'needs' || s.state === 'active' ? 'step' : undefined}>
          <span className="pt-step-mark" aria-hidden="true">{s.state === 'done' ? <Icon name="check" size={11} /> : null}</span>
          <span className="pt-step-name">{s.name}</span>
          <span className="pt-step-cap">
            <span className="sr-only">{s.state === 'done' ? 'Done: ' : s.state === 'todo' ? 'Not yet: ' : 'Now: '}</span>
            {s.caption}
          </span>
        </li>
      ))}
    </ol>
  )
}

const IDLE_TEXT: Record<PortalState, string> = {
  needs_you: 'Nothing to do right now.',
  under_review: 'Nothing to do right now. The bank is reviewing your file and will tell you if it needs anything.',
  in_progress: 'Nothing to do right now. We are checking your documents.',
  complete: 'Nothing to do. A bank officer will contact you with the decision.',
}

export function Portal() {
  const { view, docs, error, refresh, track, mutate, caseId } = useClientView('demo-1')
  const [theme, toggleTheme] = useTheme()
  if (!view) {
    return (
      <div className="pt">
        <DemoStrip theme={theme} onTheme={toggleTheme} />
        <div className="pt-wrap">
          {error ? (
            <div className="pt-loading" role="alert">
              <p>{error}</p>
              <button type="button" className="btn" onClick={() => void refresh()}>Try again</button>
            </div>
          ) : <p className="pt-loading" role="status"><Icon name="spinner" size={16} className="spin" />Loading your file…</p>}
        </div>
      </div>
    )
  }
  return (
    <FileView view={view} docs={docs} error={error} caseId={caseId} theme={theme} toggleTheme={toggleTheme}
      track={track} mutate={mutate} refresh={refresh} />
  )
}

interface FileProps {
  view: ClientView
  docs: ClientDocument[] | null
  error: string | null
  caseId: string
  theme: Theme
  toggleTheme: () => void
  track: <T>(p: Promise<T>) => Promise<T>
  mutate: ReturnType<typeof useClientView>['mutate']
  refresh: () => Promise<boolean>
}

const toggleIn = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }
const docNo = (id: string) => Number(id.replace(/\D/g, '')) || 0

function FileView({ view, docs, error, caseId, theme, toggleTheme, track, mutate, refresh }: FileProps) {
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const [ghosts, setGhosts] = useState<Record<string, MissingDocument>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [disputed, setDisputed] = useState(false)
  const [samples, setSamples] = useState<SampleFile[] | null>(null)
  const [openMail, setOpenMail] = useState<Set<string>>(() => new Set())
  const [openDocs, setOpenDocs] = useState<Set<string>>(() => new Set())
  const [details, setDetails] = useState<Record<string, { word: string; d: DetailState }>>({})
  const [sheet, setSheet] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /* sample files: only offer "Use sample file" when one exists for the request */
  useEffect(() => {
    let live = true
    api.sampleFiles().then((s) => { if (live) setSamples(Array.isArray(s) ? s : []) }).catch(() => { if (live) setSamples([]) })
    return () => { live = false }
  }, [])

  const docList = useMemo(() => [...arr(docs ?? undefined)].sort((a, b) =>
    ((b.received_day ?? 0) - (a.received_day ?? 0)) || (docNo(b.id) - docNo(a.id))), [docs])

  /* document details (history and text) load on demand, and again when the document's status changes */
  const loadDetail = useCallback(async (id: string, word: string) => {
    setDetails((m) => ({ ...m, [id]: { word, d: m[id] && typeof m[id].d === 'object' ? m[id].d : 'loading' } }))
    try {
      const d = await api.getDocument(caseId, id)
      setDetails((m) => ({ ...m, [id]: { word, d } }))
    } catch (e) {
      setDetails((m) => ({ ...m, [id]: { word, d: isUnavailable(e) ? 'unavailable' : 'error' } }))
    }
  }, [caseId])
  useEffect(() => {
    for (const d of docList) {
      const cached = details[d.id]
      if ((openDocs.has(d.id) || sheet === d.id) && (!cached || cached.word !== d.status_word)) void loadDetail(d.id, d.status_word)
    }
  }, [docList, openDocs, sheet, details, loadDetail])

  const flashTo = useCallback((token: string, selector: string) => {
    setFlash(token)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 1800)
    requestAnimationFrame(() => {
      document.querySelector(selector)?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    })
  }, [])
  const state = portalState(view)
  const missing = arr(view.missing_documents)
  const confirmations = arr(view.confirmations)
  const company = safe(view.overview?.company, 'Brutăria Aurora SRL')
  const product = view.overview?.product ? safe(view.overview.product, '') : ''

  // pending requests plus the ones that were just received (kept for a moment to show "Received")
  const requests = useMemo(() => {
    const keys = new Set(missing.map((m) => m.key))
    return sortRequests([...missing, ...Object.values(ghosts).filter((g) => !keys.has(g.key))])
  }, [missing, ghosts])
  const emails = useMemo(() => arr(view.emails).map((e, i) => ({ e, id: mailId(e, i) })).reverse(), [view.emails])
  const steps = progressSteps(view, docList)
  const known = useMemo(() => ({
    seqs: new Set<number>([...arr(view.timeline).map((e) => e.seq), ...missing.map((m) => m.seq ?? -1), ...confirmations.map((c) => c.ref_seq ?? -1)]),
    docs: new Set(docList.map((d) => d.id)),
  }), [view.timeline, missing, confirmations, docList])

  const sampleFor = (key: string) => ({
    ok: !!samples?.some((s) => s.key === key && (s.variant ?? 'ok') === 'ok'),
    wrong: key === 'onrc_certificate' && !!samples?.some((s) => s.key === key && s.variant === 'wrong_company'),
  })

  const setCard = (key: string, s: CardState | null) => setCards((m) => {
    const n = { ...m }
    if (s) n[key] = s; else delete n[key]
    return n
  })

  /* ---------- uploads ---------- */
  const sendUpload = async (req: MissingDocument, run: () => Promise<ClientView>) => {
    if (busyKey) return
    setBusyKey(req.key)
    setCard(req.key, 'uploading')
    const before = new Set(docList.map((d) => d.id))
    try {
      const { view: cv, docs: after } = await mutate(run)
      const added = arr(after ?? undefined).filter((d) => !before.has(d.id))
      const still = arr(cv.missing_documents).some((m) => m.key === req.key)
      if (added.some((d) => d.status === 'quarantined')) setCard(req.key, 'rejected')
      else if (still) setCard(req.key, null)   // e.g. a PDF waiting for manual reading: the card shows that state
      else {
        setGhosts((g) => ({ ...g, [req.key]: req }))
        setCard(req.key, 'received')
        setTimeout(() => {
          setGhosts((g) => { const n = { ...g }; delete n[req.key]; return n })
          setCard(req.key, null)
        }, 3200)
      }
    } catch (e) {
      setCard(req.key, null)
      if (isUnavailable(e)) toast('Uploads open soon in this demo')
      else toast.error(api.failureText(e))
    } finally {
      setBusyKey(null)
    }
  }
  const onFile = (req: MissingDocument, file: File) =>
    void sendUpload(req, async () => api.upload(caseId, req.key, file.name, await api.readAsBase64(file)))
  const onSample = (req: MissingDocument, variant: 'ok' | 'wrong_company') =>
    void sendUpload(req, () => api.uploadSample(caseId, req.key, variant))

  /* ---------- confirmations ---------- */
  const onAnswer = async (kind: ConfirmKind, answer: 'yes' | 'no') => {
    if (confirming) return
    setConfirming(kind)
    try {
      await mutate(() => api.clientConfirm(caseId, kind, answer))
      if (kind === 'contact_change' && answer === 'no') setDisputed(true)
      else if (kind === 'contact_change') toast('Thank you. We noted that you made this change.')
      else toast(answer === 'yes' ? 'Thank you. The bank can now check your company’s credit history.' : 'Understood. The bank may ask you again later.')
    } catch (e) {
      if (isUnavailable(e)) toast('Confirmations open soon in this demo')
      else {
        toast.error(api.failureText(e))
        if (e instanceof ApiError && e.status === 409) void refresh()
      }
    } finally {
      setConfirming(null)
    }
  }

  /* ---------- citations from the chat ---------- */
  const openDoc = (id: string) => setSheet(id)
  const onCite = (c: Citation) => {
    const ref = String(c.ref).replace(/^#/, '')
    if (c.kind === 'doc' || /^doc-\d+$/.test(ref)) {
      if (docList.some((d) => d.id === ref)) openDoc(ref)
      else toast('This document is not on your file.')
      return
    }
    const seq = Number(ref)
    const req = missing.find((m) => m.seq === seq)
    if (req) return flashTo(`req:${req.key}`, `[data-key="${CSS.escape(req.key)}"]`)
    const conf = confirmations.find((x) => x.ref_seq === seq)
    if (conf) return flashTo(`conf:${conf.kind}`, `[data-confirm="${CSS.escape(String(conf.kind))}"]`)
    const ev = arr(view.timeline).find((e) => e.seq === seq)
    if (ev?.type === 'DOCUMENT_RECEIVED') {
      const name = ev.what.replace(/^[^:]*:\s*/, '').trim()
      const d = docList.find((x) => x.name === name)
      if (d) {
        setOpenDocs((s) => new Set(s).add(d.id))
        return flashTo(d.id, `[data-doc="${CSS.escape(d.id)}"]`)
      }
    }
    if (ev && (ev.type === 'REMINDER_SENT' || ev.type === 'DOCUMENT_REQUESTED')) {
      const m = emails.find((x) => x.e.sim_time === ev.when)
      if (m) {
        setOpenMail((s) => new Set(s).add(m.id))
        return flashTo(m.id, `[data-mail="${CSS.escape(m.id)}"]`)
      }
    }
    if (ev) toast(`Day ${ev.day}: ${safe(ev.what, 'Your file was updated.')}`)
    else toast(c.label ? safe(c.label, 'Your file was updated.') : 'This item is no longer on your file.')
  }

  /* ---------- the one next action ---------- */
  const first = requests.find((r) => !ghosts[r.key])
  const busy = busyKey !== null
  let nextText: string
  if (missing.length && confirmations.length) nextText = `Please send ${plural(missing.length, 'document', 'documents')} and answer ${plural(confirmations.length, 'question', 'questions')}.`
  else if (missing.length) nextText = missing.length === 1 ? 'Please send us one document.' : `Please send us ${missing.length} documents.`
  else if (confirmations.length) nextText = confirmations.length === 1 ? 'Please answer one question from the bank.' : `Please answer ${confirmations.length} questions from the bank.`
  else nextText = IDLE_TEXT[state]
  const needsYou = missing.length + confirmations.length > 0
  const nextAction = () => {
    if (first) {
      const el = inputs.current.get(first.key)
      document.querySelector(`[data-key="${CSS.escape(first.key)}"]`)?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
      el?.click()
    } else if (confirmations[0]) {
      flashTo(`conf:${confirmations[0].kind}`, `[data-confirm="${CSS.escape(String(confirmations[0].kind))}"]`)
    }
  }
  const nextLabel = first ? `Upload ${shortLabel(first)}` : confirmations.length ? 'Answer now' : ''

  const needCount = missing.length + confirmations.length
  const sheetDoc = docList.find((d) => d.id === sheet)

  return (
    <div className="pt">
      <DemoStrip theme={theme} onTheme={toggleTheme} />
      <div className="pt-wrap">
        <header className="pt-head">
          <div className="pt-head-main">
            <p className="pt-eyebrow">Your financing file</p>
            <h1 className="pt-company">{company}</h1>
            {product ? <p className="pt-product">{product}</p> : null}
          </div>
          <div className="pt-head-side">
            <StatusPill state={state} />
            <span className="pt-day">Day {view.overview?.day ?? 0} of your file</span>
          </div>
        </header>

        {error ? <p className="pt-offline" role="status">We can’t reach the bank right now. This page updates again when the connection is back.</p> : null}

        <div className={`pt-next${needsYou ? ' is-needs' : ''}`}>
          <p className="pt-next-text">{nextText}</p>
          {nextLabel ? (
            <button type="button" className="btn primary pt-next-btn" onClick={nextAction} disabled={busy}>
              {first ? <Icon name="upload" size={14} /> : null}{nextLabel}
            </button>
          ) : null}
        </div>

        <section className="pt-progress-sec" aria-label="Progress">
          <Progress steps={steps} />
        </section>

        <main className="pt-grid">
          <section className="pt-sec pt-a-need" aria-labelledby="h-need">
            <h2 id="h-need" className="pt-h2">What we need from you{needCount ? <span className="pt-count">{needCount}</span> : null}</h2>
            {requests.length || confirmations.length || disputed ? (
              <div className="pt-cards">
                {requests.map((r) => (
                  <RequestCard key={r.key} req={r} docs={docList} state={cards[r.key]} ghost={!!ghosts[r.key]}
                    flash={flash === `req:${r.key}`} sample={sampleFor(r.key)} busy={busy}
                    onFile={onFile} onSample={onSample} onInvalid={(m) => toast.error(m)}
                    registerInput={(k, el) => { if (el) inputs.current.set(k, el); else inputs.current.delete(k) }} />
                ))}
                {disputed ? <DisputeNotice onDismiss={() => setDisputed(false)} /> : null}
                {confirmations.map((c, i) => (
                  <ConfirmCard key={`${c.kind}-${c.ref_seq ?? i}`} c={c} pending={confirming === c.kind} busy={confirming !== null}
                    flash={flash === `conf:${c.kind}`} onAnswer={(k, a) => void onAnswer(k, a)} />
                ))}
              </div>
            ) : (
              <p className="pt-all-set"><Icon name="check" size={16} />
                <span>{state === 'complete' ? 'You have sent everything we need. Thank you.' : 'Nothing needed from you right now. If that changes, we will email you and show it here.'}</span>
              </p>
            )}
          </section>

          <section className="pt-sec pt-a-msgs" aria-labelledby="h-msgs">
            <h2 id="h-msgs" className="pt-h2">Messages from the bank{emails.length ? <span className="pt-count">{emails.length}</span> : null}</h2>
            <Messages view={view} emails={emails} open={openMail} flash={flash}
              onToggle={(id) => setOpenMail((s) => toggleIn(s, id))} />
          </section>

          {docList.length ? (
            <section className="pt-sec pt-a-docs" aria-labelledby="h-docs">
              <h2 id="h-docs" className="pt-h2">Your documents<span className="pt-count">{docList.length}</span></h2>
              <Documents docs={docList} open={openDocs} details={Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.d]))}
                flash={flash} onToggle={(id) => setOpenDocs((s) => toggleIn(s, id))} onView={openDoc} />
            </section>
          ) : null}

          <section className="pt-sec pt-a-ask" aria-labelledby="h-ask">
            <h2 id="h-ask" className="pt-h2">Ask about your file</h2>
            <Ask caseId={caseId} known={known} track={track} onCite={onCite} />
          </section>
        </main>

        <footer className="pt-foot">
          <Icon name="shield" size={16} />
          <p>Internal reviews and staff notes are not shown here. A bank officer makes the credit decision.</p>
        </footer>
      </div>
      <DocSheet doc={sheetDoc} detail={sheetDoc ? details[sheetDoc.id]?.d : undefined} onClose={() => setSheet(null)} />
    </div>
  )
}

function DemoStrip({ theme, onTheme }: { theme: Theme; onTheme: () => void }) {
  return (
    <div className="pt-demo">
      <div className="pt-demo-in">
        <p><b>Demo:</b> client view of Brutăria Aurora SRL</p>
        <div className="pt-demo-tools">
          <a className="pt-demo-link" href="/" target="_blank" rel="noopener"><span>Bank screen</span><Icon name="external" size={13} /></a>
          <button type="button" className="pt-icon-btn" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
