/**
 * One canonical form for route keys so a design edited at `/page`,
 * `/page/` or `/page/index.html` applies at ALL of them — servers
 * disagree about trailing slashes, the design must not care.
 * KEEP IN SYNC with normalizeRouteKey in lib/codegen.mjs.
 */
export declare function normalizeFroamRouteKey(value: string | null | undefined): string;
export declare function getCurrentRouteKey(explicitRouteKey?: string): string;
export declare function useFroamRouteKey(explicitRouteKey?: string): string;
//# sourceMappingURL=routing.d.ts.map