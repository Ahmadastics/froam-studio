import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Activity, Boxes, Bug, GitBranch, History, Pause, Play, Plus, RotateCcw, Trash2, X, Zap } from 'lucide-react'
import type { EditorStore, FroamOp, FroamViewport } from '../collab/types'
import { appendProjectEvents, createProjectBranch, createProjectDocument, createProjectEvent, deleteProjectBranch, deriveBranchState, emptyProjectState, renameProjectBranch, switchProjectBranch } from '../project/event-log'
import { nodeRegistryGraphRecords, legacyOpsToProjectEvents } from '../project/adapters'
import { materializeGraphRows } from '../project/graph-inspector'
import { branchReplayEvents, replayActors, replayCategory, replayEventLabel, replayStateAt, type FroamReplayCategory } from '../project/replay'
import { identityHealthReport, type FroamIdentityDiagnostic, type FroamNodeRegistry } from '../project/node-registry'
import type { FroamFrameworkFinding } from '../project/framework-identity'
import { aggregateIdentityDiagnostics, identityTelemetryRates } from '../project/identity-telemetry'
import type { FroamInteraction, FroamProjectDocument, FroamProjectState } from '../project/types'
import { interactionInspectorRecord } from '../project/animator-adapter'
import { createArchiveItem, minimalArchiveDna } from '../project/archive'
import FroamAnimator from './FroamAnimator'

type SelectionRef = { nodeId?: string; path: string; label: string } | null
export type FroamConnectedCanvasTab = 'replay' | 'branches' | 'node' | 'graph' | 'interaction'

type Props = {
  open: boolean
  onClose: () => void
  projectId: string
  actorId: string
  ops: readonly FroamOp[]
  store: EditorStore
  registry: FroamNodeRegistry
  diagnostics: readonly FroamIdentityDiagnostic[]
  frameworkFinding?: FroamFrameworkFinding | null
  routeKey: string
  viewport: FroamViewport
  selection: SelectionRef
  selectedElement: HTMLElement | null
  onPreviewStore: (store: EditorStore | null) => void
  onMaterializeBranch: (store: EditorStore) => void
  onSelectNode: (nodeId: string, path?: string) => void
  onApplyAnimation: (css: string, inline: string) => void
  onToast: (message: string) => void
  project: FroamProjectDocument
  onProjectChange: Dispatch<SetStateAction<FroamProjectDocument>>
  requestedTab?: FroamConnectedCanvasTab
  onTemporalOwnerChange?: (owner: 'replay' | 'animator' | null) => void
}

function mergeRegistryState(state: FroamProjectState, registry: FroamNodeRegistry): FroamProjectState {
  const graph = nodeRegistryGraphRecords(registry)
  return {
    ...state,
    nodes: { ...state.nodes, ...Object.fromEntries(graph.nodes.map((node) => [node.id, node])) },
    relations: { ...state.relations, ...Object.fromEntries(graph.relations.map((relation) => [relation.id, relation])) },
  }
}

export default function FroamConnectedCanvas(props: Props) {
  const [tab, setTab] = useState<FroamConnectedCanvasTab>(() => { try { return (localStorage.getItem('froam-connected-tab-v1') as FroamConnectedCanvasTab | null) ?? 'replay' } catch { return 'replay' } })
  const project = props.project
  const setProject = props.onProjectChange
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [actorFilter, setActorFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FroamReplayCategory | ''>('')
  const [branchName, setBranchName] = useState('Prototype 01')
  const [draftInteraction, setDraftInteraction] = useState<FroamInteraction | null>(null)
  const previewing = useRef(false)

  useEffect(() => { if (props.requestedTab) setTab(props.requestedTab) }, [props.requestedTab])
  useEffect(() => { try { localStorage.setItem('froam-connected-tab-v1', tab) } catch { /* optional preference */ }; props.onTemporalOwnerChange?.(props.open && tab === 'replay' ? 'replay' : props.open && tab === 'interaction' ? 'animator' : null) }, [tab, props.open, props.onTemporalOwnerChange])

  useEffect(() => () => { if (previewing.current) props.onPreviewStore(null) }, [props.onPreviewStore])

  const replayEvents = useMemo(() => branchReplayEvents(project, project.activeBranchId, {
    actorId: actorFilter || undefined,
    category: categoryFilter || undefined,
    includeBaseline: false,
  }), [project, actorFilter, categoryFilter])
  const allBranchEvents = useMemo(() => branchReplayEvents(project, project.activeBranchId, { includeBaseline: false }), [project])
  const actors = useMemo(() => replayActors(allBranchEvents), [allBranchEvents])

  const previewAt = useCallback((nextCursor: number) => {
    const bounded = Math.max(0, Math.min(nextCursor, replayEvents.length))
    setCursor(bounded)
    previewing.current = true
    const allowed = new Set(replayEvents.slice(0, bounded).map((event) => event.id))
    const branch = project.branches[project.activeBranchId]
    const checkpoint = project.checkpoints[branch.baseCheckpointId]
    const previewProject = { ...project, events: project.events.filter((event) => event.branchId !== project.activeBranchId || event.actorId === 'baseline' || allowed.has(event.id)) }
    props.onPreviewStore(replayStateAt(previewProject, bounded, project.activeBranchId, { includeBaseline: true }).legacyStore)
  }, [project, replayEvents, props.onPreviewStore])

  const stopPreview = useCallback(() => {
    setPlaying(false)
    previewing.current = false
    props.onPreviewStore(null)
  }, [props.onPreviewStore])

  useEffect(() => {
    if (!playing) return
    if (cursor >= replayEvents.length) { setPlaying(false); return }
    const timer = window.setTimeout(() => previewAt(cursor + 1), Math.max(40, 700 / speed))
    return () => window.clearTimeout(timer)
  }, [playing, cursor, replayEvents.length, speed, previewAt])

  const projectState = useMemo(() => mergeRegistryState(deriveBranchState(project), props.registry), [project, props.registry])
  const graphRows = useMemo(() => materializeGraphRows(projectState), [projectState])
  const selectedEntry = props.selection?.nodeId ? props.registry[props.selection.nodeId] : undefined
  const identityHealth = useMemo(() => identityHealthReport(props.registry), [props.registry, props.diagnostics.length])
  const identityTelemetry = useMemo(() => aggregateIdentityDiagnostics(props.diagnostics), [props.diagnostics])
  const identityRates = useMemo(() => identityTelemetryRates(identityTelemetry), [identityTelemetry])
  const selectedRelations = props.selection?.nodeId
    ? Object.values(projectState.relations).filter((relation) => relation.from === props.selection?.nodeId || relation.to === props.selection?.nodeId)
    : []

  function createBranch() {
    const id = `prototype-${Date.now().toString(36)}`
    const next = createProjectBranch(project, { id, name: branchName, actorId: props.actorId })
    setProject(next)
    props.onMaterializeBranch(deriveBranchState(next, id).legacyStore)
    props.onToast(`Created ${branchName}`)
  }

  function switchBranch(branchId: string) {
    stopPreview()
    const next = switchProjectBranch(project, branchId)
    setProject(next)
    props.onMaterializeBranch(deriveBranchState(next, branchId).legacyStore)
    props.onToast(`Switched to ${next.branches[branchId].name}`)
  }

  function removeBranch(branchId: string) {
    try {
      const next = deleteProjectBranch(project, branchId)
      setProject(next)
      if (next.activeBranchId !== project.activeBranchId) props.onMaterializeBranch(deriveBranchState(next).legacyStore)
    } catch (error) { props.onToast(error instanceof Error ? error.message : 'Could not delete prototype') }
  }

  function commitAnimation(css: string, inline: string, interaction: FroamInteraction) {
    props.onApplyAnimation(css, inline)
    setProject((current) => appendProjectEvents(current, [createProjectEvent({
      projectId: current.id, branchId: current.activeBranchId, actorId: props.actorId, clock: Math.max(0, ...current.events.map((event) => event.clock)) + 1,
      type: 'interaction.upserted', targetIds: [interaction.sourceId, ...interaction.targetIds],
      payload: { interaction }, label: `Interaction: ${interaction.name}`,
    })]))
    setDraftInteraction(interaction)
  }

  function saveDraftToArchive(interaction: FroamInteraction) {
    if (!props.selection?.nodeId) return props.onToast('Select a node and create motion before archiving it')
    const dna = projectState.dna[props.selection.nodeId] ?? minimalArchiveDna(props.selection.nodeId, { role: props.selectedElement?.getAttribute('role') ?? props.selectedElement?.tagName.toLowerCase(), tagName: props.selectedElement?.tagName.toLowerCase(), motion: interaction })
    const item = createArchiveItem({ id: `archive:motion:${Date.now().toString(36)}`, nodeId: props.selection.nodeId, name: interaction.name, actorId: props.actorId, projectId: project.id, branchId: project.activeBranchId, dna, kind: 'motion', interaction, interactionIds: [interaction.id], includes: ['motion'], description: 'Precision keyframe motion authored in Animator.' })
    setProject((current) => { const clock = Math.max(0, ...current.events.map((event) => event.clock)) + 1; return appendProjectEvents(current, [
      createProjectEvent({ projectId: current.id, branchId: current.activeBranchId, actorId: props.actorId, clock, type: 'interaction.upserted', payload: { interaction }, targetIds: [interaction.sourceId, ...interaction.targetIds], label: `Saved reusable interaction: ${interaction.name}` }),
      createProjectEvent({ projectId: current.id, branchId: current.activeBranchId, actorId: props.actorId, clock: clock + 1, type: 'archive.upserted', payload: { archiveItem: item }, targetIds: [item.nodeId], label: `Archived Animator motion: ${item.name}` }),
    ]) })
    setDraftInteraction(interaction)
    props.onToast(`${item.name} saved to Archive`)
  }

  if (!props.open) return null
  const tabs: Array<[FroamConnectedCanvasTab, string, typeof History]> = [
    ['replay', 'Replay', History], ['branches', 'Prototypes', GitBranch], ['node', 'Node', Bug], ['graph', 'Graph', Boxes], ['interaction', 'Interaction', Zap],
  ]
  return (
    <aside className="froam-connected" data-chef-editor-root="true" aria-label="Connected Canvas">
      <header className="froam-connected__header">
        <div><strong>Connected Canvas</strong><small>{project.branches[project.activeBranchId].name}</small></div>
        <button type="button" onClick={() => { stopPreview(); props.onClose() }} aria-label="Close Connected Canvas"><X size={15} /></button>
      </header>
      <nav className="froam-connected__tabs">
        {tabs.map(([id, label, Icon]) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)} title={label}><Icon size={14} /><span>{label}</span></button>)}
      </nav>
      <div className="froam-connected__body">
        {tab === 'replay' && <section className="froam-connected__section">
          <div className="froam-connected__controls">
            <button type="button" onClick={() => cursor >= replayEvents.length ? previewAt(0) : setPlaying((value) => !value)}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
            <button type="button" onClick={() => previewAt(0)} title="Restart"><RotateCcw size={13} /></button>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[1, 4, 10, 20].map((value) => <option key={value} value={value}>{value}x</option>)}</select>
            <button type="button" onClick={stopPreview}>Live</button>
          </div>
          <input className="froam-connected__range" type="range" min={0} max={replayEvents.length} value={Math.min(cursor, replayEvents.length)} onChange={(event) => previewAt(Number(event.target.value))} />
          <div className="froam-connected__filters">
            <select value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setCursor(0) }}><option value="">Everyone</option>{actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select>
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value as FroamReplayCategory | ''); setCursor(0) }}><option value="">All changes</option>{['structural', 'styling', 'text', 'interaction'].map((category) => <option key={category} value={category}>{category}</option>)}</select>
          </div>
          <div className="froam-connected__timeline">{replayEvents.map((event, index) => <button type="button" key={event.id} className={index < cursor ? 'is-past' : ''} onClick={() => previewAt(index + 1)}><span>{replayEventLabel(event)}</span><small>{event.actorId} · {replayCategory(event)}</small></button>)}</div>
          {!replayEvents.length && <p className="froam-connected__empty">No replayable changes match this filter.</p>}
        </section>}

        {tab === 'branches' && <section className="froam-connected__section">
          <div className="froam-connected__create"><input value={branchName} onChange={(event) => setBranchName(event.target.value)} maxLength={80} /><button type="button" onClick={createBranch}><Plus size={13} /> Fork</button></div>
          <div className="froam-connected__branches">{Object.values(project.branches).map((branch) => <div key={branch.id} className={branch.id === project.activeBranchId ? 'is-active' : ''}>
            <button type="button" onClick={() => switchBranch(branch.id)}><strong>{branch.name}</strong><small>{branch.parentBranchId ? `from ${project.branches[branch.parentBranchId]?.name ?? branch.parentBranchId}` : 'Primary'}{branch.forkEventId ? ` · fork ${branch.forkEventId.slice(0, 7)}` : ''}</small></button>
            <button type="button" title="Rename" onClick={() => { const name = window.prompt('Prototype name', branch.name); if (name) setProject(renameProjectBranch(project, branch.id, name)) }}>Aa</button>
            {branch.id !== 'main' && <button type="button" title="Delete" onClick={() => removeBranch(branch.id)}><Trash2 size={12} /></button>}
          </div>)}</div>
        </section>}

        {tab === 'node' && <section className="froam-connected__section">
          {props.selection ? <div className="froam-connected__inspector">
            <label>Node ID<code>{props.selection.nodeId ?? 'not captured'}</code></label>
            <label>Current path<code>{props.selection.path}</code></label>
            <label>Identity source<strong>{selectedEntry?.source ?? 'legacy path'}</strong></label>
            <label>Resolved by<strong>{selectedEntry?.lastResolution ?? 'selection capture'}</strong></label>
            <label>Fingerprint<strong>{selectedEntry?.fingerprint ? 'healthy' : 'unavailable'}</strong></label>
            <label>Route / viewport<strong>{selectedEntry?.routeKey ?? props.routeKey} · {selectedEntry?.viewport ?? props.viewport}</strong></label>
            <label>Recoveries<strong>{selectedEntry?.recoveryCount ?? 0}</strong></label>
            <label>Relationships<strong>{selectedRelations.length}</strong></label>
          </div> : <p className="froam-connected__empty">Select a node to inspect its stable identity.</p>}
          <h4>Recovery diagnostics</h4>
          <div className="froam-connected__inspector">
            <label>Stable resolution<strong>{identityHealth.stablePercent.toFixed(1)}%</strong></label>
            <label>Path fallback<strong>{identityHealth.counts.path}</strong></label>
            <label>Fingerprint recovery<strong>{identityHealth.counts.fingerprint}</strong></label>
            <label>Ambiguous / failed<strong>{identityHealth.ambiguous} / {identityHealth.failed}</strong></label>
            <label>Observed path / fingerprint<strong>{(identityRates.path * 100).toFixed(1)}% / {(identityRates.fingerprint * 100).toFixed(1)}%</strong></label>
            <label>Local telemetry events<strong>{identityTelemetry.total}</strong></label>
            <label>Host framework<strong>{props.frameworkFinding?.framework ?? 'unknown'}</strong></label>
            <label>Adapter strategy<strong>observable DOM · no private internals</strong></label>
          </div>
          <div className="froam-connected__diagnostics">{props.diagnostics.slice(-12).reverse().map((event, index) => <div key={`${event.at}-${index}`}><strong>{event.type.replaceAll('-', ' ')}</strong><small>{event.nodeId}{event.path ? ` · ${event.path}` : ''}</small></div>)}</div>
        </section>}

        {tab === 'graph' && <section className="froam-connected__section">
          <p className="froam-connected__hint">Experimental project-graph projection. Selection is synchronized with the canvas.</p>
          <div className="froam-connected__graph">{graphRows.map((row) => <button type="button" key={row.node.id} className={props.selection?.nodeId === row.node.id ? 'is-selected' : ''} style={{ paddingLeft: 10 + row.depth * 16 }} onClick={() => props.onSelectNode(row.node.id, row.node.locator?.path)}><span>{row.node.name ?? row.node.id}</span><small>{row.node.kind} · {row.outgoing.map((relation) => relation.kind).join(', ') || 'leaf'}</small></button>)}</div>
        </section>}

        {tab === 'interaction' && <section className="froam-connected__section">
          <FroamAnimator selectedElement={props.selectedElement} selectionLabel={props.selection?.label ?? 'node'} sourceNodeId={props.selection?.nodeId} savedInteractions={Object.values(projectState.interactions)} onInteractionChange={setDraftInteraction} onSaveToArchive={saveDraftToArchive} onApplyAnimation={commitAnimation} onToast={props.onToast} />
          {draftInteraction && <pre className="froam-connected__interaction">{JSON.stringify(interactionInspectorRecord(draftInteraction), null, 2)}</pre>}
        </section>}
      </div>
    </aside>
  )
}
