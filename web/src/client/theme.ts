import { useEffect, useState } from 'react'

/* The theme is shared with the bank screen through its stored choice (openloop-theme), else it follows the system. */
export type Theme = 'dark' | 'light'
const THEME_KEY = 'openloop-theme'
function savedTheme(): Theme | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(THEME_KEY) ?? 'null')
    return v === 'dark' || v === 'light' ? v : null
  } catch { return null }
}
export function initialTheme(): Theme {
  const s = savedTheme()
  if (s) return s
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' } catch { return 'dark' }
}
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    // the bank screen in the other window toggles the theme: follow it
    const on = (e: StorageEvent) => { if (e.key === THEME_KEY) { const s = savedTheme(); if (s) setTheme(s) } }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])
  const toggle = () => setTheme((t) => {
    const n = t === 'dark' ? 'light' : 'dark'
    try { window.localStorage.setItem(THEME_KEY, JSON.stringify(n)) } catch { /* storage unavailable */ }
    return n
  })
  return [theme, toggle]
}
