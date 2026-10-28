import { headerStats, splitTitle, statusLine } from '@/lib/derive'
import type { Bundle, VerifyResult } from '@/lib/types'
import { Btn } from './Btn'
import { Icon } from './Icon'

interface Props {
  bundle: Bundle
  verify: VerifyResult | null
  verifying: boolean
  onVerify: () => void
  theme: 'dark' | 'light'
  onTheme: () => void
  learningCount: number | null
  onLearning: () => void
}

export function verifyLabel(v: VerifyResult | null) {
  if (!v) return null
  return v.ok ? { ok: true, text: `Chain intact, ${v.length} events` } : { ok: false, text: `Chain broken at event #${v.broken_at}` }
}

export function CaseHeader({ bundle, verify, verifying, onVerify, theme, onTheme, learningCount, onLearning }: Props) {
  const { name, sub } = splitTitle(bundle)
  const line = statusLine(bundle)
  const s = headerStats(bundle)
  const cfg = bundle.config || {}
  const v = verifyLabel(verify)
  return (
    <header className="casehead">
      <div className="casehead-main">
        <span className="brand"><span className="brand-mark" aria-hidden="true" />OpenLoop</span>
        <div style={{ minWidth: 0 }}>
          <h1 className="case-name">{name}</h1>
          {sub ? <div className="case-sub" title={bundle.case?.goal ? `Goal: ${bundle.case.goal}` : undefined}>{sub}</div> : null}
          <div className="case-line" role="status"><span className={`dot ${line.tone}`} aria-hidden="true" /><span>{line.text}</span></div>
        </div>
      </div>
      <div className="case-side">
        <div className="case-meta">
          <div className="m"><b>{s.verified}/{s.total}</b><span>checks verified</span></div>
          <div className="m"><b>{s.day}</b><span>day of the case</span></div>
          {s.amlrDays !== null ? <div className="m"><b style={{ color: 'var(--conflict)' }}>{s.amlrDays}</b><span>days to AMLR report</span></div> : null}
        </div>
        <div className="case-tools">
          <span className="modes">
            <span>Agent: <b>{String(cfg.agent_mode || 'unknown')}</b>{cfg.agent_status && cfg.agent_status !== 'ok' ? ` (${String(cfg.agent_status)})` : ''}</span>
            <span>Judge: <b>{String(cfg.judge_mode || 'unknown')}</b></span>
          </span>
          {v ? <span className={v.ok ? 'verify-ok' : 'verify-bad'} role="status">{v.text}</span> : null}
          <Btn size="sm" onClick={onVerify} loading={verifying}><Icon name="shield" size={14} />Check ledger</Btn>
          {learningCount !== null ? (
            <Btn size="sm" onClick={onLearning}>Learning{learningCount > 0 ? <span className="badge-count">{learningCount}</span> : null}</Btn>
          ) : null}
          <button type="button" className="btn quiet icon-only sm" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
