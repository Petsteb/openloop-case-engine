import { useEffect, useMemo, useRef, useState } from 'react'
import {
  arr, blockedWhy, caseClock, eventText, feedItems, fTime, fWeekDate, gateRule, parseMaybe, plain, shortHash,
  tidy, whoLabel,
} from '@/lib/derive'
import type { Bundle, TraceStep } from '@/lib/types'
import { Btn } from './Btn'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function ActivityFeed({ bundle }: { bundle: Bundle }) {
  const clock = caseClock(bundle)
  const items = useMemo(() => feedItems(bundle), [bundle])
  const [limit, setLimit] = useState(60)
  const shown = items.slice(0, limit)
  const byDay: { d: number; t: number; items: typeof items }[] = []
  shown.forEach((e) => {
    const d = clock.dayNo(e.real)
    const last = byDay[byDay.length - 1]
    if (last && last.d === d) last.items.push(e)
    else byDay.push({ d, t: e.real, items: [e] })
  })
  if (!items.length) return <p className="empty">Nothing has happened yet.</p>
  return (
    <div className="feed">
      {byDay.map((g) => (
        <div key={g.d + ':' + g.items[0].key}>
          <div className="feed-day">Day {g.d}, {fWeekDate(g.t)}</div>
          {g.items.map((e) => (
            <div key={e.key} className={'feed-item' + (e.blocked ? ' blocked' : '')}>
              <span className="when">{fTime(e.real)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="text">{e.text}</div>
                <div className="who">{e.who}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
      {items.length > limit ? <button type="button" className="linkish" onClick={() => setLimit((l) => l + 80)}>Show older activity</button> : null}
    </div>
  )
}

const pretty = (v: unknown) => { const p = parseMaybe(v); return typeof p === 'string' ? p : JSON.stringify(p, null, 2) }
const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '' && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length)

function Step({ s, ruleText }: { s: TraceStep; ruleText: (id: string) => string }) {
  const rule = gateRule(s.gate)
  const g = String(s.gate ?? '-')
  return (
    <article className="step">
      <p className="step-reason">{tidy(plain(s.reason)) || 'No reason recorded'}</p>
      <div className="step-meta">
        <span className="tool">{s.tool}</span>
        {g === 'ALLOW' ? <span>Allowed</span> : rule ? (
          <Tooltip>
            <TooltipTrigger asChild><span className="gate-deny" tabIndex={0}>Blocked: {rule}</span></TooltipTrigger>
            <TooltipContent className="ol-tip">{ruleText(rule) || blockedWhy(s)}</TooltipContent>
          </Tooltip>
        ) : <span>Read only</span>}
        <Collapsible>
          <CollapsibleTrigger asChild><button type="button" className="linkish">Details</button></CollapsibleTrigger>
          <CollapsibleContent>
            {hasValue(s.input) ? <><div className="json-label">Input</div><pre className="json">{pretty(s.input)}</pre></> : null}
            {hasValue(s.output) ? <><div className="json-label">Output</div><pre className="json">{pretty(s.output)}</pre></> : null}
            {!hasValue(s.input) && !hasValue(s.output) ? <div className="json-label">No input or output recorded.</div> : null}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </article>
  )
}

export function ReasoningList({ bundle }: { bundle: Bundle }) {
  const clock = caseClock(bundle)
  const steps = useMemo(() => [...arr(bundle.trace)].sort((a, b) => b.seq - a.seq), [bundle])
  const [limit, setLimit] = useState(40)
  const rules = useMemo(() => {
    const m = new Map<string, string>()
    arr(bundle.exceptions).forEach((x) => { if (x.rule?.id) m.set(x.rule.id, x.rule.text || '') })
    arr(bundle.trace).forEach((s) => {
      const r = gateRule(s.gate)
      if (r && !m.has(r)) m.set(r, blockedWhy(s))
    })
    return m
  }, [bundle])
  if (!steps.length) return <p className="empty">No agent steps yet.</p>
  let lastDay: number | null = null
  return (
    <div className="feed">
      {steps.slice(0, limit).map((s) => {
        const t = Date.parse(s.sim_time)
        const d = Number.isNaN(t) ? null : clock.dayNo(t)
        const head = d !== lastDay ? <div className="feed-day">{d === null ? 'Undated' : `Day ${d}, ${fWeekDate(t)}`}</div> : null
        lastDay = d
        return <div key={s.seq}>{head}<Step s={s} ruleText={(id) => tidy(rules.get(id) || '')} /></div>
      })}
      {steps.length > limit ? <button type="button" className="linkish" onClick={() => setLimit((l) => l + 60)}>Show older steps</button> : null}
    </div>
  )
}

export function LedgerList({ bundle, highlight, verifyText, verifyOk, onVerify, verifying }: {
  bundle: Bundle; highlight: number | null; verifyText: string | null; verifyOk: boolean; onVerify: () => void; verifying: boolean
}) {
  const clock = caseClock(bundle)
  const evs = useMemo(() => [...arr(bundle.events)].sort((a, b) => b.seq - a.seq), [bundle])
  const [limit, setLimit] = useState(80)
  const hlRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (highlight === null) return
    const idx = evs.findIndex((e) => e.seq === highlight)
    if (idx >= limit) setLimit(idx + 20)
  }, [highlight, evs, limit])
  useEffect(() => {
    if (highlight !== null) hlRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlight, limit])
  return (
    <div>
      <div className="led-top">
        <Btn size="sm" onClick={onVerify} loading={verifying}>Check ledger integrity</Btn>
        {verifyText ? <span className={verifyOk ? 'verify-ok' : 'verify-bad'} role="status">{verifyText}</span> : null}
      </div>
      {!evs.length ? <p className="empty">No events yet.</p> : null}
      {evs.slice(0, limit).map((e) => {
        const t = Date.parse(e.sim_time)
        const hl = e.seq === highlight
        return (
          <div key={e.seq} ref={hl ? hlRef : undefined} className={'led' + (hl ? ' hl' : '')} title={whoLabel(e)}>
            <div className="sum"><span className="seq">#{e.seq}</span>{eventText(bundle, e)}</div>
            <div className="day">{Number.isNaN(t) ? '' : `Day ${clock.dayNo(t)} ${fTime(t)}`}</div>
            <div className="hash" title={`Event #${e.seq}: its hash, then the previous event's hash`}>{shortHash(e.hash)} ← {shortHash(e.prev_hash)}</div>
          </div>
        )
      })}
      {evs.length > limit ? <button type="button" className="linkish" onClick={() => setLimit((l) => l + 120)}>Show older events</button> : null}
    </div>
  )
}

