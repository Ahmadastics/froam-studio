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
      { keys: 'Ctrl + S', label: 'Save / Publish' },
      { keys: 'Ctrl + K', label: 'Command palette' },
      { keys: 'Ctrl + Z', label: 'Undo' },
      { keys: 'Ctrl + Y', label: 'Redo' },
      { keys: 'Escape', label: 'Deselect / Close panel' },
      { keys: '?', label: 'Toggle shortcuts' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Click', label: 'Select element' },
      { keys: 'Shift + Click', label: 'Multi-select' },
      { keys: 'Double-click', label: 'Edit text inline' },
      { keys: 'Delete', label: 'Clear element styles' },
      { keys: 'Right-click', label: 'Context menu' },
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
    title: 'Clipboard & Grouping',
    shortcuts: [
      { keys: 'Ctrl + D', label: 'Duplicate element' },
      { keys: 'Ctrl + Alt + C', label: 'Copy styles' },
      { keys: 'Ctrl + Alt + V', label: 'Paste styles' },
      { keys: 'Ctrl + G', label: 'Group elements' },
      { keys: 'Ctrl + Shift + G', label: 'Ungroup elements' },
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
      <div className="froam-shortcut-overlay__card" data-chef-editor-root="true">
        <div className="froam-shortcut-overlay__header">
          <div className="froam-shortcut-overlay__title">
            <Keyboard size={18} />
            <span>Keyboard Shortcuts</span>
          </div>
          <button type="button" className="froam-shortcut-overlay__close" onClick={onClose}>
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
