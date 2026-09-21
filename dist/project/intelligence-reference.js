import { applyPriors } from './judge-priors.js';
import { auditProfile } from './judge-deterministic.js';
export const FROAM_DESIGN_REFERENCE_VERSION = 1;
const hexFor = (profile, role) => profile.color.palette.find((entry) => entry.role === role)?.hex ?? null;
/**
 * Render a profile as a short design brief.
 *
 * Written for a model to read, so it states values and their meaning rather
 * than dumping structure. Anything the profile could not establish is omitted
 * rather than defaulted — a stated "ratio 1.25" that was never measured is
 * worse than silence, because the model will build on it.
 */
export function formatDesignBrief(profile, priorNotes = []) {
    const lines = [];
    const tokens = [
        ['surface', hexFor(profile, 'surface')],
        ['raised', hexFor(profile, 'raised')],
        ['ink', hexFor(profile, 'ink')],
        ['muted', hexFor(profile, 'muted')],
        ['accent', hexFor(profile, 'accent')],
    ].filter(([, hex]) => hex);
    if (tokens.length)
        lines.push(`Palette (${profile.color.modeSignal}): ${tokens.map(([role, hex]) => `${role} ${hex}`).join(', ')}.`);
    if (hexFor(profile, 'accent')) {
        lines.push(profile.color.accentDiscipline >= 0.8
            ? `The accent is reserved for actions (${Math.round(profile.color.accentDiscipline * 100)}% of its uses). Keep it that way.`
            : `The accent is already used decoratively (${Math.round(profile.color.accentDiscipline * 100)}% of uses are actions). Do not spread it further.`);
    }
    if (profile.type.scale.length) {
        lines.push(`Type scale: ${profile.type.scale.map((step) => `${step.px}px`).join(', ')}`
            + (profile.type.ratio !== null ? ` (ratio ${profile.type.ratio}).` : ' — no consistent ratio holds, so prefer an existing size over a new one.'));
    }
    if (profile.type.families.length)
        lines.push(`Families: ${profile.type.families.slice(0, 3).map((family) => `${family.stack} (${family.role})`).join(', ')}.`);
    lines.push(profile.space.adherence >= 0.5
        ? `Spacing runs on a ${profile.space.base}px grid (${Math.round(profile.space.adherence * 100)}% adherence); use multiples of ${profile.space.base}.`
        : `No spacing grid holds (${profile.space.base}px fits only ${Math.round(profile.space.adherence * 100)}%); prefer values already present: ${profile.space.scale.slice(0, 6).join(', ')}px.`);
    if (profile.surface.radii.length)
        lines.push(`Corner radii in use: ${profile.surface.radii.join(', ')}px. Reuse one rather than introducing another.`);
    if (profile.flow.signature)
        lines.push(`Section flow: ${profile.flow.signature}.`);
    if (Number.isFinite(profile.color.contrastFloor))
        lines.push(`Worst measured text contrast is ${profile.color.contrastFloor}:1; keep any new text at or above 4.5:1.`);
    for (const note of priorNotes.slice(0, 3)) {
        lines.push(`Corpus note: ${note.claim} (held on ${Math.round(note.heldOutAccuracy * 100)}% of ${note.support} comparable pages).`);
    }
    return lines.join('\n');
}
export function buildDesignReference(input) {
    const { profile, priors = [], maxPriorNotes = 3, maxFindings = 6 } = input;
    const audit = auditProfile(profile);
    const violations = applyPriors(profile, priors);
    const priorNotes = violations.slice(0, maxPriorNotes).map((violation) => ({
        claim: violation.summary,
        heldOutAccuracy: violation.heldOutAccuracy,
        support: violation.support,
    }));
    return {
        schemaVersion: FROAM_DESIGN_REFERENCE_VERSION,
        kind: 'reference-only',
        origin: profile.origin,
        routeKey: profile.routeKey,
        tokens: {
            surface: hexFor(profile, 'surface'),
            raised: hexFor(profile, 'raised'),
            ink: hexFor(profile, 'ink'),
            muted: hexFor(profile, 'muted'),
            accent: hexFor(profile, 'accent'),
            accentDiscipline: profile.color.accentDiscipline,
            modeSignal: profile.color.modeSignal,
        },
        type: {
            steps: profile.type.scale.map((step) => step.px),
            ratio: profile.type.ratio,
            families: profile.type.families.slice(0, 3).map((family) => family.stack),
            measureCh: profile.type.measureCh,
        },
        space: {
            base: profile.space.base,
            scale: profile.space.scale.slice(0, 8),
            adherence: profile.space.adherence,
            density: profile.space.density,
        },
        surface: { radii: profile.surface.radii.slice(0, 6), shadowTiers: profile.surface.shadowTiers },
        flow: profile.flow.signature,
        openFindings: audit.findings.slice(0, maxFindings).map((finding) => ({
            check: finding.check,
            severity: finding.severity,
            summary: finding.summary,
        })),
        priorNotes,
        brief: formatDesignBrief(profile, priorNotes),
    };
}
/**
 * Attach a design reference to an assembled intelligence request.
 *
 * Deliberately a separate step from assembly. The context assembler decides
 * what may be *changed*; this decides what may be *known*. Keeping them apart
 * means adding knowledge can never widen authority by accident.
 */
export function attachDesignReference(request, reference) {
    return {
        ...request,
        context: { ...request.context, designReference: reference },
        // scopeNodeIds is passed through untouched, by construction.
    };
}
/**
 * Bytes saved by sending the measurement instead of the evidence.
 *
 * Reported rather than asserted because it is the whole economic argument:
 * richer context that costs less only holds if the numbers say so.
 */
export function referenceCostComparison(input) {
    // TextEncoder rather than Buffer: this module tree is browser-safe, and
    // reaching for a Node global here would quietly break that guarantee.
    const encoder = new TextEncoder();
    const byteLength = (value) => encoder.encode(value).length;
    const referenceBytes = byteLength(JSON.stringify(input.reference));
    const briefBytes = byteLength(input.reference.brief);
    const rawBytes = byteLength(JSON.stringify(input.scanRecords));
    return {
        referenceBytes,
        briefBytes,
        rawBytes,
        /** Raw evidence bytes per byte of brief. */
        compression: briefBytes > 0 ? Math.round((rawBytes / briefBytes) * 10) / 10 : 0,
    };
}
//# sourceMappingURL=intelligence-reference.js.map