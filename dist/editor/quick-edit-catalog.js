/* The Quick Edit catalog: 100 concrete, pre-written instructions the editor
   offers instead of making someone phrase an edit themselves.

   Every `intent` here must be resolvable by createLocalFroamIntentProposals
   without a provider — that is what keeps Quick Edit instant and offline.
   `scripts/test-froam-intent.mjs` enforces exactly that, action by action, so
   an entry worded in a way the local resolver cannot parse fails the suite
   rather than shipping a dead button. */
const make = (category, seeds) => seeds.map(([id, label, intent, keywords = '']) => ({ id: `quick-edit:${id}`, label, intent, category, keywords }));
/* A scale of one property, e.g. every font size on offer. The id drops the
   decimal point so `line-height 1.2` stays a legal, collision-free id. */
const values = (category, prefix, label, intent, list, unit = '', keywords = '') => make(category, list.map((value) => [
    `${prefix}-${String(value).replace('.', '')}`,
    `${label} ${value}${unit}`,
    `Set ${intent} to ${value}${unit}`,
    keywords,
]));
const typography = [
    ...values('Typography', 'font-size', 'Font size', 'font size', [12, 14, 16, 18, 20, 24, 32, 48], 'px', 'text heading body scale'),
    ...values('Typography', 'font-weight', 'Font weight', 'font weight', [300, 400, 500, 600, 700, 800, 900], '', 'light regular medium semibold bold heavy'),
    ...values('Typography', 'line-height', 'Line height', 'line-height', [1.2, 1.4, 1.6], '', 'leading readable'),
    ...values('Typography', 'letter-spacing', 'Letter spacing', 'letter-spacing', [0, 1], 'px', 'tracking'),
];
const textStyle = make('Text style', [
    ['text-bold', 'Bold text', 'Make the text bold', 'strong heavy'],
    ['text-regular', 'Regular text', 'Make the text regular', 'normal weight'],
    ['text-italic', 'Italic text', 'Make the text italic', 'emphasis'],
    ['text-not-italic', 'Remove italic', 'Remove italic from the text', 'normal roman'],
    ['text-underline', 'Underline text', 'Underline the text', 'decoration'],
    ['text-no-underline', 'Remove underline', 'Remove underline from the text', 'decoration none'],
    ['text-uppercase', 'Uppercase text', 'Make the text uppercase', 'all caps'],
    ['text-lowercase', 'Lowercase text', 'Make the text lowercase', 'case'],
    ['text-capitalize', 'Capitalize text', 'Capitalize the text', 'title case'],
    ['text-align-left', 'Align text left', 'Align the text left', 'start'],
    ['text-align-center', 'Align text center', 'Align the text center', 'middle'],
    ['text-align-right', 'Align text right', 'Align the text right', 'end'],
    ['text-align-justify', 'Justify text', 'Justify the text', 'full alignment'],
    ['text-white', 'White text', 'Make the text white', 'light contrast'],
    ['text-black', 'Black text', 'Make the text black', 'dark contrast'],
]);
const layout = make('Layout', [
    ['display-flex', 'Display as flex', 'Display this as flex', 'container'],
    ['display-grid', 'Display as grid', 'Display this as grid', 'container'],
    ['display-block', 'Display as block', 'Display this as block', 'container'],
    ['direction-row', 'Arrange in a row', 'Set flex direction to row', 'horizontal side by side'],
    ['direction-column', 'Arrange in a column', 'Set flex direction to column', 'vertical stack'],
    ...['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'].map((value) => [`justify-${value}`, `Justify content ${value.replace('space-', '')}`, `Set justify-content to ${value}`, 'flex alignment spread']),
    ...['start', 'center', 'end', 'stretch', 'baseline'].map((value) => [`align-${value}`, `Align items ${value}`, `Set align-items to ${value}`, 'flex alignment']),
    ['wrap', 'Wrap items', 'Set flex-wrap to wrap', 'responsive flow'],
    ['no-wrap', 'Keep items on one line', 'Set flex-wrap to nowrap', 'responsive flow'],
    ['overflow-hidden', 'Clip overflow', 'Set overflow to hidden', 'crop'],
    ['overflow-visible', 'Show overflow', 'Set overflow to visible', 'unclip'],
]);
const spacing = make('Spacing', [
    ...[0, 4, 8, 12, 16, 24, 32, 48].map((value) => [`padding-${value}`, `Padding ${value}px`, `Set padding to ${value}px`, 'inset space']),
    ...[0, 8, 16, 24].map((value) => [`margin-${value}`, `Margin ${value}px`, `Set margin to ${value}px`, 'outer space']),
    ...[8, 16, 24].map((value) => [`gap-${value}`, `Gap ${value}px`, `Set gap to ${value}px`, 'item spacing']),
]);
const surface = make('Surface', [
    ...[0, 4, 8, 12, 16, 24].map((value) => [`radius-${value}`, `Corner radius ${value}px`, `Set corner radius to ${value}px`, 'rounded surface']),
    ['opacity-50', 'Opacity 50%', 'Set opacity to 50%', 'transparent fade'],
    ['opacity-75', 'Opacity 75%', 'Set opacity to 75%', 'transparent fade'],
    ['opacity-100', 'Opacity 100%', 'Set opacity to 100%', 'opaque visible'],
    ['shadow-soft', 'Soft shadow', 'Add a soft shadow', 'depth elevation'],
]);
const sizing = make('Sizing', [
    ['width-50', 'Width 50%', 'Set width to 50%', 'half parent'],
    ['width-100', 'Width 100%', 'Set width to 100%', 'full parent fill'],
    ['height-200', 'Height 200px', 'Set height to 200px', 'size tall'],
    ['max-width-640', 'Maximum width 640px', 'Set max-width to 640px', 'content constraint'],
    ['aspect-square', 'Square aspect ratio', 'Set aspect ratio to square', 'one to one 1:1'],
]);
const motion = make('Motion', [
    ...['up', 'down', 'left', 'right'].map((direction) => [`move-${direction}-8`, `Move ${direction} 8px`, `Move this ${direction} by 8px`, 'shift position']),
    ['rotate-minus-5', 'Rotate -5 degrees', 'Rotate this to -5 degrees', 'tilt counterclockwise'],
    ['rotate-5', 'Rotate 5 degrees', 'Rotate this to 5 degrees', 'tilt clockwise'],
    ['rotate-15', 'Rotate 15 degrees', 'Rotate this to 15 degrees', 'tilt clockwise'],
    ['scale-90', 'Scale to 90%', 'Scale this to 90%', 'shrink transform'],
    ['scale-110', 'Scale to 110%', 'Scale this to 110%', 'grow transform'],
    ['transition-none', 'Remove transition', 'Remove the transition', 'animation instant'],
]);
const cleanup = make('Cleanup', [
    ['readable', 'Improve readability', 'Make this more readable', 'accessible line height opacity'],
    ['hide', 'Hide element', 'Hide this element', 'visibility display none'],
    ['show', 'Show element', 'Show this element', 'visibility display restore'],
    ['effects-none', 'Remove visual effects', 'Remove visual effects', 'shadow border clean flat'],
    ['transform-none', 'Reset transform', 'Reset the transform', 'position rotation scale'],
]);
export const FROAM_QUICK_EDIT_ACTIONS = [
    ...typography, ...textStyle, ...layout, ...spacing, ...surface, ...sizing, ...motion, ...cleanup,
];
export const FROAM_QUICK_EDIT_CONTRIBUTION_COUNT = 100;
/* Every term must match somewhere, so "font 48" narrows rather than returning
   everything that mentions a font. Exact label beats prefix beats anywhere,
   then alphabetical, so the order stays stable between keystrokes. */
export function searchFroamQuickEdits(query, limit = 24) {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length || limit <= 0)
        return [];
    return FROAM_QUICK_EDIT_ACTIONS
        .map((action) => {
        const label = action.label.toLocaleLowerCase();
        const haystack = `${label} ${action.intent} ${action.category} ${action.keywords}`.toLocaleLowerCase();
        if (!terms.every((term) => haystack.includes(term)))
            return null;
        return { action, score: label === terms.join(' ') ? 3 : label.startsWith(terms[0]) ? 2 : 1 };
    })
        .filter((match) => match !== null)
        .sort((left, right) => right.score - left.score || left.action.label.localeCompare(right.action.label))
        .slice(0, limit)
        .map(({ action }) => action);
}
//# sourceMappingURL=quick-edit-catalog.js.map