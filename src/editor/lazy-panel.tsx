import { lazy, Suspense, useRef, type ComponentType } from 'react'

/**
 * A panel whose code loads the first time it's wanted, not when the editor
 * opens. Most people never open Versions or Experiments in a session; they
 * shouldn't wait for them.
 *
 * `mountWhen` is for panels that stay mounted and hide themselves (they
 * return null while closed): nothing mounts — or downloads — until the first
 * time it says yes, and from then on the panel stays mounted, keeping its
 * state and its own closing behaviour exactly as before.
 */
export function lazyPanel<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  options: { mountWhen?: (props: P) => boolean } = {},
) {
  const Panel = lazy(load)
  function LazyPanel(props: P) {
    const wanted = useRef(false)
    if (!options.mountWhen || options.mountWhen(props)) wanted.current = true
    if (!wanted.current) return null
    return <Suspense fallback={null}><Panel {...props} /></Suspense>
  }
  return LazyPanel
}
