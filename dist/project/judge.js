import { auditProfile, compareProfiles } from './judge-deterministic.js';
import { applyPriors } from './judge-priors.js';
export const FROAM_COMPOSED_JUDGE_VERSION = 'froam-judge-v1';
const SEVERITY_RANK = { veto: 0, major: 1, minor: 2, info: 3 };
/**
 * Audit one page across both tiers.
 *
 * This is the report surface: everything a reader needs to act, with each
 * finding carrying the measurement or the evidence that produced it.
 */
export function judgePage(profile, priors = []) {
    const deterministic = auditProfile(profile);
    const priorViolations = applyPriors(profile, priors);
    return {
        schemaVersion: 1,
        judgeVersion: FROAM_COMPOSED_JUDGE_VERSION,
        deterministic,
        priorViolations,
        priorsEvaluated: priors.length,
        findings: [...deterministic.findings, ...priorViolations].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
        // Tier 1 alone. Folding advisory evidence into the headline number would
        // make the score move when the corpus changes rather than when the page does.
        score: deterministic.score,
    };
}
/**
 * Compare two pages across both tiers.
 *
 * The outcome is Tier 1's, unchanged. Priors only annotate which corpus
 * regularities the change resolved or introduced, so a reviewer can see them
 * without the verdict having been bent by them.
 */
export function judgeChange(before, after, priors = []) {
    const verdict = compareProfiles(before, after);
    const beforeViolations = applyPriors(before, priors);
    const afterViolations = applyPriors(after, priors);
    const beforeIds = new Set(beforeViolations.map((violation) => violation.priorId));
    const afterIds = new Set(afterViolations.map((violation) => violation.priorId));
    return {
        ...verdict,
        composedJudgeVersion: FROAM_COMPOSED_JUDGE_VERSION,
        priorDelta: {
            resolved: beforeViolations.filter((violation) => !afterIds.has(violation.priorId)),
            introduced: afterViolations.filter((violation) => !beforeIds.has(violation.priorId)),
        },
        priorsEvaluated: priors.length,
    };
}
/**
 * Render a report as plain text.
 *
 * Deliberately not marketing copy: every line states a measurement and the
 * threshold it was measured against, because a claim a reader cannot check is
 * one they should not trust.
 */
export function formatJudgeReport(report, input = {}) {
    const origin = input.origin ?? report.deterministic.origin;
    const routeKey = input.routeKey ?? report.deterministic.routeKey;
    const lines = [
        `${origin}${routeKey}`,
        `score ${(report.score * 100).toFixed(1)}/100   ${report.judgeVersion} · ${report.deterministic.judgeVersion}`,
        '',
    ];
    const vetoes = report.findings.filter((finding) => finding.severity === 'veto');
    const majors = report.findings.filter((finding) => finding.severity === 'major');
    const minors = report.findings.filter((finding) => finding.severity === 'minor');
    const section = (title, findings) => {
        if (!findings.length)
            return;
        lines.push(`${title} (${findings.length})`);
        for (const finding of findings)
            lines.push(`  · ${finding.summary}`);
        lines.push('');
    };
    section('Standards violations', vetoes);
    section('Significant', majors);
    section('Minor', minors);
    if (!report.findings.length)
        lines.push('No findings. Every check passed at its stated threshold.', '');
    lines.push(`checks: ${report.deterministic.checks.map((check) => `${check.id} ${(check.score * 100).toFixed(0)}`).join('  ')}`);
    if (report.priorsEvaluated)
        lines.push(`priors evaluated: ${report.priorsEvaluated}, violated: ${report.priorViolations.length}`);
    return lines.join('\n');
}
//# sourceMappingURL=judge.js.map