import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import '@/index.css'
import './portal.css'
import { App } from './App'
import { PortalBoundary } from './Boundary'
import { ensureHash } from './route'
import { initialTheme } from './theme'
import { installSessionGuard, loadMe } from '@/shared/session'
import { writeCompany } from './store'

// Set the theme before the first paint (the bank screen's stored choice, else the system setting).
document.documentElement.dataset.theme = initialTheme()
// A 401 means the session ended: sign in again.
installSessionGuard('client')

// Pill buttons: the hover fill grows as a circle from the point where the cursor entered (same as the bank screen).
document.addEventListener('pointerover', (e) => {
  const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.btn') : null
  if (!b || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return
  const r = b.getBoundingClientRect()
  b.style.setProperty('--mx', `${e.clientX - r.left}px`)
  b.style.setProperty('--my', `${e.clientY - r.top}px`)
})

// A signed-in client always views its own company, so learn it before the first render. Then no hash opens that
// company's files, or the demo file (#/case/demo-1) for the demo's company, without a history entry (ensureHash).
void loadMe().then((me) => {
  if (me?.auth && me.client?.company_id) writeCompany(me.client.company_id)
  ensureHash()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PortalBoundary><App /></PortalBoundary>
      <Toaster position="bottom-center" />
    </StrictMode>,
  )
})
