import type { FroamAsset, FroamInteraction } from './types';
export type FroamSoundCue = {
    assetId: string;
    offsetMs: number;
    volume: number;
    pitch: number;
    timing: 'start' | 'end' | 'keyframe';
    keyframeAt?: number;
};
export type FroamSoundCollection = Record<string, FroamAsset>;
export declare function importSoundAsset(collection: FroamSoundCollection, input: {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    hash?: string;
    durationMs?: number;
}): {
    [x: string]: FroamAsset;
};
export declare function removeSoundAsset(collection: FroamSoundCollection, id: string, interactions?: readonly FroamInteraction[]): {
    [x: string]: FroamAsset;
};
export declare function attachSoundToInteraction(interaction: FroamInteraction, cue: Partial<FroamSoundCue> & {
    assetId: string;
}, collection: FroamSoundCollection): FroamInteraction;
export declare function attachHapticIntent(interaction: FroamInteraction, haptic: NonNullable<FroamInteraction['feedback']>['haptic']): {
    feedback: {
        haptic: "medium" | "light" | "heavy" | "success" | undefined;
        soundAssetId?: import("./types").FroamId;
        soundOffsetMs?: number;
        volume?: number;
        pitch?: number;
    };
    metadata: {
        hapticPortableIntent: boolean;
        hapticGuarantee: string;
    };
    id: import("./types").FroamId;
    name: string;
    sourceId: import("./types").FroamId;
    targetIds: import("./types").FroamId[];
    trigger: "load" | "hover" | "press" | "click" | "focus" | "scroll" | "drag" | "custom";
    fromState?: string;
    toState?: string;
    timeline: import("./types").FroamTimelineKeyframe[];
    durationMs?: number;
    delayMs?: number;
    physics?: {
        preset?: string;
        stiffness?: number;
        damping?: number;
        mass?: number;
        friction?: number;
        bounce?: number;
        velocity?: number;
        resistance?: number;
        attraction?: number;
    };
};
export declare function soundPreviewContract(asset: FroamAsset, input: {
    userGesture: boolean;
    volume?: number;
}): {
    assetId: string;
    url: string | undefined;
    volume: number;
    autoplay: boolean;
    requiresUserGesture: boolean;
};
//# sourceMappingURL=sound.d.ts.map