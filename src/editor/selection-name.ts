/** "button.btn" → Button, "h2.title" → Heading: what a person calls the thing. */
const KIND_BY_TAG: Record<string, string> = {
  h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
  p: 'Paragraph', span: 'Text', strong: 'Text', em: 'Text', small: 'Text', b: 'Text', i: 'Text', label: 'Label',
  a: 'Link', button: 'Button', img: 'Image', picture: 'Image', svg: 'Icon', video: 'Video',
  section: 'Section', header: 'Header', footer: 'Footer', nav: 'Navigation', main: 'Main', aside: 'Sidebar', article: 'Article',
  div: 'Box', ul: 'List', ol: 'List', li: 'List item', form: 'Form', input: 'Field', textarea: 'Field', select: 'Dropdown',
  table: 'Table', tr: 'Row', td: 'Cell', th: 'Cell', blockquote: 'Quote', figure: 'Figure', figcaption: 'Caption',
}

export function describeSelection(label: string) {
  const [tag = '', ...rest] = label.trim().split('.')
  const kind = KIND_BY_TAG[tag.toLowerCase()] ?? (tag ? tag[0].toUpperCase() + tag.slice(1) : 'Element')
  return { kind, detail: rest.length ? `.${rest.join('.')}` : '' }
}

/** "109.625px" → "109.6px": lengths as a person reads them. Words ("auto") pass through. */
export function tidyLength(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/-?\d+\.\d{2,}/g, (number) => String(Math.round(Number(number) * 10) / 10))
}
