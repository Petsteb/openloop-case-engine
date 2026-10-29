import { useCallback, useEffect, useState } from 'react'
import { Btn } from '@/components/Btn'
import { useMe } from '@/shared/session'
import { caseHref } from './useHashRoute'
import './learned.css'

/* "What the agent has learned", under the work queue. Analyst rulings are kept as precedents; after enough matching
   rulings the agent proposes a check; a second person (supervisor) approves it after a backtest, and from then on
   it settles the same question in every file. All of it comes from GET /api/learning/overview (staff only). */

type Check = { id: string; description?: string; promoted_by?: string; promoted_at?: string; support?: number
  backtest?: { n?: number; auto_resolved?: number; false_approvals?: number; naive_rule_false_approvals?: number } }
type Proposal = { id: string; support?: number; ruled_by?: string[]; description?: string; examples?: { a: string; b: string; source?: string }[] }
type Precedent = { case_id: string; company: string; a: string; b: string; decision: string; by?: string; exception_id: string; sim_time?: string }
type Applied = { case_id: string; company: string; requirement_id: string; title: string; source: string; reason: string }
type Overview = { checks: Check[]; proposals: Proposal[]; precedents: Precedent[]; applied: Applied[]; history_rulings: number; min_support: number }
type Backtest = NonNullable<Check['backtest']> & { same_pairs_caught?: number; same_pairs_total?: number }

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(typeof data?.detail === 'string' ? data.detail : `Error ${res.status}`), { status: res.status })
  return data as T
}

const day = (t?: string) => (t ? new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '')

export function LearnedPanel({ rev }: { rev?: unknown }) {
  const [data, setData] = useState<Overview | null>(null)
  const [gone, setGone] = useState(false)
  const load = useCallback(() => {
    call<Overview>('GET', '/api/learning/overview').then((d) => { setData(d); setGone(false) })
      .catch((e: { status?: number }) => { if (e.status === 404) setGone(true) })
  }, [])
  useEffect(() => { load() }, [load, rev])
  if (gone) return null  // an older server without the endpoint
  return (
    <section className="lp" aria-labelledby="lp-title">
      <div className="lp-head">
        <h2 id="lp-title">What the agent has learned</h2>
        <p className="muted small">
          Analyst rulings become precedents. After {data?.min_support ?? 3} matching rulings the agent proposes a check; it is used
          in every file only after a second person approves it.
        </p>
      </div>
      {data === null ? <p className="muted small" role="status">Loading…</p> : (
        <div className="lp-cols">
          <Column title="In use" count={data.checks.length}
            empty={`No learned check yet. One is proposed after ${data.min_support} matching rulings.`}>
            {data.checks.map((c) => (
              <li key={c.id} className="lp-item">
                <div className="lp-line"><b className="lp-id">{c.id}</b><span className="muted small">approved by {c.promoted_by ?? '–'}</span></div>
                <p>{c.description}</p>
                {c.backtest ? (
                  <p className="muted small">
                    Backtest: settles {c.backtest.auto_resolved ?? '–'} of {c.backtest.n ?? '–'} past cases, {c.backtest.false_approvals ?? '–'} wrong
                    {typeof c.backtest.naive_rule_false_approvals === 'number' ? ` (the naive rule: ${c.backtest.naive_rule_false_approvals} wrong)` : ''}.
                  </p>
                ) : null}
              </li>
            ))}
          </Column>
          <Column title="Waiting for a second person" count={data.proposals.length} empty="Nothing to approve.">
            {data.proposals.map((p) => <ProposalItem key={p.id} p={p} onDone={load} />)}
          </Column>
          <Column title="Rulings it keeps" count={data.precedents.length}
            empty={`No analyst rulings in these files yet (${data.history_rulings} from the bank's history).`}>
            {data.precedents.map((p) => (
              <li key={`${p.case_id}/${p.exception_id}`} className="lp-item">
                <div className="lp-line">
                  <a href={caseHref(p.case_id)}>{p.company}</a>
                  <span className="muted small">{p.by ?? 'analyst'}{p.sim_time ? `, ${day(p.sim_time)}` : ''}</span>
                </div>
                <p className="lp-pair"><span>{p.a}</span><span aria-label="ruled the same as">≈</span><span>{p.b}</span></p>
              </li>
            ))}
            {data.applied.length ? (
              <li className="lp-item lp-applied">
                <b className="small">Reused {data.applied.length} {data.applied.length === 1 ? 'time' : 'times'} without a new card</b>
                <ul>
                  {data.applied.map((a) => (
                    <li key={`${a.case_id}/${a.requirement_id}`} className="small">
                      <a href={caseHref(a.case_id)}>{a.company}</a> <span className="muted">· {a.title} · {a.source}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}
          </Column>
        </div>
      )}
    </section>
  )
}

function Column({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div className="lp-col">
      <h3>{title}<span className="lp-n">{count}</span></h3>
      {count ? <ul className="lp-list">{children}</ul> : <p className="muted small lp-empty">{empty}</p>}
    </div>
  )
}

function ProposalItem({ p, onDone }: { p: Proposal; onDone: () => void }) {
  const me = useMe()
  const [bt, setBt] = useState<Backtest | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canPromote = me ? (!me.auth || me.perms.includes('promote')) : false
  const backtest = async () => {
    setBusy(true); setErr(null)
    try { setBt(await call<Backtest>('POST', `/api/learning/proposals/${encodeURIComponent(p.id)}/backtest`, {})) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const promote = async () => {
    setBusy(true); setErr(null)
    try {
      // the server records the signed-in person; the name below only matters when login is off
      await call('POST', `/api/learning/proposals/${encodeURIComponent(p.id)}/promote`, { by: me?.staff?.staff_id ?? 'supervisor-1' })
      onDone()
    } catch (e) {
      setErr((e as { status?: number }).status === 409 ? 'You ruled on these cases, so someone else must approve the check.' : (e as Error).message)
    } finally { setBusy(false) }
  }
  return (
    <li className="lp-item">
      <div className="lp-line"><b>{p.support} matching rulings</b><span className="muted small">by {(p.ruled_by ?? []).join(', ') || '–'}</span></div>
      <p>{p.description}</p>
      {(p.examples ?? []).slice(-2).map((x, i) => (
        <p key={i} className="lp-pair small"><span>{x.a}</span><span aria-hidden="true">≈</span><span>{x.b}</span></p>
      ))}
      {bt ? (
        <p className="small" role="status">
          Backtest on {bt.n} labelled cases: settles {bt.auto_resolved}, <b>{bt.false_approvals} wrong</b>
          {typeof bt.naive_rule_false_approvals === 'number' ? `; the naive rule would get ${bt.naive_rule_false_approvals} wrong` : ''}.
        </p>
      ) : null}
      {err ? <p className="small c-conflict" role="alert">{err}</p> : null}
      <div className="lp-actions">
        <Btn size="sm" onClick={() => void backtest()} loading={busy && !bt}>Run backtest</Btn>
        {canPromote
          ? <Btn size="sm" variant="primary" onClick={() => void promote()} disabled={busy || !bt}>Approve check</Btn>
          : <span className="muted small">A supervisor approves it.</span>}
      </div>
    </li>
  )
}
