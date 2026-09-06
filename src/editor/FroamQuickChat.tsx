import { ArrowUp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

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
  const targetLabel = selectionLabel || 'this page'
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
  return <section className="froam-quick-chat" data-chef-editor-root="true" role="dialog" aria-label={`Quick Edit ${targetLabel}`}>
    <header><span><Sparkles size={14}/><b>Quick Edit · {targetLabel}</b></span><button type="button" onClick={onClose} aria-label="Close Quick Edit"><X size={14}/></button></header>
    <form onSubmit={send}>
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={selectionLabel ? 'Describe a visual change…' : 'Run a quick local command…'} aria-label="Describe the change" disabled={busy}/>
      <button type="submit" className="is-send" disabled={!value.trim() || busy} aria-label="Preview change"><ArrowUp size={16}/></button>
    </form>
    <div className="froam-quick-chat__suggestions" aria-label="One-tap commands">
      {suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => submitIntent(suggestion)}>{suggestion}</button>)}
    </div>
    <small>{busy ? 'Preparing a safe preview…' : 'Fast local edits first. Nothing is uploaded, and you review every change before keeping it.'}</small>
  </section>
}
