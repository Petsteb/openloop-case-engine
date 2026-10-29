import { useCallback, useEffect, useMemo } from 'react'
import { PortalBoundary } from './Boundary'
import { DemoStrip, TopBar } from './Chrome'
import { safe, templateTitle } from './derive'
import { Home } from './Home'
import { Portal } from './Portal'
import { caseHref, go, HOME_HREF, useRoute } from './route'
import { DEFAULT_COMPANY, markSeen, useCompany, writeCompany } from './store'
import { useTheme } from './theme'
import { usePortalData } from './usePortalData'

/** The portal: My files at "#/", one file at "#/case/{id}". One global poll feeds My files and the bell. */
export function App() {
  const route = useRoute()
  const [theme, toggleTheme] = useTheme()
  const companyId = useCompany()
  const data = usePortalData(companyId)
  const company = data.companies?.find((c) => c.id === companyId)
  const caseId = route.name === 'case' ? route.id : null

  // a stored company the server does not know (another seed): back to Aurora
  useEffect(() => {
    const list = data.companies
    if (list && list.length && !list.some((c) => c.id === companyId)) {
      writeCompany(list.find((c) => c.id === DEFAULT_COMPANY)?.id ?? list[0].id)
    }
  }, [data.companies, companyId])

  // the open file is seen: every notification of it the bell knows about
  useEffect(() => {
    if (!caseId || !Array.isArray(data.notes)) return
    const max = data.notes.filter((n) => n.case_id === caseId).reduce((m, n) => Math.max(m, Number(n.seq) || 0), 0)
    if (max) markSeen(caseId, max, data.rows?.find((r) => r.id === caseId)?.events)
  }, [caseId, data.notes, data.rows])

  // a new page starts at the top; My files has its own title (the file page sets one with the company name)
  const routeKey = caseId ?? '#home'
  // ...with fresh lists (the file page may have marked newer events seen than the last list knew)
  const { refetch } = data
  useEffect(() => { window.scrollTo(0, 0); refetch() }, [routeKey, refetch])
  useEffect(() => {
    if (route.name === 'home') document.title = company ? `My files · ${safe(company.name, '')}` : 'My files'
  }, [route.name, company])

  // each file's ledger length: a last-seen value past it is stale (the demo was reset)
  const lengths = useMemo(() => Object.fromEntries((data.rows ?? []).map((r) => [r.id, Number(r.events) || 0])), [data.rows])
  const titles = useMemo(() => Object.fromEntries((data.rows ?? []).map((r) => [r.id, templateTitle(r.template, r.template_title)])),
    [data.rows])
  const openCase = useCallback((id: string) => go(caseHref(id)), [])
  const onCompany = (id: string) => {
    writeCompany(id)
    if (route.name === 'case') go(HOME_HREF)   // the open file belongs to the previous company
  }
  // a file of another company (a link from the bank screen): view the portal as that company, so the picker,
  // the bell and "My files" all match the file on screen
  const companies = data.companies
  const adopt = useCallback((name: string) => {
    const c = companies?.find((x) => x.name === name)
    if (c) writeCompany(c.id)
  }, [companies])

  return (
    <div className="pt">
      <DemoStrip theme={theme} onTheme={toggleTheme} companies={data.companies} companyId={companyId} onCompany={onCompany} />
      <TopBar back={route.name === 'case'} notes={data.notes} titles={titles} lengths={lengths} currentCaseId={caseId}
        onOpenCase={openCase} />
      {route.name === 'home' ? (
        <Home data={data} company={company} onOpenCase={openCase} />
      ) : (
        <PortalBoundary key={route.id} inner>
          <Portal key={route.id} caseId={route.id} file={data.rows?.find((r) => r.id === route.id)} onCompanyName={adopt} />
        </PortalBoundary>
      )}
    </div>
  )
}
