import { useEffect, useRef, useState } from 'react'
import { arr, sentence, tidy } from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import { Btn } from './Btn'
import { Icon } from './Icon'

// Internal items already say "Internal: …"; the prefix becomes a tag instead.
/** [days, button label, menu label]. The first stays a button at every width. */
const SKIPS: [number, string, string][] = [[1, 'Skip 1 day', 'Skip 1 day'], [3, '3 days', 'Skip 3 days'], [7, 'A week', 'Skip a week']]
const label = (s: string) => sentence(tidy(String(s || '').replace(/^Day\s+\d+\s*·\s*/i, '').replace(/^Internal:\s*/i, '').replace(/[“”"]/g, '')))

interface Props {
  bundle: Bundle
  caseId: string
  busy: string | null
  onInbound: (id: string, label: string) => void
  onAdvance: (days: number) => void
  /** demo-1 only: back to the start of the scripted demo. */
  onReset: () => void
  /** Any other case: wipe and reseed every demo case (the screen then goes to the work queue). */
  onResetAll: () => void
}

/** Presenter controls, kept out of the product UI. Toggle with D; hidden when the page was opened as #clean.
 *  The scripted events are per case (`bundle.scenario`); a case without any keeps only the clock and the reset. */
export function DemoDock({ bundle, caseId, busy, onInbound, onAdvance, onReset, onResetAll }: Props) {
  const [armed, setArmed] = useState(false)
  const [menu, setMenu] = useState(false)
  const timer = useRef<number | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  // Touch screens have no mouseleave: a tap outside the dock or Escape closes the menu.
  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => { if (dockRef.current && e.target instanceof Node && !dockRef.current.contains(e.target)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [menu])
  // Client items first, then the bank-internal staff events.
  const items = [...arr(bundle.scenario).filter((i) => !i.internal), ...arr(bundle.scenario).filter((i) => i.internal)]
  const next = arr(bundle.scenario).find((i) => !i.delivered)
  const scripted = items.length > 0
  const isDemo = caseId === 'demo-1'
  const reset = () => {
    if (!armed) {
      setArmed(true)
      timer.current = window.setTimeout(() => setArmed(false), 3500)
      return
    }
    if (timer.current) window.clearTimeout(timer.current)
    setArmed(false)
    if (isDemo) onReset()
    else onResetAll()
  }
  const resetText = isDemo ? (armed ? 'Click again to reset' : 'Reset demo') : (armed ? 'Click again to reset all' : 'Reset all demo cases')
  const resetTitle = isDemo ? undefined : 'Wipes every case and reseeds the demo files, then opens the work queue'
  // One row at every width: below 1024px (CSS) the 3-day and week skips and the reset move into the ⋯ menu.
  return (
    <div className="dock" role="toolbar" aria-label="Demo controls" ref={dockRef}>
      <span className="dock-label">Demo</span>
      {scripted ? (
        <div className="menu-wrap">
          {/* the label switches between "Next client event" and "Next internal event": E2E tests select data-testid="dock-next" */}
          <Btn size="sm" variant="primary" data-testid="dock-next" disabled={!next || !!busy} loading={busy === 'inbound'} title={next ? `Send: ${label(next.label)}` : 'Every scripted event was sent'}
            onClick={() => next && onInbound(next.id, label(next.label))}>
            {!next ? 'All events sent' : next.internal ? 'Next internal event' : 'Next client event'}
          </Btn>
        </div>
      ) : null}
      {/* without scripted events the menu only holds the overflow, so it shows only where the overflow does */}
      <div className={`menu-wrap dock-more${scripted ? '' : ' dock-narrow'}`}>
        <button type="button" className="btn sm quiet icon-only" aria-label={scripted ? 'All scripted events and more' : 'More demo controls'} aria-expanded={menu}
          aria-haspopup="menu" onClick={() => setMenu((v) => !v)}><Icon name="more" size={14} /></button>
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
            {SKIPS.slice(1).map(([d, , long], k) => (
              <button key={d} type="button" role="menuitem" disabled={!!busy} className={`dock-narrow${k === 0 && scripted ? ' group-start' : ''}`}
                onClick={() => { setMenu(false); onAdvance(d) }}>
                <span className="tick" /><span className="menu-text">{long}</span>
              </button>
            ))}
            {/* arm-then-confirm, like the button: the first click keeps the menu open */}
            <button type="button" role="menuitem" disabled={!!busy && busy !== 'reset'} className={`dock-narrow group-start${armed ? ' armed' : ''}`} title={resetTitle}
              onClick={() => { if (armed) setMenu(false); reset() }}>
              <span className="tick" /><span className="menu-text">{resetText}</span>
            </button>
          </div>
        ) : null}
      </div>
      <span className="sep" aria-hidden="true" />
      {SKIPS.map(([d, l], k) => (
        <Btn key={d} size="sm" className={k ? 'dock-wide' : undefined} disabled={!!busy} loading={busy === `advance:${d}`} onClick={() => onAdvance(d)}>{l}</Btn>
      ))}
      <span className="sep dock-wide" aria-hidden="true" />
      <Btn size="sm" variant="quiet" className={`dock-wide${armed ? ' armed' : ''}`} disabled={!!busy && busy !== 'reset'} loading={busy === 'reset'} onClick={reset} title={resetTitle}>
        {resetText}
      </Btn>
    </div>
  )
}
