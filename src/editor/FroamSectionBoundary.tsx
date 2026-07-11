import { Component, type ReactNode } from 'react'

/**
 * Lightweight ErrorBoundary that wraps individual Froam sections.
 * If a section crashes during render, it catches the error and shows
 * a minimal fallback — without crashing the entire Froam editor.
 *
 * This is the key crash protection: React ErrorBoundary only catches
 * render-phase errors, and child components (FroamDesignPanel,
 * FroamToolbar, FroamLayersPanel, etc.) can throw during render when
 * the DOM/state is in a transitional state.
 */
type Props = {
  children: ReactNode
  /** Optional label for debugging. */
  name?: string
  /** Optional fallback; defaults to null (invisible). */
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  errorMessage: string
}

export default class FroamSectionBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' }
  private _recoveryTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' }
  }

  componentDidCatch(error: Error) {
    console.warn(`[Froam] Section "${this.props.name ?? 'unknown'}" crashed safely:`, error?.message)
    // Schedule recovery outside render — avoids the infinite loop caused by
    // calling setState (via setTimeout) on every render pass when there's no
    // custom fallback.
    if (!this.props.fallback && !this._recoveryTimer) {
      this._recoveryTimer = setTimeout(() => {
        this._recoveryTimer = null
        this.setState({ hasError: false, errorMessage: '' })
      }, 800)
    }
  }

  componentWillUnmount() {
    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer)
      this._recoveryTimer = null
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return null
    }
    return this.props.children
  }
}
