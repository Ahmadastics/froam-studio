function validate(input) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.mimeType))
        throw new Error(`Unsupported screenshot type: ${input.mimeType}`);
    if (input.width < 16 || input.height < 16 || input.data.length !== input.width * input.height * 4)
        throw new Error('Invalid decoded screenshot pixels');
    if (input.width * input.height > 20_000_000)
        throw new Error('Screenshot is too large for local reconstruction');
}
function luminance(data, offset) { return data[offset] * .2126 + data[offset + 1] * .7152 + data[offset + 2] * .0722; }
export const localScreenshotProvider = {
    id: 'froam-local-segmentation-v1', local: true,
    async reconstruct(input) {
        validate(input);
        const sampleStep = Math.max(1, Math.floor(input.width / 128));
        const rowEnergy = [];
        for (let y = 1; y < input.height; y += 1) {
            let energy = 0;
            let count = 0;
            for (let x = 0; x < input.width; x += sampleStep) {
                const here = (y * input.width + x) * 4;
                const before = ((y - 1) * input.width + x) * 4;
                energy += Math.abs(luminance(input.data, here) - luminance(input.data, before));
                count += 1;
            }
            rowEnergy[y] = energy / Math.max(1, count);
        }
        const threshold = Math.max(18, rowEnergy.reduce((sum, value = 0) => sum + value, 0) / Math.max(1, rowEnergy.length) * 2.2);
        const cuts = [0, ...rowEnergy.map((value, index) => value > threshold ? index : -1).filter((value) => value > 0 && value < input.height - 8).filter((value, index, all) => index === 0 || value - all[index - 1] > 24), input.height];
        const regions = [];
        for (let index = 0; index < cuts.length - 1; index += 1) {
            const y = cuts[index];
            const height = cuts[index + 1] - y;
            if (height < 16)
                continue;
            regions.push({ id: `region-${index}`, x: 0, y, width: input.width, height, kind: height < 100 ? 'text' : 'container', confidence: .42 });
        }
        if (!regions.length)
            regions.push({ id: 'region-0', x: 0, y: 0, width: input.width, height: input.height, kind: 'container', confidence: .3 });
        const rootId = 'screenshot-root';
        const nodes = [{ id: rootId, kind: 'frame', name: input.name ?? 'Screenshot reconstruction', source: 'imported', metadata: { width: input.width, height: input.height } }];
        const relations = [];
        const dna = [];
        for (const region of regions) {
            const id = `screenshot:${region.id}`;
            nodes.push({ id, kind: 'element', name: region.kind, parentId: rootId, source: 'imported', metadata: { reconstructionRegion: region } });
            relations.push({ id: `contains:${rootId}:${id}`, kind: 'contains', from: rootId, to: id });
            dna.push({ schemaVersion: 1, nodeId: id, capturedAt: Date.now(), structure: { parentId: rootId }, layout: { position: 'absolute', ...region }, semantics: { role: region.kind, confidence: region.confidence }, provenance: { source: 'screenshot', provider: this.id } });
        }
        const analysis = { schemaVersion: 1, id: `screenshot:${Date.now()}`, kind: 'screenshot-reconstruction', targetIds: nodes.map((node) => node.id), createdAt: Date.now(), provider: this.id, local: true, confidence: regions.reduce((sum, region) => sum + region.confidence, 0) / regions.length, result: { width: input.width, height: input.height, regionCount: regions.length, disclaimer: 'Visual/structural reconstruction; original source code is not recovered.' } };
        return { analysis, nodes, relations, dna, regions };
    },
};
//# sourceMappingURL=screenshot-reconstruction.js.map