import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { LINK_KINDS, readLink, writeLink } from './chef/links.js';
/**
 * Where a link goes, in the words a person would use: a website, a WhatsApp
 * chat, a call, an email or another page. Saving writes the address on the
 * selected link as an ordinary edit, so Undo, Save and sharing all cover it.
 */
export default function FroamLinkEditor({ href, changed, destinations, onSave, onReset }) {
    const current = readLink(href);
    const [kind, setKind] = useState(current.kind);
    const [value, setValue] = useState(current.value);
    const [problem, setProblem] = useState('');
    const inputRef = useRef(null);
    const fieldId = useId();
    const spec = LINK_KINDS.find((entry) => entry.id === kind) ?? LINK_KINDS[0];
    useEffect(() => {
        const next = readLink(href);
        setKind(next.kind);
        setValue(next.value);
        setProblem('');
    }, [href]);
    useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, [kind]);
    const pick = (next) => {
        setKind(next);
        setProblem('');
        // The same number serves WhatsApp and calls; anything else starts empty.
        const keep = (kind === 'whatsapp' || kind === 'call') && (next === 'whatsapp' || next === 'call');
        setValue(next === current.kind ? current.value : keep ? value : '');
    };
    const save = (event) => {
        event?.preventDefault();
        const result = writeLink(kind, value, kind === 'whatsapp' ? current.message : undefined);
        if ('problem' in result) {
            setProblem(result.problem);
            return;
        }
        setProblem('');
        onSave(result.href);
    };
    const test = writeLink(kind, value, kind === 'whatsapp' ? current.message : undefined);
    const testHref = 'href' in test && !test.href.startsWith('#') ? test.href : null;
    return (_jsxs("form", { className: "froam-link-editor", onSubmit: save, "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-floating-bar__pop-head", children: [_jsx("span", { children: "Link goes to" }), changed && (_jsxs("button", { type: "button", className: "froam-link-editor__reset", onClick: onReset, title: "Put back the address the page had", children: [_jsx(RotateCcw, { size: 12 }), " Original"] }))] }), _jsx("div", { className: "froam-link-editor__kinds", role: "radiogroup", "aria-label": "Kind of link", children: LINK_KINDS.map((entry) => (_jsx("button", { type: "button", role: "radio", "aria-checked": kind === entry.id, className: kind === entry.id ? 'is-active' : '', onClick: () => pick(entry.id), children: entry.label }, entry.id))) }), _jsx("label", { className: "froam-link-editor__field", htmlFor: fieldId, children: _jsx("input", { ref: inputRef, id: fieldId, type: kind === 'email' ? 'email' : kind === 'whatsapp' || kind === 'call' ? 'tel' : 'text', inputMode: kind === 'whatsapp' || kind === 'call' ? 'tel' : kind === 'web' ? 'url' : undefined, value: value, placeholder: spec.placeholder, spellCheck: false, autoComplete: "off", "aria-invalid": problem ? true : undefined, "aria-describedby": `${fieldId}-note`, onChange: (event) => { setValue(event.target.value); setProblem(''); }, onKeyDown: (event) => event.stopPropagation() }) }), kind === 'page' && destinations.length > 0 && (_jsx("div", { className: "froam-link-editor__places", "aria-label": "Places on this site", children: destinations.map((place) => (_jsx("button", { type: "button", className: value === place.href ? 'is-active' : '', title: place.href, onClick: () => { setValue(place.href); setProblem(''); }, children: place.label }, place.href))) })), _jsx("p", { id: `${fieldId}-note`, className: `froam-link-editor__note${problem ? ' is-problem' : ''}`, role: problem ? 'alert' : undefined, children: problem || spec.hint }), _jsxs("div", { className: "froam-link-editor__actions", children: [testHref ? (_jsxs("a", { className: "froam-link-editor__test", href: testHref, target: "_blank", rel: "noopener noreferrer", title: "Try the link in a new tab", children: ["Try it ", _jsx(ExternalLink, { size: 11 })] })) : _jsx("span", {}), _jsx("button", { type: "submit", className: "froam-link-editor__save", children: "Save link" })] })] }));
}
//# sourceMappingURL=FroamLinkEditor.js.map