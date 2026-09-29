import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Check, LayoutPanelLeft, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { DEFAULT_FROAM_UI_PREFERENCE } from './froamUIPreferences.js';
const choices = {
    toolbar: [['top', 'Top'], ['bottom', 'Bottom']],
    workspace: [['attached', 'In toolbar'], ['floating-bottom', 'Floating dock']],
    panels: [['standard', 'Left'], ['mirrored', 'Right']],
    density: [['comfortable', 'Comfortable'], ['compact', 'Compact']],
    theme: [['dark', 'Dark'], ['light', 'Light'], ['system', 'Match system']],
    appearance: [['graphite', 'Graphite'], ['midnight', 'Midnight'], ['glass', 'Glass']],
    accent: [['blue', 'Blue'], ['teal', 'Teal'], ['violet', 'Violet'], ['coral', 'Coral']],
    leftSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
    inspectorSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
    scale: [[0.9, '90%'], [1, '100%'], [1.1, '110%']],
};
export default function FroamUICustomizer({ open, value, onChange, onClose }) {
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => { if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
        } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open, onClose]);
    if (!open)
        return null;
    const set = (key, next) => onChange({ ...value, [key]: next });
    const row = (key, label, description) => (_jsxs("section", { className: "froam-ui-customizer__option", children: [_jsxs("div", { children: [_jsx("strong", { children: label }), _jsx("small", { children: description })] }), _jsx("div", { className: "froam-ui-customizer__choices", children: choices[key].map(([id, name]) => _jsxs("button", { type: "button", className: value[key] === id ? 'is-active' : '', onClick: () => onChange({ ...value, [key]: id }), children: [value[key] === id && _jsx(Check, { size: 11 }), " ", name] }, String(id))) })] }, key));
    return _jsx("div", { className: "froam-ui-customizer", role: "dialog", "aria-modal": "true", "aria-label": "Customize Froam UI", "data-chef-editor-root": "true", onClick: (event) => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "froam-ui-customizer__card", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx(SlidersHorizontal, { size: 16 }), _jsxs("span", { children: [_jsx("strong", { children: "Make Froam yours" }), _jsx("small", { children: "Arrange the editor your way. Your project doesn\u2019t change." })] })] }), _jsx("button", { type: "button", "aria-label": "Close UI customizer", onClick: onClose, children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: `froam-ui-customizer__preview is-${value.panels} toolbar-${value.toolbar} workspace-${value.workspace}`, children: [_jsx("i", { className: "is-toolbar" }), _jsx("i", { className: "is-build" }), _jsx("i", { className: "is-canvas", children: _jsx(LayoutPanelLeft, { size: 18 }) }), _jsx("i", { className: "is-inspector" }), _jsx("i", { className: "is-workspace" })] }), _jsxs("main", { children: [row('toolbar', 'Top bar', 'Above or below the page.'), row('panels', 'Layers and pages', 'Which side the Layers, Pages and Library panel sits on.'), row('leftSize', 'Layers panel width', 'How much room the Layers, Pages and Library panel takes.'), row('inspectorSize', 'Design panel width', 'How much room the Design panel takes.'), row('density', 'Density', 'Compact fits more; comfortable breathes more.'), row('scale', 'Size', 'Scale the editor without changing your page.'), row('theme', 'Appearance', 'Dark or light — or follow your computer.'), value.theme !== 'light' && row('appearance', 'Dark surface', 'The material of the editor when it’s dark.'), row('accent', 'Accent', 'The colour for selected things and the main action.'), _jsxs("label", { className: "froam-ui-customizer__toggle", children: [_jsxs("span", { children: [_jsx("strong", { children: "Tab labels" }), _jsx("small", { children: "Show words on the panel tabs, or icons only." })] }), _jsx("input", { type: "checkbox", checked: value.labels, onChange: (event) => set('labels', event.target.checked) })] })] }), _jsxs("footer", { children: [_jsxs("button", { type: "button", onClick: () => onChange({ ...DEFAULT_FROAM_UI_PREFERENCE }), children: [_jsx(RotateCcw, { size: 13 }), " Reset to default"] }), _jsx("button", { type: "button", className: "is-primary", onClick: onClose, children: "Done" })] })] }) });
}
//# sourceMappingURL=FroamUICustomizer.js.map