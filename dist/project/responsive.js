export function defaultResponsivePolicy(nodeId, actorId, now = Date.now()) {
    return { schemaVersion: 1, nodeId, priority: 'medium', canHide: false, canCollapse: true, canWrap: true, canTruncate: false, canCrop: false, canReposition: true, updatedAt: now, updatedBy: actorId };
}
export function responsiveSuggestions(records, policies, width) {
    const suggestions = [];
    for (const record of records) {
        const policy = policies[record.node.nodeId];
        if (!policy)
            continue;
        const rect = record.signals.find((signal) => signal.kind === 'layout')?.values.rect;
        if (policy.minimumUsefulWidth && width < policy.minimumUsefulWidth) {
            if (policy.canReposition)
                suggestions.push({ nodeId: policy.nodeId, action: 'reposition', reason: `${width}px is below its ${policy.minimumUsefulWidth}px useful width.` });
            else if (policy.canCollapse)
                suggestions.push({ nodeId: policy.nodeId, action: 'collapse', reason: 'The component cannot remain useful at this width.' });
        }
        if (policy.priority === 'decorative' && policy.canHide && width < 640)
            suggestions.push({ nodeId: policy.nodeId, action: 'hide', reason: 'Decorative content may yield space to higher-priority content.' });
        if (policy.priority === 'critical' && Number(rect?.width ?? width) < 44)
            suggestions.push({ nodeId: policy.nodeId, action: 'preserve', reason: 'Critical content should remain visible and usable.' });
    }
    return suggestions;
}
function overlaps(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
export function observeResponsiveState(root, registry, policies, width) {
    const entries = Object.values(registry).map((entry) => ({ entry, element: root.querySelector(`[data-froam-id="${CSS.escape(entry.nodeId)}"]`) })).filter((item) => Boolean(item.element));
    const visible = entries.filter(({ element }) => { const style = getComputedStyle(element); return style.display !== 'none' && style.visibility !== 'hidden'; });
    const collisions = [];
    for (let i = 0; i < visible.length; i += 1)
        for (let j = i + 1; j < visible.length; j += 1) {
            const a = visible[i].element.getBoundingClientRect();
            const b = visible[j].element.getBoundingClientRect();
            if (overlaps(a, b) && !visible[i].element.contains(visible[j].element) && !visible[j].element.contains(visible[i].element))
                collisions.push([visible[i].entry.nodeId, visible[j].entry.nodeId]);
        }
    const hiddenCritical = entries.filter(({ entry, element }) => policies[entry.nodeId]?.priority === 'critical' && !visible.some((item) => item.element === element)).map(({ entry }) => entry.nodeId);
    const clipped = visible.filter(({ element }) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2).map(({ entry }) => entry.nodeId);
    const touchTargets = visible.filter(({ element }) => { const rect = element.getBoundingClientRect(); return ['A', 'BUTTON', 'INPUT'].includes(element.tagName) && (rect.width < 24 || rect.height < 24); }).map(({ entry }) => entry.nodeId);
    const overflowX = root.scrollWidth > width + 2;
    const markers = [...(overflowX ? ['Horizontal overflow detected'] : []), ...(collisions.length ? [`${collisions.length} possible collisions`] : []), ...(hiddenCritical.length ? ['Critical element hidden'] : []), ...(clipped.length ? [`${clipped.length} clipped elements`] : [])];
    return { width, overflowX, hiddenCritical, collisions, clipped, touchTargets, markers };
}
export function cinemaWidths(min = 320, max = 2560, step = 16) { const widths = []; for (let value = min; value <= max; value += step)
    widths.push(value); if (widths.at(-1) !== max)
    widths.push(max); return widths; }
//# sourceMappingURL=responsive.js.map