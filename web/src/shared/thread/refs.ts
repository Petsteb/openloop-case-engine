/* Pure helpers for refs: the text token of a ref, splitting a message into text and ref parts, and the composer's
   suggestion list. Only refs the server returned in `refs[]` ever become chips; any other "#12" stays plain text. */
import type { Mentionables, RefKind, ThreadRef } from './types'

export const refKey = (r: { kind: string; id: string | number }) => `${r.kind}:${String(r.id).replace(/^#/, '')}`

/** The token the composer inserts for a ref: "@Elena Munteanu", "#doc-3", "#42". */
export function tokenFor(r: { kind: string; id: string | number; label?: string | null }): string | null {
  const id = String(r.id ?? '').replace(/^#/, '')
  if (!id) return null
  if (r.kind === 'person') return `@${(r.label || id).trim()}`
  if (r.kind === 'doc' || r.kind === 'event') return `#${id}`
  return null
}

export type Part = { t: 'text'; text: string } | { t: 'ref'; ref: ThreadRef; text: string }

const WORD = /[\p{L}\p{N}_-]/u

/** Splits `text` on the tokens of `refs`. Longest token first, and a token must not run on into a word, so "#1" never
 *  matches inside "#18" and "#doc-3" never inside "#doc-31". Refs with no token in the text come back in `rest`. */
export function splitRefs(text: string, refs: ThreadRef[]): { parts: Part[]; rest: ThreadRef[] } {
  const seen = new Set<string>()
  const toks: { tok: string; low: string; ref: ThreadRef }[] = []
  for (const r of refs) {
    const k = refKey(r)
    if (seen.has(k)) continue
    seen.add(k)
    const tok = tokenFor(r)
    if (tok) toks.push({ tok, low: tok.toLowerCase(), ref: r })
  }
  toks.sort((a, b) => b.tok.length - a.tok.length)
  const used = new Set<string>()
  const parts: Part[] = []
  const low = text.toLowerCase()
  let buf = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    let hit: (typeof toks)[number] | undefined
    if ((ch === '#' || ch === '@') && (i === 0 || !WORD.test(text[i - 1]))) {
      hit = toks.find((t) => low.startsWith(t.low, i) && !WORD.test(text[i + t.tok.length] ?? ''))
    }
    if (hit) {
      if (buf) parts.push({ t: 'text', text: buf })
      buf = ''
      parts.push({ t: 'ref', ref: hit.ref, text: text.slice(i, i + hit.tok.length) })
      used.add(refKey(hit.ref))
      i += hit.tok.length
    } else {
      buf += ch
      i++
    }
  }
  if (buf) parts.push({ t: 'text', text: buf })
  const rest = toks.map((t) => t.ref).filter((r) => !used.has(refKey(r)))
  // keep the server's order for the trailing chips
  rest.sort((a, b) => refs.indexOf(a) - refs.indexOf(b))
  return { parts, rest }
}

/* ---------- composer suggestions ---------- */
export interface Option {
  key: string
  kind: RefKind
  id: string | number
  token: string
  /** mono id shown first ("doc-3", "#42"); empty for people */
  code: string
  label: string
  meta: string
}

export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function optionsFor(m: Mentionables | null, trigger: '@' | '#'): Option[] {
  if (!m) return []
  if (trigger === '@') {
    return (m.people ?? []).filter((p) => p && p.id).map((p) => {
      const label = String(p.label || p.id)
      return { key: `person:${p.id}`, kind: 'person', id: String(p.id), token: `@${label}`, code: '', label, meta: 'Person' }
    })
  }
  const docs: Option[] = (m.docs ?? []).filter((d) => d && d.id).map((d) => ({
    key: `doc:${d.id}`, kind: 'doc', id: String(d.id), token: `#${d.id}`, code: String(d.id), label: String(d.label || 'Document'), meta: 'Document',
  }))
  const events: Option[] = [...(m.events ?? [])].filter((e) => e && Number.isFinite(Number(e.seq)))
    .sort((a, b) => Number(b.seq) - Number(a.seq))
    .map((e) => ({
      key: `event:${e.seq}`, kind: 'event', id: Number(e.seq), token: `#${e.seq}`, code: `#${e.seq}`, label: String(e.label || 'Event'),
      meta: typeof e.day === 'number' ? `Day ${e.day}` : 'Event',
    }))
  return [...docs, ...events]
}

/** Case- and accent-insensitive filter; matches that start with the query come first. */
export function filterOptions(all: Option[], query: string, max = 40): Option[] {
  const q = fold(query.trim())
  if (!q) return all.slice(0, max)
  const scored: { o: Option; s: number }[] = []
  for (const o of all) {
    const id = fold(String(o.code || '').replace(/^#/, ''))
    const label = fold(o.label)
    let s = -1
    if (id && id.startsWith(q)) s = 0
    else if (label.startsWith(q)) s = 1
    else if (label.split(/\s+/).some((w) => w.startsWith(q))) s = 2
    else if (label.includes(q) || (id && id.includes(q))) s = 3
    if (s >= 0) scored.push({ o, s })
  }
  scored.sort((a, b) => a.s - b.s)
  return scored.slice(0, max).map((x) => x.o)
}

/** The @ or # trigger the caret is in, if any: the trigger starts the text or follows a space or bracket, and the
 *  query has no line break. People's names have spaces, so a query may too; it closes when nothing matches. */
export function findTrigger(value: string, caret: number): { char: '@' | '#'; start: number; query: string } | null {
  for (let i = caret - 1; i >= 0 && caret - i <= 48; i--) {
    const ch = value[i]
    if (ch === '\n') return null
    if (ch === '@' || ch === '#') {
      const before = i === 0 ? '' : value[i - 1]
      if (before && !/[\s([{"'“„]/.test(before)) return null
      const query = value.slice(i + 1, caret)
      if (/^\s/.test(query)) return null
      return { char: ch, start: i, query }
    }
  }
  return null
}
