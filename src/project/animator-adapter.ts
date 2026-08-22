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

export function interactionToLegacyAnimator(interaction: FroamInteraction): LegacyAnimatorConfig {
  const legacy = interaction.metadata?.legacyAnimator as Partial<Pick<LegacyAnimatorConfig, 'iterations' | 'direction' | 'fillMode'>> | undefined
  const trigger: LegacyAnimatorConfig['trigger'] = interaction.trigger === 'hover' ? 'hover' : interaction.trigger === 'scroll' ? 'scroll' : interaction.trigger === 'load' ? 'load' : 'click'
  return {
    name: interaction.name.replace(/[^A-Za-z0-9_-]/g, '-') || 'froam-motion',
    duration: interaction.durationMs ?? 600,
    delay: interaction.delayMs ?? 0,
    iterations: legacy?.iterations ?? Number(interaction.metadata?.iterations ?? 1),
    direction: legacy?.direction ?? (interaction.metadata?.direction as LegacyAnimatorConfig['direction'] | undefined) ?? 'normal',
    easing: interaction.timeline.find((frame) => frame.easing)?.easing ?? 'ease',
    trigger,
    fillMode: legacy?.fillMode ?? (interaction.metadata?.fillMode as LegacyAnimatorConfig['fillMode'] | undefined) ?? 'both',
    keyframes: interaction.timeline.map((frame, index) => ({ id: `saved-${index}-${Math.round(frame.at * 100)}`, offset: Math.round(frame.at * 100), properties: Object.fromEntries(Object.entries(frame.values).map(([key, value]) => [key, String(value)])) })),
  }
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Stores replaceable keyframe blocks alongside canvas custom CSS. */
export function upsertAnimationCss(existing: string | undefined, animationName: string, css: string) {
  const safeName = animationName.replace(/[^A-Za-z0-9_-]/g, '-') || 'froam-motion'
  const start = `/* froam-motion:${safeName}:start */`
  const end = `/* froam-motion:${safeName}:end */`
  const block = `${start}\n${css.trim()}\n${end}`
  const current = existing?.trim() ?? ''
  const pattern = new RegExp(`${escapePattern(start)}[\\s\\S]*?${escapePattern(end)}`, 'g')
  const next = pattern.test(current) ? current.replace(pattern, block) : [current, block].filter(Boolean).join('\n\n')
  return next.trim()
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
