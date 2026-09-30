import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, ChevronDown, RotateCw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { describeSelection } from './selection-name.js';
const BUSY_COPY = { preparing: 'Working it out…', requesting: 'Working it out…', retrying: 'Trying another way…', 'plan-ready': 'Preparing a preview…', 'creating-prototype': 'Preparing a preview…', adopting: 'Applying…' };
function score(value) { return value === undefined ? 'Not measured' : value >= .85 ? 'Strong' : value >= .7 ? 'Good' : value >= .5 ? 'Moderate' : 'Limited'; }
export default function FroamIntentResult(props) {
    const { state } = props;
    const surfaceRef = useRef(null);
    const priorPhaseRef = useRef('idle');
    const returnFocusRef = useRef(null);
    useEffect(() => {
        const prior = priorPhaseRef.current;
        priorPhaseRef.current = state.phase;
        if (prior === 'idle' && state.phase !== 'idle')
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (state.phase === 'idle') {
            if (prior !== 'idle' && returnFocusRef.current?.isConnected)
                returnFocusRef.current.focus();
            returnFocusRef.current = null;
            return;
        }
        if (!['awaiting-consent', 'previewing', 'error'].includes(state.phase))
            return;
        const frame = requestAnimationFrame(() => surfaceRef.current?.querySelector('[data-froam-intent-primary]')?.focus());
        return () => cancelAnimationFrame(frame);
    }, [state.phase]);
    if (state.phase === 'idle')
        return null;
    if (state.phase === 'awaiting-consent')
        return _jsxs("aside", { ref: surfaceRef, className: "froam-intent-result is-consent", "data-chef-editor-root": "true", role: "dialog", "aria-label": "Use AI for this?", children: [_jsxs("header", { children: [_jsx(Sparkles, { size: 14 }), _jsx("strong", { children: "Use AI for this?" })] }), _jsxs("p", { children: ["To work this out, Froam sends ", props.aiModel ?? 'your AI', " a description of the part you picked \u2014 its layout, styles and words."] }), _jsx("small", { children: "Never your source code, passwords, cookies or screenshots. You see a preview before anything changes. Froam asks once." }), _jsxs("div", { className: "froam-intent-result__actions", children: [_jsx("button", { type: "button", className: "is-primary", "data-froam-intent-primary": true, onClick: props.onAllow, children: "Use AI" }), _jsx("button", { type: "button", onClick: props.onNotNow, children: "Not now" })] })] });
    const busy = BUSY_COPY[state.phase];
    if (busy)
        return _jsxs("aside", { ref: surfaceRef, className: "froam-intent-result is-busy", "data-chef-editor-root": "true", role: "status", "aria-live": "polite", "aria-atomic": "true", children: [_jsx("span", { className: "froam-intent-result__pulse" }), _jsx("strong", { children: busy }), _jsx("button", { type: "button", onClick: props.onCancel, children: "Cancel" })] });
    if (state.phase === 'previewing' && state.session)
        return _jsxs("aside", { ref: surfaceRef, className: "froam-intent-result is-preview", "data-chef-editor-root": "true", role: "dialog", "aria-label": "Quick Edit preview", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("span", { children: "Preview" }), _jsx("strong", { children: state.session.intent })] }), state.session.maxAttempts > 1 && _jsxs("em", { title: "Try again gives a different take", children: ["Take ", state.session.attempt, " of ", state.session.maxAttempts] })] }), state.session.changeSummaries?.find((summary) => !/^Applied locally:/.test(summary)) && _jsx("p", { className: "froam-intent-result__why", children: state.session.changeSummaries.find((summary) => !/^Applied locally:/.test(summary)) }), _jsxs("p", { children: [state.session.changeCount, " change", state.session.changeCount === 1 ? '' : 's', state.session.targetLabel ? ` to the ${describeSelection(state.session.targetLabel).kind.toLowerCase()}` : '', ". Keep it, or try another take."] }), state.session.automaticTarget && _jsx("small", { children: "Nothing was selected, so Froam picked the part that fit best." }), state.session.referenceValidation && _jsxs("section", { className: "froam-intent-result__scorecard", "aria-label": "Reference candidate scorecard", children: [_jsx("strong", { children: "Reference match" }), ['structure', 'geometry', 'responsive', 'visual', 'text'].map((kind) => _jsxs("span", { children: [_jsx("b", { children: kind }), _jsx("em", { children: kind === 'visual' && state.session.referenceValidation.scorecard.visual !== undefined ? `${Math.round(state.session.referenceValidation.scorecard.visual * 100)}% measured` : score(state.session.referenceValidation.scorecard[kind]) })] }, kind)), _jsx("strong", { children: "Responsive health" }), _jsx("small", { children: state.session.referenceValidation.health.healthy ? '✓ No overflow, collision, clipping or hidden critical content measured' : `△ ${state.session.referenceValidation.differences.length} measured difference${state.session.referenceValidation.differences.length === 1 ? '' : 's'}` })] }), _jsxs("details", { children: [_jsxs("summary", { children: [_jsx(ChevronDown, { size: 12 }), " What changed"] }), state.session.rationale && _jsx("p", { children: state.session.rationale }), _jsx("ul", { children: [...new Set(state.session.changeSummaries ?? [])].map((summary, index) => _jsx("li", { children: summary }, index)) })] }), _jsxs("div", { className: "froam-intent-result__actions", children: [_jsxs("button", { type: "button", className: "is-primary", "data-froam-intent-primary": true, onClick: props.onKeep, children: [_jsx(Check, { size: 13 }), " Keep"] }), _jsxs("button", { type: "button", onClick: props.onRetry, children: [_jsx(RotateCw, { size: 13 }), " Try again"] }), _jsxs("button", { type: "button", onClick: props.onCancel, children: [_jsx(X, { size: 13 }), " Cancel"] })] })] });
    if (state.phase === 'error')
        return _jsxs("aside", { ref: surfaceRef, className: "froam-intent-result is-error", "data-chef-editor-root": "true", role: "alert", children: [_jsx("strong", { children: state.message }), _jsxs("div", { className: "froam-intent-result__actions", children: [state.session && state.session.attempt < state.session.maxAttempts && _jsxs("button", { type: "button", "data-froam-intent-primary": true, onClick: props.onRetry, children: [_jsx(RotateCw, { size: 13 }), " Try again"] }), _jsx("button", { type: "button", "data-froam-intent-primary": !state.session || state.session.attempt >= state.session.maxAttempts || undefined, onClick: state.session ? props.onCancel : props.onDismiss, children: state.session ? 'Cancel' : 'Dismiss' })] })] });
    if (state.phase === 'completed')
        return _jsxs("aside", { ref: surfaceRef, className: "froam-intent-result is-complete", "data-chef-editor-root": "true", role: "status", "aria-live": "polite", children: [_jsx(Check, { size: 14 }), _jsx("strong", { children: state.message }), _jsx("button", { type: "button", "aria-label": "Dismiss result", onClick: props.onDismiss, children: _jsx(X, { size: 13 }) })] });
    return null;
}
//# sourceMappingURL=FroamIntentResult.js.map