const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Only high-confidence observed families or explicit user choices are factored. */
export function factorComponentFamilies(families, dna, threshold = .85) {
    return families.filter((family) => family.explicit || family.confidence >= threshold).map((family) => {
        const members = family.memberNodeIds.map((id) => dna[id]).filter(Boolean);
        const first = members[0];
        const keys = ['identity', 'structure', 'layout', 'visual', 'semantics', 'behavior', 'motion', 'responsive', 'accessibility', 'provenance', 'history', 'usage', 'knowledge'];
        const sharedDna = {};
        const instanceOverrides = {};
        if (first)
            for (const key of keys)
                if (members.every((item) => equal(item[key], first[key])))
                    sharedDna[key] = first[key];
        for (const member of members) {
            const overrides = {};
            for (const key of keys)
                if (!(key in sharedDna) && member[key] !== undefined)
                    overrides[key] = member[key];
            instanceOverrides[member.nodeId] = overrides;
        }
        return { definitionId: `component-definition:${family.id}`, memberNodeIds: family.memberNodeIds, sharedDna, instanceOverrides, evidence: { signature: family.signature, confidence: family.confidence, explicit: Boolean(family.explicit) } };
    });
}
//# sourceMappingURL=structural-deduplication.js.map