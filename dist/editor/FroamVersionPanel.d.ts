export type { FroamVersionMeta } from './versions-store';
type Props = {
    projectKey: string;
    routeKey: string;
    viewportMode: string;
    currentStore: Record<string, unknown>;
    getCurrentStore?: () => Record<string, unknown>;
    onLoadVersion: (store: Record<string, unknown>, versionName: string) => void;
    onClose: () => void;
    captureThumb?: () => Promise<string | null>;
};
export default function FroamVersionPanel({ projectKey, routeKey, viewportMode, currentStore, getCurrentStore, onLoadVersion, onClose, captureThumb, }: Props): import("react").JSX.Element;
//# sourceMappingURL=FroamVersionPanel.d.ts.map