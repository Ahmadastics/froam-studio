import { jsx as _jsx } from "react/jsx-runtime";
import { lazy, Suspense, useRef } from 'react';
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
export function lazyPanel(load, options = {}) {
    const Panel = lazy(load);
    function LazyPanel(props) {
        const wanted = useRef(false);
        if (!options.mountWhen || options.mountWhen(props))
            wanted.current = true;
        if (!wanted.current)
            return null;
        return _jsx(Suspense, { fallback: null, children: _jsx(Panel, { ...props }) });
    }
    return LazyPanel;
}
//# sourceMappingURL=lazy-panel.js.map