import type { FroamInteraction } from './types'

export type FroamCompiledInteraction = {
  css: string
  animation: string
  trigger: FroamInteraction['trigger']
  requiresRuntime: boolean
}

function cssProperty(name: string) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function safeAnimationName(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+/, '')
  return cleaned || 'froam-interaction'
}

/** CSS is one runtime adapter; click, scroll and gesture triggers remain explicit runtime work. */
export function compileInteractionToCss(interaction: FroamInteraction): FroamCompiledInteraction {
  const name = safeAnimationName(`froam-${interaction.id}`)
  const frames = [...interaction.timeline]
    .sort((a, b) => a.at - b.at)
    .map((frame) => {
      const values = Object.entries(frame.values)
        .map(([property, value]) => `    ${cssProperty(property)}: ${String(value)};`)
        .join('\n')
      return `  ${Math.max(0, Math.min(1, frame.at)) * 100}% {\n${values}\n  }`
    })
    .join('\n')
  const duration = Math.max(0, interaction.durationMs ?? 300)
  const delay = Math.max(0, interaction.delayMs ?? 0)
  const animation = `${name} ${duration}ms ease ${delay}ms 1 normal both`
  return {
    css: `@keyframes ${name} {\n${frames}\n}`,
    animation,
    trigger: interaction.trigger,
    requiresRuntime: !['load', 'hover', 'focus'].includes(interaction.trigger),
  }
}

