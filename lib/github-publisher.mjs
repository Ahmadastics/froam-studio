/**
 * Froam — approving on GitHub.
 *
 * Under `froam dev`, approving a teammate's change writes it into the files on
 * the owner's machine. A hosted site has no such machine. This is the same
 * approval, done against the repo:
 *
 *   1. read the design and the source files from the base branch;
 *   2. put copy into the source where it can be placed (the same strict rules
 *      as locally — source-writeback.mjs), and styles into Tailwind class
 *      lists where that's clean (style-writeback.mjs);
 *   3. merge only the request's paths onto the current design and regenerate
 *      the artifacts;
 *   4. make one commit with all of it, and open a pull request (or, with
 *      `mode: 'commit'`, move the branch straight to it).
 *
 * CI runs on the pull request like on any other; merging deploys. Reverting
 * closes the pull request if it hasn't merged yet, or opens one that takes the
 * change back — leaving alone anything someone changed again since.
 *
 *   import { createFroamRoomApi, createGitHubPublisher } from '@ahmadastic/froam/server'
 *
 *   const github = createGitHubPublisher({
 *     token: process.env.GITHUB_TOKEN,     // contents + pull requests: write
 *     repo: 'you/your-site',
 *     base: 'main',
 *     dir: 'src/froam',                    // where froam.design.json lives
 *     siteUrl: 'https://your-site.com',    // links back into the editor
 *   })
 *   createFroamRoomApi({ storage, ...github })   // onApproveRequest + onRevertRequest
 */
import { approveChangeRequest, buildDesignArtifacts, revertChangeRequest, requestScopes } from './codegen.mjs'
import { applyTextEdits, isSourcePath } from './source-writeback.mjs'
import { applyStyleEdits, revertClassLists } from './style-writeback.mjs'

const API = 'https://api.github.com'
const MAX_SOURCE_BYTES = 1_000_000

function assert(value, message) {
  if (!value) throw new Error(`[froam] ${message}`)
}

const slug = (text) => String(text ?? 'changes').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'changes'

const where = (scope) => `${scope.routeKey === '/' ? 'Home' : scope.routeKey}${scope.viewport === 'desktop' ? '' : ` (${scope.viewport})`}`

const cell = (text) => String(text ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 200) || '—'

/** A pull request a reviewer can read without opening Froam. */
export function pullRequestBody({ request, room, siteUrl, files = [], skippedCopy = 0 }) {
  const author = room?.members?.[request.actor]
  const lines = [
    `**${request.createdBy}**${author?.title ? ` (${author.title})` : ''} suggested this in Froam; **${request.decidedBy ?? 'the owner'}** approved it.`,
    '',
  ]
  if (request.note) lines.push(`> ${request.note.replace(/\n/g, '\n> ')}`, '')
  const scopes = requestScopes(request)
  lines.push(`**Where:** ${scopes.map(where).join(', ')}`, '')
  if (request.changes?.length) {
    lines.push('| Change | Before | After |', '| --- | --- | --- |')
    for (const change of request.changes.slice(0, 50)) lines.push(`| ${cell(change.label)} | ${cell(change.before)} | ${cell(change.after)} |`)
    if (request.changes.length > 50) lines.push(`| …and ${request.changes.length - 50} more | | |`)
    lines.push('')
  }
  if (files.length) lines.push(`**Written into the source:** ${files.map((file) => `\`${file}\``).join(', ')}`, '')
  if (skippedCopy) lines.push(`${skippedCopy} copy edit${skippedCopy === 1 ? '' : 's'} couldn’t be placed in the source safely and stay${skippedCopy === 1 ? 's' : ''} in the Froam design.`, '')
  if (siteUrl && room?.id) {
    const open = new URL(siteUrl)
    open.searchParams.set('froam-room-id', room.id)
    open.searchParams.set('froam-open', `request:${request.id}`)
    lines.push(`[Open in Froam](${open})`, '')
  }
  lines.push('<sub>Opened by Froam</sub>')
  return lines.join('\n')
}

/**
 * @param {{
 *   token: string, repo: string, base?: string, dir?: string,
 *   sourceDir?: string, mode?: 'pull-request' | 'commit', autoMerge?: boolean,
 *   siteUrl?: string, tailwind?: boolean, maxSourceFiles?: number,
 *   committer?: { name: string, email: string }, fetchImpl?: typeof fetch,
 * }} options
 */
export function createGitHubPublisher(options = {}) {
  const {
    token,
    repo,
    base = 'main',
    dir = 'froam',
    sourceDir = '',
    mode = 'pull-request',
    autoMerge = false,
    siteUrl = null,
    tailwind = false,
    maxSourceFiles = 1500,
    committer,
    fetchImpl = globalThis.fetch,
  } = options
  assert(token, 'createGitHubPublisher needs a token (contents and pull requests: write)')
  assert(repo && repo.includes('/'), 'createGitHubPublisher needs repo as "owner/name"')
  assert(mode === 'pull-request' || mode === 'commit', 'mode is "pull-request" or "commit"')

  const designDir = dir.replace(/^\/+|\/+$/g, '')
  const sourceRoot = sourceDir.replace(/^\/+|\/+$/g, '')

  async function gh(apiPath, init = {}) {
    const response = await fetchImpl(`${API}${apiPath}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'froam-studio',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    const text = await response.text()
    const body = text ? JSON.parse(text) : null
    if (!response.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${apiPath} failed (${response.status})${body?.message ? `: ${body.message}` : ''}`)
    return body
  }

  const readBlob = async (sha) => {
    const blob = await gh(`/repos/${repo}/git/blobs/${sha}`)
    return Buffer.from(blob.content ?? '', blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8')
  }

  /** The base branch as it is now: its commit, its tree, and a way to read files. */
  async function snapshot() {
    const ref = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`)
    const commitSha = ref.object.sha
    const commit = await gh(`/repos/${repo}/git/commits/${commitSha}`)
    const tree = await gh(`/repos/${repo}/git/trees/${commit.tree.sha}?recursive=1`)
    const blobs = new Map((tree.tree ?? []).filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry]))
    return { commitSha, treeSha: commit.tree.sha, blobs }
  }

  async function readDesign(snap) {
    const entry = snap.blobs.get(`${designDir ? `${designDir}/` : ''}froam.design.json`)
    if (!entry) return {}
    try { return JSON.parse(await readBlob(entry.sha)) } catch { return {} }
  }

  /** Every source file that could hold copy or class lists, read up front (the edits are synchronous). */
  async function readSources(snap) {
    const prefix = sourceRoot ? `${sourceRoot}/` : ''
    const candidates = [...snap.blobs.values()]
      .filter((entry) => entry.path.startsWith(prefix) && (entry.size ?? 0) <= MAX_SOURCE_BYTES)
      .filter((entry) => isSourcePath(entry.path.slice(prefix.length)))
      .filter((entry) => !entry.path.startsWith(`${designDir}/`))
      .slice(0, maxSourceFiles)
    const contents = new Map()
    for (let i = 0; i < candidates.length; i += 8) {
      await Promise.all(candidates.slice(i, i + 8).map(async (entry) => {
        try { contents.set(entry.path, await readBlob(entry.sha)) } catch { contents.set(entry.path, null) }
      }))
    }
    return contents
  }

  async function commitFiles(snap, files, message) {
    const tree = await gh(`/repos/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: snap.treeSha,
        tree: [...files].map(([filePath, content]) => ({ path: filePath, mode: '100644', type: 'blob', content })),
      }),
    })
    return gh(`/repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.sha, parents: [snap.commitSha], ...(committer ? { committer, author: committer } : {}) }),
    })
  }

  /** Put a commit where it belongs: straight onto the base branch, or on a branch with a pull request. */
  async function ship(snap, commit, { branchName, title, body }) {
    if (mode === 'commit') {
      await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(base)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
      return { detail: `Committed to ${base}`, link: commit.html_url ?? `https://github.com/${repo}/commit/${commit.sha}`, number: null, branch: base }
    }
    await gh(`/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commit.sha }) })
    const pull = await gh(`/repos/${repo}/pulls`, { method: 'POST', body: JSON.stringify({ title, head: branchName, base, body }) })
    let merged = false
    if (autoMerge) {
      try {
        await gh(`/repos/${repo}/pulls/${pull.number}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'squash' }) })
        merged = true
      } catch { /* checks or protection: it stays open for someone to merge */ }
    }
    return {
      detail: merged ? `Merged pull request #${pull.number}` : `Opened pull request #${pull.number} — merging it publishes`,
      link: pull.html_url,
      number: pull.number,
      branch: branchName,
    }
  }

  /** Copy and styles into the source; returns the changed files and what was written. */
  function writeSource(sources, request) {
    const files = [...sources.keys()]
    const read = (file) => sources.get(file) ?? null
    const changed = new Map()
    const text = applyTextEdits(files, request.textEdits ?? [], { read })
    for (const [file, content] of text.changed) { changed.set(file, content); sources.set(file, content) }
    const writtenText = text.results.map((result, index) => (result.status === 'written' ? request.textEdits[index].to : null)).filter(Boolean)
    const skippedCopy = text.results.filter((result) => result.status !== 'written' && result.status !== 'skipped').length
    let writtenStyles = []
    if (tailwind && Array.isArray(request.styleEdits) && request.styleEdits.length) {
      const styles = applyStyleEdits(files.filter((file) => !file.endsWith('.json')), request.styleEdits, { read })
      for (const [file, content] of styles.changed) { changed.set(file, content); sources.set(file, content) }
      writtenStyles = styles.results
    }
    return { changed, writtenText, writtenStyles, skippedCopy }
  }

  /** Styles placed in class lists leave the design, as written copy does. */
  function withoutWrittenStyles(request, writtenStyles) {
    if (!writtenStyles.length) return request
    const bySpot = new Map()
    request.styleEdits.forEach((edit, index) => {
      const result = writtenStyles[index]
      if (result?.status === 'written') bySpot.set(`${edit.routeKey ?? request.routeKey}@@${edit.viewport ?? 'desktop'}@@${edit.path}`, result.written)
    })
    const scopes = requestScopes(request).map((scope) => ({
      ...scope,
      store: Object.fromEntries(Object.entries(scope.store).map(([key, draft]) => {
        const written = bySpot.get(`${scope.routeKey}@@${scope.viewport}@@${key}`)
        if (!written || !draft?.styles) return [key, draft]
        const styles = { ...draft.styles }
        for (const property of written) delete styles[property]
        return [key, { ...draft, styles }]
      })),
    }))
    return { ...request, scopes }
  }

  async function onApproveRequest({ room, request }) {
    const snap = await snapshot()
    const design = await readDesign(snap)
    const needsSource = (request.textEdits?.length ?? 0) > 0 || (tailwind && (request.styleEdits?.length ?? 0) > 0)
    const sources = needsSource ? await readSources(snap) : new Map()
    const { changed, writtenText, writtenStyles, skippedCopy } = writeSource(sources, request)
    const { design: next, undo } = approveChangeRequest(design, withoutWrittenStyles(request, writtenStyles), { writtenText })
    const artifacts = buildDesignArtifacts(next)
    const files = new Map(changed)
    const at = (name) => `${designDir ? `${designDir}/` : ''}${name}`
    files.set(at('froam.design.json'), artifacts.design)
    files.set(at('froam.generated.css'), artifacts.css)
    files.set(at('froam.runtime.js'), artifacts.runtime)
    const title = `${request.title}`
    const commit = await commitFiles(snap, files, `${title}\n\nSuggested by ${request.createdBy} in Froam.`)
    const shipped = await ship(snap, commit, {
      branchName: `froam/${slug(request.title)}-${String(request.id).slice(0, 6)}`,
      title,
      body: pullRequestBody({ request, room, siteUrl, files: [...changed.keys()], skippedCopy }),
    })
    const classLists = writtenStyles.filter((result) => result.status === 'written').map(({ tag, from, to }) => ({ tag, from, to }))
    return { ...shipped, undo: { ...undo, classLists } }
  }

  async function onRevertRequest({ room, request, undo }) {
    // Not merged yet: taking it back is closing it.
    const number = request.published?.number
    if (mode === 'pull-request' && number) {
      const pull = await gh(`/repos/${repo}/pulls/${number}`)
      if (pull.state === 'open') {
        await gh(`/repos/${repo}/pulls/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) })
        if (pull.head?.ref?.startsWith('froam/')) {
          try { await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(pull.head.ref)}`, { method: 'DELETE' }) } catch { /* already gone */ }
        }
        return { detail: `Closed pull request #${number} before it merged`, link: pull.html_url, skipped: [] }
      }
      if (!pull.merged_at) return { detail: `Pull request #${number} was closed without merging — nothing to take back`, link: pull.html_url, skipped: [] }
    }
    assert(undo, 'This change was approved before Froam could revert — revert its commit in git instead')
    const snap = await snapshot()
    const design = await readDesign(snap)
    const sources = undo.textEdits?.length || undo.classLists?.length ? await readSources(snap) : new Map()
    const read = (file) => sources.get(file) ?? null
    const text = applyTextEdits([...sources.keys()], undo.textEdits ?? [], { read })
    for (const [file, content] of text.changed) sources.set(file, content)
    const classes = revertClassLists([...sources.keys()], undo.classLists ?? [], { read })
    for (const [file, content] of classes.changed) text.changed.set(file, content)
    const { design: next, skipped } = revertChangeRequest(design, undo)
    const artifacts = buildDesignArtifacts(next)
    const files = new Map(text.changed)
    const at = (name) => `${designDir ? `${designDir}/` : ''}${name}`
    files.set(at('froam.design.json'), artifacts.design)
    files.set(at('froam.generated.css'), artifacts.css)
    files.set(at('froam.runtime.js'), artifacts.runtime)
    const title = `Revert “${request.title}”`
    const commit = await commitFiles(snap, files, `${title}\n\nReverted in Froam.`)
    const body = [
      `Takes back **${request.title}** (suggested by ${request.createdBy}${request.published?.number ? `, #${request.published.number}` : ''}).`,
      skipped.length ? `\n${skipped.length} spot${skipped.length === 1 ? ' was' : 's were'} changed again since and ${skipped.length === 1 ? 'is' : 'are'} left as they are now.` : '',
      '\n<sub>Opened by Froam</sub>',
    ].join('\n')
    const shipped = await ship(snap, commit, { branchName: `froam/revert-${slug(request.title)}-${String(request.id).slice(0, 6)}`, title, body })
    return { ...shipped, skipped }
  }

  return { onApproveRequest, onRevertRequest }
}

