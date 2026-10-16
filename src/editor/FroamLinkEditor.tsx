import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { LINK_KINDS, readLink, writeLink, type LinkKind } from './chef/links'

/**
 * Where a link goes, in the words a person would use: a website, a WhatsApp
 * chat, a call, an email or another page. Saving writes the address on the
 * selected link as an ordinary edit, so Undo, Save and sharing all cover it.
 */
export default function FroamLinkEditor({ href, changed, destinations, onSave, onReset }: {
  /** The link's address as the page shows it now. */
  href: string
  /** The address is Froam's, not the page's own. */
  changed: boolean
  /** Pages and sections this site already links to. */
  destinations: Array<{ href: string; label: string }>
  onSave: (href: string) => void
  onReset: () => void
}) {
  const current = readLink(href)
  const [kind, setKind] = useState<LinkKind>(current.kind)
  const [value, setValue] = useState(current.value)
  const [problem, setProblem] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fieldId = useId()
  const spec = LINK_KINDS.find((entry) => entry.id === kind) ?? LINK_KINDS[0]

  useEffect(() => {
    const next = readLink(href)
    setKind(next.kind)
    setValue(next.value)
    setProblem('')
  }, [href])

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }) }, [kind])

  const pick = (next: LinkKind) => {
    setKind(next)
    setProblem('')
    // The same number serves WhatsApp and calls; anything else starts empty.
    const keep = (kind === 'whatsapp' || kind === 'call') && (next === 'whatsapp' || next === 'call')
    setValue(next === current.kind ? current.value : keep ? value : '')
  }

  const save = (event?: FormEvent) => {
    event?.preventDefault()
    const result = writeLink(kind, value, kind === 'whatsapp' ? current.message : undefined)
    if ('problem' in result) {
      setProblem(result.problem)
      return
    }
    setProblem('')
    onSave(result.href)
  }

  const test = writeLink(kind, value, kind === 'whatsapp' ? current.message : undefined)
  const testHref = 'href' in test && !test.href.startsWith('#') ? test.href : null

  return (
    <form className="froam-link-editor" onSubmit={save} data-chef-editor-root="true">
      <div className="froam-floating-bar__pop-head">
        <span>Link goes to</span>
        {changed && (
          <button type="button" className="froam-link-editor__reset" onClick={onReset} title="Put back the address the page had">
            <RotateCcw size={12} /> Original
          </button>
        )}
      </div>
      <div className="froam-link-editor__kinds" role="radiogroup" aria-label="Kind of link">
        {LINK_KINDS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={kind === entry.id}
            className={kind === entry.id ? 'is-active' : ''}
            onClick={() => pick(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <label className="froam-link-editor__field" htmlFor={fieldId}>
        <input
          ref={inputRef}
          id={fieldId}
          type={kind === 'email' ? 'email' : kind === 'whatsapp' || kind === 'call' ? 'tel' : 'text'}
          inputMode={kind === 'whatsapp' || kind === 'call' ? 'tel' : kind === 'web' ? 'url' : undefined}
          value={value}
          placeholder={spec.placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${fieldId}-note`}
          onChange={(event) => { setValue(event.target.value); setProblem('') }}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </label>
      {kind === 'page' && destinations.length > 0 && (
        <div className="froam-link-editor__places" aria-label="Places on this site">
          {destinations.map((place) => (
            <button
              key={place.href}
              type="button"
              className={value === place.href ? 'is-active' : ''}
              title={place.href}
              onClick={() => { setValue(place.href); setProblem('') }}
            >
              {place.label}
            </button>
          ))}
        </div>
      )}
      <p id={`${fieldId}-note`} className={`froam-link-editor__note${problem ? ' is-problem' : ''}`} role={problem ? 'alert' : undefined}>
        {problem || spec.hint}
      </p>
      <div className="froam-link-editor__actions">
        {testHref ? (
          <a className="froam-link-editor__test" href={testHref} target="_blank" rel="noopener noreferrer" title="Try the link in a new tab">
            Try it <ExternalLink size={11} />
          </a>
        ) : <span />}
        <button type="submit" className="froam-link-editor__save">Save link</button>
      </div>
    </form>
  )
}
