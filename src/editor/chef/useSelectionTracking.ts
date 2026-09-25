import { useEffect, type Dispatch, type SetStateAction } from 'react'

type Ref<T> = { current: T }

/**
 * Keeps the selection's handles, size badge and floating bar on the element
 * they belong to. The rect they're drawn from was only measured when the
 * selection changed — so scrolling the page, opening a panel (the page
 * reflows into the space left) or anything above it growing left them
 * floating over the wrong content.
 *
 * Remeasures on scroll (any scroller, captured), window resize, and size
 * changes of the page or the element itself; at most once per frame, and
 * only publishes a rect that actually changed.
 */
export function useSelectionTracking(
  active: boolean,
  currentSelectionRef: Ref<HTMLElement | null>,
  setSelectionRect: Dispatch<SetStateAction<DOMRect | null>>,
) {
  useEffect(() => {
    if (!active) return
    let frame = 0
    let last = ''
    let observed: Element | null = null

    const sync = () => {
      frame = 0
      const element = currentSelectionRef.current
      if (element !== observed) {
        if (observed) resize?.unobserve(observed)
        if (element) resize?.observe(element)
        observed = element
      }
      if (!element || !element.isConnected) return
      const rect = element.getBoundingClientRect()
      const key = `${rect.x}|${rect.y}|${rect.width}|${rect.height}`
      if (key === last) return
      last = key
      setSelectionRect(rect)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync)
    }

    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resize?.observe(document.documentElement)
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    // Selection changes arrive through React state elsewhere; pick up the new
    // element (and its observer) on the next pointer or key input.
    window.addEventListener('pointerup', schedule, { capture: true, passive: true })
    window.addEventListener('keyup', schedule, { capture: true, passive: true })
    schedule()

    return () => {
      cancelAnimationFrame(frame)
      resize?.disconnect()
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pointerup', schedule, { capture: true })
      window.removeEventListener('keyup', schedule, { capture: true })
    }
  }, [active, currentSelectionRef, setSelectionRect])
}
