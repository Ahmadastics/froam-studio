export type FroamFramePreset = 'responsive' | 'desktop' | 'tablet' | 'mobile' | 'custom'

export type FroamFrameSpec = {
  preset: FroamFramePreset
  width: number
  height: number
  background: string
}

export type FroamWireframeSection = {
  id: string
  componentId: string | null
  name: string
  frame: FroamFrameSpec
}

export type FroamInsertPlacement = 'new-frame' | 'start' | 'end' | 'before' | 'after' | 'inside'

export const FROAM_FRAME_PRESETS: Record<Exclude<FroamFramePreset, 'custom'>, FroamFrameSpec> = {
  responsive: { preset: 'responsive', width: 1200, height: 720, background: '#ffffff' },
  desktop: { preset: 'desktop', width: 1440, height: 900, background: '#ffffff' },
  tablet: { preset: 'tablet', width: 768, height: 1024, background: '#ffffff' },
  mobile: { preset: 'mobile', width: 390, height: 844, background: '#ffffff' },
}

export function createFroamSection(
  componentId: string | null,
  name: string,
  frame: FroamFrameSpec = FROAM_FRAME_PRESETS.responsive,
): FroamWireframeSection {
  return {
    id: `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    componentId,
    name,
    frame: { ...frame },
  }
}
