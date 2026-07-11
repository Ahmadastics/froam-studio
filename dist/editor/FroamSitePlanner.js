import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Copy, FilePlus2, Frame, Grid2X2, Heart, LayoutTemplate, ListTree, Plus, RefreshCw, Search, Sparkles, Trash2, } from 'lucide-react';
import { FROAM_CATEGORIES, FROAM_COMPONENTS, } from './FroamComponentCatalog.js';
import { FROAM_FRAME_PRESETS, createFroamSection, } from './FroamPlannerTypes.js';
const DEFAULT_HOME_SECTIONS = [
    'navigation-01',
    'hero-02',
    'features-02',
    'content-03',
    'content-02',
    'social-proof-03',
    'social-proof-02',
    'cta-01',
    'footer-01',
];
const SIMPLE_LANDING_BLUEPRINT = [
    {
        label: '1. Navigation',
        componentId: 'navigation-01',
        intent: 'Let people know where they are and give them one obvious next action.',
        layout: 'Small brand mark left, 3-4 calm links, one compact action button.',
        think: 'What is the one action you want people to take from anywhere?',
    },
    {
        label: '2. Hero',
        componentId: 'hero-02',
        intent: 'Make the promise clear in the first screen without trying to explain everything.',
        layout: 'Strong headline and short copy on one side, product/brand image area on the other.',
        think: 'What should someone understand in five seconds?',
    },
    {
        label: '3. Proof strip',
        componentId: 'social-proof-03',
        intent: 'Show that the idea is real, trusted, or already moving.',
        layout: 'Three numbers, badges, or concise proof points under the hero.',
        think: 'What evidence makes your promise believable?',
    },
    {
        label: '4. How it works',
        componentId: 'content-03',
        intent: 'Explain the journey before showing too many features.',
        layout: 'Three or four steps with short labels and clean spacing.',
        think: 'What happens first, second, and third for the user?',
    },
    {
        label: '5. Feature focus',
        componentId: 'features-02',
        intent: 'Show the product strengths after the visitor understands the flow.',
        layout: 'Simple bento/grid with one large important feature and smaller supporting ones.',
        think: 'Which capability deserves the biggest visual space?',
    },
    {
        label: '6. Story / emotion',
        componentId: 'content-02',
        intent: 'Give the page a point of view so it feels memorable, not generic.',
        layout: 'Large statement with two supporting notes.',
        think: 'What do you believe that competitors would not say this clearly?',
    },
    {
        label: '7. Human proof',
        componentId: 'social-proof-02',
        intent: 'Bring in a voice, quote, or before/after moment.',
        layout: 'One strong quote or user story with an attribution.',
        think: 'Who would be proud to say this worked for them?',
    },
    {
        label: '8. Final CTA',
        componentId: 'cta-01',
        intent: 'Close with a decision, not more explanation.',
        layout: 'Short headline, one sentence, primary action, optional secondary action.',
        think: 'What should the visitor do now?',
    },
    {
        label: '9. Footer',
        componentId: 'footer-01',
        intent: 'End quietly with the essentials.',
        layout: 'Brand, useful links, legal line.',
        think: 'What does someone need if they are not ready to act yet?',
    },
];
const BLUEPRINT_PRESETS = [
    {
        id: 'saas-landing',
        label: 'SaaS landing',
        prompt: 'A premium SaaS homepage that builds trust fast: clear value proposition, social proof, feature highlights, pricing teaser, and a strong sign-up CTA.',
    },
    {
        id: 'product-launch',
        label: 'Product launch',
        prompt: 'A launch page for a new product: bold hero, what it does in one line, three benefit sections, screenshots, early-access form, and FAQ.',
    },
    {
        id: 'portfolio',
        label: 'Portfolio',
        prompt: 'A personal portfolio that feels confident and minimal: intro, selected work with case-study cards, skills, testimonials, and a contact section.',
    },
];
function componentName(componentId) {
    return FROAM_COMPONENTS.find((item) => item.id === componentId)?.title ?? 'Website section';
}
function componentBlueprintBase(componentId) {
    const existing = SIMPLE_LANDING_BLUEPRINT.find((item) => item.componentId === componentId);
    if (existing)
        return existing;
    const definition = FROAM_COMPONENTS.find((item) => item.id === componentId);
    return {
        label: definition?.title ?? 'Website section',
        componentId,
        intent: definition?.summary ?? 'Define what this section should do.',
        layout: `Use a ${definition?.category.toLowerCase() ?? 'section'} pattern that supports the page story.`,
        think: 'What should be clear after this section?',
    };
}
function sectionFromComponent(componentId) {
    return createFroamSection(componentId, componentName(componentId));
}
function defaultSections(componentIds) {
    return componentIds.map(sectionFromComponent);
}
function createDefaultBlueprintDraft() {
    return {
        title: 'Plan the page before designing the pixels.',
        summary: 'Start with the visitor\'s first question, then move through proof, process, features, story, and a clean decision point.',
        order: SIMPLE_LANDING_BLUEPRINT.map((item) => item.componentId),
        sections: Object.fromEntries(SIMPLE_LANDING_BLUEPRINT.map((item) => [
            item.componentId,
            {
                label: item.label,
                intent: item.intent,
                layout: item.layout,
                think: item.think,
            },
        ])),
    };
}
function makeBlueprintSection(base, patch = {}) {
    return {
        label: patch.label ?? base.label,
        intent: patch.intent ?? base.intent,
        layout: patch.layout ?? base.layout,
        think: patch.think ?? base.think,
    };
}
function draftBlueprintFromPrompt(prompt) {
    const cleanPrompt = prompt.trim();
    const lower = cleanPrompt.toLowerCase();
    const fallback = createDefaultBlueprintDraft();
    const wantsTrust = /trust|safe|safety|escrow|proof|verified|secure|rating/.test(lower);
    const wantsRunner = /runner|rider|earn|apply|work|job|recruit/.test(lower);
    const wantsApp = /app|dashboard|tracking|wallet|chat|mobile|product/.test(lower);
    const wantsHelp = /help|support|faq|question|contact/.test(lower);
    let order = ['navigation-01', 'hero-02', 'social-proof-03', 'content-03', 'features-02', 'content-02', 'social-proof-02', 'cta-01', 'footer-01'];
    if (wantsTrust)
        order = ['navigation-01', 'hero-03', 'social-proof-03', 'content-03', 'features-03', 'faq-01', 'cta-02', 'footer-01'];
    if (wantsRunner)
        order = ['navigation-01', 'hero-02', 'content-02', 'features-03', 'social-proof-02', 'faq-03', 'cta-01', 'footer-01'];
    if (wantsHelp)
        order = ['navigation-01', 'hero-01', 'features-03', 'faq-02', 'contact-02', 'cta-02', 'footer-01'];
    const sectionMap = Object.fromEntries(SIMPLE_LANDING_BLUEPRINT.map((base) => [base.componentId, makeBlueprintSection(base)]));
    if (wantsTrust) {
        sectionMap['hero-03'] = {
            label: '1. Trust promise',
            intent: 'Open with why Run\'Am is safe enough to trust with real errands, money, and deliveries.',
            layout: 'Large confident statement with a compact proof note beside it.',
            think: 'What fear does the visitor need you to remove immediately?',
        };
        sectionMap['features-03'] = {
            label: '5. Safety system',
            intent: 'Explain verification, escrow, tracking, proof, ratings, and support as one clear protection flow.',
            layout: 'Numbered rows from request to payment release.',
            think: 'Which safety feature should feel strongest?',
        };
        sectionMap['faq-01'] = {
            label: '6. Trust questions',
            intent: 'Answer the objections people may have before posting a task.',
            layout: 'Short accordion questions with direct answers.',
            think: 'What would stop someone from trusting a runner?',
        };
    }
    if (wantsRunner) {
        sectionMap['hero-02'] = {
            label: '1. Runner invitation',
            intent: 'Make reliable people feel that becoming a Run\'Am runner is dignified, flexible, and worth applying for.',
            layout: 'Strong copy next to a human runner image or app screen.',
            think: 'Why should a serious runner choose Run\'Am?',
        };
        sectionMap['features-03'] = {
            label: '4. How runners earn',
            intent: 'Show the work flow from verification to accepting tasks and getting paid.',
            layout: 'Clear numbered steps with short earning/support notes.',
            think: 'What makes the earning process feel fair?',
        };
        sectionMap['faq-03'] = {
            label: '6. Runner questions',
            intent: 'Handle questions about verification, payouts, safety, and task types.',
            layout: 'FAQ list with a direct support/apply panel.',
            think: 'What would a new runner ask before signing up?',
        };
    }
    if (wantsApp) {
        sectionMap['features-02'] = {
            label: wantsTrust ? '5. Product protections' : '5. App experience',
            intent: 'Show the app features that make Run\'Am feel controlled and reliable.',
            layout: 'Bento grid with tracking, wallet/escrow, chat, proof, and rating moments.',
            think: 'Which app moment should be visually biggest?',
        };
    }
    return {
        title: cleanPrompt ? 'Structure this page from my idea.' : fallback.title,
        summary: cleanPrompt || fallback.summary,
        order,
        sections: {
            ...fallback.sections,
            ...sectionMap,
        },
    };
}
function simpleLandingSections(blueprintDraft) {
    const order = blueprintDraft?.order?.length ? blueprintDraft.order : SIMPLE_LANDING_BLUEPRINT.map((item) => item.componentId);
    return order
        .filter((componentId) => Boolean(componentById(componentId)))
        .map((componentId) => createFroamSection(componentId, blueprintDraft?.sections[componentId]?.label || componentName(componentId)));
}
function createDefaultPlan() {
    return {
        projectName: 'Run\'Am website',
        selectedPageId: 'home',
        favorites: [],
        pages: [
            {
                id: 'home',
                name: 'Home',
                path: '/',
                parentId: null,
                status: 'ready',
                sections: defaultSections(DEFAULT_HOME_SECTIONS),
            },
            {
                id: 'services',
                name: 'Services',
                path: '/services',
                parentId: 'home',
                status: 'draft',
                sections: defaultSections(['navigation-01', 'hero-02', 'features-03', 'content-03', 'cta-02', 'footer-02']),
            },
            {
                id: 'about',
                name: 'About',
                path: '/about',
                parentId: 'home',
                status: 'draft',
                sections: defaultSections(['navigation-02', 'hero-03', 'content-02', 'team-01', 'social-proof-03', 'footer-01']),
            },
        ],
    };
}
function storageKey(routeKey) {
    return `froam-site-plan-v1:${routeKey}`;
}
function blueprintStorageKey(routeKey) {
    return `froam-blueprint-v1:${routeKey}`;
}
function loadPlan(routeKey) {
    if (typeof window === 'undefined')
        return createDefaultPlan();
    try {
        const raw = window.localStorage.getItem(storageKey(routeKey));
        if (!raw)
            return createDefaultPlan();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.pages) || parsed.pages.length === 0)
            return createDefaultPlan();
        const pages = parsed.pages.map((page) => ({
            ...page,
            sections: Array.isArray(page.sections)
                ? page.sections.map((section) => {
                    if (typeof section === 'string')
                        return sectionFromComponent(section);
                    const candidate = section;
                    return {
                        id: candidate.id || createFroamSection(null, 'Blank page').id,
                        componentId: typeof candidate.componentId === 'string' ? candidate.componentId : null,
                        name: candidate.name || (candidate.componentId ? componentName(candidate.componentId) : 'Blank page'),
                        frame: {
                            ...FROAM_FRAME_PRESETS.responsive,
                            ...(candidate.frame ?? {}),
                        },
                    };
                })
                : [],
        }));
        return {
            projectName: parsed.projectName || 'Untitled website',
            selectedPageId: parsed.selectedPageId || pages[0].id,
            pages,
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        };
    }
    catch {
        return createDefaultPlan();
    }
}
function loadBlueprintDraft(routeKey) {
    const fallback = createDefaultBlueprintDraft();
    if (typeof window === 'undefined')
        return fallback;
    try {
        const raw = window.localStorage.getItem(blueprintStorageKey(routeKey));
        if (!raw)
            return fallback;
        const parsed = JSON.parse(raw);
        return {
            title: parsed.title || fallback.title,
            summary: parsed.summary || fallback.summary,
            order: Array.isArray(parsed.order)
                ? parsed.order.filter((componentId) => Boolean(componentById(componentId)))
                : fallback.order,
            sections: Object.fromEntries(Array.from(new Set([...SIMPLE_LANDING_BLUEPRINT.map((item) => item.componentId), ...(parsed.order ?? [])])).map((componentId) => {
                const saved = parsed.sections?.[componentId];
                const base = fallback.sections[componentId] ?? makeBlueprintSection(componentBlueprintBase(componentId));
                return [
                    componentId,
                    {
                        label: saved?.label || base.label,
                        intent: saved?.intent ?? base.intent,
                        layout: saved?.layout ?? base.layout,
                        think: saved?.think ?? base.think,
                    },
                ];
            })),
        };
    }
    catch {
        return fallback;
    }
}
function makePageId(name) {
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'page'}-${Date.now().toString(36)}`;
}
function componentById(id) {
    return FROAM_COMPONENTS.find((item) => item.id === id);
}
function ComponentPreview({ componentId }) {
    const definition = componentById(componentId);
    const rows = definition?.anatomy ?? ['component'];
    return (_jsx("div", { className: `fsp-preview fsp-preview--${definition?.category.toLowerCase().replace(/\s+/g, '-') ?? 'component'}`, children: rows.map((row, index) => (_jsx("span", { className: index === 0 ? 'is-strong' : index === rows.length - 1 ? 'is-short' : '', style: { width: `${Math.max(34, 94 - index * 12)}%` } }, `${row}-${index}`))) }));
}
export default function FroamSitePlanner({ routeKey, onInsertComponent, onInsertBlankFrame, onBuildPage, onToast }) {
    const [plan, setPlan] = useState(() => loadPlan(routeKey));
    const [blueprintDraft, setBlueprintDraft] = useState(() => loadBlueprintDraft(routeKey));
    const [planningPrompt, setPlanningPrompt] = useState('');
    const [tab, setTab] = useState('blueprint');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [placement, setPlacement] = useState('new-frame');
    const [insertFrame, setInsertFrame] = useState({ ...FROAM_FRAME_PRESETS.responsive });
    useEffect(() => {
        setPlan(loadPlan(routeKey));
        setBlueprintDraft(loadBlueprintDraft(routeKey));
    }, [routeKey]);
    useEffect(() => {
        window.localStorage.setItem(storageKey(routeKey), JSON.stringify(plan));
    }, [plan, routeKey]);
    useEffect(() => {
        window.localStorage.setItem(blueprintStorageKey(routeKey), JSON.stringify(blueprintDraft));
    }, [blueprintDraft, routeKey]);
    const selectedPage = plan.pages.find((page) => page.id === plan.selectedPageId) ?? plan.pages[0];
    const rootPages = plan.pages.filter((page) => page.parentId === null);
    const filteredComponents = useMemo(() => {
        const query = search.trim().toLowerCase();
        return FROAM_COMPONENTS.filter((item) => {
            const matchesCategory = category === 'All' || item.category === category;
            const matchesFavorite = !favoritesOnly || plan.favorites.includes(item.id);
            const matchesSearch = !query || [item.title, item.summary, ...item.keywords].join(' ').toLowerCase().includes(query);
            return matchesCategory && matchesFavorite && matchesSearch;
        });
    }, [category, favoritesOnly, plan.favorites, search]);
    function updatePage(pageId, updater) {
        setPlan((current) => ({
            ...current,
            pages: current.pages.map((page) => page.id === pageId ? updater(page) : page),
        }));
    }
    function addPage(parentId = null) {
        const name = parentId ? 'Child page' : 'New page';
        const id = makePageId(name);
        const page = {
            id,
            name,
            path: `/${id.replace(/-[a-z0-9]+$/, '')}`,
            parentId,
            status: 'draft',
            sections: defaultSections(['navigation-01', 'hero-01', 'cta-01', 'footer-01']),
        };
        setPlan((current) => ({
            ...current,
            selectedPageId: id,
            pages: [...current.pages, page],
        }));
        onToast('Page added to sitemap');
    }
    function duplicatePage(page) {
        const id = makePageId(`${page.name}-copy`);
        setPlan((current) => ({
            ...current,
            selectedPageId: id,
            pages: [...current.pages, { ...page, id, name: `${page.name} copy`, path: `${page.path}-copy`, status: 'draft' }],
        }));
        onToast('Page duplicated');
    }
    function deletePage(pageId) {
        if (plan.pages.length === 1) {
            onToast('A sitemap needs at least one page');
            return;
        }
        const descendants = new Set([pageId]);
        let changed = true;
        while (changed) {
            changed = false;
            plan.pages.forEach((page) => {
                if (page.parentId && descendants.has(page.parentId) && !descendants.has(page.id)) {
                    descendants.add(page.id);
                    changed = true;
                }
            });
        }
        const remaining = plan.pages.filter((page) => !descendants.has(page.id));
        setPlan((current) => ({
            ...current,
            selectedPageId: remaining[0].id,
            pages: remaining,
        }));
        onToast('Page removed from sitemap');
    }
    function addSection(componentId, insertNow = false) {
        const section = createFroamSection(componentId, componentName(componentId), insertFrame);
        updatePage(selectedPage.id, (page) => ({ ...page, sections: [...page.sections, section], status: 'draft' }));
        if (insertNow)
            onInsertComponent(componentId, placement, insertFrame);
        onToast(insertNow ? 'Added to wireframe and canvas' : 'Added to wireframe');
    }
    function addBlankPage(insertNow = false) {
        const section = createFroamSection(null, 'Blank white page', insertFrame);
        updatePage(selectedPage.id, (page) => ({ ...page, sections: [...page.sections, section], status: 'draft' }));
        if (insertNow)
            onInsertBlankFrame(placement, insertFrame);
        onToast(insertNow ? 'Blank page added to wireframe and canvas' : 'Blank page added to wireframe');
    }
    function removeSection(index) {
        updatePage(selectedPage.id, (page) => ({
            ...page,
            status: 'draft',
            sections: page.sections.filter((_, sectionIndex) => sectionIndex !== index),
        }));
    }
    function moveSection(index, direction) {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= selectedPage.sections.length)
            return;
        updatePage(selectedPage.id, (page) => {
            const sections = [...page.sections];
            [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
            return { ...page, sections, status: 'draft' };
        });
    }
    function shuffleSection(index) {
        const currentSection = selectedPage.sections[index];
        const currentId = currentSection.componentId;
        if (!currentId)
            return;
        const current = componentById(currentId);
        if (!current)
            return;
        const peers = FROAM_COMPONENTS.filter((item) => item.category === current.category);
        const currentIndex = peers.findIndex((item) => item.id === currentId);
        const replacement = peers[(currentIndex + 1) % peers.length];
        updatePage(selectedPage.id, (page) => ({
            ...page,
            status: 'draft',
            sections: page.sections.map((section, sectionIndex) => sectionIndex === index
                ? { ...section, componentId: replacement.id, name: replacement.title }
                : section),
        }));
        onToast(`Switched to ${replacement.title}`);
    }
    function buildSelectedPage() {
        onBuildPage(selectedPage.sections);
        updatePage(selectedPage.id, (page) => ({ ...page, status: 'ready' }));
        onToast(`Built ${selectedPage.sections.length} sections on the canvas`);
    }
    function applySimpleLandingBlueprint(buildNow = false) {
        const sections = simpleLandingSections(blueprintDraft);
        updatePage(selectedPage.id, (page) => ({
            ...page,
            status: buildNow ? 'ready' : 'draft',
            sections,
        }));
        if (buildNow)
            onBuildPage(sections);
        onToast(buildNow ? 'Built the simple landing blueprint' : 'Simple landing blueprint applied');
    }
    function draftFromPrompt(prompt = planningPrompt, buildNow = false) {
        const nextDraft = draftBlueprintFromPrompt(prompt);
        setBlueprintDraft(nextDraft);
        const sections = simpleLandingSections(nextDraft);
        updatePage(selectedPage.id, (page) => ({
            ...page,
            status: buildNow ? 'ready' : 'draft',
            sections,
        }));
        if (buildNow)
            onBuildPage(sections);
        onToast(buildNow ? 'Drafted and built the page' : 'Drafted a structure from your prompt');
    }
    function updateBlueprintHeader(patch) {
        setBlueprintDraft((current) => ({ ...current, ...patch }));
    }
    function updateBlueprintSection(componentId, patch) {
        setBlueprintDraft((current) => ({
            ...current,
            sections: {
                ...current.sections,
                [componentId]: {
                    ...current.sections[componentId],
                    ...patch,
                },
            },
        }));
    }
    function moveBlueprintSection(componentId, direction) {
        setBlueprintDraft((current) => {
            const order = [...current.order];
            const index = order.indexOf(componentId);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= order.length)
                return current;
            [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
            return { ...current, order };
        });
    }
    function updateSectionFrame(sectionId, updater) {
        updatePage(selectedPage.id, (page) => ({
            ...page,
            status: 'draft',
            sections: page.sections.map((section) => section.id === sectionId
                ? { ...section, frame: updater(section.frame) }
                : section),
        }));
    }
    function applyFramePreset(sectionId, preset) {
        if (preset === 'custom') {
            updateSectionFrame(sectionId, (frame) => ({ ...frame, preset: 'custom' }));
            return;
        }
        updateSectionFrame(sectionId, () => ({ ...FROAM_FRAME_PRESETS[preset] }));
    }
    function setInsertFramePreset(preset) {
        if (preset === 'custom') {
            setInsertFrame((frame) => ({ ...frame, preset: 'custom' }));
            return;
        }
        setInsertFrame({ ...FROAM_FRAME_PRESETS[preset] });
    }
    const placementOptions = [
        { id: 'new-frame', label: 'New page' },
        { id: 'start', label: 'Start' },
        { id: 'end', label: 'End' },
        { id: 'before', label: 'Before' },
        { id: 'after', label: 'After' },
        { id: 'inside', label: 'Inside' },
    ];
    const frameControls = (_jsxs("div", { className: "fsp-insert-settings", children: [_jsxs("div", { className: "fsp-setting-label", children: [_jsx("span", { children: "Placement" }), _jsx("small", { children: "Before, after, and inside use the selected canvas element." })] }), _jsx("div", { className: "fsp-placement-row", children: placementOptions.map((option) => (_jsx("button", { type: "button", className: placement === option.id ? 'is-active' : '', onClick: () => setPlacement(option.id), children: option.label }, option.id))) }), _jsxs("div", { className: "fsp-frame-settings", children: [_jsxs("label", { children: [_jsx("span", { children: "Frame" }), _jsxs("select", { value: insertFrame.preset, onChange: (event) => setInsertFramePreset(event.target.value), children: [_jsx("option", { value: "responsive", children: "Responsive" }), _jsx("option", { value: "desktop", children: "Desktop 1440" }), _jsx("option", { value: "tablet", children: "Tablet 768" }), _jsx("option", { value: "mobile", children: "Mobile 390" }), _jsx("option", { value: "custom", children: "Custom" })] })] }), _jsxs("label", { children: [_jsx("span", { children: "W" }), _jsx("input", { type: "number", min: "120", value: insertFrame.width, onChange: (event) => setInsertFrame((frame) => ({ ...frame, preset: 'custom', width: Number(event.target.value) || 120 })) })] }), _jsxs("label", { children: [_jsx("span", { children: "H" }), _jsx("input", { type: "number", min: "80", value: insertFrame.height, onChange: (event) => setInsertFrame((frame) => ({ ...frame, preset: 'custom', height: Number(event.target.value) || 80 })) })] })] })] }));
    function toggleFavorite(componentId) {
        setPlan((current) => ({
            ...current,
            favorites: current.favorites.includes(componentId)
                ? current.favorites.filter((id) => id !== componentId)
                : [...current.favorites, componentId],
        }));
    }
    function renderPageCard(page, depth = 0) {
        const children = plan.pages.filter((candidate) => candidate.parentId === page.id);
        return (_jsxs("div", { className: "fsp-sitemap-branch", children: [_jsxs("button", { type: "button", className: `fsp-page-card ${page.id === selectedPage.id ? 'is-selected' : ''}`, style: { marginLeft: depth * 22 }, onClick: () => setPlan((current) => ({ ...current, selectedPageId: page.id })), children: [_jsx("span", { className: `fsp-page-card__status is-${page.status}` }), _jsxs("span", { children: [_jsx("strong", { children: page.name }), _jsx("small", { children: page.path })] }), _jsx(ChevronRight, { size: 14 })] }), children.map((child) => renderPageCard(child, depth + 1))] }, page.id));
    }
    return (_jsxs("div", { className: "fsp", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "fsp-tabs", role: "tablist", "aria-label": "Froam planning tools", children: [_jsxs("button", { type: "button", className: tab === 'blueprint' ? 'is-active' : '', onClick: () => setTab('blueprint'), children: [_jsx(Frame, { size: 14 }), " Blueprint"] }), _jsxs("button", { type: "button", className: tab === 'sitemap' ? 'is-active' : '', onClick: () => setTab('sitemap'), children: [_jsx(ListTree, { size: 14 }), " Sitemap"] }), _jsxs("button", { type: "button", className: tab === 'wireframe' ? 'is-active' : '', onClick: () => setTab('wireframe'), children: [_jsx(LayoutTemplate, { size: 14 }), " Wireframe"] }), _jsxs("button", { type: "button", className: tab === 'library' ? 'is-active' : '', onClick: () => setTab('library'), children: [_jsx(Grid2X2, { size: 14 }), " Library"] })] }), tab === 'blueprint' && (_jsxs("div", { className: "fsp-pane", children: [_jsxs("div", { className: "fsp-prompt-planner", children: [_jsxs("div", { className: "fsp-flow-rail", "aria-label": "Froam planning flow", children: [_jsx("span", { className: "is-active", children: "1 Describe" }), _jsx("span", { children: "2 Organize" }), _jsx("span", { children: "3 Build" })] }), _jsxs("label", { className: "fsp-prompt-box", children: [_jsx("span", { children: "What are you trying to make?" }), _jsx("textarea", { value: planningPrompt, onChange: (event) => setPlanningPrompt(event.target.value), placeholder: "Example: A premium homepage that makes visitors trust the product in the first five seconds \u2014 clear promise, proof, and one obvious next step...", rows: 4 })] }), _jsx("div", { className: "fsp-preset-row", children: BLUEPRINT_PRESETS.map((preset) => (_jsx("button", { type: "button", onClick: () => {
                                        setPlanningPrompt(preset.prompt);
                                        draftFromPrompt(preset.prompt, false);
                                    }, children: preset.label }, preset.id))) }), _jsxs("div", { className: "fsp-prompt-actions", children: [_jsxs("button", { type: "button", onClick: () => draftFromPrompt(planningPrompt, false), children: [_jsx(Sparkles, { size: 14 }), " Draft structure"] }), _jsxs("button", { type: "button", className: "is-primary", onClick: () => draftFromPrompt(planningPrompt, true), children: [_jsx(Frame, { size: 14 }), " Draft + build"] })] })] }), _jsxs("div", { className: "fsp-blueprint-hero", children: [_jsx("span", { children: "Simple landing structure" }), _jsx("input", { className: "fsp-blueprint-title-input", value: blueprintDraft.title, onChange: (event) => updateBlueprintHeader({ title: event.target.value }), placeholder: "Name the planning goal..." }), _jsx("textarea", { className: "fsp-blueprint-summary-input", value: blueprintDraft.summary, onChange: (event) => updateBlueprintHeader({ summary: event.target.value }), placeholder: "Write how you want this page to flow...", rows: 3 })] }), _jsxs("div", { className: "fsp-blueprint-actions", children: [_jsxs("button", { type: "button", onClick: () => applySimpleLandingBlueprint(false), children: [_jsx(LayoutTemplate, { size: 14 }), " Use this order"] }), _jsxs("button", { type: "button", className: "is-primary", onClick: () => applySimpleLandingBlueprint(true), children: [_jsx(Frame, { size: 14 }), " Build on canvas"] })] }), _jsx("div", { className: "fsp-blueprint-flow", children: blueprintDraft.order.map((componentId, index) => {
                            const item = componentBlueprintBase(componentId);
                            const definition = componentById(item.componentId);
                            const draft = blueprintDraft.sections[item.componentId] ?? item;
                            return (_jsxs("article", { className: "fsp-blueprint-step", children: [_jsx("div", { className: "fsp-blueprint-step__preview", children: _jsx(ComponentPreview, { componentId: item.componentId }) }), _jsxs("div", { className: "fsp-blueprint-step__body", children: [_jsx("span", { children: definition?.category ?? 'Section' }), _jsx("input", { className: "fsp-blueprint-section-title", value: draft.label, onChange: (event) => updateBlueprintSection(item.componentId, { label: event.target.value }), placeholder: "Section name" }), _jsxs("label", { className: "fsp-blueprint-field", children: [_jsx("span", { children: "What goes here" }), _jsx("textarea", { value: draft.intent, onChange: (event) => updateBlueprintSection(item.componentId, { intent: event.target.value }), placeholder: "Write what you want this section to say or achieve...", rows: 3 })] }), _jsxs("label", { className: "fsp-blueprint-field", children: [_jsx("span", { children: "Layout" }), _jsx("textarea", { value: draft.layout, onChange: (event) => updateBlueprintSection(item.componentId, { layout: event.target.value }), placeholder: "Describe where things should go...", rows: 2 })] }), _jsxs("label", { className: "fsp-blueprint-field", children: [_jsx("span", { children: "Notes" }), _jsx("textarea", { value: draft.think, onChange: (event) => updateBlueprintSection(item.componentId, { think: event.target.value }), placeholder: "Ideas, references, copy, doubts, anything...", rows: 2 })] })] }), _jsx("button", { type: "button", className: "fsp-icon-btn", onClick: () => addSection(item.componentId, true), title: "Insert this section", children: _jsx(Plus, { size: 13 }) }), _jsxs("div", { className: "fsp-blueprint-order-actions", children: [_jsx("button", { type: "button", onClick: () => moveBlueprintSection(item.componentId, -1), disabled: index === 0, title: "Move up", children: _jsx(ArrowUp, { size: 12 }) }), _jsx("button", { type: "button", onClick: () => moveBlueprintSection(item.componentId, 1), disabled: index === blueprintDraft.order.length - 1, title: "Move down", children: _jsx(ArrowDown, { size: 12 }) })] })] }, item.componentId));
                        }) })] })), tab === 'sitemap' && (_jsxs("div", { className: "fsp-pane", children: [_jsxs("div", { className: "fsp-pane__heading", children: [_jsxs("div", { children: [_jsx("span", { children: "Information architecture" }), _jsxs("strong", { children: [plan.pages.length, " pages connected"] })] }), _jsx("button", { type: "button", className: "fsp-icon-btn", onClick: () => addPage(null), title: "Add top-level page", children: _jsx(FilePlus2, { size: 15 }) })] }), _jsxs("label", { className: "fsp-project-name", children: [_jsx("span", { children: "Project" }), _jsx("input", { value: plan.projectName, onChange: (event) => setPlan((current) => ({ ...current, projectName: event.target.value })) })] }), _jsx("div", { className: "fsp-sitemap", children: rootPages.map((page) => renderPageCard(page)) }), _jsxs("div", { className: "fsp-page-editor", children: [_jsxs("div", { className: "fsp-page-editor__top", children: [_jsx("strong", { children: "Edit page" }), _jsxs("div", { children: [_jsx("button", { type: "button", className: "fsp-icon-btn", onClick: () => duplicatePage(selectedPage), title: "Duplicate page", children: _jsx(Copy, { size: 13 }) }), _jsx("button", { type: "button", className: "fsp-icon-btn is-danger", onClick: () => deletePage(selectedPage.id), title: "Delete page", children: _jsx(Trash2, { size: 13 }) })] })] }), _jsxs("div", { className: "fsp-fields", children: [_jsxs("label", { children: [_jsx("span", { children: "Name" }), _jsx("input", { value: selectedPage.name, onChange: (event) => updatePage(selectedPage.id, (page) => ({ ...page, name: event.target.value })) })] }), _jsxs("label", { children: [_jsx("span", { children: "Path" }), _jsx("input", { value: selectedPage.path, onChange: (event) => updatePage(selectedPage.id, (page) => ({ ...page, path: event.target.value })) })] })] }), _jsxs("div", { className: "fsp-page-editor__actions", children: [_jsxs("button", { type: "button", onClick: () => addPage(selectedPage.id), children: [_jsx(Plus, { size: 13 }), " Child page"] }), _jsxs("button", { type: "button", onClick: () => setTab('wireframe'), children: [_jsx(LayoutTemplate, { size: 13 }), " Open wireframe"] })] })] })] })), tab === 'wireframe' && (_jsxs("div", { className: "fsp-pane", children: [_jsxs("div", { className: "fsp-pane__heading", children: [_jsxs("div", { children: [_jsx("span", { children: selectedPage.path }), _jsxs("strong", { children: [selectedPage.name, " wireframe"] })] }), _jsxs("span", { className: `fsp-status is-${selectedPage.status}`, children: [selectedPage.status === 'ready' ? _jsx(Check, { size: 12 }) : null, selectedPage.status] })] }), frameControls, _jsxs("button", { type: "button", className: "fsp-blank-page-btn", onClick: () => addBlankPage(), children: [_jsx(Frame, { size: 15 }), "Add blank white page"] }), _jsxs("div", { className: "fsp-wireframe", children: [selectedPage.sections.map((section, index) => {
                                const definition = section.componentId ? componentById(section.componentId) : null;
                                return (_jsxs("article", { className: "fsp-wireframe-item", children: [definition ? _jsx(ComponentPreview, { componentId: definition.id }) : _jsx("div", { className: "fsp-preview fsp-preview--blank", children: _jsx(Frame, { size: 18 }) }), _jsxs("div", { className: "fsp-wireframe-item__meta", children: [_jsx("span", { children: definition?.category ?? 'Blank artboard' }), _jsx("strong", { children: section.name }), _jsxs("div", { className: "fsp-section-frame", children: [_jsxs("select", { value: section.frame.preset, onChange: (event) => applyFramePreset(section.id, event.target.value), children: [_jsx("option", { value: "responsive", children: "Responsive" }), _jsx("option", { value: "desktop", children: "Desktop" }), _jsx("option", { value: "tablet", children: "Tablet" }), _jsx("option", { value: "mobile", children: "Mobile" }), _jsx("option", { value: "custom", children: "Custom" })] }), _jsx("input", { "aria-label": `${section.name} width`, type: "number", min: "120", value: section.frame.width, onChange: (event) => updateSectionFrame(section.id, (frame) => ({ ...frame, preset: 'custom', width: Number(event.target.value) || 120 })) }), _jsx("span", { children: "\u00D7" }), _jsx("input", { "aria-label": `${section.name} height`, type: "number", min: "80", value: section.frame.height, onChange: (event) => updateSectionFrame(section.id, (frame) => ({ ...frame, preset: 'custom', height: Number(event.target.value) || 80 })) })] })] }), _jsxs("div", { className: "fsp-wireframe-item__actions", children: [_jsx("button", { type: "button", onClick: () => moveSection(index, -1), disabled: index === 0, title: "Move up", children: _jsx(ArrowUp, { size: 12 }) }), _jsx("button", { type: "button", onClick: () => moveSection(index, 1), disabled: index === selectedPage.sections.length - 1, title: "Move down", children: _jsx(ArrowDown, { size: 12 }) }), _jsx("button", { type: "button", onClick: () => shuffleSection(index), title: "Try another layout", children: _jsx(RefreshCw, { size: 12 }) }), _jsx("button", { type: "button", onClick: () => section.componentId
                                                        ? onInsertComponent(section.componentId, placement, section.frame)
                                                        : onInsertBlankFrame(placement, section.frame), title: "Insert this section", children: _jsx(Plus, { size: 12 }) }), _jsx("button", { type: "button", onClick: () => removeSection(index), title: "Remove", children: _jsx(Trash2, { size: 12 }) })] })] }, section.id));
                            }), selectedPage.sections.length === 0 && (_jsxs("button", { type: "button", className: "fsp-empty", onClick: () => setTab('library'), children: [_jsx(Grid2X2, { size: 22 }), "Add the first section from the library"] }))] }), _jsxs("div", { className: "fsp-build-bar", children: [_jsxs("button", { type: "button", className: "is-secondary", onClick: () => setTab('library'), children: [_jsx(Plus, { size: 14 }), " Add section"] }), _jsxs("button", { type: "button", className: "is-primary", onClick: buildSelectedPage, disabled: selectedPage.sections.length === 0, children: [_jsx(LayoutTemplate, { size: 14 }), " Build page"] })] })] })), tab === 'library' && (_jsxs("div", { className: "fsp-pane", children: [frameControls, _jsxs("button", { type: "button", className: "fsp-blank-page-btn", onClick: () => addBlankPage(true), children: [_jsx(Frame, { size: 15 }), "Insert blank white page"] }), _jsxs("div", { className: "fsp-library-tools", children: [_jsxs("label", { className: "fsp-search", children: [_jsx(Search, { size: 14 }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search 36 components..." })] }), _jsx("button", { type: "button", className: `fsp-icon-btn ${favoritesOnly ? 'is-active' : ''}`, onClick: () => setFavoritesOnly((value) => !value), title: "Show favorites", children: _jsx(Heart, { size: 14, fill: favoritesOnly ? 'currentColor' : 'none' }) })] }), _jsx("div", { className: "fsp-category-row", children: FROAM_CATEGORIES.map((item) => (_jsx("button", { type: "button", className: category === item ? 'is-active' : '', onClick: () => setCategory(item), children: item }, item))) }), _jsxs("div", { className: "fsp-library-count", children: [_jsxs("span", { children: [filteredComponents.length, " patterns"] }), _jsxs("span", { children: ["Adding to ", selectedPage.name] })] }), _jsx("div", { className: "fsp-library-grid", children: filteredComponents.map((component) => {
                            const favorite = plan.favorites.includes(component.id);
                            return (_jsxs("article", { className: "fsp-library-card", children: [_jsxs("div", { className: "fsp-library-card__preview", children: [_jsx(ComponentPreview, { componentId: component.id }), _jsx("button", { type: "button", className: `fsp-favorite ${favorite ? 'is-active' : ''}`, onClick: () => toggleFavorite(component.id), title: favorite ? 'Remove favorite' : 'Save favorite', children: _jsx(Heart, { size: 13, fill: favorite ? 'currentColor' : 'none' }) })] }), _jsxs("div", { className: "fsp-library-card__body", children: [_jsx("span", { children: component.category }), _jsx("strong", { children: component.title }), _jsx("p", { children: component.summary })] }), _jsxs("div", { className: "fsp-library-card__actions", children: [_jsxs("button", { type: "button", onClick: () => addSection(component.id), children: [_jsx(Plus, { size: 12 }), " Wireframe"] }), _jsx("button", { type: "button", className: "is-primary", onClick: () => addSection(component.id, true), children: "Insert" })] })] }, component.id));
                        }) })] }))] }));
}
//# sourceMappingURL=FroamSitePlanner.js.map