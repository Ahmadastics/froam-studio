export const deterministicSyntheticUxProvider = { id: 'froam-scripted-product-flow', version: '1', local: true, run(task, context) { let nodeId = task.startNodeId; const steps = []; const relations = context.flow.edgeIds.map((id) => context.state.relations[id]).filter(Boolean); const script = task.script ?? []; const limit = Math.min(100, task.maxSteps ?? Math.max(12, script.length)); for (let index = 0; index < limit; index += 1) {
        if (task.successNodeIds.includes(nodeId))
            break;
        const scripted = script[index];
        const candidates = relations.filter((relation) => relation.from === nodeId);
        const relation = scripted?.targetId ? candidates.find((item) => item.to === scripted.targetId) : candidates[0];
        const action = scripted ?? (relation ? { type: 'click', targetId: relation.to } : { type: 'wait' });
        if (!relation) {
            steps.push({ index, atMs: index * 250, nodeId, action, outcome: candidates.length ? 'uncertain' : 'dead-end' });
            if (!scripted || action.type !== 'back')
                break;
            continue;
        }
        nodeId = relation.to;
        steps.push({ index, atMs: index * 250, nodeId, action, relationId: relation.id, outcome: task.successNodeIds.includes(nodeId) ? 'success' : action.type === 'back' ? 'backtrack' : 'advanced' });
        if (task.successNodeIds.includes(nodeId))
            break;
    } const success = task.successNodeIds.includes(nodeId); const startedAt = context.now; return { id: `synthetic:${task.id}:${startedAt}`, task: structuredClone(task), provider: `${this.id}@${this.version}`, startedAt, finishedAt: startedAt + steps.length * 250, success, steps, clicks: steps.filter((step) => step.action.type === 'click').length, backtracks: steps.filter((step) => step.outcome === 'backtrack').length, deadEnds: steps.filter((step) => step.outcome === 'dead-end').length, finalNodeId: nodeId, importantFailures: success ? [] : steps.some((step) => step.outcome === 'dead-end') ? ['Product Flow reached a dead end before the goal.'] : ['Goal was not completed within the deterministic step limit.'] }; } };
export async function runSyntheticUx(task, input) { return (input.provider ?? deterministicSyntheticUxProvider).run(task, { flow: input.flow, state: input.state, now: input.now ?? Date.now() }); }
export function syntheticRunAnalysis(run) { return { schemaVersion: 1, id: run.id, kind: 'synthetic-ux-run', targetIds: [...new Set(run.steps.map((step) => step.nodeId).filter((id) => Boolean(id)))], createdAt: run.startedAt, provider: run.provider, local: true, confidence: 1, result: structuredClone(run) }; }
export function syntheticReplay(run) { return run.steps.map((step) => ({ atMs: step.atMs, label: `${step.action.type}${step.nodeId ? ` ${step.nodeId}` : ''}`, nodeId: step.nodeId, status: step.outcome })); }
//# sourceMappingURL=synthetic-ux.js.map