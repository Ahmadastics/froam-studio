/**
 * Component-aware editing.
 *
 * Reads React's internal fiber tree (attached to DOM nodes) to name the
 * component that owns an element and find that component's root DOM node.
 * This lets Froam say "you're editing <TaskCard>" and snap selection to a
 * component boundary — so designs survive refactors, because they're
 * anchored to a component, not a brittle DOM path.
 *
 * Entirely best-effort and read-only: every access is guarded, and if the
 * host isn't React (or internals change) the features simply go quiet.
 */

type Fiber = {
  type?: unknown
  elementType?: unknown
  tag?: number
  return?: Fiber | null
  child?: Fiber | null
  stateNode?: unknown
  _debugOwner?: Fiber | null
}

function getFiber(node: Node): Fiber | null {
  for (const key in node) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      return (node as unknown as Record<string, Fiber>)[key] ?? null
    }
  }
  return null
}

function componentNameOf(type: unknown): string | null {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string }
    const name = fn.displayName || fn.name
    return name && /^[A-Z]/.test(name) ? name : null
  }
  if (type && typeof type === 'object') {
    const obj = type as { displayName?: string; render?: { displayName?: string; name?: string }; type?: unknown }
    if (obj.displayName && /^[A-Z]/.test(obj.displayName)) return obj.displayName
    // React.memo / forwardRef wrappers
    if (obj.render) {
      const inner = obj.render.displayName || obj.render.name
      if (inner && /^[A-Z]/.test(inner)) return inner
    }
    if (obj.type) return componentNameOf(obj.type)
  }
  return null
}

export type ComponentInfo = {
  name: string
  /** DOM node that is the outermost element rendered by that component. */
  rootEl: HTMLElement | null
}

/**
 * Nearest named component owning `el`, plus that component's root element.
 * Skips generic host wrappers and Froam's own components.
 */
export function nearestComponent(el: HTMLElement): ComponentInfo | null {
  try {
    let fiber = getFiber(el)
    if (!fiber) return null

    // Walk up the fiber tree to the first function/class component with a name.
    let owner: Fiber | null = fiber
    let name: string | null = null
    while (owner) {
      const candidate = componentNameOf(owner.type ?? owner.elementType)
      if (candidate && !/^Froam|^GlobalChef|^Router|^Route$|Provider$|Boundary$|^Suspense$/.test(candidate)) {
        name = candidate
        break
      }
      owner = owner.return ?? null
    }
    if (!name || !owner) return null

    // Find the outermost DOM node rendered by that component fiber.
    let rootEl: HTMLElement | null = null
    const stack: Fiber[] = [owner]
    while (stack.length) {
      const f = stack.shift()!
      if (f.stateNode instanceof HTMLElement) { rootEl = f.stateNode; break }
      let c = f.child ?? null
      while (c) { stack.push(c); c = null } // only first child chain
      if (f.child) stack.push(f.child)
    }

    return { name, rootEl }
  } catch {
    return null
  }
}

/** Full ancestor chain of named components, outermost last. For a breadcrumb. */
export function componentAncestry(el: HTMLElement, limit = 6): string[] {
  try {
    let fiber = getFiber(el)
    const names: string[] = []
    let seen = ''
    while (fiber && names.length < limit) {
      const name = componentNameOf(fiber.type ?? fiber.elementType)
      if (name && name !== seen && !/^Froam|^GlobalChef|Provider$|Boundary$|^Suspense$|^Router/.test(name)) {
        names.push(name)
        seen = name
      }
      fiber = fiber.return ?? null
    }
    return names
  } catch {
    return []
  }
}
