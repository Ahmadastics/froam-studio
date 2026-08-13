import { looksLikeNaturalLanguageIntent } from '../project/intelligence-context.js';
export const FROAM_INTENT_MAX_ATTEMPTS = 3;
export const initialFroamIntentState = { phase: 'idle', session: null, message: null };
const allows = (phase, accepted) => accepted.includes(phase);
export function froamIntentReducer(state, event) {
    if (event.type === 'cancel')
        return initialFroamIntentState;
    if (event.type === 'submit')
        return state.phase === 'idle' || state.phase === 'completed' || state.phase === 'error' ? { phase: 'preparing', session: event.session, message: null } : state;
    if (event.type === 'require-consent')
        return allows(state.phase, ['preparing', 'retrying']) ? { ...state, phase: 'awaiting-consent', message: null } : state;
    if (event.type === 'request')
        return allows(state.phase, ['preparing', 'awaiting-consent', 'retrying']) ? { ...state, phase: 'requesting', message: null } : state;
    if (event.type === 'plan-ready')
        return state.phase === 'requesting' ? { ...state, phase: 'plan-ready', message: null } : state;
    if (event.type === 'create-prototype')
        return state.phase === 'plan-ready' ? { ...state, phase: 'creating-prototype', message: null } : state;
    if (event.type === 'preview')
        return state.phase === 'creating-prototype' && state.session ? { phase: 'previewing', message: null, session: { ...state.session, prototypeBranchId: event.prototypeBranchId, prototypeName: event.prototypeName, changeCount: event.changeCount, rationale: event.rationale, changeSummaries: event.changeSummaries, referenceValidation: event.referenceValidation } } : state;
    if (event.type === 'adopt')
        return state.phase === 'previewing' ? { ...state, phase: 'adopting', message: null } : state;
    if (event.type === 'retry')
        return (state.phase === 'previewing' || state.phase === 'error') && state.session && state.session.attempt < state.session.maxAttempts ? { phase: 'retrying', message: null, session: { ...state.session, attempt: state.session.attempt + 1, prototypeBranchId: undefined, prototypeName: undefined, changeCount: undefined, rationale: undefined, changeSummaries: undefined, referenceValidation: undefined } } : state;
    if (event.type === 'complete')
        return state.session ? { ...state, phase: 'completed', message: event.message } : state;
    if (event.type === 'fail')
        return state.phase === 'idle' ? { phase: 'error', session: null, message: event.message } : { ...state, phase: 'error', message: event.message };
    return state;
}
export function shouldOfferAskFroam(query, knownCommandCount) {
    return knownCommandCount === 0 && looksLikeNaturalLanguageIntent(query);
}
export function froamIntentPreferences(intent) {
    const normalized = intent.toLocaleLowerCase();
    return {
        preserveDimensions: /without changing (?:its |the )?(?:size|dimensions)|keep (?:its |the )?(?:size|dimensions)|preserve (?:its |the )?(?:size|dimensions)/.test(normalized),
        preserveCopy: /without changing (?:the )?copy|keep (?:the )?copy|preserve (?:the )?copy/.test(normalized),
    };
}
export function froamIntentPrototypeName(intent) {
    const words = intent.trim().replace(/[^A-Za-z0-9\s-]/g, '').split(/\s+/).filter((word) => word.length > 2 && !/^(make|this|that|feel|more|less|without|changing|keep|its|the)$/i.test(word)).slice(0, 4);
    const label = words.length ? words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') : 'New Direction';
    return `Froam / ${label.slice(0, 48)}`;
}
export function froamIntentRetryFeedback(state) {
    const summaries = state.session?.changeSummaries?.slice(0, 6).join('; ') || 'the prior bounded proposal';
    return `Previous proposal was not adopted (${summaries}). Produce a meaningfully different approach while preserving the original instruction, scope, and constraints.`.slice(0, 1000);
}
//# sourceMappingURL=froam-intent-model.js.map