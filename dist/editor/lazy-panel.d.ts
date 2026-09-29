import { type ComponentType } from 'react';
/**
 * A panel whose code loads the first time it's wanted, not when the editor
 * opens. Most people never open Versions or Experiments in a session; they
 * shouldn't wait for them.
 *
 * `mountWhen` is for panels that stay mounted and hide themselves (they
 * return null while closed): nothing mounts — or downloads — until the first
 * time it says yes, and from then on the panel stays mounted, keeping its
 * state and its own closing behaviour exactly as before.
 */
export declare function lazyPanel<P extends object>(load: () => Promise<{
    default: ComponentType<P>;
}>, options?: {
    mountWhen?: (props: P) => boolean;
}): (props: P) => import("react").JSX.Element | null;
//# sourceMappingURL=lazy-panel.d.ts.map