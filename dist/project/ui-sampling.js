export function createSamplingSession(input) { return { ...input, frames: [], provenance: 'froam-controlled-dom' }; }
export function recordSamplingFrame(session, frame) { return { ...session, frames: [...session.frames, structuredClone(frame)].sort((a, b) => a.atMs - b.atMs) }; }
export function samplingSessionToRecipe(session, input) {
    if (!session.frames.length)
        throw new Error('A sampled interaction needs observable frames');
    const roles = [...new Set(session.frames.map((frame) => frame.targetRole))];
    const duration = Math.max(1, ...session.frames.map((frame) => frame.atMs));
    const targetRole = roles[0];
    const timeline = session.frames.filter((frame) => frame.targetRole === targetRole).map((frame) => ({ at: frame.atMs / duration, values: { ...frame.styles, ...(frame.visible === undefined ? {} : { visibility: frame.visible ? 'visible' : 'hidden' }) } }));
    return { id: input.recipeId, name: input.name, interaction: { id: input.recipeId, name: input.name, sourceId: `role:${session.sourceRole}`, targetIds: roles.map((role) => `role:${role}`), trigger: session.trigger === 'hover' ? 'hover' : session.trigger === 'focus' ? 'focus' : 'click', timeline, durationMs: duration, metadata: { reconstructedFromObservation: true, observedFrameCount: session.frames.length } }, bindings: { source: { role: session.sourceRole, required: true }, targets: roles.map((role) => ({ role, required: true })) }, provenance: { kind: 'sampled', projectId: input.projectId, branchId: input.branchId, createdAt: session.startedAt, provider: 'froam-native-sampler-v1' } };
}
//# sourceMappingURL=ui-sampling.js.map