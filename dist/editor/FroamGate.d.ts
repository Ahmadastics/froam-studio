import { type ReactNode } from 'react';
import { type FroamStudioConfig } from '../config';
export type FroamGateProps = Pick<FroamStudioConfig, 'apiBaseUrl' | 'authProvider' | 'fetch' | 'rootSelector' | 'rootScope'> & {
    enabled?: boolean;
    initialOpen?: boolean;
    routeKey?: string;
    /** Stable per-project key. The Froam bridge supplies this automatically. */
    projectKey?: string;
    ownerEmails?: readonly string[] | string;
    allowLocalhost?: boolean;
    localRoutes?: readonly string[] | '*';
    fallback?: ReactNode;
    lockedFallback?: ReactNode;
};
export default function FroamGate({ apiBaseUrl, authProvider, enabled, fallback, fetch, initialOpen, localRoutes, lockedFallback, ownerEmails, rootSelector, rootScope, routeKey: explicitRouteKey, projectKey: explicitProjectKey, allowLocalhost, }: FroamGateProps): import("react").JSX.Element;
//# sourceMappingURL=FroamGate.d.ts.map