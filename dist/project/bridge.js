import { bridgeUrl } from '../lib/bridge.js';
import { coerceFroamProjectFile, isFroamProjectFile } from './serialization.js';
export async function loadProjectFromBridge(fetchImpl = fetch) {
    const response = await fetchImpl(bridgeUrl('/__froam/repo/project/load'), { cache: 'no-store' });
    if (!response.ok)
        throw new Error(`Could not load Froam project (${response.status})`);
    const payload = await response.json();
    return coerceFroamProjectFile(payload.project);
}
export async function saveProjectToBridge(project, fetchImpl = fetch) {
    if (!isFroamProjectFile(project))
        throw new Error('Cannot save an invalid Froam project');
    const response = await fetchImpl(bridgeUrl('/__froam/repo/project/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success)
        throw new Error(payload.error || `Could not save Froam project (${response.status})`);
    return payload;
}
//# sourceMappingURL=bridge.js.map