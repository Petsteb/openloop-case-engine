import { useState, type ReactNode } from 'react'
import {
  caseClock, dayText, docFieldName, docSegments, docViewFromApi, docViewFromBundle, sentence, type DocRow, type DocView, type DocViewField,
} from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import { useDocDetail } from '@/hooks/useDocs'
import { Icon } from './Icon'
import { StatusWord } from './StatusWord'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet'

const EXTRACTOR_NAME: Record<string, string> = { builtin: 'Built-in parser', bank_docai: 'Bank document AI' }

/** "Superseded by doc-11 (…)": the doc id opens that document. */
function linkDocs(text: string, onOpenDoc: (id: string) => void): ReactNode[] {
  return text.split(/\b(doc-\d+)\b/g).map((p, i) => (/^doc-\d+$/.test(p)
    ? <button key={i} type="button" className="cite" onClick={() => onOpenDoc(p)}>{p}</button> : p))
}

function fieldTitle(fs: DocViewField[]) {
  return fs.map((f) => `${docFieldName(f.field)}${f.value ? `: ${f.value}` : ''}${f.verified === false ? ' (not verified)' : ''}`).join('\n')
}

/** The full text in the serif paper style; each extracted field's quote is marked, injection lines in the conflict tone. */
function Paper({ v }: { v: DocView & { text: string } }) {
  const { parts } = docSegments(v.text, v.fields, v.injections)
  return (
    <pre className="doc-paper" aria-label={`Full text of ${v.name}`}>
      {parts.map((p, i) => {
        if (!p.mark) return p.t
        if (p.mark.kind === 'injection') return <mark key={i} className="hl-inj" title="Ignored instruction in document">{p.t}</mark>
        const unverified = p.mark.fields.some((f) => f.verified === false)
        return <mark key={i} className={unverified ? 'hl-review' : 'hl'} title={fieldTitle(p.mark.fields)}>{p.t}</mark>
      })}
    </pre>
  )
}

function Body({ bundle, v, loading, onOpenDoc, onOpenLedger, onSelectRequirement }: {
  bundle: Bundle; v: DocView; loading: boolean
  onOpenDoc: (id: string) => void; onOpenLedger: (seq: number | null) => void; onSelectRequirement: (id: string) => void
}) {
  const clock = caseClock(bundle)
  const received = v.receivedAt !== null ? clock.fWhen(v.receivedAt) : v.receivedDay !== null ? sentence(dayText(bundle, v.receivedDay)) : ''
  const issued = v.issuedDay !== null ? sentence(dayText(bundle, v.issuedDay)) : ''
  const val = v.validity
  const quarantined = v.status === 'quarantined'
  const unreadable = v.status === 'unreadable'
  const fields = v.fields.filter((f) => f.value || f.quote)
  const allOk = fields.length > 0 && fields.every((f) => f.verified !== false)
  const unplaced = v.text ? docSegments(v.text, v.fields, v.injections).unplaced : []
  // Summary first: the highlights already show every quote, so the field list folds unless something needs a look.
  // null = automatic (decided once the text has loaded), then whatever the analyst chose
  const [fieldsOpen, setFieldsOpen] = useState<boolean | null>(null)
  const showFields = fieldsOpen ?? (v.text === null || !allOk || unplaced.length > 0)
  return (
    <>
      <header className="doc-head">
        <div className="doc-kicker">
          <span className="chip">{v.id}</span>
          <span>{v.label}</span>
          {v.statusWord ? <span className={`st ${v.statusCls}`}><i aria-hidden="true" />{v.statusWord}</span> : null}
        </div>
        <SheetTitle>{v.name}</SheetTitle>
        <SheetDescription className="sr-only">The full document, the checks that use it and its history in the ledger.</SheetDescription>
        {v.origin !== 'missing' ? (
          <dl className="props doc-props">
            {issued ? <div><dt>Issued</dt><dd>{issued}</dd></div> : null}
            {received ? <div><dt>Received</dt><dd>{received}</dd></div> : null}
            <div><dt>Validity</dt><dd>
              {/* a rejected or unread document was never checked, whatever window the server computes */}
              {quarantined || unreadable ? <span className="muted">Not checked</span> : val && val.expiresDay !== null ? (
                <span className={'vchip' + (val.expired ? ' is-expired' : '')} title={`Day ${val.expiresDay} of the case`}>
                  <i aria-hidden="true" />{val.expired ? `Expired ${dayText(bundle, val.expiresDay).replace(/^day \d+, /, '')}` : `Valid until ${dayText(bundle, val.expiresDay).replace(/^day \d+, /, '')}`}
                </span>
              ) : <span className="muted">No expiry date</span>}
            </dd></div>
            <div><dt>Extracted by</dt><dd>
              {v.extractor ? <span className="mono" title={EXTRACTOR_NAME[v.extractor] || v.extractor}>{v.extractor}</span> : <span className="muted">Not extracted</span>}
            </dd></div>
          </dl>
        ) : null}
      </header>

      {v.origin === 'missing' && !loading ? (
        <p className="muted small">This document is not in this case.</p>
      ) : (
        <>
          <section className="doc-sec" aria-label="Document text">
            <h3>Document</h3>
            {quarantined ? (
              <p className="doc-flag conflict">Quarantined{v.quarantineReason ? `: ${v.quarantineReason.replace(/\.$/, '')}` : ''}. Nothing was extracted from it.</p>
            ) : null}
            {unreadable ? <p className="doc-flag review">This file needs manual reading. Nothing was extracted from it automatically.</p> : null}
            {loading ? <p className="muted small" role="status">Opening the document…</p>
              : v.text !== null ? <Paper v={v as DocView & { text: string }} />
                : !unreadable ? (
                  <>
                    <p className="muted small">The full text is not available on this server. These are the quotes used as evidence.</p>
                    {fields.some((f) => f.quote) ? (
                      <div className="papers">
                        {fields.filter((f) => f.quote).map((f, i) => (
                          <figure key={i} className="paper"><pre>{f.quote}</pre><figcaption>{docFieldName(f.field)}</figcaption></figure>
                        ))}
                      </div>
                    ) : <p className="muted small">No quotes from this document are used as evidence yet.</p>}
                  </>
                ) : null}
          </section>

          {!loading && fields.length ? (
            <section className="doc-sec" aria-label="Extracted fields">
              <button type="button" className="fold doc-fold" aria-expanded={showFields} onClick={() => setFieldsOpen(!showFields)}>
                <Icon name="chevron" size={14} />
                <span>Extracted fields <span className="mono">{fields.length}</span></span>
                {allOk ? <span className="doc-sub">every quote found in the document</span> : null}
              </button>
              {showFields ? <dl className="doc-fields">
                {fields.map((f, i) => (
                  <div key={i}>
                    <dt>{docFieldName(f.field)}</dt>
                    <dd>
                      <span>{f.value || <span className="muted">quoted</span>}</span>
                      {f.verified === false ? <span className="st st-review"><i aria-hidden="true" />Not verified</span> : null}
                      {unplaced.includes(f) && f.verified !== false ? <span className="muted tiny">quote not located in the text</span> : null}
                    </dd>
                  </div>
                ))}
              </dl> : null}
            </section>
          ) : null}

          {!loading && (v.rejected.length || v.injections.length) ? (
            <section className="doc-sec" aria-label="Problems in this document">
              <h3>Not used as evidence</h3>
              <ul className="doc-rej">
                {v.rejected.map((q, i) => (
                  <li key={`r${i}`}><q>{q}</q><span className="ln-note">Rejected: quote not found in document</span></li>
                ))}
                {v.injections.map((q, i) => (
                  <li key={`i${i}`}><q>{q}</q><span className="ln-note">Ignored instruction in document</span></li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="doc-sec" aria-label="Checks that use this document">
            <h3>Used by <span className="mono">{v.usedBy.length}</span></h3>
            {v.usedBy.length ? (
              <div className="doc-uses">
                {v.usedBy.map((u) => (
                  <button key={u.id} type="button" className="doc-use" onClick={() => onSelectRequirement(u.id)} title={`Show check ${u.id}`}>
                    <span className="rid">{u.id}</span>
                    <span className="doc-use-title">{u.title}</span>
                    {u.kind ? <StatusWord kind={u.kind} /> : <span className="st">{u.word}</span>}
                  </button>
                ))}
              </div>
            ) : <p className="muted small">{v.status === 'superseded' ? 'No check uses it any more. A newer document replaced it.' : 'No check uses this document.'}</p>}
          </section>

          <section className="doc-sec" aria-label="History of this document">
            <h3>History <span className="mono">{v.history.length}</span></h3>
            {v.history.length ? (
              <ol className="doc-hist">
                {v.history.map((h, i) => (
                  <li key={`${h.seq ?? 'x'}-${i}`}>
                    <span className="doc-hist-day">{h.day !== null ? `Day ${h.day}` : ''}</span>
                    <span className="doc-hist-what">{linkDocs(h.what, onOpenDoc)}</span>
                    {h.seq !== null ? (
                      <button type="button" className="cite" onClick={() => onOpenLedger(h.seq)} title="Show this event in the ledger">#{h.seq}</button>
                    ) : <span />}
                  </li>
                ))}
              </ol>
            ) : <p className="muted small">{loading ? '' : 'No ledger events name this document yet.'}</p>}
          </section>
        </>
      )}
    </>
  )
}

/**
 * The document viewer: a right-side sheet opened from evidence quotes, decision-card slips, `doc-N` chat citations
 * and the Docs tab. Reads `GET /documents/{id}?role=employee`; without that endpoint it is built from the bundle.
 */
export function DocumentViewer({ bundle, caseId, docId, rows, onClose, onOpenDoc, onOpenLedger, onSelectRequirement }: {
  bundle: Bundle
  caseId: string
  docId: string | null
  rows: DocRow[]
  onClose: () => void
  onOpenDoc: (id: string) => void
  onOpenLedger: (seq: number | null) => void
  onSelectRequirement: (id: string) => void
}) {
  // keep the last document on screen while the sheet slides out (state from the previous render, React's pattern)
  const [last, setLast] = useState<string | null>(docId)
  if (docId && docId !== last) setLast(docId)
  const id = docId ?? last
  const { detail, loading } = useDocDetail(caseId, docId, bundle)
  let v: DocView | null = null
  if (id) {
    const row = rows.find((r) => r.id === id)
    if (detail) v = docViewFromApi(bundle, detail, row)
    else {
      const f = docViewFromBundle(bundle, id)
      v = f.origin === 'missing' && row ? { ...f, ...row, origin: 'case' } : f
    }
  }
  return (
    <Sheet open={!!docId} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="ol-sheet doc-sheet">
        {v ? <Body key={v.id} bundle={bundle} v={v} loading={loading && !!docId}
          onOpenDoc={onOpenDoc} onOpenLedger={onOpenLedger} onSelectRequirement={onSelectRequirement} /> : <SheetTitle className="sr-only">Document</SheetTitle>}
      </SheetContent>
    </Sheet>
  )
}
