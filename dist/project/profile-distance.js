import { oklchToOklab } from './page-profile.js';
/**
 * Stated policy, same as the judge's weights.
 *
 * Palette and flow carry the most because they are what make two pages read as
 * the same system; a radius being 6px instead of 8px is a detail.
 */
export const FROAM_DISTANCE_WEIGHTS = {
    palette: 3,
    flow: 3,
    type: 2,
    space: 2,
    mode: 1,
    density: 1,
    surface: 0.5,
};
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const round = (value, places = 4) => Math.round(value * 10 ** places) / 10 ** places;
/** OKLab ΔE at which two colours count as entirely different decisions. */
const COLOUR_SATURATION_DISTANCE = 0.35;
function colourDistance(a, b) {
    if (!a || !b)
        return 1;
    const first = oklchToOklab(a.oklch);
    const second = oklchToOklab(b.oklch);
    return clamp01(Math.hypot(first.L - second.L, first.a - second.a, first.b - second.b) / COLOUR_SATURATION_DISTANCE);
}
/** Levenshtein over archetype sequences, normalised by the longer one. */
export function sequenceDistance(a, b) {
    if (!a.length && !b.length)
        return 0;
    if (!a.length || !b.length)
        return 1;
    const rows = Array.from({ length: a.length + 1 }, (_, index) => {
        const row = new Array(b.length + 1).fill(0);
        row[0] = index;
        return row;
    });
    for (let column = 0; column <= b.length; column += 1)
        rows[0][column] = column;
    for (let row = 1; row <= a.length; row += 1) {
        for (let column = 1; column <= b.length; column += 1) {
            rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1));
        }
    }
    return clamp01(rows[a.length][b.length] / Math.max(a.length, b.length));
}
/**
 * How far apart two type systems are.
 *
 * Deliberately measures the *system* — where the scale starts, where it ends,
 * and the sizes it actually lands on — rather than how many distinct sizes each
 * page happens to contain.
 *
 * The first version weighted step count at 30%, and round-tripping exposed that
 * as a mistake rather than a preference. Real pages carry seven to thirteen
 * sizes, most of them one-off utility values; the judge in this same codebase
 * flags that as a defect ("a readable scale is usually 3–7 steps"). So a
 * generator emitting six disciplined steps was scored as unfaithful for being
 * *better* than its target, and the only way to score well would have been to
 * reproduce the target's clutter.
 *
 * Step count is a quality signal, which the judge already owns. Fidelity is
 * whether the same scale is in use. Conflating them made this metric reward the
 * wrong thing.
 */
function scaleDistance(target, actual) {
    if (!target.length && !actual.length)
        return { distance: 0, note: 'no type scale on either side' };
    if (!target.length || !actual.length)
        return { distance: 1, note: 'one side has no type scale' };
    const sortedTarget = [...target].sort((a, b) => a - b);
    const sortedActual = [...actual].sort((a, b) => a - b);
    const span = (steps) => ({ low: steps[0], high: steps[steps.length - 1] });
    const targetSpan = span(sortedTarget);
    const actualSpan = span(sortedActual);
    const relative = (a, b) => Math.abs(a - b) / Math.max(1, a, b);
    const spanDistance = (relative(targetSpan.low, actualSpan.low) + relative(targetSpan.high, actualSpan.high)) / 2;
    // Do the generated sizes land on the target's scale? For each size actually
    // used, find its nearest step in the target and measure how far off it is.
    const nearestError = sortedActual.reduce((sum, value) => {
        const nearest = sortedTarget.reduce((best, step) => Math.abs(step - value) < Math.abs(best - value) ? step : best, sortedTarget[0]);
        return sum + relative(nearest, value);
    }, 0) / sortedActual.length;
    // A token penalty only, so a wildly different number of steps still registers.
    const countPenalty = Math.abs(sortedTarget.length - sortedActual.length) / Math.max(sortedTarget.length, sortedActual.length);
    return {
        distance: clamp01(spanDistance * 0.45 + nearestError * 0.45 + countPenalty * 0.1),
        note: `span ${Math.round(targetSpan.low)}–${Math.round(targetSpan.high)}px vs ${Math.round(actualSpan.low)}–${Math.round(actualSpan.high)}px, `
            + `off-scale by ${round(nearestError * 100, 1)}%`,
    };
}
export function profileDistance(target, actual) {
    const roleOf = (profile, role) => profile.color.palette.find((entry) => entry.role === role);
    const roles = ['surface', 'ink', 'accent', 'raised', 'muted'];
    const colourDistances = roles.map((role) => ({ role, value: colourDistance(roleOf(target, role), roleOf(actual, role)) }));
    const paletteDistance = colourDistances.reduce((sum, item) => sum + item.value, 0) / roles.length;
    const worstColour = [...colourDistances].sort((a, b) => b.value - a.value)[0];
    const scale = scaleDistance(target.type.scale.map((step) => step.px), actual.type.scale.map((step) => step.px));
    const baseDistance = target.space.base === actual.space.base ? 0
        : clamp01(Math.abs(target.space.base - actual.space.base) / Math.max(target.space.base, actual.space.base));
    const adherenceDistance = Math.abs(target.space.adherence - actual.space.adherence);
    const spaceDistance = clamp01(baseDistance * 0.6 + adherenceDistance * 0.4);
    const targetFlow = target.flow.sections.map((item) => item.archetype);
    const actualFlow = actual.flow.sections.map((item) => item.archetype);
    const flowDistance = sequenceDistance(targetFlow, actualFlow);
    const radiiDistance = (() => {
        const first = target.surface.radii[0];
        const second = actual.surface.radii[0];
        if (first === undefined && second === undefined)
            return 0;
        if (first === undefined || second === undefined)
            return 1;
        return clamp01(Math.abs(first - second) / Math.max(4, first, second));
    })();
    const axes = [
        { axis: 'palette', distance: round(paletteDistance), weight: FROAM_DISTANCE_WEIGHTS.palette, note: `worst role: ${worstColour.role} at ${round(worstColour.value, 2)}` },
        { axis: 'flow', distance: round(flowDistance), weight: FROAM_DISTANCE_WEIGHTS.flow, note: `${targetFlow.length} sections vs ${actualFlow.length}` },
        { axis: 'type', distance: round(scale.distance), weight: FROAM_DISTANCE_WEIGHTS.type, note: scale.note },
        { axis: 'space', distance: round(spaceDistance), weight: FROAM_DISTANCE_WEIGHTS.space, note: `base ${target.space.base}px vs ${actual.space.base}px` },
        { axis: 'mode', distance: target.color.modeSignal === actual.color.modeSignal ? 0 : 1, weight: FROAM_DISTANCE_WEIGHTS.mode, note: `${target.color.modeSignal} vs ${actual.color.modeSignal}` },
        { axis: 'density', distance: target.space.density === actual.space.density ? 0 : 1, weight: FROAM_DISTANCE_WEIGHTS.density, note: `${target.space.density} vs ${actual.space.density}` },
        { axis: 'surface', distance: round(radiiDistance), weight: FROAM_DISTANCE_WEIGHTS.surface, note: `radius ${target.surface.radii[0] ?? 'none'} vs ${actual.surface.radii[0] ?? 'none'}` },
    ];
    const totalWeight = axes.reduce((sum, axis) => sum + axis.weight, 0) || 1;
    return {
        total: round(axes.reduce((sum, axis) => sum + axis.distance * axis.weight, 0) / totalWeight),
        axes,
    };
}
//# sourceMappingURL=profile-distance.js.map