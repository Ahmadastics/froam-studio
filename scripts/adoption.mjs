/**
 * Adoption tracking that does not lie to you.
 *
 * "Weekly downloads" is the number npm shows and very nearly the worst one to
 * steer by. Publishing a version triggers a burst from mirrors, proxies, CDNs
 * and security scanners that has nothing to do with anyone choosing to use the
 * package — and that burst is large enough to swamp everything else. Watching
 * it go up after a release, then crash the following week, tells you about your
 * own publishing schedule and nothing about adoption.
 *
 * So this reports the signals that survive that:
 *
 *   baseline    median downloads on days with no publish. The floor of people
 *               and machines pulling it when nothing has happened.
 *   latest share  what fraction goes to the newest version. Humans install
 *               `latest`; mirrors and scanners fetch everything, so a low share
 *               means most of the traffic is not a person typing npm i.
 *   weekday lift  human usage dips at weekends, automated traffic does not.
 *   dependents  packages that actually build on it. Zero is zero, and no
 *               download count changes that.
 *
 * Snapshots append to a file so the trend is visible across runs, which is the
 * only way any of these become progress rather than a reading.
 *
 *   node scripts/adoption.mjs
 *   node scripts/adoption.mjs --days=60 --history=adoption.json
 */
import fs from 'node:fs'

const flags = {}
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) continue
  const [key, value] = arg.slice(2).split('=')
  flags[key] = value ?? true
}

const PACKAGE = String(flags.package ?? '@ahmadastic/froam')
const REPO = String(flags.repo ?? 'Ahmadastics/froam-studio')
const DAYS = Number(flags.days ?? 30)
const HISTORY = String(flags.history ?? 'adoption.json')

const iso = (date) => date.toISOString().slice(0, 10)
const today = new Date()
const from = new Date(today.getTime() - DAYS * 86400000)

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Days whose count is wildly above the local norm are publish bursts.
 *
 * Deliberately a robust rule rather than a mean-based one: a single 300-download
 * spike drags a mean far enough to hide every other day, which is exactly the
 * failure being corrected for. Anything past 4× the median is treated as an
 * event, not a level.
 */
function splitSpikes(series) {
  const counts = series.map((day) => day.downloads)
  const level = median(counts.filter((count) => count > 0)) || 1
  const spikes = series.filter((day) => day.downloads > level * 4)
  const steady = series.filter((day) => day.downloads <= level * 4)
  return { spikes, steady, level }
}

const [range, versions, packument] = await Promise.all([
  // The last-N-days form is silently broken for scoped packages — it answers
  // with a single zero-download day dated 2030. Explicit dates work.
  getJson(`https://api.npmjs.org/downloads/range/${iso(from)}:${iso(today)}/${PACKAGE}`),
  getJson(`https://api.npmjs.org/versions/${encodeURIComponent(PACKAGE)}/last-week`),
  getJson(`https://registry.npmjs.org/${PACKAGE}`),
])

const github = await getJson(`https://api.github.com/repos/${REPO}`).catch(() => null)

const series = range.downloads ?? []
const { spikes, steady, level } = splitSpikes(series)
const total = series.reduce((sum, day) => sum + day.downloads, 0)
const steadyTotal = steady.reduce((sum, day) => sum + day.downloads, 0)
const baseline = median(steady.map((day) => day.downloads))

const latestVersion = packument['dist-tags']?.latest
const perVersion = versions.downloads ?? {}
const versionTotal = Object.values(perVersion).reduce((sum, count) => sum + count, 0) || 1
const latestShare = (perVersion[latestVersion] ?? 0) / versionTotal

const weekday = steady.filter((day) => ![0, 6].includes(new Date(`${day.day}T00:00:00Z`).getUTCDay()))
const weekend = steady.filter((day) => [0, 6].includes(new Date(`${day.day}T00:00:00Z`).getUTCDay()))
const weekdayMean = weekday.length ? weekday.reduce((sum, day) => sum + day.downloads, 0) / weekday.length : 0
const weekendMean = weekend.length ? weekend.reduce((sum, day) => sum + day.downloads, 0) / weekend.length : 0

const snapshot = {
  at: new Date().toISOString(),
  package: PACKAGE,
  windowDays: DAYS,
  total,
  steadyTotal,
  baselineDaily: baseline,
  spikeDays: spikes.map((day) => ({ day: day.day, downloads: day.downloads })),
  latestVersion,
  latestShare: Math.round(latestShare * 1000) / 1000,
  perVersion,
  weekdayMean: Math.round(weekdayMean * 10) / 10,
  weekendMean: Math.round(weekendMean * 10) / 10,
  stars: github?.stargazers_count ?? null,
  forks: github?.forks_count ?? null,
  openIssues: github?.open_issues_count ?? null,
}

const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : []
const previous = history[history.length - 1]
history.push(snapshot)
fs.writeFileSync(HISTORY, JSON.stringify(history, null, 2))

const delta = (now, before, unit = '') =>
  before === undefined || before === null ? '' : `  (${now - before >= 0 ? '+' : ''}${Math.round((now - before) * 10) / 10}${unit} since last run)`

console.log(`\n── ${PACKAGE} ${'─'.repeat(50 - PACKAGE.length)}`)
console.log(`  window ${iso(from)} → ${iso(today)}   snapshot ${history.length}`)
console.log('')
console.log(`  headline (what npm shows)   ${total} downloads`)
console.log(`  publish bursts removed      ${steadyTotal}`)
console.log(`  baseline                    ${baseline}/day${delta(baseline, previous?.baselineDaily, '/day')}`)
if (spikes.length) {
  console.log(`\n  ${spikes.length} spike day${spikes.length === 1 ? '' : 's'} excluded — these track your releases, not your users:`)
  for (const day of spikes) console.log(`    ${day.day}  ${day.downloads}  (${Math.round(day.downloads / Math.max(1, level))}× the normal day)`)
}

console.log(`\n  latest is ${latestVersion}, taking ${(latestShare * 100).toFixed(0)}% of version traffic${delta(snapshot.latestShare, previous?.latestShare)}`)
for (const [version, count] of Object.entries(perVersion).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${version.padEnd(10)} ${String(count).padStart(5)}${version === latestVersion ? '   ← latest' : ''}`)
}
console.log(latestShare < 0.4
  ? '  A person running npm i gets latest. Most of this traffic is not a person.'
  : '  Most traffic is going to the current version, which is what real use looks like.')

console.log(`\n  weekday ${weekdayMean.toFixed(1)}/day   weekend ${weekendMean.toFixed(1)}/day`)
// Below a handful of downloads a day the weekday signal is noise, and calling
// it either way would be inventing a conclusion from nothing — the same trap as
// reporting a significance test on nine samples.
if (steadyTotal < 30) console.log('  Too little steady traffic to read a weekly pattern from.')
else if (weekdayMean > weekendMean * 1.5) console.log('  Human-shaped: usage dips at weekends.')
else console.log('  Flat across the week, which is what automated traffic looks like.')

if (github) {
  console.log(`\n  github  ${github.stargazers_count} stars${delta(github.stargazers_count, previous?.stars)}   ` +
    `${github.forks_count} forks   ${github.open_issues_count} open issues`)
}
console.log(`  npm     ${Object.keys(packument.versions ?? {}).length} versions published`)

console.log(`\n  The numbers that would mean somebody actually used this — a dependent,`)
console.log(`  an issue, a fork, a question — are the ones to watch. Downloads can rise`)
console.log(`  a long way without any of them moving.\n`)
console.log(`  history: ${HISTORY} (${history.length} snapshot${history.length === 1 ? '' : 's'})\n`)
