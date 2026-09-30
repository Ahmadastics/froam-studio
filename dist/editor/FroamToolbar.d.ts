import { type ReactNode } from 'react';
import type { FroamPersona } from './froamPersona';
type ViewportMode = 'desktop' | 'tablet' | 'mobile';
type ToolMode = 'pointer' | 'hand' | 'text' | 'frame' | 'shape' | 'move';
type Props = {
    workspace?: ReactNode;
    /** Share / Submit — the collaboration control (collaborate/FroamCollaborate). */
    collaborate?: ReactNode;
    viewportMode: ViewportMode;
    onViewportChange: (mode: ViewportMode) => void;
    activeTool: ToolMode;
    onToolChange: (tool: ToolMode) => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
    onSaveRepo?: () => void;
    repoStatus?: 'clean' | 'dirty' | 'offline' | null;
    repoDirtyCount?: number;
    onAskFroam: () => void;
    onCommandPalette: () => void;
    onShortcutsOverlay: () => void;
    onCustomize?: () => void;
    routeKey: string;
    projectName?: string;
    /** The prototype being edited, when it isn't the main line. */
    prototypeName?: string | null;
    onOpenPages?: () => void;
    /** Sections and blocks to drop in — one click from anywhere. */
    onOpenLibrary?: () => void;
    libraryOpen?: boolean;
    onOpenPrototypes?: () => void;
    persona: FroamPersona;
    onOpenPersonaEditor: () => void;
    draftCount: number;
    moveMode: boolean;
    onToggleMoveMode: () => void;
    zoom: number;
    setZoom: (z: number) => void;
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    onToggleLeftPanel: () => void;
    onToggleRightPanel: () => void;
    onMinimize: () => void;
    onClose: () => void;
    /** Changes on this page not saved yet (0: everything's saved). */
    unsavedCount?: number;
    autosave?: boolean;
    onToggleAutosave?: () => void;
    /** What happened on this page, newest first — each can be undone on its own. */
    history?: HistoryItem[];
    onUndoChange?: (id: string) => void;
    /** Named moments on this page (versions), in the same timeline as the changes. */
    versions?: TimelineVersion[];
    onHistoryOpen?: () => void;
    onNameMoment?: (name: string) => void | Promise<void>;
    onRestoreVersion?: (id: string, name: string) => void;
    onOpenAllVersions?: () => void;
};
export type TimelineVersion = {
    id: string;
    name: string;
    ts: number;
    local: boolean;
};
export type HistoryItem = {
    id: string;
    label: string;
    where: string;
    who: string;
    ts: number;
    isUndo: boolean;
};
/** "Home", "Pricing", "Blog / First post" — a route, as a person says it. */
export declare function pageName(routeKey: string): string;
export default function FroamToolbar({ workspace, collaborate, viewportMode, onViewportChange, activeTool, onToolChange, canUndo, canRedo, onUndo, onRedo, onSave, onSaveRepo, repoStatus, repoDirtyCount, onAskFroam, onCommandPalette, onShortcutsOverlay, onCustomize, routeKey, projectName, prototypeName, onOpenPages, onOpenLibrary, libraryOpen, onOpenPrototypes, persona, onOpenPersonaEditor, moveMode, onToggleMoveMode, zoom, setZoom, leftPanelOpen, rightPanelOpen, onToggleLeftPanel, onToggleRightPanel, onMinimize, onClose, unsavedCount, autosave, onToggleAutosave, history, onUndoChange, versions, onHistoryOpen, onNameMoment, onRestoreVersion, onOpenAllVersions, }: Props): import("react").JSX.Element;
export type { ToolMode };
//# sourceMappingURL=FroamToolbar.d.ts.map