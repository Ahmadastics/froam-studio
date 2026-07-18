import { useEffect, useRef } from 'react'
import {
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  ArrowUpToLine,
  ArrowDownToLine,
  Trash2,
  Box,
  ImagePlus,
} from 'lucide-react'

type ContextAction =
  | 'copy-styles'
  | 'paste-styles'
  | 'duplicate'
  | 'clear'
  | 'delete-element'
  | 'bring-to-front'
  | 'send-to-back'
  | 'toggle-visibility'
  | 'wrap-container'
  | 'upload-image'
  | 'group-elements'
  | 'ungroup-elements'

type Props = {
  position: { x: number; y: number } | null
  elementLabel?: string
  isHidden?: boolean
  hasClipboard?: boolean
  hasMultiSelection?: boolean
  isGroup?: boolean
  onAction: (action: ContextAction) => void
  onClose: () => void
}

export default function FroamContextMenu({
  position,
  elementLabel,
  isHidden,
  hasClipboard,
  hasMultiSelection,
  isGroup,
  onAction,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!position) return

    function handleClick(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handleClick, true)
    window.addEventListener('touchstart', handleClick, { capture: true, passive: true })
    window.addEventListener('keydown', handleKey, true)
    return () => {
      window.removeEventListener('mousedown', handleClick, true)
      window.removeEventListener('touchstart', handleClick, true)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [position, onClose])

  // Keep menu within viewport
  useEffect(() => {
    if (!menuRef.current || !position) return
    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) {
      menu.style.left = `${position.x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight - 8) {
      menu.style.top = `${position.y - rect.height}px`
    }
  }, [position])

  if (!position) return null

  function handleAction(action: ContextAction) {
    onAction(action)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="froam-context-menu"
      data-chef-editor-root="true"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1320,
      }}
    >
      {elementLabel && (
        <div className="froam-context-menu__header">
          <span className="froam-context-menu__label">{elementLabel}</span>
        </div>
      )}

      <div className="froam-context-menu__group">
        <button type="button" className="froam-context-menu__item" onClick={() => handleAction('copy-styles')}>
          <ClipboardCopy size={14} />
          <span>Copy styles</span>
          <kbd>Ctrl+Alt+C</kbd>
        </button>
        <button
          type="button"
          className="froam-context-menu__item"
          onClick={() => handleAction('paste-styles')}
          disabled={!hasClipboard}
        >
          <ClipboardPaste size={14} />
          <span>Paste styles</span>
          <kbd>Ctrl+Alt+V</kbd>
        </button>
      </div>

      <div className="froam-context-menu__divider" />

      <div className="froam-context-menu__group">
        {hasMultiSelection ? (
          <button type="button" className="froam-context-menu__item" onClick={() => handleAction('group-elements')}>
            <Box size={14} />
            <span>Group elements</span>
            <kbd>Ctrl+G</kbd>
          </button>
        ) : (
          <>
            <button type="button" className="froam-context-menu__item" onClick={() => handleAction('duplicate')}>
              <Copy size={14} />
              <span>Duplicate</span>
              <kbd>Ctrl+D</kbd>
            </button>
            <button type="button" className="froam-context-menu__item" onClick={() => handleAction('wrap-container')}>
              <Box size={14} />
              <span>Wrap in container</span>
            </button>
          </>
        )}
        {isGroup && (
          <button type="button" className="froam-context-menu__item" onClick={() => handleAction('ungroup-elements')}>
            <Box size={14} />
            <span>Ungroup elements</span>
            <kbd>Ctrl+Shift+G</kbd>
          </button>
        )}
        <button type="button" className="froam-context-menu__item" onClick={() => handleAction('upload-image')}>
          <ImagePlus size={14} />
          <span>Upload image</span>
        </button>
      </div>

      <div className="froam-context-menu__divider" />

      <div className="froam-context-menu__group">
        <button type="button" className="froam-context-menu__item" onClick={() => handleAction('bring-to-front')}>
          <ArrowUpToLine size={14} />
          <span>Bring to front</span>
        </button>
        <button type="button" className="froam-context-menu__item" onClick={() => handleAction('send-to-back')}>
          <ArrowDownToLine size={14} />
          <span>Send to back</span>
        </button>
        <button type="button" className="froam-context-menu__item" onClick={() => handleAction('toggle-visibility')}>
          {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{isHidden ? 'Show' : 'Hide'}</span>
        </button>
      </div>

      <div className="froam-context-menu__divider" />

      <div className="froam-context-menu__group">
        <button type="button" className="froam-context-menu__item" onClick={() => handleAction('clear')}>
          <Eraser size={14} />
          <span>Clear styles</span>
          <kbd>Delete</kbd>
        </button>
        <button
          type="button"
          className="froam-context-menu__item froam-context-menu__item--danger"
          onClick={() => handleAction('delete-element')}
        >
          <Trash2 size={14} />
          <span>Remove element</span>
        </button>
      </div>
    </div>
  )
}
