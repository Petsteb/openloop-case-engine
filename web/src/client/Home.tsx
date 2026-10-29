import { useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { ApiError, isUnavailable } from './api'
import { Icon } from './Icon'
import {
  nextText, productFor, rowNeeds, rowStatusText, rowTone, safe, sortRows, STATE_SHORT, templateAbout, templateTitle,
} from './derive'
import { caseHref } from './route'
import { readSeen, useSeenRev } from './store'
import type { CaseRow, Company, PortalNotification, PortalState, Template } from './types'
import type { NextInfo, PortalData } from './usePortalData'

/* My files: what needs the client first, one row per file, and "Start a new application" with only the templates the
   chosen company can open. */

interface Props {
  data: PortalData
  company: Company | undefined
  onOpenCase: (id: string) => void
}

/** The file's one next action: exact when its client view is known, else from the row's count. */
function nextLine(r: CaseRow, info: NextInfo | undefined): string {
  if (info) return nextText(info.state, info.missing, info.confirmations, r.template)
  const n = rowNeeds(r)
  return n === 1 ? 'The bank needs one thing from you.' : `The bank needs ${n} things from you.`
}

/** "500,000 RON" for a loan file (its title already says "Working-capital loan"). */
function amountOf(r: CaseRow, title: string): string {
  const p = productFor(r.template, r.product)
  if (!p) return ''
  return p.toLowerCase().startsWith(title.toLowerCase()) ? p.slice(title.length).replace(/^[\s,·–-]+/, '') : p
}

function unreadByCase(notes: PortalNotification[] | null | undefined, rows: CaseRow[]): Set<string> {
  const len = new Map(rows.map((r) => [r.id, Number(r.events) || 0]))
  const out = new Set<string>()
  for (const n of Array.isArray(notes) ? notes : []) if (Number(n.seq) > readSeen(n.case_id, len.get(n.case_id))) out.add(n.case_id)
  return out
}

function Tone({ tone }: { tone: PortalState }) {
  return <span className={`pt-tone is-${tone}`}><i aria-hidden="true" />{STATE_SHORT[tone]}</span>
}

function FileRow({ r, info, unread }: { r: CaseRow; info: NextInfo | undefined; unread: boolean }) {
  const tone = rowTone(r)
  const title = templateTitle(r.template, r.template_title)
  const needs = rowNeeds(r) > 0
  const amount = amountOf(r, title)
  return (
    <li>
      <a className={`pt-file${needs ? ' is-needs' : ''}`} href={caseHref(r.id)}>
        <span className="pt-file-top">
          <span className="pt-file-kind">{title}</span>
          {unread ? <span className="pt-file-dot" title="New activity"><span className="sr-only">New activity</span></span> : null}
          <span className="pt-file-day">Day {Number(r.day) || 0}</span>
        </span>
        <span className="pt-file-status">{rowStatusText(r, tone)}</span>
        {needs ? <span className="pt-file-next">{nextLine(r, info)}</span> : null}
        <span className="pt-file-foot">
          <Tone tone={tone} />
          {amount ? <span className="pt-file-amount">{amount}</span> : null}
          <Icon name="chevron" size={16} className="pt-file-chev" />
        </span>
      </a>
    </li>
  )
}

function StartList({ company, templates, onOpenCase }: { company: Company; templates: Template[] | null; onOpenCase: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<{ id: string; text: string } | null>(null)
  const ids = Array.isArray(company.templates) ? company.templates : []

  const start = async (tid: string) => {
    if (busy) return
    setBusy(tid)
    setErr(null)
    try {
      const b = await api.createCase(tid, company.id)
      const id = b?.case?.id
      if (typeof id !== 'string' || !id) throw new ApiError(-1, 'No file id')
      toast('Your application is open. Please send the documents the bank asks for.')
      onOpenCase(id)
    } catch (e) {
      const name = safe(company.name, 'your company')
      if (e instanceof ApiError && e.status === 422) {
        setErr({ id: tid, text: `This application can’t be opened for ${name} right now. Please choose another one, or ask your bank officer.` })
      } else if (isUnavailable(e)) setErr({ id: tid, text: 'New applications open soon in this demo.' })
      else setErr({ id: tid, text: api.failureText(e) })
    } finally {
      setBusy(null)
    }
  }

  if (!ids.length) return <p className="pt-empty">There is nothing new to apply for right now.</p>
  return (
    <ul className="pt-starts">
      {ids.map((tid) => {
        const t = templates?.find((x) => x.id === tid)
        const title = templateTitle(tid, t?.title)
        return (
          <li key={tid} className="pt-start">
            <div className="pt-start-main">
              <h3 className="pt-start-title">{title}</h3>
              <p className="pt-start-about">{templateAbout(tid, t?.description)}</p>
            </div>
            <button type="button" className="btn pt-start-btn" onClick={() => void start(tid)} disabled={busy !== null}
              aria-busy={busy === tid || undefined} aria-label={`Start: ${title}`}>
              {busy === tid ? <><Icon name="spinner" size={14} className="spin" />Starting…</> : <><Icon name="plus" size={14} />Start</>}
            </button>
            {err?.id === tid ? <p className="pt-start-err" role="alert"><Icon name="alert" size={15} /><span>{err.text}</span></p> : null}
          </li>
        )
      })}
    </ul>
  )
}

export function Home({ data, company, onOpenCase }: Props) {
  useSeenRev()   // the unread dots follow the last-seen marks
  const rows = data.rows ? sortRows(data.rows) : null
  const name = safe(company?.name ?? rows?.[0]?.company, 'Your company')
  const where = [company?.city ? safe(company.city, '') : '', company?.cui ? `CUI ${company.cui}` : ''].filter(Boolean)
  const unread = unreadByCase(data.notes, rows ?? [])
  const needing = rows?.filter((r) => rowNeeds(r) > 0) ?? []
  const top = needing[0]

  return (
    <div className="pt-wrap">
      <header className="pt-head pt-home-head">
        <div className="pt-head-main">
          <p className="pt-eyebrow">Your files with the bank</p>
          <h1 className="pt-company">{name}</h1>
          {where.length ? <p className="pt-product pt-home-where">{where.map((w, i) => <span key={i}>{w}</span>)}</p> : null}
        </div>
      </header>

      {rows === null ? (
        data.rowsError ? (
          <div className="pt-loading" role="alert">
            <p>{data.rowsError}</p>
            <button type="button" className="btn" onClick={data.refetch}>Try again</button>
          </div>
        ) : <p className="pt-loading" role="status"><Icon name="spinner" size={16} className="spin" />Loading your files…</p>
      ) : (
        <>
          <div className={`pt-next${top ? ' is-needs' : ''}`}>
            <p className="pt-next-text">
              {top ? (
                <>
                  <span className="pt-next-file">{templateTitle(top.template, top.template_title)}
                    {needing.length > 1 ? <span className="pt-next-more"> · {needing.length - 1} more {needing.length === 2 ? 'file needs' : 'files need'} you</span> : null}
                  </span>
                  {nextLine(top, data.next[top.id])}
                </>
              ) : rows.length ? 'Nothing to do right now. We’ll let you know here when the bank needs something.'
                : 'You have no open files yet. Start an application when you’re ready.'}
            </p>
            {top ? (
              <a className="btn primary pt-next-btn" href={caseHref(top.id)}>Open this file<Icon name="chevron" size={14} /></a>
            ) : null}
          </div>

          <main className="pt-home-grid">
            <section className="pt-sec pt-a-files" aria-labelledby="h-files">
              <h2 id="h-files" className="pt-h2">My files{rows.length ? <span className="pt-count">{rows.length}</span> : null}</h2>
              {rows.length ? (
                <ul className="pt-files">
                  {rows.map((r) => <FileRow key={r.id} r={r} info={data.next[r.id]} unread={unread.has(r.id)} />)}
                </ul>
              ) : <p className="pt-empty">No files yet.</p>}
            </section>

            {!data.legacy ? (
              <section className="pt-sec pt-a-start" aria-labelledby="h-start">
                <h2 id="h-start" className="pt-h2">Start a new application</h2>
                {company ? (
                  <>
                    <p className="pt-start-intro">The bank asks only for what it needs, and you can follow each file here.</p>
                    <StartList key={company.id} company={company} templates={data.templates}
                      onOpenCase={(id) => { data.refetch(); onOpenCase(id) }} />
                  </>
                ) : <p className="pt-loading" role="status"><Icon name="spinner" size={16} className="spin" />Loading…</p>}
              </section>
            ) : null}
          </main>
        </>
      )}

      <footer className="pt-foot">
        <Icon name="shield" size={16} />
        <p>Internal reviews and staff notes are not shown here. A bank officer makes every decision on your files.</p>
      </footer>
    </div>
  )
}
