/**
 * Froam — a minimal HTML tree for Node.
 *
 * Every Froam edit is keyed by a DOM path (`tag:n/tag:n/...`), which only means
 * anything relative to a parsed document. In the browser that document is free.
 * In a terminal — `froam check`, a CI job, a pre-commit hook — there isn't one,
 * and pulling in a full DOM implementation to answer "does this path still
 * point at the same element?" is a lot of dependency for a very small question.
 *
 * So this is the smallest parser that can answer it: an element tree with tag,
 * id, class and text, and nothing else. No layout, no CSS, no scripting, no
 * mutation. It exists to be *walked*.
 *
 * The one hard requirement is that the tree it produces indexes the same way a
 * browser's does, because a path computed here has to mean what it means there.
 * That is why implied end tags are handled at all: `<ul><li>a<li>b</ul>` is two
 * sibling `li` elements in a browser, and a parser that nests them would report
 * every list edit in a project as drift.
 *
 * Known boundary: implied closing is handled at the top of the open-element
 * stack, not through HTML5's full "in scope" algorithm, and none of the table
 * foster-parenting rules are implemented. Well-formed HTML — which is what
 * frameworks emit — parses identically; pathological soup may not. `froam
 * check` treats that as a reason to say nothing rather than to report drift.
 */

/** Elements that never have children, so they never open a scope. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/**
 * Elements whose content is text, not markup — `<script>if (a<b) {}</script>`.
 *
 * Split because the HTML spec treats them differently: `script` and `style` are
 * raw text where `&amp;` stays five characters, while `textarea` and `title`
 * are escapable raw text where it is one.
 */
const RAW_TEXT_TAGS = new Set(['script', 'style'])
const ESCAPABLE_RAW_TEXT_TAGS = new Set(['textarea', 'title'])

const TABLE_SECTIONS = new Set(['tbody', 'thead', 'tfoot'])
const CELL_TAGS = new Set(['td', 'th'])
/** Tags that need a `<tbody>` around them when written straight into a table. */
const TABLE_SECTION_PARENTS = new Set(['tr', 'td', 'th'])

/** A `<p>` is closed by the next block-level thing, per the HTML spec. */
const P_CLOSERS = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol',
  'p', 'pre', 'section', 'table', 'ul',
])

/**
 * Does opening `next` implicitly close an already-open `open`?
 *
 * Only consulted against the *top* of the stack, so an intervening element
 * stops the search — `<li><ul><li>` correctly nests, because the top is `ul`
 * and a `li` does not close a `ul`.
 */
function closedByOpening(open, next) {
  switch (open) {
    case 'li': return next === 'li'
    case 'dt': case 'dd': return next === 'dt' || next === 'dd'
    case 'option': return next === 'option' || next === 'optgroup'
    case 'optgroup': return next === 'optgroup'
    case 'tr': return next === 'tr'
    case 'td': case 'th': return next === 'td' || next === 'th' || next === 'tr'
    case 'thead': case 'tbody': return next === 'tbody' || next === 'tfoot'
    case 'p': return P_CLOSERS.has(next)
    default: return false
  }
}

/**
 * Character references, because a fingerprint compares text.
 *
 * `textContent` in a browser is decoded — a footer written `&copy; Run'Am` reads
 * back as `© Run'Am`. Leave it encoded here and every element containing an
 * `&nbsp;` or an `&amp;` looks like a different element, which is drift
 * reported on a page nobody touched.
 *
 * The numeric forms are handled completely. The named set is the practical
 * subset that appears in page copy rather than all ~2,200 HTML5 names; an
 * unrecognised reference is left exactly as written, which is also what a
 * browser does with one that isn't real.
 */
/**
 * The HTML names for U+00A0-U+00FF, in code-point order.
 *
 * Built from the order rather than written out as literal characters: much of
 * this range is invisible or looks identical to something else in a source file
 * -- `nbsp` against a plain space being the one that actually bites -- and a
 * list of names stays reviewable where a list of glyphs does not.
 */
const LATIN1_ENTITY_NAMES = (
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr '
  + 'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest '
  + 'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml '
  + 'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig '
  + 'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml '
  + 'eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ')

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  trade: '™', permil: '‰', euro: '€',
  hellip: '…', mdash: '—', ndash: '–', minus: '−',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  sbquo: '‚', bdquo: '„', bull: '•', dagger: '†', Dagger: '‡',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '‌', zwj: '‍',
}

for (const [index, name] of LATIN1_ENTITY_NAMES.entries()) {
  NAMED_ENTITIES[name] = String.fromCharCode(0xa0 + index)
}

const ENTITY_RE = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g

export function decodeEntities(value) {
  if (!value.includes('&')) return value
  return value.replace(ENTITY_RE, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return match
      try { return String.fromCodePoint(code) } catch { return match }
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

function createElement(tag, attrs, parent) {
  const node = {
    type: 'element',
    tag,
    attrs,
    id: typeof attrs.id === 'string' ? attrs.id : '',
    className: typeof attrs.class === 'string' ? attrs.class : '',
    parent,
    /** Mixed text + element children, in document order — `textContent` needs it. */
    childNodes: [],
    /** Element children only, which is what path indexing counts. */
    children: [],
  }
  if (parent) {
    parent.childNodes.push(node)
    parent.children.push(node)
  }
  return node
}

const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttributes(source) {
  const attrs = {}
  ATTR_RE.lastIndex = 0
  let match = ATTR_RE.exec(source)
  while (match) {
    const name = match[1].toLowerCase()
    // A repeated attribute keeps its first value, as the HTML parser does.
    if (!(name in attrs)) attrs[name] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? '')
    match = ATTR_RE.exec(source)
  }
  return attrs
}

/**
 * Parse HTML into an element tree.
 *
 * Returns a synthetic `#document` root; the real page root is normally found
 * with `resolveFroamRoot`.
 */
export function parseHtml(html) {
  const source = String(html ?? '')
  const document = createElement('#document', {}, null)
  const stack = [document]
  const top = () => stack[stack.length - 1]

  const addText = (value) => {
    if (!value) return
    top().childNodes.push({ type: 'text', value: decodeEntities(value) })
  }

  let index = 0
  while (index < source.length) {
    const lt = source.indexOf('<', index)
    if (lt === -1) {
      addText(source.slice(index))
      break
    }
    addText(source.slice(index, lt))

    // Comments, doctypes and processing instructions carry nothing we index.
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4)
      index = end === -1 ? source.length : end + 3
      continue
    }
    if (source.startsWith('<!', lt) || source.startsWith('<?', lt)) {
      const end = source.indexOf('>', lt)
      index = end === -1 ? source.length : end + 1
      continue
    }

    if (source.startsWith('</', lt)) {
      const end = source.indexOf('>', lt)
      if (end === -1) { addText(source.slice(lt)); break }
      const tag = source.slice(lt + 2, end).trim().toLowerCase().split(/[\s/]/)[0]
      // Pop to the nearest matching ancestor. A stray `</div>` with nothing
      // open to match is discarded rather than unwinding the whole document.
      const at = stack.findLastIndex((node) => node.tag === tag)
      if (at > 0) stack.length = at
      index = end + 1
      continue
    }

    const end = source.indexOf('>', lt)
    if (end === -1) { addText(source.slice(lt)); break }
    const inner = source.slice(lt + 1, end)
    const nameMatch = /^([a-zA-Z][^\s/>]*)/.exec(inner)
    if (!nameMatch) {
      // `<` that isn't markup — `a < b` in body text.
      addText(source.slice(lt, end + 1))
      index = end + 1
      continue
    }

    const tag = nameMatch[1].toLowerCase()
    const selfClosing = inner.endsWith('/')
    const attrs = parseAttributes(inner.slice(nameMatch[1].length).replace(/\/$/, ''))

    while (stack.length > 1 && closedByOpening(top().tag, tag)) stack.pop()

    // Browsers synthesise the table sections nobody writes: `<table><tr>` really
    // means `<table><tbody><tr>`. Skip this and every path inside any table is
    // one level short of what the editor recorded, which reads as drift on a
    // page nobody touched. Caught by diffing this parser against Chrome.
    if (TABLE_SECTION_PARENTS.has(tag) && top().tag === 'table') {
      stack.push(createElement('tbody', {}, top()))
    }
    if (CELL_TAGS.has(tag) && TABLE_SECTIONS.has(top().tag)) {
      stack.push(createElement('tr', {}, top()))
    }

    const element = createElement(tag, attrs, top())
    index = end + 1

    if (VOID_TAGS.has(tag) || selfClosing) continue

    if (RAW_TEXT_TAGS.has(tag) || ESCAPABLE_RAW_TEXT_TAGS.has(tag)) {
      const closeAt = source.toLowerCase().indexOf(`</${tag}`, index)
      const textEnd = closeAt === -1 ? source.length : closeAt
      if (textEnd > index) {
        const raw = source.slice(index, textEnd)
        element.childNodes.push({ type: 'text', value: ESCAPABLE_RAW_TEXT_TAGS.has(tag) ? decodeEntities(raw) : raw })
      }
      if (closeAt === -1) { index = source.length; continue }
      const closeEnd = source.indexOf('>', closeAt)
      index = closeEnd === -1 ? source.length : closeEnd + 1
      continue
    }

    stack.push(element)
  }

  return document
}

/** Mirrors `Node.textContent` — everything below, including script and style. */
export function textContent(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value
  let out = ''
  for (const child of node.childNodes) out += textContent(child)
  return out
}

const BODY_PREFIX = '@body/'

function isWithin(node, ancestor) {
  for (let current = node; current; current = current.parent) if (current === ancestor) return true
  return false
}

/** The <body> of the document a node belongs to. */
function bodyOf(node) {
  let top = node
  while (top.parent) top = top.parent
  return queryFirstByTag(top, 'body') ?? top
}

/** Mirrors `src/collab/paths.ts` `getElementPath` (content beside the root gets `@body/`). */
export function getElementPath(element, root) {
  if (!isWithin(element, root)) {
    const body = bodyOf(root)
    if (body !== root && isWithin(element, body)) return BODY_PREFIX + getElementPath(element, body)
  }
  const segments = []
  let current = element
  while (current && current !== root) {
    const parent = current.parent
    if (!parent) break
    const siblings = parent.children.filter((child) => child.tag === current.tag)
    const index = Math.max(1, siblings.indexOf(current) + 1)
    segments.unshift(`${current.tag}:${index}`)
    current = parent
  }
  return segments.join('/')
}

/** Mirrors `src/collab/paths.ts` `findElementByPath`. */
export function findElementByPath(root, path) {
  if (typeof path !== 'string' || !path.trim() || !path.includes(':')) return null
  const fromBody = path.startsWith(BODY_PREFIX)
  const segments = (fromBody ? path.slice(BODY_PREFIX.length) : path).split('/').filter(Boolean)
  let current = fromBody ? bodyOf(root) : root
  for (const segment of segments) {
    if (!current) return null
    const [tag, position] = segment.split(':')
    const index = Math.max(0, Number(position) - 1)
    const next = current.children.filter((child) => child.tag === tag)[index]
    if (!next) return null
    current = next
  }
  return current
}

/** Descendants only, like `root.querySelectorAll(tag)`. */
export function queryAllByTag(root, tag) {
  const found = []
  const walk = (node) => {
    for (const child of node.children) {
      if (child.tag === tag) found.push(child)
      walk(child)
    }
  }
  walk(root)
  return found
}

/** Descendants only, first match wins, like `root.querySelector('#id')`. */
export function queryById(root, id) {
  if (!id) return null
  const walk = (node) => {
    for (const child of node.children) {
      if (child.id === id) return child
      const nested = walk(child)
      if (nested) return nested
    }
    return null
  }
  return walk(root)
}

export function queryFirstByTag(root, tag) {
  return queryAllByTag(root, tag)[0] ?? null
}

function queryFirstWithAttribute(root, attribute) {
  const walk = (node) => {
    for (const child of node.children) {
      if (attribute in child.attrs) return child
      const nested = walk(child)
      if (nested) return nested
    }
    return null
  }
  return walk(root)
}

/**
 * Mirrors the root resolution in `src/config.ts` and the generated runtime:
 * `[data-froam-root]`, then `#root`, `#__next`, `main`, `body`.
 *
 * Returns the element plus *how* it was found, because that distinction is
 * load-bearing for `froam check`: the generated CSS only scopes to
 * `[data-froam-root], #root, #__next`, so a page that falls through to `main`
 * or `body` is relying on `froam.runtime.js` to stamp the attribute at load.
 */
export function resolveFroamRoot(document) {
  const byAttribute = queryFirstWithAttribute(document, 'data-froam-root')
  if (byAttribute) return { element: byAttribute, via: 'data-froam-root' }
  const byRootId = queryById(document, 'root')
  if (byRootId) return { element: byRootId, via: '#root' }
  const byNextId = queryById(document, '__next')
  if (byNextId) return { element: byNextId, via: '#__next' }
  const main = queryFirstByTag(document, 'main')
  if (main) return { element: main, via: 'main' }
  const body = queryFirstByTag(document, 'body')
  if (body) return { element: body, via: 'body' }
  return { element: document, via: 'document' }
}
