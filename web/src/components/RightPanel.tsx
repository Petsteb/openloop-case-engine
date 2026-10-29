import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { arr, feedItems, type DocRow } from '@/lib/derive'
import type { Bundle, Citation } from '@/lib/types'
import { DEMO_STAFF_AUTHOR } from '@/shared/demo'
import { Thread } from '@/shared/thread'
import { ActivityFeed, LedgerList, ReasoningList } from './ActivityTabs'
import { ChatPanel } from './ChatPanel'
import { PanelHead } from './Checklist'
import { Boundary } from './Btn'
import { DocsList } from './DocsTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

/** 'outbox' is the Messages tab (the thread with the client plus the automatic emails); the key stays for stored tabs. */
export type RightTab = 'ask' | 'activity' | 'reasoning' | 'ledger' | 'outbox' | 'docs'

/** When the six tabs would not fit on one line, these counts go first (in this order); the tab's title keeps the number. */
const DROP_ORDER: RightTab[] = ['outbox', 'reasoning', 'activity']

interface Props {
  bundle: Bundle
  caseId: string
  tab: RightTab
  onTab: (t: RightTab) => void
  onHide: () => void
  highlight: number | null
  onCite: (c: Citation) => void
  onAnswered: () => void
  verifyText: string | null
  verifyOk: boolean
  verifying: boolean
  onVerify: () => void
  docs: DocRow[]
  onOpenDoc: (id: string) => void
  /** optional: an event chip in Messages. Defaults to onCite, which opens the Ledger tab at that seq. */
  onOpenEvent?: (seq: number) => void
  /** optional: the analyst name on messages the bank sends */
  messageAuthor?: string
  /** client messages the analyst has not seen in the Messages tab yet (App.tsx): a dot on the tab */
  unreadMessages?: number
}

export function RightPanel(p: Props) {
  const { bundle } = p
  // Six tabs share one line in the 340px panel: Ask and Docs carry no count (the spec allows dropping those two).
  const counts: Record<RightTab, string | null> = {
    ask: null,
    activity: String(feedItems(bundle).length),
    reasoning: String(arr(bundle.trace).length),
    ledger: String(arr(bundle.events).length),
    // the thread's items: the automatic emails plus the messages (the same events the thread lists)
    outbox: String(arr(bundle.outbox).length + arr(bundle.events).filter((e) => e.type === 'MESSAGE_POSTED').length),
    docs: null,
  }
  const labels: Record<RightTab, string> = { ask: 'Ask', activity: 'Activity', reasoning: 'Reasoning', ledger: 'Ledger', outbox: 'Messages', docs: 'Docs' }
  const titles: Partial<Record<RightTab, string>> = {
    activity: `${counts.activity} activity items`, reasoning: `${counts.reasoning} agent steps`, outbox: `${counts.outbox} messages and emails`,
  }
  const onOpenEvent = p.onOpenEvent ?? ((seq: number) => p.onCite({ kind: 'event', ref: String(seq) }))

  // "Messages" is longer than the old "Email": drop counts (DROP_ORDER) only while the row would overflow at this width
  const listRef = useRef<HTMLDivElement | null>(null)
  const sig = Object.values(counts).join('|')
  const [width, setWidth] = useState(0)
  const [fit, setFit] = useState({ sig: '', width: 0, drop: 0 })
  const drop = fit.sig === sig && fit.width === width ? fit.drop : 0
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && el.scrollWidth > el.clientWidth && drop < DROP_ORDER.length) setFit({ sig, width, drop: drop + 1 })
  }, [sig, width, drop])
  const dropped = new Set(DROP_ORDER.slice(0, drop))
  const unread = p.unreadMessages ?? 0
  return (
    <Tabs value={p.tab} onValueChange={(v) => p.onTab(v as RightTab)} className="right-tabs" style={{ gap: 0 }}>
      <PanelHead side="right" title="Ask and activity" onHide={p.onHide}>
        <TabsList ref={listRef} className="rtabs" aria-label="Right panel">
          {(Object.keys(labels) as RightTab[]).map((t) => (
            <TabsTrigger key={t} value={t} className="rtab"
              title={t === 'outbox' && unread ? `${unread} new from the client` : dropped.has(t) ? titles[t] : undefined}>
              {labels[t]}{counts[t] !== null && !dropped.has(t) ? <sup>{counts[t]}</sup> : null}
              {/* outside the <sup>: the Messages count is the first one dropped when the row is tight */}
              {t === 'outbox' && unread ? <><i className="rtab-new" aria-hidden="true" /><span className="sr-only">, {unread} new from the client</span></> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </PanelHead>
      <TabsContent value="ask" forceMount hidden={p.tab !== 'ask'} className="tabpane">
        <Boundary name="chat"><ChatPanel bundle={bundle} caseId={p.caseId} onCite={p.onCite} onAnswered={p.onAnswered} /></Boundary>
      </TabsContent>
      <TabsContent value="activity" className="tabpane"><Boundary name="activity"><ActivityFeed bundle={bundle} /></Boundary></TabsContent>
      <TabsContent value="reasoning" className="tabpane"><Boundary name="reasoning"><ReasoningList bundle={bundle} /></Boundary></TabsContent>
      <TabsContent value="ledger" className="tabpane">
        <Boundary name="ledger">
          <LedgerList bundle={bundle} highlight={p.highlight} verifyText={p.verifyText} verifyOk={p.verifyOk} onVerify={p.onVerify} verifying={p.verifying} />
        </Boundary>
      </TabsContent>
      {/* kept mounted like Ask: switching to the Ledger from an event chip must not lose the draft or the scroll */}
      <TabsContent value="outbox" forceMount hidden={p.tab !== 'outbox'} className="tabpane">
        <Boundary name="messages">
          <Thread caseId={p.caseId} role="employee" author={p.messageAuthor ?? DEMO_STAFF_AUTHOR} active={p.tab === 'outbox'}
            onOpenDoc={p.onOpenDoc} onOpenEvent={onOpenEvent} onPosted={p.onAnswered} />
        </Boundary>
      </TabsContent>
      <TabsContent value="docs" className="tabpane"><Boundary name="docs"><DocsList bundle={bundle} rows={p.docs} onOpen={p.onOpenDoc} /></Boundary></TabsContent>
    </Tabs>
  )
}
