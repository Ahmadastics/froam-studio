import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
const SHORTCUT_GROUPS = [
    {
        title: 'General',
        shortcuts: [
            { keys: 'Ctrl + S', label: 'Save' },
            { keys: 'Ctrl + Shift + S', label: 'Save to your code' },
            { keys: 'Ctrl + K', label: 'Search commands' },
            { keys: 'Ctrl + Z', label: 'Undo' },
            { keys: 'Ctrl + Y', label: 'Redo' },
            { keys: 'Escape', label: 'Deselect or close' },
            { keys: 'Ctrl + .', label: 'Minimize the editor' },
            { keys: '?', label: 'Show these shortcuts' },
        ],
    },
    {
        title: 'Tools',
        shortcuts: [
            { keys: 'V', label: 'Select' },
            { keys: 'H', label: 'Hand — drag to pan' },
            { keys: 'T', label: 'Text' },
            { keys: 'R', label: 'Rectangle' },
            { keys: 'F', label: 'Frame' },
            { keys: 'Ctrl + Shift + L', label: 'Move freely' },
        ],
    },
    {
        title: 'Selection',
        shortcuts: [
            { keys: 'Click', label: 'Select' },
            { keys: 'Shift + Click', label: 'Add to the selection' },
            { keys: 'Double-click', label: 'Edit the words' },
            { keys: 'Right-click', label: 'More actions and Quick Edit' },
            { keys: 'Delete', label: 'Reset styles' },
        ],
    },
    {
        title: 'Movement',
        shortcuts: [
            { keys: '↑ ↓ ← →', label: 'Nudge 1px' },
            { keys: 'Shift + Arrow', label: 'Nudge 10px' },
        ],
    },
    {
        title: 'Copy and group',
        shortcuts: [
            { keys: 'Ctrl + D', label: 'Duplicate' },
            { keys: 'Ctrl + Alt + C', label: 'Copy styles' },
            { keys: 'Ctrl + Alt + V', label: 'Paste styles' },
            { keys: 'Ctrl + G', label: 'Group' },
            { keys: 'Ctrl + Shift + G', label: 'Ungroup' },
        ],
    },
];
export default function FroamShortcutOverlay({ visible, onClose }) {
    useEffect(() => {
        if (!visible)
            return;
        function handleKey(e) {
            if (e.key === 'Escape' || e.key === '?') {
                e.preventDefault();
                onClose();
            }
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [visible, onClose]);
    if (!visible)
        return null;
    return (_jsx("div", { className: "froam-shortcut-overlay", "data-chef-editor-root": "true", onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: _jsxs("div", { className: "froam-shortcut-overlay__card", role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-shortcut-overlay__header", children: [_jsxs("div", { className: "froam-shortcut-overlay__title", children: [_jsx(Keyboard, { size: 18 }), _jsx("span", { children: "Keyboard shortcuts" })] }), _jsx("button", { type: "button", className: "froam-shortcut-overlay__close", onClick: onClose, "aria-label": "Close shortcuts", children: _jsx(X, { size: 16 }) })] }), _jsx("div", { className: "froam-shortcut-overlay__body", children: SHORTCUT_GROUPS.map((group) => (_jsxs("div", { className: "froam-shortcut-group", children: [_jsx("h4", { className: "froam-shortcut-group__title", children: group.title }), group.shortcuts.map((s) => (_jsxs("div", { className: "froam-shortcut-row", children: [_jsx("span", { className: "froam-shortcut-row__label", children: s.label }), _jsx("span", { className: "froam-shortcut-row__keys", children: s.keys.split(' + ').map((k, i) => (_jsxs("span", { children: [i > 0 && _jsx("span", { className: "froam-shortcut-row__plus", children: "+" }), _jsx("kbd", { className: "froam-shortcut-row__kbd", children: k })] }, i))) })] }, s.label)))] }, group.title))) }), _jsxs("div", { className: "froam-shortcut-overlay__footer", children: ["Press ", _jsx("kbd", { children: "?" }), " or ", _jsx("kbd", { children: "Esc" }), " to close"] })] }) }));
}
//# sourceMappingURL=FroamShortcutOverlay.js.map