import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, Check, Component, Crosshair, Droplet, Palette, PenLine, ScanLine, ShieldCheck, Sparkles, SquareStack, Type as TypeIcon, Wand2, } from 'lucide-react';
import { componentAncestry, nearestComponent } from './froamReactFiber.js';
import { nearestColorToken, parseColor, readDesignTokens, toHex, } from './froamDesignTokens.js';
import { INTERACTIVE_SELECTOR, contrastOn, imageAlternative, readTextContrast, undersizedTargets } from '../project/a11y.js';
import './FroamIntel.css';
const TARGET_PROP = { fill: 'backgroundColor', text: 'color', border: 'borderColor' };
/**
 * Health score with per-category caps so one noisy category can't zero the
 * page, and a floor so a genuinely-messy page still reads as a number worth
 * improving rather than a scary 0.
 */
function scoreIssues(issues) {
    const high = issues.filter((i) => i.severity === 'high').length;
    const med = issues.filter((i) => i.severity === 'medium').length;
    const low = issues.filter((i) => i.severity === 'low').length;
    const deduction = Math.min(38, high * 3) + Math.min(30, med * 2.2) + Math.min(14, low);
    return Math.max(12, Math.round(100 - deduction));
}
/** Graded against what this text needs: large text passes AA at 3:1, so it isn't a warning there. */
function ratingLabel(ratio, required) {
    if (ratio >= 7)
        return { grade: 'AAA', tone: 'pass' };
    if (ratio >= 4.5)
        return { grade: 'AA', tone: 'pass' };
    if (ratio >= 3)
        return { grade: 'AA Large', tone: ratio >= required ? 'pass' : 'fail' };
    return { grade: 'Fail', tone: 'fail' };
}
function isFroamOwn(el) {
    return !!el.closest('[data-chef-editor-root], [class*="froam-"], [class*="global-chef"]');
}
export default function FroamIntel({ selectedElement, selectionPath, applyStyle, onSelectElement, onFixElement, onToast, rootEl }) {
    const [tab, setTab] = useState('tokens');
    const [target, setTarget] = useState('fill');
    const [tokenTick, setTokenTick] = useState(0);
    const tokens = useMemo(() => readDesignTokens(true), [tokenTick]);
    const solidColorTokens = useMemo(() => tokens.colorRamps.flatMap((r) => r.tokens).filter((t) => t.rgb && t.rgb.a >= 0.98), [tokens]);
    // Refresh token cache whenever the panel is shown or theme flips.
    useEffect(() => {
        const obs = new MutationObserver(() => setTokenTick((t) => t + 1));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, []);
    function applyToken(token) {
        if (!selectedElement) {
            onToast('Select an element first');
            return;
        }
        const prop = TARGET_PROP[target];
        const styles = { [prop]: `var(${token.name})` };
        if (target === 'border') {
            const cs = getComputedStyle(selectedElement);
            if (parseFloat(cs.borderWidth) === 0) {
                styles.borderWidth = '1px';
                styles.borderStyle = 'solid';
            }
        }
        applyStyle(styles, undefined, `Token: ${token.name} → ${target}`);
        onToast(`${target} = ${token.name}`);
    }
    function applySpaceToken(token, kind) {
        if (!selectedElement) {
            onToast('Select an element first');
            return;
        }
        const prop = kind === 'radius' ? 'borderRadius' : kind === 'gap' ? 'gap' : 'padding';
        applyStyle({ [prop]: `var(${token.name})` }, undefined, `Token: ${token.name} → ${kind}`);
        onToast(`${kind} = ${token.name}`);
    }
    const component = useMemo(() => (selectedElement ? nearestComponent(selectedElement) : null), [selectedElement]);
    const ancestry = useMemo(() => (selectedElement ? componentAncestry(selectedElement) : []), [selectedElement]);
    return (_jsxs("div", { className: "froam-intel", "data-chef-editor-root": "true", children: [component && (_jsxs("div", { className: "froam-intel__component", children: [_jsxs("div", { className: "froam-intel__component-id", children: [_jsx(Component, { size: 13 }), _jsx("span", { className: "froam-intel__component-name", children: '<' + component.name + '>' }), component.rootEl && component.rootEl !== selectedElement && (_jsxs("button", { type: "button", className: "froam-intel__component-jump", title: "Select this component's root element", onClick: () => onSelectElement(component.rootEl), children: [_jsx(Crosshair, { size: 11 }), " root"] }))] }), ancestry.length > 1 && (_jsx("div", { className: "froam-intel__breadcrumb", children: ancestry.slice().reverse().map((name, i) => (_jsx("span", { className: "froam-intel__crumb", children: name }, name + i))) }))] })), _jsxs("div", { className: "froam-intel__tabs", role: "tablist", "aria-label": "Design intelligence", children: [_jsxs("button", { type: "button", role: "tab", "aria-selected": tab === 'tokens', className: `froam-intel__tab ${tab === 'tokens' ? 'is-active' : ''}`, onClick: () => setTab('tokens'), children: [_jsx(Palette, { size: 13 }), " Tokens"] }), _jsxs("button", { type: "button", role: "tab", "aria-selected": tab === 'a11y', className: `froam-intel__tab ${tab === 'a11y' ? 'is-active' : ''}`, onClick: () => setTab('a11y'), children: [_jsx(Accessibility, { size: 13 }), " A11y"] }), _jsxs("button", { type: "button", role: "tab", "aria-selected": tab === 'health', className: `froam-intel__tab ${tab === 'health' ? 'is-active' : ''}`, onClick: () => setTab('health'), children: [_jsx(ShieldCheck, { size: 13 }), " Health"] })] }), tab === 'tokens' && (_jsx(TokensTab, { tokens: tokens, target: target, setTarget: setTarget, onApplyColor: applyToken, onApplySpace: applySpaceToken, hasSelection: !!selectedElement })), tab === 'a11y' && (_jsx(A11yTab, { selectedElement: selectedElement, solidColorTokens: solidColorTokens, applyStyle: applyStyle, onToast: onToast })), tab === 'health' && (_jsx(HealthTab, { rootEl: rootEl, solidColorTokens: solidColorTokens, onSelectElement: onSelectElement, onFixElement: onFixElement, selectionPath: selectionPath, onToast: onToast }))] }));
}
/* ─────────────────────────── Tokens ─────────────────────────── */
function TokensTab({ tokens, target, setTarget, onApplyColor, onApplySpace, hasSelection, }) {
    return (_jsxs("div", { className: "froam-intel__body", children: [!hasSelection && _jsx("p", { className: "froam-intel__hint", children: "Select an element, then tap a token to apply it on-brand." }), _jsx("div", { className: "froam-intel__seg", role: "group", "aria-label": "Apply colour to", children: ['fill', 'text', 'border'].map((t) => (_jsxs("button", { type: "button", className: `froam-intel__seg-btn ${target === t ? 'is-active' : ''}`, onClick: () => setTarget(t), "aria-pressed": target === t, children: [t === 'fill' ? _jsx(Droplet, { size: 12 }) : t === 'text' ? _jsx(TypeIcon, { size: 12 }) : _jsx(SquareStack, { size: 12 }), t] }, t))) }), tokens.colorRamps.map(({ ramp, tokens: ramps }) => (_jsxs("div", { className: "froam-intel__group", children: [_jsx("div", { className: "froam-intel__group-label", children: ramp }), _jsx("div", { className: "froam-intel__swatches", children: ramps.map((t) => (_jsxs("button", { type: "button", className: "froam-intel__swatch", style: { ['--sw']: t.value }, title: `${t.name} · ${t.value}`, "aria-label": `Apply ${t.name}`, onClick: () => onApplyColor(t), children: [_jsx("span", { className: "froam-intel__swatch-chip" }), _jsx("span", { className: "froam-intel__swatch-name", children: t.name.replace(/^--/, '') })] }, t.name))) })] }, ramp))), tokens.spacing.length > 0 && (_jsxs("div", { className: "froam-intel__group", children: [_jsx("div", { className: "froam-intel__group-label", children: "spacing \u2192 padding" }), _jsx("div", { className: "froam-intel__chips", children: tokens.spacing.map((t) => (_jsxs("button", { type: "button", className: "froam-intel__chip", onClick: () => onApplySpace(t, 'padding'), title: `${t.name} · ${t.value}`, children: [t.name.replace(/^--space-/, ''), " ", _jsx("em", { children: t.value })] }, t.name))) }), _jsx("div", { className: "froam-intel__chips froam-intel__chips--sub", children: tokens.spacing.map((t) => (_jsxs("button", { type: "button", className: "froam-intel__chip froam-intel__chip--ghost", onClick: () => onApplySpace(t, 'gap'), title: `gap: ${t.value}`, children: ["gap ", t.name.replace(/^--space-/, '')] }, t.name))) })] })), tokens.radius.length > 0 && (_jsxs("div", { className: "froam-intel__group", children: [_jsx("div", { className: "froam-intel__group-label", children: "radius" }), _jsx("div", { className: "froam-intel__chips", children: tokens.radius.map((t) => (_jsxs("button", { type: "button", className: "froam-intel__chip", onClick: () => onApplySpace(t, 'radius'), title: `${t.name} · ${t.value}`, children: [t.name.replace(/^--radius-/, ''), " ", _jsx("em", { children: t.value })] }, t.name))) })] }))] }));
}
/* ─────────────────────────── A11y ─────────────────────────── */
function A11yTab({ selectedElement, solidColorTokens, applyStyle, onToast, }) {
    // The same reading the Health scan, the reviewer checks and "Fix contrast
    // everywhere" use (project/a11y), so the tab never disagrees with them.
    const measured = useMemo(() => (selectedElement ? readTextContrast(selectedElement) : null), [selectedElement]);
    const reading = measured?.status === 'measured'
        ? { fg: measured.rendered, bg: measured.ground, ratio: measured.ratio, required: measured.required, ...ratingLabel(measured.ratio, measured.required) }
        : null;
    function suggestAccessibleToken() {
        if (measured?.status !== 'measured')
            return null;
        let best = null;
        for (const t of solidColorTokens) {
            if (!t.rgb)
                continue;
            const r = contrastOn(t.rgb, measured.grounds, measured.opacity).ratio;
            if (r >= measured.required && (!best || r < best.ratio))
                best = { t, ratio: r }; // smallest passing = closest tonal shift
        }
        return best?.t ?? null;
    }
    if (!selectedElement) {
        return _jsx("div", { className: "froam-intel__body", children: _jsx("p", { className: "froam-intel__hint", children: "Select any text element to check its live contrast against the real background behind it." }) });
    }
    if (!reading) {
        const why = measured?.status === 'unmeasurable'
            ? `${measured.detail}, so there is no single contrast ratio to give — check it by eye.`
            : measured?.status === 'exempt' && measured.reason === 'disabled'
                ? 'This control is disabled. WCAG leaves inactive controls out of the contrast requirement.'
                : 'Select an element that holds text of its own to check its contrast.';
        return _jsx("div", { className: "froam-intel__body", children: _jsx("p", { className: "froam-intel__hint", children: why }) });
    }
    const suggestion = reading.tone === 'fail' ? suggestAccessibleToken() : null;
    return (_jsxs("div", { className: "froam-intel__body", children: [_jsxs("div", { className: `froam-intel__contrast froam-intel__contrast--${reading.tone}`, children: [_jsxs("div", { className: "froam-intel__contrast-ratio", children: [reading.ratio.toFixed(2), _jsx("span", { children: ":1" })] }), _jsxs("div", { className: "froam-intel__contrast-grade", children: [reading.tone === 'pass' ? _jsx(Check, { size: 13 }) : null, reading.grade] })] }), _jsxs("div", { className: "froam-intel__contrast-preview", style: { background: toHex(reading.bg), color: toHex(reading.fg) }, children: [_jsx("span", { style: { fontSize: 13 }, children: "Normal text \u2014 the quick brown fox" }), _jsx("span", { style: { fontSize: 19, fontWeight: 700 }, children: "Large text 19px bold" })] }), _jsxs("ul", { className: "froam-intel__checks", children: [_jsxs("li", { className: reading.ratio >= 4.5 ? 'is-pass' : 'is-fail', children: [_jsx("span", { children: "AA \u00B7 normal text" }), _jsx("b", { children: "\u2265 4.5" })] }), _jsxs("li", { className: reading.ratio >= 3 ? 'is-pass' : 'is-fail', children: [_jsx("span", { children: "AA \u00B7 large text" }), _jsx("b", { children: "\u2265 3.0" })] }), _jsxs("li", { className: reading.ratio >= 7 ? 'is-pass' : 'is-fail', children: [_jsx("span", { children: "AAA \u00B7 normal text" }), _jsx("b", { children: "\u2265 7.0" })] })] }), suggestion && (_jsxs("button", { type: "button", className: "froam-intel__fix", onClick: () => { applyStyle({ color: `var(${suggestion.name})` }, undefined, 'A11y fix'); onToast(`Text → ${suggestion.name}`); }, children: [_jsx(Wand2, { size: 13 }), " Fix with ", suggestion.name.replace(/^--/, '')] })), _jsx("p", { className: "froam-intel__foot", children: "Measured against the actual painted background \u2014 something no static mock can see." })] }));
}
/* ─────────────────────────── Health ─────────────────────────── */
function HealthTab({ rootEl, solidColorTokens, onSelectElement, onFixElement, selectionPath, onToast, }) {
    const [issues, setIssues] = useState(null);
    const [scanning, setScanning] = useState(false);
    const idRef = useRef(0);
    function scan() {
        if (!rootEl) {
            onToast('No page root');
            return;
        }
        setScanning(true);
        idRef.current++;
        // Defer so the spinner paints.
        requestAnimationFrame(() => {
            const found = [];
            const els = Array.from(rootEl.querySelectorAll('*')).filter((el) => !isFroamOwn(el)).slice(0, 500);
            const tokenValues = new Set(solidColorTokens.map((t) => t.rgb ? `${t.rgb.r},${t.rgb.g},${t.rgb.b}` : ''));
            for (const el of els) {
                const cs = getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0)
                    continue;
                // Off-token background colours (only meaningful, saturated fills)
                const bg = parseColor(cs.backgroundColor);
                if (bg && bg.a >= 0.9) {
                    const key = `${bg.r},${bg.g},${bg.b}`;
                    const sat = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b);
                    if (!tokenValues.has(key) && sat > 40) {
                        const near = nearestColorToken(bg, solidColorTokens);
                        if (near && near.distance < 60) {
                            found.push({
                                id: `t${idRef.current}-${found.length}`, el, type: 'off-token', severity: 'medium',
                                label: 'Off-token colour', detail: `${toHex(bg)} ≈ ${near.token.name}`,
                                fix: { styles: { backgroundColor: `var(${near.token.name})` }, label: `Snap to ${near.token.name.replace(/^--/, '')}` },
                            });
                        }
                    }
                }
                // Contrast of the words an element holds itself, against everything
                // really painted behind them (project/a11y). Text over a photo has no
                // single ratio: it is listed for a look, not given a made-up number.
                const reading = readTextContrast(el);
                if (reading.status === 'measured' && !reading.passes) {
                    found.push({
                        id: `t${idRef.current}-${found.length}`, el, type: 'contrast', severity: 'high',
                        label: 'Low contrast',
                        detail: `${(Math.floor(reading.ratio * 100) / 100).toFixed(2)}:1 — needs ${reading.required.toFixed(1)}${reading.fixableByColour ? '' : ` · faded to ${Math.round(reading.opacity * 100)}%`}`,
                    });
                }
                else if (reading.status === 'unmeasurable' && reading.reason !== 'colour') {
                    found.push({
                        id: `t${idRef.current}-${found.length}`, el, type: 'contrast', severity: 'info',
                        label: 'Check contrast by eye', detail: reading.reason === 'photo' ? 'Text over a photo' : 'Gradient-filled text',
                    });
                }
                // Missing alt. alt="" is how an image is marked decorative — not missing.
                if (el instanceof HTMLImageElement && imageAlternative(el) === 'missing') {
                    found.push({
                        id: `t${idRef.current}-${found.length}`, el, type: 'alt', severity: 'low',
                        label: 'Image missing alt', detail: el.currentSrc?.split('/').pop()?.slice(0, 28) ?? 'image',
                    });
                }
            }
            // Targets under WCAG 2.5.8's 24×24, at every screen size, after its
            // inline and spacing exceptions — 44×44 is the AAA goal, not the floor.
            const controls = Array.from(rootEl.querySelectorAll(INTERACTIVE_SELECTOR)).filter((el) => !isFroamOwn(el));
            for (const { element, width, height } of undersizedTargets(controls)) {
                const styles = { minWidth: '24px', minHeight: '24px' };
                if (getComputedStyle(element).display === 'inline')
                    styles.display = 'inline-block';
                found.push({
                    id: `t${idRef.current}-${found.length}`, el: element, type: 'tap-target', severity: 'medium',
                    label: 'Small target', detail: `${width}×${height} — min 24×24`,
                    fix: { styles, label: 'Make it 24×24' },
                });
            }
            const dedup = found.slice(0, 60);
            setIssues(dedup);
            setScanning(false);
            const score = dedup.length ? scoreIssues(dedup) : 100;
            const failures = dedup.filter((issue) => issue.severity !== 'info').length;
            onToast(failures ? `Health ${score}/100 · ${failures} issues` : dedup.length ? `Health ${score}/100 · ${dedup.length} to check by eye` : 'Health 100/100 — clean');
        });
    }
    const score = issues ? (issues.length ? scoreIssues(issues) : 100) : null;
    const scoreTone = score == null ? '' : score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail';
    function fixIssue(issue) {
        if (!issue.fix)
            return;
        onFixElement(issue.el, issue.fix.styles, issue.fix.label);
        onToast(issue.fix.label);
        setIssues((prev) => prev ? prev.filter((i) => i.id !== issue.id) : prev);
    }
    return (_jsxs("div", { className: "froam-intel__body", children: [_jsxs("div", { className: "froam-intel__health-head", children: [score != null && (_jsxs("div", { className: `froam-intel__score froam-intel__score--${scoreTone}`, children: [_jsx("div", { className: "froam-intel__score-num", children: score }), _jsx("div", { className: "froam-intel__score-cap", children: "health" })] })), _jsxs("button", { type: "button", className: "froam-intel__scan", onClick: scan, disabled: scanning, children: [scanning ? _jsx(Sparkles, { size: 13, className: "froam-spin" }) : _jsx(ScanLine, { size: 13 }), scanning ? 'Scanning…' : issues ? 'Re-scan page' : 'Scan this page'] })] }), issues && issues.length === 0 && (_jsxs("div", { className: "froam-intel__clean", children: [_jsx(ShieldCheck, { size: 20 }), " No issues found. Ship it."] })), issues && issues.length > 0 && (_jsx("ul", { className: "froam-intel__issues", children: issues.map((issue) => (_jsxs("li", { className: `froam-intel__issue froam-intel__issue--${issue.severity}`, children: [_jsxs("button", { type: "button", className: "froam-intel__issue-main", onClick: () => onSelectElement(issue.el), title: "Select this element", children: [_jsx("span", { className: "froam-intel__issue-dot" }), _jsxs("span", { className: "froam-intel__issue-text", children: [_jsx("b", { children: issue.label }), _jsx("em", { children: issue.detail })] })] }), issue.fix && (_jsx("button", { type: "button", className: "froam-intel__issue-fix", onClick: () => fixIssue(issue), title: issue.fix.label, children: _jsx(PenLine, { size: 12 }) }))] }, issue.id))) })), !issues && _jsx("p", { className: "froam-intel__hint", children: "Scans the real rendered page for off-brand colours, contrast failures, small tap targets and missing alt text \u2014 live, on the running app." }), _jsx("input", { type: "hidden", value: selectionPath, readOnly: true })] }));
}
//# sourceMappingURL=FroamIntel.js.map