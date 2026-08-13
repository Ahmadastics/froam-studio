import { Boxes, Clapperboard, FileImage, GitBranch, Layers, MoreHorizontal, MousePointer2, Sparkles, WandSparkles } from 'lucide-react'
import type { FroamLabsFlags } from '../project/experiments'
import { workspaceProjectLabel, workspaceStatus, workspaceTemporalSurface, type FroamTemporalOwner, type FroamWorkspaceMode, type FroamWorkspaceSection } from './workspace-shell-model'

type Member = { actor: string; name: string; role?: string; avatarUrl?: string | null }
type Props = {
  mode: FroamWorkspaceMode
  activeSection: FroamWorkspaceSection
  onModeChange: (mode: FroamWorkspaceMode) => void
  onSectionChange: (section: FroamWorkspaceSection, mode?: FroamWorkspaceMode) => void
  projectName: string
  branchId: string
  branchName: string
  members: Member[]
  hasSelection: boolean
  selectionLabel?: string
  flags: FroamLabsFlags
  advancedOpen: boolean
  onToggleAdvanced: () => void
  onOpenPrototypes: () => void
  onOpenReplay: () => void
  onOpenCommands: () => void
  onAskFroam: () => void
  temporalOwner: FroamTemporalOwner
  activity?: 'scanning' | 'screenshot' | 'mutating' | 'chaos' | 'synthetic' | 'intent-understanding' | 'intent-creating' | 'intent-applying' | null
}

const primaryTools: Array<{ id: FroamWorkspaceSection; mode: FroamWorkspaceMode; label: string; icon: typeof MousePointer2 }> = [
  { id: 'design', mode: 'create', label: 'Design', icon: MousePointer2 },
  { id: 'plan', mode: 'create', label: 'Build', icon: Boxes },
  { id: 'layers', mode: 'understand', label: 'Layers', icon: Layers },
  { id: 'reference', mode: 'understand', label: 'Reference', icon: FileImage },
  { id: 'animator', mode: 'create', label: 'Animate', icon: WandSparkles },
]

export default function FroamWorkspaceShell(props: Props) {
  const project = workspaceProjectLabel(props.projectName, props.branchName, props.branchId)
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

  return <>
    <section className="froam-workspace froam-workspace--simple" data-chef-editor-root="true" aria-label="Froam workspace">
      <button type="button" className={`froam-workspace__project ${project.prototype ? 'is-prototype' : ''}`} onClick={props.onOpenPrototypes} aria-label={`Project ${project.projectName}, branch ${project.branchName}. Open prototypes`}>
        <GitBranch size={12} />
        <span>{project.projectName}</span><i>/</i><strong>{project.branchName}{project.prototype ? ' ☣' : ''}</strong>
      </button>
      <nav className="froam-workspace__rail" aria-label="Primary Froam tools">
        {primaryTools.map((item) => {
          const Icon = item.icon
          return <button type="button" key={item.id} className={props.activeSection === item.id ? 'is-active' : ''} aria-pressed={props.activeSection === item.id} onClick={() => props.onSectionChange(item.id, item.mode)}>
            <Icon size={13} /><span>{item.label}</span>
          </button>
        })}
      </nav>
      <output className={`froam-workspace__status is-${status.tone}`} aria-live="polite">
        <i />{props.activity ? status.label : props.selectionLabel ? `Selected · ${props.selectionLabel}` : 'Click anything to edit'}
      </output>
      <button type="button" className="froam-workspace__ask" onClick={props.onAskFroam} title="Ask Froam to make an edit">
        <Sparkles size={13} /><span>Ask Froam</span>
      </button>
      <button type="button" className="froam-workspace__commands" onClick={props.onOpenCommands} title="Open all Froam commands">
        <MoreHorizontal size={15} /><span>More</span>
      </button>
    </section>
    {temporal && <section className="froam-temporal-dock" data-chef-editor-root="true" aria-label="Active temporal surface"><Clapperboard size={14}/><b>{temporal.label}</b><span>Only this timeline currently owns time controls.</span></section>}
  </>
}
