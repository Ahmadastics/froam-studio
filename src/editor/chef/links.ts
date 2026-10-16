/*
 * Where a link goes. A link edit is stored as the address itself (`href` on
 * the draft); these helpers keep that address to the kinds a website needs —
 * the web, email, calls, texts, WhatsApp and the site's own pages — and turn
 * it into the friendly form the link editor shows, and back.
 */

/** The schemes a link may use. `javascript:`, `data:` and the rest never reach a page. */
const SAFE_SCHEME = /^(https?|mailto|tel|sms):/i
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * The address as it is safe to write into a page, or null. Relative
 * addresses (another page, `#a-section`, a file) are kept as they are.
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const href = raw.trim()
  if (!href || href.length > 2048 || /[\u0000-\u001f\u007f]/.test(href)) return null
  if (ANY_SCHEME.test(href)) return SAFE_SCHEME.test(href) ? href : null
  return href
}

export type LinkKind = 'web' | 'whatsapp' | 'call' | 'email' | 'page'

export const LINK_KINDS: ReadonlyArray<{ id: LinkKind; label: string; placeholder: string; hint: string }> = [
  { id: 'web', label: 'Website', placeholder: 'example.com/menu', hint: 'Any web address. https:// is added for you.' },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: '+234 906 585 7458', hint: 'Your number with its country code. Opens a chat with you.' },
  { id: 'call', label: 'Call', placeholder: '+234 906 585 7458', hint: 'A tap on a phone rings this number.' },
  { id: 'email', label: 'Email', placeholder: 'hello@yourname.com', hint: 'Opens a new email to this address.' },
  { id: 'page', label: 'Page', placeholder: 'about.html or #contact', hint: 'Another page of this site, or a section of this one.' },
]

const WHATSAPP = /^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|(?:www\.)?whatsapp\.com\/send)\/?/i

/** A number as digits (a leading + is dropped), or '' when it can't be a phone number. */
export function linkDigits(value: string) {
  const digits = value.replace(/[^\d]/g, '')
  return digits.length >= 7 && digits.length <= 15 ? digits : ''
}

/** What kind of link an address is, and the part of it a person would type. */
export function readLink(href: string | null | undefined): { kind: LinkKind; value: string; message?: string } {
  const value = (href ?? '').trim()
  if (!value) return { kind: 'web', value: '' }
  if (WHATSAPP.test(value)) {
    try {
      const url = new URL(value)
      const number = url.hostname.toLowerCase() === 'wa.me' ? url.pathname.slice(1) : url.searchParams.get('phone') ?? ''
      const message = url.searchParams.get('text') ?? undefined
      return { kind: 'whatsapp', value: number ? `+${number.replace(/[^\d]/g, '')}` : '', message }
    } catch {
      return { kind: 'whatsapp', value: '' }
    }
  }
  if (/^tel:/i.test(value)) return { kind: 'call', value: decodeURIComponent(value.slice(4)) }
  if (/^mailto:/i.test(value)) return { kind: 'email', value: decodeURIComponent(value.slice(7).split('?')[0]) }
  if (/^https?:/i.test(value)) return { kind: 'web', value }
  if (/^sms:/i.test(value)) return { kind: 'call', value: decodeURIComponent(value.slice(4).split('?')[0]) }
  return { kind: 'page', value }
}

/**
 * The address for what was typed, or an explanation of what's missing.
 * `message` is WhatsApp's opening line, kept when a number is changed.
 */
export function writeLink(kind: LinkKind, typed: string, message?: string): { href: string } | { problem: string } {
  const value = typed.trim()
  if (!value) return { problem: 'Type where the link should go.' }
  if (kind === 'whatsapp' || kind === 'call') {
    const digits = linkDigits(value)
    if (!digits) return { problem: 'That doesn’t look like a phone number.' }
    if (value.startsWith('0') && !value.startsWith('00')) return { problem: 'Add the country code, like +234, in place of the first 0.' }
    if (kind === 'call') return { href: `tel:+${digits}` }
    return { href: `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}` }
  }
  if (kind === 'email') {
    const address = value.replace(/^mailto:/i, '')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { problem: 'That doesn’t look like an email address.' }
    return { href: `mailto:${address}` }
  }
  if (kind === 'web') {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`
    const href = safeHref(withScheme)
    if (!href || !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(href)) return { problem: 'That doesn’t look like a web address.' }
    return { href }
  }
  const href = safeHref(value)
  if (!href) return { problem: 'Links can go to web pages, email, calls and WhatsApp.' }
  return { href }
}

/**
 * The places on this site a link can go: the pages its links already point
 * at, and the sections of this page that have a name (an id).
 */
export function linkDestinations(root: ParentNode | null): Array<{ href: string; label: string }> {
  if (!root) return []
  const found = new Map<string, string>()
  for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const href = link.getAttribute('href')?.trim() ?? ''
    if (!href || ANY_SCHEME.test(href) || href.startsWith('#') || href.startsWith('//')) continue
    if (!found.has(href)) found.set(href, link.textContent?.trim().slice(0, 40) || href)
  }
  for (const section of Array.from(root.querySelectorAll<HTMLElement>('[id]'))) {
    const id = section.id
    if (!id || id.startsWith('froam') || section.closest('[data-chef-editor-root]')) continue
    const heading = section.querySelector('h1, h2, h3')?.textContent?.trim()
    const href = `#${id}`
    if (!found.has(href)) found.set(href, heading ? heading.slice(0, 40) : id)
  }
  return Array.from(found, ([href, label]) => ({ href, label })).slice(0, 24)
}
