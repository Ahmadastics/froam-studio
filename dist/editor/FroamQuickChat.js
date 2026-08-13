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
    const send = (event) => {
        event?.preventDefault();
        const intent = value.trim();
        if (!intent || busy)
            return;
        onSubmit(intent);
    };
    return _jsxs("section", { className: "froam-quick-chat", "data-chef-editor-root": "true", role: "dialog", "aria-label": `Edit ${targetLabel} with Froam`, children: [_jsxs("header", { children: [_jsxs("span", { children: [_jsx(Sparkles, { size: 14 }), _jsxs("b", { children: ["Ask Froam \u00B7 ", targetLabel] })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close Ask Froam", children: _jsx(X, { size: 14 }) })] }), _jsxs("form", { onSubmit: send, children: [_jsx("input", { ref: inputRef, value: value, onChange: (event) => setValue(event.target.value), placeholder: selectionLabel ? 'Describe the change…' : 'What should Froam change or add?', "aria-label": "Describe the change", disabled: busy }), _jsx("button", { type: "submit", className: "is-send", disabled: !value.trim() || busy, "aria-label": "Preview change", children: _jsx(ArrowUp, { size: 16 }) })] }), _jsx("div", { className: "froam-quick-chat__suggestions", "aria-label": "Quick commands", children: suggestions.map((suggestion) => _jsx("button", { type: "button", onClick: () => { setValue(suggestion); inputRef.current?.focus(); }, children: suggestion }, suggestion)) }), _jsx("small", { children: busy ? 'Understanding your request…' : 'Common edits run locally; configured intelligence handles more complex requests. You review changes before keeping them.' })] });
}
//# sourceMappingURL=FroamQuickChat.js.map