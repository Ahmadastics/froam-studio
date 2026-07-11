import type { CSSProperties, ChangeEvent } from 'react'
import { ImagePlus, RotateCcw, Sparkles, X } from 'lucide-react'
import {
  getFroamPersonaInitials,
  type FroamPersona,
} from './froamPersona'

type Props = {
  open: boolean
  persona: FroamPersona
  onChange: (nextPersona: FroamPersona) => void
  onClose: () => void
  onSave: () => void
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onClearImage: () => void
}

const ACCENT_PRESETS = [
  '#5eead4', '#ff6c4f', '#a78bfa', '#34d399', '#f59e0b',
  '#60a5fa', '#f472b6', '#e2e8f0',
]

export default function FroamPersonaEditor({
  open,
  persona,
  onChange,
  onClose,
  onSave,
  onImageUpload,
  onClearImage,
}: Props) {
  if (!open) return null

  return (
    <div
      className="froam-persona-modal"
      data-chef-editor-root="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="froam-persona-modal__card" data-chef-editor-root="true">
        <div className="froam-persona-modal__header" data-chef-editor-root="true">
          <div>
            <p className="froam-persona-modal__eyebrow">Studio profile</p>
            <h3>Give Froam a little personality</h3>
          </div>
          <button
            type="button"
            className="froam-tb__icon-btn"
            onClick={onClose}
            aria-label="Close studio profile"
            data-chef-editor-root="true"
          >
            <X size={15} />
          </button>
        </div>

        {/* Live toolbar preview */}
        <div
          className="froam-persona-modal__toolbar-preview"
          data-chef-editor-root="true"
          style={{ '--froam-accent': persona.accentColor } as CSSProperties}
        >
          <div className="froam-persona-modal__toolbar-brand">
            <span className="froam-persona-modal__toolbar-avatar">
              {persona.imageUrl ? (
                <img src={persona.imageUrl} alt="" />
              ) : (
                <span style={{ background: persona.accentColor, color: '#0f172a' }}>
                  {getFroamPersonaInitials(persona.name)}
                </span>
              )}
            </span>
            <span className="froam-persona-modal__toolbar-name" style={{ color: persona.accentColor }}>
              {persona.name || 'Froam'}
            </span>
            <span className="froam-persona-modal__toolbar-role">
              {persona.role || 'Designer'}
            </span>
          </div>
          <span className="froam-persona-modal__toolbar-tagline">
            {persona.tagline || 'Shape what comes next'}
          </span>
          <Sparkles size={13} style={{ color: persona.accentColor, opacity: 0.7 }} />
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
              onChange={(event) => onChange({ ...persona, name: event.target.value })}
            />
          </label>

          <label className="froam-persona-modal__field">
            <span>Role</span>
            <input
              type="text"
              className="fs-input"
              value={persona.role}
              maxLength={32}
              placeholder="Designer, Developer, Founder…"
              onChange={(event) => onChange({ ...persona, role: event.target.value })}
            />
          </label>

          <label className="froam-persona-modal__field">
            <span>Tagline</span>
            <input
              type="text"
              className="fs-input"
              value={persona.tagline}
              maxLength={72}
              onChange={(event) => onChange({ ...persona, tagline: event.target.value })}
            />
          </label>

          <div className="froam-persona-modal__field">
            <span>Accent color</span>
            <div className="froam-persona-modal__accent-row">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`froam-persona-modal__accent-swatch ${persona.accentColor === color ? 'is-selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => onChange({ ...persona, accentColor: color })}
                  aria-label={`Set accent to ${color}`}
                />
              ))}
              <input
                type="color"
                className="froam-persona-modal__accent-custom"
                value={persona.accentColor}
                onChange={(event) => onChange({ ...persona, accentColor: event.target.value })}
                title="Custom accent color"
              />
            </div>
          </div>

          <div className="froam-persona-modal__field">
            <span>Avatar</span>
            <div className="froam-persona-modal__actions">
              <label className="fs-pill is-accent">
                <ImagePlus size={12} />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  hidden
                />
              </label>
              <button type="button" className="fs-pill" onClick={onClearImage}>
                <RotateCcw size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        <div className="froam-persona-modal__footer" data-chef-editor-root="true">
          <button type="button" className="fs-pill" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="fs-pill is-accent" onClick={onSave}>
            Save profile
          </button>
        </div>
      </div>
    </div>
  )
}
