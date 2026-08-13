import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileImage, Plus, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { requestFroamIntelligence } from '../project/bridge.js';
import { analyzeReferenceReconstructions, createReferenceIntelligenceRequest, createResponsiveIntelligenceRequest } from '../project/reference-intelligence.js';
import { localScreenshotProvider } from '../project/screenshot-reconstruction.js';
import { FROAM_REFERENCE_ACCEPTED_TYPES, FROAM_REFERENCE_MAX_REFERENCES, readReferenceConsent, referenceQualityRows, suggestReferenceLabel, validateReferenceDimensions, validateReferenceFile, writeReferenceConsent } from './reference-workspace-model.js';
const progressSteps = ['Reading references…', 'Matching interface structure…', 'Comparing viewport behavior…', 'Building responsive understanding…'];
function safeId(value) { return value.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 64) || 'reference'; }
function findingEvidence(finding) { return finding.evidence?.filter((item) => item.origin === 'observed' || item.origin === 'inferred') ?? []; }
async function thumbnailUrl(bitmap) {
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Preview decoding is unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .72));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob)
        throw new Error('Preview decoding is unavailable');
    return URL.createObjectURL(blob);
}
export default function FroamReferenceWorkspace(props) {
    const inputRef = useRef(null);
    const urlsRef = useRef(new Set());
    const cancelledRef = useRef(false);
    const mountedRef = useRef(true);
    const insightAbortRef = useRef(null);
    const insightGenerationRef = useRef(0);
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [dropActive, setDropActive] = useState(false);
    const [expandedEvidence, setExpandedEvidence] = useState(null);
    const [consent, setConsent] = useState(() => readReferenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage));
    const [consentPrompt, setConsentPrompt] = useState(false);
    const [insightBusy, setInsightBusy] = useState(false);
    const [insights, setInsights] = useState([]);
    const [providerMessage, setProviderMessage] = useState('');
    useEffect(() => () => { mountedRef.current = false; cancelledRef.current = true; insightGenerationRef.current += 1; insightAbortRef.current?.abort(); for (const url of urlsRef.current)
        URL.revokeObjectURL(url); urlsRef.current.clear(); }, []);
    const understanding = useMemo(() => {
        if (!items.length)
            return null;
        try {
            return analyzeReferenceReconstructions({ schemaVersion: 1, id: `reference-set:${props.project.id}`, label: 'Project references', references: items.map((item) => item.reference) }, items.map((item) => item.reconstruction));
        }
        catch {
            return null;
        }
    }, [items, props.project.id]);
    const ordered = useMemo(() => [...items].sort((a, b) => a.reference.viewport.width - b.reference.viewport.width || a.reference.id.localeCompare(b.reference.id)), [items]);
    const selected = ordered.find((item) => item.reference.id === selectedId) ?? ordered[0];
    const selectedTarget = props.selection?.nodeId ? { kind: 'selected', nodeId: props.selection.nodeId, path: props.selection.path, routeKey: props.routeKey, label: props.selection.label, authorizedNodeIds: [props.selection.nodeId], explicit: true } : null;
    async function decodeFile(file, index) {
        const fileValidation = validateReferenceFile(file);
        if (!fileValidation.valid)
            throw new Error(fileValidation.reason);
        const bitmap = await createImageBitmap(file);
        let canvas = null;
        try {
            const dimensions = validateReferenceDimensions(bitmap.width, bitmap.height);
            if (!dimensions.valid)
                throw new Error(dimensions.reason);
            if (cancelledRef.current)
                throw new Error('Reference import cancelled');
            canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context)
                throw new Error('Canvas decoding is unavailable');
            context.drawImage(bitmap, 0, 0);
            const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
            const id = `reference:${Date.now().toString(36)}:${index}:${safeId(file.name)}`;
            const label = suggestReferenceLabel(bitmap.width);
            const reconstruction = await localScreenshotProvider.reconstruct({ width: bitmap.width, height: bitmap.height, data: pixels.data, mimeType: file.type, name: file.name, referenceId: id, metadata: { viewportWidth: bitmap.width, viewportHeight: bitmap.height, route: props.routeKey, label } });
            if (cancelledRef.current || !mountedRef.current)
                throw new Error('Reference import cancelled');
            const previewUrl = await thumbnailUrl(bitmap);
            urlsRef.current.add(previewUrl);
            return { reference: { id, source: 'screenshot', viewport: { width: bitmap.width, height: bitmap.height }, route: props.routeKey, label, media: { id: `browser-file:${safeId(file.name)}:${file.size}`, mimeType: file.type, width: bitmap.width, height: bitmap.height } }, reconstruction, previewUrl, fileName: file.name };
        }
        finally {
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }
            ;
            bitmap.close();
        }
    }
    async function addFiles(files) {
        if (!files.length || processing)
            return;
        const available = Math.max(0, FROAM_REFERENCE_MAX_REFERENCES - items.length);
        if (!available) {
            props.onToast(`Reference supports up to ${FROAM_REFERENCE_MAX_REFERENCES} screenshots.`);
            return;
        }
        const queued = files.slice(0, available);
        props.onReferencesChanged?.();
        insightGenerationRef.current += 1;
        insightAbortRef.current?.abort();
        setInsightBusy(false);
        cancelledRef.current = false;
        setProcessing(true);
        setInsights([]);
        setProviderMessage('');
        props.onActivityChange?.('screenshot');
        try {
            setProgress(progressSteps[0]);
            const accepted = [];
            const errors = files.slice(available).map((file) => `${file.name}: Reference supports up to ${FROAM_REFERENCE_MAX_REFERENCES} screenshots`);
            for (let index = 0; index < queued.length; index += 1) {
                if (cancelledRef.current)
                    break;
                try {
                    accepted.push(await decodeFile(queued[index], index));
                }
                catch (error) {
                    errors.push(`${queued[index].name}: ${error instanceof Error ? error.message : 'Could not read screenshot'}`);
                }
            }
            if (cancelledRef.current || !mountedRef.current) {
                for (const item of accepted) {
                    URL.revokeObjectURL(item.previewUrl);
                    urlsRef.current.delete(item.previewUrl);
                }
                ;
                if (mountedRef.current)
                    setProgress('Import cancelled');
                return;
            }
            if (!accepted.length)
                throw new Error(errors[0] ?? 'No valid screenshots were selected');
            setProgress(progressSteps[1]);
            await Promise.resolve();
            setProgress(progressSteps[2]);
            await Promise.resolve();
            if (!mountedRef.current || cancelledRef.current) {
                for (const item of accepted) {
                    URL.revokeObjectURL(item.previewUrl);
                    urlsRef.current.delete(item.previewUrl);
                }
                ;
                return;
            }
            setItems((current) => [...current, ...accepted]);
            setSelectedId((current) => current ?? accepted[0].reference.id);
            setProgress(progressSteps[3]);
            await Promise.resolve();
            setProgress('Ready');
            props.onToast(`Reference understood ${accepted.length} screenshot${accepted.length === 1 ? '' : 's'}${errors.length ? ` · ${errors.length} skipped` : ''}`);
        }
        catch (error) {
            if (mountedRef.current) {
                setProgress('');
                props.onToast(error instanceof Error ? error.message : 'Reference reconstruction failed');
            }
        }
        finally {
            if (mountedRef.current) {
                setProcessing(false);
                props.onActivityChange?.(null);
            }
        }
    }
    function updateReference(id, patch) {
        props.onReferencesChanged?.();
        insightGenerationRef.current += 1;
        insightAbortRef.current?.abort();
        setInsightBusy(false);
        setItems((current) => current.map((item) => {
            if (item.reference.id !== id)
                return item;
            const reference = { ...item.reference, ...patch };
            const reconstruction = patch.viewport ? { ...item.reconstruction, references: item.reconstruction.references.map((entry, index) => index ? entry : { ...entry, width: patch.viewport.width, height: patch.viewport.height, metadata: { ...entry.metadata, viewportWidth: patch.viewport.width, viewportHeight: patch.viewport.height } }) } : item.reconstruction;
            return { ...item, reference, reconstruction };
        }));
    }
    function removeReference(id) {
        props.onReferencesChanged?.();
        insightGenerationRef.current += 1;
        insightAbortRef.current?.abort();
        setInsightBusy(false);
        const item = items.find((candidate) => candidate.reference.id === id);
        if (item) {
            URL.revokeObjectURL(item.previewUrl);
            urlsRef.current.delete(item.previewUrl);
        }
        setItems((current) => current.filter((candidate) => candidate.reference.id !== id));
        setSelectedId((current) => current === id ? null : current);
        setInsights([]);
        setProviderMessage('');
    }
    async function runInsights(consentOverride = false) {
        if (!understanding || insightBusy)
            return;
        if (consent !== 'allowed' && !consentOverride) {
            setConsentPrompt(true);
            return;
        }
        insightAbortRef.current?.abort();
        const controller = new AbortController();
        insightAbortRef.current = controller;
        const generation = ++insightGenerationRef.current;
        const current = () => mountedRef.current && !controller.signal.aborted && insightGenerationRef.current === generation;
        setInsightBusy(true);
        setProviderMessage('');
        setInsights([]);
        try {
            const input = { projectId: props.project.id, activeBranchId: props.project.activeBranchId, routeKey: props.routeKey, intent: 'Interpret the supplied reference evidence. Ground every finding in the provided observations and state uncertainty.', consent: true };
            const requests = [createReferenceIntelligenceRequest(understanding, input), ...(understanding.referenceSet.references.length >= 2 ? [createResponsiveIntelligenceRequest(understanding, { ...input, intent: 'Interpret only the supplied responsive evidence and bounded transition intervals.' })] : [])];
            const findings = [];
            for (const request of requests) {
                const response = await requestFroamIntelligence(request, fetch, controller.signal);
                if (!current())
                    return;
                if ('configured' in response && response.configured === false) {
                    setProviderMessage('Optional interpretation is not configured. Deterministic Reference results remain available.');
                    return;
                }
                if ('findings' in response)
                    findings.push(...response.findings.filter((finding) => findingEvidence(finding).length > 0));
            }
            if (current()) {
                setInsights(findings.slice(0, 12));
                setProviderMessage(findings.length ? '' : 'No additional evidence-grounded insights were returned.');
            }
        }
        catch {
            if (current())
                setProviderMessage('Optional interpretation is unavailable. Deterministic Reference results remain available.');
        }
        finally {
            if (current())
                setInsightBusy(false);
            if (insightAbortRef.current === controller)
                insightAbortRef.current = null;
        }
    }
    function allowInsights() { setConsent('allowed'); writeReferenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'allowed'); setConsentPrompt(false); void runInsights(true); }
    function declineInsights() { setConsent('declined'); writeReferenceConsent(typeof localStorage === 'undefined' ? undefined : localStorage, 'declined'); setConsentPrompt(false); }
    return _jsxs("section", { className: `froam-reference ${dropActive ? 'is-drop-active' : ''}`, "aria-label": "Reference workspace", onDragEnter: (event) => { event.preventDefault(); setDropActive(true); }, onDragOver: (event) => event.preventDefault(), onDragLeave: (event) => { if (!event.currentTarget.contains(event.relatedTarget))
            setDropActive(false); }, onDrop: (event) => { event.preventDefault(); setDropActive(false); void addFiles([...event.dataTransfer.files]); }, children: [_jsxs("header", { className: "froam-reference__header", children: [_jsxs("div", { children: [_jsx("span", { children: "Reference" }), _jsx("strong", { children: "Bring an interface into Froam." })] }), items.length > 0 && _jsxs("div", { className: "froam-reference__header-actions", children: [!processing && progress === 'Ready' && _jsx("span", { className: "froam-reference__ready", role: "status", "aria-live": "polite", children: "Ready" }), _jsxs("button", { type: "button", onClick: () => inputRef.current?.click(), children: [_jsx(Plus, { size: 14 }), " Add"] })] })] }), _jsx("input", { ref: inputRef, hidden: true, multiple: true, type: "file", accept: FROAM_REFERENCE_ACCEPTED_TYPES.join(','), onChange: (event) => { void addFiles([...event.target.files ?? []]); event.target.value = ''; } }), !items.length && !processing && _jsxs("button", { type: "button", className: `froam-reference__drop ${dropActive ? 'is-active' : ''}`, onClick: () => inputRef.current?.click(), "aria-label": "Add screenshot references", children: [_jsx(Upload, { size: 22 }), _jsx("strong", { children: "Add screenshots" }), _jsx("span", { children: "PNG, JPEG or WebP" }), _jsx("small", { children: "Desktop, tablet and mobile views help Froam understand how the design responds." })] }), processing && _jsxs("div", { className: "froam-reference__processing", children: [_jsx(RefreshCw, { size: 18 }), _jsx("strong", { children: progress }), _jsx("span", { role: "status", "aria-live": "polite", "aria-atomic": "true", children: progress }), _jsx("button", { type: "button", onClick: () => { cancelledRef.current = true; }, children: "Cancel" })] }), items.length > 0 && _jsxs(_Fragment, { children: [_jsx("div", { className: "froam-reference__cards", "aria-label": "Screenshot references", children: ordered.map((item) => _jsxs("article", { className: selected?.reference.id === item.reference.id ? 'is-selected' : '', children: [_jsxs("button", { type: "button", className: "froam-reference__card-main", onClick: () => setSelectedId(item.reference.id), "aria-label": `Inspect ${item.reference.label ?? item.fileName}`, children: [_jsx("img", { src: item.previewUrl, alt: "" }), _jsxs("span", { children: [_jsx("strong", { children: item.reference.label ?? item.fileName }), _jsxs("small", { children: [item.reference.viewport.width, " \u00D7 ", item.reference.viewport.height] }), _jsx("em", { children: "\u2713 reconstructed" })] })] }), _jsx("button", { type: "button", className: "froam-reference__remove", onClick: () => removeReference(item.reference.id), "aria-label": `Remove ${item.reference.label ?? item.fileName}`, children: _jsx(Trash2, { size: 13 }) })] }, item.reference.id)) }), selected && _jsxs("details", { className: "froam-reference__metadata", children: [_jsx("summary", { children: "Edit reference details" }), _jsxs("div", { children: [_jsxs("label", { children: ["Label", _jsx("input", { value: selected.reference.label ?? '', onChange: (event) => updateReference(selected.reference.id, { label: event.target.value }) })] }), _jsxs("label", { children: ["Route", _jsx("input", { value: selected.reference.route ?? '', onChange: (event) => updateReference(selected.reference.id, { route: event.target.value || undefined }) })] }), _jsxs("label", { children: ["State", _jsx("input", { value: selected.reference.state?.key ?? '', onChange: (event) => updateReference(selected.reference.id, { state: event.target.value ? { key: event.target.value } : undefined }) })] }), _jsxs("label", { children: ["Width", _jsx("input", { type: "number", min: "16", value: selected.reference.viewport.width, onChange: (event) => updateReference(selected.reference.id, { viewport: { ...selected.reference.viewport, width: Math.max(16, Number(event.target.value) || 16) } }) })] }), _jsxs("label", { children: ["Height", _jsx("input", { type: "number", min: "16", value: selected.reference.viewport.height, onChange: (event) => updateReference(selected.reference.id, { viewport: { ...selected.reference.viewport, height: Math.max(16, Number(event.target.value) || 16) } }) })] })] })] }), understanding && _jsx(ReferenceResults, { understanding: understanding, selectedId: selected?.reference.id ?? null, expandedEvidence: expandedEvidence, onExpandedEvidence: setExpandedEvidence }), understanding && _jsxs("section", { className: "froam-reference__build", "aria-label": "Reference build target", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("span", { children: "Reference ready" }), _jsx("strong", { children: "Target" })] }), _jsx("em", { children: selectedTarget ? selectedTarget.label : 'Current page' })] }), _jsx("p", { children: selectedTarget ? 'Reconstruct structure and responsive format inside the selected target.' : 'No selection. Page reconstruction requires this explicit action and adds a protected section without replacing the page.' }), _jsx("small", { children: "Existing copy, brand, logos, navigation content, product data and assets stay protected." }), _jsxs("button", { type: "button", disabled: props.reconstructing, onClick: () => props.onReconstruct(understanding, selectedTarget ?? { kind: 'current-page', nodeId: `page:${safeId(props.routeKey)}`, routeKey: props.routeKey, label: 'Current page', authorizedNodeIds: [`page:${safeId(props.routeKey)}`], explicit: true }), children: [_jsx(Sparkles, { size: 14 }), props.reconstructing ? 'Preparing prototype…' : selectedTarget ? 'Reconstruct here' : 'Reconstruct page'] })] }), understanding && _jsxs("section", { className: "froam-reference__insights", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx(Sparkles, { size: 14 }), _jsx("strong", { children: "Froam noticed" })] }), _jsx("button", { type: "button", disabled: insightBusy, onClick: () => void runInsights(), children: insightBusy ? 'Interpreting…' : insights.length ? 'Refresh' : 'Interpret evidence' })] }), consentPrompt && _jsxs("aside", { className: "froam-reference__consent", children: [_jsx("p", { children: "Froam can use the configured intelligence provider to interpret this reference." }), _jsx("small", { children: "It sends bounded interface observations, not your source code, credentials or raw screenshots." }), _jsxs("div", { children: [_jsx("button", { type: "button", onClick: allowInsights, children: "Allow" }), _jsx("button", { type: "button", onClick: declineInsights, children: "Not now" })] })] }), insights.map((finding, index) => _jsxs("article", { children: [_jsx("strong", { children: finding.summary }), finding.detail && _jsx("p", { children: finding.detail }), _jsxs("details", { children: [_jsxs("summary", { children: [findingEvidence(finding).length, " evidence item", findingEvidence(finding).length === 1 ? '' : 's'] }), findingEvidence(finding).map((evidence, evidenceIndex) => _jsxs("small", { children: [_jsx("b", { children: evidence.origin }), evidence.summary] }, evidenceIndex))] })] }, finding.id ?? index)), providerMessage && _jsx("p", { className: "froam-reference__provider-message", children: providerMessage })] })] })] });
}
function ReferenceResults(props) {
    const signature = props.understanding.responsiveSignature;
    const selectedObservations = signature.observations.filter((item) => !props.selectedId || item.referenceIds.includes(props.selectedId));
    return _jsxs("div", { className: "froam-reference__results", children: [_jsx("section", { className: "froam-reference__viewport-strip", "aria-label": "Observed viewport references", children: signature.observedWidths.map((width, index) => _jsxs("span", { children: [_jsx("b", { children: width }), _jsx("i", {})] }, `${width}:${index}`)) }), _jsxs("section", { className: "froam-reference__quality", children: [_jsx("h3", { children: "Reference understanding" }), referenceQualityRows(props.understanding.quality).map(([name, value]) => _jsxs("div", { children: [_jsx("span", { children: name }), _jsx("strong", { "data-tone": value.tone, children: value.label }), _jsx("small", { children: value.detail })] }, name))] }), _jsxs("section", { className: "froam-reference__evidence", children: [_jsx("h3", { children: "Responsive understanding" }), signature.observedWidths.length < 2 && _jsx("p", { children: "One reference provides structural evidence, but not responsive certainty." }), selectedObservations.slice(0, 8).map((item) => _jsxs("article", { children: [_jsx("em", { "data-origin": "observed", children: "Observed" }), _jsxs("strong", { children: [item.width, "px \u00B7 ", item.summary] }), _jsxs("button", { type: "button", onClick: () => props.onExpandedEvidence(props.expandedEvidence === item.id ? null : item.id), children: [props.expandedEvidence === item.id ? _jsx(ChevronDown, { size: 13 }) : _jsx(ChevronRight, { size: 13 }), " Show evidence"] }), props.expandedEvidence === item.id && _jsx("small", { children: item.regionIds?.length ? `${item.regionIds.length} reconstructed regions support this observation.` : 'Measured from the reconstructed viewport geometry.' })] }, item.id)), signature.hypotheses.slice(0, 8).map((item) => _jsxs("article", { children: [_jsx("em", { "data-origin": "inferred", children: "Inferred" }), _jsx("strong", { children: item.summary }), item.betweenWidths && _jsx("small", { children: item.betweenWidths[0] === item.betweenWidths[1] ? `Same ${item.betweenWidths[0]}px viewport; state or route differences remain ambiguous.` : `Bounded between ${item.betweenWidths[0]}px and ${item.betweenWidths[1]}px — not an exact CSS breakpoint.` }), _jsxs("button", { type: "button", onClick: () => props.onExpandedEvidence(props.expandedEvidence === item.id ? null : item.id), children: [props.expandedEvidence === item.id ? _jsx(ChevronDown, { size: 13 }) : _jsx(ChevronRight, { size: 13 }), " ", item.evidenceIds.length, " evidence item", item.evidenceIds.length === 1 ? '' : 's'] }), props.expandedEvidence === item.id && _jsx("small", { children: item.evidenceIds.join(' · ') || 'Inferred from adjacent unmatched or changed regions.' })] }, item.id))] }), _jsxs("footer", { children: [_jsx(FileImage, { size: 13 }), " Local reconstruction remains available without a configured intelligence provider."] })] });
}
//# sourceMappingURL=FroamReferenceWorkspace.js.map