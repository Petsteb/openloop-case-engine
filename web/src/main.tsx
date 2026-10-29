import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App.tsx'
import { installSessionGuard } from './shared/session'

// A 401 means the session ended: back to /login/, then here again (backend/app/auth.py).
installSessionGuard('staff')

// The bank screen scales its type on wide screens (index.css, `html.bank`); the portal shares index.css but not this.
document.documentElement.classList.add('bank')

// Pill buttons: the hover fill grows as a circle from the point where the cursor entered.
document.addEventListener('pointerover', (e) => {
  const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.btn') : null
  if (!b || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return
  const r = b.getBoundingClientRect()
  b.style.setProperty('--mx', `${e.clientX - r.left}px`)
  b.style.setProperty('--my', `${e.clientY - r.top}px`)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200}>
      <App />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
)
