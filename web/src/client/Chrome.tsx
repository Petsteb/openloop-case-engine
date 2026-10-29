import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import { notificationText, plural } from './derive'
import { caseHref, HOME_HREF } from './route'
import { markSeen, readSeen, useSeenRev } from './store'
import type { Theme } from './theme'
import type { Company, PortalNotification } from './types'

/* The portal's frame: the demo strip (company picker, bank screen link, theme) and the top bar (back link, bell). */

interface StripProps {
  theme: Theme
  onTheme: () => void
  companies: Company[] | null
  companyId: string
  onCompany: (id: string) => void
}

export function DemoStrip({ theme, onTheme, companies, companyId, onCompany }: StripProps) {
  const list = companies && companies.length ? companies : null
  const current = list?.find((c) => c.id === companyId)
  return (
    <div className="pt-demo">
      <div className="pt-demo-in">
        <label className="pt-demo-who">
          <span><b>Demo:</b> viewing as</span>
          {list ? (
            <span className="pt-picker">
              <select value={current ? companyId : ''} onChange={(e) => onCompany(e.target.value)} aria-label="Demo: view the portal as this company">
                {!current ? <option value="" disabled>Choose a company</option> : null}
                {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Icon name="chevron" size={13} className="pt-picker-chev" />
            </span>
          ) : <span className="pt-picker-wait">…</span>}
        </label>
        <div className="pt-demo-tools">
          <a className="pt-demo-link" href="/" target="_blank" rel="noopener" aria-label="Bank screen (opens in a new tab)">
            <span>Bank screen</span><Icon name="external" size={13} />
          </a>
          <button type="button" className="pt-icon-btn" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface BarProps {
  back: boolean
  notes: PortalNotification[] | null | undefined
  titles: Record<string, string>
  /** each file's ledger length (row `events`), to drop stale last-seen values after a demo reset */
  lengths: Record<string, number>
  /** the file on screen: its notifications are not unread (the page marks it seen) */
  currentCaseId: string | null
  onOpenCase: (id: string) => void
}

/** "← My files" on a file page, a quiet label on My files, and the bell on the right. */
export function TopBar({ back, notes, titles, lengths, currentCaseId, onOpenCase }: BarProps) {
  return (
    <div className="pt-bar">
      {back ? (
        <a className="pt-back" href={HOME_HREF}><span aria-hidden="true">←</span>My files</a>
      ) : <span className="pt-bar-label">Client portal</span>}
      <Bell notes={notes} titles={titles} lengths={lengths} currentCaseId={currentCaseId} onOpenCase={onOpenCase} />
    </div>
  )
}

const isUnread = (n: PortalNotification, lengths: Record<string, number>, current: string | null) =>
  n.case_id !== current && Number(n.seq) > readSeen(n.case_id, lengths[n.case_id])
const SHOW = 8

/** Unread = a notification whose seq is past the file's last-seen seq (openloop-seen:client:<caseId>). */
function Bell({ notes, titles, lengths, currentCaseId, onOpenCase }: Omit<BarProps, 'back'>) {
  useSeenRev()   // re-render when a file is marked seen
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement | null>(null)
  const panel = useRef<HTMLDivElement | null>(null)
  const panelId = useId()
  const list = Array.isArray(notes) ? notes : []
  const unread = list.filter((n) => isUnread(n, lengths, currentCaseId))
  const count = notes ? unread.length : 0

  const close = (focusBell = true) => {
    setOpen(false)
    if (focusBell) requestAnimationFrame(() => btn.current?.focus())
  }
  // Modal while open (a full-width sheet on a phone): focus moves in, Tab stays inside, Esc closes, focus returns to the bell.
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus() ?? panel.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      const el = panel.current
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      if (!items.length) { e.preventDefault(); el.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const at = document.activeElement
      const inside = !!at && el.contains(at)
      if (e.shiftKey && (!inside || at === first || at === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (!inside || at === last)) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const markAll = () => {
    const max = new Map<string, number>()
    for (const n of list) max.set(n.case_id, Math.max(max.get(n.case_id) ?? 0, Number(n.seq) || 0))
    max.forEach((seq, id) => markSeen(id, seq, lengths[id]))
  }
  const pick = (n: PortalNotification) => {
    close(false)
    onOpenCase(n.case_id)
  }

  const label = notes === null ? 'Notifications' : count ? `Notifications, ${plural(count, 'unread', 'unread')}` : 'Notifications, none unread'
  return (
    <div className="pt-bell">
      <button ref={btn} type="button" className={`pt-bell-btn${count ? ' has-unread' : ''}`} aria-label={label} aria-expanded={open}
        aria-controls={open ? panelId : undefined} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" size={18} />
        {count ? <span className="pt-bell-count" aria-hidden="true">{count > 9 ? '9+' : count}</span> : null}
      </button>
      {open ? (
        <>
          <div className="pt-bell-scrim" onClick={() => close()} aria-hidden="true" />
          <div ref={panel} id={panelId} className="pt-bell-pop" role="dialog" aria-modal="true" aria-label="Notifications" tabIndex={-1}>
            <div className="pt-bell-head">
              <h2 className="pt-bell-title">Notifications</h2>
              <button type="button" className="pt-link pt-bell-all" onClick={markAll} disabled={!unread.length}>Mark all read</button>
              <button type="button" className="pt-icon-btn pt-bell-x" onClick={() => close()} aria-label="Close notifications"><Icon name="x" size={16} /></button>
            </div>
            {notes === null ? <p className="pt-bell-empty">Notifications are not available on this server yet.</p>
              : notes === undefined ? <p className="pt-bell-empty"><Icon name="spinner" size={14} className="spin" />Loading…</p>
                : !list.length ? <p className="pt-bell-empty">Nothing new. We’ll let you know here when the bank needs you.</p> : (
                  <ul className="pt-bell-list">
                    {list.slice(0, SHOW).map((n, i) => {
                      const isNew = isUnread(n, lengths, currentCaseId)
                      return (
                        <li key={`${n.case_id}:${n.kind}:${n.seq}:${i}`}>
                          <a href={caseHref(n.case_id)} className={`pt-bell-item${isNew ? ' is-new' : ''}`}
                            onClick={(e) => { e.preventDefault(); pick(n) }}>
                            <span className="pt-bell-dot" aria-hidden="true" />
                            <span className="pt-bell-text">
                              {isNew ? <span className="sr-only">New: </span> : null}
                              <span className="pt-bell-what" lang={/^Email:/.test(n.text) ? 'ro' : undefined}>{notificationText(n)}</span>
                              <span className="pt-bell-meta">{titles[n.case_id] ?? 'Your file'}{n.day != null ? ` · Day ${n.day}` : ''}</span>
                            </span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                )}
          </div>
        </>
      ) : null}
    </div>
  )
}
