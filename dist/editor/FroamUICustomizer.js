import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, LayoutPanelLeft, RotateCcw, Sparkles, X } from 'lucide-react';
import { DEFAULT_FROAM_UI_PREFERENCE } from './froamUIPreferences.js';
const choices = {
    toolbar: [['top', 'Top'], ['bottom', 'Bottom']],
    workspace: [['attached', 'In toolbar'], ['floating-bottom', 'Floating dock']],
    panels: [['standard', 'Build left'], ['mirrored', 'Build right']],
    density: [['comfortable', 'Comfortable'], ['compact', 'Compact']],
    appearance: [['graphite', 'Graphite'], ['midnight', 'Midnight'], ['glass', 'Glass']],
    accent: [['mint', 'Mint'], ['blue', 'Blue'], ['violet', 'Violet'], ['coral', 'Coral']],
    leftSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
    inspectorSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
    scale: [[0.9, '90%'], [1, '100%'], [1.1, '110%']],
};
export default function FroamUICustomizer({ open, value, onChange, onClose }) {
    if (!open)
        return null;
    const set = (key, next) => onChange({ ...value, [key]: next });
    const row = (key, label, description) => (_jsxs("section", { className: "froam-ui-customizer__option", children: [_jsxs("div", { children: [_jsx("strong", { children: label }), _jsx("small", { children: description })] }), _jsx("div", { className: "froam-ui-customizer__choices", children: choices[key].map(([id, name]) => _jsxs("button", { type: "button", className: value[key] === id ? 'is-active' : '', onClick: () => onChange({ ...value, [key]: id }), children: [value[key] === id && _jsx(Check, { size: 11 }), " ", name] }, String(id))) })] }, key));
    return _jsx("div", { className: "froam-ui-customizer", role: "dialog", "aria-modal": "true", "aria-label": "Customize Froam UI", "data-chef-editor-root": "true", onClick: (event) => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "froam-ui-customizer__card", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx(Sparkles, { size: 15 }), _jsxs("span", { children: [_jsx("strong", { children: "Make Froam yours" }), _jsx("small", { children: "Move the chrome without changing your project." })] })] }), _jsx("button", { type: "button", "aria-label": "Close UI customizer", onClick: onClose, children: _jsx(X, { size: 15 }) })] }), _jsxs("div", { className: `froam-ui-customizer__preview is-${value.panels} toolbar-${value.toolbar} workspace-${value.workspace}`, children: [_jsx("i", { className: "is-toolbar" }), _jsx("i", { className: "is-build" }), _jsx("i", { className: "is-canvas", children: _jsx(LayoutPanelLeft, { size: 18 }) }), _jsx("i", { className: "is-inspector" }), _jsx("i", { className: "is-workspace" })] }), _jsxs("main", { children: [row('toolbar', 'Main toolbar', 'Keep controls above or below the canvas.'), row('workspace', 'Froam navigation', 'Attach it to the toolbar or float it near the canvas.'), row('panels', 'Panel sides', 'Swap Build/Outline with the inspector.'), row('leftSize', 'Build & Outline width', 'Choose how much canvas the structure tools use.'), row('inspectorSize', 'Inspector width', 'Give design and intelligence more or less room.'), row('density', 'Control density', 'Compact fits more; comfortable breathes more.'), row('scale', 'UI scale', 'Scale Froam chrome independently from your page.'), row('appearance', 'Surface', 'Choose the material of Froam’s chrome.'), row('accent', 'Accent', 'Choose Froam’s interaction colour.'), _jsxs("label", { className: "froam-ui-customizer__toggle", children: [_jsxs("span", { children: [_jsx("strong", { children: "Navigation labels" }), _jsx("small", { children: "Hide labels for an icon-first workspace." })] }), _jsx("input", { type: "checkbox", checked: value.labels, onChange: (event) => set('labels', event.target.checked) })] })] }), _jsxs("footer", { children: [_jsxs("button", { type: "button", onClick: () => onChange({ ...DEFAULT_FROAM_UI_PREFERENCE }), children: [_jsx(RotateCcw, { size: 12 }), " Reset Froam UI"] }), _jsx("button", { type: "button", className: "is-primary", onClick: onClose, children: "Done" })] })] }) });
}
//# sourceMappingURL=FroamUICustomizer.js.map