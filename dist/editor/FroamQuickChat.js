import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
const suggestions = ['Make it bolder', 'Add more space', 'Make it rounder'];
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
    const send = (event) => {
        event?.preventDefault();
        const intent = value.trim();
        if (!intent || busy)
            return;
        onSubmit(intent);
    };
    return _jsxs("section", { className: "froam-quick-chat", "data-chef-editor-root": "true", role: "dialog", "aria-label": `Edit ${selectionLabel} with Froam`, children: [_jsxs("header", { children: [_jsxs("span", { children: [_jsx(Sparkles, { size: 14 }), _jsxs("b", { children: ["Edit ", selectionLabel] })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close quick edit", children: _jsx(X, { size: 14 }) })] }), _jsxs("form", { onSubmit: send, children: [_jsx("input", { ref: inputRef, value: value, onChange: (event) => setValue(event.target.value), placeholder: "What should change?", "aria-label": "Describe the change", disabled: busy }), _jsx("button", { type: "submit", className: "is-send", disabled: !value.trim() || busy, "aria-label": "Preview change", children: _jsx(ArrowUp, { size: 16 }) })] }), _jsx("div", { className: "froam-quick-chat__suggestions", "aria-label": "Quick commands", children: suggestions.map((suggestion) => _jsx("button", { type: "button", onClick: () => { setValue(suggestion); inputRef.current?.focus(); }, children: suggestion }, suggestion)) }), _jsx("small", { children: busy ? 'Preparing a safe preview…' : 'Common edits run instantly on this device. Nothing changes until you Keep it.' })] });
}
//# sourceMappingURL=FroamQuickChat.js.map