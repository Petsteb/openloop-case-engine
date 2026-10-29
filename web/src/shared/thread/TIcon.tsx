import type { ReactNode } from 'react'

/* The few line icons the thread needs (same 24px grid and 2px stroke as the apps' Icon components). */
const P: Record<string, ReactNode> = {
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
  spinner: <path d="M21 12a9 9 0 1 1-6.2-8.6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  doc: <g><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></g>,
}

export function TIcon({ name, size = 14, className = '' }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg className={`thr-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name] ?? null}
    </svg>
  )
}
