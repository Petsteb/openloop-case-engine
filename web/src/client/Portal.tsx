import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { ApiError, isUnavailable } from './api'
import { Ask } from './Ask'
import { PortalBoundary, SectionBoundary } from './Boundary'
import { DocSheet, Documents, type DetailState } from './Documents'
import { Icon } from './Icon'
import { Messages } from './Messages'
import { ConfirmCard, DisputeNotice, RequestCard, type CardState } from './Needs'
import {
  arr, decidesLine, latestDispute, nextText as nextTextFor, pillState, pillText, portalState, productFor, progressSteps, safe, sameKey,
  shortLabel, sortRequests, fileEyebrow, type Step,
} from './derive'
import { HOME_HREF } from './route'
import { markSeen } from './store'
import type { CaseRow, Citation, ClientDocument, ClientView, ConfirmKind, MissingDocument, PortalState, SampleFile } from './types'
import { useClientView } from './useClientView'

const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

/* ---------- header pieces ---------- */
/** The server's own line (it already names the template's decision). Only when the pill overrides the server's state
 *  (a complete file with a question still open) do the words come from here. */
function StatusPill({ pill, state, decision, serverText }: { pill: PortalState; state: PortalState; decision: string; serverText: string | undefined }) {
  const text = pill === state ? safe(serverText, pillText(state, decision)) : pillText(pill, decision)
  return <span className={`pt-pill is-${pill}`}><i aria-hidden="true" />{text}</span>
}

function Progress({ steps }: { steps: Step[] }) {
  return (
    <ol className="pt-steps" aria-label="Progress of your case">
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

const maxSeq = (v: ClientView) => arr(v.timeline).reduce((m, e) => Math.max(m, Number(e?.seq) || 0), 0)

interface PortalProps {
  caseId: string
  /** this case's row in My cases (template, title), once the chosen company's list has it */
  file?: CaseRow
  /** the file's company name, so the demo can view the portal as that company */
  onCompanyName?: (name: string) => void
  /** the template's decision in its own words ("credit decision"), from the template list; '' while unknown */
  decision?: string
}

/** One file. Rendered with key={caseId}: switching files remounts it, so no state carries over. */
export function Portal({ caseId, file, onCompanyName, decision = '' }: PortalProps) {
  const { view, docs, error, refresh, track, mutate, gen, ledger, gone } = useClientView(caseId)
  const companyName = view?.overview?.company
  useEffect(() => { if (companyName && onCompanyName) onCompanyName(companyName) }, [companyName, onCompanyName])
  // opening the file marks it seen up to the newest ledger seq this page knows (the client timeline hides some)
  useEffect(() => { if (view) markSeen(caseId, Math.max(ledger ?? 0, maxSeq(view)), ledger) }, [caseId, view, ledger])
  useEffect(() => {
    const name = companyName ? safe(companyName, '') : ''
    document.title = name ? `${name} · Your case` : 'Your case'
  }, [companyName])
  // the file was removed (or never existed): a calm page instead of a stale one; polling has stopped
  if (gone) {
    return (
      <div className="pt-wrap">
        <div className="pt-loading pt-gone" role="alert">
          <h1 className="pt-company">This case no longer exists</h1>
          <p>It may have been closed or removed. Your other cases are in My cases.</p>
          <a className="btn" href={HOME_HREF}>Go to My cases</a>
        </div>
      </div>
    )
  }
  if (!view) {
    return (
      <div className="pt-wrap">
        {error ? (
          <div className="pt-loading" role="alert">
            <p>{error}</p>
            <button type="button" className="btn" onClick={() => void refresh()}>Try again</button>
          </div>
        ) : <p className="pt-loading" role="status"><Icon name="spinner" size={16} className="spin" />Loading your case…</p>}
      </div>
    )
  }
  // a demo reset (the ledger got shorter) remounts the page: no notes, chat or open rows from the previous run
  return (
    <PortalBoundary key={gen} inner>
      <FileView key={gen} view={view} docs={docs} error={error} caseId={caseId} file={file} decision={decision}
        track={track} mutate={mutate} refresh={refresh} />
    </PortalBoundary>
  )
}

interface FileProps {
  view: ClientView
  docs: ClientDocument[] | null
  error: string | null
  caseId: string
  file?: CaseRow
  decision: string
  track: <T>(p: Promise<T>) => Promise<T>
  mutate: ReturnType<typeof useClientView>['mutate']
  refresh: () => Promise<boolean>
}

const toggleIn = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }
const docNo = (id: string) => Number(String(id ?? '').replace(/\D/g, '')) || 0

function FileView({ view, docs, error, caseId, file, decision, track, mutate, refresh }: FileProps) {
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const [ghosts, setGhosts] = useState<Record<string, MissingDocument>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ kind: string; answer: 'yes' | 'no' } | null>(null)
  const [hiddenDispute, setHiddenDispute] = useState<number | null>(null)   // "Hide this message" (this page only)
  const [samples, setSamples] = useState<SampleFile[] | null>(null)
  const [openDocs, setOpenDocs] = useState<Set<string>>(() => new Set())
  const [details, setDetails] = useState<Record<string, { word: string; d: DetailState }>>({})
  const [sheet, setSheet] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /* sample files: only offer "Use sample file" when one exists for the request */
  useEffect(() => {
    let live = true
    api.sampleFiles(caseId).then((s) => { if (live) setSamples(Array.isArray(s) ? s : []) }).catch(() => { if (live) setSamples([]) })
    return () => { live = false }
  }, [caseId])

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
  const company = safe(view.overview?.company, 'Your company')
  // the server sends the company's loan line on every file: show it on a loan file only
  const product = file ? productFor(file.template, view.overview?.product) : ''
  const kind = file ? fileEyebrow(file.template, file.template_title) : 'Your case with the bank'

  // pending requests plus the ones that were just received (kept for a moment to show "Received")
  const requests = useMemo(() => {
    const keys = new Set(missing.map((m) => m.key))
    return sortRequests([...missing, ...Object.values(ghosts).filter((g) => !keys.has(g.key))])
  }, [missing, ghosts])
  const steps = progressSteps(view, docList)
  const known = useMemo(() => ({
    seqs: new Set<number>([...arr(view.timeline).map((e) => e.seq), ...missing.map((m) => m.seq ?? -1), ...confirmations.map((c) => c.ref_seq ?? -1)]),
    docs: new Set(docList.map((d) => d.id)),
  }), [view.timeline, missing, confirmations, docList])

  // the request may spell a name in register order ("Pop Radu") and the sample in ID order ("Radu Pop"): the server
  // matches either way, and the upload always sends the request's own key
  const sampleFor = (key: string) => ({
    ok: !!samples?.some((s) => sameKey(s.key, key) && (s.variant ?? 'ok') === 'ok'),
    wrong: key === 'onrc_certificate' && !!samples?.some((s) => sameKey(s.key, key) && s.variant === 'wrong_company'),
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
      const noSample = e instanceof ApiError && e.status === 404 && /no sample file/i.test(e.message)
      if (isUnavailable(e) && !noSample) toast('Uploads open soon in this demo')
      else toast.error(api.failureText(e))
      // e.g. 422 "not requested": the bank already has it, so this page is behind; catch up now
      if (e instanceof ApiError && (e.status === 409 || e.status === 422 || noSample)) void refresh()
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
    setConfirming({ kind, answer })
    try {
      await mutate(() => api.clientConfirm(caseId, kind, answer))
      // "No" to a contact change needs no toast: the server's timeline now has the dispute, and the notice is built from it
      if (kind === 'credit_check_consent') toast(answer === 'yes' ? 'Thank you. The bank can now check your company’s credit history.' : 'Understood. The bank may ask you again later.')
      else if (answer === 'yes') toast('Thank you. We noted that you made this change.')
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

  /* ---------- documents: opening a row or the sheet again retries a history that failed to load ---------- */
  const forgetFailed = (id: string) => {
    if (details[id]?.d === 'error') setDetails((m) => { const n = { ...m }; delete n[id]; return n })
  }
  const toggleDoc = (id: string) => {
    if (!openDocs.has(id)) forgetFailed(id)
    setOpenDocs((s) => toggleIn(s, id))
  }

  /* ---------- citations from the chat ---------- */
  const openDoc = (id: string) => { forgetFailed(id); setSheet(id) }
  const onCite = (c: Citation) => {
    const ref = String(c.ref).replace(/^#/, '')
    if (c.kind === 'doc' || /^doc-\d+$/.test(ref)) {
      if (docList.some((d) => d.id === ref)) openDoc(ref)
      else toast('This document is not part of your case.')
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
    if (ev) toast(`Day ${ev.day}: ${safe(ev.what, 'Your case was updated.')}`)
    else toast(c.label ? safe(c.label, 'Your case was updated.') : 'This item is no longer part of your case.')
  }

  /* ---------- the one next action ---------- */
  const first = requests.find((r) => !ghosts[r.key])
  const busy = busyKey !== null
  const pill = pillState(state, missing.length, confirmations.length)
  const dispute = latestDispute(view)
  const showDispute = !!dispute && hiddenDispute !== dispute.seq
  // complete with a question still open (credit-bureau consent stays pending by design) never reads "Complete"
  const nextText = nextTextFor(state, missing.length, confirmations.length, decision)
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
    <>
      <div className="pt-wrap">
        <header className="pt-head">
          <div className="pt-head-main">
            <p className="pt-eyebrow">{kind}</p>
            <h1 className="pt-company">{company}</h1>
            {product ? <p className="pt-product">{product}</p> : null}
          </div>
          <div className="pt-head-side">
            <StatusPill pill={pill} state={state} decision={decision} serverText={view.overview?.status_text} />
            <span className="pt-day">Day {view.overview?.day ?? 0} of your case</span>
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
            {requests.length || confirmations.length || showDispute ? (
              <div className="pt-cards">
                {requests.map((r) => (
                  <RequestCard key={r.key} req={r} docs={docList} state={cards[r.key]} ghost={!!ghosts[r.key]}
                    flash={flash === `req:${r.key}`} sample={sampleFor(r.key)} busy={busy}
                    onFile={onFile} onSample={onSample} onInvalid={(m) => toast.error(m)}
                    registerInput={(k, el) => { if (el) inputs.current.set(k, el); else inputs.current.delete(k) }} />
                ))}
                {showDispute && dispute ? <DisputeNotice item={dispute} onDismiss={() => setHiddenDispute(dispute.seq)} /> : null}
                {confirmations.map((c, i) => (
                  <ConfirmCard key={`${c.kind}-${c.ref_seq ?? i}`} c={c} pending={confirming?.kind === c.kind ? confirming.answer : null}
                    busy={confirming !== null} flash={flash === `conf:${c.kind}`} onAnswer={(k, a) => void onAnswer(k, a)} />
                ))}
              </div>
            ) : (
              <p className="pt-all-set"><Icon name="check" size={16} />
                <span>{state === 'complete' ? 'You have sent everything we need. Thank you.' : 'Nothing needed from you right now. If that changes, we will email you and show it here.'}</span>
              </p>
            )}
          </section>

          <section className="pt-sec pt-a-msgs" aria-labelledby="h-msgs">
            <h2 id="h-msgs" className="pt-h2">Messages with the bank</h2>
            <SectionBoundary fallback="Messages can’t be shown right now. Please reload the page.">
              <Messages caseId={caseId} role="client" />
            </SectionBoundary>
          </section>

          {docList.length ? (
            <section className="pt-sec pt-a-docs" aria-labelledby="h-docs">
              <h2 id="h-docs" className="pt-h2">Your documents<span className="pt-count">{docList.length}</span></h2>
              <Documents docs={docList} open={openDocs} details={Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.d]))}
                flash={flash} onToggle={toggleDoc} onView={openDoc} />
            </section>
          ) : null}

          <section className="pt-sec pt-a-ask" aria-labelledby="h-ask">
            <h2 id="h-ask" className="pt-h2">Ask about your case</h2>
            <Ask caseId={caseId} known={known} track={track} onCite={onCite} />
          </section>
        </main>

        <footer className="pt-foot">
          <Icon name="shield" size={16} />
          <p>Internal reviews and staff notes are not shown here. {decidesLine(decision)}</p>
        </footer>
      </div>
      <DocSheet doc={sheetDoc} detail={sheetDoc ? details[sheetDoc.id]?.d : undefined} onClose={() => setSheet(null)} />
    </>
  )
}
