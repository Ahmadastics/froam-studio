import { type Dispatch, type SetStateAction } from 'react';
import type { EditorStore, FroamViewport } from '../collab/types';
import { requestIntelligencePlan } from '../project/bridge';
import { type FroamReferenceBuildPlan, type FroamReferenceBuildTarget, type FroamReferenceBuildValidation } from '../project/reference-build';
import type { FroamReferenceUnderstanding } from '../project/reference-intelligence';
import type { FroamNodeRegistry } from '../project/node-registry';
import type { FroamIntelligenceResponse, FroamIntelligenceNotConfiguredResponse } from '../project/intelligence-transport';
import type { FroamProjectDocument } from '../project/types';
import { type FroamIntentOrigin } from './froam-intent-model';
type Selection = {
    nodeId?: string;
    path: string;
    label: string;
} | null;
type Activity = 'intent-understanding' | 'intent-creating' | 'intent-applying' | null;
type Props = {
    project: FroamProjectDocument;
    setProject: Dispatch<SetStateAction<FroamProjectDocument>>;
    actorId: string;
    routeKey: string;
    viewport: FroamViewport;
    selection: Selection;
    root: HTMLElement | null;
    selectedElement: HTMLElement | null;
    registry: FroamNodeRegistry;
    onRegistryChange: (registry: FroamNodeRegistry) => void;
    onPreviewStore: (store: EditorStore, protectRollback?: boolean) => void;
    onCommitStore: (store: EditorStore) => void;
    onActivityChange: (activity: Activity) => void;
    onToast: (message: string) => void;
    onExecuteLocalCommand?: (intent: string) => boolean;
    onValidateReference?: (plan: FroamReferenceBuildPlan, signal: AbortSignal) => Promise<FroamReferenceBuildValidation>;
    request?: (request: Parameters<typeof requestIntelligencePlan>[0], signal: AbortSignal) => Promise<FroamIntelligenceResponse | FroamIntelligenceNotConfiguredResponse>;
};
export declare function useFroamIntent(props: Props): {
    state: import("./froam-intent-model").FroamIntentState;
    submit: (input: {
        origin: FroamIntentOrigin;
        intent: string;
    }) => Promise<void>;
    submitReference: (input: {
        understanding: FroamReferenceUnderstanding;
        target: FroamReferenceBuildTarget;
        intent?: string;
    }) => Promise<void>;
    allow: () => void;
    notNow: () => void;
    keep: () => void;
    retry: () => void;
    cancel: () => void;
    dismiss: () => void;
};
export {};
//# sourceMappingURL=useFroamIntent.d.ts.map