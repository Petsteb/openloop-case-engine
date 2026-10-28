import { useEffect, useRef, useState } from 'react'
import { arr, sentence, tidy } from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import { Btn } from './Btn'
import { Icon } from './Icon'

// Internal items already say "Internal: …"; the prefix becomes a tag instead.
const label = (s: string) => sentence(tidy(String(s || '').replace(/^Day\s+\d+\s*·\s*/i, '').replace(/^Internal:\s*/i, '').replace(/[“”"]/g, '')))

interface Props {
  bundle: Bundle
  busy: string | null
  onInbound: (id: string, label: string) => void
  onAdvance: (days: number) => void
  onReset: () => void
}

/** Presenter controls, kept out of the product UI. Toggle with D; hidden when the URL hash is #clean. */
export function DemoDock({ bundle, busy, onInbound, onAdvance, onReset }: Props) {
  const [armed, setArmed] = useState(false)
  const [menu, setMenu] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  // Client items first, then the bank-internal staff events.
  const items = [...arr(bundle.scenario).filter((i) => !i.internal), ...arr(bundle.scenario).filter((i) => i.internal)]
  const next = arr(bundle.scenario).find((i) => !i.delivered)
  const reset = () => {
    if (!armed) {
      setArmed(true)
      timer.current = window.setTimeout(() => setArmed(false), 3500)
      return
    }
    if (timer.current) window.clearTimeout(timer.current)
    setArmed(false)
    onReset()
  }
  return (
    <div className="dock" role="toolbar" aria-label="Demo controls">
      <span className="dock-label">Demo</span>
      <div className="menu-wrap">
        {/* the label switches between "Next client event" and "Next internal event": E2E tests select data-testid="dock-next" */}
        <Btn size="sm" variant="primary" data-testid="dock-next" disabled={!next || !!busy} loading={busy === 'inbound'} title={next ? `Send: ${label(next.label)}` : 'Every scripted event was sent'}
          onClick={() => next && onInbound(next.id, label(next.label))}>
          {!next ? 'All events sent' : next.internal ? 'Next internal event' : 'Next client event'}
        </Btn>
      </div>
      <div className="menu-wrap">
        <button type="button" className="btn sm quiet icon-only" aria-label="All scripted events" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Icon name="more" size={14} /></button>
        {menu ? (
          <div className="menu up" role="menu" onMouseLeave={() => setMenu(false)}>
            {items.map((i, k) => (
              <button key={i.id} type="button" role="menuitem" disabled={i.delivered || !!busy}
                className={i.internal && !items[k - 1]?.internal && k > 0 ? 'group-start' : undefined}
                onClick={() => { setMenu(false); onInbound(i.id, label(i.label)) }}>
                <span className="tick">{i.delivered ? <Icon name="check" size={14} /> : null}</span>
                <span className="menu-text">{label(i.label)}</span>
                {i.internal ? <span className="tag">Internal</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span className="sep" aria-hidden="true" />
      {[[1, 'Skip 1 day'], [3, '3 days'], [7, 'A week']].map(([d, l]) => (
        <Btn key={d} size="sm" disabled={!!busy} loading={busy === `advance:${d}`} onClick={() => onAdvance(Number(d))}>{l}</Btn>
      ))}
      <span className="sep" aria-hidden="true" />
      <Btn size="sm" variant="quiet" className={armed ? 'armed' : ''} disabled={!!busy && busy !== 'reset'} loading={busy === 'reset'} onClick={reset}>
        {armed ? 'Click again to reset' : 'Reset demo'}
      </Btn>
    </div>
  )
}
