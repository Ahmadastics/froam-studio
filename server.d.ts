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

export function createFroamPublishApi(options: {
  file: string
  authorize?: (req: IncomingMessage) => boolean | Promise<boolean>
  log?: (line: string) => void
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
