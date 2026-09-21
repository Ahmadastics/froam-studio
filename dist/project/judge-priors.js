export const FROAM_PRIORS_VERSION = 'froam-induced-priors-v1';
/** Flatten a profile into the axes priors may be induced over. Null-valued axes are omitted, never defaulted. */
export function profileFeatures(profile) {
    const numeric = {
        'type.steps': profile.type.scale.length,
        'type.measureCh': profile.type.measureCh,
        'type.families': profile.type.families.length,
        'space.base': profile.space.base,
        'space.adherence': profile.space.adherence,
        'color.paletteSize': profile.color.palette.length,
        'color.accentDiscipline': profile.color.accentDiscipline,
        'surface.radii': profile.surface.radii.length,
        'surface.shadowTiers': profile.surface.shadowTiers,
        'quality.tokenDrift': profile.quality.tokenDrift,
        'quality.spacingDrift': profile.quality.spacingDrift,
        'flow.sections': profile.flow.sections.length,
    };
    if (profile.type.ratio !== null)
        numeric['type.ratio'] = profile.type.ratio;
    if (Number.isFinite(profile.color.contrastFloor))
        numeric['color.contrastFloor'] = profile.color.contrastFloor;
    const categorical = {
        'color.modeSignal': profile.color.modeSignal,
        'space.density': profile.space.density,
        'flow.signature': profile.flow.signature || 'empty',
    };
    const primaryFamily = profile.type.families[0];
    if (primaryFamily)
        categorical['type.primaryFamilyRole'] = primaryFamily.role;
    return { numeric, categorical };
}
/** Scopes a prior may be conditioned on. The global scope is always first. */
export function candidateScopes(profiles) {
    const scopes = [{ key: 'global', feature: null, value: null }];
    const conditionOn = ['color.modeSignal', 'space.density', 'type.primaryFamilyRole'];
    const seen = new Set();
    for (const profile of profiles) {
        const { categorical } = profileFeatures(profile);
        for (const feature of conditionOn) {
            const value = categorical[feature];
            if (!value)
                continue;
            const key = `${feature}=${value}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            scopes.push({ key, feature, value });
        }
    }
    return scopes;
}
const inScope = (profile, scope) => scope.feature === null || profileFeatures(profile).categorical[scope.feature] === scope.value;
// ── split ───────────────────────────────────────────────────────────────────
/** FNV-1a. Used only to make the train/hold-out split deterministic and reproducible. */
function hashString(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1)
        hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
    return hash >>> 0;
}
/**
 * Split by origin, never by page.
 *
 * Pages from one site share a palette, a scale and a grid. Splitting on pages
 * puts the answer on both sides of the split, and every induced prior scores
 * near-perfectly while having learned nothing that transfers.
 */
export function splitByOrigin(profiles, holdOutFraction = 0.3) {
    const origins = [...new Set(profiles.map((profile) => profile.origin))];
    const holdOutOrigins = new Set(origins.filter((origin) => (hashString(origin) % 1000) / 1000 < holdOutFraction));
    // Never hand back an empty hold-out: an unscored prior must not be shippable.
    if (holdOutOrigins.size === 0 && origins.length > 1) {
        holdOutOrigins.add([...origins].sort((a, b) => hashString(a) - hashString(b))[0]);
    }
    return {
        train: profiles.filter((profile) => !holdOutOrigins.has(profile.origin)),
        holdOut: profiles.filter((profile) => holdOutOrigins.has(profile.origin)),
        holdOutOrigins: [...holdOutOrigins],
    };
}
// ── statistics ──────────────────────────────────────────────────────────────
function quantile(sorted, fraction) {
    if (!sorted.length)
        return 0;
    const position = (sorted.length - 1) * fraction;
    const low = Math.floor(position), high = Math.ceil(position);
    return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}
const round = (value, places = 4) => Math.round(value * 10 ** places) / 10 ** places;
function evaluateRange(profiles, feature, low, high) {
    const values = profiles.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined);
    const held = values.filter((value) => value >= low && value <= high).length;
    return { accuracy: values.length ? held / values.length : 0, evaluated: values.length };
}
function evaluateDominance(profiles, feature, value) {
    const values = profiles.map((profile) => profileFeatures(profile).categorical[feature]).filter((item) => item !== undefined);
    const held = values.filter((item) => item === value).length;
    return { accuracy: values.length ? held / values.length : 0, evaluated: values.length };
}
const scopePhrase = (scope) => scope.feature === null ? '' : ` when ${scope.feature} is ${scope.value}`;
/** Cap for lift against a vacuous baseline, so a prior stays JSON-serialisable. */
export const FROAM_MAX_LIFT = 99;
/**
 * A prior is worth keeping when it is both accurate and narrow. Either alone is
 * trivially gameable: a range admitting every value is always right, and a
 * razor-thin range is narrow and always wrong.
 */
const utility = (accuracy, informativeness) => accuracy * informativeness;
function liftOf(accuracy, informativeness, baselineAccuracy, baselineInformativeness) {
    const value = utility(accuracy, informativeness);
    const baseline = utility(baselineAccuracy, baselineInformativeness);
    if (baseline > 0)
        return round(Math.min(FROAM_MAX_LIFT, value / baseline));
    return value > 0 ? FROAM_MAX_LIFT : 0;
}
/**
 * Induce priors from a profile corpus.
 *
 * Returns the kept priors *and* everything pruned with its reason, because what
 * failed to generalise is as informative as what did.
 */
export function inducePriors(profiles, options = {}) {
    const minSupport = options.minSupport ?? 5;
    const minHeldOutAccuracy = options.minHeldOutAccuracy ?? 0.7;
    const minInformativeness = options.minInformativeness ?? 0.2;
    const minLift = options.minLift ?? 1.02;
    const now = options.now ?? Date.now();
    const { train, holdOut, holdOutOrigins } = splitByOrigin(profiles, options.holdOutFraction ?? 0.3);
    const trainOrigins = new Set(train.map((profile) => profile.origin)).size;
    const scopes = candidateScopes(train);
    const globalScope = scopes[0];
    const numericFeatures = [...new Set(train.flatMap((profile) => Object.keys(profileFeatures(profile).numeric)))];
    const categoricalFeatures = [...new Set(train.flatMap((profile) => Object.keys(profileFeatures(profile).categorical)))];
    // Global observed span per numeric feature, used to measure how much a prior excludes.
    const globalSpan = new Map();
    for (const feature of numericFeatures) {
        const values = train.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined);
        if (values.length)
            globalSpan.set(feature, { min: Math.min(...values), max: Math.max(...values) });
    }
    const candidates = [];
    for (const scope of scopes) {
        const scopedTrain = train.filter((profile) => inScope(profile, scope));
        const scopedHoldOut = holdOut.filter((profile) => inScope(profile, scope));
        if (scopedTrain.length < minSupport)
            continue;
        for (const feature of numericFeatures) {
            const values = scopedTrain.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined).sort((a, b) => a - b);
            if (values.length < minSupport)
                continue;
            const low = round(quantile(values, 0.1), 3);
            const high = round(quantile(values, 0.9), 3);
            if (!(high > low) && !(high === low && values.every((value) => value === low)))
                continue;
            const trainEval = evaluateRange(scopedTrain, feature, low, high);
            const holdOutEval = evaluateRange(scopedHoldOut, feature, low, high);
            // Baseline: the unscoped prior, evaluated on exactly the same held-out pages.
            const globalValues = train.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined).sort((a, b) => a - b);
            const baselineLow = round(quantile(globalValues, 0.1), 3);
            const baselineHigh = round(quantile(globalValues, 0.9), 3);
            const baselineEval = evaluateRange(scopedHoldOut, feature, baselineLow, baselineHigh);
            const span = globalSpan.get(feature);
            const spanWidth = span ? span.max - span.min : 0;
            const informativeness = spanWidth > 0 ? round(Math.min(1, Math.max(0, 1 - (high - low) / spanWidth))) : 1;
            const baselineInformativeness = spanWidth > 0 ? round(Math.min(1, Math.max(0, 1 - (baselineHigh - baselineLow) / spanWidth))) : 1;
            const counterExamples = scopedHoldOut
                .filter((profile) => {
                const value = profileFeatures(profile).numeric[feature];
                return value !== undefined && (value < low || value > high);
            })
                .map((profile) => profile.origin);
            candidates.push({
                scoped: scope.feature !== null,
                prior: {
                    id: `prior:range:${scope.key}:${feature}`,
                    kind: 'range',
                    claim: `${feature} falls between ${low} and ${high}${scopePhrase(scope)} (observed in ${Math.round(trainEval.accuracy * 100)}% of ${scopedTrain.length} pages)`,
                    feature,
                    scope,
                    range: { low, high },
                    value: null,
                    support: scopedTrain.length,
                    holdRate: round(trainEval.accuracy),
                    heldOutAccuracy: round(holdOutEval.accuracy),
                    baselineAccuracy: round(baselineEval.accuracy),
                    baselineInformativeness,
                    lift: scope.feature === null ? 1 : liftOf(holdOutEval.accuracy, informativeness, baselineEval.accuracy, baselineInformativeness),
                    informativeness,
                    counterExamples: [...new Set(counterExamples)],
                    inducedAt: now,
                    priorsVersion: FROAM_PRIORS_VERSION,
                },
            });
        }
        for (const feature of categoricalFeatures) {
            if (scope.feature === feature)
                continue;
            const counts = new Map();
            for (const profile of scopedTrain) {
                const value = profileFeatures(profile).categorical[feature];
                if (value !== undefined)
                    counts.set(value, (counts.get(value) ?? 0) + 1);
            }
            const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
            if (total < minSupport || counts.size === 0)
                continue;
            const [modal, modalCount] = [...counts].sort((a, b) => b[1] - a[1])[0];
            const trainEval = { accuracy: modalCount / total };
            const holdOutEval = evaluateDominance(scopedHoldOut, feature, modal);
            const globalCounts = new Map();
            for (const profile of train) {
                const value = profileFeatures(profile).categorical[feature];
                if (value !== undefined)
                    globalCounts.set(value, (globalCounts.get(value) ?? 0) + 1);
            }
            const globalTotal = [...globalCounts.values()].reduce((sum, count) => sum + count, 0) || 1;
            const globalModal = [...globalCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? modal;
            const baselineEval = evaluateDominance(scopedHoldOut, feature, globalModal);
            // How much uncertainty the claim removes. Predicting the value that is
            // already 90% likely everywhere is nearly free; predicting a minority
            // value that dominates inside this scope is where the information is.
            const baseRate = (value) => (globalCounts.get(value) ?? 0) / globalTotal;
            const informativeness = round(Math.max(0, 1 - baseRate(modal)));
            const baselineInformativeness = round(Math.max(0, 1 - baseRate(globalModal)));
            const counterExamples = scopedHoldOut
                .filter((profile) => profileFeatures(profile).categorical[feature] !== modal)
                .map((profile) => profile.origin);
            candidates.push({
                scoped: scope.feature !== null,
                prior: {
                    id: `prior:dominance:${scope.key}:${feature}`,
                    kind: 'dominance',
                    claim: `${feature} is "${modal}"${scopePhrase(scope)} (observed in ${Math.round(trainEval.accuracy * 100)}% of ${total} pages)`,
                    feature,
                    scope,
                    range: null,
                    value: modal,
                    support: total,
                    holdRate: round(trainEval.accuracy),
                    heldOutAccuracy: round(holdOutEval.accuracy),
                    baselineAccuracy: round(baselineEval.accuracy),
                    baselineInformativeness,
                    lift: scope.feature === null ? 1 : liftOf(holdOutEval.accuracy, informativeness, baselineEval.accuracy, baselineInformativeness),
                    informativeness,
                    counterExamples: [...new Set(counterExamples)],
                    inducedAt: now,
                    priorsVersion: FROAM_PRIORS_VERSION,
                },
            });
        }
    }
    const kept = [];
    const pruned = [];
    for (const candidate of candidates) {
        const { prior, scoped } = candidate;
        const drop = (reason) => pruned.push({ id: prior.id, reason, lift: prior.lift, informativeness: prior.informativeness, heldOutAccuracy: prior.heldOutAccuracy });
        if (prior.heldOutAccuracy < minHeldOutAccuracy) {
            drop(`held-out accuracy ${prior.heldOutAccuracy} below ${minHeldOutAccuracy}`);
            continue;
        }
        if (prior.informativeness < minInformativeness) {
            drop(`informativeness ${prior.informativeness} below ${minInformativeness} — admits nearly everything`);
            continue;
        }
        if (scoped && prior.lift < minLift) {
            drop(`lift ${prior.lift} below ${minLift} — conditioning on ${prior.scope.key} adds nothing over the global prior`);
            continue;
        }
        kept.push(prior);
    }
    return {
        priorsVersion: FROAM_PRIORS_VERSION,
        trainOrigins,
        holdOutOrigins: holdOutOrigins.length,
        candidates: candidates.length,
        kept: kept.length,
        pruned,
        priors: kept.sort((a, b) => b.informativeness * b.heldOutAccuracy - a.informativeness * a.heldOutAccuracy),
    };
}
/**
 * Score a page against induced priors.
 *
 * Every violation cites its evidence — how many pages the prior was induced
 * from, how it scored on pages it never saw, and the origins where it failed.
 * A claim Froam cannot support this way should not be made.
 */
export function applyPriors(profile, priors) {
    const features = profileFeatures(profile);
    const violations = [];
    for (const prior of priors) {
        if (!inScope(profile, prior.scope))
            continue;
        if (prior.kind === 'range' && prior.range) {
            const value = features.numeric[prior.feature];
            if (value === undefined || (value >= prior.range.low && value <= prior.range.high))
                continue;
            violations.push({
                id: `${prior.id}:violation`,
                priorId: prior.id,
                check: 'induced-prior',
                // Severity tracks evidence strength, not how strongly anyone feels about it.
                severity: prior.heldOutAccuracy >= 0.85 && prior.support >= 20 ? 'major' : 'minor',
                summary: `${prior.feature} is ${value}, outside the ${prior.range.low}–${prior.range.high} range that held on ${Math.round(prior.heldOutAccuracy * 100)}% of ${prior.support} comparable pages${scopePhrase(prior.scope)}`,
                measured: value,
                threshold: value < prior.range.low ? prior.range.low : prior.range.high,
                heldOutAccuracy: prior.heldOutAccuracy,
                support: prior.support,
                counterExamples: prior.counterExamples,
                evidence: { lift: prior.lift, informativeness: prior.informativeness, counterExamples: prior.counterExamples.length },
            });
            continue;
        }
        if (prior.kind === 'dominance' && prior.value !== null) {
            const value = features.categorical[prior.feature];
            if (value === undefined || value === prior.value)
                continue;
            violations.push({
                id: `${prior.id}:violation`,
                priorId: prior.id,
                check: 'induced-prior',
                severity: prior.heldOutAccuracy >= 0.85 && prior.support >= 20 ? 'major' : 'minor',
                summary: `${prior.feature} is "${value}" where "${prior.value}" held on ${Math.round(prior.heldOutAccuracy * 100)}% of ${prior.support} comparable pages${scopePhrase(prior.scope)}`,
                measured: 0,
                threshold: 0,
                heldOutAccuracy: prior.heldOutAccuracy,
                support: prior.support,
                counterExamples: prior.counterExamples,
                evidence: { observed: value, expected: prior.value, lift: prior.lift, counterExamples: prior.counterExamples.length },
            });
        }
    }
    return violations.sort((a, b) => b.heldOutAccuracy * b.support - a.heldOutAccuracy * a.support);
}
//# sourceMappingURL=judge-priors.js.map