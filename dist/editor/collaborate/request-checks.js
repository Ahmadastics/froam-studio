import { findElementByPath } from '../../collab/paths.js';
import { imageAlternative, ownText, readTextContrast } from '../../project/a11y.js';
import { elementLabel } from './request-builder.js';
/**
 * What a reviewer would want to know before approving: can people read it,
 * does it fit, do images and links work. Runs on the page as previewed, so
 * it judges what people will actually see, at this screen size.
 */
export function checkRequestOnPage(root, paths, { viewport = 'desktop' } = {}) {
    const checks = [];
    const pageWidth = document.documentElement.clientWidth;
    const seen = new Set();
    for (const path of paths) {
        const element = findElementByPath(root, path);
        if (!element || seen.has(element))
            continue;
        seen.add(element);
        const label = elementLabel(path, root);
        const add = (kind, severity, message) => checks.push({ path, label, kind, severity, message });
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden')
            continue;
        if (ownText(element)) {
            // The same reading as the A11y tab and "Fix contrast everywhere": every
            // layer and gradient stop behind it, opacity applied, disabled controls exempt.
            const reading = readTextContrast(element);
            if (reading.status === 'measured' && !reading.passes) {
                const ratio = Math.floor(reading.ratio * 10) / 10;
                add('contrast', reading.ratio < reading.required - 1.5 ? 'fail' : 'warn', `Hard to read — contrast ${ratio.toFixed(1)}:1, needs ${reading.required}:1`);
            }
            const size = parseFloat(style.fontSize);
            if (viewport === 'mobile' && size < 12)
                add('small-text', 'warn', `Small on phones — ${Math.round(size)}px text`);
        }
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && (rect.right > pageWidth + 1 || rect.left < -1))
            add('overflow', 'fail', 'Runs off the side of the screen');
        else if (element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible' && style.overflowX !== 'auto' && style.overflowX !== 'scroll')
            add('clipped', 'warn', 'Text is cut off at the side');
        if (element.scrollHeight > element.clientHeight + 2 && (style.overflowY === 'hidden' || style.overflowY === 'clip') && ownText(element))
            add('clipped', 'warn', 'Text is cut off at the bottom');
        const images = element instanceof HTMLImageElement ? [element] : Array.from(element.querySelectorAll('img')).slice(0, 6);
        for (const image of images) {
            if (image.complete && image.naturalWidth === 0 && image.currentSrc)
                add('image', 'fail', 'Image doesn’t load');
            if (imageAlternative(image) === 'missing')
                add('alt', 'warn', 'Image has no description (alt text) for screen readers');
        }
        const link = element.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (!href || href === '#' || /^javascript:/i.test(href))
                add('link', 'warn', 'Link goes nowhere');
        }
    }
    return checks;
}
//# sourceMappingURL=request-checks.js.map