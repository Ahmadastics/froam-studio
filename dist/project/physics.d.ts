import type { FroamInteraction } from './types';
export type FroamPhysicsDescription = {
    mass: number;
    stiffness: number;
    damping: number;
    friction: number;
    bounce: number;
    initialVelocity: number;
    resistance: number;
    attraction: number;
    preset?: string;
};
export type FroamPhysicsState = {
    position: number;
    velocity: number;
};
export type FroamPhysicsState2D = {
    x: FroamPhysicsState;
    y: FroamPhysicsState;
};
export declare const FROAM_PHYSICS_PRESETS: {
    readonly 'Soft Spring': {
        readonly mass: 1;
        readonly stiffness: 95;
        readonly damping: 18;
        readonly friction: 0.04;
        readonly bounce: 0.08;
        readonly initialVelocity: 0;
        readonly resistance: 0.08;
        readonly attraction: 0;
    };
    readonly Heavy: {
        readonly mass: 3.6;
        readonly stiffness: 150;
        readonly damping: 32;
        readonly friction: 0.18;
        readonly bounce: 0.02;
        readonly initialVelocity: 0;
        readonly resistance: 0.32;
        readonly attraction: 0;
    };
    readonly Elastic: {
        readonly mass: 0.7;
        readonly stiffness: 240;
        readonly damping: 9;
        readonly friction: 0.015;
        readonly bounce: 0.62;
        readonly initialVelocity: 0;
        readonly resistance: 0.03;
        readonly attraction: 0;
    };
    readonly Snappy: {
        readonly mass: 0.55;
        readonly stiffness: 390;
        readonly damping: 31;
        readonly friction: 0.06;
        readonly bounce: 0.08;
        readonly initialVelocity: 0;
        readonly resistance: 0.04;
        readonly attraction: 0;
    };
    readonly Float: {
        readonly mass: 0.55;
        readonly stiffness: 52;
        readonly damping: 9;
        readonly friction: 0.01;
        readonly bounce: 0.18;
        readonly initialVelocity: 0;
        readonly resistance: 0.015;
        readonly attraction: 0.08;
    };
    readonly Sticky: {
        readonly mass: 1.5;
        readonly stiffness: 115;
        readonly damping: 38;
        readonly friction: 0.48;
        readonly bounce: 0;
        readonly initialVelocity: 0;
        readonly resistance: 0.7;
        readonly attraction: 0.18;
    };
    readonly Magnetic: {
        readonly mass: 0.9;
        readonly stiffness: 180;
        readonly damping: 21;
        readonly friction: 0.04;
        readonly bounce: 0.12;
        readonly initialVelocity: 0;
        readonly resistance: 0.06;
        readonly attraction: 0.8;
    };
    readonly Rubber: {
        readonly mass: 0.8;
        readonly stiffness: 285;
        readonly damping: 13;
        readonly friction: 0.03;
        readonly bounce: 0.78;
        readonly initialVelocity: 0;
        readonly resistance: 0.04;
        readonly attraction: 0;
    };
};
export type FroamPhysicsPreset = keyof typeof FROAM_PHYSICS_PRESETS;
export declare function normalizePhysics(input: Partial<FroamPhysicsDescription>): FroamPhysicsDescription;
export declare function physicsPreset(name: FroamPhysicsPreset): FroamPhysicsDescription;
export declare function stepSpring(state: FroamPhysicsState, target: number, physicsInput: FroamPhysicsDescription, deltaSeconds: number): FroamPhysicsState;
export declare function stepSpring2D(state: FroamPhysicsState2D, target: {
    x: number;
    y: number;
}, physics: FroamPhysicsDescription, deltaSeconds: number): FroamPhysicsState2D;
export declare function simulateThrow(input: {
    position?: number;
    velocity: number;
    target: number;
    physics: FroamPhysicsDescription;
    frames?: number;
    stepSeconds?: number;
}): {
    position: number;
    velocity: number;
}[];
export declare function interactionWithPhysics(interaction: FroamInteraction, input: Partial<FroamPhysicsDescription>): FroamInteraction;
export declare function compilePhysicsRuntime(interaction: FroamInteraction): {
    kind: "froam-physics-runtime";
    version: 2;
    interactionId: string;
    physics: FroamPhysicsDescription;
    deterministicStep: string;
    fixedStepSeconds: number;
    requiresRuntime: boolean;
};
export type FroamGravityDescription = {
    mode: 'attract' | 'repel' | 'follow' | 'anchor' | 'stay-near' | 'avoid' | 'group';
    strength: number;
    radius: number;
    sourceId?: string;
    targetId?: string;
    labOnly?: boolean;
};
export declare function gravityForce(input: FroamGravityDescription, source: {
    x: number;
    y: number;
}, target: {
    x: number;
    y: number;
}): {
    x: number;
    y: number;
};
export declare function interactionWithGravity(interaction: FroamInteraction, gravity: FroamGravityDescription): {
    metadata: {
        gravity: {
            version: number;
            experimental: boolean;
            mode: "attract" | "repel" | "follow" | "anchor" | "stay-near" | "avoid" | "group";
            strength: number;
            radius: number;
            sourceId?: string;
            targetId?: string;
            labOnly?: boolean;
        };
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
    feedback?: {
        soundAssetId?: import("./types").FroamId;
        soundOffsetMs?: number;
        volume?: number;
        pitch?: number;
        haptic?: "light" | "medium" | "heavy" | "success";
    };
};
//# sourceMappingURL=physics.d.ts.map