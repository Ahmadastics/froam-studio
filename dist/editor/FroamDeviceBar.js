import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Smartphone, Tablet } from 'lucide-react';
import { DEVICE_SIZES } from './chef/device-sizes.js';
/**
 * Under the phone or tablet: which screen it is, how big, how far it's scaled
 * to fit — and a menu of the other screens that preview the same edits.
 */
export default function FroamDeviceBar({ frame, onPick, onDesktop }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const close = (event) => { if (!ref.current?.contains(event.target))
            setOpen(false); };
        const esc = (event) => { if (event.key === 'Escape') {
            event.stopPropagation();
            setOpen(false);
        } };
        document.addEventListener('pointerdown', close, true);
        window.addEventListener('keydown', esc, true);
        return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true); };
    }, [open]);
    const Icon = frame.kind === 'mobile' ? Smartphone : Tablet;
    const sizes = DEVICE_SIZES[frame.kind];
    return (_jsxs("div", { ref: ref, className: "froam-device-bar", style: { left: frame.left + frame.width / 2, top: frame.top + frame.height + 18 }, "data-chef-editor-root": "true", children: [_jsxs("button", { type: "button", className: "froam-device-bar__pick", onClick: () => setOpen((v) => !v), "aria-haspopup": "menu", "aria-expanded": open, title: "Preview another screen size", children: [_jsx(Icon, { size: 14 }), _jsx("span", { children: frame.size.label }), _jsxs("em", { children: [frame.size.width, " \u00D7 ", frame.size.height] }), _jsx(ChevronDown, { size: 12 })] }), _jsxs("span", { className: "froam-device-bar__scale", title: "Scaled to fit \u2014 the page is laid out at full size", children: [Math.round(frame.scale * 100), "%"] }), open && (_jsxs("div", { className: "froam-device-bar__menu", role: "menu", "aria-label": "Screen size", children: [sizes.map((size) => (_jsxs("button", { type: "button", role: "menuitemradio", "aria-checked": size.id === frame.size.id, onClick: () => { onPick(size.id); setOpen(false); }, children: [_jsx("span", { className: "froam-device-bar__tick", children: size.id === frame.size.id && _jsx(Check, { size: 13 }) }), _jsx("span", { children: size.label }), _jsxs("em", { children: [size.width, " \u00D7 ", size.height] })] }, size.id))), _jsxs("div", { className: "froam-device-bar__note", children: ["Edits here apply to every ", frame.kind === 'mobile' ? 'phone (up to 640px wide)' : 'tablet (641–1024px wide)', "."] }), _jsxs("button", { type: "button", onClick: () => { onDesktop(); setOpen(false); }, children: [_jsx("span", { className: "froam-device-bar__tick" }), _jsx("span", { children: "Back to desktop" })] })] }))] }));
}
//# sourceMappingURL=FroamDeviceBar.js.map