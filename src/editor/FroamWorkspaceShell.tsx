import { Archive, Beaker, Boxes, Braces, Clapperboard, DraftingCompass, FlaskConical, GitBranch, History, Layers, MousePointer2, Network, ScanSearch, Sparkles, UserRound, Waves, Zap } from 'lucide-react'
import type { FroamLabsFlags } from '../project/experiments'
import { FROAM_WORKSPACE_MODES, workspacePresenceSummary, workspaceProjectLabel, workspaceSections, workspaceStatus, workspaceTemporalSurface, type FroamTemporalOwner, type FroamWorkspaceMode, type FroamWorkspaceSection } from './workspace-shell-model'

type Member = { actor: string; name: string; role?: string; avatarUrl?: string | null }
type Props = {
  mode: FroamWorkspaceMode
  activeSection: FroamWorkspaceSection
  onModeChange: (mode: FroamWorkspaceMode) => void
  onSectionChange: (section: FroamWorkspaceSection) => void
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
  temporalOwner: FroamTemporalOwner
  activity?: 'scanning' | 'screenshot' | 'mutating' | 'chaos' | 'synthetic' | null
}

const icons: Partial<Record<FroamWorkspaceSection, typeof MousePointer2>> = { design: MousePointer2, plan: Boxes, layers: Layers, blueprint: DraftingCompass, animator: Clapperboard, scan: ScanSearch, dna: Braces, archive: Archive, flow: Network, rhythm: Waves, responsive: Clapperboard, laboratory: Beaker, mutate: FlaskConical, sample: Zap, interactions: Zap, 'interactions-create': Zap, break: FlaskConical, 'test-user': UserRound, prototypes: GitBranch, replay: History, advanced: Braces }
export default function FroamWorkspaceShell(props: Props) {
  const project = workspaceProjectLabel(props.projectName, props.branchName, props.branchId)
  const status = workspaceStatus({ mode: props.mode, branchName: props.branchName, branchId: props.branchId, activity: props.activity, sampling: props.temporalOwner === 'sampling', replay: props.temporalOwner === 'replay', physics: props.activeSection === 'physics' })
  const sections = workspaceSections(props.mode, props.flags, props.hasSelection)
  const presence = workspacePresenceSummary(props.members)
  const temporal = workspaceTemporalSurface(props.temporalOwner)
  return <>
    <section className={`froam-workspace froam-workspace--${props.mode}`} data-chef-editor-root="true" aria-label="Froam workspace">
      <button type="button" className={`froam-workspace__project ${project.prototype ? 'is-prototype' : ''}`} onClick={props.onOpenPrototypes} aria-label={`Project ${project.projectName}, branch ${project.branchName}. Open prototypes`}>
        <span>{project.projectName}</span><i>/</i><strong>{project.branchName}{project.prototype ? ' ☣' : ''}</strong>
      </button>
      <div className="froam-workspace__modes" role="tablist" aria-label="Workspace mode" onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
        event.preventDefault()
        const current = FROAM_WORKSPACE_MODES.findIndex((item) => item.id === props.mode)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? FROAM_WORKSPACE_MODES.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + FROAM_WORKSPACE_MODES.length) % FROAM_WORKSPACE_MODES.length
        props.onModeChange(FROAM_WORKSPACE_MODES[next].id)
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.froam-workspace__modes [data-mode="${FROAM_WORKSPACE_MODES[next].id}"]`)?.focus())
      }}>
        {FROAM_WORKSPACE_MODES.map((item) => <button type="button" role="tab" data-mode={item.id} tabIndex={props.mode === item.id ? 0 : -1} aria-selected={props.mode === item.id} key={item.id} className={props.mode === item.id ? 'is-active' : ''} onClick={() => props.onModeChange(item.id)}><b>{item.label}</b><small>{item.promise}</small></button>)}
      </div>
      <div className="froam-workspace__people" aria-label={presence.accessibleLabel}>
        {presence.visible.map((member) => <button type="button" key={member.actor} title={`${member.name} · ${member.role ?? 'present'}`} aria-label={`${member.name}, ${member.role ?? 'present'}`}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{member.name.trim().slice(0, 1).toUpperCase()}</span>}</button>)}
        {presence.overflow > 0 && <small>+{presence.overflow}</small>}
      </div>
      <div className="froam-workspace__global-actions">
        <button type="button" onClick={props.onOpenReplay} aria-label="Open Replay and history" title="Replay and history"><History size={14}/></button>
        <button type="button" onClick={props.onToggleAdvanced} aria-pressed={props.advancedOpen} className={props.advancedOpen ? 'is-active' : ''} aria-label="Toggle Advanced editor surfaces" title="Advanced editor surfaces"><Braces size={14}/></button>
      </div>
      <nav className="froam-workspace__rail" aria-label={`${props.mode} tools`}>
        {sections.map((section) => { const Icon = icons[section.id] ?? Sparkles; return <button type="button" key={`${section.mode}:${section.id}`} className={props.activeSection === section.id ? 'is-active' : ''} aria-pressed={props.activeSection === section.id} disabled={!section.contextual} onClick={() => props.onSectionChange(section.id)} title={!section.contextual ? `Select an element to use ${section.label}` : section.description}><Icon size={13}/><span>{section.label}</span>{section.maturity !== 'production' && <em data-maturity={section.maturity}>{section.maturity === 'experimental' ? 'Lab' : section.maturity}</em>}</button> })}
      </nav>
      <output className={`froam-workspace__status is-${status.tone}`} aria-live="polite"><i/>{status.label}{props.selectionLabel && <small>{props.selectionLabel}</small>}</output>
    </section>
    {temporal && <section className="froam-temporal-dock" data-chef-editor-root="true" aria-label="Active temporal surface"><Clapperboard size={14}/><b>{temporal.label}</b><span>Only this timeline currently owns time controls.</span></section>}
  </>
}
