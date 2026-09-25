export declare function canApplyTextDraft(element: HTMLElement): boolean;
export declare const TEXT_VISUAL_TAGS: Set<string>;
export declare const INLINE_TEXT_CHILD_TAGS: Set<string>;
export declare const NON_WRITABLE_TAGS: Set<string>;
export declare const WRITABLE_TAGS: Set<string>;
/** Enter finishes writing in these (Shift+Enter still breaks the line); elsewhere it's a new line. */
export declare const SINGLE_LINE_TAGS: Set<string>;
/** Copy someone could want to rewrite: text tags, or any leaf that already shows text. */
export declare function isWritableElement(element: Element | null | undefined): element is HTMLElement;
export type CaretTarget = 'end' | {
    x: number;
    y: number;
    word?: boolean;
};
/** Put the caret where the person pointed (or select the word there), else at the end. */
export declare function placeCaret(element: HTMLElement, caret: CaretTarget): void;
export declare function isEditableField(target: EventTarget | null): boolean;
export declare function isTextVisualLayer(element: HTMLElement): boolean;
//# sourceMappingURL=writing.d.ts.map