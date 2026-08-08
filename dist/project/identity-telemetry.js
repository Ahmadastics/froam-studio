const methods = ['stable-id', 'registry', 'path', 'fingerprint', 'attribute-lost', 'ambiguous', 'failed', 'duplicate-prevented'];
export function createIdentityTelemetry(now = Date.now()) {
    const snapshot = { version: 1, local: true, startedAt: now, updatedAt: now, total: 0, counts: Object.fromEntries(methods.map((method) => [method, 0])) };
    return {
        record(method, count = 1, at = Date.now()) { if (!methods.includes(method) || !Number.isFinite(count) || count <= 0)
            return; snapshot.counts[method] += Math.floor(count); snapshot.total += Math.floor(count); snapshot.updatedAt = at; },
        snapshot() { return structuredClone(snapshot); },
    };
}
export function identityTelemetryRates(snapshot) { return Object.fromEntries(methods.map((method) => [method, snapshot.total ? snapshot.counts[method] / snapshot.total : 0])); }
export function aggregateIdentityDiagnostics(events, startedAt = events[0]?.at ?? Date.now()) {
    const telemetry = createIdentityTelemetry(startedAt);
    for (const event of events) {
        const method = event.type === 'stable-id-resolved' ? 'stable-id' : event.type === 'registry-resolved' ? 'registry' : event.type === 'duplicate-identity-prevented' ? 'duplicate-prevented' : event.type === 'identity-attribute-lost' ? 'attribute-lost' : event.type === 'resolved-by-path' ? 'path' : event.type === 'fingerprint-match' ? 'fingerprint' : event.type === 'ambiguous-match' ? 'ambiguous' : event.type === 'resolution-failed' ? 'failed' : null;
        if (method)
            telemetry.record(method, 1, event.at);
    }
    return telemetry.snapshot();
}
//# sourceMappingURL=identity-telemetry.js.map