import { Fragment, type ReactNode } from 'react'
import {
  actionLabel, arr, caseClock, clamp, cleanTitle, compareSlips, DAY, decisionEvidence, fTime, humanize, JUDGE_LABELS,
  linkedEvents, ms, noteText, noteTimes, plain, plural, raisedSeq, reqById, sentence, tidy, type CompareSlip,
} from '@/lib/derive'
import type { Bundle, Exception_ } from '@/lib/types'
import { Btn } from './Btn'
import { Icon } from './Icon'

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function highlight(text: string, marks: string[]): ReactNode {
  const list = marks.filter(Boolean)
  if (!list.length) return text
  const re = new RegExp(`(${list.map(escRe).join('|')})`, 'g')
  return text.split(re).map((part, i) => (list.includes(part) ? <mark key={i}>{part}</mark> : part))
}

function SlipView({ s }: { s: CompareSlip }) {
  return (
    <figure className={'slip' + (s.role === 'new' ? ' is-new' : '')}>
      <figcaption>
        {s.role ? <span className={`age age-${s.role}`}>{s.role === 'new' ? 'New' : 'On file'}</span> : <span />}
        <span className="src" title={s.src}>{s.src}</span>
        {s.doc ? <span className="mono">{s.doc}</span> : <span />}
        {s.meta ? <span className="meta">{s.meta}</span> : null}
      </figcaption>
      <ol>
        {s.lines.map((l, j) => (
          <li key={j} className={`ln ln-${l.k}`}>
            <span className="q">{l.k === 'gap' ? l.t : highlight(l.t, l.marks)}</span>
            {l.note ? <span className="ln-note">{l.note}</span> : null}
          </li>
        ))}
      </ol>
    </figure>
  )
}

const RULE_NAMES: Record<string, string> = {
  'HR-01': 'Tax ID checksum', 'HR-02': 'Active in the register', 'HR-03': 'Document validity', 'HR-04': 'Beneficial owners',
  'HR-05': 'Owner identity documents', 'HR-06': 'Postal code', 'HR-07': 'Debt service coverage', 'HR-08': 'Tax debts',
  'JQ-01': 'Fuzzy match', 'JQ-02': 'Fuzzy match', 'SR-01': 'Insider sequence',
}

interface Props {
  bundle: Bundle
  x: Exception_
  busy: string | null
  onResolve: (x: Exception_, actionId: string) => void
  onOpenLedger: (seq: number | null) => void
}

/** The one raised surface: flat panel, header row, meta properties, on-file vs new comparison, footer actions. */
export function DecisionCard({ bundle, x, busy, onResolve, onOpenLedger }: Props) {
  const clock = caseClock(bundle)
  const req = reqById(bundle, x.requirement_id)
  const sev = String(x.severity || 'medium').toLowerCase()
  const tone = sev === 'high' || sev === 'critical' ? 'var(--conflict)' : 'var(--review)'
  const created = ms(x.created_at)
  const legal = x.kind === 'ubo_discrepancy' || x.requirement_id === 'R2'
    ? arr(bundle.timers).filter((t) => t.kind === 'legal_deadline' && t.status === 'PENDING').map((t) => ms(t.due)).filter((t): t is number => t !== null)[0]
    : undefined
  const insider = x.kind === 'sequence_insider'
  const ev = insider ? null : decisionEvidence(x)
  const slips = ev ? compareSlips(bundle, ev.slips) : []
  const pair = slips.length === 2 && slips.every((s) => s.role)
  const links = insider ? linkedEvents(bundle, x) : []
  const notes = arr(x.notes).map(noteText).filter(Boolean)
  const nTimes = noteTimes(bundle, x.id)
  const j = x.judge && typeof x.judge === 'object' ? x.judge : null
  const thr = Number(j?.threshold ?? bundle.config?.judge_threshold ?? 0.9)
  const probs = j ? Object.entries(j.probs || {}).map(([k, v]) => [k, clamp(Number(v) || 0, 0, 1)] as const) : []
  const why = tidy(plain(String(x.summary || '').replace(/\s*\((?:HR|JQ|SR|GATE)-\d+\)\s*$/, '')))
  const busyHere = busy?.startsWith(`resolve:${x.id}:`) ? busy.split(':')[2] : null
  const ruleId = x.rule?.id ? String(x.rule.id) : null

  return (
    <article className="decision" style={{ ['--tone' as string]: tone }} aria-label={`Decision: ${cleanTitle(x.title)}`}>
      <header className="dec-head">
        <div className="dec-flags">
          <span className="needs-you">Needs your decision</span>
          <span className="sev">{sentence(sev)} priority</span>
        </div>
        <span className="dec-id">{x.id}</span>
      </header>
      <div className="dec-main">
        <h2>{cleanTitle(x.title)}</h2>
        {why ? <p className="why">{why}</p> : null}
        <dl className="props">
          <div><dt>Check</dt><dd><span className="mono">{x.requirement_id || 'MON'}</span>{req ? cleanTitle(req.title) : insider ? 'Staff actions' : 'Monitoring'}</dd></div>
          {ruleId ? <div><dt>Rule</dt><dd><span className="mono">{ruleId}</span>{RULE_NAMES[ruleId] || 'Rule'}</dd></div> : null}
          {legal !== undefined ? (
            <div><dt>Deadline</dt><dd className="warn">AMLR report in {plural(Math.max(0, Math.ceil((legal - clock.now) / DAY)), 'day')}</dd></div>
          ) : null}
          {created !== null ? <div><dt>Raised</dt><dd>Day {clock.dayNo(created)}, {fTime(created)}</dd></div> : null}
        </dl>

        {insider ? (
          <div className="linked" aria-label="Linked events">
            {links.length ? links.map((l, i) => (
              <div key={i} className="linked-row">
                <button type="button" className="cite" onClick={() => onOpenLedger(l.seq)} disabled={l.seq === null}>{l.seq !== null ? `#${l.seq}` : 'event'}</button>
                <span style={{ minWidth: 0 }}>{l.text}</span>
                {l.when !== null ? <span className="when">{clock.fWhen(l.when)}</span> : null}
              </div>
            )) : <p className="empty">The linked events are listed in the ledger.</p>}
          </div>
        ) : pair ? (
          <div className="compare" aria-label="The document on file compared with the new document">
            <SlipView s={slips[0]} />
            <div className="vs" aria-hidden="true"><span>vs</span></div>
            <SlipView s={slips[1]} />
          </div>
        ) : slips.length ? (
          <div className="compare single">{slips.map((s, i) => <Fragment key={i}><SlipView s={s} /></Fragment>)}</div>
        ) : null}

        {ev && ev.matches.length ? (
          <div className="matches" aria-label="What already matches">
            {ev.matches.map((m) => <span key={m}><Icon name="check" size={13} />{m}</span>)}
          </div>
        ) : null}

        {probs.length ? (
          <div className="judge">
            <span className="judge-h">Judge confidence{j?.source ? ` (${String(j.source)})` : ''}</span>
            {probs.map(([k, p]) => {
              const lab = JUDGE_LABELS[k] || sentence(humanize(k))
              return (
                <div key={k} className="jrow">
                  <span>{lab}</span>
                  <span className="jbar" role="img" aria-label={`${lab} ${Math.round(p * 100)}%`}>
                    <i style={{ width: `${p * 100}%` }} />
                    <span className="th" style={{ left: `${clamp(thr, 0, 1) * 100}%` }} />
                  </span>
                  <b>{Math.round(p * 100)}%</b>
                </div>
              )
            })}
            <span className="muted tiny">Needed to accept automatically: {Math.round(thr * 100)}%</span>
          </div>
        ) : null}

        {notes.map((n, i) => (
          <div key={i} className="agent-note">
            <span className="who"><Icon name="spark" size={13} />Agent</span>
            <p>{tidy(n)}</p>
            {nTimes[i] !== undefined ? <time>day {clock.dayNo(nTimes[i])}, {fTime(nTimes[i])}</time> : <span />}
          </div>
        ))}

        {x.rule && (x.rule.id || x.rule.text) ? (
          <div className="rule"><span className="rule-id">{x.rule.id || 'Rule'}</span><p>{tidy(x.rule.text || '')}</p></div>
        ) : null}
      </div>
      <footer className="dec-actions">
        {arr(x.actions).map((a, i) => (
          <Btn key={a.id} variant={i === 0 ? 'primary' : 'secondary'} loading={busyHere === a.id} disabled={!!busy}
            onClick={() => onResolve(x, a.id)}>
            {actionLabel(x, a.id)}
            {i === 0 ? <span className="kbd" aria-hidden="true">⏎</span> : null}
          </Btn>
        ))}
        <span className="spacer" />
        <button type="button" className="linkish" onClick={() => onOpenLedger(raisedSeq(bundle, x.id))}>Open in ledger</button>
      </footer>
    </article>
  )
}
