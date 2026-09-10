export declare const SECTION_STRUCTURE_KEY = "__froam_structure__:sections";
export type SectionStructureEntry = {
    nodeId: string;
    sourcePath: string;
    parentPath: string;
    order: number;
    editorHidden?: boolean;
    exportHidden?: boolean;
    deleted?: boolean;
};
export type SectionStructureManifest = {
    version: 1;
    sections: SectionStructureEntry[];
};
type TextDraft = {
    text?: string;
};
export declare function readSectionStructureDraft(draft: TextDraft | undefined): SectionStructureManifest;
export declare function writeSectionStructureDraft(manifest: SectionStructureManifest): {
    text: string;
};
export declare function assignFreshFroamNodeIds(element: HTMLElement, idFactory?: (index: number) => string): void;
export {};
//# sourceMappingURL=section-structure.d.ts.map