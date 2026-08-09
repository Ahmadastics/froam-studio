import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Brain, Clapperboard, Eye, History, Network, Play, Pause, ScanSearch, Upload, Waves, X } from 'lucide-react';
import { appendProjectEvents, createProjectEvent, deriveBranchState } from '../project/event-log.js';
import { scanDomTree, dnaFromScan } from '../project/scan.js';
import { createArchiveItem, searchArchive } from '../project/archive.js';
import { archaeologyForNode } from '../project/archaeology.js';
import { createFlowGraph } from '../project/product-flow.js';
import { predictAttention } from '../project/attention.js';
import { analyzeVisualRhythm } from '../project/rhythm.js';
import { defaultResponsivePolicy, observeResponsiveState, responsiveSuggestions } from '../project/responsive.js';
import { applyVisualDiff, compareScreenshotPixels, localScreenshotProvider } from '../project/screenshot-reconstruction.js';
export default function FroamIntelligence(props) {
    const [tab, setTab] = useState(() => { try {
        return localStorage.getItem('froam-intelligence-tab-v1') ?? 'scan';
    }
    catch {
        return 'scan';
    } });
    const [scanning, setScanning] = useState(false);
    const [archiveQuery, setArchiveQuery] = useState('');
    const [flowName, setFlowName] = useState('Primary journey');
    const [flowNodeName, setFlowNodeName] = useState('New screen');
    const [flowRoute, setFlowRoute] = useState('');
    const [attentionOverlay, setAttentionOverlay] = useState(false);
    const [cinemaPlaying, setCinemaPlaying] = useState(false);
    const [cinemaWidth, setCinemaWidth] = useState(375);
    const [cinemaSpeed, setCinemaSpeed] = useState(1);
    const [cinemaObservations, setCinemaObservations] = useState([]);
    const [screenshotBusy, setScreenshotBusy] = useState(false);
    const [lastReconstruction, setLastReconstruction] = useState(null);
    const screenshotInput = useRef(null);
    const state = useMemo(() => deriveBranchState(props.project), [props.project]);
    const selectedDna = props.selection?.nodeId ? state.dna[props.selection.nodeId] : undefined;
    const selectedPolicy = props.selection?.nodeId ? state.responsive[props.selection.nodeId] : undefined;
    const scans = Object.values(state.scans);
    const latestScans = useMemo(() => {
        const latest = new Map();
        for (const scan of scans)
            if (!latest.has(scan.node.nodeId) || latest.get(scan.node.nodeId).capturedAt < scan.capturedAt)
                latest.set(scan.node.nodeId, scan);
        return [...latest.values()];
    }, [state.scans]);
    const latestAttention = Object.values(state.analyses).filter((analysis) => analysis.kind === 'predicted-attention').sort((a, b) => b.createdAt - a.createdAt)[0];
    const ranking = (latestAttention?.result.ranking ?? []);
    useEffect(() => { if (props.requestedTab)
        setTab(props.requestedTab); }, [props.requestedTab]);
    useEffect(() => { try {
        localStorage.setItem('froam-intelligence-tab-v1', tab);
    }
    catch { /* optional preference */ } ; props.onTemporalOwnerChange?.(props.open && tab === 'responsive' ? 'breakpoint-cinema' : null); }, [tab, props.open, props.onTemporalOwnerChange]);
    function commit(inputs) {
        props.onProjectChange((current) => {
            let clock = Math.max(0, ...current.events.map((event) => event.clock));
            const events = inputs.map((input) => createProjectEvent({ projectId: current.id, branchId: current.activeBranchId, actorId: props.actorId, clock: ++clock, ...input }));
            return appendProjectEvents(current, events);
        });
    }
    function runScan() {
        if (!props.root)
            return;
        setScanning(true);
        props.onActivityChange?.('scanning');
        try {
            const bundle = scanDomTree(props.root, props.registry, { routeKey: props.routeKey, viewport: props.viewport, selectedRoot: props.selectedElement ?? undefined, maxNodes: props.selectedElement ? 260 : 600 });
            props.onRegistryChange(bundle.registry);
            const events = [];
            for (const record of bundle.records) {
                events.push({ type: 'scan.captured', payload: { scan: record }, targetIds: [record.node.nodeId], label: 'Froam Scan' });
                events.push({ type: 'dna.captured', payload: { dna: dnaFromScan(record) }, targetIds: [record.node.nodeId], label: 'Component DNA' });
            }
            for (const node of bundle.nodes)
                events.push({ type: 'node.upserted', payload: { node }, targetIds: [node.id] });
            for (const relation of bundle.relations)
                events.push({ type: 'relation.upserted', payload: { relation }, targetIds: [relation.from, relation.to] });
            commit(events);
            props.onToast(`Scan understood ${bundle.records.length} nodes${bundle.families.length ? ` and ${bundle.families.length} repeated families` : ''}`);
        }
        catch (error) {
            props.onToast(error instanceof Error ? error.message : 'Scan failed');
        }
        finally {
            setScanning(false);
            props.onActivityChange?.(null);
        }
    }
    function archiveSelection() {
        if (!props.selection?.nodeId || !selectedDna)
            return props.onToast('Scan this node before archiving it');
        const item = createArchiveItem({ id: `archive:${Date.now().toString(36)}`, nodeId: props.selection.nodeId, name: props.selection.label, actorId: props.actorId, projectId: props.project.id, branchId: props.project.activeBranchId, dna: selectedDna, html: props.selectedElement?.outerHTML, legacyPath: props.selection.path });
        commit([{ type: 'archive.upserted', payload: { archiveItem: item }, targetIds: [item.nodeId], label: `Archived ${item.name}` }]);
    }
    function removeArchive(id) { commit([{ type: 'archive.removed', payload: { archiveItemId: id }, label: 'Removed from Archive' }]); }
    function addFlowNode() {
        const existing = Object.values(state.flows)[0];
        const id = `screen:${Date.now().toString(36)}`;
        const graph = createFlowGraph(flowName, [{ id, name: flowNodeName, routeKey: flowRoute || undefined }], []);
        if (existing) {
            graph.flow.id = existing.id;
            graph.flow.nodeIds = [...new Set([...existing.nodeIds, id])];
            graph.flow.edgeIds = existing.edgeIds;
            graph.flow.entryNodeId = existing.entryNodeId ?? id;
        }
        commit([{ type: 'node.upserted', payload: { node: graph.nodes[0] }, targetIds: [id] }, { type: 'flow.upserted', payload: { flow: graph.flow }, targetIds: [id], label: 'Flow screen' }]);
    }
    function connectFlow(from, to) {
        if (!from || !to || from === to)
            return;
        const relation = { id: `transition:${from}:${to}:${Date.now().toString(36)}`, kind: 'transitions-to', from, to, label: window.prompt('Transition name', 'Continue') ?? 'Continue', condition: window.prompt('Condition (optional)', '') || undefined };
        const flow = Object.values(state.flows)[0];
        if (!flow)
            return;
        commit([{ type: 'relation.upserted', payload: { relation }, targetIds: [from, to] }, { type: 'flow.upserted', payload: { flow: { ...flow, edgeIds: [...flow.edgeIds, relation.id] } }, targetIds: [from, to], label: 'Flow transition' }]);
    }
    function runAttention() { const analysis = predictAttention(latestScans); commit([{ type: 'analysis.upserted', payload: { analysis }, targetIds: analysis.targetIds, label: 'Predicted Attention' }]); setAttentionOverlay(true); }
    function runRhythm() { const analysis = analyzeVisualRhythm(latestScans, window.innerHeight); commit([{ type: 'analysis.upserted', payload: { analysis }, targetIds: analysis.targetIds, label: 'Visual Rhythm' }]); }
    function updatePolicy(patch) {
        if (!props.selection?.nodeId)
            return;
        const policy = { ...(selectedPolicy ?? defaultResponsivePolicy(props.selection.nodeId, props.actorId)), ...patch, updatedAt: Date.now(), updatedBy: props.actorId };
        commit([{ type: 'responsive.upserted', payload: { responsive: policy }, targetIds: [policy.nodeId], label: 'Responsive priority' }]);
    }
    useEffect(() => {
        if (!cinemaPlaying)
            return;
        const timer = window.setTimeout(() => setCinemaWidth((width) => width >= 1440 ? 320 : width + 16), Math.max(30, 180 / cinemaSpeed));
        return () => window.clearTimeout(timer);
    }, [cinemaPlaying, cinemaWidth, cinemaSpeed]);
    useEffect(() => {
        if (tab !== 'responsive')
            return;
        props.onPreviewWidth(cinemaWidth);
        const frame = requestAnimationFrame(() => {
            if (!props.root)
                return;
            const observation = observeResponsiveState(props.root, props.registry, state.responsive, cinemaWidth);
            setCinemaObservations((current) => current.some((item) => item.width === observation.width) ? current : [...current, observation]);
        });
        return () => cancelAnimationFrame(frame);
    }, [cinemaWidth, tab]);
    useEffect(() => () => props.onPreviewWidth(null), []);
    async function importScreenshot(file) {
        setScreenshotBusy(true);
        props.onActivityChange?.('screenshot');
        try {
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
                throw new Error('Use a PNG, JPEG or WebP screenshot');
            const bitmap = await createImageBitmap(file);
            const imageWidth = bitmap.width;
            const imageHeight = bitmap.height;
            const canvas = document.createElement('canvas');
            canvas.width = imageWidth;
            canvas.height = imageHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context)
                throw new Error('Canvas decoding is unavailable');
            context.drawImage(bitmap, 0, 0);
            const pixels = context.getImageData(0, 0, imageWidth, imageHeight);
            bitmap.close();
            let result = await localScreenshotProvider.reconstruct({ width: imageWidth, height: imageHeight, data: pixels.data, mimeType: file.type, name: file.name, referenceId: `reference:${Date.now().toString(36)}`, metadata: { viewportWidth: imageWidth, viewportHeight: imageHeight, route: props.routeKey, label: file.name } });
            const frame = props.onInsertReconstruction(result.regions, imageWidth, imageHeight, result.rootNodeId);
            try {
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                const { toPixelData } = await import('html-to-image');
                const captured = await toPixelData(frame, { width: imageWidth, height: imageHeight, pixelRatio: 1, cacheBust: true });
                result = applyVisualDiff(result, compareScreenshotPixels({ width: imageWidth, height: imageHeight, data: pixels.data, mimeType: file.type }, { width: imageWidth, height: imageHeight, data: new Uint8ClampedArray(captured), mimeType: 'image/png' }));
            }
            catch {
                result = applyVisualDiff(result, { metric: 'normalized-rgb-mae-v1', comparable: false, largestMismatches: [], disclaimer: 'The browser could not capture the reconstruction; structure remains editable and validation can be retried.' });
            }
            const events = [{ type: 'analysis.upserted', payload: { analysis: result.analysis }, targetIds: result.analysis.targetIds, label: 'Screenshot reconstruction' }];
            for (const node of result.nodes)
                events.push({ type: 'node.upserted', payload: { node }, targetIds: [node.id] });
            for (const relation of result.relations)
                events.push({ type: 'relation.upserted', payload: { relation }, targetIds: [relation.from, relation.to] });
            for (const dna of result.dna)
                events.push({ type: 'dna.captured', payload: { dna }, targetIds: [dna.nodeId] });
            commit(events);
            setLastReconstruction(result);
            const validation = result.analysis.result.validation;
            props.onToast(`Reconstructed ${result.regions.length} editable regions${validation?.comparable ? ` · measured ${Math.round((validation.pixelSimilarity ?? 0) * 100)}% RGB similarity` : ''}`);
        }
        catch (error) {
            props.onToast(error instanceof Error ? error.message : 'Screenshot reconstruction failed');
        }
        finally {
            setScreenshotBusy(false);
            props.onActivityChange?.(null);
        }
    }
    if (!props.open)
        return null;
    const tabs = [['scan', 'Scan', ScanSearch], ['dna', 'DNA', Brain], ['archive', 'Archive', Archive], ['archaeology', 'Origins', History], ['flow', 'Flow', Network], ['attention', 'Attention', Eye], ['rhythm', 'Rhythm', Waves], ['responsive', 'Responsive', Clapperboard], ['screenshot', 'Screenshot', Upload]];
    const archaeology = props.selection?.nodeId ? archaeologyForNode(props.project, props.selection.nodeId) : null;
    const rhythm = Object.values(state.analyses).filter((analysis) => analysis.kind === 'visual-rhythm').sort((a, b) => b.createdAt - a.createdAt)[0];
    const flow = Object.values(state.flows)[0];
    const flowNodes = flow?.nodeIds.map((id) => state.nodes[id]).filter(Boolean) ?? [];
    const archiveItems = searchArchive(state.archive, archiveQuery);
    const suggestions = responsiveSuggestions(latestScans, state.responsive, cinemaWidth);
    return _jsxs(_Fragment, { children: [_jsxs("aside", { className: "froam-intelligence", "data-chef-editor-root": "true", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("strong", { children: "Froam Intelligence" }), _jsx("small", { children: "v7 \u00B7 understands locally" })] }), _jsx("button", { type: "button", onClick: () => { props.onPreviewWidth(null); props.onClose(); }, children: _jsx(X, { size: 15 }) })] }), _jsx("nav", { children: tabs.map(([id, label, Icon]) => _jsxs("button", { type: "button", className: tab === id ? 'is-active' : '', title: label, onClick: () => { if (tab === 'responsive')
                                props.onPreviewWidth(null); setTab(id); }, children: [_jsx(Icon, { size: 14 }), _jsx("span", { children: label })] }, id)) }), _jsxs("div", { className: "froam-intelligence__journey", children: [_jsx("span", { children: "Observe" }), _jsx("i", { children: "\u2192" }), _jsx("span", { children: "Understand" }), _jsx("i", { children: "\u2192" }), _jsx("span", { children: "Explain" }), _jsx("i", { children: "\u2192" }), _jsx("span", { children: "Act" })] }), _jsxs("main", { children: [tab === 'scan' && _jsxs("section", { children: [_jsx("h3", { children: "Understand this interface" }), _jsx("p", { children: "Scan measures the live DOM, maps stable identity and separates observed facts from conservative inference." }), _jsx("button", { className: "is-primary", type: "button", onClick: runScan, disabled: scanning, children: scanning ? 'Scanning…' : props.selectedElement ? `Scan ${props.selection?.label ?? 'selection'}` : 'Scan page' }), _jsxs("div", { className: "froam-intelligence__stats", children: [_jsx("b", { children: latestScans.length }), _jsx("span", { children: "understood nodes" }), _jsx("b", { children: Object.keys(state.dna).length }), _jsx("span", { children: "DNA records" })] })] }), tab === 'dna' && _jsxs("section", { children: [_jsx("h3", { children: "Component DNA" }), selectedDna ? _jsxs(_Fragment, { children: [['identity', 'structure', 'visual', 'layout', 'semantics', 'behavior', 'responsive', 'accessibility', 'history', 'usage'].map((key) => selectedDna[key] && _jsxs("details", { open: key === 'identity' || key === 'semantics', children: [_jsx("summary", { children: key }), _jsx("pre", { children: JSON.stringify(selectedDna[key], null, 2) })] }, key)), _jsxs("details", { children: [_jsx("summary", { children: "Advanced / Raw" }), _jsx("pre", { children: JSON.stringify(selectedDna, null, 2) })] })] }) : _jsx("p", { children: "Select and scan a node to inspect its DNA. Unknown fields remain unknown." })] }), tab === 'archive' && _jsxs("section", { children: [_jsxs("div", { className: "froam-intelligence__row", children: [_jsx("input", { placeholder: "Search Archive", value: archiveQuery, onChange: (event) => setArchiveQuery(event.target.value) }), _jsx("button", { type: "button", onClick: archiveSelection, children: "Add selected" })] }), _jsx("div", { className: "froam-intelligence__list", children: archiveItems.map((item) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: item.name }), _jsxs("small", { children: [String(item.dna.semantics?.role ?? 'component'), " \u00B7 used ", item.usageNodeIds.length, " times"] })] }), _jsx("button", { type: "button", disabled: !item.snapshot?.html, onClick: () => item.snapshot?.html && props.onInsertArchived(item.snapshot.html), children: "Insert" }), _jsx("button", { type: "button", onClick: () => removeArchive(item.id), children: "Remove" })] }, item.id)) }), !archiveItems.length && _jsx("p", { children: "No archived components match." })] }), tab === 'archaeology' && _jsxs("section", { children: [_jsx("h3", { children: "Design Archaeology" }), archaeology ? _jsxs(_Fragment, { children: [_jsxs("dl", { children: [_jsx("dt", { children: "Creation" }), _jsx("dd", { children: archaeology.creation ? `${archaeology.creation.actorId} · ${archaeology.creation.branchId}` : 'Unknown — no recorded creation event' }), _jsx("dt", { children: "Branch lineage" }), _jsx("dd", { children: archaeology.branchLineage.join(' → ') }), _jsx("dt", { children: "Authors" }), _jsx("dd", { children: archaeology.authors.join(', ') || 'Unknown' }), _jsx("dt", { children: "Checkpoint ancestry" }), _jsx("dd", { children: archaeology.checkpointLineage.map((checkpoint) => checkpoint.label ?? checkpoint.id).join(' ← ') || 'No recorded checkpoints' }), _jsx("dt", { children: "Derived from" }), _jsx("dd", { children: archaeology.derivedFrom.join(', ') || 'No recorded origin' })] }), _jsx("div", { className: "froam-intelligence__list", children: archaeology.edits.slice().reverse().map((edit) => _jsx("article", { children: _jsxs("div", { children: [_jsx("strong", { children: edit.label }), _jsxs("small", { children: [edit.actorId, " \u00B7 ", edit.branchId] }), edit.rationale && _jsxs("em", { children: ["Recorded reason: ", edit.rationale.text] })] }) }, edit.eventId)) })] }) : _jsx("p", { children: "Select a node to trace recorded origins. Froam never invents rationale." })] }), tab === 'flow' && _jsxs("section", { children: [_jsx("h3", { children: "Product Flow" }), _jsxs("div", { className: "froam-intelligence__grid", children: [_jsx("input", { value: flowName, onChange: (event) => setFlowName(event.target.value), placeholder: "Flow name" }), _jsx("input", { value: flowNodeName, onChange: (event) => setFlowNodeName(event.target.value), placeholder: "Screen name" }), _jsx("input", { value: flowRoute, onChange: (event) => setFlowRoute(event.target.value), placeholder: "Route, e.g. /checkout" }), _jsx("button", { type: "button", onClick: addFlowNode, children: "Add screen" })] }), _jsx("div", { className: "froam-intelligence__flow", children: flowNodes.map((node, index) => _jsxs("div", { children: [_jsxs("button", { type: "button", onClick: () => node.locator?.routeKey ? window.location.assign(node.locator.routeKey) : props.onSelectNode(node.id, node.locator?.path), children: [node.name, _jsx("small", { children: node.locator?.routeKey ?? node.kind })] }), index < flowNodes.length - 1 && _jsx("button", { className: "froam-intelligence__edge", type: "button", onClick: () => connectFlow(node.id, flowNodes[index + 1].id), children: "\u2192 connect" })] }, node.id)) })] }), tab === 'attention' && _jsxs("section", { children: [_jsx("h3", { children: "Predicted Attention" }), _jsx("p", { children: "Local heuristic estimate\u2014not eye tracking or scientific measurement." }), _jsx("button", { type: "button", className: "is-primary", onClick: runAttention, disabled: !latestScans.length, children: "Analyze attention" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: attentionOverlay, onChange: (event) => setAttentionOverlay(event.target.checked) }), " Heat overlay"] }), _jsx("ol", { children: ranking.slice(0, 12).map((item) => _jsxs("li", { onClick: () => props.onSelectNode(item.nodeId), children: [_jsx("b", { children: item.score }), _jsx("span", { children: item.role }), _jsx("small", { children: item.reasons.join(', ') })] }, item.nodeId)) }), (latestAttention?.result.warnings ?? []).map((warning) => _jsx("aside", { className: "froam-intelligence__warning", children: warning }, warning))] }), tab === 'rhythm' && _jsxs("section", { children: [_jsx("h3", { children: "Visual Rhythm" }), _jsx("button", { type: "button", className: "is-primary", onClick: runRhythm, disabled: !latestScans.length, children: "Analyze page rhythm" }), rhythm && _jsxs(_Fragment, { children: [_jsx("div", { className: "froam-intelligence__rhythm", children: (rhythm.result.sections ?? []).map((item, index) => _jsx("i", { style: { height: Math.max(8, Math.min(70, item.height / 8)) } }, index)) }), (rhythm.result.warnings ?? []).map((warning) => _jsx("aside", { className: "froam-intelligence__warning", children: warning }, warning)), _jsxs("small", { children: ["Confidence ", Math.round((rhythm.confidence ?? 0) * 100), "%"] })] })] }), tab === 'responsive' && _jsxs("section", { children: [_jsx("h3", { children: "Priority Responsive" }), props.selection?.nodeId ? _jsxs("div", { className: "froam-intelligence__grid", children: [_jsxs("label", { children: ["Priority", _jsx("select", { value: selectedPolicy?.priority ?? 'medium', onChange: (event) => updatePolicy({ priority: event.target.value }), children: ['critical', 'high', 'medium', 'low', 'decorative'].map((value) => _jsx("option", { children: value }, value)) })] }), ['canHide', 'canCollapse', 'canWrap', 'canTruncate', 'canCrop', 'canReposition'].map((key) => _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: selectedPolicy?.[key] ?? defaultResponsivePolicy('', props.actorId)[key], onChange: (event) => updatePolicy({ [key]: event.target.checked }) }), " ", key.replace('can', 'Can ')] }, key)), _jsxs("label", { children: ["Minimum useful width", _jsx("input", { type: "number", value: selectedPolicy?.minimumUsefulWidth ?? '', onChange: (event) => updatePolicy({ minimumUsefulWidth: Number(event.target.value) || undefined }) })] })] }) : _jsx("p", { children: "Select a node to set survival metadata." }), _jsx("h3", { children: "Breakpoint Cinema" }), _jsxs("div", { className: "froam-intelligence__row", children: [_jsx("button", { type: "button", onClick: () => setCinemaPlaying((value) => !value), children: cinemaPlaying ? _jsx(Pause, { size: 13 }) : _jsx(Play, { size: 13 }) }), _jsx("input", { type: "range", min: "320", max: "1440", value: cinemaWidth, onChange: (event) => setCinemaWidth(Number(event.target.value)) }), _jsxs("b", { children: [cinemaWidth, "px"] }), _jsx("select", { value: cinemaSpeed, onChange: (event) => setCinemaSpeed(Number(event.target.value)), children: [1, 2, 4].map((speed) => _jsxs("option", { value: speed, children: [speed, "x"] }, speed)) })] }), _jsx("div", { className: "froam-intelligence__markers", children: cinemaObservations.filter((item) => item.markers.length).map((item) => _jsxs("button", { type: "button", onClick: () => setCinemaWidth(item.width), children: [_jsxs("b", { children: [item.width, "px"] }), item.markers.join(' · ')] }, item.width)) }), suggestions.map((suggestion) => _jsxs("aside", { children: [_jsx("b", { children: suggestion.action }), " ", suggestion.reason] }, `${suggestion.nodeId}:${suggestion.action}`))] }), tab === 'screenshot' && _jsxs("section", { children: [_jsx("h3", { children: "Observe \u2192 Understand \u2192 Validate" }), _jsx("p", { children: "Experimental local reconstruction extracts observable regions and available browser OCR, creates normal Froam/DNA nodes, renders them, then reports an equal-size RGB difference. It does not recover original source code." }), _jsx("button", { type: "button", className: "is-primary", onClick: () => screenshotInput.current?.click(), disabled: screenshotBusy, children: screenshotBusy ? 'Reconstructing and validating…' : 'Import screenshot' }), _jsx("input", { ref: screenshotInput, hidden: true, type: "file", accept: "image/png,image/jpeg,image/webp", onChange: (event) => { const file = event.target.files?.[0]; if (file)
                                            void importScreenshot(file); event.target.value = ''; } }), lastReconstruction && _jsxs(_Fragment, { children: [_jsxs("dl", { children: [_jsx("dt", { children: "OCR" }), _jsx("dd", { children: lastReconstruction.ocr[0]?.available ? `${lastReconstruction.ocr[0].lines.length} detected lines` : 'Unavailable — text remains unknown' }), _jsx("dt", { children: "References" }), _jsxs("dd", { children: [lastReconstruction.references.length, " \u00B7 multi-reference model"] }), _jsx("dt", { children: "Similarity" }), _jsx("dd", { children: lastReconstruction.analysis.result.validation?.comparable ? `${Math.round((lastReconstruction.analysis.result.validation.pixelSimilarity) * 100)}% normalized RGB agreement` : 'Capture not comparable' }), _jsx("dt", { children: "Largest mismatches" }), _jsxs("dd", { children: [(lastReconstruction.analysis.result.validation?.largestMismatches?.length ?? 0), " measured tiles"] })] }), _jsx("small", { children: "Similarity is a transparent pixel-error metric, not a claim of perceptual or source equivalence." })] }), _jsxs("dl", { children: [_jsx("dt", { children: "Provider" }), _jsx("dd", { children: "froam-local-reconstruction-v2" }), _jsx("dt", { children: "Data boundary" }), _jsx("dd", { children: "Pixels stay in this browser. No source, credentials or image data is uploaded." })] })] })] })] }), attentionOverlay && _jsx("div", { className: "froam-attention-overlay", "data-chef-editor-root": "true", children: ranking.slice(0, 12).map((item) => { const element = props.root?.querySelector(`[data-froam-id="${CSS.escape(item.nodeId)}"]`); const rect = element?.getBoundingClientRect(); return rect ? _jsx("i", { style: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, opacity: Math.max(.12, item.score / 125) }, children: _jsx("b", { children: item.rank }) }, item.nodeId) : null; }) })] });
}
//# sourceMappingURL=FroamIntelligence.js.map