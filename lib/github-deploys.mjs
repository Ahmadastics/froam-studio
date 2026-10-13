/**
 * What the host did with a push, as GitHub hears it.
 *
 * Vercel, Netlify and Cloudflare Pages each report their deployments back to
 * the GitHub repo they build from: a deployment per push, with a status that
 * goes pending → success (with the address it went live at) or failure (with
 * a link to the build log). Some hosts post a commit status instead. Reading
 * those lets Go Live say the true thing without anyone telling Froam the
 * site's address: "Vercel finished — live at …", or "Vercel's build failed,
 * here's the log". The same reports name the branch a host deploys to
 * production and which of several remotes it watches.
 *
 * Public repos need no sign-in. A private one uses a token the person already
 * has: GITHUB_TOKEN / GH_TOKEN, the GitHub CLI's, or the login git keeps for
 * github.com (git credential fill — never prompting). The token is only ever
 * sent to api.github.com, and never logged, returned or shown.
 */
import { execFile } from 'node:child_process'

const API = 'https://api.github.com'

/** owner/repo of a github.com remote, whatever its spelling; null for anything else. */
export function githubRepoOf(remoteUrl) {
  const text = String(remoteUrl ?? '').trim()
  const match = /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https?:\/\/(?:[^@/]+@)?(?:www\.)?github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(text)
  return match ? { owner: match[1], repo: match[2] } : null
}

function run(command, args, { input = null, timeout = 8000, cwd } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GH_PROMPT_DISABLED: '1' }
    const child = execFile(command, args, { cwd, env, timeout, windowsHide: true }, (error, stdout) => resolve(error ? null : String(stdout)))
    if (input !== null) { child.stdin?.end(input) }
  })
}

/** A token for api.github.com the person already has, or null. Never prompts. */
export async function findGitHubToken({ cwd, env = process.env } = {}) {
  const fromEnv = env.GITHUB_TOKEN || env.GH_TOKEN
  if (fromEnv) return fromEnv.trim()
  const fromGh = (await run('gh', ['auth', 'token', '--hostname', 'github.com'], { cwd, timeout: 5000 }))?.trim()
  if (fromGh) return fromGh
  // The login git uses to push to github.com: what Go Live is already about to push with.
  const filled = await run('git', ['credential', 'fill'], { cwd, input: 'protocol=https\nhost=github.com\n\n' })
  const password = /^password=(.+)$/m.exec(filled ?? '')?.[1]?.trim()
  return password || null
}

/** Who deployed, as people say it: vercel[bot] → Vercel. */
export function hostName(login = '', context = '') {
  const said = `${login} ${context}`.toLowerCase()
  if (said.includes('vercel')) return 'Vercel'
  if (said.includes('netlify')) return 'Netlify'
  if (said.includes('cloudflare')) return 'Cloudflare Pages'
  if (said.includes('render')) return 'Render'
  if (said.includes('railway')) return 'Railway'
  if (said.includes('github-actions') || said.includes('github-pages') || said.includes('pages build')) return 'GitHub Pages'
  if (said.includes('amplify')) return 'AWS Amplify'
  return null
}

const isProduction = (deployment) => deployment?.production_environment === true || /prod/i.test(String(deployment?.environment ?? ''))
const stateOf = (state) => (state === 'success' ? 'success' : state === 'failure' || state === 'error' ? 'failure' : state === 'inactive' ? 'inactive' : 'pending')

/**
 * @param {{ owner: string, repo: string, token?: string | null, fetchImpl?: typeof fetch }} options
 */
export function createGitHubDeploys({ owner, repo, token = null, fetchImpl = globalThis.fetch }) {
  async function api(path) {
    const response = await fetchImpl(`${API}/repos/${owner}/${repo}${path}`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'froam-go-live', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!response.ok) {
      const error = new Error(response.status === 404 ? 'not found (private without a sign-in, or no such repo)' : response.status === 403 || response.status === 429 ? 'GitHub asked Froam to slow down' : `GitHub answered ${response.status}`)
      error.status = response.status
      throw error
    }
    return response.json()
  }

  async function latestStatus(deployment) {
    const statuses = await api(`/deployments/${deployment.id}/statuses?per_page=1`)
    return statuses?.[0] ?? null
  }

  return {
    /** The repo as GitHub describes it: its website field, and its default branch. */
    async about() {
      const info = await api('')
      return { homepage: typeof info?.homepage === 'string' && /^https?:\/\//i.test(info.homepage) ? info.homepage.replace(/\/+$/, '') : null, defaultBranch: info?.default_branch ?? null }
    },

    /** The most recent production deployment a host reported: where it went live, from which branch, by whom. */
    async lastProduction() {
      const deployments = await api('/deployments?per_page=20')
      const production = (Array.isArray(deployments) ? deployments : []).find(isProduction)
      if (!production) return null
      const status = await latestStatus(production)
      const url = status?.environment_url || null
      return {
        host: hostName(production.creator?.login, production.environment),
        branch: typeof production.ref === 'string' && !/^[0-9a-f]{40}$/i.test(production.ref) ? production.ref : null,
        url: url && /^https?:\/\//i.test(url) ? url.replace(/\/+$/, '') : null,
        at: production.created_at ?? null,
      }
    },

    /** What hosts have said about one commit: a deployment (production preferred), or else a commit status. */
    async forCommit(sha) {
      const deployments = await api(`/deployments?sha=${encodeURIComponent(sha)}&per_page=10`)
      const list = Array.isArray(deployments) ? deployments : []
      const deployment = list.find(isProduction) ?? list[0]
      if (deployment) {
        const status = await latestStatus(deployment)
        return {
          state: status ? stateOf(status.state) : 'pending',
          url: status?.environment_url || null,
          logUrl: status?.log_url || status?.target_url || null,
          host: hostName(deployment.creator?.login, deployment.environment),
          production: isProduction(deployment),
        }
      }
      const combined = await api(`/commits/${encodeURIComponent(sha)}/status`)
      const statuses = (Array.isArray(combined?.statuses) ? combined.statuses : []).filter((status) => hostName(status.creator?.login, status.context))
      if (!statuses.length) return { state: 'none' }
      const failed = statuses.find((status) => stateOf(status.state) === 'failure')
      const pending = statuses.find((status) => stateOf(status.state) === 'pending')
      const chosen = failed ?? pending ?? statuses[0]
      return { state: stateOf(chosen.state), url: null, logUrl: chosen.target_url || null, host: hostName(chosen.creator?.login, chosen.context), production: null }
    },
  }
}

/**
 * Follow one commit until a host says it's done (or failed).
 * `none`: no host said anything within `firstSignMs` — nothing reports to GitHub.
 * `unknown`: GitHub couldn't be asked (a private repo without a sign-in, a rate limit).
 */
export async function waitForDeploy(client, sha, { firstSignMs = 90_000, timeoutMs = 10 * 60_000, everyMs = 5_000, say = () => {}, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
  const started = now()
  let seen = null
  let wait = everyMs
  while (now() - started <= timeoutMs) {
    let report
    try {
      report = await client.forCommit(sha)
    } catch (error) {
      return { state: 'unknown', reason: error instanceof Error ? error.message : String(error) }
    }
    if (report.state === 'success' || report.state === 'failure') return report
    if (report.state !== 'none') {
      seen = report
      say(report, Math.round((now() - started) / 1000))
    } else if (!seen && now() - started > firstSignMs) {
      return { state: 'none' }
    }
    await sleep(wait)
    // Gentle on the rate limit: a build that takes minutes is asked about less often.
    wait = Math.min(wait + everyMs / 2, 20_000)
  }
  return { state: 'timeout', ...(seen ?? {}) }
}
