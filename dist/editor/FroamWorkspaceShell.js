import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Boxes, Clapperboard, Command, FileImage, GitBranch, Layers, MousePointer2 } from 'lucide-react';
import { workspaceProjectLabel, workspaceStatus, workspaceTemporalSurface } from './workspace-shell-model.js';
const primaryTools = [
    { id: 'design', mode: 'create', label: 'Design', icon: MousePointer2 },
    { id: 'plan', mode: 'create', label: 'Build', icon: Boxes },
    { id: 'reference', mode: 'understand', label: 'Reference', icon: FileImage },
    { id: 'layers', mode: 'understand', label: 'Layers', icon: Layers },
];
export default function FroamWorkspaceShell(props) {
    const project = workspaceProjectLabel(props.projectName, props.branchName, props.branchId);
    const status = workspaceStatus({
        mode: props.mode,
        branchName: props.branchName,
        branchId: props.branchId,
        activity: props.activity,
        sampling: props.temporalOwner === 'sampling',
        replay: props.temporalOwner === 'replay',
        physics: props.activeSection === 'physics',
    });
    const temporal = workspaceTemporalSurface(props.temporalOwner);
    return _jsxs(_Fragment, { children: [_jsxs("section", { className: "froam-workspace froam-workspace--simple", "data-chef-editor-root": "true", "aria-label": "Froam workspace", children: [_jsxs("button", { type: "button", className: `froam-workspace__project ${project.prototype ? 'is-prototype' : ''}`, onClick: props.onOpenPrototypes, "aria-label": `Project ${project.projectName}, branch ${project.branchName}. Open prototypes`, children: [_jsx(GitBranch, { size: 12 }), _jsx("span", { children: project.projectName }), _jsx("i", { children: "/" }), _jsxs("strong", { children: [project.branchName, project.prototype ? ' ☣' : ''] })] }), _jsx("nav", { className: "froam-workspace__rail", "aria-label": "Primary Froam tools", children: primaryTools.map((item) => {
                            const Icon = item.icon;
                            return _jsxs("button", { type: "button", className: props.activeSection === item.id ? 'is-active' : '', "aria-pressed": props.activeSection === item.id, onClick: () => props.onSectionChange(item.id, item.mode), children: [_jsx(Icon, { size: 13 }), _jsx("span", { children: item.label })] }, item.id);
                        }) }), _jsxs("output", { className: `froam-workspace__status is-${status.tone}`, "aria-live": "polite", children: [_jsx("i", {}), props.selectionLabel ? `Selected · ${props.selectionLabel}` : 'Click anything to edit'] }), _jsxs("button", { type: "button", className: "froam-workspace__commands", onClick: props.onOpenCommands, title: "Open all Froam commands", children: [_jsx(Command, { size: 13 }), _jsx("span", { children: "Commands" })] })] }), temporal && _jsxs("section", { className: "froam-temporal-dock", "data-chef-editor-root": "true", "aria-label": "Active temporal surface", children: [_jsx(Clapperboard, { size: 14 }), _jsx("b", { children: temporal.label }), _jsx("span", { children: "Only this timeline currently owns time controls." })] })] });
}
//# sourceMappingURL=FroamWorkspaceShell.js.map