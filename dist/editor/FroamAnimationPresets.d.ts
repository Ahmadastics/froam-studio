import type { AnimationConfig } from './FroamAnimator';
import type { FroamInteraction } from '../project/types';
export type FroamAnimationCategory = 'Entrance' | 'Reveal' | 'Emphasis' | 'Motion' | 'Exit';
export type FroamAnimationPreset = {
    id: string;
    label: string;
    category: FroamAnimationCategory;
    description: string;
    config: Partial<AnimationConfig>;
};
export declare const FROAM_ANIMATION_PRESETS: FroamAnimationPreset[];
export declare function animationPresetInteraction(preset: FroamAnimationPreset, nodeId: string): FroamInteraction;
//# sourceMappingURL=FroamAnimationPresets.d.ts.map