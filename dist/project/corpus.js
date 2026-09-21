import { auditProfile } from './judge-deterministic.js';
export const FROAM_CORPUS_SCHEMA_VERSION = 1;
/** Tiers priors may be induced from. Baseline and negative are evidence, not aspiration. */
export const FROAM_LEARNABLE_TIERS = ['reference', 'good'];
export function emptyCorpus() {
    return { schemaVersion: FROAM_CORPUS_SCHEMA_VERSION, entries: [] };
}
const keyOf = (profile) => `${profile.origin}|${profile.routeKey}|${profile.viewport}`;
/**
 * Add a profile, replacing any earlier capture of the same origin/route/viewport.
 *
 * `tier` is required. There is no default, because a default would be a silent
 * judgement about quality made by nobody.
 */
export function addToCorpus(corpus, profile, input) {
    const audit = auditProfile(profile);
    const entry = {
        profile,
        tier: input.tier,
        tags: [...new Set(input.tags ?? [])],
        addedAt: input.now ?? Date.now(),
        scoreAtIngest: audit.score,
        judgeVersion: audit.judgeVersion,
        ...(input.note ? { note: input.note } : {}),
    };
    const key = keyOf(profile);
    return { ...corpus, entries: [...corpus.entries.filter((existing) => keyOf(existing.profile) !== key), entry] };
}
export function removeOrigin(corpus, origin) {
    return { ...corpus, entries: corpus.entries.filter((entry) => entry.profile.origin !== origin) };
}
export function selectEntries(corpus, filter = {}) {
    return corpus.entries.filter((entry) => {
        if (filter.tiers && !filter.tiers.includes(entry.tier))
            return false;
        if (filter.viewport && entry.profile.viewport !== filter.viewport)
            return false;
        if (filter.modeSignal && entry.profile.color.modeSignal !== filter.modeSignal)
            return false;
        if (filter.origins && !filter.origins.includes(entry.profile.origin))
            return false;
        if (filter.tags && !filter.tags.every((tag) => entry.tags.includes(tag)))
            return false;
        if (filter.archetype && !entry.profile.flow.sections.some((section) => section.archetype === filter.archetype))
            return false;
        return true;
    });
}
/**
 * Profiles eligible for prior induction.
 *
 * Baseline and negative pages are deliberately excluded. They are useful for
 * scoring the judge and for contrast, but inducing "what is normal" from pages
 * nobody vouched for is how a corpus starts recommending the median.
 */
export function learnableProfiles(corpus) {
    return selectEntries(corpus, { tiers: FROAM_LEARNABLE_TIERS }).map((entry) => entry.profile);
}
/** Deliberately-retained bad pages, for contrast and for judge scoring. */
export function negativeProfiles(corpus) {
    return selectEntries(corpus, { tiers: ['negative'] }).map((entry) => entry.profile);
}
export function corpusStats(corpus) {
    const byTier = { reference: 0, good: 0, baseline: 0, negative: 0 };
    const byViewport = {};
    const byMode = {};
    const originCounts = new Map();
    let scoreTotal = 0;
    for (const entry of corpus.entries) {
        byTier[entry.tier] += 1;
        byViewport[entry.profile.viewport] = (byViewport[entry.profile.viewport] ?? 0) + 1;
        byMode[entry.profile.color.modeSignal] = (byMode[entry.profile.color.modeSignal] ?? 0) + 1;
        originCounts.set(entry.profile.origin, (originCounts.get(entry.profile.origin) ?? 0) + 1);
        scoreTotal += entry.scoreAtIngest;
    }
    return {
        entries: corpus.entries.length,
        origins: originCounts.size,
        byTier,
        byViewport,
        byMode,
        meanScore: corpus.entries.length ? Math.round((scoreTotal / corpus.entries.length) * 1000) / 1000 : 0,
        learnable: byTier.reference + byTier.good,
        multiPageOrigins: [...originCounts.values()].filter((count) => count > 1).length,
        judgeVersions: [...new Set(corpus.entries.map((entry) => entry.judgeVersion))].sort(),
    };
}
/**
 * Whether the corpus can support induction yet.
 *
 * Reported rather than assumed, because the failure mode of a thin corpus is
 * not an error — it is a confident prior induced from six pages that does not
 * survive contact with a seventh.
 */
export function corpusReadiness(corpus, input = {}) {
    const minOrigins = input.minOrigins ?? 8;
    const minLearnable = input.minLearnable ?? 12;
    const stats = corpusStats(corpus);
    const learnableOrigins = new Set(selectEntries(corpus, { tiers: FROAM_LEARNABLE_TIERS }).map((entry) => entry.profile.origin)).size;
    const blockers = [];
    const warnings = [];
    if (learnableOrigins < minOrigins)
        blockers.push(`${learnableOrigins} learnable origins, need ${minOrigins} — an origin-split hold-out needs sites to split`);
    if (stats.learnable < minLearnable)
        blockers.push(`${stats.learnable} learnable pages, need ${minLearnable}`);
    if (stats.judgeVersions.length > 1)
        blockers.push(`mixed judge versions (${stats.judgeVersions.join(', ')}) — scores across versions are not comparable, re-audit before inducing`);
    if (stats.byTier.reference === 0)
        warnings.push('no reference-tier pages: the corpus has no target to aim at, only an average to regress toward');
    if (stats.byTier.negative === 0)
        warnings.push('no negative-tier pages: without counter-examples there is no decision boundary');
    if (Object.keys(stats.byViewport).length === 1)
        warnings.push(`only ${Object.keys(stats.byViewport)[0]} captures: priors will not transfer across viewports`);
    if (stats.multiPageOrigins === 0 && stats.entries > 0)
        warnings.push('every origin has one page: within-site consistency cannot be measured');
    return { ready: blockers.length === 0, blockers, warnings };
}
/** Re-audit every entry under the current judge, reporting where ingest scores have drifted. */
export function reauditCorpus(corpus) {
    const drifted = [];
    const entries = corpus.entries.map((entry) => {
        const audit = auditProfile(entry.profile);
        const delta = Math.round((audit.score - entry.scoreAtIngest) * 1000) / 1000;
        if (Math.abs(delta) > 0.001 || audit.judgeVersion !== entry.judgeVersion) {
            drifted.push({ origin: entry.profile.origin, routeKey: entry.profile.routeKey, was: entry.scoreAtIngest, now: audit.score, delta });
        }
        return { ...entry, scoreAtIngest: audit.score, judgeVersion: audit.judgeVersion };
    });
    return { corpus: { ...corpus, entries }, drifted };
}
//# sourceMappingURL=corpus.js.map