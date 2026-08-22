import type { FroamInteraction, FroamTimelineKeyframe } from './types';
export type LegacyAnimatorConfig = {
    name: string;
    duration: number;
    delay: number;
    iterations: number;
    direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
    easing: string;
    trigger: 'load' | 'hover' | 'click' | 'scroll';
    fillMode: 'none' | 'forwards' | 'backwards' | 'both';
    keyframes: Array<{
        id: string;
        offset: number;
        properties: Record<string, string>;
    }>;
};
export declare function legacyAnimatorToInteraction(config: LegacyAnimatorConfig, input: {
    id: string;
    sourceId: string;
    targetIds?: string[];
}): FroamInteraction;
export declare function interactionToLegacyAnimator(interaction: FroamInteraction): LegacyAnimatorConfig;
/** Stores replaceable keyframe blocks alongside canvas custom CSS. */
export declare function upsertAnimationCss(existing: string | undefined, animationName: string, css: string): string;
export declare function interactionInspectorRecord(interaction: FroamInteraction): {
    trigger: "click" | "drag" | "focus" | "load" | "scroll" | "custom" | "hover" | "press";
    source: string;
    targets: string[];
    state: {
        from: string | null;
        to: string | null;
    };
    timeline: FroamTimelineKeyframe[];
    physics: {
        preset?: string;
        stiffness?: number;
        damping?: number;
        mass?: number;
        friction?: number;
        bounce?: number;
        velocity?: number;
        resistance?: number;
        attraction?: number;
    } | null;
    sound: string | null;
    compilerTarget: string;
};
//# sourceMappingURL=animator-adapter.d.ts.map