import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Atom, Beaker, BookOpen, Radio, X } from 'lucide-react';
import { appendProjectEvents, createProjectEvent, deriveBranchState } from '../project/event-log.js';
import { defaultFroamLabsFlags } from '../project/experiments.js';
import { saveInteractionRecipe } from '../project/interaction-library.js';
import { createMutationPrototype } from '../project/mutation.js';
import { interactionWithPhysics } from '../project/physics.js';
import { createSamplingSession, recordSamplingFrame, samplingSessionToRecipe } from '../project/ui-sampling.js';
const FLAGS_KEY = 'froam-labs-flags-v1';
function loadFlags() { try {
    return { ...defaultFroamLabsFlags(), ...JSON.parse(localStorage.getItem(FLAGS_KEY) ?? '{}') };
}
catch {
    return defaultFroamLabsFlags();
} }
function styles(element) { const value = getComputedStyle(element); return { opacity: value.opacity, transform: value.transform, width: value.width, height: value.height, visibility: value.visibility }; }
export default function FroamLabs(props) {
    const [flags, setFlags] = useState(loadFlags);
    const [level, setLevel] = useState('safe');
    const [mutating, setMutating] = useState(false);
    const [spring, setSpring] = useState({ stiffness: 170, damping: 26, mass: 1 });
    const state = useMemo(() => deriveBranchState(props.project), [props.project]);
    const library = (props.project.metadata?.interactionLibrary ?? {});
    const mutations = (props.project.metadata?.mutations ?? []);
    const updateFlag = (key, enabled) => { const next = { ...flags, [key]: enabled }; setFlags(next); try {
        localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
    }
    catch { /* optional preference */ } };
    const saveLibrary = (next) => props.onProjectChange((project) => ({ ...project, updatedAt: Date.now(), metadata: { ...project.metadata, interactionLibrary: next } }));
    function mutate() { if (!props.selectedNodeId)
        return props.onToast('Select a scanned node before mutating'); setMutating(true); window.setTimeout(() => { try {
        const id = `mutation-${String(mutations.length + 1).padStart(3, '0')}`;
        const result = createMutationPrototype(props.project, { branchId: id, actorId: props.actorId, level, scopeNodeIds: [props.selectedNodeId], seed: mutations.length });
        props.onProjectChange(result.project);
        props.onToast(`${id} created; the source branch remains untouched`);
    }
    catch (error) {
        props.onToast(error instanceof Error ? error.message : 'Mutation failed');
    }
    finally {
        setMutating(false);
    } }, 420); }
    function saveFirstInteraction() { const interaction = Object.values(state.interactions)[0]; if (!interaction)
        return props.onToast('Create an interaction before saving a recipe'); const recipe = { id: `recipe:${Date.now().toString(36)}`, name: interaction.name, interaction, bindings: { source: { role: 'trigger', originalNodeId: interaction.sourceId, required: true }, targets: interaction.targetIds.map((id, index) => ({ role: index ? `target-${index + 1}` : 'target', originalNodeId: id, required: true })) }, provenance: { kind: 'native', projectId: props.project.id, branchId: props.project.activeBranchId, createdAt: Date.now(), sourceInteractionId: interaction.id } }; saveLibrary(saveInteractionRecipe(library, recipe)); }
    async function sample() { if (!props.selectedElement || !props.selectedNodeId)
        return props.onToast('Select a Froam-controlled element to sample'); const rect = props.selectedElement.getBoundingClientRect(); let session = createSamplingSession({ id: `sample:${Date.now().toString(36)}`, trigger: 'click', sourceRole: 'trigger', startedAt: Date.now() }); session = recordSamplingFrame(session, { atMs: 0, targetRole: 'target', nodeId: props.selectedNodeId, styles: styles(props.selectedElement), geometry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, visible: rect.width > 0 && rect.height > 0 }); await new Promise((resolve) => setTimeout(resolve, 240)); session = recordSamplingFrame(session, { atMs: 240, targetRole: 'target', nodeId: props.selectedNodeId, styles: styles(props.selectedElement), visible: true }); const recipe = samplingSessionToRecipe(session, { recipeId: `sampled:${Date.now().toString(36)}`, name: 'Observed interaction', projectId: props.project.id, branchId: props.project.activeBranchId }); saveLibrary(saveInteractionRecipe(library, recipe)); props.onToast('Observable frames saved as a sampled recipe'); }
    function applyPhysics() { if (!props.selectedNodeId)
        return props.onToast('Select a node for Physics'); const base = Object.values(state.interactions)[0] ?? { id: `physics:${props.selectedNodeId}`, name: 'Physics spring', sourceId: props.selectedNodeId, targetIds: [props.selectedNodeId], trigger: 'drag', timeline: [{ at: 0, values: { transform: 'translate3d(0,0,0)' } }, { at: 1, values: { transform: 'translate3d(0,0,0)' } }] }; const interaction = interactionWithPhysics(base, spring); const event = createProjectEvent({ projectId: props.project.id, branchId: props.project.activeBranchId, actorId: props.actorId, clock: Math.max(0, ...props.project.events.map((item) => item.clock)) + 1, type: 'interaction.upserted', payload: { interaction }, targetIds: [props.selectedNodeId], label: 'Design Physics' }); props.onProjectChange((project) => appendProjectEvents(project, [event])); props.onToast('Deterministic spring compiled into FroamInteraction'); }
    if (!props.open)
        return null;
    return _jsxs("aside", { className: `froam-labs ${mutating ? 'is-mutating' : ''}`, "data-chef-editor-root": "true", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx(Beaker, { size: 16 }), _jsx("strong", { children: "Froam Labs" }), _jsx("small", { children: "v8 prototypes \u00B7 Experimental" })] }), _jsx("button", { type: "button", onClick: props.onClose, children: _jsx(X, { size: 15 }) })] }), _jsxs("main", { children: [_jsxs("section", { children: [_jsx("h3", { children: "Independent flags" }), Object.keys(flags).map((key) => _jsxs("label", { className: "froam-labs__flag", children: [_jsx("input", { type: "checkbox", checked: flags[key], onChange: (event) => updateFlag(key, event.target.checked) }), _jsx("span", { children: key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim() }), _jsx("em", { children: "Experimental" })] }, key))] }), _jsxs("section", { className: "froam-labs__mutate", children: [_jsx("h3", { children: "\u2623 MUTATE" }), _jsx("p", { children: "Creates a branch-scoped deterministic proposal. The current source branch is never changed." }), _jsxs("select", { value: level, onChange: (event) => setLevel(event.target.value), children: [_jsx("option", { value: "safe", children: "SAFE" }), _jsx("option", { value: "experimental", children: "EXPERIMENTAL" }), _jsx("option", { value: "unhinged", children: "UNHINGED" })] }), _jsx("button", { type: "button", disabled: !flags.mutate || mutating, onClick: mutate, children: mutating ? 'Energizing prototype…' : 'Create mutation branch' }), mutations.at(-1) && _jsxs("div", { className: "froam-labs__compare", children: [_jsxs("span", { children: ["Original", _jsx("br", {}), _jsx("b", { children: mutations.at(-1).sourceBranchId })] }), _jsx("i", { children: "VS" }), _jsxs("span", { children: ["Mutation", _jsx("br", {}), _jsx("b", { children: mutations.at(-1).id })] })] })] }), _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(BookOpen, { size: 14 }), " Interaction Library"] }), _jsx("button", { type: "button", disabled: !flags.interactionLibrary, onClick: saveFirstInteraction, children: "Save existing interaction" }), _jsx("ul", { children: Object.values(library).map((recipe) => _jsxs("li", { children: [_jsx("b", { children: recipe.name }), _jsxs("small", { children: [recipe.provenance.kind, " \u00B7 ", recipe.interaction.trigger] })] }, recipe.id)) })] }), _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(Radio, { size: 14 }), " Native Sampler"] }), _jsx("p", { children: "Records observable Froam-controlled DOM state only; it does not recover source implementation." }), _jsx("button", { type: "button", disabled: !flags.uiSampling, onClick: () => void sample(), children: "Record observable frames" })] }), _jsxs("section", { children: [_jsxs("h3", { children: [_jsx(Atom, { size: 14 }), " Design Physics"] }), ['stiffness', 'damping', 'mass'].map((key) => _jsxs("label", { children: [key, _jsx("input", { type: "number", value: spring[key], onChange: (event) => setSpring({ ...spring, [key]: Number(event.target.value) }) })] }, key)), _jsx("button", { type: "button", disabled: !flags.designPhysics, onClick: applyPhysics, children: "Compile spring interaction" })] })] })] });
}
//# sourceMappingURL=FroamLabs.js.map