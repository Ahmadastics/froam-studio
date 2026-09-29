import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Smartphone, Tablet } from 'lucide-react'
import { DEVICE_SIZES, type DeviceFrame } from './chef/device-sizes'

type Props = {
  frame: DeviceFrame
  onPick: (id: string) => void
  onDesktop: () => void
}

/**
 * Under the phone or tablet: which screen it is, how big, how far it's scaled
 * to fit — and a menu of the other screens that preview the same edits.
 */
export default function FroamDeviceBar({ frame, onPick, onDesktop }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true) }
  }, [open])
  const Icon = frame.kind === 'mobile' ? Smartphone : Tablet
  const sizes = DEVICE_SIZES[frame.kind]
  return (
    <div
      ref={ref}
      className="froam-device-bar"
      style={{ left: frame.left + frame.width / 2, top: frame.top + frame.height + 18 }}
      data-chef-editor-root="true"
    >
      <button type="button" className="froam-device-bar__pick" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title="Preview another screen size">
        <Icon size={14} />
        <span>{frame.size.label}</span>
        <em>{frame.size.width} × {frame.size.height}</em>
        <ChevronDown size={12} />
      </button>
      <span className="froam-device-bar__scale" title="Scaled to fit — the page is laid out at full size">{Math.round(frame.scale * 100)}%</span>
      {open && (
        <div className="froam-device-bar__menu" role="menu" aria-label="Screen size">
          {sizes.map((size) => (
            <button key={size.id} type="button" role="menuitemradio" aria-checked={size.id === frame.size.id} onClick={() => { onPick(size.id); setOpen(false) }}>
              <span className="froam-device-bar__tick">{size.id === frame.size.id && <Check size={13} />}</span>
              <span>{size.label}</span>
              <em>{size.width} × {size.height}</em>
            </button>
          ))}
          <div className="froam-device-bar__note">Edits here apply to every {frame.kind === 'mobile' ? 'phone (up to 640px wide)' : 'tablet (641–1024px wide)'}.</div>
          <button type="button" onClick={() => { onDesktop(); setOpen(false) }}>
            <span className="froam-device-bar__tick" />
            <span>Back to desktop</span>
          </button>
        </div>
      )}
    </div>
  )
}
