import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, isUnavailable } from '@/lib/api'
import { failureText } from '@/hooks/useCase'
import { plural } from '@/lib/derive'
import { Btn } from '@/components/Btn'
import { Icon } from '@/components/Icon'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import * as homeApi from './api'
import { invalidateQueue } from './queue'
import type { CaseExtra, Company, Template } from './types'
import { caseHref, go } from './useHashRoute'

type Catalog = { companies: Company[]; templates: Template[] }
let cached: Catalog | null = null

/** New case: pick a company, then one of the templates it has documents for, then open the file. */
export function NewCaseSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(cached)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || cached) return
    let gone = false
    Promise.all([homeApi.getCompanies(), homeApi.getTemplates()])
      .then(([companies, templates]) => {
        cached = { companies: Array.isArray(companies) ? companies : [], templates: Array.isArray(templates) ? templates : [] }
        if (!gone) { setCatalog(cached); setLoadError(null) }
      })
      .catch((e) => { if (!gone) setLoadError(isUnavailable(e) ? 'New cases are not available on this server yet.' : failureText(e)) })
    return () => { gone = true }
  }, [open])

  const company = catalog?.companies.find((c) => c.id === companyId) ?? null
  // Only the templates this company has documents for: any other pair is refused with a 422.
  const offered = useMemo(() => {
    if (!catalog || !company) return []
    const ids = Array.isArray(company.templates) ? company.templates : catalog.templates.map((t) => t.id)
    return catalog.templates.filter((t) => ids.includes(t.id))
  }, [catalog, company])
  const template = offered.find((t) => t.id === templateId) ?? (offered.length === 1 ? offered[0] : null)

  const pickCompany = (c: Company) => {
    setCompanyId(c.id)
    const ids = Array.isArray(c.templates) ? c.templates : []
    setTemplateId((t) => (t && ids.includes(t) ? t : ids.length === 1 ? ids[0] : null))
  }

  const create = async () => {
    if (!company || !template || busy) return
    setBusy(true)
    try {
      const b = await homeApi.createCase(template.id, company.id)
      const c = b.case as typeof b.case & CaseExtra
      toast(`Case opened for ${c.company || company.name}. The agent asked the client for the first documents.`)
      invalidateQueue()
      onOpenChange(false)
      setCompanyId(null); setTemplateId(null)
      go(caseHref(String(b.case.id)))
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 422 ? `The case could not be opened: ${e.message}.` : failureText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="ol-sheet nc-sheet">
        <SheetTitle>New case</SheetTitle>
        <SheetDescription className="muted small">
          Pick the client, then the kind of file. The agent asks the client for the starting documents straight away.
        </SheetDescription>
        {loadError ? <p className="err" role="alert">{loadError}</p>
          : !catalog ? <p className="muted small" role="status">Loading clients…</p> : (
            <>
              <section className="nc-sec" aria-labelledby="nc-company">
                <h3 id="nc-company">Client</h3>
                <div className="nc-list" role="radiogroup" aria-labelledby="nc-company">
                  {catalog.companies.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={c.id === companyId} className="nc-opt" onClick={() => pickCompany(c)}>
                      <span className="nc-tick">{c.id === companyId ? <Icon name="check" size={14} /> : null}</span>
                      <span className="nc-name">{c.name}</span>
                      <span className="nc-city">{c.city}</span>
                      {c.story ? <span className="nc-story">{c.story}</span> : null}
                    </button>
                  ))}
                </div>
              </section>
              {company ? (
                <section className="nc-sec" aria-labelledby="nc-template">
                  <h3 id="nc-template">Kind of file</h3>
                  {!offered.length ? <p className="empty">No file type has documents for {company.name}.</p> : (
                    <div className="nc-list" role="radiogroup" aria-labelledby="nc-template">
                      {offered.map((t) => (
                        <button key={t.id} type="button" role="radio" aria-checked={t.id === template?.id} className="nc-opt" onClick={() => setTemplateId(t.id)}>
                          <span className="nc-tick">{t.id === template?.id ? <Icon name="check" size={14} /> : null}</span>
                          <span className="nc-name">{t.title}</span>
                          <span className="nc-city">{Array.isArray(t.requirements) ? plural(t.requirements.length, 'check') : ''}</span>
                          {t.description ? <span className="nc-story">{t.description}</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  {offered.length === 1 ? <p className="muted tiny">{company.name} has documents for this kind of file only.</p> : null}
                </section>
              ) : null}
              <div className="nc-actions">
                <Btn variant="primary" onClick={() => void create()} disabled={!company || !template} loading={busy}>Open the case</Btn>
                <Btn variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Btn>
              </div>
            </>
          )}
      </SheetContent>
    </Sheet>
  )
}
