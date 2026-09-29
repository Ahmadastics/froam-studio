import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { describeSelection } from './selection-name.js';
const selectedSuggestions = ['Make it bolder', 'Center the content', 'Add more space', 'Make it rounder'];
const pageSuggestions = ['Add a hero section', 'Add a rectangle', 'Open Layers', 'Make the page dark'];
const aiSuggestions = ['Make it feel more premium', 'Tighten the spacing', 'Make it easier to read', 'Give it more contrast'];
export default function FroamQuickChat({ open, selectionLabel, busy, onSubmit, onClose, ai = null }) {
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
    const targetLabel = selectionLabel ? describeSelection(selectionLabel).kind.toLowerCase() : 'this page';
    const aiOn = Boolean(ai?.available && ai.on);
    const suggestions = aiOn && selectionLabel ? aiSuggestions : selectionLabel ? selectedSuggestions : pageSuggestions;
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
    return _jsxs("section", { className: "froam-quick-chat", "data-chef-editor-root": "true", role: "dialog", "aria-label": `Quick Edit ${targetLabel}`, onKeyDown: (event) => { if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
        } }, children: [_jsxs("header", { children: [_jsxs("span", { children: [_jsx(Sparkles, { size: 15 }), _jsx("b", { children: "Quick Edit" }), _jsx("em", { children: selectionLabel ? `the selected ${targetLabel}` : targetLabel })] }), ai?.available && (_jsxs("label", { className: `froam-quick-chat__ai${aiOn ? ' is-on' : ''}`, title: aiOn ? `Anything you ask goes to ${ai.model ?? 'your AI'}` : 'Let AI handle requests that aren’t simple edits', children: [_jsx("span", { children: "AI" }), _jsx("input", { type: "checkbox", role: "switch", checked: aiOn, onChange: ai.onToggle, "aria-label": "Use AI for Quick Edit" })] })), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close Quick Edit", title: "Close (Esc)", children: _jsx(X, { size: 15 }) })] }), _jsxs("form", { onSubmit: send, children: [_jsx("input", { ref: inputRef, value: value, onChange: (event) => setValue(event.target.value), placeholder: aiOn ? 'Say what you want — “make it feel more premium”…' : selectionLabel ? 'Say what to change — “make it bolder”…' : 'Say what to do — “add a hero section”…', "aria-label": "Describe the change", disabled: busy }), _jsx("button", { type: "submit", className: "is-send", disabled: !value.trim() || busy, "aria-label": "Preview change", title: "Preview (Enter)", children: _jsx(ArrowUp, { size: 16 }) })] }), _jsx("div", { className: "froam-quick-chat__suggestions", "aria-label": "One-tap commands", children: suggestions.map((suggestion) => _jsx("button", { type: "button", disabled: busy, onClick: () => submitIntent(suggestion), children: suggestion }, suggestion)) }), _jsx("small", { children: busy
                    ? 'Preparing a preview…'
                    : aiOn
                        ? `Simple edits run on this device; anything else goes to ${ai?.model ?? 'your AI'}. You see a preview before anything changes.`
                        : ai && !ai.available
                            ? 'Simple edits run on this device. For anything else, set up AI for froam dev — the README shows how.'
                            : 'Simple edits run on this device — nothing is uploaded. You see a preview before anything changes.' })] });
}
//# sourceMappingURL=FroamQuickChat.js.map