import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, Code, Eye, EyeOff, Image, Layers, SquareDashedBottom, Type, Search, RefreshCw, MousePointer2, } from 'lucide-react';
function getElementIcon(tag) {
    switch (tag) {
        case 'img':
            return _jsx(Image, { size: 12 });
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
            return _jsx(Type, { size: 12 });
        case 'section':
        case 'article':
        case 'div':
        case 'main':
        case 'aside':
            return _jsx(SquareDashedBottom, { size: 12 });
        case 'button':
            return _jsx(MousePointer2, { size: 12 });
        default:
            return _jsx(Code, { size: 12 });
    }
}
function getLayerIcon(node) {
    if (node.kind === 'stamp')
        return _jsx(Layers, { size: 12 });
    if (node.kind === 'shape')
        return _jsx(SquareDashedBottom, { size: 12 });
    return getElementIcon(node.tag);
}
export default function FroamLayersPanel({ layers, selectedPath, selections, onSelectLayer, onToggleVisibility, onRefresh, routeKey, projectName, branchName, knowledgeByNodeId, onOpenKnowledge, }) {
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
    const selectedKnowledge = selectedNode?.nodeId ? knowledgeByNodeId[selectedNode.nodeId] : undefined;
    function moveTreeFocus(current, direction) {
        const items = Array.from(current.closest('[role="tree"]')?.querySelectorAll('[role="treeitem"]') ?? []);
        const index = items.indexOf(current);
        items[index + direction]?.focus();
    }
    return (_jsxs("div", { className: "froam-lp", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-lp__header", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-lp__header-title", children: [_jsx(Layers, { size: 14 }), _jsx("span", { children: "Outline" })] }), _jsx("button", { type: "button", className: "froam-lp__header-btn", onClick: onRefresh, title: "Refresh layers", "data-chef-editor-root": "true", children: _jsx(RefreshCw, { size: 12 }) })] }), _jsxs("div", { className: "froam-lp__route", "data-chef-editor-root": "true", children: [_jsx("span", { className: "froam-lp__route-dot" }), _jsxs("span", { className: "froam-lp__route-copy", children: [_jsx("strong", { children: projectName }), _jsxs("small", { children: [branchName, " \u00B7 ", routeKey] })] }), selections.length > 1 && (_jsxs("span", { className: "froam-lp__selection-count", children: [selections.length, " selected"] }))] }), _jsxs("div", { className: "froam-lp__search", "data-chef-editor-root": "true", children: [_jsx(Search, { size: 12 }), _jsx("input", { type: "text", className: "froam-lp__search-input", placeholder: "Search layers\u2026", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), "data-chef-editor-root": "true" })] }), _jsx("div", { className: "froam-lp__tree", role: "tree", "aria-label": "Live page structure", "data-chef-editor-root": "true", children: visibleLayers.length === 0 ? (_jsxs("div", { className: "froam-lp__empty", children: [_jsx(Layers, { size: 20 }), _jsx("span", { children: "No layers found" })] })) : (visibleLayers.map((node) => {
                    const isSelected = selectedPath === node.path || selectedPaths.has(node.path);
                    const isCollapsed = collapsed.has(node.path);
                    const knowledge = node.nodeId ? knowledgeByNodeId[node.nodeId] : undefined;
                    return (_jsxs("div", { role: "treeitem", "aria-level": node.depth + 1, "aria-selected": isSelected, "aria-expanded": node.hasChildren ? !isCollapsed : undefined, tabIndex: isSelected ? 0 : -1, className: `froam-lp__node ${isSelected ? 'is-selected' : ''} ${node.hidden ? 'is-hidden-layer' : ''}`, style: { paddingLeft: `${12 + node.depth * 16}px` }, onClick: () => onSelectLayer(node), onKeyDown: (event) => {
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
                        }, "data-chef-editor-root": "true", children: [node.hasChildren ? (_jsx("button", { type: "button", className: "froam-lp__expand-btn", onClick: (e) => {
                                    e.stopPropagation();
                                    toggleCollapse(node.path);
                                }, "data-chef-editor-root": "true", children: _jsx(ChevronRight, { size: 10, style: {
                                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                                        transition: 'transform 120ms ease',
                                    } }) })) : (_jsx("span", { className: "froam-lp__expand-spacer" })), _jsx("span", { className: `froam-lp__node-icon ${node.kind === 'stamp' ? 'is-stamp' : ''}`, children: getLayerIcon(node) }), _jsx("span", { className: "froam-lp__node-tag", children: node.label }), node.kind === 'stamp' && (_jsx("span", { className: "froam-lp__node-badge", children: "stamp" })), node.nodeId && _jsx("span", { className: "froam-lp__node-badge is-identity", title: node.nodeId, children: "id" }), knowledge?.dna && _jsx("span", { className: "froam-lp__node-signal", title: "DNA captured", children: "D" }), knowledge?.interactions ? _jsxs("span", { className: "froam-lp__node-signal", title: `${knowledge.interactions} interactions`, children: ["I", knowledge.interactions] }) : null, knowledge?.responsive && _jsx("span", { className: "froam-lp__node-signal", title: `Responsive priority: ${knowledge.responsive}`, children: "R" }), knowledge?.archived && _jsx("span", { className: "froam-lp__node-signal", title: "Saved in Component Archive", children: "A" }), node.className && (_jsxs("span", { className: "froam-lp__node-class", children: [".", node.className.replace(/ /g, '.')] })), _jsx("div", { className: "froam-lp__node-actions", children: _jsx("button", { type: "button", className: `froam-lp__vis-btn ${node.hidden ? 'is-hidden' : ''}`, onClick: (e) => {
                                        e.stopPropagation();
                                        onToggleVisibility(node);
                                    }, title: node.hidden ? 'Show' : 'Hide', "data-chef-editor-root": "true", children: node.hidden ? _jsx(EyeOff, { size: 11 }) : _jsx(Eye, { size: 11 }) }) })] }, node.path));
                })) }), selectedNode && (_jsxs("footer", { className: "froam-lp__inspector", "data-chef-editor-root": "true", children: [_jsxs("div", { children: [_jsx("span", { children: "Selected structure" }), _jsx("strong", { children: selectedNode.label }), _jsx("small", { children: selectedNode.nodeId ? 'Stable identity connected' : 'Legacy path · select or scan to connect' })] }), _jsxs("div", { className: "froam-lp__knowledge-actions", children: [_jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'dna'), children: ["DNA", selectedKnowledge?.dna ? ' ✓' : ''] }), _jsx("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'responsive'), children: "Responsive" }), _jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'interactions-create'), children: ["Interactions", selectedKnowledge?.interactions ? ` ${selectedKnowledge.interactions}` : ''] }), _jsxs("button", { type: "button", onClick: () => onOpenKnowledge(selectedNode, 'archive'), children: ["Archive", selectedKnowledge?.archived ? ' ✓' : ''] })] })] }))] }));
}
//# sourceMappingURL=FroamLayersPanel.js.map