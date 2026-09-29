import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Clapperboard, FileImage, Grid2X2, Layers, ListTree, Loader2, MousePointer2, WandSparkles } from 'lucide-react';
import { workspaceStatus, workspaceTemporalSurface } from './workspace-shell-model.js';
export const LEFT_PANEL_TABS = [
    { id: 'layers', mode: 'understand', label: 'Layers', hint: 'Everything on this page, as a tree', icon: Layers },
    { id: 'plan', mode: 'create', label: 'Pages', hint: 'The pages of this site', icon: ListTree },
    { id: 'library', mode: 'create', label: 'Library', hint: 'Sections and blocks to drop in', icon: Grid2X2 },
    { id: 'reference', mode: 'understand', label: 'Reference', hint: 'Build from a screenshot', icon: FileImage },
];
export const RIGHT_PANEL_TABS = [
    { id: 'design', mode: 'create', label: 'Design', hint: 'How the selection looks', icon: MousePointer2 },
    { id: 'animator', mode: 'create', label: 'Animate', hint: 'Motion and interactions for the selection', icon: WandSparkles },
];
export function FroamPanelTabs({ tabs, active, onSelect, label }) {
    return (_jsx("div", { className: "froam-panel-tabs", role: "tablist", "aria-label": label, "data-chef-editor-root": "true", children: tabs.map((tab) => {
            const Icon = tab.icon;
            return (_jsxs("button", { type: "button", role: "tab", "aria-selected": active === tab.id, className: active === tab.id ? 'is-active' : '', title: tab.hint, onClick: () => onSelect(tab), "data-chef-editor-root": "true", children: [_jsx(Icon, { size: 14 }), _jsx("span", { children: tab.label })] }, tab.id));
        }) }));
}
const FIRST_HINT_KEY = 'froam-first-hint-v1';
const readHintSeen = () => { try {
    return window.localStorage.getItem(FIRST_HINT_KEY) === '1';
}
catch {
    return true;
} };
const writeHintSeen = () => { try {
    window.localStorage.setItem(FIRST_HINT_KEY, '1');
}
catch { /* private mode */ } };
/** What Froam is busy with, and which timeline owns time — shown only while it's true. */
export default function FroamWorkspaceShell(props) {
    const status = workspaceStatus({
        mode: props.mode,
        branchName: props.branchName,
        branchId: props.branchId,
        activity: props.activity,
        sampling: props.temporalOwner === 'sampling',
        replay: props.temporalOwner === 'replay',
        physics: props.activeSection === 'physics',
    });
    const temporal = workspaceTemporalSurface(props.temporalOwner);
    const [hintSeen, setHintSeen] = useState(readHintSeen);
    useEffect(() => { if (props.hasSelection && !hintSeen) {
        writeHintSeen();
        setHintSeen(true);
    } }, [props.hasSelection, hintSeen]);
    return _jsxs(_Fragment, { children: [!hintSeen && !props.activity && !props.hasSelection && (_jsxs("div", { className: "froam-first-hint", role: "status", "data-chef-editor-root": "true", children: [_jsx(MousePointer2, { size: 14 }), _jsx("span", { children: "Click anything on the page to edit it" }), _jsx("kbd", { children: "Ctrl K" }), _jsx("span", { className: "froam-first-hint__more", children: "for everything else" }), _jsx("button", { type: "button", onClick: () => { writeHintSeen(); setHintSeen(true); }, children: "Got it" })] })), props.activity && (_jsxs("output", { className: `froam-activity is-${status.tone}`, "aria-live": "polite", "data-chef-editor-root": "true", children: [_jsx(Loader2, { size: 13, className: "froam-activity__spin" }), status.label.replace(/\s*[☣●]\s*$/u, '')] })), temporal && _jsxs("section", { className: "froam-temporal-dock", "data-chef-editor-root": "true", "aria-label": "Active timeline", children: [_jsx(Clapperboard, { size: 14 }), _jsx("b", { children: temporal.label }), _jsx("span", { children: "This timeline owns playback until you close it." })] })] });
}
//# sourceMappingURL=FroamWorkspaceShell.js.map