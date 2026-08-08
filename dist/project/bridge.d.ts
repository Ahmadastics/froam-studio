import { type FroamProjectFile } from './serialization';
export declare function loadProjectFromBridge(fetchImpl?: typeof fetch): Promise<FroamProjectFile | null>;
export declare function saveProjectToBridge(project: FroamProjectFile, fetchImpl?: typeof fetch): Promise<{
    success?: boolean;
    error?: string;
}>;
//# sourceMappingURL=bridge.d.ts.map