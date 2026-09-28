import { useEffect, useRef } from 'react'
import { isFroamPersonaPath } from '../froamPersona'
import { findElementByPath, isBodyScopedPath, isFroamOwnedNode, isInPageScope } from '../../collab/paths'
import { getRoot } from './dom'
import { applyCanvasDraftStyles, applyDraft, isInjectionPath, isSectionStructurePath } from './drafts'
import { clearPseudoPaint, paintPseudoElements } from './pseudo'
import { restorePageText } from '../draft-text'
import { CANVAS_KEY, type ElementDraft } from './types'

type Ref<T> = { current: T }

export type UseDraftPainterOptions = {
  hasRouteDrafts: boolean
  routeDrafts: Record<string, ElementDraft>
  viewportStoreKey: string
  suspendDraftPaintingRef: Ref<boolean>
  applySectionStructure: (routeDraftsToApply: Record<string, ElementDraft>) => void
  restoreInjectedBlocks: (routeDraftsToApply: Record<string, ElementDraft>) => void
}

/**
 * Keeps this route's drafts on the page: painted once, then again whenever the
 * page's own DOM changes under them (React re-renders, late content). The
 * painter's own writes are not page changes — see draft-text.ts.
 */
export function useDraftPainter({ hasRouteDrafts, routeDrafts, viewportStoreKey, suspendDraftPaintingRef, applySectionStructure, restoreInjectedBlocks }: UseDraftPainterOptions) {
  // Text drafts painted last time, per page and screen size. One that is gone
  // now (undo, revert, a teammate's change taken back) must unpaint — a
  // removed draft otherwise leaves its words on screen until a reload.
  const paintedTextRef = useRef<{ key: string; paths: Set<string> }>({ key: viewportStoreKey, paths: new Set() })
  useEffect(() => {
    const now = new Set(Object.entries(routeDrafts).filter(([, draft]) => typeof draft?.text === 'string').map(([path]) => path))
    const before = paintedTextRef.current
    if (before.key === viewportStoreKey) {
      const root = getRoot()
      if (root) {
        for (const path of before.paths) {
          if (now.has(path)) continue
          const target = findElementByPath(root, path)
          if (target) restorePageText(target)
        }
      }
    }
    paintedTextRef.current = { key: viewportStoreKey, paths: now }
  }, [routeDrafts, viewportStoreKey])

  useEffect(() => {
    if (!hasRouteDrafts) {
      clearPseudoPaint()
      return
    }
    const root = getRoot()
    if (!root) return
    const rootElement = root

    function paintDrafts() {
      try {
        if (suspendDraftPaintingRef.current) return
        applySectionStructure(routeDrafts)
        restoreInjectedBlocks(routeDrafts)
        Object.entries(routeDrafts).forEach(([path, draft]) => {
          if (path === CANVAS_KEY || isInjectionPath(path) || isSectionStructurePath(path) || isFroamPersonaPath(path)) return
          const target = findElementByPath(rootElement, path)
          if (target) applyDraft(target, draft)
        })
        paintPseudoElements(rootElement, routeDrafts)
        const canvasDraft = routeDrafts[CANVAS_KEY]
        applyCanvasDraftStyles(canvasDraft?.styles?.backgroundColor, canvasDraft?.styles?.color, canvasDraft?.styles)
      } catch {
        // Safe to ignore, element likely removed by React
      } finally {
        // Painting mutates the root too; those records are ours, not the
        // page's — left queued they'd schedule the next paint, every frame.
        observer.takeRecords()
      }
    }

    // Defer initial paint to avoid running synchronously during React commit phase
    let paintFrame = requestAnimationFrame(paintDrafts)

    const body = document.body
    const observer = new MutationObserver((records) => {
      if (records.every(isFroamRecord)) return
      cancelAnimationFrame(paintFrame)
      paintFrame = requestAnimationFrame(paintDrafts)
    })
    // Drafts on content beside the root (a portal's modal) need <body> watched
    // too: the modal mounts there, long after the first paint.
    const watchBody = rootElement !== body && Object.keys(routeDrafts).some(isBodyScopedPath)
    observer.observe(watchBody ? body : rootElement, { childList: true, subtree: true })

    /** Froam's own UI updates constantly; its changes are not the page's. */
    function isFroamRecord(record: MutationRecord) {
      if (!watchBody) return false
      if (record.target === body) {
        const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
        return nodes.every((node) => !(node instanceof Element) || isFroamOwnedNode(node))
      }
      return record.target instanceof Element && !isInPageScope(record.target, rootElement)
    }

    return () => {
      cancelAnimationFrame(paintFrame)
      observer.disconnect()
    }
  }, [hasRouteDrafts, routeDrafts, viewportStoreKey])
}
