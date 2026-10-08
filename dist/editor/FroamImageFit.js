import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { clampFitState, cropRect, DEFAULT_IMAGE_FIT, enlargement, IMAGE_FIT_ASPECTS, isUsableSize, MAX_IMAGE_FIT_ZOOM, outputSize, panFit, resolveAspectRatio, slotSize, sourceRect, zoomFitAt, } from './image-fit.js';
import { DEFAULT_PLAYBACK } from './media/media-draft.js';
/*
 * Without a bridge to keep originals as files, a fitted picture remembers in
 * memory what it was cut from, so Adjust can start again from the original
 * for the rest of the session. (With a bridge the original is in the design.)
 */
const fitOrigins = new Map();
// Originals can be several MB each; a handful covers a session of fitting.
const FIT_ORIGINS_KEPT = 8;
export function rememberImageFit(url, blob, state) {
    fitOrigins.delete(url);
    fitOrigins.set(url, { blob, state });
    while (fitOrigins.size > FIT_ORIGINS_KEPT) {
        const oldest = fitOrigins.keys().next().value;
        if (oldest === undefined)
            break;
        fitOrigins.delete(oldest);
    }
}
export function recallImageFit(url) {
    return fitOrigins.get(url) ?? null;
}
/** Formats a browser can't redraw without losing something: a GIF's motion, an SVG's sharpness. */
export function isAnimatedOrVector(typeOrUrl) {
    return /^(?:image\/(?:gif|svg\+xml))$/i.test(typeOrUrl) || /^data:image\/(?:gif|svg\+xml)/i.test(typeOrUrl) || /\.(?:gif|svg)(?:[?#]|$)/i.test(typeOrUrl);
}
const STAGE_MARGIN = 28;
const NUDGE = 10;
const HEAVY_VIDEO_BYTES = 25 * 1024 * 1024;
export default function FroamImageFit({ request, onApply, onCancel }) {
    if (!request)
        return null;
    return _jsx(ImageFitDialog, { request: request, onApply: onApply, onCancel: onCancel }, request.id);
}
function ImageFitDialog({ request, onApply, onCancel }) {
    const [natural, setNatural] = useState(null);
    const [error, setError] = useState(null);
    const [state, setState] = useState(() => {
        const initial = request.initial ?? DEFAULT_IMAGE_FIT;
        return request.zoomable ? initial : { ...initial, zoom: 1 };
    });
    const [playback, setPlayback] = useState(request.playback ?? DEFAULT_PLAYBACK);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [view, setView] = useState({ width: 0, height: 0 });
    const dialogRef = useRef(null);
    const stageRef = useRef(null);
    // Pointers down on the stage: one drags, two pinch.
    const pointersRef = useRef(new Map());
    const pinchRef = useRef(null);
    const isVideo = request.kind === 'video';
    function loaded(width, height) {
        if (!width || !height) {
            setError(isVideo ? 'This video could not be read.' : 'This image has no fixed size (usually an SVG without one), so it can’t be shaped.');
            return;
        }
        setNatural({ width, height });
    }
    useLayoutEffect(() => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const measure = () => setView({ width: stage.clientWidth, height: stage.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);
    const image = natural;
    const zoomable = request.zoomable;
    const ratio = image ? resolveAspectRatio(state.aspect, request.frame, image) : (isUsableSize(request.frame) ? request.frame.width / request.frame.height : 4 / 3);
    // The frame, as big as the stage allows with room to see what is cut off.
    const availableWidth = Math.max(40, view.width - STAGE_MARGIN * 2);
    const availableHeight = Math.max(40, view.height - STAGE_MARGIN * 2);
    let boxWidth = availableWidth;
    let boxHeight = availableWidth / ratio;
    if (boxHeight > availableHeight) {
        boxHeight = availableHeight;
        boxWidth = availableHeight * ratio;
    }
    const boxLeft = (view.width - boxWidth) / 2;
    const boxTop = (view.height - boxHeight) / 2;
    // Until the file has decoded it is laid out invisibly, so its size can be read.
    let pictureStyle = { visibility: 'hidden', left: 0, top: 0 };
    if (image) {
        if (state.mode === 'fill') {
            const crop = cropRect(image, ratio, state);
            const scale = boxWidth / crop.sw;
            pictureStyle = { width: image.width * scale, height: image.height * scale, left: boxLeft - crop.sx * scale, top: boxTop - crop.sy * scale };
        }
        else {
            const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
            pictureStyle = { width: image.width * scale, height: image.height * scale, left: boxLeft + (boxWidth - image.width * scale) / 2, top: boxTop + (boxHeight - image.height * scale) / 2 };
        }
    }
    const slot = slotSize(request.frame, state.aspect, ratio);
    const baked = image && request.method === 'baked'
        ? outputSize((({ sw, sh }) => ({ width: sw, height: sh }))(sourceRect(image, ratio, state)), slot)
        : null;
    const soft = image && !isVideo && !request.vector ? enlargement(image, ratio, state, slot) > 1.15 : false;
    const heavy = isVideo && (request.bytes ?? 0) > HEAVY_VIDEO_BYTES;
    // Handlers below read the latest geometry through a ref; the native
    // listeners are attached once.
    const live = useRef({ image, ratio, boxWidth, boxLeft, boxTop, boxHeight, state, zoomable, busy, apply: () => { }, cancel: onCancel });
    live.current = { image, ratio, boxWidth, boxLeft, boxTop, boxHeight, state, zoomable, busy, apply, cancel: onCancel };
    async function apply() {
        if (!natural || busy)
            return;
        setBusy(true);
        setError(null);
        try {
            await onApply({ state: state.mode === 'fill' ? clampFitState(natural, ratio, state) : state, natural, playback: isVideo ? playback : undefined });
        }
        catch (reason) {
            setBusy(false);
            setError(reason instanceof Error ? reason.message : 'Could not place it. Try again.');
        }
    }
    /* Wheel zoom toward the pointer. Native and non-passive, so the page behind does not scroll. */
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const onWheel = (event) => {
            event.preventDefault();
            const current = live.current;
            if (!current.image || current.state.mode !== 'fill' || !current.zoomable)
                return;
            const bounds = stage.getBoundingClientRect();
            const px = Math.min(1, Math.max(0, (event.clientX - bounds.left - current.boxLeft) / current.boxWidth));
            const py = Math.min(1, Math.max(0, (event.clientY - bounds.top - current.boxTop) / current.boxHeight));
            const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0015));
            const fitImage = current.image;
            setState((previous) => zoomFitAt(fitImage, current.ratio, previous, previous.zoom * factor, px, py));
        };
        stage.addEventListener('wheel', onWheel, { passive: false });
        return () => stage.removeEventListener('wheel', onWheel);
    }, []);
    /*
     * Keys. Window capture runs before the editor's own shortcuts, so while
     * this is open Delete does not delete the selection behind it, Ctrl+Z does
     * not undo the page, and typing does not write into selected copy.
     */
    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        stageRef.current?.focus({ preventScroll: true });
        const onKey = (event) => {
            event.stopPropagation();
            const current = live.current;
            if (event.key === 'Escape') {
                event.preventDefault();
                if (!current.busy)
                    current.cancel();
                return;
            }
            if (event.key === 'Tab') {
                const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]') ?? []);
                if (!focusable.length)
                    return;
                const index = focusable.indexOf(document.activeElement);
                const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index === focusable.length - 1 ? 0 : index + 1);
                event.preventDefault();
                focusable[next].focus();
                return;
            }
            const onControl = event.target instanceof HTMLButtonElement || (event.target instanceof HTMLInputElement && event.target.type === 'checkbox');
            if (event.key === 'Enter' && !onControl) {
                event.preventDefault();
                void current.apply();
                return;
            }
            if (event.target !== stageRef.current || !current.image || current.state.mode !== 'fill')
                return;
            const fitImage = current.image;
            const step = event.shiftKey ? NUDGE * 4 : NUDGE;
            const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            const move = moves[event.key];
            if (move) {
                event.preventDefault();
                setState((previous) => panFit(fitImage, current.ratio, previous, move[0], move[1], current.boxWidth));
                return;
            }
            if (current.zoomable && (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_')) {
                event.preventDefault();
                const factor = event.key === '-' || event.key === '_' ? 1 / 1.15 : 1.15;
                setState((previous) => zoomFitAt(fitImage, current.ratio, previous, previous.zoom * factor));
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previousFocus?.focus({ preventScroll: true });
        };
    }, []);
    function pinchOf(points) {
        const [a, b] = [...points.values()];
        return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    function handlePointerDown(event) {
        if (!image || state.mode !== 'fill' || event.button !== 0)
            return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const points = pointersRef.current;
        points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        pinchRef.current = points.size >= 2 && zoomable ? pinchOf(points) : null;
        setDragging(true);
    }
    function handlePointerMove(event) {
        const points = pointersRef.current;
        const last = points.get(event.pointerId);
        if (!last || !image)
            return;
        points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (points.size >= 2 && zoomable) {
            // Pinch: zoom by the change in finger spread, around the fingers,
            // and follow them as they move together.
            const previous = pinchRef.current;
            const next = pinchOf(points);
            pinchRef.current = next;
            if (!previous || previous.distance < 1)
                return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const px = Math.min(1, Math.max(0, (next.x - bounds.left - boxLeft) / boxWidth));
            const py = Math.min(1, Math.max(0, (next.y - bounds.top - boxTop) / boxHeight));
            setState((current) => panFit(image, ratio, zoomFitAt(image, ratio, current, current.zoom * (next.distance / previous.distance), px, py), next.x - previous.x, next.y - previous.y, boxWidth));
            return;
        }
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        setState((current) => panFit(image, ratio, current, dx, dy, boxWidth));
    }
    function endDrag(event) {
        const points = pointersRef.current;
        if (!points.delete(event.pointerId))
            return;
        pinchRef.current = points.size >= 2 && zoomable ? pinchOf(points) : null;
        if (!points.size)
            setDragging(false);
    }
    function chooseAspect(aspect) {
        setState((previous) => {
            const next = { ...previous, aspect };
            return image ? clampFitState(image, resolveAspectRatio(aspect, request.frame, image), next) : next;
        });
    }
    function chooseMode(mode) {
        setState((previous) => ({ ...previous, mode }));
    }
    function zoomTo(zoom) {
        if (!image || !zoomable)
            return;
        setState((previous) => zoomFitAt(image, ratio, previous, zoom));
    }
    function togglePlayback(key) {
        setPlayback((current) => {
            const next = { ...current, [key]: !current[key] };
            // Browsers only start a video on their own when it is silent.
            if (key === 'muted' && !next.muted)
                next.autoplay = false;
            if (key === 'autoplay' && next.autoplay)
                next.muted = true;
            // A video that neither starts nor has controls could never be played.
            if (!next.autoplay && !next.controls)
                next.controls = true;
            return next;
        });
    }
    const fill = state.mode === 'fill';
    const title = request.isUpload ? (isVideo ? 'Fit your video' : 'Fit your image') : (isVideo ? 'Adjust video' : 'Adjust image');
    const hint = !fill
        ? `The whole ${isVideo ? 'video' : 'image'} shows inside the frame`
        : zoomable ? 'Drag to move · scroll or pinch to zoom' : 'Drag to choose what shows';
    return (_jsx("div", { className: "froam-image-fit", "data-chef-editor-root": "true", children: _jsxs("div", { ref: dialogRef, className: "froam-image-fit__card", role: "dialog", "aria-modal": "true", "aria-labelledby": "froam-image-fit-title", "aria-busy": busy, "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-image-fit__header", children: [_jsxs("div", { className: "froam-image-fit__title", id: "froam-image-fit-title", children: [_jsx(Crop, { size: 16 }), _jsx("span", { children: title })] }), _jsx("button", { type: "button", className: "froam-image-fit__close", onClick: onCancel, disabled: busy, "aria-label": "Close", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { ref: stageRef, className: `froam-image-fit__stage${fill ? ' is-fill' : ' is-fit'}${dragging ? ' is-dragging' : ''}`, tabIndex: 0, "aria-label": fill ? 'Crop preview. Drag, or use the arrow keys, to move it.' + (zoomable ? ' Plus and minus zoom.' : '') : 'Preview of the whole file inside the frame', onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, children: [isVideo ? (_jsx("video", { className: "froam-image-fit__picture", src: request.previewUrl, style: pictureStyle, muted: true, autoPlay: true, loop: true, playsInline: true, preload: "auto", onLoadedMetadata: (event) => loaded(event.currentTarget.videoWidth, event.currentTarget.videoHeight), onError: () => setError('This video could not be opened. Froam plays MP4 (H.264), WebM and Ogg.') })) : (_jsx("img", { className: "froam-image-fit__picture", src: request.previewUrl, alt: "", draggable: false, decoding: "async", style: pictureStyle, onLoad: (event) => loaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight), onError: () => setError('This image couldn’t be opened. Try uploading it again.') })), view.width > 0 ? (_jsx("div", { className: "froam-image-fit__frame", style: { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight }, "aria-hidden": "true", children: fill ? _jsx("span", { className: "froam-image-fit__thirds" }) : null })) : null, !natural && !error ? _jsx("div", { className: "froam-image-fit__status", children: "Opening\u2026" }) : null, busy ? _jsx("div", { className: "froam-image-fit__status is-busy", children: "Placing\u2026" }) : null] }), error ? _jsx("p", { className: "froam-image-fit__error", role: "alert", children: error }) : null, request.note && !error ? _jsx("p", { className: "froam-image-fit__note", children: request.note }) : null, _jsxs("div", { className: "froam-image-fit__controls", children: [_jsxs("div", { className: "froam-image-fit__segmented", role: "radiogroup", "aria-label": "How it fills the frame", children: [_jsx("button", { type: "button", role: "radio", "aria-checked": fill, className: fill ? 'is-active' : '', onClick: () => chooseMode('fill'), title: "Fill the frame; the edges that don\u2019t fit are cut off", children: "Fill" }), _jsx("button", { type: "button", role: "radio", "aria-checked": !fill, className: !fill ? 'is-active' : '', onClick: () => chooseMode('fit'), title: "Show all of it; the frame\u2019s background fills any gap", children: "Fit" })] }), _jsxs("div", { className: `froam-image-fit__zoom${fill && zoomable ? '' : ' is-disabled'}`, title: zoomable ? undefined : 'Zoom works on photos, on backgrounds and inside Froam frames. Here the position is what you choose.', children: [_jsx("button", { type: "button", className: "froam-image-fit__icon-btn", onClick: () => zoomTo(state.zoom / 1.2), disabled: !fill || !zoomable || !image || state.zoom <= 1, "aria-label": "Zoom out", children: _jsx(ZoomOut, { size: 14 }) }), _jsx("input", { type: "range", className: "fs-range", min: 1, max: MAX_IMAGE_FIT_ZOOM, step: 0.01, value: state.zoom, disabled: !fill || !zoomable || !image, onChange: (event) => zoomTo(Number(event.target.value)), "aria-label": "Zoom" }), _jsx("button", { type: "button", className: "froam-image-fit__icon-btn", onClick: () => zoomTo(state.zoom * 1.2), disabled: !fill || !zoomable || !image || state.zoom >= MAX_IMAGE_FIT_ZOOM, "aria-label": "Zoom in", children: _jsx(ZoomIn, { size: 14 }) })] }), _jsx("button", { type: "button", className: "froam-image-fit__icon-btn", onClick: () => setState((previous) => ({ ...DEFAULT_IMAGE_FIT, mode: previous.mode, aspect: previous.aspect })), disabled: !image || (state.zoom === 1 && state.x === 0.5 && state.y === 0.5), title: "Recentre and zoom out", "aria-label": "Reset position and zoom", children: _jsx(RotateCcw, { size: 14 }) })] }), _jsx("div", { className: "froam-image-fit__aspects", role: "radiogroup", "aria-label": "Shape", children: IMAGE_FIT_ASPECTS.filter((option) => option.id !== 'frame' || isUsableSize(request.frame)).map((option) => (_jsx("button", { type: "button", role: "radio", "aria-checked": state.aspect === option.id, className: `froam-image-fit__chip${state.aspect === option.id ? ' is-active' : ''}`, onClick: () => chooseAspect(option.id), title: option.title, children: option.label }, option.id))) }), isVideo ? (_jsx("div", { className: "froam-image-fit__playback", role: "group", "aria-label": "How the video plays", children: [['autoplay', 'Plays on its own'], ['loop', 'Loops'], ['muted', 'Muted'], ['controls', 'Controls']].map(([key, label]) => (_jsxs("label", { className: `froam-image-fit__toggle${playback[key] ? ' is-on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: playback[key], onChange: () => togglePlayback(key) }), _jsx("span", { children: label })] }, key))) })) : null, _jsxs("div", { className: "froam-image-fit__footer", children: [_jsxs("div", { className: "froam-image-fit__meta", "aria-live": "polite", children: [soft
                                    ? _jsx("span", { className: "froam-image-fit__warn", children: "Small for this spot \u2014 it may look soft. Zoom out or use a bigger photo." })
                                    : heavy
                                        ? _jsxs("span", { className: "froam-image-fit__warn", children: [Math.round((request.bytes ?? 0) / 1048576), " MB is heavy for a web page \u2014 under 10 MB loads fast on phones."] })
                                        : _jsx("span", { children: hint }), baked ? _jsxs("span", { className: "froam-image-fit__size", children: [baked.width, " \u00D7 ", baked.height] }) : null, !baked && natural ? _jsxs("span", { className: "froam-image-fit__size", children: [natural.width, " \u00D7 ", natural.height, request.method === 'live' && !isVideo ? ' · kept as is' : ''] }) : null] }), _jsxs("div", { className: "froam-image-fit__actions", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: onCancel, disabled: busy, children: "Cancel" }), _jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => void apply(), disabled: !natural || busy || (Boolean(error) && !busy && !natural), children: busy ? 'Placing…' : request.isUpload ? (isVideo ? 'Place video' : 'Place image') : 'Apply' })] })] })] }) }));
}
//# sourceMappingURL=FroamImageFit.js.map