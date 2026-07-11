import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  Code,
  Eye,
  EyeOff,
  Image,
  Layers,
  SquareDashedBottom,
  Type,
  Search,
  RefreshCw,
  MousePointer2,
} from 'lucide-react'

type LayerNode = {
  element: HTMLElement
  path: string
  tag: string
  label: string
  kind: 'element' | 'shape' | 'stamp'
  className: string
  depth: number
  hidden: boolean
  hasChildren: boolean
  childCount: number
}

type Props = {
  layers: LayerNode[]
  selectedPath: string | null
  selections: { path: string }[]
  onSelectLayer: (node: LayerNode) => void
  onToggleVisibility: (node: LayerNode) => void
  onRefresh: () => void
  routeKey: string
}

function getElementIcon(tag: string) {
  switch (tag) {
    case 'img':
      return <Image size={12} />
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
    case 'p': case 'span': case 'a': case 'label': case 'strong': case 'em':
      return <Type size={12} />
    case 'section': case 'article': case 'div': case 'main': case 'aside':
      return <SquareDashedBottom size={12} />
    case 'button':
      return <MousePointer2 size={12} />
    default:
      return <Code size={12} />
  }
}

function getLayerIcon(node: LayerNode) {
  if (node.kind === 'stamp') return <Layers size={12} />
  if (node.kind === 'shape') return <SquareDashedBottom size={12} />
  return getElementIcon(node.tag)
}

export default function FroamLayersPanel({
  layers,
  selectedPath,
  selections,
  onSelectLayer,
  onToggleVisibility,
  onRefresh,
  routeKey,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const selectedPaths = useMemo(
    () => new Set(selections.map((s) => s.path)),
    [selections],
  )

  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return layers
    const q = searchQuery.toLowerCase()
    return layers.filter(
      (n) =>
        n.tag.includes(q) ||
        n.label.toLowerCase().includes(q) ||
        n.kind.includes(q) ||
        n.className.toLowerCase().includes(q) ||
        n.path.toLowerCase().includes(q),
    )
  }, [layers, searchQuery])

  const toggleCollapse = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Determine which layers should be visible given collapsed state
  const visibleLayers = useMemo(() => {
    if (searchQuery.trim()) return filteredLayers

    const result: LayerNode[] = []
    const collapsedPrefixes: string[] = []

    for (const node of filteredLayers) {
      // Check if any collapsed parent hides this node
      const isHiddenByParent = collapsedPrefixes.some((prefix) =>
        node.path.startsWith(prefix + '/'),
      )
      if (isHiddenByParent) continue

      result.push(node)

      // If this node is collapsed, track its prefix
      if (collapsed.has(node.path) && node.hasChildren) {
        collapsedPrefixes.push(node.path)
      }
    }

    return result
  }, [filteredLayers, collapsed, searchQuery])

  return (
    <div className="froam-lp" data-chef-editor-root="true">
      {/* Header */}
      <div className="froam-lp__header" data-chef-editor-root="true">
        <div className="froam-lp__header-title">
          <Layers size={14} />
          <span>Layers</span>
        </div>
        <button
          type="button"
          className="froam-lp__header-btn"
          onClick={onRefresh}
          title="Refresh layers"
          data-chef-editor-root="true"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Route info */}
      <div className="froam-lp__route" data-chef-editor-root="true">
        <span className="froam-lp__route-dot" />
        <span>{routeKey}</span>
        {selections.length > 1 && (
          <span className="froam-lp__selection-count">{selections.length} selected</span>
        )}
      </div>

      {/* Search */}
      <div className="froam-lp__search" data-chef-editor-root="true">
        <Search size={12} />
        <input
          type="text"
          className="froam-lp__search-input"
          placeholder="Search layers…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-chef-editor-root="true"
        />
      </div>

      {/* Layer tree */}
      <div className="froam-lp__tree" data-chef-editor-root="true">
        {visibleLayers.length === 0 ? (
          <div className="froam-lp__empty">
            <Layers size={20} />
            <span>No layers found</span>
          </div>
        ) : (
          visibleLayers.map((node) => {
            const isSelected = selectedPath === node.path || selectedPaths.has(node.path)
            const isCollapsed = collapsed.has(node.path)

            return (
              <div
                key={node.path}
                className={`froam-lp__node ${isSelected ? 'is-selected' : ''} ${node.hidden ? 'is-hidden-layer' : ''}`}
                style={{ paddingLeft: `${12 + node.depth * 16}px` }}
                onClick={() => onSelectLayer(node)}
                data-chef-editor-root="true"
              >
                {/* Expand/collapse toggle */}
                {node.hasChildren ? (
                  <button
                    type="button"
                    className="froam-lp__expand-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCollapse(node.path)
                    }}
                    data-chef-editor-root="true"
                  >
                    <ChevronRight
                      size={10}
                      style={{
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        transition: 'transform 120ms ease',
                      }}
                    />
                  </button>
                ) : (
                  <span className="froam-lp__expand-spacer" />
                )}

                {/* Element icon */}
                <span className={`froam-lp__node-icon ${node.kind === 'stamp' ? 'is-stamp' : ''}`}>
                  {getLayerIcon(node)}
                </span>

                {/* Element name */}
                <span className="froam-lp__node-tag">{node.label}</span>
                {node.kind === 'stamp' && (
                  <span className="froam-lp__node-badge">stamp</span>
                )}
                {node.className && (
                  <span className="froam-lp__node-class">
                    .{node.className.replace(/ /g, '.')}
                  </span>
                )}

                {/* Right side: visibility */}
                <div className="froam-lp__node-actions">
                  <button
                    type="button"
                    className={`froam-lp__vis-btn ${node.hidden ? 'is-hidden' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleVisibility(node)
                    }}
                    title={node.hidden ? 'Show' : 'Hide'}
                    data-chef-editor-root="true"
                  >
                    {node.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export type { LayerNode }
