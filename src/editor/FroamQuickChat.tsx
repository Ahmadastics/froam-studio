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

const selectedSuggestions = ['Make it bolder', 'Center the content', 'Add more space', 'Make it rounder']
const pageSuggestions = ['Add a hero section', 'Add a rectangle', 'Open Layers', 'Make the page dark']

const aiSuggestions = ['Make it feel more premium', 'Tighten the spacing', 'Make it easier to read', 'Give it more contrast']

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
  const targetLabel = selectionLabel ? describeSelection(selectionLabel).kind.toLowerCase() : 'this page'
  const aiOn = Boolean(ai?.available && ai.on)
  const suggestions = aiOn && selectionLabel ? aiSuggestions : selectionLabel ? selectedSuggestions : pageSuggestions
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
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={aiOn ? 'Say what you want — “make it feel more premium”…' : selectionLabel ? 'Say what to change — “make it bolder”…' : 'Say what to do — “add a hero section”…'} aria-label="Describe the change" disabled={busy}/>
      <button type="submit" className="is-send" disabled={!value.trim() || busy} aria-label="Preview change" title="Preview (Enter)"><ArrowUp size={16}/></button>
    </form>
    <div className="froam-quick-chat__suggestions" aria-label="One-tap commands">
      {suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => submitIntent(suggestion)}>{suggestion}</button>)}
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
