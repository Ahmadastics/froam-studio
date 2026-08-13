function clamp(value) { return Math.max(0, Math.min(1, value)); }
function normalizedText(value) { return value?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? ''; }
function tokens(value) { return new Set(normalizedText(value).split(' ').filter(Boolean)); }
function tokenSimilarity(a, b) {
    const left = tokens(a);
    const right = tokens(b);
    if (!left.size || !right.size)
        return 0;
    const overlap = [...left].filter((token) => right.has(token)).length;
    return overlap / Math.max(left.size, right.size);
}
export function normalizedScreenshotGeometry(region, viewport) {
    const width = Math.max(1, viewport.width);
    const height = Math.max(1, viewport.height);
    return { x: region.x / width, y: region.y / height, width: region.width / width, height: region.height / height, centerX: (region.x + region.width / 2) / width, centerY: (region.y + region.height / 2) / height };
}
function parentSignature(reconstruction, region) {
    const node = reconstruction.nodes.find((candidate) => candidate.id === region.nodeId);
    const parent = node?.parentId ? reconstruction.nodes.find((candidate) => candidate.id === node.parentId) : undefined;
    return parent ? `${parent.kind}:${String(parent.metadata?.semanticRole ?? '')}` : '';
}
function candidateScore(source, target, sourceIndex, targetIndex, from, to, fromViewport, toViewport) {
    const evidence = [];
    let score = 0;
    if (source.kind === target.kind) {
        score += .16;
        evidence.push({ signal: 'kind', score: .16, detail: `same ${source.kind} region kind` });
    }
    if (source.semanticRole !== 'unknown' && source.semanticRole === target.semanticRole) {
        score += .18;
        evidence.push({ signal: 'semantic-role', score: .18, detail: `same ${source.semanticRole} role` });
    }
    const sourceText = normalizedText(source.text);
    const targetText = normalizedText(target.text);
    if (sourceText && sourceText === targetText) {
        score += .34;
        evidence.push({ signal: 'ocr-text', score: .34, detail: 'exact normalized OCR text' });
    }
    else {
        const textScore = tokenSimilarity(source.text, target.text) * .24;
        if (textScore > .04) {
            score += textScore;
            evidence.push({ signal: 'ocr-text', score: textScore, detail: 'overlapping OCR tokens' });
        }
    }
    const a = normalizedScreenshotGeometry(source, fromViewport);
    const b = normalizedScreenshotGeometry(target, toViewport);
    const sizeSimilarity = 1 - clamp((Math.abs(a.width - b.width) + Math.abs(a.height - b.height)) / 1.2);
    const positionSimilarity = 1 - clamp(Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY) / 1.25);
    const geometryScore = sizeSimilarity * .08 + positionSimilarity * .04;
    score += geometryScore;
    evidence.push({ signal: 'geometry', score: geometryScore, detail: `normalized size ${sizeSimilarity.toFixed(2)}, position ${positionSimilarity.toFixed(2)}` });
    const orderSimilarity = 1 - Math.min(1, Math.abs(sourceIndex / Math.max(1, from.regions.length - 1) - targetIndex / Math.max(1, to.regions.length - 1)));
    score += orderSimilarity * .05;
    if (orderSimilarity > .7)
        evidence.push({ signal: 'ordering', score: orderSimilarity * .05, detail: 'similar reading order' });
    if (source.componentFamilyId && source.componentFamilyId === target.componentFamilyId) {
        score += .08;
        evidence.push({ signal: 'component-family', score: .08, detail: 'same reconstructed component family' });
    }
    if (source.averageColor && source.averageColor === target.averageColor) {
        score += .04;
        evidence.push({ signal: 'visual', score: .04, detail: 'same sampled average color' });
    }
    const sourceParent = parentSignature(from, source);
    const targetParent = parentSignature(to, target);
    if (sourceParent && sourceParent === targetParent) {
        score += .05;
        evidence.push({ signal: 'hierarchy', score: .05, detail: 'compatible reconstructed parent role' });
    }
    return { confidence: clamp(score), evidence };
}
/**
 * Match regions using observable evidence. Region/node IDs are returned as locators,
 * but are intentionally never scored as correspondence proof.
 */
export function matchScreenshotRegions(from, to) {
    const fromViewport = { width: from.references[0]?.width ?? 1, height: from.references[0]?.height ?? 1 };
    const toViewport = { width: to.references[0]?.width ?? 1, height: to.references[0]?.height ?? 1 };
    const proposals = from.regions.map((source, sourceIndex) => {
        const candidates = to.regions.map((target, targetIndex) => ({ target, ...candidateScore(source, target, sourceIndex, targetIndex, from, to, fromViewport, toViewport) })).sort((a, b) => b.confidence - a.confidence || a.target.id.localeCompare(b.target.id));
        return { source, candidates };
    }).sort((a, b) => (b.candidates[0]?.confidence ?? 0) - (a.candidates[0]?.confidence ?? 0) || a.source.id.localeCompare(b.source.id));
    const used = new Set();
    const matches = [];
    const ambiguous = [];
    for (const proposal of proposals) {
        const available = proposal.candidates.filter((candidate) => !used.has(candidate.target.id));
        const best = available[0];
        const second = available[1];
        if (!best)
            continue;
        const hasStrongText = best.evidence.some((item) => item.signal === 'ocr-text' && item.score >= .3);
        const margin = best.confidence - (second?.confidence ?? 0);
        if (!hasStrongText && second && best.confidence >= .3 && margin < .075) {
            ambiguous.push({ fromRegionId: proposal.source.id, candidateRegionIds: available.slice(0, 3).map((item) => item.target.id), confidence: best.confidence, reason: `top candidate margin ${margin.toFixed(3)} is below ambiguity threshold` });
            continue;
        }
        if (best.confidence < .58)
            continue;
        used.add(best.target.id);
        matches.push({ fromRegionId: proposal.source.id, toRegionId: best.target.id, fromNodeId: proposal.source.nodeId, toNodeId: best.target.nodeId, confidence: best.confidence, evidence: best.evidence });
    }
    const matchedFrom = new Set(matches.map((item) => item.fromRegionId));
    return { matches, ambiguous, unmatchedFromRegionIds: from.regions.filter((item) => !matchedFrom.has(item.id)).map((item) => item.id), unmatchedToRegionIds: to.regions.filter((item) => !used.has(item.id)).map((item) => item.id) };
}
export function compareScreenshotStates(from, to) {
    const matching = matchScreenshotRegions(from, to);
    const fromById = new Map(from.regions.map((region) => [region.id, region]));
    const toById = new Map(to.regions.map((region) => [region.id, region]));
    const appeared = matching.unmatchedToRegionIds.map((id) => toById.get(id)).filter((item) => Boolean(item));
    const disappeared = matching.unmatchedFromRegionIds.map((id) => fromById.get(id)).filter((item) => Boolean(item));
    const geometry = matching.matches.flatMap((match) => { const source = fromById.get(match.fromRegionId); const target = toById.get(match.toRegionId); if (!source || !target)
        return []; const distance = Math.hypot(source.x / Math.max(1, from.references[0]?.width ?? 1) - target.x / Math.max(1, to.references[0]?.width ?? 1), source.y / Math.max(1, from.references[0]?.height ?? 1) - target.y / Math.max(1, to.references[0]?.height ?? 1)); return distance > .02 ? [{ fromNodeId: source.nodeId, toNodeId: target.nodeId, distance }] : []; });
    const styles = matching.matches.flatMap((match) => { const source = fromById.get(match.fromRegionId); const target = toById.get(match.toRegionId); return source && target && source.averageColor !== target.averageColor ? [{ fromNodeId: source.nodeId, toNodeId: target.nodeId, colorChanged: true }] : []; });
    const hypotheses = [];
    if (appeared.length)
        hypotheses.push({ kind: 'reveal', confidence: Math.min(.75, .4 + appeared.length / Math.max(1, to.regions.length) * .3), evidence: [`${appeared.length} unmatched regions appeared`] });
    if (disappeared.length)
        hypotheses.push({ kind: 'hide', confidence: Math.min(.75, .4 + disappeared.length / Math.max(1, from.regions.length) * .3), evidence: [`${disappeared.length} unmatched regions disappeared`] });
    if (geometry.length)
        hypotheses.push({ kind: 'move', confidence: .55, evidence: [`${geometry.length} matched regions moved in normalized geometry`] });
    if (styles.length)
        hypotheses.push({ kind: 'restyle', confidence: .5, evidence: [`${styles.length} matched regions changed sampled color`] });
    return { fromReferenceId: from.references[0]?.id ?? 'from', toReferenceId: to.references[0]?.id ?? 'to', matched: matching.matches.length, matches: matching.matches, ambiguousMatches: matching.ambiguous, appearedNodeIds: appeared.map((region) => region.nodeId), disappearedNodeIds: disappeared.map((region) => region.nodeId), geometryChanges: geometry, styleChanges: styles, interactionHypotheses: hypotheses, limitations: ['State differences are hypotheses from flattened pixels.', 'Ambiguous candidates remain unmatched.', 'Trigger, easing, source implementation and hidden state remain unknown.', 'No Interaction Recipe is generated automatically.'] };
}
export function inferResponsiveScreenshotReferences(reconstructions) {
    const sorted = [...reconstructions].sort((a, b) => (a.references[0]?.width ?? 0) - (b.references[0]?.width ?? 0));
    return { references: sorted.map((item) => ({ id: item.references[0]?.id, width: item.references[0]?.width, height: item.references[0]?.height, regionCount: item.regions.length })), observations: sorted.slice(1).map((item, index) => ({ from: sorted[index].references[0]?.id, to: item.references[0]?.id, difference: compareScreenshotStates(sorted[index], item) })), confidence: sorted.length >= 3 ? .55 : .35, limitation: 'Multiple screenshots provide responsive evidence and bounded intervals, not the original breakpoint rules.' };
}
//# sourceMappingURL=screenshot-state.js.map