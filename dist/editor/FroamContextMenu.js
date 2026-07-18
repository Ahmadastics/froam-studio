import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { ClipboardCopy, ClipboardPaste, Copy, Eraser, Eye, EyeOff, ArrowUpToLine, ArrowDownToLine, Trash2, Box, ImagePlus, } from 'lucide-react';
export default function FroamContextMenu({ position, elementLabel, isHidden, hasClipboard, hasMultiSelection, isGroup, onAction, onClose, }) {
    const menuRef = useRef(null);
    // Close on outside click / Escape
    useEffect(() => {
        if (!position)
            return;
        function handleClick(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        }
        function handleKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('mousedown', handleClick, true);
        window.addEventListener('touchstart', handleClick, { capture: true, passive: true });
        window.addEventListener('keydown', handleKey, true);
        return () => {
            window.removeEventListener('mousedown', handleClick, true);
            window.removeEventListener('touchstart', handleClick, true);
            window.removeEventListener('keydown', handleKey, true);
        };
    }, [position, onClose]);
    // Keep menu within viewport
    useEffect(() => {
        if (!menuRef.current || !position)
            return;
        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth - 8) {
            menu.style.left = `${position.x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight - 8) {
            menu.style.top = `${position.y - rect.height}px`;
        }
    }, [position]);
    if (!position)
        return null;
    function handleAction(action) {
        onAction(action);
        onClose();
    }
    return (_jsxs("div", { ref: menuRef, className: "froam-context-menu", "data-chef-editor-root": "true", style: {
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 1320,
        }, children: [elementLabel && (_jsx("div", { className: "froam-context-menu__header", children: _jsx("span", { className: "froam-context-menu__label", children: elementLabel }) })), _jsxs("div", { className: "froam-context-menu__group", children: [_jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('copy-styles'), children: [_jsx(ClipboardCopy, { size: 14 }), _jsx("span", { children: "Copy styles" }), _jsx("kbd", { children: "Ctrl+Alt+C" })] }), _jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('paste-styles'), disabled: !hasClipboard, children: [_jsx(ClipboardPaste, { size: 14 }), _jsx("span", { children: "Paste styles" }), _jsx("kbd", { children: "Ctrl+Alt+V" })] })] }), _jsx("div", { className: "froam-context-menu__divider" }), _jsxs("div", { className: "froam-context-menu__group", children: [hasMultiSelection ? (_jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('group-elements'), children: [_jsx(Box, { size: 14 }), _jsx("span", { children: "Group elements" }), _jsx("kbd", { children: "Ctrl+G" })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('duplicate'), children: [_jsx(Copy, { size: 14 }), _jsx("span", { children: "Duplicate" }), _jsx("kbd", { children: "Ctrl+D" })] }), _jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('wrap-container'), children: [_jsx(Box, { size: 14 }), _jsx("span", { children: "Wrap in container" })] })] })), isGroup && (_jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('ungroup-elements'), children: [_jsx(Box, { size: 14 }), _jsx("span", { children: "Ungroup elements" }), _jsx("kbd", { children: "Ctrl+Shift+G" })] })), _jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('upload-image'), children: [_jsx(ImagePlus, { size: 14 }), _jsx("span", { children: "Upload image" })] })] }), _jsx("div", { className: "froam-context-menu__divider" }), _jsxs("div", { className: "froam-context-menu__group", children: [_jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('bring-to-front'), children: [_jsx(ArrowUpToLine, { size: 14 }), _jsx("span", { children: "Bring to front" })] }), _jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('send-to-back'), children: [_jsx(ArrowDownToLine, { size: 14 }), _jsx("span", { children: "Send to back" })] }), _jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('toggle-visibility'), children: [isHidden ? _jsx(Eye, { size: 14 }) : _jsx(EyeOff, { size: 14 }), _jsx("span", { children: isHidden ? 'Show' : 'Hide' })] })] }), _jsx("div", { className: "froam-context-menu__divider" }), _jsxs("div", { className: "froam-context-menu__group", children: [_jsxs("button", { type: "button", className: "froam-context-menu__item", onClick: () => handleAction('clear'), children: [_jsx(Eraser, { size: 14 }), _jsx("span", { children: "Clear styles" }), _jsx("kbd", { children: "Delete" })] }), _jsxs("button", { type: "button", className: "froam-context-menu__item froam-context-menu__item--danger", onClick: () => handleAction('delete-element'), children: [_jsx(Trash2, { size: 14 }), _jsx("span", { children: "Remove element" })] })] })] }));
}
//# sourceMappingURL=FroamContextMenu.js.map