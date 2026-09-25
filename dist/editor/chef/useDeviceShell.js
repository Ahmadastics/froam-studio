import { useEffect, useRef } from 'react';
import { isFroamPersonaPath } from '../froamPersona.js';
import { findElementByPath } from '../../collab/paths.js';
import { getRoot } from './dom.js';
import { applyCanvasDraftStyles, applyDraft, clearCanvasDraftStyles, isInjectionPath } from './drafts.js';
import { CANVAS_KEY, DEVICE_SHELL_ID, VIEWPORT_MODES, } from './types.js';
/**
 * Tablet and mobile preview: the page's root is sized to the device width (so
 * its own media queries fire), fixed in a scaled frame with a decorative bezel,
 * and the drafts for that viewport are painted. Desktop puts everything back.
 * Returns the viewport the page was last laid out for.
 */
export function useDeviceShell({ routeKey, store, viewportMode, zoom, currentSelectionRef, setPanelPosition, setSelection }) {
    const prevViewportRef = useRef('desktop');
    useEffect(() => {
        const appRoot = getRoot();
        if (!appRoot)
            return;
        // Strip previous viewport's drafted styles
        const prevKey = `${routeKey}@@${prevViewportRef.current}`;
        const prevDrafts = store[prevKey] ?? {};
        Object.keys(prevDrafts).forEach((path) => {
            if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                return;
            const el = findElementByPath(appRoot, path);
            if (el)
                el.removeAttribute('style');
        });
        if (prevDrafts[CANVAS_KEY]) {
            clearCanvasDraftStyles();
        }
        // Remove any old shell overlay
        document.getElementById(DEVICE_SHELL_ID)?.remove();
        // Always make sure #root is back in body (safety) — unless the root
        // IS <body>/<html>, which can never be re-parented into itself.
        if (appRoot !== document.body && appRoot !== document.documentElement && appRoot.parentElement && appRoot.parentElement !== document.body) {
            document.body.appendChild(appRoot);
        }
        // Reset root styles
        appRoot.style.removeProperty('width');
        appRoot.style.removeProperty('min-height');
        appRoot.style.removeProperty('height');
        appRoot.style.removeProperty('overflow-y');
        appRoot.style.removeProperty('overflow-x');
        appRoot.style.removeProperty('position');
        appRoot.style.removeProperty('left');
        appRoot.style.removeProperty('top');
        appRoot.style.removeProperty('z-index');
        appRoot.style.removeProperty('border-radius');
        appRoot.style.removeProperty('box-shadow');
        appRoot.style.removeProperty('background');
        appRoot.style.removeProperty('transform');
        appRoot.style.removeProperty('transform-origin');
        appRoot.style.removeProperty('max-width');
        appRoot.style.removeProperty('margin-inline');
        appRoot.style.removeProperty('margin-left');
        appRoot.style.removeProperty('margin-right');
        appRoot.style.removeProperty('margin-top');
        appRoot.style.removeProperty('margin');
        appRoot.style.removeProperty('isolation');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('background');
        document.body.style.removeProperty('display');
        document.body.style.removeProperty('align-items');
        document.body.style.removeProperty('justify-content');
        document.body.style.removeProperty('min-height');
        prevViewportRef.current = viewportMode;
        setPanelPosition(null);
        const mode = VIEWPORT_MODES.find((m) => m.id === viewportMode);
        if (!mode || mode.width === null) {
            // Desktop — plain, repaint desktop drafts
            const newDrafts = store[`${routeKey}@@desktop`] ?? {};
            Object.entries(newDrafts).forEach(([path, draft]) => {
                if (path === CANVAS_KEY || isFroamPersonaPath(path))
                    return;
                const el = findElementByPath(appRoot, path);
                if (el)
                    applyDraft(el, draft);
            });
            const cd = newDrafts[CANVAS_KEY];
            applyCanvasDraftStyles(cd?.styles?.backgroundColor, cd?.styles?.color, cd?.styles);
            currentSelectionRef.current?.removeAttribute('data-chef-selected');
            currentSelectionRef.current = null;
            setSelection(null);
            // Desktop stays true to the page. Froam controls float above it instead of
            // pushing the canvas into a dark editor workbench.
            appRoot.style.minHeight = '100vh';
            appRoot.style.transformOrigin = 'top left';
            appRoot.style.transform = zoom !== 1 ? `scale(${zoom})` : '';
            return;
        }
        // Mobile / Tablet: put #root inside a fixed device screen and scale it.
        // This keeps #root in document.body, triggers real media queries, and aligns the page with the phone frame.
        const deviceW = mode.width;
        const deviceH = mode.height;
        const padding = viewportMode === 'mobile' ? 28 : 32;
        const availW = window.innerWidth - padding * 2;
        const availH = window.innerHeight - padding * 2;
        const scale = Math.min(availW / deviceW, availH / deviceH, viewportMode === 'mobile' ? 0.96 : 0.92);
        const scaledW = deviceW * scale;
        const scaledH = deviceH * scale;
        const screenLeft = Math.round((window.innerWidth - scaledW) / 2);
        const screenTop = Math.round((window.innerHeight - scaledH) / 2);
        const screenRadius = viewportMode === 'mobile' ? 32 : 18;
        // Size #root to device width so media queries fire correctly
        appRoot.style.width = `${deviceW}px`;
        appRoot.style.height = `${deviceH}px`;
        appRoot.style.minHeight = `${deviceH}px`;
        appRoot.style.maxWidth = 'none';
        appRoot.style.marginInline = '0';
        appRoot.style.position = 'fixed';
        appRoot.style.left = `${screenLeft}px`;
        appRoot.style.top = `${screenTop}px`;
        appRoot.style.zIndex = '1045';
        appRoot.style.isolation = 'isolate';
        appRoot.style.borderRadius = `${screenRadius}px`;
        appRoot.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.06)';
        appRoot.style.background = '#fff';
        appRoot.style.overflowX = 'hidden';
        appRoot.style.overflowY = 'auto';
        appRoot.style.transformOrigin = 'top left';
        appRoot.style.transform = `scale(${scale})`;
        // Dark background behind the scaled frame
        document.body.style.background = 'rgba(6,8,14,0.95)';
        document.body.style.minHeight = '100vh';
        document.body.style.overflow = 'hidden';
        // Build a thin bezel overlay (purely decorative, pointer-events:none)
        const bezelPad = viewportMode === 'mobile' ? 12 : 16;
        const bezelRadius = screenRadius;
        const shell = document.createElement('div');
        shell.id = DEVICE_SHELL_ID;
        shell.setAttribute('data-chef-editor-root', 'true');
        shell.style.cssText = [
            'position:fixed',
            `left:${screenLeft}px`,
            `top:${screenTop}px`,
            `width:${scaledW}px`,
            `height:${scaledH}px`,
            `border-radius:${bezelRadius}px`,
            `box-shadow:0 0 0 ${bezelPad}px #1f2430,0 0 0 ${bezelPad + 1}px rgba(255,255,255,0.08),0 32px 80px rgba(0,0,0,0.7)`,
            'border:2px solid rgba(255,255,255,0.08)',
            'z-index:1048',
            'pointer-events:none',
        ].join(';');
        if (viewportMode === 'mobile') {
            const notch = document.createElement('div');
            notch.setAttribute('data-chef-editor-root', 'true');
            notch.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);width:92px;height:24px;background:#0e1016;border-radius:15px;z-index:2;pointer-events:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)';
            shell.appendChild(notch);
        }
        document.body.appendChild(shell);
        // Paint new viewport drafts
        const newDrafts = store[`${routeKey}@@${viewportMode}`] ?? {};
        Object.entries(newDrafts).forEach(([path, draft]) => {
            if (path === CANVAS_KEY || isFroamPersonaPath(path))
                return;
            const el = findElementByPath(appRoot, path);
            if (el)
                applyDraft(el, draft);
        });
        const cd = newDrafts[CANVAS_KEY];
        applyCanvasDraftStyles(cd?.styles?.backgroundColor, cd?.styles?.color, cd?.styles);
        currentSelectionRef.current?.removeAttribute('data-chef-selected');
        currentSelectionRef.current = null;
        setSelection(null);
        return () => {
            document.getElementById(DEVICE_SHELL_ID)?.remove();
            appRoot.style.removeProperty('width');
            appRoot.style.removeProperty('min-height');
            appRoot.style.removeProperty('height');
            appRoot.style.removeProperty('overflow-y');
            appRoot.style.removeProperty('overflow-x');
            appRoot.style.removeProperty('position');
            appRoot.style.removeProperty('left');
            appRoot.style.removeProperty('top');
            appRoot.style.removeProperty('z-index');
            appRoot.style.removeProperty('border-radius');
            appRoot.style.removeProperty('box-shadow');
            appRoot.style.removeProperty('background');
            appRoot.style.removeProperty('transform');
            appRoot.style.removeProperty('transform-origin');
            appRoot.style.removeProperty('max-width');
            appRoot.style.removeProperty('margin-inline');
            appRoot.style.removeProperty('margin-left');
            appRoot.style.removeProperty('margin-right');
            appRoot.style.removeProperty('margin-top');
            appRoot.style.removeProperty('margin');
            appRoot.style.removeProperty('isolation');
            document.body.style.removeProperty('background');
            document.body.style.removeProperty('min-height');
            document.body.style.removeProperty('overflow');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewportMode, routeKey, zoom]);
    return prevViewportRef;
}
//# sourceMappingURL=useDeviceShell.js.map