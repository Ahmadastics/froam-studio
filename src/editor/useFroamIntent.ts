import { useCallback, useEffect, useReducer, useRef, type Dispatch, type SetStateAction } from 'react'
import type { EditorStore, FroamViewport } from '../collab/types'
import { requestIntelligencePlan } from '../project/bridge'
import { assembleFroamIntelligenceRequest } from '../project/intelligence-context'
import { deriveBranchState, switchProjectBranch } from '../project/event-log'
import { adoptMutationChanges, compareMutationBranches, createMutationPrototypeFromProposals, type FroamMutationSelectionSnapshot } from '../project/mutation'
import { dnaFromScan, scanDomTree } from '../project/scan'
import type { FroamNodeRegistry } from '../project/node-registry'
import type { FroamIntelligenceResponse, FroamIntelligenceNotConfiguredResponse } from '../project/intelligence-transport'
import type { FroamProjectDocument } from '../project/types'
import { readFroamIntelligenceConsent, writeFroamIntelligenceConsent } from './intelligence-consent'
import { FROAM_INTENT_MAX_ATTEMPTS, froamIntentPreferences, froamIntentPrototypeName, froamIntentReducer, froamIntentRetryFeedback, initialFroamIntentState, type FroamIntentOrigin, type FroamIntentSession } from './froam-intent-model'

type Selection = { nodeId?: string; path: string; label: string } | null
type Activity = 'intent-understanding' | 'intent-creating' | 'intent-applying' | null
type PendingIntent = { session: FroamIntentSession; snapshot: FroamMutationSelectionSnapshot; feedback: string | null }

type Props = {
  project: FroamProjectDocument
  setProject: Dispatch<SetStateAction<FroamProjectDocument>>
  actorId: string
  routeKey: string
  viewport: FroamViewport
  selection: Selection
  root: HTMLElement | null
  selectedElement: HTMLElement | null
  registry: FroamNodeRegistry
  onRegistryChange: (registry: FroamNodeRegistry) => void
  onPreviewStore: (store: EditorStore, protectRollback?: boolean) => void
  onCommitStore: (store: EditorStore) => void
  onActivityChange: (activity: Activity) => void
  onToast: (message: string) => void
  request?: (request: Parameters<typeof requestIntelligencePlan>[0], signal: AbortSignal) => Promise<FroamIntelligenceResponse | FroamIntelligenceNotConfiguredResponse>
}

function safeIntentError(error: unknown) {
  const code = error instanceof Error ? error.message : 'provider_unavailable'
  if (code === 'not_configured') return "Froam intelligence isn't configured for this project."
  if (code === 'provider_unavailable') return "Froam couldn't reach the configured intelligence provider."
  if (code === 'no_valid_proposals') return "Froam couldn't find a safe change for that request."
  if (code === 'provider_invalid_response' || code === 'invalid_request') return "Froam couldn't prepare a safe experiment."
  if (code === 'identity_lost') return 'That element changed while Froam was preparing the experiment. Select it again and retry.'
  if (code === 'no_compiled_changes' || /No safe mutation proposals/.test(code)) return "Froam couldn't find a safe change for that request."
  return "Froam couldn't reach the configured intelligence provider."
}

export function useFroamIntent(props: Props) {
  const [state, dispatch] = useReducer(froamIntentReducer, initialFroamIntentState)
  const stateRef = useRef(state); stateRef.current = state
  const projectRef = useRef(props.project); projectRef.current = props.project
  const selectionRef = useRef(props.selection); selectionRef.current = props.selection
  const selectedElementRef = useRef(props.selectedElement); selectedElementRef.current = props.selectedElement
  const pendingRef = useRef<PendingIntent | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    if (state.phase === 'preparing' || state.phase === 'awaiting-consent' || state.phase === 'requesting' || state.phase === 'retrying') props.onActivityChange('intent-understanding')
    else if (state.phase === 'plan-ready' || state.phase === 'creating-prototype') props.onActivityChange('intent-creating')
    else if (state.phase === 'adopting') props.onActivityChange('intent-applying')
    else props.onActivityChange(null)
  }, [state.phase, props.onActivityChange])

  const observeSelection = useCallback((): FroamMutationSelectionSnapshot | null => {
    const selection = selectionRef.current
    const root = props.root
    const element = selectedElementRef.current
    if (!selection?.nodeId || !root || !element || !root.contains(element)) return null
    const bundle = scanDomTree(root, props.registry, { routeKey: props.routeKey, viewport: props.viewport, selectedRoot: element, maxNodes: 48 })
    props.onRegistryChange(bundle.registry)
    const scan = bundle.records.find((record) => record.node.nodeId === selection.nodeId)
    const node = bundle.nodes.find((candidate) => candidate.id === selection.nodeId)
    if (!scan || !node || scan.node.path !== selection.path) return null
    const evidenceIds = new Set([selection.nodeId, ...scan.childNodeIds, ...scan.siblingNodeIds])
    return { node, scan, dna: dnaFromScan(scan), relationships: bundle.relations.filter((relation) => evidenceIds.has(relation.from) || evidenceIds.has(relation.to)).slice(0, 16), routeKey: props.routeKey, viewport: props.viewport, path: selection.path }
  }, [props.root, props.registry, props.routeKey, props.viewport, props.onRegistryChange])

  const performRequest = useCallback(async (pending: PendingIntent) => {
    dispatch({ type: 'request' })
    const request = assembleFroamIntelligenceRequest({ project: projectRef.current, intent: pending.session.intent, scope: { selectedNodeId: pending.session.selectedNodeId, selectedDomPath: pending.session.selectedPath, routeKey: props.routeKey, viewport: props.viewport }, priorAttemptFeedback: pending.feedback, requestId: `${pending.session.id}:${pending.session.attempt}`, consent: true, selectionEvidence: { node: pending.snapshot.node, scan: pending.snapshot.scan, dna: pending.snapshot.dna, relationships: pending.snapshot.relationships } })
    if (!request) { dispatch({ type: 'fail', message: 'Froam couldn\'t identify that element reliably. Select it again and retry.' }); return }
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller
    try {
      const response = props.request ? await props.request(request, controller.signal) : await requestIntelligencePlan(request, fetch, controller.signal)
      if ('configured' in response) throw new Error('not_configured')
      if (response.purpose !== 'mutate') throw new Error('provider_invalid_response')
      dispatch({ type: 'plan-ready' })
      dispatch({ type: 'create-prototype' })
      const currentSelection = selectionRef.current
      const currentElement = selectedElementRef.current
      if (!currentSelection?.nodeId || currentSelection.nodeId !== pending.session.selectedNodeId || !currentElement || !props.root?.contains(currentElement)) throw new Error('identity_lost')
      const sourceProject = projectRef.current.activeBranchId === pending.session.sourceBranchId ? projectRef.current : switchProjectBranch(projectRef.current, pending.session.sourceBranchId)
      const branchId = `froam-intent-${Date.now().toString(36)}-${pending.session.attempt}`
      const branchName = froamIntentPrototypeName(pending.session.intent)
      const preferences = froamIntentPreferences(pending.session.intent)
      const result = createMutationPrototypeFromProposals(sourceProject, { branchId, name: branchName, actorId: props.actorId, level: 'safe', scopeNodeIds: [pending.session.selectedNodeId], proposals: response.proposals, constraints: request.constraints, provider: response.provider, selectionSnapshot: pending.snapshot, preserveDimensions: preferences.preserveDimensions })
      if (result.compiledDesignOperationCount === 0) throw new Error('no_compiled_changes')
      projectRef.current = result.project
      props.setProject(result.project)
      props.onPreviewStore(deriveBranchState(result.project, branchId).legacyStore, true)
      dispatch({ type: 'preview', prototypeBranchId: branchId, prototypeName: branchName, changeCount: result.compiledDesignOperationCount, rationale: response.rationale, changeSummaries: result.proposals.map((proposal) => proposal.rationale).slice(0, 6) })
    } catch (error) {
      if (controller.signal.aborted) { dispatch({ type: 'cancel' }); return }
      dispatch({ type: 'fail', message: safeIntentError(error) })
    } finally { if (abortRef.current === controller) abortRef.current = null }
  }, [props.actorId, props.onPreviewStore, props.request, props.root, props.routeKey, props.setProject, props.viewport])

  const submit = useCallback(async (input: { origin: FroamIntentOrigin; intent: string }) => {
    const intent = input.intent.trim()
    const selection = selectionRef.current
    if (!intent) return
    if (!selection?.nodeId) { dispatch({ type: 'fail', message: 'Select something on the canvas first.' }); return }
    const snapshot = observeSelection()
    if (!snapshot) { dispatch({ type: 'fail', message: "Froam couldn't identify that element reliably. Select it again and retry." }); return }
    const session: FroamIntentSession = { id: `intent:${Date.now().toString(36)}`, origin: input.origin, intent, selectedNodeId: selection.nodeId, selectedPath: selection.path, sourceBranchId: projectRef.current.activeBranchId, attempt: 1, maxAttempts: FROAM_INTENT_MAX_ATTEMPTS }
    const pending = { session, snapshot, feedback: null }; pendingRef.current = pending
    dispatch({ type: 'submit', session })
    if (readFroamIntelligenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage) !== 'allowed') { dispatch({ type: 'require-consent' }); return }
    await performRequest(pending)
  }, [observeSelection, performRequest])

  const allow = useCallback(() => {
    const pending = pendingRef.current; if (!pending) return
    writeFroamIntelligenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'allowed')
    void performRequest(pending)
  }, [performRequest])
  const notNow = useCallback(() => { writeFroamIntelligenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'declined'); pendingRef.current = null; dispatch({ type: 'cancel' }) }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort(); abortRef.current = null
    const current = stateRef.current
    if (current.session?.sourceBranchId && projectRef.current.branches[current.session.sourceBranchId]) {
      const source = switchProjectBranch(projectRef.current, current.session.sourceBranchId)
      projectRef.current = source; props.setProject(source); props.onPreviewStore(deriveBranchState(source, current.session.sourceBranchId).legacyStore, false)
    }
    pendingRef.current = null
    dispatch({ type: 'cancel' })
  }, [props.onPreviewStore, props.setProject])

  const retry = useCallback(() => {
    const current = stateRef.current
    if (!current.session) return
    if (current.session.attempt >= current.session.maxAttempts) { dispatch({ type: 'fail', message: 'Refine your instruction to try another direction.' }); return }
    const source = switchProjectBranch(projectRef.current, current.session.sourceBranchId)
    projectRef.current = source; props.setProject(source); props.onPreviewStore(deriveBranchState(source, current.session.sourceBranchId).legacyStore, false)
    const feedback = froamIntentRetryFeedback(current)
    const nextSession = { ...current.session, attempt: current.session.attempt + 1 }
    const pending = { session: nextSession, snapshot: pendingRef.current?.snapshot ?? observeSelection()!, feedback }
    if (!pending.snapshot) { dispatch({ type: 'fail', message: 'That element changed while Froam was preparing the experiment. Select it again and retry.' }); return }
    pendingRef.current = pending
    dispatch({ type: 'retry' })
    void performRequest(pending)
  }, [observeSelection, performRequest, props.onPreviewStore, props.setProject])

  const keep = useCallback(() => {
    const current = stateRef.current
    const session = current.session
    if (current.phase !== 'previewing' || !session?.prototypeBranchId) return
    dispatch({ type: 'adopt' })
    try {
      const comparison = compareMutationBranches(projectRef.current, session.sourceBranchId, session.prototypeBranchId)
      const adopted = adoptMutationChanges(projectRef.current, { mutationBranchId: session.prototypeBranchId, targetBranchId: session.sourceBranchId, eventIds: comparison.eventIds, actorId: props.actorId })
      if (adopted.status === 'refused') {
        const source = switchProjectBranch(adopted.project, session.sourceBranchId)
        projectRef.current = source; props.setProject(source); props.onPreviewStore(deriveBranchState(source, session.sourceBranchId).legacyStore, false)
        dispatch({ type: 'fail', message: "The original interface changed while this experiment was open. Froam won't overwrite the newer changes." })
        return
      }
      const source = switchProjectBranch(adopted.project, session.sourceBranchId)
      projectRef.current = source; props.setProject(source); props.onCommitStore(deriveBranchState(source, session.sourceBranchId).legacyStore)
      pendingRef.current = null
      const message = `Froam applied ${adopted.adoptedEventIds.filter((id) => source.events.find((event) => event.id === id)?.type === 'design.op.appended').length || session.changeCount || 1} change${(session.changeCount ?? 1) === 1 ? '' : 's'}`
      dispatch({ type: 'complete', message })
      props.onToast(message)
    } catch {
      const source = switchProjectBranch(projectRef.current, session.sourceBranchId)
      projectRef.current = source; props.setProject(source); props.onPreviewStore(deriveBranchState(source, session.sourceBranchId).legacyStore, false)
      dispatch({ type: 'fail', message: "The original interface changed while this experiment was open. Froam won't overwrite the newer changes." })
    }
  }, [props.actorId, props.onCommitStore, props.onPreviewStore, props.onToast, props.setProject])

  const dismiss = useCallback(() => dispatch({ type: 'cancel' }), [])
  return { state, submit, allow, notNow, keep, retry, cancel, dismiss }
}
