export const FROAM_WORKSPACE_MODES = [
    { id: 'create', label: 'Create', promise: 'Build it' },
    { id: 'understand', label: 'Understand', promise: 'Know it' },
    { id: 'experiment', label: 'Experiment', promise: 'Challenge it' },
];
export const FROAM_WORKSPACE_SECTIONS = [
    { id: 'design', mode: 'create', label: 'Design', description: 'Style and layout the selection', maturity: 'production', aliases: ['style', 'typography', 'layout'] },
    { id: 'plan', mode: 'create', label: 'Build', description: 'Draft pages, compose structure and add reusable components', maturity: 'production', aliases: ['insert', 'site planner', 'components', 'compose'] },
    { id: 'blueprint', mode: 'create', label: 'Blueprint', description: 'Open the existing 2D/3D structural view', maturity: 'production', aliases: ['blueprint 2d', 'blueprint 3d'] },
    { id: 'animator', mode: 'create', label: 'Animator', description: 'Edit time-based interaction motion', maturity: 'production', requiresSelection: true, temporalOwner: 'animator', aliases: ['animation', 'timeline'] },
    { id: 'interactions-create', mode: 'create', label: 'Interactions', description: 'Apply behavior to the selection', maturity: 'experimental', requiresSelection: true, labFlag: 'interactionLibrary' },
    { id: 'responsive-create', mode: 'create', label: 'Responsive', description: 'Viewport and survival controls', maturity: 'beta' },
    { id: 'reference', mode: 'understand', label: 'Reference', description: 'Import screenshots and understand structure across viewport evidence', maturity: 'production', aliases: ['screenshot', 'screenshot to ui', 'screenshot → ui', 'reconstruction', 'multiple views'] },
    { id: 'layers', mode: 'understand', label: 'Layers', description: 'Navigate the identity-aware live DOM structure', maturity: 'production', aliases: ['outline', 'dom structure', 'structure', 'tree'] },
    { id: 'scan', mode: 'understand', label: 'Scan', description: 'Observe the live interface', maturity: 'beta', aliases: ['scan page'] },
    { id: 'dna', mode: 'understand', label: 'DNA', description: 'Inspect selected component knowledge', maturity: 'beta', requiresSelection: true, aliases: ['component dna'] },
    { id: 'archive', mode: 'understand', label: 'Archive', description: 'Reuse known components', maturity: 'beta', aliases: ['component archive'] },
    { id: 'archaeology', mode: 'understand', label: 'Origins', description: 'Trace recorded provenance', maturity: 'beta', requiresSelection: true, aliases: ['archaeology', 'history'] },
    { id: 'flow', mode: 'understand', label: 'Product Flow', description: 'Inspect screen relationships', maturity: 'beta', aliases: ['flow'] },
    { id: 'attention', mode: 'understand', label: 'Attention', description: 'Estimate probable visual focus', maturity: 'experimental', aliases: ['heatmap'] },
    { id: 'rhythm', mode: 'understand', label: 'Rhythm', description: 'Inspect compositional repetition', maturity: 'experimental' },
    { id: 'responsive', mode: 'understand', label: 'Responsive', description: 'Priority metadata and Breakpoint Cinema', maturity: 'beta', temporalOwner: 'breakpoint-cinema', aliases: ['breakpoint cinema'] },
    { id: 'laboratory', mode: 'experiment', label: 'Laboratory', description: 'Configure independently flagged experiments', maturity: 'experimental', aliases: ['labs', 'flags'] },
    { id: 'mutate', mode: 'experiment', label: '☣ MUTATE', description: 'Fork an alternate prototype reality', maturity: 'experimental', requiresSelection: true, labFlag: 'mutate' },
    { id: 'sample', mode: 'experiment', label: '◉ SAMPLE', description: 'Record observable interaction behavior', maturity: 'experimental', requiresSelection: true, labFlag: 'uiSampling', temporalOwner: 'sampling' },
    { id: 'interactions', mode: 'experiment', label: 'Interactions', description: 'Browse and edit portable recipes', maturity: 'experimental', labFlag: 'interactionLibrary' },
    { id: 'physics', mode: 'experiment', label: 'Physics', description: 'Tune physical interaction behavior', maturity: 'experimental', requiresSelection: true, labFlag: 'designPhysics' },
    { id: 'gravity', mode: 'experiment', label: 'Gravity', description: 'Define motion relationships', maturity: 'experimental', requiresSelection: true, labFlag: 'uiGravity' },
    { id: 'break', mode: 'experiment', label: 'BREAK', description: 'Run explicit simulated realities', maturity: 'experimental', labFlag: 'chaosTesting' },
    { id: 'test-user', mode: 'experiment', label: 'Test User', description: 'Run deterministic Product Flow tasks', maturity: 'research', labFlag: 'syntheticUx' },
    { id: 'sound', mode: 'experiment', label: 'Sound', description: 'Attach project-local audio feedback', maturity: 'experimental', labFlag: 'uiSound' },
    { id: 'trailer', mode: 'experiment', label: 'Trailer', description: 'Edit a real-project storyboard', maturity: 'experimental', labFlag: 'trailerGenerator', temporalOwner: 'trailer' },
    { id: 'reality', mode: 'experiment', label: 'Reality', description: 'Bounded probable-screen research', maturity: 'research', labFlag: 'realityMode' },
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
        return { label: 'Froam is understanding', tone: 'understand' };
    if (input.activity === 'intent-creating')
        return { label: 'Preparing experiment', tone: 'prototype' };
    if (input.activity === 'intent-applying')
        return { label: 'Applying', tone: 'prototype' };
    if (input.activity === 'mutating')
        return { label: 'Mutagen active ☣', tone: 'prototype' };
    if (input.activity === 'chaos')
        return { label: 'Chaos simulation', tone: 'warning' };
    if (input.activity === 'synthetic')
        return { label: 'Synthetic UX', tone: 'research' };
    if (input.activity === 'screenshot')
        return { label: 'Reading references', tone: 'understand' };
    const scanning = input.activity === 'scanning';
    if (scanning)
        return { label: 'Scanning', tone: 'understand' };
    if (input.sampling)
        return { label: 'Sampling ●', tone: 'live' };
    if (input.replay)
        return { label: 'Replay', tone: 'understand' };
    if (input.physics)
        return { label: 'Physics', tone: 'experiment' };
    if (input.branchId !== 'main')
        return { label: `${input.branchName} ☣`, tone: 'prototype' };
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
    const labels = { animator: 'Animator timeline', replay: 'Replay timeline', sampling: 'Sampling timeline', 'breakpoint-cinema': 'Breakpoint Cinema', trailer: 'Trailer storyboard' };
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