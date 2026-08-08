import type { FroamInteraction } from './types';
export type FroamCompiledInteraction = {
    css: string;
    animation: string;
    trigger: FroamInteraction['trigger'];
    requiresRuntime: boolean;
};
/** CSS is one runtime adapter; click, scroll and gesture triggers remain explicit runtime work. */
export declare function compileInteractionToCss(interaction: FroamInteraction): FroamCompiledInteraction;
//# sourceMappingURL=interaction-runtime.d.ts.map