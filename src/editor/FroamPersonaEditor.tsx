import { useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { Camera, ImagePlus, RotateCcw, Sparkles, X } from 'lucide-react'
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
      }}
    >
      <div className="froam-persona-modal__card" data-chef-editor-root="true">
        <div className="froam-persona-modal__header" data-chef-editor-root="true">
          <div>
            <p className="froam-persona-modal__eyebrow">Your profile</p>
            <h3>How people see you</h3>
          </div>
          <button
            type="button"
            className="froam-tb__icon-btn"
            onClick={onClose}
            aria-label="Close profile"
            data-chef-editor-root="true"
          >
            <X size={15} />
          </button>
        </div>

        <div className="froam-persona-modal__avatar-row">
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
          >
            <PersonAvatar name={name} color={persona.accentColor} avatarUrl={persona.imageUrl} size={64} ring />
            <span className="froam-collab__photo-badge"><Camera size={11} /></span>
          </button>
          <div className="froam-persona-modal__actions">
            <label className="fs-pill is-accent">
              <ImagePlus size={12} />
              <span>{persona.imageUrl ? 'Change photo' : 'Add a photo'}</span>
              <input ref={fileRef} type="file" accept="image/*" onChange={onImageUpload} hidden />
            </label>
            {persona.imageUrl && (
              <button type="button" className="fs-pill" onClick={onClearImage}>
                <RotateCcw size={12} />
                <span>Remove</span>
              </button>
            )}
            <p>Any photo works — it’s cropped to a small square. You can drop one on the circle.</p>
          </div>
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
            <span>What you do</span>
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
            <span>Your colour — your cursor and highlights</span>
            <div className="froam-persona-modal__accent-row">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`froam-persona-modal__accent-swatch ${persona.accentColor === color ? 'is-selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => onChange({ ...persona, accentColor: color })}
                  aria-label={`Set colour to ${color}`}
                />
              ))}
              <input
                type="color"
                className="froam-persona-modal__accent-custom"
                value={persona.accentColor}
                onChange={(event) => onChange({ ...persona, accentColor: event.target.value })}
                title="Custom colour"
              />
            </div>
          </div>

          <label className="froam-persona-modal__field">
            <span>Studio tagline</span>
            <input
              type="text"
              className="fs-input"
              value={persona.tagline}
              maxLength={72}
              onChange={(event) => onChange({ ...persona, tagline: event.target.value })}
            />
          </label>
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
            <PersonAvatar name={name} color={persona.accentColor} avatarUrl={persona.imageUrl} size={24} />
            <div className="froam-chat__stack">
              <div className="froam-chat__meta">
                <span className="froam-chat__name" style={{ color: persona.accentColor }}>{name}</span>
                <span className="froam-chat__title">{what}</span>
              </div>
              <div className="froam-chat__bubble">Take a look at the new headline?</div>
            </div>
          </div>
        </div>

        <div
          className="froam-persona-modal__toolbar-preview"
          data-chef-editor-root="true"
          style={{ '--froam-accent': persona.accentColor } as CSSProperties}
        >
          <div className="froam-persona-modal__toolbar-brand">
            <span className="froam-persona-modal__toolbar-avatar">
              <PersonAvatar name={name} color={persona.accentColor} avatarUrl={persona.imageUrl} size={22} />
            </span>
            <span className="froam-persona-modal__toolbar-name" style={{ color: persona.accentColor }}>
              {persona.name || 'Froam'}
            </span>
            <span className="froam-persona-modal__toolbar-role">{what}</span>
          </div>
          <span className="froam-persona-modal__toolbar-tagline">
            {persona.tagline || 'Shape what comes next'}
          </span>
          <Sparkles size={13} style={{ color: persona.accentColor, opacity: 0.7 }} />
        </div>

        <div className="froam-persona-modal__footer" data-chef-editor-root="true">
          <button type="button" className="fs-pill" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="fs-pill is-accent" onClick={onSave}>
            {inRoom ? 'Save — update the room' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
