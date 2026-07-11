export type FroamFramePreset = 'responsive' | 'desktop' | 'tablet' | 'mobile' | 'custom';
export type FroamFrameSpec = {
    preset: FroamFramePreset;
    width: number;
    height: number;
    background: string;
};
export type FroamWireframeSection = {
    id: string;
    componentId: string | null;
    name: string;
    frame: FroamFrameSpec;
};
export type FroamInsertPlacement = 'new-frame' | 'start' | 'end' | 'before' | 'after' | 'inside';
export declare const FROAM_FRAME_PRESETS: Record<Exclude<FroamFramePreset, 'custom'>, FroamFrameSpec>;
export declare function createFroamSection(componentId: string | null, name: string, frame?: FroamFrameSpec): FroamWireframeSection;
//# sourceMappingURL=FroamPlannerTypes.d.ts.map