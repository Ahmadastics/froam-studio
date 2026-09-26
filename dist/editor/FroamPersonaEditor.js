import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCcw, Sparkles, X } from 'lucide-react';
import { PersonAvatar } from './collaborate/PersonAvatar.js';
const ACCENT_PRESETS = [
    '#5eead4', '#ff6c4f', '#a78bfa', '#34d399', '#f59e0b',
    '#60a5fa', '#f472b6', '#e2e8f0',
];
const ROLE_WORD = {
    owner: 'Owner',
    editor: 'Editing',
    contributor: 'Suggesting',
};
/**
 * Your studio profile — and, in a shared room, who you are to everyone else:
 * the face on your cursor, your messages, and every change you send for
 * approval. The previews show exactly that, as you type.
 */
export default function FroamPersonaEditor({ open, persona, inRoom = false, roomRole = null, onChange, onClose, onSave, onImageUpload, onImageFile, onClearImage, }) {
    const fileRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    if (!open)
        return null;
    const name = persona.name || 'Your name';
    const what = persona.role || ROLE_WORD[roomRole ?? 'contributor'] || 'Designer';
    return (_jsx("div", { className: "froam-persona-modal", "data-chef-editor-root": "true", onClick: (event) => {
            if (event.target === event.currentTarget)
                onClose();
        }, onKeyDown: (event) => {
            // Typing a name is words, never editor shortcuts.
            event.stopPropagation();
            if (event.key === 'Escape')
                onClose();
        }, children: _jsxs("div", { className: "froam-persona-modal__card", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-persona-modal__header", "data-chef-editor-root": "true", children: [_jsxs("div", { children: [_jsx("p", { className: "froam-persona-modal__eyebrow", children: "Your profile" }), _jsx("h3", { children: "How people see you" })] }), _jsx("button", { type: "button", className: "froam-tb__icon-btn", onClick: onClose, "aria-label": "Close profile", "data-chef-editor-root": "true", children: _jsx(X, { size: 15 }) })] }), _jsxs("div", { className: "froam-persona-modal__avatar-row", children: [_jsxs("button", { type: "button", className: `froam-persona-modal__photo${dragging ? ' is-dragging' : ''}`, onClick: () => fileRef.current?.click(), onDragOver: (event) => { event.preventDefault(); setDragging(true); }, onDragLeave: () => setDragging(false), onDrop: (event) => {
                                event.preventDefault();
                                setDragging(false);
                                const file = event.dataTransfer.files?.[0];
                                if (file)
                                    onImageFile?.(file);
                            }, "aria-label": persona.imageUrl ? 'Change your photo' : 'Add a photo', children: [_jsx(PersonAvatar, { name: name, color: persona.accentColor, avatarUrl: persona.imageUrl, size: 64, ring: true }), _jsx("span", { className: "froam-collab__photo-badge", children: _jsx(Camera, { size: 11 }) })] }), _jsxs("div", { className: "froam-persona-modal__actions", children: [_jsxs("label", { className: "fs-pill is-accent", children: [_jsx(ImagePlus, { size: 12 }), _jsx("span", { children: persona.imageUrl ? 'Change photo' : 'Add a photo' }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", onChange: onImageUpload, hidden: true })] }), persona.imageUrl && (_jsxs("button", { type: "button", className: "fs-pill", onClick: onClearImage, children: [_jsx(RotateCcw, { size: 12 }), _jsx("span", { children: "Remove" })] })), _jsx("p", { children: "Any photo works \u2014 it\u2019s cropped to a small square. You can drop one on the circle." })] })] }), _jsxs("div", { className: "froam-persona-modal__fields", "data-chef-editor-root": "true", children: [_jsxs("label", { className: "froam-persona-modal__field", children: [_jsx("span", { children: "Name" }), _jsx("input", { type: "text", className: "fs-input", value: persona.name, maxLength: 32, autoFocus: true, placeholder: "What should people call you?", onChange: (event) => onChange({ ...persona, name: event.target.value }) })] }), _jsxs("label", { className: "froam-persona-modal__field", children: [_jsx("span", { children: "What you do" }), _jsx("input", { type: "text", className: "fs-input", value: persona.role, maxLength: 32, placeholder: "Designer, Marketing, Founder\u2026", onChange: (event) => onChange({ ...persona, role: event.target.value }) })] }), _jsxs("div", { className: "froam-persona-modal__field", children: [_jsx("span", { children: "Your colour \u2014 your cursor and highlights" }), _jsxs("div", { className: "froam-persona-modal__accent-row", children: [ACCENT_PRESETS.map((color) => (_jsx("button", { type: "button", className: `froam-persona-modal__accent-swatch ${persona.accentColor === color ? 'is-selected' : ''}`, style: { background: color }, onClick: () => onChange({ ...persona, accentColor: color }), "aria-label": `Set colour to ${color}` }, color))), _jsx("input", { type: "color", className: "froam-persona-modal__accent-custom", value: persona.accentColor, onChange: (event) => onChange({ ...persona, accentColor: event.target.value }), title: "Custom colour" })] })] }), _jsxs("label", { className: "froam-persona-modal__field", children: [_jsx("span", { children: "Studio tagline" }), _jsx("input", { type: "text", className: "fs-input", value: persona.tagline, maxLength: 72, onChange: (event) => onChange({ ...persona, tagline: event.target.value }) })] })] }), _jsxs("div", { className: "froam-persona-modal__room-preview", "aria-hidden": "true", children: [_jsx("small", { children: inRoom ? 'What people in this room see' : 'What people see when you share' }), _jsxs("div", { className: "froam-persona-modal__room-card", children: [_jsxs("div", { className: "froam-persona-modal__room-row", children: [_jsxs("div", { className: "froam-collab__who", children: [_jsx(PersonAvatar, { name: name, color: persona.accentColor, avatarUrl: persona.imageUrl, size: 28, here: true }), _jsxs("span", { children: [_jsx("strong", { children: name }), _jsxs("small", { children: [what, " \u00B7 just now"] })] })] }), _jsx("span", { className: "froam-collab__status", children: "Waiting for approval" })] }), _jsx("strong", { children: "New hero headline" })] }), _jsxs("div", { className: "froam-persona-modal__room-chat", children: [_jsx(PersonAvatar, { name: name, color: persona.accentColor, avatarUrl: persona.imageUrl, size: 24 }), _jsxs("div", { className: "froam-chat__stack", children: [_jsxs("div", { className: "froam-chat__meta", children: [_jsx("span", { className: "froam-chat__name", style: { color: persona.accentColor }, children: name }), _jsx("span", { className: "froam-chat__title", children: what })] }), _jsx("div", { className: "froam-chat__bubble", children: "Take a look at the new headline?" })] })] })] }), _jsxs("div", { className: "froam-persona-modal__toolbar-preview", "data-chef-editor-root": "true", style: { '--froam-accent': persona.accentColor }, children: [_jsxs("div", { className: "froam-persona-modal__toolbar-brand", children: [_jsx("span", { className: "froam-persona-modal__toolbar-avatar", children: _jsx(PersonAvatar, { name: name, color: persona.accentColor, avatarUrl: persona.imageUrl, size: 22 }) }), _jsx("span", { className: "froam-persona-modal__toolbar-name", style: { color: persona.accentColor }, children: persona.name || 'Froam' }), _jsx("span", { className: "froam-persona-modal__toolbar-role", children: what })] }), _jsx("span", { className: "froam-persona-modal__toolbar-tagline", children: persona.tagline || 'Shape what comes next' }), _jsx(Sparkles, { size: 13, style: { color: persona.accentColor, opacity: 0.7 } })] }), _jsxs("div", { className: "froam-persona-modal__footer", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: onClose, children: "Cancel" }), _jsx("button", { type: "button", className: "fs-pill is-accent", onClick: onSave, children: inRoom ? 'Save — update the room' : 'Save profile' })] })] }) }));
}
//# sourceMappingURL=FroamPersonaEditor.js.map