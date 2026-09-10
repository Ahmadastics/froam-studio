export const SECTION_STRUCTURE_KEY = '__froam_structure__:sections';
export function readSectionStructureDraft(draft) {
    if (!draft?.text)
        return { version: 1, sections: [] };
    try {
        const parsed = JSON.parse(draft.text);
        if (parsed.version !== 1 || !Array.isArray(parsed.sections))
            return { version: 1, sections: [] };
        return {
            version: 1,
            sections: parsed.sections.filter((entry) => Boolean(entry
                && typeof entry.nodeId === 'string'
                && typeof entry.sourcePath === 'string'
                && typeof entry.parentPath === 'string'
                && typeof entry.order === 'number')),
        };
    }
    catch {
        return { version: 1, sections: [] };
    }
}
export function writeSectionStructureDraft(manifest) {
    return { text: JSON.stringify(manifest) };
}
export function assignFreshFroamNodeIds(element, idFactory = (index) => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${index.toString(36)}`) {
    const nodes = [element, ...Array.from(element.querySelectorAll('*'))];
    const htmlIds = new Map();
    const cloneToken = idFactory(nodes.length);
    nodes.forEach((node, index) => {
        if (node === element || node.hasAttribute('data-froam-id'))
            node.dataset.froamId = idFactory(index);
        const htmlId = node.id;
        if (htmlId) {
            const nextId = `${htmlId}-froam-${cloneToken}-${index.toString(36)}`;
            htmlIds.set(htmlId, nextId);
            node.id = nextId;
        }
        if (node.hasAttribute('data-froam-section-id'))
            node.dataset.froamSectionId = `${cloneToken}-section-${index.toString(36)}`;
    });
    const tokenListAttributes = ['aria-controls', 'aria-describedby', 'aria-labelledby', 'aria-owns', 'aria-activedescendant'];
    nodes.forEach((node) => {
        const htmlFor = node.getAttribute('for');
        if (htmlFor && htmlIds.has(htmlFor))
            node.setAttribute('for', htmlIds.get(htmlFor));
        tokenListAttributes.forEach((attribute) => {
            const value = node.getAttribute(attribute);
            if (value)
                node.setAttribute(attribute, value.split(/\s+/).map((id) => htmlIds.get(id) ?? id).join(' '));
        });
        for (const attribute of ['href', 'xlink:href']) {
            const value = node.getAttribute(attribute);
            if (value?.startsWith('#') && htmlIds.has(value.slice(1)))
                node.setAttribute(attribute, `#${htmlIds.get(value.slice(1))}`);
        }
    });
}
//# sourceMappingURL=section-structure.js.map