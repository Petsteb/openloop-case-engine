import {
  actionLabel, arr, caseClock, checklist, cleanTitle, docName, isComplete, isOnHold, kindOf, ms, openExceptions, plain,
  tidy, type CheckItem,
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

  const back = selected ? (
    <button type="button" className="linkish" onClick={p.onClearSelection}>
      {open.length ? `Back to ${open.length === 1 ? 'the decision' : `all ${open.length} decisions`}` : 'Back to the summary'}
    </button>
  ) : null

  // An explicitly selected row shows its own detail (or its decision card).
  if (sel) {
    return (
      <div className="stack">
        {back}
        {selEx ? <DecisionCard bundle={bundle} x={selEx} busy={p.busy} onResolve={p.onResolve} onOpenLedger={p.onOpenLedger} />
          : <RequirementDetail bundle={bundle} r={sel} onOpenDoc={p.onOpenDoc} />}
      </div>
    )
  }
  if (open.length) {
    return (
      <div className="stack">
        {open.map((x) => <DecisionCard key={x.id} bundle={bundle} x={x} busy={p.busy} onResolve={p.onResolve} onOpenLedger={p.onOpenLedger} />)}
        <ResolvedList bundle={bundle} />
      </div>
    )
  }
  if (isOnHold(bundle)) {
    return (
      <div className="stack">
        <section className="hold-card">
          <span className="st st-hold"><i aria-hidden="true" />On hold</span>
          <h2>File on hold</h2>
          <p className="why">The file was escalated to compliance. The agent takes no further action until compliance releases it.</p>
        </section>
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
