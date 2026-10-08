import { isFroamOwnedNode, isInPageScope } from '../../collab/paths'

/**
 * The few page elements the editor has to know about by their computed style:
 * click-through layers (`pointer-events: none`, see hit-test.ts) and pinned
 * ones (`position: sticky | fixed`, see usePageCanvasOffset.ts).
 *
 * Nothing but a computed style says which elements those are, and a page can
 * have tens of thousands of elements. Both used to read every element's style
 * again after any change on the page — every edit, every typed word — and
 * each scan forced a full relayout. Here one scan runs when the page is idle,
 * then only the subtree a change touched is read again: an edit to one
 * element re-reads that element, not the page.
 */
export type PageStyleIndex = {
  clickThrough: ReadonlySet<HTMLElement>
  pinned: ReadonlySet<HTMLElement>
}

type Listener = (index: PageStyleIndex, changed: { clickThrough: boolean; pinned: boolean }) => void

type Shared = {
  listeners: Set<Listener>
  index: PageStyleIndex | null
  dispose: () => void
  disposeTimer: number
}

const shared = new WeakMap<HTMLElement, Shared>()

/** Get the index for `root` now and on every change. Returns unsubscribe. */
export function subscribePageStyles(root: HTMLElement, listener: Listener): () => void {
  let entry = shared.get(root)
  if (!entry) {
    entry = createIndex(root)
    shared.set(root, entry)
  }
  window.clearTimeout(entry.disposeTimer)
  entry.listeners.add(listener)
  if (entry.index) listener(entry.index, { clickThrough: true, pinned: true })
  const current = entry
  return () => {
    current.listeners.delete(listener)
    if (current.listeners.size) return
    // An editor effect re-subscribes right after it cleans up (a dependency
    // changed): keep the index for that instead of scanning the page again.
    current.disposeTimer = window.setTimeout(() => {
      if (current.listeners.size) return
      current.dispose()
      if (shared.get(root) === current) shared.delete(root)
    }, 2000)
  }
}

const whenIdle = (fn: () => void, timeout: number) => {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback
  if (idle) {
    const id = idle(fn, { timeout })
    return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, Math.min(timeout, 120))
  return () => window.clearTimeout(id)
}

function createIndex(root: HTMLElement): Shared {
  const doc = root.ownerDocument
  const body = doc.body
  // With an app root (#root, <main>), content also lives beside it on <body>.
  const base = root === body || !body ? root : body
  const clickThrough = new Set<HTMLElement>()
  const pinned = new Set<HTMLElement>()
  let changedClickThrough = false
  let changedPinned = false

  function check(el: HTMLElement) {
    const style = window.getComputedStyle(el)
    const none = style.pointerEvents === 'none'
    if (none !== clickThrough.has(el)) {
      if (none) clickThrough.add(el)
      else clickThrough.delete(el)
      changedClickThrough = true
    }
    const pin = style.position === 'sticky' || style.position === 'fixed'
    if (pin !== pinned.has(el)) {
      if (pin) pinned.add(el)
      else pinned.delete(el)
      changedPinned = true
    }
  }

  /**
   * Visit page elements under `parent`, carrying what an ancestor already
   * decided: inside the root, or beside it under something Froam owns.
   * (One pass, instead of a closest() and a scope walk per element.)
   */
  function walk(parent: Element, inRoot: boolean, owned: boolean) {
    const rootIsPage = root.getAttribute('data-froam-root') === 'page'
    const stack: Array<[Element, boolean, boolean]> = [[parent, inRoot, owned]]
    while (stack.length) {
      const [node, within, froam] = stack.pop()!
      for (let child = node.lastElementChild; child; child = child.previousElementSibling) {
        if (child.getAttribute('data-chef-editor-root') === 'true') continue
        const childWithin = within || child === root
        const childOwned = froam || isFroamOwnedNode(child)
        if ((childWithin || (!rootIsPage && !childOwned)) && (child instanceof HTMLElement)) check(child)
        stack.push([child, childWithin, childOwned])
      }
    }
  }

  function scanAll() {
    for (const el of clickThrough) if (!el.isConnected) { clickThrough.delete(el); changedClickThrough = true }
    for (const el of pinned) if (!el.isConnected) { pinned.delete(el); changedPinned = true }
    walk(base, base === root, false)
  }

  /** Re-read one changed element and everything inside it (classes reach descendants). */
  function scanSubtree(el: Element) {
    if (!el.isConnected || !base.contains(el) || el.closest('[data-chef-editor-root="true"]')) return
    const inRoot = root.contains(el)
    if (el instanceof HTMLElement && el !== base && isInPageScope(el, root)) check(el)
    walk(el, inRoot, !inRoot && !isInPageScope(el, root))
  }

  function notify() {
    if (!changedClickThrough && !changedPinned) return
    const changed = { clickThrough: changedClickThrough, pinned: changedPinned }
    changedClickThrough = false
    changedPinned = false
    entry.index = { clickThrough, pinned }
    for (const listener of entry.listeners) listener(entry.index, changed)
  }

  let pending = new Set<Element>()
  let full = true
  let cancel = whenIdle(flush, 300)

  function flush() {
    cancel = () => {}
    if (full) {
      full = false
      pending.clear()
      scanAll()
    } else {
      const roots = [...pending]
      pending = new Set()
      for (const el of clickThrough) if (!el.isConnected) { clickThrough.delete(el); changedClickThrough = true }
      for (const el of pinned) if (!el.isConnected) { pinned.delete(el); changedPinned = true }
      // An element inside another changed one is read with it.
      const changedRoots = new Set(roots)
      for (const el of roots) {
        let covered = false
        for (let up = el.parentElement; up && !covered; up = up.parentElement) covered = changedRoots.has(up)
        if (!covered) scanSubtree(el)
      }
    }
    if (!entry.index) {
      entry.index = { clickThrough, pinned }
      changedClickThrough = true
      changedPinned = true
    }
    notify()
  }

  function schedule() {
    cancel()
    cancel = whenIdle(flush, 400)
  }

  const observer = new MutationObserver((records) => {
    let touched = false
    for (const record of records) {
      const target = record.target
      if (record.type === 'attributes') {
        if (!(target instanceof Element) || target.closest('[data-chef-editor-root="true"]')) continue
        if (target === base || target === root || target === doc.documentElement) full = true
        else pending.add(target)
        touched = true
        continue
      }
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element) || node.getAttribute('data-chef-editor-root') === 'true') continue
        if (target === body && isFroamOwnedNode(node)) continue
        pending.add(node)
        touched = true
      }
      if (record.removedNodes.length) touched = true
    }
    if (touched) schedule()
  })
  observer.observe(base, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })

  const entry: Shared = {
    listeners: new Set(),
    index: null,
    disposeTimer: 0,
    dispose: () => {
      cancel()
      observer.disconnect()
    },
  }
  return entry
}
