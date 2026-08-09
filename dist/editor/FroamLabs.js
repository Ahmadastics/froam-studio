import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import { Activity, Atom, Beaker, BookOpen, FlaskConical, Radio, Volume2, X } from 'lucide-react';
import { appendProjectEvents, createProjectEvent, deriveBranchState } from '../project/event-log.js';
import { chaosReportAnalysis, createDefaultChaosScenarios, runChaosTesting } from '../project/chaos.js';
import { defaultFroamLabsFlags } from '../project/experiments.js';
import { applyInteractionRecipe, deleteInteractionRecipe, previewInteractionRecipe, saveInteractionRecipe, searchInteractionLibrary } from '../project/interaction-library.js';
import { adoptMutationChanges, compareMutationBranches, createMutationPrototype, deterministicMutationProvider, normalizeMutationConstraints, previewMutation } from '../project/mutation.js';
import { FROAM_PHYSICS_PRESETS, interactionWithGravity, interactionWithPhysics, physicsPreset } from '../project/physics.js';
import { attachSoundToInteraction, importSoundAsset } from '../project/sound.js';
import { runSyntheticUx, syntheticRunAnalysis } from '../project/synthetic-ux.js';
import { createTrailerStoryboard, removeTrailerShot, reorderTrailerShot, trailerStoryboardAnalysis } from '../project/trailer.js';
import { createNativeSamplingRecorder, samplingSessionToRecipe, samplingTimeline } from '../project/ui-sampling.js';
const FLAGS_KEY = 'froam-labs-flags-v2';
const PROTECTIONS = ['copy', 'brand-colors', 'logo', 'product-data', 'navigation', 'component', 'section'];
function loadFlags() { try {
    return { ...defaultFroamLabsFlags(), ...JSON.parse(localStorage.getItem(FLAGS_KEY) ?? '{}') };
}
catch {
    return defaultFroamLabsFlags();
} }
export default function FroamLabs(props) {
    const [flags, setFlags] = useState(loadFlags);
    const [active, setActive] = useState('mutate');
    const [level, setLevel] = useState('safe');
    const [protect, setProtect] = useState(['copy', 'product-data']);
    const [mutating, setMutating] = useState(false);
    const [search, setSearch] = useState('');
    const [sampling, setSampling] = useState(false);
    const [preset, setPreset] = useState('Soft Spring');
    const [gravity, setGravity] = useState('attract');
    const [chaos, setChaos] = useState(null);
    const [synthetic, setSynthetic] = useState(null);
    const [storyboard, setStoryboard] = useState(null);
    const recorder = useRef(null);
    const state = useMemo(() => deriveBranchState(props.project), [props.project]);
    const library = (props.project.metadata?.interactionLibrary ?? {});
    const mutations = (props.project.metadata?.mutations ?? []);
    const latest = mutations.at(-1);
    const constraints = useMemo(() => normalizeMutationConstraints(level, { protect }), [level, protect]);
    const proposal = useMemo(() => props.selectedNodeId ? previewMutation(deterministicMutationProvider, { state, scopeNodeIds: [props.selectedNodeId], level, constraints, seed: mutations.length, now: props.project.updatedAt }) : null, [state, props.selectedNodeId, level, constraints, mutations.length, props.project.updatedAt]);
    const comparison = latest && props.project.branches[latest.id] ? compareMutationBranches(props.project, latest.sourceBranchId, latest.id) : null;
    const updateFlag = (key, enabled) => { const next = { ...flags, [key]: enabled }; setFlags(next); try {
        localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
    }
    catch { /* optional preference */ } };
    const saveLibrary = (next) => props.onProjectChange((project) => ({ ...project, updatedAt: Date.now(), metadata: { ...project.metadata, interactionLibrary: next } }));
    const addEvents = (events) => props.onProjectChange((project) => appendProjectEvents(project, events));
    const eventFor = (type, payload, targetIds, label) => createProjectEvent({ projectId: props.project.id, branchId: props.project.activeBranchId, actorId: props.actorId, clock: Math.max(0, ...props.project.events.map((item) => item.clock)) + 1, type, payload, targetIds, label });
    function mutate() { if (!props.selectedNodeId)
        return props.onToast('Select a scanned node before mutating'); setMutating(true); const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420; window.setTimeout(() => { try {
        const id = `mutation-${String(mutations.length + 1).padStart(3, '0')}`;
        const result = createMutationPrototype(props.project, { branchId: id, actorId: props.actorId, level, constraints, scopeNodeIds: [props.selectedNodeId], seed: mutations.length });
        props.onProjectChange(result.project);
        props.onToast(`${id} created; ${result.proposals.length} branch-scoped changes`);
    }
    catch (error) {
        props.onToast(error instanceof Error ? error.message : 'Mutation failed');
    }
    finally {
        setMutating(false);
    } }, delay); }
    function adopt() { if (!latest || !comparison)
        return; const result = adoptMutationChanges(props.project, { mutationBranchId: latest.id, targetBranchId: latest.sourceBranchId, eventIds: comparison.eventIds, actorId: props.actorId }); if (result.status === 'refused')
        return props.onToast(`Adoption refused: ${result.conflicts[0]?.reason}`); props.onProjectChange(result.project); props.onToast(`${result.adoptedEventIds.length} compatible changes adopted with provenance`); }
    function saveFirstInteraction() { const interaction = Object.values(state.interactions)[0]; if (!interaction)
        return props.onToast('Create an interaction before saving a recipe'); const recipe = { id: `recipe:${Date.now().toString(36)}`, name: interaction.name, category: 'Feedback', interaction, bindings: { source: { role: 'trigger', originalNodeId: interaction.sourceId, required: true }, targets: interaction.targetIds.map((id, index) => ({ role: index ? `target-${index + 1}` : 'target', originalNodeId: id, required: true })) }, provenance: { kind: 'native', source: 'froam', projectId: props.project.id, branchId: props.project.activeBranchId, createdAt: Date.now(), sourceInteractionId: interaction.id, originalImplementation: 'froam' } }; saveLibrary(saveInteractionRecipe(library, recipe)); }
    function applyFirstRecipe() { const recipe = searchInteractionLibrary(library, { query: search })[0]; if (!recipe || !props.selectedNodeId)
        return props.onToast('Select a node and recipe'); try {
        const targetIds = Object.fromEntries(recipe.bindings.targets.map((role) => [role.role, props.selectedNodeId]));
        const interaction = applyInteractionRecipe(recipe, { sourceId: props.selectedNodeId, targetIds });
        addEvents([eventFor('interaction.upserted', { interaction }, [props.selectedNodeId], `Applied ${recipe.name}`)]);
    }
    catch (error) {
        props.onToast(error instanceof Error ? error.message : 'Binding failed');
    } }
    function toggleSampling() { if (!flags.uiSampling || !props.selectedElement || !props.selectedNodeId)
        return props.onToast('Enable Sampling and select a Froam-controlled element'); if (!sampling) {
        recorder.current = createNativeSamplingRecorder({ root: document.body, targets: [{ element: props.selectedElement, role: 'target', nodeId: props.selectedNodeId }], trigger: 'click', sourceRole: 'trigger' }).start();
        setSampling(true);
        props.onToast('Sampling observable events, mutations and computed styles');
    }
    else {
        const session = recorder.current?.stop();
        recorder.current = null;
        setSampling(false);
        if (!session)
            return;
        const recipe = samplingSessionToRecipe(session, { recipeId: `sampled:${Date.now().toString(36)}`, name: 'Observed interaction', projectId: props.project.id, branchId: props.project.activeBranchId });
        saveLibrary(saveInteractionRecipe(library, recipe));
        props.onToast(`${samplingTimeline(session).length} observations saved as a sampled recipe`);
    } }
    function applyPhysics() { if (!props.selectedNodeId)
        return props.onToast('Select a node for Physics'); const base = Object.values(state.interactions)[0] ?? { id: `physics:${props.selectedNodeId}`, name: `${preset} interaction`, sourceId: props.selectedNodeId, targetIds: [props.selectedNodeId], trigger: 'drag', timeline: [{ at: 0, values: { transform: 'translate3d(0,0,0)' } }, { at: 1, values: { transform: 'translate3d(0,0,0)' } }] }; let interaction = interactionWithPhysics(base, physicsPreset(preset)); if (flags.uiGravity)
        interaction = interactionWithGravity(interaction, { mode: gravity, strength: 24, radius: 180, sourceId: props.selectedNodeId, labOnly: ['stay-near', 'avoid', 'group'].includes(gravity) }); addEvents([eventFor('interaction.upserted', { interaction }, [props.selectedNodeId], 'Design Physics')]); props.onToast(`${preset} compiled into deterministic runtime behavior`); }
    async function breakPage() { if (!flags.chaosTesting)
        return; let viewport = { width: window.innerWidth, height: window.innerHeight }; const report = await runChaosTesting({ scenarios: createDefaultChaosScenarios().slice(0, 4), state, adapter: { apply(event) { if (event.type === 'viewport')
                viewport = { width: event.width, height: event.height }; }, capture() { const elements = [...document.querySelectorAll('[data-froam-id]')]; return { viewport, nodes: elements.map((element) => { const rect = element.getBoundingClientRect(); const css = getComputedStyle(element); return { nodeId: element.dataset.froamId, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, visible: css.display !== 'none' && css.visibility !== 'hidden', clipped: element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2, reachable: !element.matches(':disabled') }; }) }; }, restore() { } } }); setChaos(report); const analysis = chaosReportAnalysis(report); addEvents([eventFor('analysis.upserted', { analysis }, analysis.targetIds, 'BREAK THIS PAGE')]); props.onToast(`${report.total} realities: ${report.passed} passed, ${report.warnings} warnings, ${report.failed} failed`); }
    async function testUser() { const flow = Object.values(state.flows)[0]; if (!flow?.entryNodeId || flow.nodeIds.length < 2)
        return props.onToast('Synthetic UX needs a Product Flow with at least two nodes'); const run = await runSyntheticUx({ id: `goal:${Date.now().toString(36)}`, goal: `Reach ${flow.nodeIds.at(-1)}`, startNodeId: flow.entryNodeId, successNodeIds: [flow.nodeIds.at(-1)] }, { flow, state }); setSynthetic(run); addEvents([eventFor('analysis.upserted', { analysis: syntheticRunAnalysis(run) }, syntheticRunAnalysis(run).targetIds, 'Synthetic UX run')]); props.onToast(run.success ? `Synthetic user succeeded in ${run.steps.length} steps` : `Synthetic user failed: ${run.importantFailures[0]}`); }
    function importSound(file) { if (!file)
        return; const reader = new FileReader(); reader.onload = () => { const id = `sound:${Date.now().toString(36)}`; const sounds = importSoundAsset(Object.fromEntries(Object.entries(state.assets).filter(([, asset]) => asset.kind === 'audio')), { id, name: file.name, url: String(reader.result), mimeType: file.type || 'audio/mpeg' }); const asset = sounds[id]; const interaction = Object.values(state.interactions)[0]; const events = [eventFor('asset.upserted', { asset }, [id], 'Imported UI sound')]; if (interaction)
        events.push(eventFor('interaction.upserted', { interaction: attachSoundToInteraction(interaction, { assetId: id, timing: 'start', volume: .7 }, sounds) }, interaction.targetIds, 'Attached UI sound')); addEvents(events); props.onToast(interaction ? 'Sound imported and attached to the first interaction' : 'Sound imported into the project collection'); }; reader.readAsDataURL(file); }
    function persistStoryboard(value) { setStoryboard(value); const analysis = trailerStoryboardAnalysis(value); addEvents([eventFor('analysis.upserted', { analysis }, analysis.targetIds, 'Edited trailer storyboard')]); }
    function createTrailer(durationSeconds) { if (!flags.trailerGenerator)
        return; const value = createTrailerStoryboard({ state, branchId: props.project.activeBranchId, durationSeconds, mutationBranchId: latest?.id }); persistStoryboard(value); props.onToast(`${value.shots.length} real product-state shots created`); }
    if (!props.open)
        return null;
    const labs = [['mutate', '☣ MUTATE'], ['interactions', 'Interactions'], ['sample', '◉ SAMPLE'], ['physics', 'Physics'], ['break', 'BREAK'], ['user', 'Test User'], ['sound', 'Sound'], ['trailer', 'Trailer']];
    return _jsxs("aside", { className: `froam-labs ${mutating ? 'is-mutating' : ''}`, "data-chef-editor-root": "true", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx(Beaker, { size: 16 }), _jsx("strong", { children: "Interface Laboratory" }), _jsx("small", { children: "Froam v8 \u00B7 Experiments" })] }), _jsx("button", { type: "button", onClick: props.onClose, children: _jsx(X, { size: 15 }) })] }), _jsx("nav", { children: labs.map(([id, label]) => _jsx("button", { className: active === id ? 'is-active' : '', onClick: () => setActive(id), children: label }, id)) }), _jsxs("main", { children: [active === 'mutate' && _jsxs("section", { className: "froam-labs__mutate", children: [_jsx("h3", { children: "\u2623 MUTATE" }), _jsx("p", { children: "Fork first. The source branch is immutable." }), _jsxs("select", { value: level, onChange: (event) => setLevel(event.target.value), children: [_jsx("option", { value: "safe", children: "SAFE" }), _jsx("option", { value: "experimental", children: "EXPERIMENTAL" }), _jsx("option", { value: "unhinged", children: "UNHINGED" })] }), _jsx("div", { className: "froam-labs__chips", children: PROTECTIONS.map((item) => _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: protect.includes(item), onChange: () => setProtect((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]) }), item] }, item)) }), _jsx("div", { className: "froam-labs__proposal", children: proposal?.summary.map((item, index) => _jsxs("p", { children: [_jsx("b", { children: item.domain }), item.rationale, _jsxs("small", { children: [Math.round(item.confidence * 100), "% \u00B7 ", item.targets, " target"] })] }, index)) }), _jsx("button", { disabled: !flags.mutate || mutating, onClick: mutate, children: mutating ? 'Froam Mutagen active…' : proposal?.requiresConfirmation ? 'MUTATE NOW' : 'Create mutation' }), comparison && _jsxs("div", { className: "froam-labs__compare", children: [_jsxs("span", { children: ["Original", _jsx("br", {}), _jsx("b", { children: comparison.sourceBranchId })] }), _jsx("i", { children: "VS" }), _jsxs("span", { children: ["Mutation", _jsx("br", {}), _jsx("b", { children: comparison.mutationBranchId })] }), _jsxs("small", { children: [comparison.structural, " structural \u00B7 ", comparison.visual, " visual \u00B7 ", comparison.interactions, " interaction"] }), _jsx("button", { onClick: adopt, children: "Adopt compatible changes" })] })] }), active === 'interactions' && _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(BookOpen, { size: 14 }), " Interaction Library"] }), _jsx("input", { placeholder: "Search behavior", value: search, onChange: (event) => setSearch(event.target.value) }), _jsxs("div", { className: "froam-labs__actions", children: [_jsx("button", { disabled: !flags.interactionLibrary, onClick: saveFirstInteraction, children: "Save existing" }), _jsx("button", { disabled: !flags.interactionLibrary, onClick: applyFirstRecipe, children: "Apply first result" })] }), _jsx("ul", { children: searchInteractionLibrary(library, { query: search }).map((recipe) => _jsxs("li", { children: [_jsx("b", { children: recipe.name }), _jsxs("small", { children: [recipe.category ?? 'Uncategorized', " \u00B7 ", recipe.provenance.kind, " \u00B7 ", previewInteractionRecipe(recipe, { samples: 4 }).length, " preview frames"] }), _jsx("button", { disabled: !flags.interactionLibrary, onClick: () => saveLibrary(deleteInteractionRecipe(library, recipe.id)), children: "Remove" })] }, recipe.id)) })] }), active === 'sample' && _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(Radio, { size: 14 }), " Native Sampling"] }), _jsx("p", { children: "Captures observable events, mutations, styles, layout and timing\u2014not source implementation." }), _jsx("button", { disabled: !flags.uiSampling, className: sampling ? 'is-danger' : '', onClick: toggleSampling, children: sampling ? 'Stop and reconstruct recipe' : '● Record selected region' }), _jsx(Flag, { flag: "externalSampling", value: flags.externalSampling, update: updateFlag }), _jsx("small", { children: "External prototype is separately permissioned under experiments/external-sampler." })] }), active === 'physics' && _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(Atom, { size: 14 }), " Design Physics"] }), _jsx("select", { value: preset, onChange: (event) => setPreset(event.target.value), children: Object.keys(FROAM_PHYSICS_PRESETS).map((name) => _jsx("option", { children: name }, name)) }), _jsx("select", { value: gravity, onChange: (event) => setGravity(event.target.value), children: ['attract', 'repel', 'follow', 'anchor', 'stay-near', 'avoid', 'group'].map((mode) => _jsx("option", { children: mode }, mode)) }), _jsx(Flag, { flag: "uiGravity", value: flags.uiGravity, update: updateFlag }), _jsx("button", { disabled: !flags.designPhysics, onClick: applyPhysics, children: "Compile Physics interaction" })] }), active === 'break' && _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(FlaskConical, { size: 14 }), " BREAK THIS PAGE"] }), _jsx("p", { children: "Run isolated viewport realities here. Content, assets, locale, network, API, permissions and sessions use the same adapter boundary when a host can safely simulate them." }), _jsx("button", { disabled: !flags.chaosTesting, onClick: () => void breakPage(), children: "Run tested viewport realities" }), chaos && _jsxs("div", { className: "froam-labs__score", children: [_jsxs("b", { children: [chaos.total, " scenarios"] }), _jsxs("span", { children: [chaos.passed, " passed \u00B7 ", chaos.warnings, " warnings \u00B7 ", chaos.failed, " failed"] }), chaos.scenarios.flatMap((item) => item.failures).slice(0, 6).map((failure) => _jsxs("small", { children: [failure.severity, ": ", failure.message] }, failure.id))] })] }), active === 'user' && _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(Activity, { size: 14 }), " Synthetic UX"] }), _jsx("p", { children: "Deterministic Product Flow task runner. Not a substitute for human usability testing." }), _jsx("button", { disabled: !flags.syntheticUx, onClick: () => void testUser(), children: "Run first flow goal" }), synthetic && _jsxs("div", { className: "froam-labs__score", children: [_jsx("b", { children: synthetic.success ? 'Goal completed' : 'Goal failed' }), _jsxs("span", { children: [synthetic.steps.length, " steps \u00B7 ", synthetic.clicks, " clicks \u00B7 ", synthetic.deadEnds, " dead ends"] })] })] }), active === 'sound' && _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(Volume2, { size: 14 }), " UI Sound"] }), _jsx("p", { children: "Project-local optional audio synchronized through FroamInteraction. Browser autoplay rules apply." }), _jsxs("label", { className: "froam-labs__upload", children: ["Import sound", _jsx("input", { type: "file", accept: "audio/*", disabled: !flags.uiSound, onChange: (event) => importSound(event.target.files?.[0]) })] }), _jsxs("span", { children: [Object.values(state.assets).filter((asset) => asset.kind === 'audio').length, " project sounds"] })] }), active === 'trailer' && _jsxs("section", { children: [_jsx("h3", { children: "Trailer Generator" }), _jsx("p", { children: "Editable storyboard from real Product Flow nodes, interactions and mutation branches." }), _jsx("div", { className: "froam-labs__actions", children: [10, 15, 30].map((duration) => _jsxs("button", { disabled: !flags.trailerGenerator, onClick: () => createTrailer(duration), children: [duration, "s"] }, duration)) }), storyboard && _jsx("ol", { children: storyboard.shots.map((shot, index) => _jsxs("li", { children: [_jsxs("b", { children: [(shot.startMs / 1000).toFixed(1), "s"] }), " ", shot.label, _jsxs("span", { className: "froam-labs__actions", children: [_jsx("button", { disabled: index === 0, onClick: () => persistStoryboard(reorderTrailerShot(storyboard, shot.id, index - 1)), children: "\u2191" }), _jsx("button", { disabled: index === storyboard.shots.length - 1, onClick: () => persistStoryboard(reorderTrailerShot(storyboard, shot.id, index + 1)), children: "\u2193" }), _jsx("button", { disabled: storyboard.shots.length === 1, onClick: () => persistStoryboard(removeTrailerShot(storyboard, shot.id)), children: "Remove" })] })] }, shot.id)) })] }), _jsxs("section", { className: "froam-labs__flags", children: [_jsx("h3", { children: "Experiment controls" }), Object.keys(flags).map((key) => _jsx(Flag, { flag: key, value: flags[key], update: updateFlag }, key))] })] })] });
}
function Flag(props) { return _jsxs("label", { className: "froam-labs__flag", children: [_jsx("input", { type: "checkbox", checked: props.value, onChange: (event) => props.update(props.flag, event.target.checked) }), _jsx("span", { children: props.flag.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim() }), _jsx("em", { children: "Experimental" })] }); }
//# sourceMappingURL=FroamLabs.js.map