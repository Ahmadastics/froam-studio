import { type ReactNode } from 'react'
import { type FroamIntelligenceTab } from '../FroamIntelligence'
import { type FroamLab } from '../FroamLabs'
import { type FroamWorkspaceSection } from '../workspace-shell-model'
import { type FroamAnchorFingerprint, type FroamViewport } from '../../collab/types'

export const intelligenceTabs: Partial<Record<FroamWorkspaceSection, FroamIntelligenceTab>> = { scan: 'scan', dna: 'dna', archive: 'archive', archaeology: 'archaeology', flow: 'flow', attention: 'attention', rhythm: 'rhythm', responsive: 'responsive' }

export const labTabs: Partial<Record<FroamWorkspaceSection, FroamLab>> = { laboratory: 'overview', mutate: 'mutate', sample: 'sample', interactions: 'interactions', 'interactions-create': 'interactions', physics: 'physics', gravity: 'physics', break: 'break', 'test-user': 'user', sound: 'sound', trailer: 'trailer', reality: 'reality' }

export type ElementDraft = {
  text?: string
  imageUrl?: string
  styles?: Record<string, string>
  /** See `ElementDraft` in src/collab/types.ts — how this edit re-finds its element. */
  fingerprint?: FroamAnchorFingerprint
}

export type EditorStore = Record<string, Record<string, ElementDraft>>

export type FroamPublishedResponse = {
  success: boolean
  design?: {
    routeKey: string
    viewportMode: ViewportMode
    store: Record<string, ElementDraft>
    publishedAt?: string | null
    updatedAt?: string
  } | null
}

export type SelectionState = {
  path: string
  /** Stable identity is additive; all editing and output remain path-based. */
  nodeId?: string
  label: string
  text: string
  background: string
  color: string
  borderColor: string
  borderWidth: number
  borderStyle: string
  borderRadiusTL: number
  borderRadiusTR: number
  borderRadiusBR: number
  borderRadiusBL: number
  opacity: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  width: string
  height: string
  minWidth: string
  maxWidth: string
  minHeight: string
  maxHeight: string
  aspectRatio: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textAlign: string
  lineHeight: number
  letterSpacing: number
  wordSpacing: number
  textTransform: string
  textDecoration: string
  display: string
  flexDirection: string
  justifyContent: string
  alignItems: string
  flexWrap: string
  gap: number
  gridTemplateColumns: string
  gridTemplateRows: string
  position: string
  zIndex: number
  overflow: string
  cursor: string
  rotate: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  translateX: number
  translateY: number
  boxShadow: string
  textShadow: string
  mixBlendMode: string
  filter: string
  backdropFilter: string
  imageUrl: string
}

export type CanvasState = {
  background: string
  text: string
  imageUrl?: string
}

export type GradientStop = {
  color: string
  position: number
}

export type LayerNode = {
  element: HTMLElement
  path: string
  tag: string
  label: string
  kind: 'element' | 'shape' | 'stamp'
  className: string
  depth: number
  hidden: boolean
  editorHidden: boolean
  exportHidden: boolean
  hasChildren: boolean
  childCount: number
  nodeId?: string
}

export type FroamBlockKind =
  | 'section'
  | 'header'
  | 'footer'
  | 'container'
  | 'card'
  | 'grid'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'shape'
  | 'hero'
  | 'stats'

export type CSSVarEntry = {
  name: string
  value: string
}

export type DesignToken = {
  id: string
  name: string
  value: string
  category: 'color' | 'spacing' | 'font-size' | 'radius' | 'shadow' | 'other'
}

export type AssetEntry = {
  id: string
  name: string
  url: string
  addedAt: number
}

export const CHEF_BUTTON_START = { x: 20, y: 480 }

export const CANVAS_KEY = '__froam_canvas__'

export const INJECTION_KEY = '__froam_injection__'

export const ROOT_PARENT_KEY = '__froam_root__'

export const INJECTED_BLOCK_SELECTOR = '[data-froam-injected="true"][data-froam-block="true"], [data-froam-runtime-injected="true"]'

export const VIEWPORT_MODES = [
  { id: 'desktop', label: 'Desktop', width: null, height: null },
  { id: 'tablet',  label: 'Tablet',  width: 768,  height: 1024 },
  { id: 'mobile',  label: 'Mobile',  width: 390,  height: 844  },
] as const

export type ViewportMode = typeof VIEWPORT_MODES[number]['id']

// The editor's viewport ids and the collab schema's must stay the same set —
// the op log keys every op by viewport, so a drift here would silently split
// one design into two. This line stops compiling if they diverge.
export type ViewportsAgree = ViewportMode extends FroamViewport
  ? (FroamViewport extends ViewportMode ? true : never)
  : never

export const VIEWPORTS_AGREE: ViewportsAgree = true

void VIEWPORTS_AGREE

export type FroamToolMode = 'pointer' | 'hand' | 'text' | 'frame' | 'shape' | 'move'

// ID of the portal element Froam injects to host the device shell
export const DEVICE_SHELL_ID = 'froam-device-shell'

export type PaletteCommand = {
  id: string
  label: string
  searchText?: string
  shortcut?: string
  hint?: string
  icon: ReactNode
  action: () => void
}
