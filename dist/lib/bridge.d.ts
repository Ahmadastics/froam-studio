/**
 * Repo-Mode bridge resolution.
 *
 * In a Vite app the bridge endpoints (/__froam/repo/*) live on the same
 * origin (vite plugin middleware). In standalone mode (`froam dev`) the
 * editor may be injected into a page served from a different origin, so
 * the loader records the bridge origin on window and every repo call
 * routes through it.
 */
export declare function getBridgeOrigin(): string;
export declare function bridgeUrl(path: string): string;
//# sourceMappingURL=bridge.d.ts.map