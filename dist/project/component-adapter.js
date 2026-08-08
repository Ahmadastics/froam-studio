/** Projects today's catalog metadata into the shared graph without changing its factories. */
export function componentCatalogGraphRecords(definitions) {
    const nodes = definitions.map((definition) => ({
        id: definition.id,
        kind: 'component-definition',
        name: definition.title,
        source: 'froam',
        metadata: {
            category: definition.category,
            summary: definition.summary,
            anatomy: definition.anatomy ? [...definition.anatomy] : undefined,
        },
    }));
    const relations = [];
    return { nodes, relations };
}
//# sourceMappingURL=component-adapter.js.map