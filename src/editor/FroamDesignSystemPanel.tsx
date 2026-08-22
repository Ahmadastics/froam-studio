import { useEffect, useMemo, useState } from 'react'
import { Box, Check, Component, Library, Layers3, Palette, Plus, RefreshCw, Smartphone, SunMoon, Variable } from 'lucide-react'
import {
  decideLibraryUpdate,
  designVariableCss,
  publishLibraryRelease,
  resolveDesignVariable,
  setActiveModes,
  upsertDesignVariable,
} from '../project/design-system'
import type { FroamDesignSystem, FroamDesignVariable, FroamStyleState } from '../project/types'

type Tab = 'variables' | 'styles' | 'components' | 'kits' | 'libraries'

export default function FroamDesignSystemPanel({ system, onChange, onApplyStyle, onToast }: {
  system: FroamDesignSystem
  onChange: (system: FroamDesignSystem, label: string) => void
  onApplyStyle: (states: Partial<Record<FroamStyleState, Record<string, string>>>, name: string) => void
  onToast: (message: string) => void
}) {
  const [tab, setTab] = useState<Tab>('variables')
  const [name, setName] = useState('')
  const [value, setValue] = useState('#14b8a6')
  const [kind, setKind] = useState<FroamDesignVariable['kind']>('color')
  const [role, setRole] = useState<FroamDesignVariable['role']>('semantic')
  const activeModes = useMemo(() => new Set(system.activeModeIds), [system.activeModeIds])

  useEffect(() => {
    for (const variable of Object.values(system.variables)) {
      const resolved = resolveDesignVariable(system, variable.id)
      if (resolved !== undefined) document.documentElement.style.setProperty(variable.cssName, resolved)
    }
  }, [system])

  function toggleMode(id: string) {
    const mode = system.modes[id]
    let next = [...system.activeModeIds]
    if (mode.kind === 'light' || mode.kind === 'dark') next = next.filter((candidate) => !['light', 'dark'].includes(system.modes[candidate]?.kind))
    next = activeModes.has(id) ? next.filter((candidate) => candidate !== id) : [...next, id]
    onChange(setActiveModes(system, next), `Changed design mode: ${mode.name}`)
  }

  function addVariable() {
    const clean = name.trim()
    if (!clean) return onToast('Name the variable first')
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const variable: FroamDesignVariable = { id: `var:${slug}:${Date.now().toString(36)}`, name: clean, cssName: `--froam-${slug}`, kind, role, collection: role === 'semantic' ? 'Semantic' : 'Primitives', values: { [system.activeModeIds[0] ?? 'mode:base']: value } }
    onChange(upsertDesignVariable(system, variable), `Added design variable: ${clean}`)
    setName('')
  }

  function applyStyle(id: string) {
    const style = system.styles[id]
    if (!style) return
    onApplyStyle(style.states, style.name)
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Variable; count: number }> = [
    { id: 'variables', label: 'Variables', icon: Variable, count: Object.keys(system.variables).length },
    { id: 'styles', label: 'Styles', icon: Palette, count: Object.keys(system.styles).length },
    { id: 'components', label: 'Families', icon: Component, count: Object.keys(system.componentFamilies).length },
    { id: 'kits', label: 'Site kits', icon: Layers3, count: Object.keys(system.siteKits).length },
    { id: 'libraries', label: 'Libraries', icon: Library, count: Object.keys(system.libraries).length },
  ]

  return <div className="froam-design-system" data-chef-editor-root="true">
    <div className="froam-design-system__modes">
      {Object.values(system.modes).filter((mode) => mode.kind !== 'base').map((mode) => <button type="button" key={mode.id} className={activeModes.has(mode.id) ? 'is-active' : ''} onClick={() => toggleMode(mode.id)}>{mode.kind === 'mobile' ? <Smartphone size={11}/> : <SunMoon size={11}/>}<span>{mode.name}</span></button>)}
    </div>
    <div className="froam-design-system__tabs" role="tablist">
      {tabs.map((item) => <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}><item.icon size={12}/><span>{item.label}</span><small>{item.count}</small></button>)}
    </div>

    {tab === 'variables' && <section>
      <div className="froam-design-system__summary"><strong>Bound variables</strong><button type="button" onClick={() => navigator.clipboard?.writeText(`:root {\n${designVariableCss(system).split('\n').map((line) => `  ${line}`).join('\n')}\n}`)}>Copy CSS</button></div>
      <div className="froam-design-system__list">{Object.values(system.variables).map((variable) => <article key={variable.id}><i style={variable.kind === 'color' ? { background: resolveDesignVariable(system, variable.id) } : undefined}/><div><strong>{variable.name}</strong><small>{variable.cssName} · {variable.role}</small></div><code>{resolveDesignVariable(system, variable.id) ?? 'unresolved'}</code></article>)}</div>
      <div className="froam-design-system__creator"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Variable name"/><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Value"/><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="color">Color</option><option value="size">Size</option><option value="number">Number</option><option value="font">Font</option><option value="shadow">Shadow</option><option value="string">String</option></select><select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="semantic">Semantic</option><option value="primitive">Primitive</option></select><button type="button" onClick={addVariable}><Plus size={11}/> Add</button></div>
    </section>}

    {tab === 'styles' && <section><div className="froam-design-system__cards">{Object.values(system.styles).map((style) => <article key={style.id}><Palette size={16}/><div><strong>{style.name}</strong><small>v{style.version} · {Object.keys(style.states).join(', ')} · {style.usageNodeIds.length} uses</small></div><button type="button" onClick={() => applyStyle(style.id)}>Apply</button></article>)}</div></section>}

    {tab === 'components' && <section><div className="froam-design-system__cards">{Object.values(system.componentFamilies).map((family) => <article key={family.id}><Component size={16}/><div><strong>{family.name}</strong><small>v{family.version} · {family.props.length} props · {family.slots.length} slots · {family.variants.length} variants</small><div className="froam-design-system__chips">{family.variants.map((variant) => <span key={variant.id}>{variant.name}</span>)}</div></div></article>)}</div></section>}

    {tab === 'kits' && <section><div className="froam-design-system__cards">{Object.values(system.siteKits).map((kit) => <article key={kit.id}><Box size={16}/><div><strong>{kit.name}</strong><small>{kit.description}</small><div className="froam-design-system__chips">{kit.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><button type="button" onClick={() => { onChange(setActiveModes(system, kit.modeIds.filter((id) => ['light','brand','mobile'].includes(system.modes[id]?.kind))), `Applied site kit: ${kit.name}`); onToast(`${kit.name} design system activated`) }}>Activate</button></article>)}</div></section>}

    {tab === 'libraries' && <section><div className="froam-design-system__cards">{Object.values(system.libraries).map((library) => <article key={library.id}><Library size={16}/><div><strong>{library.name}</strong><small>Installed v{library.installedVersion} · Latest v{library.availableVersion} · {library.status}</small></div><div className="froam-design-system__library-actions"><button type="button" onClick={() => onChange(publishLibraryRelease(system, library.id, 'Design system update'), `Published ${library.name} update`)}><RefreshCw size={11}/> Publish</button>{library.status === 'update-available' && <><button type="button" onClick={() => onChange(decideLibraryUpdate(system, library.id, 'accept'), `Accepted ${library.name} update`)}><Check size={11}/> Accept</button><button type="button" onClick={() => onChange(decideLibraryUpdate(system, library.id, 'postpone'), `Postponed ${library.name} update`)}>Later</button></>}</div></article>)}</div></section>}
  </div>
}

