/* ===============================================================
   FROAM STUDIO v4 — media / input-modality detection
   Two independent signals drive the mobile experience:
   - MOBILE_UI_QUERY  → compact chrome (bottom sheet, drawer, slim toolbar)
   - COARSE_POINTER_QUERY → touch behaviors (long-press, big hit targets)
   A narrow desktop window gets the mobile chrome without touch behaviors;
   an iPad gets touch behaviors while keeping the desktop chrome.
   =============================================================== */
import { useEffect, useState } from 'react'

export const MOBILE_UI_QUERY = '(max-width: 768px)'
export const COARSE_POINTER_QUERY = '(pointer: coarse)'

export function matchesMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesMedia(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    // Safari < 14 fallback
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [query])

  return matches
}
