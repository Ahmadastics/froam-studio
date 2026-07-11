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
};
export default function FroamRuntime({ apiBaseUrl, design, enabled, fetch, rootSelector, routeKey: explicitRouteKey, routes, }: FroamRuntimeProps): null;
export {};
//# sourceMappingURL=FroamRuntime.d.ts.map