import { dayText, plural, type DocRow } from '@/lib/derive'
import type { Bundle } from '@/lib/types'
import { docFileUrl } from '@/shared/docfile'
import { Icon } from './Icon'

function dates(b: Bundle, r: DocRow): string {
  const rec = r.receivedDay !== null ? dayText(b, r.receivedDay) : ''
  // a quarantined or unread document was never checked: its issue date is unverified and it has no validity window
  if (r.status === 'quarantined' || r.status === 'unreadable') return rec ? `Received ${rec}. Validity not checked` : 'Validity not checked'
  const iss = r.issuedDay !== null ? dayText(b, r.issuedDay) : ''
  if (iss && rec && iss === rec) return `Issued and received ${rec}`
  if (iss && rec) return `Issued ${iss}, received ${rec}`
  if (rec) return `Received ${rec}`
  return iss ? `Issued ${iss}` : ''
}

/** Docs tab: every document in the case, newest first, with its status and the checks that use it. */
export function DocsList({ bundle, rows, onOpen }: { bundle: Bundle; rows: DocRow[]; onOpen: (id: string) => void }) {
  if (!rows.length) return <p className="empty">No documents yet. They appear here as soon as the client sends them.</p>
  const counts = (['expired', 'quarantined', 'unreadable', 'superseded'] as const)
    .map((s) => [s, rows.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0)
  const words = (s: string, n: number) => (s === 'unreadable' ? (n === 1 ? 'needs manual reading' : 'need manual reading') : s)
  const caseId = bundle.case?.id ? String(bundle.case.id) : ''
  return (
    <div className="docs">
      <p className="docs-sum">
        {plural(rows.length, 'document')}{counts.length ? `, ${counts.map(([s, n]) => `${n} ${words(s, n)}`).join(', ')}` : ''}.
      </p>
      {rows.map((r) => {
        // the type label only adds something when the name does not already say it
        const label = r.name.toLowerCase().startsWith(r.label.toLowerCase()) ? '' : r.label
        const d = dates(bundle, r)
        return (
          // the row opens the viewer; Open beside it is the original file in a new tab (a link can't sit inside a button)
          <div key={r.id} className="docrow-item">
          <button type="button" className={'docrow' + (r.status === 'superseded' ? ' is-old' : '')} onClick={() => onOpen(r.id)}
            aria-label={`View ${r.name} (${r.id}), ${r.statusWord}`}>
            <span className="rid">{r.id}</span>
            <span className="docrow-name">{r.name}</span>
            <span className={`st ${r.statusCls}`}><i aria-hidden="true" />{r.statusWord}</span>
            <span className="docrow-meta">{[label, d].filter(Boolean).join('. ')}</span>
            <span className="docrow-uses">
              {r.usedBy.length ? <>Used by {r.usedBy.map((u) => <span key={u.id} className="mono" title={`${u.title}: ${u.word.toLowerCase()}`}>{u.id}</span>)}</>
                : 'Not used by a check'}
            </span>
          </button>
          {caseId ? (
            <a className="btn sm quiet docrow-open" href={docFileUrl(caseId, r.id, 'employee')} target="_blank" rel="noopener"
              aria-label={`Open the original ${r.name} (new tab)`}>Open<Icon name="external" size={13} /></a>
          ) : null}
          </div>
        )
      })}
    </div>
  )
}
