import { runSimulationScenario } from './simulation.js';
export function createDefaultChaosScenarios() {
    const scenario = (id, name, events) => ({ id, name, events });
    return [
        scenario('viewport-320', '320px mobile', [{ atMs: 0, type: 'viewport', width: 320, height: 720 }]),
        scenario('viewport-landscape', 'Landscape mobile', [{ atMs: 0, type: 'viewport', width: 667, height: 375 }]),
        scenario('viewport-tablet', 'Tablet', [{ atMs: 0, type: 'viewport', width: 768, height: 1024 }]),
        scenario('viewport-ultrawide', 'Ultrawide', [{ atMs: 0, type: 'viewport', width: 2560, height: 1080 }]),
        scenario('content-long', 'Long content', [{ atMs: 0, type: 'content', state: 'long-text', locale: 'en' }]),
        scenario('content-empty', 'Empty content', [{ atMs: 0, type: 'content', state: 'empty' }]),
        scenario('assets-missing', 'Missing assets', [{ atMs: 0, type: 'assets', state: 'missing' }]),
        scenario('locale-rtl', 'RTL locale', [{ atMs: 0, type: 'content', state: 'long-text', locale: 'ar-RTL' }]),
        scenario('network-offline', 'Offline', [{ atMs: 0, type: 'network', state: 'offline' }]),
        scenario('network-slow', 'Slow connection', [{ atMs: 0, type: 'network', state: 'slow', latencyMs: 2500 }]),
        scenario('api-failure', 'API failure', [{ atMs: 0, type: 'api', state: 'failure', endpointId: 'primary', status: 500 }]),
        scenario('permission-denied', 'Permissions denied', [{ atMs: 0, type: 'permissions', state: 'denied', permission: 'required' }]),
        scenario('session-expired', 'Expired session', [{ atMs: 0, type: 'session', state: 'expired' }]),
    ];
}
function overlaps(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function severity(policy) { return policy?.priority === 'critical' ? 'critical' : policy?.priority === 'high' ? 'high' : 'warning'; }
export function evaluateChaosSnapshot(scenario, snapshot, state) { const failures = []; const add = (node, kind, message, evidence = {}) => failures.push({ id: `${scenario.id}:${kind}:${node.nodeId}`, scenarioId: scenario.id, nodeId: node.nodeId, kind, severity: severity(state.responsive[node.nodeId]), message, evidence }); for (const node of snapshot.nodes) {
    const policy = state.responsive[node.nodeId];
    if (node.visible && (node.rect.x < 0 || node.rect.x + node.rect.width > snapshot.viewport.width))
        add(node, 'overflow', 'Element extends beyond the viewport', { rect: node.rect, viewport: snapshot.viewport, priority: policy?.priority });
    if (node.clipped || node.textOverflow)
        add(node, 'clipped', 'Content is clipped or truncated under this reality', { clipped: node.clipped, textOverflow: node.textOverflow, priority: policy?.priority });
    if (!node.visible && policy?.priority === 'critical')
        add(node, 'hidden-critical', 'Critical responsive element is hidden', { priority: policy.priority, visibility: 'hidden' });
    if (node.reachable === false)
        add(node, 'unreachable-control', 'Control cannot be reached in this state');
    if (node.hierarchyBroken)
        add(node, 'broken-hierarchy', 'Recorded product hierarchy is broken');
} const visible = snapshot.nodes.filter((node) => node.visible); for (let a = 0; a < visible.length; a += 1)
    for (let b = a + 1; b < visible.length; b += 1)
        if (overlaps(visible[a].rect, visible[b].rect) && visible[a].rect.width * visible[a].rect.height > 0 && visible[b].rect.width * visible[b].rect.height > 0)
            failures.push({ id: `${scenario.id}:collision:${visible[a].nodeId}:${visible[b].nodeId}`, scenarioId: scenario.id, kind: 'collision', severity: severity(state.responsive[visible[a].nodeId] ?? state.responsive[visible[b].nodeId]), message: 'Visible elements collide', evidence: { nodeIds: [visible[a].nodeId, visible[b].nodeId] } }); return failures; }
export async function runChaosTesting(input) { const results = []; for (const scenario of input.scenarios) {
    try {
        await runSimulationScenario(scenario, input.adapter);
        const snapshot = await input.adapter.capture(scenario);
        const failures = evaluateChaosSnapshot(scenario, snapshot, input.state);
        results.push({ scenario, snapshot, failures, replay: [...scenario.events], status: failures.some((item) => item.severity === 'critical' || item.severity === 'high') ? 'failed' : failures.length ? 'warning' : 'passed' });
    }
    catch (error) {
        const snapshot = { viewport: { width: 0, height: 0 }, nodes: [], state: 'adapter-error' };
        results.push({ scenario, snapshot, replay: [...scenario.events], status: 'failed', failures: [{ id: `${scenario.id}:invalid-state`, scenarioId: scenario.id, kind: 'invalid-state', severity: 'critical', message: 'Chaos adapter could not apply or capture this scenario', evidence: { error: error instanceof Error ? error.message : String(error) } }] });
    }
    finally {
        await input.adapter.restore();
    }
} const createdAt = input.now ?? Date.now(); return { id: `chaos:${createdAt}`, createdAt, scenarios: results, passed: results.filter((item) => item.status === 'passed').length, warnings: results.filter((item) => item.status === 'warning').length, failed: results.filter((item) => item.status === 'failed').length, total: results.length }; }
export function chaosReportAnalysis(report) { return { schemaVersion: 1, id: report.id, kind: 'chaos-result', targetIds: [...new Set(report.scenarios.flatMap((result) => result.failures.map((failure) => failure.nodeId).filter((id) => Boolean(id))))], createdAt: report.createdAt, provider: 'froam-deterministic-chaos-v1', local: true, confidence: 1, result: structuredClone(report) }; }
//# sourceMappingURL=chaos.js.map