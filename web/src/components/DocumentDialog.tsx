import { caseClock, docQuotes, ms } from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

/** Opened from a `doc-3` citation chip: the document's quotes used as evidence anywhere in the case. */
export function DocumentDialog({ bundle, docId, onClose }: { bundle: Bundle; docId: string | null; onClose: () => void }) {
  const clock = caseClock(bundle)
  const data = docId ? docQuotes(bundle, docId) : null
  const received = ms(data?.doc?.received_at)
  const issued = ms(data?.doc?.issued_at)
  return (
    <Dialog open={!!docId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="ol-dialog">
        <DialogTitle>{data?.doc?.name || docId}</DialogTitle>
        <DialogDescription className="muted small">
          <span className="mono">{docId}</span>
          {received !== null ? `, received ${clock.fWhen(received)}` : ', not in this case'}
          {issued !== null ? `, issued ${new Date(issued).toISOString().slice(0, 10)}` : ''}
        </DialogDescription>
        {data && data.quotes.length ? (
          <div className="papers" style={{ marginTop: 8 }}>
            {data.quotes.map((q, i) => (
              <figure key={i} className="paper">
                <pre>{q.quote}</pre>
                <figcaption>{q.field ? String(q.field).replace(/_/g, ' ') : q.label || 'Quote'}</figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="muted small">No quotes from this document are used as evidence yet.</p>}
      </DialogContent>
    </Dialog>
  )
}
