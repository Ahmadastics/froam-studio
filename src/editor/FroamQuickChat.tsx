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
  const send = (event?: FormEvent) => {
    event?.preventDefault()
    const intent = value.trim()
    if (!intent || busy) return
    onSubmit(intent)
  }
  return <section className="froam-quick-chat" data-chef-editor-root="true" role="dialog" aria-label={`Edit ${targetLabel} with Froam`}>
    <header><span><Sparkles size={14}/><b>Ask Froam · {targetLabel}</b></span><button type="button" onClick={onClose} aria-label="Close Ask Froam"><X size={14}/></button></header>
    <form onSubmit={send}>
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={selectionLabel ? 'Describe the change…' : 'What should Froam change or add?'} aria-label="Describe the change" disabled={busy}/>
      <button type="submit" className="is-send" disabled={!value.trim() || busy} aria-label="Preview change"><ArrowUp size={16}/></button>
    </form>
    <div className="froam-quick-chat__suggestions" aria-label="Quick commands">
      {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setValue(suggestion); inputRef.current?.focus() }}>{suggestion}</button>)}
    </div>
    <small>{busy ? 'Understanding your request…' : 'Common edits run locally; configured intelligence handles more complex requests. You review changes before keeping them.'}</small>
  </section>
}
