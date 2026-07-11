import { Component } from 'react';
export default class FroamSectionBoundary extends Component {
    state = { hasError: false, errorMessage: '' };
    _recoveryTimer = null;
    static getDerivedStateFromError(error) {
        return { hasError: true, errorMessage: error?.message || 'Unknown error' };
    }
    componentDidCatch(error) {
        console.warn(`[Froam] Section "${this.props.name ?? 'unknown'}" crashed safely:`, error?.message);
        // Schedule recovery outside render — avoids the infinite loop caused by
        // calling setState (via setTimeout) on every render pass when there's no
        // custom fallback.
        if (!this.props.fallback && !this._recoveryTimer) {
            this._recoveryTimer = setTimeout(() => {
                this._recoveryTimer = null;
                this.setState({ hasError: false, errorMessage: '' });
            }, 800);
        }
    }
    componentWillUnmount() {
        if (this._recoveryTimer) {
            clearTimeout(this._recoveryTimer);
            this._recoveryTimer = null;
        }
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback)
                return this.props.fallback;
            return null;
        }
        return this.props.children;
    }
}
//# sourceMappingURL=FroamSectionBoundary.js.map