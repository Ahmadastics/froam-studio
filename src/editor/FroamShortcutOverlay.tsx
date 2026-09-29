import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

type Props = {
  visible: boolean
  onClose: () => void
}

const SHORTCUT_GROUPS = [
  {
    title: 'General',
    shortcuts: [
      { keys: 'Ctrl + S', label: 'Save' },
      { keys: 'Ctrl + Shift + S', label: 'Save to your code' },
      { keys: 'Ctrl + K', label: 'Search commands' },
      { keys: 'Ctrl + Z', label: 'Undo' },
      { keys: 'Ctrl + Y', label: 'Redo' },
      { keys: 'Escape', label: 'Deselect or close' },
      { keys: 'Ctrl + .', label: 'Minimize the editor' },
      { keys: '?', label: 'Show these shortcuts' },
    ],
  },
  {
    title: 'Tools',
    shortcuts: [
      { keys: 'V', label: 'Select' },
      { keys: 'H', label: 'Hand — drag to pan' },
      { keys: 'T', label: 'Text' },
      { keys: 'R', label: 'Rectangle' },
      { keys: 'F', label: 'Frame' },
      { keys: 'Ctrl + Shift + L', label: 'Move freely' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Click', label: 'Select' },
      { keys: 'Shift + Click', label: 'Add to the selection' },
      { keys: 'Double-click', label: 'Edit the words' },
      { keys: 'Right-click', label: 'More actions and Quick Edit' },
      { keys: 'Delete', label: 'Reset styles' },
    ],
  },
  {
    title: 'Movement',
    shortcuts: [
      { keys: '↑ ↓ ← →', label: 'Nudge 1px' },
      { keys: 'Shift + Arrow', label: 'Nudge 10px' },
    ],
  },
  {
    title: 'Copy and group',
    shortcuts: [
      { keys: 'Ctrl + D', label: 'Duplicate' },
      { keys: 'Ctrl + Alt + C', label: 'Copy styles' },
      { keys: 'Ctrl + Alt + V', label: 'Paste styles' },
      { keys: 'Ctrl + G', label: 'Group' },
      { keys: 'Ctrl + Shift + G', label: 'Ungroup' },
    ],
  },
]

export default function FroamShortcutOverlay({ visible, onClose }: Props) {
  useEffect(() => {
    if (!visible) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div
      className="froam-shortcut-overlay"
      data-chef-editor-root="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="froam-shortcut-overlay__card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" data-chef-editor-root="true">
        <div className="froam-shortcut-overlay__header">
          <div className="froam-shortcut-overlay__title">
            <Keyboard size={18} />
            <span>Keyboard shortcuts</span>
          </div>
          <button type="button" className="froam-shortcut-overlay__close" onClick={onClose} aria-label="Close shortcuts">
            <X size={16} />
          </button>
        </div>

        <div className="froam-shortcut-overlay__body">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="froam-shortcut-group">
              <h4 className="froam-shortcut-group__title">{group.title}</h4>
              {group.shortcuts.map((s) => (
                <div key={s.label} className="froam-shortcut-row">
                  <span className="froam-shortcut-row__label">{s.label}</span>
                  <span className="froam-shortcut-row__keys">
                    {s.keys.split(' + ').map((k, i) => (
                      <span key={i}>
                        {i > 0 && <span className="froam-shortcut-row__plus">+</span>}
                        <kbd className="froam-shortcut-row__kbd">{k}</kbd>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="froam-shortcut-overlay__footer">
          Press <kbd>?</kbd> or <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  )
}
