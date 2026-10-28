import { Component, type ButtonHTMLAttributes, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'quiet'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  loading?: boolean
}

/** Pill button. The hover fill grows as a circle from where the cursor entered (see main.tsx). */
export function Btn({ variant = 'secondary', size = 'md', loading = false, className = '', children, disabled, ...rest }: BtnProps) {
  const cls = ['btn', variant === 'secondary' ? '' : variant, size === 'sm' ? 'sm' : '', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Icon name="spinner" size={14} className="spin" /> : null}
      {children}
    </button>
  )
}

/** Keeps one broken panel from blanking the whole screen on the projector. */
export class Boundary extends Component<{ name: string; children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`[${this.props.name}]`, error, info.componentStack) }
  render() {
    if (this.state.failed) {
      return this.props.fallback ?? <p className="unavailable">This part of the screen could not be shown. The rest of the case is unaffected.</p>
    }
    return this.props.children
  }
}
