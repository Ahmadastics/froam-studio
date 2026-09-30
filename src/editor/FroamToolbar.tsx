import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  Check,
  ChevronDown,
  Command,
  LayoutGrid,
  Bookmark,
  GitBranch,
  Hand,
  History,
  Keyboard,
  LogOut,
  Minimize2,
  Monitor,
  MousePointer2,
  Move,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Tablet,
  Type,
  Undo2,
  UserRound,
  X,
} from 'lucide-react'
import type { FroamPersona } from './froamPersona'
import { relativeTime } from './chef/change-report'

type ViewportMode = 'desktop' | 'tablet' | 'mobile'
type ToolMode = 'pointer' | 'hand' | 'text' | 'frame' | 'shape' | 'move'

type Props = {
  workspace?: ReactNode
  /** Share / Submit — the collaboration control (collaborate/FroamCollaborate). */
  collaborate?: ReactNode
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
  onAskFroam: () => void
  onCommandPalette: () => void
  onShortcutsOverlay: () => void
  onCustomize?: () => void
  routeKey: string
  projectName?: string
  /** The prototype being edited, when it isn't the main line. */
  prototypeName?: string | null
  onOpenPages?: () => void
  /** Sections and blocks to drop in — one click from anywhere. */
  onOpenLibrary?: () => void
  libraryOpen?: boolean
  onOpenPrototypes?: () => void
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
  /** Changes on this page not saved yet (0: everything's saved). */
  unsavedCount?: number
  autosave?: boolean
  onToggleAutosave?: () => void
  /** What happened on this page, newest first — each can be undone on its own. */
  history?: HistoryItem[]
  onUndoChange?: (id: string) => void
  /** Named moments on this page (versions), in the same timeline as the changes. */
  versions?: TimelineVersion[]
  onHistoryOpen?: () => void
  onNameMoment?: (name: string) => void | Promise<void>
  onRestoreVersion?: (id: string, name: string) => void
  onOpenAllVersions?: () => void
}

export type TimelineVersion = { id: string; name: string; ts: number; local: boolean }

export type HistoryItem = { id: string; label: string; where: string; who: string; ts: number; isUndo: boolean }

/** "Home", "Pricing", "Blog / First post" — a route, as a person says it. */
export function pageName(routeKey: string) {
  const path = routeKey.split(/[?#]/)[0].replace(/\/+$/, '')
  if (!path || path === '/') return 'Home'
  return path.split('/').filter(Boolean).map((part) => {
    const words = decodeURIComponent(part).replace(/[-_]+/g, ' ').trim()
    return words ? words[0].toUpperCase() + words.slice(1) : part
  }).join(' / ')
}

/** Close a menu on Escape or a press outside it. */
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
    const onDown = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close() }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, close, ref])
}

function FroamMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="froam-tb__mark-glyph">
      <path fill="currentColor" d="M7.2 21V3h10.6v3.3h-6.9v4.3h6.2v3.3h-6.2V21Z" />
    </svg>
  )
}

type MenuItem = { id: string; label: string; icon: ReactNode; shortcut?: string; onSelect: () => void; tone?: 'danger'; checked?: boolean } | 'divider'

function Menu({ items, onDone, align = 'start', label }: { items: MenuItem[]; onDone: () => void; align?: 'start' | 'end'; label: string }) {
  return (
    <div className={`froam-tb__menu is-${align}`} role="menu" aria-label={label} data-chef-editor-root="true">
      {items.map((item, index) => item === 'divider'
        ? <div key={`divider-${index}`} className="froam-tb__menu-divider" role="separator" />
        : (
          <button
            key={item.id}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            className={`froam-tb__menu-item${item.tone === 'danger' ? ' is-danger' : ''}`}
            onClick={() => { onDone(); item.onSelect() }}
            data-chef-editor-root="true"
          >
            {item.icon}
            <span>{item.label}</span>
            {item.checked !== undefined && <span className={`froam-tb__menu-check${item.checked ? ' is-on' : ''}`} aria-hidden="true">{item.checked && <Check size={13} />}</span>}
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        ))}
    </div>
  )
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

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function FroamToolbar({
  workspace,
  collaborate,
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
  onAskFroam,
  onCommandPalette,
  onShortcutsOverlay,
  onCustomize,
  routeKey,
  projectName,
  prototypeName,
  onOpenPages,
  onOpenLibrary,
  libraryOpen = false,
  onOpenPrototypes,
  persona,
  onOpenPersonaEditor,
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
  unsavedCount = 0,
  autosave = false,
  onToggleAutosave,
  history = [],
  onUndoChange,
  versions = [],
  onHistoryOpen,
  onNameMoment,
  onRestoreVersion,
  onOpenAllVersions,
}: Props) {
  const [naming, setNaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<'main' | 'zoom' | 'history' | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(savedTimer.current), [])
  const save = () => {
    onSave()
    setJustSaved(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 1600)
  }
  const mainRef = useRef<HTMLDivElement | null>(null)
  const zoomRef = useRef<HTMLDivElement | null>(null)
  const closeMenu = useRef(() => setMenu(null)).current
  useDismiss(mainRef, menu === 'main', closeMenu)
  useDismiss(zoomRef, menu === 'zoom', closeMenu)
  useDismiss(historyRef, menu === 'history', closeMenu)

  const page = pageName(routeKey)
  const repoDirty = repoStatus === 'dirty'
  const zoomTo = (value: number) => setZoom(Math.min(3, Math.max(0.2, Math.round(value * 100) / 100)))

  const mainItems: MenuItem[] = [
    { id: 'commands', label: 'Search commands', icon: <Command size={14} />, shortcut: 'Ctrl K', onSelect: onCommandPalette },
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard size={14} />, shortcut: '?', onSelect: onShortcutsOverlay },
    ...(onCustomize ? [{ id: 'customize', label: 'Customize the editor', icon: <SlidersHorizontal size={14} />, onSelect: onCustomize }] : []),
    { id: 'profile', label: 'Your profile', icon: <UserRound size={14} />, onSelect: onOpenPersonaEditor },
    ...(onToggleAutosave ? [{ id: 'autosave', label: 'Save automatically', icon: <Save size={14} />, onSelect: onToggleAutosave, checked: autosave }] : []),
    'divider',
    { id: 'minimize', label: 'Minimize', icon: <Minimize2 size={14} />, shortcut: 'Ctrl .', onSelect: onMinimize },
    { id: 'exit', label: 'Exit editing', icon: <LogOut size={14} />, onSelect: onClose, tone: 'danger' },
  ]

  return (
    <header className="froam-chrome" data-chef-editor-root="true">
    <div className="froam-tb" data-chef-editor-root="true">
      {/* Left: menu, pages panel, where you are */}
      <div className="froam-tb__left" data-chef-editor-root="true">
        <div className="froam-tb__menu-anchor" ref={mainRef}>
          <button
            type="button"
            className={`froam-tb__brand froam-tb__brand-btn${menu === 'main' ? ' is-open' : ''}`}
            onClick={() => setMenu((current) => (current === 'main' ? null : 'main'))}
            title="Froam menu"
            aria-label="Froam menu"
            aria-haspopup="menu"
            aria-expanded={menu === 'main'}
            data-chef-editor-root="true"
          >
            <span className="froam-tb__mark" aria-hidden="true"><FroamMark /></span>
            <ChevronDown size={12} className="froam-tb__caret" />
          </button>
          {menu === 'main' && <Menu items={mainItems} onDone={closeMenu} label="Froam menu" />}
        </div>

        <button
          type="button"
          className={`froam-tb__icon-btn ${leftPanelOpen ? 'is-active' : ''}`}
          onClick={onToggleLeftPanel}
          title={leftPanelOpen ? 'Hide layers and pages' : 'Show layers and pages'}
          aria-label={leftPanelOpen ? 'Hide pages and layers panel' : 'Show pages and layers panel'}
          aria-pressed={leftPanelOpen}
          data-chef-editor-root="true"
        >
          <PanelLeft size={16} />
        </button>

        <div className="froam-tb__where froam-tb__desktop-only" data-chef-editor-root="true">
          <button type="button" className="froam-tb__crumb" onClick={onOpenPages} title="Pages in this project" data-chef-editor-root="true">
            {projectName && <><span className="froam-tb__crumb-project">{projectName}</span><span className="froam-tb__crumb-sep" aria-hidden="true">/</span></>}
            <strong>{page}</strong>
          </button>
          {prototypeName && (
            <button type="button" className="froam-tb__prototype" onClick={onOpenPrototypes} title="You are editing a prototype — open prototypes" data-chef-editor-root="true">
              {prototypeName}
            </button>
          )}
        </div>
        <span className="froam-tb__route">{page}</span>

        <button type="button" className="froam-tb__icon-btn froam-tb__mobile-command" onClick={onCommandPalette} title="Quick Edit or run a command" aria-label="Quick Edit or run a command" data-chef-editor-root="true">
          <Command size={16} />
        </button>
      </div>

      {/* Center: tools */}
      <div className="froam-tb__center" data-chef-editor-root="true">
        <div className="froam-tb__tool-group" role="toolbar" aria-label="Tools">
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
            icon={<Plus size={16} />}
            label="Frame"
            shortcut="F"
            isActive={activeTool === 'frame'}
            onClick={() => onToolChange('frame')}
          />
          <ToolButton
            icon={<Square size={16} />}
            label="Rectangle"
            shortcut="R"
            isActive={activeTool === 'shape'}
            onClick={() => onToolChange('shape')}
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
          {onOpenLibrary && (
            <>
              <span className="froam-tb__tool-sep" aria-hidden="true" />
              <button
                type="button"
                className={`froam-tb__tool ${libraryOpen ? 'is-open' : ''}`}
                onClick={onOpenLibrary}
                title="Library — sections and blocks to drop in"
                aria-label="Library"
                aria-pressed={libraryOpen}
                data-chef-editor-root="true"
              >
                <LayoutGrid size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right: view, history, people, save */}
      <div className="froam-tb__right" data-chef-editor-root="true">
        {/* Viewport switcher — pointless on an actual phone */}
        <div className="froam-tb__viewport-group froam-tb__desktop-only" role="group" aria-label="Screen size">
          <button
            type="button"
            className={`froam-tb__vp-btn ${viewportMode === 'desktop' ? 'is-active' : ''}`}
            onClick={() => onViewportChange('desktop')}
            title="Desktop"
            aria-label="Desktop"
            aria-pressed={viewportMode === 'desktop'}
            data-chef-editor-root="true"
          >
            <Monitor size={15} />
          </button>
          <button
            type="button"
            className={`froam-tb__vp-btn ${viewportMode === 'tablet' ? 'is-active' : ''}`}
            onClick={() => onViewportChange('tablet')}
            title="Tablet (768px)"
            aria-label="Tablet"
            aria-pressed={viewportMode === 'tablet'}
            data-chef-editor-root="true"
          >
            <Tablet size={15} />
          </button>
          <button
            type="button"
            className={`froam-tb__vp-btn ${viewportMode === 'mobile' ? 'is-active' : ''}`}
            onClick={() => onViewportChange('mobile')}
            title="Mobile (375px)"
            aria-label="Mobile"
            aria-pressed={viewportMode === 'mobile'}
            data-chef-editor-root="true"
          >
            <Smartphone size={15} />
          </button>
        </div>

        <div className="froam-tb__menu-anchor froam-tb__zoom-group froam-tb__desktop-only" ref={zoomRef} data-chef-editor-root="true">
          <button
            type="button"
            className={`froam-tb__zoom-btn${menu === 'zoom' ? ' is-open' : ''}`}
            onClick={() => setMenu((current) => (current === 'zoom' ? null : 'zoom'))}
            title="Zoom"
            aria-label={`Zoom ${Math.round(zoom * 100)}%`}
            aria-haspopup="menu"
            aria-expanded={menu === 'zoom'}
            data-chef-editor-root="true"
          >
            <span className="froam-tb__zoom-label">{Math.round(zoom * 100)}%</span>
            <ChevronDown size={12} />
          </button>
          {menu === 'zoom' && (
            <div className="froam-tb__menu is-end" role="menu" aria-label="Zoom" data-chef-editor-root="true">
              <button type="button" role="menuitem" className="froam-tb__menu-item" onClick={() => zoomTo(zoom + 0.1)}><Plus size={14} /><span>Zoom in</span></button>
              <button type="button" role="menuitem" className="froam-tb__menu-item" onClick={() => zoomTo(zoom - 0.1)}><span className="froam-tb__menu-minus" aria-hidden="true">−</span><span>Zoom out</span></button>
              <div className="froam-tb__menu-divider" role="separator" />
              {ZOOM_STEPS.map((step) => (
                <button key={step} type="button" role="menuitemradio" aria-checked={Math.abs(zoom - step) < 0.005} className="froam-tb__menu-item" onClick={() => { zoomTo(step); closeMenu() }}>
                  {Math.abs(zoom - step) < 0.005 ? <Check size={14} /> : <span className="froam-tb__menu-spacer" />}
                  <span>{Math.round(step * 100)}%</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="froam-tb__history" role="group" aria-label="History">
          <button type="button" className="froam-tb__icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" data-chef-editor-root="true">
            <Undo2 size={16} />
          </button>
          <button type="button" className="froam-tb__icon-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo" data-chef-editor-root="true">
            <Redo2 size={16} />
          </button>
          <div className="froam-tb__menu-anchor" ref={historyRef}>
            <button
              type="button"
              className={`froam-tb__icon-btn${menu === 'history' ? ' is-active' : ''}`}
              onClick={() => setMenu((current) => {
                const next = current === 'history' ? null : 'history'
                if (next) onHistoryOpen?.()
                else setNaming(null)
                return next
              })}
              title="History — every change on this page, and the moments you named"
              aria-label="History"
              aria-haspopup="dialog"
              aria-expanded={menu === 'history'}
              data-chef-editor-root="true"
            >
              <History size={16} />
            </button>
            {menu === 'history' && (
              <div className="froam-tb__menu froam-tb__history-pop is-end" role="dialog" aria-label="History" data-chef-editor-root="true">
                <div className="froam-tb__history-head">
                  <strong>History</strong>
                  <small>{history.length ? `${history.length} change${history.length === 1 ? '' : 's'} on this page` : 'On this page'}</small>
                </div>
                {prototypeName && (
                  <div className="froam-tb__history-proto">
                    <GitBranch size={13} />
                    <span>You're on the prototype <strong>{prototypeName}</strong>. Its changes stay on it.</span>
                    <button type="button" onClick={() => { closeMenu(); onOpenPrototypes?.() }}>Prototypes</button>
                  </div>
                )}
                {onNameMoment && (naming === null ? (
                  <button type="button" className="froam-tb__history-name" onClick={() => setNaming('')}>
                    <Bookmark size={13} /> Name this moment
                    <small>so you can come back to it</small>
                  </button>
                ) : (
                  <form
                    className="froam-tb__history-naming"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = (naming ?? '').trim()
                      if (!name) return
                      void onNameMoment(name)
                      setNaming(null)
                    }}
                  >
                    <input autoFocus value={naming} onChange={(event) => setNaming(event.target.value)} placeholder="e.g. Before the launch" aria-label="Name for this moment" maxLength={80} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setNaming(null) } }} />
                    <button type="submit" disabled={!naming?.trim()}>Keep</button>
                  </form>
                ))}
                {history.length === 0 && versions.length === 0 ? (
                  <p className="froam-tb__history-empty">Nothing has changed on this page yet. Every edit shows up here, and each one can be undone on its own.</p>
                ) : (
                  <ol className="froam-tb__history-list">
                    {[
                      ...history.map((item) => ({ kind: 'change' as const, ts: item.ts, item })),
                      ...versions.map((version) => ({ kind: 'version' as const, ts: version.ts, version })),
                    ].sort((a, b) => b.ts - a.ts).map((entry) => entry.kind === 'change' ? (
                      <li key={entry.item.id} className={entry.item.isUndo ? 'is-undo' : ''}>
                        <span>
                          <strong>{entry.item.label}{entry.item.where && <em> · {entry.item.where}</em>}</strong>
                          <small>{entry.item.who} · {relativeTime(entry.item.ts)}</small>
                        </span>
                        {!entry.item.isUndo && onUndoChange && (
                          <button type="button" onClick={() => onUndoChange(entry.item.id)} title="Put this back as it was — later changes stay">Undo</button>
                        )}
                      </li>
                    ) : (
                      <li key={entry.version.id} className="is-version">
                        <Bookmark size={13} aria-hidden="true" />
                        <span>
                          <strong>{entry.version.name}</strong>
                          <small>{entry.version.local ? 'Kept in this browser' : 'Version'} · {relativeTime(entry.version.ts)}</small>
                        </span>
                        {onRestoreVersion && (
                          <button type="button" onClick={() => { closeMenu(); onRestoreVersion(entry.version.id, entry.version.name) }} title="Put the page back the way it was here — you can undo this">Restore</button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {onOpenAllVersions && (
                  <button type="button" className="froam-tb__history-foot" onClick={() => { closeMenu(); onOpenAllVersions() }}>
                    Tags, notes, compare and going live — all versions
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="froam-tb__sep" />

        {collaborate}


        <button type="button" className="froam-tb__ask-btn" onClick={onAskFroam} title="Quick Edit — say what to change" data-chef-editor-root="true">
          <Sparkles size={15} />
          <span>Quick Edit</span>
        </button>

        <div className="froam-tb__save" role="group" aria-label="Save">
          <button
            type="button"
            className={`froam-tb__save-btn${justSaved ? ' is-saved' : ''}${!justSaved && unsavedCount === 0 ? ' is-clean' : ''}`}
            onClick={save}
            aria-label="Save draft (Ctrl+S)"
            title={unsavedCount ? `Save (Ctrl+S) — ${unsavedCount} change${unsavedCount === 1 ? '' : 's'} not saved yet` : 'Everything is saved (Ctrl+S)'}
            data-chef-editor-root="true"
          >
            {justSaved || unsavedCount === 0 ? <Check size={15} /> : <Save size={15} />}
            <span>{justSaved || unsavedCount === 0 ? 'Saved' : 'Save'}</span>
            {!justSaved && unsavedCount > 0 && <i className="froam-tb__unsaved" aria-label={`${unsavedCount} unsaved`}>{unsavedCount > 99 ? '99+' : unsavedCount}</i>}
          </button>
          {/* Save to Repo — writes git-ready files via the dev bridge */}
          {onSaveRepo && (
            <button
              type="button"
              className={`froam-tb__save-btn froam-tb__save-btn--repo${repoDirty ? ' is-dirty' : ''}`}
              onClick={onSaveRepo}
              aria-label="Save to Repo, git-ready (Ctrl+Shift+S)"
              title={repoDirty
                ? `Save to your code (Ctrl+Shift+S) — ${repoDirtyCount ?? ''} change${repoDirtyCount === 1 ? '' : 's'} not committed yet`
                : repoStatus === 'clean' ? 'Save to your code (Ctrl+Shift+S) — in sync with git' : 'Save to your code, git-ready (Ctrl+Shift+S)'}
              data-chef-editor-root="true"
            >
              <GitBranch size={15} />
              {repoDirty && <i className="froam-tb__save-dot" aria-hidden="true" />}
            </button>
          )}
        </div>

        <div className="froam-tb__sep" />

        <div className="froam-tb__panel-controls" data-chef-editor-root="true">
          <button
            type="button"
            className={`froam-tb__icon-btn ${rightPanelOpen ? 'is-active' : ''}`}
            onClick={onToggleRightPanel}
            title={rightPanelOpen ? 'Hide design panel' : 'Show design panel'}
            aria-label={rightPanelOpen ? 'Hide design controls panel' : 'Show design controls panel'}
            aria-pressed={rightPanelOpen}
            data-chef-editor-root="true"
          >
            <PanelRight size={16} />
          </button>
          <button
            type="button"
            className="froam-tb__icon-btn froam-tb__minimize-btn"
            onClick={onMinimize}
            title="Minimize (Ctrl+.) — keep editing with the page in full view"
            aria-label={`Minimize ${persona.name} and keep editing`}
            data-chef-editor-root="true"
          >
            <Minimize2 size={15} />
          </button>
          <button
            type="button"
            className="froam-tb__icon-btn froam-tb__close-btn"
            onClick={onClose}
            title="Exit editing"
            aria-label={`Exit ${persona.name} editing`}
            data-chef-editor-root="true"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
    {workspace}
    </header>
  )
}

export type { ToolMode }
