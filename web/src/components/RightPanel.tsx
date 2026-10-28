import { arr, feedItems, type DocRow } from '@/lib/derive'
import type { Bundle, Citation } from '@/lib/types'
import { ActivityFeed, LedgerList, OutboxList, ReasoningList } from './ActivityTabs'
import { ChatPanel } from './ChatPanel'
import { PanelHead } from './Checklist'
import { Boundary } from './Btn'
import { DocsList } from './DocsTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export type RightTab = 'ask' | 'activity' | 'reasoning' | 'ledger' | 'outbox' | 'docs'

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
}

export function RightPanel(p: Props) {
  const { bundle } = p
  // Six tabs share one line in the 340px panel: Ask and Docs carry no count (the spec allows dropping those two).
  const counts: Record<RightTab, string | null> = {
    ask: null,
    activity: String(feedItems(bundle).length),
    reasoning: String(arr(bundle.trace).length),
    ledger: String(arr(bundle.events).length),
    outbox: String(arr(bundle.outbox).length),
    docs: null,
  }
  const labels: Record<RightTab, string> = { ask: 'Ask', activity: 'Activity', reasoning: 'Reasoning', ledger: 'Ledger', outbox: 'Email', docs: 'Docs' }
  return (
    <Tabs value={p.tab} onValueChange={(v) => p.onTab(v as RightTab)} className="right-tabs" style={{ gap: 0 }}>
      <PanelHead side="right" title="Ask and activity" onHide={p.onHide}>
        <TabsList className="rtabs" aria-label="Right panel">
          {(Object.keys(labels) as RightTab[]).map((t) => (
            <TabsTrigger key={t} value={t} className="rtab">{labels[t]}{counts[t] !== null ? <sup>{counts[t]}</sup> : null}</TabsTrigger>
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
      <TabsContent value="outbox" className="tabpane"><Boundary name="outbox"><OutboxList bundle={bundle} /></Boundary></TabsContent>
      <TabsContent value="docs" className="tabpane"><Boundary name="docs"><DocsList bundle={bundle} rows={p.docs} onOpen={p.onOpenDoc} /></Boundary></TabsContent>
    </Tabs>
  )
}
