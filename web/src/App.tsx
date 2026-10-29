import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import * as api from '@/lib/api'
import { isUnavailable } from '@/lib/api'
import { arr, checklist, checklistNote, docRows, fTime, latestActivity, plural, resolveToast } from '@/lib/derive'
import type { Citation, Exception_, LearningState, VerifyResult } from '@/lib/types'
import { isTyping, store } from '@/lib/store'
import { failureText, useCase } from '@/hooks/useCase'
import { useDocList } from '@/hooks/useDocs'
import { toast } from 'sonner'
import { Boundary } from './components/Btn'
import { CaseHeader, verifyLabel } from './components/CaseHeader'
import { CenterPane } from './components/CenterPane'
import { ChecklistAttention, ChecklistRail, PanelHead, RightRail } from './components/Checklist'
import { DemoDock } from './components/DemoDock'
import { DocumentViewer } from './components/DocumentDialog'
import { LearningSheet } from './components/LearningSheet'
import { RightPanel, type RightTab } from './components/RightPanel'
import { Timeline } from './components/Timeline'
import { Icon } from './components/Icon'
import { resetAllDemo } from './home/queue'
import { setSeen } from './home/seen'
import type { CaseExtra } from './home/types'
import { HOME_HREF, STARTED_CLEAN, go, useHashRoute } from './home/useHashRoute'
import { WorkQueue } from './home/WorkQueue'

type Theme = 'dark' | 'light'
const initialTheme = (): Theme => {
  const saved = store.get<Theme | null>('theme', null)
  if (saved === 'dark' || saved === 'light') return saved
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' } catch { return 'dark' }
}

const lastSeq = (ev: { seq: number }[] | undefined) => (Array.isArray(ev) && ev.length ? Number(ev[ev.length - 1].seq) || 0 : 0)

/** The shell: `#/` is the work queue, `#/case/{id}` a case. Theme and the demo dock's visibility carry across screens. */
export default function App() {
  const route = useHashRoute()
  const [theme, setTheme] = useState<Theme>(initialTheme)
  // Hidden when the page was opened as `#clean` (presenter mode); toggled with D.
  const [dock, setDock] = useState<boolean>(!STARTED_CLEAN)
  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('theme', theme) }, [theme])
  const onTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const screen = route.name === 'case' ? `case:${route.id}` : 'home'
  useEffect(() => {
    try { window.scrollTo(0, 0) } catch { /* no window */ }
    if (screen === 'home') document.title = 'Work queue | OpenLoop'
  }, [screen])

  if (route.name === 'home') return <WorkQueue theme={theme} onTheme={onTheme} />
  // key: a different case remounts the whole screen, so selection, the open sheet, the chat draft and the timeline view
  // never carry over from the previous case.
  return <CaseView key={route.id} caseId={route.id} theme={theme} onTheme={onTheme} dock={dock} setDock={setDock} />
}

interface CaseViewProps {
  caseId: string
  theme: Theme
  onTheme: () => void
  dock: boolean
  setDock: Dispatch<SetStateAction<boolean>>
}

function CaseView({ caseId: routeId, theme, onTheme, dock, setDock }: CaseViewProps) {
  const { bundle, busy, error, missing, act, load, refresh, caseId } = useCase(routeId)
  const [left, setLeft] = useState<boolean>(() => store.get('left-open', true))
  const [right, setRight] = useState<boolean>(() => store.get('right-open', true))
  const [tab, setTab] = useState<RightTab>(() => store.get<RightTab>('rtab', 'ask'))
  const [selected, setSelected] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [docOpen, setDocOpen] = useState<string | null>(null)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [learning, setLearning] = useState<LearningState | null>(null)
  const [learningOk, setLearningOk] = useState(false)
  const [learningOpen, setLearningOpen] = useState(false)

  useEffect(() => store.set('left-open', left), [left])
  useEffect(() => store.set('right-open', right), [right])
  useEffect(() => store.set('rtab', tab), [tab])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '[') setLeft((v) => !v)
      else if (e.key === ']') setRight((v) => !v)
      else if (e.key === 'd' || e.key === 'D') setDock((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setDock])

  const eventCount = arr(bundle?.events).length
  const seq = lastSeq(bundle?.events)
  // Seen: the analyst has this case on screen, so everything up to the newest event is read (the bell and the queue's
  // unread dot use it). Written again on leaving, in case another writer lowered it meanwhile.
  useEffect(() => { if (seq) setSeen(caseId, seq) }, [caseId, seq])
  // (not after "Reset all demo cases": the reseed cleared every seen value and the old seq means nothing any more)
  const leavingAfterReset = useRef(false)
  useEffect(() => () => { if (seq && !leavingAfterReset.current) setSeen(caseId, seq) }, [caseId, seq])
  const company = bundle ? String((bundle.case as typeof bundle.case & CaseExtra)?.company || '') : ''
  useEffect(() => { document.title = `${company || caseId} | OpenLoop` }, [company, caseId])
  // a new bundle makes an earlier integrity check stale
  useEffect(() => { setVerify(null) }, [eventCount])

  const loadLearning = useCallback(async () => {
    try { setLearning(await api.getLearning()); setLearningOk(true) } catch (e) { if (isUnavailable(e)) setLearningOk(false) }
  }, [])
  useEffect(() => { if (bundle) void loadLearning() }, [eventCount, bundle === null, loadLearning]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => (bundle ? checklist(bundle) : []), [bundle])
  const docList = useDocList(caseId, bundle)
  const docs = useMemo(() => (bundle ? docRows(bundle, docList) : []), [bundle, docList])
  const latest = useMemo(() => {
    const l = bundle ? latestActivity(bundle) : null
    return l ? { time: fTime(l.real), text: l.text } : null
  }, [bundle])

  const doVerify = useCallback(async () => {
    setVerifying(true)
    try { setVerify(await api.verify(caseId)) } catch (e) { toast.error(failureText(e)) } finally { setVerifying(false) }
  }, [caseId])

  const onResolve = useCallback((x: Exception_, actionId: string) => {
    void act(`resolve:${x.id}:${actionId}`, () => api.resolve(caseId, x.id, actionId), resolveToast(x, actionId))
      .then((b) => { if (b) setSelected(null) })
  }, [act, caseId])
  const onInbound = useCallback((id: string, label: string) => {
    void act('inbound', () => api.inbound(caseId, id), `Delivered: ${label}`).then((b) => { if (b) setSelected(null) })
  }, [act, caseId])
  const onAdvance = useCallback((days: number) => {
    void act(`advance:${days}`, () => api.advance(caseId, days), `Skipped ${plural(days, 'day')}`).then((b) => { if (b) setSelected(null) })
  }, [act, caseId])
  const onRelease = useCallback((note: string) => {
    void act('release', () => api.releaseHold(caseId, 'compliance-1', note), 'Hold released. The agent resumes the file.')
      .then((b) => { if (b) setSelected(null) })
  }, [act, caseId])
  const onReset = useCallback(() => {
    void act('reset', () => api.reset(), 'Demo reset. A fresh case is open.').then((b) => { if (b) { setSelected(null); setHighlight(null) } })
  }, [act])
  // Reseeds every synthetic file. Leave the case first: while the database is wiped this case (and its polling) would
  // answer 404, and the reset answers with demo-1's bundle, which must not render under this case's id.
  const onResetAll = useCallback(() => {
    if (busy) return
    leavingAfterReset.current = true
    go(HOME_HREF)
    void resetAllDemo()
  }, [busy])

  const openLedger = useCallback((seq: number | null) => {
    setRight(true)
    setTab('ledger')
    setHighlight(seq)
  }, [])
  // The viewer is a modal sheet over the panels: close it first, then show the ledger event or the check.
  const ledgerFromDoc = useCallback((seq: number | null) => { setDocOpen(null); openLedger(seq) }, [openLedger])
  const checkFromDoc = useCallback((id: string) => { setDocOpen(null); setSelected(id) }, [])
  const onCite = useCallback((c: Citation) => {
    if (c.kind === 'doc') setDocOpen(String(c.ref))
    else {
      const seq = Number(String(c.ref).replace(/^#/, ''))
      openLedger(Number.isFinite(seq) ? seq : null)
    }
  }, [openLedger])

  if (!bundle) {
    return (
      <main className="page">
        <div className="casehead">
          <div className="casehead-main">
            <span className="brand"><span className="brand-mark" aria-hidden="true" />OpenLoop</span>
            <a className="case-back" href={HOME_HREF}><Icon name="chevronL" size={14} />Work queue</a>
          </div>
        </div>
        {error ? (
          <div className="stack" role="alert">
            <p>{error}</p>
            <div className="actions">
              {missing ? <a className="btn" href={HOME_HREF}>Open the work queue</a>
                : <button type="button" className="btn" onClick={() => void load()}>Try again</button>}
            </div>
          </div>
        ) : <p className="muted" role="status">Loading the case…</p>}
      </main>
    )
  }

  const v = verifyLabel(verify)
  const learningCount = learningOk ? (typeof bundle.learning?.proposals === 'number' ? bundle.learning.proposals : arr(learning?.proposals).length) : null

  return (
    <>
      <main className="page">
        <Boundary name="header">
          <CaseHeader bundle={bundle} caseId={caseId} verify={verify} verifying={verifying} onVerify={doVerify} theme={theme}
            onTheme={onTheme} learningCount={learningCount} onLearning={() => { setLearningOpen(true); void loadLearning() }} />
        </Boundary>
        <section className="panel" aria-label="Timeline">
          <Boundary name="timeline"><Timeline bundle={bundle} /></Boundary>
        </section>
        <div className="l-three" style={{ ['--lw' as string]: left ? undefined : '44px', ['--rw' as string]: right ? undefined : '44px' }}>
          {left ? (
            <section className="panel side-panel left-col" aria-label="Checklist">
              <PanelHead title="Checklist" count={items.length} side="left" onHide={() => setLeft(false)} />
              <div className="panel-body">
                <Boundary name="checklist">
                  <ChecklistAttention items={items} selected={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} note={checklistNote(bundle)} />
                </Boundary>
              </div>
            </section>
          ) : <ChecklistRail items={items} onOpen={() => setLeft(true)} />}
          <section className="center-col" aria-label="Decision">
            <Boundary name="centre">
              <CenterPane bundle={bundle} selected={selected} busy={busy} onClearSelection={() => setSelected(null)} onResolve={onResolve}
                onOpenLedger={openLedger} onOpenDoc={setDocOpen} onVerify={doVerify} verifyText={v?.text ?? null} onRelease={onRelease} />
            </Boundary>
          </section>
          <section className="panel side-panel right-col" aria-label="Ask and activity" hidden={!right}>
            <RightPanel bundle={bundle} caseId={caseId} tab={tab} onTab={setTab} onHide={() => setRight(false)} highlight={highlight}
              onCite={onCite} onAnswered={() => void refresh()} verifyText={v?.text ?? null} verifyOk={!!v?.ok} verifying={verifying} onVerify={doVerify}
              docs={docs} onOpenDoc={setDocOpen} />
          </section>
          {!right ? <RightRail latest={latest} onOpen={(t) => { if (t) setTab(t); setRight(true) }} /> : null}
        </div>
      </main>
      {dock ? <DemoDock bundle={bundle} caseId={caseId} busy={busy} onInbound={onInbound} onAdvance={onAdvance}
        onReset={onReset} onResetAll={onResetAll} /> : null}
      <DocumentViewer bundle={bundle} caseId={caseId} docId={docOpen} rows={docs} onClose={() => setDocOpen(null)} onOpenDoc={setDocOpen}
        onOpenLedger={ledgerFromDoc} onSelectRequirement={checkFromDoc} />
      {learningOk ? <LearningSheet open={learningOpen} onOpenChange={setLearningOpen} state={learning} onChanged={() => { void loadLearning(); void refresh() }} /> : null}
    </>
  )
}
