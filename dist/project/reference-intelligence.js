import { FROAM_INTELLIGENCE_SCHEMA_VERSION } from './intelligence-transport.js';
import { cinemaWidths, responsiveSuggestions } from './responsive.js';
import { localScreenshotProvider } from './screenshot-reconstruction.js';
import { compareScreenshotStates, normalizedScreenshotGeometry } from './screenshot-state.js';
export const FROAM_REFERENCE_SCHEMA_VERSION = 1;
export const FROAM_BASELINE_VALIDATION_WIDTHS = [320, 360, 390, 430, 480, 640, 768, 834, 1024, 1280, 1440, 1600, 1920];
function assertBoundedString(value, name, max = 2_000) {
    if (value != null && (!value.trim() || value.length > max))
        throw new Error(`${name} must be a non-empty bounded string`);
}
function clamp(value) { return Math.max(0, Math.min(1, value)); }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined; }
function safe(value) { return value.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 100) || 'reference'; }
function compactJson(value) { return JSON.parse(JSON.stringify(value)); }
export function validateReferenceSet(value) {
    if (value.schemaVersion !== FROAM_REFERENCE_SCHEMA_VERSION)
        throw new Error('Unsupported reference schema version');
    assertBoundedString(value.id, 'Reference set id', 256);
    if (!Array.isArray(value.references) || value.references.length < 1 || value.references.length > 20)
        throw new Error('A reference set requires 1 to 20 references');
    const ids = new Set();
    for (const reference of value.references) {
        assertBoundedString(reference.id, 'Reference id', 256);
        assertBoundedString(reference.route, 'Reference route');
        assertBoundedString(reference.state?.key, 'Reference state key', 500);
        assertBoundedString(reference.state?.label, 'Reference state label', 500);
        assertBoundedString(reference.label, 'Reference label', 500);
        if (ids.has(reference.id))
            throw new Error(`Duplicate reference id: ${reference.id}`);
        ids.add(reference.id);
        if (!Number.isFinite(reference.viewport.width) || !Number.isFinite(reference.viewport.height) || reference.viewport.width < 16 || reference.viewport.height < 16 || reference.viewport.width > 100_000 || reference.viewport.height > 100_000)
            throw new Error(`Invalid viewport for ${reference.id}`);
        if (reference.media) {
            assertBoundedString(reference.media.id, 'Media reference id', 1_000);
            if (reference.media.id.startsWith('data:'))
                throw new Error('Media references must be opaque identifiers, not data URLs');
        }
    }
    return structuredClone(value);
}
export function normalizeReferenceRegions(entry) {
    return entry.reconstruction.regions.map((region) => ({ referenceId: entry.reference.id, regionId: region.id, nodeId: region.nodeId, ...normalizedScreenshotGeometry(region, entry.reference.viewport) }));
}
export function deriveGeometryRelationships(entry) {
    const normalized = normalizeReferenceRegions(entry);
    const output = [];
    for (const region of normalized) {
        if (region.width >= .9)
            output.push({ referenceId: entry.reference.id, fromRegionId: region.regionId, kind: 'full-width', origin: 'observed', confidence: .95 });
        else
            output.push({ referenceId: entry.reference.id, fromRegionId: region.regionId, kind: 'contained', origin: 'observed', confidence: .9 });
        if (region.x <= .05)
            output.push({ referenceId: entry.reference.id, fromRegionId: region.regionId, kind: 'aligned-left', origin: 'observed', confidence: .85 });
        if (Math.abs(region.centerX - .5) <= .05)
            output.push({ referenceId: entry.reference.id, fromRegionId: region.regionId, kind: 'aligned-center', origin: 'observed', confidence: .85 });
    }
    for (let left = 0; left < normalized.length; left += 1)
        for (let right = left + 1; right < normalized.length; right += 1) {
            const a = normalized[left];
            const b = normalized[right];
            if (Math.abs(a.centerY - b.centerY) < Math.max(.025, Math.min(a.height, b.height) * .35))
                output.push({ referenceId: entry.reference.id, fromRegionId: a.regionId, toRegionId: b.regionId, kind: 'same-row', origin: 'observed', confidence: .8 });
            if (Math.abs(a.centerX - b.centerX) < Math.max(.025, Math.min(a.width, b.width) * .35) && Math.abs(a.centerY - b.centerY) > Math.min(a.height, b.height) * .5)
                output.push({ referenceId: entry.reference.id, fromRegionId: a.regionId, toRegionId: b.regionId, kind: 'stacked', origin: 'observed', confidence: .8 });
            if (Math.abs(a.width - b.width) < .025)
                output.push({ referenceId: entry.reference.id, fromRegionId: a.regionId, toRegionId: b.regionId, kind: 'equal-width', origin: 'observed', confidence: .85 });
        }
    const byFamily = new Map();
    for (const region of entry.reconstruction.regions)
        if (region.componentFamilyId)
            byFamily.set(region.componentFamilyId, [...(byFamily.get(region.componentFamilyId) ?? []), region]);
    for (const family of byFamily.values())
        if (family.length >= 2)
            for (const region of family)
                output.push({ referenceId: entry.reference.id, fromRegionId: region.id, kind: 'repeated-grid-member', origin: 'observed', confidence: .9 });
    return output;
}
function rowCount(regions) {
    const rows = [];
    for (const region of [...regions].sort((a, b) => a.y - b.y || a.x - b.x)) {
        const row = rows.find((candidate) => Math.abs(candidate.y - (region.y + region.height / 2)) <= Math.max(12, region.height * .4));
        if (row)
            row.count += 1;
        else
            rows.push({ y: region.y + region.height / 2, count: 1 });
    }
    return Math.max(1, ...rows.map((row) => row.count));
}
function observedGridColumns(reconstruction) {
    const families = new Map();
    for (const region of reconstruction.regions)
        if (region.componentFamilyId)
            families.set(region.componentFamilyId, [...(families.get(region.componentFamilyId) ?? []), region]);
    const strongest = [...families.entries()].filter(([, regions]) => regions.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
    return strongest ? { familyId: strongest[0], columns: rowCount(strongest[1]), regionIds: strongest[1].map((region) => region.id) } : undefined;
}
function heroOrientation(reconstruction) {
    const heading = reconstruction.regions.find((region) => region.semanticRole === 'heading');
    const image = reconstruction.regions.filter((region) => region.kind === 'image').sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!heading || !image)
        return undefined;
    const dx = Math.abs((heading.x + heading.width / 2) - (image.x + image.width / 2));
    const dy = Math.abs((heading.y + heading.height / 2) - (image.y + image.height / 2));
    return { orientation: dx > dy * 1.2 ? 'row' : 'column', regionIds: [heading.id, image.id] };
}
function navShape(reconstruction) {
    const height = reconstruction.references[0]?.height ?? 1;
    const top = reconstruction.regions.filter((region) => region.y < height * .18);
    const textItems = top.filter((region) => region.kind === 'text' && (region.semanticRole === 'label' || region.semanticRole === 'button')).length;
    const compactControls = top.filter((region) => region.semanticRole === 'button' && region.width <= 72).length;
    return { textItems, compactControls };
}
function containerObservation(entry) {
    const regions = entry.reconstruction.regions.filter((region) => region.kind !== 'container' || region.width < entry.reference.viewport.width * .98);
    const left = regions.length ? Math.min(...regions.map((region) => region.x)) : 0;
    const right = regions.length ? Math.max(...regions.map((region) => region.x + region.width)) : entry.reference.viewport.width;
    const contentWidth = Math.max(0, right - left);
    const ratio = contentWidth / entry.reference.viewport.width;
    return { id: `container:${safe(entry.reference.id)}`, kind: 'container', origin: 'observed', width: entry.reference.viewport.width, summary: `Observable content spans ${Math.round(ratio * 100)}% of the viewport`, confidence: regions.length ? .82 : .3, referenceIds: [entry.reference.id], values: { contentWidth, viewportRatio: ratio, leftInset: left } };
}
export function inferResponsiveSignature(referenceSetId, entries, comparisons) {
    const sorted = [...entries].sort((a, b) => a.reference.viewport.width - b.reference.viewport.width || a.reference.id.localeCompare(b.reference.id));
    const observations = [];
    const hypotheses = [];
    for (const entry of sorted) {
        observations.push(containerObservation(entry));
        const grid = observedGridColumns(entry.reconstruction);
        if (grid)
            observations.push({ id: `grid:${safe(entry.reference.id)}`, kind: 'grid', origin: 'observed', width: entry.reference.viewport.width, summary: `${grid.columns} repeated columns observed`, confidence: .88, referenceIds: [entry.reference.id], regionIds: grid.regionIds, values: { columns: grid.columns, family: grid.familyId } });
        const hero = heroOrientation(entry.reconstruction);
        if (hero)
            observations.push({ id: `hero:${safe(entry.reference.id)}`, kind: 'layout', origin: 'observed', width: entry.reference.viewport.width, summary: `Hero evidence is ${hero.orientation}-oriented`, confidence: .75, referenceIds: [entry.reference.id], regionIds: hero.regionIds, values: { orientation: hero.orientation } });
        const nav = navShape(entry.reconstruction);
        observations.push({ id: `nav:${safe(entry.reference.id)}`, kind: 'navigation', origin: 'observed', width: entry.reference.viewport.width, summary: `${nav.textItems} top navigation text controls and ${nav.compactControls} compact controls observed`, confidence: .65, referenceIds: [entry.reference.id], values: nav });
        const text = entry.reconstruction.regions.filter((region) => region.kind === 'text');
        const textHeight = mean(text.map((region) => region.height));
        if (textHeight !== undefined)
            observations.push({ id: `type:${safe(entry.reference.id)}`, kind: 'typography', origin: 'observed', width: entry.reference.viewport.width, summary: `Mean observed text-region height is ${textHeight.toFixed(1)}px`, confidence: .55, referenceIds: [entry.reference.id], regionIds: text.map((region) => region.id), values: { meanTextRegionHeight: textHeight } });
        const ordered = [...entry.reconstruction.regions].sort((a, b) => a.y - b.y || a.x - b.x);
        const gaps = ordered.slice(1).map((region, index) => region.y - (ordered[index].y + ordered[index].height)).filter((gap) => gap > 0);
        const meanGap = mean(gaps);
        if (meanGap !== undefined)
            observations.push({ id: `spacing:${safe(entry.reference.id)}`, kind: 'spacing', origin: 'observed', width: entry.reference.viewport.width, summary: `Mean positive inter-region gap is ${meanGap.toFixed(1)}px`, confidence: .5, referenceIds: [entry.reference.id], values: { meanPositiveGap: meanGap } });
    }
    for (let index = 1; index < sorted.length; index += 1) {
        const narrow = sorted[index - 1];
        const wide = sorted[index];
        const between = [narrow.reference.viewport.width, wide.reference.viewport.width];
        const narrowGrid = observedGridColumns(narrow.reconstruction);
        const wideGrid = observedGridColumns(wide.reconstruction);
        if (narrowGrid && wideGrid && narrowGrid.columns !== wideGrid.columns)
            hypotheses.push({ id: `grid-transition:${between.join('-')}`, kind: 'layout-transition', origin: 'inferred', summary: `Repeated layout changes from ${narrowGrid.columns} to ${wideGrid.columns} columns somewhere in this interval`, confidence: .82, betweenWidths: between, evidenceIds: [`grid:${safe(narrow.reference.id)}`, `grid:${safe(wide.reference.id)}`] });
        const narrowHero = heroOrientation(narrow.reconstruction);
        const wideHero = heroOrientation(wide.reconstruction);
        if (narrowHero && wideHero && narrowHero.orientation !== wideHero.orientation)
            hypotheses.push({ id: `hero-transition:${between.join('-')}`, kind: 'layout-transition', origin: 'inferred', summary: `Hero changes from ${narrowHero.orientation} to ${wideHero.orientation} somewhere in this interval`, confidence: .74, betweenWidths: between, evidenceIds: [`hero:${safe(narrow.reference.id)}`, `hero:${safe(wide.reference.id)}`] });
        const narrowNav = navShape(narrow.reconstruction);
        const wideNav = navShape(wide.reconstruction);
        if (narrowNav.compactControls > wideNav.compactControls && narrowNav.textItems < wideNav.textItems)
            hypotheses.push({ id: `nav-transition:${between.join('-')}`, kind: 'navigation-transformation', origin: 'inferred', summary: 'Navigation likely transforms from text links to a compact control in this interval', confidence: .72, betweenWidths: between, evidenceIds: [`nav:${safe(narrow.reference.id)}`, `nav:${safe(wide.reference.id)}`] });
        const comparison = comparisons.find((item) => item.fromReferenceId === narrow.reference.id && item.toReferenceId === wide.reference.id);
        if (comparison?.difference.appearedNodeIds.length || comparison?.difference.disappearedNodeIds.length)
            hypotheses.push({ id: `visibility:${between.join('-')}`, kind: 'visibility-change', origin: 'inferred', summary: `${comparison.difference.appearedNodeIds.length} regions appear and ${comparison.difference.disappearedNodeIds.length} disappear across this interval`, confidence: .62, betweenWidths: between, evidenceIds: [] });
        if (comparison) {
            const fromById = new Map(narrow.reconstruction.regions.map((region) => [region.id, region]));
            const toById = new Map(wide.reconstruction.regions.map((region) => [region.id, region]));
            let resized = 0;
            let repositioned = 0;
            let aspectChanged = 0;
            let textScaled = 0;
            for (const match of comparison.difference.matches) {
                const fromRegion = fromById.get(match.fromRegionId);
                const toRegion = toById.get(match.toRegionId);
                if (!fromRegion || !toRegion)
                    continue;
                const fromGeometry = normalizedScreenshotGeometry(fromRegion, narrow.reference.viewport);
                const toGeometry = normalizedScreenshotGeometry(toRegion, wide.reference.viewport);
                if (Math.abs(fromGeometry.width - toGeometry.width) + Math.abs(fromGeometry.height - toGeometry.height) > .08)
                    resized += 1;
                if (Math.hypot(fromGeometry.centerX - toGeometry.centerX, fromGeometry.centerY - toGeometry.centerY) > .08)
                    repositioned += 1;
                if (Math.abs(fromRegion.width / Math.max(1, fromRegion.height) - toRegion.width / Math.max(1, toRegion.height)) > .3)
                    aspectChanged += 1;
                if (fromRegion.kind === 'text' && Math.abs(fromRegion.height - toRegion.height) > 4)
                    textScaled += 1;
            }
            if (resized || repositioned)
                hypotheses.push({ id: `geometry:${between.join('-')}`, kind: 'geometry-change', origin: 'inferred', summary: `${resized} matched regions resize and ${repositioned} reposition across this interval`, confidence: .68, betweenWidths: between, evidenceIds: comparison.difference.matches.flatMap((match) => [match.fromRegionId, match.toRegionId]) });
            if (aspectChanged)
                hypotheses.push({ id: `aspect:${between.join('-')}`, kind: 'crop-or-aspect-change', origin: 'inferred', summary: `${aspectChanged} matched regions change observable aspect ratio; crop intent remains unknown`, confidence: .58, betweenWidths: between, evidenceIds: comparison.difference.matches.flatMap((match) => [match.fromRegionId, match.toRegionId]) });
            if (textScaled)
                hypotheses.push({ id: `typography:${between.join('-')}`, kind: 'typography-change', origin: 'inferred', summary: `${textScaled} matched text regions change observed height across this interval`, confidence: .52, betweenWidths: between, evidenceIds: [`type:${safe(narrow.reference.id)}`, `type:${safe(wide.reference.id)}`] });
            const narrowSpacing = observations.find((item) => item.id === `spacing:${safe(narrow.reference.id)}`)?.values?.meanPositiveGap;
            const wideSpacing = observations.find((item) => item.id === `spacing:${safe(wide.reference.id)}`)?.values?.meanPositiveGap;
            if (typeof narrowSpacing === 'number' && typeof wideSpacing === 'number' && Math.abs(narrowSpacing - wideSpacing) > 4)
                hypotheses.push({ id: `spacing:${between.join('-')}`, kind: 'spacing-change', origin: 'inferred', summary: `Observed mean positive spacing changes across this interval`, confidence: .48, betweenWidths: between, evidenceIds: [`spacing:${safe(narrow.reference.id)}`, `spacing:${safe(wide.reference.id)}`] });
        }
    }
    const containerEvidence = observations.filter((item) => item.kind === 'container');
    if (containerEvidence.length >= 2)
        hypotheses.push({ id: 'container-behavior', kind: 'container-behavior', origin: 'inferred', summary: 'Container behavior is inferred from observed content-width ratios; original max-width rules remain unknown', confidence: .58, evidenceIds: containerEvidence.map((item) => item.id) });
    const limitations = sorted.length < 2 ? ['A single reference cannot establish responsive transitions or breakpoint intervals.'] : ['Breakpoint locations are bounded intervals between observed widths, never invented exact CSS values.', 'Raster evidence cannot prove source rules, DOM semantics, font metrics, crop intent, or hidden interaction state.'];
    return { schemaVersion: 1, id: `responsive:${safe(referenceSetId)}`, referenceSetId, observedWidths: sorted.map((entry) => entry.reference.viewport.width), observations, hypotheses, limitations };
}
function qualityFor(entries, comparisons) {
    const matches = comparisons.flatMap((comparison) => comparison.difference.matches);
    const population = comparisons.reduce((sum, comparison) => sum + Math.max(1, comparison.difference.matches.length + comparison.difference.disappearedNodeIds.length + comparison.difference.ambiguousMatches.length), 0);
    const textConfidence = entries.flatMap((entry) => entry.reconstruction.regions.filter((region) => region.kind === 'text' && region.textConfidence != null).map((region) => region.textConfidence));
    const visual = entries.flatMap((entry) => { const validation = entry.reconstruction.analysis.result.validation; return typeof validation?.pixelSimilarity === 'number' ? [validation.pixelSimilarity] : []; });
    const structure = comparisons.length ? matches.length / Math.max(1, population) : undefined;
    return { structure, geometry: matches.length ? mean(matches.map((match) => match.confidence)) : undefined, text: mean(textConfidence), visual: mean(visual), responsiveEvidence: entries.length >= 2 ? clamp((Math.min(4, entries.length) / 4) * .55 + (structure ?? 0) * .45) : undefined, limitations: [...(!textConfidence.length ? ['Text quality is unknown because no OCR confidence was available.'] : []), ...(!visual.length ? ['Visual accuracy is unknown until an equal-dimension candidate capture is compared.'] : []), ...(entries.length < 2 ? ['Responsive evidence is unknown from a single viewport.'] : [])] };
}
export function referenceValidationWidths(referenceWidths, hypotheses, delta = 1) {
    const values = new Set([...FROAM_BASELINE_VALIDATION_WIDTHS, ...cinemaWidths(320, 1920, 160), ...referenceWidths]);
    for (const hypothesis of hypotheses)
        if (hypothesis.betweenWidths)
            for (const boundary of hypothesis.betweenWidths) {
                values.add(Math.max(1, Math.round(boundary - Math.max(1, delta))));
                values.add(Math.round(boundary));
                values.add(Math.round(boundary + Math.max(1, delta)));
            }
    return [...values].filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
}
export function analyzeReferenceReconstructions(referenceSetInput, reconstructionInput) {
    const referenceSet = validateReferenceSet(referenceSetInput);
    if (reconstructionInput.length !== referenceSet.references.length)
        throw new Error('Every reference must have exactly one reconstruction');
    const byReference = new Map(reconstructionInput.map((reconstruction) => [reconstruction.references[0]?.id, reconstruction]));
    const entries = referenceSet.references.map((reference, index) => { const reconstruction = byReference.get(reference.id) ?? reconstructionInput[index]; if (!reconstruction)
        throw new Error(`Missing reconstruction for ${reference.id}`); const observed = reconstruction.references[0]; if (observed && (observed.width !== reference.viewport.width || observed.height !== reference.viewport.height))
        throw new Error(`Reconstruction viewport does not match ${reference.id}`); return { reference, reconstruction }; }).sort((a, b) => a.reference.viewport.width - b.reference.viewport.width || a.reference.id.localeCompare(b.reference.id));
    const comparisons = entries.slice(1).map((entry, index) => ({ fromReferenceId: entries[index].reference.id, toReferenceId: entry.reference.id, fromWidth: entries[index].reference.viewport.width, toWidth: entry.reference.viewport.width, difference: compareScreenshotStates(entries[index].reconstruction, entry.reconstruction) }));
    const responsiveSignature = inferResponsiveSignature(referenceSet.id, entries, comparisons);
    const quality = qualityFor(entries, comparisons);
    const limitations = [...new Set([...referenceSet.references.flatMap((reference) => reference.limitations ?? []), ...responsiveSignature.limitations, ...quality.limitations])];
    return { schemaVersion: 1, id: `reference-understanding:${safe(referenceSet.id)}`, referenceSet, reconstructions: entries, normalizedRegions: entries.flatMap(normalizeReferenceRegions), relationships: entries.flatMap(deriveGeometryRelationships), comparisons, responsiveSignature, quality, validationWidths: referenceValidationWidths(entries.map((entry) => entry.reference.viewport.width), responsiveSignature.hypotheses), limitations };
}
export async function reconstructReferenceSet(referenceSetInput, pixelsByReferenceId, provider = localScreenshotProvider) {
    const referenceSet = validateReferenceSet(referenceSetInput);
    const reconstructions = await Promise.all(referenceSet.references.map(async (reference) => {
        const pixels = pixelsByReferenceId[reference.id];
        if (!pixels)
            throw new Error(`Missing decoded pixels for ${reference.id}`);
        if (pixels.width !== reference.viewport.width || pixels.height !== reference.viewport.height)
            throw new Error(`Pixel viewport does not match metadata for ${reference.id}`);
        return provider.reconstruct({ ...pixels, referenceId: reference.id, metadata: { ...pixels.metadata, viewportWidth: reference.viewport.width, viewportHeight: reference.viewport.height, route: reference.route, state: reference.state?.key, label: reference.label, limitations: reference.limitations } });
    }));
    return analyzeReferenceReconstructions(referenceSet, reconstructions);
}
export function validateResponsiveHealth(observations, referenceMismatches = []) {
    const sorted = [...observations].sort((a, b) => a.width - b.width);
    const issueCount = sorted.reduce((sum, item) => sum + Number(item.overflowX) + item.hiddenCritical.length + item.collisions.length + item.clipped.length + item.touchTargets.length, 0) + referenceMismatches.length;
    const criticalIssueCount = sorted.reduce((sum, item) => sum + Number(item.overflowX) + item.hiddenCritical.length, 0) + referenceMismatches.filter((item) => item.severity === 'critical').length;
    return { testedWidths: sorted.map((item) => item.width), observations: sorted, referenceMismatches: [...referenceMismatches], issueCount, criticalIssueCount, healthy: issueCount === 0 };
}
/** Uses the existing cinema sweep and policy suggestion engine; DOM observations are supplied by observeResponsiveState. */
export function planResponsiveValidation(records, policies, referenceWidths, hypotheses) {
    const widths = referenceValidationWidths(referenceWidths, hypotheses);
    return { widths, cinemaSweep: cinemaWidths(), observationContract: 'observeResponsiveState', suggestions: widths.map((width) => ({ width, items: responsiveSuggestions(records, policies, width) })) };
}
export async function adaptiveBreakpointSearch(input) {
    const same = input.sameState ?? ((left, right) => JSON.stringify(left) === JSON.stringify(right));
    const maxProbes = Math.max(0, Math.min(12, Math.floor(input.maxProbes ?? 6)));
    const minimum = Math.max(1, input.minimumInterval ?? 2);
    let lower = Math.round(Math.min(input.lowerWidth, input.upperWidth));
    let upper = Math.round(Math.max(input.lowerWidth, input.upperWidth));
    let lowerState = input.lowerState;
    const upperState = input.upperState;
    const probes = [];
    if (same(lowerState, upperState))
        return { transitionFound: false, interval: undefined, probes, origin: 'inferred', confidence: 0 };
    while (probes.length < maxProbes && upper - lower > minimum) {
        const width = Math.floor((lower + upper) / 2);
        if (width === lower || width === upper)
            break;
        const state = await input.observe(width);
        probes.push({ width, state, origin: 'observed' });
        if (same(state, lowerState)) {
            lower = width;
            lowerState = state;
        }
        else
            upper = width;
    }
    return { transitionFound: true, interval: [lower, upper], probes, origin: 'inferred', confidence: clamp(.45 + probes.length * .07) };
}
function viewportName(width) { return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'; }
function intelligenceReferences(understanding) {
    const count = Math.max(1, understanding.reconstructions.length);
    const regionLimit = Math.max(1, Math.floor(30 / count));
    const ocrLimit = Math.max(1, Math.floor(20 / count));
    const hierarchyLimit = Math.max(1, Math.floor(30 / count));
    return understanding.reconstructions.map(({ reference, reconstruction }) => ({ id: reference.id, mediaReferenceId: reference.media?.id, viewportWidth: reference.viewport.width, viewportHeight: reference.viewport.height, route: reference.route, state: reference.state?.key, label: reference.label, reconstructedRegions: reconstruction.regions.slice(0, regionLimit).map((region) => ({ id: region.id, nodeId: region.nodeId, kind: region.kind, x: region.x, y: region.y, width: region.width, height: region.height, text: region.text, semanticRole: region.semanticRole, confidence: region.confidence, origin: 'observed' })), ocrText: reconstruction.ocr.flatMap((ocr) => ocr.lines).slice(0, ocrLimit).map((line) => ({ text: line.text ?? '[unreadable]', confidence: line.confidence, origin: line.text ? 'observed' : 'inferred' })), observedHierarchy: reconstruction.relations.filter((relation) => relation.kind === 'contains').slice(0, hierarchyLimit).map((relation) => ({ parentId: relation.from, childId: relation.to, origin: relation.metadata?.inferred ? 'inferred' : 'observed', confidence: typeof relation.metadata?.confidence === 'number' ? relation.metadata.confidence : undefined })), knownLimitations: reference.limitations }));
}
function intelligenceResponsiveObservations(signature) {
    return [...signature.observations.slice(0, 40).map((item) => ({ width: item.width, summary: item.summary, origin: item.origin, confidence: item.confidence, markers: [item.kind] })), ...signature.hypotheses.slice(0, 20).flatMap((item) => item.betweenWidths ? [{ width: Math.round((item.betweenWidths[0] + item.betweenWidths[1]) / 2), summary: `${item.summary}; bounded by ${item.betweenWidths[0]}-${item.betweenWidths[1]}px`, origin: item.origin, confidence: item.confidence, markers: [item.kind] }] : [])];
}
function intelligenceReferenceEvidence(understanding) {
    return {
        matches: understanding.comparisons.flatMap((comparison) => comparison.difference.matches.map((match) => ({ fromReferenceId: comparison.fromReferenceId, toReferenceId: comparison.toReferenceId, fromRegionId: match.fromRegionId, toRegionId: match.toRegionId, confidence: match.confidence, evidence: match.evidence.slice(0, 3).map((item) => `${item.signal}: ${item.detail}`) }))).slice(0, 30),
        differences: understanding.comparisons.map((comparison) => ({ fromReferenceId: comparison.fromReferenceId, toReferenceId: comparison.toReferenceId, appeared: comparison.difference.appearedNodeIds.length, disappeared: comparison.difference.disappearedNodeIds.length, moved: comparison.difference.geometryChanges.length, ambiguous: comparison.difference.ambiguousMatches.length })),
        responsiveSignature: { observedWidths: understanding.responsiveSignature.observedWidths, observations: understanding.responsiveSignature.observations.slice(0, 30).map((item) => ({ kind: item.kind, width: item.width, summary: item.summary, origin: item.origin, confidence: item.confidence })), hypotheses: understanding.responsiveSignature.hypotheses.slice(0, 20).map((item) => ({ kind: item.kind, summary: item.summary, origin: item.origin, confidence: item.confidence, betweenWidths: item.betweenWidths })) },
        quality: { structure: understanding.quality.structure, geometry: understanding.quality.geometry, text: understanding.quality.text, visual: understanding.quality.visual, responsiveEvidence: understanding.quality.responsiveEvidence },
        limitations: understanding.limitations,
    };
}
export function createReferenceIntelligenceRequest(understanding, input) {
    const width = Math.max(...understanding.referenceSet.references.map((reference) => reference.viewport.width));
    return compactJson({ schemaVersion: FROAM_INTELLIGENCE_SCHEMA_VERSION, purpose: 'reference', intent: input.intent, ...(input.requestId ? { requestId: input.requestId } : {}), ...(input.consent ? { consent: true } : {}), context: { projectId: input.projectId, activeBranchId: input.activeBranchId, routeKey: input.routeKey, viewport: viewportName(width), references: intelligenceReferences(understanding), responsiveObservations: intelligenceResponsiveObservations(understanding.responsiveSignature), referenceEvidence: intelligenceReferenceEvidence(understanding) } });
}
export function createResponsiveIntelligenceRequest(understanding, input) {
    return { ...createReferenceIntelligenceRequest(understanding, input), purpose: 'responsive' };
}
/** Compact, additive metadata suitable for project metadata without a schema migration. */
export function serializeReferenceMetadata(understanding) {
    return structuredClone({ schemaVersion: FROAM_REFERENCE_SCHEMA_VERSION, referenceSet: understanding.referenceSet, responsiveSignature: understanding.responsiveSignature, quality: understanding.quality, validationWidths: understanding.validationWidths, limitations: understanding.limitations });
}
//# sourceMappingURL=reference-intelligence.js.map