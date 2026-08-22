const now = () => Date.now();
export function emptyDesignSystem() {
    const createdAt = now();
    const modes = [
        { id: 'mode:base', name: 'Base', kind: 'base', createdAt },
        { id: 'mode:light', name: 'Light', kind: 'light', parentId: 'mode:base', createdAt },
        { id: 'mode:dark', name: 'Dark', kind: 'dark', parentId: 'mode:base', createdAt },
        { id: 'mode:mobile', name: 'Mobile', kind: 'mobile', parentId: 'mode:base', viewport: 'mobile', createdAt },
        { id: 'mode:brand', name: 'Brand', kind: 'brand', parentId: 'mode:light', brand: 'Primary', createdAt },
    ];
    return {
        schemaVersion: 1,
        activeModeIds: ['mode:light'],
        modes: Object.fromEntries(modes.map((mode) => [mode.id, mode])),
        variables: {}, styles: {}, componentFamilies: {}, siteKits: {}, libraries: {},
    };
}
export function normalizeDesignSystem(value) {
    // Treat the starter system as the additive migration baseline so projects
    // created before design systems existed receive the same useful defaults as
    // new projects without replacing anything they already own.
    const base = seedStarterDesignSystem(emptyDesignSystem());
    return {
        schemaVersion: 1,
        activeModeIds: value?.activeModeIds?.filter((id) => Boolean(value.modes?.[id] ?? base.modes[id])) ?? base.activeModeIds,
        modes: { ...base.modes, ...(value?.modes ?? {}) },
        variables: { ...base.variables, ...(value?.variables ?? {}) },
        styles: { ...base.styles, ...(value?.styles ?? {}) },
        componentFamilies: { ...base.componentFamilies, ...(value?.componentFamilies ?? {}) },
        siteKits: { ...base.siteKits, ...(value?.siteKits ?? {}) },
        libraries: { ...base.libraries, ...(value?.libraries ?? {}) },
    };
}
function modeChain(system, modeId) {
    const result = [];
    const seen = new Set();
    let cursor = modeId;
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        result.push(cursor);
        cursor = system.modes[cursor]?.parentId;
    }
    if (!result.includes('mode:base'))
        result.push('mode:base');
    return result;
}
export function resolveDesignVariable(system, variableId, modeIds = system.activeModeIds, seen = new Set()) {
    if (seen.has(variableId))
        return undefined;
    const variable = system.variables[variableId];
    if (!variable)
        return undefined;
    seen.add(variableId);
    if (variable.aliasTo)
        return resolveDesignVariable(system, variable.aliasTo, modeIds, seen);
    for (const modeId of modeIds)
        for (const candidate of modeChain(system, modeId)) {
            if (variable.values[candidate] !== undefined)
                return variable.values[candidate];
        }
    return variable.values['mode:base'] ?? Object.values(variable.values)[0];
}
export function upsertDesignVariable(system, variable) {
    return { ...system, variables: { ...system.variables, [variable.id]: variable } };
}
export function setActiveModes(system, modeIds) {
    const valid = [...new Set(modeIds)].filter((id) => Boolean(system.modes[id]));
    return { ...system, activeModeIds: valid.length ? valid : ['mode:base'] };
}
export function designVariableCss(system, modeIds = system.activeModeIds) {
    return Object.values(system.variables).map((variable) => {
        const value = resolveDesignVariable(system, variable.id, modeIds);
        return value === undefined ? '' : `${variable.cssName.startsWith('--') ? variable.cssName : `--${variable.cssName}`}: ${value};`;
    }).filter(Boolean).join('\n');
}
export function createReusableStyle(input) {
    const createdAt = input.now ?? now();
    return { id: input.id, name: input.name.trim() || 'Untitled style', category: input.category ?? 'Look Studio', states: input.states, usageNodeIds: [], createdAt, updatedAt: createdAt, version: 1 };
}
export function saveReusableStyle(system, style) {
    const previous = system.styles[style.id];
    const next = previous ? { ...style, createdAt: previous.createdAt, updatedAt: now(), version: previous.version + 1, usageNodeIds: [...new Set([...previous.usageNodeIds, ...style.usageNodeIds])] } : style;
    return { ...system, styles: { ...system.styles, [next.id]: next } };
}
export function recordStyleUse(system, styleId, nodeId) {
    const style = system.styles[styleId];
    if (!style)
        return system;
    return { ...system, styles: { ...system.styles, [styleId]: { ...style, usageNodeIds: [...new Set([...style.usageNodeIds, nodeId])] } } };
}
export function upsertComponentFamily(system, family) {
    const previous = system.componentFamilies[family.id];
    const next = previous ? { ...family, createdAt: previous.createdAt, updatedAt: now(), version: previous.version + 1 } : family;
    return { ...system, componentFamilies: { ...system.componentFamilies, [next.id]: next } };
}
export function createSiteKit(input) {
    const createdAt = input.now ?? now();
    return { ...input, createdAt, updatedAt: createdAt, version: 1 };
}
export function upsertSiteKit(system, kit) {
    const previous = system.siteKits[kit.id];
    const next = previous ? { ...kit, createdAt: previous.createdAt, updatedAt: now(), version: previous.version + 1 } : kit;
    return { ...system, siteKits: { ...system.siteKits, [next.id]: next } };
}
export function installLibrary(system, library) {
    return { ...system, libraries: { ...system.libraries, [library.id]: library } };
}
export function publishLibraryRelease(system, libraryId, notes, at = now()) {
    const library = system.libraries[libraryId];
    if (!library)
        return system;
    const version = library.availableVersion + 1;
    const release = { version, createdAt: at, variableIds: Object.keys(system.variables), styleIds: Object.keys(system.styles), componentFamilyIds: Object.keys(system.componentFamilies), siteKitIds: Object.keys(system.siteKits), notes };
    return { ...system, libraries: { ...system.libraries, [libraryId]: { ...library, availableVersion: version, status: 'update-available', releases: [...library.releases, release], updatedAt: at } } };
}
export function decideLibraryUpdate(system, libraryId, decision, at = now()) {
    const library = system.libraries[libraryId];
    if (!library)
        return system;
    const next = decision === 'accept'
        ? { ...library, installedVersion: library.availableVersion, status: 'current', updatedAt: at }
        : { ...library, status: 'postponed', updatedAt: at };
    return { ...system, libraries: { ...system.libraries, [libraryId]: next } };
}
export function seedStarterDesignSystem(system = emptyDesignSystem(), at = now()) {
    if (Object.keys(system.variables).length || Object.keys(system.componentFamilies).length)
        return system;
    const variables = [
        { id: 'var:accent', name: 'Accent', cssName: '--froam-accent', kind: 'color', role: 'primitive', collection: 'Brand', values: { 'mode:base': '#14b8a6', 'mode:dark': '#5eead4', 'mode:brand': '#7c3aed' } },
        { id: 'var:surface', name: 'Surface', cssName: '--froam-surface', kind: 'color', role: 'semantic', collection: 'Semantic', values: { 'mode:light': '#ffffff', 'mode:dark': '#0f172a' } },
        { id: 'var:text', name: 'Text', cssName: '--froam-text', kind: 'color', role: 'semantic', collection: 'Semantic', values: { 'mode:light': '#0f172a', 'mode:dark': '#f8fafc' } },
        { id: 'var:radius', name: 'Card radius', cssName: '--froam-radius-card', kind: 'size', role: 'semantic', collection: 'Shape', values: { 'mode:base': '18px', 'mode:mobile': '14px' } },
        { id: 'var:space', name: 'Section space', cssName: '--froam-space-section', kind: 'size', role: 'semantic', collection: 'Layout', values: { 'mode:base': '72px', 'mode:mobile': '36px' } },
    ];
    let next = { ...system, variables: Object.fromEntries(variables.map((variable) => [variable.id, variable])) };
    const button = createReusableStyle({ id: 'style:button-primary', name: 'Primary button', category: 'Button', now: at, states: { base: { background: 'var(--froam-accent)', color: '#ffffff', borderRadius: 'var(--froam-radius-card)', padding: '12px 18px', fontWeight: '700' }, hover: { filter: 'brightness(1.08)', transform: 'translateY(-1px)' }, focus: { outline: '3px solid color-mix(in srgb, var(--froam-accent) 35%, transparent)', outlineOffset: '2px' }, active: { transform: 'translateY(0)', filter: 'brightness(.94)' } } });
    next = saveReusableStyle(next, button);
    for (const style of [
        createReusableStyle({ id: 'style:display-heading', name: 'Display heading', category: 'Typography', now: at, states: { base: { color: 'var(--froam-text)', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 'clamp(2.75rem, 8vw, 7rem)', fontWeight: '800', letterSpacing: '-.055em', lineHeight: '.92' } } }),
        createReusableStyle({ id: 'style:card', name: 'System card', category: 'Card', now: at, states: { base: { background: 'var(--froam-surface)', color: 'var(--froam-text)', border: '1px solid color-mix(in srgb, var(--froam-text) 12%, transparent)', borderRadius: 'var(--froam-radius-card)', padding: '24px', boxShadow: '0 20px 50px -34px rgba(15,23,42,.45)' }, hover: { transform: 'translateY(-3px)', boxShadow: '0 26px 60px -32px rgba(15,23,42,.55)' } } }),
        createReusableStyle({ id: 'style:field', name: 'Form field', category: 'Form', now: at, states: { base: { background: 'var(--froam-surface)', color: 'var(--froam-text)', border: '1px solid color-mix(in srgb, var(--froam-text) 18%, transparent)', borderRadius: '12px', padding: '12px 14px' }, focus: { borderColor: 'var(--froam-accent)', outline: '3px solid color-mix(in srgb, var(--froam-accent) 22%, transparent)' } } }),
        createReusableStyle({ id: 'style:navigation', name: 'Navigation shell', category: 'Navigation', now: at, states: { base: { background: 'color-mix(in srgb, var(--froam-surface) 88%, transparent)', color: 'var(--froam-text)', backdropFilter: 'blur(18px)', borderBottom: '1px solid color-mix(in srgb, var(--froam-text) 10%, transparent)', padding: '14px 24px' } } }),
    ])
        next = saveReusableStyle(next, style);
    const family = { id: 'family:button', name: 'Button', category: 'Action', baseComponentId: 'button', props: [{ id: 'prop:label', name: 'Label', kind: 'text', defaultValue: 'Get started' }, { id: 'prop:link', name: 'Link', kind: 'link', defaultValue: '#' }, { id: 'prop:icon', name: 'Show icon', kind: 'boolean', defaultValue: false }], slots: [{ id: 'slot:icon', name: 'Icon', accepts: ['icon', 'svg'] }], variants: [{ id: 'variant:solid', name: 'Solid', styles: { background: 'var(--froam-accent)', color: '#fff' } }, { id: 'variant:outline', name: 'Outline', styles: { background: 'transparent', color: 'var(--froam-accent)', border: '1px solid currentColor' } }, { id: 'variant:quiet', name: 'Quiet', styles: { background: 'transparent', color: 'var(--froam-text)' } }], createdAt: at, updatedAt: at, version: 1 };
    next = upsertComponentFamily(next, family);
    const kitFamilies = ['family:button', 'family:navigation', 'family:hero', 'family:features', 'family:cta', 'family:contact', 'family:footer'];
    const kit = createSiteKit({ id: 'kit:launch', name: 'Launch system', description: 'Coordinated typography, actions, cards, navigation, forms, and motion for a product launch.', modeIds: ['mode:light', 'mode:mobile', 'mode:brand'], variableIds: Object.keys(next.variables), styleIds: Object.keys(next.styles), componentFamilyIds: kitFamilies, interactionIds: [], tags: ['launch', 'marketing', 'responsive'], now: at });
    next = upsertSiteKit(next, kit);
    next = upsertSiteKit(next, createSiteKit({ id: 'kit:editorial', name: 'Editorial system', description: 'Large display typography, restrained surfaces, article cards, navigation, newsletter forms, and calm motion.', modeIds: ['mode:light', 'mode:mobile'], variableIds: Object.keys(next.variables), styleIds: ['style:display-heading', 'style:card', 'style:field', 'style:navigation'], componentFamilyIds: ['family:navigation', 'family:hero', 'family:content', 'family:blog', 'family:footer'], interactionIds: [], tags: ['editorial', 'content', 'magazine'], now: at }));
    next = upsertSiteKit(next, createSiteKit({ id: 'kit:product-dark', name: 'Product dark system', description: 'Dark product surfaces, clear actions, bento features, pricing, forms, and focused interaction states.', modeIds: ['mode:dark', 'mode:mobile', 'mode:brand'], variableIds: Object.keys(next.variables), styleIds: Object.keys(next.styles), componentFamilyIds: ['family:navigation', 'family:hero', 'family:features', 'family:pricing', 'family:faq', 'family:contact', 'family:footer'], interactionIds: [], tags: ['product', 'dark', 'saas'], now: at }));
    const library = { id: 'library:local', name: 'Project library', sourceProjectId: 'local', installedVersion: 1, availableVersion: 1, status: 'current', releases: [{ version: 1, createdAt: at, variableIds: Object.keys(next.variables), styleIds: Object.keys(next.styles), componentFamilyIds: Object.keys(next.componentFamilies), siteKitIds: Object.keys(next.siteKits), notes: 'Initial design system' }], createdAt: at, updatedAt: at };
    return installLibrary(next, library);
}
//# sourceMappingURL=design-system.js.map