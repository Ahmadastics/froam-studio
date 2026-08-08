export function createFlowGraph(name, nodes, transitions) {
    const graphNodes = nodes.map((node) => ({ id: node.id, kind: node.kind ?? 'screen', name: node.name, source: 'froam', locator: { routeKey: node.routeKey }, metadata: { stateType: node.stateType ?? 'normal' } }));
    const relations = transitions.map((edge) => ({ id: edge.id, kind: 'transitions-to', from: edge.from, to: edge.to, label: edge.name, condition: edge.condition }));
    return { flow: { id: `flow:${name.toLowerCase().replace(/\W+/g, '-')}`, name, nodeIds: graphNodes.map((node) => node.id), edgeIds: relations.map((edge) => edge.id), entryNodeId: graphNodes[0]?.id }, nodes: graphNodes, relations };
}
export function extendFlow(flow, node, relation) {
    return { ...flow, nodeIds: [...new Set([...flow.nodeIds, node.id])], edgeIds: relation ? [...new Set([...flow.edgeIds, relation.id])] : flow.edgeIds };
}
//# sourceMappingURL=product-flow.js.map