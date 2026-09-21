/**
 * Froam Judge — Tier 1, deterministic.
 *
 * Exact measurements over page profiles. No model, no network, no randomness:
 * the same two profiles always produce the same verdict, and every verdict
 * carries the number that produced it.
 *
 * Design rules this file exists to enforce:
 *
 * 1. Never ask a model something computable. Contrast, grid adherence, scale
 *    consistency and drift are arithmetic. Routing them through a vision model
 *    converts an exact answer into a noisy one and pays for the privilege.
 * 2. Normative checks veto. WCAG contrast is a published standard, not taste.
 *    When a change pushes text under its required ratio the verdict is
 *    'worse' — there is no weighing and no further debate.
 * 3. Equivalence and abstention are outcomes. Forcing a verdict on a pair that
 *    is genuinely tied, or on profiles that are not comparable, manufactures
 *    noise which downstream induction then learns as signal.
 * 4. Weights are stated policy, not discovered truth. They are exported so
 *    they can be inspected, argued with and changed — and every change
 *    requires bumping FROAM_JUDGE_VERSION, because verdicts from two versions
 *    are not comparable.
 */
import { FROAM_MIN_TARGET_PX } from './page-profile.js';
/**
 * Bump on any change to checks, weights or thresholds. Verdicts are only
 * comparable within a version.
 *
 * v2 — touch-targets measures WCAG 2.5.8 geometry instead of proxying through
 * accessibility warning counts, those warnings moved to their own non-normative
 * check, and the confidence curve was recalibrated against the gold set
 * (ECE 0.118 → 0.050).
 */
export const FROAM_JUDGE_VERSION = 'froam-deterministic-judge-v2';
/**
 * Stated policy. Normative checks carry more weight because they are the ones
 * with an external standard behind them; taste-adjacent checks are kept light
 * on purpose so no single preference can dominate a verdict.
 */
export const FROAM_JUDGE_WEIGHTS = {
    contrast: 3,
    'touch-targets': 2,
    'spacing-grid': 2,
    'token-drift': 2,
    'accent-discipline': 1.5,
    'type-scale': 1.5,
    accessibility: 1.5,
    'component-variance': 1,
    measure: 1,
    'radius-consistency': 0.5,
    'shadow-tiers': 0.5,
};
/** Score deltas smaller than this are noise, not improvement. */
export const FROAM_JUDGE_EQUIVALENCE_BAND = 0.01;
/** Minimum coverage before two profiles may be compared at all. */
export const FROAM_JUDGE_MIN_COVERAGE = 0.5;
/** Maximum relative difference in rendered node count before profiles are treated as different pages. */
export const FROAM_JUDGE_MAX_SIZE_DRIFT = 0.4;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const round = (value, places = 4) => Math.round(value * 10 ** places) / 10 ** places;
/**
 * Map a score margin to a stated confidence.
 *
 * The previous form — margin / (band × 4), linear from zero — was invented, and
 * the gold set showed it: on material breaks the judge was correct in 100% of
 * cases while stating 0.34 and 0.51, an expected calibration error of 0.118
 * driven entirely by underconfidence. Systematically underclaiming is not the
 * safe direction. Downstream code multiplies by this number, so understating it
 * discards verdicts that were right.
 *
 * This measurement is deterministic, so the uncertainty is not in the arithmetic
 * — it is in whether a given score movement reflects a real quality change. The
 * gold set says: once outside the noise band, it does. The curve therefore
 * starts at 0.6 at the band edge (a margin barely distinguishable from noise)
 * and saturates toward the 0.95 ceiling, which only a normative veto may exceed.
 *
 * Re-derive this against the gold set whenever checks or weights change; a
 * calibration fitted to one judge version does not transfer to the next.
 */
export const FROAM_CONFIDENCE_FLOOR = 0.6;
export const FROAM_CONFIDENCE_CEILING = 0.95;
export function confidenceForMargin(margin, band = FROAM_JUDGE_EQUIVALENCE_BAND) {
    if (margin < band)
        return round(clamp01(1 - margin / band));
    const excess = (margin - band) / band;
    return round(Math.min(FROAM_CONFIDENCE_CEILING, FROAM_CONFIDENCE_FLOOR + (FROAM_CONFIDENCE_CEILING - FROAM_CONFIDENCE_FLOOR + 0.05) * (1 - Math.exp(-excess))));
}
/** Linear score that is 1 inside [low, high] and decays to 0 at the given margins. */
function band(value, low, high, softness) {
    if (value >= low && value <= high)
        return 1;
    const distance = value < low ? low - value : value - high;
    return clamp01(1 - distance / softness);
}
// ── checks ──────────────────────────────────────────────────────────────────
function checkContrast(profile) {
    const { contrastFailures, contrastSamples, contrastFloor } = profile.color;
    const failureRate = contrastSamples > 0 ? contrastFailures.length / contrastSamples : 0;
    const findings = contrastFailures.slice(0, 20).map((pair) => ({
        id: `contrast:${pair.nodeId}`,
        check: 'contrast',
        severity: 'veto',
        summary: `${pair.role} text renders at ${pair.ratio}:1 against its background, below the WCAG AA floor of ${pair.required}:1`,
        measured: pair.ratio,
        threshold: pair.required,
        evidence: { nodeId: pair.nodeId, largeText: pair.largeText },
    }));
    if (contrastSamples === 0)
        return { id: 'contrast', score: 1, weight: FROAM_JUDGE_WEIGHTS.contrast, normative: true, findings: [] };
    return {
        id: 'contrast',
        score: round(clamp01(1 - failureRate)),
        weight: FROAM_JUDGE_WEIGHTS.contrast,
        normative: true,
        findings: findings.length
            ? [{
                    id: 'contrast:summary',
                    check: 'contrast',
                    severity: 'veto',
                    summary: `${contrastFailures.length} of ${contrastSamples} text elements fail WCAG AA contrast; the worst renders at ${contrastFloor}:1`,
                    measured: contrastFloor,
                    threshold: 4.5,
                    evidence: { failures: contrastFailures.length, samples: contrastSamples },
                }, ...findings]
            : [],
    };
}
function checkTouchTargets(profile) {
    const { targetSamples, undersizedTargets, smallestTargetPx, exemptInlineTargets } = profile.interaction;
    if (targetSamples === 0)
        return { id: 'touch-targets', score: 1, weight: FROAM_JUDGE_WEIGHTS['touch-targets'], normative: true, findings: [] };
    const failureRate = undersizedTargets.length / targetSamples;
    const findings = undersizedTargets.slice(0, 20).map((target) => ({
        id: `touch-targets:${target.nodeId}`,
        check: 'touch-targets',
        severity: 'veto',
        summary: `${target.role === 'unknown' ? target.tag : target.role} target measures ${target.width}×${target.height}px; WCAG 2.5.8 requires a shortest side of ${FROAM_MIN_TARGET_PX}px`,
        measured: target.shortestSide,
        threshold: FROAM_MIN_TARGET_PX,
        evidence: { nodeId: target.nodeId, tag: target.tag },
    }));
    return {
        id: 'touch-targets',
        score: round(clamp01(1 - failureRate)),
        weight: FROAM_JUDGE_WEIGHTS['touch-targets'],
        normative: true,
        findings: findings.length
            ? [{
                    id: 'touch-targets:summary',
                    check: 'touch-targets',
                    severity: 'veto',
                    summary: `${undersizedTargets.length} of ${targetSamples} interactive targets are under ${FROAM_MIN_TARGET_PX}px; the smallest is ${smallestTargetPx}px`
                        + (exemptInlineTargets ? ` (${exemptInlineTargets} inline link${exemptInlineTargets === 1 ? '' : 's'} exempted)` : ''),
                    measured: smallestTargetPx,
                    threshold: FROAM_MIN_TARGET_PX,
                    evidence: { undersized: undersizedTargets.length, samples: targetSamples, exemptInlineTargets },
                }, ...findings]
            : [],
    };
}
/** Accessibility warnings the scan raised that no other check re-derives. */
function checkAccessibilityWarnings(profile) {
    const warnings = profile.quality.accessibilityWarnings;
    const nodes = Math.max(1, profile.provenance.nodesRendered);
    const rate = warnings / nodes;
    return {
        id: 'accessibility',
        score: round(clamp01(1 - rate * 4)),
        weight: FROAM_JUDGE_WEIGHTS.accessibility,
        normative: false,
        findings: warnings > 0 ? [{
                id: 'accessibility:summary',
                check: 'accessibility',
                severity: rate > 0.05 ? 'major' : 'minor',
                summary: `${warnings} accessibility warnings across ${nodes} rendered elements (${round(rate * 100, 1)}%)`,
                measured: warnings,
                threshold: 0,
                evidence: { rate: round(rate) },
            }] : [],
    };
}
/** Below this, the best-fitting base explains so little that calling it a grid misleads. */
export const FROAM_GRID_EXISTS_THRESHOLD = 0.5;
function checkSpacingGrid(profile) {
    const { adherence, base } = profile.space;
    // Naming a grid the page does not follow is worse than reporting none. A
    // page whose best fit is "5px at 10%" has no spacing system, and saying
    // "lands on the 5px grid 10% of the time" invites someone to defend a grid
    // that was never there.
    const gridHolds = adherence >= FROAM_GRID_EXISTS_THRESHOLD;
    const summary = gridHolds
        ? `spacing lands on the ${base}px grid ${round(adherence * 100, 1)}% of the time; ${round((1 - adherence) * 100, 1)}% of values are off-grid`
        : `no spacing grid holds; the closest fit (${base}px) explains only ${round(adherence * 100, 1)}% of values`;
    return {
        id: 'spacing-grid',
        score: round(adherence),
        weight: FROAM_JUDGE_WEIGHTS['spacing-grid'],
        normative: false,
        findings: adherence < 0.9 ? [{
                id: 'spacing-grid:summary',
                check: 'spacing-grid',
                severity: adherence < 0.7 ? 'major' : 'minor',
                summary,
                measured: round(adherence),
                threshold: 0.9,
                evidence: { base, gridHolds, scale: profile.space.scale },
            }] : [],
    };
}
function checkTokenDrift(profile) {
    const drift = profile.quality.tokenDrift;
    const unique = profile.quality.uniqueColors;
    const resolved = profile.color.palette.length;
    return {
        id: 'token-drift',
        score: round(clamp01(1 - drift)),
        weight: FROAM_JUDGE_WEIGHTS['token-drift'],
        normative: false,
        findings: drift > 0.05 ? [{
                id: 'token-drift:summary',
                check: 'token-drift',
                severity: drift > 0.15 ? 'major' : 'minor',
                summary: `${round(drift * 100, 1)}% of painted area falls outside the resolved palette; ${unique} distinct colours collapse to ${resolved} decisions`,
                measured: round(drift),
                threshold: 0.05,
                evidence: { uniqueColors: unique, paletteSize: resolved },
            }] : [],
    };
}
function checkAccentDiscipline(profile) {
    const discipline = profile.color.accentDiscipline;
    const accent = profile.color.palette.find((entry) => entry.role === 'accent');
    // 'unknown' is the scan saying it could not classify the element, not a role.
    // Printing it back as one would read like a finding about a element type.
    const strays = accent ? accent.appearsOn.filter((role) => role !== 'unknown' && !['cta', 'button', 'input', 'form'].includes(role)) : [];
    return {
        id: 'accent-discipline',
        score: round(discipline),
        weight: FROAM_JUDGE_WEIGHTS['accent-discipline'],
        normative: false,
        findings: discipline < 0.8 && accent ? [{
                id: 'accent-discipline:summary',
                check: 'accent-discipline',
                severity: discipline < 0.5 ? 'major' : 'minor',
                summary: `the accent ${accent.hex} carries action meaning only ${round(discipline * 100, 1)}% of the time; it also paints ${strays.join(', ') || 'non-action elements'}`,
                measured: round(discipline),
                threshold: 0.8,
                evidence: { accent: accent.hex, strayRoles: strays },
            }] : [],
    };
}
function checkTypeScale(profile) {
    const steps = profile.type.scale.length;
    const spread = profile.type.ratioSpread;
    // A usable scale has few steps that agree with each other. Both halves matter:
    // six steps at wildly different ratios is a list of sizes, not a scale.
    const stepScore = band(steps, 3, 7, 4);
    const spreadScore = profile.type.ratio === null ? 0.4 : clamp01(1 - spread / 0.25);
    const findings = [];
    if (steps > 7)
        findings.push({
            id: 'type-scale:steps',
            check: 'type-scale',
            severity: steps > 10 ? 'major' : 'minor',
            summary: `${steps} distinct type sizes are in use; a readable scale is usually 3–7 steps`,
            measured: steps,
            threshold: 7,
            evidence: { sizes: profile.type.scale.map((step) => step.px) },
        });
    if (profile.type.ratio === null && steps > 2)
        findings.push({
            id: 'type-scale:ratio',
            check: 'type-scale',
            severity: 'minor',
            summary: `no consistent ratio holds between type steps (spread ${spread}); the sizes do not form a scale`,
            measured: spread,
            threshold: 0.25,
            evidence: { sizes: profile.type.scale.map((step) => step.px) },
        });
    return { id: 'type-scale', score: round((stepScore + spreadScore) / 2), weight: FROAM_JUDGE_WEIGHTS['type-scale'], normative: false, findings };
}
function checkMeasure(profile) {
    const measure = profile.type.measureCh;
    if (!measure)
        return { id: 'measure', score: 1, weight: FROAM_JUDGE_WEIGHTS.measure, normative: false, findings: [] };
    return {
        id: 'measure',
        score: round(band(measure, 45, 85, 40)),
        weight: FROAM_JUDGE_WEIGHTS.measure,
        normative: false,
        findings: measure < 45 || measure > 85 ? [{
                id: 'measure:summary',
                check: 'measure',
                severity: measure > 110 || measure < 30 ? 'major' : 'minor',
                summary: `body text runs about ${measure} characters per line; comfortable reading is 45–85`,
                measured: measure,
                threshold: measure < 45 ? 45 : 85,
            }] : [],
    };
}
function checkRadiusConsistency(profile) {
    const count = profile.surface.radii.length;
    return {
        id: 'radius-consistency',
        score: round(band(count, 0, 3, 5)),
        weight: FROAM_JUDGE_WEIGHTS['radius-consistency'],
        normative: false,
        findings: count > 3 ? [{
                id: 'radius-consistency:summary',
                check: 'radius-consistency',
                severity: 'minor',
                summary: `${count} distinct corner radii are in use (${profile.surface.radii.join(', ')}px); a system usually holds 2–3`,
                measured: count,
                threshold: 3,
            }] : [],
    };
}
function checkShadowTiers(profile) {
    const tiers = profile.surface.shadowTiers;
    return {
        id: 'shadow-tiers',
        score: round(band(tiers, 0, 4, 6)),
        weight: FROAM_JUDGE_WEIGHTS['shadow-tiers'],
        normative: false,
        findings: tiers > 4 ? [{
                id: 'shadow-tiers:summary',
                check: 'shadow-tiers',
                severity: 'minor',
                summary: `${tiers} distinct shadow definitions are in use; elevation usually reads as 2–4 tiers`,
                measured: tiers,
                threshold: 4,
            }] : [],
    };
}
function checkComponentVariance(profile) {
    const families = profile.components.filter((family) => family.instances >= 2);
    if (!families.length)
        return { id: 'component-variance', score: 1, weight: FROAM_JUDGE_WEIGHTS['component-variance'], normative: false, findings: [] };
    const weighted = families.reduce((sum, family) => sum + family.variance * family.instances, 0) / families.reduce((sum, family) => sum + family.instances, 0);
    const worst = [...families].sort((a, b) => b.variance - a.variance)[0];
    return {
        id: 'component-variance',
        score: round(clamp01(1 - weighted)),
        weight: FROAM_JUDGE_WEIGHTS['component-variance'],
        normative: false,
        findings: weighted > 0.15 ? [{
                id: 'component-variance:summary',
                check: 'component-variance',
                severity: weighted > 0.35 ? 'major' : 'minor',
                summary: `repeated components disagree on spacing (weighted variance ${round(weighted, 3)}); worst is ${worst.role} across ${worst.instances} instances`,
                measured: round(weighted, 3),
                threshold: 0.15,
                evidence: { families: families.length },
            }] : [],
    };
}
const CHECKS = [
    checkContrast,
    checkTouchTargets,
    checkAccessibilityWarnings,
    checkSpacingGrid,
    checkTokenDrift,
    checkAccentDiscipline,
    checkTypeScale,
    checkMeasure,
    checkRadiusConsistency,
    checkShadowTiers,
    checkComponentVariance,
];
// ── audit ───────────────────────────────────────────────────────────────────
/**
 * Score one page on its own terms. This is the audit surface: every finding
 * states what was measured, what the threshold was, and why it matters.
 */
export function auditProfile(profile) {
    const checks = CHECKS.map((check) => check(profile));
    const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0) || 1;
    const score = checks.reduce((sum, check) => sum + check.score * check.weight, 0) / totalWeight;
    const severityRank = { veto: 0, major: 1, minor: 2, info: 3 };
    return {
        schemaVersion: 1,
        judgeVersion: FROAM_JUDGE_VERSION,
        origin: profile.origin,
        routeKey: profile.routeKey,
        score: round(score),
        checks,
        findings: checks.flatMap((check) => check.findings).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]),
    };
}
// ── compare ─────────────────────────────────────────────────────────────────
function comparability(before, after) {
    if (before.viewport !== after.viewport)
        return `viewports differ (${before.viewport} vs ${after.viewport}); profiles are not comparable`;
    if (before.provenance.coverage < FROAM_JUDGE_MIN_COVERAGE || after.provenance.coverage < FROAM_JUDGE_MIN_COVERAGE) {
        return `coverage below ${FROAM_JUDGE_MIN_COVERAGE} (${before.provenance.coverage} / ${after.provenance.coverage}); too little of the page rendered to judge`;
    }
    const sizeBefore = Math.max(1, before.provenance.nodesRendered);
    const sizeAfter = Math.max(1, after.provenance.nodesRendered);
    const drift = Math.abs(sizeAfter - sizeBefore) / Math.max(sizeBefore, sizeAfter);
    if (drift > FROAM_JUDGE_MAX_SIZE_DRIFT) {
        return `rendered node count changed by ${round(drift * 100, 1)}% (${sizeBefore} → ${sizeAfter}); this is a different page, not a revision`;
    }
    return null;
}
/**
 * Detect a normative regression: a published-standard check that was passing
 * and is now failing, or was failing and got materially worse. Taste-adjacent
 * checks never veto, however badly they move.
 */
function findVeto(before, after, beforeChecks, afterChecks) {
    const beforeFailures = before.color.contrastFailures.length;
    const afterFailures = after.color.contrastFailures.length;
    if (afterFailures > beforeFailures) {
        const worst = [...after.color.contrastFailures].sort((a, b) => a.ratio - b.ratio)[0];
        return {
            id: 'veto:contrast',
            check: 'contrast',
            severity: 'veto',
            summary: `WCAG AA contrast failures rose from ${beforeFailures} to ${afterFailures}; the worst now renders at ${worst?.ratio}:1 against a required ${worst?.required}:1`,
            measured: afterFailures,
            threshold: beforeFailures,
            evidence: { worstNodeId: worst?.nodeId, worstRatio: worst?.ratio },
        };
    }
    if (Number.isFinite(after.color.contrastFloor) && Number.isFinite(before.color.contrastFloor)
        && after.color.contrastFloor < 4.5 && after.color.contrastFloor < before.color.contrastFloor) {
        return {
            id: 'veto:contrast-floor',
            check: 'contrast',
            severity: 'veto',
            summary: `worst text contrast fell from ${before.color.contrastFloor}:1 to ${after.color.contrastFloor}:1, below the WCAG AA floor of 4.5:1`,
            measured: after.color.contrastFloor,
            threshold: 4.5,
        };
    }
    if (after.interaction.undersizedTargets.length > before.interaction.undersizedTargets.length) {
        const worst = [...after.interaction.undersizedTargets].sort((a, b) => a.shortestSide - b.shortestSide)[0];
        return {
            id: 'veto:touch-targets',
            check: 'touch-targets',
            severity: 'veto',
            summary: `interactive targets under ${FROAM_MIN_TARGET_PX}px rose from ${before.interaction.undersizedTargets.length} to ${after.interaction.undersizedTargets.length}; the smallest is now ${worst?.width}×${worst?.height}px`,
            measured: after.interaction.undersizedTargets.length,
            threshold: before.interaction.undersizedTargets.length,
            evidence: { worstNodeId: worst?.nodeId, shortestSide: worst?.shortestSide },
        };
    }
    for (const afterCheck of afterChecks.filter((check) => check.normative)) {
        const beforeCheck = beforeChecks.find((check) => check.id === afterCheck.id);
        if (!beforeCheck)
            continue;
        if (beforeCheck.score >= 0.99 && afterCheck.score < 0.95) {
            return {
                id: `veto:${afterCheck.id}`,
                check: afterCheck.id,
                severity: 'veto',
                summary: `${afterCheck.id} was clean and now scores ${afterCheck.score}; a standards check must not regress`,
                measured: afterCheck.score,
                threshold: 0.99,
            };
        }
    }
    return null;
}
/**
 * Compare two profiles. Returns 'equivalent' inside the noise band and
 * 'abstain' when the profiles cannot be meaningfully compared — neither is a
 * failure, and neither should be treated as a reason to roll back.
 */
export function compareProfiles(before, after) {
    const beforeAudit = auditProfile(before);
    const afterAudit = auditProfile(after);
    const deltas = afterAudit.checks.map((check) => {
        const previous = beforeAudit.checks.find((candidate) => candidate.id === check.id);
        return { id: check.id, before: previous?.score ?? 0, after: check.score, delta: round(check.score - (previous?.score ?? 0)), weight: check.weight };
    });
    const scoreDelta = round(afterAudit.score - beforeAudit.score);
    const base = {
        schemaVersion: 1,
        tier: 'deterministic',
        judgeVersion: FROAM_JUDGE_VERSION,
        scoreBefore: beforeAudit.score,
        scoreAfter: afterAudit.score,
        scoreDelta,
        deltas,
    };
    const blocked = comparability(before, after);
    if (blocked) {
        return { ...base, outcome: 'abstain', veto: null, confidence: 0, abstainReason: blocked, explain: [blocked] };
    }
    const veto = findVeto(before, after, beforeAudit.checks, afterAudit.checks);
    if (veto) {
        return { ...base, outcome: 'worse', veto, confidence: 1, abstainReason: null, explain: [veto.summary, 'A normative regression decides the verdict on its own; weighted scores were not consulted.'] };
    }
    const moved = deltas.filter((delta) => Math.abs(delta.delta) >= 0.005).sort((a, b) => Math.abs(b.delta * b.weight) - Math.abs(a.delta * a.weight));
    const explain = moved.slice(0, 5).map((delta) => `${delta.id}: ${delta.before} → ${delta.after} (${delta.delta >= 0 ? '+' : ''}${delta.delta}, weight ${delta.weight})`);
    if (Math.abs(scoreDelta) < FROAM_JUDGE_EQUIVALENCE_BAND) {
        return {
            ...base,
            outcome: 'equivalent',
            veto: null,
            confidence: round(clamp01(1 - Math.abs(scoreDelta) / FROAM_JUDGE_EQUIVALENCE_BAND)),
            abstainReason: null,
            explain: [`score moved ${scoreDelta}, inside the ±${FROAM_JUDGE_EQUIVALENCE_BAND} noise band`, ...explain],
        };
    }
    const confidence = confidenceForMargin(Math.abs(scoreDelta));
    return {
        ...base,
        outcome: scoreDelta > 0 ? 'better' : 'worse',
        veto: null,
        confidence,
        abstainReason: null,
        explain,
    };
}
//# sourceMappingURL=judge-deterministic.js.map