export type FroamQuickEditCategory = 'Typography' | 'Text style' | 'Layout' | 'Spacing' | 'Surface' | 'Sizing' | 'Motion' | 'Cleanup';
export type FroamQuickEditAction = {
    id: string;
    label: string;
    intent: string;
    category: FroamQuickEditCategory;
    keywords: string;
};
export declare const FROAM_QUICK_EDIT_ACTIONS: FroamQuickEditAction[];
export declare const FROAM_QUICK_EDIT_CONTRIBUTION_COUNT = 100;
export declare function searchFroamQuickEdits(query: string, limit?: number): FroamQuickEditAction[];
//# sourceMappingURL=quick-edit-catalog.d.ts.map