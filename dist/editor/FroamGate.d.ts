import { type ReactNode } from 'react';
import { type FroamStudioConfig } from '../config';
export type FroamGateProps = Pick<FroamStudioConfig, 'apiBaseUrl' | 'authProvider' | 'fetch' | 'rootSelector'> & {
    enabled?: boolean;
    initialOpen?: boolean;
    routeKey?: string;
    ownerEmails?: readonly string[] | string;
    allowLocalhost?: boolean;
    localRoutes?: readonly string[] | '*';
    fallback?: ReactNode;
    lockedFallback?: ReactNode;
};
export default function FroamGate({ apiBaseUrl, authProvider, enabled, fallback, fetch, initialOpen, localRoutes, lockedFallback, ownerEmails, rootSelector, routeKey: explicitRouteKey, allowLocalhost, }: FroamGateProps): import("react").JSX.Element;
//# sourceMappingURL=FroamGate.d.ts.map