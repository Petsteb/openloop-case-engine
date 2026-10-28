import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '@/lib/api'
import { isUnavailable } from '@/lib/api'
import { arr, checklist, fTime, latestActivity, plural, resolveToast } from '@/lib/derive'
import type { Citation, Exception_, LearningState, VerifyResult } from '@/lib/types'
import { isTyping, store } from '@/lib/store'
import { failureText, useCase } from '@/hooks/useCase'
import { toast } from 'sonner'
import { Boundary } from './components/Btn'
import { CaseHeader, verifyLabel } from './components/CaseHeader'
import { CenterPane } from './components/CenterPane'
import { ChecklistAttention, ChecklistRail, PanelHead, RightRail } from './components/Checklist'
import { DemoDock } from './components/DemoDock'
import { DocumentDialog } from './components/DocumentDialog'
import { LearningSheet } from './components/LearningSheet'
import { RightPanel, type RightTab } from './components/RightPanel'
import { Timeline } from './components/Timeline'

type Theme = 'dark' | 'light'
const initialTheme = (): Theme => {
  const saved = store.get<Theme | null>('theme', null)
  if (saved === 'dark' || saved === 'light') return saved
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' } catch { return 'dark' }
}

export default function App() {
  const { bundle, busy, error, act, load, refresh, caseId } = useCase('demo-1')
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [left, setLeft] = useState<boolean>(() => store.get('left-open', true))
  const [right, setRight] = useState<boolean>(() => store.get('right-open', true))
  const [tab, setTab] = useState<RightTab>(() => store.get<RightTab>('rtab', 'ask'))
  const [dock, setDock] = useState<boolean>(() => { try { return window.location.hash !== '#clean' } catch { return true } })
  const [selected, setSelected] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [docOpen, setDocOpen] = useState<string | null>(null)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [learning, setLearning] = useState<LearningState | null>(null)
  const [learningOk, setLearningOk] = useState(false)
  const [learningOpen, setLearningOpen] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('theme', theme) }, [theme])
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
  }, [])

  const eventCount = arr(bundle?.events).length
  // a new bundle makes an earlier integrity check stale
  useEffect(() => { setVerify(null) }, [eventCount])

  const loadLearning = useCallback(async () => {
    try { setLearning(await api.getLearning()); setLearningOk(true) } catch (e) { if (isUnavailable(e)) setLearningOk(false) }
  }, [])
  useEffect(() => { if (bundle) void loadLearning() }, [eventCount, bundle === null, loadLearning]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => (bundle ? checklist(bundle) : []), [bundle])
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
  const onReset = useCallback(() => {
    void act('reset', () => api.reset(), 'Demo reset. A fresh case is open.').then((b) => { if (b) { setSelected(null); setHighlight(null) } })
  }, [act])

  const openLedger = useCallback((seq: number | null) => {
    setRight(true)
    setTab('ledger')
    setHighlight(seq)
  }, [])
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
        <div className="casehead"><span className="brand"><span className="brand-mark" aria-hidden="true" />OpenLoop</span></div>
        {error ? (
          <div className="stack" role="alert">
            <p>{error}</p>
            <div><button type="button" className="btn" onClick={() => void load()}>Try again</button></div>
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
          <CaseHeader bundle={bundle} verify={verify} verifying={verifying} onVerify={doVerify} theme={theme}
            onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} learningCount={learningCount} onLearning={() => { setLearningOpen(true); void loadLearning() }} />
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
                  <ChecklistAttention items={items} selected={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} />
                </Boundary>
              </div>
            </section>
          ) : <ChecklistRail items={items} onOpen={() => setLeft(true)} />}
          <section className="center-col" aria-label="Decision">
            <Boundary name="centre">
              <CenterPane bundle={bundle} selected={selected} busy={busy} onClearSelection={() => setSelected(null)} onResolve={onResolve}
                onOpenLedger={openLedger} onOpenDoc={setDocOpen} onVerify={doVerify} verifyText={v?.text ?? null} />
            </Boundary>
          </section>
          <section className="panel side-panel right-col" aria-label="Ask and activity" hidden={!right}>
            <RightPanel bundle={bundle} caseId={caseId} tab={tab} onTab={setTab} onHide={() => setRight(false)} highlight={highlight}
              onCite={onCite} onAnswered={() => void refresh()} verifyText={v?.text ?? null} verifyOk={!!v?.ok} verifying={verifying} onVerify={doVerify} />
          </section>
          {!right ? <RightRail latest={latest} onOpen={(t) => { if (t) setTab(t); setRight(true) }} /> : null}
        </div>
      </main>
      {dock ? <DemoDock bundle={bundle} busy={busy} onInbound={onInbound} onAdvance={onAdvance} onReset={onReset} /> : null}
      <DocumentDialog bundle={bundle} docId={docOpen} onClose={() => setDocOpen(null)} />
      {learningOk ? <LearningSheet open={learningOpen} onOpenChange={setLearningOpen} state={learning} onChanged={() => { void loadLearning(); void refresh() }} /> : null}
    </>
  )
}
