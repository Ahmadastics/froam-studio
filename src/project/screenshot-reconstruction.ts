import type { FroamAnalysis, FroamDNA, FroamNode, FroamRelation } from './types'

export type FroamScreenshotReferenceMeta = { viewportWidth?: number; viewportHeight?: number; state?: string; route?: string; label?: string }
export type FroamScreenshotPixels = { width: number; height: number; data: Uint8ClampedArray; mimeType: string; name?: string; referenceId?: string; metadata?: FroamScreenshotReferenceMeta }
export type FroamScreenshotReferenceSet = { references: FroamScreenshotPixels[]; primaryReferenceId?: string }
export type FroamOcrLine = { id: string; text?: string; bounds: { x: number; y: number; width: number; height: number }; confidence: number; uncertain?: boolean; lineBreakAfter?: boolean }
export type FroamOcrResult = { provider: string; available: boolean; lines: FroamOcrLine[]; warnings: string[] }
export interface FroamOcrProvider { id: string; local: boolean; available(): boolean; recognize(reference: FroamScreenshotPixels): Promise<FroamOcrResult> }

export type FroamScreenshotRegion = {
  id: string; nodeId: string; x: number; y: number; width: number; height: number
  kind: 'text' | 'image' | 'container'; confidence: number; averageColor?: string
  text?: string; textConfidence?: number; semanticRole?: 'heading' | 'paragraph' | 'label' | 'button' | 'unknown'
  componentFamilyId?: string
}
export type FroamPixelMismatch = { x: number; y: number; width: number; height: number; meanError: number; category: 'color-or-image' }
export type FroamVisualDiff = { metric: 'normalized-rgb-mae-v1'; comparable: boolean; pixelSimilarity?: number; meanAbsoluteError?: number; largestMismatches: FroamPixelMismatch[]; disclaimer: string }
export type FroamCorrectionPass = { pass: number; category: 'geometry'; changedRegionIds: string[]; remainingGeometryError: number }
export type FroamScreenshotReconstruction = {
  analysis: FroamAnalysis; nodes: FroamNode[]; relations: FroamRelation[]; dna: FroamDNA[]; regions: FroamScreenshotRegion[]
  rootNodeId: string; references: Array<{ id: string; metadata?: FroamScreenshotReferenceMeta; width: number; height: number }>; ocr: FroamOcrResult[]; correctionPasses: FroamCorrectionPass[]
}

export interface FroamScreenshotProvider {
  id: string; local: boolean
  reconstruct(input: FroamScreenshotPixels | FroamScreenshotReferenceSet): Promise<FroamScreenshotReconstruction>
}

function referencesOf(input: FroamScreenshotPixels | FroamScreenshotReferenceSet) { return 'references' in input ? input.references : [input] }
function validate(input: FroamScreenshotPixels) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.mimeType)) throw new Error(`Unsupported screenshot type: ${input.mimeType}`)
  if (input.width < 16 || input.height < 16 || input.data.length !== input.width * input.height * 4) throw new Error('Invalid decoded screenshot pixels')
  if (input.width * input.height > 20_000_000) throw new Error('Screenshot is too large for local reconstruction')
}
function luminance(data: Uint8ClampedArray, offset: number) { return data[offset] * .2126 + data[offset + 1] * .7152 + data[offset + 2] * .0722 }
function safeId(value: string) { return value.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 80) || 'reference' }
function averageColor(input: FroamScreenshotPixels, x: number, y: number, width: number, height: number) {
  const step = Math.max(1, Math.floor(Math.max(width, height) / 32)); let r = 0; let g = 0; let b = 0; let count = 0
  for (let py = y; py < Math.min(input.height, y + height); py += step) for (let px = x; px < Math.min(input.width, x + width); px += step) { const at = (py * input.width + px) * 4; r += input.data[at]; g += input.data[at + 1]; b += input.data[at + 2]; count += 1 }
  return `rgb(${Math.round(r / Math.max(1, count))},${Math.round(g / Math.max(1, count))},${Math.round(b / Math.max(1, count))})`
}
function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y }
function inferTextRole(line: FroamOcrLine, viewportHeight: number): FroamScreenshotRegion['semanticRole'] {
  if (!line.text || line.confidence < .45) return 'unknown'
  if (line.bounds.width < 240 && line.bounds.height >= 24 && line.bounds.height <= 64 && /^(buy|start|continue|submit|sign up|join|checkout|save|next|book|contact)\b/i.test(line.text)) return 'button'
  if (line.bounds.height >= 28 && line.bounds.y < viewportHeight * .55) return 'heading'
  if (line.bounds.width < 220 && line.bounds.height < 48 && line.text.length < 32) return 'label'
  return 'paragraph'
}

function luminanceVariance(input: FroamScreenshotPixels, y: number, height: number) {
  const step = Math.max(2, Math.floor(input.width / 64)); const values: number[] = []
  for (let py = y; py < Math.min(input.height, y + height); py += step) for (let px = 0; px < input.width; px += step) values.push(luminance(input.data, (py * input.width + px) * 4))
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length)
}

function segment(reference: FroamScreenshotPixels, ocr: FroamOcrResult, prefix: string): FroamScreenshotRegion[] {
  const sampleStep = Math.max(1, Math.floor(reference.width / 128)); const rowEnergy: number[] = []
  for (let y = 1; y < reference.height; y += 1) { let energy = 0; let count = 0; for (let x = 0; x < reference.width; x += sampleStep) { const here = (y * reference.width + x) * 4; const before = ((y - 1) * reference.width + x) * 4; energy += Math.abs(luminance(reference.data, here) - luminance(reference.data, before)); count += 1 } rowEnergy[y] = energy / Math.max(1, count) }
  const mean = rowEnergy.reduce((sum, value = 0) => sum + value, 0) / Math.max(1, rowEnergy.length)
  const threshold = Math.max(18, mean * 2.2)
  const cuts = [0, ...rowEnergy.map((value, index) => value > threshold ? index : -1).filter((value) => value > 0 && value < reference.height - 8).filter((value, index, all) => index === 0 || value - all[index - 1] > 24), reference.height]
  const regions: FroamScreenshotRegion[] = []
  for (let index = 0; index < cuts.length - 1; index += 1) { const y = cuts[index]; const height = cuts[index + 1] - y; if (height < 16) continue; const id = `${prefix}:region-${index}`; const variance = luminanceVariance(reference, y, height); regions.push({ id, nodeId: `screenshot:${id}`, x: 0, y, width: reference.width, height, kind: height < 100 && !ocr.lines.some((line) => intersects({ x: 0, y, width: reference.width, height }, line.bounds)) ? 'text' : variance > 900 ? 'image' : 'container', confidence: variance > 900 ? .58 : .42, averageColor: averageColor(reference, 0, y, reference.width, height), semanticRole: 'unknown' }) }
  for (const line of ocr.lines) { const id = `${prefix}:ocr-${safeId(line.id)}`; regions.push({ id, nodeId: `screenshot:${id}`, ...line.bounds, kind: 'text', confidence: line.confidence, text: line.text, textConfidence: line.confidence, semanticRole: inferTextRole(line, reference.height), averageColor: averageColor(reference, line.bounds.x, line.bounds.y, line.bounds.width, line.bounds.height) }) }
  if (!regions.length) regions.push({ id: `${prefix}:region-0`, nodeId: `screenshot:${prefix}:region-0`, x: 0, y: 0, width: reference.width, height: reference.height, kind: 'container', confidence: .3, averageColor: averageColor(reference, 0, 0, reference.width, reference.height), semanticRole: 'unknown' })
  const groups = new Map<string, FroamScreenshotRegion[]>()
  for (const region of regions) { const key = `${region.kind}:${Math.round(region.width / 24)}:${Math.round(region.height / 24)}:${region.semanticRole ?? 'unknown'}`; groups.set(key, [...(groups.get(key) ?? []), region]) }
  for (const [key, family] of groups) if (family.length >= 3) for (const region of family) region.componentFamilyId = `family:${safeId(key)}`
  return regions.sort((a, b) => a.y - b.y || a.x - b.x)
}

type TextDetectorLike = new () => { detect(source: ImageData): Promise<Array<{ rawValue?: string; boundingBox?: DOMRectReadOnly; cornerPoints?: Array<{ x: number; y: number }> }>> }
export const browserTextDetectorOcrProvider: FroamOcrProvider = {
  id: 'browser-text-detector-v1', local: true,
  available: () => typeof ImageData !== 'undefined' && typeof (globalThis as { TextDetector?: TextDetectorLike }).TextDetector === 'function',
  async recognize(reference) {
    const Detector = (globalThis as { TextDetector?: TextDetectorLike }).TextDetector
    if (!Detector || typeof ImageData === 'undefined') return { provider: this.id, available: false, lines: [], warnings: ['Local browser OCR is unavailable; no text was fabricated.'] }
    try { const detections = await new Detector().detect(new ImageData(new Uint8ClampedArray(reference.data), reference.width, reference.height)); const lines = detections.map((item, index) => { const box = item.boundingBox; const text = item.rawValue?.trim(); return { id: `line-${index}`, text: text || undefined, bounds: { x: box?.x ?? 0, y: box?.y ?? 0, width: box?.width ?? 1, height: box?.height ?? 1 }, confidence: text ? .7 : .2, uncertain: !text } }); return { provider: this.id, available: true, lines, warnings: [] } }
    catch { return { provider: this.id, available: true, lines: [], warnings: ['OCR failed; reconstructed text remains explicitly unknown.'] } }
  },
}

export const unavailableOcrProvider: FroamOcrProvider = { id: 'ocr-unavailable', local: true, available: () => false, async recognize() { return { provider: this.id, available: false, lines: [], warnings: ['No local OCR provider is available; no text was fabricated.'] } } }

export function compareScreenshotPixels(reference: FroamScreenshotPixels, candidate: FroamScreenshotPixels, tileSize = 64): FroamVisualDiff {
  if (reference.width !== candidate.width || reference.height !== candidate.height || reference.data.length !== candidate.data.length) return { metric: 'normalized-rgb-mae-v1', comparable: false, largestMismatches: [], disclaimer: 'Pixel similarity requires captures with identical dimensions.' }
  let total = 0; let channels = 0; const tiles: FroamPixelMismatch[] = []
  for (let ty = 0; ty < reference.height; ty += tileSize) for (let tx = 0; tx < reference.width; tx += tileSize) { let error = 0; let count = 0; const h = Math.min(tileSize, reference.height - ty); const w = Math.min(tileSize, reference.width - tx); for (let y = ty; y < ty + h; y += 1) for (let x = tx; x < tx + w; x += 1) { const at = (y * reference.width + x) * 4; for (let c = 0; c < 3; c += 1) { const delta = Math.abs(reference.data[at + c] - candidate.data[at + c]); total += delta; error += delta; channels += 1; count += 1 } } tiles.push({ x: tx, y: ty, width: w, height: h, meanError: error / Math.max(1, count), category: 'color-or-image' }) }
  const mae = total / Math.max(1, channels); return { metric: 'normalized-rgb-mae-v1', comparable: true, meanAbsoluteError: mae, pixelSimilarity: Math.max(0, 1 - mae / 255), largestMismatches: tiles.filter((tile) => tile.meanError > 4).sort((a, b) => b.meanError - a.meanError).slice(0, 8), disclaimer: 'Similarity is normalized RGB mean absolute error at equal dimensions; it is not source-code or perceptual equivalence.' }
}

export function applyVisualDiff(reconstruction: FroamScreenshotReconstruction, diff: FroamVisualDiff): FroamScreenshotReconstruction { return { ...reconstruction, analysis: { ...reconstruction.analysis, result: { ...reconstruction.analysis.result, validation: diff } } } }

export function boundedGeometryCorrection(regions: readonly FroamScreenshotRegion[], targets: readonly Pick<FroamScreenshotRegion, 'id' | 'x' | 'y' | 'width' | 'height'>[], maxPasses = 4) {
  const limit = Math.max(0, Math.min(4, Math.floor(maxPasses))); let current = regions.map((region) => ({ ...region })); const passes: FroamCorrectionPass[] = []
  for (let pass = 1; pass <= limit; pass += 1) { const changed: string[] = []; let error = 0; current = current.map((region, index) => { const target = targets.find((item) => item.id === region.id) ?? targets[index]; if (!target) return region; const delta = Math.abs(region.x - target.x) + Math.abs(region.y - target.y) + Math.abs(region.width - target.width) + Math.abs(region.height - target.height); error += delta; if (delta < 1) return region; changed.push(region.id); return { ...region, x: (region.x + target.x) / 2, y: (region.y + target.y) / 2, width: (region.width + target.width) / 2, height: (region.height + target.height) / 2 } }); passes.push({ pass, category: 'geometry', changedRegionIds: changed, remainingGeometryError: error }); if (!changed.length) break }
  return { regions: current, passes }
}

export function createLocalScreenshotProvider(ocrProvider: FroamOcrProvider = browserTextDetectorOcrProvider): FroamScreenshotProvider {
  return { id: 'froam-local-reconstruction-v2', local: true, async reconstruct(input) {
    const references = referencesOf(input); if (!references.length) throw new Error('At least one screenshot reference is required'); references.forEach(validate)
    const primaryId = 'references' in input ? input.primaryReferenceId : input.referenceId; const primary = references.find((item) => item.referenceId === primaryId) ?? references[0]
    const ocrResults = await Promise.all(references.map((reference) => ocrProvider.recognize(reference)))
    const prefix = safeId(primary.referenceId ?? primary.name ?? 'primary'); const regions = segment(primary, ocrResults[references.indexOf(primary)], prefix)
    const rootNodeId = `screenshot-root:${prefix}`; const nodes: FroamNode[] = [{ id: rootNodeId, kind: 'frame', name: primary.name ?? 'Screenshot reconstruction', source: 'imported', metadata: { width: primary.width, height: primary.height, references: references.map((item) => ({ id: item.referenceId, metadata: item.metadata })) } }]
    const relations: FroamRelation[] = []; const dna: FroamDNA[] = []; const now = Date.now()
    for (const familyId of new Set(regions.map((region) => region.componentFamilyId).filter((id): id is string => Boolean(id)))) nodes.push({ id: familyId, kind: 'component-definition', name: 'Reconstructed repeated component', source: 'imported', metadata: { inferred: true } })
    for (const region of regions) { nodes.push({ id: region.nodeId, kind: 'element', name: region.text || region.semanticRole || region.kind, parentId: rootNodeId, source: 'imported', metadata: { reconstructionRegion: region, componentFamilyId: region.componentFamilyId } }); relations.push({ id: `contains:${rootNodeId}:${region.nodeId}`, kind: 'contains', from: rootNodeId, to: region.nodeId }); if (region.componentFamilyId) relations.push({ id: `belongs:${region.nodeId}:${region.componentFamilyId}`, kind: 'belongs-to', from: region.nodeId, to: region.componentFamilyId }); dna.push({ schemaVersion: 1, nodeId: region.nodeId, capturedAt: now, identity: { source: 'screenshot', stable: true }, structure: { parentId: rootNodeId, componentFamilyId: region.componentFamilyId }, layout: { position: 'absolute', x: region.x, y: region.y, width: region.width, height: region.height }, visual: { averageColor: region.averageColor }, semantics: { role: region.semanticRole ?? region.kind, confidence: region.textConfidence ?? region.confidence, text: region.text, uncertain: region.textConfidence !== undefined && region.textConfidence < .5 }, responsive: { referenceMetadata: primary.metadata }, provenance: { source: 'screenshot', provider: this.id, referenceId: primary.referenceId } }) }
    const confidence = regions.reduce((sum, region) => sum + region.confidence, 0) / Math.max(1, regions.length); const analysis: FroamAnalysis = { schemaVersion: 1, id: `screenshot:${now}`, kind: 'screenshot-reconstruction', targetIds: nodes.map((node) => node.id), createdAt: now, provider: this.id, local: true, confidence, result: { width: primary.width, height: primary.height, regionCount: regions.length, referenceCount: references.length, ocr: ocrResults.map((result) => ({ provider: result.provider, available: result.available, lines: result.lines.length, warnings: result.warnings })), validation: null, disclaimer: 'Experimental visual/structural reconstruction; original source code is not recovered.' } }
    return { analysis, nodes, relations, dna, regions, rootNodeId, references: references.map((item, index) => ({ id: item.referenceId ?? `reference-${index}`, metadata: item.metadata, width: item.width, height: item.height })), ocr: ocrResults, correctionPasses: [] }
  } }
}

export const localScreenshotProvider = createLocalScreenshotProvider()
