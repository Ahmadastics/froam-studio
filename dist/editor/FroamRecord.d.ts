type RecordChange = {
    label: string;
    before?: string;
    after?: string;
    page?: string;
};
export type RecordEntry = {
    seq: number;
    at: string;
    type: string;
    by: {
        name: string;
        role?: string;
        via?: string;
    };
    title?: string;
    author?: {
        name: string;
        role?: string;
    };
    pages?: string[];
    viewport?: string;
    changes?: RecordChange[];
    count?: number;
    note?: string;
    result?: string;
    refs?: Record<string, string | number>;
    hash: string;
    summary: string;
};
type Props = {
    open: boolean;
    onClose: () => void;
};
export default function FroamRecord({ open, onClose }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamRecord.d.ts.map