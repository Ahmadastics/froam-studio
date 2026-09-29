import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'
import type { FroamRole } from '../collab/types'
import { PersonAvatar } from './collaborate/PersonAvatar'
import { type FroamPersona } from './froamPersona'

type Props = {
  open: boolean
  persona: FroamPersona
  /** In a room right now: saving updates what everyone there sees. */
  inRoom?: boolean
  roomRole?: FroamRole | null
  onChange: (nextPersona: FroamPersona) => void
  onClose: () => void
  onSave: () => void
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void
  /** A photo dropped onto the avatar. */
  onImageFile?: (file: File) => void
  onClearImage: () => void
}

const ACCENT_PRESETS = [
  '#5eead4', '#ff6c4f', '#a78bfa', '#34d399', '#f59e0b',
  '#60a5fa', '#f472b6', '#e2e8f0',
]

const ROLE_WORD: Partial<Record<FroamRole, string>> = {
  owner: 'Owner',
  editor: 'Editing',
  contributor: 'Suggesting',
}

/**
 * Your studio profile — and, in a shared room, who you are to everyone else:
 * the face on your cursor, your messages, and every change you send for
 * approval. The previews show exactly that, as you type.
 */
export default function FroamPersonaEditor({
  open,
  persona,
  inRoom = false,
  roomRole = null,
  onChange,
  onClose,
  onSave,
  onImageUpload,
  onImageFile,
  onClearImage,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  if (!open) return null

  const name = persona.name || 'Your name'
  const what = persona.role || ROLE_WORD[roomRole ?? 'contributor'] || 'Designer'

  return (
    <div
      className="froam-persona-modal"
      data-chef-editor-root="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        // Typing a name is words, never editor shortcuts.
        event.stopPropagation()
        if (event.key === 'Escape') onClose()
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSave()
      }}
    >
      <div className="froam-persona-modal__card" role="dialog" aria-modal="true" aria-labelledby="froam-profile-title" data-chef-editor-root="true">
        <div className="froam-persona-modal__header" data-chef-editor-root="true">
          <div>
            <h3 id="froam-profile-title">Your profile</h3>
            <p>How people see you when you share a page, chat and send changes.</p>
          </div>
          <button
            type="button"
            className="froam-tb__icon-btn"
            onClick={onClose}
            aria-label="Close profile"
            data-chef-editor-root="true"
          >
            <X size={16} />
          </button>
        </div>

        <div className="froam-persona-modal__body">
          <div className="froam-persona-modal__identity">
            <div className="froam-persona-modal__photo-col">
              <button
                type="button"
                className={`froam-persona-modal__photo${dragging ? ' is-dragging' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  const file = event.dataTransfer.files?.[0]
                  if (file) onImageFile?.(file)
                }}
                aria-label={persona.imageUrl ? 'Change your photo' : 'Add a photo'}
                title="Click or drop a photo"
              >
                <PersonAvatar name={name} color={persona.accentColor} avatarUrl={persona.imageUrl} size={72} ring />
                <span className="froam-collab__photo-badge"><Camera size={12} /></span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onImageUpload} hidden />
              <button type="button" className="froam-persona-modal__link" onClick={() => fileRef.current?.click()}>
                {persona.imageUrl ? 'Change photo' : 'Add a photo'}
              </button>
              {persona.imageUrl && (
                <button type="button" className="froam-persona-modal__link is-quiet" onClick={onClearImage}>Remove</button>
              )}
            </div>

            <div className="froam-persona-modal__fields" data-chef-editor-root="true">
              <label className="froam-persona-modal__field">
                <span>Name</span>
                <input
                  type="text"
                  className="fs-input"
                  value={persona.name}
                  maxLength={32}
                  autoFocus
                  placeholder="What should people call you?"
                  onChange={(event) => onChange({ ...persona, name: event.target.value })}
                />
              </label>

              <label className="froam-persona-modal__field">
                <span>What you do <small>Optional</small></span>
                <input
                  type="text"
                  className="fs-input"
                  value={persona.role}
                  maxLength={32}
                  placeholder="Designer, Marketing, Founder…"
                  onChange={(event) => onChange({ ...persona, role: event.target.value })}
                />
              </label>

              <div className="froam-persona-modal__field">
                <span>Colour <small>Your cursor and highlights</small></span>
                <div className="froam-persona-modal__accent-row" role="radiogroup" aria-label="Your colour">
                  {ACCENT_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={persona.accentColor === color}
                      className={`froam-persona-modal__accent-swatch ${persona.accentColor === color ? 'is-selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => onChange({ ...persona, accentColor: color })}
                      aria-label={`Colour ${color}`}
                    />
                  ))}
                  <input
                    type="color"
                    className="froam-persona-modal__accent-custom"
                    value={persona.accentColor}
                    onChange={(event) => onChange({ ...persona, accentColor: event.target.value })}
                    title="Any colour"
                    aria-label="Any colour"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* What a teammate sees: your request in their inbox, your message in the chat. */}
          <div className="froam-persona-modal__room-preview" aria-hidden="true">
            <small>{inRoom ? 'What people in this room see' : 'What people see when you share'}</small>
            <div className="froam-persona-modal__room-card">
              <div className="froam-persona-modal__room-row">
                <div className="froam-collab__who">
                  <PersonAvatar name={name} color={persona.accentColor} avatarUrl={persona.imageUrl} size={28} here />
                  <span>
                    <strong>{name}</strong>
                    <small>{what} · just now</small>
                  </span>
                </div>
                <span className="froam-collab__status">Waiting for approval</span>
              </div>
              <strong>New hero headline</strong>
            </div>
            <div className="froam-persona-modal__room-chat">
              <PersonAvatar name={name} color={persona.accentColor} avatarUrl={persona.imageUrl} size={26} />
              <div className="froam-chat__stack">
                <div className="froam-chat__meta">
                  <span className="froam-chat__name" style={{ color: persona.accentColor }}>{name}</span>
                  <span className="froam-chat__title">{what}</span>
                </div>
                <div className="froam-chat__bubble">Take a look at the new headline?</div>
              </div>
            </div>
          </div>
        </div>

        <div className="froam-persona-modal__footer" data-chef-editor-root="true">
          <button type="button" className="fs-pill" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="fs-pill is-accent" onClick={onSave}>
            {inRoom ? 'Save and update the room' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
