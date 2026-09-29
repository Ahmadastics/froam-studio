import { useEffect } from 'react'
import { Check, LayoutPanelLeft, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { DEFAULT_FROAM_UI_PREFERENCE, type FroamUIPreference } from './froamUIPreferences'

type Props = { open: boolean; value: FroamUIPreference; onChange: (value: FroamUIPreference) => void; onClose: () => void }

const choices = {
  toolbar: [['top', 'Top'], ['bottom', 'Bottom']],
  workspace: [['attached', 'In toolbar'], ['floating-bottom', 'Floating dock']],
  panels: [['standard', 'Left'], ['mirrored', 'Right']],
  density: [['comfortable', 'Comfortable'], ['compact', 'Compact']],
  theme: [['dark', 'Dark'], ['light', 'Light'], ['system', 'Match system']],
  appearance: [['graphite', 'Graphite'], ['midnight', 'Midnight'], ['glass', 'Glass']],
  accent: [['blue', 'Blue'], ['teal', 'Teal'], ['violet', 'Violet'], ['coral', 'Coral']],
  leftSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
  inspectorSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
  scale: [[0.9, '90%'], [1, '100%'], [1.1, '110%']],
} as const

export default function FroamUICustomizer({ open, value, onChange, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  if (!open) return null
  const set = <K extends keyof FroamUIPreference>(key: K, next: FroamUIPreference[K]) => onChange({ ...value, [key]: next })
  const row = (key: keyof typeof choices, label: string, description: string) => (
    <section className="froam-ui-customizer__option" key={key}>
      <div><strong>{label}</strong><small>{description}</small></div>
      <div className="froam-ui-customizer__choices">
        {(choices[key] as readonly (readonly [string | number, string])[]).map(([id, name]) => <button type="button" key={String(id)} className={value[key] === id ? 'is-active' : ''} onClick={() => onChange({ ...value, [key]: id } as FroamUIPreference)}>{value[key] === id && <Check size={11}/>} {name}</button>)}
      </div>
    </section>
  )
  return <div className="froam-ui-customizer" role="dialog" aria-modal="true" aria-label="Customize Froam UI" data-chef-editor-root="true" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="froam-ui-customizer__card">
      <header><div><SlidersHorizontal size={16}/><span><strong>Make Froam yours</strong><small>Arrange the editor your way. Your project doesn’t change.</small></span></div><button type="button" aria-label="Close UI customizer" onClick={onClose}><X size={16}/></button></header>
      <div className={`froam-ui-customizer__preview is-${value.panels} toolbar-${value.toolbar} workspace-${value.workspace}`}>
        <i className="is-toolbar"/><i className="is-build"/><i className="is-canvas"><LayoutPanelLeft size={18}/></i><i className="is-inspector"/><i className="is-workspace"/>
      </div>
      <main>
        {row('toolbar', 'Top bar', 'Above or below the page.')}
        {row('panels', 'Layers and pages', 'Which side the Layers, Pages and Library panel sits on.')}
        {row('leftSize', 'Layers panel width', 'How much room the Layers, Pages and Library panel takes.')}
        {row('inspectorSize', 'Design panel width', 'How much room the Design panel takes.')}
        {row('density', 'Density', 'Compact fits more; comfortable breathes more.')}
        {row('scale', 'Size', 'Scale the editor without changing your page.')}
        {row('theme', 'Appearance', 'Dark or light — or follow your computer.')}
        {value.theme !== 'light' && row('appearance', 'Dark surface', 'The material of the editor when it’s dark.')}
        {row('accent', 'Accent', 'The colour for selected things and the main action.')}
        <label className="froam-ui-customizer__toggle"><span><strong>Tab labels</strong><small>Show words on the panel tabs, or icons only.</small></span><input type="checkbox" checked={value.labels} onChange={(event) => set('labels', event.target.checked)}/></label>
      </main>
      <footer><button type="button" onClick={() => onChange({ ...DEFAULT_FROAM_UI_PREFERENCE })}><RotateCcw size={13}/> Reset to default</button><button type="button" className="is-primary" onClick={onClose}>Done</button></footer>
    </div>
  </div>
}
