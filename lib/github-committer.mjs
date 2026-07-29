/**
 * Froam Studio — the GitHub committer.
 *
 * `Save to Repo` writes files through the local `froam dev` bridge, which
 * means it only works on the machine running the bridge. Publish from a phone
 * and there is no bridge, so the design can reach the publish API but can
 * never reach the repo — and a design that isn't in the repo isn't in the
 * build.
 *
 * This closes that gap server-side: take a design, compile it the same way the
 * bridge does, and commit the result through the GitHub Contents API. Vercel's
 * existing GitHub integration sees the commit and redeploys. No CI, no runner,
 * no bridge — a token and two HTTPS calls.
 *
 *   import { createGitHubCommitter } from 'froam-studio/server'
 *
 *   const commit = createGitHubCommitter({
 *     token: process.env.GITHUB_TOKEN,     // contents:write on the repo
 *     repo: 'you/your-site',
 *     branch: 'main',
 *     dir: 'src/froam',
 *   })
 *
 *   await commit({ design, message: 'Design update from Froam' })
 *
 * Wire it into the publish API so one save does both:
 *
 *   createFroamPublishApi({ file, authorize, commit })
 */
import { buildDesignArtifacts } from './codegen.mjs'

const API = 'https://api.github.com'

function assert(value, message) {
  if (!value) throw new Error(`[froam] ${message}`)
}

/** GitHub wants base64, and designs are full of non-ASCII (curly quotes, emoji). */
function toBase64(text) {
  return Buffer.from(text, 'utf8').toString('base64')
}

export function createGitHubCommitter(options = {}) {
  const {
    token,
    repo,
    branch = 'main',
    dir = 'froam',
    committer,
    fetchImpl = globalThis.fetch,
  } = options

  assert(token, 'createGitHubCommitter needs a token with contents:write')
  assert(repo && repo.includes('/'), 'createGitHubCommitter needs repo as "owner/name"')
  assert(fetchImpl, 'createGitHubCommitter needs a fetch implementation (Node 18+)')

  async function gh(path, init = {}) {
    const response = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'froam-studio',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    const text = await response.text()
    const body = text ? JSON.parse(text) : null
    if (!response.ok) {
      const detail = body?.message ? `: ${body.message}` : ''
      throw new Error(`[froam] GitHub ${init.method ?? 'GET'} ${path} failed (${response.status})${detail}`)
    }
    return body
  }

  /**
   * The Contents API refuses a write without the blob's current sha, which is
   * what stops two devices silently overwriting each other. A missing file is
   * a 404 and simply means "no sha yet".
   */
  async function currentSha(path) {
    try {
      const existing = await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`)
      return Array.isArray(existing) ? null : existing?.sha ?? null
    } catch (error) {
      if (String(error.message).includes('(404)')) return null
      throw error
    }
  }

  async function putFile(path, content, message) {
    const sha = await currentSha(path)
    return gh(`/repos/${repo}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: toBase64(content),
        branch,
        ...(sha ? { sha } : {}),
        ...(committer ? { committer } : {}),
      }),
    })
  }

  /**
   * Commit a design as the same three files the bridge writes, so a repo
   * populated from a phone is byte-identical to one populated from a laptop.
   *
   * Files are written one at a time rather than as a single tree commit: it is
   * three calls instead of five, needs no git plumbing, and an interrupted run
   * leaves a valid repo rather than a dangling tree. The cost is that a design
   * and its CSS can land in separate commits — harmless, because the runtime
   * reads the design and the CSS is regenerated from it.
   */
  return async function commitDesign({ design, message, paths } = {}) {
    assert(design && typeof design === 'object', 'commitDesign needs a design')

    const artifacts = buildDesignArtifacts(design)
    const base = dir.replace(/\/+$/, '')
    const targets = paths ?? {
      design: `${base}/froam.design.json`,
      css: `${base}/froam.generated.css`,
      runtime: `${base}/froam.runtime.js`,
    }

    const subject = message || 'Design update from Froam'
    const written = []
    for (const [key, path] of Object.entries(targets)) {
      const content = artifacts[key]
      if (typeof content !== 'string') continue
      const result = await putFile(path, content, subject)
      written.push({ path, commit: result?.commit?.sha ?? null })
    }

    assert(written.length, 'commitDesign wrote nothing — check `paths`')
    return { repo, branch, written }
  }
}
