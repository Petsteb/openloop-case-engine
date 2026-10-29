import { useMemo, useState } from 'react'
import { Btn } from '@/components/Btn'
import { Icon } from '@/components/Icon'
import { store } from '@/lib/store'
import { SessionChip } from '@/shared/session'
import { Bell } from './Bell'
import { NewCaseSheet } from './NewCase'
import { invalidateQueue, useQueue } from './queue'
import {
  FILTERS, bucketCounts, bucketOf, countWord, filesWord, lastActivity, matches, rowMeta, rowSeq, summary, type Filter,
} from './queue-derive'
import { getSeen } from './seen'
import type { CaseRow } from './types'
import { caseHref } from './useHashRoute'
import './home.css'

const DOT: Record<ReturnType<typeof bucketOf>, string> = { needs: 'need', ready: 'done', hold: 'hold', waiting: 'wait', working: 'wait' }
const BUCKET_WORD: Record<ReturnType<typeof bucketOf>, string> = {
  needs: 'Needs you', ready: 'Ready', hold: 'On hold', waiting: 'Waiting on client', working: 'In progress',
}

/** A count cell: a bare numeral under the column header on wide screens, "2 waiting on client" inline on phones. */
function Count({ value, word, kind }: { value: number; word: string; kind?: 'need' }) {
  const v = Number(value) || 0
  return (
    <span className={`q-n${v ? '' : ' is-zero'}${kind && v ? ` is-${kind}` : ''}`}>
      <b>{v ? v : <><span aria-hidden="true">–</span><span className="sr-only">0</span></>}</b>
      <span className="q-l"> {word}</span>
    </span>
  )
}

function Row({ r, unread }: { r: CaseRow; unread: boolean }) {
  const b = bucketOf(r)
  const meta = rowMeta(r)
  const when = lastActivity(r)
  const day = Number.isFinite(Number(r.day)) ? Number(r.day) : null
  const needs = Number(r.needs_you ?? r.open_decisions) || 0
  return (
    <li>
      <a className={`q-row q-${b}${unread ? ' is-unread' : ''}`} href={caseHref(r.id)}>
        <span className={`dot ${DOT[b]}`} aria-hidden="true" />
        <span className="q-main">
          <span className="q-top">
            <span className="q-co">{r.company || r.title || r.id}</span>
            {meta.template ? <span className="q-tpl">{meta.template}</span> : null}
            {meta.product ? <span className="q-tpl q-prod">{meta.product}</span> : null}
          </span>
          <span className="q-status"><span className="sr-only">{BUCKET_WORD[b]}. </span>{r.status_text || BUCKET_WORD[b]}</span>
        </span>
        <span className="q-facts">
          <Count value={needs} word={countWord.needs(needs)} kind="need" />
          <Count value={Number(r.open_decisions) || 0} word={countWord.decisions(Number(r.open_decisions) || 0)} />
          <Count value={Number(r.waiting_on_client) || 0} word={countWord.waiting()} />
          <span className="q-day">{day !== null ? `Day ${day}` : ''}</span>
          <span className="q-when">{when}</span>
        </span>
        <span className="q-unread" title={unread ? 'New activity since you last opened this file' : undefined}>
          {unread ? <><i aria-hidden="true" /><span className="sr-only">New activity.</span></> : null}
        </span>
      </a>
    </li>
  )
}

interface Props { theme: 'dark' | 'light'; onTheme: () => void }

/** The bank analyst's home: every open file, the ones that need a person first (the server's order is kept). */
export function WorkQueue({ theme, onTheme }: Props) {
  const { rows, fallback, error, seenRev } = useQueue()
  const [filter, setFilter] = useState<Filter>(() => {
    const f = store.get<Filter>('queue-filter', 'all')
    return FILTERS.some((x) => x.id === f) ? f : 'all'
  })
  const [creating, setCreating] = useState(false)
  const list = useMemo(() => rows ?? [], [rows])
  const counts = useMemo(() => bucketCounts(list), [list])
  const shown = useMemo(() => list.filter((r) => matches(r, filter)), [list, filter])
  // seenRev: re-read localStorage when any seen value changed
  const unread = useMemo(() => new Set(list.filter((r) => rowSeq(r) > getSeen(r.id)).map((r) => r.id)), [list, seenRev]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (f: Filter) => { setFilter(f); store.set('queue-filter', f) }
  const sum = summary(counts)
  const empty = FILTERS.find((x) => x.id === filter)?.empty ?? 'No files.'

  return (
    <main className="page q-page">
      <header className="casehead q-head">
        <div className="casehead-main">
          <span className="brand"><span className="brand-mark" aria-hidden="true" />OpenLoop</span>
          <div style={{ minWidth: 0 }}>
            <h1 className="case-name">Work queue</h1>
            <div className="case-sub">{rows ? `${filesWord(list.length)}, the ones that need you first` : 'Bank files across every client'}</div>
          </div>
        </div>
        <div className="case-side">
          {rows ? (
            <div className="case-meta q-sum" aria-label="Summary">
              {sum.map((s) => (
                <div key={s.id} className={`m${s.id === 'needs' && s.value ? ' is-need' : ''}`}><b>{s.value}</b><span>{s.label}</span></div>
              ))}
            </div>
          ) : null}
          <div className="case-tools">
            <Btn size="sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} />New case</Btn>
            <SessionChip app="staff" />
            <Bell />
            <button type="button" className="btn quiet icon-only sm" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            </button>
          </div>
        </div>
      </header>

      <section className="q-wrap" aria-label="Files">
        <div className="q-bar">
          <div className="seg q-seg" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => pick(f.id)}>
                {f.label}<span className="q-segn">{counts[f.id]}</span>
              </button>
            ))}
          </div>
          {fallback ? <span className="muted tiny">This server lists only the demo case.</span> : null}
        </div>

        {rows === null ? (
          error ? (
            <div className="stack" role="alert">
              <p>{error}</p>
              <div><Btn onClick={() => invalidateQueue()}>Try again</Btn></div>
            </div>
          ) : <p className="muted" role="status">Loading the work queue…</p>
        ) : (
          <>
            <div className="q-cols" aria-hidden="true">
              <span /><span>File</span><span>Needs you</span><span>Decisions</span><span>Waiting on client</span><span>Day</span><span>Last activity</span><span />
            </div>
            {shown.length ? (
              <ul className="q-list">
                {shown.map((r) => <Row key={r.id} r={r} unread={unread.has(r.id)} />)}
              </ul>
            ) : <p className="empty q-empty">{empty}</p>}
            {error ? <p className="err" role="status">{error}</p> : null}
          </>
        )}
      </section>
      <NewCaseSheet open={creating} onOpenChange={setCreating} />
    </main>
  )
}
