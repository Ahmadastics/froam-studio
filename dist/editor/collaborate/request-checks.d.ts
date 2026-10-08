export type RequestCheck = {
    path: string;
    /** "Heading “Plan a trip”". */
    label: string;
    kind: 'contrast' | 'overflow' | 'clipped' | 'image' | 'alt' | 'link' | 'small-text';
    severity: 'fail' | 'warn';
    message: string;
};
/**
 * What a reviewer would want to know before approving: can people read it,
 * does it fit, do images and links work. Runs on the page as previewed, so
 * it judges what people will actually see, at this screen size.
 */
export declare function checkRequestOnPage(root: HTMLElement, paths: readonly string[], { viewport }?: {
    viewport?: string;
}): RequestCheck[];
//# sourceMappingURL=request-checks.d.ts.map