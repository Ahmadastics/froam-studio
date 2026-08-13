import { ArrowUp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

type Props = {
  open: boolean
  selectionLabel: string
  busy?: boolean
  onSubmit: (intent: string) => void
  onClose: () => void
}

const suggestions = ['Make it bolder', 'Add more space', 'Make it rounder']

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
  const send = (event?: FormEvent) => {
    event?.preventDefault()
    const intent = value.trim()
    if (!intent || busy) return
    onSubmit(intent)
  }
  return <section className="froam-quick-chat" data-chef-editor-root="true" role="dialog" aria-label={`Edit ${selectionLabel} with Froam`}>
    <header><span><Sparkles size={14}/><b>Edit {selectionLabel}</b></span><button type="button" onClick={onClose} aria-label="Close quick edit"><X size={14}/></button></header>
    <form onSubmit={send}>
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder="What should change?" aria-label="Describe the change" disabled={busy}/>
      <button type="submit" className="is-send" disabled={!value.trim() || busy} aria-label="Preview change"><ArrowUp size={16}/></button>
    </form>
    <div className="froam-quick-chat__suggestions" aria-label="Quick commands">
      {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setValue(suggestion); inputRef.current?.focus() }}>{suggestion}</button>)}
    </div>
    <small>{busy ? 'Preparing a safe preview…' : 'Common edits run instantly on this device. Nothing changes until you Keep it.'}</small>
  </section>
}
