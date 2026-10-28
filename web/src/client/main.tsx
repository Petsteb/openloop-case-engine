import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import '@/index.css'
import './portal.css'
import { PortalBoundary } from './Boundary'
import { initialTheme, Portal } from './Portal'

// Set the theme before the first paint (the bank screen's stored choice, else the system setting).
document.documentElement.dataset.theme = initialTheme()

// Pill buttons: the hover fill grows as a circle from the point where the cursor entered (same as the bank screen).
document.addEventListener('pointerover', (e) => {
  const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.btn') : null
  if (!b || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return
  const r = b.getBoundingClientRect()
  b.style.setProperty('--mx', `${e.clientX - r.left}px`)
  b.style.setProperty('--my', `${e.clientY - r.top}px`)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalBoundary><Portal /></PortalBoundary>
    <Toaster position="bottom-center" />
  </StrictMode>,
)
