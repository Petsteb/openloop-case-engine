import { headerStats, splitTitle, statusLine } from '@/lib/derive'
import type { Bundle, VerifyResult } from '@/lib/types'
import { Bell } from '@/home/Bell'
import type { CaseExtra } from '@/home/types'
import { HOME_HREF } from '@/home/useHashRoute'
import { Btn } from './Btn'
import { Icon } from './Icon'

interface Props {
  bundle: Bundle
  caseId: string
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

/** The shared status line speaks of a loan; an annual review has a sign-off and a review pack instead. */
const forTemplate = (template: string | undefined, text: string) => (template === 'kyb_review'
  ? text.replace(/\bthe credit decision\b/gi, 'the sign-off').replace(/\bapplication pack\b/gi, 'review pack')
  : text)

export function CaseHeader({ bundle, caseId, verify, verifying, onVerify, theme, onTheme, learningCount, onLearning }: Props) {
  const c = (bundle.case || {}) as Bundle['case'] & CaseExtra
  const split = splitTitle(bundle)
  // contract v3: the case names its company and template; older servers only have "<template> — <company>" in the title
  const name = c.company ? String(c.company) : split.name
  const sub = c.template_title ? String(c.template_title) : split.sub
  const product = c.product && c.product !== sub ? String(c.product) : ''
  const raw = statusLine(bundle)
  const line = { ...raw, text: forTemplate(c.template, raw.text) }
  const s = headerStats(bundle)
  const cfg = bundle.config || {}
  const v = verifyLabel(verify)
  const agentStatus = cfg.agent_status ? String(cfg.agent_status) : ''
  // "fallback (<Error>)": the configured planner failed and the scripted one took over. Worth a glance, not an alarm.
  const fallback = /^fallback/i.test(agentStatus)
  return (
    <header className="casehead">
      <div className="casehead-main">
        <span className="brand"><span className="brand-mark" aria-hidden="true" />OpenLoop</span>
        <div style={{ minWidth: 0 }}>
          <a className="case-back" href={HOME_HREF}><Icon name="chevronL" size={14} />Work queue</a>
          <h1 className="case-name">{name}</h1>
          {sub ? (
            <div className={`case-sub${product ? ' has-product' : ''}`} title={bundle.case?.goal ? `Goal: ${bundle.case.goal}` : undefined}>
              <span>{sub}{product ? <span className="sr-only">,</span> : null}</span>{product ? <span>{product}</span> : null}
            </div>
          ) : null}
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
            <span>Agent: <b>{String(cfg.agent_mode || 'unknown')}</b>
              {fallback ? <span className="c-review" title={`The agent is running on its fallback: ${agentStatus}`}> {agentStatus}</span>
                : agentStatus && agentStatus !== 'ok' ? ` (${agentStatus})` : ''}
            </span>
            <span>Judge: <b>{String(cfg.judge_mode || 'unknown')}</b></span>
          </span>
          {v ? <span className={v.ok ? 'verify-ok' : 'verify-bad'} role="status">{v.text}</span> : null}
          <Btn size="sm" onClick={onVerify} loading={verifying}><Icon name="shield" size={14} />Check ledger</Btn>
          {learningCount !== null ? (
            <Btn size="sm" onClick={onLearning}>Learning{learningCount > 0 ? <span className="badge-count">{learningCount}</span> : null}</Btn>
          ) : null}
          {/* the client portal for this case, for the two-window demo; trailing slash: it is its own page */}
          <a className="btn quiet sm" href={`/client/#/case/${encodeURIComponent(caseId)}`} target="_blank" rel="noopener" title="Open what the client sees, in a new window">
            Preview client view<Icon name="external" size={13} />
          </a>
          <Bell currentCaseId={caseId} />
          <button type="button" className="btn quiet icon-only sm" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
