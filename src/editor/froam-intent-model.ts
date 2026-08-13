import { looksLikeNaturalLanguageIntent } from '../project/intelligence-context'
import type { FroamReferenceBuildValidation } from '../project/reference-build'
import type { FroamMutationDomain, FroamMutationProposal, FroamMutationSelectionSnapshot } from '../project/mutation'
import type { FroamDNA } from '../project/types'

export const FROAM_INTENT_MAX_ATTEMPTS = 3
export type FroamIntentOrigin = 'command-palette' | 'reference' | 'responsive' | 'contextual'
export type FroamIntentPhase = 'idle' | 'preparing' | 'awaiting-consent' | 'requesting' | 'plan-ready' | 'creating-prototype' | 'previewing' | 'adopting' | 'retrying' | 'error' | 'completed'
export type FroamIntentSession = {
  id: string
  origin: FroamIntentOrigin
  intent: string
  selectedNodeId: string
  selectedPath: string
  targetLabel?: string
  automaticTarget?: boolean
  sourceBranchId: string
  attempt: number
  maxAttempts: number
  prototypeBranchId?: string
  prototypeName?: string
  changeCount?: number
  rationale?: string
  changeSummaries?: string[]
  referenceValidation?: FroamReferenceBuildValidation
}
export type FroamIntentState = { phase: FroamIntentPhase; session: FroamIntentSession | null; message: string | null }
export const initialFroamIntentState: FroamIntentState = { phase: 'idle', session: null, message: null }

export type FroamIntentEvent =
  | { type: 'submit'; session: FroamIntentSession }
  | { type: 'require-consent' }
  | { type: 'request' }
  | { type: 'plan-ready' }
  | { type: 'create-prototype' }
  | { type: 'preview'; prototypeBranchId: string; prototypeName: string; changeCount: number; rationale?: string; changeSummaries: string[]; referenceValidation?: FroamReferenceBuildValidation }
  | { type: 'adopt' }
  | { type: 'retry' }
  | { type: 'complete'; message: string }
  | { type: 'fail'; message: string }
  | { type: 'cancel' }

const allows = (phase: FroamIntentPhase, accepted: FroamIntentPhase[]) => accepted.includes(phase)
export function froamIntentReducer(state: FroamIntentState, event: FroamIntentEvent): FroamIntentState {
  if (event.type === 'cancel') return initialFroamIntentState
  if (event.type === 'submit') return state.phase === 'idle' || state.phase === 'completed' || state.phase === 'error' ? { phase: 'preparing', session: event.session, message: null } : state
  if (event.type === 'require-consent') return allows(state.phase, ['preparing', 'retrying']) ? { ...state, phase: 'awaiting-consent', message: null } : state
  if (event.type === 'request') return allows(state.phase, ['preparing', 'awaiting-consent', 'retrying']) ? { ...state, phase: 'requesting', message: null } : state
  if (event.type === 'plan-ready') return state.phase === 'requesting' ? { ...state, phase: 'plan-ready', message: null } : state
  if (event.type === 'create-prototype') return state.phase === 'plan-ready' ? { ...state, phase: 'creating-prototype', message: null } : state
  if (event.type === 'preview') return state.phase === 'creating-prototype' && state.session ? { phase: 'previewing', message: null, session: { ...state.session, prototypeBranchId: event.prototypeBranchId, prototypeName: event.prototypeName, changeCount: event.changeCount, rationale: event.rationale, changeSummaries: event.changeSummaries, referenceValidation: event.referenceValidation } } : state
  if (event.type === 'adopt') return state.phase === 'previewing' ? { ...state, phase: 'adopting', message: null } : state
  if (event.type === 'retry') return (state.phase === 'previewing' || state.phase === 'error') && state.session && state.session.attempt < state.session.maxAttempts ? { phase: 'retrying', message: null, session: { ...state.session, attempt: state.session.attempt + 1, prototypeBranchId: undefined, prototypeName: undefined, changeCount: undefined, rationale: undefined, changeSummaries: undefined, referenceValidation: undefined } } : state
  if (event.type === 'complete') return state.session ? { ...state, phase: 'completed', message: event.message } : state
  if (event.type === 'fail') return state.phase === 'idle' ? { phase: 'error', session: null, message: event.message } : { ...state, phase: 'error', message: event.message }
  return state
}

export function shouldOfferAskFroam(query: string, knownCommandCount: number) {
  return knownCommandCount === 0 && looksLikeNaturalLanguageIntent(query)
}

export function froamIntentPreferences(intent: string) {
  const normalized = intent.toLocaleLowerCase()
  return {
    preserveDimensions: /without changing (?:its |the )?(?:size|dimensions)|keep (?:its |the )?(?:size|dimensions)|preserve (?:its |the )?(?:size|dimensions)/.test(normalized),
    preserveCopy: /without changing (?:the )?copy|keep (?:the )?copy|preserve (?:the )?copy/.test(normalized),
  }
}

export function froamIntentPrototypeName(intent: string) {
  const words = intent.trim().replace(/[^A-Za-z0-9\s-]/g, '').split(/\s+/).filter((word) => word.length > 2 && !/^(make|this|that|feel|more|less|without|changing|keep|its|the)$/i.test(word)).slice(0, 4)
  const label = words.length ? words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') : 'New Direction'
  return `Froam / ${label.slice(0, 48)}`
}

export function froamIntentRetryFeedback(state: FroamIntentState) {
  const summaries = state.session?.changeSummaries?.slice(0, 6).join('; ') || 'the prior bounded proposal'
  return `Previous proposal was not adopted (${summaries}). Produce a meaningfully different approach while preserving the original instruction, scope, and constraints.`.slice(0, 1000)
}

const LOCAL_COLORS: Record<string, string> = {
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
  green: '#22c55e', mint: '#2dd4bf', teal: '#14b8a6', blue: '#3b82f6',
  purple: '#8b5cf6', violet: '#7c3aed', pink: '#ec4899', white: '#ffffff',
  black: '#050505', gray: '#64748b', grey: '#64748b',
}

function pixels(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function firstNumber(intent: string, labels: string) {
  const match = intent.match(new RegExp(`(?:${labels})(?:\\s+(?:to|of|by))?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(px|rem|em|%|deg)?`, 'i'))
  if (!match) return null
  return { value: Number(match[1]), unit: match[2]?.toLowerCase() || 'px' }
}

function replacementText(intent: string) {
  const patterns = [
    /(?:change|replace|update|set)\s+(?:the\s+)?(?:text|copy|label|heading|title|button text)\s+(?:to|with)\s+(.+)$/i,
    /rename\s+(?:this|it|the\s+(?:button|heading|title|label))?\s*to\s+(.+)$/i,
    /(?:make\s+(?:it|this)\s+say|say|read)\s+(.+)$/i,
  ]
  const raw = patterns.map((pattern) => intent.match(pattern)?.[1]).find(Boolean)?.trim()
  if (!raw) return null
  return raw.replace(/^["'“‘]|["'”’]$/g, '').trim().slice(0, 1_000) || null
}

/**
 * Fast, browser-local commands for the edits people ask for most often.
 * They use the same native proposal validation and protected branch workflow
 * as remote intelligence, but never require a provider or network request.
 */
export function createLocalFroamIntentProposals(snapshot: FroamMutationSelectionSnapshot, intent: string): FroamMutationProposal[] {
  const normalized = intent.toLocaleLowerCase().trim()
  const dna = snapshot.dna ?? ({ schemaVersion: 1, nodeId: snapshot.node.id, capturedAt: Date.now() } as FroamDNA)
  const visual = { ...(dna.visual as Record<string, unknown> | undefined) }
  const layout = { ...(dna.layout as Record<string, unknown> | undefined) }
  const motion = { ...(dna.motion as Record<string, unknown> | undefined) }
  const changes = new Map<FroamMutationDomain, Record<string, unknown>>()
  const add = (domain: FroamMutationDomain, property: string, value: string) => changes.set(domain, { ...(changes.get(domain) ?? {}), [property]: value })

  const colorName = Object.keys(LOCAL_COLORS).find((name) => new RegExp(`\\b${name}\\b`).test(normalized))
  const hex = normalized.match(/#[0-9a-f]{3,8}\b/i)?.[0]
  const requestedColor = hex ?? (colorName ? LOCAL_COLORS[colorName] : null)
  if (requestedColor) add('visual', /border/.test(normalized) ? 'borderColor' : /background|surface|card|section|fill/.test(normalized) ? 'backgroundColor' : 'color', requestedColor)
  if (/dark(?:er)? (?:background|surface|fill)|(?:background|surface|fill).{0,12}dark/.test(normalized)) add('visual', 'backgroundColor', '#0b0f14')
  if (/white text|light text/.test(normalized)) add('visual', 'color', '#ffffff')
  if (/black text|dark text/.test(normalized)) add('visual', 'color', '#111827')
  if (/bold|stronger text|heavier text/.test(normalized)) add('typography', 'fontWeight', '700')
  if (/lighter text|less bold/.test(normalized)) add('typography', 'fontWeight', '400')
  if (/uppercase|all caps/.test(normalized)) add('typography', 'textTransform', 'uppercase')
  if (/lowercase/.test(normalized)) add('typography', 'textTransform', 'lowercase')
  if (/italic/.test(normalized)) add('typography', 'fontStyle', 'italic')
  if (/underline/.test(normalized)) add('typography', 'textDecorationLine', 'underline')
  const fontSize = firstNumber(normalized, 'font(?:\\s+size)?|text\\s+size')
  if (fontSize) add('typography', 'fontSize', `${fontSize.value}${fontSize.unit}`)
  else if (/bigger|larger|increase (?:the )?(?:text|font)|make (?:the )?(?:text|font) bigger/.test(normalized)) add('typography', 'fontSize', `${Math.round(pixels(visual.fontSize, 16) * 1.15)}px`)
  if (/smaller|reduce (?:the )?(?:text|font)|make (?:the )?(?:text|font) smaller/.test(normalized)) add('typography', 'fontSize', `${Math.max(10, Math.round(pixels(visual.fontSize, 16) * .88))}px`)
  const lineHeight = firstNumber(normalized, 'line[-\\s]?height')
  if (lineHeight) add('typography', 'lineHeight', `${lineHeight.value}${lineHeight.unit}`)
  const letterSpacing = firstNumber(normalized, 'letter[-\\s]?spacing|tracking')
  if (letterSpacing) add('typography', 'letterSpacing', `${letterSpacing.value}${letterSpacing.unit}`)
  if (/align (?:the )?text (?:to the )?center|center (?:the )?text/.test(normalized)) add('typography', 'textAlign', 'center')
  if (/align (?:the )?text (?:to the )?left|left[- ]align/.test(normalized)) add('typography', 'textAlign', 'left')
  if (/align (?:the )?text (?:to the )?right|right[- ]align/.test(normalized)) add('typography', 'textAlign', 'right')
  if (/rounder|rounded|soft corners/.test(normalized)) add('visual', 'borderRadius', /pill|fully/.test(normalized) ? '999px' : '16px')
  const radius = firstNumber(normalized, 'border[-\\s]?radius|corner(?:\\s+radius)?|radius')
  if (radius) add('visual', 'borderRadius', `${radius.value}${radius.unit}`)
  if (/square corners|sharp corners|remove (?:the )?radius/.test(normalized)) add('visual', 'borderRadius', '0px')
  if (/shadow|depth|premium|polished|prominent|stand out|pop/.test(normalized)) add('visual', 'boxShadow', '0 16px 42px rgba(0, 0, 0, 0.28)')
  if (/remove (?:the )?shadow|flat/.test(normalized)) add('visual', 'boxShadow', 'none')
  if (/remove (?:the )?border|borderless/.test(normalized)) add('visual', 'border', 'none')
  const border = normalized.match(/(?:add|set|make)?\s*(?:a\s+)?(\d+(?:\.\d+)?px)\s+(solid|dashed|dotted)\s+border/)
  if (border) add('visual', 'border', `${border[1]} ${border[2]} ${requestedColor ?? '#64748b'}`)
  if (/transparent|fade|faded|less visible/.test(normalized)) add('visual', 'opacity', '0.72')
  if (/opaque|fully visible/.test(normalized)) add('visual', 'opacity', '1')
  const opacity = normalized.match(/opacity(?:\s+(?:to|of))?\s*(\d+(?:\.\d+)?)\s*(%)?/)
  if (opacity) add('visual', 'opacity', String(Math.max(0, Math.min(1, opacity[2] ? Number(opacity[1]) / 100 : Number(opacity[1])))))
  const padding = firstNumber(normalized, 'padding')
  const margin = firstNumber(normalized, 'margin')
  const gap = firstNumber(normalized, 'gap|spacing')
  if (padding) add('spacing', 'padding', `${padding.value}${padding.unit}`)
  else if (/more (?:space|spacing|padding)|breathing room|roomier/.test(normalized)) add('spacing', 'padding', `${Math.round(pixels(layout.padding, 12) + 6)}px`)
  if (/less (?:space|spacing|padding)|tighter|compact/.test(normalized)) add('spacing', 'padding', `${Math.max(0, Math.round(pixels(layout.padding, 12) - 4))}px`)
  if (margin) add('spacing', 'margin', `${margin.value}${margin.unit}`)
  if (gap) add('spacing', 'gap', `${gap.value}${gap.unit}`)

  if (/display (?:as )?grid|make (?:it|this) (?:a )?grid|grid layout/.test(normalized)) add('layout', 'display', 'grid')
  if (/display (?:as )?flex|use flex|flex layout/.test(normalized)) add('layout', 'display', 'flex')
  if (/stack|vertical|column/.test(normalized)) { add('layout', 'display', 'flex'); add('layout', 'flexDirection', 'column') }
  if (/horizontal|row layout|side by side/.test(normalized)) { add('layout', 'display', 'flex'); add('layout', 'flexDirection', 'row') }
  if (/center (?:the )?(?:content|items|children)|align (?:everything|items) (?:to the )?center/.test(normalized)) { add('layout', 'display', 'flex'); add('layout', 'justifyContent', 'center'); add('layout', 'alignItems', 'center') }
  if (/space between|spread (?:the )?(?:items|content)/.test(normalized)) add('layout', 'justifyContent', 'space-between')
  if (/allow (?:it|items|content) to wrap|wrap (?:the )?(?:items|content)|make (?:it|this) wrap/.test(normalized)) add('layout', 'flexWrap', 'wrap')
  if (/hide overflow|clip overflow/.test(normalized)) add('layout', 'overflow', 'hidden')
  if (/show overflow/.test(normalized)) add('layout', 'overflow', 'visible')
  if (/\bhide (?:it|this|the element)?\b/.test(normalized)) add('layout', 'display', 'none')

  const width = firstNumber(normalized, 'width|make\\s+(?:it|this)\\s+wide')
  const height = firstNumber(normalized, 'height|make\\s+(?:it|this)\\s+tall')
  if (width) add('layout', 'width', `${width.value}${width.unit}`)
  else if (/full width|fill (?:the )?(?:parent|container|width)/.test(normalized)) add('layout', 'width', '100%')
  if (height) add('layout', 'height', `${height.value}${height.unit}`)
  if (/responsive|fit (?:on )?(?:mobile|all screens)/.test(normalized)) { add('layout', 'width', '100%'); add('layout', 'maxWidth', '100%'); add('layout', 'flexWrap', 'wrap') }

  const distance = normalized.match(/(?:move|shift)\s+(?:it|this)?\s*(up|down|left|right)(?:\s+by)?\s*(\d+(?:\.\d+)?)?\s*(px|rem|em|%)?/)
  if (distance) {
    const amount = `${distance[2] ?? '8'}${distance[3] ?? 'px'}`
    const negative = distance[1] === 'up' || distance[1] === 'left' ? '-' : ''
    add('motion', 'transform', distance[1] === 'up' || distance[1] === 'down' ? `translateY(${negative}${amount})` : `translateX(${negative}${amount})`)
  } else if (/lift|raise|slightly up/.test(normalized)) add('motion', 'transform', 'translateY(-4px)')
  const rotate = firstNumber(normalized, 'rotate')
  if (rotate) add('motion', 'transform', `rotate(${rotate.value}deg)`)
  if (/smooth|animate|add (?:a )?transition/.test(normalized)) add('motion', 'transition', 'all 220ms ease')

  if (/minimal|cleaner|simpler/.test(normalized)) { add('visual', 'boxShadow', 'none'); add('visual', 'borderRadius', '12px') }
  if (/premium|polish(?:ed)?|modern|make (?:it|this) better|improve (?:it|this)/.test(normalized)) { add('visual', 'borderRadius', '16px'); add('visual', 'boxShadow', '0 16px 42px rgba(0, 0, 0, 0.24)'); add('motion', 'transition', 'all 220ms ease') }
  if (/accessible|easier to read|more readable/.test(normalized)) { add('typography', 'lineHeight', '1.6'); add('visual', 'opacity', '1') }

  const nextText = replacementText(intent)
  if (nextText) add('typography', 'textContent', nextText)

  return [...changes].map(([domain, record]) => ({
    type: 'dna.captured',
    domain,
    targetIds: [snapshot.node.id],
    confidence: .98,
    rationale: `Applied locally: ${intent.slice(0, 120)}`,
    payload: { dna: { ...dna, nodeId: snapshot.node.id, capturedAt: Date.now(), visual: domain === 'visual' || domain === 'typography' ? { ...visual, ...Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'textContent')) } : visual, layout: domain === 'spacing' || domain === 'layout' ? { ...layout, ...record } : layout, motion: domain === 'motion' ? { ...motion, ...record } : motion, semantics: record.textContent ? { ...dna.semantics, textContent: record.textContent } : dna.semantics } },
  }))
}
