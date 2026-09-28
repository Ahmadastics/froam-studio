import { findElementByPath } from '../../collab/paths'
import { elementLabel } from './request-builder'

export type RequestCheck = {
  path: string
  /** "Heading “Plan a trip”". */
  label: string
  kind: 'contrast' | 'overflow' | 'clipped' | 'image' | 'alt' | 'link' | 'small-text'
  severity: 'fail' | 'warn'
  message: string
}

type Rgba = { r: number; g: number; b: number; a: number }

function parseColor(value: string): Rgba | null {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(value)
  if (!match) return null
  const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number(match[4].slice(0, -1)) / 100 : Number(match[4])
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha }
}

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ({ r, g, b }: Rgba) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** WCAG contrast ratio between two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const blend = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
})

/**
 * The colour actually behind an element: its own background and its
 * ancestors', blended down to the page. Null behind a background image or
 * gradient — a guess there would be worse than saying nothing.
 */
function backgroundBehind(element: HTMLElement): Rgba | null {
  const layers: Rgba[] = []
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.backgroundImage && style.backgroundImage !== 'none') return null
    const color = parseColor(style.backgroundColor)
    if (color && color.a > 0) {
      layers.push(color)
      if (color.a >= 1) break
    }
  }
  let result: Rgba = { r: 255, g: 255, b: 255, a: 1 }
  for (const layer of layers.reverse()) result = blend(layer, result)
  return result
}

const ownText = (element: HTMLElement) => Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())

/**
 * What a reviewer would want to know before approving: can people read it,
 * does it fit, do images and links work. Runs on the page as previewed, so
 * it judges what people will actually see, at this screen size.
 */
export function checkRequestOnPage(root: HTMLElement, paths: readonly string[], { viewport = 'desktop' }: { viewport?: string } = {}): RequestCheck[] {
  const checks: RequestCheck[] = []
  const pageWidth = document.documentElement.clientWidth
  const seen = new Set<Element>()
  for (const path of paths) {
    const element = findElementByPath(root, path)
    if (!element || seen.has(element)) continue
    seen.add(element)
    const label = elementLabel(path, root)
    const add = (kind: RequestCheck['kind'], severity: RequestCheck['severity'], message: string) => checks.push({ path, label, kind, severity, message })
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') continue

    if (ownText(element)) {
      const color = parseColor(style.color)
      const behind = backgroundBehind(element)
      if (color && behind) {
        const ratio = contrastRatio(blend(color, behind), behind)
        const size = parseFloat(style.fontSize)
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
        const needed = large ? 3 : 4.5
        if (ratio < needed) add('contrast', ratio < needed - 1.5 ? 'fail' : 'warn', `Hard to read — contrast ${ratio.toFixed(1)}:1, needs ${needed}:1`)
      }
      const size = parseFloat(style.fontSize)
      if (viewport === 'mobile' && size < 12) add('small-text', 'warn', `Small on phones — ${Math.round(size)}px text`)
    }

    const rect = element.getBoundingClientRect()
    if (rect.width > 0 && (rect.right > pageWidth + 1 || rect.left < -1)) add('overflow', 'fail', 'Runs off the side of the screen')
    else if (element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible' && style.overflowX !== 'auto' && style.overflowX !== 'scroll') add('clipped', 'warn', 'Text is cut off at the side')
    if (element.scrollHeight > element.clientHeight + 2 && (style.overflowY === 'hidden' || style.overflowY === 'clip') && ownText(element)) add('clipped', 'warn', 'Text is cut off at the bottom')

    const images = element instanceof HTMLImageElement ? [element] : Array.from(element.querySelectorAll('img')).slice(0, 6)
    for (const image of images) {
      if (image.complete && image.naturalWidth === 0 && image.currentSrc) add('image', 'fail', 'Image doesn’t load')
      if (!image.hasAttribute('alt')) add('alt', 'warn', 'Image has no description (alt text) for screen readers')
    }

    const link = element.closest('a')
    if (link) {
      const href = link.getAttribute('href')
      if (!href || href === '#' || /^javascript:/i.test(href)) add('link', 'warn', 'Link goes nowhere')
    }
  }
  return checks
}
