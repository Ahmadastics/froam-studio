import type { FroamInteraction, FroamTimelineKeyframe } from './types'

export type LegacyAnimatorConfig = {
  name: string
  duration: number
  delay: number
  iterations: number
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  easing: string
  trigger: 'load' | 'hover' | 'click' | 'scroll'
  fillMode: 'none' | 'forwards' | 'backwards' | 'both'
  keyframes: Array<{ id: string; offset: number; properties: Record<string, string> }>
}

export function legacyAnimatorToInteraction(config: LegacyAnimatorConfig, input: { id: string; sourceId: string; targetIds?: string[] }): FroamInteraction {
  const timeline: FroamTimelineKeyframe[] = [...config.keyframes]
    .sort((a, b) => a.offset - b.offset)
    .map((keyframe) => ({ at: keyframe.offset / 100, values: { ...keyframe.properties }, easing: config.easing }))
  return {
    id: input.id,
    name: config.name,
    sourceId: input.sourceId,
    targetIds: input.targetIds?.length ? input.targetIds : [input.sourceId],
    trigger: config.trigger,
    timeline,
    durationMs: config.duration,
    delayMs: config.delay,
    metadata: {
      legacyAnimator: { iterations: config.iterations, direction: config.direction, fillMode: config.fillMode },
      compilerTarget: 'css-keyframes',
    },
  }
}

export function interactionInspectorRecord(interaction: FroamInteraction) {
  return {
    trigger: interaction.trigger,
    source: interaction.sourceId,
    targets: interaction.targetIds,
    state: { from: interaction.fromState ?? null, to: interaction.toState ?? null },
    timeline: interaction.timeline,
    physics: interaction.physics ?? null,
    sound: interaction.feedback?.soundAssetId ?? null,
    compilerTarget: String(interaction.metadata?.compilerTarget ?? 'css-keyframes'),
  }
}
