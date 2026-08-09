import { addUnsupportedSamplingEffect, createSamplingSession, recordSamplingEvent, recordSamplingFrame, recordSamplingMutation, samplingSessionToRecipe } from './ui-sampling.js';
const STYLE_ALLOWLIST = new Set(['opacity', 'transform', 'visibility', 'display', 'filter', 'backdropFilter', 'color', 'backgroundColor', 'borderRadius', 'width', 'height', 'left', 'top', 'position']);
export function validateExternalPermission(permission, origin) { let normalized; try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        throw new Error();
    normalized = parsed.origin;
}
catch {
    throw new Error('External Sampling accepts only explicit HTTP(S) origins');
} if (!permission.activeTab || !permission.userInitiated || permission.origin !== normalized || origin !== normalized)
    throw new Error('External Sampling requires explicit active-tab permission for this origin'); return true; }
export function isSensitiveSamplingElement(input) { const signature = `${input.type ?? ''} ${input.autocomplete ?? ''} ${input.name ?? ''}`.toLocaleLowerCase(); const formControl = ['input', 'textarea', 'select'].includes(input.tagName.toLocaleLowerCase()); return formControl && /password|token|secret|credit|card|cc-|otp|one-time|authorization/.test(signature); }
export function sanitizeExternalObservation(observation) { const styles = observation.styles ? Object.fromEntries(Object.entries(observation.styles).filter(([key, value]) => STYLE_ALLOWLIST.has(key) && (typeof value === 'string' || typeof value === 'number')).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 240) : value])) : undefined; return { elapsedMs: Math.max(0, Math.min(120_000, observation.elapsedMs)), type: observation.type, role: observation.role.replace(/[^a-z0-9-_]/gi, '-').slice(0, 80) || 'target', nodeToken: observation.nodeToken?.replace(/[^a-z0-9:_-]/gi, '').slice(0, 120), event: observation.event?.slice(0, 40), mutation: observation.mutation, styles, geometry: observation.geometry && Object.values(observation.geometry).every(Number.isFinite) ? observation.geometry : undefined, visible: observation.visible }; }
export function validateExternalSamplerMessage(message, permission) { if (message.version !== 1 || !message.sessionId || message.sessionId.length > 120)
    throw new Error('Unsupported External Sampler message'); validateExternalPermission(permission, message.origin); if ((message.observations?.length ?? 0) > 2_000)
    throw new Error('External Sampler observation batch is too large'); return { ...message, observations: message.observations?.map(sanitizeExternalObservation) }; }
export function detectExternalSamplingLimitations(root) { const limitations = new Set(); if (root.querySelector('iframe'))
    limitations.add('cross-origin-iframe'); if (root.querySelector('canvas'))
    limitations.add('canvas'); if (root.querySelector('video'))
    limitations.add('video'); if (root.querySelector('svg use, svg foreignObject, svg animate'))
    limitations.add('complex-svg'); return [...limitations]; }
export function externalObservationsToRecipe(input) { let session = createSamplingSession({ id: input.sessionId, trigger: input.observations.find((item) => item.type === 'event')?.event ?? 'click', sourceRole: input.observations.find((item) => item.type === 'event')?.role ?? 'trigger', startedAt: input.startedAt }); for (const observation of input.observations.map(sanitizeExternalObservation)) {
    if (observation.type === 'event')
        session = recordSamplingEvent(session, { atMs: observation.elapsedMs, targetRole: observation.role, event: observation.event ?? 'unknown' });
    else if (observation.type === 'mutation')
        session = recordSamplingMutation(session, { atMs: observation.elapsedMs, targetRole: observation.role, kind: observation.mutation ?? 'attributes' });
    else
        session = recordSamplingFrame(session, { atMs: observation.elapsedMs, targetRole: observation.role, nodeId: observation.nodeToken, styles: observation.styles ?? {}, geometry: observation.geometry, visible: observation.visible });
} for (const limitation of input.limitations ?? [])
    session = addUnsupportedSamplingEffect(session, limitation); const recipe = samplingSessionToRecipe(session, { recipeId: input.recipeId, name: input.name, projectId: input.projectId, branchId: input.branchId, confidence: Math.max(.2, .7 - (input.limitations?.length ?? 0) * .08) }); return { ...recipe, provenance: { ...recipe.provenance, source: 'external', provider: 'froam-external-sampler-prototype-v1', originalImplementation: 'unknown' }, metadata: { ...recipe.metadata, sourceOrigin: new URL(input.origin).origin, rawSourceCodeCaptured: false, sensitiveValuesCaptured: false } }; }
//# sourceMappingURL=external-sampling.js.map