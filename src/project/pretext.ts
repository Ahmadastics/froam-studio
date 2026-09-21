/**
 * Froam Pretext Tasks — the learning engine.
 *
 * Storing scans teaches Froam nothing. Understanding is not a data structure,
 * it is a capability, and a capability has to be exercised against something
 * that can mark it wrong. So each scanned page is turned into questions whose
 * answers are already known: hide part of a profile, ask what was hidden,
 * compare to the truth. The error is the lesson.
 *
 * This is why scanning is worth doing. A scanned page is *self-labelling* —
 * the answers come free, so a corpus of two hundred pages yields thousands of
 * graded questions with no annotation budget at all.
 *
 * Two rules this file exists to enforce:
 *
 * 1. **No leakage.** Every masked input is built by removing the answer from
 *    the profile *and* from everything derived from it. `flow.signature`
 *    contains the archetype of the section being hidden; shipping it in the
 *    input makes the task trivially solvable and the resulting accuracy a lie.
 *    The leakage guards below are not paranoia, they are the whole validity of
 *    the measurement.
 *
 * 2. **Every task carries a baseline.** Accuracy alone is meaningless: a
 *    predictor that always answers "hero" for the first section is right most
 *    of the time. Only the margin over the dumb answer is evidence of learning.
 */
import type { FroamPageProfile, FroamSectionArchetype, FroamTypeStep } from './page-profile'
import type { FroamSemanticRole } from './types'

export const FROAM_PRETEXT_VERSION = 'froam-pretext-v1'

export type FroamPretextTaskKind =
  | 'section-infill'
  | 'next-section'
  | 'accent-placement'
  | 'scale-infill'
  | 'blind-role'
  | 'density-match'

export type FroamPretextTask = {
  id: string
  kind: FroamPretextTaskKind
  /** Origin the task came from, so scoring can hold out by site. */
  origin: string
  routeKey: string
  /** Everything the predictor may see. Guaranteed free of the answer. */
  input: Record<string, unknown>
  /** The known-correct answer, taken from the unmasked profile. */
  answer: string | number
  /** Candidate answers for a closed task, or null when open-ended. */
  choices: Array<string | number> | null
}

export const FROAM_SECTION_ARCHETYPES: readonly FroamSectionArchetype[] = [
  'hero', 'proof', 'feature-grid', 'split', 'testimonial', 'pricing', 'faq', 'cta', 'footer', 'unknown',
]

const DENSITIES = ['tight', 'balanced', 'airy'] as const

// ── generators ──────────────────────────────────────────────────────────────

/**
 * Hide one section; predict its archetype from the ones around it.
 *
 * Tests whether Froam has any model of page narrative — that a proof strip
 * follows a hero, that a footer ends things.
 */
function sectionInfill(profile: FroamPageProfile): FroamPretextTask[] {
  const sections = profile.flow.sections
  if (sections.length < 3) return []
  return sections.map((hidden, index) => ({
    id: `${profile.origin}${profile.routeKey}:section-infill:${index}`,
    kind: 'section-infill' as const,
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
  }))
}

/** Given the page so far, predict what comes next. Tests rhetorical order. */
function nextSection(profile: FroamPageProfile): FroamPretextTask[] {
  const sections = profile.flow.sections
  if (sections.length < 3) return []
  const tasks: FroamPretextTask[] = []
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
    })
  }
  return tasks
}

/**
 * Predict which role the accent colour lands on.
 *
 * Tests whether colour is understood as a system of meaning rather than
 * decoration — that the loud colour is where the action is.
 */
function accentPlacement(profile: FroamPageProfile): FroamPretextTask[] {
  const accent = profile.color.palette.find((entry) => entry.role === 'accent')
  if (!accent || accent.appearsOn.length === 0) return []
  const roles = accent.appearsOn.filter((role) => role !== 'unknown')
  if (!roles.length) return []
  const modal = roles[0]
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
    choices: ['cta', 'button', 'input', 'form', 'heading', 'card', 'badge', 'navigation', 'media', 'paragraph'] as FroamSemanticRole[],
  }]
}

/** Hide one step of the type scale; predict its size. Tests proportion. */
function scaleInfill(profile: FroamPageProfile): FroamPretextTask[] {
  const scale = profile.type.scale
  if (scale.length < 4) return []
  const tasks: FroamPretextTask[] = []
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
        visibleSteps: scale.filter((_, position) => position !== index).map((step: FroamTypeStep) => step.px),
        hiddenUsedBy: scale[index].usedBy,
        stepCount: scale.length,
      },
      answer: scale[index].px,
      choices: null,
    })
  }
  return tasks
}

/**
 * Predict a section's archetype from geometry alone — no roles, no text.
 *
 * Tests whether visual hierarchy is understood independently of markup, which
 * is the part that transfers to pages whose HTML says nothing useful.
 */
function blindRole(profile: FroamPageProfile): FroamPretextTask[] {
  return profile.flow.sections
    .filter((section) => section.archetype !== 'unknown')
    .map((section) => ({
      id: `${profile.origin}${profile.routeKey}:blind-role:${section.index}`,
      kind: 'blind-role' as const,
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
    }))
}

/**
 * Predict spacing density from colour and type alone.
 *
 * Tests cross-axis coherence: whether the parts of a design system are
 * understood as mutually constraining rather than independent.
 */
function densityMatch(profile: FroamPageProfile): FroamPretextTask[] {
  if (!profile.type.scale.length) return []
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
  }]
}

const GENERATORS: Array<(profile: FroamPageProfile) => FroamPretextTask[]> = [
  sectionInfill, nextSection, accentPlacement, scaleInfill, blindRole, densityMatch,
]

/** Turn profiles into graded questions. No annotation, no model, no cost. */
export function generatePretextTasks(profiles: readonly FroamPageProfile[], kinds?: readonly FroamPretextTaskKind[]): FroamPretextTask[] {
  const tasks = profiles.flatMap((profile) => GENERATORS.flatMap((generate) => generate(profile)))
  return kinds ? tasks.filter((task) => kinds.includes(task.kind)) : tasks
}

// ── leakage ─────────────────────────────────────────────────────────────────

/**
 * Check that a task's input does not contain its own answer.
 *
 * Run over every generated task in the test suite. A leak does not throw or
 * warn at runtime — it silently produces excellent scores, which is the single
 * most likely way this whole apparatus ends up lying.
 */
export function detectLeakage(task: FroamPretextTask): string[] {
  const leaks: string[] = []
  const serialized = JSON.stringify(task.input)
  // Substring matching is only safe where the answer's value-space cannot
  // collide with anything else in the input. 'cta' is both a semantic role and
  // a section archetype, so a raw scan would flag an accent-placement task for
  // listing a cta *section* — a correlation the predictor is supposed to learn,
  // not the answer handed over. Those tasks are checked by key instead.
  if (typeof task.answer === 'string' && task.kind === 'density-match') {
    if (serialized.split(`"${task.answer}"`).length - 1 > 0) leaks.push(`density "${task.answer}" appears in input`)
  }
  if (task.kind === 'accent-placement') {
    for (const key of ['appearsOn', 'accentAppearsOn', 'accentDiscipline', 'accentRole']) {
      if (key in task.input) leaks.push(`${key} reconstructs where the accent lands`)
    }
    const palette = (task.input as { palette?: Array<{ role: string }> }).palette
    if (palette?.some((entry) => entry.role === 'accent')) leaks.push('accent entry left in the palette')
  }
  if (task.kind === 'section-infill') {
    const input = task.input as { visible: Array<{ index: number }>; hiddenIndex: number }
    if (input.visible.some((section) => section.index === input.hiddenIndex)) leaks.push('hidden section present in visible list')
    if ('signature' in task.input) leaks.push('flow.signature contains every archetype including the hidden one')
  }
  if (task.kind === 'scale-infill') {
    const input = task.input as { visibleSteps: number[] }
    if (input.visibleSteps.includes(task.answer as number)) leaks.push('hidden step present in visible steps')
    if ('ratio' in task.input || 'ratioSpread' in task.input) leaks.push('type ratio reconstructs the hidden step')
  }
  if (task.kind === 'blind-role' && ('childRoles' in task.input || 'archetype' in task.input)) {
    leaks.push('blind-role input carries semantic roles, which is the answer')
  }
  if (task.kind === 'next-section') {
    const input = task.input as { prefix: string[]; atIndex: number }
    if (input.prefix.length !== input.atIndex) leaks.push('prefix length disagrees with index')
    if ('sectionCount' in task.input) leaks.push('section count reveals whether the answer is the footer')
  }
  return leaks
}

// ── scoring ─────────────────────────────────────────────────────────────────

export type FroamPretextPrediction = { taskId: string; answer: string | number | null }

/** Numeric answers are correct within a relative tolerance; a type step is not a lottery number. */
export const FROAM_NUMERIC_TOLERANCE = 0.1

export function isCorrect(task: FroamPretextTask, predicted: string | number | null | undefined) {
  if (predicted === null || predicted === undefined) return false
  if (typeof task.answer === 'number') {
    const value = typeof predicted === 'number' ? predicted : Number.parseFloat(String(predicted))
    if (!Number.isFinite(value)) return false
    return Math.abs(value - task.answer) <= Math.max(0.5, Math.abs(task.answer) * FROAM_NUMERIC_TOLERANCE)
  }
  return String(predicted) === String(task.answer)
}

export type FroamPretextScorecard = {
  pretextVersion: string
  predictor: string
  baseline: string
  tasks: number
  accuracy: number
  baselineAccuracy: number
  /** accuracy / baselineAccuracy. At or below 1, nothing was learned. */
  lift: number
  /** Task kinds scored together, which sets the multiple-comparison correction. */
  comparisons: number
  byKind: Array<{
    kind: FroamPretextTaskKind
    tasks: number
    accuracy: number
    baselineAccuracy: number
    lift: number
    /** Z-score of the margin, reported so a borderline call can be inspected. */
    z: number
    /** Bonferroni-corrected threshold z had to clear. */
    significanceThreshold: number
    significant: boolean
  }>
}

const round = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places

/**
 * Upper-tail normal quantile (Abramowitz & Stegun 26.2.23).
 *
 * Needed to correct the significance threshold for the number of task kinds
 * being tested at once; accurate to about 5e-4, which is far beyond what this
 * decision requires.
 */
function normalQuantileUpper(p: number) {
  const probability = Math.min(0.5, Math.max(1e-12, p))
  const t = Math.sqrt(-2 * Math.log(probability))
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t)
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
function significance(accuracy: number, baseline: number, tasks: number, comparisons: number) {
  const threshold = normalQuantileUpper(0.05 / Math.max(1, comparisons))
  if (tasks < 10) return { z: 0, threshold: round(threshold, 3), significant: false }
  const pooled = (accuracy + baseline) / 2
  const variance = pooled * (1 - pooled) * (2 / tasks)
  const z = variance > 0 ? (accuracy - baseline) / Math.sqrt(variance) : accuracy > baseline ? Infinity : 0
  return { z: Number.isFinite(z) ? round(z, 3) : z, threshold: round(threshold, 3), significant: z > threshold }
}

export function scorePretext(
  tasks: readonly FroamPretextTask[],
  predictions: readonly FroamPretextPrediction[],
  baselinePredictions: readonly FroamPretextPrediction[],
  input: { predictor: string; baseline: string },
): FroamPretextScorecard {
  const byId = new Map(predictions.map((prediction) => [prediction.taskId, prediction.answer]))
  const baselineById = new Map(baselinePredictions.map((prediction) => [prediction.taskId, prediction.answer]))
  const correct = tasks.filter((task) => isCorrect(task, byId.get(task.id))).length
  const baselineCorrect = tasks.filter((task) => isCorrect(task, baselineById.get(task.id))).length
  const accuracy = tasks.length ? correct / tasks.length : 0
  const baselineAccuracy = tasks.length ? baselineCorrect / tasks.length : 0

  const kinds = [...new Set(tasks.map((task) => task.kind))]
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
      const forKind = tasks.filter((task) => task.kind === kind)
      const kindCorrect = forKind.filter((task) => isCorrect(task, byId.get(task.id))).length / forKind.length
      const kindBaseline = forKind.filter((task) => isCorrect(task, baselineById.get(task.id))).length / forKind.length
      const test = significance(kindCorrect, kindBaseline, forKind.length, kinds.length)
      return {
        kind,
        tasks: forKind.length,
        accuracy: round(kindCorrect),
        baselineAccuracy: round(kindBaseline),
        lift: kindBaseline > 0 ? round(kindCorrect / kindBaseline) : kindCorrect > 0 ? Infinity : 0,
        z: test.z,
        significanceThreshold: test.threshold,
        significant: test.significant,
      }
    }),
  }
}
