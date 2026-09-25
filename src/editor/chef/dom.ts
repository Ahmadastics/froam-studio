import { getFroamRootElement } from '../../config'
import { type SelectionState } from './types'

export function getRoot(): HTMLElement | null {
  return getFroamRootElement()
}

export function getCanvasHost() {
  const root = getRoot()
  return root?.querySelector<HTMLElement>('[data-froam-canvas]') ?? null
}

export function applyGlobalCSS(css?: string) {
  if (typeof window === 'undefined') return
  let styleEl = document.getElementById('froam-global-styles') as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'froam-global-styles'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = css || ''
}

export const SVG_NS = 'http://www.w3.org/2000/svg'

/** An element inside an <svg> (path, g, circle…) — edited through its <svg>. */
export function isSvgInternal(element: Element) {
  return element.namespaceURI === SVG_NS && element.tagName.toLowerCase() !== 'svg'
}

export function shouldSkipElement(element: HTMLElement) {
  const tag = element.tagName.toLowerCase()
  if (['html', 'body', 'head', 'script', 'style', 'noscript', 'template', 'link', 'meta'].includes(tag)) return true
  if (isSvgInternal(element)) return true
  if (element.id === 'root') return true
  if (element.dataset.chefEditorRoot === 'true') return true
  return false
}

export function readNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function readCssUrl(value: string) {
  const match = value.match(/url\((['"]?)(.*?)\1\)/i)
  return match?.[2] ?? null
}

export function parseTransformValues(transformStr: string): { rotate: number; scaleX: number; scaleY: number; skewX: number; skewY: number; translateX: number; translateY: number } {
  const result = { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 }
  if (!transformStr || transformStr === 'none') return result

  // Parse matrix(a, b, c, d, tx, ty)
  const matrixMatch = transformStr.match(/matrix\(([^)]+)\)/)
  if (matrixMatch) {
    const parts = matrixMatch[1].split(',').map((s) => parseFloat(s.trim()))
    if (parts.length >= 6) {
      const [a, b, c, d, tx, ty] = parts
      result.rotate = Math.round(Math.atan2(b, a) * (180 / Math.PI))
      result.scaleX = Math.round(Math.sqrt(a * a + b * b) * 10) / 10
      result.scaleY = Math.round(Math.sqrt(c * c + d * d) * 10) / 10
      result.translateX = Math.round(tx)
      result.translateY = Math.round(ty)
    }
    return result
  }

  // Parse individual functions
  const rotateMatch = transformStr.match(/rotate\(([\d.-]+)deg\)/)
  if (rotateMatch) result.rotate = parseFloat(rotateMatch[1])
  const scaleXMatch = transformStr.match(/scaleX\(([\d.-]+)\)/)
  if (scaleXMatch) result.scaleX = parseFloat(scaleXMatch[1])
  const scaleYMatch = transformStr.match(/scaleY\(([\d.-]+)\)/)
  if (scaleYMatch) result.scaleY = parseFloat(scaleYMatch[1])
  const scaleMatch = transformStr.match(/scale\(([\d.-]+)\)/)
  if (scaleMatch) { result.scaleX = parseFloat(scaleMatch[1]); result.scaleY = parseFloat(scaleMatch[1]) }
  const skewXMatch = transformStr.match(/skewX\(([\d.-]+)deg\)/)
  if (skewXMatch) result.skewX = parseFloat(skewXMatch[1])
  const skewYMatch = transformStr.match(/skewY\(([\d.-]+)deg\)/)
  if (skewYMatch) result.skewY = parseFloat(skewYMatch[1])
  const translateXMatch = transformStr.match(/translateX\(([\d.-]+)px\)/)
  if (translateXMatch) result.translateX = parseFloat(translateXMatch[1])
  const translateYMatch = transformStr.match(/translateY\(([\d.-]+)px\)/)
  if (translateYMatch) result.translateY = parseFloat(translateYMatch[1])

  return result
}

export function rgbToHex(value: string) {
  if (value.startsWith('#')) return value
  const match = value.match(/\d+(\.\d+)?/g)
  if (!match || match.length < 3) return '#ffffff'
  const [r, g, b] = match.map((part) => Math.round(Number(part)))
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

export function readImageUrl(value: string) {
  const match = value.match(/url\((['"]?)(.*?)\1\)/i)
  return match?.[2] ?? ''
}

export function buildSelection(element: HTMLElement, path: string): SelectionState {
  try {
    const c = window.getComputedStyle(element)
    const imageUrl =
      element instanceof HTMLImageElement ? element.currentSrc || element.src || '' : readImageUrl(c.backgroundImage)

    // Parse transform matrix to get rotate/scale/skew/translate
    const transformValues = parseTransformValues(c.transform)

    // Normalize lineHeight: computed gives px, convert to ratio using fontSize
    const fontSizePx = readNumber(c.fontSize, 16)
    const lineHeightPx = readNumber(c.lineHeight, fontSizePx * 1.5)
    const lineHeightRatio = fontSizePx > 0 ? Math.round((lineHeightPx / fontSizePx) * 10) / 10 : 1.5

    return {
      path,
      label: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''}`,
      text: element.innerText || '',
      background: c.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : rgbToHex(c.backgroundColor),
      color: rgbToHex(c.color),
      borderColor: c.borderColor === 'rgba(0, 0, 0, 0)' ? '#d1d5db' : rgbToHex(c.borderColor),
      borderWidth: readNumber(c.borderTopWidth, 0),
      borderStyle: c.borderTopStyle || 'none',
      borderRadiusTL: readNumber(c.borderTopLeftRadius, 0),
      borderRadiusTR: readNumber(c.borderTopRightRadius, 0),
      borderRadiusBR: readNumber(c.borderBottomRightRadius, 0),
      borderRadiusBL: readNumber(c.borderBottomLeftRadius, 0),
      opacity: readNumber(c.opacity, 1),
      marginTop: readNumber(c.marginTop, 0),
      marginRight: readNumber(c.marginRight, 0),
      marginBottom: readNumber(c.marginBottom, 0),
      marginLeft: readNumber(c.marginLeft, 0),
      paddingTop: readNumber(c.paddingTop, 0),
      paddingRight: readNumber(c.paddingRight, 0),
      paddingBottom: readNumber(c.paddingBottom, 0),
      paddingLeft: readNumber(c.paddingLeft, 0),
      width: c.width || 'auto',
      height: c.height || 'auto',
      minWidth: c.minWidth === '0px' ? '' : c.minWidth,
      maxWidth: c.maxWidth === 'none' ? '' : c.maxWidth,
      minHeight: c.minHeight === '0px' ? '' : c.minHeight,
      maxHeight: c.maxHeight === 'none' ? '' : c.maxHeight,
      aspectRatio: c.aspectRatio === 'auto' ? '' : c.aspectRatio,
      fontSize: fontSizePx,
      fontFamily: c.fontFamily || 'Satoshi, system-ui, sans-serif',
      fontWeight: c.fontWeight || '400',
      fontStyle: c.fontStyle || 'normal',
      textAlign: c.textAlign || 'start',
      lineHeight: lineHeightRatio,
      letterSpacing: readNumber(c.letterSpacing, 0),
      wordSpacing: readNumber(c.wordSpacing, 0),
      textTransform: c.textTransform || 'none',
      textDecoration: c.textDecorationLine || 'none',
      display: c.display || 'block',
      flexDirection: c.flexDirection || 'row',
      justifyContent: c.justifyContent || 'flex-start',
      alignItems: c.alignItems || 'stretch',
      flexWrap: c.flexWrap || 'nowrap',
      gap: readNumber(c.gap, 0),
      gridTemplateColumns: c.gridTemplateColumns === 'none' ? '' : c.gridTemplateColumns,
      gridTemplateRows: c.gridTemplateRows === 'none' ? '' : c.gridTemplateRows,
      position: c.position || 'static',
      zIndex: readNumber(c.zIndex, 0),
      overflow: c.overflow || 'visible',
      cursor: c.cursor || 'auto',
      rotate: transformValues.rotate,
      scaleX: transformValues.scaleX,
      scaleY: transformValues.scaleY,
      skewX: transformValues.skewX,
      skewY: transformValues.skewY,
      translateX: transformValues.translateX,
      translateY: transformValues.translateY,
      boxShadow: c.boxShadow === 'none' ? '' : c.boxShadow,
      textShadow: c.textShadow === 'none' ? '' : c.textShadow,
      mixBlendMode: c.mixBlendMode || 'normal',
      filter: c.filter === 'none' ? '' : c.filter,
      backdropFilter: (c as unknown as Record<string, string>).backdropFilter === 'none' ? '' : ((c as unknown as Record<string, string>).backdropFilter || ''),
      imageUrl,
    }
  } catch {
    // Element may be disconnected from DOM — return safe defaults
    return {
      path,
      label: 'unknown',
      text: '',
      background: '#ffffff',
      color: '#000000',
      borderColor: '#d1d5db',
      borderWidth: 0,
      borderStyle: 'none',
      borderRadiusTL: 0,
      borderRadiusTR: 0,
      borderRadiusBR: 0,
      borderRadiusBL: 0,
      opacity: 1,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      width: 'auto',
      height: 'auto',
      minWidth: '',
      maxWidth: '',
      minHeight: '',
      maxHeight: '',
      aspectRatio: '',
      fontSize: 16,
      fontFamily: 'Satoshi, system-ui, sans-serif',
      fontWeight: '400',
      fontStyle: 'normal',
      textAlign: 'start',
      lineHeight: 1.5,
      letterSpacing: 0,
      wordSpacing: 0,
      textTransform: 'none',
      textDecoration: 'none',
      display: 'block',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      flexWrap: 'nowrap',
      gap: 0,
      gridTemplateColumns: '',
      gridTemplateRows: '',
      position: 'static',
      zIndex: 0,
      overflow: 'visible',
      cursor: 'auto',
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      translateX: 0,
      translateY: 0,
      boxShadow: '',
      textShadow: '',
      mixBlendMode: 'normal',
      filter: '',
      backdropFilter: '',
      imageUrl: '',
    }
  }
}
