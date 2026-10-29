import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Keeps a render error from leaving a white page on the projector: a short note in the portal's voice and a Reload button.
 *  `inner`: inside the portal frame (no second full-height page). */
export class PortalBoundary extends Component<{ children: ReactNode; inner?: boolean }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[portal]', error, info.componentStack) }
  render() {
    if (this.state.failed) {
      const note = (
        <div className="pt-wrap">
          <div className="pt-loading" role="alert">
            <p>This page could not be shown. Your file is safe; please reload the page.</p>
            <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      )
      return this.props.inner ? note : <div className="pt">{note}</div>
    }
    return this.props.children
  }
}

/** One section of the page fails alone (e.g. the messages thread): the rest of the file stays usable. */
export class SectionBoundary extends Component<{ children: ReactNode; fallback: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[portal section]', error, info.componentStack) }
  render() {
    return this.state.failed ? <p className="pt-empty" role="status">{this.props.fallback}</p> : this.props.children
  }
}
