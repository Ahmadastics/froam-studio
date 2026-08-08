import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Bug, GitBranch, History, Pause, Play, Plus, RotateCcw, Trash2, X, Zap } from 'lucide-react';
import { appendProjectEvents, createProjectBranch, createProjectEvent, deleteProjectBranch, deriveBranchState, renameProjectBranch, switchProjectBranch } from '../project/event-log.js';
import { nodeRegistryGraphRecords } from '../project/adapters.js';
import { materializeGraphRows } from '../project/graph-inspector.js';
import { branchReplayEvents, replayActors, replayCategory, replayEventLabel, replayStateAt } from '../project/replay.js';
import { identityHealthReport } from '../project/node-registry.js';
import { aggregateIdentityDiagnostics, identityTelemetryRates } from '../project/identity-telemetry.js';
import { interactionInspectorRecord } from '../project/animator-adapter.js';
import FroamAnimator from './FroamAnimator.js';
function mergeRegistryState(state, registry) {
    const graph = nodeRegistryGraphRecords(registry);
    return {
        ...state,
        nodes: { ...state.nodes, ...Object.fromEntries(graph.nodes.map((node) => [node.id, node])) },
        relations: { ...state.relations, ...Object.fromEntries(graph.relations.map((relation) => [relation.id, relation])) },
    };
}
export default function FroamConnectedCanvas(props) {
    const [tab, setTab] = useState('replay');
    const project = props.project;
    const setProject = props.onProjectChange;
    const [cursor, setCursor] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [actorFilter, setActorFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [branchName, setBranchName] = useState('Prototype 01');
    const [draftInteraction, setDraftInteraction] = useState(null);
    const previewing = useRef(false);
    useEffect(() => () => { if (previewing.current)
        props.onPreviewStore(null); }, [props.onPreviewStore]);
    const replayEvents = useMemo(() => branchReplayEvents(project, project.activeBranchId, {
        actorId: actorFilter || undefined,
        category: categoryFilter || undefined,
        includeBaseline: false,
    }), [project, actorFilter, categoryFilter]);
    const allBranchEvents = useMemo(() => branchReplayEvents(project, project.activeBranchId, { includeBaseline: false }), [project]);
    const actors = useMemo(() => replayActors(allBranchEvents), [allBranchEvents]);
    const previewAt = useCallback((nextCursor) => {
        const bounded = Math.max(0, Math.min(nextCursor, replayEvents.length));
        setCursor(bounded);
        previewing.current = true;
        const allowed = new Set(replayEvents.slice(0, bounded).map((event) => event.id));
        const branch = project.branches[project.activeBranchId];
        const checkpoint = project.checkpoints[branch.baseCheckpointId];
        const previewProject = { ...project, events: project.events.filter((event) => event.branchId !== project.activeBranchId || event.actorId === 'baseline' || allowed.has(event.id)) };
        props.onPreviewStore(replayStateAt(previewProject, bounded, project.activeBranchId, { includeBaseline: true }).legacyStore);
    }, [project, replayEvents, props.onPreviewStore]);
    const stopPreview = useCallback(() => {
        setPlaying(false);
        previewing.current = false;
        props.onPreviewStore(null);
    }, [props.onPreviewStore]);
    useEffect(() => {
        if (!playing)
            return;
        if (cursor >= replayEvents.length) {
            setPlaying(false);
            return;
        }
        const timer = window.setTimeout(() => previewAt(cursor + 1), Math.max(40, 700 / speed));
        return () => window.clearTimeout(timer);
    }, [playing, cursor, replayEvents.length, speed, previewAt]);
    const projectState = useMemo(() => mergeRegistryState(deriveBranchState(project), props.registry), [project, props.registry]);
    const graphRows = useMemo(() => materializeGraphRows(projectState), [projectState]);
    const selectedEntry = props.selection?.nodeId ? props.registry[props.selection.nodeId] : undefined;
    const identityHealth = useMemo(() => identityHealthReport(props.registry), [props.registry, props.diagnostics.length]);
    const identityTelemetry = useMemo(() => aggregateIdentityDiagnostics(props.diagnostics), [props.diagnostics]);
    const identityRates = useMemo(() => identityTelemetryRates(identityTelemetry), [identityTelemetry]);
    const selectedRelations = props.selection?.nodeId
        ? Object.values(projectState.relations).filter((relation) => relation.from === props.selection?.nodeId || relation.to === props.selection?.nodeId)
        : [];
    function createBranch() {
        const id = `prototype-${Date.now().toString(36)}`;
        const next = createProjectBranch(project, { id, name: branchName, actorId: props.actorId });
        setProject(next);
        props.onMaterializeBranch(deriveBranchState(next, id).legacyStore);
        props.onToast(`Created ${branchName}`);
    }
    function switchBranch(branchId) {
        stopPreview();
        const next = switchProjectBranch(project, branchId);
        setProject(next);
        props.onMaterializeBranch(deriveBranchState(next, branchId).legacyStore);
        props.onToast(`Switched to ${next.branches[branchId].name}`);
    }
    function removeBranch(branchId) {
        try {
            const next = deleteProjectBranch(project, branchId);
            setProject(next);
            if (next.activeBranchId !== project.activeBranchId)
                props.onMaterializeBranch(deriveBranchState(next).legacyStore);
        }
        catch (error) {
            props.onToast(error instanceof Error ? error.message : 'Could not delete prototype');
        }
    }
    function commitAnimation(css, inline) {
        props.onApplyAnimation(css, inline);
        if (!draftInteraction)
            return;
        const clock = Math.max(0, ...project.events.map((event) => event.clock)) + 1;
        setProject((current) => appendProjectEvents(current, [createProjectEvent({
                projectId: current.id, branchId: current.activeBranchId, actorId: props.actorId, clock,
                type: 'interaction.upserted', targetIds: [draftInteraction.sourceId, ...draftInteraction.targetIds],
                payload: { interaction: draftInteraction }, label: `Interaction: ${draftInteraction.name}`,
            })]));
    }
    if (!props.open)
        return null;
    const tabs = [
        ['replay', 'Replay', History], ['branches', 'Prototypes', GitBranch], ['node', 'Node', Bug], ['graph', 'Graph', Boxes], ['interaction', 'Interaction', Zap],
    ];
    return (_jsxs("aside", { className: "froam-connected", "data-chef-editor-root": "true", "aria-label": "Connected Canvas", children: [_jsxs("header", { className: "froam-connected__header", children: [_jsxs("div", { children: [_jsx("strong", { children: "Connected Canvas" }), _jsx("small", { children: project.branches[project.activeBranchId].name })] }), _jsx("button", { type: "button", onClick: () => { stopPreview(); props.onClose(); }, "aria-label": "Close Connected Canvas", children: _jsx(X, { size: 15 }) })] }), _jsx("nav", { className: "froam-connected__tabs", children: tabs.map(([id, label, Icon]) => _jsxs("button", { type: "button", className: tab === id ? 'is-active' : '', onClick: () => setTab(id), title: label, children: [_jsx(Icon, { size: 14 }), _jsx("span", { children: label })] }, id)) }), _jsxs("div", { className: "froam-connected__body", children: [tab === 'replay' && _jsxs("section", { className: "froam-connected__section", children: [_jsxs("div", { className: "froam-connected__controls", children: [_jsx("button", { type: "button", onClick: () => cursor >= replayEvents.length ? previewAt(0) : setPlaying((value) => !value), children: playing ? _jsx(Pause, { size: 13 }) : _jsx(Play, { size: 13 }) }), _jsx("button", { type: "button", onClick: () => previewAt(0), title: "Restart", children: _jsx(RotateCcw, { size: 13 }) }), _jsx("select", { value: speed, onChange: (event) => setSpeed(Number(event.target.value)), children: [1, 4, 10, 20].map((value) => _jsxs("option", { value: value, children: [value, "x"] }, value)) }), _jsx("button", { type: "button", onClick: stopPreview, children: "Live" })] }), _jsx("input", { className: "froam-connected__range", type: "range", min: 0, max: replayEvents.length, value: Math.min(cursor, replayEvents.length), onChange: (event) => previewAt(Number(event.target.value)) }), _jsxs("div", { className: "froam-connected__filters", children: [_jsxs("select", { value: actorFilter, onChange: (event) => { setActorFilter(event.target.value); setCursor(0); }, children: [_jsx("option", { value: "", children: "Everyone" }), actors.map((actor) => _jsx("option", { value: actor, children: actor }, actor))] }), _jsxs("select", { value: categoryFilter, onChange: (event) => { setCategoryFilter(event.target.value); setCursor(0); }, children: [_jsx("option", { value: "", children: "All changes" }), ['structural', 'styling', 'text', 'interaction'].map((category) => _jsx("option", { value: category, children: category }, category))] })] }), _jsx("div", { className: "froam-connected__timeline", children: replayEvents.map((event, index) => _jsxs("button", { type: "button", className: index < cursor ? 'is-past' : '', onClick: () => previewAt(index + 1), children: [_jsx("span", { children: replayEventLabel(event) }), _jsxs("small", { children: [event.actorId, " \u00B7 ", replayCategory(event)] })] }, event.id)) }), !replayEvents.length && _jsx("p", { className: "froam-connected__empty", children: "No replayable changes match this filter." })] }), tab === 'branches' && _jsxs("section", { className: "froam-connected__section", children: [_jsxs("div", { className: "froam-connected__create", children: [_jsx("input", { value: branchName, onChange: (event) => setBranchName(event.target.value), maxLength: 80 }), _jsxs("button", { type: "button", onClick: createBranch, children: [_jsx(Plus, { size: 13 }), " Fork"] })] }), _jsx("div", { className: "froam-connected__branches", children: Object.values(project.branches).map((branch) => _jsxs("div", { className: branch.id === project.activeBranchId ? 'is-active' : '', children: [_jsxs("button", { type: "button", onClick: () => switchBranch(branch.id), children: [_jsx("strong", { children: branch.name }), _jsxs("small", { children: [branch.parentBranchId ? `from ${project.branches[branch.parentBranchId]?.name ?? branch.parentBranchId}` : 'Primary', branch.forkEventId ? ` · fork ${branch.forkEventId.slice(0, 7)}` : ''] })] }), _jsx("button", { type: "button", title: "Rename", onClick: () => { const name = window.prompt('Prototype name', branch.name); if (name)
                                                setProject(renameProjectBranch(project, branch.id, name)); }, children: "Aa" }), branch.id !== 'main' && _jsx("button", { type: "button", title: "Delete", onClick: () => removeBranch(branch.id), children: _jsx(Trash2, { size: 12 }) })] }, branch.id)) })] }), tab === 'node' && _jsxs("section", { className: "froam-connected__section", children: [props.selection ? _jsxs("div", { className: "froam-connected__inspector", children: [_jsxs("label", { children: ["Node ID", _jsx("code", { children: props.selection.nodeId ?? 'not captured' })] }), _jsxs("label", { children: ["Current path", _jsx("code", { children: props.selection.path })] }), _jsxs("label", { children: ["Identity source", _jsx("strong", { children: selectedEntry?.source ?? 'legacy path' })] }), _jsxs("label", { children: ["Resolved by", _jsx("strong", { children: selectedEntry?.lastResolution ?? 'selection capture' })] }), _jsxs("label", { children: ["Fingerprint", _jsx("strong", { children: selectedEntry?.fingerprint ? 'healthy' : 'unavailable' })] }), _jsxs("label", { children: ["Route / viewport", _jsxs("strong", { children: [selectedEntry?.routeKey ?? props.routeKey, " \u00B7 ", selectedEntry?.viewport ?? props.viewport] })] }), _jsxs("label", { children: ["Recoveries", _jsx("strong", { children: selectedEntry?.recoveryCount ?? 0 })] }), _jsxs("label", { children: ["Relationships", _jsx("strong", { children: selectedRelations.length })] })] }) : _jsx("p", { className: "froam-connected__empty", children: "Select a node to inspect its stable identity." }), _jsx("h4", { children: "Recovery diagnostics" }), _jsxs("div", { className: "froam-connected__inspector", children: [_jsxs("label", { children: ["Stable resolution", _jsxs("strong", { children: [identityHealth.stablePercent.toFixed(1), "%"] })] }), _jsxs("label", { children: ["Path fallback", _jsx("strong", { children: identityHealth.counts.path })] }), _jsxs("label", { children: ["Fingerprint recovery", _jsx("strong", { children: identityHealth.counts.fingerprint })] }), _jsxs("label", { children: ["Ambiguous / failed", _jsxs("strong", { children: [identityHealth.ambiguous, " / ", identityHealth.failed] })] }), _jsxs("label", { children: ["Observed path / fingerprint", _jsxs("strong", { children: [(identityRates.path * 100).toFixed(1), "% / ", (identityRates.fingerprint * 100).toFixed(1), "%"] })] }), _jsxs("label", { children: ["Local telemetry events", _jsx("strong", { children: identityTelemetry.total })] }), _jsxs("label", { children: ["Host framework", _jsx("strong", { children: props.frameworkFinding?.framework ?? 'unknown' })] }), _jsxs("label", { children: ["Adapter strategy", _jsx("strong", { children: "observable DOM \u00B7 no private internals" })] })] }), _jsx("div", { className: "froam-connected__diagnostics", children: props.diagnostics.slice(-12).reverse().map((event, index) => _jsxs("div", { children: [_jsx("strong", { children: event.type.replaceAll('-', ' ') }), _jsxs("small", { children: [event.nodeId, event.path ? ` · ${event.path}` : ''] })] }, `${event.at}-${index}`)) })] }), tab === 'graph' && _jsxs("section", { className: "froam-connected__section", children: [_jsx("p", { className: "froam-connected__hint", children: "Experimental project-graph projection. Selection is synchronized with the canvas." }), _jsx("div", { className: "froam-connected__graph", children: graphRows.map((row) => _jsxs("button", { type: "button", className: props.selection?.nodeId === row.node.id ? 'is-selected' : '', style: { paddingLeft: 10 + row.depth * 16 }, onClick: () => props.onSelectNode(row.node.id, row.node.locator?.path), children: [_jsx("span", { children: row.node.name ?? row.node.id }), _jsxs("small", { children: [row.node.kind, " \u00B7 ", row.outgoing.map((relation) => relation.kind).join(', ') || 'leaf'] })] }, row.node.id)) })] }), tab === 'interaction' && _jsxs("section", { className: "froam-connected__section", children: [_jsx(FroamAnimator, { selectedElement: props.selectedElement, selectionLabel: props.selection?.label ?? 'node', sourceNodeId: props.selection?.nodeId, onInteractionChange: setDraftInteraction, onApplyAnimation: commitAnimation, onToast: props.onToast }), draftInteraction && _jsx("pre", { className: "froam-connected__interaction", children: JSON.stringify(interactionInspectorRecord(draftInteraction), null, 2) })] })] })] }));
}
//# sourceMappingURL=FroamConnectedCanvas.js.map