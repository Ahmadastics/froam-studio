import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useCallback } from 'react';
import { Archive, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Check, ChevronLeft, ChevronRight, Code, Copy, CornerLeftUp, CornerRightDown, Dna, Eye, EyeOff, FileOutput, Image, Layers, MousePointer2, RefreshCw, Search, Smartphone, SquareDashedBottom, Trash2, Type, WandSparkles, } from 'lucide-react';
function getElementIcon(tag) {
    switch (tag) {
        case 'img':
            return _jsx(Image, { size: 13 });
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
        case 'p':
        case 'span':
        case 'a':
        case 'label':
        case 'strong':
        case 'em':
            return _jsx(Type, { size: 13 });
        case 'section':
        case 'article':
        case 'div':
        case 'main':
        case 'aside':
            return _jsx(SquareDashedBottom, { size: 13 });
        case 'button':
            return _jsx(MousePointer2, { size: 13 });
        default:
            return _jsx(Code, { size: 13 });
    }
}
/** What a person calls a layer: its own name, or what kind of thing it is. */
const LAYER_KIND = {
    h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6',
    p: 'Paragraph', span: 'Text', strong: 'Bold text', em: 'Italic text', small: 'Small text', a: 'Link', button: 'Button',
    img: 'Image', picture: 'Image', svg: 'Icon', video: 'Video', section: 'Section', header: 'Header', footer: 'Footer',
    nav: 'Navigation', main: 'Main', aside: 'Sidebar', article: 'Article', div: 'Box', ul: 'List', ol: 'List', li: 'Item',
    form: 'Form', input: 'Field', textarea: 'Text box', select: 'Dropdown', label: 'Label', table: 'Table', figure: 'Figure',
    blockquote: 'Quote', hr: 'Divider',
};
function layerName(node) {
    if (node.label && node.label.toLowerCase() !== node.tag)
        return node.label;
    return LAYER_KIND[node.tag] ?? node.tag;
}
function getLayerIcon(node) {
    if (node.kind === 'stamp')
        return _jsx(Layers, { size: 13 });
    if (node.kind === 'shape')
        return _jsx(SquareDashedBottom, { size: 13 });
    return getElementIcon(node.tag);
}
export default function FroamLayersPanel({ layers, selectedPath, selections, selectionCandidates, onSelectLayer, onToggleVisibility, onAddSection, onDuplicateSection, onMoveSection, canMoveSection, onSetSectionVisibility, onDeleteSection, onRefresh, routeKey, projectName, branchName, knowledgeByNodeId, onOpenKnowledge, }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsed, setCollapsed] = useState(new Set());
    const selectedPaths = useMemo(() => new Set(selections.map((s) => s.path)), [selections]);
    const filteredLayers = useMemo(() => {
        if (!searchQuery.trim())
            return layers;
        const q = searchQuery.toLowerCase();
        return layers.filter((n) => n.tag.includes(q) ||
            n.label.toLowerCase().includes(q) ||
            n.kind.includes(q) ||
            n.className.toLowerCase().includes(q) ||
            n.nodeId?.toLowerCase().includes(q) ||
            n.path.toLowerCase().includes(q));
    }, [layers, searchQuery]);
    const toggleCollapse = useCallback((path) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(path))
                next.delete(path);
            else
                next.add(path);
            return next;
        });
    }, []);
    // Determine which layers should be visible given collapsed state
    const visibleLayers = useMemo(() => {
        if (searchQuery.trim())
            return filteredLayers;
        const result = [];
        const collapsedPrefixes = [];
        for (const node of filteredLayers) {
            // Check if any collapsed parent hides this node
            const isHiddenByParent = collapsedPrefixes.some((prefix) => node.path.startsWith(prefix + '/'));
            if (isHiddenByParent)
                continue;
            result.push(node);
            // If this node is collapsed, track its prefix
            if (collapsed.has(node.path) && node.hasChildren) {
                collapsedPrefixes.push(node.path);
            }
        }
        return result;
    }, [filteredLayers, collapsed, searchQuery]);
    const selectedNode = layers.find((node) => node.path === selectedPath);
    const selectedSection = selectedNode && ['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'].includes(selectedNode.tag)
        ? selectedNode
        : null;
    const selectedKnowledge = selectedNode?.nodeId ? knowledgeByNodeId[selectedNode.nodeId] : undefined;
    const selectedTrail = useMemo(() => {
        if (!selectedPath)
            return [];
        return layers
            .filter((node) => node.path === selectedPath || selectedPath.startsWith(`${node.path}/`))
            .sort((a, b) => a.depth - b.depth);
    }, [layers, selectedPath]);
    const nearbyLayers = useMemo(() => {
        if (!selectedNode)
            return { parent: null, child: null, previous: null, next: null };
        const parentPath = selectedNode.path.split('/').slice(0, -1).join('/');
        const siblings = layers.filter((node) => node.depth === selectedNode.depth && node.path.split('/').slice(0, -1).join('/') === parentPath);
        const index = siblings.findIndex((node) => node.path === selectedNode.path);
        return {
            parent: selectedTrail.at(-2) ?? null,
            child: layers.find((node) => node.depth === selectedNode.depth + 1 && node.path.startsWith(`${selectedNode.path}/`)) ?? null,
            previous: index > 0 ? siblings[index - 1] : null,
            next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
        };
    }, [layers, selectedNode, selectedTrail]);
    const pointerStack = useMemo(() => {
        const unique = [];
        for (const node of selectionCandidates) {
            if (!unique.some((item) => item.path === node.path))
                unique.push(node);
        }
        if (!selectedPath || !unique.some((node) => node.path === selectedPath))
            return [];
        return unique;
    }, [selectedPath, selectionCandidates]);
    function moveTreeFocus(current, direction) {
        const items = Array.from(current.closest('[role="tree"]')?.querySelectorAll('[role="treeitem"]') ?? []);
        const index = items.indexOf(current);
        items[index + direction]?.focus();
    }
    return (_jsxs("div", { className: "froam-lp", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-lp__search", "data-chef-editor-root": "true", children: [_jsx(Search, { size: 13 }), _jsx("input", { type: "text", className: "froam-lp__search-input", placeholder: "Find a layer\u2026", "aria-label": "Find a layer", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), "data-chef-editor-root": "true" }), selections.length > 1 && (_jsxs("span", { className: "froam-lp__selection-count", children: [selections.length, " selected"] })), _jsx("button", { type: "button", className: "froam-lp__header-btn", onClick: onRefresh, title: `Read the page again (${projectName} · ${branchName} · ${routeKey})`, "aria-label": "Refresh layers", "data-chef-editor-root": "true", children: _jsx(RefreshCw, { size: 13 }) })] }), selectedTrail.length > 0 && (_jsxs("div", { className: "froam-lp__where", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-lp__breadcrumbs", "aria-label": "Selected layer path", "data-chef-editor-root": "true", children: [selectedTrail.length > 3 && (_jsxs("button", { type: "button", onClick: () => onSelectLayer(selectedTrail[selectedTrail.length - 4]), title: selectedTrail.slice(0, -3).map(layerName).join(' › '), "aria-label": "Select further up", "data-chef-editor-root": "true", children: [_jsx("span", { children: "\u2026" }), _jsx(ChevronRight, { size: 11, "aria-hidden": "true" })] })), selectedTrail.slice(-3).map((node, index, shown) => (_jsxs("button", { type: "button", className: node.path === selectedPath ? 'is-current' : '', onClick: () => onSelectLayer(node), title: node.path, "data-chef-editor-root": "true", children: [_jsx("span", { children: layerName(node) }), index < shown.length - 1 && _jsx(ChevronRight, { size: 11, "aria-hidden": "true" })] }, node.path)))] }), selectedNode && (_jsxs("div", { className: "froam-lp__ladder", role: "toolbar", "aria-label": "Move through nearby layers", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", disabled: !nearbyLayers.parent, onClick: () => nearbyLayers.parent && onSelectLayer(nearbyLayers.parent), title: "Parent", "aria-label": "Select parent layer", children: _jsx(CornerLeftUp, { size: 13 }) }), _jsx("button", { type: "button", disabled: !nearbyLayers.previous, onClick: () => nearbyLayers.previous && onSelectLayer(nearbyLayers.previous), title: "Previous", "aria-label": "Select previous sibling", children: _jsx(ChevronLeft, { size: 13 }) }), _jsx("button", { type: "button", disabled: !nearbyLayers.next, onClick: () => nearbyLayers.next && onSelectLayer(nearbyLayers.next), title: "Next", "aria-label": "Select next sibling", children: _jsx(ChevronRight, { size: 13 }) }), _jsx("button", { type: "button", disabled: !nearbyLayers.child, onClick: () => nearbyLayers.child && onSelectLayer(nearbyLayers.child), title: "First inside", "aria-label": "Select first child layer", children: _jsx(CornerRightDown, { size: 13 }) })] }))] })), pointerStack.length > 1 && (_jsxs("div", { className: "froam-lp__stack", "data-chef-editor-root": "true", children: [_jsx("span", { children: "Under pointer" }), _jsx("div", { children: pointerStack.slice(0, 8).map((node) => (_jsxs("button", { type: "button", className: node.path === selectedPath ? 'is-current' : '', onClick: () => onSelectLayer(node), title: node.path, "data-chef-editor-root": "true", children: [getLayerIcon(node), _jsx("span", { children: node.label })] }, node.path))) })] })), _jsx("div", { className: "froam-lp__tree", role: "tree", "aria-label": "Live page structure", "data-chef-editor-root": "true", children: visibleLayers.length === 0 ? (_jsxs("div", { className: "froam-lp__empty", children: [_jsx(Layers, { size: 20 }), _jsx("span", { children: searchQuery.trim() ? `Nothing called “${searchQuery.trim()}” on this page` : 'No layers yet — the page is still loading' })] })) : (visibleLayers.map((node) => {
                    const isSelected = selectedPath === node.path || selectedPaths.has(node.path);
                    const isCollapsed = collapsed.has(node.path);
                    const isSectionNode = ['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'].includes(node.tag);
                    const knowledge = node.nodeId ? knowledgeByNodeId[node.nodeId] : undefined;
                    const facts = [
                        knowledge?.dna && 'Design DNA saved',
                        knowledge?.interactions && `${knowledge.interactions} interaction${knowledge.interactions === 1 ? '' : 's'}`,
                        knowledge?.responsive && `Responsive: ${knowledge.responsive}`,
                        knowledge?.archived && 'In your archive',
                    ].filter(Boolean).join(' · ');
                    return (_jsxs("div", { role: "treeitem", "aria-level": node.depth + 1, "aria-selected": isSelected, "aria-expanded": node.hasChildren ? !isCollapsed : undefined, tabIndex: isSelected ? 0 : -1, className: `froam-lp__node ${isSelected ? 'is-selected' : ''} ${node.hidden ? 'is-hidden-layer' : ''}`, style: { paddingLeft: `${8 + node.depth * 14}px` }, title: facts || undefined, onClick: () => onSelectLayer(node), onKeyDown: (event) => {
                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault();
                                moveTreeFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
                            }
                            if (event.key === 'ArrowRight' && node.hasChildren && isCollapsed) {
                                event.preventDefault();
                                toggleCollapse(node.path);
                            }
                            if (event.key === 'ArrowLeft' && node.hasChildren && !isCollapsed) {
                                event.preventDefault();
                                toggleCollapse(node.path);
                            }
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onSelectLayer(node);
                            }
                        }, "data-chef-editor-root": "true", children: [node.hasChildren ? (_jsx("button", { type: "button", className: "froam-lp__expand-btn", "aria-label": isCollapsed ? 'Expand' : 'Collapse', onClick: (e) => {
                                    e.stopPropagation();
                                    toggleCollapse(node.path);
                                }, "data-chef-editor-root": "true", children: _jsx(ChevronRight, { size: 12, style: {
                                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                                        transition: 'transform 120ms ease',
                                    } }) })) : (_jsx("span", { className: "froam-lp__expand-spacer" })), _jsx("span", { className: `froam-lp__node-icon ${node.kind === 'stamp' ? 'is-stamp' : ''}`, children: getLayerIcon(node) }), _jsx("span", { className: "froam-lp__node-tag", children: layerName(node) }), node.kind === 'stamp' && (_jsx("span", { className: "froam-lp__node-badge", children: "group" })), node.className && (_jsxs("span", { className: "froam-lp__node-class", children: [".", node.className.split(/\s+/)[0]] })), knowledge?.interactions ? _jsx("span", { className: "froam-lp__node-signal", "aria-label": `${knowledge.interactions} interactions`, children: _jsx(WandSparkles, { size: 11 }) }) : null, _jsx("div", { className: "froam-lp__node-actions", children: _jsx("button", { type: "button", className: `froam-lp__vis-btn ${node.hidden ? 'is-hidden' : ''}`, onClick: (e) => {
                                        e.stopPropagation();
                                        if (isSectionNode)
                                            onSetSectionVisibility(node, 'editor');
                                        else
                                            onToggleVisibility(node);
                                    }, title: isSectionNode ? node.editorHidden ? 'Show in editor' : 'Hide in editor only' : node.hidden ? 'Show' : 'Hide', "aria-label": node.hidden || node.editorHidden ? 'Show layer' : 'Hide layer', "data-chef-editor-root": "true", children: isSectionNode
                                        ? node.editorHidden ? _jsx(EyeOff, { size: 13 }) : _jsx(Eye, { size: 13 })
                                        : node.hidden ? _jsx(EyeOff, { size: 13 }) : _jsx(Eye, { size: 13 }) }) })] }, node.path));
                })) }), selectedNode && (_jsxs("footer", { className: "froam-lp__inspector", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-lp__inspector-head", title: selectedNode.nodeId ? 'Stable identity connected' : 'Legacy path · select or scan to connect', children: [_jsx("span", { className: "froam-lp__node-icon", children: getLayerIcon(selectedNode) }), _jsx("strong", { children: layerName(selectedNode) }), selectedNode.className && _jsxs("small", { children: [".", selectedNode.className.split(/\s+/)[0]] })] }), selectedSection && (_jsxs("div", { className: "froam-lp__section-controls", "aria-label": "Section controls", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-lp__section-actions", role: "toolbar", "aria-label": "Insert and reorder section", children: [_jsx("button", { type: "button", onClick: () => onAddSection(selectedSection, 'before'), title: "Add section above", "aria-label": "Add section above", children: _jsx(ArrowUpToLine, { size: 14 }) }), _jsx("button", { type: "button", onClick: () => onAddSection(selectedSection, 'after'), title: "Add section below", "aria-label": "Add section below", children: _jsx(ArrowDownToLine, { size: 14 }) }), _jsx("button", { type: "button", onClick: () => onDuplicateSection(selectedSection), title: "Duplicate section", "aria-label": "Duplicate section", children: _jsx(Copy, { size: 14 }) }), _jsx("button", { type: "button", disabled: !canMoveSection(selectedSection, 'up'), onClick: () => onMoveSection(selectedSection, 'up'), title: "Move section up", "aria-label": "Move section up", children: _jsx(ArrowUp, { size: 14 }) }), _jsx("button", { type: "button", disabled: !canMoveSection(selectedSection, 'down'), onClick: () => onMoveSection(selectedSection, 'down'), title: "Move section down", "aria-label": "Move section down", children: _jsx(ArrowDown, { size: 14 }) }), _jsx("button", { type: "button", className: "is-danger", onClick: () => onDeleteSection(selectedSection), title: "Delete section", "aria-label": "Delete section", children: _jsx(Trash2, { size: 14 }) })] }), _jsxs("div", { className: "froam-lp__section-visibility", children: [_jsxs("button", { type: "button", className: selectedSection.editorHidden ? 'is-active' : '', onClick: () => onSetSectionVisibility(selectedSection, 'editor'), title: "Editor visibility never changes the exported page", children: [selectedSection.editorHidden ? _jsx(Eye, { size: 13 }) : _jsx(EyeOff, { size: 13 }), _jsx("span", { children: selectedSection.editorHidden ? 'Show in editor' : 'Hide in editor' })] }), _jsxs("button", { type: "button", className: selectedSection.exportHidden ? 'is-active' : '', onClick: () => onSetSectionVisibility(selectedSection, 'export'), title: "Export visibility keeps the section editable here", children: [_jsx(FileOutput, { size: 13 }), _jsx("span", { children: selectedSection.exportHidden ? 'Include in export' : 'Hide in export' })] })] })] })), _jsxs("div", { className: "froam-lp__knowledge-actions", children: [_jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'dna'), title: "Its colours, type and spacing, captured", children: [_jsx(Dna, { size: 13 }), _jsx("span", { children: "Design DNA" }), selectedKnowledge?.dna && _jsx(Check, { size: 13 })] }), _jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'responsive'), title: "How it behaves across screen sizes", children: [_jsx(Smartphone, { size: 13 }), _jsx("span", { children: "Responsive" })] }), _jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'interactions-create'), title: "Hover, click and scroll motion", children: [_jsx(WandSparkles, { size: 13 }), _jsxs("span", { children: ["Interactions", selectedKnowledge?.interactions ? ` · ${selectedKnowledge.interactions}` : ''] })] }), _jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'archive'), title: "Keep it to reuse on any page", children: [_jsx(Archive, { size: 13 }), _jsx("span", { children: selectedKnowledge?.archived ? 'In archive' : 'Save to archive' }), selectedKnowledge?.archived && _jsx(Check, { size: 13 })] })] })] }))] }));
}
//# sourceMappingURL=FroamLayersPanel.js.map