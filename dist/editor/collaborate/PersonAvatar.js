import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function initialsOf(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
/**
 * A person's face: their studio-profile photo when they set one, their
 * initials in their colour when they didn't (or the photo fails to load).
 */
export function PersonAvatar({ name, color, avatarUrl, size = 22, here, ring = false, }) {
    const [broken, setBroken] = useState(false);
    const showPhoto = Boolean(avatarUrl) && !broken;
    return (_jsxs("span", { className: `froam-avatar${ring ? ' has-ring' : ''}${here === false ? ' is-away' : ''}`, style: { width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.38)), ['--froam-avatar-color']: color ?? '#64748b' }, title: name, "aria-hidden": "true", children: [showPhoto ? _jsx("img", { src: avatarUrl, alt: "", onError: () => setBroken(true) }) : initialsOf(name), here !== undefined && _jsx("i", { className: `froam-avatar__dot${here ? ' is-here' : ''}` })] }));
}
//# sourceMappingURL=PersonAvatar.js.map