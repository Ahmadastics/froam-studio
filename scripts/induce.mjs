/**
 * Turn a scanned corpus into knowledge, and report honestly whether it worked.
 *
 * This is the step scanning exists for. It does three things and refuses to
 * blur them together:
 *
 *   1. Says whether the corpus can support induction at all, and why not.
 *   2. Induces priors on training origins and scores them on held-out ones,
 *      reporting what was pruned alongside what survived.
 *   3. Measures whether looking at the corpus beats not looking at it, against
 *      the majority baseline, on pages the model never saw.
 *
 * Step 3 is the one that matters. Priors that survive pruning still prove
 * nothing on their own — a regularity can hold and carry no information. Only
 * a margin over the dumb answer is evidence that anything was learned.
 *
 *   node scripts/induce.mjs --corpus=corpus.json
 *   node scripts/induce.mjs --corpus=corpus.json --out=priors.json
 *
 * Flags
 *   --corpus=<path>      required
 *   --out=<path>         write the surviving priors as JSON
 *   --force              induce despite readiness blockers (results are noise)
 *   --min-support=<n>    training pages needed before a prior is proposed
 *   --hold-out=<0..1>    fraction of origins held out, default 0.3
 *   --json               machine-readable output only
 */
import fs from 'node:fs'
import {
  corpusReadiness,
  corpusStats,
  learnableProfiles,
  negativeProfiles,
} from '../dist/project/corpus.js'
import { inducePriors, splitByOrigin } from '../dist/project/judge-priors.js'
import { generatePretextTasks, detectLeakage, scorePretext } from '../dist/project/pretext.js'
import { fitCorpusModel, corpusPredictor, fitMajorityBaseline, runPredictor, diagnosePredictor } from '../dist/project/predictors.js'

const flags = {}
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) continue
  const [key, value] = arg.slice(2).split('=')
  flags[key] = value ?? true
}

const asJson = Boolean(flags.json)
const log = (...args) => { if (!asJson) console.log(...args) }
const rule = (label) => log(`\n── ${label} ${'─'.repeat(Math.max(0, 58 - label.length))}`)
const pct = (value) => `${(value * 100).toFixed(1)}%`

if (!flags.corpus) {
  console.error('usage: node scripts/induce.mjs --corpus=<path> [--out=priors.json] [--force]')
  process.exit(1)
}
if (!fs.existsSync(String(flags.corpus))) {
  console.error(`no corpus at ${flags.corpus} — scan some pages first:`)
  console.error('  node scripts/scan-url.mjs https://example.com --tier=good --corpus=' + flags.corpus)
  process.exit(1)
}

const corpus = JSON.parse(fs.readFileSync(String(flags.corpus), 'utf8'))
const stats = corpusStats(corpus)
const readiness = corpusReadiness(corpus)

rule('corpus')
log(`  ${stats.entries} pages across ${stats.origins} origins   ${stats.multiPageOrigins} origins with more than one page`)
log(`  tiers      reference ${stats.byTier.reference}   good ${stats.byTier.good}   baseline ${stats.byTier.baseline}   negative ${stats.byTier.negative}`)
log(`  learnable  ${stats.learnable} pages (reference + good only)`)
log(`  viewports  ${Object.entries(stats.byViewport).map(([key, count]) => `${key} ${count}`).join('   ') || 'none'}`)
log(`  modes      ${Object.entries(stats.byMode).map(([key, count]) => `${key} ${count}`).join('   ') || 'none'}`)
log(`  mean audit score ${stats.meanScore}   judge ${stats.judgeVersions.join(', ') || 'none'}`)

for (const warning of readiness.warnings) log(`  warning: ${warning}`)
for (const blocker of readiness.blockers) log(`  BLOCKED: ${blocker}`)

if (!readiness.ready && !flags.force) {
  log('')
  log('  Not enough corpus to induce anything that would survive contact with a new page.')
  log('  Induction on a thin corpus does not fail loudly — it produces confident priors')
  log('  from six pages that break on the seventh, which is worse than no priors.')
  log('')
  log('  Scan more sites, or pass --force to see the numbers anyway.')
  if (asJson) console.log(JSON.stringify({ ready: false, stats, readiness }, null, 2))
  process.exit(2)
}
if (!readiness.ready) log('\n  --force: proceeding despite blockers. Treat everything below as noise.')

const profiles = learnableProfiles(corpus)
const holdOutFraction = Number(flags['hold-out'] ?? 0.3)
const minSupport = Number(flags['min-support'] ?? 5)
const { train, holdOut, holdOutOrigins } = splitByOrigin(profiles, holdOutFraction)

rule('split')
log(`  train    ${train.length} pages / ${new Set(train.map((profile) => profile.origin)).size} origins`)
log(`  hold-out ${holdOut.length} pages / ${holdOutOrigins.length} origins`)
log(`  Split by origin, never by page: two pages of one site share a design system,`)
log(`  so splitting on pages puts the answer on both sides.`)

// ── priors ──────────────────────────────────────────────────────────────────

const report = inducePriors(profiles, { minSupport, holdOutFraction })

rule('priors')
log(`  ${report.candidates} candidates → ${report.kept} kept, ${report.pruned.length} pruned`)
if (report.priors.length) {
  log('')
  for (const prior of report.priors.slice(0, 12)) {
    log(`  ${prior.claim}`)
    log(`      held-out ${pct(prior.heldOutAccuracy)}   lift ${prior.lift}   informativeness ${prior.informativeness}   support ${prior.support}` +
      (prior.counterExamples.length ? `   ${prior.counterExamples.length} counter-example${prior.counterExamples.length === 1 ? '' : 's'}` : '   never failed yet'))
  }
  if (report.priors.length > 12) log(`  … and ${report.priors.length - 12} more`)
} else {
  log('  Nothing survived. That is a result, not an error: no regularity in this')
  log('  corpus both held on unseen sites and said anything a wider range would not.')
}

// Pruning is evidence. Grouping it says which discipline is doing the work.
const prunedReasons = new Map()
for (const entry of report.pruned) {
  const kind = entry.reason.startsWith('held-out') ? 'failed on unseen sites'
    : entry.reason.startsWith('informativeness') ? 'admitted nearly everything'
    : 'conditioning added nothing over the global prior'
  prunedReasons.set(kind, (prunedReasons.get(kind) ?? 0) + 1)
}
if (prunedReasons.size) {
  log('')
  for (const [reason, count] of [...prunedReasons].sort((a, b) => b[1] - a[1])) log(`  pruned ${String(count).padStart(3)}  ${reason}`)
}

// A prior that has never failed has not been tested. If almost none of them
// have failed, the corpus has too little variance to be telling the truth yet —
// which looks identical to success until a real page arrives.
const untested = report.priors.filter((prior) => prior.counterExamples.length === 0).length
if (report.priors.length >= 4 && untested / report.priors.length > 0.8) {
  log('')
  log(`  ${untested} of ${report.priors.length} priors have no counter-examples at all.`)
  log(`  Every one of them held on every held-out page, which in a real corpus`)
  log(`  almost never happens. The likely cause is too few origins or sites too`)
  log(`  similar to each other — not priors that are unusually true.`)
}

// ── did anything actually get learned ───────────────────────────────────────

rule('learning')

const trainTasks = generatePretextTasks(train)
const holdOutTasks = generatePretextTasks(holdOut)
const leaks = [...trainTasks, ...holdOutTasks].flatMap((task) => detectLeakage(task).map((leak) => `${task.kind}: ${leak}`))
if (leaks.length) {
  console.error(`  LEAKAGE DETECTED — every number below would be meaningless:`)
  for (const leak of [...new Set(leaks)].slice(0, 10)) console.error(`    ${leak}`)
  process.exit(3)
}

if (holdOutTasks.length < 20) {
  log(`  Only ${holdOutTasks.length} held-out tasks. Too few to conclude anything;`)
  log(`  scan more origins so the hold-out has pages to ask about.`)
} else {
  const model = fitCorpusModel(train)
  const learned = corpusPredictor(model)
  const majority = fitMajorityBaseline(trainTasks)
  const card = scorePretext(
    holdOutTasks,
    runPredictor(learned, holdOutTasks),
    runPredictor(majority, holdOutTasks),
    { predictor: learned.name, baseline: majority.name },
  )

  log(`  ${card.tasks} tasks on ${holdOutOrigins.length} unseen origins`)
  log(`  accuracy ${pct(card.accuracy)}   majority baseline ${pct(card.baselineAccuracy)}   lift ${card.lift === Infinity ? '∞' : card.lift.toFixed(2)}`)
  log(`  significance threshold z > ${card.byKind[0]?.significanceThreshold} (corrected for ${card.comparisons} task kinds)`)
  log('')
  for (const kind of card.byKind) {
    // Below ten tasks the significance test declines to run and reports z=0.
    // Printing that as a zero reads as "measured, no effect" when it means
    // "not measured" — two very different things to tell someone.
    const verdict = kind.tasks < 10
      ? 'too few tasks'
      : `z=${String(kind.z).padStart(6)}${kind.significant ? '   LEARNED' : ''}`
    log(`    ${kind.kind.padEnd(18)} ${String(kind.tasks).padStart(3)} tasks   ` +
      `${pct(kind.accuracy).padStart(6)} vs ${pct(kind.baselineAccuracy).padStart(6)}   ${verdict}`)
  }

  const learnedKinds = card.byKind.filter((kind) => kind.significant && kind.lift > 1)
  log('')
  if (learnedKinds.length) {
    log(`  ${learnedKinds.length} of ${card.byKind.length} task kinds beat the baseline on sites the model never saw.`)
    log(`  That is the claim worth making: not "Froam has a corpus", but "looking at`)
    log(`  it helps on pages it has not seen".`)
  } else {
    log(`  Nothing beat the baseline. Either the corpus is too small, or the sites in`)
    log(`  it share no regularity worth learning. Both are fixable, and neither is`)
    log(`  fixed by inducing harder — scan more, and scan a narrower niche.`)
  }

  if (!asJson) {
    const confused = diagnosePredictor(learned, holdOutTasks).filter((entry) => entry.confusions.length)
    if (confused.length) {
      log('')
      log('  most common mistakes')
      for (const entry of confused.slice(0, 4)) {
        const worst = entry.confusions[0]
        log(`    ${entry.kind.padEnd(18)} called ${worst.expected} a ${worst.predicted} ×${worst.count}`)
      }
    }
  }

  if (asJson) console.log(JSON.stringify({ ready: readiness.ready, stats, split: { train: train.length, holdOut: holdOut.length, holdOutOrigins }, priors: report, learning: card }, null, 2))
}

if (flags.out) {
  fs.writeFileSync(String(flags.out), JSON.stringify({ priorsVersion: report.priorsVersion, inducedAt: Date.now(), priors: report.priors }, null, 2))
  log(`\n  wrote ${report.priors.length} priors to ${flags.out}`)
  log(`  Use them with buildDesignReference({ profile, priors }) to give the editor`)
  log(`  corpus notes alongside the page's own measurements.`)
}
log('')
