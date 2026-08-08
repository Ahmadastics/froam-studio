import { deriveBranchState } from './event-log.js';
import { dnaFromScan, dnaProjectionHash } from './scan.js';
const utf8Bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function contentId(serialized) { let a = 0x811c9dc5; let b = 0x9e3779b9; for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
} return `blob:${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}:${serialized.length}`; }
/** Content-addressed storage only: unpacking must reproduce the exact canonical event document. */
export function packProjectDocument(project, thresholdBytes = 384) {
    const checkpointDnaFromScans = {};
    const checkpoints = Object.fromEntries(Object.entries(project.checkpoints).map(([checkpointId, checkpoint]) => {
        const scans = new Map(Object.values(checkpoint.state.scans).map((scan) => [scan.node.nodeId, scan]));
        const dna = { ...checkpoint.state.dna };
        const projected = [];
        for (const [nodeId, record] of Object.entries(dna)) {
            const scan = scans.get(nodeId);
            const marker = record.provenance?._froamProjection;
            const markedProjection = scan && marker?.kind === 'scan-derived-v1' && marker.scanId === scan.id && marker.hash === dnaProjectionHash(record);
            // The equality fallback migrates DNA written before v7.2. New records use the cheap fingerprint path.
            const legacyProjection = scan && !marker && JSON.stringify(dnaFromScan(scan)) === JSON.stringify(record);
            if (markedProjection || legacyProjection) {
                delete dna[nodeId];
                projected.push(nodeId);
            }
        }
        if (projected.length)
            checkpointDnaFromScans[checkpointId] = projected;
        return [checkpointId, projected.length ? { ...checkpoint, state: { ...checkpoint.state, dna } } : checkpoint];
    }));
    const storageProject = Object.keys(checkpointDnaFromScans).length ? { ...project, checkpoints } : project;
    const blobs = [];
    const blobIds = [];
    const blobKeys = new Map();
    const references = new Map();
    const counts = new Map();
    const count = (value) => { if (typeof value === 'string') {
        if (value.length >= Math.min(48, thresholdBytes))
            counts.set(value, (counts.get(value) ?? 0) + 1);
        return;
    } if (!value || typeof value !== 'object')
        return; for (const item of Array.isArray(value) ? value : Object.values(value))
        count(item); };
    count(storageProject);
    const encode = (value, root = false) => {
        if (value === null || typeof value === 'number' || typeof value === 'boolean')
            return value;
        const encoded = typeof value === 'string' ? value : Array.isArray(value) ? value.map((item) => item === undefined ? null : encode(item)) : Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && typeof item !== 'function').map(([key, item]) => [key, encode(item)]));
        if (root)
            return encoded;
        const serialized = typeof value === 'string' ? value : undefined;
        const occurrences = serialized ? counts.get(serialized) ?? 0 : 0;
        const referenceCost = 64;
        const shouldStore = Boolean(serialized) && (occurrences > 1 && (occurrences - 1) * serialized.length > occurrences * referenceCost || typeof value === 'string' && serialized.length >= 8192);
        if (!shouldStore)
            return encoded;
        const known = references.get(serialized);
        if (known)
            return known;
        let id = contentId(serialized);
        let suffix = 0;
        while (blobKeys.has(id) && blobKeys.get(id) !== serialized)
            id = `${contentId(serialized)}:${++suffix}`;
        const index = blobs.length;
        blobs.push(encoded);
        blobIds.push(id);
        blobKeys.set(id, serialized);
        const reference = { $froamBlob: index };
        references.set(serialized, reference);
        return reference;
    };
    return { kind: 'froam-packed-project', version: 1, projectId: project.id, root: encode(storageProject, true), blobIds, blobs, ...(Object.keys(checkpointDnaFromScans).length ? { projections: { checkpointDnaFromScans } } : {}) };
}
export function unpackProjectDocument(packed) {
    if (packed.kind !== 'froam-packed-project' || packed.version !== 1 || !packed.root || !Array.isArray(packed.blobs) || !Array.isArray(packed.blobIds) || packed.blobs.length !== packed.blobIds.length)
        throw new Error('Unsupported packed Froam project');
    const stack = new Set();
    const decode = (value) => {
        if (!value || typeof value !== 'object')
            return value;
        if (!Array.isArray(value) && Object.keys(value).length === 1 && Number.isSafeInteger(value.$froamBlob)) {
            const index = value.$froamBlob;
            if (index < 0 || index >= packed.blobs.length || stack.has(index))
                throw new Error('Invalid or cyclic Froam blob reference');
            stack.add(index);
            const decoded = decode(packed.blobs[index]);
            stack.delete(index);
            return decoded;
        }
        return Array.isArray(value) ? value.map(decode) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
    };
    let project = decode(packed.root);
    if (packed.projections?.checkpointDnaFromScans) {
        const checkpoints = { ...project.checkpoints };
        for (const [checkpointId, nodeIds] of Object.entries(packed.projections.checkpointDnaFromScans)) {
            const checkpoint = checkpoints[checkpointId];
            if (!checkpoint)
                throw new Error('Packed Froam projection checkpoint is missing');
            const scans = new Map(Object.values(checkpoint.state.scans).map((scan) => [scan.node.nodeId, scan]));
            const dna = { ...checkpoint.state.dna };
            for (const nodeId of nodeIds) {
                const scan = scans.get(nodeId);
                if (!scan)
                    throw new Error('Packed Froam DNA projection source is missing');
                dna[nodeId] = dnaFromScan(scan);
            }
            checkpoints[checkpointId] = { ...checkpoint, state: { ...checkpoint.state, dna } };
        }
        project = { ...project, checkpoints };
    }
    if (project.id !== packed.projectId)
        throw new Error('Packed Froam project identity mismatch');
    return project;
}
function stringDuplication(value) { const counts = new Map(); const visit = (item) => { if (typeof item === 'string')
    counts.set(item, (counts.get(item) ?? 0) + 1);
else if (Array.isArray(item))
    item.forEach(visit);
else if (item && typeof item === 'object')
    Object.values(item).forEach(visit); }; visit(value); let duplicateStringBytes = 0; let duplicatedStrings = 0; for (const [text, count] of counts)
    if (count > 1) {
        duplicatedStrings += 1;
        duplicateStringBytes += new TextEncoder().encode(text).byteLength * (count - 1);
    } return { duplicateStringBytes, duplicatedStrings }; }
export function profileProjectSize(project) {
    const state = deriveBranchState(project);
    const operations = project.events.filter((event) => event.type.startsWith('design.'));
    const screenshotMetadata = Object.values(state.analyses).filter((analysis) => analysis.kind === 'screenshot-reconstruction');
    const categories = { nodes: utf8Bytes(state.nodes), dna: utf8Bytes(state.dna), scanProvenance: utf8Bytes(state.scans), styles: utf8Bytes(Object.values(state.dna).map((dna) => ({ layout: dna.layout, visual: dna.visual }))), graphRelations: utf8Bytes(state.relations), operations: utf8Bytes(operations), checkpoints: utf8Bytes(project.checkpoints), branches: utf8Bytes(project.branches), analyses: utf8Bytes(state.analyses), responsive: utf8Bytes(state.responsive), assets: utf8Bytes(state.assets), screenshotMetadata: utf8Bytes(screenshotMetadata), interactions: utf8Bytes(state.interactions), events: utf8Bytes(project.events) };
    const totalBytes = utf8Bytes(project);
    const packedBytes = Math.min(totalBytes, utf8Bytes(packProjectDocument(project)));
    const duplicates = stringDuplication(project);
    return { totalBytes, categories, ...duplicates, packedBytes, reductionPercent: totalBytes ? (1 - packedBytes / totalBytes) * 100 : 0 };
}
//# sourceMappingURL=storage-codec.js.map