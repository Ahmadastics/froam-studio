import { packProjectDocument } from './storage-codec.js';
const scope = self;
scope.onmessage = (event) => { try {
    scope.postMessage({ id: event.data.id, packed: packProjectDocument(event.data.project) });
}
catch (error) {
    scope.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Project packing failed' });
} };
//# sourceMappingURL=storage-worker.js.map