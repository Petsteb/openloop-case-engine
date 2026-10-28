import { Fragment, useState, type ReactNode } from 'react'
import {
  actionLabel, arr, caseClock, clamp, cleanTitle, compareSlips, confirmedBetween, DAY, decisionEvidence, fTime, gapText, humanize,
  JUDGE_LABELS, linkedEvents, ms, noteText, noteTimes, plain, plural, raisedSeq, reqById, sentence, softCaps, tidy, type CompareSlip,
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

function SlipView({ s, showSame, onOpenDoc }: { s: CompareSlip; showSame: boolean; onOpenDoc: (id: string) => void }) {
  const lines = showSame ? s.lines : s.lines.filter((l) => l.k !== 'same')
  return (
    <figure className={'slip' + (s.role === 'new' ? ' is-new' : '')}>
      <figcaption>
        {s.role ? <span className={`age age-${s.role}`}>{s.role === 'new' ? 'New' : 'On file'}</span> : <span />}
        <span className="src" title={s.src}>{s.src}</span>
        {s.doc ? (
          <button type="button" className="cite slip-doc" onClick={() => onOpenDoc(String(s.doc))} title={`Open the whole document (${s.doc})`}>{s.doc}</button>
        ) : <span />}
        {s.meta ? <span className="meta">{s.meta}</span> : null}
      </figcaption>
      <ol>
        {!lines.length ? <li className="ln ln-gap"><span className="q">No differences in this document</span></li> : null}
        {lines.map((l, j) => (
          <li key={j} className={`ln ln-${l.k}`}>
            <span className="q">{l.k === 'gap' ? l.t : highlight(l.t, l.marks)}</span>
            {l.note ? <span className="ln-note">{l.note}</span> : null}
          </li>
        ))}
      </ol>
    </figure>
  )
}

const pct = (p: number) => Math.round(p * 100)
const num01 = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : clamp(Number(v), 0, 1))

/** One confidence track; the dashed tick is the mark it must pass to accept automatically. */
function Bar({ label, p, thr, title }: { label: string; p: number; thr: number | null; title?: string }) {
  return (
    <div className="jrow" title={title}>
      <span>{label}</span>
      <span className="jbar" role="img" aria-label={`${label} ${pct(p)}%${thr !== null ? `, mark at ${pct(thr)}%` : ''}`}>
        <i style={{ width: `${p * 100}%` }} />
        {thr !== null ? <span className="th" style={{ left: `${thr * 100}%` }} /> : null}
      </span>
      <b>{pct(p)}%</b>
    </div>
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
  onOpenDoc: (docId: string) => void
}

/** The one raised surface: flat panel, header row, meta properties, on-file vs new comparison, footer actions. */
export function DecisionCard({ bundle, x, busy, onResolve, onOpenLedger, onOpenDoc }: Props) {
  const clock = caseClock(bundle)
  const req = reqById(bundle, x.requirement_id)
  const sev = String(x.severity || 'medium').toLowerCase()
  const tone = sev === 'high' || sev === 'critical' ? 'var(--conflict)' : 'var(--review)'
  const created = ms(x.created_at)
  const legal = x.kind === 'ubo_discrepancy' || x.requirement_id === 'R2'
    ? arr(bundle.timers).filter((t) => t.kind === 'legal_deadline' && t.status === 'PENDING').map((t) => ms(t.due)).filter((t): t is number => t !== null)[0]
    : undefined
  // Both show two linked ledger events on one rail instead of document quotes.
  const dispute = x.kind === 'client_dispute'
  const insider = x.kind === 'sequence_insider' || dispute
  const ev = insider ? null : decisionEvidence(x)
  const slips = ev ? compareSlips(bundle, ev.slips) : []
  const pair = slips.length === 2 && slips.every((s) => s.role)
  const links = insider ? linkedEvents(bundle, x) : []
  const notes = arr(x.notes).map(noteText).filter(Boolean)
  const nTimes = noteTimes(bundle, x.id)
  const j = x.judge && typeof x.judge === 'object' ? x.judge : null
  const thr = Number(j?.threshold ?? bundle.config?.judge_threshold ?? 0.9)
  const probs = j ? Object.entries(j.probs || {}).map(([k, v]) => [k, clamp(Number(v) || 0, 0, 1)] as const) : []
  // v2: an independent similarity check must also pass its own mark. The classifier's mark sits on its "same" row only.
  const so = j?.second_opinion && typeof j.second_opinion === 'object' ? j.second_opinion : null
  const soP = num01(so?.p_same)
  const soThr = num01(so?.threshold)
  const sameKey = probs.find(([k]) => k.startsWith('same'))?.[0]
  const src = j?.source ? String(j.source) : ''
  // A card is only raised when auto-accept failed, so a missing flag still means "not accepted".
  const verdict = j?.auto_accept === true ? 'Accepted automatically.' : 'Not accepted automatically.'
  const why = softCaps(tidy(plain(String(x.summary || '').replace(/\s*\((?:HR|JQ|SR|GATE)-\d+\)\s*$/, ''))))
  const busyHere = busy?.startsWith(`resolve:${x.id}:`) ? busy.split(':')[2] : null
  const ruleId = x.rule?.id ? String(x.rule.id) : null
  const [showSame, setShowSame] = useState(false)
  const hasSame = slips.some((sl) => sl.lines.some((l) => l.k === 'same')) || !!ev?.matches.length

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
        {why ? <p className="why dec-why">{why}</p> : null}
        <dl className="props">
          <div><dt>Check</dt><dd><span className="mono">{x.requirement_id || 'MON'}</span>{req ? cleanTitle(req.title) : dispute ? 'Client contact details' : insider ? 'Staff actions' : 'Monitoring'}</dd></div>
          {ruleId ? <div><dt>Rule</dt><dd><span className="mono">{ruleId}</span>{dispute ? 'Client disputes a staff change' : RULE_NAMES[ruleId] || 'Rule'}</dd></div> : null}
          {legal !== undefined ? (
            <div><dt>Deadline</dt><dd className="warn">AMLR report in {plural(Math.max(0, Math.ceil((legal - clock.now) / DAY)), 'day')}</dd></div>
          ) : null}
          {created !== null ? <div><dt>Raised</dt><dd>Day {clock.dayNo(created)}, {fTime(created)}</dd></div> : null}
        </dl>

        {insider ? (
          links.length ? (
            <ol className="seq" aria-label="The two linked events, in order">
              {links.map((l, i) => {
                const prev = i > 0 ? links[i - 1] : null
                const gap = prev ? gapText(prev.when, l.when) : null
                return (
                  <Fragment key={i}>
                    {prev ? (
                      <li className="seq-gap">
                        {sentence(gap || 'later')}, {dispute ? 'the client said they did not make this change'
                          : confirmedBetween(bundle, prev.seq, l.seq) ? 'after a client confirmation' : 'with no client confirmation in between'}
                      </li>
                    ) : null}
                    <li className="seq-ev">
                      <span className="seq-step">{i === 0 ? 'First' : 'Then'}</span>
                      <p>{l.text}</p>
                      <span className="seq-meta">
                        <button type="button" className="cite" onClick={() => onOpenLedger(l.seq)} disabled={l.seq === null}>{l.seq !== null ? `#${l.seq}` : 'event'}</button>
                        {l.when !== null ? <span>{clock.fWhen(l.when)}</span> : null}
                      </span>
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          ) : <p className="empty">The linked events are listed in the ledger.</p>
        ) : pair ? (
          <div className="compare" aria-label="The document on file compared with the new document">
            <SlipView s={slips[0]} showSame={showSame} onOpenDoc={onOpenDoc} />
            <div className="vs" aria-hidden="true"><span>vs</span></div>
            <SlipView s={slips[1]} showSame={showSame} onOpenDoc={onOpenDoc} />
          </div>
        ) : slips.length ? (
          <div className="compare single">{slips.map((s, i) => <Fragment key={i}><SlipView s={s} showSame={showSame} onOpenDoc={onOpenDoc} /></Fragment>)}</div>
        ) : null}

        {!insider && hasSame ? (
          <div><button type="button" role="switch" aria-checked={showSame} className="switch" onClick={() => setShowSame((v) => !v)}>
            <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
            Show what already matches
          </button></div>
        ) : null}

        {showSame && ev && ev.matches.length ? (
          <div className="matches" aria-label="What already matches">
            {ev.matches.map((m) => <span key={m}><Icon name="check" size={13} />{m}</span>)}
          </div>
        ) : null}

        {probs.length || soP !== null ? (
          <div className="judge">
            <span className="judge-h">
              Judge confidence
              {src ? <span className={'judge-src' + (/fail|error|fallback/i.test(src) ? ' c-review' : '')}>{src}</span> : null}
            </span>
            {probs.map(([k, p]) => (
              <Bar key={k} label={JUDGE_LABELS[k] || sentence(humanize(k))} p={p} thr={!sameKey || k === sameKey ? clamp(thr, 0, 1) : null} />
            ))}
            {soP !== null ? (
              <Bar label="Similarity check" p={soP} thr={soThr} title={so?.method ? `Second opinion: ${String(so.method)}` : undefined} />
            ) : null}
            {so ? (
              <p className="judge-note">
                <b>{verdict}</b> Auto-accept needs both bars past their marks
                {soThr !== null ? ` (classifier ${pct(clamp(thr, 0, 1))}%, similarity check ${pct(soThr)}%)` : ''}.
              </p>
            ) : <span className="muted tiny">Needed to accept automatically: {pct(clamp(thr, 0, 1))}%</span>}
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
