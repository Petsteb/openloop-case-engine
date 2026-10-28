import { Icon } from './Icon'
import { dayOf, hhmm } from './derive'
import type { ClientEmail, ClientView } from './types'

export const mailId = (e: ClientEmail, i: number) => `${e.sim_time}#${i}`

interface Props {
  view: ClientView
  emails: { e: ClientEmail; id: string }[]   // newest first
  open: Set<string>
  flash: string | null
  onToggle: (id: string) => void
}

/** The emails the bank sent, verbatim in Romanian, newest first. The body opens on click. */
export function Messages({ view, emails, open, flash, onToggle }: Props) {
  if (!emails.length) return <p className="pt-empty">No messages yet.</p>
  return (
    <ul className="pt-mails">
      {emails.map(({ e, id }) => {
        const isOpen = open.has(id)
        const day = dayOf(e.sim_time, view)
        const bodyId = `mail-${id.replace(/[^a-z0-9]/gi, '')}`
        return (
          <li key={id} className={`pt-mail${flash === id ? ' pt-flash' : ''}`} data-mail={id}>
            <button type="button" className="pt-mail-head" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => onToggle(id)}>
              <Icon name="chevron" size={14} className="pt-chev" />
              <span className="pt-mail-subj" lang="ro">{e.subject || '(fără subiect)'}</span>
              <span className="pt-mail-when">{day != null ? `Day ${day}, ` : ''}{hhmm(e.sim_time)}</span>
            </button>
            {isOpen ? <div id={bodyId} className="pt-mail-body" lang="ro">{e.body}</div> : null}
          </li>
        )
      })}
    </ul>
  )
}
