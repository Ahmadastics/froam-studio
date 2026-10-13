export type GoLiveJob = {
    id: string;
    mode: 'git' | 'publish';
    step: string;
    message: string;
    url?: string | null;
    done: boolean;
    ok?: boolean;
    outcome?: 'live' | 'pushed' | 'preview' | 'failed';
    /** What the link at the end opens, when it isn't the site (a build log). */
    linkLabel?: string;
};
type Props = {
    open: boolean;
    onClose: () => void;
    /** Save what this device has first, so what goes live is what's on screen. */
    saveFirst: () => Promise<void>;
    /** The job as the bridge last announced it (/__froam/events). */
    job: GoLiveJob | null;
    onJob: (job: GoLiveJob | null) => void;
};
export default function FroamGoLive({ open, onClose, saveFirst, job, onJob }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamGoLive.d.ts.map