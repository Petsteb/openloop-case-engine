import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { useQueue } from './queue'
import { rowSeq, unreadNotes } from './queue-derive'
import { getSeen, setSeenMany } from './seen'
import { caseHref, go } from './useHashRoute'
import './home.css'

const MAX_ITEMS = 12

function BellIcon() {
  return (
    <svg className="icon" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  )
}

/** Notification bell, in both bank headers. Unread = a seq above the case's last-seen seq in localStorage.
 *  The case on screen (`currentCaseId`) never counts as unread: the analyst is looking at it. */
export function Bell({ currentCaseId = null }: { currentCaseId?: string | null }) {
  const { notes, rows, seenRev } = useQueue()
  const [open, setOpen] = useState(false)
  const unread = useMemo(() => (notes ? unreadNotes(notes, getSeen, currentCaseId) : []), [notes, currentCaseId, seenRev]) // eslint-disable-line react-hooks/exhaustive-deps
  const unreadKeys = useMemo(() => new Set(unread.map((x) => `${x.case_id}:${x.seq}`)), [unread])
  const items = notes ? notes.slice(0, MAX_ITEMS) : []
  const count = unread.length

  const markAll = () => {
    const best = new Map<string, number>()
    const up = (id: string, seq: number) => { if (id && seq > (best.get(id) ?? 0)) best.set(id, seq) }
    for (const x of notes ?? []) up(x.case_id, Number(x.seq) || 0)
    for (const r of rows ?? []) up(r.id, rowSeq(r))
    // never lower a value: the case screen writes the full ledger seq, which can be above these
    setSeenMany([...best].filter(([id, seq]) => seq > getSeen(id)))
  }

  const label = notes === null ? 'Notifications' : count ? `Notifications, ${count} unread` : 'Notifications, nothing new'
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={`btn quiet sm bell${count ? ' has-unread' : ''}`} aria-label={label} title="Notifications">
          <BellIcon />
          {count ? <span className="badge-count" aria-hidden="true">{count > 99 ? '99+' : count}</span> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="bell-pop" align="end" sideOffset={8} collisionPadding={16}>
          <div className="bell-head">
            <h2>Notifications</h2>
            {notes && notes.length ? (
              <button type="button" className="linkish" onClick={markAll} disabled={!count}>Mark all read</button>
            ) : null}
          </div>
          {notes === null ? <p className="empty">Notifications are not available on this server yet.</p>
            : !items.length ? <p className="empty">Nothing new. Updates from your files appear here.</p> : (
              <ul className="bell-list">
                {items.map((x) => {
                  const isNew = unreadKeys.has(`${x.case_id}:${x.seq}`)
                  return (
                    <li key={`${x.case_id}:${x.seq}`}>
                      <button type="button" className={`bell-item${isNew ? ' is-new' : ''}`}
                        onClick={() => { setOpen(false); go(caseHref(x.case_id)) }}>
                        <span className="bell-dot" aria-hidden="true" />
                        <span className="bell-co">{x.company || x.case_id}</span>
                        <span className="bell-day">{Number.isFinite(Number(x.day)) ? `Day ${x.day}` : ''}</span>
                        <span className="bell-text">{x.text}</span>
                        {isNew ? <span className="sr-only">New.</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
