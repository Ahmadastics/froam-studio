import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
function findByPath(root, path) {
    const segments = path.split('/').filter(Boolean);
    let current = root;
    for (const segment of segments) {
        const [tag, rawIndex] = segment.split(':');
        const index = Number(rawIndex) - 1;
        if (!tag || !Number.isInteger(index) || index < 0)
            return null;
        current = Array.from(current.children).filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === tag)[index] ?? null;
        if (!current)
            return null;
    }
    return current;
}
function findMemberElement(root, nodeId, path) {
    if (nodeId) {
        const byId = root.querySelector(`[data-froam-id="${CSS.escape(nodeId)}"]`);
        if (byId)
            return byId;
    }
    return path ? findByPath(root, path) : null;
}
function MemberLabel({ member }) {
    return _jsxs(_Fragment, { children: [member.avatarUrl && _jsx("img", { className: "froam-presence__avatar", src: member.avatarUrl, alt: "" }), member.name] });
}
/** Ephemeral multiplayer chrome. Nothing rendered here is persisted. */
export default function FroamPresenceLayer({ members, routeKey, viewport, root }) {
    const [, redraw] = useState(0);
    const visible = useMemo(() => members.filter((member) => member.here && member.routeKey === routeKey && member.viewport === viewport), [members, routeKey, viewport]);
    useEffect(() => {
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => redraw((value) => value + 1));
        };
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        const timer = window.setInterval(update, 1_000);
        return () => {
            cancelAnimationFrame(frame);
            window.clearInterval(timer);
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, []);
    useEffect(() => {
        if (!root)
            return;
        const marked = [];
        for (const member of visible) {
            if (!member.lockedPath && !member.lockedNodeId)
                continue;
            const element = findMemberElement(root, member.lockedNodeId, member.lockedPath);
            if (!element)
                continue;
            element.dataset.froamLockedBy = member.name;
            element.style.setProperty('--froam-lock-color', member.color);
            marked.push(element);
        }
        return () => {
            for (const element of marked) {
                delete element.dataset.froamLockedBy;
                element.style.removeProperty('--froam-lock-color');
            }
        };
    }, [root, visible]);
    return (_jsx("div", { className: "froam-presence", "data-chef-editor-root": "true", "aria-hidden": "true", children: visible.map((member) => {
            const selected = root ? findMemberElement(root, member.selectedNodeId, member.selectedPath) : null;
            const rect = selected?.getBoundingClientRect();
            return (_jsxs("div", { children: [rect && (_jsx("div", { className: `froam-presence__selection${(member.lockedNodeId && member.lockedNodeId === member.selectedNodeId) || member.lockedPath === member.selectedPath ? ' is-locked' : ''}`, style: {
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            borderColor: member.color,
                        }, children: _jsx("span", { style: { background: member.color }, children: _jsx(MemberLabel, { member: member }) }) })), member.cursor && (_jsxs("div", { className: "froam-presence__cursor", style: { left: member.cursor.x, top: member.cursor.y, color: member.color }, children: [_jsx("svg", { width: "18", height: "23", viewBox: "0 0 18 23", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M2 2 16 12h-6l-3 8-2.6-1L7 11H2V2Z", fill: "currentColor", stroke: "#111827", strokeWidth: "1.2" }) }), _jsx("span", { style: { background: member.color }, children: _jsx(MemberLabel, { member: member }) })] }))] }, member.actor));
        }) }));
}
//# sourceMappingURL=FroamPresenceLayer.js.map