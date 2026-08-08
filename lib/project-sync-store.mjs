import fs from 'node:fs'
import path from 'node:path'

const MAX_BODY_BYTES = 2_000_000
const MAX_EVENTS_PER_PUSH = 1_000

function sendJson(res, status, payload) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)) }
function readBody(req) { if (req.body && typeof req.body === 'object') return Promise.resolve(req.body); return new Promise((resolve, reject) => { let body = ''; req.on('data', (chunk) => { body += chunk; if (body.length > MAX_BODY_BYTES) reject(new Error('Payload too large')) }); req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch (error) { reject(error) } }); req.on('error', reject) }) }
function fileStorage(file) { return { get(id) { try { const all = JSON.parse(fs.readFileSync(file, 'utf8')); return all.projects?.[id] ?? null } catch { return null } }, put(project) { let all = { version: 1, projects: {} }; try { all = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* first write */ } all.projects ??= {}; all.projects[project.id] = project; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n') } } }
function empty(id) { return { version: 1, id, sequence: 0, events: [], checkpoints: {}, branches: {} } }
function validEvent(event, projectId, branchId) { return event && event.schemaVersion === 2 && event.projectId === projectId && event.branchId === branchId && typeof event.id === 'string' && typeof event.clock === 'number' }

/** Pure server merge used by the HTTP adapter and tests. Room ops remain canonical. */
export function mergeHostedProjectState(current, push) {
  const project = current ? structuredClone(current) : empty(push.projectId)
  if (project.id !== push.projectId) throw new Error('Project mismatch')
  if (typeof push.branchId !== 'string' || !push.branchId) throw new Error('A branch is required')
  const incoming = Array.isArray(push.events) ? push.events : []
  if (incoming.length > MAX_EVENTS_PER_PUSH) throw new Error('Too many project events')
  const known = new Set(project.events.map((item) => item.event.id))
  for (const item of incoming) {
    if (!validEvent(item.event, push.projectId, push.branchId)) throw new Error('Invalid or cross-branch project event')
    if (item.event.type === 'design.op.appended' && !Number.isFinite(item.roomSequence)) throw new Error('Design operations require their canonical room sequence')
    if (known.has(item.event.id)) continue
    project.sequence += 1; project.events.push({ seq: project.sequence, roomSequence: Number.isFinite(item.roomSequence) ? item.roomSequence : undefined, event: item.event }); known.add(item.event.id)
  }
  for (const checkpoint of Array.isArray(push.checkpoints) ? push.checkpoints : []) { if (checkpoint.branchId !== push.branchId || checkpoint.projectId !== push.projectId || (project.checkpoints[checkpoint.id] && project.checkpoints[checkpoint.id].branchId !== push.branchId)) throw new Error('Cross-branch checkpoint refused'); project.checkpoints[checkpoint.id] = checkpoint }
  const branches = Array.isArray(push.branches) ? push.branches : []; const active = branches.find((branch) => branch.id === push.branchId); const allowedBranches = new Set([push.branchId, active?.parentBranchId].filter(Boolean))
  for (const branch of branches) { if (!allowedBranches.has(branch.id)) throw new Error('Unrelated branch metadata refused'); project.branches[branch.id] = branch }
  project.events.sort((a, b) => { if (Number.isFinite(a.roomSequence) && Number.isFinite(b.roomSequence) && a.roomSequence !== b.roomSequence) return a.roomSequence - b.roomSequence; return a.seq - b.seq })
  return project
}

export function createFroamProjectSyncApi({ file, storage, authorize = null } = {}) {
  const persistence = storage ?? (file ? fileStorage(file) : null)
  if (!persistence) throw new Error('[froam] project sync needs a file or storage')
  return async function projectSyncApi(req, res) {
    const url = new URL(req.url ?? '/', 'http://froam.local'); const match = url.pathname.match(/^\/api\/froam\/projects\/([^/]+)\/sync$/)
    if (!match) return false
    const projectId = decodeURIComponent(match[1]); const body = req.method === 'POST' ? await readBody(req) : {}; const actor = body.actor ?? url.searchParams.get('actor')
    if (authorize && !await authorize(req, { projectId, actor })) { sendJson(res, 403, { success: false, error: 'Not authorized to synchronize this project' }); return true }
    const current = await persistence.get(projectId) ?? empty(projectId)
    if (req.method === 'GET') { const cursor = Math.max(0, Number(url.searchParams.get('cursor')) || 0); const branchId = url.searchParams.get('branchId') || 'main'; sendJson(res, 200, { success: true, projectId, branchId, cursor: current.sequence, events: current.events.filter((item) => item.seq > cursor && item.event.branchId === branchId), checkpoints: Object.values(current.checkpoints).filter((item) => item.branchId === branchId), branches: Object.values(current.branches) }); return true }
    if (req.method === 'POST') { try { const next = mergeHostedProjectState(current, { ...body, projectId }); await persistence.put(next); const cursor = Math.max(0, Number(body.cursor) || 0); sendJson(res, 200, { success: true, projectId, branchId: body.branchId, cursor: next.sequence, events: next.events.filter((item) => item.seq > cursor && item.event.branchId === body.branchId), checkpoints: Object.values(next.checkpoints).filter((item) => item.branchId === body.branchId), branches: Object.values(next.branches) }) } catch (error) { sendJson(res, 400, { success: false, error: error instanceof Error ? error.message : 'Invalid sync payload' }) } return true }
    sendJson(res, 405, { success: false, error: 'Method not allowed' }); return true
  }
}
