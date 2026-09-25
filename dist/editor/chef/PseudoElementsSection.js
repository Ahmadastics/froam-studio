import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { X } from 'lucide-react';
import { rgbToHex } from './dom.js';
import { decodePseudoContent, encodePseudoContent, PSEUDO_ELEMENTS, pseudoStyles } from './pseudo.js';
const LABEL = { before: 'Before', after: 'After' };
/**
 * ::before / ::after of the selection: what the page already draws there, and
 * fields to change it — or to add one to an element that has none.
 */
export function PseudoElementsSection({ element, styles, onChange }) {
    if (!element)
        return null;
    return (_jsx("div", { className: "froam-dp__stack", children: PSEUDO_ELEMENTS.map((pseudo) => {
            const edited = pseudoStyles(styles, pseudo);
            const computed = window.getComputedStyle(element, `::${pseudo}`);
            const effective = edited.content ?? computed.content;
            const exists = !['none', 'normal', ''].includes(effective);
            const color = rgbToHex(edited.color ?? computed.color);
            const background = rgbToHex(edited.backgroundColor ?? computed.backgroundColor);
            const fontSize = Number.parseFloat(edited.fontSize ?? computed.fontSize) || 16;
            return (_jsxs("div", { className: "froam-dp__stack", children: [_jsxs("label", { className: "froam-dp__compact-field", children: [_jsxs("span", { className: "froam-dp__compact-label", children: [LABEL[pseudo], " ::", pseudo] }), _jsx("input", { type: "text", className: "froam-dp__compact-input froam-dp__full-width", "aria-label": `::${pseudo} content`, placeholder: exists ? '' : 'Type to add one', value: decodePseudoContent(effective), onChange: (event) => onChange(pseudo, { content: encodePseudoContent(event.target.value) }, `${LABEL[pseudo]}: content`), "data-chef-editor-root": "true" })] }), exists && (_jsxs("div", { className: "froam-dp__fill-row", children: [_jsx("div", { className: "froam-dp__color-swatch-wrap", title: `::${pseudo} color`, children: _jsx("input", { type: "color", className: "froam-dp__color-swatch", "aria-label": `::${pseudo} color`, value: color, onChange: (event) => onChange(pseudo, { color: event.target.value }, `${LABEL[pseudo]}: color`), "data-chef-editor-root": "true" }) }), _jsx("div", { className: "froam-dp__color-swatch-wrap", title: `::${pseudo} background`, children: _jsx("input", { type: "color", className: "froam-dp__color-swatch", "aria-label": `::${pseudo} background`, value: background, onChange: (event) => onChange(pseudo, { backgroundColor: event.target.value }, `${LABEL[pseudo]}: background`), "data-chef-editor-root": "true" }) }), _jsx("input", { type: "number", min: 4, max: 400, className: "froam-dp__compact-input", "aria-label": `::${pseudo} size`, title: "Size (px)", value: Math.round(fontSize), onChange: (event) => onChange(pseudo, { fontSize: `${event.target.value}px` }, `${LABEL[pseudo]}: size`), "data-chef-editor-root": "true" }), _jsx("button", { type: "button", className: "froam-dp__mini-btn", "aria-label": `Remove ::${pseudo}`, title: `Remove ::${pseudo}`, onClick: () => onChange(pseudo, { content: 'none', color: '', backgroundColor: '', fontSize: '' }, `${LABEL[pseudo]}: removed`), "data-chef-editor-root": "true", children: _jsx(X, { size: 10 }) })] }))] }, pseudo));
        }) }));
}
//# sourceMappingURL=PseudoElementsSection.js.map