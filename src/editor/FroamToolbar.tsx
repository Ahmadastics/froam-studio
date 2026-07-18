import { type ReactNode } from 'react'
import {
  Command,
  GitBranch,
  Hand,
  Moon,
  Keyboard,
  Minus,
  Minimize2,
  Monitor,
  MousePointer2,
  Move,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Square,
  Sun,
  Tablet,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import {
  getFroamPersonaInitials,
  type FroamPersona,
} from './froamPersona'

type ViewportMode = 'desktop' | 'tablet' | 'mobile'
type ToolMode = 'pointer' | 'hand' | 'text' | 'frame' | 'shape' | 'move'

type Props = {
  viewportMode: ViewportMode
  onViewportChange: (mode: ViewportMode) => void
  activeTool: ToolMode
  onToolChange: (tool: ToolMode) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onSaveRepo?: () => void
  repoStatus?: 'clean' | 'dirty' | 'offline' | null
  repoDirtyCount?: number
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
  onCommandPalette: () => void
  onShortcutsOverlay: () => void
  routeKey: string
  persona: FroamPersona
  onOpenPersonaEditor: () => void
  draftCount: number
  moveMode: boolean
  onToggleMoveMode: () => void
  zoom: number
  setZoom: (z: number) => void
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onMinimize: () => void
  onClose: () => void
}

function ToolButton({
  icon,
  label,
  shortcut,
  isActive,
  onClick,
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`froam-tb__tool ${isActive ? 'is-active' : ''}`}
      onClick={onClick}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      aria-label={label}
      aria-pressed={isActive}
      data-chef-editor-root="true"
    >
      {icon}
    </button>
  )
}

export default function FroamToolbar({
  viewportMode,
  onViewportChange,
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onSaveRepo,
  repoStatus,
  repoDirtyCount,
  theme,
  onToggleTheme,
  onCommandPalette,
  onShortcutsOverlay,
  routeKey,
  persona,
  onOpenPersonaEditor,
  draftCount,
  moveMode,
  onToggleMoveMode,
  zoom,
  setZoom,
  leftPanelOpen,
  rightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
  onMinimize,
  onClose,
}: Props) {
  return (
    <div className="froam-tb" data-chef-editor-root="true">
      {/* Left: Brand */}
      <div className="froam-tb__left" data-chef-editor-root="true">
        <button
          type="button"
          className="froam-tb__brand froam-tb__brand-btn"
          onClick={onOpenPersonaEditor}
          title="Edit studio profile"
          data-chef-editor-root="true"
        >
          <span className="froam-tb__avatar" aria-hidden="true">
            {persona.imageUrl ? (
              <img src={persona.imageUrl} alt="" />
            ) : (
              <span>{getFroamPersonaInitials(persona.name)}</span>
            )}
          </span>
          <span className="froam-tb__logo">{persona.name}</span>
        </button>
        <div className="froam-tb__sep" />
        <span className="froam-tb__route froam-tb__desktop-only">{routeKey}</span>
      </div>

      {/* Center: Tools */}
      <div className="froam-tb__center" data-chef-editor-root="true">
        <div className="froam-tb__tool-group">
          <ToolButton
            icon={<MousePointer2 size={16} />}
            label="Select"
            shortcut="V"
            isActive={activeTool === 'pointer' && !moveMode}
            onClick={() => onToolChange('pointer')}
          />
          <ToolButton
            icon={<Move size={16} />}
            label="Move"
            shortcut="Ctrl+Shift+L"
            isActive={moveMode}
            onClick={onToggleMoveMode}
          />
          <ToolButton
            icon={<Square size={16} />}
            label="Rectangle"
            shortcut="R"
            isActive={activeTool === 'shape'}
            onClick={() => onToolChange('shape')}
          />
          <ToolButton
            icon={<Plus size={16} />}
            label="Frame"
            shortcut="F"
            isActive={activeTool === 'frame'}
            onClick={() => onToolChange('frame')}
          />
          <ToolButton
            icon={<Type size={16} />}
            label="Text"
            shortcut="T"
            isActive={activeTool === 'text'}
            onClick={() => onToolChange('text')}
          />
          <ToolButton
            icon={<Hand size={16} />}
            label="Hand"
            shortcut="H"
            isActive={activeTool === 'hand'}
            onClick={() => onToolChange('hand')}
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="froam-tb__right" data-chef-editor-root="true">
        <div className="froam-tb__panel-controls" data-chef-editor-root="true">
          <button
            type="button"
            className={`froam-tb__icon-btn ${leftPanelOpen ? 'is-active' : ''}`}
            onClick={onToggleLeftPanel}
            title={leftPanelOpen ? 'Hide pages and layers' : 'Show pages and layers'}
            aria-label={leftPanelOpen ? 'Hide pages and layers panel' : 'Show pages and layers panel'}
            aria-pressed={leftPanelOpen}
            data-chef-editor-root="true"
          >
            <PanelLeft size={15} />
          </button>
          <button
            type="button"
            className={`froam-tb__icon-btn ${rightPanelOpen ? 'is-active' : ''}`}
            onClick={onToggleRightPanel}
            title={rightPanelOpen ? 'Hide design controls' : 'Show design controls'}
            aria-label={rightPanelOpen ? 'Hide design controls panel' : 'Show design controls panel'}
            aria-pressed={rightPanelOpen}
            data-chef-editor-root="true"
          >
            <PanelRight size={15} />
          </button>
          <button
            type="button"
            className="froam-tb__icon-btn froam-tb__minimize-btn"
            onClick={onMinimize}
            title={`Minimize ${persona.name} and keep editing`}
            aria-label={`Minimize ${persona.name} and keep editing`}
            data-chef-editor-root="true"
          >
            <Minimize2 size={15} />
          </button>
          <button
            type="button"
            className="froam-tb__icon-btn froam-tb__close-btn"
            onClick={onClose}
            title={`Exit ${persona.name}`}
            aria-label={`Exit ${persona.name} editing`}
            data-chef-editor-root="true"
          >
            <X size={15} />
          </button>
        </div>

        <div className="froam-tb__sep" />

        {/* Viewport switcher — pointless on an actual phone */}
        <div className="froam-tb__viewport-group froam-tb__desktop-only">
          <button
            type="button"
            className={`froam-tb__vp-btn ${viewportMode === 'desktop' ? 'is-active' : ''}`}
            onClick={() => onViewportChange('desktop')}
            title="Desktop"
            data-chef-editor-root="true"
          >
            <Monitor size={14} />
          </button>
          <button
            type="button"
            className={`froam-tb__vp-btn ${viewportMode === 'tablet' ? 'is-active' : ''}`}
            onClick={() => onViewportChange('tablet')}
            title="Tablet (768px)"
            data-chef-editor-root="true"
          >
            <Tablet size={14} />
          </button>
          <button
            type="button"
            className={`froam-tb__vp-btn ${viewportMode === 'mobile' ? 'is-active' : ''}`}
            onClick={() => onViewportChange('mobile')}
            title="Mobile (375px)"
            data-chef-editor-root="true"
          >
            <Smartphone size={14} />
          </button>
        </div>

        <div className="froam-tb__sep" />

        {/* Zoom */}
        <div className="froam-tb__zoom-group froam-tb__desktop-only" data-chef-editor-root="true">
          <button type="button" className="froam-tb__icon-btn" onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} title="Zoom out" data-chef-editor-root="true">
            <Minus size={13} />
          </button>
          <span className="froam-tb__zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="froam-tb__icon-btn" onClick={() => setZoom(Math.min(3, zoom + 0.1))} title="Zoom in" data-chef-editor-root="true">
            <Plus size={13} />
          </button>
        </div>

        <div className="froam-tb__sep" />

        {/* Undo/Redo */}
        <button type="button" className="froam-tb__icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" data-chef-editor-root="true">
          <Undo2 size={15} />
        </button>
        <button type="button" className="froam-tb__icon-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" data-chef-editor-root="true">
          <Redo2 size={15} />
        </button>

        <div className="froam-tb__sep" />

        <button type="button" className="froam-tb__icon-btn" onClick={onCommandPalette} title="Command palette (Ctrl+K)" data-chef-editor-root="true">
          <Command size={14} />
        </button>
        <button type="button" className="froam-tb__icon-btn froam-tb__desktop-only" onClick={onShortcutsOverlay} title="Keyboard shortcuts (?)" data-chef-editor-root="true">
          <Keyboard size={14} />
        </button>

        {/* Save */}
        <button type="button" className="froam-tb__save-btn" onClick={onSave} aria-label="Save draft (Ctrl+S)" title="Save draft (Ctrl+S)" data-chef-editor-root="true">
          <Save size={14} />
          <span>Save</span>
        </button>

        {/* Save to Repo — writes git-ready files via the dev bridge */}
        {onSaveRepo && (
          <button type="button" className="froam-tb__save-btn froam-tb__save-btn--repo" onClick={onSaveRepo} aria-label="Save to Repo, git-ready (Ctrl+Shift+S)" title="Save to Repo — git-ready files (Ctrl+Shift+S)" data-chef-editor-root="true">
            <GitBranch size={14} />
            <span>Repo</span>
          </button>
        )}

        {/* Git status chip — reflects the repo bridge's dirty/clean state */}
        {repoStatus && repoStatus !== 'offline' && (
          <span
            className={`froam-tb__git-chip froam-tb__git-chip--${repoStatus}`}
            title={repoStatus === 'dirty' ? `${repoDirtyCount ?? ''} uncommitted froam change${repoDirtyCount === 1 ? '' : 's'} — commit & push to ship` : 'Froam files committed — in sync with git'}
            aria-label={repoStatus === 'dirty' ? 'Repo has uncommitted changes' : 'Repo clean'}
            data-chef-editor-root="true"
          >
            <span className="froam-tb__git-dot" />
            {repoStatus === 'dirty' ? `${repoDirtyCount ?? ''} unsaved` : 'in sync'}
          </span>
        )}

        {/* Theme flip — only Froam can preview both themes on the real app */}
        {onToggleTheme && (
          <button type="button" className="froam-tb__icon-btn" onClick={onToggleTheme} title={`Preview ${theme === 'light' ? 'dark' : 'light'} theme`} aria-label="Toggle theme preview" data-chef-editor-root="true">
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        )}

        {/* Draft count */}
        <span className="froam-tb__draft-count">{draftCount}</span>
      </div>
    </div>
  )
}

export type { ToolMode }
