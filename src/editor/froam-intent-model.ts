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
  if (requestedColor) add('visual', /background|surface|card|section|fill/.test(normalized) ? 'backgroundColor' : 'color', requestedColor)
  if (/bold|stronger text|heavier text/.test(normalized)) add('typography', 'fontWeight', '700')
  if (/lighter text|less bold/.test(normalized)) add('typography', 'fontWeight', '400')
  if (/uppercase|all caps/.test(normalized)) add('typography', 'textTransform', 'uppercase')
  if (/lowercase/.test(normalized)) add('typography', 'textTransform', 'lowercase')
  if (/italic/.test(normalized)) add('typography', 'fontStyle', 'italic')
  if (/underline/.test(normalized)) add('typography', 'textDecorationLine', 'underline')
  if (/bigger|larger|increase (?:the )?(?:text|font)|make (?:the )?(?:text|font) bigger/.test(normalized)) add('typography', 'fontSize', `${Math.round(pixels(visual.fontSize, 16) * 1.15)}px`)
  if (/smaller|reduce (?:the )?(?:text|font)|make (?:the )?(?:text|font) smaller/.test(normalized)) add('typography', 'fontSize', `${Math.max(10, Math.round(pixels(visual.fontSize, 16) * .88))}px`)
  if (/rounder|rounded|soft corners/.test(normalized)) add('visual', 'borderRadius', /pill|fully/.test(normalized) ? '999px' : '16px')
  if (/square corners|sharp corners|remove (?:the )?radius/.test(normalized)) add('visual', 'borderRadius', '0px')
  if (/shadow|depth|premium|polished|prominent|stand out|pop/.test(normalized)) add('visual', 'boxShadow', '0 16px 42px rgba(0, 0, 0, 0.28)')
  if (/remove (?:the )?shadow|flat/.test(normalized)) add('visual', 'boxShadow', 'none')
  if (/transparent|fade|faded|less visible/.test(normalized)) add('visual', 'opacity', '0.72')
  if (/opaque|fully visible/.test(normalized)) add('visual', 'opacity', '1')
  if (/more (?:space|spacing|padding)|breathing room|roomier/.test(normalized)) add('spacing', 'padding', `${Math.round(pixels(layout.padding, 12) + 6)}px`)
  if (/less (?:space|spacing|padding)|tighter|compact/.test(normalized)) add('spacing', 'padding', `${Math.max(0, Math.round(pixels(layout.padding, 12) - 4))}px`)
  if (/lift|raise|slightly up/.test(normalized)) add('motion', 'transform', 'translateY(-4px)')

  return [...changes].map(([domain, record]) => ({
    type: 'dna.captured',
    domain,
    targetIds: [snapshot.node.id],
    confidence: .98,
    rationale: `Applied locally: ${intent.slice(0, 120)}`,
    payload: { dna: { ...dna, nodeId: snapshot.node.id, capturedAt: Date.now(), visual: domain === 'visual' || domain === 'typography' ? { ...visual, ...record } : visual, layout: domain === 'spacing' ? { ...layout, ...record } : layout, motion: domain === 'motion' ? { ...motion, ...record } : motion } },
  }))
}
