import { Component, type ReactNode } from 'react';
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
    children: ReactNode;
    /** Optional label for debugging. */
    name?: string;
    /** Optional fallback; defaults to null (invisible). */
    fallback?: ReactNode;
};
type State = {
    hasError: boolean;
    errorMessage: string;
};
export default class FroamSectionBoundary extends Component<Props, State> {
    state: State;
    private _recoveryTimer;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error): void;
    componentWillUnmount(): void;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=FroamSectionBoundary.d.ts.map