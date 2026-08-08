function signal(record, kind) { return record.signals.find((item) => item.kind === kind)?.values ?? {}; }
function heuristicPrediction(records, now = Date.now()) {
    const raw = records.map((record) => {
        const layout = signal(record, 'layout');
        const visual = signal(record, 'appearance');
        const semantic = signal(record, 'semantics');
        const area = Math.max(1, Number(layout.rect?.width ?? 0) * Number(layout.rect?.height ?? 0));
        const reasons = [];
        let score = Math.log10(area + 1) * 10;
        const font = Number.parseFloat(String(visual.fontSize ?? 0));
        if (font >= 28) {
            score += 18;
            reasons.push('large type');
        }
        const role = String(semantic.role ?? 'unknown');
        if (['cta', 'button'].includes(role)) {
            score += 14;
            reasons.push('action affordance');
        }
        if (role === 'media') {
            score += 12;
            reasons.push('large visual region');
        }
        if (Number(layout.rect?.y ?? 9999) < 800) {
            score += 8;
            reasons.push('early viewport position');
        }
        return { nodeId: record.node.nodeId, score, role, reasons };
    }).sort((a, b) => b.score - a.score);
    const max = raw[0]?.score || 1;
    const ranking = raw.map((item, index) => ({ ...item, score: Math.round(item.score / max * 100), rank: index + 1 }));
    const primaryAction = ranking.find((item) => item.role === 'cta' || item.role === 'button');
    const warnings = primaryAction && primaryAction.rank > 3 ? [`Primary action ranks ${primaryAction.rank}, below ${primaryAction.rank - 1} other elements.`] : [];
    const evidenceCoverage = records.length ? raw.filter((item) => item.reasons.length).length / records.length : 0;
    return { schemaVersion: 1, id: `attention:${now}`, kind: 'predicted-attention', targetIds: ranking.map((item) => item.nodeId), createdAt: now, provider: 'froam-local-attention-v1', local: true, confidence: Math.min(.6, .35 + evidenceCoverage * .25), result: { ranking, warnings, method: 'Area, typography, semantic affordance and early-viewport weighted ranking.', maturity: 'experimental', evidenceCoverage, disclaimer: 'Heuristic prediction, not eye-tracking data; confidence describes available heuristic evidence, not human-gaze accuracy.' } };
}
export const LOCAL_ATTENTION_PROVIDER = { id: 'froam-local-attention-v1', maturity: 'experimental', method: 'Deterministic weighted salience heuristic', predict: heuristicPrediction };
export function predictAttention(records, now = Date.now()) { return LOCAL_ATTENTION_PROVIDER.predict(records, now); }
export function evaluateAttentionProvider(provider, fixtures) {
    const results = fixtures.map((fixture, index) => { const ranking = (provider.predict(fixture.records, index + 1).result.ranking ?? []); const predicted = ranking.slice(0, 3).map((item) => item.nodeId); return { fixtureId: fixture.id, topChoice: predicted[0] === fixture.expectedTopNodeIds[0], topThreeRecall: fixture.expectedTopNodeIds.length ? fixture.expectedTopNodeIds.filter((id) => predicted.includes(id)).length / fixture.expectedTopNodeIds.length : 0 }; });
    return { provider: provider.id, fixtures: fixtures.length, topChoiceAgreement: fixtures.length ? results.filter((item) => item.topChoice).length / fixtures.length : 0, meanTopThreeRecall: fixtures.length ? results.reduce((sum, item) => sum + item.topThreeRecall, 0) / fixtures.length : 0, results };
}
//# sourceMappingURL=attention.js.map