/**
 * Froam Judge — Tier 2, induced priors.
 *
 * Tier 1 knows published standards. Tier 2 learns what is actually true across
 * a corpus of real interfaces, and is allowed to be wrong about it.
 *
 * Every prior in this file is derived from measurement. Nothing here contains a
 * pre-written conclusion selected by keyword — that is a rule engine wearing the
 * word "learned", and it cannot discover anything its author did not already
 * believe. A prior's claim text is generated from the numbers that produced it.
 *
 * Four disciplines are enforced structurally, because each one is a way this
 * kind of system usually fails:
 *
 * 1. Held-out scoring, split BY ORIGIN. Two pages of one site share a design
 *    system, so a page-level split leaks the answer and every prior looks
 *    brilliant.
 * 2. A baseline for every prior. A scoped prior is scored against the
 *    unscoped one on the same held-out pages. If conditioning does not help,
 *    lift is 1 and the prior is deleted.
 * 3. A real denominator. holdRate counts the pages where the prior failed, so
 *    confidence can fall. Counting only successes produces a number that rises
 *    forever and means nothing.
 * 4. Counter-examples are retained, never discarded. A prior that has never
 *    failed has not been tested.
 */
import type { FroamPageProfile } from './page-profile'
import type { FroamJudgeFinding } from './judge-deterministic'

export const FROAM_PRIORS_VERSION = 'froam-induced-priors-v1'

export type FroamPriorScope = { key: string; feature: string | null; value: string | null }

export type FroamPrior = {
  id: string
  kind: 'range' | 'dominance'
  /** Generated from the induced numbers. Never a stored constant. */
  claim: string
  feature: string
  scope: FroamPriorScope
  /** Numeric priors: inclusive bounds. Categorical priors: the modal value. */
  range: { low: number; high: number } | null
  value: string | null
  /** Training pages matching this scope. */
  support: number
  /** Fraction of training pages where the prior held. Counts failures. */
  holdRate: number
  /** Fraction of held-out pages where it held. The number that counts. */
  heldOutAccuracy: number
  /** Accuracy of the unscoped prior on the same held-out pages. */
  baselineAccuracy: number
  /** Informativeness of the unscoped prior, for comparison. */
  baselineInformativeness: number
  /**
   * utility / baselineUtility, where utility is heldOutAccuracy × informativeness.
   *
   * A plain accuracy ratio cannot see the usual benefit of conditioning. If
   * dark pages use a 4px base and light pages use 8px, the global range
   * 4–8 is 100% accurate and says nothing; the scoped range 4–4 is also 100%
   * accurate and says everything. Both score 1.0 on accuracy alone, so the
   * genuinely useful prior would be pruned. Weighting by how much each range
   * excludes separates them.
   */
  lift: number
  /** 0–1: how much uncertainty the prior removes. A prior that admits everything is useless. */
  informativeness: number
  /** Origins where it failed. Kept, because an untested prior is not evidence. */
  counterExamples: string[]
  inducedAt: number
  priorsVersion: string
}

export type FroamPriorInductionReport = {
  priorsVersion: string
  trainOrigins: number
  holdOutOrigins: number
  candidates: number
  kept: number
  /** Priors dropped, with the reason. Pruning is evidence, so it is reported. */
  pruned: Array<{ id: string; reason: string; lift: number; informativeness: number; heldOutAccuracy: number }>
  priors: FroamPrior[]
}

// ── features ────────────────────────────────────────────────────────────────

export type FroamFeatureVector = { numeric: Record<string, number>; categorical: Record<string, string> }

/** Flatten a profile into the axes priors may be induced over. Null-valued axes are omitted, never defaulted. */
export function profileFeatures(profile: FroamPageProfile): FroamFeatureVector {
  const numeric: Record<string, number> = {
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
  }
  if (profile.type.ratio !== null) numeric['type.ratio'] = profile.type.ratio
  if (Number.isFinite(profile.color.contrastFloor)) numeric['color.contrastFloor'] = profile.color.contrastFloor
  const categorical: Record<string, string> = {
    'color.modeSignal': profile.color.modeSignal,
    'space.density': profile.space.density,
    'flow.signature': profile.flow.signature || 'empty',
  }
  const primaryFamily = profile.type.families[0]
  if (primaryFamily) categorical['type.primaryFamilyRole'] = primaryFamily.role
  return { numeric, categorical }
}

/** Scopes a prior may be conditioned on. The global scope is always first. */
export function candidateScopes(profiles: readonly FroamPageProfile[]): FroamPriorScope[] {
  const scopes: FroamPriorScope[] = [{ key: 'global', feature: null, value: null }]
  const conditionOn = ['color.modeSignal', 'space.density', 'type.primaryFamilyRole']
  const seen = new Set<string>()
  for (const profile of profiles) {
    const { categorical } = profileFeatures(profile)
    for (const feature of conditionOn) {
      const value = categorical[feature]
      if (!value) continue
      const key = `${feature}=${value}`
      if (seen.has(key)) continue
      seen.add(key)
      scopes.push({ key, feature, value })
    }
  }
  return scopes
}

const inScope = (profile: FroamPageProfile, scope: FroamPriorScope) =>
  scope.feature === null || profileFeatures(profile).categorical[scope.feature] === scope.value

// ── split ───────────────────────────────────────────────────────────────────

/** FNV-1a. Used only to make the train/hold-out split deterministic and reproducible. */
function hashString(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  return hash >>> 0
}

/**
 * Split by origin, never by page.
 *
 * Pages from one site share a palette, a scale and a grid. Splitting on pages
 * puts the answer on both sides of the split, and every induced prior scores
 * near-perfectly while having learned nothing that transfers.
 */
export function splitByOrigin(profiles: readonly FroamPageProfile[], holdOutFraction = 0.3) {
  const origins = [...new Set(profiles.map((profile) => profile.origin))]
  const holdOutOrigins = new Set(origins.filter((origin) => (hashString(origin) % 1000) / 1000 < holdOutFraction))
  // Never hand back an empty hold-out: an unscored prior must not be shippable.
  if (holdOutOrigins.size === 0 && origins.length > 1) {
    holdOutOrigins.add([...origins].sort((a, b) => hashString(a) - hashString(b))[0])
  }
  return {
    train: profiles.filter((profile) => !holdOutOrigins.has(profile.origin)),
    holdOut: profiles.filter((profile) => holdOutOrigins.has(profile.origin)),
    holdOutOrigins: [...holdOutOrigins],
  }
}

// ── statistics ──────────────────────────────────────────────────────────────

function quantile(sorted: readonly number[], fraction: number) {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * fraction
  const low = Math.floor(position), high = Math.ceil(position)
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

const round = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places

// ── induction ───────────────────────────────────────────────────────────────

export type FroamInductionOptions = {
  /** Minimum training pages in scope before a prior may be proposed. */
  minSupport?: number
  /** Minimum held-out accuracy to keep a prior. */
  minHeldOutAccuracy?: number
  /** Minimum share of the observed span a prior must exclude. */
  minInformativeness?: number
  /** Minimum lift for a scoped prior. Global priors are exempt — there is nothing to condition against. */
  minLift?: number
  holdOutFraction?: number
  now?: number
}

type Candidate = { prior: FroamPrior; scoped: boolean }

function evaluateRange(profiles: readonly FroamPageProfile[], feature: string, low: number, high: number) {
  const values = profiles.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined)
  const held = values.filter((value) => value >= low && value <= high).length
  return { accuracy: values.length ? held / values.length : 0, evaluated: values.length }
}

function evaluateDominance(profiles: readonly FroamPageProfile[], feature: string, value: string) {
  const values = profiles.map((profile) => profileFeatures(profile).categorical[feature]).filter((item) => item !== undefined)
  const held = values.filter((item) => item === value).length
  return { accuracy: values.length ? held / values.length : 0, evaluated: values.length }
}

const scopePhrase = (scope: FroamPriorScope) => scope.feature === null ? '' : ` when ${scope.feature} is ${scope.value}`

/** Cap for lift against a vacuous baseline, so a prior stays JSON-serialisable. */
export const FROAM_MAX_LIFT = 99

/**
 * A prior is worth keeping when it is both accurate and narrow. Either alone is
 * trivially gameable: a range admitting every value is always right, and a
 * razor-thin range is narrow and always wrong.
 */
const utility = (accuracy: number, informativeness: number) => accuracy * informativeness

function liftOf(accuracy: number, informativeness: number, baselineAccuracy: number, baselineInformativeness: number) {
  const value = utility(accuracy, informativeness)
  const baseline = utility(baselineAccuracy, baselineInformativeness)
  if (baseline > 0) return round(Math.min(FROAM_MAX_LIFT, value / baseline))
  return value > 0 ? FROAM_MAX_LIFT : 0
}

/**
 * Induce priors from a profile corpus.
 *
 * Returns the kept priors *and* everything pruned with its reason, because what
 * failed to generalise is as informative as what did.
 */
export function inducePriors(profiles: readonly FroamPageProfile[], options: FroamInductionOptions = {}): FroamPriorInductionReport {
  const minSupport = options.minSupport ?? 5
  const minHeldOutAccuracy = options.minHeldOutAccuracy ?? 0.7
  const minInformativeness = options.minInformativeness ?? 0.2
  const minLift = options.minLift ?? 1.02
  const now = options.now ?? Date.now()

  const { train, holdOut, holdOutOrigins } = splitByOrigin(profiles, options.holdOutFraction ?? 0.3)
  const trainOrigins = new Set(train.map((profile) => profile.origin)).size
  const scopes = candidateScopes(train)
  const globalScope = scopes[0]

  const numericFeatures = [...new Set(train.flatMap((profile) => Object.keys(profileFeatures(profile).numeric)))]
  const categoricalFeatures = [...new Set(train.flatMap((profile) => Object.keys(profileFeatures(profile).categorical)))]

  // Global observed span per numeric feature, used to measure how much a prior excludes.
  const globalSpan = new Map<string, { min: number; max: number }>()
  for (const feature of numericFeatures) {
    const values = train.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined)
    if (values.length) globalSpan.set(feature, { min: Math.min(...values), max: Math.max(...values) })
  }

  const candidates: Candidate[] = []

  for (const scope of scopes) {
    const scopedTrain = train.filter((profile) => inScope(profile, scope))
    const scopedHoldOut = holdOut.filter((profile) => inScope(profile, scope))
    if (scopedTrain.length < minSupport) continue

    for (const feature of numericFeatures) {
      const values = scopedTrain.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined).sort((a, b) => a - b)
      if (values.length < minSupport) continue
      const low = round(quantile(values, 0.1), 3)
      const high = round(quantile(values, 0.9), 3)
      if (!(high > low) && !(high === low && values.every((value) => value === low))) continue

      const trainEval = evaluateRange(scopedTrain, feature, low, high)
      const holdOutEval = evaluateRange(scopedHoldOut, feature, low, high)

      // Baseline: the unscoped prior, evaluated on exactly the same held-out pages.
      const globalValues = train.map((profile) => profileFeatures(profile).numeric[feature]).filter((value) => value !== undefined).sort((a, b) => a - b)
      const baselineLow = round(quantile(globalValues, 0.1), 3)
      const baselineHigh = round(quantile(globalValues, 0.9), 3)
      const baselineEval = evaluateRange(scopedHoldOut, feature, baselineLow, baselineHigh)

      const span = globalSpan.get(feature)
      const spanWidth = span ? span.max - span.min : 0
      const informativeness = spanWidth > 0 ? round(Math.min(1, Math.max(0, 1 - (high - low) / spanWidth))) : 1
      const baselineInformativeness = spanWidth > 0 ? round(Math.min(1, Math.max(0, 1 - (baselineHigh - baselineLow) / spanWidth))) : 1

      const counterExamples = scopedHoldOut
        .filter((profile) => {
          const value = profileFeatures(profile).numeric[feature]
          return value !== undefined && (value < low || value > high)
        })
        .map((profile) => profile.origin)

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
      })
    }

    for (const feature of categoricalFeatures) {
      if (scope.feature === feature) continue
      const counts = new Map<string, number>()
      for (const profile of scopedTrain) {
        const value = profileFeatures(profile).categorical[feature]
        if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1)
      }
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
      if (total < minSupport || counts.size === 0) continue
      const [modal, modalCount] = [...counts].sort((a, b) => b[1] - a[1])[0]
      const trainEval = { accuracy: modalCount / total }
      const holdOutEval = evaluateDominance(scopedHoldOut, feature, modal)

      const globalCounts = new Map<string, number>()
      for (const profile of train) {
        const value = profileFeatures(profile).categorical[feature]
        if (value !== undefined) globalCounts.set(value, (globalCounts.get(value) ?? 0) + 1)
      }
      const globalTotal = [...globalCounts.values()].reduce((sum, count) => sum + count, 0) || 1
      const globalModal = [...globalCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? modal
      const baselineEval = evaluateDominance(scopedHoldOut, feature, globalModal)

      // How much uncertainty the claim removes. Predicting the value that is
      // already 90% likely everywhere is nearly free; predicting a minority
      // value that dominates inside this scope is where the information is.
      const baseRate = (value: string) => (globalCounts.get(value) ?? 0) / globalTotal
      const informativeness = round(Math.max(0, 1 - baseRate(modal)))
      const baselineInformativeness = round(Math.max(0, 1 - baseRate(globalModal)))

      const counterExamples = scopedHoldOut
        .filter((profile) => profileFeatures(profile).categorical[feature] !== modal)
        .map((profile) => profile.origin)

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
      })
    }
  }

  const kept: FroamPrior[] = []
  const pruned: FroamPriorInductionReport['pruned'] = []
  for (const candidate of candidates) {
    const { prior, scoped } = candidate
    const drop = (reason: string) => pruned.push({ id: prior.id, reason, lift: prior.lift, informativeness: prior.informativeness, heldOutAccuracy: prior.heldOutAccuracy })
    if (prior.heldOutAccuracy < minHeldOutAccuracy) { drop(`held-out accuracy ${prior.heldOutAccuracy} below ${minHeldOutAccuracy}`); continue }
    if (prior.informativeness < minInformativeness) { drop(`informativeness ${prior.informativeness} below ${minInformativeness} — admits nearly everything`); continue }
    if (scoped && prior.lift < minLift) { drop(`lift ${prior.lift} below ${minLift} — conditioning on ${prior.scope.key} adds nothing over the global prior`); continue }
    kept.push(prior)
  }

  return {
    priorsVersion: FROAM_PRIORS_VERSION,
    trainOrigins,
    holdOutOrigins: holdOutOrigins.length,
    candidates: candidates.length,
    kept: kept.length,
    pruned,
    priors: kept.sort((a, b) => b.informativeness * b.heldOutAccuracy - a.informativeness * a.heldOutAccuracy),
  }
}

// ── application ─────────────────────────────────────────────────────────────

export type FroamPriorViolation = FroamJudgeFinding & {
  priorId: string
  heldOutAccuracy: number
  support: number
  counterExamples: string[]
}

/**
 * Score a page against induced priors.
 *
 * Every violation cites its evidence — how many pages the prior was induced
 * from, how it scored on pages it never saw, and the origins where it failed.
 * A claim Froam cannot support this way should not be made.
 */
export function applyPriors(profile: FroamPageProfile, priors: readonly FroamPrior[]): FroamPriorViolation[] {
  const features = profileFeatures(profile)
  const violations: FroamPriorViolation[] = []
  for (const prior of priors) {
    if (!inScope(profile, prior.scope)) continue
    if (prior.kind === 'range' && prior.range) {
      const value = features.numeric[prior.feature]
      if (value === undefined || (value >= prior.range.low && value <= prior.range.high)) continue
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
      })
      continue
    }
    if (prior.kind === 'dominance' && prior.value !== null) {
      const value = features.categorical[prior.feature]
      if (value === undefined || value === prior.value) continue
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
      })
    }
  }
  return violations.sort((a, b) => b.heldOutAccuracy * b.support - a.heldOutAccuracy * a.support)
}
