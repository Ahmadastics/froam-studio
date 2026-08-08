/** Deterministic orchestration only. Products opt into effects through an adapter. */
export async function runSimulationScenario(scenario, adapter) {
    const ordered = [...scenario.events].sort((a, b) => a.atMs - b.atMs);
    for (const event of ordered)
        await adapter.apply(event);
    return { scenarioId: scenario.id, applied: ordered.length };
}
//# sourceMappingURL=simulation.js.map