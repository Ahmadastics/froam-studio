export type FroamComponentCategory = 'Navigation' | 'Hero' | 'Features' | 'Content' | 'Social proof' | 'Pricing' | 'CTA' | 'FAQ' | 'Footer' | 'Contact' | 'Team' | 'Blog';
export type FroamComponentDefinition = {
    id: string;
    category: FroamComponentCategory;
    title: string;
    summary: string;
    anatomy: string[];
    keywords: string[];
};
export declare const FROAM_COMPONENTS: FroamComponentDefinition[];
export declare const FROAM_CATEGORIES: readonly ["All", ...FroamComponentCategory[]];
export declare function createFroamLibraryComponent(componentId: string): HTMLElement | null;
//# sourceMappingURL=FroamComponentCatalog.d.ts.map