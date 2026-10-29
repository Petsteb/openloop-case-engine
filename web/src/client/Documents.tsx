import { Dialog } from 'radix-ui'
import { Icon } from './Icon'
import { safe } from './derive'
import type { ClientDocument, ClientDocumentDetail } from './types'

export type DetailState = ClientDocumentDetail | 'loading' | 'error' | 'unavailable'

type Tone = 'done' | 'wait' | 'expired' | 'conflict' | 'old'
const STATUS_FALLBACK: Record<string, string> = {
  valid: 'Received', expired: 'Please send a new one', superseded: 'Replaced by a newer version',
  quarantined: 'Not accepted', unreadable: 'Received, waiting for manual reading',
}

export function docTone(d: { status?: string; status_word: string }): Tone {
  if (d.status === 'quarantined' || /not accepted/i.test(d.status_word)) return 'conflict'
  if (d.status === 'expired' || /send a new one/i.test(d.status_word)) return 'expired'
  if (d.status === 'superseded' || /replaced/i.test(d.status_word)) return 'old'
  if (/verified/i.test(d.status_word)) return 'done'
  return 'wait'
}

export function StatusChip({ doc }: { doc: { status?: string; status_word: string } }) {
  const word = safe(doc.status_word, STATUS_FALLBACK[doc.status ?? ''] ?? 'Received')
  return <span className={`pt-chip tone-${docTone(doc)}`}><i aria-hidden="true" />{word}</span>
}

const receivedLine = (d: number | null | undefined) => (d == null ? 'Received' : `Received on day ${d}`)

function History({ detail }: { detail: DetailState | undefined }) {
  if (detail === undefined || detail === 'loading') {
    return <p className="pt-hist-msg"><Icon name="spinner" size={14} className="spin" />Loading history…</p>
  }
  if (detail === 'unavailable') return <p className="pt-hist-msg">History is not available for this document yet.</p>
  if (detail === 'error') return <p className="pt-hist-msg">The history could not be loaded. Close and open it again to retry.</p>
  const items = Array.isArray(detail.history) ? detail.history : []
  if (!items.length) return <p className="pt-hist-msg">No history yet.</p>
  return (
    <ol className="pt-hist">
      {items.map((h, i) => (
        <li key={i}><span className="pt-hist-day">Day {h.day}</span><span>{safe(h.what, 'Updated by the bank')}</span></li>
      ))}
    </ol>
  )
}

interface ListProps {
  docs: ClientDocument[]
  open: Set<string>
  details: Record<string, DetailState>
  flash: string | null
  onToggle: (id: string) => void
  onView: (id: string) => void
}

/** Every document the client sent, with a status chip, a View button (the document sheet) and a History expander. */
export function Documents({ docs, open, details, flash, onToggle, onView }: ListProps) {
  return (
    <ul className="pt-docs">
      {docs.map((d) => {
        const isOpen = open.has(d.id)
        const panel = `hist-${d.id}`
        const det = details[d.id]
        const name = safe(d.name, safe(d.label, 'Document'))
        return (
          <li key={d.id} className={`pt-doc${flash === d.id ? ' pt-flash' : ''}${docTone(d) === 'old' ? ' is-old' : ''}`} data-doc={d.id}>
            <div className="pt-doc-row">
              <Icon name="doc" size={16} className="pt-doc-icon" />
              <span className="pt-doc-name">{name}</span>
              <span className="pt-doc-meta">
                <StatusChip doc={d} />
                <span className="pt-doc-when">{receivedLine(d.received_day)}</span>
              </span>
              <span className="pt-doc-acts">
                <button type="button" className="btn sm pt-doc-view" onClick={() => onView(d.id)} aria-label={`View ${name}`}>View</button>
                <button type="button" className="pt-doc-hist" aria-expanded={isOpen} aria-controls={panel} onClick={() => onToggle(d.id)}>
                  History<Icon name="chevron" size={14} className="pt-chev" />
                </button>
              </span>
            </div>
            {isOpen ? (
              <div id={panel} className="pt-doc-more">
                <History detail={det} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

interface SheetProps {
  doc: ClientDocument | undefined
  detail: DetailState | undefined
  onClose: () => void
}

/** The document itself: its text in the serif "paper" style, plus its history. */
export function DocSheet({ doc, detail, onClose }: SheetProps) {
  const det = typeof detail === 'object' ? detail : undefined
  const name = safe(det?.name ?? doc?.name, 'Document')
  const chipDoc = det ? { status: doc?.status, status_word: det.status_word } : doc
  return (
    <Dialog.Root open={!!doc} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pt-overlay" />
        <Dialog.Content className="pt-sheet" aria-describedby={undefined}>
          <header className="pt-sheet-head">
            <div className="pt-sheet-titles">
              <Dialog.Title className="pt-sheet-title">{name}</Dialog.Title>
              <p className="pt-sheet-meta">
                <span>{receivedLine(det?.received_day ?? doc?.received_day)}</span>
                {chipDoc ? <StatusChip doc={chipDoc} /> : null}
              </p>
            </div>
            <Dialog.Close className="pt-icon-btn" aria-label="Close"><Icon name="x" size={16} /></Dialog.Close>
          </header>
          {detail === undefined || detail === 'loading' ? (
            <p className="pt-hist-msg"><Icon name="spinner" size={14} className="spin" />Loading the document…</p>
          ) : detail === 'unavailable' || detail === 'error' ? (
            <p className="pt-hist-msg">This document can’t be shown right now.</p>
          ) : (
            <>
              {det?.text ? <pre className="pt-paper">{det.text}</pre> : <p className="pt-hist-msg">There is no text to show for this file.</p>}
              <section className="pt-sheet-sec">
                <h3>History</h3>
                <History detail={detail} />
              </section>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
