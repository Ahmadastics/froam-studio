import { isCorrect } from './pretext.js';
export function runPredictor(predictor, tasks) {
    return tasks.map((task) => ({ taskId: task.id, answer: predictor.predict(task) }));
}
// ── baselines ───────────────────────────────────────────────────────────────
/**
 * Answer whatever is most common for this task kind in training.
 *
 * This is the baseline that matters. "Always say hero for the first section"
 * is right most of the time, and any predictor that cannot beat it has learned
 * nothing beyond the shape of the distribution.
 */
export function fitMajorityBaseline(trainingTasks) {
    const byKind = new Map();
    for (const task of trainingTasks) {
        const counts = byKind.get(task.kind) ?? new Map();
        counts.set(task.answer, (counts.get(task.answer) ?? 0) + 1);
        byKind.set(task.kind, counts);
    }
    const modal = new Map();
    for (const [kind, counts] of byKind) {
        modal.set(kind, [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0]);
    }
    // Numeric kinds take the training median rather than the modal value: sizes
    // rarely repeat exactly, so a mode over floats is an accident.
    for (const [kind, counts] of byKind) {
        const values = [...counts.keys()].filter((value) => typeof value === 'number');
        if (values.length && values.length === counts.size) {
            const sorted = [...values].sort((a, b) => a - b);
            modal.set(kind, sorted[sorted.length >> 1]);
        }
    }
    return { name: 'majority', predict: (task) => modal.get(task.kind) ?? null };
}
/** Deterministic uniform choice. Present as a floor, not as a serious opponent. */
export function uniformBaseline(seed = 1) {
    return {
        name: 'uniform',
        predict(task) {
            if (!task.choices || !task.choices.length)
                return null;
            let hash = seed >>> 0;
            for (let index = 0; index < task.id.length; index += 1)
                hash = Math.imul(hash ^ task.id.charCodeAt(index), 0x01000193) >>> 0;
            return task.choices[hash % task.choices.length];
        },
    };
}
const bump = (map, key, value) => {
    const counts = map.get(key) ?? new Map();
    counts.set(value, (counts.get(value) ?? 0) + 1);
    map.set(key, counts);
};
const argmax = (counts) => counts && counts.size ? [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] : null;
/** Position is bucketed so a 4-section page and a 9-section page can inform each other. */
const positionBucket = (index, total) => {
    if (total <= 1)
        return 'only';
    if (index === 0)
        return 'first';
    if (index === total - 1)
        return 'last';
    const ratio = index / (total - 1);
    return ratio < 0.34 ? 'early' : ratio < 0.67 ? 'middle' : 'late';
};
/**
 * Fit a model from training profiles.
 *
 * Nothing here is hand-written knowledge about design. The transition table,
 * the positional frequencies and the interpolation rule are all read off the
 * corpus, so the model changes when the corpus does — which is the difference
 * between a learned prior and a rule with a confidence field bolted on.
 */
export function fitCorpusModel(profiles) {
    const transitions = new Map();
    const positional = new Map();
    const geometry = [];
    const accentRoles = new Map();
    const densityExamples = [];
    let geometricError = 0;
    let arithmeticError = 0;
    let interpolationSamples = 0;
    for (const profile of profiles) {
        const sections = profile.flow.sections;
        sections.forEach((section, index) => {
            if (index > 0)
                bump(transitions, sections[index - 1].archetype, section.archetype);
            bump(positional, positionBucket(index, sections.length), section.archetype);
            geometry.push({
                columns: section.grid.columns,
                heightRatio: section.heightRatio,
                isFirst: index === 0,
                isLast: index === sections.length - 1,
                archetype: section.archetype,
            });
        });
        const accent = profile.color.palette.find((entry) => entry.role === 'accent');
        for (const role of accent?.appearsOn ?? [])
            if (role !== 'unknown')
                accentRoles.set(role, (accentRoles.get(role) ?? 0) + 1);
        if (profile.type.scale.length) {
            const steps = profile.type.scale.map((step) => step.px);
            densityExamples.push({
                medianStep: steps[steps.length >> 1],
                measureCh: profile.type.measureCh,
                paletteSize: profile.color.palette.length,
                density: profile.space.density,
            });
            // Which interpolation actually describes real type scales? Measured, not assumed.
            for (let index = 1; index < steps.length - 1; index += 1) {
                const geometric = Math.sqrt(steps[index - 1] * steps[index + 1]);
                const arithmetic = (steps[index - 1] + steps[index + 1]) / 2;
                geometricError += Math.abs(geometric - steps[index]) / steps[index];
                arithmeticError += Math.abs(arithmetic - steps[index]) / steps[index];
                interpolationSamples += 1;
            }
        }
    }
    return {
        transitions,
        positional,
        geometry,
        accentRoles,
        densityExamples,
        interpolation: geometricError <= arithmeticError ? 'geometric' : 'arithmetic',
        interpolationFit: {
            geometric: interpolationSamples ? geometricError / interpolationSamples : 0,
            arithmetic: interpolationSamples ? arithmeticError / interpolationSamples : 0,
        },
        trainedOn: profiles.length,
    };
}
export function corpusPredictor(model) {
    return {
        name: 'corpus',
        predict(task) {
            switch (task.kind) {
                case 'next-section': {
                    const input = task.input;
                    const previous = input.prefix[input.prefix.length - 1];
                    return argmax(model.transitions.get(previous))
                        ?? argmax(model.positional.get('middle'));
                }
                case 'section-infill': {
                    const input = task.input;
                    // Prefer the transition from the section immediately before the gap;
                    // fall back to what usually sits at this position.
                    const before = input.visible.find((section) => section.index === input.hiddenIndex - 1);
                    return (before ? argmax(model.transitions.get(before.archetype)) : null)
                        ?? argmax(model.positional.get(positionBucket(input.hiddenIndex, input.sectionCount)));
                }
                case 'blind-role': {
                    const input = task.input;
                    if (!model.geometry.length)
                        return null;
                    // Nearest neighbour over geometry. Position agreement dominates the
                    // distance because it is by far the strongest observed signal.
                    const scored = model.geometry.map((example) => ({
                        archetype: example.archetype,
                        distance: Math.abs(example.columns - input.columns) * 0.5
                            + Math.abs(example.heightRatio - input.heightRatio) * 2
                            + (example.isFirst === input.isFirst ? 0 : 3)
                            + (example.isLast === input.isLast ? 0 : 3),
                    })).sort((a, b) => a.distance - b.distance).slice(0, 5);
                    const votes = new Map();
                    for (const item of scored)
                        votes.set(item.archetype, (votes.get(item.archetype) ?? 0) + 1);
                    return argmax(votes);
                }
                case 'accent-placement':
                    return argmax(model.accentRoles);
                case 'scale-infill': {
                    const input = task.input;
                    const below = input.visibleSteps.filter((_, index) => index < input.hiddenIndex);
                    const above = input.visibleSteps.filter((_, index) => index >= input.hiddenIndex);
                    const previous = below[below.length - 1];
                    const next = above[0];
                    if (previous === undefined || next === undefined)
                        return null;
                    return model.interpolation === 'geometric' ? Math.sqrt(previous * next) : (previous + next) / 2;
                }
                case 'density-match': {
                    const input = task.input;
                    if (!model.densityExamples.length)
                        return null;
                    const medianStep = input.typeSteps[input.typeSteps.length >> 1] ?? 16;
                    const scored = model.densityExamples.map((example) => ({
                        density: example.density,
                        distance: Math.abs(example.medianStep - medianStep) / 8
                            + Math.abs(example.measureCh - input.measureCh) / 30
                            + Math.abs(example.paletteSize - input.paletteSize) / 4,
                    })).sort((a, b) => a.distance - b.distance).slice(0, 3);
                    const votes = new Map();
                    for (const item of scored)
                        votes.set(item.density, (votes.get(item.density) ?? 0) + 1);
                    return argmax(votes);
                }
                default:
                    return null;
            }
        },
    };
}
/**
 * What a predictor gets wrong, not just how often.
 *
 * An accuracy number says a predictor is weak. A confusion table says it calls
 * every three-column section a feature-grid, which is a fixable observation.
 */
export function diagnosePredictor(predictor, tasks) {
    const kinds = [...new Set(tasks.map((task) => task.kind))];
    return kinds.map((kind) => {
        const forKind = tasks.filter((task) => task.kind === kind);
        const confusions = new Map();
        let abstained = 0;
        for (const task of forKind) {
            const predicted = predictor.predict(task);
            if (predicted === null) {
                abstained += 1;
                continue;
            }
            if (isCorrect(task, predicted))
                continue;
            const key = `${task.answer}→${predicted}`;
            confusions.set(key, (confusions.get(key) ?? 0) + 1);
        }
        return {
            kind,
            tasks: forKind.length,
            abstainRate: forKind.length ? Math.round((abstained / forKind.length) * 1000) / 1000 : 0,
            confusions: [...confusions]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([key, count]) => ({ expected: key.split('→')[0], predicted: key.split('→')[1], count })),
        };
    });
}
//# sourceMappingURL=predictors.js.map