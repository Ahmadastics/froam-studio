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
};
/** "Home", "Pricing", "Blog / First post" — a route, as a person says it. */
export declare function pageName(routeKey: string): string;
export default function FroamToolbar({ workspace, collaborate, viewportMode, onViewportChange, activeTool, onToolChange, canUndo, canRedo, onUndo, onRedo, onSave, onSaveRepo, repoStatus, repoDirtyCount, onAskFroam, onCommandPalette, onShortcutsOverlay, onCustomize, routeKey, projectName, prototypeName, onOpenPages, onOpenLibrary, libraryOpen, onOpenPrototypes, persona, onOpenPersonaEditor, moveMode, onToggleMoveMode, zoom, setZoom, leftPanelOpen, rightPanelOpen, onToggleLeftPanel, onToggleRightPanel, onMinimize, onClose, }: Props): import("react").JSX.Element;
export type { ToolMode };
//# sourceMappingURL=FroamToolbar.d.ts.map