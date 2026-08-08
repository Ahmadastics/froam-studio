import type { FroamInteractionRecipe } from './interaction-library'

export type FroamObservedStyle = Record<string, string | number>
export type FroamSampleFrame = { atMs: number; targetRole: string; nodeId?: string; styles: FroamObservedStyle; geometry?: { x: number; y: number; width: number; height: number }; visible?: boolean }
export type FroamSamplingSession = { id: string; trigger: string; sourceRole: string; startedAt: number; frames: FroamSampleFrame[]; provenance: 'froam-controlled-dom' }
export function createSamplingSession(input: Omit<FroamSamplingSession, 'frames' | 'provenance'>): FroamSamplingSession { return { ...input, frames: [], provenance: 'froam-controlled-dom' } }
export function recordSamplingFrame(session: FroamSamplingSession, frame: FroamSampleFrame): FroamSamplingSession { return { ...session, frames: [...session.frames, structuredClone(frame)].sort((a, b) => a.atMs - b.atMs) } }
export function samplingSessionToRecipe(session: FroamSamplingSession, input: { recipeId: string; name: string; projectId: string; branchId: string }): FroamInteractionRecipe {
  if (!session.frames.length) throw new Error('A sampled interaction needs observable frames')
  const roles = [...new Set(session.frames.map((frame) => frame.targetRole))]; const duration = Math.max(1, ...session.frames.map((frame) => frame.atMs))
  const targetRole = roles[0]; const timeline = session.frames.filter((frame) => frame.targetRole === targetRole).map((frame) => ({ at: frame.atMs / duration, values: { ...frame.styles, ...(frame.visible === undefined ? {} : { visibility: frame.visible ? 'visible' : 'hidden' }) } }))
  return { id: input.recipeId, name: input.name, interaction: { id: input.recipeId, name: input.name, sourceId: `role:${session.sourceRole}`, targetIds: roles.map((role) => `role:${role}`), trigger: session.trigger === 'hover' ? 'hover' : session.trigger === 'focus' ? 'focus' : 'click', timeline, durationMs: duration, metadata: { reconstructedFromObservation: true, observedFrameCount: session.frames.length } }, bindings: { source: { role: session.sourceRole, required: true }, targets: roles.map((role) => ({ role, required: true })) }, provenance: { kind: 'sampled', projectId: input.projectId, branchId: input.branchId, createdAt: session.startedAt, provider: 'froam-native-sampler-v1' } }
}
