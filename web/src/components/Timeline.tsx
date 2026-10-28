import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import {
  caseClock, clamp, DAY, deadlines, fTime, fWeekDate, HOUR, MIN, plural, timelineItems,
  type Deadline, type Lane, type TLItem,
} from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import { store } from '@/lib/store'
import { Icon } from './Icon'

function useWidth<T extends HTMLElement>(fallback = 900) {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setW(el.getBoundingClientRect().width || fallback)
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, w] as const
}

const TICK_STEPS = [HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY]
function makeTicks(a: number, b: number, plotW: number) {
  const span = b - a
  const step = TICK_STEPS.find((s) => (s / span) * plotW >= 70) || 14 * DAY
  const ticks: number[] = []
  for (let t = Math.ceil(a / step) * step; t <= b; t += step) ticks.push(t)
  return { step, ticks }
}

const LANES: { id: Lane; label: string }[] = [
  { id: 'client', label: 'Client' },
  { id: 'agent', label: 'Agent' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'deadline', label: 'Deadlines' },
]
const LANE_COLOR: Record<Lane, string> = { client: 'var(--ink)', agent: 'var(--muted)', analyst: 'var(--attn)', deadline: 'var(--expired)' }
const LANE_NAME: Record<Lane, string> = { client: 'Client', agent: 'Agent', analyst: 'Analyst', deadline: 'Deadline' }

interface Cluster { x: number; x0: number; x1: number; items: TLItem[] }
function clusterItems(items: TLItem[], x: (t: number) => number, gap: number): Cluster[] {
  const out: Cluster[] = []
  items.forEach((it) => {
    const px = x(it.t)
    const last = out[out.length - 1]
    if (last && px - last.x1 < gap) { last.items.push(it); last.x1 = px } else out.push({ x: px, x0: px, x1: px, items: [it] })
  })
  return out.map((c) => ({ ...c, x: (c.x0 + c.x1) / 2 }))
}

function markShape(kind: TLItem['kind'], cx: number, cy: number): ReactNode {
  switch (kind) {
    case 'doc': return <circle className="m-doc" cx={cx} cy={cy} r="6" />
    case 'email': return <circle className="m-email" cx={cx} cy={cy} r="5.5" />
    case 'blocked': return <path className="m-blocked" d={`M${cx - 5} ${cy - 5}L${cx + 5} ${cy + 5}M${cx + 5} ${cy - 5}L${cx - 5} ${cy + 5}`} />
    case 'decision': return <rect className="m-decision" x={cx - 5} y={cy - 5} width="10" height="10" transform={`rotate(45 ${cx} ${cy})`} />
    case 'staff': return <rect className="m-staff" x={cx - 4.5} y={cy - 4.5} width="9" height="9" transform={`rotate(45 ${cx} ${cy})`} />
    case 'step': return <circle className="m-step" cx={cx} cy={cy} r="3" />
    default: return <rect className="m-agent" x={cx - 4.5} y={cy - 4.5} width="9" height="9" rx="2" />
  }
}

interface Sel { key: string; items: TLItem[] }
type Preset = 'day' | 'week' | 'twoweeks' | 'all'

export function Timeline({ bundle }: { bundle: Bundle }) {
  const clock = useMemo(() => caseClock(bundle), [bundle])
  const T = clock.now
  const [steps, setSteps] = useState<boolean>(() => store.get('tl-steps', false))
  const [cluster, setCluster] = useState<boolean>(() => store.get('tl-cluster', true))
  const [menu, setMenu] = useState(false)
  useEffect(() => store.set('tl-steps', steps), [steps])
  useEffect(() => store.set('tl-cluster', cluster), [cluster])

  const items = useMemo(() => timelineItems(bundle, { steps }), [bundle, steps])
  const dls = useMemo(() => deadlines(bundle), [bundle])

  const [wrapRef, W] = useWidth<HTMLDivElement>()
  const ML = W < 560 ? 70 : 92
  const MR = 14
  const plotW = Math.max(60, W - ML - MR)

  const lastDue = Math.max(T + 3 * DAY, ...dls.filter((d) => d.state === 'pending').map((d) => d.due))
  const domain: [number, number] = [Math.min(clock.opened, ...items.map((i) => i.t)) - DAY, lastDue + 2 * DAY]
  const domainRef = useRef(domain)
  domainRef.current = domain
  const presetView = useCallback((p: Preset): [number, number] => {
    if (p === 'all') return domainRef.current
    if (p === 'day') return [T - 16 * HOUR, T + 8 * HOUR]
    if (p === 'twoweeks') return [T - 9 * DAY, T + 5 * DAY]
    return [T - 4.5 * DAY, T + 2.5 * DAY]
  }, [T])
  const [view, setView] = useState<[number, number]>(() => presetView('week'))
  const viewRef = useRef(view)
  viewRef.current = view
  const [sel, setSel] = useState<Sel | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x0: number; v0: [number, number]; moved: boolean } | null>(null)

  // On a time skip "now" slides; the view follows only when now would leave it.
  const prevT = useRef(T)
  const [animNow, setAnimNow] = useState(false)
  useEffect(() => {
    if (prevT.current === T) return
    const goingBack = T < prevT.current
    prevT.current = T
    setSel(null)
    const [a, b] = viewRef.current
    const s = b - a
    if (goingBack) setView(presetView('week'))
    else if (T > b - s * 0.08 || T < a) setView([T - s * 0.65, T + s * 0.35])
    setAnimNow(true)
    const id = window.setTimeout(() => setAnimNow(false), 700)
    return () => window.clearTimeout(id)
  }, [T, presetView])

  const span = view[1] - view[0]
  const x = (t: number) => ML + ((t - view[0]) / span) * plotW
  const tAt = (px: number) => view[0] + ((px - ML) / plotW) * span
  const zoomAround = (factor: number, px: number) => {
    const [a, b] = viewRef.current
    const s = b - a
    const s2 = clamp(s * factor, 20 * MIN, 120 * DAY)
    const tc = a + ((px - ML) / plotW) * s
    const a2 = tc - ((px - ML) / plotW) * s2
    setView([a2, a2 + s2])
  }
  const panBy = (dt: number) => { const [a, b] = viewRef.current; setView([a + dt, b + dt]) }

  // wheel zooms around the cursor; Shift or a horizontal swipe pans (TradingView-style)
  const geo = useRef({ plotW, ML })
  geo.current = { plotW, ML }
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { plotW: pw, ML: ml } = geo.current
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const [a, b] = viewRef.current
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const d = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX
        const dt = (d / pw) * (b - a)
        setView([a + dt, b + dt])
      } else {
        const s = b - a
        const s2 = clamp(s * Math.exp(e.deltaY * 0.0016), 20 * MIN, 120 * DAY)
        const p = clamp(px, ml, ml + pw)
        const tc = a + ((p - ml) / pw) * s
        const a2 = tc - ((p - ml) / pw) * s2
        setView([a2, a2 + s2])
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [wrapRef])

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    drag.current = { x0: e.clientX, v0: viewRef.current, moved: false }
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current
    if (!el) return
    const px = e.clientX - el.getBoundingClientRect().left
    setHoverX(px >= ML && px <= ML + plotW ? px : null)
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0
    if (!d.moved && Math.abs(dx) > 3) {
      // capture only once a drag starts, so plain clicks still reach the markers
      d.moved = true
      setDragging(true)
      try { el.setPointerCapture(e.pointerId) } catch { /* pointer already released */ }
    }
    if (d.moved) {
      const s = d.v0[1] - d.v0[0]
      const dt = -(dx / plotW) * s
      setView([d.v0[0] + dt, d.v0[1] + dt])
    }
  }
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (d && !d.moved && !(e.target instanceof Element && e.target.closest('.tl-mark'))) setSel(null)
  }
  const onKey = (e: RKeyboardEvent) => {
    const mid = ML + plotW / 2
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAround(0.7, mid) }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAround(1 / 0.7, mid) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); panBy(-span * 0.15) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); panBy(span * 0.15) }
    else if (e.key === '0') { e.preventDefault(); setView(presetView('all')) }
    else if (e.key === 'Escape') setSel(null)
  }

  const { step, ticks } = makeTicks(view[0], view[1], plotW)
  const hourly = step < DAY
  const AXIS_H = 34
  const laneH = W < 560 ? 32 : 38
  const DL_H = 54
  const laneTop = (i: number) => AXIS_H + i * laneH
  const bodyH = 3 * laneH + DL_H
  const H = AXIS_H + bodyH + 18
  const laneY = (i: number) => (i === 3 ? AXIS_H + 3 * laneH + DL_H / 2 : laneTop(i) + laneH / 2)
  const nowX = x(T)
  const clipId = useMemo(() => 'clip' + Math.random().toString(36).slice(2, 8), [])

  const selKey = (c: Cluster) => c.items.map((i) => i.key).join('|')
  const renderMarks = (laneItems: TLItem[], cy: number) => {
    const groups = cluster ? clusterItems(laneItems, x, 14) : laneItems.map((it) => ({ x: x(it.t), x0: 0, x1: 0, items: [it] }))
    return groups.map((g) => {
      if (g.x < ML - 10 || g.x > ML + plotW + 10) return null
      const key = selKey(g)
      const isSel = sel?.key === key
      const single = g.items.length === 1
      const label = single ? `${g.items[0].title} (${clock.fWhen(g.items[0].real)})` : `${g.items.length} events, select to list them`
      const hasBlocked = g.items.some((i) => i.kind === 'blocked')
      return (
        <g key={key} className={'tl-mark' + (isSel ? ' sel' : '')} role="button" tabIndex={0} aria-label={label}
          onClick={(e) => { e.stopPropagation(); setSel({ key, items: g.items }) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel({ key, items: g.items }) } }}>
          <circle className="hit" cx={g.x} cy={cy} r="13" />
          {single ? markShape(g.items[0].kind, g.x, cy) : (
            <g>
              <circle className={'m-cluster' + (hasBlocked ? ' has-blocked' : '')} cx={g.x} cy={cy} r="9" />
              <text className="m-cluster-t" x={g.x} y={cy + 3.5} textAnchor="middle">{g.items.length > 99 ? '99+' : g.items.length}</text>
            </g>
          )}
          <title>{label}</title>
        </g>
      )
    })
  }

  const renderDeadlines = (cy: number) => {
    const rows: [number, number][][] = [[], []]
    return dls.map((d: Deadline) => {
      const xd = x(d.due)
      const xs = x(d.set)
      const done = d.state !== 'pending'
      const endX = done ? x(d.end) : xd
      if (Math.max(xs, endX, xd) < ML - 40 || Math.min(xs, xd) > ML + plotW + 40) return null
      const cls = done ? 'done' : d.cls === 'legal' ? 'legal' : d.cls === 'expiry' ? 'expiry' : ''
      const left = Math.ceil((d.due - T) / DAY)
      const sub = d.state === 'pending' ? (left <= 0 ? 'due today' : `in ${plural(left, 'day')}`) : d.state === 'fired' ? 'fired' : 'cancelled'
      const inView = xd >= ML - 6 && xd <= ML + plotW + 6
      // two label rows; a label that fits in neither is left to the tooltip
      const w = (d.label.length + sub.length) * 6 + 26
      const lx0 = clamp(xd + 6, ML + 4, ML + plotW - 4)
      let row = rows.findIndex((r) => r.every(([a, z]) => lx0 + w + 8 < a || lx0 > z + 8))
      const yOff = (row === -1 ? 0 : row) * 18 - 9
      if (row !== -1 && inView) rows[row].push([lx0, lx0 + w])
      const title = `${d.labels.join(', ')}: ${sub}. Due ${clock.fWhen(d.due)}.`
      const detail = `${d.count > 1 ? d.labels.join('. ') + '. ' : ''}Set ${clock.fWhen(d.set)}. ${d.state === 'cancelled' ? `Cancelled ${clock.fWhen(d.end)}.` : d.state === 'fired' ? 'Fired on time.' : `Due ${clock.fWhen(d.due)}.`}`
      return (
        <g key={d.key} className="tl-mark" role="button" tabIndex={0} aria-label={title}
          onClick={(e) => { e.stopPropagation(); setSel({ key: d.key, items: [{ key: d.key, t: d.due, real: d.due, lane: 'deadline', kind: 'deadline', title: d.label, detail }] }) }}
          onKeyDown={(e) => { if (e.key === 'Enter') setSel({ key: d.key, items: [{ key: d.key, t: d.due, real: d.due, lane: 'deadline', kind: 'deadline', title: d.label, detail }] }) }}>
          <line className="dl-span" x1={clamp(xs, ML - 2, ML + plotW + 2)} x2={clamp(endX, ML - 2, ML + plotW + 2)} y1={cy + yOff} y2={cy + yOff} style={{ opacity: done ? 0.4 : 0.8 }} />
          {inView ? <rect className="hit" x={xd - 6} y={cy + yOff - 11} width="16" height="20" /> : null}
          {inView ? <path className={'dl-flag ' + cls} d={`M${xd} ${cy + yOff + 7}V${cy + yOff - 9}h9l-3 4 3 4h-9`} /> : null}
          {inView && row !== -1 && plotW > 300 ? (
            <text className={'dl-text ' + (done ? 'done' : '')} x={lx0 + 6} y={cy + yOff - 1}>{d.label}<tspan className="dl-sub" dx="5">{sub}</tspan></text>
          ) : null}
          <title>{title}</title>
        </g>
      )
    })
  }

  const spanText = span < DAY ? `${Math.round(span / HOUR)} hours` : `${(span / DAY).toFixed(span < 3 * DAY ? 1 : 0)} days`
  const distinctTimes = sel ? new Set(sel.items.map((i) => i.real)).size : 0

  return (
    <div className="tl">
      <div ref={wrapRef} className={'tl-canvas' + (dragging ? ' dragging' : '')} tabIndex={0}
        aria-label="Case timeline. Scroll to zoom, drag to pan, plus and minus keys zoom, arrow keys pan."
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHoverX(null)}
        onDoubleClick={() => setView(presetView('all'))} onKeyDown={onKey}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline">
          <defs><clipPath id={clipId}><rect x={ML} y="0" width={plotW} height={H} /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <rect className="tl-past" x={ML} y={AXIS_H} width={clamp(nowX - ML, 0, plotW)} height={bodyH} />
            {ticks.map((t) => {
              const major = hourly && (t - clock.midnight0) % DAY === 0
              return <line key={'g' + t} className={major ? 'tl-grid-major' : 'tl-grid'} x1={x(t)} x2={x(t)} y1={AXIS_H - 4} y2={AXIS_H + bodyH} />
            })}
            {LANES.slice(1).map((_, i) => <line key={'sep' + i} className="tl-grid" x1={ML} x2={ML + plotW} y1={laneTop(i + 1)} y2={laneTop(i + 1)} style={{ opacity: 0.5 }} />)}
          </g>
          {ticks.map((t) => {
            const px = x(t)
            if (px < ML - 1 || px > ML + plotW - 30) return null
            const midnight = (t - clock.midnight0) % DAY === 0
            const top = hourly ? (midnight ? fWeekDate(t) : fTime(t)) : fWeekDate(t)
            const bottom = hourly ? (midnight ? `Day ${clock.dayNo(t)}` : '') : `Day ${clock.dayNo(t)}`
            return (
              <g key={'a' + t}>
                <text className={midnight && hourly ? 'tl-axis-b' : 'tl-axis'} x={px + 4} y={13}>{top}</text>
                {bottom ? <text className="tl-axis" x={px + 4} y={26}>{bottom}</text> : null}
              </g>
            )
          })}
          {LANES.map((l, i) => (
            <g key={l.id}>
              <text className="tl-lane-label" x={8} y={laneY(i) + 4}>{l.label}</text>
              <g clipPath={`url(#${clipId})`}>
                {l.id === 'deadline' ? renderDeadlines(laneY(i)) : renderMarks(items.filter((it) => it.lane === l.id), laneY(i))}
              </g>
            </g>
          ))}
          <g className="tl-now-g" style={{ transform: `translateX(${nowX}px)`, transition: animNow ? undefined : 'none', opacity: nowX >= ML && nowX <= ML + plotW ? 1 : 0 }}>
            <line className="tl-now" x1={0} x2={0} y1={AXIS_H - 6} y2={AXIS_H + bodyH} />
            <rect className="tl-now-pill" x={clamp(nowX - 36, ML, ML + plotW - 72) - nowX} y={AXIS_H + bodyH - 2} width="72" height="16" rx="8" />
            <text className="tl-now-text" x={clamp(nowX - 36, ML, ML + plotW - 72) - nowX + 36} y={AXIS_H + bodyH + 10} textAnchor="middle">Now, day {clock.dayNo(T)}</text>
          </g>
          {hoverX != null && !dragging ? (
            <g pointerEvents="none">
              <line className="tl-cross" x1={hoverX} x2={hoverX} y1={AXIS_H} y2={AXIS_H + bodyH} />
              <rect className="tl-cross-pill" x={clamp(hoverX - 52, ML, ML + plotW - 104)} y={AXIS_H - 2} width="104" height="17" rx="4" />
              <text className="tl-cross-text" x={clamp(hoverX - 52, ML, ML + plotW - 104) + 52} y={AXIS_H + 10} textAnchor="middle">
                {hourly ? `Day ${clock.dayNo(tAt(hoverX))}, ${fTime(tAt(hoverX))}` : fWeekDate(tAt(hoverX))}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <Navigator W={W} ML={ML} plotW={plotW} domain={domain} view={view} setView={setView} T={T} items={items} dls={dls} />
      {sel ? (
        <div className="tl-detail" aria-live="polite">
          <div className="tl-detail-list">
            {sel.items.slice(0, 12).map((it) => (
              <div key={it.key} style={{ minWidth: 0 }}>
                <div><b style={{ fontWeight: 500 }}>{it.title}</b></div>
                {it.detail ? <div className="muted small">{it.detail}</div> : null}
                <div className="meta">{LANE_NAME[it.lane]}, {clock.fWhen(it.real)}{it.seq ? `, #${it.seq}` : ''}</div>
              </div>
            ))}
          </div>
          {sel.items.length > 12 ? (
            <div className="meta">and {sel.items.length - 12} more{distinctTimes > 1 ? '. Zoom in to separate them.' : '. The full list is in the Ledger tab.'}</div>
          ) : null}
        </div>
      ) : null}
      <div className="tl-tools">
        <div className="ctrl">
          <button type="button" className="btn quiet icon-only" onClick={() => zoomAround(1 / 0.65, ML + plotW / 2)} aria-label="Zoom out"><Icon name="minus" size={14} /></button>
          <button type="button" className="btn quiet icon-only" onClick={() => zoomAround(0.65, ML + plotW / 2)} aria-label="Zoom in"><Icon name="plus" size={14} /></button>
          <div className="seg" role="group" aria-label="Range">
            <button type="button" onClick={() => setView(presetView('day'))}>1 day</button>
            <button type="button" onClick={() => setView(presetView('week'))}>1 week</button>
            <button type="button" onClick={() => setView(presetView('twoweeks'))}>2 weeks</button>
            <button type="button" onClick={() => setView(presetView('all'))}>Whole case</button>
          </div>
          <button type="button" className="btn quiet" onClick={() => { const s = viewRef.current[1] - viewRef.current[0]; setView([T - s * 0.65, T + s * 0.35]) }}>
            <Icon name="now" size={14} />Now
          </button>
        </div>
        <span className="grow" />
        <span className="tl-help">Showing {spanText}. Scroll to zoom, drag to pan, double-click for the whole case.</span>
        <div className="menu-wrap">
          <button type="button" className="btn quiet icon-only" aria-label="Timeline options" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Icon name="more" size={14} /></button>
          {menu ? (
            <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
              <button type="button" role="menuitemcheckbox" aria-checked={steps} onClick={() => setSteps((v) => !v)}>
                <span className="tick">{steps ? <Icon name="check" size={14} /> : null}</span>Every agent step
              </button>
              <button type="button" role="menuitemcheckbox" aria-checked={cluster} onClick={() => setCluster((v) => !v)}>
                <span className="tick">{cluster ? <Icon name="check" size={14} /> : null}</span>Group close events
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface NavProps {
  W: number; ML: number; plotW: number; domain: [number, number]; view: [number, number]
  setView: (v: [number, number]) => void; T: number; items: TLItem[]; dls: Deadline[]
}
function Navigator({ W, ML, plotW, domain, view, setView, T, items, dls }: NavProps) {
  const H = 40
  const [d0, d1] = domain
  const ds = d1 - d0
  const nx = (t: number) => ML + ((t - d0) / ds) * plotW
  const nt = (px: number) => d0 + ((px - ML) / plotW) * ds
  const ref = useRef<SVGSVGElement | null>(null)
  const g = useRef<{ mode: 'move' | 'left' | 'right'; x0: number; v0: [number, number] } | null>(null)
  const days: number[] = []
  for (let t = Math.ceil(d0 / DAY) * DAY; t <= d1 && days.length < 400; t += DAY) days.push(t)
  const bx0 = clamp(nx(view[0]), ML, ML + plotW)
  const bx1 = clamp(nx(view[1]), ML, ML + plotW)
  const start = (mode: 'move' | 'left' | 'right') => (e: RPointerEvent<SVGRectElement>) => {
    e.stopPropagation()
    g.current = { mode, x0: e.clientX, v0: view }
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const s = g.current
    if (!s) return
    const dt = ((e.clientX - s.x0) / plotW) * ds
    if (s.mode === 'move') setView([s.v0[0] + dt, s.v0[1] + dt])
    if (s.mode === 'left') setView([Math.min(s.v0[0] + dt, s.v0[1] - 20 * MIN), s.v0[1]])
    if (s.mode === 'right') setView([s.v0[0], Math.max(s.v0[1] + dt, s.v0[0] + 20 * MIN)])
  }
  const end = () => { g.current = null }
  const jump = (e: RPointerEvent<SVGRectElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const t = nt(e.clientX - r.left)
    const s = view[1] - view[0]
    setView([t - s / 2, t + s / 2])
  }
  const laneY: Record<string, [number, number]> = { client: [10, 16], analyst: [16, 22], agent: [22, 28] }
  return (
    <svg ref={ref} className="tl-nav" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ touchAction: 'none' }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      aria-label="Overview of the whole case. Drag the window to move, drag its edges to resize.">
      <text className="tl-lane-label" x="8" y={H / 2 + 4}>Overview</text>
      <rect className="nav-bg" x={ML} y="2" width={plotW} height={H - 4} rx="6" onPointerDown={jump} />
      {days.map((t) => <line key={t} className="tl-grid" x1={nx(t)} x2={nx(t)} y1="4" y2={H - 4} pointerEvents="none" />)}
      {items.filter((i) => i.kind !== 'step').map((i) => {
        const [y1, y2] = laneY[i.lane] ?? [22, 28]
        return <line key={i.key} className="nav-tick" x1={nx(i.t)} x2={nx(i.t)} y1={y1} y2={y2} style={{ stroke: i.kind === 'blocked' ? 'var(--conflict)' : LANE_COLOR[i.lane] }} pointerEvents="none" />
      })}
      {dls.filter((d) => d.state === 'pending').map((d) => (
        <path key={d.key} className={'dl-flag ' + (d.cls === 'legal' ? 'legal' : d.cls === 'expiry' ? 'expiry' : '')} d={`M${nx(d.due)} ${H - 6}V${H - 16}h6l-2 3 2 3h-6`} pointerEvents="none" />
      ))}
      <line className="tl-now" x1={nx(T)} x2={nx(T)} y1="3" y2={H - 3} pointerEvents="none" />
      <rect className="nav-brush" x={bx0} y="3" width={Math.max(6, bx1 - bx0)} height={H - 6} rx="5" onPointerDown={start('move')} />
      <rect className="nav-handle" x={bx0 - 3} y="10" width="6" height={H - 20} rx="3" onPointerDown={start('left')} />
      <rect className="nav-handle" x={Math.max(bx0 + 6, bx1) - 3} y="10" width="6" height={H - 20} rx="3" onPointerDown={start('right')} />
    </svg>
  )
}
