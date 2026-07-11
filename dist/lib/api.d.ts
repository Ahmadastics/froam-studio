type ApiOptions = {
    method?: string;
    body?: unknown;
    cache?: boolean;
};
export declare class FroamStudioApiError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown);
}
export declare function api<T = unknown>(endpoint: string, options?: ApiOptions): Promise<T>;
export declare const apiGetFresh: <T = unknown>(endpoint: string) => Promise<T>;
export declare const apiPost: <T = unknown>(endpoint: string, body: unknown) => Promise<T>;
export declare const apiDelete: <T = unknown>(endpoint: string) => Promise<T>;
export {};
//# sourceMappingURL=api.d.ts.map