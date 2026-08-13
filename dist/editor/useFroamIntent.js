import { useCallback, useEffect, useReducer, useRef } from 'react';
import { requestIntelligencePlan } from '../project/bridge.js';
import { assembleFroamIntelligenceRequest } from '../project/intelligence-context.js';
import { deriveBranchState, switchProjectBranch } from '../project/event-log.js';
import { adoptMutationChanges, compareMutationBranches, createMutationPrototypeFromProposals } from '../project/mutation.js';
import { createDeterministicReferenceBuildPlan, createReferenceBuildPrototype, referenceBuildRetryFeedback } from '../project/reference-build.js';
import { dnaFromScan, scanDomTree } from '../project/scan.js';
import { readFroamIntelligenceConsent, writeFroamIntelligenceConsent } from './intelligence-consent.js';
import { createLocalFroamIntentProposals, FROAM_INTENT_MAX_ATTEMPTS, froamIntentPreferences, froamIntentPrototypeName, froamIntentReducer, froamIntentRetryFeedback, initialFroamIntentState } from './froam-intent-model.js';
function safeIntentError(error) {
    const code = error instanceof Error ? error.message : 'provider_unavailable';
    if (code === 'not_configured' || code === 'provider_unavailable')
        return 'That request needs online intelligence. Try a direct edit like “make it bolder”, “add more space”, or “make it rounder”.';
    if (code === 'no_valid_proposals')
        return "Froam couldn't find a safe change for that request.";
    if (code === 'provider_invalid_response' || code === 'invalid_request')
        return "Froam couldn't prepare a safe experiment.";
    if (code === 'identity_lost')
        return 'That element changed while Froam was preparing the experiment. Select it again and retry.';
    if (code === 'stale_context')
        return 'The interface changed while Froam was preparing this. Try again.';
    if (code === 'no_compiled_changes' || /No safe mutation proposals/.test(code))
        return "Froam couldn't find a safe change for that request.";
    return 'Froam could not prepare that change. Try a shorter, more direct instruction.';
}
export function useFroamIntent(props) {
    const [state, dispatch] = useReducer(froamIntentReducer, initialFroamIntentState);
    const stateRef = useRef(state);
    stateRef.current = state;
    const projectRef = useRef(props.project);
    projectRef.current = props.project;
    const selectionRef = useRef(props.selection);
    selectionRef.current = props.selection;
    const selectedElementRef = useRef(props.selectedElement);
    selectedElementRef.current = props.selectedElement;
    const routeRef = useRef(props.routeKey);
    routeRef.current = props.routeKey;
    const pendingRef = useRef(null);
    const abortRef = useRef(null);
    const operationRef = useRef(0);
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; operationRef.current += 1; abortRef.current?.abort(); }, []);
    useEffect(() => {
        if (state.phase === 'preparing' || state.phase === 'awaiting-consent' || state.phase === 'requesting' || state.phase === 'retrying')
            props.onActivityChange('intent-understanding');
        else if (state.phase === 'plan-ready' || state.phase === 'creating-prototype')
            props.onActivityChange('intent-creating');
        else if (state.phase === 'adopting')
            props.onActivityChange('intent-applying');
        else
            props.onActivityChange(null);
    }, [state.phase, props.onActivityChange]);
    const observeSelection = useCallback(() => {
        const selection = selectionRef.current;
        const root = props.root;
        const element = selectedElementRef.current;
        if (!selection?.nodeId || !root || !element || !root.contains(element))
            return null;
        const bundle = scanDomTree(root, props.registry, { routeKey: props.routeKey, viewport: props.viewport, selectedRoot: element, maxNodes: 48 });
        props.onRegistryChange(bundle.registry);
        const scan = bundle.records.find((record) => record.node.nodeId === selection.nodeId);
        const node = bundle.nodes.find((candidate) => candidate.id === selection.nodeId);
        if (!scan || !node || scan.node.path !== selection.path)
            return null;
        const evidenceIds = new Set([selection.nodeId, ...scan.childNodeIds, ...scan.siblingNodeIds]);
        return { node, scan, dna: dnaFromScan(scan), relationships: bundle.relations.filter((relation) => evidenceIds.has(relation.from) || evidenceIds.has(relation.to)).slice(0, 16), routeKey: props.routeKey, viewport: props.viewport, path: selection.path };
    }, [props.root, props.registry, props.routeKey, props.viewport, props.onRegistryChange]);
    const sourceContext = useCallback(() => {
        const project = projectRef.current;
        const branch = project.branches[project.activeBranchId];
        return { projectId: project.id, branchId: project.activeBranchId, baseCheckpointId: branch.baseCheckpointId, headEventId: branch.headEventId, routeKey: routeRef.current };
    }, []);
    const elementFingerprint = useCallback(() => {
        const element = selectedElementRef.current;
        return element ? JSON.stringify([element.tagName, element.getAttribute('style') ?? '', element.textContent?.slice(0, 500) ?? '', element.childElementCount]) : '';
    }, []);
    const contextIsCurrent = useCallback((pending) => {
        const project = projectRef.current;
        const branch = project.branches[pending.source.branchId];
        if (project.id !== pending.source.projectId || project.activeBranchId !== pending.source.branchId || routeRef.current !== pending.source.routeKey || !branch || branch.baseCheckpointId !== pending.source.baseCheckpointId || branch.headEventId !== pending.source.headEventId)
            return false;
        if (pending.kind === 'reference' && pending.target.routeKey !== routeRef.current)
            return false;
        if (pending.session.selectedNodeId && pending.session.selectedPath !== '__froam_root__') {
            const selection = selectionRef.current;
            if (!selection?.nodeId || selection.nodeId !== pending.session.selectedNodeId || selection.path !== pending.session.selectedPath || !selectedElementRef.current || !props.root?.contains(selectedElementRef.current))
                return false;
            if (pending.elementFingerprint !== elementFingerprint())
                return false;
        }
        return true;
    }, [elementFingerprint, props.root]);
    const previewContextIsCurrent = useCallback((pending, prototypeBranchId) => {
        const project = projectRef.current;
        const sourceBranch = project.branches[pending.source.branchId];
        if (project.id !== pending.source.projectId || project.activeBranchId !== prototypeBranchId || routeRef.current !== pending.source.routeKey || !sourceBranch || sourceBranch.baseCheckpointId !== pending.source.baseCheckpointId || sourceBranch.headEventId !== pending.source.headEventId)
            return false;
        if (pending.kind === 'reference' && pending.target.routeKey !== routeRef.current)
            return false;
        if (pending.session.selectedNodeId && pending.session.selectedPath !== '__froam_root__') {
            const selection = selectionRef.current;
            if (!selection?.nodeId || selection.nodeId !== pending.session.selectedNodeId || selection.path !== pending.session.selectedPath || !selectedElementRef.current || !props.root?.contains(selectedElementRef.current))
                return false;
        }
        return true;
    }, [props.root]);
    const startOperation = useCallback((pending) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const token = ++operationRef.current;
        const current = () => mountedRef.current && operationRef.current === token && pendingRef.current?.session.id === pending.session.id && pendingRef.current.session.attempt === pending.session.attempt;
        return { controller, current };
    }, []);
    const performRequest = useCallback(async (pending) => {
        const operation = startOperation(pending);
        dispatch({ type: 'request' });
        const request = assembleFroamIntelligenceRequest({ project: projectRef.current, intent: pending.session.intent, scope: { selectedNodeId: pending.session.selectedNodeId, selectedDomPath: pending.session.selectedPath, routeKey: props.routeKey, viewport: props.viewport }, priorAttemptFeedback: pending.feedback, requestId: `${pending.session.id}:${pending.session.attempt}`, consent: true, selectionEvidence: { node: pending.snapshot.node, scan: pending.snapshot.scan, dna: pending.snapshot.dna, relationships: pending.snapshot.relationships } });
        if (!request) {
            if (abortRef.current === operation.controller)
                abortRef.current = null;
            dispatch({ type: 'fail', message: 'Froam couldn\'t identify that element reliably. Select it again and retry.' });
            return;
        }
        try {
            const localProposals = createLocalFroamIntentProposals(pending.snapshot, pending.session.intent);
            const response = localProposals.length
                ? { schemaVersion: 1, purpose: 'mutate', provider: 'froam-local-command@1', proposals: localProposals, rationale: 'Prepared instantly on this device.', confidence: .98 }
                : props.request ? await props.request(request, operation.controller.signal) : await requestIntelligencePlan(request, fetch, operation.controller.signal);
            if (!operation.current())
                return;
            if ('configured' in response)
                throw new Error('not_configured');
            if (response.purpose !== 'mutate')
                throw new Error('provider_invalid_response');
            if (!contextIsCurrent(pending))
                throw new Error('stale_context');
            dispatch({ type: 'plan-ready' });
            dispatch({ type: 'create-prototype' });
            const sourceProject = projectRef.current;
            const branchId = `froam-intent-${Date.now().toString(36)}-${pending.session.attempt}`;
            const branchName = froamIntentPrototypeName(pending.session.intent);
            const preferences = froamIntentPreferences(pending.session.intent);
            const result = createMutationPrototypeFromProposals(sourceProject, { branchId, name: branchName, actorId: props.actorId, level: 'safe', scopeNodeIds: [pending.session.selectedNodeId], proposals: response.proposals, constraints: request.constraints, provider: response.provider, selectionSnapshot: pending.snapshot, preserveDimensions: preferences.preserveDimensions });
            if (result.compiledDesignOperationCount === 0)
                throw new Error('no_compiled_changes');
            if (!operation.current())
                return;
            projectRef.current = result.project;
            props.setProject(result.project);
            props.onPreviewStore(deriveBranchState(result.project, branchId).legacyStore, true);
            dispatch({ type: 'preview', prototypeBranchId: branchId, prototypeName: branchName, changeCount: result.compiledDesignOperationCount, rationale: response.rationale, changeSummaries: result.proposals.map((proposal) => proposal.rationale).slice(0, 6) });
        }
        catch (error) {
            if (!operation.current() || operation.controller.signal.aborted)
                return;
            dispatch({ type: 'fail', message: safeIntentError(error) });
        }
        finally {
            if (abortRef.current === operation.controller)
                abortRef.current = null;
        }
    }, [contextIsCurrent, props.actorId, props.onPreviewStore, props.request, props.routeKey, props.setProject, props.viewport, startOperation]);
    const performReference = useCallback(async (pending) => {
        const operation = startOperation(pending);
        let previewBranchId = null;
        dispatch({ type: 'request' });
        try {
            if (!contextIsCurrent(pending))
                throw new Error('stale_context');
            const sourceProject = projectRef.current;
            const plan = createDeterministicReferenceBuildPlan({ understanding: pending.understanding, target: pending.target, sourceBranchId: pending.session.sourceBranchId, attempt: pending.session.attempt, previousPrototypeBranchId: pending.previousPrototypeBranchId });
            dispatch({ type: 'plan-ready' });
            dispatch({ type: 'create-prototype' });
            const branchId = `froam-reference-${Date.now().toString(36)}-${pending.session.attempt}`;
            previewBranchId = branchId;
            const branchName = `Froam / Reference ${pending.target.label}`.slice(0, 80);
            const result = createReferenceBuildPrototype(sourceProject, { plan, branchId, name: branchName, actorId: props.actorId, selectionSnapshot: pending.snapshot });
            if (!operation.current())
                return;
            projectRef.current = result.project;
            props.setProject(result.project);
            props.onPreviewStore(deriveBranchState(result.project, branchId).legacyStore, true);
            const validation = props.onValidateReference ? await props.onValidateReference(plan, operation.controller.signal) : undefined;
            if (!operation.current())
                return;
            if (!previewContextIsCurrent(pending, branchId))
                throw new Error('stale_context');
            if (validation) {
                const project = { ...projectRef.current, metadata: { ...projectRef.current.metadata, referenceBuildValidations: [...(projectRef.current.metadata?.referenceBuildValidations ?? []), validation] } };
                projectRef.current = project;
                props.setProject(project);
            }
            const differences = validation?.differences.slice(0, 6) ?? [];
            pendingRef.current = { ...pending, previousPrototypeBranchId: branchId, feedback: validation ? referenceBuildRetryFeedback(validation) : pending.feedback };
            dispatch({ type: 'preview', prototypeBranchId: branchId, prototypeName: branchName, changeCount: plan.operations.length, rationale: validation?.successful ? 'Reference constraints and responsive health passed at measured widths.' : 'A protected native reconstruction is ready. Review measured differences before keeping it.', changeSummaries: differences.length ? differences : [`${plan.structure.length} bounded nodes`, `${plan.responsiveConstraints.length} responsive constraints`, 'Copy, brand, logos, navigation content and assets protected'], referenceValidation: validation });
        }
        catch (error) {
            if (!operation.current() || operation.controller.signal.aborted)
                return;
            if (previewBranchId && projectRef.current.branches[pending.session.sourceBranchId]) {
                const source = switchProjectBranch(projectRef.current, pending.session.sourceBranchId);
                projectRef.current = source;
                props.setProject(source);
                props.onPreviewStore(deriveBranchState(source, pending.session.sourceBranchId).legacyStore, false);
            }
            dispatch({ type: 'fail', message: safeIntentError(error) });
        }
        finally {
            if (abortRef.current === operation.controller)
                abortRef.current = null;
        }
    }, [contextIsCurrent, previewContextIsCurrent, props.actorId, props.onPreviewStore, props.onValidateReference, props.setProject, startOperation]);
    const submit = useCallback(async (input) => {
        if (stateRef.current.phase !== 'idle' && stateRef.current.phase !== 'completed' && stateRef.current.phase !== 'error')
            return;
        const intent = input.intent.trim();
        const selection = selectionRef.current;
        if (!intent)
            return;
        if (!selection?.nodeId) {
            dispatch({ type: 'fail', message: 'Select something on the canvas first.' });
            return;
        }
        const snapshot = observeSelection();
        if (!snapshot) {
            dispatch({ type: 'fail', message: "Froam couldn't identify that element reliably. Select it again and retry." });
            return;
        }
        const session = { id: `intent:${Date.now().toString(36)}`, origin: input.origin, intent, selectedNodeId: selection.nodeId, selectedPath: selection.path, sourceBranchId: projectRef.current.activeBranchId, attempt: 1, maxAttempts: FROAM_INTENT_MAX_ATTEMPTS };
        const pending = { kind: 'intelligence', session, snapshot, source: sourceContext(), elementFingerprint: elementFingerprint(), feedback: null };
        pendingRef.current = pending;
        dispatch({ type: 'submit', session });
        if (createLocalFroamIntentProposals(snapshot, intent).length === 0 && readFroamIntelligenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage) !== 'allowed') {
            dispatch({ type: 'require-consent' });
            return;
        }
        await performRequest(pending);
    }, [elementFingerprint, observeSelection, performRequest, sourceContext]);
    const submitReference = useCallback(async (input) => {
        if (stateRef.current.phase !== 'idle' && stateRef.current.phase !== 'completed' && stateRef.current.phase !== 'error')
            return;
        let snapshot;
        if (input.target.kind === 'selected') {
            const selection = selectionRef.current;
            if (!selection?.nodeId || selection.nodeId !== input.target.nodeId || selection.path !== input.target.path) {
                dispatch({ type: 'fail', message: 'Select that target again before reconstructing here.' });
                return;
            }
            snapshot = observeSelection() ?? undefined;
            if (!snapshot) {
                dispatch({ type: 'fail', message: "Froam couldn't identify that target reliably. Select it again and retry." });
                return;
            }
        }
        const session = { id: `reference-intent:${Date.now().toString(36)}`, origin: 'reference', intent: input.intent?.trim() || `Reconstruct ${input.target.label} from the supplied reference evidence`, selectedNodeId: input.target.nodeId, selectedPath: input.target.kind === 'selected' ? input.target.path : '__froam_root__', sourceBranchId: projectRef.current.activeBranchId, attempt: 1, maxAttempts: FROAM_INTENT_MAX_ATTEMPTS };
        const pending = { kind: 'reference', session, understanding: input.understanding, target: input.target, snapshot, source: sourceContext(), elementFingerprint: input.target.kind === 'selected' ? elementFingerprint() : undefined, feedback: null };
        pendingRef.current = pending;
        dispatch({ type: 'submit', session });
        await performReference(pending);
    }, [elementFingerprint, observeSelection, performReference, sourceContext]);
    const allow = useCallback(() => {
        const pending = pendingRef.current;
        if (!pending)
            return;
        writeFroamIntelligenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'allowed');
        if (pending.kind === 'intelligence')
            void performRequest(pending);
    }, [performRequest]);
    const notNow = useCallback(() => { writeFroamIntelligenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'declined'); pendingRef.current = null; dispatch({ type: 'cancel' }); }, []);
    const cancel = useCallback(() => {
        operationRef.current += 1;
        abortRef.current?.abort();
        abortRef.current = null;
        const current = stateRef.current;
        if (current.session?.sourceBranchId && projectRef.current.branches[current.session.sourceBranchId]) {
            const source = switchProjectBranch(projectRef.current, current.session.sourceBranchId);
            projectRef.current = source;
            props.setProject(source);
            props.onPreviewStore(deriveBranchState(source, current.session.sourceBranchId).legacyStore, false);
        }
        pendingRef.current = null;
        dispatch({ type: 'cancel' });
    }, [props.onPreviewStore, props.setProject]);
    const retry = useCallback(() => {
        const current = stateRef.current;
        if (!current.session)
            return;
        if (current.session.attempt >= current.session.maxAttempts) {
            dispatch({ type: 'fail', message: 'Refine your instruction to try another direction.' });
            return;
        }
        const source = switchProjectBranch(projectRef.current, current.session.sourceBranchId);
        projectRef.current = source;
        props.setProject(source);
        props.onPreviewStore(deriveBranchState(source, current.session.sourceBranchId).legacyStore, false);
        const previous = pendingRef.current;
        const feedback = current.session.origin === 'reference' && current.session.referenceValidation ? referenceBuildRetryFeedback(current.session.referenceValidation) : froamIntentRetryFeedback(current);
        const nextSession = { ...current.session, attempt: current.session.attempt + 1 };
        if (previous?.kind === 'reference') {
            const pending = { ...previous, session: nextSession, feedback, previousPrototypeBranchId: current.session.prototypeBranchId };
            pendingRef.current = pending;
            dispatch({ type: 'retry' });
            void performReference(pending);
            return;
        }
        const snapshot = previous?.kind === 'intelligence' ? previous.snapshot : observeSelection();
        if (!snapshot) {
            dispatch({ type: 'fail', message: 'That element changed while Froam was preparing the experiment. Select it again and retry.' });
            return;
        }
        const pending = previous?.kind === 'intelligence'
            ? { ...previous, session: nextSession, snapshot, feedback }
            : { kind: 'intelligence', session: nextSession, snapshot, source: sourceContext(), elementFingerprint: elementFingerprint(), feedback };
        pendingRef.current = pending;
        dispatch({ type: 'retry' });
        void performRequest(pending);
    }, [elementFingerprint, observeSelection, performReference, performRequest, props.onPreviewStore, props.setProject, sourceContext]);
    const keep = useCallback(() => {
        const current = stateRef.current;
        const session = current.session;
        if (current.phase !== 'previewing' || !session?.prototypeBranchId)
            return;
        const pending = pendingRef.current;
        if (!pending || !previewContextIsCurrent(pending, session.prototypeBranchId)) {
            if (projectRef.current.branches[session.sourceBranchId]) {
                const source = switchProjectBranch(projectRef.current, session.sourceBranchId);
                projectRef.current = source;
                props.setProject(source);
                props.onPreviewStore(deriveBranchState(source, session.sourceBranchId).legacyStore, false);
            }
            dispatch({ type: 'fail', message: 'The interface changed while Froam was preparing this. Try again.' });
            return;
        }
        dispatch({ type: 'adopt' });
        try {
            const comparison = compareMutationBranches(projectRef.current, session.sourceBranchId, session.prototypeBranchId);
            const adopted = adoptMutationChanges(projectRef.current, { mutationBranchId: session.prototypeBranchId, targetBranchId: session.sourceBranchId, eventIds: comparison.eventIds, actorId: props.actorId });
            if (adopted.status === 'refused') {
                const source = switchProjectBranch(adopted.project, session.sourceBranchId);
                projectRef.current = source;
                props.setProject(source);
                props.onPreviewStore(deriveBranchState(source, session.sourceBranchId).legacyStore, false);
                dispatch({ type: 'fail', message: "The original interface changed while this experiment was open. Froam won't overwrite the newer changes." });
                return;
            }
            const source = switchProjectBranch(adopted.project, session.sourceBranchId);
            projectRef.current = source;
            props.setProject(source);
            props.onCommitStore(deriveBranchState(source, session.sourceBranchId).legacyStore);
            pendingRef.current = null;
            const message = `Froam applied ${adopted.adoptedEventIds.filter((id) => source.events.find((event) => event.id === id)?.type === 'design.op.appended').length || session.changeCount || 1} change${(session.changeCount ?? 1) === 1 ? '' : 's'}`;
            dispatch({ type: 'complete', message });
            props.onToast(message);
        }
        catch {
            const source = switchProjectBranch(projectRef.current, session.sourceBranchId);
            projectRef.current = source;
            props.setProject(source);
            props.onPreviewStore(deriveBranchState(source, session.sourceBranchId).legacyStore, false);
            dispatch({ type: 'fail', message: "The original interface changed while this experiment was open. Froam won't overwrite the newer changes." });
        }
    }, [previewContextIsCurrent, props.actorId, props.onCommitStore, props.onPreviewStore, props.onToast, props.setProject]);
    const dismiss = useCallback(() => dispatch({ type: 'cancel' }), []);
    return { state, submit, submitReference, allow, notNow, keep, retry, cancel, dismiss };
}
//# sourceMappingURL=useFroamIntent.js.map