import { useState, useCallback } from 'react'
import {
  Camera,
  Code,
  Copy,
  Download,
  FileImage,
  FileCode2,
  Check,
  Loader2,
  Maximize,
  Image as ImageIcon,
} from 'lucide-react'

type ExportFormat = 'png' | 'svg' | 'webp' | 'jpeg'
type FullPageFormat = Exclude<ExportFormat, 'svg'>
type ExportScale = 1 | 2 | 3
type FullPageScale = 1 | 2

type Props = {
  selectedElement: HTMLElement | null
  selectionLabel: string
  selectionPath: string
  onToast: (msg: string) => void
}

/* ── helpers ── */
function getCleanCSS(el: HTMLElement): string {
  const computed = window.getComputedStyle(el)
  const defaults = [
    'display', 'position', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'background', 'background-color', 'background-image', 'background-size', 'background-position',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
    'border', 'border-radius', 'border-color', 'border-width', 'border-style',
    'box-shadow', 'text-shadow', 'opacity', 'overflow', 'z-index', 'cursor',
    'flex-direction', 'justify-content', 'align-items', 'gap', 'flex-wrap',
    'grid-template-columns', 'grid-template-rows',
    'transform', 'filter', 'backdrop-filter', 'mix-blend-mode', 'transition',
  ]
  const lines: string[] = []
  for (const prop of defaults) {
    const value = computed.getPropertyValue(prop)
    if (value && value !== '' && value !== 'none' && value !== 'normal' && value !== 'auto'
      && value !== '0px' && value !== '0' && value !== 'rgba(0, 0, 0, 0)' && value !== 'visible'
      && value !== 'static' && value !== 'start') {
      lines.push(`  ${prop}: ${value};`)
    }
  }
  return `.${el.className?.split?.(' ')?.[0] || el.tagName.toLowerCase()} {\n${lines.join('\n')}\n}`
}

function generateReactCode(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  const computed = window.getComputedStyle(el)
  const reactTag = ['div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'img', 'ul', 'ol', 'li'].includes(tag) ? tag : 'div'

  const styleObj: Record<string, string> = {}
  const importantProps = [
    'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
    'padding', 'margin', 'backgroundColor', 'color', 'fontSize', 'fontWeight',
    'fontFamily', 'borderRadius', 'border', 'boxShadow', 'width', 'height',
    'minHeight', 'position', 'overflow', 'textAlign', 'lineHeight',
    'letterSpacing', 'opacity', 'transform', 'gridTemplateColumns',
  ]
  for (const prop of importantProps) {
    const kebab = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
    const value = computed.getPropertyValue(kebab)
    if (value && value !== '' && value !== 'none' && value !== 'normal'
      && value !== 'auto' && value !== '0px' && value !== '0'
      && value !== 'rgba(0, 0, 0, 0)' && value !== 'visible'
      && value !== 'static' && value !== 'start' && value !== 'stretch'
      && value !== 'row' && value !== 'nowrap') {
      styleObj[prop] = value
    }
  }

  const styleStr = Object.entries(styleObj)
    .map(([k, v]) => `    ${k}: '${v}'`)
    .join(',\n')

  const textContent = el.innerText?.trim()?.slice(0, 80) || ''
  const hasChildren = el.children.length > 0
  const inner = hasChildren
    ? `\n      {/* ${el.children.length} child elements */}\n      <span>${textContent}</span>\n    `
    : textContent

  return `export default function Component() {\n  return (\n    <${reactTag}\n      style={{\n${styleStr}\n      }}\n    >\n      ${inner}\n    </${reactTag}>\n  )\n}`
}

type CaptureOptions = {
  cacheBust: boolean
  pixelRatio: number
  width?: number
  height?: number
  canvasWidth?: number
  canvasHeight?: number
  backgroundColor?: string
  style?: Record<string, string>
  filter: (node: HTMLElement) => boolean
}

async function convertPngToFormat(pngUrl: string, format: 'webp' | 'jpeg'): Promise<string> {
  const img = new Image()
  img.src = pngUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not load captured image'))
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL(format === 'webp' ? 'image/webp' : 'image/jpeg', format === 'webp' ? 0.92 : 0.95)
}

function getCaptureFilter() {
  return (node: HTMLElement) => !node?.dataset?.chefEditorRoot
}

function getPageBackgroundColor() {
  const bodyBg = window.getComputedStyle(document.body).backgroundColor
  if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') return bodyBg
  const docBg = window.getComputedStyle(document.documentElement).backgroundColor
  return docBg && docBg !== 'rgba(0, 0, 0, 0)' && docBg !== 'transparent' ? docBg : '#ffffff'
}

function getFullPageSize() {
  const body = document.body
  const doc = document.documentElement
  return {
    width: Math.max(body.scrollWidth, body.offsetWidth, doc.clientWidth, doc.scrollWidth, doc.offsetWidth, window.innerWidth),
    height: Math.max(body.scrollHeight, body.offsetHeight, doc.clientHeight, doc.scrollHeight, doc.offsetHeight, window.innerHeight),
  }
}

async function captureElement(el: HTMLElement, format: ExportFormat, scale: ExportScale): Promise<string> {
  // Dynamic import to avoid bundling html-to-image if not used
  const { toPng, toSvg, toJpeg } = await import('html-to-image')

  const options: CaptureOptions = {
    cacheBust: true,
    pixelRatio: scale,
    filter: getCaptureFilter(),
  }

  switch (format) {
    case 'svg': return toSvg(el, options)
    case 'jpeg': return toJpeg(el, { ...options, quality: 0.95 })
    case 'webp': {
      const pngUrl = await toPng(el, options)
      return convertPngToFormat(pngUrl, 'webp')
    }
    default: return toPng(el, options)
  }
}

async function captureFullPage(format: FullPageFormat, scale: FullPageScale): Promise<string> {
  const { toPng } = await import('html-to-image')
  const { width, height } = getFullPageSize()
  const pixelCount = width * height * scale * scale
  const maxPixels = 80_000_000

  if (pixelCount > maxPixels) {
    throw new Error(`Full page is too large for ${scale}x capture. Try 1x or capture a smaller page.`)
  }

  const previousScroll = { x: window.scrollX, y: window.scrollY }
  document.documentElement.dataset.froamCapturingFullPage = 'true'

  try {
    window.scrollTo(0, 0)
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const pngUrl = await toPng(document.body, {
      cacheBust: true,
      pixelRatio: scale,
      width,
      height,
      canvasWidth: width * scale,
      canvasHeight: height * scale,
      backgroundColor: getPageBackgroundColor(),
      filter: getCaptureFilter(),
      style: {
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: 'none',
        minHeight: `${height}px`,
        overflow: 'visible',
      },
    } satisfies CaptureOptions)

    if (format === 'png') return pngUrl
    return convertPngToFormat(pngUrl, format)
  } finally {
    delete document.documentElement.dataset.froamCapturingFullPage
    window.scrollTo(previousScroll.x, previousScroll.y)
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

/* ── component ── */
export default function FroamExport({ selectedElement, selectionLabel, selectionPath, onToast }: Props) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [scale, setScale] = useState<ExportScale>(2)
  const [fullPageFormat, setFullPageFormat] = useState<FullPageFormat>('png')
  const [fullPageScale, setFullPageScale] = useState<FullPageScale>(1)
  const [exporting, setExporting] = useState(false)
  const [capturingFullPage, setCapturingFullPage] = useState(false)
  const [copiedCSS, setCopiedCSS] = useState(false)
  const [copiedReact, setCopiedReact] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    if (!selectedElement) { onToast('Select an element first'); return }
    setExporting(true)
    try {
      const dataUrl = await captureElement(selectedElement, format, scale)
      const name = selectionLabel.split('.')[0] || 'froam-export'
      downloadDataUrl(dataUrl, `${name}-${scale}x.${format}`)
      onToast(`Exported as ${format.toUpperCase()} @${scale}x`)
    } catch (err) {
      console.error('Export error:', err)
      onToast('Export failed — try selecting a simpler element')
    } finally {
      setExporting(false)
    }
  }, [selectedElement, format, scale, selectionLabel, onToast])

  const handleFullPageCapture = useCallback(async () => {
    setCapturingFullPage(true)
    try {
      const dataUrl = await captureFullPage(fullPageFormat, fullPageScale)
      downloadDataUrl(dataUrl, `froam-full-page-${fullPageScale}x.${fullPageFormat}`)
      onToast(`Captured full page as ${fullPageFormat.toUpperCase()} @${fullPageScale}x`)
    } catch (err) {
      console.error('Full-page capture error:', err)
      onToast(err instanceof Error ? err.message : 'Full-page capture failed')
    } finally {
      setCapturingFullPage(false)
    }
  }, [fullPageFormat, fullPageScale, onToast])

  const handlePreview = useCallback(async () => {
    if (!selectedElement) return
    try {
      const url = await captureElement(selectedElement, 'png', 1)
      setPreviewUrl(url)
    } catch {
      onToast('Preview failed')
    }
  }, [selectedElement, onToast])

  const handleCopyCSS = useCallback(async () => {
    if (!selectedElement) { onToast('Select an element first'); return }
    const css = getCleanCSS(selectedElement)
    await navigator.clipboard.writeText(css)
    setCopiedCSS(true)
    onToast('CSS copied to clipboard')
    setTimeout(() => setCopiedCSS(false), 2000)
  }, [selectedElement, onToast])

  const handleCopyReact = useCallback(async () => {
    if (!selectedElement) { onToast('Select an element first'); return }
    const code = generateReactCode(selectedElement)
    await navigator.clipboard.writeText(code)
    setCopiedReact(true)
    onToast('React component copied')
    setTimeout(() => setCopiedReact(false), 2000)
  }, [selectedElement, onToast])

  const handleCopySpecs = useCallback(async () => {
    if (!selectedElement) { onToast('Select an element first'); return }
    const rect = selectedElement.getBoundingClientRect()
    const c = window.getComputedStyle(selectedElement)
    const specs = [
      `/* Design Specs — ${selectionLabel} */`,
      `Element: ${selectionPath}`,
      ``,
      `/* Dimensions */`,
      `Width: ${Math.round(rect.width)}px`,
      `Height: ${Math.round(rect.height)}px`,
      ``,
      `/* Position */`,
      `X: ${Math.round(rect.left)}px`,
      `Y: ${Math.round(rect.top)}px`,
      ``,
      `/* Colors */`,
      `Background: ${c.backgroundColor}`,
      `Color: ${c.color}`,
      `Border: ${c.border}`,
      ``,
      `/* Typography */`,
      `Font: ${c.fontFamily}`,
      `Size: ${c.fontSize}`,
      `Weight: ${c.fontWeight}`,
      `Line Height: ${c.lineHeight}`,
      `Letter Spacing: ${c.letterSpacing}`,
      ``,
      `/* Spacing */`,
      `Padding: ${c.padding}`,
      `Margin: ${c.margin}`,
      ``,
      `/* Border */`,
      `Border Radius: ${c.borderRadius}`,
      `Box Shadow: ${c.boxShadow}`,
    ].join('\n')
    await navigator.clipboard.writeText(specs)
    onToast('Design specs copied')
  }, [selectedElement, selectionLabel, selectionPath, onToast])

  const fullPageSection = (
    <div className="fs-export__section">
      <div className="fs-export__section-title">
        <Camera size={12} />
        Full Page Capture
      </div>
      <div className="fs-fullpage-summary">
        <span>{getFullPageSize().width}px wide</span>
        <span>{getFullPageSize().height}px tall</span>
      </div>
      <div className="fs-grid-2" style={{ gap: 6 }}>
        <label className="fs-field">
          <span className="fs-field__label">Format</span>
          <select className="fs-select" value={fullPageFormat} onChange={(e) => setFullPageFormat(e.target.value as FullPageFormat)}>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
        <label className="fs-field">
          <span className="fs-field__label">Scale</span>
          <select className="fs-select" value={fullPageScale} onChange={(e) => setFullPageScale(Number(e.target.value) as FullPageScale)}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </label>
      </div>
      <button type="button" className="fs-pill is-accent" onClick={handleFullPageCapture} disabled={capturingFullPage}>
        {capturingFullPage ? <Loader2 size={12} className="froam-spin" /> : <Download size={12} />}
        {capturingFullPage ? 'Capturing...' : 'Capture full page'}
      </button>
      <small className="fs-export-note">Captures the full document height and hides Froam controls from the image.</small>
    </div>
  )

  if (!selectedElement) {
    return (
      <div className="fs-export" data-chef-editor-root="true">
        {fullPageSection}
        <div className="fs-export-empty" data-chef-editor-root="true">
          <FileImage size={22} style={{ opacity: 0.4 }} />
          <span style={{ color: 'var(--fs-text-secondary)', fontSize: '0.78rem' }}>Select an element to export or inspect it</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fs-export" data-chef-editor-root="true">
      {fullPageSection}

      {/* Export as image */}
      <div className="fs-export__section">
        <div className="fs-export__section-title">
          <FileImage size={12} />
          Export Image
        </div>
        <div className="fs-grid-2" style={{ gap: 6 }}>
          <label className="fs-field">
            <span className="fs-field__label">Format</span>
            <select className="fs-select" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
              <option value="webp">WebP</option>
              <option value="jpeg">JPEG</option>
            </select>
          </label>
          <label className="fs-field">
            <span className="fs-field__label">Scale</span>
            <select className="fs-select" value={scale} onChange={(e) => setScale(Number(e.target.value) as ExportScale)}>
              <option value={1}>1x</option>
              <option value={2}>2x (Retina)</option>
              <option value={3}>3x</option>
            </select>
          </label>
        </div>
        <div className="fs-pill-group" style={{ marginTop: 6 }}>
          <button type="button" className="fs-pill is-accent" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 size={12} className="froam-spin" /> : <Download size={12} />}
            {exporting ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
          <button type="button" className="fs-pill" onClick={handlePreview}>
            <ImageIcon size={12} /> Preview
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="fs-export__preview" data-chef-editor-root="true">
          <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--fs-border)' }} />
          <button type="button" className="fs-pill" onClick={() => setPreviewUrl(null)} style={{ marginTop: 4 }}>
            Close preview
          </button>
        </div>
      )}

      {/* Copy CSS */}
      <div className="fs-export__section">
        <div className="fs-export__section-title">
          <Code size={12} />
          Copy Code
        </div>
        <div className="fs-pill-group">
          <button type="button" className="fs-pill" onClick={handleCopyCSS}>
            {copiedCSS ? <Check size={12} /> : <Copy size={12} />}
            {copiedCSS ? 'Copied!' : 'Copy CSS'}
          </button>
          <button type="button" className="fs-pill" onClick={handleCopyReact}>
            {copiedReact ? <Check size={12} /> : <FileCode2 size={12} />}
            {copiedReact ? 'Copied!' : 'React Component'}
          </button>
          <button type="button" className="fs-pill" onClick={handleCopySpecs}>
            <Maximize size={12} /> Design Specs
          </button>
        </div>
      </div>
    </div>
  )
}
