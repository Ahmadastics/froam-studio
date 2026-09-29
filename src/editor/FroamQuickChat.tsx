import { ArrowUp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { describeSelection } from './selection-name'

type Props = {
  open: boolean
  selectionLabel?: string
  busy?: boolean
  onSubmit: (intent: string) => void
  onClose: () => void
}

const selectedSuggestions = ['Make it bolder', 'Center the content', 'Add more space', 'Make it rounder']
const pageSuggestions = ['Add a hero section', 'Add a rectangle', 'Open Layers', 'Make the page dark']

export default function FroamQuickChat({ open, selectionLabel, busy, onSubmit, onClose }: Props) {
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
  const suggestions = selectionLabel ? selectedSuggestions : pageSuggestions
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
      <button type="button" onClick={onClose} aria-label="Close Quick Edit" title="Close (Esc)"><X size={15}/></button>
    </header>
    <form onSubmit={send}>
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={selectionLabel ? 'Say what to change — “make it bolder”…' : 'Run a quick local command…'} aria-label="Describe the change" disabled={busy}/>
      <button type="submit" className="is-send" disabled={!value.trim() || busy} aria-label="Preview change" title="Preview (Enter)"><ArrowUp size={16}/></button>
    </form>
    <div className="froam-quick-chat__suggestions" aria-label="One-tap commands">
      {suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => submitIntent(suggestion)}>{suggestion}</button>)}
    </div>
    <small>{busy ? 'Preparing a safe preview…' : 'Fast local edits first. Nothing is uploaded, and you review every change before keeping it.'}</small>
  </section>
}
