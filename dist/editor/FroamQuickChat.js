import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
const selectedSuggestions = ['Make it bolder', 'Center the content', 'Add more space', 'Make it rounder'];
const pageSuggestions = ['Add a hero section', 'Add a rectangle', 'Open Layers', 'Make the page dark'];
export default function FroamQuickChat({ open, selectionLabel, busy, onSubmit, onClose }) {
    const [value, setValue] = useState('');
    const inputRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        setValue('');
        const frame = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open, selectionLabel]);
    if (!open)
        return null;
    const targetLabel = selectionLabel || 'this page';
    const suggestions = selectionLabel ? selectedSuggestions : pageSuggestions;
    const submitIntent = (intent) => {
        const command = intent.trim();
        if (!command || busy)
            return;
        onSubmit(command);
    };
    const send = (event) => {
        event?.preventDefault();
        submitIntent(value);
    };
    return _jsxs("section", { className: "froam-quick-chat", "data-chef-editor-root": "true", role: "dialog", "aria-label": `Quick Edit ${targetLabel}`, children: [_jsxs("header", { children: [_jsxs("span", { children: [_jsx(Sparkles, { size: 14 }), _jsxs("b", { children: ["Quick Edit \u00B7 ", targetLabel] })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close Quick Edit", children: _jsx(X, { size: 14 }) })] }), _jsxs("form", { onSubmit: send, children: [_jsx("input", { ref: inputRef, value: value, onChange: (event) => setValue(event.target.value), placeholder: selectionLabel ? 'Describe a visual change…' : 'Run a quick local command…', "aria-label": "Describe the change", disabled: busy }), _jsx("button", { type: "submit", className: "is-send", disabled: !value.trim() || busy, "aria-label": "Preview change", children: _jsx(ArrowUp, { size: 16 }) })] }), _jsx("div", { className: "froam-quick-chat__suggestions", "aria-label": "One-tap commands", children: suggestions.map((suggestion) => _jsx("button", { type: "button", disabled: busy, onClick: () => submitIntent(suggestion), children: suggestion }, suggestion)) }), _jsx("small", { children: busy ? 'Preparing a safe preview…' : 'Fast local edits first. Nothing is uploaded, and you review every change before keeping it.' })] });
}
//# sourceMappingURL=FroamQuickChat.js.map