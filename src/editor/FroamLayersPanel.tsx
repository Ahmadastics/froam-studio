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
  ArrowUp,
  ArrowDown,
  Copy,
  FileOutput,
  Plus,
  Trash2,
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
  editorHidden: boolean
  exportHidden: boolean
  hasChildren: boolean
  childCount: number
  nodeId?: string
}

export type LayerKnowledge = {
  dna: boolean
  interactions: number
  responsive?: string
  archived: boolean
  graph: boolean
}

type Props = {
  layers: LayerNode[]
  selectedPath: string | null
  selections: { path: string }[]
  selectionCandidates: LayerNode[]
  onSelectLayer: (node: LayerNode) => void
  onToggleVisibility: (node: LayerNode) => void
  onAddSection: (node: LayerNode, placement: 'before' | 'after') => void
  onDuplicateSection: (node: LayerNode) => void
  onMoveSection: (node: LayerNode, direction: 'up' | 'down') => void
  canMoveSection: (node: LayerNode, direction: 'up' | 'down') => boolean
  onSetSectionVisibility: (node: LayerNode, scope: 'editor' | 'export') => void
  onDeleteSection: (node: LayerNode) => void
  onRefresh: () => void
  routeKey: string
  projectName: string
  branchName: string
  knowledgeByNodeId: Record<string, LayerKnowledge>
  onOpenKnowledge: (node: LayerNode, section: 'dna' | 'archive' | 'responsive' | 'interactions-create') => void
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
  selectionCandidates,
  onSelectLayer,
  onToggleVisibility,
  onAddSection,
  onDuplicateSection,
  onMoveSection,
  canMoveSection,
  onSetSectionVisibility,
  onDeleteSection,
  onRefresh,
  routeKey,
  projectName,
  branchName,
  knowledgeByNodeId,
  onOpenKnowledge,
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
        n.nodeId?.toLowerCase().includes(q) ||
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

  const selectedNode = layers.find((node) => node.path === selectedPath)
  const selectedSection = selectedNode && ['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'].includes(selectedNode.tag)
    ? selectedNode
    : null
  const selectedKnowledge = selectedNode?.nodeId ? knowledgeByNodeId[selectedNode.nodeId] : undefined
  const selectedTrail = useMemo(() => {
    if (!selectedPath) return []
    return layers
      .filter((node) => node.path === selectedPath || selectedPath.startsWith(`${node.path}/`))
      .sort((a, b) => a.depth - b.depth)
  }, [layers, selectedPath])
  const nearbyLayers = useMemo(() => {
    if (!selectedNode) return { parent: null, child: null, previous: null, next: null }
    const parentPath = selectedNode.path.split('/').slice(0, -1).join('/')
    const siblings = layers.filter((node) => node.depth === selectedNode.depth && node.path.split('/').slice(0, -1).join('/') === parentPath)
    const index = siblings.findIndex((node) => node.path === selectedNode.path)
    return {
      parent: selectedTrail.at(-2) ?? null,
      child: layers.find((node) => node.depth === selectedNode.depth + 1 && node.path.startsWith(`${selectedNode.path}/`)) ?? null,
      previous: index > 0 ? siblings[index - 1] : null,
      next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    }
  }, [layers, selectedNode, selectedTrail])
  const pointerStack = useMemo(() => {
    const unique: LayerNode[] = []
    for (const node of selectionCandidates) {
      if (!unique.some((item) => item.path === node.path)) unique.push(node)
    }
    if (!selectedPath || !unique.some((node) => node.path === selectedPath)) return []
    return unique
  }, [selectedPath, selectionCandidates])

  function moveTreeFocus(current: HTMLElement, direction: -1 | 1) {
    const items = Array.from(current.closest('[role="tree"]')?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])
    const index = items.indexOf(current)
    items[index + direction]?.focus()
  }

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
        <span className="froam-lp__route-copy"><strong>{projectName}</strong><small>{branchName} · {routeKey}</small></span>
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
      {selectedTrail.length > 0 && (
        <div className="froam-lp__breadcrumbs" aria-label="Selected layer path" data-chef-editor-root="true">
          {selectedTrail.map((node, index) => (
            <button
              type="button"
              key={node.path}
              className={node.path === selectedPath ? 'is-current' : ''}
              onClick={() => onSelectLayer(node)}
              title={node.path}
              data-chef-editor-root="true"
            >
              <span>{node.label}</span>
              {index < selectedTrail.length - 1 && <ChevronRight size={10} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {selectedNode && (
        <div className="froam-lp__ladder" role="toolbar" aria-label="Move through nearby layers" data-chef-editor-root="true">
          <button type="button" disabled={!nearbyLayers.parent} onClick={() => nearbyLayers.parent && onSelectLayer(nearbyLayers.parent)} title="Select parent layer">Parent</button>
          <button type="button" disabled={!nearbyLayers.previous} onClick={() => nearbyLayers.previous && onSelectLayer(nearbyLayers.previous)} title="Select previous sibling">Prev</button>
          <button type="button" disabled={!nearbyLayers.next} onClick={() => nearbyLayers.next && onSelectLayer(nearbyLayers.next)} title="Select next sibling">Next</button>
          <button type="button" disabled={!nearbyLayers.child} onClick={() => nearbyLayers.child && onSelectLayer(nearbyLayers.child)} title="Select first child layer">Child</button>
        </div>
      )}
      {pointerStack.length > 1 && (
        <div className="froam-lp__stack" data-chef-editor-root="true">
          <span>Under pointer</span>
          <div>
            {pointerStack.slice(0, 8).map((node) => (
              <button
                type="button"
                key={node.path}
                className={node.path === selectedPath ? 'is-current' : ''}
                onClick={() => onSelectLayer(node)}
                title={node.path}
                data-chef-editor-root="true"
              >
                {getLayerIcon(node)}
                <span>{node.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layer tree */}
      <div className="froam-lp__tree" role="tree" aria-label="Live page structure" data-chef-editor-root="true">
        {visibleLayers.length === 0 ? (
          <div className="froam-lp__empty">
            <Layers size={20} />
            <span>No layers found</span>
          </div>
        ) : (
          visibleLayers.map((node) => {
            const isSelected = selectedPath === node.path || selectedPaths.has(node.path)
            const isCollapsed = collapsed.has(node.path)
            const isSectionNode = ['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'].includes(node.tag)
            const knowledge = node.nodeId ? knowledgeByNodeId[node.nodeId] : undefined

            return (
              <div
                key={node.path}
                role="treeitem"
                aria-level={node.depth + 1}
                aria-selected={isSelected}
                aria-expanded={node.hasChildren ? !isCollapsed : undefined}
                tabIndex={isSelected ? 0 : -1}
                className={`froam-lp__node ${isSelected ? 'is-selected' : ''} ${node.hidden ? 'is-hidden-layer' : ''}`}
                style={{ paddingLeft: `${12 + node.depth * 16}px` }}
                onClick={() => onSelectLayer(node)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); moveTreeFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1) }
                  if (event.key === 'ArrowRight' && node.hasChildren && isCollapsed) { event.preventDefault(); toggleCollapse(node.path) }
                  if (event.key === 'ArrowLeft' && node.hasChildren && !isCollapsed) { event.preventDefault(); toggleCollapse(node.path) }
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectLayer(node) }
                }}
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
                {node.nodeId && <span className="froam-lp__node-badge is-identity" title={node.nodeId}>id</span>}
                {knowledge?.dna && <span className="froam-lp__node-signal" title="DNA captured">D</span>}
                {knowledge?.interactions ? <span className="froam-lp__node-signal" title={`${knowledge.interactions} interactions`}>I{knowledge.interactions}</span> : null}
                {knowledge?.responsive && <span className="froam-lp__node-signal" title={`Responsive priority: ${knowledge.responsive}`}>R</span>}
                {knowledge?.archived && <span className="froam-lp__node-signal" title="Saved in Component Archive">A</span>}
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
                      if (isSectionNode) onSetSectionVisibility(node, 'editor')
                      else onToggleVisibility(node)
                    }}
                    title={isSectionNode ? node.editorHidden ? 'Show in editor' : 'Hide in editor only' : node.hidden ? 'Show' : 'Hide'}
                    data-chef-editor-root="true"
                  >
                    {isSectionNode
                      ? node.editorHidden ? <EyeOff size={11} /> : <Eye size={11} />
                      : node.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
      {selectedNode && (
        <footer className="froam-lp__inspector" data-chef-editor-root="true">
          <div>
            <span>Selected structure</span>
            <strong>{selectedNode.label}</strong>
            <small>{selectedNode.nodeId ? 'Stable identity connected' : 'Legacy path · select or scan to connect'}</small>
          </div>
          {selectedSection && (
            <div className="froam-lp__section-controls" aria-label="Section controls" data-chef-editor-root="true">
              <span>Section controls</span>
              <div className="froam-lp__section-actions" role="toolbar" aria-label="Insert and reorder section">
                <button type="button" onClick={() => onAddSection(selectedSection, 'before')} title="Add section above" aria-label="Add section above"><Plus size={12} /><ArrowUp size={10} /></button>
                <button type="button" onClick={() => onAddSection(selectedSection, 'after')} title="Add section below" aria-label="Add section below"><Plus size={12} /><ArrowDown size={10} /></button>
                <button type="button" onClick={() => onDuplicateSection(selectedSection)} title="Duplicate section" aria-label="Duplicate section"><Copy size={13} /></button>
                <button type="button" disabled={!canMoveSection(selectedSection, 'up')} onClick={() => onMoveSection(selectedSection, 'up')} title="Move section up" aria-label="Move section up"><ArrowUp size={13} /></button>
                <button type="button" disabled={!canMoveSection(selectedSection, 'down')} onClick={() => onMoveSection(selectedSection, 'down')} title="Move section down" aria-label="Move section down"><ArrowDown size={13} /></button>
              </div>
              <div className="froam-lp__section-visibility">
                <button type="button" className={selectedSection.editorHidden ? 'is-active' : ''} onClick={() => onSetSectionVisibility(selectedSection, 'editor')} title={selectedSection.editorHidden ? 'Show in editor' : 'Hide in editor only'}>
                  {selectedSection.editorHidden ? <Eye size={12} /> : <EyeOff size={12} />}<span>{selectedSection.editorHidden ? 'Show in editor' : 'Hide in editor'}</span>
                </button>
                <button type="button" className={selectedSection.exportHidden ? 'is-active' : ''} onClick={() => onSetSectionVisibility(selectedSection, 'export')} title={selectedSection.exportHidden ? 'Include in export' : 'Hide in export'}>
                  <FileOutput size={12} /><span>{selectedSection.exportHidden ? 'Include in export' : 'Hide in export'}</span>
                </button>
              </div>
              <button type="button" className="froam-lp__section-delete" onClick={() => onDeleteSection(selectedSection)}><Trash2 size={12} /><span>Delete section</span></button>
              <small>Editor visibility never changes the exported page. Export visibility keeps the section editable here.</small>
            </div>
          )}
          <div className="froam-lp__knowledge-actions">
            <button type="button" onClick={() => onOpenKnowledge(selectedNode, 'dna')}>DNA{selectedKnowledge?.dna ? ' ✓' : ''}</button>
            <button type="button" onClick={() => onOpenKnowledge(selectedNode, 'responsive')}>Responsive</button>
            <button type="button" onClick={() => onOpenKnowledge(selectedNode, 'interactions-create')}>Interactions{selectedKnowledge?.interactions ? ` ${selectedKnowledge.interactions}` : ''}</button>
            <button type="button" onClick={() => onOpenKnowledge(selectedNode, 'archive')}>Archive{selectedKnowledge?.archived ? ' ✓' : ''}</button>
          </div>
        </footer>
      )}
    </div>
  )
}

export type { LayerNode }
