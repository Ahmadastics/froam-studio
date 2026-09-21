export const FROAM_PRETEXT_VERSION = 'froam-pretext-v1';
export const FROAM_SECTION_ARCHETYPES = [
    'hero', 'proof', 'feature-grid', 'split', 'testimonial', 'pricing', 'faq', 'cta', 'footer', 'unknown',
];
const DENSITIES = ['tight', 'balanced', 'airy'];
// ── generators ──────────────────────────────────────────────────────────────
/**
 * Hide one section; predict its archetype from the ones around it.
 *
 * Tests whether Froam has any model of page narrative — that a proof strip
 * follows a hero, that a footer ends things.
 */
function sectionInfill(profile) {
    const sections = profile.flow.sections;
    if (sections.length < 3)
        return [];
    return sections.map((hidden, index) => ({
        id: `${profile.origin}${profile.routeKey}:section-infill:${index}`,
        kind: 'section-infill',
        origin: profile.origin,
        routeKey: profile.routeKey,
        input: {
            hiddenIndex: index,
            sectionCount: sections.length,
            // Only the *visible* sections. The signature is deliberately absent:
            // it is a join of every archetype including the hidden one.
            visible: sections.filter((_, position) => position !== index).map((section) => ({
                index: section.index,
                archetype: section.archetype,
                columns: section.grid.columns,
                heightRatio: section.heightRatio,
            })),
            hiddenGeometry: { columns: hidden.grid.columns, heightRatio: hidden.heightRatio, gapPx: hidden.grid.gapPx },
            modeSignal: profile.color.modeSignal,
            density: profile.space.density,
        },
        answer: hidden.archetype,
        choices: [...FROAM_SECTION_ARCHETYPES],
    }));
}
/** Given the page so far, predict what comes next. Tests rhetorical order. */
function nextSection(profile) {
    const sections = profile.flow.sections;
    if (sections.length < 3)
        return [];
    const tasks = [];
    for (let index = 1; index < sections.length; index += 1) {
        tasks.push({
            id: `${profile.origin}${profile.routeKey}:next-section:${index}`,
            kind: 'next-section',
            origin: profile.origin,
            routeKey: profile.routeKey,
            input: {
                // Prefix only. Total section count is withheld: knowing the page ends
                // at this index gives away 'footer'.
                prefix: sections.slice(0, index).map((section) => section.archetype),
                atIndex: index,
                modeSignal: profile.color.modeSignal,
            },
            answer: sections[index].archetype,
            choices: [...FROAM_SECTION_ARCHETYPES],
        });
    }
    return tasks;
}
/**
 * Predict which role the accent colour lands on.
 *
 * Tests whether colour is understood as a system of meaning rather than
 * decoration — that the loud colour is where the action is.
 */
function accentPlacement(profile) {
    const accent = profile.color.palette.find((entry) => entry.role === 'accent');
    if (!accent || accent.appearsOn.length === 0)
        return [];
    const roles = accent.appearsOn.filter((role) => role !== 'unknown');
    if (!roles.length)
        return [];
    const modal = roles[0];
    return [{
            id: `${profile.origin}${profile.routeKey}:accent-placement`,
            kind: 'accent-placement',
            origin: profile.origin,
            routeKey: profile.routeKey,
            input: {
                // The accent's own usage is removed. accentDiscipline is derived from it
                // and is withheld for the same reason.
                palette: profile.color.palette
                    .filter((entry) => entry.role !== 'accent')
                    .map((entry) => ({ role: entry.role, areaShare: entry.areaShare, channel: entry.channel })),
                accentChroma: accent.oklch.c,
                accentAreaShare: accent.areaShare,
                sectionArchetypes: profile.flow.sections.map((section) => section.archetype),
                modeSignal: profile.color.modeSignal,
            },
            answer: modal,
            choices: ['cta', 'button', 'input', 'form', 'heading', 'card', 'badge', 'navigation', 'media', 'paragraph'],
        }];
}
/** Hide one step of the type scale; predict its size. Tests proportion. */
function scaleInfill(profile) {
    const scale = profile.type.scale;
    if (scale.length < 4)
        return [];
    const tasks = [];
    // Interior steps only. An endpoint is extrapolation, which is a different
    // and much harder question than filling a gap.
    for (let index = 1; index < scale.length - 1; index += 1) {
        tasks.push({
            id: `${profile.origin}${profile.routeKey}:scale-infill:${index}`,
            kind: 'scale-infill',
            origin: profile.origin,
            routeKey: profile.routeKey,
            input: {
                hiddenIndex: index,
                // ratio and ratioSpread are computed from the full scale and would
                // hand back the missing step directly.
                visibleSteps: scale.filter((_, position) => position !== index).map((step) => step.px),
                hiddenUsedBy: scale[index].usedBy,
                stepCount: scale.length,
            },
            answer: scale[index].px,
            choices: null,
        });
    }
    return tasks;
}
/**
 * Predict a section's archetype from geometry alone — no roles, no text.
 *
 * Tests whether visual hierarchy is understood independently of markup, which
 * is the part that transfers to pages whose HTML says nothing useful.
 */
function blindRole(profile) {
    return profile.flow.sections
        .filter((section) => section.archetype !== 'unknown')
        .map((section) => ({
        id: `${profile.origin}${profile.routeKey}:blind-role:${section.index}`,
        kind: 'blind-role',
        origin: profile.origin,
        routeKey: profile.routeKey,
        input: {
            // Geometry and position only. childRoles is the answer in disguise.
            index: section.index,
            columns: section.grid.columns,
            gapPx: section.grid.gapPx,
            maxWidthPx: section.grid.maxWidthPx,
            heightRatio: section.heightRatio,
            isFirst: section.index === 0,
            isLast: section.index === profile.flow.sections.length - 1,
            sectionCount: profile.flow.sections.length,
        },
        answer: section.archetype,
        choices: [...FROAM_SECTION_ARCHETYPES],
    }));
}
/**
 * Predict spacing density from colour and type alone.
 *
 * Tests cross-axis coherence: whether the parts of a design system are
 * understood as mutually constraining rather than independent.
 */
function densityMatch(profile) {
    if (!profile.type.scale.length)
        return [];
    return [{
            id: `${profile.origin}${profile.routeKey}:density-match`,
            kind: 'density-match',
            origin: profile.origin,
            routeKey: profile.routeKey,
            input: {
                typeSteps: profile.type.scale.map((step) => step.px),
                measureCh: profile.type.measureCh,
                paletteSize: profile.color.palette.length,
                modeSignal: profile.color.modeSignal,
                radii: profile.surface.radii,
                // space.base, adherence, scale and sectionGapPx are all withheld: density
                // is derived from spacing, so any of them would answer the question.
            },
            answer: profile.space.density,
            choices: [...DENSITIES],
        }];
}
const GENERATORS = [
    sectionInfill, nextSection, accentPlacement, scaleInfill, blindRole, densityMatch,
];
/** Turn profiles into graded questions. No annotation, no model, no cost. */
export function generatePretextTasks(profiles, kinds) {
    const tasks = profiles.flatMap((profile) => GENERATORS.flatMap((generate) => generate(profile)));
    return kinds ? tasks.filter((task) => kinds.includes(task.kind)) : tasks;
}
// ── leakage ─────────────────────────────────────────────────────────────────
/**
 * Check that a task's input does not contain its own answer.
 *
 * Run over every generated task in the test suite. A leak does not throw or
 * warn at runtime — it silently produces excellent scores, which is the single
 * most likely way this whole apparatus ends up lying.
 */
export function detectLeakage(task) {
    const leaks = [];
    const serialized = JSON.stringify(task.input);
    // Substring matching is only safe where the answer's value-space cannot
    // collide with anything else in the input. 'cta' is both a semantic role and
    // a section archetype, so a raw scan would flag an accent-placement task for
    // listing a cta *section* — a correlation the predictor is supposed to learn,
    // not the answer handed over. Those tasks are checked by key instead.
    if (typeof task.answer === 'string' && task.kind === 'density-match') {
        if (serialized.split(`"${task.answer}"`).length - 1 > 0)
            leaks.push(`density "${task.answer}" appears in input`);
    }
    if (task.kind === 'accent-placement') {
        for (const key of ['appearsOn', 'accentAppearsOn', 'accentDiscipline', 'accentRole']) {
            if (key in task.input)
                leaks.push(`${key} reconstructs where the accent lands`);
        }
        const palette = task.input.palette;
        if (palette?.some((entry) => entry.role === 'accent'))
            leaks.push('accent entry left in the palette');
    }
    if (task.kind === 'section-infill') {
        const input = task.input;
        if (input.visible.some((section) => section.index === input.hiddenIndex))
            leaks.push('hidden section present in visible list');
        if ('signature' in task.input)
            leaks.push('flow.signature contains every archetype including the hidden one');
    }
    if (task.kind === 'scale-infill') {
        const input = task.input;
        if (input.visibleSteps.includes(task.answer))
            leaks.push('hidden step present in visible steps');
        if ('ratio' in task.input || 'ratioSpread' in task.input)
            leaks.push('type ratio reconstructs the hidden step');
    }
    if (task.kind === 'blind-role' && ('childRoles' in task.input || 'archetype' in task.input)) {
        leaks.push('blind-role input carries semantic roles, which is the answer');
    }
    if (task.kind === 'next-section') {
        const input = task.input;
        if (input.prefix.length !== input.atIndex)
            leaks.push('prefix length disagrees with index');
        if ('sectionCount' in task.input)
            leaks.push('section count reveals whether the answer is the footer');
    }
    return leaks;
}
/** Numeric answers are correct within a relative tolerance; a type step is not a lottery number. */
export const FROAM_NUMERIC_TOLERANCE = 0.1;
export function isCorrect(task, predicted) {
    if (predicted === null || predicted === undefined)
        return false;
    if (typeof task.answer === 'number') {
        const value = typeof predicted === 'number' ? predicted : Number.parseFloat(String(predicted));
        if (!Number.isFinite(value))
            return false;
        return Math.abs(value - task.answer) <= Math.max(0.5, Math.abs(task.answer) * FROAM_NUMERIC_TOLERANCE);
    }
    return String(predicted) === String(task.answer);
}
const round = (value, places = 4) => Math.round(value * 10 ** places) / 10 ** places;
/**
 * Upper-tail normal quantile (Abramowitz & Stegun 26.2.23).
 *
 * Needed to correct the significance threshold for the number of task kinds
 * being tested at once; accurate to about 5e-4, which is far beyond what this
 * decision requires.
 */
function normalQuantileUpper(p) {
    const probability = Math.min(0.5, Math.max(1e-12, p));
    const t = Math.sqrt(-2 * Math.log(probability));
    return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}
/**
 * Significance of an accuracy margin, corrected for multiple comparisons.
 *
 * A normal approximation on the difference of two proportions, which stops a
 * three-task fluke reading as learning. The Bonferroni correction matters more
 * than it looks: scoring six task kinds at α=0.05 each gives roughly a 26%
 * chance that at least one comes back "significant" on pure noise. Measured on
 * a deliberately structureless corpus, exactly that happened — one kind in one
 * seed at z=2.03, over the uncorrected 1.96 line and nowhere near the
 * corrected one. Without this, the harness would periodically announce that
 * Froam had learned something from random data.
 */
function significance(accuracy, baseline, tasks, comparisons) {
    const threshold = normalQuantileUpper(0.05 / Math.max(1, comparisons));
    if (tasks < 10)
        return { z: 0, threshold: round(threshold, 3), significant: false };
    const pooled = (accuracy + baseline) / 2;
    const variance = pooled * (1 - pooled) * (2 / tasks);
    const z = variance > 0 ? (accuracy - baseline) / Math.sqrt(variance) : accuracy > baseline ? Infinity : 0;
    return { z: Number.isFinite(z) ? round(z, 3) : z, threshold: round(threshold, 3), significant: z > threshold };
}
export function scorePretext(tasks, predictions, baselinePredictions, input) {
    const byId = new Map(predictions.map((prediction) => [prediction.taskId, prediction.answer]));
    const baselineById = new Map(baselinePredictions.map((prediction) => [prediction.taskId, prediction.answer]));
    const correct = tasks.filter((task) => isCorrect(task, byId.get(task.id))).length;
    const baselineCorrect = tasks.filter((task) => isCorrect(task, baselineById.get(task.id))).length;
    const accuracy = tasks.length ? correct / tasks.length : 0;
    const baselineAccuracy = tasks.length ? baselineCorrect / tasks.length : 0;
    const kinds = [...new Set(tasks.map((task) => task.kind))];
    return {
        pretextVersion: FROAM_PRETEXT_VERSION,
        predictor: input.predictor,
        baseline: input.baseline,
        tasks: tasks.length,
        accuracy: round(accuracy),
        baselineAccuracy: round(baselineAccuracy),
        lift: baselineAccuracy > 0 ? round(accuracy / baselineAccuracy) : accuracy > 0 ? Infinity : 0,
        comparisons: kinds.length,
        byKind: kinds.map((kind) => {
            const forKind = tasks.filter((task) => task.kind === kind);
            const kindCorrect = forKind.filter((task) => isCorrect(task, byId.get(task.id))).length / forKind.length;
            const kindBaseline = forKind.filter((task) => isCorrect(task, baselineById.get(task.id))).length / forKind.length;
            const test = significance(kindCorrect, kindBaseline, forKind.length, kinds.length);
            return {
                kind,
                tasks: forKind.length,
                accuracy: round(kindCorrect),
                baselineAccuracy: round(kindBaseline),
                lift: kindBaseline > 0 ? round(kindCorrect / kindBaseline) : kindCorrect > 0 ? Infinity : 0,
                z: test.z,
                significanceThreshold: test.threshold,
                significant: test.significant,
            };
        }),
    };
}
//# sourceMappingURL=pretext.js.map