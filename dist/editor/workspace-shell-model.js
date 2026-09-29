export const FROAM_WORKSPACE_MODES = [
    { id: 'create', label: 'Create', promise: 'Build it' },
    { id: 'understand', label: 'Understand', promise: 'Know it' },
    { id: 'experiment', label: 'Experiment', promise: 'Challenge it' },
];
export const FROAM_WORKSPACE_SECTIONS = [
    { id: 'design', mode: 'create', label: 'Design', description: 'Style and layout the selection', maturity: 'production', aliases: ['style', 'typography', 'layout'] },
    { id: 'plan', mode: 'create', label: 'Pages', description: 'Organize the live site, draft routes and compose page structure', maturity: 'production', aliases: ['build', 'site planner', 'sitemap', 'routes', 'compose'] },
    { id: 'library', mode: 'create', label: 'Library', description: 'Reuse production patterns, saved project artifacts and media', maturity: 'production', aliases: ['assets', 'components', 'patterns', 'media', 'archive'] },
    { id: 'blueprint', mode: 'create', label: 'Page map', description: 'The whole page as a map of its parts', maturity: 'production', aliases: ['blueprint 2d', 'blueprint 3d'] },
    { id: 'animator', mode: 'create', label: 'Animate', description: 'Motion and interactions for the selection', maturity: 'production', requiresSelection: true, temporalOwner: 'animator', aliases: ['animation', 'timeline'] },
    { id: 'interactions-create', mode: 'create', label: 'Interactions', description: 'Quick behaviors for the selection', maturity: 'experimental', requiresSelection: true, labFlag: 'interactionLibrary' },
    { id: 'responsive-create', mode: 'create', label: 'Responsive', description: 'How the selection adapts to screen sizes', maturity: 'beta' },
    { id: 'reference', mode: 'understand', label: 'Reference', description: 'Import screenshots and understand structure across viewport evidence', maturity: 'production', aliases: ['screenshot', 'screenshot to ui', 'screenshot → ui', 'reconstruction', 'multiple views'] },
    { id: 'layers', mode: 'understand', label: 'Layers', description: 'Navigate the identity-aware live DOM structure', maturity: 'production', aliases: ['outline', 'dom structure', 'structure', 'tree'] },
    { id: 'scan', mode: 'understand', label: 'Scan', description: 'Read the page so Froam can explain it', maturity: 'beta', aliases: ['scan page'] },
    { id: 'dna', mode: 'understand', label: 'Design DNA', description: 'Colours, type and spacing of the selection', maturity: 'beta', requiresSelection: true, aliases: ['component dna'] },
    { id: 'archive', mode: 'understand', label: 'Archive', description: 'Sections, styles and motion you kept to reuse', maturity: 'beta', aliases: ['component archive'] },
    { id: 'archaeology', mode: 'understand', label: 'Origins', description: 'Where the selection came from and every change to it', maturity: 'beta', requiresSelection: true, aliases: ['archaeology', 'history'] },
    { id: 'flow', mode: 'understand', label: 'Product flow', description: 'How your screens connect', maturity: 'beta', aliases: ['flow'] },
    { id: 'attention', mode: 'understand', label: 'Attention', description: 'Where eyes are likely to go first', maturity: 'experimental', aliases: ['heatmap'] },
    { id: 'rhythm', mode: 'understand', label: 'Rhythm', description: 'How evenly the page is spaced', maturity: 'experimental' },
    { id: 'responsive', mode: 'understand', label: 'Responsive priorities', description: 'What matters most as the screen gets smaller', maturity: 'beta', temporalOwner: 'breakpoint-cinema', aliases: ['breakpoint cinema'] },
    { id: 'laboratory', mode: 'experiment', label: 'Experiments', description: 'Turn on tools that are still being shaped', maturity: 'experimental', aliases: ['laboratory', 'labs', 'flags'] },
    { id: 'mutate', mode: 'experiment', label: 'Variations', description: 'Try changes on a copy of the page', maturity: 'experimental', requiresSelection: true, labFlag: 'mutate' },
    { id: 'sample', mode: 'experiment', label: 'Record', description: 'Turn what you do into an interaction', maturity: 'experimental', requiresSelection: true, labFlag: 'uiSampling', temporalOwner: 'sampling' },
    { id: 'interactions', mode: 'experiment', label: 'Interaction library', description: 'Browse and edit saved behaviors', maturity: 'experimental', labFlag: 'interactionLibrary' },
    { id: 'physics', mode: 'experiment', label: 'Physics', description: 'Weight and spring for the selection', maturity: 'experimental', requiresSelection: true, labFlag: 'designPhysics' },
    { id: 'gravity', mode: 'experiment', label: 'Gravity', description: 'Elements that attract or repel', maturity: 'experimental', requiresSelection: true, labFlag: 'uiGravity' },
    { id: 'break', mode: 'experiment', label: 'Stress test', description: 'See what breaks at odd sizes and conditions', maturity: 'experimental', labFlag: 'chaosTesting' },
];
export function workspaceSections(mode, flags, hasSelection) {
    return FROAM_WORKSPACE_SECTIONS.filter((section) => section.mode === mode)
        .filter((section) => !section.labFlag || flags[section.labFlag])
        .map((section) => ({ ...section, contextual: section.requiresSelection ? hasSelection : true }));
}
export function workspaceModeForSection(section) {
    return FROAM_WORKSPACE_SECTIONS.find((item) => item.id === section)?.mode ?? 'create';
}
export function workspaceProjectLabel(projectName, branchName, branchId) {
    return { projectName: projectName.trim() || 'Untitled project', branchName: branchName.trim() || branchId, prototype: branchId !== 'main', label: `${projectName.trim() || 'Untitled project'} / ${branchName.trim() || branchId}` };
}
export function workspaceStatus(input) {
    if (input.activity === 'intent-understanding')
        return { label: 'Working out what you asked for', tone: 'understand' };
    if (input.activity === 'intent-creating')
        return { label: 'Preparing a preview', tone: 'prototype' };
    if (input.activity === 'intent-applying')
        return { label: 'Applying', tone: 'prototype' };
    if (input.activity === 'mutating')
        return { label: 'Trying variations', tone: 'prototype' };
    if (input.activity === 'chaos')
        return { label: 'Stress testing the page', tone: 'warning' };
    if (input.activity === 'synthetic')
        return { label: 'Walking the flow', tone: 'research' };
    if (input.activity === 'screenshot')
        return { label: 'Reading your screenshots', tone: 'understand' };
    const scanning = input.activity === 'scanning';
    if (scanning)
        return { label: 'Reading the page', tone: 'understand' };
    if (input.sampling)
        return { label: 'Sampling ●', tone: 'live' };
    if (input.replay)
        return { label: 'Replay', tone: 'understand' };
    if (input.physics)
        return { label: 'Physics', tone: 'experiment' };
    if (input.branchId !== 'main')
        return { label: `Prototype: ${input.branchName}`, tone: 'prototype' };
    return { label: input.mode === 'create' ? 'Editing' : input.mode === 'understand' ? 'Understanding' : 'Experimenting', tone: input.mode };
}
export function workspaceCommandMatches(section, query) {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const haystack = [section.label, section.description, ...(section.aliases ?? [])].join(' ').toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
}
export function workspacePresenceSummary(members, limit = 4) {
    return { visible: members.slice(0, limit), overflow: Math.max(0, members.length - limit), accessibleLabel: members.length ? `${members.length} collaborator${members.length === 1 ? '' : 's'} present: ${members.map((member) => member.name).join(', ')}` : 'No collaborators present' };
}
export function workspaceTemporalSurface(owner) {
    const labels = { animator: 'Animation timeline', replay: 'Replay timeline', sampling: 'Recording timeline', 'breakpoint-cinema': 'Screen-size preview', trailer: 'Trailer storyboard' };
    return owner ? { owner, label: labels[owner] } : null;
}
export const FROAM_WORKSPACE_PREFERENCE_KEY = 'froam-workspace-shell-v1';
export const defaultWorkspacePreference = () => ({ mode: 'create', sections: { create: 'design', understand: 'scan', experiment: 'laboratory' }, advancedOpen: false });
export function transitionWorkspacePreference(preference, mode, section) { return { ...preference, mode, sections: section ? { ...preference.sections, [mode]: section } : preference.sections }; }
export function readWorkspacePreference(storage) { try {
    const raw = storage?.getItem(FROAM_WORKSPACE_PREFERENCE_KEY);
    const value = raw ? JSON.parse(raw) : {};
    const mode = FROAM_WORKSPACE_MODES.some((item) => item.id === value.mode) ? value.mode : 'create';
    return { ...defaultWorkspacePreference(), ...value, mode, sections: { ...defaultWorkspacePreference().sections, ...value.sections } };
}
catch {
    return defaultWorkspacePreference();
} }
export function writeWorkspacePreference(storage, preference) { try {
    storage?.setItem(FROAM_WORKSPACE_PREFERENCE_KEY, JSON.stringify(preference));
    return true;
}
catch {
    return false;
} }
//# sourceMappingURL=workspace-shell-model.js.map