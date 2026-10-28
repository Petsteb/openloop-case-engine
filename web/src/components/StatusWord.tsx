import { STATUS, type Kind } from '@/lib/derive'
import { Icon } from './Icon'

export function StatusWord({ kind }: { kind: Kind }) {
  return <span className={`st st-${kind}`}><i aria-hidden="true" />{STATUS[kind].word}</span>
}

export function StatusIcon({ kind, size = 16 }: { kind: Kind; size?: number }) {
  return <span className={`glyph c-${kind}`} title={STATUS[kind].word}><Icon name={STATUS[kind].icon} size={size} /></span>
}
