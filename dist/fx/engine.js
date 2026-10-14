/**
 * Froam effects — interactive styles that answer the cursor, the scroll and
 * the passing of time: tilt, magnetic pull, spotlight, reveals, parallax,
 * kinetic text, marquees, hover craft.
 *
 * An effect is a style like any other, `--froam-fx-<id>: <params>` (for
 * example `--froam-fx-tilt: max:12 glare:0.3`), so it is saved, merged
 * between devices, undone, cascaded by screen size (`none` at Mobile turns
 * one off on phones) and shipped exactly as colours are. This engine reads
 * those properties off the page and brings them to life. The same code runs
 * in the editor and, inlined into froam.runtime.js (lib/codegen.mjs), on the
 * live site — so it imports nothing and touches nothing but the elements
 * that ask for it.
 *
 * Rules every effect keeps:
 *   - `prefers-reduced-motion`: nothing moves; content is shown as it is.
 *   - Cursor effects need a real cursor; on touch they stay still.
 *   - Content is never hidden from a crawler: only this script hides it, and
 *     only until it is revealed.
 *   - Whatever an effect changes it puts back when it ends. In the editor
 *     ("preview"), effects that rewrite text or structure play once and
 *     restore, so editing and saving never see the split-up version.
 */
export const FX_PREFIX = '--froam-fx-';
const n = (key, label, def, min, max, step, unit = '') => ({ key, label, kind: 'number', default: def, min, max, step, unit });
const c = (key, label, def, options) => ({ key, label, kind: 'choice', default: def, options });
const col = (key, label, def) => ({ key, label, kind: 'color', default: def });
export const FX_CATALOG = [
    /* Follow the cursor */
    { id: 'tilt', family: 'pointer', label: '3D tilt', description: 'Leans toward the cursor in 3D, with a glint of light', params: [n('max', 'Angle', 10, 2, 30, 1, '°'), n('glare', 'Glint', 0.35, 0, 1, 0.05), n('lift', 'Grow', 1.02, 1, 1.15, 0.01)] },
    { id: 'magnetic', family: 'pointer', label: 'Magnetic', description: 'Drifts toward the cursor as it comes near', params: [n('strength', 'Pull', 0.35, 0.05, 1, 0.05), n('radius', 'Reach', 110, 20, 400, 10, 'px')] },
    { id: 'spotlight', family: 'pointer', label: 'Cursor spotlight', description: 'A soft light that follows the cursor across it', params: [n('size', 'Size', 320, 80, 900, 20, 'px'), n('strength', 'Brightness', 0.22, 0.05, 0.8, 0.01), col('color', 'Colour', '#ffffff')] },
    { id: 'press', family: 'pointer', label: 'Springy press', description: 'Squishes when pressed and springs back', params: [n('depth', 'Squish', 0.95, 0.8, 0.99, 0.01)] },
    { id: 'ripple', family: 'pointer', label: 'Ripple', description: 'A ripple spreads from where it was pressed', params: [col('color', 'Colour', 'currentColor'), n('strength', 'Strength', 0.25, 0.05, 0.8, 0.05)] },
    { id: 'cursor', family: 'pointer', label: 'Cursor label', description: 'A pill with your words follows the cursor over it', params: [c('text', 'Says', 'View', ['View', 'Open', 'Play', 'Drag', 'Explore', '→']), col('color', 'Colour', '#111111')] },
    /* On scroll */
    { id: 'reveal', family: 'scroll', label: 'Reveal', description: 'Arrives as it scrolls into view', oneShot: true, params: [c('from', 'From', 'up', ['up', 'down', 'left', 'right', 'scale', 'blur', 'fade', 'mask']), n('distance', 'Distance', 36, 0, 200, 2, 'px'), n('duration', 'Duration', 800, 150, 3000, 50, 'ms'), n('delay', 'Delay', 0, 0, 2000, 50, 'ms'), n('stagger', 'Children one by one', 0, 0, 400, 10, 'ms')] },
    { id: 'parallax', family: 'scroll', label: 'Parallax', description: 'Moves at its own speed as the page scrolls, for depth', params: [n('speed', 'Speed', 0.15, -0.6, 0.6, 0.01)] },
    { id: 'scrub', family: 'scroll', label: 'Scroll scrub', description: 'Grows, turns or fades in step with the scroll', params: [n('scale', 'Starts at size', 0.85, 0.3, 1.5, 0.01), n('rotate', 'Starts turned', 0, -45, 45, 1, '°'), n('fade', 'Starts faded', 0.4, 0, 1, 0.05)] },
    { id: 'count', family: 'scroll', label: 'Count up', description: 'Numbers count up from zero when they come into view', oneShot: true, rewrites: true, text: true, params: [n('duration', 'Duration', 1600, 300, 6000, 100, 'ms')] },
    { id: 'progress', family: 'scroll', label: 'Scroll progress', description: 'Fills from left to right as the page is read', params: [] },
    { id: 'stack', family: 'scroll', label: 'Sticky stack', description: 'Sticks as you scroll and shrinks back as the next card covers it', params: [n('top', 'Sticks at', 80, 0, 400, 4, 'px'), n('shrink', 'Shrink to', 0.92, 0.6, 1, 0.01)] },
    /* Moving text */
    { id: 'words', family: 'text', label: 'Word by word', description: 'Words rise into place one after another', oneShot: true, rewrites: true, text: true, params: [n('stagger', 'Gap', 60, 10, 300, 5, 'ms'), n('duration', 'Each takes', 700, 150, 2000, 50, 'ms'), c('from', 'From', 'up', ['up', 'down', 'blur', 'fade'])] },
    { id: 'letters', family: 'text', label: 'Letter by letter', description: 'Letters arrive one at a time', oneShot: true, rewrites: true, text: true, params: [n('stagger', 'Gap', 24, 5, 120, 1, 'ms'), n('duration', 'Each takes', 500, 100, 1500, 50, 'ms')] },
    { id: 'scramble', family: 'text', label: 'Decode', description: 'Scrambles through random characters into the real words', oneShot: true, rewrites: true, text: true, params: [n('duration', 'Duration', 1100, 300, 4000, 100, 'ms'), c('when', 'When', 'view', ['view', 'hover'])] },
    { id: 'typewriter', family: 'text', label: 'Typewriter', description: 'Typed out a letter at a time, with a caret', oneShot: true, rewrites: true, text: true, params: [n('speed', 'Letters a second', 22, 4, 80, 1)] },
    { id: 'highlight', family: 'text', label: 'Marker highlight', description: 'A marker stroke is drawn under the words', oneShot: true, text: true, params: [col('color', 'Colour', '#fde047'), n('duration', 'Duration', 900, 200, 3000, 50, 'ms'), n('height', 'Thickness', 0.38, 0.1, 1, 0.02, 'em')] },
    { id: 'gradient', family: 'text', label: 'Flowing gradient', description: 'A gradient flows slowly through the letters', text: true, params: [col('from', 'From', '#6366f1'), col('to', 'To', '#ec4899'), n('speed', 'One flow takes', 6, 1, 30, 0.5, 's')] },
    { id: 'marquee', family: 'text', label: 'Marquee', description: 'Scrolls sideways forever, like a ticker', rewrites: true, params: [n('speed', 'Speed', 60, 10, 400, 5, 'px/s'), c('direction', 'Direction', 'left', ['left', 'right']), c('hover', 'On hover', 'pause', ['pause', 'keep going'])] },
    /* Hover craft */
    { id: 'zoom', family: 'craft', label: 'Zoom inside', description: 'The picture inside zooms in its frame on hover', params: [n('scale', 'Zoom', 1.08, 1.01, 1.4, 0.01), n('duration', 'Duration', 700, 150, 2000, 50, 'ms')] },
    { id: 'underline', family: 'craft', label: 'Drawn underline', description: 'An underline is drawn on hover and leaves the other way', params: [n('thickness', 'Thickness', 2, 1, 8, 1, 'px'), col('color', 'Colour', 'currentColor')] },
    { id: 'border', family: 'craft', label: 'Flowing border', description: 'A glowing gradient travels around the edge', params: [col('from', 'From', '#22d3ee'), col('to', 'To', '#a855f7'), n('width', 'Width', 2, 1, 6, 1, 'px'), n('speed', 'One turn takes', 4, 1, 20, 0.5, 's')] },
    { id: 'shine', family: 'craft', label: 'Shine', description: 'A sheen sweeps across on hover', params: [n('strength', 'Brightness', 0.35, 0.05, 0.9, 0.05), n('duration', 'Duration', 900, 200, 3000, 50, 'ms')] },
    { id: 'lift', family: 'craft', label: 'Spring lift', description: 'Rises on hover with a soft shadow, and settles with a spring', params: [n('height', 'Rise', 8, 1, 30, 1, 'px')] },
    { id: 'flip', family: 'craft', label: '3D flip', description: 'Turns over in 3D on hover to show its back', params: [c('axis', 'Turns', 'horizontal', ['horizontal', 'vertical'])] },
    /* Always alive */
    { id: 'float', family: 'ambient', label: 'Gentle float', description: 'Floats gently up and down', params: [n('distance', 'Distance', 8, 2, 40, 1, 'px'), n('duration', 'One float takes', 4, 1, 15, 0.5, 's')] },
    { id: 'breathe', family: 'ambient', label: 'Breathe', description: 'Grows and settles slowly, like breathing', params: [n('scale', 'Grows to', 1.04, 1.01, 1.2, 0.01), n('duration', 'One breath takes', 4, 1, 15, 0.5, 's')] },
    { id: 'glow', family: 'ambient', label: 'Glow pulse', description: 'A soft glow pulses around it', params: [col('color', 'Colour', '#38bdf8'), n('size', 'Size', 24, 4, 80, 2, 'px'), n('duration', 'One pulse takes', 2.4, 0.5, 10, 0.1, 's')] },
    { id: 'confetti', family: 'ambient', label: 'Confetti burst', description: 'Bursts into confetti when clicked', params: [n('pieces', 'Pieces', 28, 8, 80, 2)] },
];
const SPECS = Object.fromEntries(FX_CATALOG.map((spec) => [spec.id, spec]));
export const fxSpec = (id) => SPECS[id];
/** `max:12 glare:0.3` → { max: 12, glare: 0.3 }, filled in with defaults. `none` or nothing → null. */
export function parseFx(id, raw) {
    const spec = SPECS[id];
    const text = String(raw ?? '').trim().replace(/^["']|["']$/g, '');
    if (!spec || !text || text === 'none' || text === 'off')
        return null;
    const params = {};
    for (const param of spec.params)
        params[param.key] = param.default;
    for (const part of text.split(/\s+/)) {
        const at = part.indexOf(':');
        if (at <= 0)
            continue;
        const key = part.slice(0, at);
        const value = decodeURIComponent(part.slice(at + 1));
        const param = spec.params.find((entry) => entry.key === key);
        if (!param)
            continue;
        if (param.kind === 'number') {
            const number = Number(value);
            if (Number.isFinite(number))
                params[key] = Math.min(param.max ?? number, Math.max(param.min ?? number, number));
        }
        else if (param.kind === 'choice') {
            if (!param.options || param.options.includes(value))
                params[key] = value;
        }
        else if (/^(#[0-9a-f]{3,8}|currentColor|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i.test(value)) {
            params[key] = value;
        }
    }
    return params;
}
/** The value to store: only what differs from the defaults, or `on`. */
export function formatFx(id, params = {}) {
    const spec = SPECS[id];
    if (!spec)
        return 'none';
    const parts = spec.params
        .filter((param) => params[param.key] !== undefined && String(params[param.key]) !== String(param.default))
        .map((param) => `${param.key}:${encodeURIComponent(String(params[param.key]))}`);
    return parts.length ? parts.join(' ') : 'on';
}
export function installFroamFx(win) {
    const existing = win.__froamFx;
    if (existing)
        return existing;
    const doc = win.document;
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const finePointer = win.matchMedia?.('(hover: hover) and (pointer: fine)');
    const still = () => Boolean(reduced?.matches);
    const hasCursor = () => Boolean(finePointer?.matches);
    let preview = false;
    const running = new Map();
    /* ── motion: every effect's share of an element's movement, composed ── */
    const motions = new Map();
    const ZERO = { tx: 0, ty: 0, scale: 1, rx: 0, ry: 0, rz: 0 };
    function setMotion(el, owner, part) {
        let record = motions.get(el);
        if (!record) {
            record = { parts: new Map(), base: { translate: el.style.translate, scale: el.style.scale, transform: el.style.transform } };
            motions.set(el, record);
        }
        if (part)
            record.parts.set(owner, { ...ZERO, ...part });
        else
            record.parts.delete(owner);
        if (!record.parts.size) {
            el.style.translate = record.base.translate;
            el.style.scale = record.base.scale;
            el.style.transform = record.base.transform;
            motions.delete(el);
            return;
        }
        const sum = { ...ZERO };
        for (const value of record.parts.values()) {
            sum.tx += value.tx;
            sum.ty += value.ty;
            sum.rx += value.rx;
            sum.ry += value.ry;
            sum.rz += value.rz;
            sum.scale *= value.scale;
        }
        el.style.translate = `${sum.tx.toFixed(2)}px ${sum.ty.toFixed(2)}px`;
        el.style.scale = sum.scale.toFixed(4);
        const turn = sum.rx || sum.ry || sum.rz ? `perspective(900px) rotateX(${sum.rx.toFixed(2)}deg) rotateY(${sum.ry.toFixed(2)}deg) rotate(${sum.rz.toFixed(2)}deg)` : '';
        el.style.transform = [record.base.transform, turn].filter(Boolean).join(' ');
    }
    /** A value that follows its target with a spring, calling `draw` each frame until it settles. */
    function spring(initial, draw, { stiffness = 0.12, damping = 0.78 } = {}) {
        let value = initial;
        let target = initial;
        let velocity = 0;
        let frame = 0;
        const tick = () => {
            velocity = (velocity + (target - value) * stiffness) * damping;
            value += velocity;
            if (Math.abs(target - value) < 0.0005 && Math.abs(velocity) < 0.0005) {
                value = target;
                draw(value);
                frame = 0;
                return;
            }
            draw(value);
            frame = win.requestAnimationFrame(tick);
        };
        return {
            to(next) { target = next; if (!frame)
                frame = win.requestAnimationFrame(tick); },
            stop() { if (frame)
                win.cancelAnimationFrame(frame); frame = 0; },
        };
    }
    /** Remember inline styles and give them back exactly. */
    function keep(el, properties) {
        const saved = properties.map((property) => [property, el.style.getPropertyValue(property), el.style.getPropertyPriority(property)]);
        return () => { for (const [property, value, priority] of saved) {
            if (value)
                el.style.setProperty(property, value, priority);
            else
                el.style.removeProperty(property);
        } };
    }
    /** A layer laid over the element: never selectable, never saved, never in the way. */
    function layer(el, css) {
        const restore = win.getComputedStyle(el).position === 'static' ? keep(el, ['position']) : null;
        if (restore)
            el.style.position = 'relative';
        const span = doc.createElement('span');
        span.setAttribute('aria-hidden', 'true');
        span.setAttribute('data-chef-editor-root', 'true');
        span.setAttribute('data-froam-fx-layer', '');
        span.style.cssText = `position:absolute;inset:0;pointer-events:none;border-radius:inherit;${css}`;
        el.appendChild(span);
        return { span, remove: () => { span.remove(); restore?.(); } };
    }
    /** Once the element is on screen (now, if IntersectionObserver is missing), run `go`. */
    function whenSeen(el, go, threshold = 0.18) {
        if (typeof win.IntersectionObserver === 'undefined') {
            go();
            return () => { };
        }
        const io = new win.IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                io.disconnect();
                go();
            }
        }, { threshold, rootMargin: '0px 0px -8% 0px' });
        io.observe(el);
        return () => io.disconnect();
    }
    /** Run `frame` on every scroll/resize frame while the element is near the screen. */
    function onScroll(el, frame) {
        let near = true;
        let queued = 0;
        const schedule = () => { if (near && !queued)
            queued = win.requestAnimationFrame(() => { queued = 0; frame(); }); };
        const io = typeof win.IntersectionObserver !== 'undefined'
            ? new win.IntersectionObserver((entries) => { near = entries.some((entry) => entry.isIntersecting); schedule(); }, { rootMargin: '25% 0px' })
            : null;
        io?.observe(el);
        win.addEventListener('scroll', schedule, { passive: true });
        win.addEventListener('resize', schedule);
        frame();
        return () => { io?.disconnect(); win.removeEventListener('scroll', schedule); win.removeEventListener('resize', schedule); if (queued)
            win.cancelAnimationFrame(queued); };
    }
    /** Put an element's children back exactly as they were (after splitting text). */
    function snapshot(el) {
        const nodes = Array.from(el.childNodes);
        const label = el.getAttribute('aria-label');
        return () => {
            el.replaceChildren(...nodes);
            if (label === null)
                el.removeAttribute('aria-label');
            else
                el.setAttribute('aria-label', label);
        };
    }
    /** Wrap each word (or letter) of the element's own text in a span; the real words stay readable to screen readers. */
    function split(el, by) {
        const restore = snapshot(el);
        const pieces = [];
        el.setAttribute('aria-label', el.textContent?.replace(/\s+/g, ' ').trim() ?? '');
        const walk = (node) => {
            for (const child of Array.from(node.childNodes)) {
                if (child.nodeType === 3) {
                    const text = child.textContent ?? '';
                    const fragment = doc.createDocumentFragment();
                    for (const token of text.split(by === 'words' ? /(\s+)/ : /(\s)/)) {
                        if (!token)
                            continue;
                        if (/^\s+$/.test(token)) {
                            fragment.append(doc.createTextNode(token));
                            continue;
                        }
                        const units = by === 'words' ? [token] : Array.from(token);
                        for (const unit of units) {
                            const span = doc.createElement('span');
                            span.setAttribute('aria-hidden', 'true');
                            span.style.display = 'inline-block';
                            span.style.whiteSpace = 'pre';
                            span.textContent = unit;
                            pieces.push(span);
                            fragment.append(span);
                        }
                    }
                    child.replaceWith(fragment);
                }
                else if (child.nodeType === 1 && !child.hasAttribute('data-froam-fx-layer')) {
                    walk(child);
                }
            }
        };
        walk(el);
        return { pieces, restore };
    }
    const animate = (el, frames, options) => typeof el.animate === 'function' ? el.animate(frames, options) : null;
    const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const EFFECTS = {
        tilt(el, p) {
            if (!hasCursor() || still())
                return () => { };
            const max = Number(p.max);
            const glare = Number(p.glare);
            const restore = keep(el, ['transform-style', 'will-change']);
            el.style.willChange = 'transform';
            const shine = glare > 0 ? layer(el, `opacity:0;transition:opacity .4s;background:radial-gradient(circle at var(--fx-x,50%) var(--fx-y,50%), rgba(255,255,255,${glare}), transparent 60%);mix-blend-mode:soft-light;z-index:1`) : null;
            let rx = 0, ry = 0, s = 1;
            const draw = () => setMotion(el, 'tilt', { rx, ry, scale: s });
            const ax = spring(0, (v) => { rx = v; draw(); });
            const ay = spring(0, (v) => { ry = v; draw(); });
            const as = spring(1, (v) => { s = v; draw(); });
            const move = (event) => {
                const box = el.getBoundingClientRect();
                const x = (event.clientX - box.left) / box.width;
                const y = (event.clientY - box.top) / box.height;
                ax.to((0.5 - y) * 2 * max);
                ay.to((x - 0.5) * 2 * max);
                if (shine) {
                    shine.span.style.setProperty('--fx-x', `${(x * 100).toFixed(1)}%`);
                    shine.span.style.setProperty('--fx-y', `${(y * 100).toFixed(1)}%`);
                }
            };
            const enter = () => { as.to(Number(p.lift)); if (shine)
                shine.span.style.opacity = '1'; };
            const leave = () => { ax.to(0); ay.to(0); as.to(1); if (shine)
                shine.span.style.opacity = '0'; };
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => {
                el.removeEventListener('pointermove', move);
                el.removeEventListener('pointerenter', enter);
                el.removeEventListener('pointerleave', leave);
                ax.stop();
                ay.stop();
                as.stop();
                shine?.remove();
                setMotion(el, 'tilt', null);
                restore();
            };
        },
        magnetic(el, p) {
            if (!hasCursor() || still())
                return () => { };
            const strength = Number(p.strength);
            const reach = Number(p.radius);
            let tx = 0, ty = 0;
            const draw = () => setMotion(el, 'magnetic', { tx, ty });
            const sx = spring(0, (v) => { tx = v; draw(); }, { stiffness: 0.15, damping: 0.72 });
            const sy = spring(0, (v) => { ty = v; draw(); }, { stiffness: 0.15, damping: 0.72 });
            const move = (event) => {
                const box = el.getBoundingClientRect();
                const cx = box.left + box.width / 2 - tx;
                const cy = box.top + box.height / 2 - ty;
                const dx = event.clientX - cx;
                const dy = event.clientY - cy;
                const near = Math.abs(dx) < box.width / 2 + reach && Math.abs(dy) < box.height / 2 + reach;
                sx.to(near ? dx * strength : 0);
                sy.to(near ? dy * strength : 0);
            };
            win.addEventListener('pointermove', move, { passive: true });
            return () => { win.removeEventListener('pointermove', move); sx.stop(); sy.stop(); setMotion(el, 'magnetic', null); };
        },
        spotlight(el, p) {
            if (!hasCursor())
                return () => { };
            const restore = keep(el, ['overflow']);
            if (win.getComputedStyle(el).overflow === 'visible')
                el.style.overflow = 'hidden';
            const light = layer(el, `opacity:0;transition:opacity .35s;background:radial-gradient(${Number(p.size)}px circle at var(--fx-x,50%) var(--fx-y,50%), color-mix(in srgb, ${p.color} ${Math.round(Number(p.strength) * 100)}%, transparent), transparent 70%);z-index:1`);
            const move = (event) => {
                const box = el.getBoundingClientRect();
                light.span.style.setProperty('--fx-x', `${event.clientX - box.left}px`);
                light.span.style.setProperty('--fx-y', `${event.clientY - box.top}px`);
            };
            const enter = () => { light.span.style.opacity = '1'; };
            const leave = () => { light.span.style.opacity = '0'; };
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); light.remove(); restore(); };
        },
        press(el, p) {
            if (still())
                return () => { };
            const s = spring(1, (v) => setMotion(el, 'press', { scale: v }), { stiffness: 0.2, damping: 0.62 });
            const down = () => s.to(Number(p.depth));
            const up = () => s.to(1);
            el.addEventListener('pointerdown', down);
            win.addEventListener('pointerup', up);
            el.addEventListener('pointerleave', up);
            return () => { el.removeEventListener('pointerdown', down); win.removeEventListener('pointerup', up); el.removeEventListener('pointerleave', up); s.stop(); setMotion(el, 'press', null); };
        },
        ripple(el, p) {
            const restore = keep(el, ['overflow']);
            if (win.getComputedStyle(el).overflow === 'visible')
                el.style.overflow = 'hidden';
            const down = (event) => {
                if (still())
                    return;
                const box = el.getBoundingClientRect();
                const size = Math.max(box.width, box.height) * 2.2;
                const wave = layer(el, `inset:auto;left:${event.clientX - box.left - size / 2}px;top:${event.clientY - box.top - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:${p.color};opacity:${p.strength};transform:scale(0)`);
                const run = animate(wave.span, [{ transform: 'scale(0)', opacity: Number(p.strength) }, { transform: 'scale(1)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
                if (run)
                    run.onfinish = () => wave.remove();
                else
                    win.setTimeout(() => wave.remove(), 650);
            };
            el.addEventListener('pointerdown', down);
            return () => { el.removeEventListener('pointerdown', down); el.querySelectorAll('[data-froam-fx-layer]').forEach((node) => node.remove()); restore(); };
        },
        cursor(el, p) {
            if (!hasCursor())
                return () => { };
            const pill = doc.createElement('span');
            pill.setAttribute('aria-hidden', 'true');
            pill.setAttribute('data-chef-editor-root', 'true');
            pill.setAttribute('data-froam-fx-layer', '');
            pill.textContent = String(p.text);
            pill.style.cssText = `position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;padding:8px 14px;border-radius:999px;background:${p.color};color:#fff;font:600 13px/1 system-ui,sans-serif;opacity:0;transform:translate(-50%,-50%) scale(.6);transition:opacity .2s, transform .25s cubic-bezier(.34,1.56,.64,1)`;
            doc.body.appendChild(pill);
            const move = (event) => { pill.style.left = `${event.clientX}px`; pill.style.top = `${event.clientY}px`; };
            const enter = () => { pill.style.opacity = '1'; pill.style.transform = 'translate(-50%,-50%) scale(1)'; };
            const leave = () => { pill.style.opacity = '0'; pill.style.transform = 'translate(-50%,-50%) scale(.6)'; };
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); pill.remove(); };
        },
        reveal(el, p) {
            if (still())
                return () => { };
            const distance = Number(p.distance);
            const from = String(p.from);
            const start = { opacity: 0 };
            if (from === 'up')
                start.translate = `0 ${distance}px`;
            if (from === 'down')
                start.translate = `0 ${-distance}px`;
            if (from === 'left')
                start.translate = `${-distance}px 0`;
            if (from === 'right')
                start.translate = `${distance}px 0`;
            if (from === 'scale')
                start.scale = '0.88';
            if (from === 'blur')
                start.filter = 'blur(14px)';
            if (from === 'mask') {
                start.clipPath = 'inset(0 0 100% 0)';
                start.opacity = 1;
            }
            const end = { opacity: 1, translate: '0 0', scale: '1', filter: 'blur(0px)', clipPath: 'inset(0 0 0% 0)' };
            for (const key of Object.keys(end))
                if (!(key in start))
                    delete end[key];
            const stagger = Number(p.stagger);
            const targets = stagger > 0 ? Array.from(el.children).filter((child) => !child.hasAttribute('data-froam-fx-layer')) : [el];
            const runs = [];
            // Hidden only by this script, and only until it's on screen.
            const hide = targets.map((target) => animate(target, [start, start], { duration: 1, fill: 'forwards' }));
            const play = () => {
                hide.forEach((run) => run?.cancel());
                targets.forEach((target, index) => {
                    const run = animate(target, [start, end], { duration: Number(p.duration), delay: Number(p.delay) + index * stagger, easing: EASE, fill: 'backwards' });
                    if (run)
                        runs.push(run);
                });
            };
            const stop = preview ? (play(), () => { }) : whenSeen(el, play);
            return () => { stop(); hide.forEach((run) => run?.cancel()); runs.forEach((run) => run.cancel()); };
        },
        parallax(el, p) {
            if (still())
                return () => { };
            const speed = Number(p.speed);
            const stop = onScroll(el, () => {
                const box = el.getBoundingClientRect();
                const offset = box.top + box.height / 2 - win.innerHeight / 2;
                setMotion(el, 'parallax', { ty: -offset * speed });
            });
            return () => { stop(); setMotion(el, 'parallax', null); };
        },
        scrub(el, p) {
            if (still())
                return () => { };
            const restore = keep(el, ['opacity']);
            const stop = onScroll(el, () => {
                const box = el.getBoundingClientRect();
                // 0 as it enters from below, 1 once its middle reaches the middle of the screen.
                const progress = Math.min(1, Math.max(0, (win.innerHeight - box.top) / (win.innerHeight / 2 + box.height / 2)));
                const eased = 1 - Math.pow(1 - progress, 2);
                setMotion(el, 'scrub', { scale: Number(p.scale) + (1 - Number(p.scale)) * eased, rz: Number(p.rotate) * (1 - eased) });
                el.style.opacity = String(1 - Number(p.fade) * (1 - eased));
            });
            return () => { stop(); setMotion(el, 'scrub', null); restore(); };
        },
        count(el, p) {
            const text = el.textContent ?? '';
            const match = /-?\d[\d,.]*/.exec(text);
            if (!match || still())
                return () => { };
            const raw = match[0];
            const target = Number(raw.replace(/,/g, ''));
            if (!Number.isFinite(target))
                return () => { };
            const decimals = (raw.split('.')[1] ?? '').length;
            const commas = raw.includes(',');
            const restore = snapshot(el);
            let frame = 0;
            const format = (value) => {
                const fixed = value.toFixed(decimals);
                return commas ? Number(fixed).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : fixed;
            };
            const play = () => {
                const started = win.performance.now();
                const tick = (now) => {
                    const t = Math.min(1, (now - started) / Number(p.duration));
                    const eased = 1 - Math.pow(1 - t, 3);
                    el.textContent = text.slice(0, match.index) + format(target * eased) + text.slice(match.index + raw.length);
                    if (t < 1)
                        frame = win.requestAnimationFrame(tick);
                    else
                        restore();
                };
                frame = win.requestAnimationFrame(tick);
            };
            const stop = preview ? (play(), () => { }) : whenSeen(el, play, 0.5);
            return () => { stop(); if (frame)
                win.cancelAnimationFrame(frame); restore(); };
        },
        progress(el) {
            // Its own width is the reading: scaled along x only, so not through the shared motion.
            const restore = keep(el, ['transform-origin', 'scale']);
            el.style.transformOrigin = 'left center';
            const draw = () => {
                const total = doc.documentElement.scrollHeight - win.innerHeight;
                const done = total > 0 ? Math.min(1, Math.max(0, win.scrollY / total)) : 0;
                el.style.scale = `${done.toFixed(4)} 1`;
            };
            win.addEventListener('scroll', draw, { passive: true });
            win.addEventListener('resize', draw);
            draw();
            return () => { win.removeEventListener('scroll', draw); win.removeEventListener('resize', draw); restore(); };
        },
        stack(el, p) {
            const restore = keep(el, ['position', 'top', 'transform-origin']);
            el.style.position = 'sticky';
            el.style.top = `${Number(p.top)}px`;
            el.style.transformOrigin = 'center top';
            if (still())
                return restore;
            const next = () => el.nextElementSibling;
            const stop = onScroll(el, () => {
                const follower = next();
                if (!follower)
                    return;
                const box = el.getBoundingClientRect();
                const covering = follower.getBoundingClientRect();
                const covered = Math.min(1, Math.max(0, (box.bottom - covering.top) / Math.max(1, box.height)));
                setMotion(el, 'stack', { scale: 1 - (1 - Number(p.shrink)) * covered });
            });
            return () => { stop(); setMotion(el, 'stack', null); restore(); };
        },
        words(el, p) {
            if (still())
                return () => { };
            const { pieces, restore } = split(el, 'words');
            const start = String(p.from) === 'blur' ? { opacity: 0, filter: 'blur(10px)' } : String(p.from) === 'fade' ? { opacity: 0 } : { opacity: 0, translate: `0 ${String(p.from) === 'down' ? '-' : ''}0.6em` };
            const hide = pieces.map((piece) => animate(piece, [start, start], { duration: 1, fill: 'forwards' }));
            let left = pieces.length;
            const play = () => {
                hide.forEach((run) => run?.cancel());
                pieces.forEach((piece, index) => {
                    const run = animate(piece, [start, { opacity: 1, translate: '0 0', filter: 'blur(0px)' }], { duration: Number(p.duration), delay: index * Number(p.stagger), easing: EASE, fill: 'backwards' });
                    const done = () => { left -= 1; if (left === 0)
                        restore(); };
                    if (run)
                        run.onfinish = done;
                    else
                        done();
                });
                if (!pieces.length)
                    restore();
            };
            const stop = preview ? (play(), () => { }) : whenSeen(el, play);
            return () => { stop(); restore(); };
        },
        letters(el, p) {
            if (still())
                return () => { };
            const { pieces, restore } = split(el, 'letters');
            const start = { opacity: 0, translate: '0 0.4em', rotate: '8deg' };
            const hide = pieces.map((piece) => animate(piece, [start, start], { duration: 1, fill: 'forwards' }));
            let left = pieces.length;
            const play = () => {
                hide.forEach((run) => run?.cancel());
                pieces.forEach((piece, index) => {
                    const run = animate(piece, [start, { opacity: 1, translate: '0 0', rotate: '0deg' }], { duration: Number(p.duration), delay: index * Number(p.stagger), easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' });
                    const done = () => { left -= 1; if (left === 0)
                        restore(); };
                    if (run)
                        run.onfinish = done;
                    else
                        done();
                });
                if (!pieces.length)
                    restore();
            };
            const stop = preview ? (play(), () => { }) : whenSeen(el, play);
            return () => { stop(); restore(); };
        },
        scramble(el, p) {
            if (still())
                return () => { };
            const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?';
            let frame = 0;
            let restore = null;
            const play = () => {
                if (frame)
                    return;
                restore = snapshot(el);
                const original = el.textContent ?? '';
                el.setAttribute('aria-label', original);
                const started = win.performance.now();
                const tick = (now) => {
                    const t = Math.min(1, (now - started) / Number(p.duration));
                    const settled = Math.floor(original.length * t);
                    el.textContent = Array.from(original).map((ch, i) => (i < settled || /\s/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
                    if (t < 1)
                        frame = win.requestAnimationFrame(tick);
                    else {
                        frame = 0;
                        restore?.();
                        restore = null;
                    }
                };
                frame = win.requestAnimationFrame(tick);
            };
            let stop = () => { };
            if (String(p.when) === 'hover') {
                el.addEventListener('pointerenter', play);
                stop = () => el.removeEventListener('pointerenter', play);
            }
            else
                stop = preview ? (play(), () => { }) : whenSeen(el, play);
            return () => { stop(); if (frame)
                win.cancelAnimationFrame(frame); frame = 0; restore?.(); };
        },
        typewriter(el, p) {
            if (still())
                return () => { };
            const restore = snapshot(el);
            const original = el.textContent ?? '';
            let frame = 0;
            const caret = '▍';
            el.setAttribute('aria-label', original);
            el.textContent = caret;
            const play = () => {
                const started = win.performance.now();
                const tick = (now) => {
                    const shown = Math.min(original.length, Math.floor(((now - started) / 1000) * Number(p.speed)));
                    el.textContent = original.slice(0, shown) + (shown < original.length || Math.floor(now / 500) % 2 ? caret : '');
                    if (shown < original.length || now - started < (original.length / Number(p.speed)) * 1000 + 1200)
                        frame = win.requestAnimationFrame(tick);
                    else {
                        frame = 0;
                        restore();
                    }
                };
                frame = win.requestAnimationFrame(tick);
            };
            const stop = preview ? (play(), () => { }) : whenSeen(el, play);
            return () => { stop(); if (frame)
                win.cancelAnimationFrame(frame); restore(); };
        },
        highlight(el, p) {
            const restore = keep(el, ['background-image', 'background-size', 'background-repeat', 'background-position', 'box-decoration-break', '-webkit-box-decoration-break']);
            const height = `${Number(p.height)}em`;
            el.style.backgroundImage = `linear-gradient(${p.color}, ${p.color})`;
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundPosition = '0 88%';
            el.style.setProperty('box-decoration-break', 'clone');
            el.style.setProperty('-webkit-box-decoration-break', 'clone');
            if (still()) {
                el.style.backgroundSize = `100% ${height}`;
                return restore;
            }
            el.style.backgroundSize = `0% ${height}`;
            let run = null;
            const play = () => { run = animate(el, [{ backgroundSize: `0% ${height}` }, { backgroundSize: `100% ${height}` }], { duration: Number(p.duration), easing: EASE, fill: 'forwards' }); };
            const stop = preview ? (play(), () => { }) : whenSeen(el, play, 0.6);
            return () => { stop(); run?.cancel(); restore(); };
        },
        gradient(el, p) {
            const restore = keep(el, ['background-image', 'background-size', '-webkit-background-clip', 'background-clip', 'color', '-webkit-text-fill-color']);
            el.style.backgroundImage = `linear-gradient(90deg, ${p.from}, ${p.to}, ${p.from})`;
            el.style.backgroundSize = '200% 100%';
            el.style.setProperty('-webkit-background-clip', 'text');
            el.style.setProperty('background-clip', 'text');
            el.style.setProperty('-webkit-text-fill-color', 'transparent');
            const run = still() ? null : animate(el, [{ backgroundPosition: '0% 50%' }, { backgroundPosition: '200% 50%' }], { duration: Number(p.speed) * 1000, iterations: Infinity });
            return () => { run?.cancel(); restore(); };
        },
        marquee(el, p) {
            if (still())
                return () => { };
            const restore = snapshot(el);
            const keepStyle = keep(el, ['overflow', 'white-space', 'display']);
            const items = Array.from(el.childNodes);
            const track = doc.createElement('span');
            track.setAttribute('data-froam-fx-track', '');
            track.style.cssText = 'display:inline-flex;gap:3rem;padding-right:3rem;will-change:transform';
            const copy = () => { const part = doc.createElement('span'); part.style.cssText = 'display:inline-flex;gap:3rem;flex:none'; items.forEach((node) => part.append(node.cloneNode(true))); return part; };
            const first = copy();
            const second = copy();
            second.setAttribute('aria-hidden', 'true');
            track.append(first, second);
            el.style.overflow = 'hidden';
            el.style.whiteSpace = 'nowrap';
            if (win.getComputedStyle(el).display === 'inline')
                el.style.display = 'block';
            el.replaceChildren(track);
            const width = first.getBoundingClientRect().width + 48;
            const leftward = String(p.direction) !== 'right';
            const run = animate(track, [{ transform: `translateX(${leftward ? 0 : -width}px)` }, { transform: `translateX(${leftward ? -width : 0}px)` }], { duration: (width / Number(p.speed)) * 1000, iterations: preview ? 1 : Infinity, easing: 'linear' });
            const pause = () => { if (String(p.hover) === 'pause')
                run?.pause(); };
            const resume = () => run?.play();
            el.addEventListener('pointerenter', pause);
            el.addEventListener('pointerleave', resume);
            const done = () => { el.removeEventListener('pointerenter', pause); el.removeEventListener('pointerleave', resume); run?.cancel(); restore(); keepStyle(); };
            // In the editor the children must be the page's own again, to be selected and saved.
            if (preview && run)
                run.onfinish = done;
            return done;
        },
        zoom(el, p) {
            const inner = el.querySelector('img, video, picture, svg') ?? el.firstElementChild;
            if (!inner || still())
                return () => { };
            const restoreOuter = keep(el, ['overflow']);
            const restoreInner = keep(inner, ['transition', 'scale']);
            if (win.getComputedStyle(el).overflow === 'visible')
                el.style.overflow = 'hidden';
            inner.style.transition = `scale ${Number(p.duration)}ms ${EASE}`;
            const enter = () => { inner.style.scale = String(p.scale); };
            const leave = () => { inner.style.scale = '1'; };
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); restoreInner(); restoreOuter(); };
        },
        underline(el, p) {
            const line = layer(el, `inset:auto 0 -2px 0;height:${Number(p.thickness)}px;background:${p.color};border-radius:${Number(p.thickness)}px;transform:scaleX(0);transform-origin:right;transition:transform .45s ${EASE}`);
            const enter = () => { line.span.style.transformOrigin = 'left'; line.span.style.transform = 'scaleX(1)'; };
            const leave = () => { line.span.style.transformOrigin = 'right'; line.span.style.transform = 'scaleX(0)'; };
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); line.remove(); };
        },
        border(el, p) {
            const ring = layer(el, `padding:${Number(p.width)}px;background:conic-gradient(from var(--fx-angle,0deg), ${p.from}, ${p.to}, ${p.from});-webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);filter:drop-shadow(0 0 6px ${p.to})`);
            if (still())
                return ring.remove;
            let frame = 0;
            let started = 0;
            const period = Number(p.speed) * 1000;
            const tick = (now) => { if (!started)
                started = now; ring.span.style.setProperty('--fx-angle', `${(((now - started) / period) * 360) % 360}deg`); frame = win.requestAnimationFrame(tick); };
            frame = win.requestAnimationFrame(tick);
            return () => { win.cancelAnimationFrame(frame); ring.remove(); };
        },
        shine(el, p) {
            const restore = keep(el, ['overflow']);
            if (win.getComputedStyle(el).overflow === 'visible')
                el.style.overflow = 'hidden';
            const band = layer(el, `background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,${p.strength}) 50%, transparent 65%);transform:translateX(-120%);z-index:1`);
            const enter = () => { if (!still())
                animate(band.span, [{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], { duration: Number(p.duration), easing: EASE }); };
            el.addEventListener('pointerenter', enter);
            return () => { el.removeEventListener('pointerenter', enter); band.remove(); restore(); };
        },
        lift(el, p) {
            const restore = keep(el, ['box-shadow', 'transition']);
            const shadow = el.style.boxShadow;
            const s = spring(0, (v) => {
                setMotion(el, 'lift', { ty: -v });
                el.style.boxShadow = v > 0.1 ? `0 ${(v * 2.2).toFixed(1)}px ${(v * 4).toFixed(1)}px -${(v * 1.2).toFixed(1)}px rgba(15, 23, 42, ${Math.min(0.28, v / 40).toFixed(3)})${shadow ? `, ${shadow}` : ''}` : shadow;
            }, { stiffness: 0.14, damping: 0.7 });
            const enter = () => { if (!still())
                s.to(Number(p.height)); };
            const leave = () => s.to(0);
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); s.stop(); setMotion(el, 'lift', null); restore(); };
        },
        flip(el, p) {
            const restore = keep(el, ['transition', 'transform-style']);
            const turns = String(p.axis) === 'vertical' ? 'rx' : 'ry';
            const s = spring(0, (v) => setMotion(el, 'flip', { [turns]: v }), { stiffness: 0.08, damping: 0.8 });
            const enter = () => { if (!still())
                s.to(180); };
            const leave = () => s.to(0);
            el.addEventListener('pointerenter', enter);
            el.addEventListener('pointerleave', leave);
            return () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); s.stop(); setMotion(el, 'flip', null); restore(); };
        },
        float(el, p) {
            if (still())
                return () => { };
            let frame = 0;
            const tick = (now) => { setMotion(el, 'float', { ty: Math.sin((now / (Number(p.duration) * 1000)) * Math.PI * 2) * Number(p.distance) }); frame = win.requestAnimationFrame(tick); };
            frame = win.requestAnimationFrame(tick);
            return () => { win.cancelAnimationFrame(frame); setMotion(el, 'float', null); };
        },
        breathe(el, p) {
            if (still())
                return () => { };
            let frame = 0;
            const tick = (now) => { setMotion(el, 'breathe', { scale: 1 + (Number(p.scale) - 1) * (0.5 - Math.cos((now / (Number(p.duration) * 1000)) * Math.PI * 2) / 2) }); frame = win.requestAnimationFrame(tick); };
            frame = win.requestAnimationFrame(tick);
            return () => { win.cancelAnimationFrame(frame); setMotion(el, 'breathe', null); };
        },
        glow(el, p) {
            const restore = keep(el, ['box-shadow']);
            const own = el.style.boxShadow;
            const size = Number(p.size);
            const run = still() ? null : animate(el, [
                { boxShadow: `0 0 0 0 transparent${own ? `, ${own}` : ''}` },
                { boxShadow: `0 0 ${size}px ${size / 3}px color-mix(in srgb, ${p.color} 55%, transparent)${own ? `, ${own}` : ''}` },
                { boxShadow: `0 0 0 0 transparent${own ? `, ${own}` : ''}` },
            ], { duration: Number(p.duration) * 1000, iterations: Infinity, easing: 'ease-in-out' });
            return () => { run?.cancel(); restore(); };
        },
        confetti(el, p) {
            const COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
            const burst = (event) => {
                if (still())
                    return;
                for (let i = 0; i < Number(p.pieces); i += 1) {
                    const piece = doc.createElement('span');
                    piece.setAttribute('aria-hidden', 'true');
                    piece.setAttribute('data-chef-editor-root', 'true');
                    piece.setAttribute('data-froam-fx-layer', '');
                    const size = 6 + Math.random() * 6;
                    piece.style.cssText = `position:fixed;left:${event.clientX}px;top:${event.clientY}px;width:${size}px;height:${size * 0.6}px;background:${COLORS[i % COLORS.length]};border-radius:2px;pointer-events:none;z-index:2147483000`;
                    doc.body.appendChild(piece);
                    const angle = Math.random() * Math.PI * 2;
                    const reach = 60 + Math.random() * 140;
                    const run = animate(piece, [
                        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
                        { transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach - 40}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.7 },
                        { transform: `translate(${Math.cos(angle) * reach * 1.1}px, ${Math.sin(angle) * reach + 120}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
                    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
                    if (run)
                        run.onfinish = () => piece.remove();
                    else
                        win.setTimeout(() => piece.remove(), 1200);
                }
            };
            el.addEventListener('click', burst);
            return () => el.removeEventListener('click', burst);
        },
    };
    /* ── reading the page ── */
    function targets() {
        return Array.from(doc.querySelectorAll('[data-froam-fx], [style*="--froam-fx-"]'))
            .filter((el) => !el.closest('[data-froam-fx-layer], [data-froam-fx-track]'));
    }
    function sync(el) {
        const computed = win.getComputedStyle(el);
        let effects = running.get(el);
        for (const spec of FX_CATALOG) {
            const raw = computed.getPropertyValue(`${FX_PREFIX}${spec.id}`).trim();
            const current = effects?.get(spec.id);
            const params = parseFx(spec.id, raw);
            if (current && current.raw === raw)
                continue;
            if (current) {
                current.stop();
                effects.delete(spec.id);
            }
            if (!params)
                continue;
            if (!effects) {
                effects = new Map();
                running.set(el, effects);
            }
            let stop = () => { };
            try {
                stop = EFFECTS[spec.id](el, params);
            }
            catch { /* one effect failing never stops the rest */ }
            effects.set(spec.id, { raw, stop });
        }
        if (effects && !effects.size)
            running.delete(el);
    }
    let queued = 0;
    function refreshNow() {
        queued = 0;
        const live = new Set(targets());
        for (const [el, effects] of running) {
            if (!live.has(el) || !el.isConnected) {
                for (const effect of effects.values())
                    effect.stop();
                running.delete(el);
            }
        }
        live.forEach(sync);
    }
    function refresh() { if (!queued)
        queued = win.requestAnimationFrame(refreshNow); }
    function replay(el) {
        const effects = running.get(el);
        if (!effects)
            return;
        for (const [id, effect] of effects) {
            if (!FX_CATALOG.find((spec) => spec.id === id)?.oneShot)
                continue;
            effect.stop();
            effects.delete(id);
        }
        sync(el);
    }
    let resizeTimer = 0;
    const onResize = () => { win.clearTimeout(resizeTimer); resizeTimer = win.setTimeout(refresh, 150); };
    win.addEventListener('resize', onResize);
    reduced?.addEventListener?.('change', () => { for (const effects of running.values())
        for (const effect of effects.values())
            effect.stop(); running.clear(); refresh(); });
    const observer = typeof win.MutationObserver !== 'undefined' ? new win.MutationObserver(refresh) : null;
    observer?.observe(doc.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-froam-fx'] });
    if (doc.readyState === 'loading')
        doc.addEventListener('DOMContentLoaded', refresh);
    else
        refresh();
    const api = {
        refresh,
        replay,
        setPreview(on) {
            if (preview === on)
                return;
            preview = on;
            // Everything restarts in its new manner: in the editor, rewriting effects must not be left mid-rewrite.
            for (const effects of running.values())
                for (const effect of effects.values())
                    effect.stop();
            running.clear();
            refresh();
        },
        destroy() {
            observer?.disconnect();
            win.removeEventListener('resize', onResize);
            for (const effects of running.values())
                for (const effect of effects.values())
                    effect.stop();
            running.clear();
            delete win.__froamFx;
        },
    };
    win.__froamFx = api;
    return api;
}
//# sourceMappingURL=engine.js.map