import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, ChevronRight, FileImage, Plus, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react'
import { requestFroamIntelligence } from '../project/bridge'
import { analyzeReferenceReconstructions, createReferenceIntelligenceRequest, createResponsiveIntelligenceRequest, type FroamReference, type FroamReferenceUnderstanding } from '../project/reference-intelligence'
import { localScreenshotProvider, type FroamScreenshotReconstruction } from '../project/screenshot-reconstruction'
import type { FroamAnalysisFinding } from '../project/intelligence-transport'
import type { FroamProjectDocument } from '../project/types'
import { FROAM_REFERENCE_ACCEPTED_TYPES, readReferenceConsent, referenceQualityRows, suggestReferenceLabel, validateReferenceDimensions, validateReferenceFile, writeReferenceConsent, type FroamReferenceConsent } from './reference-workspace-model'

type ReferenceItem = { reference: FroamReference; reconstruction: FroamScreenshotReconstruction; previewUrl: string; fileName: string }
type Props = {
  project: FroamProjectDocument
  routeKey: string
  onToast: (message: string) => void
  onActivityChange?: (activity: 'screenshot' | null) => void
}

const progressSteps = ['Reading references…', 'Matching interface structure…', 'Comparing viewport behavior…', 'Building responsive understanding…'] as const
function safeId(value: string) { return value.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 64) || 'reference' }
function findingEvidence(finding: FroamAnalysisFinding) { return finding.evidence?.filter((item) => item.origin === 'observed' || item.origin === 'inferred') ?? [] }
async function thumbnailUrl(bitmap: ImageBitmap) {
  const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d'); if (!context) throw new Error('Preview decoding is unavailable'); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .72)); canvas.width = 0; canvas.height = 0
  if (!blob) throw new Error('Preview decoding is unavailable')
  return URL.createObjectURL(blob)
}

export default function FroamReferenceWorkspace(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef(new Set<string>())
  const cancelledRef = useRef(false)
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [dropActive, setDropActive] = useState(false)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const [consent, setConsent] = useState<FroamReferenceConsent>(() => readReferenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage))
  const [consentPrompt, setConsentPrompt] = useState(false)
  const [insightBusy, setInsightBusy] = useState(false)
  const [insights, setInsights] = useState<FroamAnalysisFinding[]>([])
  const [providerMessage, setProviderMessage] = useState('')

  useEffect(() => () => { for (const url of urlsRef.current) URL.revokeObjectURL(url); urlsRef.current.clear(); cancelledRef.current = true }, [])

  const understanding = useMemo<FroamReferenceUnderstanding | null>(() => {
    if (!items.length) return null
    try { return analyzeReferenceReconstructions({ schemaVersion: 1, id: `reference-set:${props.project.id}`, label: 'Project references', references: items.map((item) => item.reference) }, items.map((item) => item.reconstruction)) } catch { return null }
  }, [items, props.project.id])
  const ordered = useMemo(() => [...items].sort((a, b) => a.reference.viewport.width - b.reference.viewport.width || a.reference.id.localeCompare(b.reference.id)), [items])
  const selected = ordered.find((item) => item.reference.id === selectedId) ?? ordered[0]

  async function decodeFile(file: File, index: number): Promise<ReferenceItem> {
    const fileValidation = validateReferenceFile(file)
    if (!fileValidation.valid) throw new Error(fileValidation.reason)
    const bitmap = await createImageBitmap(file)
    try {
      const dimensions = validateReferenceDimensions(bitmap.width, bitmap.height)
      if (!dimensions.valid) throw new Error(dimensions.reason)
      if (cancelledRef.current) throw new Error('Reference import cancelled')
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas decoding is unavailable')
      context.drawImage(bitmap, 0, 0)
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height)
      const id = `reference:${Date.now().toString(36)}:${index}:${safeId(file.name)}`
      const label = suggestReferenceLabel(bitmap.width)
      const reconstruction = await localScreenshotProvider.reconstruct({ width: bitmap.width, height: bitmap.height, data: pixels.data, mimeType: file.type, name: file.name, referenceId: id, metadata: { viewportWidth: bitmap.width, viewportHeight: bitmap.height, route: props.routeKey, label } })
      canvas.width = 0; canvas.height = 0
      const previewUrl = await thumbnailUrl(bitmap); urlsRef.current.add(previewUrl)
      return { reference: { id, source: 'screenshot', viewport: { width: bitmap.width, height: bitmap.height }, route: props.routeKey, label, media: { id: `browser-file:${safeId(file.name)}:${file.size}`, mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp', width: bitmap.width, height: bitmap.height } }, reconstruction, previewUrl, fileName: file.name }
    } finally { bitmap.close() }
  }

  async function addFiles(files: File[]) {
    if (!files.length || processing) return
    cancelledRef.current = false; setProcessing(true); setInsights([]); setProviderMessage(''); props.onActivityChange?.('screenshot')
    try {
      setProgress(progressSteps[0])
      const accepted: ReferenceItem[] = []; const errors: string[] = []
      for (let index = 0; index < files.length; index += 1) {
        if (cancelledRef.current) break
        try { accepted.push(await decodeFile(files[index], index)) } catch (error) { errors.push(`${files[index].name}: ${error instanceof Error ? error.message : 'Could not read screenshot'}`) }
      }
      if (cancelledRef.current) { for (const item of accepted) { URL.revokeObjectURL(item.previewUrl); urlsRef.current.delete(item.previewUrl) }; setProgress('Import cancelled'); return }
      if (!accepted.length) throw new Error(errors[0] ?? 'No valid screenshots were selected')
      setProgress(progressSteps[1]); await Promise.resolve()
      setProgress(progressSteps[2]); await Promise.resolve()
      setItems((current) => [...current, ...accepted]); setSelectedId((current) => current ?? accepted[0].reference.id)
      setProgress(progressSteps[3]); await Promise.resolve(); setProgress('Ready')
      props.onToast(`Reference understood ${accepted.length} screenshot${accepted.length === 1 ? '' : 's'}${errors.length ? ` · ${errors.length} skipped` : ''}`)
    } catch (error) { setProgress(''); props.onToast(error instanceof Error ? error.message : 'Reference reconstruction failed') }
    finally { setProcessing(false); props.onActivityChange?.(null) }
  }

  function updateReference(id: string, patch: Partial<Pick<FroamReference, 'label' | 'route' | 'state' | 'viewport'>>) {
    setItems((current) => current.map((item) => {
      if (item.reference.id !== id) return item
      const reference = { ...item.reference, ...patch }
      const reconstruction = patch.viewport ? { ...item.reconstruction, references: item.reconstruction.references.map((entry, index) => index ? entry : { ...entry, width: patch.viewport!.width, height: patch.viewport!.height, metadata: { ...entry.metadata, viewportWidth: patch.viewport!.width, viewportHeight: patch.viewport!.height } }) } : item.reconstruction
      return { ...item, reference, reconstruction }
    }))
  }

  function removeReference(id: string) {
    const item = items.find((candidate) => candidate.reference.id === id); if (item) { URL.revokeObjectURL(item.previewUrl); urlsRef.current.delete(item.previewUrl) }
    setItems((current) => current.filter((candidate) => candidate.reference.id !== id)); setSelectedId((current) => current === id ? null : current); setInsights([]); setProviderMessage('')
  }

  async function runInsights(consentOverride = false) {
    if (!understanding || insightBusy) return
    if (consent !== 'allowed' && !consentOverride) { setConsentPrompt(true); return }
    setInsightBusy(true); setProviderMessage(''); setInsights([])
    try {
      const input = { projectId: props.project.id, activeBranchId: props.project.activeBranchId, routeKey: props.routeKey, intent: 'Interpret the supplied reference evidence. Ground every finding in the provided observations and state uncertainty.', consent: true }
      const requests = [createReferenceIntelligenceRequest(understanding, input), ...(understanding.referenceSet.references.length >= 2 ? [createResponsiveIntelligenceRequest(understanding, { ...input, intent: 'Interpret only the supplied responsive evidence and bounded transition intervals.' })] : [])]
      const findings: FroamAnalysisFinding[] = []
      for (const request of requests) {
        const response = await requestFroamIntelligence(request)
        if ('configured' in response && response.configured === false) { setProviderMessage('Optional interpretation is not configured. Deterministic Reference results remain available.'); return }
        if ('findings' in response) findings.push(...response.findings.filter((finding) => findingEvidence(finding).length > 0))
      }
      setInsights(findings.slice(0, 12)); setProviderMessage(findings.length ? '' : 'No additional evidence-grounded insights were returned.')
    } catch { setProviderMessage('Optional interpretation is unavailable. Deterministic Reference results remain available.') }
    finally { setInsightBusy(false) }
  }

  function allowInsights() { setConsent('allowed'); writeReferenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'allowed'); setConsentPrompt(false); void runInsights(true) }
  function declineInsights() { setConsent('declined'); writeReferenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'declined'); setConsentPrompt(false) }

  return <section className={`froam-reference ${dropActive ? 'is-drop-active' : ''}`} aria-label="Reference workspace" onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false) }} onDrop={(event: DragEvent) => { event.preventDefault(); setDropActive(false); void addFiles([...event.dataTransfer.files]) }}>
    <header className="froam-reference__header"><div><span>Reference</span><strong>Bring an interface into Froam.</strong></div>{items.length > 0 && <div className="froam-reference__header-actions">{!processing && progress === 'Ready' && <span className="froam-reference__ready" role="status" aria-live="polite">Ready</span>}<button type="button" onClick={() => inputRef.current?.click()}><Plus size={14}/> Add</button></div>}</header>
    <input ref={inputRef} hidden multiple type="file" accept={FROAM_REFERENCE_ACCEPTED_TYPES.join(',')} onChange={(event) => { void addFiles([...event.target.files ?? []]); event.target.value = '' }}/>
    {!items.length && !processing && <button type="button" className={`froam-reference__drop ${dropActive ? 'is-active' : ''}`} onClick={() => inputRef.current?.click()} aria-label="Add screenshot references">
      <Upload size={22}/><strong>Add screenshots</strong><span>PNG, JPEG or WebP</span><small>Desktop, tablet and mobile views help Froam understand how the design responds.</small>
    </button>}
    {processing && <div className="froam-reference__processing"><RefreshCw size={18}/><strong>{progress}</strong><span role="status" aria-live="polite" aria-atomic="true">{progress}</span><button type="button" onClick={() => { cancelledRef.current = true }}>Cancel</button></div>}
    {items.length > 0 && <>
      <div className="froam-reference__cards" aria-label="Screenshot references">{ordered.map((item) => <article key={item.reference.id} className={selected?.reference.id === item.reference.id ? 'is-selected' : ''}>
        <button type="button" className="froam-reference__card-main" onClick={() => setSelectedId(item.reference.id)} aria-label={`Inspect ${item.reference.label ?? item.fileName}`}><img src={item.previewUrl} alt=""/><span><strong>{item.reference.label ?? item.fileName}</strong><small>{item.reference.viewport.width} × {item.reference.viewport.height}</small><em>✓ reconstructed</em></span></button>
        <button type="button" className="froam-reference__remove" onClick={() => removeReference(item.reference.id)} aria-label={`Remove ${item.reference.label ?? item.fileName}`}><Trash2 size={13}/></button>
      </article>)}</div>
      {selected && <details className="froam-reference__metadata"><summary>Edit reference details</summary><div>
        <label>Label<input value={selected.reference.label ?? ''} onChange={(event) => updateReference(selected.reference.id, { label: event.target.value })}/></label>
        <label>Route<input value={selected.reference.route ?? ''} onChange={(event) => updateReference(selected.reference.id, { route: event.target.value || undefined })}/></label>
        <label>State<input value={selected.reference.state?.key ?? ''} onChange={(event) => updateReference(selected.reference.id, { state: event.target.value ? { key: event.target.value } : undefined })}/></label>
        <label>Width<input type="number" min="16" value={selected.reference.viewport.width} onChange={(event) => updateReference(selected.reference.id, { viewport: { ...selected.reference.viewport, width: Math.max(16, Number(event.target.value) || 16) } })}/></label>
        <label>Height<input type="number" min="16" value={selected.reference.viewport.height} onChange={(event) => updateReference(selected.reference.id, { viewport: { ...selected.reference.viewport, height: Math.max(16, Number(event.target.value) || 16) } })}/></label>
      </div></details>}
      {understanding && <ReferenceResults understanding={understanding} selectedId={selected?.reference.id ?? null} expandedEvidence={expandedEvidence} onExpandedEvidence={setExpandedEvidence}/>} 
      {understanding && <section className="froam-reference__insights"><header><div><Sparkles size={14}/><strong>Froam noticed</strong></div><button type="button" disabled={insightBusy} onClick={() => void runInsights()}>{insightBusy ? 'Interpreting…' : insights.length ? 'Refresh' : 'Interpret evidence'}</button></header>
        {consentPrompt && <aside className="froam-reference__consent"><p>Froam can use the configured intelligence provider to interpret this reference.</p><small>It sends bounded interface observations, not your source code, credentials or raw screenshots.</small><div><button type="button" onClick={allowInsights}>Allow</button><button type="button" onClick={declineInsights}>Not now</button></div></aside>}
        {insights.map((finding, index) => <article key={finding.id ?? index}><strong>{finding.summary}</strong>{finding.detail && <p>{finding.detail}</p>}<details><summary>{findingEvidence(finding).length} evidence item{findingEvidence(finding).length === 1 ? '' : 's'}</summary>{findingEvidence(finding).map((evidence, evidenceIndex) => <small key={evidenceIndex}><b>{evidence.origin}</b>{evidence.summary}</small>)}</details></article>)}
        {providerMessage && <p className="froam-reference__provider-message">{providerMessage}</p>}
      </section>}
    </>}
  </section>
}

function ReferenceResults(props: { understanding: FroamReferenceUnderstanding; selectedId: string | null; expandedEvidence: string | null; onExpandedEvidence: (id: string | null) => void }) {
  const signature = props.understanding.responsiveSignature
  const selectedObservations = signature.observations.filter((item) => !props.selectedId || item.referenceIds.includes(props.selectedId))
  return <div className="froam-reference__results">
    <section className="froam-reference__viewport-strip" aria-label="Observed viewport references">{signature.observedWidths.map((width, index) => <span key={`${width}:${index}`}><b>{width}</b><i/></span>)}</section>
    <section className="froam-reference__quality"><h3>Reference understanding</h3>{referenceQualityRows(props.understanding.quality).map(([name, value]) => <div key={name}><span>{name}</span><strong data-tone={value.tone}>{value.label}</strong><small>{value.detail}</small></div>)}</section>
    <section className="froam-reference__evidence"><h3>Responsive understanding</h3>{signature.observedWidths.length < 2 && <p>One reference provides structural evidence, but not responsive certainty.</p>}
      {selectedObservations.slice(0, 8).map((item) => <article key={item.id}><em data-origin="observed">Observed</em><strong>{item.width}px · {item.summary}</strong><button type="button" onClick={() => props.onExpandedEvidence(props.expandedEvidence === item.id ? null : item.id)}>{props.expandedEvidence === item.id ? <ChevronDown size={13}/> : <ChevronRight size={13}/>} Show evidence</button>{props.expandedEvidence === item.id && <small>{item.regionIds?.length ? `${item.regionIds.length} reconstructed regions support this observation.` : 'Measured from the reconstructed viewport geometry.'}</small>}</article>)}
      {signature.hypotheses.slice(0, 8).map((item) => <article key={item.id}><em data-origin="inferred">Inferred</em><strong>{item.summary}</strong>{item.betweenWidths && <small>Bounded between {item.betweenWidths[0]}px and {item.betweenWidths[1]}px — not an exact CSS breakpoint.</small>}<button type="button" onClick={() => props.onExpandedEvidence(props.expandedEvidence === item.id ? null : item.id)}>{props.expandedEvidence === item.id ? <ChevronDown size={13}/> : <ChevronRight size={13}/>} {item.evidenceIds.length} evidence item{item.evidenceIds.length === 1 ? '' : 's'}</button>{props.expandedEvidence === item.id && <small>{item.evidenceIds.join(' · ') || 'Inferred from adjacent unmatched or changed regions.'}</small>}</article>)}
    </section>
    <footer><FileImage size={13}/> Local reconstruction remains available without a configured intelligence provider.</footer>
  </div>
}
