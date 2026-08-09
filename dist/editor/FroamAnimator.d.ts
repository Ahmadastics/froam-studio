import type { FroamInteraction } from '../project/types';
export type AnimatableProperty = 'opacity' | 'transform' | 'backgroundColor' | 'color' | 'boxShadow' | 'borderRadius' | 'width' | 'height' | 'clipPath' | 'filter';
export type AnimatorKeyframe = {
    id: string;
    offset: number;
    properties: Partial<Record<AnimatableProperty, string>>;
};
export type AnimationConfig = {
    name: string;
    duration: number;
    delay: number;
    iterations: number;
    direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
    easing: string;
    trigger: 'load' | 'hover' | 'click' | 'scroll';
    fillMode: 'none' | 'forwards' | 'backwards' | 'both';
    keyframes: AnimatorKeyframe[];
};
type Props = {
    selectedElement: HTMLElement | null;
    selectionLabel: string;
    onApplyAnimation: (css: string, inline: string) => void;
    onToast: (msg: string) => void;
    sourceNodeId?: string | null;
    onInteractionChange?: (interaction: FroamInteraction) => void;
    onSaveToArchive?: () => void;
};
export default function FroamAnimator({ selectedElement, selectionLabel, onApplyAnimation, onToast, sourceNodeId, onInteractionChange, onSaveToArchive }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamAnimator.d.ts.map