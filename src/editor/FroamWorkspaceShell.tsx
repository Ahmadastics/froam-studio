import { useEffect, useState } from 'react'
import { Clapperboard, FileImage, Grid2X2, Layers, ListTree, Loader2, MousePointer2, WandSparkles } from 'lucide-react'
import { workspaceStatus, workspaceTemporalSurface, type FroamTemporalOwner, type FroamWorkspaceMode, type FroamWorkspaceSection } from './workspace-shell-model'

/**
 * Where everything lives. The top bar is one row; each side panel carries its
 * own tabs, the way design tools do: what you build with on the left, how the
 * selection looks on the right.
 */
export type PanelTab = { id: FroamWorkspaceSection; mode: FroamWorkspaceMode; label: string; hint: string; icon: typeof MousePointer2 }

export const LEFT_PANEL_TABS: PanelTab[] = [
  { id: 'layers', mode: 'understand', label: 'Layers', hint: 'Everything on this page, as a tree', icon: Layers },
  { id: 'plan', mode: 'create', label: 'Pages', hint: 'The pages of this site', icon: ListTree },
  { id: 'library', mode: 'create', label: 'Library', hint: 'Sections and blocks to drop in', icon: Grid2X2 },
  { id: 'reference', mode: 'understand', label: 'Reference', hint: 'Build from a screenshot', icon: FileImage },
]

export const RIGHT_PANEL_TABS: PanelTab[] = [
  { id: 'design', mode: 'create', label: 'Design', hint: 'How the selection looks', icon: MousePointer2 },
  { id: 'animator', mode: 'create', label: 'Animate', hint: 'Motion and interactions for the selection', icon: WandSparkles },
]

export function FroamPanelTabs({ tabs, active, onSelect, label }: {
  tabs: PanelTab[]
  active: FroamWorkspaceSection | null
  onSelect: (tab: PanelTab) => void
  label: string
}) {
  return (
    <div className="froam-panel-tabs" role="tablist" aria-label={label} data-chef-editor-root="true">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            type="button"
            role="tab"
            key={tab.id}
            aria-selected={active === tab.id}
            className={active === tab.id ? 'is-active' : ''}
            title={tab.hint}
            onClick={() => onSelect(tab)}
            data-chef-editor-root="true"
          >
            <Icon size={14} /><span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  mode: FroamWorkspaceMode
  activeSection: FroamWorkspaceSection
  branchId: string
  branchName: string
  temporalOwner: FroamTemporalOwner
  activity?: 'scanning' | 'screenshot' | 'mutating' | 'chaos' | 'synthetic' | 'intent-understanding' | 'intent-creating' | 'intent-applying' | null
  /** Something is selected — the first-time hint has done its job. */
  hasSelection?: boolean
}

const FIRST_HINT_KEY = 'froam-first-hint-v1'
const readHintSeen = () => { try { return window.localStorage.getItem(FIRST_HINT_KEY) === '1' } catch { return true } }
const writeHintSeen = () => { try { window.localStorage.setItem(FIRST_HINT_KEY, '1') } catch { /* private mode */ } }

/** What Froam is busy with, and which timeline owns time — shown only while it's true. */
export default function FroamWorkspaceShell(props: Props) {
  const status = workspaceStatus({
    mode: props.mode,
    branchName: props.branchName,
    branchId: props.branchId,
    activity: props.activity,
    sampling: props.temporalOwner === 'sampling',
    replay: props.temporalOwner === 'replay',
    physics: props.activeSection === 'physics',
  })
  const temporal = workspaceTemporalSurface(props.temporalOwner)
  const [hintSeen, setHintSeen] = useState(readHintSeen)
  useEffect(() => { if (props.hasSelection && !hintSeen) { writeHintSeen(); setHintSeen(true) } }, [props.hasSelection, hintSeen])

  return <>
    {!hintSeen && !props.activity && !props.hasSelection && (
      <div className="froam-first-hint" role="status" data-chef-editor-root="true">
        <MousePointer2 size={14} />
        <span>Click anything on the page to edit it</span>
        <kbd>Ctrl K</kbd>
        <span className="froam-first-hint__more">for everything else</span>
        <button type="button" onClick={() => { writeHintSeen(); setHintSeen(true) }}>Got it</button>
      </div>
    )}
    {props.activity && (
      <output className={`froam-activity is-${status.tone}`} aria-live="polite" data-chef-editor-root="true">
        <Loader2 size={13} className="froam-activity__spin" />{status.label.replace(/\s*[☣●]\s*$/u, '')}
      </output>
    )}
    {temporal && <section className="froam-temporal-dock" data-chef-editor-root="true" aria-label="Active timeline"><Clapperboard size={14}/><b>{temporal.label}</b><span>This timeline owns playback until you close it.</span></section>}
  </>
}
