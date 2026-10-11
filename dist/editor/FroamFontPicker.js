import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Globe2, Search, X } from 'lucide-react';
import { FONT_GROUP_LABELS, FONT_SCRIPT_LABELS, FONT_SCRIPT_ORDER, FONT_SCRIPT_SAMPLES, catalogEntry, fontStylesheetUrls, groupFontOptions, primaryFamily, } from './fontSources.js';
import { isPreviewLoaded, onPreviewsLoaded, previewFamily, requestPreview } from './font-preview.js';
const RECENT_KEY = 'froam:recent-fonts:v1';
const RECENT_MAX = 8;
function readRecent() {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, RECENT_MAX) : [];
    }
    catch {
        return [];
    }
}
function rememberRecent(family) {
    try {
        const next = [family, ...readRecent().filter((item) => item !== family)].slice(0, RECENT_MAX);
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
    catch { /* storage unavailable: recents are a convenience */ }
}
/** The label Froam shows for a CSS font-family value. */
function labelFor(value, options) {
    const exact = options.find((option) => option.value === value);
    if (exact)
        return exact.label;
    const family = primaryFamily(value);
    return options.find((option) => option.family === family)?.label ?? family ?? 'Font';
}
function selectedElements() {
    return [...document.querySelectorAll('[data-chef-selected="true"]')]
        .filter((el) => !el.closest('[data-chef-editor-root="true"]'));
}
function loadFullFamily(family) {
    if (!family)
        return;
    for (const url of fontStylesheetUrls([family])) {
        if (document.head.querySelector(`link[data-froam-font-trial][href="${CSS.escape(url)}"]`))
            continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.setAttribute('data-froam-font-trial', 'true');
        document.head.appendChild(link);
    }
}
export default function FroamFontPicker({ value, options, onPick, variant = 'bar', className = '' }) {
    const triggerRef = useRef(null);
    const listRef = useRef(null);
    const searchRef = useRef(null);
    const trialRef = useRef(null);
    const trialTimer = useRef(0);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [script, setScript] = useState('any');
    const [active, setActive] = useState(0);
    const [recent, setRecent] = useState([]);
    const [style, setStyle] = useState({});
    const [, setLoadedTick] = useState(0);
    useEffect(() => onPreviewsLoaded(() => setLoadedTick((tick) => tick + 1)), []);
    const currentFamily = primaryFamily(value);
    const currentLabel = labelFor(value, options);
    /* Rows, after filters. Grouped under headings only when browsing everything. */
    const rows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const matches = (option) => {
            const entry = catalogEntry(option.family);
            if (script !== 'any' && !(entry?.scripts ?? []).includes(script))
                return false;
            if (!needle)
                return true;
            const haystack = [
                option.label, FONT_GROUP_LABELS[option.role], entry?.note, entry?.origin,
                ...(entry?.scripts ?? []).map((s) => FONT_SCRIPT_LABELS[s]),
            ].join(' ').toLowerCase();
            return needle.split(/\s+/).every((word) => haystack.includes(word));
        };
        if (filter === 'recent') {
            return recent
                .map((family) => options.find((option) => option.family === family))
                .filter((option) => Boolean(option) && matches(option))
                .map((option) => ({ option, heading: null }));
        }
        const pool = options.filter((option) => (filter === 'all' || option.role === filter) && matches(option));
        if (filter !== 'all' || needle)
            return pool.map((option) => ({ option, heading: null }));
        return groupFontOptions(pool).flatMap(([role, group]) => group.map((option, index) => ({ option, heading: index === 0 ? FONT_GROUP_LABELS[role] : null })));
    }, [filter, options, query, recent, script]);
    const presentGroups = useMemo(() => new Set(options.map((option) => option.role)), [options]);
    const scriptCounts = useMemo(() => {
        const counts = new Map();
        for (const option of options)
            for (const s of catalogEntry(option.family)?.scripts ?? [])
                counts.set(s, (counts.get(s) ?? 0) + 1);
        return counts;
    }, [options]);
    /*
     * Placement. The try-on is the point, so the picker never sits on the words
     * it's restyling: beside the selection when there's room (clear of the side
     * panels and the top bar), else under the trigger, flipped up if needed.
     */
    const place = useCallback(() => {
        const trigger = triggerRef.current?.getBoundingClientRect();
        if (!trigger)
            return;
        const gap = 10;
        const width = Math.min(380, window.innerWidth - 16);
        const leftPanel = document.querySelector('.froam-figma-left:not([hidden])')?.getBoundingClientRect();
        const rightPanel = document.querySelector('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect();
        const toolbar = document.querySelector('.froam-chrome')?.getBoundingClientRect();
        const safeLeft = leftPanel && leftPanel.width > 0 ? leftPanel.right + 8 : 8;
        const safeRight = rightPanel && rightPanel.width > 0 ? rightPanel.left - 8 : window.innerWidth - 8;
        const safeTop = toolbar && toolbar.top <= 8 ? toolbar.bottom + 8 : 8;
        const height = Math.min(600, window.innerHeight - safeTop - 8);
        const clampTop = (top) => Math.min(Math.max(safeTop, top), window.innerHeight - height - 8);
        const targets = selectedElements().map((el) => el.getBoundingClientRect());
        if (targets.length) {
            const sel = targets.reduce((a, b) => new DOMRect(Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right) - Math.min(a.left, b.left), Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top)));
            const top = clampTop(Math.min(trigger.bottom + 6, sel.top));
            if (sel.right + gap + width <= safeRight) {
                setStyle({ left: sel.right + gap, top, width, maxHeight: height });
                return;
            }
            if (sel.left - gap - width >= safeLeft) {
                setStyle({ left: sel.left - gap - width, top, width, maxHeight: height });
                return;
            }
        }
        // In the Design panel: open beside the panel, pointing at the field.
        if (variant === 'panel' && trigger.left - gap - width >= safeLeft - 8) {
            setStyle({ left: trigger.left - gap - width, top: clampTop(trigger.top - 60), width, maxHeight: height });
            return;
        }
        const below = window.innerHeight - trigger.bottom - 12;
        const above = trigger.top - safeTop - 6;
        const top = below >= Math.min(height, 420) || below >= above ? trigger.bottom + 6 : Math.max(safeTop, trigger.top - 6 - Math.min(height, above));
        const left = Math.min(Math.max(safeLeft, trigger.left), Math.max(safeLeft, safeRight - width));
        setStyle({ left, top, width, maxHeight: Math.max(260, top > trigger.top ? Math.min(height, below) : Math.min(height, above)) });
    }, [variant]);
    useLayoutEffect(() => {
        if (!open)
            return;
        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [open, place]);
    /* ── try-on ── */
    const endTrial = useCallback(() => {
        window.clearTimeout(trialTimer.current);
        const trial = trialRef.current;
        trialRef.current = null;
        trial?.elements.forEach(({ el, value: previous, priority }) => {
            if (previous)
                el.style.setProperty('font-family', previous, priority);
            else
                el.style.removeProperty('font-family');
        });
    }, []);
    const tryOn = useCallback((option) => {
        window.clearTimeout(trialTimer.current);
        if (!option)
            return;
        trialTimer.current = window.setTimeout(() => {
            loadFullFamily(option.family);
            if (!trialRef.current) {
                trialRef.current = {
                    elements: selectedElements().map((el) => ({ el, value: el.style.getPropertyValue('font-family'), priority: el.style.getPropertyPriority('font-family') })),
                };
            }
            trialRef.current.elements.forEach(({ el }) => el.style.setProperty('font-family', option.value, 'important'));
        }, 110);
    }, []);
    const close = useCallback(() => {
        endTrial();
        setOpen(false);
        document.head.querySelectorAll('link[data-froam-font-trial]').forEach((link) => link.remove());
        triggerRef.current?.focus({ preventScroll: true });
    }, [endTrial]);
    const pick = useCallback((option) => {
        endTrial();
        if (option.family)
            rememberRecent(option.family);
        onPick(option.value);
        setOpen(false);
        // The real stylesheet (ensureFontLinks) now owns the family; drop the try-on links a moment later.
        window.setTimeout(() => document.head.querySelectorAll('link[data-froam-font-trial]').forEach((link) => link.remove()), 1500);
        triggerRef.current?.focus({ preventScroll: true });
    }, [endTrial, onPick]);
    function openPicker() {
        const recents = readRecent();
        setRecent(recents);
        setQuery('');
        setScript('any');
        setFilter('all');
        setOpen(true);
    }
    // Start on the current font, scrolled into view.
    useEffect(() => {
        if (!open)
            return;
        const index = rows.findIndex((row) => row.option.value === value || (currentFamily && row.option.family === currentFamily));
        setActive(Math.max(0, index));
        requestAnimationFrame(() => {
            searchRef.current?.focus({ preventScroll: true });
            listRef.current?.querySelector(`[data-index="${Math.max(0, index)}"]`)?.scrollIntoView({ block: 'center' });
        });
        // Only when it opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    useEffect(() => { if (open)
        setActive(0); }, [open, query, filter, script]);
    // Close on a press outside (the trigger toggles itself).
    useEffect(() => {
        if (!open)
            return;
        const onDown = (event) => {
            const target = event.target;
            if (triggerRef.current?.contains(target))
                return;
            if (target.closest?.('.froam-font-picker'))
                return;
            close();
        };
        window.addEventListener('pointerdown', onDown, true);
        return () => window.removeEventListener('pointerdown', onDown, true);
    }, [close, open]);
    useEffect(() => endTrial, [endTrial]);
    /* Rows load their own face as they scroll into view. */
    useEffect(() => {
        if (!open || !listRef.current)
            return;
        const list = listRef.current;
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting)
                    continue;
                const family = entry.target.dataset.family;
                if (!family)
                    continue;
                const sample = catalogEntry(family)?.script ? FONT_SCRIPT_SAMPLES[catalogEntry(family).script] : '';
                requestPreview(family, `${family}${sample}`);
            }
        }, { root: list, rootMargin: '120px 0px' });
        list.querySelectorAll('[data-family]').forEach((row) => observer.observe(row));
        return () => observer.disconnect();
    }, [open, rows]);
    function onKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            const next = Math.min(rows.length - 1, Math.max(0, active + (event.key === 'ArrowDown' ? 1 : -1)));
            setActive(next);
            tryOn(rows[next]?.option);
            listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const row = rows[active];
            if (row)
                pick(row.option);
        }
    }
    const activeOption = rows[active]?.option;
    const activeEntry = catalogEntry(activeOption?.family);
    const filters = [
        { id: 'all', label: 'All' },
        ...(recent.length ? [{ id: 'recent', label: 'Recent' }] : []),
        ...['brand', 'display', 'sans', 'humanist', 'condensed', 'serif', 'slab', 'mono', 'hand', 'system']
            .filter((group) => presentGroups.has(group))
            .map((group) => ({ id: group, label: FONT_GROUP_LABELS[group] })),
    ];
    const rowFont = (option) => {
        if (option.role === 'system' || option.role === 'brand' || !option.family)
            return option.value;
        return isPreviewLoaded(option.family) ? previewFamily(option.family) : 'inherit';
    };
    return (_jsxs(_Fragment, { children: [_jsxs("button", { ref: triggerRef, type: "button", className: `froam-font-trigger froam-font-trigger--${variant} ${className}`, title: `Font: ${currentLabel}`, "aria-label": "Font family", "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => (open ? close() : openPicker()), "data-chef-editor-root": "true", children: [_jsx("span", { className: "froam-font-trigger__name", children: currentLabel }), _jsx(ChevronDown, { size: 12, "aria-hidden": "true" })] }), open && typeof document !== 'undefined' && createPortal(_jsxs("div", { className: "froam-font-picker", role: "dialog", "aria-label": "Choose a font", style: style, onKeyDown: onKeyDown, onPointerLeave: () => endTrial(), "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-font-picker__search", children: [_jsx(Search, { size: 14, "aria-hidden": "true" }), _jsx("input", { ref: searchRef, value: query, onChange: (event) => setQuery(event.target.value), placeholder: `Search ${options.length} fonts — try “Japanese”, “India”, “wedding”`, "aria-label": "Search fonts", "aria-controls": "froam-font-list", "aria-activedescendant": activeOption ? `froam-font-row-${active}` : undefined, role: "combobox", "aria-expanded": "true" }), query && _jsx("button", { type: "button", className: "froam-font-picker__clear", onClick: () => { setQuery(''); searchRef.current?.focus(); }, "aria-label": "Clear search", children: _jsx(X, { size: 12 }) })] }), _jsx("div", { className: "froam-font-picker__filters", role: "tablist", "aria-label": "Font roles", children: filters.map((item) => (_jsx("button", { type: "button", role: "tab", "aria-selected": filter === item.id, className: filter === item.id ? 'is-active' : '', onClick: () => setFilter(item.id), children: item.label }, item.id))) }), _jsxs("label", { className: "froam-font-picker__world", children: [_jsx(Globe2, { size: 13, "aria-hidden": "true" }), _jsx("span", { children: "Writing system" }), _jsxs("select", { value: script, onChange: (event) => setScript(event.target.value), "aria-label": "Writing system", children: [_jsx("option", { value: "any", children: "Any (Latin included)" }), FONT_SCRIPT_ORDER.filter((s) => scriptCounts.has(s)).map((s) => (_jsxs("option", { value: s, children: [FONT_SCRIPT_LABELS[s], " \u00B7 ", scriptCounts.get(s)] }, s)))] })] }), _jsxs("div", { className: "froam-font-picker__list", id: "froam-font-list", role: "listbox", "aria-label": "Fonts", ref: listRef, children: [rows.map(({ option, heading }, index) => {
                                const entry = catalogEntry(option.family);
                                const sample = entry?.script ? FONT_SCRIPT_SAMPLES[entry.script] : '';
                                const selected = option.value === value || (!!currentFamily && option.family === currentFamily);
                                return (_jsxs("div", { className: "froam-font-picker__row-wrap", children: [heading && _jsx("div", { className: "froam-font-picker__heading", role: "presentation", children: heading }), _jsxs("button", { type: "button", id: `froam-font-row-${index}`, role: "option", "aria-selected": selected, "data-index": index, "data-family": option.family, className: `froam-font-picker__row ${index === active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`, onPointerEnter: () => { setActive(index); tryOn(option); }, onFocus: () => setActive(index), onClick: () => pick(option), children: [_jsx("span", { className: "froam-font-picker__face", style: { fontFamily: rowFont(option) }, children: option.label.replace(/ \(brand\)$/, '') }), sample && _jsx("span", { className: "froam-font-picker__sample", style: { fontFamily: rowFont(option) }, lang: entry?.script === 'chinese' ? 'zh' : entry?.script === 'japanese' ? 'ja' : entry?.script === 'korean' ? 'ko' : undefined, children: sample }), _jsx("span", { className: "froam-font-picker__meta", children: option.role === 'brand' ? 'Brand' : option.role === 'system' ? 'No download' : entry?.origin ?? FONT_GROUP_LABELS[option.role] }), selected && _jsx(Check, { size: 13, className: "froam-font-picker__check", "aria-hidden": "true" })] })] }, option.value));
                            }), rows.length === 0 && (_jsx("div", { className: "froam-font-picker__empty", children: filter === 'recent' ? 'Fonts you pick show up here.' : `No fonts match${query ? ` “${query}”` : ''}${script !== 'any' ? ` in ${FONT_SCRIPT_LABELS[script]}` : ''}.` }))] }), _jsx("div", { className: "froam-font-picker__about", "aria-live": "polite", children: activeOption && (_jsxs(_Fragment, { children: [_jsx("strong", { children: activeOption.label }), _jsx("span", { children: activeEntry?.note ?? (activeOption.role === 'system' ? 'Uses the fonts already on the device. Nothing to load.' : activeOption.role === 'brand' ? "The client's own font, carried in the design." : '') }), (activeEntry?.origin || activeEntry?.scripts?.length) && (_jsxs("small", { children: [activeEntry?.origin ? `Made in ${activeEntry.origin}` : '', activeEntry?.origin && activeEntry?.scripts?.length ? ' · ' : '', activeEntry?.scripts?.length ? `Latin + ${activeEntry.scripts.map((s) => FONT_SCRIPT_LABELS[s]).join(', ')}` : ''] })), !!activeEntry?.pairsWith?.length && (_jsxs("div", { className: "froam-font-picker__pairs", children: [_jsx("span", { children: "Pairs with" }), activeEntry.pairsWith.map((pair) => (_jsx("button", { type: "button", onClick: () => { setFilter('all'); setScript('any'); setQuery(pair); }, children: pair }, pair)))] }))] })) })] }), document.body)] }));
}
//# sourceMappingURL=FroamFontPicker.js.map