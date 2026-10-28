import { useEffect, useRef, useState } from 'react'
import {
  actionLabel, arr, caseClock, checklist, cleanTitle, docName, fTime, holdInfo, isComplete, isOnHold, kindOf, linkedEvents, ms,
  openExceptions, plain, tidy, type CheckItem,
} from '@/lib/derive'
import type { Bundle, Exception_, Requirement } from '@/lib/types'
import { Btn } from './Btn'
import { DecisionCard } from './DecisionCard'
import { Icon } from './Icon'
import { StatusIcon, StatusWord } from './StatusWord'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface Props {
  bundle: Bundle
  selected: string | null
  busy: string | null
  onClearSelection: () => void
  onResolve: (x: Exception_, actionId: string) => void
  onOpenLedger: (seq: number | null) => void
  onOpenDoc: (docId: string) => void
  onVerify: () => void
  verifyText: string | null
  onRelease: (note: string) => void
}

function ruleTexts(b: Bundle) {
  const m = new Map<string, string>()
  arr(b.exceptions).forEach((x) => { if (x.rule?.id) m.set(x.rule.id, x.rule.text || '') })
  return m
}

function ResolvedList({ bundle }: { bundle: Bundle }) {
  const clock = caseClock(bundle)
  const done = arr(bundle.exceptions).filter((x) => x.status !== 'OPEN')
  if (!done.length) return null
  return (
    <section className="panel resolved" aria-label="Resolved decisions">
      <div className="panel-head"><h3>Decided so far <span className="mono">{done.length}</span></h3></div>
      <ul>
        {done.map((x) => {
          const r = x.resolution || {}
          const at = ms(r.at)
          const by = String(r.by?.type || '')
          return (
            <li key={x.id}>
              <span className="c-verified"><Icon name="check" size={14} /></span>
              <span style={{ minWidth: 0 }}>{cleanTitle(x.title)} <span className="mono muted tiny">{x.id}</span></span>
              <span className="what">
                {actionLabel(x, r.action_id)}
                {by || at !== null ? `. ${by === 'analyst' ? 'Decided by the analyst' : by ? `Closed by the ${by === 'system' ? 'rules engine' : by}` : 'Decided'}${at !== null ? ` on day ${clock.dayNo(at)}` : ''}.` : ''}
                {r.note ? ` Note: ${String(r.note)}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function RequirementDetail({ bundle, r, onOpenDoc }: { bundle: Bundle; r: Requirement; onOpenDoc: (id: string) => void }) {
  const clock = caseClock(bundle)
  const kind = kindOf(r.status)
  const texts = ruleTexts(bundle)
  const ev = arr(r.evidence)
  const upd = ms(r.updated_at)
  return (
    <section className="detail" aria-label={`Check ${r.id}`}>
      <div className="dec-kicker"><span className="mono" style={{ border: '1px solid var(--line-2)', borderRadius: 999, padding: '0 7px', fontSize: 11 }}>{r.id}</span><StatusWord kind={kind} /></div>
      <h2>{cleanTitle(r.title)}</h2>
      {r.reason ? <p className="reason">{tidy(plain(r.reason))}</p> : null}
      {arr(r.rule_ids).length ? (
        <div className="rule-ids">Rules checked:
          {arr(r.rule_ids).map((id) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild><span className="chip" tabIndex={0}>{id}</span></TooltipTrigger>
              <TooltipContent className="ol-tip">{texts.get(id) ? `${id}: ${tidy(texts.get(id))}` : `Rule ${id}`}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : null}
      {ev.length ? (
        <div className="papers">
          {ev.map((q, i) => (
            <figure key={i} className="paper">
              <pre>{q.quote}</pre>
              <figcaption>
                {q.doc_id ? <button type="button" className="cite" onClick={() => onOpenDoc(String(q.doc_id))}>{q.doc_id}</button> : null}
                {' '}{q.label || docName(bundle, q.doc_id)}{q.field ? `, ${String(q.field).replace(/_/g, ' ')}` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <p className="muted small">No evidence yet. The agent checks this as soon as the document arrives.</p>}
      {upd !== null ? <p className="muted tiny">Last changed {clock.fWhen(upd)}</p> : null}
    </section>
  )
}

/** While ON_HOLD this owns the centre: nothing else may read as "all clear". Release takes a second click and an optional note. */
function HoldBanner({ bundle, busy, onRelease, onOpenLedger }: {
  bundle: Bundle; busy: string | null; onRelease: (note: string) => void; onOpenLedger: (seq: number | null) => void
}) {
  const clock = caseClock(bundle)
  const { x, since, seq } = holdInfo(bundle)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const input = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (confirming) input.current?.focus() }, [confirming])
  // a client dispute has its own rule (SR-02; older servers reused SR-01), so it is told apart by its kind first
  const dispute = x?.kind === 'client_dispute'
  const insider = !dispute && (x?.kind === 'sequence_insider' || x?.rule?.id === 'SR-01')
  const ruleId = x?.rule?.id ? String(x.rule.id) : insider ? 'SR-01' : null
  const links = x && (insider || dispute) ? linkedEvents(bundle, x) : []
  const by = String(x?.resolution?.by?.type || '')
  const cancel = () => { setConfirming(false); setNote('') }
  const release = () => { if (!busy) onRelease(note.trim()) }
  return (
    <article className="decision hold" style={{ ['--tone' as string]: 'var(--conflict)' }} aria-label="File on hold">
      <header className="dec-head">
        <div className="dec-flags"><span className="st st-hold"><i aria-hidden="true" />On hold</span></div>
        {x ? <span className="dec-id">{x.id}</span> : null}
      </header>
      <div className="dec-main">
        <h2>On hold — escalated to compliance</h2>
        <p className="why dec-why">
          {dispute
            ? 'The agent is paused. A bank employee changed the client’s contact details, and the client says they did not ask for it. Nothing moves on this file until compliance releases it.'
            : insider
              ? `The agent is paused. A bank employee changed the client's contact details and then started a credit action for the same client (insider pattern ${ruleId}). Nothing moves on this file until compliance releases it.`
              : 'The agent is paused. Nothing moves on this file until compliance releases it.'}
        </p>
        <dl className="props">
          {since !== null ? (
            <div><dt>Escalated</dt><dd>Day {clock.dayNo(since)}, {fTime(since)}{by === 'analyst' ? ', by the analyst' : ''}</dd></div>
          ) : null}
          {ruleId ? <div><dt>Rule</dt><dd><span className="mono">{ruleId}</span>{dispute ? 'Client disputes a staff change' : insider ? 'Insider sequence' : 'Rule'}</dd></div> : null}
          {links.length ? (
            <div><dt>Linked events</dt><dd>
              {links.map((l, i) => (
                <button key={i} type="button" className="cite" onClick={() => onOpenLedger(l.seq)} disabled={l.seq === null} title={l.text}>
                  {l.seq !== null ? `#${l.seq}` : 'event'}
                </button>
              ))}
            </dd></div>
          ) : null}
          <div><dt>Waiting for</dt><dd>Compliance</dd></div>
        </dl>
      </div>
      <footer className="dec-actions">
        {confirming ? (
          <>
            <input ref={input} className="release-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)}
              placeholder="Note for the ledger (optional)" aria-label="Note for the ledger (optional)"
              onKeyDown={(e) => { if (e.key === 'Enter') release(); else if (e.key === 'Escape') cancel() }} />
            <Btn variant="primary" loading={busy === 'release'} disabled={!!busy} onClick={release}>
              Confirm release<span className="kbd" aria-hidden="true">⏎</span>
            </Btn>
            <Btn variant="quiet" disabled={busy === 'release'} onClick={cancel}>Cancel</Btn>
          </>
        ) : (
          <Btn variant="primary" disabled={!!busy} onClick={() => setConfirming(true)}>Release hold</Btn>
        )}
        <span className="spacer" />
        <button type="button" className="linkish" onClick={() => onOpenLedger(seq)}>Open in ledger</button>
      </footer>
    </article>
  )
}

function CheckRows({ items }: { items: CheckItem[] }) {
  return (
    <div className="cl">
      {items.map((it) => (
        <div key={it.id} className="row" style={{ cursor: 'default' }}>
          <span className="rid">{it.id}</span>
          <div className="row-title">{it.title}</div>
          <StatusWord kind={it.kind} />
          <div className="row-reason" title={it.reason}>{it.reason}</div>
        </div>
      ))}
    </div>
  )
}

export function CenterPane(p: Props) {
  const { bundle, selected } = p
  const open = openExceptions(bundle)
  const items = checklist(bundle)
  const sel = selected ? arr(bundle.requirements).find((r) => r.id === selected) : undefined
  const selEx = sel ? open.find((x) => x.requirement_id === sel.id) : undefined
  // On hold, the banner comes first in every branch (a selected row or a leftover open card must not hide it).
  const hold = isOnHold(bundle)
    ? <HoldBanner bundle={bundle} busy={p.busy} onRelease={p.onRelease} onOpenLedger={p.onOpenLedger} />
    : null

  const back = selected ? (
    <button type="button" className="linkish" onClick={p.onClearSelection}>
      {open.length ? `Back to ${open.length === 1 ? 'the decision' : `all ${open.length} decisions`}` : 'Back to the summary'}
    </button>
  ) : null

  // An explicitly selected row shows its own detail (or its decision card).
  if (sel) {
    return (
      <div className="stack">
        {hold}
        {back}
        {selEx ? <DecisionCard bundle={bundle} x={selEx} busy={p.busy} onResolve={p.onResolve} onOpenLedger={p.onOpenLedger} onOpenDoc={p.onOpenDoc} />
          : <RequirementDetail bundle={bundle} r={sel} onOpenDoc={p.onOpenDoc} />}
      </div>
    )
  }
  if (open.length) {
    return (
      <div className="stack">
        {hold}
        {open.map((x) => <DecisionCard key={x.id} bundle={bundle} x={x} busy={p.busy} onResolve={p.onResolve} onOpenLedger={p.onOpenLedger} onOpenDoc={p.onOpenDoc} />)}
        <ResolvedList bundle={bundle} />
      </div>
    )
  }
  if (hold) {
    return (
      <div className="stack">
        {hold}
        <ResolvedList bundle={bundle} />
      </div>
    )
  }
  if (isComplete(bundle)) {
    return (
      <div className="stack">
        <section className="raised complete" aria-label="File complete">
          <span className="c-verified"><Icon name="check" size={28} /></span>
          <h2>File complete</h2>
          <p>All {items.length} checks are verified. The agent stopped here because the credit decision belongs to a person.</p>
          <CheckRows items={items} />
          <div className="led-top">
            <span className="muted small">The ledger holds {arr(bundle.events).length} events, each linked to the one before.</span>
            <Btn size="sm" onClick={p.onVerify}>Check ledger</Btn>
            {p.verifyText ? <span className="verify-ok">{p.verifyText}</span> : null}
          </div>
        </section>
        <ResolvedList bundle={bundle} />
      </div>
    )
  }
  const waiting = items.filter((i) => i.kind !== 'verified')
  return (
    <div className="stack">
      <section className="panel" aria-label="Summary">
        <div className="panel-head"><h3>No decisions for you right now</h3></div>
        <div className="panel-body">
          <p className="muted" style={{ marginBottom: 8 }}>
            {arr(bundle.events).some((e) => e.type === 'DOCUMENT_RECEIVED')
              ? 'The agent is waiting on the client for these items and reminds them automatically every 3 days.'
              : 'The case is open. The agent starts as soon as the client sends the application pack.'}
          </p>
          <div className="cl">
            {waiting.map((it) => (
              <div key={it.id} className={'row' + (it.attention ? ' attn' : '')} style={{ cursor: 'default' }}>
                <StatusIcon kind={it.kind} />
                <div className="row-title">{it.title}</div>
                <StatusWord kind={it.kind} />
                <div className="row-reason" title={it.reason}>{it.reason}</div>
                {it.next && it.next.type === 'waiting' ? <div className="row-next">{it.next.text}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
      <ResolvedList bundle={bundle} />
    </div>
  )
}
