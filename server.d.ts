/**
 * froam-studio/server — the publish-path backend, reusable anywhere.
 * See lib/publish-store.mjs for the endpoint contract.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export type FroamPublishedFile = {
  version: number
  updatedAt: string | null
  routes: Record<string, Partial<Record<'desktop' | 'tablet' | 'mobile', {
    store: Record<string, unknown>
    publishedAt: string
  }>>>
}

export function loadPublished(file: string): FroamPublishedFile

export type FroamDesign = {
  version: number
  updatedAt?: string | null
  meta?: Record<string, unknown>
  routes: Record<string, Partial<Record<'desktop' | 'tablet' | 'mobile', Record<string, unknown>>>>
}

export type FroamCommitInput = { design: FroamDesign; message: string }

export type FroamCommitResult = {
  repo: string
  branch: string
  written: Array<{ path: string; commit: string | null }>
}

export function createFroamPublishApi(options: {
  file: string
  authorize?: (req: IncomingMessage) => boolean | Promise<boolean>
  log?: (line: string) => void
  /**
   * Optional second leg: also commit the design to a repo, so it ships in the
   * build instead of only living behind the API. Runs after the publish is
   * stored and never fails the request.
   */
  commit?: ((input: FroamCommitInput) => Promise<unknown>) | null
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export type FroamRole = 'owner' | 'editor' | 'contributor' | 'commenter' | 'viewer'

export type FroamRoomMember = {
  actor: string
  name: string
  role: FroamRole
  color: string
  avatarUrl: string | null
  /** What they do, in their words ("Marketing"). */
  title: string | null
  joinedAt: number | null
  /** Heartbeat within the presence window. */
  here: boolean
  routeKey: string | null
  viewport: 'desktop' | 'tablet' | 'mobile' | null
  selectedPath: string | null
  selectedNodeId: string | null
  lockedPath: string | null
  lockedNodeId: string | null
  cursor: { x: number; y: number } | null
  tool: string | null
  action: string | null
  seenAt: number | null
}

export type FroamRoomView = {
  id: string
  routes: readonly string[] | '*'
  createdAt: number
  members: FroamRoomMember[]
  /** The highest-ranked editor currently present, or null if nobody is. */
  presenter: string | null
  /** Latest ordered collaboration event. */
  sequence: number
  /** When the host keeps rooms for a limited time. */
  expiresAt: number | null
  you: { actor: string; role: FroamRole; name: string } | null
}

/** How long after a heartbeat someone still counts as present. */
export const PRESENCE_TTL_MS: number

export type FroamRoomStorage = {
  get: (roomId: string) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null
  put: (room: { id: string } & Record<string, unknown>) => Promise<void> | void
}

/**
 * A room is who may touch a design and what they may do with it.
 *
 * The room contract covers identity, presence, ordered events and ops,
 * comments, revisions, chat, revert proposals, and an SSE wake-up stream.
 * An invite token grants a role; joining mints a separate member session.
 *
 * `authorize` gates opening a room; tokens gate everything after that.
 */
export function createFroamRoomApi(options: {
  /** JSON persistence for `froam dev`; use `storage` on a hosted backend. */
  file?: string
  storage?: FroamRoomStorage
  authorize?: (req: IncomingMessage) => boolean | Promise<boolean>
  /**
   * Makes an approved change request live — called when the owner approves
   * what a contributor submitted. Store the publish, commit it (see
   * createGitHubCommitter), trigger a deploy. Resolve `{ detail }` for the
   * record; throw to leave the request pending with the error shown.
   */
  onApproveRequest?: (input: { room: { id: string }; request: FroamChangeRequest }) => Promise<FroamPublishResult | void> | FroamPublishResult | void
  /**
   * Takes an approved request back, given the `undo` its approval returned.
   * Without it, Revert isn't offered.
   */
  onRevertRequest?: (input: { room: { id: string }; request: FroamChangeRequest; undo: FroamRequestUndo | null }) => Promise<{ detail?: string; link?: string; skipped?: unknown[] } | void>
  /** Told about requests and @mentions, for people away from the editor (see createFroamNotifier). */
  notify?: ((event: FroamRoomNotification) => unknown) | null
  /** Rooms end this long after they open; the room says when (`expiresAt`). */
  roomTtlMs?: number | null
  log?: (line: string) => void
  now?: () => number
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export type FroamViewport = 'desktop' | 'tablet' | 'mobile'

/** One page at one screen size, as a request changes it. */
export type FroamRequestScope = {
  routeKey: string
  viewport: FroamViewport
  store: Record<string, Record<string, unknown>>
  removed: string[]
}

export type FroamChangeRequest = {
  id: string
  /** The first scope, for readers that predate multi-page requests. */
  routeKey: string
  viewport: FroamViewport
  store: Record<string, Record<string, unknown>>
  removed: string[]
  /** Every page and screen size the request changes. */
  scopes?: FroamRequestScope[]
  title: string
  note: string | null
  changes: Array<{ label: string; before: string | null; after: string | null; routeKey?: string; viewport?: FroamViewport }>
  textEdits: Array<{ from: string; to: string }>
  /** Base (desktop) style edits a Tailwind project can take into class lists. */
  styleEdits?: Array<{ routeKey: string; viewport: FroamViewport; path: string; tag: string; className: string; styles: Record<string, string> }>
  actor: string
  createdBy: string
  createdAt: number
  status: 'pending' | 'approved' | 'changes-requested' | 'withdrawn' | 'reverted'
  decidedBy: string | null
  published: { ok: boolean; detail: string; link: string | null; number: number | null; branch: string | null } | null
}

/** What approving returns so a revert can take it back. */
export type FroamRequestUndo = {
  scopes: Array<FroamRequestScope & { expect: Record<string, unknown> }>
  textEdits: Array<{ from: string; to: string }>
  classLists?: Array<{ tag: string | null; from: string; to: string }>
}

export type FroamPublishResult = {
  detail?: string
  /** Where to see it: a pull request, a commit, a deploy. */
  link?: string
  number?: number
  branch?: string
  undo?: FroamRequestUndo
}

export type FroamRoomNotification = {
  type: 'request.submitted' | 'request.decided' | 'request.reverted' | 'chat.mention'
  room: { id: string }
  actor: { actor: string; name: string; role: FroamRole; title: string | null } | null
  request?: FroamChangeRequest
  message?: { id: string; body: string; actor: string; name: string; createdAt: number }
  mentioned?: Array<{ actor: string; name: string; role: FroamRole }>
}

/**
 * Apply an approved change request to a design: only the paths it changed
 * (never the contributor's whole snapshot); text listed in `writtenText` was
 * placed in the source and is dropped from the drafts.
 */
export function applyChangeRequest<T extends { routes?: Record<string, unknown> }>(
  design: T,
  request: { routeKey: string; viewport: string; store: Record<string, Record<string, unknown>>; removed?: string[] },
  options?: { writtenText?: string[] },
): T

/** Apply an approved request and get back how to undo it. */
export function approveChangeRequest<T extends { routes?: Record<string, unknown> }>(
  design: T,
  request: Partial<FroamChangeRequest> & { store?: Record<string, Record<string, unknown>> },
  options?: { writtenText?: string[] },
): { design: T; undo: FroamRequestUndo }

/** Take an approved request back; paths changed again since are left alone and listed. */
export function revertChangeRequest<T extends { routes?: Record<string, unknown> }>(
  design: T,
  undo: FroamRequestUndo,
): { design: T; skipped: Array<{ routeKey: string; viewport: FroamViewport; path: string }> }

/**
 * Approve on GitHub: one commit with the design, copy written into the source
 * and (for Tailwind) styles written into class lists — as a pull request, or
 * straight onto the branch with `mode: 'commit'`. Spread the result into
 * createFroamRoomApi: `{ ...createGitHubPublisher(options) }`.
 */
export function createGitHubPublisher(options: {
  token: string
  repo: string
  base?: string
  /** Where froam.design.json lives in the repo. */
  dir?: string
  /** Only search this folder for copy and class lists. */
  sourceDir?: string
  mode?: 'pull-request' | 'commit'
  /** Try to merge the pull request right away (it stays open if checks or protection say no). */
  autoMerge?: boolean
  /** Links in the pull request open the request in Froam. */
  siteUrl?: string
  /** Write base style edits into Tailwind class lists. */
  tailwind?: boolean
  maxSourceFiles?: number
  committer?: { name: string; email: string }
  fetchImpl?: typeof fetch
}): {
  onApproveRequest: NonNullable<Parameters<typeof createFroamRoomApi>[0]['onApproveRequest']>
  onRevertRequest: NonNullable<Parameters<typeof createFroamRoomApi>[0]['onRevertRequest']>
}

/**
 * Tell people about requests and @mentions where they already are: Slack,
 * Discord, any webhook, or email (through Resend). Links open the request in
 * the editor and never carry a token.
 */
export function createFroamNotifier(options: {
  siteUrl?: string
  webhooks?: Array<string | { url: string; format?: 'slack' | 'discord' | 'json' }>
  email?: { resendApiKey: string; from: string; to: string[] }
  events?: Array<FroamRoomNotification['type']>
  fetchImpl?: typeof fetch
}): (event: FroamRoomNotification) => Promise<Array<{ ok: boolean; to?: string; error?: string }>>

/**
 * Beta branch/checkpoint project-document delta contract. The existing Room
 * operation log remains canonical; design events must carry their room seq.
 */
export function createFroamProjectSyncApi(options: {
  file?: string
  storage?: FroamProjectDocumentStore | { get: (projectId: string) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null; put: (project: Record<string, unknown>) => Promise<void> | void }
  authorize?: (req: IncomingMessage, input: { projectId: string; actor?: string | null }) => boolean | Promise<boolean>
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export type FroamProjectDocumentStore = {
  kind: string
  atomic: boolean
  read(projectId: string): Promise<Record<string, unknown> | null>
  compareAndSwap(projectId: string, expectedRevision: number, next: Record<string, unknown>): Promise<Record<string, unknown>>
  transaction(projectId: string, expectedRevision: number | undefined, update: (current: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>): Promise<Record<string, unknown>>
  getBlob(blobId: string): Promise<unknown | null>
  putBlob(blobId: string, value: unknown): Promise<string>
}
export class FroamStaleRevisionError extends Error { expected: unknown; actual: unknown }
export function createMemoryProjectDocumentStore(): FroamProjectDocumentStore
export function createFileProjectDocumentStore(file: string): FroamProjectDocumentStore

/**
 * Commit a design to GitHub through the Contents API, so a save made on a
 * device with no `froam dev` bridge — a phone — still reaches the repo and
 * triggers whatever deploys from it.
 */
export function createGitHubCommitter(options: {
  /** Token with contents:write on the repo. */
  token: string
  /** "owner/name". */
  repo: string
  /** Defaults to "main". */
  branch?: string
  /** Directory the froam files live in. Defaults to "froam". */
  dir?: string
  committer?: { name: string; email: string }
  fetchImpl?: typeof fetch
}): (input: { design: FroamDesign; message?: string; paths?: Record<string, string> }) => Promise<FroamCommitResult>

// ─── Intelligence API ─────────────────────────────────────────────────────────

export type FroamMutationDomain = 'visual' | 'typography' | 'spacing' | 'layout' | 'navigation' | 'interactions' | 'motion' | 'responsive' | 'composition'

export type FroamMutationProposal = {
  type: string
  domain: FroamMutationDomain
  targetIds: string[]
  confidence: number
  rationale: string
  payload: Record<string, unknown>
  dependencies?: string[]
}

export type FroamIntelligencePurpose = 'mutate' | 'understand' | 'reference' | 'responsive' | 'evaluate'
export type FroamEvidenceOrigin = 'observed' | 'inferred' | 'generated'

export type FroamIntelligenceRequest = {
  schemaVersion: 1
  purpose: FroamIntelligencePurpose
  intent: string
  context: {
    projectId: string
    activeBranchId: string
    routeKey: string
    viewport: string
    selectedNodeId?: string | null
    selectedDomPath?: string | null
    scanRecords?: unknown[]
    dna?: Record<string, unknown>
    relationships?: unknown[]
    responsivePolicies?: unknown[]
    responsiveObservations?: unknown[]
    references?: unknown[]
    memory?: unknown
  }
  constraints?: { protect: string[]; allow: FroamMutationDomain[]; protectedNodeIds?: string[] }
  scopeNodeIds?: string[]
  protectedNodeIds?: string[]
  priorAttemptFeedback?: string | null
  previousAttemptFeedback?: string | null
  requestId?: string
  consent?: boolean
}
export type FroamIntelligencePlanRequest = FroamIntelligenceRequest

export type FroamIntelligencePlanResponse = {
  schemaVersion: 1
  purpose: 'mutate'
  requestId?: string
  provider: string
  proposals: FroamMutationProposal[]
  rationale: string
  confidence: number
  warnings?: string[]
}

export type FroamIntelligenceAnalysisResponse = {
  schemaVersion: 1
  purpose: Exclude<FroamIntelligencePurpose, 'mutate'>
  requestId?: string
  provider: string
  findings: Array<{ id?: string; summary: string; detail?: string; origin: FroamEvidenceOrigin; confidence?: number; evidence?: unknown[]; nodeIds?: string[] }>
  recommendations?: string[]
  limitations?: string[]
  referenceIds?: string[]
  breakpointHypotheses?: Array<{ summary: string; origin: 'inferred'; confidence?: number }>
  score?: number
}

export type FroamIntelligenceResponse = FroamIntelligencePlanResponse | FroamIntelligenceAnalysisResponse

export type FroamIntelligenceProvider = {
  id: string
  privacy: {
    execution: 'local' | 'remote'
    requiresConsent?: boolean
    sendsSourceCode: false
    sendsCredentials: false
    dataDescription: string
  }
  plan(request: FroamIntelligenceRequest, options?: { signal?: AbortSignal }): Promise<string | Record<string, unknown>>
}

/**
 * Mount a Froam intelligence planning endpoint.
 *
 * POST /plan — receives a FroamIntelligencePlanRequest, calls the provider,
 * validates the output deterministically, returns a FroamIntelligencePlanResponse.
 *
 * API key is server-side only and never appears in responses.
 */
export function createFroamIntelligenceApi(options: {
  provider?: FroamIntelligenceProvider | null
  authorize?: (req: IncomingMessage) => boolean | Promise<boolean>
  log?: (line: string) => void
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

/**
 * OpenAI-compatible provider. Works with any provider that speaks the
 * OpenAI chat completions API (OpenAI, Azure OpenAI, Ollama, etc.).
 * Uses fetch only — no SDK dependency.
 * API key is server-side only.
 */
export function createOpenAICompatibleProvider(options: {
  /** Base URL of the compatible chat-completions API. */
  baseUrl: string
  /** Server-side API key. Never serialized to browser responses. */
  apiKey: string
  /** Provider-specific model name. */
  model: string
  fetchImpl?: typeof fetch
  systemPrompt?: string
  timeout?: number
}): FroamIntelligenceProvider
