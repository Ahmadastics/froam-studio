import { type FroamStudioConfig } from '../config';
type ElementDraft = {
    text?: string;
    imageUrl?: string;
    styles?: Record<string, string>;
};
type ViewportMode = 'desktop' | 'tablet' | 'mobile';
export type FroamLocalDesign = {
    version: number;
    updatedAt?: string | null;
    routes: Record<string, Partial<Record<ViewportMode, Record<string, ElementDraft>>>>;
};
export type FroamRuntimeProps = Pick<FroamStudioConfig, 'apiBaseUrl' | 'fetch' | 'rootSelector'> & {
    enabled?: boolean;
    routeKey?: string;
    routes?: readonly string[] | '*';
    /**
     * Repo Mode: a committed froam.design.json (see froam-studio/vite).
     * Routes present here are applied locally — no API fetch, ships with
     * the build. Routes absent fall back to the published API when
     * apiBaseUrl is configured.
     */
    design?: FroamLocalDesign | null;
    /**
     * Who wins when a route is both committed and published.
     *
     * `'repo'` (default) keeps Froam's promise of no runtime API dependency:
     * a committed route is applied from the bundle and the API is never called.
     * The cost is that publishing to a route you have already committed does
     * nothing visible, with no feedback — publish silently loses.
     *
     * `'newest'` compares the publish time against the committed design's
     * `updatedAt` and applies whichever is more recent, falling back to the
     * committed design if the request fails. Costs one small GET per route.
     * Use it when people publish from devices that can't reach a repo.
     */
    prefer?: 'repo' | 'newest';
};
export default function FroamRuntime({ apiBaseUrl, design, enabled, fetch, rootSelector, routeKey: explicitRouteKey, routes, prefer, }: FroamRuntimeProps): null;
export {};
//# sourceMappingURL=FroamRuntime.d.ts.map