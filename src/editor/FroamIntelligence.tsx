import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Archive, Brain, Clapperboard, Eye, GitFork, History, Network, Play, Pause, ScanSearch, Smartphone, Upload, Waves, X } from 'lucide-react'
import { appendProjectEvents, createProjectEvent, deriveBranchState } from '../project/event-log'
import { scanDomTree, dnaFromScan } from '../project/scan'
import { archiveItemKind, createArchiveItem, recordArchiveArtifactUse, searchArchive, type FroamArchiveKind } from '../project/archive'
import { buildIntelligenceMemory } from '../project/intelligence-memory'
import { archaeologyForNode } from '../project/archaeology'
import { createFlowGraph } from '../project/product-flow'
import { predictAttention, type FroamAttentionRank } from '../project/attention'
import { analyzeVisualRhythm } from '../project/rhythm'
import { cinemaWidths, defaultResponsivePolicy, observeResponsiveState, responsiveSuggestions, type FroamResponsiveObservation } from '../project/responsive'
import { applyVisualDiff, compareScreenshotPixels, localScreenshotProvider, type FroamScreenshotReconstruction, type FroamScreenshotRegion } from '../project/screenshot-reconstruction'
import type { FroamNodeRegistry } from '../project/node-registry'
import type { FroamArchiveItem, FroamProjectDocument, FroamProjectEventPayload, FroamProjectEventType, FroamResponsivePolicy, FroamScanRecord } from '../project/types'

type SelectionRef = { nodeId?: string; path: string; label: string } | null
export type FroamIntelligenceTab = 'scan' | 'dna' | 'archive' | 'archaeology' | 'flow' | 'attention' | 'rhythm' | 'responsive' | 'screenshot'

type Props = {
  open: boolean; onClose: () => void; project: FroamProjectDocument; onProjectChange: Dispatch<SetStateAction<FroamProjectDocument>>
  actorId: string; root: HTMLElement | null; registry: FroamNodeRegistry; onRegistryChange: (registry: FroamNodeRegistry) => void
  routeKey: string; viewport: 'desktop' | 'tablet' | 'mobile'; selection: SelectionRef; selectedElement: HTMLElement | null
  onSelectNode: (nodeId: string, path?: string) => void; onInsertArchived: (html: string) => void
  onApplyArchivedStyle: (styles: Record<string, string>) => void
  onInsertReconstruction: (regions: FroamScreenshotRegion[], width: number, height: number, rootNodeId: string) => HTMLElement
  onPreviewWidth: (width: number | null) => void; onToast: (message: string) => void
  requestedTab?: FroamIntelligenceTab; onTemporalOwnerChange?: (owner: 'breakpoint-cinema' | null) => void
  onActivityChange?: (activity: 'scanning' | 'screenshot' | null) => void
}

type EventInput = { type: FroamProjectEventType; payload: FroamProjectEventPayload; targetIds?: string[]; label?: string }

export default function FroamIntelligence(props: Props) {
  const [tab, setTab] = useState<FroamIntelligenceTab>(() => { try { return (localStorage.getItem('froam-intelligence-tab-v1') as FroamIntelligenceTab | null) ?? 'scan' } catch { return 'scan' } })
  const [scanning, setScanning] = useState(false)
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveKind, setArchiveKind] = useState<'all' | FroamArchiveKind>('all')
  const [flowName, setFlowName] = useState('Primary journey')
  const [flowNodeName, setFlowNodeName] = useState('New screen')
  const [flowRoute, setFlowRoute] = useState('')
  const [attentionOverlay, setAttentionOverlay] = useState(false)
  const [cinemaPlaying, setCinemaPlaying] = useState(false)
  const [cinemaWidth, setCinemaWidth] = useState(375)
  const [cinemaSpeed, setCinemaSpeed] = useState(1)
  const [cinemaObservations, setCinemaObservations] = useState<FroamResponsiveObservation[]>([])
  const [screenshotBusy, setScreenshotBusy] = useState(false)
  const [lastReconstruction, setLastReconstruction] = useState<FroamScreenshotReconstruction | null>(null)
  const screenshotInput = useRef<HTMLInputElement>(null)
  const state = useMemo(() => deriveBranchState(props.project), [props.project])
  const selectedDna = props.selection?.nodeId ? state.dna[props.selection.nodeId] : undefined
  const selectedPolicy = props.selection?.nodeId ? state.responsive[props.selection.nodeId] : undefined
  const scans = Object.values(state.scans)
  const latestScans = useMemo(() => {
    const latest = new Map<string, FroamScanRecord>()
    for (const scan of scans) if (!latest.has(scan.node.nodeId) || latest.get(scan.node.nodeId)!.capturedAt < scan.capturedAt) latest.set(scan.node.nodeId, scan)
    return [...latest.values()]
  }, [state.scans])
  const latestAttention = Object.values(state.analyses).filter((analysis) => analysis.kind === 'predicted-attention').sort((a, b) => b.createdAt - a.createdAt)[0]
  const ranking = (latestAttention?.result.ranking ?? []) as FroamAttentionRank[]
  const memory = useMemo(() => buildIntelligenceMemory(state), [state])

  useEffect(() => { if (props.requestedTab) setTab(props.requestedTab) }, [props.requestedTab])
  useEffect(() => { try { localStorage.setItem('froam-intelligence-tab-v1', tab) } catch { /* optional preference */ }; props.onTemporalOwnerChange?.(props.open && tab === 'responsive' ? 'breakpoint-cinema' : null) }, [tab, props.open, props.onTemporalOwnerChange])

  function commit(inputs: EventInput[]) {
    props.onProjectChange((current) => {
      let clock = Math.max(0, ...current.events.map((event) => event.clock))
      const events = inputs.map((input) => createProjectEvent({ projectId: current.id, branchId: current.activeBranchId, actorId: props.actorId, clock: ++clock, ...input }))
      return appendProjectEvents(current, events)
    })
  }

  function runScan() {
    if (!props.root) return
    setScanning(true)
    props.onActivityChange?.('scanning')
    try {
      const bundle = scanDomTree(props.root, props.registry, { routeKey: props.routeKey, viewport: props.viewport, selectedRoot: props.selectedElement ?? undefined, maxNodes: props.selectedElement ? 260 : 600 })
      props.onRegistryChange(bundle.registry)
      const events: EventInput[] = []
      for (const record of bundle.records) {
        events.push({ type: 'scan.captured', payload: { scan: record }, targetIds: [record.node.nodeId], label: 'Froam Scan' })
        events.push({ type: 'dna.captured', payload: { dna: dnaFromScan(record) }, targetIds: [record.node.nodeId], label: 'Component DNA' })
      }
      for (const node of bundle.nodes) events.push({ type: 'node.upserted', payload: { node }, targetIds: [node.id] })
      for (const relation of bundle.relations) events.push({ type: 'relation.upserted', payload: { relation }, targetIds: [relation.from, relation.to] })
      commit(events)
      props.onToast(`Scan understood ${bundle.records.length} nodes${bundle.families.length ? ` and ${bundle.families.length} repeated families` : ''}`)
    } catch (error) { props.onToast(error instanceof Error ? error.message : 'Scan failed') } finally { setScanning(false); props.onActivityChange?.(null) }
  }

  function archiveSelection() {
    if (!props.selection?.nodeId || !selectedDna) return props.onToast('Scan this node before archiving it')
    const item = createArchiveItem({ id: `archive:${Date.now().toString(36)}`, nodeId: props.selection.nodeId, name: props.selection.label, actorId: props.actorId, projectId: props.project.id, branchId: props.project.activeBranchId, dna: selectedDna, html: props.selectedElement?.outerHTML, legacyPath: props.selection.path })
    commit([{ type: 'archive.upserted', payload: { archiveItem: item }, targetIds: [item.nodeId], label: `Archived ${item.name}` }])
  }

  function removeArchive(id: string) { commit([{ type: 'archive.removed', payload: { archiveItemId: id }, label: 'Removed from Archive' }]) }

  function useArchiveItem(item: FroamArchiveItem) {
    const kind = archiveItemKind(item)
    const targetNodeId = props.selection?.nodeId ?? item.nodeId
    if ((kind === 'component' || kind === 'interface-pattern') && item.snapshot?.html) props.onInsertArchived(item.snapshot.html)
    if ((kind === 'style' || kind === 'interface-pattern') && item.artifact?.styles) props.onApplyArchivedStyle(item.artifact.styles)
    if ((kind === 'motion' || kind === 'interaction' || kind === 'interface-pattern') && item.artifact?.interaction) {
      const source = item.artifact.interaction
      const interaction = { ...source, id: `archive-use:${Date.now().toString(36)}`, sourceId: targetNodeId, targetIds: [targetNodeId], metadata: { ...source.metadata, archiveItemId: item.id, derivedFromInteractionId: source.id } }
      commit([{ type: 'interaction.upserted', payload: { interaction }, targetIds: [targetNodeId], label: `Applied Archive behavior: ${item.name}` }])
      if (props.selectedElement && interaction.timeline.length) props.selectedElement.animate(interaction.timeline.map((frame) => ({ ...frame.values, offset: frame.at })), { duration: interaction.durationMs ?? 600, delay: interaction.delayMs ?? 0, fill: 'both' })
    }
    commit([{ type: 'archive.upserted', payload: { archiveItem: recordArchiveArtifactUse(item, props.selection?.nodeId) }, targetIds: [item.nodeId], label: `Used Archive ${kind}: ${item.name}` }])
    props.onToast(`${item.name} applied from Archive`)
  }

  function addFlowNode() {
    const existing = Object.values(state.flows)[0]
    const id = `screen:${Date.now().toString(36)}`
    const graph = createFlowGraph(flowName, [{ id, name: flowNodeName, routeKey: flowRoute || undefined }], [])
    if (existing) { graph.flow.id = existing.id; graph.flow.nodeIds = [...new Set([...existing.nodeIds, id])]; graph.flow.edgeIds = existing.edgeIds; graph.flow.entryNodeId = existing.entryNodeId ?? id }
    commit([{ type: 'node.upserted', payload: { node: graph.nodes[0] }, targetIds: [id] }, { type: 'flow.upserted', payload: { flow: graph.flow }, targetIds: [id], label: 'Flow screen' }])
  }

  function connectFlow(from: string, to: string) {
    if (!from || !to || from === to) return
    const relation = { id: `transition:${from}:${to}:${Date.now().toString(36)}`, kind: 'transitions-to' as const, from, to, label: window.prompt('Transition name', 'Continue') ?? 'Continue', condition: window.prompt('Condition (optional)', '') || undefined }
    const flow = Object.values(state.flows)[0]
    if (!flow) return
    commit([{ type: 'relation.upserted', payload: { relation }, targetIds: [from, to] }, { type: 'flow.upserted', payload: { flow: { ...flow, edgeIds: [...flow.edgeIds, relation.id] } }, targetIds: [from, to], label: 'Flow transition' }])
  }

  function runAttention() { const analysis = predictAttention(latestScans); commit([{ type: 'analysis.upserted', payload: { analysis }, targetIds: analysis.targetIds, label: 'Predicted Attention' }]); setAttentionOverlay(true) }
  function runRhythm() { const analysis = analyzeVisualRhythm(latestScans, window.innerHeight); commit([{ type: 'analysis.upserted', payload: { analysis }, targetIds: analysis.targetIds, label: 'Visual Rhythm' }]) }

  function updatePolicy(patch: Partial<FroamResponsivePolicy>) {
    if (!props.selection?.nodeId) return
    const policy = { ...(selectedPolicy ?? defaultResponsivePolicy(props.selection.nodeId, props.actorId)), ...patch, updatedAt: Date.now(), updatedBy: props.actorId }
    commit([{ type: 'responsive.upserted', payload: { responsive: policy }, targetIds: [policy.nodeId], label: 'Responsive priority' }])
  }

  useEffect(() => {
    if (!cinemaPlaying) return
    const timer = window.setTimeout(() => setCinemaWidth((width) => width >= 1440 ? 320 : width + 16), Math.max(30, 180 / cinemaSpeed))
    return () => window.clearTimeout(timer)
  }, [cinemaPlaying, cinemaWidth, cinemaSpeed])
  useEffect(() => {
    if (tab !== 'responsive') return
    props.onPreviewWidth(cinemaWidth)
    const frame = requestAnimationFrame(() => {
      if (!props.root) return
      const observation = observeResponsiveState(props.root, props.registry, state.responsive, cinemaWidth)
      setCinemaObservations((current) => current.some((item) => item.width === observation.width) ? current : [...current, observation])
    })
    return () => cancelAnimationFrame(frame)
  }, [cinemaWidth, tab])
  useEffect(() => () => props.onPreviewWidth(null), [])

  async function importScreenshot(file: File) {
    setScreenshotBusy(true)
    props.onActivityChange?.('screenshot')
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use a PNG, JPEG or WebP screenshot')
      const bitmap = await createImageBitmap(file); const imageWidth = bitmap.width; const imageHeight = bitmap.height; const canvas = document.createElement('canvas'); canvas.width = imageWidth; canvas.height = imageHeight
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas decoding is unavailable')
      context.drawImage(bitmap, 0, 0); const pixels = context.getImageData(0, 0, imageWidth, imageHeight); bitmap.close()
      let result = await localScreenshotProvider.reconstruct({ width: imageWidth, height: imageHeight, data: pixels.data, mimeType: file.type, name: file.name, referenceId: `reference:${Date.now().toString(36)}`, metadata: { viewportWidth: imageWidth, viewportHeight: imageHeight, route: props.routeKey, label: file.name } })
      const frame = props.onInsertReconstruction(result.regions, imageWidth, imageHeight, result.rootNodeId)
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        const { toPixelData } = await import('html-to-image')
        const captured = await toPixelData(frame, { width: imageWidth, height: imageHeight, pixelRatio: 1, cacheBust: true })
        result = applyVisualDiff(result, compareScreenshotPixels({ width: imageWidth, height: imageHeight, data: pixels.data, mimeType: file.type }, { width: imageWidth, height: imageHeight, data: new Uint8ClampedArray(captured), mimeType: 'image/png' }))
      } catch { result = applyVisualDiff(result, { metric: 'normalized-rgb-mae-v1', comparable: false, largestMismatches: [], disclaimer: 'The browser could not capture the reconstruction; structure remains editable and validation can be retried.' }) }
      const events: EventInput[] = [{ type: 'analysis.upserted', payload: { analysis: result.analysis }, targetIds: result.analysis.targetIds, label: 'Screenshot reconstruction' }]
      for (const node of result.nodes) events.push({ type: 'node.upserted', payload: { node }, targetIds: [node.id] })
      for (const relation of result.relations) events.push({ type: 'relation.upserted', payload: { relation }, targetIds: [relation.from, relation.to] })
      for (const dna of result.dna) events.push({ type: 'dna.captured', payload: { dna }, targetIds: [dna.nodeId] })
      commit(events); setLastReconstruction(result); const validation = result.analysis.result.validation as { comparable?: boolean; pixelSimilarity?: number } | null; props.onToast(`Reconstructed ${result.regions.length} editable regions${validation?.comparable ? ` · measured ${Math.round((validation.pixelSimilarity ?? 0) * 100)}% RGB similarity` : ''}`)
    } catch (error) { props.onToast(error instanceof Error ? error.message : 'Screenshot reconstruction failed') } finally { setScreenshotBusy(false); props.onActivityChange?.(null) }
  }

  if (!props.open) return null
  const tabs: Array<[FroamIntelligenceTab, string, typeof Brain]> = [['scan', 'Scan', ScanSearch], ['dna', 'DNA', Brain], ['archive', 'Archive', Archive], ['archaeology', 'Origins', History], ['flow', 'Flow', Network], ['attention', 'Attention', Eye], ['rhythm', 'Rhythm', Waves], ['responsive', 'Responsive', Clapperboard], ['screenshot', 'Screenshot', Upload]]
  const archaeology = props.selection?.nodeId ? archaeologyForNode(props.project, props.selection.nodeId) : null
  const rhythm = Object.values(state.analyses).filter((analysis) => analysis.kind === 'visual-rhythm').sort((a, b) => b.createdAt - a.createdAt)[0]
  const flow = Object.values(state.flows)[0]
  const flowNodes = flow?.nodeIds.map((id) => state.nodes[id]).filter(Boolean) ?? []
  const archiveItems = searchArchive(state.archive, archiveQuery).filter((item) => archiveKind === 'all' || archiveItemKind(item) === archiveKind)
  const suggestions = responsiveSuggestions(latestScans, state.responsive, cinemaWidth)
  return <>
    <aside className="froam-intelligence" data-chef-editor-root="true">
      <header><div><strong>Froam Intelligence</strong><small>v7 · understands locally</small></div><button type="button" aria-label="Close Froam Intelligence" onClick={() => { props.onPreviewWidth(null); props.onClose() }}><X size={15} /></button></header>
      <nav>{tabs.map(([id, label, Icon]) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} title={label} onClick={() => { if (tab === 'responsive') props.onPreviewWidth(null); setTab(id) }}><Icon size={14} /><span>{label}</span></button>)}</nav>
      <div className="froam-intelligence__journey"><span>Observe</span><i>→</i><span>Understand</span><i>→</i><span>Explain</span><i>→</i><span>Act</span></div>
      <main>
        {tab === 'scan' && <section><h3>Understand this interface</h3><p>Scan measures the live DOM, maps stable identity and separates observed facts from conservative inference.</p><button className="is-primary" type="button" onClick={runScan} disabled={scanning}>{scanning ? 'Scanning…' : props.selectedElement ? `Scan ${props.selection?.label ?? 'selection'}` : 'Scan page'}</button><div className="froam-intelligence__stats"><b>{latestScans.length}</b><span>understood nodes</span><b>{Object.keys(state.dna).length}</b><span>DNA records</span></div></section>}
        {tab === 'dna' && <section><h3>Component DNA</h3>{selectedDna ? <>{(['identity','structure','visual','layout','semantics','behavior','responsive','accessibility','history','usage'] as const).map((key) => selectedDna[key] && <details key={key} open={key === 'identity' || key === 'semantics'}><summary>{key}</summary><pre>{JSON.stringify(selectedDna[key], null, 2)}</pre></details>)}<details><summary>Advanced / Raw</summary><pre>{JSON.stringify(selectedDna, null, 2)}</pre></details></> : <p>Select and scan a node to inspect its DNA. Unknown fields remain unknown.</p>}</section>}
        {tab === 'archive' && <section><h3>Archive & project memory</h3><p>One library for reusable structure, appearance, motion, behavior, and complete interface patterns.</p><div className="froam-intelligence__memory">{Object.entries(memory.artifactCounts).map(([kind,count]) => <button type="button" className={archiveKind === kind ? 'is-active' : ''} key={kind} onClick={() => setArchiveKind(archiveKind === kind ? 'all' : kind as FroamArchiveKind)}><b>{count}</b><span>{kind.replace('-', ' ')}</span></button>)}</div><div className="froam-intelligence__row"><input placeholder="Search every artifact" value={archiveQuery} onChange={(event) => setArchiveQuery(event.target.value)} /><button type="button" onClick={archiveSelection}>Add component</button></div><div className="froam-intelligence__insights">{memory.insights.map((insight) => <article key={insight.id} data-tone={insight.tone}><strong>{insight.title}</strong><small>{insight.detail}</small></article>)}</div><div className="froam-intelligence__list">{archiveItems.map((item) => <article key={item.id}><div><em>{archiveItemKind(item).replace('-', ' ')}</em><strong>{item.name}</strong><small>{String(item.dna.semantics?.role ?? 'unknown')} · used {Number(item.metadata?.useCount ?? item.usageNodeIds.length)} times</small></div><button type="button" disabled={archiveItemKind(item) === 'component' && !item.snapshot?.html} onClick={() => useArchiveItem(item)}>{archiveItemKind(item) === 'component' ? 'Insert' : 'Apply'}</button><button type="button" onClick={() => removeArchive(item.id)}>Remove</button></article>)}</div>{!archiveItems.length && <p>No saved artifacts match this view. Right-click any selected element to add one.</p>}</section>}
        {tab === 'archaeology' && <section><h3>Design Archaeology</h3>{archaeology ? <><dl><dt>Creation</dt><dd>{archaeology.creation ? `${archaeology.creation.actorId} · ${archaeology.creation.branchId}` : 'Unknown — no recorded creation event'}</dd><dt>Branch lineage</dt><dd>{archaeology.branchLineage.join(' → ')}</dd><dt>Authors</dt><dd>{archaeology.authors.join(', ') || 'Unknown'}</dd><dt>Checkpoint ancestry</dt><dd>{archaeology.checkpointLineage.map((checkpoint) => checkpoint.label ?? checkpoint.id).join(' ← ') || 'No recorded checkpoints'}</dd><dt>Derived from</dt><dd>{archaeology.derivedFrom.join(', ') || 'No recorded origin'}</dd></dl><div className="froam-intelligence__list">{archaeology.edits.slice().reverse().map((edit) => <article key={edit.eventId}><div><strong>{edit.label}</strong><small>{edit.actorId} · {edit.branchId}</small>{edit.rationale && <em>Recorded reason: {edit.rationale.text}</em>}</div></article>)}</div></> : <p>Select a node to trace recorded origins. Froam never invents rationale.</p>}</section>}
        {tab === 'flow' && <section><h3>Product Flow</h3><div className="froam-intelligence__grid"><input value={flowName} onChange={(event) => setFlowName(event.target.value)} placeholder="Flow name" /><input value={flowNodeName} onChange={(event) => setFlowNodeName(event.target.value)} placeholder="Screen name" /><input value={flowRoute} onChange={(event) => setFlowRoute(event.target.value)} placeholder="Route, e.g. /checkout" /><button type="button" onClick={addFlowNode}>Add screen</button></div><div className="froam-intelligence__flow">{flowNodes.map((node, index) => <div key={node.id}><button type="button" onClick={() => node.locator?.routeKey ? window.location.assign(node.locator.routeKey) : props.onSelectNode(node.id, node.locator?.path)}>{node.name}<small>{node.locator?.routeKey ?? node.kind}</small></button>{index < flowNodes.length - 1 && <button className="froam-intelligence__edge" type="button" onClick={() => connectFlow(node.id, flowNodes[index + 1].id)}>→ connect</button>}</div>)}</div></section>}
        {tab === 'attention' && <section><h3>Predicted Attention</h3><p>Local heuristic estimate—not eye tracking or scientific measurement.</p><button type="button" className="is-primary" onClick={runAttention} disabled={!latestScans.length}>Analyze attention</button><label><input type="checkbox" checked={attentionOverlay} onChange={(event) => setAttentionOverlay(event.target.checked)} /> Heat overlay</label><ol>{ranking.slice(0, 12).map((item) => <li key={item.nodeId} onClick={() => props.onSelectNode(item.nodeId)}><b>{item.score}</b><span>{item.role}</span><small>{item.reasons.join(', ')}</small></li>)}</ol>{((latestAttention?.result.warnings ?? []) as string[]).map((warning) => <aside className="froam-intelligence__warning" key={warning}>{warning}</aside>)}</section>}
        {tab === 'rhythm' && <section><h3>Visual Rhythm</h3><button type="button" className="is-primary" onClick={runRhythm} disabled={!latestScans.length}>Analyze page rhythm</button>{rhythm && <><div className="froam-intelligence__rhythm">{((rhythm.result.sections ?? []) as Array<{ height: number }>).map((item, index) => <i key={index} style={{ height: Math.max(8, Math.min(70, item.height / 8)) }} />)}</div>{((rhythm.result.warnings ?? []) as string[]).map((warning) => <aside className="froam-intelligence__warning" key={warning}>{warning}</aside>)}<small>Confidence {Math.round((rhythm.confidence ?? 0) * 100)}%</small></>}</section>}
        {tab === 'responsive' && <section><h3>Priority Responsive</h3>{props.selection?.nodeId ? <div className="froam-intelligence__grid"><label>Priority<select value={selectedPolicy?.priority ?? 'medium'} onChange={(event) => updatePolicy({ priority: event.target.value as FroamResponsivePolicy['priority'] })}>{['critical','high','medium','low','decorative'].map((value) => <option key={value}>{value}</option>)}</select></label>{(['canHide','canCollapse','canWrap','canTruncate','canCrop','canReposition'] as const).map((key) => <label key={key}><input type="checkbox" checked={selectedPolicy?.[key] ?? defaultResponsivePolicy('', props.actorId)[key]} onChange={(event) => updatePolicy({ [key]: event.target.checked })} /> {key.replace('can','Can ')}</label>)}<label>Minimum useful width<input type="number" value={selectedPolicy?.minimumUsefulWidth ?? ''} onChange={(event) => updatePolicy({ minimumUsefulWidth: Number(event.target.value) || undefined })} /></label></div> : <p>Select a node to set survival metadata.</p>}<h3>Breakpoint Cinema</h3><div className="froam-intelligence__row"><button type="button" onClick={() => setCinemaPlaying((value) => !value)}>{cinemaPlaying ? <Pause size={13} /> : <Play size={13} />}</button><input type="range" min="320" max="1440" value={cinemaWidth} onChange={(event) => setCinemaWidth(Number(event.target.value))} /><b>{cinemaWidth}px</b><select value={cinemaSpeed} onChange={(event) => setCinemaSpeed(Number(event.target.value))}>{[1,2,4].map((speed) => <option key={speed} value={speed}>{speed}x</option>)}</select></div><div className="froam-intelligence__markers">{cinemaObservations.filter((item) => item.markers.length).map((item) => <button type="button" key={item.width} onClick={() => setCinemaWidth(item.width)}><b>{item.width}px</b>{item.markers.join(' · ')}</button>)}</div>{suggestions.map((suggestion) => <aside key={`${suggestion.nodeId}:${suggestion.action}`}><b>{suggestion.action}</b> {suggestion.reason}</aside>)}</section>}
        {tab === 'screenshot' && <section><h3>Observe → Understand → Validate</h3><p>Experimental local reconstruction extracts observable regions and available browser OCR, creates normal Froam/DNA nodes, renders them, then reports an equal-size RGB difference. It does not recover original source code.</p><button type="button" className="is-primary" onClick={() => screenshotInput.current?.click()} disabled={screenshotBusy}>{screenshotBusy ? 'Reconstructing and validating…' : 'Import screenshot'}</button><input ref={screenshotInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importScreenshot(file); event.target.value = '' }} />{lastReconstruction && <><dl><dt>OCR</dt><dd>{lastReconstruction.ocr[0]?.available ? `${lastReconstruction.ocr[0].lines.length} detected lines` : 'Unavailable — text remains unknown'}</dd><dt>References</dt><dd>{lastReconstruction.references.length} · multi-reference model</dd><dt>Similarity</dt><dd>{(lastReconstruction.analysis.result.validation as { comparable?: boolean; pixelSimilarity?: number } | null)?.comparable ? `${Math.round(((lastReconstruction.analysis.result.validation as { pixelSimilarity: number }).pixelSimilarity) * 100)}% normalized RGB agreement` : 'Capture not comparable'}</dd><dt>Largest mismatches</dt><dd>{((lastReconstruction.analysis.result.validation as { largestMismatches?: unknown[] } | null)?.largestMismatches?.length ?? 0)} measured tiles</dd></dl><small>Similarity is a transparent pixel-error metric, not a claim of perceptual or source equivalence.</small></>}<dl><dt>Provider</dt><dd>froam-local-reconstruction-v2</dd><dt>Data boundary</dt><dd>Pixels stay in this browser. No source, credentials or image data is uploaded.</dd></dl></section>}
      </main>
    </aside>
    {attentionOverlay && <div className="froam-attention-overlay" data-chef-editor-root="true">{ranking.slice(0, 12).map((item) => { const element = props.root?.querySelector<HTMLElement>(`[data-froam-id="${CSS.escape(item.nodeId)}"]`); const rect = element?.getBoundingClientRect(); return rect ? <i key={item.nodeId} style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, opacity: Math.max(.12, item.score / 125) }}><b>{item.rank}</b></i> : null })}</div>}
  </>
}
