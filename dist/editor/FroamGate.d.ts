import { type ReactNode } from 'react';
import { type FroamStudioConfig } from '../config';
export type FroamGateProps = Pick<FroamStudioConfig, 'apiBaseUrl' | 'authProvider' | 'fetch' | 'rootSelector' | 'rootScope'> & {
    /**
     * true opens the editor for everyone in development; false keeps it shut.
     * A production build ignores it unless `showInProduction` is set — owners
     * signed in through `authProvider` + `ownerEmails` still get in.
     */
    enabled?: boolean;
    /**
     * Let `enabled` and localhost open the editor in a production build too.
     * Only for a page whose visitors are meant to use the editor, such as a
     * public demo.
     */
    showInProduction?: boolean;
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
export default function FroamGate({ apiBaseUrl, authProvider, enabled, fallback, fetch, initialOpen, localRoutes, lockedFallback, ownerEmails, rootSelector, rootScope, routeKey: explicitRouteKey, projectKey: explicitProjectKey, allowLocalhost, showInProduction, }: FroamGateProps): import("react").JSX.Element;
//# sourceMappingURL=FroamGate.d.ts.map