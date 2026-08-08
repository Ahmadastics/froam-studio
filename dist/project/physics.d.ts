import type { FroamInteraction } from './types';
export type FroamPhysicsDescription = {
    mass: number;
    stiffness: number;
    damping: number;
    friction?: number;
    bounce?: number;
    initialVelocity?: number;
};
export type FroamPhysicsState = {
    position: number;
    velocity: number;
};
export declare function normalizePhysics(input: Partial<FroamPhysicsDescription>): FroamPhysicsDescription;
export declare function stepSpring(state: FroamPhysicsState, target: number, physics: FroamPhysicsDescription, deltaSeconds: number): FroamPhysicsState;
export declare function interactionWithPhysics(interaction: FroamInteraction, input: Partial<FroamPhysicsDescription>): FroamInteraction;
export declare function compilePhysicsRuntime(interaction: FroamInteraction): {
    kind: "froam-physics-runtime";
    version: 1;
    interactionId: string;
    physics: FroamPhysicsDescription;
    deterministicStep: string;
    requiresRuntime: boolean;
};
export type FroamGravityDescription = {
    mode: 'attract-cursor' | 'repel-cursor' | 'follow-target';
    strength: number;
    radius: number;
    targetId?: string;
};
//# sourceMappingURL=physics.d.ts.map