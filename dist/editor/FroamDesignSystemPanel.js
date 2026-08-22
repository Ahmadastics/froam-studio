import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Box, Check, Component, Library, Layers3, Palette, Plus, RefreshCw, Smartphone, SunMoon, Variable } from 'lucide-react';
import { decideLibraryUpdate, designVariableCss, publishLibraryRelease, resolveDesignVariable, setActiveModes, upsertDesignVariable, } from '../project/design-system.js';
export default function FroamDesignSystemPanel({ system, onChange, onApplyStyle, onToast }) {
    const [tab, setTab] = useState('variables');
    const [name, setName] = useState('');
    const [value, setValue] = useState('#14b8a6');
    const [kind, setKind] = useState('color');
    const [role, setRole] = useState('semantic');
    const activeModes = useMemo(() => new Set(system.activeModeIds), [system.activeModeIds]);
    useEffect(() => {
        for (const variable of Object.values(system.variables)) {
            const resolved = resolveDesignVariable(system, variable.id);
            if (resolved !== undefined)
                document.documentElement.style.setProperty(variable.cssName, resolved);
        }
    }, [system]);
    function toggleMode(id) {
        const mode = system.modes[id];
        let next = [...system.activeModeIds];
        if (mode.kind === 'light' || mode.kind === 'dark')
            next = next.filter((candidate) => !['light', 'dark'].includes(system.modes[candidate]?.kind));
        next = activeModes.has(id) ? next.filter((candidate) => candidate !== id) : [...next, id];
        onChange(setActiveModes(system, next), `Changed design mode: ${mode.name}`);
    }
    function addVariable() {
        const clean = name.trim();
        if (!clean)
            return onToast('Name the variable first');
        const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const variable = { id: `var:${slug}:${Date.now().toString(36)}`, name: clean, cssName: `--froam-${slug}`, kind, role, collection: role === 'semantic' ? 'Semantic' : 'Primitives', values: { [system.activeModeIds[0] ?? 'mode:base']: value } };
        onChange(upsertDesignVariable(system, variable), `Added design variable: ${clean}`);
        setName('');
    }
    function applyStyle(id) {
        const style = system.styles[id];
        if (!style)
            return;
        onApplyStyle(style.states, style.name);
    }
    const tabs = [
        { id: 'variables', label: 'Variables', icon: Variable, count: Object.keys(system.variables).length },
        { id: 'styles', label: 'Styles', icon: Palette, count: Object.keys(system.styles).length },
        { id: 'components', label: 'Families', icon: Component, count: Object.keys(system.componentFamilies).length },
        { id: 'kits', label: 'Site kits', icon: Layers3, count: Object.keys(system.siteKits).length },
        { id: 'libraries', label: 'Libraries', icon: Library, count: Object.keys(system.libraries).length },
    ];
    return _jsxs("div", { className: "froam-design-system", "data-chef-editor-root": "true", children: [_jsx("div", { className: "froam-design-system__modes", children: Object.values(system.modes).filter((mode) => mode.kind !== 'base').map((mode) => _jsxs("button", { type: "button", className: activeModes.has(mode.id) ? 'is-active' : '', onClick: () => toggleMode(mode.id), children: [mode.kind === 'mobile' ? _jsx(Smartphone, { size: 11 }) : _jsx(SunMoon, { size: 11 }), _jsx("span", { children: mode.name })] }, mode.id)) }), _jsx("div", { className: "froam-design-system__tabs", role: "tablist", children: tabs.map((item) => _jsxs("button", { type: "button", role: "tab", "aria-selected": tab === item.id, className: tab === item.id ? 'is-active' : '', onClick: () => setTab(item.id), children: [_jsx(item.icon, { size: 12 }), _jsx("span", { children: item.label }), _jsx("small", { children: item.count })] }, item.id)) }), tab === 'variables' && _jsxs("section", { children: [_jsxs("div", { className: "froam-design-system__summary", children: [_jsx("strong", { children: "Bound variables" }), _jsx("button", { type: "button", onClick: () => navigator.clipboard?.writeText(`:root {\n${designVariableCss(system).split('\n').map((line) => `  ${line}`).join('\n')}\n}`), children: "Copy CSS" })] }), _jsx("div", { className: "froam-design-system__list", children: Object.values(system.variables).map((variable) => _jsxs("article", { children: [_jsx("i", { style: variable.kind === 'color' ? { background: resolveDesignVariable(system, variable.id) } : undefined }), _jsxs("div", { children: [_jsx("strong", { children: variable.name }), _jsxs("small", { children: [variable.cssName, " \u00B7 ", variable.role] })] }), _jsx("code", { children: resolveDesignVariable(system, variable.id) ?? 'unresolved' })] }, variable.id)) }), _jsxs("div", { className: "froam-design-system__creator", children: [_jsx("input", { value: name, onChange: (event) => setName(event.target.value), placeholder: "Variable name" }), _jsx("input", { value: value, onChange: (event) => setValue(event.target.value), placeholder: "Value" }), _jsxs("select", { value: kind, onChange: (event) => setKind(event.target.value), children: [_jsx("option", { value: "color", children: "Color" }), _jsx("option", { value: "size", children: "Size" }), _jsx("option", { value: "number", children: "Number" }), _jsx("option", { value: "font", children: "Font" }), _jsx("option", { value: "shadow", children: "Shadow" }), _jsx("option", { value: "string", children: "String" })] }), _jsxs("select", { value: role, onChange: (event) => setRole(event.target.value), children: [_jsx("option", { value: "semantic", children: "Semantic" }), _jsx("option", { value: "primitive", children: "Primitive" })] }), _jsxs("button", { type: "button", onClick: addVariable, children: [_jsx(Plus, { size: 11 }), " Add"] })] })] }), tab === 'styles' && _jsx("section", { children: _jsx("div", { className: "froam-design-system__cards", children: Object.values(system.styles).map((style) => _jsxs("article", { children: [_jsx(Palette, { size: 16 }), _jsxs("div", { children: [_jsx("strong", { children: style.name }), _jsxs("small", { children: ["v", style.version, " \u00B7 ", Object.keys(style.states).join(', '), " \u00B7 ", style.usageNodeIds.length, " uses"] })] }), _jsx("button", { type: "button", onClick: () => applyStyle(style.id), children: "Apply" })] }, style.id)) }) }), tab === 'components' && _jsx("section", { children: _jsx("div", { className: "froam-design-system__cards", children: Object.values(system.componentFamilies).map((family) => _jsxs("article", { children: [_jsx(Component, { size: 16 }), _jsxs("div", { children: [_jsx("strong", { children: family.name }), _jsxs("small", { children: ["v", family.version, " \u00B7 ", family.props.length, " props \u00B7 ", family.slots.length, " slots \u00B7 ", family.variants.length, " variants"] }), _jsx("div", { className: "froam-design-system__chips", children: family.variants.map((variant) => _jsx("span", { children: variant.name }, variant.id)) })] })] }, family.id)) }) }), tab === 'kits' && _jsx("section", { children: _jsx("div", { className: "froam-design-system__cards", children: Object.values(system.siteKits).map((kit) => _jsxs("article", { children: [_jsx(Box, { size: 16 }), _jsxs("div", { children: [_jsx("strong", { children: kit.name }), _jsx("small", { children: kit.description }), _jsx("div", { className: "froam-design-system__chips", children: kit.tags.map((tag) => _jsx("span", { children: tag }, tag)) })] }), _jsx("button", { type: "button", onClick: () => { onChange(setActiveModes(system, kit.modeIds.filter((id) => ['light', 'brand', 'mobile'].includes(system.modes[id]?.kind))), `Applied site kit: ${kit.name}`); onToast(`${kit.name} design system activated`); }, children: "Activate" })] }, kit.id)) }) }), tab === 'libraries' && _jsx("section", { children: _jsx("div", { className: "froam-design-system__cards", children: Object.values(system.libraries).map((library) => _jsxs("article", { children: [_jsx(Library, { size: 16 }), _jsxs("div", { children: [_jsx("strong", { children: library.name }), _jsxs("small", { children: ["Installed v", library.installedVersion, " \u00B7 Latest v", library.availableVersion, " \u00B7 ", library.status] })] }), _jsxs("div", { className: "froam-design-system__library-actions", children: [_jsxs("button", { type: "button", onClick: () => onChange(publishLibraryRelease(system, library.id, 'Design system update'), `Published ${library.name} update`), children: [_jsx(RefreshCw, { size: 11 }), " Publish"] }), library.status === 'update-available' && _jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: () => onChange(decideLibraryUpdate(system, library.id, 'accept'), `Accepted ${library.name} update`), children: [_jsx(Check, { size: 11 }), " Accept"] }), _jsx("button", { type: "button", onClick: () => onChange(decideLibraryUpdate(system, library.id, 'postpone'), `Postponed ${library.name} update`), children: "Later" })] })] })] }, library.id)) }) })] });
}
//# sourceMappingURL=FroamDesignSystemPanel.js.map