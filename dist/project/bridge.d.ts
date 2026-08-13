import { type FroamProjectFile } from './serialization';
import type { FroamIntelligenceNotConfiguredResponse, FroamIntelligenceRequest, FroamIntelligenceResponse } from './intelligence-transport';
export declare function loadProjectFromBridge(fetchImpl?: typeof fetch): Promise<FroamProjectFile | null>;
export declare function saveProjectToBridge(project: FroamProjectFile, fetchImpl?: typeof fetch): Promise<{
    success?: boolean;
    error?: string;
}>;
/**
 * Browser-safe intelligence planning client.
 * Calls the Froam bridge intelligence endpoint.
 * No provider credentials or model-specific logic lives here.
 */
export declare function requestFroamIntelligence(request: FroamIntelligenceRequest, fetchImpl?: typeof fetch, signal?: AbortSignal): Promise<FroamIntelligenceResponse | FroamIntelligenceNotConfiguredResponse>;
/** Compatibility name for the first mutation-only client. */
export declare const requestIntelligencePlan: typeof requestFroamIntelligence;
//# sourceMappingURL=bridge.d.ts.map