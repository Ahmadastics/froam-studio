import type { FroamReferenceBuildValidation } from '../project/reference-build';
export declare const FROAM_INTENT_MAX_ATTEMPTS = 3;
export type FroamIntentOrigin = 'command-palette' | 'reference' | 'responsive' | 'contextual';
export type FroamIntentPhase = 'idle' | 'preparing' | 'awaiting-consent' | 'requesting' | 'plan-ready' | 'creating-prototype' | 'previewing' | 'adopting' | 'retrying' | 'error' | 'completed';
export type FroamIntentSession = {
    id: string;
    origin: FroamIntentOrigin;
    intent: string;
    selectedNodeId: string;
    selectedPath: string;
    sourceBranchId: string;
    attempt: number;
    maxAttempts: number;
    prototypeBranchId?: string;
    prototypeName?: string;
    changeCount?: number;
    rationale?: string;
    changeSummaries?: string[];
    referenceValidation?: FroamReferenceBuildValidation;
};
export type FroamIntentState = {
    phase: FroamIntentPhase;
    session: FroamIntentSession | null;
    message: string | null;
};
export declare const initialFroamIntentState: FroamIntentState;
export type FroamIntentEvent = {
    type: 'submit';
    session: FroamIntentSession;
} | {
    type: 'require-consent';
} | {
    type: 'request';
} | {
    type: 'plan-ready';
} | {
    type: 'create-prototype';
} | {
    type: 'preview';
    prototypeBranchId: string;
    prototypeName: string;
    changeCount: number;
    rationale?: string;
    changeSummaries: string[];
    referenceValidation?: FroamReferenceBuildValidation;
} | {
    type: 'adopt';
} | {
    type: 'retry';
} | {
    type: 'complete';
    message: string;
} | {
    type: 'fail';
    message: string;
} | {
    type: 'cancel';
};
export declare function froamIntentReducer(state: FroamIntentState, event: FroamIntentEvent): FroamIntentState;
export declare function shouldOfferAskFroam(query: string, knownCommandCount: number): boolean;
export declare function froamIntentPreferences(intent: string): {
    preserveDimensions: boolean;
    preserveCopy: boolean;
};
export declare function froamIntentPrototypeName(intent: string): string;
export declare function froamIntentRetryFeedback(state: FroamIntentState): string;
//# sourceMappingURL=froam-intent-model.d.ts.map