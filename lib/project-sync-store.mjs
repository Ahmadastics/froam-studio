import { adaptLegacyProjectStorage, createFileProjectDocumentStore, FroamStaleRevisionError } from './project-document-store.mjs'

const MAX_BODY_BYTES = 2_000_000
const MAX_EVENTS_PER_PUSH = 1_000

function sendJson(res, status, payload) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)) }
function readBody(req) { if (req.body && typeof req.body === 'object') return Promise.resolve(req.body); return new Promise((resolve, reject) => { let body = ''; req.on('data', (chunk) => { body += chunk; if (body.length > MAX_BODY_BYTES) reject(new Error('Payload too large')) }); req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch (error) { reject(error) } }); req.on('error', reject) }) }
function empty(id) { return { version: 2, id, revision: 0, sequence: 0, events: [], checkpoints: {}, branches: {} } }
function safeId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(value) }
function validEvent(event, projectId, branchId) { return event && event.schemaVersion === 2 && event.projectId === projectId && event.branchId === branchId && safeId(event.id) && Number.isSafeInteger(event.clock) && event.clock >= 0 && Array.isArray(event.targetIds) && event.targetIds.length <= 500 }

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
  const incomingIds = new Set(incoming.map((item) => item?.event?.id).filter(Boolean)); const knownIds = new Set([...known, ...incomingIds])
  for (const checkpoint of Array.isArray(push.checkpoints) ? push.checkpoints : []) { if (!safeId(checkpoint.id) || checkpoint.branchId !== push.branchId || checkpoint.projectId !== push.projectId || (project.checkpoints[checkpoint.id] && project.checkpoints[checkpoint.id].branchId !== push.branchId)) throw new Error('Cross-branch or invalid checkpoint refused'); if (!Array.isArray(checkpoint.eventIds) || checkpoint.eventIds.some((id) => !knownIds.has(id))) throw new Error('Checkpoint references unknown events'); if (checkpoint.parentCheckpointId && !project.checkpoints[checkpoint.parentCheckpointId] && !(push.checkpoints ?? []).some((item) => item.id === checkpoint.parentCheckpointId)) throw new Error('Checkpoint parent is missing'); project.checkpoints[checkpoint.id] = checkpoint }
  const branches = Array.isArray(push.branches) ? push.branches : []; const active = branches.find((branch) => branch.id === push.branchId); const allowedBranches = new Set([push.branchId, active?.parentBranchId].filter(Boolean))
  for (const branch of branches) { if (!safeId(branch.id) || !allowedBranches.has(branch.id)) throw new Error('Unrelated branch metadata refused'); const previous = project.branches[branch.id]; if (branch.id === push.branchId && push.expectedBranchHeadId !== undefined && (previous?.headEventId ?? null) !== push.expectedBranchHeadId) throw new FroamStaleRevisionError(push.expectedBranchHeadId, previous?.headEventId ?? null); if (!project.checkpoints[branch.baseCheckpointId]) throw new Error('Branch base checkpoint is missing'); project.branches[branch.id] = branch }
  project.events.sort((a, b) => { if (Number.isFinite(a.roomSequence) && Number.isFinite(b.roomSequence) && a.roomSequence !== b.roomSequence) return a.roomSequence - b.roomSequence; return a.seq - b.seq })
  return project
}

export function createFroamProjectSyncApi({ file, storage, authorize = null } = {}) {
  const persistence = storage ? adaptLegacyProjectStorage(storage) : file ? createFileProjectDocumentStore(file) : null
  if (!persistence) throw new Error('[froam] project sync needs a file or storage')
  return async function projectSyncApi(req, res) {
    const url = new URL(req.url ?? '/', 'http://froam.local'); const match = url.pathname.match(/^\/api\/froam\/projects\/([^/]+)\/sync$/)
    if (!match) return false
    const projectId = decodeURIComponent(match[1]); const body = req.method === 'POST' ? await readBody(req) : {}; const actor = body.actor ?? url.searchParams.get('actor')
    if (authorize && !await authorize(req, { projectId, actor })) { sendJson(res, 403, { success: false, error: 'Not authorized to synchronize this project' }); return true }
    const current = await persistence.read(projectId) ?? empty(projectId)
    if (req.method === 'GET') { const requestedCursor = Math.max(0, Number(url.searchParams.get('cursor')) || 0); const cursorReset = requestedCursor > current.sequence; const cursor = cursorReset ? 0 : requestedCursor; const branchId = url.searchParams.get('branchId') || 'main'; sendJson(res, 200, { success: true, projectId, branchId, revision: current.revision, cursor: current.sequence, cursorReset, events: current.events.filter((item) => item.seq > cursor && item.event.branchId === branchId), checkpoints: Object.values(current.checkpoints).filter((item) => item.branchId === branchId), branches: Object.values(current.branches).filter((item) => item.id === branchId || item.parentBranchId === branchId || item.id === current.branches[branchId]?.parentBranchId) }); return true }
    if (req.method === 'POST') { try { const next = await persistence.transaction(projectId, Number.isSafeInteger(body.expectedRevision) ? body.expectedRevision : undefined, (latest) => mergeHostedProjectState(latest, { ...body, projectId })); const cursor = Math.max(0, Number(body.cursor) || 0); sendJson(res, 200, { success: true, projectId, branchId: body.branchId, revision: next.revision, cursor: next.sequence, events: next.events.filter((item) => item.seq > cursor && item.event.branchId === body.branchId), checkpoints: Object.values(next.checkpoints).filter((item) => item.branchId === body.branchId), branches: Object.values(next.branches).filter((item) => item.id === body.branchId || item.id === next.branches[body.branchId]?.parentBranchId) }) } catch (error) { sendJson(res, error instanceof FroamStaleRevisionError ? 409 : 400, { success: false, stale: error instanceof FroamStaleRevisionError, error: error instanceof Error ? error.message : 'Invalid sync payload' }) } return true }
    sendJson(res, 405, { success: false, error: 'Method not allowed' }); return true
  }
}
