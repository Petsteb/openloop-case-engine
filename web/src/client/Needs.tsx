import { useRef, type ChangeEvent } from 'react'
import { Icon } from './Icon'
import { MAX_UPLOAD_BYTES, UPLOAD_EXT } from './api'
import { confirmFallback, expiredFor, latestFor, plural, safe, whyFor } from './derive'
import type { ClientDocument, Confirmation, ConfirmKind, MissingDocument } from './types'

export type CardState = 'uploading' | 'received' | 'rejected'

interface RequestProps {
  req: MissingDocument
  docs: ClientDocument[]
  state: CardState | undefined
  ghost: boolean
  flash: boolean
  sample: { ok: boolean; wrong: boolean }
  busy: boolean
  onFile: (req: MissingDocument, file: File) => void
  onSample: (req: MissingDocument, variant: 'ok' | 'wrong_company') => void
  onInvalid: (msg: string) => void
  registerInput: (key: string, el: HTMLInputElement | null) => void
}

function whenLine(r: MissingDocument): string {
  const parts = [`Asked on day ${r.requested_day}.`]
  if (r.reminders > 0) parts.push(`${plural(r.reminders, 'reminder', 'reminders')} sent.`)
  if (r.next_reminder_day != null) parts.push(`Next reminder on day ${r.next_reminder_day}.`)
  return parts.join(' ')
}

/** Masked numbers ("07•• ••• 958") must not break across lines. */
const keepTogether = (s: string) => s.replace(/[\d•]+(?: [\d•]+)+/g, (m) => m.replace(/ /g, ' '))

/** One pending request: what, why, when, and the two ways to send it. */
export function RequestCard({ req, docs, state, ghost, flash, sample, busy, onFile, onSample, onInvalid, registerInput }: RequestProps) {
  const input = useRef<HTMLInputElement | null>(null)
  const latest = latestFor(req, docs)
  const rejected = state === 'rejected' || (state === undefined && latest?.status === 'quarantined')
  const unreadable = !ghost && state !== 'uploading' && state !== 'rejected' && latest?.status === 'unreadable'
  const expired = !rejected && !unreadable && expiredFor(req, docs)
  const label = safe(req.label, 'A document')

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''   // picking the same file again must fire change
    if (!f) return
    if (!UPLOAD_EXT.test(f.name)) return onInvalid('Please choose a .txt or .pdf file.')
    if (f.size > MAX_UPLOAD_BYTES) return onInvalid('That file is larger than 1 MB. Please choose a smaller one.')
    onFile(req, f)
  }

  return (
    <article className={`pt-card${ghost ? ' is-done' : ''}${flash ? ' pt-flash' : ''}`} data-key={req.key} aria-busy={state === 'uploading' || undefined}>
      <div className="pt-card-main">
        <h3 className="pt-card-title">{label}</h3>
        <p className="pt-why">{whyFor(req)}</p>
        <p className="pt-when">{whenLine(req)}</p>
      </div>

      {expired && !ghost ? (
        <p className="pt-note tone-expired"><Icon name="clock" size={15} /><span>Your previous copy expired. Please send a new one.</span></p>
      ) : null}
      {rejected && !ghost ? (
        <p className="pt-note tone-conflict" role="status"><Icon name="alert" size={15} />
          <span>Not accepted: this document seems to belong to another company. Please upload yours.</span></p>
      ) : null}
      {unreadable && !rejected ? (
        <p className="pt-note" role="status"><Icon name="clock" size={15} /><span>Received, waiting for manual reading. You can also send a .txt copy.</span></p>
      ) : null}

      <div className="pt-card-foot">
        {state === 'uploading' ? (
          <p className="pt-progress" role="status"><Icon name="spinner" size={15} className="spin" /><span>Uploading…</span></p>
        ) : state === 'received' || ghost ? (
          <p className="pt-progress is-ok" role="status"><Icon name="check" size={15} /><span>Received, we’re checking it</span></p>
        ) : (
          <>
            <div className="pt-actions">
              <input ref={(el) => { input.current = el; registerInput(req.key, el) }} type="file" accept=".txt,.pdf,text/plain,application/pdf"
                className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />
              <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
                <Icon name="upload" size={14} />Upload file
              </button>
              {sample.ok ? (
                <button type="button" className="btn quiet" disabled={busy} onClick={() => onSample(req, 'ok')}>Use sample file</button>
              ) : null}
            </div>
            <p className="pt-hint">.txt or .pdf, up to 1 MB.</p>
            {sample.wrong ? (
              <button type="button" className="pt-link" disabled={busy} onClick={() => onSample(req, 'wrong_company')}>Try a wrong file (demo)</button>
            ) : null}
          </>
        )}
      </div>
    </article>
  )
}

interface ConfirmProps {
  c: Confirmation
  pending: boolean
  busy: boolean
  flash: boolean
  onAnswer: (kind: ConfirmKind, answer: 'yes' | 'no') => void
}

/** A question from the bank with two answers: a contact change made by staff, or consent to a credit-bureau check. */
export function ConfirmCard({ c, pending, busy, flash, onAnswer }: ConfirmProps) {
  const consent = c.kind === 'credit_check_consent'
  const kind = (consent ? 'credit_check_consent' : 'contact_change') as ConfirmKind
  return (
    <article className={`pt-card pt-confirm${flash ? ' pt-flash' : ''}`} data-confirm={c.kind}>
      <div className="pt-card-main">
        <p className="pt-eyebrow"><Icon name={consent ? 'shield' : 'phone'} size={14} />{consent ? 'Your consent' : 'Please confirm a change'}</p>
        <h3 className="pt-card-title is-q">{keepTogether(safe(c.text, confirmFallback(c)))}</h3>
      </div>
      <div className="pt-card-foot">
        <div className="pt-actions">
          <button type="button" className="btn" disabled={busy} aria-busy={pending || undefined} onClick={() => onAnswer(kind, 'yes')}>
            {pending ? <Icon name="spinner" size={14} className="spin" /> : null}
            {consent ? 'I consent' : 'Yes, I made this change'}
          </button>
          <button type="button" className="btn quiet" disabled={busy} onClick={() => onAnswer(kind, 'no')}>
            {consent ? 'Not now' : 'No, I didn’t'}
          </button>
        </div>
      </div>
    </article>
  )
}

/** Shown after "No, I didn't": the dispute went to the bank. */
export function DisputeNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <article className="pt-card pt-dispute" role="status">
      <div className="pt-card-main">
        <p className="pt-eyebrow tone-conflict"><Icon name="shield" size={14} />Change reported</p>
        <h3 className="pt-card-title is-q">Thank you for telling us. Our team will contact you.</h3>
        <p className="pt-why">We have alerted the bank. Until we call, please don’t share any codes sent to the new number.</p>
      </div>
      <div className="pt-card-foot">
        <button type="button" className="pt-link" onClick={onDismiss}>Hide this message</button>
      </div>
    </article>
  )
}
