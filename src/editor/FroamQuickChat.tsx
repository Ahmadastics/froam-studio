import { ArrowUp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { describeSelection } from './selection-name'

type Props = {
  open: boolean
  selectionLabel?: string
  busy?: boolean
  onSubmit: (intent: string) => void
  onClose: () => void
  /** null: this editor can't reach an AI at all (no bridge, or not the owner). */
  ai?: { available: boolean; on: boolean; model: string | null; onToggle: () => void } | null
}

type Suggestion = { label: string; intent: string; smart?: boolean }
const say = (intent: string): Suggestion => ({ label: intent, intent })
const selectedSuggestions = ['Make it bolder', 'Center the content', 'Add more space', 'Make it rounder'].map(say)
const pageSuggestions = ['Add a hero section', 'Add a rectangle', 'Open Layers', 'Make the page dark'].map(say)
const aiSuggestions = ['Make it feel more premium', 'Tighten the spacing', 'Make it easier to read'].map(say)

/* Smart edits read the page first (smart-styles.ts); these are the ones that suit each kind of thing. */
const SMART: Record<string, Suggestion> = {
  contrast: { label: 'Fix contrast', intent: 'Fix the contrast', smart: true },
  balance: { label: 'Balance lines', intent: 'Balance the lines', smart: true },
  fluid: { label: 'Fluid size', intent: 'Make the size fluid', smart: true },
  gradient: { label: 'Brand gradient', intent: 'Add a gradient in the brand colour', smart: true },
  brand: { label: 'Brand colour', intent: 'Use the brand colour', smart: true },
  glow: { label: 'Brand glow', intent: 'Make it glow in the brand colour', smart: true },
  pop: { label: 'Make it pop', intent: 'Make it pop', smart: true },
  glass: { label: 'Frosted glass', intent: 'Make it frosted glass', smart: true },
  match: { label: 'Match the others', intent: 'Match the others like it', smart: true },
}
function smartSuggestions(kind: string): Suggestion[] {
  if (kind === 'Heading') return [SMART.contrast, SMART.balance, SMART.fluid, SMART.gradient]
  if (['Paragraph', 'Text', 'Label', 'Quote', 'Caption'].includes(kind)) return [SMART.contrast, SMART.balance, SMART.brand]
  if (['Button', 'Link'].includes(kind)) return [SMART.brand, SMART.glow, SMART.pop, SMART.match]
  if (['Box', 'Section', 'Article', 'List item', 'Figure', 'Header', 'Footer', 'Sidebar', 'Form'].includes(kind)) return [SMART.glass, SMART.match, SMART.glow]
  return []
}

export default function FroamQuickChat({ open, selectionLabel, busy, onSubmit, onClose, ai = null }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!open) return
    setValue('')
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, selectionLabel])
  if (!open) return null
  const kind = selectionLabel ? describeSelection(selectionLabel).kind : ''
  const targetLabel = selectionLabel ? kind.toLowerCase() : 'this page'
  const aiOn = Boolean(ai?.available && ai.on)
  const smart = selectionLabel ? smartSuggestions(kind) : []
  const suggestions = selectionLabel
    ? [...smart, ...(aiOn ? aiSuggestions : selectedSuggestions)].slice(0, Math.max(4, smart.length + 2))
    : pageSuggestions
  const submitIntent = (intent: string) => {
    const command = intent.trim()
    if (!command || busy) return
    onSubmit(command)
  }
  const send = (event?: FormEvent) => {
    event?.preventDefault()
    submitIntent(value)
  }
  return <section
    className="froam-quick-chat"
    data-chef-editor-root="true"
    role="dialog"
    aria-label={`Quick Edit ${targetLabel}`}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}
  >
    <header>
      <span><Sparkles size={15}/><b>Quick Edit</b><em>{selectionLabel ? `the selected ${targetLabel}` : targetLabel}</em></span>
      {ai?.available && (
        <label className={`froam-quick-chat__ai${aiOn ? ' is-on' : ''}`} title={aiOn ? `Anything you ask goes to ${ai.model ?? 'your AI'}` : 'Let AI handle requests that aren’t simple edits'}>
          <span>AI</span>
          <input type="checkbox" role="switch" checked={aiOn} onChange={ai.onToggle} aria-label="Use AI for Quick Edit" />
        </label>
      )}
      <button type="button" onClick={onClose} aria-label="Close Quick Edit" title="Close (Esc)"><X size={15}/></button>
    </header>
    <form onSubmit={send}>
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={aiOn ? 'Say what you want — “make it feel more premium”…' : selectionLabel ? 'Say what to change — “fix the contrast”, “make it bolder”…' : 'Say what to do — “add a hero section”…'} aria-label="Describe the change" disabled={busy}/>
      <button type="submit" className="is-send" disabled={!value.trim() || busy} aria-label="Preview change" title="Preview (Enter)"><ArrowUp size={16}/></button>
    </form>
    <div className="froam-quick-chat__suggestions" aria-label="One-tap commands">
      {suggestions.map((suggestion) => (
        <button
          type="button"
          key={suggestion.intent}
          className={suggestion.smart ? 'is-smart' : undefined}
          disabled={busy}
          title={suggestion.smart ? `${suggestion.intent} — worked out from this page` : undefined}
          onClick={() => submitIntent(suggestion.intent)}
        >
          {suggestion.smart && <Sparkles size={11} aria-hidden="true" />}{suggestion.label}
        </button>
      ))}
    </div>
    <small>{busy
      ? 'Preparing a preview…'
      : aiOn
        ? `Simple edits run on this device; anything else goes to ${ai?.model ?? 'your AI'}. You see a preview before anything changes.`
        : ai && !ai.available
          ? 'Simple edits run on this device. For anything else, set up AI for froam dev — the README shows how.'
          : 'Simple edits run on this device — nothing is uploaded. You see a preview before anything changes.'}</small>
  </section>
}
