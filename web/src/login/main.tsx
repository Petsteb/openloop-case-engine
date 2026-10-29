import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import './login.css'
import { initialTheme } from '@/client/theme'
import { Login } from './Login'

document.documentElement.dataset.theme = initialTheme()

// Pill buttons: the hover fill grows as a circle from the point where the cursor entered (same as both apps).
document.addEventListener('pointerover', (e) => {
  const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.btn') : null
  if (!b || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return
  const r = b.getBoundingClientRect()
  b.style.setProperty('--mx', `${e.clientX - r.left}px`)
  b.style.setProperty('--my', `${e.clientY - r.top}px`)
})

createRoot(document.getElementById('root')!).render(<StrictMode><Login /></StrictMode>)
