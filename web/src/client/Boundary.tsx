import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Keeps a render error from leaving a white page on the projector: a short note in the portal's voice and a Reload button. */
export class PortalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[portal]', error, info.componentStack) }
  render() {
    if (this.state.failed) {
      return (
        <div className="pt"><div className="pt-wrap">
          <div className="pt-loading" role="alert">
            <p>This page could not be shown. Your file is safe; please reload the page.</p>
            <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div></div>
      )
    }
    return this.props.children
  }
}
