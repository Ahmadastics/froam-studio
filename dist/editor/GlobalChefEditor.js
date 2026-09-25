import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignHorizontalDistributeCenter, AlignHorizontalJustifyCenter, AlignLeft, AlignRight, AlignVerticalDistributeCenter, AlignVerticalJustifyCenter, Bold, Box, ClipboardCheck, Clock, Code, Command, Copy, Download, Eraser, Eye, EyeOff, FileImage, FileText, GitCommit, Grid2X2, Grip, ImagePlus, Italic, Keyboard, Layers, LayoutGrid, ListTree, Link, Minus, Monitor, MousePointer, Share2, Smartphone, Tablet, MousePointer2, MessageSquare, Move, Paintbrush, Palette, PencilLine, Plus, Redo2, RotateCw, Save, DraftingCompass, ScanLine, Search, SlidersHorizontal, Sparkles, Square, SquareDashedBottom, Strikethrough, Type, Underline, Undo2, Unlink, Variable, Maximize2, X, Zap, Coins, AlignCenterHorizontal, AlignCenterVertical, Timer, } from 'lucide-react';
import FroamSectionBoundary from './FroamSectionBoundary.js';
import { apiGetFresh, apiPost } from '../lib/api.js';
import { bridgeUrl } from '../lib/bridge.js';
import FroamResizeHandles from './FroamResizeHandles.js';
import FroamFloatingBar from './FroamFloatingBar.js';
import FroamContextMenu from './FroamContextMenu.js';
import FroamBottomSheet from './FroamBottomSheet.js';
import FroamBlueprint from './FroamBlueprint.js';
import { COARSE_POINTER_QUERY, MOBILE_UI_QUERY, useMediaQuery } from './froamMedia.js';
import FroamExport from './FroamExport.js';
import FroamShortcutOverlay from './FroamShortcutOverlay.js';
import FroamSmartGuides from './FroamSmartGuides.js';
import FroamVersionPanel from './FroamVersionPanel.js';
import FroamSitePlanner from './FroamSitePlanner.js';
import { createFroamLibraryComponent, FROAM_COMPONENTS } from './FroamComponentCatalog.js';
import FroamDesignSystemPanel from './FroamDesignSystemPanel.js';
import { FROAM_FRAME_PRESETS, } from './FroamPlannerTypes.js';
import FroamToolbar from './FroamToolbar.js';
import FroamIntel from './FroamIntel.js';
import FroamLayersPanel from './FroamLayersPanel.js';
import FroamDesignPanel from './FroamDesignPanel.js';
import FroamInspirationPanel from './FroamInspirationPanel.js';
import FroamShapeLibrary from './FroamShapeLibrary.js';
import FroamPersonaEditor from './FroamPersonaEditor.js';
import { getFroamStudioConfig } from '../config.js';
import { createOpLogSession } from '../collab/session.js';
import { useFroamRoom } from '../collab/useFroamRoom.js';
import { readRoomFromLocation } from '../collab/room.js';
import FroamNotePins from './FroamNotePins.js';
import FroamPresenceLayer from './FroamPresenceLayer.js';
import FroamConnectedCanvas from './FroamConnectedCanvas.js';
import FroamIntelligence from './FroamIntelligence.js';
import FroamReferenceWorkspace from './FroamReferenceWorkspace.js';
import FroamIntentResult from './FroamIntentResult.js';
import FroamQuickChat from './FroamQuickChat.js';
import { useFroamIntent } from './useFroamIntent.js';
import { shouldOfferAskFroam } from './froam-intent-model.js';
import { searchFroamQuickEdits } from './quick-edit-catalog.js';
import FroamLabs from './FroamLabs.js';
import FroamWorkspaceShell from './FroamWorkspaceShell.js';
import FroamUICustomizer from './FroamUICustomizer.js';
import { froamUIPanelWidth, readFroamUIPreference, writeFroamUIPreference } from './froamUIPreferences.js';
import { FROAM_WORKSPACE_SECTIONS, readWorkspacePreference, workspaceCommandMatches, writeWorkspacePreference } from './workspace-shell-model.js';
import { projectTextLayerStyles } from './text-style-projection.js';
import { SECTION_STRUCTURE_KEY, assignFreshFroamNodeIds, readSectionStructureDraft, writeSectionStructureDraft, } from './section-structure.js';
import { readFroamLabsFlags, writeFroamLabsFlags } from '../project/experiments.js';
import { appendProjectEvents, createProjectEvent, deriveBranchState, switchProjectBranch } from '../project/event-log.js';
import { validateReferenceBuildCandidate } from '../project/reference-build.js';
import { sitePlanGraphRecords } from '../project/adapters.js';
import { useFroamProjectDocument } from './useFroamProjectDocument.js';
import FroamRoomChat from './FroamRoomChat.js';
import { diffStores } from '../collab/oplog.js';
import { loadOpLog, saveOpLog } from '../collab/persist.js';
import { findElementByPath, getElementPath, isInPageScope, isPathElement, isSafeDraftPath } from '../collab/paths.js';
import { usePageCanvasOffset } from './usePageCanvasOffset.js';
import { createAnchor, resolveAnchor } from '../collab/anchor.js';
import { fingerprintForDraft } from './draft-fingerprint.js';
import { LOCAL_ACTOR, scopeKey } from '../collab/types.js';
import { captureNodeRef, resolveNodeRef } from '../project/node-registry.js';
import { archiveItemKind, createArchiveItem, minimalArchiveDna } from '../project/archive.js';
import { componentCatalogFamilies } from '../project/component-adapter.js';
import { upsertAnimationCss } from '../project/animator-adapter.js';
import { createReusableStyle, saveReusableStyle, upsertComponentFamily } from '../project/design-system.js';
import { createFrameworkIdentityObserver } from '../project/framework-identity.js';
import { froamProjectId as createFroamProjectId, froamStorageKey, resolveFroamProjectKey } from '../project/storage-scope.js';
import { collectStoreFontFamilies, ensureBrandFontStyle, ensureFontLinks, fontOptionsFor, sanitizeBrandFonts, } from './fontSources.js';
import { useFroamRouteKey } from '../routing.js';
import { useCanvasPointer } from './chef/useCanvasPointer.js';
import { useSelectionTracking } from './chef/useSelectionTracking.js';
import { sampleSiteTheme } from './library/site-theme.js';
import { usePatternDrop } from './library/pattern-drop.js';
import { FroamCollaborate } from './collaborate/FroamCollaborate.js';
import { buildChangeRequest } from './collaborate/request-builder.js';
import { PSEUDO_HOST_ATTR, pseudoKey } from './chef/pseudo.js';
import { useDraftPainter } from './chef/useDraftPainter.js';
import { useDeviceShell } from './chef/useDeviceShell.js';
import { readFroamPersonaDraft, sanitizeFroamPersona, isFroamPersonaPath, } from './froamPersona.js';
import { intelligenceTabs, labTabs, CHEF_BUTTON_START, CANVAS_KEY, INJECTION_KEY, ROOT_PARENT_KEY, INJECTED_BLOCK_SELECTOR, VIEWPORT_MODES, DEVICE_SHELL_ID, } from './chef/types.js';
import { cursorOptions, displayOptions, flexDirectionOptions, justifyOptions, alignOptions, positionOptions, overflowOptions, borderStyleOptions, blendModeOptions, textTransformOptions, persistedStyleKeys, } from './chef/style-options.js';
import { MAX_PERSONA_IMAGE_BYTES, SAVE_META_KEY, BRAND_FONT_MAX_BYTES, loadBrandFonts, saveBrandFontsForProject, loadStore, saveStoreForProject, loadNodeRegistry, saveNodeRegistryForProject, loadPersonaPreference, savePersonaPreference, personasEqual, stripPersonaDrafts, withPersonaDraft, countRenderableDrafts, } from './chef/storage.js';
import { getRoot, getCanvasHost, applyGlobalCSS, isSvgInternal, shouldSkipElement, readNumber, camelToKebab, readImageUrl, buildSelection, } from './chef/dom.js';
import { describeChange, relativeTime, changeByline, buildFroamChangeReport } from './chef/change-report.js';
import { SINGLE_LINE_TAGS, isWritableElement, placeCaret, isEditableField, isTextVisualLayer, } from './chef/writing.js';
import { sanitizeDraftForElement, applyDraft, isInjectionPath, isSectionStructurePath, readInjectionDraft, readLiveElementDraft, applyCanvasDraftStyles, clearCanvasDraftStyles, } from './chef/drafts.js';
import { ensureFroamNodeId, isStructuralLayerElement, syncStructureBoundaryLabel, buildLayerNode, collectLayers, } from './chef/layers.js';
import { collectCSSVars, readCanvasState, capturePageThumb, syncFroamArtboardMetadata, buildGradientCSS, } from './chef/canvas.js';
import { AccordionSection, Toast, FroamWelcomeTips, SCAN_DONE_KEY, BLUEPRINT_SEEN_KEY, FroamScan, MeasurementOverlay, ClickPulseOverlay, SelectionHandoffOverlay, } from './chef/overlays.js';
export default function GlobalChefEditor({ initialOpen = false, routeKey: explicitRouteKey, projectKey: explicitProjectKey }) {
    const routeKey = useFroamRouteKey(explicitRouteKey);
    const projectKey = useMemo(() => resolveFroamProjectKey(explicitProjectKey), [explicitProjectKey]);
    const saveStore = useCallback((next) => saveStoreForProject(next, projectKey), [projectKey]);
    const saveBrandFonts = useCallback((next) => saveBrandFontsForProject(next, projectKey), [projectKey]);
    const saveNodeRegistry = useCallback((next) => saveNodeRegistryForProject(next, projectKey), [projectKey]);
    const [portalContainer] = useState(() => {
        if (typeof document === 'undefined')
            return null;
        const container = document.createElement('div');
        container.id = 'froam-editor-portal';
        container.setAttribute('data-chef-editor-root', 'true');
        return container;
    });
    useEffect(() => {
        if (!portalContainer)
            return;
        document.body.appendChild(portalContainer);
        return () => {
            portalContainer.remove();
        };
    }, [portalContainer]);
    // Core state
    const [store, setStore] = useState(() => loadStore(projectKey));
    const [brandFonts, setBrandFonts] = useState(() => loadBrandFonts(projectKey));
    const nodeRegistryRef = useRef(loadNodeRegistry(projectKey));
    const [buttonPosition, setButtonPosition] = useState(CHEF_BUTTON_START);
    const [panelPosition, setPanelPosition] = useState(null);
    const panelDragRef = useRef(null);
    const [panelOpen, setPanelOpen] = useState(initialOpen);
    const [active, setActive] = useState(initialOpen);
    const [selection, setSelection] = useState(null);
    const [selections, setSelections] = useState([]);
    const [selectionCandidates, setSelectionCandidates] = useState([]);
    const [canvas, setCanvas] = useState(() => ({ background: '#050505', text: '#ffffff' }));
    const [zoom, setZoom] = useState(1);
    const [persona, setPersona] = useState(() => loadPersonaPreference());
    const [personaDraft, setPersonaDraft] = useState(() => loadPersonaPreference());
    const [personaEditorOpen, setPersonaEditorOpen] = useState(false);
    // UI state
    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [openSections, setOpenSections] = useState({
        intel: true,
        quickActions: false,
        layout: false,
        spacing: false,
        typography: false,
        fill: false,
        borders: false,
        effects: false,
        transform: false,
        container: false,
        layers: false,
        gradient: false,
        cssVars: false,
        history: false,
        notes: false,
        share: false,
        textShadow: false,
        versions: false,
        shapes: false,
        animator: false,
        export: false,
        inspiration: false,
        tokens: false,
        designSystem: false,
        align: false,
        transitions: false,
        assets: false,
    });
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [quickChatOpen, setQuickChatOpen] = useState(false);
    const [workspacePreference, setWorkspacePreference] = useState(() => readWorkspacePreference(typeof localStorage === 'undefined' ? undefined : localStorage));
    const [uiPreference, setUIPreference] = useState(() => readFroamUIPreference(typeof localStorage === 'undefined' ? undefined : localStorage));
    const [uiCustomizerOpen, setUICustomizerOpen] = useState(false);
    const [leftWorkspaceMode, setLeftWorkspaceMode] = useState(() => workspacePreference.sections.understand === 'reference' ? 'reference' : workspacePreference.sections.understand === 'layers' ? 'layers' : 'plan');
    const [plannerRequestedTab, setPlannerRequestedTab] = useState(() => workspacePreference.sections.create === 'library' ? 'library' : 'sitemap');
    // v4: phone-first editing — compact chrome on small viewports, touch behaviors on coarse pointers
    const isMobileUI = useMediaQuery(MOBILE_UI_QUERY);
    const isTouchDevice = useMediaQuery(COARSE_POINTER_QUERY);
    const [sheetDetent, setSheetDetent] = useState('peek');
    const [leftPanelOpen, setLeftPanelOpen] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [studioMinimized, setStudioMinimized] = useState(false);
    const [scanActive, setScanActive] = useState(false);
    const [blueprintOpen, setBlueprintOpen] = useState(false);
    const [connectedCanvasOpen, setConnectedCanvasOpen] = useState(false);
    const [intelligenceOpen, setIntelligenceOpen] = useState(() => workspacePreference.mode === 'understand'
        && workspacePreference.sections.understand !== 'reference'
        && workspacePreference.sections.understand !== 'layers');
    const [labsOpen, setLabsOpen] = useState(() => workspacePreference.mode === 'experiment');
    const [labsFlags, setLabsFlags] = useState(() => readFroamLabsFlags(typeof localStorage === 'undefined' ? undefined : localStorage));
    const [requestedIntelligenceTab, setRequestedIntelligenceTab] = useState(() => intelligenceTabs[workspacePreference.sections.understand ?? 'scan'] ?? 'scan');
    const [requestedLab, setRequestedLab] = useState(() => labTabs[workspacePreference.sections.experiment ?? 'laboratory'] ?? 'overview');
    const [requestedConnectedTab, setRequestedConnectedTab] = useState('replay');
    const [temporalOwner, setTemporalOwner] = useState(null);
    const [workspaceActivity, setWorkspaceActivity] = useState(null);
    const [identityDiagnostics, setIdentityDiagnostics] = useState([]);
    const [frameworkIdentityFinding, setFrameworkIdentityFinding] = useState(null);
    const [tipsReady, setTipsReady] = useState(() => {
        try {
            return window.localStorage.getItem(froamStorageKey(SCAN_DONE_KEY, projectKey)) === '1';
        }
        catch {
            return true;
        }
    });
    const [commandSearch, setCommandSearch] = useState('');
    const [commandFocusIndex, setCommandFocusIndex] = useState(0);
    const commandPaletteRef = useRef(null);
    const commandPaletteReturnFocusRef = useRef(null);
    const [inlineEditing, setInlineEditing] = useState(false);
    const [measureRect, setMeasureRect] = useState(null);
    useEffect(() => { writeWorkspacePreference(typeof localStorage === 'undefined' ? undefined : localStorage, workspacePreference); }, [workspacePreference]);
    useEffect(() => { writeFroamUIPreference(typeof localStorage === 'undefined' ? undefined : localStorage, uiPreference); }, [uiPreference]);
    useEffect(() => {
        if (!commandPaletteOpen)
            return;
        return () => {
            if (commandPaletteReturnFocusRef.current?.isConnected)
                commandPaletteReturnFocusRef.current.focus();
            commandPaletteReturnFocusRef.current = null;
        };
    }, [commandPaletteOpen]);
    useEffect(() => {
        if (!portalContainer)
            return;
        portalContainer.dataset.froamUiAppearance = uiPreference.appearance;
        portalContainer.dataset.froamUiAccent = uiPreference.accent;
        portalContainer.dataset.froamUiDensity = uiPreference.density;
        portalContainer.dataset.froamUiLabels = uiPreference.labels ? 'shown' : 'hidden';
    }, [portalContainer, uiPreference]);
    useEffect(() => { writeFroamLabsFlags(typeof localStorage === 'undefined' ? undefined : localStorage, labsFlags); }, [labsFlags]);
    // v4: New feature state
    const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState(null);
    const [selectionRect, setSelectionRect] = useState(null);
    const [selectionHandoffKey, setSelectionHandoffKey] = useState(0);
    // Where the last selecting click landed — typing then writes from that spot.
    const lastClickPointRef = useRef(null);
    // A tool-shortcut letter typed on selected copy waits a beat: more typing
    // means writing, silence means the shortcut.
    const pendingToolKeyRef = useRef(null);
    // The click feedback: a ripple where the pointer landed + a flash over what it picked.
    const [clickPulse, setClickPulse] = useState(null);
    const [selectionHandoffMode, setSelectionHandoffMode] = useState('Editing');
    const [smartGuides] = useState([]);
    const [clipboardStyles, setClipboardStyles] = useState(null);
    const [isResizing, setIsResizing] = useState(false);
    const resizeBaseRef = useRef(null);
    // Drag-to-move mode
    const [moveMode, setMoveMode] = useState(false);
    const moveDragRef = useRef(null);
    // v4.1: remember an element's display before hiding, so Show restores its layout
    const hiddenPrevDisplayRef = useRef({});
    // Undo/redo — a cursor into the op log, not a stack of store snapshots.
    // Bumped whenever the log moves, purely so the toolbar buttons re-render.
    const [logVersion, setLogVersion] = useState(0);
    /**
     * The op log (v4.9.2). Every state-changing edit is recorded here as a
     * field-level operation, alongside the store that paints the page.
     *
     * The store is still what renders; the log is what undo, history and — from
     * v5 — a room read from. Keeping both for one release means the log can be
     * proven against real editing before anything depends on it.
     * See src/collab/ and ROADMAP.md Phase 0.
     */
    const opLogRef = useRef(null);
    if (!opLogRef.current) {
        // Seeded at construction, not from the first effect run. Tying the two
        // together is what makes a remount safe: a fresh session is always born
        // knowing the design it woke up to, so no real edit can ever be mistaken
        // for the baseline.
        // Last session's history first, then seed whatever the design has that the
        // log doesn't. When the two already agree — the normal case — seeding is a
        // no-op and yesterday's undo history survives intact. When they disagree,
        // because the design was changed by something other than this editor, the
        // difference lands as baseline and the log tells the truth again.
        const session = createOpLogSession({ ops: loadOpLog(projectKey) });
        session.seed(store);
        opLogRef.current = session;
    }
    const opLog = opLogRef.current;
    const opBatchRef = useRef(null);
    const opBatchTimerRef = useRef(0);
    /**
     * Names the next store change for the reconciler.
     *
     * Paths that write straight to the store — inline text, drag-to-move,
     * clearing a route — get caught by the reconciler and would otherwise all
     * read as "Edit". That is survivable alone and useless in a shared log,
     * where "Zainab · Edit · div" tells you nothing. Consumed once, then reset.
     */
    const opPendingLabelRef = useRef(null);
    /** Set by paths that load a design rather than edit one, so the ops they
     *  produce are baseline rather than someone's undo history. */
    const opLoadingDesignRef = useRef(false);
    const bumpLog = useCallback(() => setLogVersion((n) => n + 1), []);
    // Recomputed whenever the log moves. `logVersion` is the dependency that
    // makes that happen — the session itself is a ref and can't trigger a render.
    const canUndo = useMemo(() => opLog.canUndo(), [logVersion, store]);
    const canRedo = useMemo(() => opLog.canRedo(), [logVersion, store]);
    // Gradient builder
    const [gradType, setGradType] = useState('linear');
    const [gradAngle, setGradAngle] = useState(135);
    const [gradStops, setGradStops] = useState([
        { color: '#5eead4', position: 0 },
        { color: '#ff6c4f', position: 100 },
    ]);
    // Spacing link
    const [marginLinked, setMarginLinked] = useState(true);
    const [paddingLinked, setPaddingLinked] = useState(true);
    const [radiusLinked, setRadiusLinked] = useState(true);
    // Viewport simulation
    const [viewportMode, setViewportMode] = useState('desktop');
    const [activeTool, setActiveTool] = useState('pointer');
    // Layers
    const [layers, setLayers] = useState([]);
    // CSS Variables
    const [cssVars, setCssVars] = useState([]);
    const [repoStatus, setRepoStatus] = useState(null);
    const [repoDirtyCount, setRepoDirtyCount] = useState(0);
    const [newVarName, setNewVarName] = useState('');
    const [newVarValue, setNewVarValue] = useState('');
    // Design Tokens (named colors, spacing, type scales)
    const [tokens, setTokens] = useState(() => {
        if (typeof window === 'undefined')
            return [];
        try {
            return JSON.parse(window.localStorage.getItem(froamStorageKey('froam-tokens-v1', projectKey)) || '[]');
        }
        catch {
            return [];
        }
    });
    const [newTokenName, setNewTokenName] = useState('');
    const [newTokenValue, setNewTokenValue] = useState('');
    const [newTokenCategory, setNewTokenCategory] = useState('color');
    // Transition editor
    const [transitionProp, setTransitionProp] = useState('all');
    const [transitionDuration, setTransitionDuration] = useState(300);
    const [transitionEasing, setTransitionEasing] = useState('ease');
    const [transitionDelay, setTransitionDelay] = useState(0);
    // Asset manager
    const [assets, setAssets] = useState(() => {
        if (typeof window === 'undefined')
            return [];
        try {
            return JSON.parse(window.localStorage.getItem(froamStorageKey('froam-assets-v1', projectKey)) || '[]');
        }
        catch {
            return [];
        }
    });
    const [assetSearch, setAssetSearch] = useState('');
    // Refs
    const dragRef = useRef(null);
    const fileInputRef = useRef(null);
    const pendingImageTargetRef = useRef(null);
    const pendingCanvasImageRef = useRef(false);
    const currentSelectionRef = useRef(null);
    /** What the selected element *is*, so it can be found again if the page moves. */
    const selectionAnchorRef = useRef(null);
    const selectionSwitchTargetRef = useRef(null);
    const selectionSwitchTimerRef = useRef(0);
    const currentHoverRef = useRef(null);
    const originalsRef = useRef({});
    const sectionBaselineRef = useRef(new Map());
    const toastTimerRef = useRef(0);
    const suspendDraftPaintingRef = useRef(false);
    const pendingDraftPaintResumeRef = useRef(false);
    const loadedPublishedKeysRef = useRef(new Set());
    const intelligencePreviewStyleRef = useRef(null);
    const isKitchenRoute = routeKey === '/kitchen';
    // Each viewport gets its own isolated store bucket
    const viewportStoreKey = `${routeKey}@@${viewportMode}`;
    const viewportStoreKeyRef = useRef(viewportStoreKey);
    viewportStoreKeyRef.current = viewportStoreKey;
    const routeDrafts = useMemo(() => store[viewportStoreKey] ?? {}, [store, viewportStoreKey]);
    /** What people did on this route + viewport, newest first. */
    const changeLog = useMemo(() => opLog.changes(60).filter((c) => scopeKey(c.routeKey, c.viewport) === viewportStoreKey), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logVersion, store, viewportStoreKey]);
    /**
     * The session, if this page is one. Inert without an invite in the URL:
     * no polling, no storage, nothing rendered.
     *
     * The editor is the presenter's side — it announces where it is so a client
     * following along knows which page to be on.
     */
    const [roomLockedPath, setRoomLockedPath] = useState(null);
    const [roomCursor, setRoomCursor] = useState(null);
    // Someone who arrived by an invite link is asked their name — it's what the
    // owner sees on their changes. The owner, in their own room, is just in it.
    const [invitedByLink] = useState(() => readRoomFromLocation() !== null);
    const room = useFroamRoom({
        where: {
            routeKey,
            viewport: viewportMode,
            selectedPath: selection?.path ?? null,
            selectedNodeId: selection?.nodeId ?? null,
            lockedPath: roomLockedPath,
            lockedNodeId: roomLockedPath === selection?.path ? selection?.nodeId ?? null : null,
            cursor: roomCursor,
            tool: activeTool,
            action: roomLockedPath ? 'Transforming selection' : selection ? 'Editing selection' : null,
        },
        autoJoinAs: invitedByLink ? undefined : persona.name || 'Designer',
        autoJoinProfile: { avatarUrl: persona.imageUrl || null },
    });
    const roomPresence = room.present;
    const froamProjectId = createFroamProjectId(projectKey);
    const projectSession = useFroamProjectDocument({ projectId: froamProjectId, actorId: room.identity?.actor ?? LOCAL_ACTOR, ops: opLog.all(), store, revision: logVersion });
    const activeProjectState = useMemo(() => deriveBranchState(projectSession.project), [projectSession.project]);
    const layerKnowledge = useMemo(() => {
        const result = {};
        const interactionCounts = new Map();
        Object.values(activeProjectState.interactions).forEach((interaction) => {
            interactionCounts.set(interaction.sourceId, (interactionCounts.get(interaction.sourceId) ?? 0) + 1);
            interaction.targetIds.forEach((nodeId) => interactionCounts.set(nodeId, (interactionCounts.get(nodeId) ?? 0) + 1));
        });
        const archived = new Set(Object.values(activeProjectState.archive).map((item) => item.nodeId));
        const ids = new Set([
            ...Object.keys(activeProjectState.nodes),
            ...Object.keys(activeProjectState.dna),
            ...Object.keys(activeProjectState.responsive),
            ...interactionCounts.keys(),
            ...archived,
        ]);
        ids.forEach((nodeId) => {
            result[nodeId] = {
                graph: Boolean(activeProjectState.nodes[nodeId]),
                dna: Boolean(activeProjectState.dna[nodeId]),
                interactions: interactionCounts.get(nodeId) ?? 0,
                responsive: activeProjectState.responsive[nodeId]?.priority,
                archived: archived.has(nodeId),
            };
        });
        return result;
    }, [activeProjectState]);
    const plannerArchiveItems = useMemo(() => Object.values(activeProjectState.archive).map((item) => ({
        id: item.id,
        name: item.name,
        html: item.snapshot?.html,
    })), [activeProjectState.archive]);
    const projectActorId = room.identity?.actor ?? LOCAL_ACTOR;
    const replaceDesignSystem = useCallback((designSystem, label) => {
        projectSession.setProject((current) => appendProjectEvents(current, [createProjectEvent({
                projectId: current.id,
                branchId: current.activeBranchId,
                actorId: projectActorId,
                clock: Math.max(0, ...current.events.map((event) => event.clock)) + 1,
                type: 'design-system.replaced',
                payload: { designSystem },
                targetIds: Object.keys(designSystem.variables),
                label,
            })]));
    }, [projectActorId, projectSession.setProject]);
    useEffect(() => {
        if (!clickPulse)
            return undefined;
        const timer = window.setTimeout(() => setClickPulse(null), 700);
        return () => window.clearTimeout(timer);
    }, [clickPulse]);
    useEffect(() => {
        const catalogFamilies = componentCatalogFamilies(FROAM_COMPONENTS);
        if (catalogFamilies.every((family) => activeProjectState.designSystem.componentFamilies[family.id]))
            return;
        let next = activeProjectState.designSystem;
        for (const family of catalogFamilies)
            if (!next.componentFamilies[family.id])
                next = upsertComponentFamily(next, family);
        replaceDesignSystem(next, 'Added component catalog families');
    }, [activeProjectState.designSystem, replaceDesignSystem]);
    const syncSitePlanGraph = useCallback((pages) => {
        projectSession.setProject((current) => {
            const state = deriveBranchState(current);
            const graph = sitePlanGraphRecords(pages);
            const nodeIds = new Set(graph.nodes.map((node) => node.id));
            const relationIds = new Set(graph.relations.map((relation) => relation.id));
            const changes = [];
            graph.nodes.forEach((node) => {
                if (JSON.stringify(state.nodes[node.id]) !== JSON.stringify(node))
                    changes.push({ type: 'node.upserted', payload: { node }, targetIds: [node.id] });
            });
            graph.relations.forEach((relation) => {
                if (JSON.stringify(state.relations[relation.id]) !== JSON.stringify(relation))
                    changes.push({ type: 'relation.upserted', payload: { relation }, targetIds: [relation.from, relation.to] });
            });
            Object.values(state.nodes).filter((node) => node.metadata?.sitePlanner === true && !nodeIds.has(node.id)).forEach((node) => changes.push({ type: 'node.removed', payload: { nodeId: node.id }, targetIds: [node.id] }));
            Object.values(state.relations).filter((relation) => relation.metadata?.sitePlanner === true && !relationIds.has(relation.id)).forEach((relation) => changes.push({ type: 'relation.removed', payload: { relationId: relation.id }, targetIds: [relation.from, relation.to] }));
            if (!changes.length)
                return current;
            let clock = Math.max(0, ...current.events.map((event) => event.clock));
            const createdAt = Date.now();
            const batchId = `site-plan:${createdAt.toString(36)}`;
            return appendProjectEvents(current, changes.map((change) => createProjectEvent({
                projectId: current.id,
                branchId: current.activeBranchId,
                actorId: projectActorId,
                clock: ++clock,
                createdAt,
                type: change.type,
                payload: change.payload,
                targetIds: change.targetIds,
                batchId,
                label: 'Update page structure',
            })));
        });
    }, [projectActorId, projectSession.setProject]);
    const roomSubmittedOpsRef = useRef(new Set());
    const remoteLocks = useMemo(() => new Map(roomPresence.filter((member) => member.lockedPath).map((member) => [member.lockedPath, member])), [roomPresence]);
    function guardRemoteLock(path) {
        const member = remoteLocks.get(path) ?? [...remoteLocks.entries()]
            .find(([locked]) => path.startsWith(`${locked}/`) || locked.startsWith(`${path}/`))?.[1];
        if (!member)
            return false;
        showToast(`${member.name} is editing that`);
        return true;
    }
    useEffect(() => {
        roomSubmittedOpsRef.current.clear();
    }, [room.roomId]);
    useEffect(() => {
        if (room.identity?.actor)
            opLog.setActor(room.identity.actor);
    }, [opLog, room.identity?.actor]);
    useEffect(() => {
        if (inlineEditing && selection?.path)
            setRoomLockedPath(selection.path);
        else if (!isResizing && !moveDragRef.current)
            setRoomLockedPath(null);
    }, [inlineEditing, isResizing, selection?.path]);
    // A pointer is useful presence only in Studio mode. Five updates a second
    // feels live without turning the room store into a mouse-movement database.
    useEffect(() => {
        if (!room.inRoom || (!panelOpen && !active)) {
            setRoomCursor(null);
            return;
        }
        let last = 0;
        const move = (event) => {
            const stamp = performance.now();
            if (stamp - last < 180)
                return;
            last = stamp;
            setRoomCursor({ x: event.clientX, y: event.clientY });
        };
        window.addEventListener('pointermove', move, { passive: true });
        return () => window.removeEventListener('pointermove', move);
    }, [room.inRoom, panelOpen, active]);
    // Apply the room's canonical op order. Starting at event zero on each page
    // is deliberate: a fresh browser can rebuild the shared design, while the
    // session de-duplicates ids already present in local history.
    useEffect(() => {
        const incoming = room.events
            .filter((event) => event.type === 'op')
            .map((event) => event.op);
        if (!incoming.length)
            return;
        opLog.observe(incoming);
        for (const op of incoming)
            roomSubmittedOpsRef.current.add(op.id);
        applyLogToStore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.events]);
    // Offline-first queue: unsent local ops stay in the log. Any room refresh
    // retries them; acknowledgements replace optimistic clocks by id.
    useEffect(() => {
        if (!room.client || !room.identity || (room.role !== 'owner' && room.role !== 'editor'))
            return;
        const pending = opLog.all()
            .filter((op) => op.actor === room.identity?.actor && !roomSubmittedOpsRef.current.has(op.id))
            .slice(0, 500);
        if (!pending.length)
            return;
        for (const op of pending)
            roomSubmittedOpsRef.current.add(op.id);
        void room.client.pushOps(pending).then(({ accepted, rejected }) => {
            opLog.observe(accepted);
            const rejectedIds = rejected.map((item) => item.id).filter((id) => Boolean(id));
            opLog.discard(rejectedIds);
            applyLogToStore();
            if (rejected.some((item) => item.reason === 'owner-approval-required'))
                showToast('Sent to the owner for approval');
            else if (rejected.length)
                showToast('A concurrent owner edit was kept');
        }).catch(() => {
            for (const op of pending)
                roomSubmittedOpsRef.current.delete(op.id);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, logVersion, room.room, room.identity?.actor, room.role]);
    /**
     * Notes the client has left on this page.
     *
     * Polled on the same rhythm as everything else in a session — a note arriving
     * within a few seconds is the difference between answering it on the call and
     * finding it afterwards.
     */
    const [notes, setNotes] = useState([]);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [revisions, setRevisions] = useState([]);
    /* Change requests: a contributor's submissions, and the owner's inbox. */
    const [requests, setRequests] = useState([]);
    const [previewingRequestId, setPreviewingRequestId] = useState(null);
    const isContributor = room.role === 'contributor';
    const [sharing, setSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    /** The link to hand over — a commenter one, since that is what a client is. */
    const shareLink = room.owned ? room.inviteLink(room.owned, 'commenter') : null;
    const editorLink = room.owned ? room.inviteLink(room.owned, 'editor') : null;
    const startSharing = useCallback(async (fresh = false) => {
        setSharing(true);
        try {
            // "New link" opens a new room, which is how you cut off an old one:
            // the tokens that were sent stop working because the room they name is
            // no longer the one being shown.
            if (fresh || !room.owned)
                await room.openRoom(persona.name || 'Designer');
            showToast(fresh ? 'New link — the old one no longer works' : 'Review link ready');
        }
        catch {
            showToast('Could not open a room — is the bridge running?');
        }
        finally {
            setSharing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.owned, room.openRoom, persona.name]);
    const copyShareLink = useCallback(async () => {
        if (!shareLink)
            return;
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2_000);
        }
        catch {
            showToast('Copy failed — select the link and copy it');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shareLink]);
    const copyEditorLink = useCallback(async () => {
        if (!editorLink)
            return;
        try {
            await navigator.clipboard.writeText(editorLink);
            showToast('Editor invite copied');
        }
        catch {
            showToast('Copy failed — select the link and copy it');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorLink]);
    const refreshNotes = useCallback(async () => {
        if (!room.client || !room.inRoom)
            return;
        try {
            setNotes(await room.client.comments(routeKey));
            setRevisions(await room.client.revisions(routeKey));
            if (room.role === 'owner' || room.role === 'editor' || room.role === 'contributor')
                setRequests(await room.client.requests());
        }
        catch { /* offline */ }
    }, [room.client, room.inRoom, routeKey, room.role]);
    /**
     * Send what is on screen for a decision.
     *
     * The snapshot is taken now, so "approved" refers to a specific design
     * rather than to whatever the page happens to look like when someone reads
     * the word later.
     */
    const sendForReview = useCallback(async () => {
        if (!room.client)
            return;
        try {
            await room.client.sendRevision({
                routeKey,
                viewport: viewportMode,
                store: stripPersonaDrafts(collectVersionRouteDrafts()),
            });
            await refreshNotes();
            showToast('Sent for review');
        }
        catch {
            showToast('Could not reach the room');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.client, routeKey, viewportMode, refreshNotes]);
    useEffect(() => {
        if (!room.inRoom)
            return;
        void refreshNotes();
        const timer = window.setInterval(() => { if (!document.hidden)
            void refreshNotes(); }, 5_000);
        return () => window.clearInterval(timer);
    }, [room.inRoom, refreshNotes]);
    useEffect(() => {
        if (room.events.some((event) => event.type === 'comment' || event.type === 'revision' || event.type === 'request'))
            void refreshNotes();
    }, [room.events, refreshNotes]);
    /**
     * Which of the contributor's ops are already in a request that's pending or
     * approved. A request sent back or withdrawn frees its ops, so its changes
     * show up again to be revised and resubmitted as one.
     */
    const requestOpsKey = room.roomId ? `froam-room-request-ops:${room.roomId}` : null;
    const readRequestOps = () => {
        if (!requestOpsKey)
            return {};
        try {
            return JSON.parse(window.localStorage.getItem(requestOpsKey) ?? '{}');
        }
        catch {
            return {};
        }
    };
    const excludedRequestOps = useMemo(() => {
        const byRequest = readRequestOps();
        const held = new Set();
        for (const request of requests) {
            if (request.status !== 'pending' && request.status !== 'approved')
                continue;
            for (const id of byRequest[request.id] ?? [])
                held.add(id);
        }
        return held;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requests, requestOpsKey]);
    const contributorRequest = useMemo(() => {
        if (!isContributor)
            return null;
        const mine = room.identity?.actor;
        return buildChangeRequest({
            ops: opLog.all(),
            isMine: (actor) => actor === mine || actor === LOCAL_ACTOR,
            routeKey,
            viewport: viewportMode,
            drafts: stripPersonaDrafts(store[viewportStoreKey] ?? {}),
            root: getRoot(),
            excludedOpIds: excludedRequestOps,
            originalText: (path) => {
                const original = originalsRef.current[viewportStoreKey]?.[path]?.text;
                if (original !== undefined)
                    return original;
                const sample = store[viewportStoreKey]?.[path]?.fingerprint?.text;
                return sample && sample.length < 80 ? sample : undefined;
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isContributor, room.identity?.actor, store, viewportStoreKey, routeKey, viewportMode, excludedRequestOps, logVersion]);
    const submitChangeRequest = useCallback(async (title, note) => {
        if (!room.client || !contributorRequest || !contributorRequest.changes.length)
            return false;
        try {
            const request = await room.client.submitRequest({
                routeKey,
                viewport: viewportMode,
                title: title || `Changes to ${routeKey === '/' ? 'the home page' : routeKey}`,
                note,
                store: contributorRequest.store,
                removed: contributorRequest.removed,
                changes: contributorRequest.changes,
                textEdits: contributorRequest.textEdits,
            });
            if (request && requestOpsKey) {
                try {
                    window.localStorage.setItem(requestOpsKey, JSON.stringify({ ...readRequestOps(), [request.id]: contributorRequest.opIds }));
                }
                catch { /* private mode */ }
            }
            await refreshNotes();
            showToast('Sent for approval — you’ll see the answer here');
            return true;
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not reach the room');
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.client, contributorRequest, routeKey, viewportMode, requestOpsKey, refreshNotes]);
    const withdrawChangeRequest = useCallback(async (request) => {
        if (!room.client)
            return;
        try {
            await room.client.withdrawRequest(request.id);
            await refreshNotes();
            showToast('Withdrawn — your changes are back to edit');
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not reach the room');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.client, refreshNotes]);
    /** The request's changes over the current page, without touching the design. */
    const applyRequestToStore = (base, request) => {
        const key = `${request.routeKey}@@${request.viewport}`;
        const route = { ...(base[key] ?? {}) };
        for (const [path, draft] of Object.entries(request.store))
            route[path] = draft;
        for (const path of request.removed)
            delete route[path];
        return { ...base, [key]: route };
    };
    const previewChangeRequest = useCallback((request) => {
        if (!request) {
            previewConnectedCanvas(null);
            setPreviewingRequestId(null);
            return;
        }
        if (request.routeKey !== routeKey || request.viewport !== viewportMode) {
            showToast(`Open ${request.routeKey} on ${request.viewport} to preview this`);
            return;
        }
        previewConnectedCanvas(applyRequestToStore(storeRef.current, request));
        setPreviewingRequestId(request.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey, viewportMode]);
    const decideChangeRequest = useCallback(async (request, decision, note) => {
        if (!room.client)
            return;
        if (previewingRequestId) {
            previewConnectedCanvas(null);
            setPreviewingRequestId(null);
        }
        try {
            const decided = await room.client.decideRequest(request.id, decision, note || undefined);
            if (decision === 'approved' && decided) {
                // The owner's own editor takes the change too — its next Save to Repo
                // must include it, not overwrite it. Where the bridge published, read
                // back exactly what it wrote (copy placed in source is not a draft).
                let next = applyRequestToStore(storeRef.current, decided);
                try {
                    const loaded = await window.fetch(bridgeUrl('/__froam/repo/load')).then((response) => response.json());
                    const written = loaded?.design?.routes?.[decided.routeKey]?.[decided.viewport];
                    if (written) {
                        const key = `${decided.routeKey}@@${decided.viewport}`;
                        const route = { ...(next[key] ?? {}) };
                        for (const path of [...Object.keys(decided.store), ...decided.removed]) {
                            if (written[path])
                                route[path] = written[path];
                            else
                                delete route[path];
                        }
                        next = { ...next, [key]: route };
                    }
                }
                catch { /* hosted, no bridge: the request's own changes stand */ }
                opPendingLabelRef.current = `Approved: ${decided.title}`;
                storeRef.current = next;
                setStore(next);
                saveStore(next);
                showToast(decided.published?.detail ? `${decided.title} — ${decided.published.detail}` : `${decided.title} approved`);
            }
            else {
                showToast(`Sent back to ${request.createdBy}`);
            }
            await refreshNotes();
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not reach the room');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.client, previewingRequestId, refreshNotes]);
    const inviteLinks = useMemo(() => {
        const owned = room.owned;
        if (!owned)
            return {};
        const link = (role) => (owned.invites[role] ? room.inviteLink(owned, role) : undefined);
        return { editor: link('editor'), contributor: link('contributor'), commenter: link('commenter'), viewer: link('viewer') };
    }, [room.owned, room.inviteLink]);
    const copyInviteLink = useCallback(async (link) => {
        try {
            await navigator.clipboard.writeText(link);
        }
        catch {
            showToast('Copy failed — select the link and copy it');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const resolveNote = useCallback(async (note) => {
        if (!room.client)
            return;
        try {
            await room.client.resolveComment(note.id, !note.resolved);
            await refreshNotes();
            showToast(note.resolved ? 'Reopened' : 'Resolved');
        }
        catch {
            showToast('Could not reach the room');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.client, refreshNotes]);
    /** Jump to what a note is about, using the anchor rather than the raw path. */
    const goToNote = useCallback((note) => {
        setActiveNoteId(note.id);
        const root = getRoot();
        if (!root)
            return;
        const found = resolveAnchor(note.anchor, root);
        if (found.status === 'orphaned') {
            showToast('That element is gone — the note is kept');
            return;
        }
        found.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        selectInsertedElement(found.element);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    /**
     * While someone is watching, push edits to them as they settle.
     *
     * Deliberately later than the 400ms undo batch: that decides what counts as
     * one change, this decides when a change is finished being fiddled with.
     * Publishing mid-drag would show the client the fumbling rather than the
     * result — fig. 0.4 called for edits arriving settled.
     */
    const sessionPublishRef = useRef(0);
    useEffect(() => {
        if (!room.inRoom || roomPresence.length === 0)
            return;
        window.clearTimeout(sessionPublishRef.current);
        sessionPublishRef.current = window.setTimeout(() => { void publishForSession(); }, 1_200);
        return () => window.clearTimeout(sessionPublishRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, room.inRoom, roomPresence.length]);
    const draftCount = useMemo(() => countRenderableDrafts(routeDrafts), [routeDrafts]);
    const hasRouteDrafts = useMemo(() => draftCount > 0, [draftCount]);
    const showPanel = panelOpen || active;
    /* Fonts the drafts reference must actually load, or the preview lies. */
    useEffect(() => {
        ensureFontLinks(collectStoreFontFamilies(routeDrafts));
    }, [routeDrafts]);
    /* The client's own typeface, same rule: preview it exactly as it will ship. */
    useEffect(() => {
        ensureBrandFontStyle(brandFonts);
        saveBrandFonts(brandFonts);
    }, [brandFonts]);
    /* Offer the brand faces in the picker the moment they are added. */
    const fontOptions = useMemo(() => fontOptionsFor(brandFonts), [brandFonts]);
    /*
     * Keep the log level with the store, whoever moved it.
     *
     * The main mutation paths record their own ops with proper labels, and this
     * finds nothing to do after them. What it catches is every *other* way the
     * store changes — the drafts restored at boot, a published design arriving
     * from the bridge, inline text edits, drag-to-move — so the log is a
     * complete account of the design rather than an account of the three places
     * someone remembered to instrument.
     */
    useEffect(() => {
        const session = opLog;
        if (!session)
            return;
        try {
            if (opLoadingDesignRef.current) {
                opLoadingDesignRef.current = false;
                session.seed(store);
                return;
            }
            // Ops recorded at the call site are already in the log by the time React
            // renders. Ops found here are appended *after* it, so the undo button
            // would stay greyed out on exactly the edits this effect exists to catch
            // unless we ask for another render.
            const pending = opPendingLabelRef.current;
            opPendingLabelRef.current = null;
            if (session.reconcile(store, pending ?? 'Edit').length)
                bumpLog();
        }
        catch {
            /* Never let bookkeeping break an edit. */
        }
    }, [store]);
    /*
     * Persist the log so undo survives a reload.
     *
     * Debounced, because a colour drag would otherwise serialise the history on
     * every frame. `saveOpLog` returns what actually fit, and adopting it keeps
     * the in-memory log the same size as the stored one — storage pressure is
     * what bounds the log, rather than an arbitrary entry count.
     */
    useEffect(() => {
        const session = opLog;
        const timer = window.setTimeout(() => {
            try {
                const stored = saveOpLog(session.all(), projectKey);
                if (stored.length !== session.size())
                    session.load(stored);
            }
            catch {
                /* Persistence is a nicety; editing is not. */
            }
        }, 600);
        return () => window.clearTimeout(timer);
    }, [logVersion, store, opLog]);
    /*
     * Dev seam for the op log. While the log shadows the store, this is how the
     * two get compared against real editing — `__froamOpLog.agrees()` is the
     * invariant that has to hold before anything is allowed to depend on it.
     */
    useEffect(() => {
        const debug = {
            session: opLog,
            ops: () => opLog.all(),
            derived: () => opLog.store(),
            live: () => storeRef.current,
            originals: () => originalsRef.current,
            anchors: {
                of: (el) => { const r = getRoot(); return r ? createAnchor(el, r) : null; },
                resolve: (a) => { const r = getRoot(); return r ? resolveAnchor(a, r) : null; },
                selection: () => selectionAnchorRef.current,
            },
            // Field-level, not JSON.stringify: two stores can hold identical design
            // and still serialise differently just from key order.
            diff: () => diffStores(opLog.store(), storeRef.current),
            agrees: () => diffStores(opLog.store(), storeRef.current).length === 0,
        };
        window.__froamOpLog = debug;
        return () => { delete window.__froamOpLog; };
    }, []);
    useEffect(() => {
        if (!pendingDraftPaintResumeRef.current)
            return;
        pendingDraftPaintResumeRef.current = false;
        const frame = window.requestAnimationFrame(() => {
            suspendDraftPaintingRef.current = false;
        });
        return () => window.cancelAnimationFrame(frame);
    }, [routeDrafts]);
    function keepStudioPinned() {
        setPanelOpen(true);
        setActive(true);
        setStudioMinimized(false);
    }
    /* ─── Toast helper ─── */
    const showToast = useCallback((msg) => {
        setToastMsg(msg);
        setToastVisible(true);
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToastVisible(false), 2200);
    }, []);
    function executeLocalFroamCommand(intent) {
        const request = intent.toLocaleLowerCase().trim();
        const wants = (pattern) => pattern.test(request);
        if (wants(/^(?:undo|undo that|go back)$/)) {
            undo();
            return true;
        }
        if (wants(/^(?:redo|redo that)$/)) {
            redo();
            return true;
        }
        if (wants(/\b(save|save draft)\b/) && request.split(/\s+/).length <= 4) {
            saveToRunam();
            return true;
        }
        if (wants(/\b(open|show)\s+(?:the\s+)?layers\b/)) {
            openWorkspaceSection('layers', 'understand');
            return true;
        }
        if (wants(/\b(open|show)\s+(?:the\s+)?(?:pages?|sitemap|routes?|build)\b/)) {
            openWorkspaceSection('plan', 'create');
            return true;
        }
        if (wants(/\b(open|show)\s+(?:the\s+)?(?:library|assets?|components?|patterns?)\b/)) {
            openWorkspaceSection('library', 'create');
            return true;
        }
        if (wants(/\b(open|show)\s+(?:the\s+)?reference\b/)) {
            openWorkspaceSection('reference', 'understand');
            return true;
        }
        if (wants(/\b(?:turn on|enable|use|enter)\s+move(?: mode)?\b|\bmove mode\b/)) {
            setActiveTool('move');
            setMoveMode(true);
            showToast('Move mode on — drag any element freely');
            return true;
        }
        if (wants(/\b(?:select|pointer) tool\b/)) {
            setActiveTool('pointer');
            setMoveMode(false);
            showToast('Select tool active');
            return true;
        }
        if (wants(/\bmake (?:the )?page dark\b|\bdark(?:en)? (?:the )?(?:page|canvas)\b/)) {
            applyCanvasStyles({ background: '#050505', text: '#ffffff' });
            return true;
        }
        if (wants(/\b(add|insert|create|place|draw)\b/)) {
            const blocks = [
                [/\bhero\b/, 'hero'], [/\bheader|navbar|navigation bar\b/, 'header'], [/\bfooter\b/, 'footer'],
                [/\bsection\b/, 'section'], [/\bstats?|metrics?\b/, 'stats'], [/\bgrid\b/, 'grid'],
                [/\bcards?\b/, 'card'], [/\bcontainers?\b/, 'container'], [/\bbuttons?|cta\b/, 'button'],
                [/\bimages?|photos?|pictures?\b/, 'image'], [/\btext|heading|paragraph\b/, 'text'],
                [/\brectangle|square|shape|circle\b/, 'shape'], [/\bdivider|separator\b/, 'divider'],
            ];
            const block = blocks.find(([pattern]) => pattern.test(request))?.[1];
            if (block) {
                addStructureBlock(block);
                return true;
            }
            if (wants(/\bframe|artboard\b/)) {
                insertBlankFrame('end', { preset: 'responsive', width: 1200, height: 720, background: '#ffffff' });
                return true;
            }
        }
        return false;
    }
    async function validateReferenceBuildOnCanvas(plan, signal) {
        const root = getRoot();
        if (!root)
            return validateReferenceBuildCandidate(plan, []);
        const original = { width: root.style.width, maxWidth: root.style.maxWidth, marginInline: root.style.marginInline };
        const observations = [];
        try {
            for (const width of plan.validationWidths) {
                if (signal.aborted)
                    throw new Error('Reference validation cancelled');
                root.style.width = `${width}px`;
                root.style.maxWidth = 'none';
                root.style.marginInline = 'auto';
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                if (signal.aborted)
                    throw new Error('Reference validation cancelled');
                const target = plan.target.kind === 'selected' ? findElementByPath(root, plan.target.path) : root.querySelector(`[data-froam-reference-build="${CSS.escape(plan.id.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 80))}"]`);
                const measuredTarget = target?.querySelector('[data-froam-reference-grid], [data-froam-reference-hero]') ?? target;
                const children = measuredTarget ? Array.from(measuredTarget.children).filter((item) => item instanceof HTMLElement && getComputedStyle(item).display !== 'none') : [];
                const rects = children.map((item) => item.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
                const rows = new Map();
                for (const rect of rects) {
                    const row = [...rows.keys()].find((value) => Math.abs(value - rect.top) < 8) ?? Math.round(rect.top);
                    rows.set(row, (rows.get(row) ?? 0) + 1);
                }
                const first = rects[0];
                const second = rects[1];
                const orientation = first && second ? Math.abs(first.top - second.top) < Math.min(first.height, second.height) * .5 ? 'row' : 'column' : undefined;
                let collisions = 0;
                for (let left = 0; left < rects.length; left += 1)
                    for (let right = left + 1; right < rects.length; right += 1)
                        if (rects[left].left < rects[right].right && rects[left].right > rects[right].left && rects[left].top < rects[right].bottom && rects[left].bottom > rects[right].top)
                            collisions += 1;
                const visibleNodes = target ? [target, ...Array.from(target.querySelectorAll('*'))].filter((item) => { const style = getComputedStyle(item); const rect = item.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0; }) : [];
                const clipped = visibleNodes.filter((item) => { const style = getComputedStyle(item); return ((style.overflowX === 'hidden' || style.overflowX === 'clip') && item.scrollWidth > item.clientWidth + 2) || ((style.overflowY === 'hidden' || style.overflowY === 'clip') && item.scrollHeight > item.clientHeight + 2); }).length;
                const touchTargetFailures = visibleNodes.filter((item) => { const rect = item.getBoundingClientRect(); return ['A', 'BUTTON', 'INPUT'].includes(item.tagName) && (rect.width < 24 || rect.height < 24); }).length;
                const navText = target?.querySelectorAll('nav a, nav button, [role="navigation"] a').length ?? 0;
                observations.push({ width, targetFound: Boolean(target), targetWidthRatio: measuredTarget ? measuredTarget.getBoundingClientRect().width / Math.max(1, width) : undefined, gridColumns: rows.size ? Math.max(...rows.values()) : undefined, orientation, navigationShape: navText <= 1 ? 'compact' : 'expanded', visible: Boolean(target), regionCount: visibleNodes.length, overflowX: measuredTarget ? measuredTarget.scrollWidth > measuredTarget.clientWidth + 2 : false, collisions, clipped, hiddenCritical: target?.querySelectorAll('[data-froam-priority="critical"][hidden]').length ?? 0, touchTargetFailures });
            }
        }
        finally {
            root.style.width = original.width;
            root.style.maxWidth = original.maxWidth;
            root.style.marginInline = original.marginInline;
        }
        return validateReferenceBuildCandidate(plan, observations);
    }
    const froamIntent = useFroamIntent({
        project: projectSession.project,
        setProject: projectSession.setProject,
        actorId: projectActorId,
        routeKey,
        viewport: viewportMode,
        selection: selection ? { nodeId: selection.nodeId, path: selection.path, label: selection.label } : null,
        root: getRoot(),
        selectedElement: currentSelectionRef.current,
        registry: nodeRegistryRef.current,
        onRegistryChange: (registry) => { nodeRegistryRef.current = registry; saveNodeRegistry(registry); },
        onPreviewStore: previewConnectedCanvas,
        onCommitStore: adoptConnectedCandidate,
        onActivityChange: setWorkspaceActivity,
        onToast: showToast,
        onExecuteLocalCommand: executeLocalFroamCommand,
        enableRemoteIntent: false,
        onValidateReference: validateReferenceBuildOnCanvas,
    });
    function openPersonaEditor() {
        keepStudioPinned();
        setPersonaDraft(persona);
        setPersonaEditorOpen(true);
    }
    function closePersonaEditor() {
        setPersonaDraft(persona);
        setPersonaEditorOpen(false);
    }
    function savePersonaProfile() {
        const nextPersona = sanitizeFroamPersona(personaDraft);
        setPersona(nextPersona);
        setPersonaDraft(nextPersona);
        setPersonaEditorOpen(false);
        showToast('Froam profile updated');
    }
    function clearPersonaImage() {
        setPersonaDraft((current) => {
            const nextPersona = sanitizeFroamPersona({ ...current, imageUrl: '' });
            setPersona(nextPersona);
            return nextPersona;
        });
    }
    function handlePersonaImageUpload(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            showToast('Use an image file for the Froam avatar');
            return;
        }
        if (file.size > MAX_PERSONA_IMAGE_BYTES) {
            showToast('Avatar is too large. Keep it under 400 KB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const imageUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!imageUrl)
                return;
            setPersonaDraft((current) => {
                const nextPersona = sanitizeFroamPersona({ ...current, imageUrl });
                setPersona(nextPersona);
                return nextPersona;
            });
        };
        reader.readAsDataURL(file);
    }
    /**
     * Start writing into a page element: remember its original copy, make it
     * editable, put the caret where the person meant, and save the new text
     * when they leave. Every entry point — typing, a second click, double-click,
     * Enter, paste, the Text tool — comes through here, so they all save alike.
     */
    function startWriting(target, caret = 'end') {
        const root = getRoot();
        if (!root || !isInPageScope(target, root) || !isWritableElement(target))
            return false;
        if (target.isContentEditable) {
            placeCaret(target, caret);
            return true;
        }
        const editPath = getElementPath(target, root);
        const originalRoute = originalsRef.current[viewportStoreKeyRef.current] ?? {};
        if (!originalRoute[editPath]) {
            // Remember the copy as it was before anyone typed. Undo can take the
            // draft's text away, but only this can put the page's own words back.
            originalRoute[editPath] = { text: target.innerText };
            originalsRef.current[viewportStoreKeyRef.current] = originalRoute;
        }
        const singleLine = SINGLE_LINE_TAGS.has(target.tagName.toLowerCase());
        target.contentEditable = 'true';
        target.focus({ preventScroll: true });
        placeCaret(target, caret);
        setInlineEditing(true);
        markSelectionSwitch(target, 'Writing');
        const onKeyDown = (event) => {
            if (event.key === 'Enter' && !event.shiftKey && singleLine) {
                event.preventDefault();
                target.blur();
            }
        };
        // Pasted copy arrives as plain text — never someone else's markup.
        const onPaste = (event) => {
            const text = event.clipboardData?.getData('text/plain');
            if (text == null)
                return;
            event.preventDefault();
            document.execCommand('insertText', false, text);
        };
        const finish = () => {
            target.contentEditable = 'false';
            setInlineEditing(false);
            target.removeEventListener('blur', finish);
            target.removeEventListener('keydown', onKeyDown);
            target.removeEventListener('paste', onPaste);
            const liveRoot = getRoot();
            if (!liveRoot || !isInPageScope(target, liveRoot))
                return;
            const path = getElementPath(target, liveRoot);
            const newText = target.innerText;
            opPendingLabelRef.current = 'Rewrote copy';
            setStore((currentStore) => {
                const vsk = viewportStoreKeyRef.current;
                return { ...currentStore, [vsk]: { ...(currentStore[vsk] ?? {}), [path]: { ...(currentStore[vsk]?.[path] ?? {}), text: newText } } };
            });
            setSelection((s) => (s ? { ...s, text: newText } : s));
            persistLiveRouteSnapshot();
        };
        target.addEventListener('blur', finish);
        target.addEventListener('keydown', onKeyDown);
        target.addEventListener('paste', onPaste);
        return true;
    }
    /** Type into the selected copy: at the last click if it was on this element, else at the end. */
    function writeIntoSelection(text) {
        const target = currentSelectionRef.current;
        if (!target)
            return false;
        const point = lastClickPointRef.current;
        const rect = target.getBoundingClientRect();
        const caret = point && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
            ? { x: point.x, y: point.y }
            : 'end';
        if (!startWriting(target, caret))
            return false;
        if (text)
            document.execCommand('insertText', false, text);
        return true;
    }
    function markSelectionSwitch(element, mode = 'Editing') {
        selectionSwitchTargetRef.current?.removeAttribute('data-froam-switching');
        selectionSwitchTargetRef.current = null;
        window.clearTimeout(selectionSwitchTimerRef.current);
        if (!element)
            return;
        selectionSwitchTargetRef.current = element;
        element.setAttribute('data-froam-switching', 'true');
        setSelectionHandoffMode(mode);
        setSelectionHandoffKey(window.performance.now());
        selectionSwitchTimerRef.current = window.setTimeout(() => {
            if (selectionSwitchTargetRef.current === element) {
                element.removeAttribute('data-froam-switching');
                selectionSwitchTargetRef.current = null;
            }
        }, 520);
    }
    /* ─── Section toggle ─── */
    const toggleSection = useCallback((id) => {
        setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);
    /* ─── Device shell: CSS-transform viewport simulation (no DOM tree moves) ─── */
    const prevViewportRef = useDeviceShell({ routeKey, store, viewportMode, zoom, currentSelectionRef, setPanelPosition, setSelection });
    /* ─── Route change reset ─── */
    // Only on an actual navigation. On mount this used to close the editor a
    // frame later — undoing `initialOpen`, and swallowing a Ctrl+. pressed the
    // moment the button appeared.
    const resetForRouteRef = useRef(routeKey);
    useEffect(() => {
        if (resetForRouteRef.current === routeKey)
            return;
        resetForRouteRef.current = routeKey;
        const frame = window.requestAnimationFrame(() => {
            setPanelOpen(false);
            setActive(false);
            setStudioMinimized(false);
            setSelection(null);
            setInlineEditing(false);
            prevViewportRef.current = 'desktop';
            setViewportMode('desktop');
        });
        return () => window.cancelAnimationFrame(frame);
    }, [routeKey]);
    /* ─── Editing attribute ─── */
    useEffect(() => {
        document.documentElement.toggleAttribute('data-chef-editing', showPanel);
        return () => { document.documentElement.removeAttribute('data-chef-editing'); };
    }, [showPanel]);
    // Keep the page's own header out from under Froam's toolbar while editing.
    usePageCanvasOffset(showPanel && !studioMinimized, getRoot);
    /* ─── Move mode cursor ─── */
    /* ─── Tool cursor ─── */
    useEffect(() => {
        if (!showPanel) {
            document.body.style.removeProperty('cursor');
            return;
        }
        if (moveMode || activeTool === 'move') {
            document.body.style.cursor = 'move';
        }
        else if (activeTool === 'hand') {
            document.body.style.cursor = 'grab';
        }
        else if (activeTool === 'text') {
            document.body.style.cursor = 'text';
        }
        else if (activeTool === 'shape' || activeTool === 'frame') {
            document.body.style.cursor = 'crosshair';
        }
        else {
            document.body.style.removeProperty('cursor');
        }
        return () => { document.body.style.removeProperty('cursor'); };
    }, [moveMode, activeTool, showPanel]);
    /* ─── Turn off move mode and reset tool when panel closes ─── */
    useEffect(() => {
        if (!showPanel) {
            setMoveMode(false);
            setActiveTool('pointer');
        }
    }, [showPanel]);
    /* ─── Persist store ─── */
    useEffect(() => { saveStore(store); }, [store]);
    useEffect(() => {
        savePersonaPreference(persona);
    }, [persona]);
    useEffect(() => {
        if (personaEditorOpen)
            return;
        setPersonaDraft(persona);
    }, [persona, personaEditorOpen]);
    useEffect(() => {
        const draftPersona = readFroamPersonaDraft(routeDrafts);
        if (draftPersona && !personasEqual(draftPersona, persona)) {
            setPersona(sanitizeFroamPersona(draftPersona));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeDrafts]);
    useEffect(() => {
        let cancelled = false;
        let settled = false;
        if (loadedPublishedKeysRef.current.has(viewportStoreKey))
            return;
        // Claim the key up front so two mounts can't both fetch...
        loadedPublishedKeysRef.current.add(viewportStoreKey);
        async function loadPublishedDesign() {
            try {
                const params = new URLSearchParams({ routeKey, viewportMode });
                const response = await apiGetFresh(`/api/froam/published?${params.toString()}`);
                const publishedStore = response.design?.store;
                settled = true;
                if (cancelled || !publishedStore || Object.keys(publishedStore).length === 0)
                    return;
                const publishedPersona = readFroamPersonaDraft(publishedStore);
                if (publishedPersona && !personasEqual(publishedPersona, persona)) {
                    setPersona(sanitizeFroamPersona(publishedPersona));
                }
                // Merge rather than refuse. This device having *any* local draft used
                // to block the whole route, which is why a design saved on a laptop
                // never reached a phone that had been opened in the editor once.
                const publishedAt = Date.parse(response.design?.publishedAt ?? response.design?.updatedAt ?? '') || 0;
                const result = opLog.adoptPublished({
                    routeKey,
                    viewport: viewportMode,
                    store: stripPersonaDrafts(publishedStore),
                    publishedAt,
                });
                if (cancelled || !result.adopted)
                    return;
                // The log is now ahead of the store; take its word for the design.
                const next = opLog.store();
                opLoadingDesignRef.current = true;
                storeRef.current = next;
                setStore(next);
                saveStore(next);
                applyStoreToDOM(next);
                bumpLog();
                showToast(result.kept
                    ? `Design updated — ${result.kept} newer local change${result.kept === 1 ? '' : 's'} kept`
                    : 'Design updated from your other device');
            }
            catch {
                // Stay usable offline or while backend is restarting.
                settled = true;
            }
        }
        void loadPublishedDesign();
        return () => {
            cancelled = true;
            // ...but a mount that was torn down before its answer arrived must
            // release the claim, or the next mount skips a fetch that never
            // finished. React's StrictMode double-mount does exactly this, which
            // meant the editor silently never picked up a design published from
            // another device.
            if (!settled)
                loadedPublishedKeysRef.current.delete(viewportStoreKey);
        };
        // Intentionally exclude `store` — including it causes an infinite loop when
        // setStore fires and re-triggers this effect. We gate on the ref instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey, viewportMode, viewportStoreKey]);
    /* ─── Read canvas on route change ─── */
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setCanvas(readCanvasState()));
        return () => window.cancelAnimationFrame(frame);
    }, [routeKey]);
    /* ─── Paint drafts (re-apply on DOM mutations, e.g. React re-renders) ─── */
    useDraftPainter({ hasRouteDrafts, routeDrafts, viewportStoreKey, suspendDraftPaintingRef, applySectionStructure, restoreInjectedBlocks });
    useEffect(() => {
        if (!showPanel || studioMinimized)
            return;
        if (!leftPanelOpen && !rightPanelOpen && !intelligenceOpen && !labsOpen && !connectedCanvasOpen && !workspacePreference.advancedOpen)
            return;
        const root = getRoot();
        if (!root || typeof MutationObserver === 'undefined')
            return;
        const maintenance = createFrameworkIdentityObserver({
            root,
            registry: () => nodeRegistryRef.current,
            onRegistry: (registry) => { nodeRegistryRef.current = registry; saveNodeRegistry(registry); },
            onDiagnostic: (event) => setIdentityDiagnostics((current) => [...current.slice(-199), event]),
        });
        setFrameworkIdentityFinding(maintenance.finding);
        return () => maintenance.disconnect();
    }, [showPanel, studioMinimized, viewportStoreKey, leftPanelOpen, rightPanelOpen, intelligenceOpen, labsOpen, connectedCanvasOpen, workspacePreference.advancedOpen]);
    /* ─── v4: touch affordances while editing on a coarse pointer ─── */
    useEffect(() => {
        if (!showPanel || !isTouchDevice)
            return;
        // touch-action: manipulation + user-select rules live in mobile.css under this attribute
        document.documentElement.setAttribute('data-froam-touch', 'true');
        return () => document.documentElement.removeAttribute('data-froam-touch');
    }, [showPanel, isTouchDevice]);
    // Latest values for event handlers registered once per editing session.
    const selectionRef = useRef(selection);
    selectionRef.current = selection;
    const selectionsRef = useRef(selections);
    selectionsRef.current = selections;
    const panelOpenRef = useRef(panelOpen);
    panelOpenRef.current = panelOpen;
    const activeToolRef = useRef(activeTool);
    activeToolRef.current = activeTool;
    // The selection's handles and floating bar stay on it through scrolls and reflows.
    useSelectionTracking(showPanel, currentSelectionRef, setSelectionRect);
    /* ─── Library patterns dragged onto the page ─── */
    usePatternDrop({
        enabled: showPanel,
        getRoot,
        onDrop: (componentId, target, placement) => insertLibraryComponent(componentId, placement, FROAM_FRAME_PRESETS.responsive, target),
    });
    /* ─── Click / hover handlers ─── */
    useCanvasPointer({
        showPanel, routeKey, viewportStoreKey, inlineEditing, showToast, startWriting, updateSelectionsState,
        activeToolRef, currentHoverRef, currentSelectionRef, lastClickPointRef, panelOpenRef, selectionRef, selectionsRef,
        setActive, setClickPulse, setCommandPaletteOpen, setContextMenuPos, setInlineEditing, setMeasureRect, setPanelOpen,
        setQuickChatOpen, setSelectionCandidates,
    });
    /* ─── Drag-to-move ─── */
    useEffect(() => {
        if (!showPanel || !moveMode)
            return;
        const root = getRoot();
        if (!root)
            return;
        function resolveMovTarget(rawTarget) {
            // Same rules as selection: SVG internals move their whole <svg>.
            let element = rawTarget instanceof Element ? rawTarget : null;
            if (element && isSvgInternal(element))
                element = element.closest('svg');
            while (element && root.contains(element)) {
                if (element.closest('[data-chef-editor-root="true"]'))
                    return null;
                if (isPathElement(element) && !shouldSkipElement(element))
                    return element;
                element = element.parentElement;
            }
            return null;
        }
        function handleMoveDown(e) {
            const target = resolveMovTarget(e.target);
            if (!target)
                return;
            e.preventDefault();
            e.stopPropagation();
            const computed = window.getComputedStyle(target);
            const origTop = readNumber(computed.top, 0);
            const origLeft = readNumber(computed.left, 0);
            if (computed.position === 'static')
                target.style.position = 'relative';
            const path = getElementPath(target, root);
            if (guardRemoteLock(path))
                return;
            moveDragRef.current = { startX: e.clientX, startY: e.clientY, origTop, origLeft, target, path };
            setRoomLockedPath(path);
            target.setPointerCapture(e.pointerId);
            updateSelectionsState([buildSelection(target, path)]);
            target.setAttribute('data-froam-moving', 'true');
            markSelectionSwitch(target, 'Moving');
        }
        function handleMoveMove(e) {
            const drag = moveDragRef.current;
            if (!drag)
                return;
            e.preventDefault();
            drag.target.style.top = `${drag.origTop + e.clientY - drag.startY}px`;
            drag.target.style.left = `${drag.origLeft + e.clientX - drag.startX}px`;
            setSelectionRect(drag.target.getBoundingClientRect());
        }
        function handleMoveUp(e) {
            const drag = moveDragRef.current;
            if (!drag)
                return;
            drag.target.releasePointerCapture(e.pointerId);
            const newTop = drag.origTop + e.clientY - drag.startY;
            const newLeft = drag.origLeft + e.clientX - drag.startX;
            moveDragRef.current = null;
            setRoomLockedPath(null);
            drag.target.removeAttribute('data-froam-moving');
            const computed = window.getComputedStyle(drag.target);
            const pos = computed.position === 'static' ? 'relative' : computed.position;
            // Persist the new position into the draft store via applyStyle
            // We need selection to be set — update it first, then call applyStyle
            setSelection((current) => {
                if (!current || current.path !== drag.path)
                    return current;
                return { ...current, position: pos };
            });
            const nextStore = { ...storeRef.current };
            const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
            const existing = routeStore[drag.path] ?? {};
            routeStore[drag.path] = {
                ...existing,
                styles: { ...(existing.styles ?? {}), position: pos, top: `${Math.round(newTop)}px`, left: `${Math.round(newLeft)}px` },
            };
            nextStore[viewportStoreKey] = routeStore;
            opPendingLabelRef.current = 'Moved element';
            setStore(nextStore);
            saveStore(nextStore);
            setSelectionRect(drag.target.getBoundingClientRect());
        }
        document.addEventListener('pointerdown', handleMoveDown, true);
        document.addEventListener('pointermove', handleMoveMove, true);
        document.addEventListener('pointerup', handleMoveUp, true);
        // v4: while the Move tool is armed, touch drags must move elements — not scroll the page
        const previousBodyTouchAction = document.body.style.touchAction;
        document.body.style.touchAction = 'none';
        return () => {
            moveDragRef.current?.target.removeAttribute('data-froam-moving');
            document.removeEventListener('pointerdown', handleMoveDown, true);
            document.removeEventListener('pointermove', handleMoveMove, true);
            document.removeEventListener('pointerup', handleMoveUp, true);
            document.body.style.touchAction = previousBodyTouchAction;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPanel, moveMode, viewportStoreKey]);
    /* ─── Cleanup refs on unmount ─── */
    useEffect(() => {
        return () => {
            currentSelectionRef.current?.removeAttribute('data-chef-selected');
            currentSelectionRef.current?.removeAttribute('data-froam-moving');
            currentSelectionRef.current?.removeAttribute('data-froam-multi-selected');
            selectionSwitchTargetRef.current?.removeAttribute('data-froam-switching');
            window.clearTimeout(selectionSwitchTimerRef.current);
            currentHoverRef.current?.removeAttribute('data-chef-hovered');
        };
    }, []);
    /* ─── Restore #root on page unload (refresh / tab close) ─── */
    useEffect(() => {
        function restoreOnUnload() {
            try {
                const vsk = viewportStoreKeyRef.current;
                const routeSnapshot = collectVersionRouteDrafts();
                saveStore({ ...storeRef.current, [vsk]: stripPersonaDrafts(routeSnapshot) });
            }
            catch {
                // Best-effort refresh safety
            }
            const shell = document.getElementById(DEVICE_SHELL_ID);
            const appRoot = getRoot();
            if (shell && appRoot && appRoot.parentElement !== document.body) {
                document.body.insertBefore(appRoot, shell);
            }
            shell?.remove();
        }
        window.addEventListener('beforeunload', restoreOnUnload);
        return () => window.removeEventListener('beforeunload', restoreOnUnload);
    }, []);
    useEffect(() => {
        return () => {
            const shell = document.getElementById(DEVICE_SHELL_ID);
            const appRoot = getRoot();
            if (shell && appRoot) {
                // Move #root back to body before removing shell
                if (appRoot.parentElement !== document.body) {
                    document.body.insertBefore(appRoot, shell);
                }
                shell.remove();
            }
            else if (shell) {
                shell.remove();
            }
            // Strip any viewport constraint styles left on #root
            if (appRoot) {
                appRoot.style.removeProperty('max-width');
                appRoot.style.removeProperty('margin-inline');
                appRoot.style.removeProperty('overflow-x');
                appRoot.style.removeProperty('width');
                appRoot.style.removeProperty('min-height');
                appRoot.style.removeProperty('height');
                appRoot.style.removeProperty('overflow-y');
                appRoot.style.removeProperty('position');
                appRoot.style.removeProperty('left');
                appRoot.style.removeProperty('top');
                appRoot.style.removeProperty('z-index');
                appRoot.style.removeProperty('border-radius');
                appRoot.style.removeProperty('box-shadow');
                appRoot.style.removeProperty('background');
                appRoot.style.removeProperty('transform');
                appRoot.style.removeProperty('transform-origin');
                appRoot.style.removeProperty('isolation');
            }
            document.documentElement.removeAttribute('data-chef-editing');
        };
    }, []);
    /* ─── Refresh layers when section opens ─── */
    useEffect(() => {
        if (!openSections.layers || !showPanel)
            return;
        const root = getRoot();
        if (!root)
            return;
        setLayers(collectLayers(root));
    }, [openSections.layers, showPanel, routeKey]);
    /* ─── Op log ─── */
    /**
     * Ops recorded close together under the same label collapse into one undo
     * step — a colour-picker drag is fifty ops and a single Ctrl+Z. The 400 ms
     * window matches the existing undo debounce; a different label opens a new
     * batch immediately, so "colour then padding" stays two steps even when it
     * happens fast.
     */
    function opBatch(label) {
        const open = opBatchRef.current;
        const id = open && open.label === label
            ? open.id
            : `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        opBatchRef.current = { id, label };
        window.clearTimeout(opBatchTimerRef.current);
        opBatchTimerRef.current = window.setTimeout(() => { opBatchRef.current = null; }, 400);
        return id;
    }
    /** Record one element's draft change on the log. Never throws into the editor. */
    function recordOp(path, prev, next, label, batch) {
        try {
            const recorded = opLog.record({
                routeKey,
                viewport: viewportMode,
                path,
                prev,
                next,
                label,
                batch: batch ?? opBatch(label),
            });
            const nodeId = Object.values(nodeRegistryRef.current).find((entry) => (entry.routeKey === routeKey && entry.viewport === viewportMode && entry.path === path))?.nodeId;
            if (nodeId)
                recorded.forEach((op) => { op.nodeId = nodeId; });
        }
        catch {
            /* The log is not load-bearing yet — never let it break an edit. */
        }
    }
    /* Keep the selection's anchor current, so a restructure has something to
       re-find it with. Cheap: one fingerprint per selection change. */
    useEffect(() => {
        const root = getRoot();
        if (!selection || !root) {
            selectionAnchorRef.current = null;
            return;
        }
        const element = currentSelectionRef.current ?? findElementByPath(root, selection.path);
        selectionAnchorRef.current = element ? createAnchor(element, root) : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selection?.path]);
    function refreshSelectedElementFromDOM() {
        window.requestAnimationFrame(() => {
            if (!selection)
                return;
            const root = getRoot();
            if (!root)
                return;
            // Re-find by anchor rather than path. Wrapping a section in a container
            // shifts every path beneath it, and the old lookup either lost the
            // selection or — worse — silently handed back whatever now sits in that
            // slot. The fingerprint follows the element instead of the slot.
            const anchor = selectionAnchorRef.current;
            const stableRef = selection.nodeId ? nodeRegistryRef.current[selection.nodeId] : undefined;
            const stableResolved = stableRef ? resolveNodeRef(stableRef, root, nodeRegistryRef.current, {
                onDiagnostic: (event) => setIdentityDiagnostics((current) => [...current.slice(-99), event]),
            }) : null;
            if (stableResolved) {
                nodeRegistryRef.current = stableResolved.registry;
                saveNodeRegistry(stableResolved.registry);
            }
            const resolved = stableResolved && stableResolved.status !== 'orphaned'
                ? { status: stableResolved.status, element: stableResolved.element, path: stableResolved.ref.path ?? getElementPath(stableResolved.element, root) }
                : anchor
                    ? resolveAnchor(anchor, root)
                    : (() => {
                        const el = findElementByPath(root, selection.path);
                        return el ? { status: 'exact', element: el, path: selection.path } : { status: 'orphaned' };
                    })();
            if (resolved.status === 'orphaned')
                return;
            const target = resolved.element;
            const path = resolved.path;
            if (resolved.status === 'recovered') {
                selectionAnchorRef.current = createAnchor(target, root);
            }
            const refreshed = { ...buildSelection(target, path), nodeId: selection.nodeId };
            currentSelectionRef.current = target;
            target.setAttribute('data-chef-selected', 'true');
            syncStructureBoundaryLabel(target);
            setSelection(refreshed);
            setSelections((current) => current.map((item) => item.path === selection.path ? refreshed : item));
            setSelectionRect(target.getBoundingClientRect());
        });
    }
    function restoreConnectedCanvasPreview() {
        const root = getRoot();
        const originals = connectedPreviewOriginalStylesRef.current;
        if (!root || !originals)
            return;
        originals.forEach((original, path) => {
            const element = findElementByPath(root, path);
            if (!element)
                return;
            if (original.style === null)
                element.removeAttribute('style');
            else
                element.setAttribute('style', original.style);
            if (original.text !== undefined)
                element.innerText = original.text;
            if (original.imageUrl !== undefined && element instanceof HTMLImageElement)
                element.src = original.imageUrl;
        });
        connectedPreviewOriginalStylesRef.current = null;
    }
    function previewConnectedCanvas(next, protectRollback = true) {
        const target = next ?? storeRef.current;
        restoreConnectedCanvasPreview();
        if (protectRollback) {
            const root = getRoot();
            const originals = new Map();
            Object.keys(target[viewportStoreKey] ?? {}).forEach((path) => {
                if (!root || path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                    return;
                const element = findElementByPath(root, path);
                const draft = target[viewportStoreKey]?.[path];
                if (element)
                    originals.set(path, {
                        style: element.getAttribute('style'),
                        text: draft?.text !== undefined ? element.innerText : undefined,
                        imageUrl: draft?.imageUrl !== undefined && element instanceof HTMLImageElement ? element.currentSrc || element.src : undefined,
                    });
            });
            connectedPreviewOriginalStylesRef.current = originals;
        }
        applyStoreToDOM(target, { clearCurrent: true, previousStore: connectedPreviewStoreRef.current ?? storeRef.current });
        connectedPreviewStoreRef.current = target;
    }
    function materializeConnectedBranch(next) {
        restoreConnectedCanvasPreview();
        opLoadingDesignRef.current = true;
        opLog.load([]);
        opLog.seed(next);
        storeRef.current = next;
        setStore(next);
        saveStore(next);
        applyStoreToDOM(next, { clearCurrent: true, previousStore: connectedPreviewStoreRef.current ?? storeRef.current });
        connectedPreviewStoreRef.current = null;
        bumpLog();
        updateSelectionsState([]);
    }
    function adoptConnectedCandidate(next) {
        restoreConnectedCanvasPreview();
        const previous = connectedPreviewStoreRef.current ?? storeRef.current;
        opPendingLabelRef.current = 'Froam experiment';
        storeRef.current = next;
        setStore(next);
        saveStore(next);
        applyStoreToDOM(next, { clearCurrent: true, previousStore: previous });
        connectedPreviewStoreRef.current = null;
    }
    function selectConnectedNode(nodeId, fallbackPath) {
        const root = getRoot();
        if (!root)
            return;
        const entry = nodeRegistryRef.current[nodeId];
        if (entry) {
            const resolved = resolveNodeRef(entry, root, nodeRegistryRef.current, {
                onDiagnostic: (event) => setIdentityDiagnostics((current) => [...current.slice(-99), event]),
            });
            nodeRegistryRef.current = resolved.registry;
            saveNodeRegistry(resolved.registry);
            if (resolved.status !== 'orphaned') {
                updateSelectionsState([{ ...buildSelection(resolved.element, resolved.ref.path ?? fallbackPath ?? ''), nodeId }]);
                return;
            }
        }
        if (fallbackPath) {
            const element = findElementByPath(root, fallbackPath);
            if (element)
                updateSelectionsState([{ ...buildSelection(element, fallbackPath), nodeId }]);
        }
    }
    function insertArchivedHtml(html, placement = 'end') {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        const node = template.content.firstElementChild;
        if (!node)
            return showToast('Archive item has no reusable structure');
        node.querySelectorAll('script,iframe,object,embed').forEach((element) => element.remove());
        [node, ...Array.from(node.querySelectorAll('*'))].forEach((element) => {
            for (const attribute of Array.from(element.attributes))
                if (attribute.name.toLowerCase().startsWith('on'))
                    element.removeAttribute(attribute.name);
        });
        node.setAttribute('data-froam-injected', 'true');
        node.setAttribute('data-froam-block', 'true');
        assignFreshFroamNodeIds(node);
        placeInsertedNode(node, placement);
        selectInsertedElement(node);
        persistLiveRouteSnapshot();
        showToast('Inserted from Component Archive');
    }
    function archiveCurrentSelection(kind) {
        if (!selection?.nodeId || !currentSelectionRef.current)
            return showToast('Select an element before adding it to Archive');
        const nodeId = selection.nodeId;
        const element = currentSelectionRef.current;
        const computed = window.getComputedStyle(element);
        const visualKeys = ['color', 'backgroundColor', 'borderColor', 'borderRadius', 'boxShadow', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'padding', 'margin', 'gap', 'display', 'alignItems', 'justifyContent'];
        const styles = Object.fromEntries(visualKeys.map((key) => [key, computed[key]]).filter(([, value]) => Boolean(value)));
        const interaction = Object.values(activeProjectState.interactions).filter((item) => item.sourceId === nodeId || item.targetIds.includes(nodeId)).at(-1);
        if (kind === 'motion' && !interaction)
            return showToast('This element has no saved motion yet. Apply it in Animator or Laboratory first.');
        const dna = activeProjectState.dna[nodeId] ?? minimalArchiveDna(nodeId, { role: element.getAttribute('role') ?? element.tagName.toLowerCase(), tagName: element.tagName.toLowerCase(), styles, motion: interaction });
        const suffix = kind === 'component' ? 'Component' : kind === 'style' ? 'Style' : kind === 'motion' ? 'Motion' : 'Pattern';
        const item = createArchiveItem({
            id: `archive:${kind}:${Date.now().toString(36)}`, nodeId, name: `${selection.label} ${suffix}`,
            actorId: projectActorId, projectId: projectSession.project.id, branchId: projectSession.project.activeBranchId, dna, kind,
            html: kind === 'component' || kind === 'interface-pattern' ? element.outerHTML : undefined,
            legacyPath: selection.path, styles: kind === 'style' || kind === 'interface-pattern' ? styles : undefined,
            interaction: kind === 'motion' || kind === 'interface-pattern' ? interaction : undefined,
            interactionIds: interaction ? [interaction.id] : [],
            includes: kind === 'interface-pattern' ? ['structure', 'styles', ...(interaction ? ['motion', 'behavior'] : [])] : kind === 'component' ? ['structure'] : kind === 'style' ? ['styles'] : ['motion', 'behavior'],
            description: kind === 'interface-pattern' ? 'Structure, visual styling, and available behavior captured as one reusable pattern.' : undefined,
        });
        projectSession.setProject((current) => appendProjectEvents(current, [createProjectEvent({ projectId: current.id, branchId: current.activeBranchId, actorId: projectActorId, clock: Math.max(0, ...current.events.map((event) => event.clock)) + 1, type: 'archive.upserted', payload: { archiveItem: item }, targetIds: [item.nodeId], label: `Archived ${archiveItemKind(item)}: ${item.name}` })]));
        showToast(`${item.name} added to Archive`);
    }
    function previewIntelligenceWidth(width) {
        const root = getRoot();
        if (!root)
            return;
        if (width === null) {
            const saved = intelligencePreviewStyleRef.current;
            if (saved?.element === root) {
                root.style.width = saved.width;
                root.style.maxWidth = saved.maxWidth;
                root.style.marginInline = saved.marginInline;
            }
            intelligencePreviewStyleRef.current = null;
            return;
        }
        if (!intelligencePreviewStyleRef.current)
            intelligencePreviewStyleRef.current = { element: root, width: root.style.width, maxWidth: root.style.maxWidth, marginInline: root.style.marginInline };
        root.style.width = `${width}px`;
        root.style.maxWidth = '100%';
        root.style.marginInline = 'auto';
    }
    /**
     * Apply whatever the op log now says the design is.
     *
     * Undo and redo don't compute a new store — they append inverse ops and then
     * take the log's word for it. The reconcile effect sees the store already
     * matches the log and stays quiet.
     */
    function applyLogToStore(toast) {
        const next = opLog.store();
        storeRef.current = next;
        setStore(next);
        saveStore(next);
        applyStoreToDOM(next, { clearCurrent: true });
        refreshSelectedElementFromDOM();
        bumpLog();
        if (toast)
            showToast(toast);
    }
    function undo() {
        const session = opLog;
        if (!session.canUndo())
            return;
        const label = session.undoLabel();
        session.undo();
        applyLogToStore(label ? `Undone — ${label}` : 'Undone');
    }
    function redo() {
        const session = opLog;
        if (!session.canRedo())
            return;
        session.redo();
        applyLogToStore('Redone');
    }
    /**
     * Undo one specific change from the list, wherever it sits in the history.
     *
     * Not the same as Ctrl+Z, which walks your own most-recent-first. This is
     * "take back that one", and it is how undoing someone else's work will work
     * once a room has two people in it.
     */
    function revertChange(change) {
        const ops = opLog.revert(change.id);
        if (!ops.length) {
            showToast('Already undone');
            return;
        }
        applyLogToStore(`Undid ${describeChange(change)}`);
    }
    function structureBaselineKey(sourcePath) {
        return `${viewportStoreKeyRef.current}\u0000${sourcePath}`;
    }
    function rememberSectionBaseline(element, sourcePath) {
        const key = structureBaselineKey(sourcePath);
        const existing = sectionBaselineRef.current.get(key);
        if (existing)
            return existing;
        const parent = element.parentElement;
        if (!parent)
            return null;
        const baseline = {
            element,
            parent,
            order: Array.from(parent.children).indexOf(element),
            hidden: element.hidden,
            editorHidden: element.getAttribute('data-froam-editor-hidden'),
            exportHidden: element.getAttribute('data-froam-export-hidden'),
        };
        sectionBaselineRef.current.set(key, baseline);
        element.dataset.froamStructureSource = sourcePath;
        return baseline;
    }
    function restoreSectionStructure() {
        const prefix = `${viewportStoreKeyRef.current}\u0000`;
        const entries = Array.from(sectionBaselineRef.current.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([, value]) => value)
            .sort((left, right) => left.order - right.order);
        entries.forEach((baseline) => {
            const { element, parent, order } = baseline;
            const currentOrder = element.parentElement === parent ? Array.from(parent.children).indexOf(element) : -1;
            if (currentOrder !== order) {
                element.remove();
                parent.insertBefore(element, parent.children.item(order));
            }
            element.hidden = baseline.hidden;
            if (baseline.editorHidden === null)
                element.removeAttribute('data-froam-editor-hidden');
            else
                element.setAttribute('data-froam-editor-hidden', baseline.editorHidden);
            if (baseline.exportHidden === null)
                element.removeAttribute('data-froam-export-hidden');
            else
                element.setAttribute('data-froam-export-hidden', baseline.exportHidden);
            element.removeAttribute('data-froam-structure-deleted');
        });
    }
    function findSectionStructureSource(root, entry) {
        const remembered = sectionBaselineRef.current.get(structureBaselineKey(entry.sourcePath));
        if (remembered)
            return remembered.element;
        const byIdentity = root.querySelector(`[data-froam-id="${CSS.escape(entry.nodeId)}"]`);
        if (byIdentity && byIdentity.dataset.froamInjected !== 'true')
            return byIdentity;
        const byPath = findElementByPath(root, entry.sourcePath);
        return byPath && byPath.dataset.froamInjected !== 'true' ? byPath : null;
    }
    function applySectionStructure(routeDraftsToApply) {
        const root = getRoot();
        if (!root)
            return;
        const manifest = readSectionStructureDraft(routeDraftsToApply[SECTION_STRUCTURE_KEY]);
        if (!manifest.sections.length)
            return;
        const resolved = manifest.sections.map((entry) => {
            const element = findSectionStructureSource(root, entry);
            if (!element)
                return null;
            rememberSectionBaseline(element, entry.sourcePath);
            element.dataset.froamId = entry.nodeId;
            element.dataset.froamStructureSource = entry.sourcePath;
            return { entry, element };
        }).filter((item) => item !== null);
        resolved.filter(({ entry }) => !entry.deleted).sort((left, right) => left.entry.order - right.entry.order).forEach(({ entry, element }) => {
            const parent = entry.parentPath === ROOT_PARENT_KEY ? root : findElementByPath(root, entry.parentPath);
            if (parent) {
                const currentOrder = element.parentElement === parent ? Array.from(parent.children).indexOf(element) : -1;
                if (currentOrder !== entry.order) {
                    element.remove();
                    parent.insertBefore(element, parent.children.item(entry.order));
                }
            }
            if (entry.editorHidden)
                element.dataset.froamEditorHidden = 'true';
            else
                element.removeAttribute('data-froam-editor-hidden');
            if (entry.exportHidden)
                element.dataset.froamExportHidden = 'true';
            else
                element.removeAttribute('data-froam-export-hidden');
            element.hidden = false;
            element.removeAttribute('data-froam-structure-deleted');
        });
        resolved.filter(({ entry }) => entry.deleted).forEach(({ element }) => {
            element.dataset.froamStructureDeleted = 'true';
            element.remove();
        });
    }
    function remapLiveDraftPaths(routeDraftsToRemap, root) {
        const collect = (drafts) => {
            const tracked = [];
            const next = {};
            Object.entries(drafts).forEach(([path, draft]) => {
                if (path === CANVAS_KEY || isInjectionPath(path) || isSectionStructurePath(path) || isFroamPersonaPath(path)) {
                    next[path] = draft;
                    return;
                }
                const element = findElementByPath(root, path);
                if (element)
                    tracked.push({ element, draft, path });
                else
                    next[path] = draft;
            });
            return { next, tracked };
        };
        const live = collect(routeDraftsToRemap);
        const originals = collect(originalsRef.current[viewportStoreKeyRef.current] ?? {});
        return { ...live, originalNext: originals.next, originalTracked: originals.tracked };
    }
    function finishSectionMutation(label, remapped, selectedElement) {
        const root = getRoot();
        if (!root)
            return;
        remapped.tracked.forEach(({ element, draft }) => {
            if (!root.contains(element) || element.closest(INJECTED_BLOCK_SELECTOR))
                return;
            const path = getElementPath(element, root);
            if (path)
                remapped.next[path] = draft;
        });
        remapped.originalTracked.forEach(({ element, draft, path: priorPath }) => {
            if (!root.contains(element)) {
                remapped.originalNext[priorPath] = draft;
                return;
            }
            if (element.closest(INJECTED_BLOCK_SELECTOR))
                return;
            const path = getElementPath(element, root);
            if (path)
                remapped.originalNext[path] = draft;
        });
        originalsRef.current[viewportStoreKeyRef.current] = remapped.originalNext;
        storeRef.current = {
            ...storeRef.current,
            [viewportStoreKeyRef.current]: remapped.next,
        };
        const routeSnapshot = collectVersionRouteDrafts();
        const candidate = {
            ...storeRef.current,
            [viewportStoreKeyRef.current]: stripPersonaDrafts(routeSnapshot),
        };
        opLog.reconcile(candidate, label);
        const next = opLog.store();
        storeRef.current = next;
        setStore(next);
        saveStore(next);
        bumpLog();
        if (selectedElement && root.contains(selectedElement))
            selectInsertedElement(selectedElement);
        else
            updateSelectionsState([]);
        setLayers(collectLayers(root));
    }
    function serializableElementHtml(element) {
        const clone = element.cloneNode(true);
        clone.querySelectorAll('[data-chef-editor-root="true"]').forEach((node) => node.remove());
        [clone, ...Array.from(clone.querySelectorAll('*'))].forEach((node) => {
            node.removeAttribute('data-chef-selected');
            node.removeAttribute('data-chef-hovered');
            node.removeAttribute('data-froam-multi-selected');
            node.removeAttribute('data-froam-boundary-label');
            node.removeAttribute('data-froam-static-boundary');
            node.removeAttribute('data-froam-runtime-injected');
            node.removeAttribute('data-froam-switching');
            node.removeAttribute('data-froam-pin');
            node.removeAttribute('data-froam-pe');
            node.removeAttribute(PSEUDO_HOST_ATTR);
            // Writing mode's temporary contenteditable must never reach a live page.
            node.removeAttribute('contenteditable');
            node.removeAttribute('data-froam-writable');
            node.removeAttribute('data-froam-moving');
        });
        return clone.outerHTML;
    }
    function collectVersionRouteDrafts() {
        const root = getRoot();
        const latestRouteDrafts = storeRef.current[viewportStoreKeyRef.current] ?? {};
        const nextRouteDrafts = stripPersonaDrafts(latestRouteDrafts);
        if (!root)
            return withPersonaDraft(nextRouteDrafts, persona);
        // Every outbound path — Save to Repo, publish, the session beat, the local
        // snapshot — is built from this one walk, so fingerprinting here is what
        // makes an edit findable again after someone restructures the page. Doing
        // it at the call sites would be four chances to forget.
        const originalRouteDrafts = originalsRef.current[viewportStoreKeyRef.current] ?? {};
        Object.entries(nextRouteDrafts).forEach(([path, draft]) => {
            if (isInjectionPath(path)) {
                delete nextRouteDrafts[path];
                return;
            }
            if (path === CANVAS_KEY || isSectionStructurePath(path) || isFroamPersonaPath(path))
                return;
            const element = findElementByPath(root, path);
            if (element?.closest(INJECTED_BLOCK_SELECTOR)) {
                delete nextRouteDrafts[path];
                return;
            }
            if (element) {
                nextRouteDrafts[path] = {
                    ...readLiveElementDraft(element, draft),
                    fingerprint: fingerprintForDraft(element, root, originalRouteDrafts[path]?.text),
                };
            }
        });
        const activeElement = currentSelectionRef.current;
        if (activeElement
            && !shouldSkipElement(activeElement)
            && !activeElement.closest(INJECTED_BLOCK_SELECTOR)) {
            const activePath = getElementPath(activeElement, root);
            if (activePath && !isInjectionPath(activePath)) {
                nextRouteDrafts[activePath] = readLiveElementDraft(activeElement, nextRouteDrafts[activePath] ?? {});
            }
        }
        const injectedBlocks = Array.from(root.querySelectorAll(INJECTED_BLOCK_SELECTOR))
            .filter((element) => !element.parentElement?.closest(INJECTED_BLOCK_SELECTOR));
        injectedBlocks.forEach((element) => {
            const parent = element.parentElement;
            if (!parent)
                return;
            const parentPath = parent === root ? ROOT_PARENT_KEY : getElementPath(parent, root);
            if (parentPath !== ROOT_PARENT_KEY && !parentPath)
                return;
            const id = ensureFroamNodeId(element);
            const order = Array.from(parent.children).indexOf(element);
            nextRouteDrafts[`${INJECTION_KEY}:${id}`] = {
                text: JSON.stringify({
                    parentPath,
                    parentId: parent === root ? undefined : parent.dataset.froamId,
                    order,
                    html: serializableElementHtml(element),
                }),
            };
        });
        return withPersonaDraft(nextRouteDrafts, persona);
    }
    function persistLiveRouteSnapshot() {
        const routeSnapshot = collectVersionRouteDrafts();
        const next = { ...storeRef.current, [viewportStoreKey]: stripPersonaDrafts(routeSnapshot) };
        storeRef.current = next;
        setStore(next);
        saveStore(next);
        return routeSnapshot;
    }
    function clearDraftsFromDOM(drafts) {
        const root = getRoot();
        if (!root)
            return;
        const injectedBlocks = Array.from(root.querySelectorAll(INJECTED_BLOCK_SELECTOR))
            .filter((element) => !element.parentElement?.closest(INJECTED_BLOCK_SELECTOR));
        injectedBlocks.forEach((element) => element.remove());
        restoreSectionStructure();
        Object.entries(drafts).forEach(([path]) => {
            if (path === CANVAS_KEY || isInjectionPath(path) || isSectionStructurePath(path) || isFroamPersonaPath(path))
                return;
            const target = findElementByPath(root, path);
            if (!target)
                return;
            const original = originalsRef.current[viewportStoreKey]?.[path];
            if (original)
                applyDraft(target, original);
            else
                target.removeAttribute('style');
        });
        if (drafts[CANVAS_KEY])
            clearCanvasDraftStyles();
    }
    function restoreInjectedBlocks(routeDraftsToApply) {
        const root = getRoot();
        if (!root)
            return;
        Object.entries(routeDraftsToApply)
            .filter(([path]) => isInjectionPath(path))
            .map(([, draft]) => readInjectionDraft(draft))
            .filter((draft) => draft !== null)
            .sort((a, b) => a.order - b.order)
            .forEach((injection) => {
            const parent = injection.parentId
                ? root.querySelector(`[data-froam-id="${CSS.escape(injection.parentId)}"]`)
                : injection.parentPath === ROOT_PARENT_KEY
                    ? root
                    : findElementByPath(root, injection.parentPath);
            if (!parent)
                return;
            const template = document.createElement('template');
            template.innerHTML = injection.html.trim();
            const node = template.content.firstElementChild;
            if (!(node instanceof HTMLElement))
                return;
            const nodeId = node.dataset.froamId;
            if (nodeId && Array.from(root.querySelectorAll('[data-froam-id]')).some((element) => element.dataset.froamId === nodeId)) {
                return;
            }
            node.removeAttribute('data-chef-selected');
            node.removeAttribute('data-chef-hovered');
            parent.insertBefore(node, parent.children.item(injection.order));
        });
    }
    function applyStoreToDOM(targetStore, options = {}) {
        const root = getRoot();
        if (!root)
            return;
        const routeDraftsToApply = targetStore[viewportStoreKey] ?? {};
        if (options.clearCurrent) {
            const previous = (options.previousStore ?? store)[viewportStoreKey] ?? {};
            clearDraftsFromDOM(previous);
            // Styles live in the element's style attribute and are cleared above.
            // Text and image swaps were written into the DOM itself, so a draft
            // simply disappearing leaves the edited copy on screen — undo has to
            // put the element's captured original back explicitly.
            const originals = originalsRef.current[viewportStoreKey] ?? {};
            Object.keys(previous).forEach((path) => {
                if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                    return;
                const original = originals[path];
                if (!original)
                    return;
                const wanted = routeDraftsToApply[path];
                const restore = {};
                if (previous[path]?.text !== undefined && wanted?.text === undefined && original.text !== undefined) {
                    restore.text = original.text;
                }
                if (previous[path]?.imageUrl !== undefined && wanted?.imageUrl === undefined && original.imageUrl) {
                    restore.imageUrl = original.imageUrl;
                }
                if (restore.text === undefined && restore.imageUrl === undefined)
                    return;
                const el = findElementByPath(root, path);
                if (el)
                    applyDraft(el, restore);
            });
        }
        applySectionStructure(routeDraftsToApply);
        restoreInjectedBlocks(routeDraftsToApply);
        Object.entries(routeDraftsToApply).forEach(([path, draft]) => {
            if (path === CANVAS_KEY || isInjectionPath(path) || isSectionStructurePath(path) || isFroamPersonaPath(path))
                return;
            const el = findElementByPath(root, path);
            if (el?.closest(INJECTED_BLOCK_SELECTOR))
                return;
            if (el)
                applyDraft(el, draft);
        });
        const canvasDraft = routeDraftsToApply[CANVAS_KEY];
        const backgroundColor = canvasDraft?.styles?.backgroundColor;
        const color = canvasDraft?.styles?.color;
        applyCanvasDraftStyles(backgroundColor, color, canvasDraft?.styles);
    }
    /* ─── Draft update ─── */
    function updateDraft(updater, nextSelection, historyLabel) {
        if (!selection)
            return;
        if ((selections.length ? selections : [selection]).some((item) => guardRemoteLock(item.path)))
            return;
        const root = getRoot();
        if (!root)
            return;
        // No snapshot to debounce any more — coalescing is the op batch below,
        // which costs a string comparison instead of a deep copy of the design.
        const nextStore = { ...storeRef.current };
        const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
        const targetsToUpdate = selections.length > 0 ? selections : [selection];
        // One batch for the whole multi-selection: restyling six elements at once
        // is one undo step, not six.
        const batch = opBatch(historyLabel ?? 'Edit');
        targetsToUpdate.forEach((sel) => {
            const target = findElementByPath(root, sel.path);
            if (!target)
                return;
            const originalRoute = originalsRef.current[viewportStoreKey] ?? {};
            if (!originalRoute[sel.path]) {
                const s = target.style;
                originalRoute[sel.path] = {
                    text: target.innerText,
                    imageUrl: target instanceof HTMLImageElement ? target.currentSrc || target.src || '' : undefined,
                    styles: {
                        backgroundColor: s.backgroundColor || '',
                        color: s.color || '',
                        borderColor: s.borderColor || '',
                        borderRadius: s.borderRadius || '',
                        borderTopLeftRadius: s.borderTopLeftRadius || '',
                        borderTopRightRadius: s.borderTopRightRadius || '',
                        borderBottomRightRadius: s.borderBottomRightRadius || '',
                        borderBottomLeftRadius: s.borderBottomLeftRadius || '',
                        borderWidth: s.borderWidth || '',
                        borderStyle: s.borderStyle || '',
                        opacity: s.opacity || '',
                        margin: s.margin || '',
                        marginTop: s.marginTop || '',
                        marginRight: s.marginRight || '',
                        marginBottom: s.marginBottom || '',
                        marginLeft: s.marginLeft || '',
                        padding: s.padding || '',
                        paddingTop: s.paddingTop || '',
                        paddingRight: s.paddingRight || '',
                        paddingBottom: s.paddingBottom || '',
                        paddingLeft: s.paddingLeft || '',
                        fontSize: s.fontSize || '',
                        fontFamily: s.fontFamily || '',
                        fontWeight: s.fontWeight || '',
                        fontStyle: s.fontStyle || '',
                        textAlign: s.textAlign || '',
                        lineHeight: s.lineHeight || '',
                        letterSpacing: s.letterSpacing || '',
                        wordSpacing: s.wordSpacing || '',
                        textTransform: s.textTransform || '',
                        textDecorationLine: s.textDecorationLine || '',
                        display: s.display || '',
                        flexDirection: s.flexDirection || '',
                        justifyContent: s.justifyContent || '',
                        alignItems: s.alignItems || '',
                        flexWrap: s.flexWrap || '',
                        gap: s.gap || '',
                        gridTemplateColumns: s.gridTemplateColumns || '',
                        gridTemplateRows: s.gridTemplateRows || '',
                        position: s.position || '',
                        zIndex: s.zIndex || '',
                        overflow: s.overflow || '',
                        cursor: s.cursor || '',
                        width: s.width || '',
                        height: s.height || '',
                        minWidth: s.minWidth || '',
                        maxWidth: s.maxWidth || '',
                        minHeight: s.minHeight || '',
                        maxHeight: s.maxHeight || '',
                        aspectRatio: s.aspectRatio || '',
                        transform: s.transform || '',
                        boxShadow: s.boxShadow || '',
                        textShadow: s.textShadow || '',
                        filter: s.filter || '',
                        backdropFilter: s.backdropFilter || '',
                        mixBlendMode: s.mixBlendMode || '',
                        backgroundImage: s.backgroundImage || '',
                        backgroundSize: s.backgroundSize || '',
                        backgroundPosition: s.backgroundPosition || '',
                        backgroundRepeat: s.backgroundRepeat || '',
                    },
                };
                originalsRef.current[viewportStoreKey] = originalRoute;
            }
            const currentDraft = routeStore[sel.path] ?? {};
            const nextDraft = sanitizeDraftForElement(target, updater(currentDraft, target));
            applyDraft(target, nextDraft);
            syncFroamArtboardMetadata(target);
            routeStore[sel.path] = nextDraft;
            recordOp(sel.path, currentDraft, nextDraft, historyLabel ?? 'Edit', batch);
        });
        nextStore[viewportStoreKey] = routeStore;
        storeRef.current = nextStore;
        setStore(nextStore);
        if (nextSelection) {
            setSelection((current) => (current ? { ...current, ...nextSelection } : current));
            setSelections((current) => current.map((s) => ({ ...s, ...nextSelection })));
        }
    }
    function applyStyle(styles, nextSel, label) {
        const root = getRoot();
        const selectedElements = root ? (selections.length ? selections : selection ? [selection] : []).map((item) => findElementByPath(root, item.path)).filter((item) => item !== null) : [];
        const textOnlySelection = selectedElements.length > 0 && selectedElements.every(isTextVisualLayer);
        const projectedStyles = textOnlySelection ? projectTextLayerStyles(styles) : styles;
        const projectedSelection = textOnlySelection ? { ...(nextSel ?? {}) } : nextSel;
        if (textOnlySelection && projectedSelection) {
            delete projectedSelection.background;
            delete projectedSelection.borderColor;
            delete projectedSelection.borderWidth;
            delete projectedSelection.borderStyle;
            delete projectedSelection.borderRadiusTL;
            delete projectedSelection.borderRadiusTR;
            delete projectedSelection.borderRadiusBR;
            delete projectedSelection.borderRadiusBL;
            delete projectedSelection.boxShadow;
            if (/^#[\da-f]{3,8}$/i.test(projectedStyles.color ?? ''))
                projectedSelection.color = projectedStyles.color;
            if (projectedStyles.textShadow !== undefined)
                projectedSelection.textShadow = projectedStyles.textShadow === 'none' ? '' : projectedStyles.textShadow;
        }
        updateDraft((draft, target) => ({ ...draft, styles: { ...(draft.styles ?? {}), ...(isTextVisualLayer(target) ? projectTextLayerStyles(styles) : styles) } }), projectedSelection, label ?? `Style: ${Object.keys(styles).join(', ')}`);
    }
    /**
     * ::before / ::after of the selection. No text-layer projection: a badge's
     * background is a background, not a glyph fill.
     */
    function applyPseudoStyle(pseudo, styles, label) {
        const encoded = Object.fromEntries(Object.entries(styles).map(([property, value]) => [pseudoKey(pseudo, property), value]));
        updateDraft((draft) => ({ ...draft, styles: { ...(draft.styles ?? {}), ...encoded } }), undefined, label);
    }
    function previewEncodedStateStyles(styles) {
        const target = currentSelectionRef.current;
        if (!target)
            return;
        const previewStyles = isTextVisualLayer(target) ? projectTextLayerStyles(styles) : styles;
        const encoded = Object.entries(previewStyles).filter(([key]) => key.startsWith('__froamState:'));
        if (!encoded.length)
            return;
        const state = encoded[0][0].split(':')[1];
        const id = target.dataset.froamStateTarget || ensureFroamNodeId(target);
        target.dataset.froamStateTarget = id;
        target.dataset.froamPreviewState = state;
        let style = document.querySelector('style[data-froam-state-preview="true"]');
        if (!style) {
            style = document.createElement('style');
            style.dataset.froamStatePreview = 'true';
            document.head.appendChild(style);
        }
        const declarations = encoded.map(([key, value]) => {
            const property = key.split(':').slice(2).join(':');
            if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(property) || /[{}]/.test(value))
                return '';
            return `${camelToKebab(property)}:${value}!important`;
        }).filter(Boolean).join(';');
        const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        style.textContent = `[data-froam-state-target="${escaped}"]:${state},[data-froam-state-target="${escaped}"][data-froam-preview-state="${state}"]{${declarations}}`;
    }
    /* ─── Design Intelligence bridges ─── */
    // Select an arbitrary element (used by the Health scanner to jump to an issue).
    function selectElementFromIntel(el) {
        const root = getRoot();
        if (!root || !isInPageScope(el, root))
            return;
        const path = getElementPath(el, root);
        if (!path)
            return;
        updateSelectionsState([buildSelection(el, path)]);
        setRightPanelOpen(true);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    // Apply styles to a specific element by path, independent of the async selection state.
    function fixElementFromIntel(el, styles, label) {
        const root = getRoot();
        if (!root || !isInPageScope(el, root))
            return;
        const path = getElementPath(el, root);
        if (!path)
            return;
        const target = findElementByPath(root, path);
        if (!target)
            return;
        const nextStore = { ...storeRef.current };
        const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
        const currentDraft = routeStore[path] ?? {};
        const nextDraft = sanitizeDraftForElement(target, {
            ...currentDraft,
            styles: { ...(currentDraft.styles ?? {}), ...styles },
        });
        applyDraft(target, nextDraft);
        syncFroamArtboardMetadata(target);
        recordOp(path, currentDraft, nextDraft, label);
        routeStore[path] = nextDraft;
        nextStore[viewportStoreKey] = routeStore;
        storeRef.current = nextStore;
        setStore(nextStore);
        selectElementFromIntel(el);
    }
    function applySizePreset(preset) {
        if (!selection)
            return;
        if (preset === 'auto') {
            applyStyle({ width: '', height: '', minWidth: '', maxWidth: '', minHeight: '', maxHeight: '', aspectRatio: '' }, { width: 'auto', height: 'auto', minWidth: '', maxWidth: '', minHeight: '', maxHeight: '', aspectRatio: '' }, 'Size: auto');
            return;
        }
        if (preset === 'hug') {
            applyStyle({ width: 'max-content', height: 'auto', maxWidth: '100%' }, { width: 'max-content', height: 'auto', maxWidth: '100%' }, 'Size: hug content');
            return;
        }
        if (preset === 'fill') {
            applyStyle({ width: '100%', maxWidth: '100%', height: 'auto' }, { width: '100%', maxWidth: '100%', height: 'auto' }, 'Size: fill parent');
            return;
        }
        if (preset === 'fullBleed') {
            applyStyle({ width: '100vw', maxWidth: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }, { width: '100vw', maxWidth: '100vw', marginLeft: 0, marginRight: 0 }, 'Size: full bleed');
            return;
        }
        if (preset === 'square') {
            const side = selectionRect ? `${Math.round(Math.max(selectionRect.width, selectionRect.height))}px` : selection.width;
            applyStyle({ width: side, height: side, aspectRatio: '1 / 1' }, { width: side, height: side, aspectRatio: '1 / 1' }, 'Size: square');
            return;
        }
        applyStyle({ minHeight: '100vh' }, { minHeight: '100vh' }, 'Size: viewport height');
    }
    /* ─── Clear / reset ─── */
    function updateTargetDraft(target, updater, nextSelection, historyLabel) {
        const root = getRoot();
        if (!root)
            return;
        const path = getElementPath(target, root);
        if (!isSafeDraftPath(path))
            return;
        if (guardRemoteLock(path))
            return;
        const originalRoute = originalsRef.current[viewportStoreKey] ?? {};
        if (!originalRoute[path]) {
            const s = target.style;
            originalRoute[path] = {
                text: target.innerText,
                imageUrl: target instanceof HTMLImageElement ? target.currentSrc || target.src || '' : undefined,
                styles: {
                    backgroundColor: s.backgroundColor || '',
                    color: s.color || '',
                    borderColor: s.borderColor || '',
                    borderRadius: s.borderRadius || '',
                    borderWidth: s.borderWidth || '',
                    borderStyle: s.borderStyle || '',
                    opacity: s.opacity || '',
                    padding: s.padding || '',
                    margin: s.margin || '',
                    display: s.display || '',
                    gap: s.gap || '',
                    width: s.width || '',
                    height: s.height || '',
                    minWidth: s.minWidth || '',
                    maxWidth: s.maxWidth || '',
                    minHeight: s.minHeight || '',
                    maxHeight: s.maxHeight || '',
                    aspectRatio: s.aspectRatio || '',
                    backgroundImage: s.backgroundImage || '',
                    backgroundSize: s.backgroundSize || '',
                    backgroundPosition: s.backgroundPosition || '',
                    backgroundRepeat: s.backgroundRepeat || '',
                },
            };
            originalsRef.current[viewportStoreKey] = originalRoute;
        }
        const currentDraft = routeDrafts[path] ?? {};
        const nextDraft = sanitizeDraftForElement(target, updater(currentDraft));
        applyDraft(target, nextDraft);
        recordOp(path, currentDraft, nextDraft, historyLabel ?? 'Edit');
        const nextStore = {
            ...store,
            [viewportStoreKey]: {
                ...(store[viewportStoreKey] ?? {}),
                [path]: nextDraft,
            },
        };
        setStore(nextStore);
        currentSelectionRef.current?.removeAttribute('data-chef-selected');
        currentSelectionRef.current?.removeAttribute('data-froam-boundary-label');
        currentSelectionRef.current = target;
        target.setAttribute('data-chef-selected', 'true');
        syncStructureBoundaryLabel(target);
        setSelection({ ...buildSelection(target, path), ...nextSelection });
    }
    function clearSelectionDraft() {
        opPendingLabelRef.current = 'Cleared styles';
        if (!selection)
            return;
        const root = getRoot();
        const target = root ? findElementByPath(root, selection.path) : null;
        const original = originalsRef.current[viewportStoreKey]?.[selection.path];
        if (target && original)
            applyDraft(target, original);
        else if (target)
            target.removeAttribute('style');
        setStore((current) => {
            const routeEntries = { ...(current[viewportStoreKey] ?? {}) };
            delete routeEntries[selection.path];
            return { ...current, [viewportStoreKey]: routeEntries };
        });
        updateSelectionsState([]);
        showToast('Selection cleared');
    }
    function clearRouteDrafts() {
        opPendingLabelRef.current = `Reset ${viewportMode}`;
        const root = getRoot();
        if (root) {
            Object.entries(routeDrafts).forEach(([path]) => {
                if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                    return;
                const target = findElementByPath(root, path);
                if (target) {
                    const original = originalsRef.current[viewportStoreKey]?.[path];
                    if (original)
                        applyDraft(target, original);
                    else
                        target.removeAttribute('style');
                }
            });
        }
        setStore((current) => {
            const next = { ...current };
            delete next[viewportStoreKey];
            return next;
        });
        clearCanvasDraftStyles();
        root?.querySelectorAll(INJECTED_BLOCK_SELECTOR).forEach((element) => {
            if (!element.parentElement?.closest(INJECTED_BLOCK_SELECTOR)) {
                element.remove();
            }
        });
        setCanvas(readCanvasState());
        showToast(`${viewportMode} reset`);
    }
    /* ─── Canvas styles ─── */
    function applyCanvasStyles(patch) {
        opPendingLabelRef.current = 'Page background';
        if (!getCanvasHost()) {
            showToast('Canvas edits need a page canvas host');
            return;
        }
        const next = { ...canvas, ...patch };
        const currentCanvasDraft = store[viewportStoreKey]?.[CANVAS_KEY]?.styles ?? {};
        const nextStyles = {
            ...currentCanvasDraft,
            backgroundColor: next.background,
            color: next.text,
        };
        applyCanvasDraftStyles(next.background, next.text, nextStyles);
        setCanvas(next);
        setStore((current) => ({
            ...current,
            [viewportStoreKey]: {
                ...(current[viewportStoreKey] ?? {}),
                [CANVAS_KEY]: {
                    styles: nextStyles,
                },
            },
        }));
    }
    /* ─── Save / export ─── */
    function applyCanvasImage(imageData) {
        opPendingLabelRef.current = 'Page background image';
        keepStudioPinned();
        if (!getCanvasHost()) {
            showToast('Canvas edits need a page canvas host');
            return;
        }
        const next = { ...canvas, imageUrl: imageData };
        const currentCanvasDraft = store[viewportStoreKey]?.[CANVAS_KEY]?.styles ?? {};
        const nextStyles = {
            ...currentCanvasDraft,
            backgroundColor: next.background,
            color: next.text,
            backgroundImage: `url("${imageData}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'scroll',
        };
        applyCanvasDraftStyles(next.background, next.text, nextStyles);
        setCanvas(next);
        setStore((current) => ({
            ...current,
            [viewportStoreKey]: {
                ...(current[viewportStoreKey] ?? {}),
                [CANVAS_KEY]: { styles: nextStyles },
            },
        }));
        showToast('Page background image applied');
    }
    function clearCanvasImage() {
        opPendingLabelRef.current = 'Removed background image';
        keepStudioPinned();
        if (!getCanvasHost()) {
            showToast('Canvas edits need a page canvas host');
            return;
        }
        const next = { ...canvas, imageUrl: '' };
        const currentCanvasDraft = store[viewportStoreKey]?.[CANVAS_KEY]?.styles ?? {};
        const nextStyles = {
            ...currentCanvasDraft,
            backgroundColor: next.background,
            color: next.text,
            backgroundImage: '',
            backgroundSize: '',
            backgroundPosition: '',
            backgroundRepeat: '',
            backgroundAttachment: '',
        };
        applyCanvasDraftStyles(next.background, next.text, nextStyles);
        setCanvas(next);
        setStore((current) => ({
            ...current,
            [viewportStoreKey]: {
                ...(current[viewportStoreKey] ?? {}),
                [CANVAS_KEY]: { styles: nextStyles },
            },
        }));
        showToast('Page background image cleared');
    }
    async function copyRouteDrafts() {
        const payload = JSON.stringify(collectVersionRouteDrafts(), null, 2);
        await navigator.clipboard.writeText(payload);
        showToast('Copied to clipboard');
    }
    async function copyDesignReport() {
        const routeSnapshot = collectVersionRouteDrafts();
        const report = buildFroamChangeReport({
            routeKey,
            viewportMode,
            viewportStoreKey,
            drafts: routeSnapshot,
            persona,
        });
        await navigator.clipboard.writeText(report);
        showToast('Design report copied for Codex');
    }
    /**
     * Publish quietly while presenting.
     *
     * In a session the client should see a change land while you are still
     * talking about it, not when you remember to press save. Same endpoint as
     * Ctrl+S — no second sync path — but silent: a toast every few seconds
     * would be its own kind of noise, and a failed beat here is not worth
     * interrupting anyone for.
     */
    async function publishForSession() {
        // A contributor's edits are private until the owner approves them.
        if (room.role === 'contributor')
            return;
        try {
            const routeSnapshot = collectVersionRouteDrafts();
            await apiPost('/api/froam/published', {
                routeKey,
                viewportMode,
                store: stripPersonaDrafts(routeSnapshot),
            });
            await room.client?.signalDesign(routeKey, viewportMode);
        }
        catch {
            /* The next settle publishes the same design. */
        }
    }
    async function saveToRunam() {
        keepStudioPinned();
        const routeSnapshot = collectVersionRouteDrafts();
        const nextStore = { ...store, [viewportStoreKey]: stripPersonaDrafts(routeSnapshot) };
        const payload = {
            savedAt: new Date().toISOString(),
            route: viewportStoreKey,
            routeKey,
            viewportMode,
            draftCount: countRenderableDrafts(routeSnapshot),
        };
        setStore(nextStore);
        saveStore(nextStore);
        window.localStorage.setItem(froamStorageKey(SAVE_META_KEY, projectKey), JSON.stringify(payload));
        if (room.role === 'contributor') {
            showToast('Saved in this browser — Submit when you’re ready for approval');
            return;
        }
        try {
            await apiPost('/api/froam/published', {
                routeKey,
                viewportMode,
                store: routeSnapshot,
            });
            showToast('Published');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '';
            showToast(message.includes('restricted') || message.includes('token') ? 'Saved locally. Admin sign-in needed to publish.' : 'Saved locally. Publish server unavailable.');
        }
    }
    /**
     * Copy edits into the project's own source, wherever the bridge finds the
     * original words exactly once (lib/source-writeback.mjs). Written edits
     * leave the design — the source says it now, and a stale override would
     * later overrule the developer's own change to that string.
     */
    async function writeCopyToSource(drafts) {
        const originals = originalsRef.current[viewportStoreKeyRef.current] ?? {};
        const edits = [];
        for (const [path, draft] of Object.entries(drafts)) {
            if (typeof draft.text !== 'string' || !isSafeDraftPath(path))
                continue;
            // The fingerprint keeps the first 80 characters: complete for shorter copy.
            const sample = draft.fingerprint?.text;
            const from = originals[path]?.text ?? (sample && sample.length < 80 ? sample : undefined);
            if (!from || from.trim() === draft.text.trim())
                continue;
            edits.push({ path, from, to: draft.text });
        }
        if (!edits.length)
            return { drafts, note: '' };
        try {
            const response = await window.fetch(bridgeUrl('/__froam/source/text'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ edits: edits.map(({ from, to }) => ({ from, to })) }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.success || !Array.isArray(data.results))
                return { drafts, note: '' };
            const next = { ...drafts };
            const files = new Set();
            data.results.forEach((result, index) => {
                const edit = edits[index];
                if (!edit || result.status !== 'written')
                    return;
                const { text: _written, ...rest } = next[edit.path] ?? {};
                if (rest.styles || rest.imageUrl !== undefined)
                    next[edit.path] = rest;
                else
                    delete next[edit.path];
                originals[edit.path] = { text: edit.to };
                if (result.file)
                    files.add(result.file);
            });
            originalsRef.current[viewportStoreKeyRef.current] = originals;
            const written = data.results.filter((result) => result.status === 'written').length;
            const kept = edits.length - written;
            const note = written
                ? ` · ${written} copy edit${written === 1 ? '' : 's'} written into ${[...files].join(', ')}${kept ? ` · ${kept} kept as Froam edit${kept === 1 ? '' : 's'}` : ''}`
                : '';
            return { drafts: next, note };
        }
        catch {
            return { drafts, note: '' };
        }
    }
    async function saveToRepo() {
        if (room.role === 'contributor') {
            showToast('Your changes go live when the owner approves them — use Submit');
            return;
        }
        keepStudioPinned();
        const routeSnapshot = collectVersionRouteDrafts();
        const { drafts: cleanDrafts, note: sourceNote } = await writeCopyToSource(stripPersonaDrafts(routeSnapshot));
        const nextStore = { ...store, [viewportStoreKey]: cleanDrafts };
        setStore(nextStore);
        saveStore(nextStore);
        try {
            const response = await window.fetch(bridgeUrl('/__froam/repo/save'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routeKey, viewportMode, store: cleanDrafts, brandFonts, rootScope: getFroamStudioConfig().rootScope }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.success)
                throw new Error(data?.error || 'Repo bridge unavailable');
            showToast(`Saved to repo${sourceNote} — commit & push to ship it`);
        }
        catch {
            showToast('Repo bridge offline — run `froam dev` or add froamStudio() to vite.config');
        }
    }
    function downloadRunamDrafts() {
        const routeSnapshot = collectVersionRouteDrafts();
        const nextStore = { ...storeRef.current, [viewportStoreKeyRef.current]: stripPersonaDrafts(routeSnapshot) };
        storeRef.current = nextStore;
        setStore(nextStore);
        saveStore(nextStore);
        const payload = JSON.stringify({ savedAt: new Date().toISOString(), route: viewportStoreKeyRef.current, store: nextStore }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `froam-studio-${routeKey.replace(/[^a-z0-9]+/gi, '-') || 'home'}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        showToast('Exported JSON');
    }
    /* ─── Container injection ─── */
    function updateSelectionsState(nextSelections) {
        try {
            const root = getRoot();
            const previousElement = currentSelectionRef.current;
            const previousPath = root && previousElement && isInPageScope(previousElement, root)
                ? getElementPath(previousElement, root)
                : '';
            if (root) {
                // Selection can be beside the root too (a portal), so clear marks page-wide.
                document.querySelectorAll('[data-chef-selected="true"], [data-froam-writable]').forEach((el) => {
                    if (!isInPageScope(el, root))
                        return;
                    el.removeAttribute('data-chef-selected');
                    el.removeAttribute('data-froam-writable');
                    el.removeAttribute('data-froam-multi-selected');
                    el.removeAttribute('data-froam-boundary-label');
                    el.removeAttribute('data-froam-static-boundary');
                });
            }
            let registry = nodeRegistryRef.current;
            const identifiedSelections = nextSelections.map((sel) => {
                const el = root ? findElementByPath(root, sel.path) : null;
                if (el) {
                    const captured = captureNodeRef(el, root, registry, { routeKey, viewport: viewportMode });
                    registry = captured.registry;
                    el.setAttribute('data-chef-selected', 'true');
                    syncStructureBoundaryLabel(el);
                    if (nextSelections.length > 1)
                        el.setAttribute('data-froam-multi-selected', 'true');
                    return { ...sel, nodeId: captured.ref.nodeId };
                }
                return sel;
            });
            if (registry !== nodeRegistryRef.current) {
                nodeRegistryRef.current = registry;
                saveNodeRegistry(registry);
            }
            setSelections(identifiedSelections);
            const primary = identifiedSelections[identifiedSelections.length - 1] ?? null;
            setSelection(primary);
            const nextElement = primary && root ? findElementByPath(root, primary.path) : null;
            currentSelectionRef.current = nextElement;
            setSelectionRect(nextElement ? nextElement.getBoundingClientRect() : null);
            if (!nextElement) {
                markSelectionSwitch(null);
            }
            else if (primary.path !== previousPath) {
                markSelectionSwitch(nextElement, moveMode ? 'Moving' : isWritableElement(nextElement) ? 'Type to edit' : 'Editing');
            }
            if (nextElement && identifiedSelections.length === 1 && isWritableElement(nextElement)) {
                nextElement.setAttribute('data-froam-writable', 'true');
            }
            if (root) {
                try {
                    setLayers(collectLayers(root));
                }
                catch { /* DOM may be mid-render */ }
            }
        }
        catch {
            // Safe fallback if DOM nodes disappear mid-update
        }
    }
    function selectInsertedElement(element) {
        const root = getRoot();
        if (!root)
            return;
        const path = getElementPath(element, root);
        const sel = buildSelection(element, path);
        updateSelectionsState([sel]);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    /* v4: selection walker — precise selection without precise fingers */
    function walkSelection(direction) {
        const root = getRoot();
        if (!root || !selection)
            return;
        const current = findElementByPath(root, selection.path);
        if (!current)
            return;
        const step = (from) => {
            switch (direction) {
                case 'parent': return from.parentElement;
                case 'prev': return from.previousElementSibling;
                case 'next': return from.nextElementSibling;
                case 'child': return from.firstElementChild;
            }
        };
        let next = step(current);
        while (next && next !== root && isInPageScope(next, root) && (shouldSkipElement(next) || next.closest('[data-chef-editor-root="true"]'))) {
            next = step(next);
        }
        if (!next || next === root || !isInPageScope(next, root)) {
            showToast(direction === 'parent' ? 'Top of the page' : direction === 'child' ? 'No children' : 'No sibling there');
            return;
        }
        selectInsertedElement(next);
        if ('vibrate' in navigator)
            navigator.vibrate?.(4);
    }
    function getStructureTarget() {
        const root = getRoot();
        if (!root)
            return null;
        const canvas = root.querySelector('[data-froam-canvas], .kitchen-canvas');
        if (!selection)
            return canvas ?? root;
        return findElementByPath(root, selection.path) ?? canvas ?? root;
    }
    function applyInjectedBase(element) {
        element.setAttribute('data-froam-injected', 'true');
        element.setAttribute('data-froam-block', 'true');
        ensureFroamNodeId(element);
        element.style.boxSizing = 'border-box';
        element.style.width = '100%';
    }
    function syncImageFrameState(frame, imageUrl) {
        const hasImage = Boolean(imageUrl);
        const chrome = frame.querySelector('[data-froam-image-ui="true"]');
        if (chrome) {
            chrome.style.opacity = hasImage ? '0' : '1';
            chrome.style.pointerEvents = hasImage ? 'none' : 'auto';
        }
        frame.style.borderStyle = hasImage ? 'solid' : 'dashed';
        frame.style.borderColor = hasImage ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.24)';
    }
    function applyImageToTarget(target, imageData) {
        if (target instanceof HTMLImageElement) {
            updateTargetDraft(target, (draft) => ({ ...draft, imageUrl: imageData }), { imageUrl: imageData }, 'Uploaded image');
            return;
        }
        updateTargetDraft(target, (draft) => ({
            ...draft,
            imageUrl: imageData,
            styles: {
                ...(draft.styles ?? {}),
                backgroundImage: `url("${imageData}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            },
        }), { imageUrl: imageData }, 'Uploaded image');
        if (target.dataset.froamImageFrame === 'true') {
            syncImageFrameState(target, imageData);
        }
    }
    function addImageBlockFromSource(imageData, label = 'Image added') {
        const frame = createInjectedBlock('image');
        if (!placeInsertedNode(frame, 'inside'))
            return;
        selectInsertedElement(frame);
        applyImageToTarget(frame, imageData);
        syncImageFrameState(frame, imageData);
        persistLiveRouteSnapshot();
        showToast(label);
    }
    function insertShapeLayer(svgString, width, height) {
        const shape = createInjectedBlock('shape');
        shape.innerHTML = svgString;
        Object.assign(shape.style, {
            width: `${Math.max(20, Math.round(width))}px`,
            height: `${Math.max(20, Math.round(height))}px`,
            minWidth: '20px',
            minHeight: '20px',
            maxWidth: 'none',
            display: 'inline-grid',
            placeItems: 'stretch',
            padding: '0',
            lineHeight: '0',
            flex: '0 0 auto',
            resize: 'both',
            overflow: 'visible',
        });
        const svg = shape.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.display = 'block';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
        }
        if (!placeInsertedNode(shape, 'inside'))
            return;
        selectInsertedElement(shape);
        persistLiveRouteSnapshot();
    }
    function readImageFile(file, target) {
        const reader = new FileReader();
        reader.onload = () => {
            const imageData = typeof reader.result === 'string' ? reader.result : undefined;
            if (!imageData)
                return;
            applyImageToTarget(target, imageData);
            showToast('Image applied');
        };
        reader.readAsDataURL(file);
    }
    function createInjectedBlock(kind) {
        if (kind === 'header') {
            const header = document.createElement('header');
            applyInjectedBase(header);
            Object.assign(header.style, {
                minHeight: '86px',
                padding: '22px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                borderRadius: '28px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: 'rgba(255, 255, 255, 0.94)',
                color: '#111827',
            });
            header.innerHTML = '<strong contenteditable="true">New header</strong><nav contenteditable="true">Home  Work  Contact</nav>';
            return header;
        }
        if (kind === 'footer') {
            const footer = document.createElement('footer');
            applyInjectedBase(footer);
            Object.assign(footer.style, {
                minHeight: '110px',
                padding: '28px',
                display: 'grid',
                gap: '10px',
                borderRadius: '28px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: '#0b0f14',
                color: '#f8fafc',
            });
            footer.innerHTML = '<strong contenteditable="true">Footer</strong><p contenteditable="true">Add links, copyright text, contact details, or final calls to action here.</p>';
            return footer;
        }
        if (kind === 'hero') {
            const section = document.createElement('section');
            applyInjectedBase(section);
            Object.assign(section.style, {
                minHeight: '360px',
                padding: '48px',
                display: 'grid',
                alignContent: 'center',
                gap: '18px',
                borderRadius: '36px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e8f8f1 54%, #fff1ed 100%)',
                color: '#0f172a',
            });
            section.innerHTML = '<p contenteditable="true" style="margin:0;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ef4444;">Hero</p><h1 contenteditable="true" style="margin:0;font-size:clamp(2.6rem,6vw,5rem);line-height:.94;">Cook your next layout.</h1><p contenteditable="true" style="max-width:620px;margin:0;color:#475569;font-size:1.05rem;line-height:1.7;">Drop images, tune colors, resize containers, and shape the page from Froam.</p><button type="button" contenteditable="true" style="width:max-content;border:0;border-radius:999px;padding:14px 20px;background:#111827;color:#fff;font-weight:800;">Edit this button</button>';
            return section;
        }
        if (kind === 'section') {
            const section = document.createElement('section');
            applyInjectedBase(section);
            Object.assign(section.style, {
                minHeight: '260px',
                padding: '32px',
                display: 'grid',
                gap: '18px',
                borderRadius: '32px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: '#ffffff',
                color: '#111827',
            });
            section.innerHTML = '<p contenteditable="true" style="margin:0;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#16a34a;">Section</p><h2 contenteditable="true" style="margin:0;font-size:2.3rem;line-height:1;">New section</h2><p contenteditable="true" style="margin:0;color:#64748b;line-height:1.7;">Write what this section needs to say.</p>';
            return section;
        }
        if (kind === 'grid') {
            const grid = document.createElement('div');
            applyInjectedBase(grid);
            Object.assign(grid.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                padding: '18px',
                borderRadius: '28px',
                border: '1px dashed rgba(22, 163, 74, 0.35)',
                background: 'rgba(248, 250, 252, 0.86)',
            });
            grid.innerHTML = Array.from({ length: 3 }, (_, index) => `<article data-froam-injected="true" style="min-height:140px;border-radius:22px;border:1px solid rgba(15,23,42,.1);padding:18px;background:#fff;color:#111827;"><strong contenteditable="true">Grid card ${index + 1}</strong><p contenteditable="true" style="color:#64748b;line-height:1.6;">Add content here.</p></article>`).join('');
            return grid;
        }
        if (kind === 'stats') {
            const stats = document.createElement('div');
            applyInjectedBase(stats);
            Object.assign(stats.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '14px',
            });
            stats.innerHTML = ['24', '98%', '4.9'].map((value) => `<article data-froam-injected="true" style="padding:20px;border-radius:24px;border:1px solid rgba(15,23,42,.1);background:#fff;color:#111827;"><strong contenteditable="true" style="font-size:2rem;">${value}</strong><p contenteditable="true" style="margin:.35rem 0 0;color:#64748b;">Metric label</p></article>`).join('');
            return stats;
        }
        if (kind === 'card' || kind === 'container') {
            const card = document.createElement('article');
            applyInjectedBase(card);
            Object.assign(card.style, {
                minHeight: kind === 'container' ? '180px' : '150px',
                padding: kind === 'container' ? '28px' : '22px',
                display: 'grid',
                gap: '12px',
                borderRadius: kind === 'container' ? '30px' : '24px',
                border: kind === 'container' ? '1px dashed rgba(22, 163, 74, 0.38)' : '1px solid rgba(15, 23, 42, 0.12)',
                background: '#ffffff',
                color: '#111827',
            });
            card.innerHTML = `<strong contenteditable="true">${kind === 'container' ? 'New container' : 'New card'}</strong><p contenteditable="true" style="margin:0;color:#64748b;line-height:1.65;">Add text, images, buttons, or nested blocks here.</p>`;
            return card;
        }
        if (kind === 'text') {
            const text = document.createElement('div');
            applyInjectedBase(text);
            Object.assign(text.style, {
                padding: '16px 0',
                color: '#111827',
            });
            text.innerHTML = '<h2 contenteditable="true" style="margin:0 0 10px;font-size:2rem;line-height:1.05;">Editable heading</h2><p contenteditable="true" style="margin:0;color:#64748b;line-height:1.75;">Write your copy here and style it with Froam.</p>';
            return text;
        }
        if (kind === 'image') {
            const frame = document.createElement('div');
            applyInjectedBase(frame);
            frame.dataset.froamImageFrame = 'true';
            Object.assign(frame.style, {
                minHeight: '220px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '28px',
                border: '1px dashed rgba(15, 23, 42, 0.24)',
                background: 'linear-gradient(135deg, rgba(248,250,252,.96), rgba(226,232,240,.82))',
                color: '#64748b',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
            });
            const frameUi = document.createElement('div');
            frameUi.setAttribute('data-froam-image-ui', 'true');
            frameUi.setAttribute('data-chef-editor-root', 'true');
            Object.assign(frameUi.style, {
                display: 'grid',
                gap: '12px',
                justifyItems: 'center',
                padding: '20px',
                textAlign: 'center',
            });
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.textContent = 'Drop or add image';
            Object.assign(pill.style, {
                minHeight: '42px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid rgba(15, 23, 42, 0.14)',
                background: 'rgba(255, 255, 255, 0.88)',
                color: '#0f172a',
                fontWeight: '700',
                cursor: 'pointer',
            });
            pill.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                pendingImageTargetRef.current = frame;
                selectInsertedElement(frame);
                fileInputRef.current?.click();
            });
            const label = document.createElement('span');
            label.textContent = 'Drop or add image';
            Object.assign(label.style, {
                fontWeight: '800',
                fontSize: '1rem',
            });
            const note = document.createElement('span');
            note.textContent = 'Use Froam upload, click the button, or drag a file straight into the frame.';
            Object.assign(note.style, {
                maxWidth: '260px',
                color: '#64748b',
                lineHeight: '1.55',
                fontSize: '0.92rem',
            });
            frameUi.append(pill, label, note);
            frame.appendChild(frameUi);
            frame.addEventListener('dragover', (event) => {
                event.preventDefault();
                frame.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                frame.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
            });
            frame.addEventListener('dragleave', () => {
                syncImageFrameState(frame, readImageUrl(frame.style.backgroundImage));
                frame.style.backgroundColor = '';
            });
            frame.addEventListener('drop', (event) => {
                event.preventDefault();
                const file = event.dataTransfer?.files?.[0];
                frame.style.backgroundColor = '';
                if (!file)
                    return;
                pendingImageTargetRef.current = frame;
                selectInsertedElement(frame);
                readImageFile(file, frame);
            });
            syncImageFrameState(frame);
            return frame;
        }
        if (kind === 'button') {
            const button = document.createElement('button');
            applyInjectedBase(button);
            button.type = 'button';
            button.setAttribute('contenteditable', 'true');
            Object.assign(button.style, {
                width: 'max-content',
                minHeight: '48px',
                padding: '0 20px',
                border: '0',
                borderRadius: '999px',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: '800',
                cursor: 'pointer',
            });
            button.textContent = 'New button';
            return button;
        }
        if (kind === 'shape') {
            const shape = document.createElement('div');
            applyInjectedBase(shape);
            shape.dataset.froamShape = 'true';
            Object.assign(shape.style, {
                width: '200px',
                height: '140px',
                minWidth: '20px',
                minHeight: '20px',
                display: 'inline-grid',
                placeItems: 'center',
                padding: '12px',
                borderRadius: '0',
                background: 'transparent',
                color: '#0f172a',
                border: '2px solid #0f172a',
                fontFamily: 'Satoshi, system-ui, sans-serif',
                fontSize: '18px',
                fontWeight: '700',
                textAlign: 'center',
                flex: '0 0 auto',
                resize: 'both',
                overflow: 'visible',
            });
            return shape;
        }
        const divider = document.createElement('hr');
        applyInjectedBase(divider);
        Object.assign(divider.style, {
            height: '1px',
            minHeight: '1px',
            border: '0',
            margin: '20px 0',
            background: 'rgba(15, 23, 42, 0.16)',
        });
        return divider;
    }
    function addStructureBlock(kind, mode = 'inside') {
        const target = getStructureTarget();
        if (!target)
            return;
        const block = createInjectedBlock(kind);
        if (mode === 'after' && selection && target.parentElement) {
            target.parentElement.insertBefore(block, target.nextSibling);
        }
        else {
            target.appendChild(block);
        }
        selectInsertedElement(block);
        persistLiveRouteSnapshot();
        showToast(`Added ${kind}`);
    }
    function createFroamArtboard(frame, label = 'Blank white page') {
        const artboard = document.createElement('section');
        applyInjectedBase(artboard);
        artboard.dataset.froamArtboard = 'true';
        artboard.dataset.froamFrameLabel = label;
        artboard.dataset.froamFrameWidth = String(frame.width);
        artboard.dataset.froamFrameHeight = String(frame.height);
        artboard.dataset.froamFramePreset = frame.preset;
        Object.assign(artboard.style, {
            width: frame.preset === 'responsive' ? '100%' : `${frame.width}px`,
            maxWidth: frame.preset === 'responsive' ? `${frame.width}px` : 'none',
            height: `${frame.height}px`,
            minHeight: `${frame.height}px`,
            margin: '28px auto',
            padding: '0',
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: '0',
            border: '1px solid rgba(15, 23, 42, 0.14)',
            borderRadius: '0',
            background: frame.background || '#ffffff',
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
        });
        return artboard;
    }
    function selectedPlacementTarget(root) {
        const selected = currentSelectionRef.current
            ?? (selection ? findElementByPath(root, selection.path) : null);
        if (!selected)
            return null;
        return selected.closest('[data-froam-artboard="true"], [data-froam-component-id], [data-froam-block="true"]')
            ?? selected;
    }
    /** `target`: an explicit anchor (a drop on the page); otherwise the selection. */
    function placeInsertedNode(node, placement, target) {
        const root = getRoot();
        if (!root)
            return false;
        const canvasTarget = root.querySelector('[data-froam-canvas], .kitchen-canvas') ?? root;
        const selectedTarget = target ?? selectedPlacementTarget(root);
        if (placement === 'start') {
            canvasTarget.insertBefore(node, canvasTarget.firstChild);
            return true;
        }
        if (placement === 'inside' && selectedTarget) {
            selectedTarget.appendChild(node);
            return true;
        }
        if ((placement === 'before' || placement === 'after') && selectedTarget?.parentElement) {
            selectedTarget.parentElement.insertBefore(node, placement === 'before' ? selectedTarget : selectedTarget.nextSibling);
            return true;
        }
        canvasTarget.appendChild(node);
        if (['before', 'after', 'inside'].includes(placement) && !selectedTarget) {
            showToast('Nothing selected, so Froam placed it at the page end');
        }
        return true;
    }
    function insertLibraryComponent(componentId, placement, frame, target) {
        // Sampled at insert time: the pattern arrives in the site's fonts, colours and radius.
        const component = createFroamLibraryComponent(componentId, sampleSiteTheme(getRoot() ?? undefined));
        if (!component)
            return;
        applyInjectedBase(component);
        assignFreshFroamNodeIds(component);
        const node = placement === 'new-frame'
            ? createFroamArtboard(frame, component.dataset.froamComponentCategory || 'Website section')
            : component;
        if (node !== component) {
            node.appendChild(component);
            assignFreshFroamNodeIds(node);
        }
        if (!placeInsertedNode(node, placement, target))
            return;
        selectInsertedElement(node);
        persistLiveRouteSnapshot();
        announceArrival(node);
        const title = FROAM_COMPONENTS.find((item) => item.id === componentId)?.title ?? 'Pattern';
        showToast(placement === 'new-frame' ? `${title} inserted on a new white page` : `${title} inserted`);
    }
    /** A new section eases into place, so the eye finds it (skipped for reduced motion). */
    function announceArrival(node) {
        if (typeof node.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
            return;
        node.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    function insertBlankFrame(placement, frame) {
        const artboard = createFroamArtboard(frame);
        assignFreshFroamNodeIds(artboard);
        if (!placeInsertedNode(artboard, placement))
            return;
        selectInsertedElement(artboard);
        persistLiveRouteSnapshot();
        showToast('Blank white page inserted');
    }
    function buildLibraryPage(sections) {
        const root = getRoot();
        if (!root)
            return;
        suspendDraftPaintingRef.current = true;
        pendingDraftPaintResumeRef.current = true;
        const canvasTarget = root.querySelector('[data-froam-canvas], .kitchen-canvas') ?? root;
        canvasTarget.querySelectorAll('[data-froam-artboard="true"]').forEach((artboard) => artboard.remove());
        canvasTarget.querySelectorAll('[data-froam-component-id]').forEach((component) => {
            if (!component.closest('[data-froam-artboard="true"]'))
                component.remove();
        });
        let lastArtboard = null;
        const theme = sampleSiteTheme(root);
        sections.forEach((section) => {
            const artboard = createFroamArtboard(section.frame, section.name);
            artboard.dataset.froamSectionId = section.id;
            if (section.componentId) {
                const component = createFroamLibraryComponent(section.componentId, theme);
                if (component) {
                    applyInjectedBase(component);
                    component.style.margin = '0';
                    component.style.minHeight = '100%';
                    component.style.height = '100%';
                    artboard.appendChild(component);
                }
            }
            assignFreshFroamNodeIds(artboard);
            canvasTarget.appendChild(artboard);
            lastArtboard = artboard;
        });
        if (lastArtboard)
            selectInsertedElement(lastArtboard);
        persistLiveRouteSnapshot();
    }
    function wrapInContainer() {
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target || !target.parentElement)
            return;
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-froam-injected', 'true');
        wrapper.setAttribute('data-froam-block', 'true');
        wrapper.setAttribute('data-froam-wrapper', 'true');
        ensureFroamNodeId(wrapper);
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        target.parentElement.insertBefore(wrapper, target);
        wrapper.appendChild(target);
        selectInsertedElement(wrapper);
        persistLiveRouteSnapshot();
        showToast('Wrapped in container');
    }
    function rectsOverlap(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    function getMergeElements(root) {
        const selectedElements = selections
            .map((sel) => findElementByPath(root, sel.path))
            .filter((el) => el !== null);
        if (selectedElements.length > 1)
            return selectedElements;
        const primary = selectedElements[0] ?? currentSelectionRef.current;
        if (!primary || !primary.parentElement)
            return primary ? [primary] : [];
        const primaryRect = primary.getBoundingClientRect();
        const siblings = Array.from(primary.parentElement.children)
            .filter((child) => (child instanceof HTMLElement
            && child !== primary
            && !child.closest('[data-chef-editor-root="true"]')
            && rectsOverlap(primaryRect, child.getBoundingClientRect())));
        return [primary, ...siblings];
    }
    function groupSelected() {
        const root = getRoot();
        if (!root)
            return;
        const elements = getMergeElements(root);
        if (elements.length < 2) {
            showToast('Select or overlap at least 2 layers to merge');
            return;
        }
        const parent = elements[0].parentElement;
        if (!parent)
            return;
        const sameParent = elements.every((el) => el.parentElement === parent);
        if (!sameParent) {
            showToast('Can only group elements with the same parent');
            return;
        }
        const sortedElements = Array.from(parent.children)
            .filter((child) => child instanceof HTMLElement && elements.includes(child));
        const rects = sortedElements.map((element) => ({ element, rect: element.getBoundingClientRect() }));
        const parentRect = parent.getBoundingClientRect();
        const left = Math.min(...rects.map(({ rect }) => rect.left));
        const top = Math.min(...rects.map(({ rect }) => rect.top));
        const right = Math.max(...rects.map(({ rect }) => rect.right));
        const bottom = Math.max(...rects.map(({ rect }) => rect.bottom));
        const firstEl = sortedElements[0];
        const parentComputed = window.getComputedStyle(parent);
        if (parentComputed.position === 'static')
            parent.style.position = 'relative';
        if (parent !== root) {
            const parentPath = getElementPath(parent, root);
            if (parentPath && !isInjectionPath(parentPath)) {
                const routeKeyRef = viewportStoreKeyRef.current;
                const currentRoute = storeRef.current[routeKeyRef] ?? {};
                storeRef.current = {
                    ...storeRef.current,
                    [routeKeyRef]: {
                        ...currentRoute,
                        [parentPath]: readLiveElementDraft(parent, currentRoute[parentPath] ?? {}),
                    },
                };
            }
        }
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-froam-injected', 'true');
        wrapper.setAttribute('data-froam-block', 'true');
        wrapper.setAttribute('data-froam-merged', 'true');
        ensureFroamNodeId(wrapper);
        Object.assign(wrapper.style, {
            position: 'absolute',
            left: `${Math.round(left - parentRect.left + parent.scrollLeft)}px`,
            top: `${Math.round(top - parentRect.top + parent.scrollTop)}px`,
            width: `${Math.max(1, Math.round(right - left))}px`,
            height: `${Math.max(1, Math.round(bottom - top))}px`,
            minWidth: '1px',
            minHeight: '1px',
            display: 'block',
            padding: '0',
            margin: '0',
            border: '0',
            background: 'transparent',
            overflow: 'visible',
            boxSizing: 'border-box',
        });
        parent.insertBefore(wrapper, firstEl);
        rects.forEach(({ element, rect }) => {
            const computed = window.getComputedStyle(element);
            Object.assign(element.style, {
                position: 'absolute',
                left: `${Math.round(rect.left - left)}px`,
                top: `${Math.round(rect.top - top)}px`,
                width: `${Math.max(1, Math.round(rect.width))}px`,
                height: `${Math.max(1, Math.round(rect.height))}px`,
                margin: '0',
                flex: '0 0 auto',
                boxSizing: computed.boxSizing || 'border-box',
            });
            wrapper.appendChild(element);
        });
        selectInsertedElement(wrapper);
        persistLiveRouteSnapshot();
        setLayers(collectLayers(root));
        showToast('Merged into movable stamp');
    }
    function ungroupSelected() {
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target || !target.parentElement)
            return;
        if (target.getAttribute('data-froam-injected') !== 'true') {
            showToast('Can only ungroup injected containers');
            return;
        }
        const parent = target.parentElement;
        const children = Array.from(target.children).filter((c) => c instanceof HTMLElement);
        if (children.length === 0) {
            target.remove();
            clearSelectionDraft();
            showToast('Removed empty container');
            return;
        }
        const isMerged = target.getAttribute('data-froam-merged') === 'true';
        const wrapperRect = target.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        children.forEach((child) => {
            if (isMerged) {
                const childLeft = readNumber(child.style.left, 0);
                const childTop = readNumber(child.style.top, 0);
                child.style.left = `${Math.round(wrapperRect.left - parentRect.left + parent.scrollLeft + childLeft)}px`;
                child.style.top = `${Math.round(wrapperRect.top - parentRect.top + parent.scrollTop + childTop)}px`;
            }
            parent.insertBefore(child, target);
        });
        target.remove();
        const newSelections = children.map((child) => buildSelection(child, getElementPath(child, root)));
        updateSelectionsState(newSelections);
        persistLiveRouteSnapshot();
        setLayers(collectLayers(root));
        showToast('Ungrouped elements');
    }
    function addChildContainer() {
        addStructureBlock('container', 'inside');
    }
    function addSiblingContainer() {
        addStructureBlock('container', 'after');
    }
    /* ─── Layer click ─── */
    function selectLayerNode(node) {
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, node.path) ?? node.element;
        updateSelectionsState([buildSelection(target, node.path)]);
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.requestAnimationFrame(() => setSelectionRect(target.getBoundingClientRect()));
    }
    // v4.1: write a style to a specific path's draft (persists + undoable), without changing selection.
    function persistPathStyle(target, path, styles, label) {
        const nextStore = { ...storeRef.current };
        const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
        const currentDraft = routeStore[path] ?? {};
        const nextDraft = sanitizeDraftForElement(target, {
            ...currentDraft,
            styles: { ...(currentDraft.styles ?? {}), ...styles },
        });
        applyDraft(target, nextDraft);
        recordOp(path, currentDraft, nextDraft, label);
        routeStore[path] = nextDraft;
        nextStore[viewportStoreKey] = routeStore;
        storeRef.current = nextStore;
        setStore(nextStore);
        saveStore(nextStore);
    }
    function toggleLayerVisibility(node) {
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, node.path);
        if (!target)
            return;
        const isHidden = window.getComputedStyle(target).display === 'none';
        if (isHidden) {
            const prior = hiddenPrevDisplayRef.current[node.path] || '';
            persistPathStyle(target, node.path, { display: prior }, 'Show element');
        }
        else {
            const current = window.getComputedStyle(target).display;
            hiddenPrevDisplayRef.current[node.path] = current === 'none' ? '' : current;
            persistPathStyle(target, node.path, { display: 'none' }, 'Hide element');
        }
        // Refresh layers
        setLayers(collectLayers(root));
    }
    function selectedSectionElement(node) {
        const root = getRoot();
        if (!root || !isStructuralLayerElement(node.element))
            return null;
        return findElementByPath(root, node.path) ?? node.element;
    }
    function getHostStructurePath(element, root) {
        const segments = [];
        let current = element;
        while (current && current !== root) {
            const parent = current.parentElement;
            if (!parent)
                break;
            const siblings = Array.from(parent.children).filter((child) => (child instanceof HTMLElement
                && child.tagName === current?.tagName
                && !child.matches(INJECTED_BLOCK_SELECTOR)));
            segments.unshift(`${current.tagName.toLowerCase()}:${Math.max(1, siblings.indexOf(current) + 1)}`);
            current = parent;
        }
        return segments.join('/');
    }
    function writeHostSectionEntry(routeDrafts, target, patch) {
        const root = getRoot();
        if (!root || !target.parentElement)
            return null;
        const manifest = readSectionStructureDraft(routeDrafts[SECTION_STRUCTURE_KEY]);
        const sourcePath = target.dataset.froamStructureSource || getHostStructurePath(target, root);
        const nodeId = ensureFroamNodeId(target);
        rememberSectionBaseline(target, sourcePath);
        const previous = manifest.sections.find((entry) => entry.nodeId === nodeId || entry.sourcePath === sourcePath);
        const parentPath = target.parentElement === root ? ROOT_PARENT_KEY : getHostStructurePath(target.parentElement, root);
        const nextEntry = {
            nodeId,
            sourcePath,
            parentPath,
            order: Array.from(target.parentElement.children).indexOf(target),
            ...previous,
            ...patch,
        };
        const sections = manifest.sections.filter((entry) => entry.nodeId !== nodeId && entry.sourcePath !== sourcePath);
        sections.push(nextEntry);
        routeDrafts[SECTION_STRUCTURE_KEY] = writeSectionStructureDraft({ version: 1, sections });
        return nextEntry;
    }
    function addSectionRelative(node, placement) {
        const target = selectedSectionElement(node);
        const root = getRoot();
        if (!target || !target.parentElement || !root)
            return;
        const remapped = remapLiveDraftPaths(storeRef.current[viewportStoreKeyRef.current] ?? {}, root);
        const block = createInjectedBlock('section');
        block.dataset.froamFrameLabel = 'New section';
        target.parentElement.insertBefore(block, placement === 'before' ? target : target.nextSibling);
        finishSectionMutation(placement === 'before' ? 'Added section above' : 'Added section below', remapped, block);
        showToast(placement === 'before' ? 'Section added above' : 'Section added below');
    }
    function duplicateSection(node) {
        const target = selectedSectionElement(node);
        const root = getRoot();
        if (!target || !target.parentElement || !root)
            return;
        const remapped = remapLiveDraftPaths(storeRef.current[viewportStoreKeyRef.current] ?? {}, root);
        const clone = target.cloneNode(true);
        clone.dataset.froamInjected = 'true';
        clone.dataset.froamBlock = 'true';
        clone.removeAttribute('data-froam-structure-source');
        clone.removeAttribute('data-froam-structure-deleted');
        assignFreshFroamNodeIds(clone);
        target.parentElement.insertBefore(clone, target.nextSibling);
        finishSectionMutation('Duplicated section', remapped, clone);
        showToast('Section duplicated with independent identities');
    }
    function canMoveSection(node, direction) {
        const target = selectedSectionElement(node);
        return direction === 'up' ? Boolean(target?.previousElementSibling) : Boolean(target?.nextElementSibling);
    }
    function moveSection(node, direction) {
        const target = selectedSectionElement(node);
        const root = getRoot();
        const parent = target?.parentElement;
        const sibling = direction === 'up' ? target?.previousElementSibling : target?.nextElementSibling;
        if (!target || !root || !parent || !(sibling instanceof HTMLElement))
            return;
        const remapped = remapLiveDraftPaths(storeRef.current[viewportStoreKeyRef.current] ?? {}, root);
        const isInjected = target.dataset.froamInjected === 'true' && target.dataset.froamBlock === 'true';
        if (!isInjected)
            writeHostSectionEntry(remapped.next, target, {});
        if (direction === 'up')
            parent.insertBefore(target, sibling);
        else
            parent.insertBefore(sibling, target);
        if (!isInjected) {
            writeHostSectionEntry(remapped.next, target, { order: Array.from(parent.children).indexOf(target) });
        }
        finishSectionMutation(direction === 'up' ? 'Moved section up' : 'Moved section down', remapped, target);
        showToast(direction === 'up' ? 'Section moved up' : 'Section moved down');
    }
    function setSectionVisibility(node, scope) {
        const target = selectedSectionElement(node);
        const root = getRoot();
        if (!target || !root)
            return;
        const remapped = remapLiveDraftPaths(storeRef.current[viewportStoreKeyRef.current] ?? {}, root);
        const attribute = scope === 'editor' ? 'data-froam-editor-hidden' : 'data-froam-export-hidden';
        const nextHidden = target.getAttribute(attribute) !== 'true';
        if (nextHidden)
            target.setAttribute(attribute, 'true');
        else
            target.removeAttribute(attribute);
        if (target.dataset.froamInjected !== 'true') {
            writeHostSectionEntry(remapped.next, target, scope === 'editor' ? { editorHidden: nextHidden } : { exportHidden: nextHidden });
        }
        finishSectionMutation(`${nextHidden ? 'Hid' : 'Showed'} section in ${scope}`, remapped, nextHidden && scope === 'editor' ? null : target);
        showToast(scope === 'editor'
            ? nextHidden ? 'Hidden in editor only; it will still export' : 'Section visible in editor'
            : nextHidden ? 'Hidden in export; kept visible here for editing' : 'Section restored to export');
    }
    function deleteSection(node) {
        const target = selectedSectionElement(node);
        const root = getRoot();
        if (!target || !root || !target.parentElement)
            return;
        const remapped = remapLiveDraftPaths(storeRef.current[viewportStoreKeyRef.current] ?? {}, root);
        const fallback = (target.nextElementSibling ?? target.previousElementSibling);
        if (target.dataset.froamInjected !== 'true') {
            writeHostSectionEntry(remapped.next, target, { deleted: true });
        }
        target.remove();
        finishSectionMutation('Deleted section', remapped, fallback && root.contains(fallback) ? fallback : null);
        showToast('Section deleted; Undo restores it');
    }
    /* ─── Image upload ─── */
    function handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            event.target.value = '';
            return;
        }
        if (pendingCanvasImageRef.current) {
            const reader = new FileReader();
            reader.onload = () => {
                const imageData = typeof reader.result === 'string' ? reader.result : undefined;
                if (imageData)
                    applyCanvasImage(imageData);
            };
            reader.readAsDataURL(file);
            pendingCanvasImageRef.current = false;
            pendingImageTargetRef.current = null;
            event.target.value = '';
            return;
        }
        const root = getRoot();
        if (!root) {
            event.target.value = '';
            return;
        }
        const selectedTarget = selection ? findElementByPath(root, selection.path) : null;
        const target = pendingImageTargetRef.current ?? selectedTarget;
        if (!target) {
            const reader = new FileReader();
            reader.onload = () => {
                const imageData = typeof reader.result === 'string' ? reader.result : undefined;
                if (imageData)
                    addImageBlockFromSource(imageData);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
            return;
        }
        readImageFile(file, target);
        pendingImageTargetRef.current = null;
        event.target.value = '';
    }
    /*
     * Add the client's own typeface.
     *
     * The face is inlined into the design as a data URI rather than dropped in
     * a folder, so it survives Save to Repo and reaches production through the
     * same path as everything else — no asset pipeline to configure, nothing to
     * host. The input is built here instead of living in the JSX so this stays
     * self-contained.
     */
    function addBrandFont() {
        keepStudioPinned();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.woff2,.woff,.ttf,.otf';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file)
                return;
            // Base64 costs a third on top, and this rides inside the design file.
            if (file.size > BRAND_FONT_MAX_BYTES) {
                showToast(`${file.name} is ${Math.round(file.size / 1024)}KB — keep brand faces under ${Math.round(BRAND_FONT_MAX_BYTES / 1024)}KB`);
                return;
            }
            const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
            const format = extension === 'woff2' ? 'woff2'
                : extension === 'woff' ? 'woff'
                    : extension === 'ttf' ? 'truetype'
                        : extension === 'otf' ? 'opentype'
                            : undefined;
            const reader = new FileReader();
            reader.onerror = () => showToast('Could not read that font file');
            reader.onload = () => {
                const src = typeof reader.result === 'string' ? reader.result : '';
                const suggested = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
                const family = window.prompt('Name this font — this is what the CSS will call it', suggested)?.trim();
                if (!family)
                    return;
                const added = sanitizeBrandFonts([{ family, faces: [{ src, format }] }]);
                if (!added.length) {
                    showToast('That file could not be read as a font');
                    return;
                }
                // Re-adding a family replaces it, so uploading a corrected file
                // does the obvious thing instead of stacking a duplicate face.
                setBrandFonts((current) => [...current.filter((font) => font.family !== family), ...added]);
                showToast(`${family} added — it's under Brand in the font list`);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
    function openSelectedImageUpload() {
        keepStudioPinned();
        pendingCanvasImageRef.current = false;
        const root = getRoot();
        const target = root && selection ? findElementByPath(root, selection.path) : null;
        pendingImageTargetRef.current = target;
        if (!target) {
            showToast('No selection, so Froam will add a new image frame');
            fileInputRef.current?.click();
            return;
        }
        fileInputRef.current?.click();
    }
    function openCanvasImageUpload() {
        keepStudioPinned();
        pendingImageTargetRef.current = null;
        pendingCanvasImageRef.current = true;
        fileInputRef.current?.click();
    }
    function clearAppliedImage() {
        keepStudioPinned();
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target)
            return;
        if (target instanceof HTMLImageElement) {
            updateDraft((draft) => ({ ...draft, imageUrl: '' }), { imageUrl: '' }, 'Cleared image');
            showToast('Image cleared');
            return;
        }
        updateDraft((draft) => ({
            ...draft,
            imageUrl: '',
            styles: {
                ...(draft.styles ?? {}),
                backgroundImage: 'none',
                backgroundSize: '',
                backgroundPosition: '',
                backgroundRepeat: '',
            },
        }), { imageUrl: '' }, 'Cleared image');
        if (target.dataset.froamImageFrame === 'true') {
            syncImageFrameState(target);
        }
        showToast('Image cleared');
    }
    /* ─── Panel drag (desktop: free drag; device modes: stays in background area) ─── */
    function handlePanelHeaderPointerDown(e) {
        // Only drag on the header itself, not buttons inside it
        if (e.target.closest('button'))
            return;
        const aside = e.currentTarget.closest('aside');
        if (!aside)
            return;
        const rect = aside.getBoundingClientRect();
        panelDragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
        aside.setPointerCapture(e.pointerId);
    }
    function handlePanelPointerMove(e) {
        if (!panelDragRef.current)
            return;
        const panelW = 400;
        const panelH = 600;
        let newX = e.clientX - panelDragRef.current.offsetX;
        let newY = e.clientY - panelDragRef.current.offsetY;
        if (viewportMode !== 'desktop') {
            // In device mode: constrain to the background overlay, not the device screen
            const mode = VIEWPORT_MODES.find((m) => m.id === viewportMode);
            const padding = 20;
            const scale = Math.min((window.innerWidth - padding * 2) / mode.width, (window.innerHeight - padding * 2) / mode.height, 1);
            const deviceScreenW = mode.width * scale;
            const deviceScreenLeft = (window.innerWidth - deviceScreenW) / 2 - 30; // bezel padding approx
            // Only allow positioning in the left or right background strip
            const rightStripStart = (window.innerWidth + deviceScreenW) / 2 + 30;
            if (newX + panelW / 2 > deviceScreenLeft && newX < rightStripStart) {
                // Push to whichever side is closer
                newX = e.clientX < window.innerWidth / 2
                    ? Math.min(newX, deviceScreenLeft - panelW - 8)
                    : Math.max(newX, rightStripStart);
            }
        }
        newX = Math.max(8, Math.min(newX, window.innerWidth - panelW - 8));
        newY = Math.max(8, Math.min(newY, window.innerHeight - panelH));
        setPanelPosition({ x: newX, y: newY });
    }
    function handlePanelPointerUp(e) {
        if (!panelDragRef.current)
            return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        panelDragRef.current = null;
    }
    // Compute default panel position when not manually placed
    function getDefaultPanelStyle() {
        if (panelPosition) {
            return { position: 'fixed', left: panelPosition.x, top: panelPosition.y, right: 'auto', bottom: 'auto' };
        }
        if (viewportMode !== 'desktop') {
            // Place in the right background strip next to the device shell
            const mode = VIEWPORT_MODES.find((m) => m.id === viewportMode);
            const padding = 20;
            const scale = Math.min((window.innerWidth - padding * 2) / mode.width, (window.innerHeight - padding * 2) / mode.height, 1);
            const deviceScreenW = mode.width * scale;
            const rightStripStart = (window.innerWidth + deviceScreenW) / 2 + 38;
            const availRight = window.innerWidth - rightStripStart - 8;
            if (availRight >= 260) {
                // Enough room on the right
                return { position: 'fixed', left: rightStripStart, top: '50%', right: 'auto', bottom: 'auto', transform: 'translateY(-50%) scale(1)', opacity: 1 };
            }
            // Fall back to left strip
            return { position: 'fixed', right: 'auto', left: 8, top: '50%', bottom: 'auto', transform: 'translateY(-50%) scale(1)', opacity: 1 };
        }
        // Desktop default: top-right
        return {};
    }
    const DRAG_THRESHOLD = 5;
    function handleButtonPointerDown(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    function handleButtonPointerMove(event) {
        if (!dragRef.current)
            return;
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < DRAG_THRESHOLD)
            return; // ignore micro-jitter
        dragRef.current.moved = true;
        setButtonPosition({
            x: Math.min(Math.max(12, event.clientX - dragRef.current.offsetX), window.innerWidth - 80),
            y: Math.min(Math.max(80, event.clientY - dragRef.current.offsetY), window.innerHeight - 80),
        });
    }
    function handleButtonPointerUp(event) {
        const drag = dragRef.current;
        if (!drag)
            return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        dragRef.current = null;
        if (!drag.moved) {
            // Cycle: idle → open, open → minimized, minimized → restored
            if (!showPanel) {
                setPanelOpen(true);
                setActive(true);
                setStudioMinimized(false);
            }
            else if (!studioMinimized) {
                setStudioMinimized(true);
            }
            else {
                setStudioMinimized(false);
            }
        }
    }
    function handleFroamContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        setPanelOpen(false);
        setActive(false);
        setStudioMinimized(false);
        setCommandPaletteOpen(false);
        showToast('Froam hidden');
    }
    /* ─── Refs for stable callbacks (avoids stale closures) ─── */
    const storeRef = useRef(store);
    const connectedPreviewStoreRef = useRef(null);
    const connectedPreviewOriginalStylesRef = useRef(null);
    storeRef.current = store;
    const quickChatOpenRef = useRef(quickChatOpen);
    quickChatOpenRef.current = quickChatOpen;
    const contextMenuPosRef = useRef(contextMenuPos);
    contextMenuPosRef.current = contextMenuPos;
    const moveModeRef = useRef(moveMode);
    moveModeRef.current = moveMode;
    const actionsRef = useRef({ saveToRunam, saveToRepo, undo, redo, clearSelectionDraft, applyStyle, openSelectedImageUpload, wrapInContainer });
    actionsRef.current = { saveToRunam, saveToRepo, undo, redo, clearSelectionDraft, applyStyle, openSelectedImageUpload, wrapInContainer };
    /* ─── CSS Vars refresh ─── */
    useEffect(() => {
        if (!openSections.cssVars)
            return;
        setCssVars(collectCSSVars());
    }, [openSections.cssVars]);
    /* ─── Repo bridge status polling (dev only) ─── */
    useEffect(() => {
        if (!showPanel || !['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname)) {
            setRepoStatus('offline');
            return;
        }
        let active = true;
        let timer = 0;
        async function poll() {
            try {
                const res = await window.fetch(bridgeUrl('/__froam/repo/status'), { cache: 'no-store' });
                if (!res.ok)
                    throw new Error('no bridge');
                const data = await res.json();
                if (!active)
                    return;
                if (!data.success) {
                    setRepoStatus('offline');
                    return;
                }
                setRepoStatus(data.dirty ? 'dirty' : 'clean');
                setRepoDirtyCount(data.files?.length ?? 0);
            }
            catch {
                if (active)
                    setRepoStatus('offline');
            }
        }
        void poll();
        timer = window.setInterval(poll, 4000);
        return () => { active = false; window.clearInterval(timer); };
    }, [showPanel]);
    function updateCSSVar(name, value) {
        document.documentElement.style.setProperty(name, value);
        setCssVars((prev) => prev.map((v) => v.name === name ? { ...v, value } : v));
        showToast(`Updated ${name}`);
    }
    function addCSSVar() {
        if (!newVarName.trim())
            return;
        const name = newVarName.startsWith('--') ? newVarName : `--${newVarName}`;
        document.documentElement.style.setProperty(name, newVarValue || '#000000');
        setCssVars((prev) => [...prev, { name, value: newVarValue || '#000000' }]);
        setNewVarName('');
        setNewVarValue('');
        showToast(`Added ${name}`);
    }
    function removeCSSVar(name) {
        document.documentElement.style.removeProperty(name);
        setCssVars((prev) => prev.filter((v) => v.name !== name));
        showToast(`Removed ${name}`);
    }
    /* ─── Design Tokens ─── */
    function addToken() {
        if (!newTokenName.trim() || !newTokenValue.trim())
            return;
        const token = { id: `${Date.now()}`, name: newTokenName.trim(), value: newTokenValue.trim(), category: newTokenCategory };
        const next = [...tokens, token];
        setTokens(next);
        window.localStorage.setItem(froamStorageKey('froam-tokens-v1', projectKey), JSON.stringify(next));
        document.documentElement.style.setProperty(`--${token.name.replace(/\s+/g, '-').toLowerCase()}`, token.value);
        setNewTokenName('');
        setNewTokenValue('');
        showToast('Token added');
    }
    function removeToken(id) {
        const token = tokens.find((t) => t.id === id);
        if (token)
            document.documentElement.style.removeProperty(`--${token.name.replace(/\s+/g, '-').toLowerCase()}`);
        const next = tokens.filter((t) => t.id !== id);
        setTokens(next);
        window.localStorage.setItem(froamStorageKey('froam-tokens-v1', projectKey), JSON.stringify(next));
    }
    function applyTokenToSelection(token) {
        if (!selection) {
            showToast('Select an element first');
            return;
        }
        if (token.category === 'color')
            applyStyle({ backgroundColor: token.value }, { background: token.value });
        else if (token.category === 'spacing')
            applyStyle({ padding: token.value }, { paddingTop: parseFloat(token.value) });
        else if (token.category === 'font-size')
            applyStyle({ fontSize: token.value }, { fontSize: parseFloat(token.value) });
        else if (token.category === 'radius')
            applyStyle({ borderRadius: token.value }, { borderRadiusTL: parseFloat(token.value) });
        else if (token.category === 'shadow')
            applyStyle({ boxShadow: token.value }, { boxShadow: token.value });
        showToast('Token applied');
    }
    /* ─── Alignment (multi-select) ─── */
    function alignSelections(type) {
        const root = getRoot();
        if (!root)
            return;
        const targets = selections.length > 1
            ? selections.map((s) => findElementByPath(root, s.path)).filter((el) => el !== null)
            : selection ? [findElementByPath(root, selection.path)].filter((el) => el !== null) : [];
        if (targets.length < 2) {
            showToast('Select 2+ elements to align');
            return;
        }
        const rects = targets.map((el) => el.getBoundingClientRect());
        const minLeft = Math.min(...rects.map((r) => r.left));
        const maxRight = Math.max(...rects.map((r) => r.right));
        const minTop = Math.min(...rects.map((r) => r.top));
        const maxBottom = Math.max(...rects.map((r) => r.bottom));
        const centerH = (minLeft + maxRight) / 2;
        const centerV = (minTop + maxBottom) / 2;
        targets.forEach((el, i) => {
            const rect = rects[i];
            const computed = window.getComputedStyle(el);
            if (computed.position === 'static')
                el.style.position = 'relative';
            const currentLeft = parseFloat(computed.left) || 0;
            const currentTop = parseFloat(computed.top) || 0;
            if (type === 'left')
                el.style.left = `${currentLeft + (minLeft - rect.left)}px`;
            else if (type === 'center-h')
                el.style.left = `${currentLeft + (centerH - rect.left - rect.width / 2)}px`;
            else if (type === 'right')
                el.style.left = `${currentLeft + (maxRight - rect.right)}px`;
            else if (type === 'top')
                el.style.top = `${currentTop + (minTop - rect.top)}px`;
            else if (type === 'center-v')
                el.style.top = `${currentTop + (centerV - rect.top - rect.height / 2)}px`;
            else if (type === 'bottom')
                el.style.top = `${currentTop + (maxBottom - rect.bottom)}px`;
        });
        if (type === 'distribute-h' && targets.length >= 3) {
            const sorted = targets.map((el, i) => ({ el, rect: rects[i] })).sort((a, b) => a.rect.left - b.rect.left);
            const totalGap = maxRight - minLeft - sorted.reduce((sum, { rect }) => sum + rect.width, 0);
            const gap = totalGap / (sorted.length - 1);
            let cursor = minLeft;
            sorted.forEach(({ el, rect }, idx) => {
                if (idx === 0 || idx === sorted.length - 1) {
                    cursor += rect.width + gap;
                    return;
                }
                const computed = window.getComputedStyle(el);
                const currentLeft = parseFloat(computed.left) || 0;
                el.style.left = `${currentLeft + (cursor - rect.left)}px`;
                cursor += rect.width + gap;
            });
        }
        if (type === 'distribute-v' && targets.length >= 3) {
            const sorted = targets.map((el, i) => ({ el, rect: rects[i] })).sort((a, b) => a.rect.top - b.rect.top);
            const totalGap = maxBottom - minTop - sorted.reduce((sum, { rect }) => sum + rect.height, 0);
            const gap = totalGap / (sorted.length - 1);
            let cursor = minTop;
            sorted.forEach(({ el, rect }, idx) => {
                if (idx === 0 || idx === sorted.length - 1) {
                    cursor += rect.height + gap;
                    return;
                }
                const computed = window.getComputedStyle(el);
                const currentTop = parseFloat(computed.top) || 0;
                el.style.top = `${currentTop + (cursor - rect.top)}px`;
                cursor += rect.height + gap;
            });
        }
        persistLiveRouteSnapshot();
        showToast('Aligned');
    }
    /* ─── Transition builder ─── */
    function applyTransitionToSelection() {
        if (!selection) {
            showToast('Select an element first');
            return;
        }
        const value = `${transitionProp} ${transitionDuration}ms ${transitionEasing} ${transitionDelay}ms`;
        applyStyle({ transition: value }, undefined, 'Applied transition');
        showToast('Transition applied');
    }
    /* ─── Asset manager ─── */
    function addAssetEntry(url, name) {
        const entry = { id: `${Date.now()}`, name, url, addedAt: Date.now() };
        const next = [entry, ...assets];
        setAssets(next);
        window.localStorage.setItem(froamStorageKey('froam-assets-v1', projectKey), JSON.stringify(next));
    }
    function removeAsset(id) {
        const next = assets.filter((a) => a.id !== id);
        setAssets(next);
        window.localStorage.setItem(froamStorageKey('froam-assets-v1', projectKey), JSON.stringify(next));
    }
    function applyAssetToSelection(url) {
        if (!selection) {
            addImageBlockFromSource(url, 'Asset added as image');
            return;
        }
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target)
            return;
        if (target instanceof HTMLImageElement) {
            updateDraft((d) => ({ ...d, imageUrl: url }));
        }
        else {
            applyStyle({ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' });
        }
        showToast('Asset applied');
    }
    function renameProject(name) {
        const next = name.trim();
        if (!next || next === projectSession.project.name)
            return;
        projectSession.setProject((current) => ({ ...current, name: next, updatedAt: Date.now() }));
        showToast(`Project renamed to ${next}`);
    }
    /* ─── Build transform string ─── */
    function buildTransformString(vals) {
        const s = selection;
        if (!s)
            return '';
        const r = vals.rotate ?? s.rotate;
        const sx = vals.scaleX ?? s.scaleX;
        const sy = vals.scaleY ?? s.scaleY;
        const skx = vals.skewX ?? s.skewX;
        const sky = vals.skewY ?? s.skewY;
        const tx = vals.translateX ?? s.translateX;
        const ty = vals.translateY ?? s.translateY;
        const parts = [];
        if (tx !== 0 || ty !== 0)
            parts.push(`translate(${tx}px, ${ty}px)`);
        if (r !== 0)
            parts.push(`rotate(${r}deg)`);
        if (sx !== 1 || sy !== 1)
            parts.push(`scale(${sx}, ${sy})`);
        if (skx !== 0)
            parts.push(`skewX(${skx}deg)`);
        if (sky !== 0)
            parts.push(`skewY(${sky}deg)`);
        return parts.length > 0 ? parts.join(' ') : 'none';
    }
    /* ─── Command palette ─── */
    const workspaceMode = workspacePreference.mode;
    const activeWorkspaceSection = workspacePreference.sections[workspaceMode] ?? (workspaceMode === 'create' ? 'design' : workspaceMode === 'understand' ? 'scan' : 'laboratory');
    function setWorkspaceMode(mode) {
        const section = workspacePreference.sections[mode] ?? (mode === 'create' ? 'design' : mode === 'understand' ? 'scan' : 'laboratory');
        setWorkspacePreference((current) => ({ ...current, mode }));
        setWorkspaceActivity(null);
        setTemporalOwner(null);
        if (mode === 'create') {
            setIntelligenceOpen(false);
            setLabsOpen(false);
            setConnectedCanvasOpen(false);
            if (section === 'plan' || section === 'library') {
                setRightPanelOpen(false);
                setLeftPanelOpen(true);
                setLeftWorkspaceMode('plan');
                setPlannerRequestedTab(section === 'library' ? 'library' : 'sitemap');
            }
            else
                setRightPanelOpen(true);
        }
        else if (mode === 'understand') {
            setLabsOpen(false);
            setConnectedCanvasOpen(false);
            setRightPanelOpen(false);
            if (section === 'reference' || section === 'layers') {
                setIntelligenceOpen(false);
                setLeftPanelOpen(true);
                setLeftWorkspaceMode(section);
                if (section === 'layers') {
                    const root = getRoot();
                    if (root)
                        setLayers(collectLayers(root));
                }
            }
            else {
                setLeftPanelOpen(false);
                setIntelligenceOpen(true);
                setRequestedIntelligenceTab(intelligenceTabs[section] ?? 'scan');
            }
        }
        else {
            setIntelligenceOpen(false);
            setConnectedCanvasOpen(false);
            setLeftPanelOpen(false);
            setRightPanelOpen(false);
            setLabsOpen(true);
            if (labTabs[section])
                setRequestedLab(labTabs[section]);
        }
    }
    function openWorkspaceSection(section, mode = workspaceMode) {
        const definition = FROAM_WORKSPACE_SECTIONS.find((item) => item.mode === mode && item.id === section);
        if (definition?.requiresSelection && !selection) {
            showToast(`Select an element to use ${definition.label}`);
            return;
        }
        setWorkspacePreference((current) => ({ ...current, mode, sections: { ...current.sections, [mode]: section } }));
        setWorkspaceActivity(null);
        setTemporalOwner(definition?.temporalOwner ?? null);
        setIntelligenceOpen(false);
        setLabsOpen(false);
        setConnectedCanvasOpen(false);
        if (section === 'blueprint') {
            setBlueprintOpen(true);
            return;
        }
        if (section === 'reference' || section === 'layers') {
            setLeftPanelOpen(true);
            setRightPanelOpen(false);
            setLeftWorkspaceMode(section);
            if (section === 'layers') {
                const root = getRoot();
                if (root)
                    setLayers(collectLayers(root));
            }
            return;
        }
        if (mode === 'create') {
            if (section === 'plan' || section === 'library') {
                setLeftPanelOpen(true);
                setRightPanelOpen(false);
                setLeftWorkspaceMode('plan');
                setPlannerRequestedTab(section === 'library' ? 'library' : 'sitemap');
                return;
            }
            if (section === 'animator') {
                setRequestedConnectedTab('interaction');
                setConnectedCanvasOpen(true);
                return;
            }
            if (section === 'interactions-create') {
                setRequestedLab('interactions');
                setLabsOpen(true);
                return;
            }
            setRightPanelOpen(true);
            return;
        }
        if (mode === 'understand') {
            setLeftPanelOpen(false);
            setRightPanelOpen(false);
            setRequestedIntelligenceTab(intelligenceTabs[section] ?? 'scan');
            setIntelligenceOpen(true);
            return;
        }
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
        setLabsOpen(true);
        if (labTabs[section])
            setRequestedLab(labTabs[section]);
    }
    function toggleAdvancedWorkspace() {
        const opening = !workspacePreference.advancedOpen;
        setWorkspacePreference((current) => ({ ...current, advancedOpen: opening }));
        if (opening) {
            setConnectedCanvasOpen(false);
            setIntelligenceOpen(false);
            setLabsOpen(false);
            setRightPanelOpen(false);
            setTemporalOwner(null);
        }
    }
    function openConnectedWorkspace(tab) { setIntelligenceOpen(false); setLabsOpen(false); setRightPanelOpen(false); setRequestedConnectedTab(tab); setConnectedCanvasOpen(true); setTemporalOwner(tab === 'replay' ? 'replay' : tab === 'interaction' ? 'animator' : null); }
    function switchWorkspaceBranch(branchId) { try {
        const next = switchProjectBranch(projectSession.project, branchId);
        projectSession.setProject(next);
        materializeConnectedBranch(deriveBranchState(next, branchId).legacyStore);
        showToast(`Switched to ${next.branches[branchId].name}`);
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not switch prototype');
    } }
    const corePaletteCommands = [
        { id: 'save', label: 'Save draft', shortcut: 'Ctrl+S', icon: _jsx(Save, { size: 15 }), action: saveToRunam },
        { id: 'save-repo', label: 'Save to Repo (git-ready)', shortcut: 'Ctrl+Shift+S', icon: _jsx(GitCommit, { size: 15 }), action: () => { void saveToRepo(); } },
        // Sharing is the start of a review, so it belongs where people look for a
        // verb — not only in a panel section they have to find first.
        {
            id: 'share',
            label: shareLink ? 'Copy review link' : 'Share for review',
            icon: _jsx(Share2, { size: 15 }),
            action: () => {
                setOpenSections((p) => ({ ...p, share: true }));
                if (shareLink)
                    void copyShareLink();
                else
                    void startSharing();
            },
        },
        ...(shareLink
            ? [{
                    id: 'share-new',
                    label: 'New review link (revokes the old one)',
                    icon: _jsx(Share2, { size: 15 }),
                    action: () => { setOpenSections((p) => ({ ...p, share: true })); void startSharing(true); },
                }]
            : []),
        { id: 'scan', label: 'Scan page', icon: _jsx(ScanLine, { size: 15 }), action: () => setScanActive(true) },
        { id: 'blueprint', label: 'Blueprint', icon: _jsx(DraftingCompass, { size: 15 }), action: () => setBlueprintOpen(true) },
        ...FROAM_WORKSPACE_SECTIONS.filter((section) => !section.labFlag || labsFlags[section.labFlag]).map((section) => ({ id: `workspace:${section.mode}:${section.id}`, label: `${section.mode[0].toUpperCase()}${section.mode.slice(1)} · ${section.label}`, searchText: [section.label, section.description, ...(section.aliases ?? [])].join(' '), icon: _jsx(Sparkles, { size: 15 }), action: () => openWorkspaceSection(section.id, section.mode) })),
        ...Object.values(projectSession.project.branches).map((branch) => ({ id: `branch:${branch.id}`, label: `Switch prototype · ${branch.name}`, searchText: `switch branch prototype mutation ${branch.id} ${branch.name}`, icon: _jsx(GitCommit, { size: 15 }), action: () => switchWorkspaceBranch(branch.id) })),
        { id: 'versions', label: 'Versions', icon: _jsx(GitCommit, { size: 15 }), action: () => { setWorkspacePreference((current) => ({ ...current, advancedOpen: true })); setOpenSections((p) => ({ ...p, versions: true })); } },
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: _jsx(Undo2, { size: 15 }), action: undo },
        { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: _jsx(Redo2, { size: 15 }), action: redo },
        { id: 'copy-report', label: 'Copy design report', icon: _jsx(FileText, { size: 15 }), action: () => { copyDesignReport(); } },
        { id: 'copy', label: 'Copy page JSON', shortcut: 'Ctrl+C', icon: _jsx(Copy, { size: 15 }), action: () => { copyRouteDrafts(); } },
        { id: 'export', label: 'Export as file', icon: _jsx(Download, { size: 15 }), action: downloadRunamDrafts },
        { id: 'reset', label: 'Reset page', icon: _jsx(Eraser, { size: 15 }), action: clearRouteDrafts },
        { id: 'dark', label: 'Dark page', icon: _jsx(Palette, { size: 15 }), action: () => applyCanvasStyles({ background: '#050505', text: '#ffffff' }) },
        { id: 'clear-sel', label: 'Clear selected element', icon: _jsx(X, { size: 15 }), action: clearSelectionDraft },
        { id: 'bold', label: 'Toggle bold', icon: _jsx(Bold, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ fontWeight: Number(selectionRef.current.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(selectionRef.current.fontWeight) >= 700 ? '400' : '700' }); } },
        { id: 'flex', label: 'Set display: flex', icon: _jsx(LayoutGrid, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ display: 'flex' }, { display: 'flex' }); } },
        { id: 'grid', label: 'Set display: grid', icon: _jsx(LayoutGrid, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ display: 'grid' }, { display: 'grid' }); } },
        { id: 'center-flex', label: 'Center with flex', icon: _jsx(AlignCenter, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ display: 'flex', justifyContent: 'center', alignItems: 'center' }, { display: 'flex', justifyContent: 'center', alignItems: 'center' }); } },
        { id: 'group-selected', label: 'Group selected elements', icon: _jsx(SquareDashedBottom, { size: 15 }), action: groupSelected },
        { id: 'ungroup-selected', label: 'Ungroup selected container', icon: _jsx(SquareDashedBottom, { size: 15 }), action: ungroupSelected },
        { id: 'size-fill', label: 'Resize: fill parent', icon: _jsx(Box, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('fill'); } },
        { id: 'size-hug', label: 'Resize: hug content', icon: _jsx(Box, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('hug'); } },
        { id: 'size-square', label: 'Resize: square', icon: _jsx(Square, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('square'); } },
        { id: 'size-full-bleed', label: 'Resize: full bleed', icon: _jsx(Box, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('fullBleed'); } },
        { id: 'size-auto', label: 'Resize: reset auto', icon: _jsx(Eraser, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('auto'); } },
    ];
    const commandSearchTerm = commandSearch.trim().toLowerCase();
    const quickEditCommands = selection && commandSearchTerm
        ? searchFroamQuickEdits(commandSearchTerm).map((action) => ({
            id: action.id,
            label: action.label,
            searchText: `${action.intent} ${action.category} ${action.keywords}`,
            hint: action.category,
            icon: _jsx(Sparkles, { size: 15 }),
            action: () => { void froamIntent.submit({ origin: 'command-palette', intent: action.intent }); },
        }))
        : [];
    const paletteCommands = [...corePaletteCommands, ...quickEditCommands];
    const filteredCommands = commandSearchTerm
        ? paletteCommands.filter((c) => `${c.label} ${c.searchText ?? ''}`.toLowerCase().includes(commandSearchTerm) || FROAM_WORKSPACE_SECTIONS.some((section) => c.id === `workspace:${section.mode}:${section.id}` && workspaceCommandMatches(section, commandSearchTerm)))
        : paletteCommands;
    const askFroamVisible = shouldOfferAskFroam(commandSearch, filteredCommands.length);
    const commandResultCount = filteredCommands.length + (askFroamVisible ? 1 : 0);
    function executePaletteCommand(cmd) {
        cmd.action();
        setCommandPaletteOpen(false);
        setCommandSearch('');
    }
    function executeAskFroam() {
        const intent = commandSearch.trim();
        if (!intent || !askFroamVisible)
            return;
        setCommandPaletteOpen(false);
        setCommandSearch('');
        void froamIntent.submit({ origin: 'command-palette', intent });
    }
    function openCommandPalette() {
        commandPaletteReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setCommandPaletteOpen(true);
    }
    function trapCommandPaletteFocus(event) {
        if (event.key !== 'Tab')
            return;
        const focusable = [...(commandPaletteRef.current?.querySelectorAll('input, button:not(:disabled)') ?? [])].filter((element) => element.offsetParent !== null);
        if (!focusable.length)
            return;
        const current = focusable.indexOf(document.activeElement);
        const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current < 0 || current === focusable.length - 1 ? 0 : current + 1);
        event.preventDefault();
        focusable[next].focus();
    }
    /* ─── Global toggle shortcut (works even when panel is closed) ─── */
    useEffect(() => {
        function handleGlobalToggle(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === '.') {
                e.preventDefault();
                if (!showPanel) {
                    setPanelOpen(true);
                    setActive(true);
                    setStudioMinimized(false);
                }
                else if (!studioMinimized) {
                    setStudioMinimized(true);
                }
                else {
                    setPanelOpen(false);
                    setActive(false);
                    setStudioMinimized(false);
                }
            }
        }
        window.addEventListener('keydown', handleGlobalToggle);
        return () => window.removeEventListener('keydown', handleGlobalToggle);
    }, [showPanel, studioMinimized]);
    /* ─── Keyboard shortcuts ─── */
    useEffect(() => {
        if (!showPanel)
            return;
        const TOOL_SHORTCUT_KEYS = new Set(['v', 'h', 't', 'r', 'f']);
        function runToolShortcut(key) {
            switch (key.toLowerCase()) {
                case 'v':
                    setActiveTool('pointer');
                    break;
                case 'h':
                    setActiveTool('hand');
                    break;
                case 't':
                    setActiveTool('text');
                    break;
                case 'r':
                    setActiveTool('shape');
                    break;
                case 'f':
                    setActiveTool('frame');
                    break;
                default: return;
            }
            setMoveMode(false);
        }
        function cancelPendingToolKey(runIt) {
            const pending = pendingToolKeyRef.current;
            if (!pending)
                return;
            window.clearTimeout(pending.timer);
            pendingToolKeyRef.current = null;
            if (runIt)
                runToolShortcut(pending.key);
        }
        /** Start writing, replaying a held shortcut letter as the first typed character. */
        function writeTyped(text) {
            const pending = pendingToolKeyRef.current;
            cancelPendingToolKey(false);
            writeIntoSelection((pending?.key ?? '') + text);
        }
        function handlePaste(e) {
            if (isEditableField(e.target) || inlineEditing || commandPaletteOpen)
                return;
            const selected = currentSelectionRef.current;
            if (!selected || !isWritableElement(selected))
                return;
            const text = e.clipboardData?.getData('text/plain');
            if (!text)
                return;
            e.preventDefault();
            writeIntoSelection(text);
        }
        function handleKeyDown(e) {
            // Keys typed into a field (Froam's own inputs, or copy being written)
            // belong to that field; only modified shortcuts below still apply.
            const inField = isEditableField(e.target);
            // ─── Auto text mode: typing on selected copy writes into it ───
            const selectedCopy = currentSelectionRef.current;
            // Read "am I writing?" from the DOM, not React state: a key can arrive
            // before the render that follows startWriting(), and a key the copy
            // itself already handled (Enter finishing a heading) must not restart it.
            if (!e.defaultPrevented
                && !inField
                && !inlineEditing
                && !commandPaletteOpen
                && selectedCopy
                && !selectedCopy.isContentEditable
                && isWritableElement(selectedCopy)
                && (activeToolRef.current === 'pointer' || activeToolRef.current === 'text')) {
                const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    writeTyped('');
                    return;
                }
                if (printable) {
                    e.preventDefault();
                    if (pendingToolKeyRef.current) {
                        writeTyped(e.key);
                        return;
                    }
                    if (TOOL_SHORTCUT_KEYS.has(e.key.toLowerCase())) {
                        // Could be the start of a word or a tool shortcut: wait a beat.
                        const key = e.key;
                        const timer = window.setTimeout(() => {
                            pendingToolKeyRef.current = null;
                            runToolShortcut(key);
                        }, 260);
                        pendingToolKeyRef.current = { key, timer };
                        return;
                    }
                    writeTyped(e.key);
                    return;
                }
                if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key))
                    cancelPendingToolKey(true);
            }
            // Command palette
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (commandPaletteOpen)
                    setCommandPaletteOpen(false);
                else
                    openCommandPalette();
                return;
            }
            // Save to repo (git-ready files via the dev-server bridge)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                void actionsRef.current.saveToRepo();
                return;
            }
            // Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                actionsRef.current.saveToRunam();
                return;
            }
            // Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                actionsRef.current.undo();
                return;
            }
            // Redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                actionsRef.current.redo();
                return;
            }
            // Escape — layered dismissal: AI first, then menus, then panels, then deselect
            if (e.key === 'Escape') {
                if (commandPaletteOpen) {
                    setCommandPaletteOpen(false);
                    setCommandSearch('');
                    return;
                }
                if (quickChatOpenRef.current) {
                    setQuickChatOpen(false);
                    return;
                }
                if (contextMenuPosRef.current) {
                    setContextMenuPos(null);
                    return;
                }
                if ((inlineEditing || currentSelectionRef.current?.isContentEditable) && currentSelectionRef.current) {
                    // blur() runs startWriting's finish, which saves the copy and turns editing off.
                    currentSelectionRef.current.blur();
                    currentSelectionRef.current.contentEditable = 'false';
                    setInlineEditing(false);
                    return;
                }
                if (labsOpen || intelligenceOpen || connectedCanvasOpen) {
                    setLabsOpen(false);
                    setIntelligenceOpen(false);
                    setConnectedCanvasOpen(false);
                    setTemporalOwner(null);
                    setWorkspaceActivity(null);
                    return;
                }
                if (workspacePreference.advancedOpen) {
                    setWorkspacePreference((current) => ({ ...current, advancedOpen: false }));
                    return;
                }
                currentSelectionRef.current?.removeAttribute('data-chef-selected');
                currentSelectionRef.current?.removeAttribute('data-froam-boundary-label');
                currentSelectionRef.current?.removeAttribute('data-froam-static-boundary');
                currentSelectionRef.current = null;
                setSelection(null);
                return;
            }
            // Delete to clear
            if (e.key === 'Delete' && selection && !inlineEditing && !inField) {
                e.preventDefault();
                actionsRef.current.clearSelectionDraft();
                return;
            }
            // ? key for shortcut overlay
            if (e.key === '?' && !inlineEditing && !commandPaletteOpen && !inField) {
                e.preventDefault();
                setShowShortcutOverlay((v) => !v);
                return;
            }
            // ─── Tool shortcuts — only when not typing ───
            if (!inlineEditing && !commandPaletteOpen && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.key === 'v' || e.key === 'V') {
                    e.preventDefault();
                    setActiveTool('pointer');
                    setMoveMode(false);
                    return;
                }
                if (e.key === 'h' || e.key === 'H') {
                    e.preventDefault();
                    setActiveTool('hand');
                    setMoveMode(false);
                    return;
                }
                if (e.key === 't' || e.key === 'T') {
                    e.preventDefault();
                    setActiveTool('text');
                    setMoveMode(false);
                    return;
                }
                if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    setActiveTool('shape');
                    setMoveMode(false);
                    return;
                }
                if (e.key === 'f' || e.key === 'F') {
                    e.preventDefault();
                    setActiveTool('frame');
                    setMoveMode(false);
                    return;
                }
            }
            // Modified shortcut to toggle move mode without stealing normal typing.
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l' && !inlineEditing && !commandPaletteOpen) {
                e.preventDefault();
                setMoveMode((v) => {
                    showToast(v ? 'Move mode off' : 'Move mode on — drag any element freely');
                    return !v;
                });
                return;
            }
            // Ctrl+D to duplicate (copy styles to new sibling)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selection && !inlineEditing) {
                e.preventDefault();
                const root = getRoot();
                if (!root)
                    return;
                const target = findElementByPath(root, selection.path);
                if (!target || !target.parentElement)
                    return;
                if (isStructuralLayerElement(target)) {
                    duplicateSection(buildLayerNode(target, root));
                    return;
                }
                const clone = target.cloneNode(true);
                clone.removeAttribute('data-chef-selected');
                clone.removeAttribute('data-chef-hovered');
                assignFreshFroamNodeIds(clone);
                target.parentElement.insertBefore(clone, target.nextSibling);
                selectInsertedElement(clone);
                persistLiveRouteSnapshot();
                showToast('Duplicated');
                return;
            }
            // Ctrl+Alt+C to copy styles
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'c' && selection) {
                e.preventDefault();
                const draft = storeRef.current[viewportStoreKey]?.[selection.path];
                if (draft?.styles) {
                    setClipboardStyles({ ...draft.styles });
                    showToast('Styles copied');
                }
                return;
            }
            // Ctrl+Alt+V to paste styles
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'v' && selection && clipboardStyles) {
                e.preventDefault();
                actionsRef.current.applyStyle(clipboardStyles, undefined, 'Pasted styles');
                showToast('Styles pasted');
                return;
            }
            // Arrow keys to nudge position (only when not inline editing)
            if (selection && !inlineEditing && !inField && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const root = getRoot();
                if (!root)
                    return;
                const target = findElementByPath(root, selection.path);
                if (!target)
                    return;
                const computed = window.getComputedStyle(target);
                if (computed.position === 'static') {
                    target.style.position = 'relative';
                }
                const currentTop = readNumber(computed.top, 0);
                const currentLeft = readNumber(computed.left, 0);
                const step = e.shiftKey ? 10 : 1;
                if (e.key === 'ArrowUp')
                    actionsRef.current.applyStyle({ top: `${currentTop - step}px` });
                if (e.key === 'ArrowDown')
                    actionsRef.current.applyStyle({ top: `${currentTop + step}px` });
                if (e.key === 'ArrowLeft')
                    actionsRef.current.applyStyle({ left: `${currentLeft - step}px` });
                if (e.key === 'ArrowRight')
                    actionsRef.current.applyStyle({ left: `${currentLeft + step}px` });
                // Update selection rect for resize handles
                const updated = findElementByPath(root, selection.path);
                if (updated)
                    setSelectionRect(updated.getBoundingClientRect());
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('paste', handlePaste);
        };
    }, [showPanel, selection, commandPaletteOpen, inlineEditing, clipboardStyles, viewportStoreKey, labsOpen, intelligenceOpen, connectedCanvasOpen, workspacePreference.advancedOpen]);
    /* ─── Gradient helpers ─── */
    function applyGradient() {
        if (!selection) {
            showToast('Select an element first');
            return;
        }
        const css = buildGradientCSS(gradType, gradAngle, gradStops);
        applyStyle({ backgroundImage: css, backgroundSize: '100% 100%' }, undefined, 'Applied gradient');
        showToast('Gradient applied');
    }
    /* ─── Bail for kitchen route ─── */
    if (isKitchenRoute)
        return null;
    /* ═══════════════════════════════════════════════════════════════
       Render
       ═══════════════════════════════════════════════════════════════ */
    if (!portalContainer)
        return null;
    const selectedExportElement = selection ? currentSelectionRef.current : null;
    const intelRoot = getRoot();
    const intelSelectedElement = selection && intelRoot ? findElementByPath(intelRoot, selection.path) : null;
    return createPortal(_jsxs(_Fragment, { children: [_jsxs("button", { className: [
                    'global-chef-button',
                    showPanel ? 'is-active' : '',
                    showPanel && !studioMinimized ? 'is-studio-open' : '',
                ].filter(Boolean).join(' '), "data-chef-editor-root": "true", type: "button", style: { left: buttonPosition.x, top: buttonPosition.y }, onPointerDown: handleButtonPointerDown, onPointerMove: handleButtonPointerMove, onPointerUp: handleButtonPointerUp, onPointerCancel: handleButtonPointerUp, onContextMenu: handleFroamContextMenu, "aria-label": showPanel ? `Toggle ${persona.name} Studio` : `Open ${persona.name} Studio`, title: showPanel && !studioMinimized ? 'Minimize (Ctrl+.)' : showPanel ? 'Restore (Ctrl+.)' : `Open ${persona.name} (Ctrl+.)`, children: [_jsx("span", { className: "global-chef-button__halo", "aria-hidden": "true" }), _jsx("span", { className: "global-chef-button__ring", "aria-hidden": "true" }), _jsx("span", { className: "global-chef-button__core", "aria-hidden": "true", children: persona.imageUrl ? (_jsx("img", { src: persona.imageUrl, alt: "", className: "global-chef-button__avatar" })) : (_jsxs("svg", { className: "global-chef-button__mark", viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "froam-mark-grad", x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "#f0fdfa" }), _jsx("stop", { offset: "1", stopColor: "#5eead4" })] }) }), _jsx("path", { fill: "url(#froam-mark-grad)", d: "M7.2 21V3h10.6v3.3h-6.9v4.3h6.2v3.3h-6.2V21Z" })] })) }), _jsxs("span", { className: "global-chef-button__hint", "aria-hidden": "true", children: ["Edit this page ", _jsx("kbd", { children: "Ctrl+." })] }), showPanel && _jsx("span", { className: "global-chef-button__dot" })] }), showPanel && _jsx(MeasurementOverlay, { rect: measureRect }), showPanel && _jsx(ClickPulseOverlay, { pulse: clickPulse }), showPanel && selection && (_jsx(SelectionHandoffOverlay, { rect: selectionRect, label: selection.label, mode: selectionHandoffMode, count: selections.length, pulseKey: selectionHandoffKey }, selectionHandoffKey)), _jsx(Toast, { message: toastMsg, visible: toastVisible }), _jsx(FroamWelcomeTips, { open: showPanel && !studioMinimized && tipsReady && !scanActive }), _jsx(FroamScan, { active: scanActive, onDone: () => {
                    setScanActive(false);
                    setTipsReady(true);
                    // v4.5: the first scan doesn't just count the page — it drafts it
                    try {
                        if (!window.localStorage.getItem(BLUEPRINT_SEEN_KEY)) {
                            window.localStorage.setItem(BLUEPRINT_SEEN_KEY, '1');
                            setBlueprintOpen(true);
                        }
                    }
                    catch { /* storage unavailable */ }
                } }), _jsx(FroamBlueprint, { open: blueprintOpen, onClose: () => setBlueprintOpen(false), routeKey: routeKey, getRootEl: getRoot, onJumpToElement: (el) => {
                    setBlueprintOpen(false);
                    selectInsertedElement(el);
                }, onOpenLayers: () => openWorkspaceSection('layers', 'understand') }), commandPaletteOpen && (_jsx("div", { ref: commandPaletteRef, className: "fs-command-palette", "data-chef-editor-root": "true", role: "dialog", "aria-modal": "true", "aria-label": "Froam command palette", onKeyDown: trapCommandPaletteFocus, onClick: (e) => { if (e.target === e.currentTarget) {
                    setCommandPaletteOpen(false);
                    setCommandSearch('');
                } }, children: _jsxs("div", { className: "fs-command-palette__card", "data-chef-editor-root": "true", children: [_jsx("input", { className: "fs-command-palette__input", type: "text", value: commandSearch, placeholder: "Type a command or ask Froam\u2026", "aria-label": "Search commands or ask Froam", role: "combobox", "aria-controls": "froam-command-results", "aria-expanded": "true", "aria-activedescendant": filteredCommands[commandFocusIndex] ? `froam-command-${filteredCommands[commandFocusIndex].id}` : askFroamVisible && commandFocusIndex === 0 ? 'froam-command-ask' : undefined, autoFocus: true, onChange: (e) => { setCommandSearch(e.target.value); setCommandFocusIndex(0); }, onKeyDown: (e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setCommandFocusIndex((i) => Math.min(i + 1, Math.max(0, commandResultCount - 1)));
                                }
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setCommandFocusIndex((i) => Math.max(i - 1, 0));
                                }
                                if (e.key === 'Enter' && filteredCommands[commandFocusIndex]) {
                                    executePaletteCommand(filteredCommands[commandFocusIndex]);
                                }
                                else if (e.key === 'Enter' && askFroamVisible)
                                    executeAskFroam();
                                if (e.key === 'Escape') {
                                    setCommandPaletteOpen(false);
                                    setCommandSearch('');
                                }
                            } }), _jsxs("ul", { className: "fs-command-palette__list", id: "froam-command-results", role: "listbox", children: [filteredCommands.map((cmd, idx) => (_jsx("li", { id: `froam-command-${cmd.id}`, role: "option", "aria-selected": idx === commandFocusIndex, className: `fs-command-palette__item ${idx === commandFocusIndex ? 'is-focused' : ''}`, onMouseEnter: () => setCommandFocusIndex(idx), children: _jsxs("button", { type: "button", tabIndex: -1, onClick: () => executePaletteCommand(cmd), children: [cmd.icon, _jsx("span", { className: "fs-command-palette__item-label", children: cmd.label }), (cmd.shortcut || cmd.hint) && _jsx("span", { className: "fs-command-palette__item-shortcut", children: cmd.shortcut ?? cmd.hint })] }) }, cmd.id))), askFroamVisible && (_jsx("li", { id: "froam-command-ask", role: "option", "aria-selected": commandFocusIndex === 0, className: `fs-command-palette__item fs-command-palette__ask ${commandFocusIndex === 0 ? 'is-focused' : ''}`, children: _jsxs("button", { type: "button", tabIndex: -1, "aria-label": `Quick Edit: ${commandSearch.trim()}`, onClick: executeAskFroam, children: [_jsx(Sparkles, { size: 15 }), _jsxs("span", { className: "fs-command-palette__item-label", children: [_jsx("strong", { children: "Quick Edit" }), _jsx("small", { children: commandSearch.trim() })] }), _jsx("span", { className: "fs-command-palette__item-shortcut", children: "Enter" })] }) })), filteredCommands.length === 0 && !askFroamVisible && (_jsx("li", { role: "status", className: "fs-command-palette__empty", children: "No commands found" }))] })] }) })), _jsx(FroamIntentResult, { state: froamIntent.state, onAllow: froamIntent.allow, onNotNow: froamIntent.notNow, onKeep: froamIntent.keep, onRetry: froamIntent.retry, onCancel: froamIntent.cancel, onDismiss: froamIntent.dismiss }), showPanel && !inlineEditing && (_jsx(FroamQuickChat, { open: quickChatOpen, selectionLabel: selection?.label, busy: ['preparing', 'awaiting-consent', 'requesting', 'plan-ready', 'creating-prototype', 'retrying', 'adopting'].includes(froamIntent.state.phase), onSubmit: (intent) => { setQuickChatOpen(false); void froamIntent.submit({ origin: 'contextual', intent }); }, onClose: () => setQuickChatOpen(false) })), showPanel && !studioMinimized && (_jsxs("div", { className: [
                    'froam-figma-layout',
                    isMobileUI ? 'is-mobile' : '',
                    leftWorkspaceMode === 'plan' || leftWorkspaceMode === 'reference' ? 'is-planning' : '',
                    leftPanelOpen ? '' : 'is-left-collapsed',
                    connectedCanvasOpen || intelligenceOpen || labsOpen || workspacePreference.advancedOpen ? 'has-context-inspector' : '',
                    (workspaceMode === 'create' && rightPanelOpen) || connectedCanvasOpen || intelligenceOpen || labsOpen || workspacePreference.advancedOpen ? '' : 'is-right-collapsed',
                    `is-toolbar-${uiPreference.toolbar}`,
                    `is-workspace-${uiPreference.workspace}`,
                    `is-panels-${uiPreference.panels}`,
                    froamIntent.state.phase === 'previewing' ? 'is-intent-preview' : '',
                ].filter(Boolean).join(' '), style: {
                    '--froam-left-width': `${froamUIPanelWidth(uiPreference.leftSize, 'left')}px`,
                    '--froam-planner-width': `${Math.max(320, froamUIPanelWidth(uiPreference.leftSize, 'left') + 150)}px`,
                    '--froam-inspector-width': `${froamUIPanelWidth(uiPreference.inspectorSize, 'inspector')}px`,
                    '--froam-ui-scale': uiPreference.scale,
                }, "data-chef-editor-root": "true", children: [_jsx(FroamSectionBoundary, { name: "Toolbar", children: _jsx(FroamToolbar, { viewportMode: viewportMode, onViewportChange: setViewportMode, activeTool: activeTool, onToolChange: (tool) => {
                                if (tool === 'shape') {
                                    setActiveTool('shape');
                                    setMoveMode(false);
                                    setRightPanelOpen(true);
                                    addStructureBlock('shape');
                                    showToast('Rectangle tool — shape inserted');
                                    return;
                                }
                                if (tool === 'frame') {
                                    setActiveTool('frame');
                                    setMoveMode(false);
                                    setRightPanelOpen(true);
                                    insertBlankFrame('end', { preset: 'responsive', width: 1200, height: 720, background: '#ffffff' });
                                    showToast('Frame inserted');
                                    return;
                                }
                                if (tool === 'text') {
                                    setActiveTool('text');
                                    setMoveMode(false);
                                    showToast('Text tool — click any element to edit its text');
                                    return;
                                }
                                if (tool === 'hand') {
                                    setActiveTool('hand');
                                    setMoveMode(false);
                                    showToast('Hand tool — click and drag to pan');
                                    return;
                                }
                                if (tool === 'pointer') {
                                    setActiveTool('pointer');
                                    setMoveMode(false);
                                    return;
                                }
                                setActiveTool(tool);
                                setMoveMode(tool === 'move');
                            }, canUndo: canUndo, canRedo: canRedo, onSave: actionsRef.current.saveToRunam, onSaveRepo: isContributor ? undefined : () => { void actionsRef.current.saveToRepo(); }, collaborate: (_jsx(FroamCollaborate, { role: room.role, isOwner: room.role === 'owner', inRoom: room.inRoom, myName: room.identity?.name ?? persona.name ?? 'You', people: room.others, links: inviteLinks, opening: sharing, onOpenRoom: (fresh) => { void startSharing(fresh); }, onCopyLink: (link) => { void copyInviteLink(link); }, requests: requests, pendingChanges: contributorRequest?.changes ?? [], onSubmit: submitChangeRequest, onWithdraw: (request) => { void withdrawChangeRequest(request); }, previewingId: previewingRequestId, onPreview: previewChangeRequest, onDecide: decideChangeRequest, onEditName: openPersonaEditor, needsName: room.needsName && invitedByLink, onJoin: async (name) => { await room.join(name); } })), repoStatus: repoStatus, repoDirtyCount: repoDirtyCount, onAskFroam: () => setQuickChatOpen(true), onUndo: actionsRef.current.undo, onRedo: actionsRef.current.redo, onCommandPalette: openCommandPalette, onShortcutsOverlay: () => setShowShortcutOverlay(true), routeKey: routeKey, persona: persona, onOpenPersonaEditor: openPersonaEditor, draftCount: draftCount, moveMode: moveMode, onToggleMoveMode: () => setMoveMode((value) => !value), zoom: zoom, setZoom: setZoom, leftPanelOpen: leftPanelOpen, rightPanelOpen: (workspaceMode === 'create' && rightPanelOpen) || connectedCanvasOpen || intelligenceOpen || labsOpen || workspacePreference.advancedOpen, onToggleLeftPanel: () => {
                                if (workspaceMode !== 'create' && leftWorkspaceMode !== 'reference' && leftWorkspaceMode !== 'layers') {
                                    setWorkspaceMode('create');
                                    setLeftPanelOpen(true);
                                    return;
                                }
                                setLeftPanelOpen((value) => !value);
                            }, onToggleRightPanel: () => {
                                if (connectedCanvasOpen || intelligenceOpen || labsOpen || workspacePreference.advancedOpen) {
                                    setConnectedCanvasOpen(false);
                                    setIntelligenceOpen(false);
                                    setLabsOpen(false);
                                    setWorkspacePreference((current) => ({ ...current, advancedOpen: false }));
                                    setTemporalOwner(null);
                                    return;
                                }
                                setRightPanelOpen((value) => !value);
                            }, workspace: (_jsx(FroamWorkspaceShell, { mode: workspaceMode, activeSection: activeWorkspaceSection, onModeChange: setWorkspaceMode, onSectionChange: openWorkspaceSection, projectName: projectSession.project.name, branchId: projectSession.project.activeBranchId, branchName: projectSession.project.branches[projectSession.project.activeBranchId]?.name ?? projectSession.project.activeBranchId, members: roomPresence, hasSelection: Boolean(selection), selectionLabel: selection?.label, flags: labsFlags, advancedOpen: workspacePreference.advancedOpen, onToggleAdvanced: toggleAdvancedWorkspace, onOpenPrototypes: () => openConnectedWorkspace('branches'), onOpenReplay: () => openConnectedWorkspace('replay'), onOpenCommands: openCommandPalette, onAskFroam: () => setQuickChatOpen(true), temporalOwner: temporalOwner, activity: workspaceActivity })), onMinimize: () => {
                                setStudioMinimized(true);
                                showToast(`${persona.name} minimized — editing is still active`);
                            }, onClose: () => {
                                setPanelOpen(false);
                                setActive(false);
                                setStudioMinimized(false);
                            } }) }), _jsxs("div", { className: "froam-figma-left", "data-chef-editor-root": "true", hidden: !leftPanelOpen, children: [_jsxs("div", { className: "froam-figma-left__tabs", "data-chef-editor-root": "true", children: [_jsxs("button", { type: "button", className: leftWorkspaceMode === 'plan' && activeWorkspaceSection !== 'library' ? 'is-active' : '', onClick: () => openWorkspaceSection('plan', 'create'), children: [_jsx(ListTree, { size: 13 }), " Pages"] }), _jsxs("button", { type: "button", className: leftWorkspaceMode === 'plan' && activeWorkspaceSection === 'library' ? 'is-active' : '', onClick: () => openWorkspaceSection('library', 'create'), children: [_jsx(Grid2X2, { size: 13 }), " Library"] }), _jsxs("button", { type: "button", className: leftWorkspaceMode === 'reference' ? 'is-active' : '', onClick: () => openWorkspaceSection('reference', 'understand'), children: [_jsx(FileImage, { size: 13 }), " Reference"] })] }), _jsxs("div", { className: "froam-figma-left__body", "data-chef-editor-root": "true", children: [leftWorkspaceMode === 'plan' ? (_jsx("div", { className: "froam-figma-left__view", children: _jsx(FroamSectionBoundary, { name: "SitePlanner", children: _jsx(FroamSitePlanner, { projectKey: projectKey, routeKey: routeKey, projectName: projectSession.project.name, branchName: projectSession.project.branches[projectSession.project.activeBranchId]?.name ?? projectSession.project.activeBranchId, requestedTab: plannerRequestedTab, selection: selection ? { nodeId: selection.nodeId, label: selection.label } : null, archiveItems: plannerArchiveItems, assets: assets, onRenameProject: renameProject, onAddAsset: addAssetEntry, onApplyAsset: applyAssetToSelection, onRemoveAsset: removeAsset, onTabChange: (nextTab) => {
                                                    setPlannerRequestedTab(nextTab);
                                                    const section = nextTab === 'library' ? 'library' : 'plan';
                                                    setWorkspacePreference((current) => ({ ...current, mode: 'create', sections: { ...current.sections, create: section } }));
                                                }, onInsertComponent: insertLibraryComponent, onInsertBlankFrame: insertBlankFrame, onInsertBlock: addStructureBlock, onInsertArchived: insertArchivedHtml, onBuildPage: buildLibraryPage, onPlanChange: syncSitePlanGraph, onToast: showToast, sampleTheme: () => sampleSiteTheme(getRoot() ?? undefined) }) }) })) : null, _jsx("div", { className: "froam-figma-left__view", hidden: leftWorkspaceMode !== 'reference', children: _jsx(FroamSectionBoundary, { name: "ReferenceWorkspace", children: _jsx(FroamReferenceWorkspace, { project: projectSession.project, routeKey: routeKey, selection: selection ? { nodeId: selection.nodeId, path: selection.path, label: selection.label } : null, reconstructing: ['preparing', 'requesting', 'plan-ready', 'creating-prototype', 'retrying'].includes(froamIntent.state.phase), onReconstruct: (understanding, target) => { void froamIntent.submitReference({ understanding, target }); }, onReferencesChanged: () => { if (froamIntent.state.session?.origin === 'reference')
                                                    froamIntent.cancel(); }, onToast: showToast, onActivityChange: setWorkspaceActivity }) }) }), leftWorkspaceMode === 'layers' ? (_jsx("div", { className: "froam-figma-left__view", children: _jsx(FroamSectionBoundary, { name: "LayersPanel", children: _jsx(FroamLayersPanel, { layers: layers, selectedPath: selection?.path ?? null, selections: selections, selectionCandidates: selectionCandidates, onSelectLayer: selectLayerNode, onToggleVisibility: toggleLayerVisibility, onAddSection: addSectionRelative, onDuplicateSection: duplicateSection, onMoveSection: moveSection, canMoveSection: canMoveSection, onSetSectionVisibility: setSectionVisibility, onDeleteSection: deleteSection, onRefresh: () => { const root = getRoot(); if (root)
                                                    setLayers(collectLayers(root)); }, routeKey: routeKey, projectName: projectSession.project.name, branchName: projectSession.project.branches[projectSession.project.activeBranchId]?.name ?? projectSession.project.activeBranchId, knowledgeByNodeId: layerKnowledge, onOpenKnowledge: (node, section) => { selectLayerNode(node); openWorkspaceSection(section); } }) }) })) : null] })] }), _jsx("div", { className: "froam-figma-layout__canvas", "data-chef-editor-root": "true" }), rightPanelOpen && workspaceMode === 'create' && (() => {
                        const designPanel = (_jsx(FroamSectionBoundary, { name: "DesignPanel", children: _jsx(FroamDesignPanel, { projectKey: projectKey, selection: selection, selectionRect: selectionRect, onApplyStyle: applyStyle, onUpdateDraft: updateDraft, onOpenImageUpload: openSelectedImageUpload, onClearImage: clearAppliedImage, onClearSelectionDraft: actionsRef.current.clearSelectionDraft, marginLinked: marginLinked, paddingLinked: paddingLinked, radiusLinked: radiusLinked, onToggleMarginLinked: () => setMarginLinked((value) => !value), onTogglePaddingLinked: () => setPaddingLinked((value) => !value), onToggleRadiusLinked: () => setRadiusLinked((value) => !value), onApplySizePreset: applySizePreset, onBuildTransformString: buildTransformString, fontOptions: fontOptions, onAddBrandFont: addBrandFont, getRootEl: getRoot, onOpenBlueprint: () => setBlueprintOpen(true), draftStyles: selection ? store[viewportStoreKey]?.[selection.path]?.styles : undefined, onApplyPseudoStyle: applyPseudoStyle }) }));
                        if (!isMobileUI)
                            return designPanel;
                        return (_jsx(FroamBottomSheet, { detent: sheetDetent, onDetentChange: setSheetDetent, title: selection?.label ?? 'Design', subtitle: selection ? 'Tap for style controls' : 'Tap any element to start', children: designPanel }));
                    })()] })), showPanel && studioMinimized && (_jsxs("div", { className: "froam-mini-dock", "data-chef-editor-root": "true", role: "toolbar", "aria-label": `Minimized ${persona.name} Studio`, children: [_jsxs("button", { type: "button", className: "froam-mini-dock__status froam-mini-dock__persona", onClick: openPersonaEditor, title: "Edit studio profile", children: [persona.imageUrl ? (_jsx("img", { className: "froam-mini-dock__avatar", src: persona.imageUrl, alt: "", "aria-hidden": "true" })) : (_jsx("span", { className: "froam-mini-dock__dot" })), _jsx("span", { children: persona.name }), _jsx("small", { children: "editing" })] }), _jsx("button", { type: "button", className: "froam-mini-dock__button", onClick: actionsRef.current.saveToRunam, title: "Save changes", "aria-label": `Save ${persona.name} changes`, children: _jsx(Save, { size: 15 }) }), _jsxs("button", { type: "button", className: "froam-mini-dock__button froam-mini-dock__button--primary", onClick: () => setStudioMinimized(false), title: `Restore ${persona.name} Studio`, "aria-label": `Restore ${persona.name} Studio`, children: [_jsx(Maximize2, { size: 15 }), _jsx("span", { children: "Restore" })] }), _jsx("button", { type: "button", className: "froam-mini-dock__button", onClick: () => {
                            setPanelOpen(false);
                            setActive(false);
                            setStudioMinimized(false);
                        }, title: `Exit ${persona.name}`, "aria-label": `Exit ${persona.name} editing`, children: _jsx(X, { size: 15 }) })] })), showPanel && !studioMinimized && workspacePreference.advancedOpen ? (_jsx("aside", { className: `froam-studio is-advanced-surface ${showPanel ? 'is-open' : ''} ${viewportMode !== 'desktop' ? 'is-device-mode' : ''}`, "data-chef-editor-root": "true", style: getDefaultPanelStyle(), onPointerMove: handlePanelPointerMove, onPointerUp: handlePanelPointerUp, onPointerCancel: handlePanelPointerUp, children: _jsxs("div", { className: "froam-studio__card", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-studio__header", "data-chef-editor-root": "true", style: { cursor: 'grab' }, onPointerDown: handlePanelHeaderPointerDown, children: [_jsxs("div", { className: "froam-studio__brand", children: [_jsx("span", { className: "froam-studio__version-dot" }), _jsxs("span", { className: "froam-studio__logo", children: [persona.name, " Studio"] }), _jsx("span", { className: "froam-studio__badge", children: "v4" }), roomPresence.length > 0 && (_jsx("span", { className: "froam-studio__badge", title: roomPresence.map((m) => `${m.name} · ${m.role}`).join('\n'), style: { background: 'rgba(94,234,212,0.16)', color: '#5eead4' }, children: roomPresence.length === 1
                                                ? `${roomPresence[0].name} is here`
                                                : `${roomPresence.length} here` }))] }), _jsxs("div", { className: "froam-studio__header-actions", children: [_jsx("button", { type: "button", className: `froam-studio__icon-btn${moveMode ? ' is-active' : ''}`, "data-chef-editor-root": "true", onClick: () => { setMoveMode((v) => !v); showToast(moveMode ? 'Move mode off' : 'Move mode on — drag any element freely'); }, title: "Move mode \u2014 drag elements to reposition (Ctrl+Shift+L)", style: moveMode ? { background: 'rgba(239,68,68,0.18)', color: '#ef4444' } : {}, children: _jsx(Move, { size: 14 }) }), _jsx("div", { className: "froam-studio__header-divider" }), _jsxs("div", { className: "froam-viewport-switcher", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", className: `froam-studio__icon-btn ${viewportMode === 'desktop' ? 'is-active' : ''}`, onClick: () => setViewportMode('desktop'), title: "Desktop", children: _jsx(Monitor, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${viewportMode === 'tablet' ? 'is-active' : ''}`, onClick: () => setViewportMode('tablet'), title: "Tablet (768px)", children: _jsx(Tablet, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${viewportMode === 'mobile' ? 'is-active' : ''}`, onClick: () => setViewportMode('mobile'), title: "Mobile (375px)", children: _jsx(Smartphone, { size: 14 }) })] }), _jsx("div", { className: "froam-studio__header-divider" }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: openCommandPalette, title: "Command palette (Ctrl+K)", children: _jsx(Command, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${connectedCanvasOpen ? 'is-active' : ''}`, onClick: () => setConnectedCanvasOpen((value) => !value), title: "Connected Canvas \u2014 replay, prototypes and inspectors", children: _jsx(Share2, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${intelligenceOpen ? 'is-active' : ''}`, onClick: () => setIntelligenceOpen((value) => !value), title: "Understand \u2014 Scan, DNA, Archive, Flow and responsive evidence", children: _jsx(Sparkles, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${labsOpen ? 'is-active' : ''}`, onClick: () => setLabsOpen((value) => !value), title: "Experiments \u2014 optional Froam tools", children: _jsx(Zap, { size: 14 }) }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: undo, disabled: !canUndo, title: "Undo (Ctrl+Z)", children: _jsx(Undo2, { size: 14 }) }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: redo, disabled: !canRedo, title: "Redo (Ctrl+Y)", children: _jsx(Redo2, { size: 14 }) }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: () => setShowShortcutOverlay(true), title: "Keyboard shortcuts (?)", children: _jsx(Keyboard, { size: 14 }) })] })] }), _jsxs("div", { className: "froam-studio__status", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-studio__status-left", children: [_jsx("span", { className: `froam-studio__status-dot ${showPanel ? '' : 'is-idle'}` }), _jsx("span", { className: "froam-studio__status-text", children: showPanel ? 'Editing live' : 'Idle' })] }), _jsx("span", { className: "froam-studio__route", children: routeKey }), viewportMode !== 'desktop' && (_jsx("span", { className: "froam-studio__viewport-badge", "data-chef-editor-root": "true", children: viewportMode === 'mobile' ? '375px' : '768px' }))] }), _jsx("div", { className: "froam-studio__divider" }), inlineEditing && (_jsxs("div", { className: "fs-inline-indicator", "data-chef-editor-root": "true", children: [_jsx(PencilLine, { size: 13, "aria-hidden": "true" }), "Editing inline \u2014 click away or press Esc to finish"] })), selection ? (_jsxs("div", { className: "froam-selection-banner", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-selection-banner__tag", children: [_jsx(MousePointer2, { size: 12, "aria-hidden": "true" }), selection.label] }), _jsx("span", { className: "froam-selection-banner__path", children: selection.path })] })) : (_jsxs("div", { className: "froam-empty-state", "data-chef-editor-root": "true", children: [_jsx(MousePointer2, { size: 28, className: "froam-empty-state__icon" }), _jsx("strong", { children: "No element selected" }), _jsx("span", { children: "Click any element on the page to start designing. Double-click to edit text inline." })] })), _jsxs(AccordionSection, { id: "quickActions", icon: _jsx(Zap, { size: 14 }), title: "Quick Actions", isOpen: openSections.quickActions, onToggle: () => toggleSection('quickActions'), children: [_jsxs("div", { className: "fs-pill-group", children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: saveToRunam, children: [_jsx(ClipboardCheck, { size: 13 }), " Save"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => { copyDesignReport(); }, children: [_jsx(FileText, { size: 13 }), " Copy report"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => { copyRouteDrafts(); }, children: [_jsx(Copy, { size: 13 }), " Copy JSON"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: downloadRunamDrafts, children: [_jsx(Download, { size: 13 }), " Export"] }), _jsxs("button", { type: "button", className: "fs-pill is-danger", onClick: clearRouteDrafts, children: [_jsx(Eraser, { size: 13 }), " Reset page"] }), selection && (_jsxs("button", { type: "button", className: "fs-pill", onClick: clearSelectionDraft, children: [_jsx(X, { size: 13 }), " Clear selected"] }))] }), _jsxs("div", { className: "fs-grid-2", style: { marginTop: 6 }, children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(Palette, { size: 12 }), " Page BG"] }), _jsx("input", { type: "color", className: "fs-color-input", value: canvas.background, onChange: (e) => applyCanvasStyles({ background: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(Type, { size: 12 }), " Page text"] }), _jsx("input", { type: "color", className: "fs-color-input", value: canvas.text, onChange: (e) => applyCanvasStyles({ text: e.target.value }) })] })] }), _jsxs("div", { className: "fs-pill-group", style: { marginTop: 8 }, children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: openCanvasImageUpload, children: [_jsx(ImagePlus, { size: 13 }), " Page image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: clearCanvasImage, children: [_jsx(Eraser, { size: 13 }), " Clear page image"] })] })] }), _jsx(AccordionSection, { id: "intel", icon: _jsx(Sparkles, { size: 14 }), title: "Design Intelligence", isOpen: openSections.intel, onToggle: () => toggleSection('intel'), children: _jsx(FroamIntel, { selectedElement: intelSelectedElement, selectionPath: selection?.path ?? '', applyStyle: applyStyle, onSelectElement: selectElementFromIntel, onFixElement: fixElementFromIntel, onToast: showToast, rootEl: getRoot() }) }), _jsx(AccordionSection, { id: "export", icon: _jsx(Download, { size: 14 }), title: "Export / Capture", isOpen: openSections.export, onToggle: () => toggleSection('export'), children: _jsx(FroamExport, { selectedElement: selectedExportElement, selectionLabel: selection?.label ?? 'Page', selectionPath: selection?.path ?? 'document.body', onToast: showToast }) }), _jsx(AccordionSection, { id: "layout", icon: _jsx(LayoutGrid, { size: 14 }), title: "Layout", isOpen: openSections.layout, onToggle: () => toggleSection('layout'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Display" }), _jsx("select", { className: "fs-select", value: selection.display, onChange: (e) => applyStyle({ display: e.target.value }, { display: e.target.value }), children: displayOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), (selection.display === 'flex' || selection.display === 'inline-flex') && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Direction" }), _jsx("select", { className: "fs-select", value: selection.flexDirection, onChange: (e) => applyStyle({ flexDirection: e.target.value }, { flexDirection: e.target.value }), children: flexDirectionOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Justify" }), _jsx("select", { className: "fs-select", value: selection.justifyContent, onChange: (e) => applyStyle({ justifyContent: e.target.value }, { justifyContent: e.target.value }), children: justifyOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Align" }), _jsx("select", { className: "fs-select", value: selection.alignItems, onChange: (e) => applyStyle({ alignItems: e.target.value }, { alignItems: e.target.value }), children: alignOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Wrap" }), _jsxs("select", { className: "fs-select", value: selection.flexWrap, onChange: (e) => applyStyle({ flexWrap: e.target.value }, { flexWrap: e.target.value }), children: [_jsx("option", { value: "nowrap", children: "nowrap" }), _jsx("option", { value: "wrap", children: "wrap" }), _jsx("option", { value: "wrap-reverse", children: "wrap-reverse" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Gap" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "64", value: selection.gap, onChange: (e) => { const v = e.target.value; applyStyle({ gap: `${v}px` }, { gap: Number(v) }); } }), _jsx("span", { className: "fs-range-value", children: selection.gap })] })] })] })] })), selection.display === 'grid' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Grid columns" }), _jsx("input", { type: "text", className: "fs-input", value: selection.gridTemplateColumns, placeholder: "1fr 1fr 1fr", onChange: (e) => applyStyle({ gridTemplateColumns: e.target.value }, { gridTemplateColumns: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Grid rows" }), _jsx("input", { type: "text", className: "fs-input", value: selection.gridTemplateRows, placeholder: "auto", onChange: (e) => applyStyle({ gridTemplateRows: e.target.value }, { gridTemplateRows: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Gap" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "64", value: selection.gap, onChange: (e) => { const v = e.target.value; applyStyle({ gap: `${v}px` }, { gap: Number(v) }); } }), _jsx("span", { className: "fs-range-value", children: selection.gap })] })] })] })), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Position" }), _jsx("select", { className: "fs-select", value: selection.position, onChange: (e) => applyStyle({ position: e.target.value }, { position: e.target.value }), children: positionOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Z-Index" }), _jsx("input", { type: "number", className: "fs-input", value: selection.zIndex, onChange: (e) => { const v = e.target.value; applyStyle({ zIndex: v }, { zIndex: Number(v) }); } })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Overflow" }), _jsx("select", { className: "fs-select", value: selection.overflow, onChange: (e) => applyStyle({ overflow: e.target.value }, { overflow: e.target.value }), children: overflowOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(MousePointer, { size: 12 }), " Cursor"] }), _jsx("select", { className: "fs-select", value: selection.cursor, onChange: (e) => applyStyle({ cursor: e.target.value }, { cursor: e.target.value }), children: cursorOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "spacing", icon: _jsx(Square, { size: 14 }), title: "Spacing & Sizing", isOpen: openSections.spacing, onToggle: () => toggleSection('spacing'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-boxmodel", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", className: `fs-boxmodel__link-btn ${marginLinked ? 'is-linked' : ''}`, onClick: () => setMarginLinked(!marginLinked), title: "Link margins", children: marginLinked ? _jsx(Link, { size: 10 }) : _jsx(Unlink, { size: 10 }) }), _jsx("input", { className: "fs-boxmodel__input is-mt", value: Math.round(selection.marginTop), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginTop: `${v}px` }, { marginTop: Number(v) });
                                                } } }), _jsx("input", { className: "fs-boxmodel__input is-mr", value: Math.round(selection.marginRight), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginRight: `${v}px` }, { marginRight: Number(v) });
                                                } } }), _jsx("input", { className: "fs-boxmodel__input is-mb", value: Math.round(selection.marginBottom), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginBottom: `${v}px` }, { marginBottom: Number(v) });
                                                } } }), _jsx("input", { className: "fs-boxmodel__input is-ml", value: Math.round(selection.marginLeft), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginLeft: `${v}px` }, { marginLeft: Number(v) });
                                                } } }), _jsxs("div", { className: "fs-boxmodel__padding", children: [_jsx("button", { type: "button", className: `fs-boxmodel__link-btn ${paddingLinked ? 'is-linked' : ''}`, onClick: () => setPaddingLinked(!paddingLinked), title: "Link padding", children: paddingLinked ? _jsx(Link, { size: 10 }) : _jsx(Unlink, { size: 10 }) }), _jsx("input", { className: "fs-boxmodel__input is-pt", value: Math.round(selection.paddingTop), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingTop: `${v}px` }, { paddingTop: Number(v) });
                                                        } } }), _jsx("input", { className: "fs-boxmodel__input is-pr", value: Math.round(selection.paddingRight), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingRight: `${v}px` }, { paddingRight: Number(v) });
                                                        } } }), _jsx("input", { className: "fs-boxmodel__input is-pb", value: Math.round(selection.paddingBottom), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingBottom: `${v}px` }, { paddingBottom: Number(v) });
                                                        } } }), _jsx("input", { className: "fs-boxmodel__input is-pl", value: Math.round(selection.paddingLeft), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingLeft: `${v}px` }, { paddingLeft: Number(v) });
                                                        } } }), _jsx("div", { className: "fs-boxmodel__content", children: "content" })] })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('auto'), children: "Auto" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('hug'), children: "Hug" }), _jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => applySizePreset('fill'), children: "Fill" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('fullBleed'), children: "Full bleed" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('square'), children: "Square" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('viewportHeight'), children: "100vh" })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Width" }), _jsx("input", { type: "text", className: "fs-input", value: selection.width, onChange: (e) => applyStyle({ width: e.target.value }, { width: e.target.value }), placeholder: "auto" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Height" }), _jsx("input", { type: "text", className: "fs-input", value: selection.height, onChange: (e) => applyStyle({ height: e.target.value }, { height: e.target.value }), placeholder: "auto" })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Min width" }), _jsx("input", { type: "text", className: "fs-input", value: selection.minWidth, onChange: (e) => applyStyle({ minWidth: e.target.value }, { minWidth: e.target.value }), placeholder: "none" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Max width" }), _jsx("input", { type: "text", className: "fs-input", value: selection.maxWidth, onChange: (e) => applyStyle({ maxWidth: e.target.value }, { maxWidth: e.target.value }), placeholder: "none" })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Min height" }), _jsx("input", { type: "text", className: "fs-input", value: selection.minHeight, onChange: (e) => applyStyle({ minHeight: e.target.value }, { minHeight: e.target.value }), placeholder: "none" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Max height" }), _jsx("input", { type: "text", className: "fs-input", value: selection.maxHeight, onChange: (e) => applyStyle({ maxHeight: e.target.value }, { maxHeight: e.target.value }), placeholder: "none" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Aspect ratio" }), _jsx("input", { type: "text", className: "fs-input", value: selection.aspectRatio, onChange: (e) => applyStyle({ aspectRatio: e.target.value }, { aspectRatio: e.target.value }), placeholder: "auto, 1 / 1, 16 / 9" })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "typography", icon: _jsx(Type, { size: 14 }), title: "Typography", isOpen: openSections.typography, onToggle: () => toggleSection('typography'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(PencilLine, { size: 12 }), " Content"] }), _jsx("textarea", { className: "fs-textarea", value: selection.text, onChange: (e) => {
                                                    const value = e.target.value;
                                                    updateDraft((draft) => ({ ...draft, text: value }), { text: value });
                                                } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Font family" }), _jsx("select", { className: "fs-select", value: selection.fontFamily, onChange: (e) => applyStyle({ fontFamily: e.target.value }, { fontFamily: e.target.value }), children: fontOptions.map((f) => _jsx("option", { value: f.value, children: f.label }, f.label)) })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Size" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "8", max: "96", value: selection.fontSize, onChange: (e) => { const v = Number(e.target.value); applyStyle({ fontSize: `${v}px` }, { fontSize: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.fontSize })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Weight" }), _jsx("select", { className: "fs-select", value: selection.fontWeight, onChange: (e) => applyStyle({ fontWeight: e.target.value }, { fontWeight: e.target.value }), children: ['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((w) => _jsx("option", { value: w, children: w }, w)) })] })] }), _jsxs("div", { className: "fs-toolbar", role: "toolbar", "aria-label": "Text formatting", children: [_jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.fontWeight === '700' || selection.fontWeight === '800' || selection.fontWeight === '900' ? 'is-active' : ''}`, onClick: () => applyStyle({ fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' }), title: "Bold", children: _jsx(Bold, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.fontStyle === 'italic' ? 'is-active' : ''}`, onClick: () => applyStyle({ fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' }, { fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' }), title: "Italic", children: _jsx(Italic, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textDecoration.includes('underline') ? 'is-active' : ''}`, onClick: () => applyStyle({ textDecorationLine: selection.textDecoration.includes('underline') ? 'none' : 'underline' }, { textDecoration: selection.textDecoration.includes('underline') ? 'none' : 'underline' }), title: "Underline", children: _jsx(Underline, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textDecoration.includes('line-through') ? 'is-active' : ''}`, onClick: () => applyStyle({ textDecorationLine: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' }, { textDecoration: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' }), title: "Strikethrough", children: _jsx(Strikethrough, { size: 14 }) })] }), _jsxs("div", { className: "fs-toolbar", role: "toolbar", "aria-label": "Text alignment", children: [_jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textAlign === 'left' || selection.textAlign === 'start' ? 'is-active' : ''}`, onClick: () => applyStyle({ textAlign: 'left' }, { textAlign: 'left' }), title: "Align left", children: _jsx(AlignLeft, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textAlign === 'center' ? 'is-active' : ''}`, onClick: () => applyStyle({ textAlign: 'center' }, { textAlign: 'center' }), title: "Align center", children: _jsx(AlignCenter, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textAlign === 'right' || selection.textAlign === 'end' ? 'is-active' : ''}`, onClick: () => applyStyle({ textAlign: 'right' }, { textAlign: 'right' }), title: "Align right", children: _jsx(AlignRight, { size: 14 }) })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Letter spacing" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-5", max: "20", step: "0.5", value: selection.letterSpacing, onChange: (e) => { const v = Number(e.target.value); applyStyle({ letterSpacing: `${v}px` }, { letterSpacing: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.letterSpacing })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Line height" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0.8", max: "3", step: "0.1", value: selection.lineHeight, onChange: (e) => { const v = Number(e.target.value); applyStyle({ lineHeight: `${v}` }, { lineHeight: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.lineHeight.toFixed(1) })] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Word spacing" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-5", max: "20", step: "1", value: selection.wordSpacing, onChange: (e) => { const v = Number(e.target.value); applyStyle({ wordSpacing: `${v}px` }, { wordSpacing: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.wordSpacing })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Text transform" }), _jsx("select", { className: "fs-select", value: selection.textTransform, onChange: (e) => applyStyle({ textTransform: e.target.value }, { textTransform: e.target.value }), children: textTransformOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "fill", icon: _jsx(Paintbrush, { size: 14 }), title: "Fill & Color", isOpen: openSections.fill, onToggle: () => toggleSection('fill'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(Palette, { size: 12 }), " Background"] }), _jsx("input", { type: "color", className: "fs-color-input", value: selection.background, onChange: (e) => applyStyle({ backgroundColor: e.target.value }, { background: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(PencilLine, { size: 12 }), " Text color"] }), _jsx("input", { type: "color", className: "fs-color-input", value: selection.color, onChange: (e) => applyStyle({ color: e.target.value }, { color: e.target.value }) })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Opacity" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "100", value: Math.round(selection.opacity * 100), onChange: (e) => { const v = Number(e.target.value) / 100; applyStyle({ opacity: `${v}` }, { opacity: v }); } }), _jsxs("span", { className: "fs-range-value", children: [Math.round(selection.opacity * 100), "%"] })] })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: openSelectedImageUpload, children: [_jsx(ImagePlus, { size: 13 }), " Selected image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: clearAppliedImage, children: [_jsx(Eraser, { size: 13 }), " Clear selected image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: openCanvasImageUpload, children: [_jsx(ImagePlus, { size: 13 }), " Page image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: clearCanvasImage, children: [_jsx(Eraser, { size: 13 }), " Clear page image"] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Mix blend mode" }), _jsx("select", { className: "fs-select", value: selection.mixBlendMode, onChange: (e) => applyStyle({ mixBlendMode: e.target.value }, { mixBlendMode: e.target.value }), children: blendModeOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "borders", icon: _jsx(SquareDashedBottom, { size: 14 }), title: "Borders", isOpen: openSections.borders, onToggle: () => toggleSection('borders'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Width" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "12", value: selection.borderWidth, onChange: (e) => { const v = e.target.value; applyStyle({ borderWidth: `${v}px` }, { borderWidth: Number(v) }); } }), _jsx("span", { className: "fs-range-value", children: selection.borderWidth })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Style" }), _jsx("select", { className: "fs-select", value: selection.borderStyle, onChange: (e) => applyStyle({ borderStyle: e.target.value }, { borderStyle: e.target.value }), children: borderStyleOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(SlidersHorizontal, { size: 12 }), " Border color"] }), _jsx("input", { type: "color", className: "fs-color-input", value: selection.borderColor, onChange: (e) => applyStyle({ borderColor: e.target.value }, { borderColor: e.target.value }) })] }), _jsxs("div", { className: "fs-row-between", children: [_jsx("span", { className: "fs-field__label", children: "Corner radius" }), _jsx("button", { type: "button", className: `fs-boxmodel__link-btn ${radiusLinked ? 'is-linked' : ''}`, onClick: () => setRadiusLinked(!radiusLinked), title: "Link corners", style: { position: 'static' }, children: radiusLinked ? _jsx(Link, { size: 10 }) : _jsx(Unlink, { size: 10 }) })] }), _jsxs("div", { className: "fs-grid-4", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "TL" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusTL), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderTopLeftRadius: `${v}px` }, { borderRadiusTL: v });
                                                            }
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "TR" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusTR), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderTopRightRadius: `${v}px` }, { borderRadiusTR: v });
                                                            }
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "BR" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusBR), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderBottomRightRadius: `${v}px` }, { borderRadiusBR: v });
                                                            }
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "BL" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusBL), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderBottomLeftRadius: `${v}px` }, { borderRadiusBL: v });
                                                            }
                                                        } })] })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "effects", icon: _jsx(Sparkles, { size: 14 }), title: "Effects", isOpen: openSections.effects, onToggle: () => toggleSection('effects'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Box shadow" }), _jsx("input", { type: "text", className: "fs-input", value: selection.boxShadow, placeholder: "0 4px 12px rgba(0,0,0,0.2)", onChange: (e) => applyStyle({ boxShadow: e.target.value }, { boxShadow: e.target.value }) })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }, { boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }), children: "Soft" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }, { boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }), children: "Medium" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }, { boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }), children: "Heavy" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 0 20px rgba(94,234,212,0.3)' }, { boxShadow: '0 0 20px rgba(94,234,212,0.3)' }), children: "Glow" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: 'none' }, { boxShadow: '' }), children: "None" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "CSS Filter" }), _jsx("input", { type: "text", className: "fs-input", value: selection.filter, placeholder: "blur(4px) brightness(1.1)", onChange: (e) => applyStyle({ filter: e.target.value }, { filter: e.target.value }) })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'blur(4px)' }, { filter: 'blur(4px)' }), children: "Blur" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'grayscale(1)' }, { filter: 'grayscale(1)' }), children: "Grayscale" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'brightness(1.2) contrast(1.1)' }, { filter: 'brightness(1.2) contrast(1.1)' }), children: "Vivid" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'saturate(2)' }, { filter: 'saturate(2)' }), children: "Saturate" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'sepia(0.8)' }, { filter: 'sepia(0.8)' }), children: "Sepia" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'none' }, { filter: '' }), children: "Clear" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Backdrop filter" }), _jsx("input", { type: "text", className: "fs-input", value: selection.backdropFilter, placeholder: "blur(12px)", onChange: (e) => applyStyle({ backdropFilter: e.target.value }, { backdropFilter: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Text shadow" }), _jsx("input", { type: "text", className: "fs-input", value: selection.textShadow, placeholder: "2px 2px 4px rgba(0,0,0,0.3)", onChange: (e) => applyStyle({ textShadow: e.target.value }, { textShadow: e.target.value }) })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }, { textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }), children: "Subtle" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '2px 2px 6px rgba(0,0,0,0.5)' }, { textShadow: '2px 2px 6px rgba(0,0,0,0.5)' }), children: "Medium" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '0 0 10px rgba(94,234,212,0.6)' }, { textShadow: '0 0 10px rgba(94,234,212,0.6)' }), children: "Glow" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '3px 3px 0px rgba(255,108,79,0.8)' }, { textShadow: '3px 3px 0px rgba(255,108,79,0.8)' }), children: "Retro" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: 'none' }, { textShadow: '' }), children: "None" })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "transform", icon: _jsx(Move, { size: 14 }), title: "Transform", isOpen: openSections.transform, onToggle: () => toggleSection('transform'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(RotateCw, { size: 12 }), " Rotate"] }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-180", max: "180", value: selection.rotate, onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            applyStyle({ transform: buildTransformString({ rotate: v }) }, { rotate: v });
                                                        } }), _jsxs("span", { className: "fs-range-value", children: [selection.rotate, "\u00B0"] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Scale X" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0.1", max: "3", step: "0.1", value: selection.scaleX, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ scaleX: v }) }, { scaleX: v });
                                                                } }), _jsx("span", { className: "fs-range-value", children: selection.scaleX.toFixed(1) })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Scale Y" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0.1", max: "3", step: "0.1", value: selection.scaleY, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ scaleY: v }) }, { scaleY: v });
                                                                } }), _jsx("span", { className: "fs-range-value", children: selection.scaleY.toFixed(1) })] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Skew X" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-45", max: "45", value: selection.skewX, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ skewX: v }) }, { skewX: v });
                                                                } }), _jsxs("span", { className: "fs-range-value", children: [selection.skewX, "\u00B0"] })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Skew Y" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-45", max: "45", value: selection.skewY, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ skewY: v }) }, { skewY: v });
                                                                } }), _jsxs("span", { className: "fs-range-value", children: [selection.skewY, "\u00B0"] })] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Translate X" }), _jsx("input", { type: "number", className: "fs-input", value: selection.translateX, onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            applyStyle({ transform: buildTransformString({ translateX: v }) }, { translateX: v });
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Translate Y" }), _jsx("input", { type: "number", className: "fs-input", value: selection.translateY, onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            applyStyle({ transform: buildTransformString({ translateY: v }) }, { translateY: v });
                                                        } })] })] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ transform: 'none' }, { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 }), children: [_jsx(Eraser, { size: 12 }), " Reset transform"] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "container", icon: _jsx(Box, { size: 14 }), title: "Add Structure", isOpen: openSections.container, onToggle: () => toggleSection('container'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Add inside the selected area. If nothing is selected, Froam adds it to the page canvas." }), _jsxs("div", { className: "fs-shape-studio", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "fs-shape-studio__header", children: [_jsxs("span", { children: [_jsx(Square, { size: 13 }), " Shape studio"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => addStructureBlock('shape'), children: [_jsx(Plus, { size: 12 }), " Rectangle"] })] }), _jsx(FroamShapeLibrary, { onInsertShape: insertShapeLayer, onToast: showToast })] }), _jsxs("div", { className: "fs-inject-grid", children: [_jsxs("button", { type: "button", className: "fs-inject-btn is-primary", onClick: () => addStructureBlock('section'), children: [_jsx(Square, { size: 18 }), "Add section"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('header'), children: [_jsx(SquareDashedBottom, { size: 18 }), "Add header"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('footer'), children: [_jsx(SquareDashedBottom, { size: 18 }), "Add footer"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('container'), children: [_jsx(Box, { size: 18 }), "Add container"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('card'), children: [_jsx(Layers, { size: 18 }), "Add card"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('grid'), children: [_jsx(LayoutGrid, { size: 18 }), "Add grid"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('hero'), children: [_jsx(Sparkles, { size: 18 }), "Add hero"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('stats'), children: [_jsx(ClipboardCheck, { size: 18 }), "Add stats"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('text'), children: [_jsx(Type, { size: 18 }), "Add text"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('image'), children: [_jsx(ImagePlus, { size: 18 }), "Add image frame"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('button'), children: [_jsx(MousePointer2, { size: 18 }), "Add button"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('divider'), children: [_jsx(Minus, { size: 18 }), "Add divider"] })] }), _jsxs("div", { className: "fs-inject-actions", children: [_jsxs("button", { type: "button", className: "fs-pill", onClick: wrapInContainer, disabled: !selection, children: [_jsx(Grip, { size: 12 }), " Wrap selected"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: addChildContainer, children: [_jsx(Plus, { size: 12 }), " Child container"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: addSiblingContainer, disabled: !selection, children: [_jsx(Minus, { size: 12 }), " Sibling container"] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: openSelectedImageUpload, children: [_jsx(ImagePlus, { size: 12 }), " Upload image"] })] })] }) }), _jsx(AccordionSection, { id: "gradient", icon: _jsx(Palette, { size: 14 }), title: "Gradient Builder", isOpen: openSections.gradient, onToggle: () => toggleSection('gradient'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("div", { className: "fs-gradient-preview", children: _jsx("div", { className: "fs-gradient-preview__overlay", style: { background: buildGradientCSS(gradType, gradAngle, gradStops) } }) }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Type" }), _jsxs("select", { className: "fs-select", value: gradType, onChange: (e) => setGradType(e.target.value), children: [_jsx("option", { value: "linear", children: "Linear" }), _jsx("option", { value: "radial", children: "Radial" })] })] }), gradType === 'linear' && (_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Angle" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "360", value: gradAngle, onChange: (e) => setGradAngle(Number(e.target.value)) }), _jsxs("span", { className: "fs-range-value", children: [gradAngle, "\u00B0"] })] })] }))] }), _jsx("div", { className: "fs-gradient-stops", children: gradStops.map((stop, i) => (_jsxs("div", { className: "fs-gradient-stop", children: [_jsx("input", { type: "color", className: "fs-gradient-stop__color", value: stop.color, onChange: (e) => {
                                                        const next = [...gradStops];
                                                        next[i] = { ...next[i], color: e.target.value };
                                                        setGradStops(next);
                                                    } }), _jsx("input", { type: "number", className: "fs-input fs-gradient-stop__position", min: "0", max: "100", value: stop.position, onChange: (e) => {
                                                        const next = [...gradStops];
                                                        next[i] = { ...next[i], position: Number(e.target.value) };
                                                        setGradStops(next);
                                                    } }), _jsx("span", { className: "fs-range-value", children: "%" }), gradStops.length > 2 && (_jsx("button", { type: "button", className: "fs-gradient-stop__remove", onClick: () => setGradStops(gradStops.filter((_, j) => j !== i)), children: _jsx(X, { size: 12 }) }))] }, i))) }), _jsxs("div", { className: "fs-pill-group", children: [_jsxs("button", { type: "button", className: "fs-pill", onClick: () => setGradStops([...gradStops, { color: '#ffffff', position: 50 }]), children: [_jsx(Plus, { size: 12 }), " Add stop"] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: applyGradient, disabled: !selection, children: [_jsx(Paintbrush, { size: 12 }), " Apply gradient"] })] })] }) }), _jsxs(AccordionSection, { id: "layers", icon: _jsx(Layers, { size: 14 }), title: "Layers", isOpen: openSections.layers, onToggle: () => toggleSection('layers'), children: [_jsx("div", { className: "fs-layers", "data-chef-editor-root": "true", children: layers.length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "No layers detected" })) : (layers.map((node) => (_jsxs("div", { className: `fs-layers__node ${selection?.path === node.path ? 'is-selected' : ''}`, style: { paddingLeft: `${8 + node.depth * 14}px` }, onClick: () => selectLayerNode(node), children: [_jsx(Code, { size: 11, style: { opacity: 0.5, flexShrink: 0 } }), _jsx("span", { className: "fs-layers__node-tag", children: node.tag }), node.className && _jsxs("span", { className: "fs-layers__node-class", children: [".", node.className.replace(/ /g, '.')] }), _jsx("button", { type: "button", className: `fs-layers__eye ${node.hidden ? 'is-hidden' : ''}`, onClick: (e) => { e.stopPropagation(); toggleLayerVisibility(node); }, title: node.hidden ? 'Show' : 'Hide', children: node.hidden ? _jsx(EyeOff, { size: 12 }) : _jsx(Eye, { size: 12 }) })] }, node.path)))) }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => { const root = getRoot(); if (root)
                                        setLayers(collectLayers(root)); }, children: [_jsx(Search, { size: 12 }), " Refresh layers"] })] }), _jsx(AccordionSection, { id: "cssVars", icon: _jsx(Variable, { size: 14 }), title: "CSS Variables", isOpen: openSections.cssVars, onToggle: () => toggleSection('cssVars'), children: _jsxs("div", { className: "fs-stack", children: [cssVars.length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "No custom properties found on :root" })) : (cssVars.map((v) => (_jsxs("div", { className: "fs-css-var", "data-chef-editor-root": "true", children: [_jsx("span", { className: "fs-css-var__name", title: v.name, children: v.name }), _jsx("input", { type: "text", className: "fs-input fs-css-var__value", value: v.value, onChange: (e) => updateCSSVar(v.name, e.target.value) }), _jsx("button", { type: "button", className: "fs-gradient-stop__remove", onClick: () => removeCSSVar(v.name), title: "Remove", children: _jsx(X, { size: 12 }) })] }, v.name)))), _jsxs("div", { className: "fs-row", style: { gap: 6 }, children: [_jsx("input", { type: "text", className: "fs-input", value: newVarName, onChange: (e) => setNewVarName(e.target.value), placeholder: "--my-color", style: { flex: 1 } }), _jsx("input", { type: "text", className: "fs-input", value: newVarValue, onChange: (e) => setNewVarValue(e.target.value), placeholder: "#ff0000", style: { flex: 1 } }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: addCSSVar, children: [_jsx(Plus, { size: 12 }), " Add"] })] })] }) }), _jsx(AccordionSection, { id: "versions", icon: _jsx(GitCommit, { size: 14 }), title: "Versions", isOpen: openSections.versions, onToggle: () => toggleSection('versions'), children: _jsx(FroamVersionPanel, { projectKey: projectKey, routeKey: routeKey, viewportMode: viewportMode, currentStore: routeDrafts, getCurrentStore: () => collectVersionRouteDrafts(), captureThumb: capturePageThumb, onLoadVersion: (versionStore, versionName) => {
                                    // No snapshot needed: the reconcile effect turns this store
                                    // swap into ops, so loading a version is undoable by itself.
                                    opPendingLabelRef.current = `Loaded “${versionName}”`;
                                    const nextStore = {
                                        ...store,
                                        [viewportStoreKey]: versionStore,
                                    };
                                    setStore(nextStore);
                                    saveStore(nextStore);
                                    applyStoreToDOM(nextStore, { clearCurrent: true });
                                    showToast(`Loaded "${versionName}"`);
                                    toggleSection('versions');
                                }, onClose: () => toggleSection('versions') }) }), _jsx(AccordionSection, { id: "history", icon: _jsx(Clock, { size: 14 }), title: "History", isOpen: openSections.history, onToggle: () => toggleSection('history'), children: changeLog.length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Nothing changed here yet" })) : (_jsx("ul", { className: "fs-history-list", children: changeLog.map((change) => (_jsxs("li", { className: "fs-history-item", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "fs-history-meta", children: [_jsx("span", { children: describeChange(change) }), _jsx("small", { children: changeByline(change) })] }), _jsx("button", { type: "button", className: "fs-pill is-accent", title: `Undo ${describeChange(change)}`, onClick: () => revertChange(change), children: "Undo" })] }, change.id))) })) }), _jsx(AccordionSection, { id: "share", icon: _jsx(Share2, { size: 14 }), title: room.inRoom ? 'Shared for review' : 'Share for review', isOpen: openSections.share, onToggle: () => toggleSection('share'), children: !shareLink ? (_jsxs("div", { className: "froam-notes", children: [_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Open a room and send the link. They need no account \u2014 the link is the way in." }), _jsx("button", { type: "button", className: "fs-pill is-accent", disabled: sharing, onClick: () => void startSharing(), children: sharing ? 'Opening…' : 'Get a review link' })] })) : (_jsxs("div", { className: "froam-notes", children: [_jsx("div", { className: "froam-share__link", title: shareLink, children: shareLink }), _jsxs("div", { className: "froam-note__row", children: [_jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => void copyShareLink(), children: copied ? 'Copied' : 'Copy link' }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => void copyEditorLink(), title: "Invite another designer who can edit", children: "Invite editor" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => void startSharing(true), children: "New link" })] }), _jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.7rem' }, children: roomPresence.length
                                            ? `${roomPresence.map((m) => m.name).join(', ')} ${roomPresence.length === 1 ? 'is' : 'are'} here`
                                            : 'Nobody has opened it yet' })] })) }), room.inRoom && (_jsxs(AccordionSection, { id: "notes", icon: _jsx(MessageSquare, { size: 14 }), title: notes.some((n) => !n.resolved) ? `Notes · ${notes.filter((n) => !n.resolved).length}` : 'Notes', isOpen: openSections.notes, onToggle: () => toggleSection('notes'), children: [_jsxs("div", { className: "froam-note froam-revision", "data-chef-editor-root": "true", children: [(() => {
                                            const latest = revisions[0];
                                            if (!latest)
                                                return _jsx("div", { className: "froam-note__body", children: "Not sent for review yet" });
                                            if (latest.status === 'sent') {
                                                return _jsxs("div", { className: "froam-note__body", children: ["Waiting on ", room.present[0]?.name ?? 'them', " \u00B7 sent ", relativeTime(latest.createdAt)] });
                                            }
                                            if (latest.status === 'approved') {
                                                return _jsxs("div", { className: "froam-note__body", style: { color: 'var(--fs-accent, #5eead4)' }, children: ["Approved by ", latest.decidedBy, " \u00B7 ", relativeTime(latest.decidedAt ?? latest.createdAt)] });
                                            }
                                            return _jsxs("div", { className: "froam-note__body", style: { color: '#ff8a45' }, children: [latest.decidedBy, " asked for changes \u00B7 ", relativeTime(latest.decidedAt ?? latest.createdAt), latest.decisionNote && _jsxs("div", { className: "froam-note__quote", style: { marginTop: 4 }, children: ["\u201C", latest.decisionNote, "\u201D"] })] });
                                        })(), _jsx("div", { className: "froam-note__row", children: _jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => void sendForReview(), children: revisions.length ? 'Send again' : 'Send for review' }) })] }), notes.length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Nothing yet \u2014 notes land here as they are left" })) : (_jsx("div", { className: "froam-notes", children: notes.map((note, i) => {
                                        const root = getRoot();
                                        const orphaned = root
                                            ? resolveAnchor(note.anchor, root).status === 'orphaned'
                                            : false;
                                        return (_jsxs("div", { className: `froam-note${note.resolved ? ' is-resolved' : ''}${orphaned ? ' is-orphaned' : ''}`, "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-note__head", children: [_jsx("span", { className: "froam-note__num", children: i + 1 }), _jsx("span", { className: "froam-note__who", children: note.name }), _jsx("span", { className: "froam-note__when", children: note.viewport === viewportMode ? relativeTime(note.createdAt) : `on ${note.viewport} · ${relativeTime(note.createdAt)}` })] }), note.quoted && _jsxs("div", { className: "froam-note__quote", children: ["\u201C", note.quoted, "\u201D"] }), _jsx("div", { className: "froam-note__body", children: note.body }), orphaned && (_jsx("div", { className: "froam-note__flag", children: "The element this was about is gone \u2014 kept, not deleted" })), _jsxs("div", { className: "froam-note__row", children: [!orphaned && (_jsx("button", { type: "button", className: "fs-pill", onClick: () => goToNote(note), children: "Show me" })), _jsx("button", { type: "button", className: note.resolved ? 'fs-pill' : 'fs-pill is-accent', onClick: () => void resolveNote(note), children: note.resolved ? 'Reopen' : 'Resolve' })] })] }, note.id));
                                    }) }))] })), room.inRoom && (_jsx(AccordionSection, { id: "roomChat", icon: _jsx(MessageSquare, { size: 14 }), title: roomPresence.length ? `Room chat · ${roomPresence.length + 1} here` : 'Room chat', isOpen: openSections.roomChat, onToggle: () => toggleSection('roomChat'), children: _jsx(FroamRoomChat, { client: room.client, events: room.events, role: room.role }) })), _jsx(AccordionSection, { id: "inspiration", icon: _jsx(ImagePlus, { size: 14 }), title: "Inspiration Board", isOpen: openSections.inspiration, onToggle: () => toggleSection('inspiration'), children: _jsx(FroamInspirationPanel, { projectKey: projectKey, onToast: showToast }) }), _jsx(AccordionSection, { id: "tokens", icon: _jsx(Coins, { size: 14 }), title: "Design Tokens", isOpen: openSections.tokens, onToggle: () => toggleSection('tokens'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Named values you can apply instantly to any element. Also injected as CSS variables." }), tokens.length > 0 && (_jsx("div", { className: "fs-tokens-grid", children: tokens.map((token) => (_jsxs("div", { className: "fs-token", "data-chef-editor-root": "true", children: [token.category === 'color' && (_jsx("span", { className: "fs-token__swatch", style: { background: token.value } })), _jsx("span", { className: "fs-token__name", title: `--${token.name.replace(/\s+/g, '-').toLowerCase()}`, children: token.name }), _jsx("span", { className: "fs-token__value", children: token.value }), _jsx("button", { type: "button", className: "fs-pill fs-token__apply", onClick: () => applyTokenToSelection(token), children: "Apply" }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", onClick: () => removeToken(token.id), children: _jsx(X, { size: 10 }) })] }, token.id))) })), _jsxs("div", { className: "fs-grid-2", style: { gap: 6 }, children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Category" }), _jsxs("select", { className: "fs-select", value: newTokenCategory, onChange: (e) => setNewTokenCategory(e.target.value), children: [_jsx("option", { value: "color", children: "Color" }), _jsx("option", { value: "spacing", children: "Spacing" }), _jsx("option", { value: "font-size", children: "Font size" }), _jsx("option", { value: "radius", children: "Radius" }), _jsx("option", { value: "shadow", children: "Shadow" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Name" }), _jsx("input", { type: "text", className: "fs-input", value: newTokenName, onChange: (e) => setNewTokenName(e.target.value), placeholder: "brand-primary" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Value" }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [newTokenCategory === 'color' && _jsx("input", { type: "color", className: "fs-color-input", value: newTokenValue || '#000000', onChange: (e) => setNewTokenValue(e.target.value), style: { width: 36 } }), _jsx("input", { type: "text", className: "fs-input", value: newTokenValue, onChange: (e) => setNewTokenValue(e.target.value), placeholder: newTokenCategory === 'color' ? '#5eead4' : newTokenCategory === 'spacing' ? '16px' : newTokenCategory === 'radius' ? '8px' : 'value', style: { flex: 1 } })] })] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: addToken, children: [_jsx(Plus, { size: 12 }), " Add token"] })] }) }), _jsx(AccordionSection, { id: "designSystem", icon: _jsx(Variable, { size: 14 }), title: "Design System", isOpen: openSections.designSystem, onToggle: () => toggleSection('designSystem'), children: _jsx(FroamDesignSystemPanel, { system: activeProjectState.designSystem, onChange: replaceDesignSystem, onToast: showToast, onApplyStyle: (states, name) => {
                                    const combined = { ...(states.base ?? {}) };
                                    for (const state of ['hover', 'focus', 'active'])
                                        for (const [property, value] of Object.entries(states[state] ?? {}))
                                            combined[`__froamState:${state}:${property}`] = value;
                                    applyStyle(combined, undefined, `Reusable style: ${name}`);
                                    showToast(`${name} applied with ${Object.keys(states).length} states`);
                                } }) }), _jsx(AccordionSection, { id: "align", icon: _jsx(AlignCenterHorizontal, { size: 14 }), title: "Align & Distribute", isOpen: openSections.align, onToggle: () => toggleSection('align'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Shift-click multiple elements, then align. Works on 2+ selected elements." }), _jsxs("div", { className: "fs-align-grid", children: [_jsxs("button", { type: "button", className: "fs-pill", title: "Align left edges", onClick: () => alignSelections('left'), children: [_jsx(AlignLeft, { size: 13 }), " Left"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Center horizontally", onClick: () => alignSelections('center-h'), children: [_jsx(AlignCenterHorizontal, { size: 13 }), " Center H"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Align right edges", onClick: () => alignSelections('right'), children: [_jsx(AlignRight, { size: 13 }), " Right"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Align top edges", onClick: () => alignSelections('top'), children: [_jsx(AlignVerticalJustifyCenter, { size: 13 }), " Top"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Center vertically", onClick: () => alignSelections('center-v'), children: [_jsx(AlignCenterVertical, { size: 13 }), " Center V"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Align bottom edges", onClick: () => alignSelections('bottom'), children: [_jsx(AlignVerticalDistributeCenter, { size: 13 }), " Bottom"] })] }), _jsxs("div", { className: "fs-pill-group", style: { marginTop: 4 }, children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", title: "Distribute horizontally", onClick: () => alignSelections('distribute-h'), children: [_jsx(AlignHorizontalDistributeCenter, { size: 13 }), " Distribute H"] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", title: "Distribute vertically", onClick: () => alignSelections('distribute-v'), children: [_jsx(AlignHorizontalJustifyCenter, { size: 13 }), " Distribute V"] })] }), _jsxs("p", { style: { fontSize: '0.7rem', color: 'var(--fs-text-tertiary)', margin: 0 }, children: [selections.length, " element", selections.length !== 1 ? 's' : '', " selected"] })] }) }), _jsx(AccordionSection, { id: "transitions", icon: _jsx(Timer, { size: 14 }), title: "Transitions & Motion", isOpen: openSections.transitions, onToggle: () => toggleSection('transitions'), children: _jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Property" }), _jsx("select", { className: "fs-select", value: transitionProp, onChange: (e) => setTransitionProp(e.target.value), children: ['all', 'opacity', 'transform', 'background-color', 'color', 'box-shadow', 'border-radius', 'width', 'height', 'padding', 'margin', 'filter'].map((p) => (_jsx("option", { value: p, children: p }, p))) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Easing" }), _jsx("select", { className: "fs-select", value: transitionEasing, onChange: (e) => setTransitionEasing(e.target.value), children: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'cubic-bezier(0.34,1.56,0.64,1)', 'cubic-bezier(0.4,0,0.2,1)'].map((e) => (_jsx("option", { value: e, children: e.startsWith('cubic') ? 'Spring' : e }, e))) })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Duration (ms)" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "50", max: "2000", step: "50", value: transitionDuration, onChange: (e) => setTransitionDuration(Number(e.target.value)) }), _jsx("span", { className: "fs-range-value", children: transitionDuration })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Delay (ms)" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "1000", step: "50", value: transitionDelay, onChange: (e) => setTransitionDelay(Number(e.target.value)) }), _jsx("span", { className: "fs-range-value", children: transitionDelay })] })] })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('all'); setTransitionDuration(200); setTransitionEasing('ease'); setTransitionDelay(0); }, children: "Fast" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('all'); setTransitionDuration(400); setTransitionEasing('ease-in-out'); setTransitionDelay(0); }, children: "Smooth" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('transform'); setTransitionDuration(600); setTransitionEasing('cubic-bezier(0.34,1.56,0.64,1)'); setTransitionDelay(0); }, children: "Spring" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('opacity'); setTransitionDuration(300); setTransitionEasing('ease'); setTransitionDelay(0); }, children: "Fade" })] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: applyTransitionToSelection, disabled: !selection, children: [_jsx(Zap, { size: 12 }), " Apply to selected"] }), selection && (_jsxs("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ transition: 'none' }), children: [_jsx(Eraser, { size: 12 }), " Remove transition"] }))] }) }), _jsx(AccordionSection, { id: "assets", icon: _jsx(FileImage, { size: 14 }), title: "Asset Manager", isOpen: openSections.assets, onToggle: () => toggleSection('assets'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Save images and apply them to any element. Drag & drop or paste a URL." }), _jsxs("div", { className: "fs-row", style: { gap: 6 }, children: [_jsx("input", { type: "text", className: "fs-input", placeholder: "Paste image URL\u2026", style: { flex: 1 }, onKeyDown: (e) => {
                                                    if (e.key === 'Enter') {
                                                        const url = e.target.value.trim();
                                                        if (url) {
                                                            addAssetEntry(url, url.split('/').pop()?.split('?')[0] || 'Image');
                                                            e.target.value = '';
                                                        }
                                                    }
                                                } }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: () => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.onchange = () => {
                                                        const file = input.files?.[0];
                                                        if (!file)
                                                            return;
                                                        const reader = new FileReader();
                                                        reader.onload = () => { if (typeof reader.result === 'string')
                                                            addAssetEntry(reader.result, file.name.replace(/\.[^.]+$/, '')); };
                                                        reader.readAsDataURL(file);
                                                    };
                                                    input.click();
                                                }, children: [_jsx(ImagePlus, { size: 12 }), " Upload"] })] }), assets.length > 0 && (_jsx("input", { type: "text", className: "fs-input", placeholder: "Search assets\u2026", value: assetSearch, onChange: (e) => setAssetSearch(e.target.value) })), _jsxs("div", { className: "fs-assets-grid", children: [assets.filter((a) => !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase())).map((asset) => (_jsxs("div", { className: "fs-asset-item", "data-chef-editor-root": "true", children: [_jsx("img", { src: asset.url, alt: asset.name, className: "fs-asset-item__thumb", onClick: () => applyAssetToSelection(asset.url), loading: "lazy" }), _jsx("span", { className: "fs-asset-item__name", title: asset.name, children: asset.name }), _jsx("button", { type: "button", className: "fs-asset-item__remove", onClick: () => removeAsset(asset.id), children: _jsx(X, { size: 10 }) })] }, asset.id))), assets.length === 0 && _jsx("p", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem', margin: 0 }, children: "No assets yet." })] })] }) }), _jsxs("div", { className: "froam-studio__quick-bar", "data-chef-editor-root": "true", children: [_jsxs("button", { type: "button", className: "fs-pill", onClick: openCommandPalette, title: "Ctrl+K", children: [_jsx(Search, { size: 11 }), " Ctrl+K"] }), _jsx("span", { style: { flex: 1 } }), _jsxs("span", { style: { fontSize: '0.64rem', color: 'var(--fs-text-tertiary)' }, children: [draftCount, " ", viewportMode, " drafts"] })] })] }) })) : null, _jsx("input", { ref: fileInputRef, className: "fs-hidden-input", "data-chef-editor-root": "true", type: "file", accept: "image/*", onChange: handleImageUpload }), room.inRoom && (_jsx(FroamNotePins, { notes: notes, root: getRoot(), activeId: activeNoteId, onPick: goToNote })), room.inRoom && (_jsx(FroamPresenceLayer, { members: roomPresence, routeKey: routeKey, viewport: viewportMode, root: getRoot() })), _jsx(FroamConnectedCanvas, { open: showPanel && connectedCanvasOpen, onClose: () => { setConnectedCanvasOpen(false); setTemporalOwner((owner) => owner === 'replay' || owner === 'animator' ? null : owner); }, projectId: froamProjectId, actorId: room.identity?.actor ?? LOCAL_ACTOR, ops: opLog.all(), store: store, registry: nodeRegistryRef.current, diagnostics: identityDiagnostics, frameworkFinding: frameworkIdentityFinding, routeKey: routeKey, viewport: viewportMode, selection: selection ? { nodeId: selection.nodeId, path: selection.path, label: selection.label } : null, selectedElement: currentSelectionRef.current, onPreviewStore: previewConnectedCanvas, onMaterializeBranch: materializeConnectedBranch, onSelectNode: selectConnectedNode, onApplyAnimation: (css, inline) => {
                    let style = document.getElementById('froam-connected-interactions');
                    if (!style) {
                        style = document.createElement('style');
                        style.id = 'froam-connected-interactions';
                        document.head.appendChild(style);
                    }
                    style.textContent = `${style.textContent ?? ''}\n${css}`;
                    const activeStoreKey = viewportStoreKeyRef.current;
                    const activeStore = storeRef.current;
                    const activeRoute = { ...(activeStore[activeStoreKey] ?? {}) };
                    const currentCanvasDraft = activeRoute[CANVAS_KEY] ?? {};
                    const animationName = inline.trim().split(/\s+/)[0] || 'froam-motion';
                    const nextCustomCSS = upsertAnimationCss(currentCanvasDraft.styles?.customCSS, animationName, css);
                    const nextCanvasDraft = { ...currentCanvasDraft, styles: { ...(currentCanvasDraft.styles ?? {}), customCSS: nextCustomCSS } };
                    activeRoute[CANVAS_KEY] = nextCanvasDraft;
                    const nextStore = { ...activeStore, [activeStoreKey]: activeRoute };
                    recordOp(CANVAS_KEY, currentCanvasDraft, nextCanvasDraft, `Animation keyframes: ${animationName}`);
                    applyGlobalCSS(nextCustomCSS);
                    storeRef.current = nextStore;
                    setStore(nextStore);
                    applyStyle({ animation: inline }, undefined, 'Animation');
                }, onToast: showToast, project: projectSession.project, onProjectChange: projectSession.setProject, requestedTab: requestedConnectedTab, onTemporalOwnerChange: (owner) => setTemporalOwner((current) => owner ?? (current === 'replay' || current === 'animator' ? null : current)) }), _jsx(FroamIntelligence, { open: showPanel && intelligenceOpen, onClose: () => { setIntelligenceOpen(false); setTemporalOwner((owner) => owner === 'breakpoint-cinema' ? null : owner); }, project: projectSession.project, onProjectChange: projectSession.setProject, actorId: room.identity?.actor ?? LOCAL_ACTOR, root: getRoot(), registry: nodeRegistryRef.current, onRegistryChange: (registry) => { nodeRegistryRef.current = registry; saveNodeRegistry(registry); }, routeKey: routeKey, viewport: viewportMode, selection: selection ? { nodeId: selection.nodeId, path: selection.path, label: selection.label } : null, selectedElement: currentSelectionRef.current, onSelectNode: selectConnectedNode, onInsertArchived: insertArchivedHtml, onApplyArchivedStyle: (styles) => applyStyle(styles, undefined, 'Archive style'), onPreviewWidth: previewIntelligenceWidth, onToast: showToast, requestedTab: requestedIntelligenceTab, onTemporalOwnerChange: (owner) => setTemporalOwner((current) => owner ?? (current === 'breakpoint-cinema' ? null : current)), onActivityChange: setWorkspaceActivity }), _jsx(FroamLabs, { open: showPanel && labsOpen, onClose: () => { setLabsOpen(false); setTemporalOwner((owner) => owner === 'sampling' || owner === 'trailer' ? null : owner); }, project: projectSession.project, onProjectChange: projectSession.setProject, actorId: room.identity?.actor ?? LOCAL_ACTOR, selectedNodeId: selection?.nodeId, selectedElement: currentSelectionRef.current, onToast: showToast, requestedLab: requestedLab, flags: labsFlags, onFlagsChange: setLabsFlags, onTemporalOwnerChange: (owner) => setTemporalOwner((current) => owner ?? (current === 'sampling' || current === 'trailer' ? null : current)), onActivityChange: setWorkspaceActivity }), showPanel && selection && !inlineEditing && (_jsx(FroamResizeHandles, { targetRect: selectionRect, visible: !!selectionRect, lockKey: selectionHandoffKey, onResizeStart: () => {
                    if (!selection)
                        return;
                    if (guardRemoteLock(selection.path))
                        return;
                    const root = getRoot();
                    if (!root)
                        return;
                    const target = findElementByPath(root, selection.path);
                    if (!target)
                        return;
                    const rect = target.getBoundingClientRect();
                    const computed = window.getComputedStyle(target);
                    const originalRoute = originalsRef.current[viewportStoreKey] ?? {};
                    if (!originalRoute[selection.path]) {
                        const inlineStyles = target.style;
                        originalRoute[selection.path] = {
                            text: target.innerText,
                            imageUrl: target instanceof HTMLImageElement ? target.currentSrc || target.src || '' : undefined,
                            styles: Object.fromEntries(persistedStyleKeys.map((key) => [key, inlineStyles[key] || ''])),
                        };
                        originalsRef.current[viewportStoreKey] = originalRoute;
                    }
                    resizeBaseRef.current = {
                        width: rect.width,
                        height: rect.height,
                        left: readNumber(computed.left, 0),
                        top: readNumber(computed.top, 0),
                        position: computed.position,
                        aspectRatio: rect.height > 0 ? rect.width / rect.height : 1,
                        finalStyles: {},
                    };
                    setIsResizing(true);
                    setRoomLockedPath(selection.path);
                }, onResize: ({ direction, deltaWidth, deltaHeight, deltaX, deltaY, preserveAspectRatio, resizeFromCenter }) => {
                    if (!selection || !resizeBaseRef.current)
                        return;
                    const root = getRoot();
                    if (!root)
                        return;
                    const target = findElementByPath(root, selection.path);
                    if (!target)
                        return;
                    const base = resizeBaseRef.current;
                    let widthDelta = resizeFromCenter ? deltaWidth * 2 : deltaWidth;
                    let heightDelta = resizeFromCenter ? deltaHeight * 2 : deltaHeight;
                    const changesWidth = direction.includes('e') || direction.includes('w');
                    const changesHeight = direction === 'n' || direction === 's' || direction.includes('n') || direction.includes('s');
                    let newW = Math.max(20, base.width + widthDelta);
                    let newH = Math.max(10, base.height + heightDelta);
                    if (preserveAspectRatio && changesWidth && changesHeight && base.aspectRatio > 0) {
                        const widthChange = Math.abs(widthDelta / Math.max(base.width, 1));
                        const heightChange = Math.abs(heightDelta / Math.max(base.height, 1));
                        if (widthChange >= heightChange) {
                            newH = Math.max(10, newW / base.aspectRatio);
                            heightDelta = newH - base.height;
                        }
                        else {
                            newW = Math.max(20, newH * base.aspectRatio);
                            widthDelta = newW - base.width;
                        }
                    }
                    const snap = (value) => {
                        const rounded = Math.round(value);
                        const grid = Math.round(rounded / 8) * 8;
                        return Math.abs(grid - rounded) <= 2 ? grid : rounded;
                    };
                    newW = snap(newW);
                    newH = snap(newH);
                    widthDelta = newW - base.width;
                    heightDelta = newH - base.height;
                    let moveX = resizeFromCenter && changesWidth ? -widthDelta / 2 : deltaX;
                    let moveY = resizeFromCenter && changesHeight ? -heightDelta / 2 : deltaY;
                    if (!resizeFromCenter && direction.includes('w'))
                        moveX = -widthDelta;
                    if (!resizeFromCenter && direction.includes('n'))
                        moveY = -heightDelta;
                    const styles = {};
                    if (changesWidth) {
                        styles.width = `${newW}px`;
                        styles.minWidth = '0px';
                        styles.maxWidth = 'none';
                        styles.boxSizing = 'border-box';
                        styles.flex = '0 0 auto';
                    }
                    if (changesHeight) {
                        styles.height = `${newH}px`;
                        styles.minHeight = '0px';
                        styles.maxHeight = 'none';
                        styles.boxSizing = 'border-box';
                    }
                    if (moveX !== 0 || moveY !== 0) {
                        if (base.position === 'static') {
                            styles.position = 'relative';
                        }
                        if (moveX !== 0) {
                            styles.left = `${Math.round(base.left + moveX)}px`;
                        }
                        if (moveY !== 0) {
                            styles.top = `${Math.round(base.top + moveY)}px`;
                        }
                    }
                    if (!Object.keys(styles).length)
                        return;
                    Object.entries(styles).forEach(([property, value]) => {
                        target.style.setProperty(camelToKebab(property), value);
                    });
                    base.finalStyles = styles;
                    setSelectionRect(target.getBoundingClientRect());
                }, onResizeEnd: () => {
                    setIsResizing(false);
                    setRoomLockedPath(null);
                    const finalStyles = resizeBaseRef.current?.finalStyles ?? {};
                    resizeBaseRef.current = null;
                    if (!selection)
                        return;
                    const root = getRoot();
                    if (!root)
                        return;
                    const target = findElementByPath(root, selection.path);
                    if (!target)
                        return;
                    if (Object.keys(finalStyles).length) {
                        const nextSelection = {};
                        if (finalStyles.width)
                            nextSelection.width = finalStyles.width;
                        if (finalStyles.height)
                            nextSelection.height = finalStyles.height;
                        if (finalStyles.position)
                            nextSelection.position = finalStyles.position;
                        applyStyle(finalStyles, nextSelection, 'Resized element');
                    }
                    setSelectionRect(target.getBoundingClientRect());
                } })), _jsx(FroamPersonaEditor, { open: personaEditorOpen, persona: personaDraft, onChange: setPersonaDraft, onClose: closePersonaEditor, onSave: savePersonaProfile, onImageUpload: handlePersonaImageUpload, onClearImage: clearPersonaImage }), showPanel && selection && !inlineEditing && !isResizing && !quickChatOpen && froamIntent.state.phase !== 'previewing' && (!isMobileUI || sheetDetent === 'peek') && (_jsx(FroamFloatingBar, { targetRect: selectionRect, visible: !!selectionRect, docked: isMobileUI, canUndo: canUndo, onWalk: walkSelection, label: selection.label, fontFamily: selection.fontFamily, fontSize: selection.fontSize, fontWeight: selection.fontWeight, lineHeight: selection.lineHeight, letterSpacing: selection.letterSpacing, wordSpacing: selection.wordSpacing, textTransform: selection.textTransform, isBold: Number(selection.fontWeight) >= 700, isItalic: selection.fontStyle === 'italic', isUnderline: selection.textDecoration.includes('underline'), isStrike: selection.textDecoration.includes('line-through'), textAlign: selection.textAlign, color: selection.color, background: selection.background, width: selection.width, height: selection.height, display: selection.display, flexDirection: selection.flexDirection, justifyContent: selection.justifyContent, alignItems: selection.alignItems, gap: selection.gap, padding: selection.paddingTop, radius: selection.borderRadiusTL, overflow: selection.overflow, opacity: selection.opacity, isHidden: selection.display === 'none', mixBlendMode: selection.mixBlendMode, zIndex: selection.zIndex, fontOptions: fontOptions, selectionCount: selections.length, isTextLayer: currentSelectionRef.current ? isTextVisualLayer(currentSelectionRef.current) : false, onSaveLook: ({ name, states }) => {
                    const style = createReusableStyle({ id: `style:look:${Date.now().toString(36)}`, name: `${name} custom`, states });
                    replaceDesignSystem(saveReusableStyle(activeProjectState.designSystem, style), `Saved reusable style: ${style.name}`);
                    showToast(`${style.name} saved to Design System`);
                }, onStyle: (styles, selectionPatch, label) => {
                    applyStyle(styles, selectionPatch, label);
                    previewEncodedStateStyles(styles);
                    const root = getRoot();
                    const target = root ? findElementByPath(root, selection.path) : null;
                    if (target)
                        window.requestAnimationFrame(() => setSelectionRect(target.getBoundingClientRect()));
                }, onAction: (action, value) => {
                    switch (action) {
                        case 'bold':
                            applyStyle({ fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' });
                            break;
                        case 'italic':
                            applyStyle({ fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' }, { fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' });
                            break;
                        case 'underline':
                            applyStyle({ textDecorationLine: selection.textDecoration.includes('underline') ? 'none' : 'underline' }, { textDecoration: selection.textDecoration.includes('underline') ? 'none' : 'underline' });
                            break;
                        case 'strike':
                            applyStyle({ textDecorationLine: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' }, { textDecoration: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' });
                            break;
                        case 'align-left':
                            applyStyle({ textAlign: 'left' }, { textAlign: 'left' });
                            break;
                        case 'align-center':
                            applyStyle({ textAlign: 'center' }, { textAlign: 'center' });
                            break;
                        case 'align-right':
                            applyStyle({ textAlign: 'right' }, { textAlign: 'right' });
                            break;
                        case 'align-justify':
                            applyStyle({ textAlign: 'justify' }, { textAlign: 'justify' });
                            break;
                        case 'color':
                            if (value)
                                applyStyle({ color: value }, { color: value });
                            break;
                        case 'bg-color':
                            if (value)
                                applyStyle({ backgroundColor: value }, { background: value });
                            break;
                        case 'clear-bg':
                            applyStyle({ backgroundColor: 'transparent' }, { background: '#ffffff' }, 'Cleared fill');
                            break;
                        case 'toggle-hidden': {
                            if (selection.display === 'none') {
                                const prior = hiddenPrevDisplayRef.current[selection.path] || '';
                                applyStyle({ display: prior }, { display: prior || 'block' }, 'Show element');
                            }
                            else {
                                hiddenPrevDisplayRef.current[selection.path] = selection.display;
                                applyStyle({ display: 'none' }, { display: 'none' }, 'Hide element');
                                showToast('Hidden — bring it back from the Layers panel');
                            }
                            break;
                        }
                        case 'bring-front':
                            applyStyle({ zIndex: '999' }, { zIndex: 999 }, 'Brought to front');
                            break;
                        case 'send-back':
                            applyStyle({ zIndex: '0' }, { zIndex: 0 }, 'Sent to back');
                            break;
                        case 'image':
                            actionsRef.current.openSelectedImageUpload();
                            break;
                        case 'merge':
                            groupSelected();
                            break;
                        case 'unmerge':
                            ungroupSelected();
                            break;
                        case 'duplicate': {
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (!target || !target.parentElement)
                                break;
                            if (isStructuralLayerElement(target)) {
                                duplicateSection(buildLayerNode(target, root));
                                break;
                            }
                            const clone = target.cloneNode(true);
                            clone.removeAttribute('data-chef-selected');
                            clone.removeAttribute('data-chef-hovered');
                            assignFreshFroamNodeIds(clone);
                            target.parentElement.insertBefore(clone, target.nextSibling);
                            selectInsertedElement(clone);
                            persistLiveRouteSnapshot();
                            showToast('Duplicated');
                            break;
                        }
                        case 'delete':
                            clearSelectionDraft();
                            break;
                        case 'undo':
                            actionsRef.current.undo();
                            break;
                        case 'edit-text': {
                            // Route through the dblclick pipeline so contentEditable setup + blur/text sync stay in one place
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (!target)
                                break;
                            target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                            break;
                        }
                    }
                } })), _jsx(FroamContextMenu, { position: contextMenuPos, elementLabel: selection?.label, isHidden: false, hasClipboard: !!clipboardStyles, hasMultiSelection: selections.length > 1, isGroup: selection?.label?.toLowerCase().includes('group') || false, onAction: (action) => {
                    switch (action) {
                        case 'edit-with-ai': {
                            // Intentional AI entry point: open Quick Chat with the selected element as context
                            setContextMenuPos(null);
                            setQuickChatOpen(true);
                            break;
                        }
                        case 'copy-styles': {
                            const draft = store[viewportStoreKey]?.[selection?.path ?? ''];
                            if (draft?.styles) {
                                setClipboardStyles({ ...draft.styles });
                                showToast('Styles copied');
                            }
                            break;
                        }
                        case 'paste-styles': {
                            if (clipboardStyles && selection) {
                                applyStyle(clipboardStyles, undefined, 'Pasted styles');
                                showToast('Styles pasted');
                            }
                            break;
                        }
                        case 'duplicate': {
                            if (!selection)
                                break;
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (!target || !target.parentElement)
                                break;
                            if (isStructuralLayerElement(target)) {
                                duplicateSection(buildLayerNode(target, root));
                                break;
                            }
                            const clone = target.cloneNode(true);
                            clone.removeAttribute('data-chef-selected');
                            clone.removeAttribute('data-chef-hovered');
                            assignFreshFroamNodeIds(clone);
                            target.parentElement.insertBefore(clone, target.nextSibling);
                            selectInsertedElement(clone);
                            persistLiveRouteSnapshot();
                            showToast('Duplicated');
                            break;
                        }
                        case 'clear':
                            clearSelectionDraft();
                            break;
                        case 'delete-element': {
                            if (!selection)
                                break;
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (target && isStructuralLayerElement(target)) {
                                deleteSection(buildLayerNode(target, root));
                                break;
                            }
                            if (target?.dataset.froamInjected === 'true' && target.parentElement) {
                                target.remove();
                                currentSelectionRef.current = null;
                                setSelection(null);
                                setSelectionRect(null);
                                persistLiveRouteSnapshot();
                                showToast('Element removed');
                            }
                            else {
                                showToast('Only injected elements can be removed');
                            }
                            break;
                        }
                        case 'bring-to-front': {
                            if (selection)
                                applyStyle({ zIndex: '999' }, { zIndex: 999 });
                            break;
                        }
                        case 'send-to-back': {
                            if (selection)
                                applyStyle({ zIndex: '-1' }, { zIndex: -1 });
                            break;
                        }
                        case 'toggle-visibility': {
                            if (!selection)
                                break;
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (target) {
                                const isHidden = window.getComputedStyle(target).display === 'none';
                                applyStyle({ display: isHidden ? '' : 'none' });
                            }
                            break;
                        }
                        case 'wrap-container':
                            actionsRef.current.wrapInContainer();
                            break;
                        case 'upload-image':
                            actionsRef.current.openSelectedImageUpload();
                            break;
                        case 'customize-ui':
                            setUICustomizerOpen(true);
                            break;
                        case 'archive-component':
                            archiveCurrentSelection('component');
                            break;
                        case 'archive-style':
                            archiveCurrentSelection('style');
                            break;
                        case 'archive-motion':
                            archiveCurrentSelection('motion');
                            break;
                        case 'archive-pattern':
                            archiveCurrentSelection('interface-pattern');
                            break;
                    }
                }, onClose: () => setContextMenuPos(null) }), _jsx(FroamUICustomizer, { open: uiCustomizerOpen, value: uiPreference, onChange: setUIPreference, onClose: () => setUICustomizerOpen(false) }), _jsx(FroamSmartGuides, { guides: smartGuides, visible: smartGuides.length > 0 }), _jsx(FroamShortcutOverlay, { visible: showShortcutOverlay, onClose: () => setShowShortcutOverlay(false) })] }), portalContainer);
}
//# sourceMappingURL=GlobalChefEditor.js.map