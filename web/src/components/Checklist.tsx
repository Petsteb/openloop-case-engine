import { useState, type ReactNode } from 'react'
import { byAttention, plural, STATUS_COLOR, type CheckItem } from '@/lib/derive'
import { Icon } from './Icon'
import { StatusWord } from './StatusWord'

function Row({ it, selected, onSelect, showNext = true }: { it: CheckItem; selected: boolean; onSelect: (id: string) => void; showNext?: boolean }) {
  return (
    <button type="button" className={'row' + (it.attention ? ' attn' : '')} aria-pressed={selected} onClick={() => onSelect(it.id)}>
      <span className="rid">{it.id}</span>
      <span className="row-title">{it.title}</span>
      <StatusWord kind={it.kind} />
      <span className="row-reason" title={it.reason}>{it.reason}</span>
      {showNext && it.next ? (
        it.next.type === 'decision'
          ? <span className="row-next"><span className="needs-you">Your decision</span><span>{it.next.text}</span></span>
          : <span className="row-next">{it.next.text}</span>
      ) : null}
    </button>
  )
}

/** Attention first: conflict, review, expired, waiting; verified checks fold into one line. */
export function ChecklistAttention({ items, selected, onSelect }: { items: CheckItem[]; selected: string | null; onSelect: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false)
  const sorted = [...items].sort(byAttention)
  const open = sorted.filter((i) => i.kind !== 'verified')
  const done = sorted.filter((i) => i.kind === 'verified')
  return (
    <div className="cl">
      {open.map((it) => <Row key={it.id} it={it} selected={selected === it.id} onSelect={onSelect} />)}
      {open.length === 0 ? <div className="empty">{items.length ? 'Nothing needs attention.' : 'No checks yet.'}</div> : null}
      {done.length ? (
        <button type="button" className="fold" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
          <Icon name="chevron" size={14} />
          <span className="c-verified"><Icon name="check" size={14} /></span>
          {plural(done.length, 'check')} verified
        </button>
      ) : null}
      {showDone ? done.map((it) => <Row key={it.id} it={it} selected={selected === it.id} onSelect={onSelect} showNext={false} />) : null}
    </div>
  )
}

/** Collapsed checklist: status dots in attention order and a count of problems. */
export function ChecklistRail({ items, onOpen }: { items: CheckItem[]; onOpen: () => void }) {
  const sorted = [...items].sort(byAttention)
  const problems = items.filter((i) => i.attention).length
  return (
    <button type="button" className="rail rail-left" onClick={onOpen} aria-label="Show checklist" title="Show checklist ([)">
      <Icon name="chevron" size={14} />
      <span className="rail-label">Checklist</span>
      <span className="rail-dots" aria-hidden="true">
        {sorted.map((i) => (
          <i key={i.id} className={i.kind === 'waiting' ? 'hollow' : ''} style={{ background: i.kind === 'waiting' ? 'transparent' : STATUS_COLOR[i.kind] }} />
        ))}
      </span>
      {problems ? <span className="rail-count" title={`${problems} need attention`}>{problems}</span> : null}
    </button>
  )
}

export function PanelHead({ title, count, side, onHide, children }: { title?: string; count?: number; side: 'left' | 'right'; onHide: () => void; children?: ReactNode }) {
  const key = side === 'left' ? '[' : ']'
  const name = title ? title.toLowerCase() : 'panel'
  return (
    <div className="panel-head">
      {children ?? <h3>{title}{count != null ? <span className="mono">{count}</span> : null}</h3>}
      <button type="button" className="collapse" onClick={onHide} aria-label={`Hide ${name}`} aria-expanded="true" title={`Hide ${name} (${key})`}>
        <Icon name={side === 'left' ? 'chevronL' : 'chevron'} size={15} />
      </button>
    </div>
  )
}

/** Collapsed right panel: ‹ (last tab), AI pill (Ask), Activity, and the time of the last activity. */
export function RightRail({ latest, onOpen }: { latest: { time: string; text: string } | null; onOpen: (tab?: 'ask' | 'activity') => void }) {
  return (
    <div className="rail rail-right rail-split" role="group" aria-label="AI and activity, hidden">
      <button type="button" className="rail-btn" onClick={() => onOpen()} aria-label="Show AI and activity" aria-expanded="false" title="Show AI and activity (])">
        <Icon name="chevronL" size={14} />
      </button>
      <button type="button" className="rail-btn rail-ai" onClick={() => onOpen('ask')} title="Open the AI chat">AI</button>
      <button type="button" className="rail-btn rail-label" onClick={() => onOpen('activity')} title="Open activity">Activity</button>
      {latest ? (
        <button type="button" className="rail-btn rail-time mono" onClick={() => onOpen('activity')} title={`Last activity: ${latest.text}`}>{latest.time}</button>
      ) : null}
    </div>
  )
}
