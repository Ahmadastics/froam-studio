/**
 * Froam Judge — composition.
 *
 * One entry point over the tiers, with a strict authority order that exists to
 * stop the weakest evidence from overruling the strongest:
 *
 *   Tier 1  deterministic   published standards and exact measurement.
 *                           Vetoes. Decides the outcome.
 *   Tier 2  induced priors  what held across a corpus, with held-out accuracy.
 *                           Advises. Never decides, never vetoes.
 *
 * A prior is a statistical regularity — "84% of comparable pages did X". That
 * is genuinely useful and genuinely fallible, and the 16% are not defects. So a
 * prior may raise a finding, sharpen a report and explain a recommendation, but
 * it may never turn a measured improvement into a regression. Letting induction
 * override measurement is how a system ends up confidently enforcing the
 * average of whatever it happened to scan.
 *
 * Tier 3 (perceptual) is deliberately absent. It should only be added once it
 * has been scored on the same gold set and shown to beat Tier 1 on questions
 * Tier 1 cannot answer.
 */
import type { FroamPageProfile } from './page-profile'
import { auditProfile, compareProfiles, type FroamJudgeFinding, type FroamJudgeVerdict, type FroamPageAudit } from './judge-deterministic'
import { applyPriors, type FroamPrior, type FroamPriorViolation } from './judge-priors'

export const FROAM_COMPOSED_JUDGE_VERSION = 'froam-judge-v1'

export type FroamJudgeReport = {
  schemaVersion: 1
  judgeVersion: string
  /** Exact, standards-backed measurement. Authoritative. */
  deterministic: FroamPageAudit
  /** Corpus regularities this page departs from. Advisory. */
  priorViolations: FroamPriorViolation[]
  /** Priors evaluated, so a silent tier is distinguishable from an absent one. */
  priorsEvaluated: number
  /** Ordered for a reader: vetoes first, then majors, then advisory. */
  findings: FroamJudgeFinding[]
  /** Tier 1 score. Priors deliberately do not move it. */
  score: number
}

export type FroamComposedVerdict = FroamJudgeVerdict & {
  composedJudgeVersion: string
  /** Priors the change moved toward or away from. Context only. */
  priorDelta: {
    resolved: FroamPriorViolation[]
    introduced: FroamPriorViolation[]
  }
  priorsEvaluated: number
}

const SEVERITY_RANK: Record<FroamJudgeFinding['severity'], number> = { veto: 0, major: 1, minor: 2, info: 3 }

/**
 * Audit one page across both tiers.
 *
 * This is the report surface: everything a reader needs to act, with each
 * finding carrying the measurement or the evidence that produced it.
 */
export function judgePage(profile: FroamPageProfile, priors: readonly FroamPrior[] = []): FroamJudgeReport {
  const deterministic = auditProfile(profile)
  const priorViolations = applyPriors(profile, priors)
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
  }
}

/**
 * Compare two pages across both tiers.
 *
 * The outcome is Tier 1's, unchanged. Priors only annotate which corpus
 * regularities the change resolved or introduced, so a reviewer can see them
 * without the verdict having been bent by them.
 */
export function judgeChange(
  before: FroamPageProfile,
  after: FroamPageProfile,
  priors: readonly FroamPrior[] = [],
): FroamComposedVerdict {
  const verdict = compareProfiles(before, after)
  const beforeViolations = applyPriors(before, priors)
  const afterViolations = applyPriors(after, priors)
  const beforeIds = new Set(beforeViolations.map((violation) => violation.priorId))
  const afterIds = new Set(afterViolations.map((violation) => violation.priorId))
  return {
    ...verdict,
    composedJudgeVersion: FROAM_COMPOSED_JUDGE_VERSION,
    priorDelta: {
      resolved: beforeViolations.filter((violation) => !afterIds.has(violation.priorId)),
      introduced: afterViolations.filter((violation) => !beforeIds.has(violation.priorId)),
    },
    priorsEvaluated: priors.length,
  }
}

/**
 * Render a report as plain text.
 *
 * Deliberately not marketing copy: every line states a measurement and the
 * threshold it was measured against, because a claim a reader cannot check is
 * one they should not trust.
 */
export function formatJudgeReport(report: FroamJudgeReport, input: { origin?: string; routeKey?: string } = {}) {
  const origin = input.origin ?? report.deterministic.origin
  const routeKey = input.routeKey ?? report.deterministic.routeKey
  const lines: string[] = [
    `${origin}${routeKey}`,
    `score ${(report.score * 100).toFixed(1)}/100   ${report.judgeVersion} · ${report.deterministic.judgeVersion}`,
    '',
  ]
  const vetoes = report.findings.filter((finding) => finding.severity === 'veto')
  const majors = report.findings.filter((finding) => finding.severity === 'major')
  const minors = report.findings.filter((finding) => finding.severity === 'minor')

  const section = (title: string, findings: FroamJudgeFinding[]) => {
    if (!findings.length) return
    lines.push(`${title} (${findings.length})`)
    for (const finding of findings) lines.push(`  · ${finding.summary}`)
    lines.push('')
  }
  section('Standards violations', vetoes)
  section('Significant', majors)
  section('Minor', minors)

  if (!report.findings.length) lines.push('No findings. Every check passed at its stated threshold.', '')
  lines.push(`checks: ${report.deterministic.checks.map((check) => `${check.id} ${(check.score * 100).toFixed(0)}`).join('  ')}`)
  if (report.priorsEvaluated) lines.push(`priors evaluated: ${report.priorsEvaluated}, violated: ${report.priorViolations.length}`)
  return lines.join('\n')
}
