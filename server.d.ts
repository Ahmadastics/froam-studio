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

export type FroamRole = 'owner' | 'editor' | 'commenter' | 'viewer'

export type FroamRoomMember = {
  actor: string
  name: string
  role: FroamRole
  color: string
  /** Heartbeat within the presence window. */
  here: boolean
  routeKey: string | null
  viewport: 'desktop' | 'tablet' | 'mobile' | null
  selectedPath: string | null
  lockedPath: string | null
  cursor: { x: number; y: number } | null
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
  log?: (line: string) => void
  now?: () => number
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

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
