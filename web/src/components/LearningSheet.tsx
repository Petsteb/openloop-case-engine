import { useState } from 'react'
import * as api from '@/lib/api'
import { ApiError, isUnavailable } from '@/lib/api'
import { arr, fDate, ms } from '@/lib/derive'
import type { Backtest, LearningState, Proposal } from '@/lib/types'
import { failureText } from '@/hooks/useCase'
import { Btn } from './Btn'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet'

const pct = (v: number | undefined, n: number | undefined) => {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return '–'
  const x = Number(v)
  const rate = x <= 1 ? x : n ? x / n : x
  return `${Math.round(rate * 100)}%`
}

function ProposalRow({ p, onPromoted }: { p: Proposal; onPromoted: () => void }) {
  const [bt, setBt] = useState<Backtest | null>(null)
  const [busy, setBusy] = useState<'bt' | 'promote' | null>(null)
  const [by, setBy] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const run = async () => {
    setBusy('bt'); setErr(null)
    try { setBt(await api.backtest(p.id)) } catch (e) { setErr(isUnavailable(e) ? 'Backtests are not available on this server yet.' : failureText(e)) } finally { setBusy(null) }
  }
  const promote = async () => {
    if (!by.trim()) { setErr('Enter the name of the person approving the check.'); return }
    setBusy('promote'); setErr(null)
    try { await api.promote(p.id, by.trim()); onPromoted() } catch (e) {
      setErr(e instanceof ApiError && e.status === 409 ? 'The person who ruled on these cases can’t approve the check.' : isUnavailable(e) ? 'Promotion is not available on this server yet.' : failureText(e))
    } finally { setBusy(null) }
  }
  return (
    <div className="proposal">
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
        <span className="support">{p.support ?? '–'}</span>
        <span className="muted small">similar rulings{arr(p.ruled_by).length ? ` by ${arr(p.ruled_by).join(', ')}` : ''}</span>
      </div>
      <p>{p.description || p.id}</p>
      <div className="actions">
        <Btn size="sm" onClick={run} loading={busy === 'bt'} disabled={!!busy}>Run backtest</Btn>
      </div>
      {bt ? (
        <div className="bt" aria-label="Backtest result">
          <div><b>{bt.n ?? '–'}</b><span>cases replayed</span></div>
          <div><b>{pct(bt.auto_resolved, bt.n)}</b><span>resolved automatically</span></div>
          <div><b style={{ color: Number(bt.false_approvals) > 0 ? 'var(--conflict)' : undefined }}>{bt.false_approvals ?? '–'}</b><span>false approvals</span></div>
          <div><b>{pct(bt.manual_review_rate, bt.n)}</b><span>still manual review</span></div>
        </div>
      ) : null}
      <div className="promote">
        <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Reviewer name, e.g. analyst-7" aria-label="Reviewer who approves the check" />
        <Btn size="sm" variant="primary" onClick={promote} loading={busy === 'promote'} disabled={!!busy}>Promote</Btn>
      </div>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div>
  )
}

export function LearningSheet({ open, onOpenChange, state, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; state: LearningState | null; onChanged: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="ol-sheet">
        <SheetTitle>Learning</SheetTitle>
        <SheetDescription className="muted small">
          After three similar analyst rulings the system proposes a reusable check. It is backtested on labelled cases and goes live only when a different person approves it.
        </SheetDescription>
        <section>
          <div className="panel-head"><h3>Proposed checks <span className="mono">{arr(state?.proposals).length}</span></h3></div>
          {arr(state?.proposals).length ? arr(state?.proposals).map((p) => <ProposalRow key={p.id} p={p} onPromoted={onChanged} />)
            : <p className="empty">No proposals yet. They appear after three similar rulings.</p>}
        </section>
        <section>
          <div className="panel-head"><h3>Checks in use <span className="mono">{arr(state?.checks).length}</span></h3></div>
          {arr(state?.checks).length ? (
            <ul>
              {arr(state?.checks).map((c) => {
                const at = ms(c.promoted_at)
                return (
                  <li key={c.id} className="feed-item" style={{ gridTemplateColumns: '52px minmax(0, 1fr)' }}>
                    <span className="when">{c.id}</span>
                    <div style={{ minWidth: 0 }}>
                      <div>{c.description || c.proposal_id || 'Learned check'}</div>
                      <div className="who">Promoted by {c.promoted_by || 'a reviewer'}{at !== null ? ` on ${fDate(at)}` : ''}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : <p className="empty">None promoted yet.</p>}
        </section>
      </SheetContent>
    </Sheet>
  )
}
