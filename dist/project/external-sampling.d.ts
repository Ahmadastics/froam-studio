import type { FroamInteractionRecipe } from './interaction-library';
export type FroamExternalSamplerCapability = 'dom' | 'computed-style' | 'events' | 'mutations' | 'animations' | 'shadow-open';
export type FroamExternalSamplerLimitation = 'cross-origin-iframe' | 'closed-shadow-dom' | 'canvas' | 'webgl' | 'video' | 'complex-svg' | 'csp' | 'framework-hidden-state' | 'server-driven-transition';
export type FroamExternalObservation = {
    elapsedMs: number;
    type: 'event' | 'frame' | 'mutation';
    role: string;
    nodeToken?: string;
    event?: string;
    mutation?: 'attributes' | 'child-list' | 'visibility';
    styles?: Record<string, string | number>;
    geometry?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    visible?: boolean;
};
export type FroamExternalSamplerMessage = {
    version: 1;
    sessionId: string;
    type: 'session-start' | 'observations' | 'session-stop' | 'error';
    origin: string;
    elapsedMs: number;
    observations?: FroamExternalObservation[];
    limitations?: FroamExternalSamplerLimitation[];
};
export type FroamExternalPermission = {
    origin: string;
    grantedAt: number;
    activeTab: true;
    userInitiated: true;
};
export declare function validateExternalPermission(permission: FroamExternalPermission, origin: string): boolean;
export declare function isSensitiveSamplingElement(input: {
    tagName: string;
    type?: string;
    autocomplete?: string;
    name?: string;
}): boolean;
export declare function sanitizeExternalObservation(observation: FroamExternalObservation): FroamExternalObservation;
export declare function validateExternalSamplerMessage(message: FroamExternalSamplerMessage, permission: FroamExternalPermission): {
    observations: FroamExternalObservation[] | undefined;
    version: 1;
    sessionId: string;
    type: "session-start" | "observations" | "session-stop" | "error";
    origin: string;
    elapsedMs: number;
    limitations?: FroamExternalSamplerLimitation[];
};
export declare function detectExternalSamplingLimitations(root: ParentNode): FroamExternalSamplerLimitation[];
export declare function externalObservationsToRecipe(input: {
    sessionId: string;
    origin: string;
    startedAt: number;
    observations: FroamExternalObservation[];
    limitations?: FroamExternalSamplerLimitation[];
    recipeId: string;
    name: string;
    projectId: string;
    branchId: string;
}): FroamInteractionRecipe;
//# sourceMappingURL=external-sampling.d.ts.map