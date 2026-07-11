export type FroamVersionMeta = {
    id: string;
    name: string;
    description?: string | null;
    tags?: string[];
    notes?: string | null;
    changeSummary?: FroamChangeSummary | null;
    imageRefs?: FroamImageRef[];
    isLive: boolean;
    parentVersionId?: string | null;
    createdAt: string;
    localOnly?: boolean;
    routeKey?: string;
    viewportMode?: string;
};
type FroamChangeSummary = {
    draftCount: number;
    insertedBlockCount: number;
    textCount: number;
    styleCount: number;
    imageCount: number;
    changedPaths?: string[];
};
type FroamImageRef = {
    path: string;
    kind: 'image' | 'background';
    sha256?: string;
    size?: number;
    mime?: string | null;
    preview?: string;
};
type Props = {
    routeKey: string;
    viewportMode: string;
    currentStore: Record<string, unknown>;
    getCurrentStore?: () => Record<string, unknown>;
    onLoadVersion: (store: Record<string, unknown>, versionName: string) => void;
    onClose: () => void;
    captureThumb?: () => Promise<string | null>;
};
export default function FroamVersionPanel({ routeKey, viewportMode, currentStore, getCurrentStore, onLoadVersion, onClose, captureThumb, }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamVersionPanel.d.ts.map