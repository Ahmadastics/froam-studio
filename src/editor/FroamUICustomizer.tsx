import { Check, LayoutPanelLeft, RotateCcw, Sparkles, X } from 'lucide-react'
import { DEFAULT_FROAM_UI_PREFERENCE, type FroamUIPreference } from './froamUIPreferences'

type Props = { open: boolean; value: FroamUIPreference; onChange: (value: FroamUIPreference) => void; onClose: () => void }

const choices = {
  toolbar: [['top', 'Top'], ['bottom', 'Bottom']],
  workspace: [['attached', 'In toolbar'], ['floating-bottom', 'Floating dock']],
  panels: [['standard', 'Build left'], ['mirrored', 'Build right']],
  density: [['comfortable', 'Comfortable'], ['compact', 'Compact']],
  appearance: [['graphite', 'Graphite'], ['midnight', 'Midnight'], ['glass', 'Glass']],
  accent: [['mint', 'Mint'], ['blue', 'Blue'], ['violet', 'Violet'], ['coral', 'Coral']],
  leftSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
  inspectorSize: [['narrow', 'Narrow'], ['standard', 'Standard'], ['wide', 'Wide']],
  scale: [[0.9, '90%'], [1, '100%'], [1.1, '110%']],
} as const

export default function FroamUICustomizer({ open, value, onChange, onClose }: Props) {
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
      <header><div><Sparkles size={15}/><span><strong>Make Froam yours</strong><small>Move the chrome without changing your project.</small></span></div><button type="button" aria-label="Close UI customizer" onClick={onClose}><X size={15}/></button></header>
      <div className={`froam-ui-customizer__preview is-${value.panels} toolbar-${value.toolbar} workspace-${value.workspace}`}>
        <i className="is-toolbar"/><i className="is-build"/><i className="is-canvas"><LayoutPanelLeft size={18}/></i><i className="is-inspector"/><i className="is-workspace"/>
      </div>
      <main>
        {row('toolbar', 'Main toolbar', 'Keep controls above or below the canvas.')}
        {row('workspace', 'Froam navigation', 'Attach it to the toolbar or float it near the canvas.')}
        {row('panels', 'Panel sides', 'Swap Build/Outline with the inspector.')}
        {row('leftSize', 'Build & Outline width', 'Choose how much canvas the structure tools use.')}
        {row('inspectorSize', 'Inspector width', 'Give design and intelligence more or less room.')}
        {row('density', 'Control density', 'Compact fits more; comfortable breathes more.')}
        {row('scale', 'UI scale', 'Scale Froam chrome independently from your page.')}
        {row('appearance', 'Surface', 'Choose the material of Froam’s chrome.')}
        {row('accent', 'Accent', 'Choose Froam’s interaction colour.')}
        <label className="froam-ui-customizer__toggle"><span><strong>Navigation labels</strong><small>Hide labels for an icon-first workspace.</small></span><input type="checkbox" checked={value.labels} onChange={(event) => set('labels', event.target.checked)}/></label>
      </main>
      <footer><button type="button" onClick={() => onChange({ ...DEFAULT_FROAM_UI_PREFERENCE })}><RotateCcw size={12}/> Reset Froam UI</button><button type="button" className="is-primary" onClick={onClose}>Done</button></footer>
    </div>
  </div>
}
