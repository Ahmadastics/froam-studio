function luma(data, at) { return data[at] * .2126 + data[at + 1] * .7152 + data[at + 2] * .0722; }
export function detectProbableScreenRegion(photo) { if (photo.width < 32 || photo.height < 32)
    return null; let minX = photo.width, maxX = 0, minY = photo.height, maxY = 0, hits = 0; const step = Math.max(1, Math.floor(Math.min(photo.width, photo.height) / 256)); for (let y = step; y < photo.height - step; y += step)
    for (let x = step; x < photo.width - step; x += step) {
        const at = (y * photo.width + x) * 4;
        const gradient = Math.abs(luma(photo.data, at) - luma(photo.data, at - 4)) + Math.abs(luma(photo.data, at) - luma(photo.data, at - photo.width * 4));
        if (gradient > 70) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            hits += 1;
        }
    } if (hits < 20 || maxX - minX < photo.width * .15 || maxY - minY < photo.height * .15)
    return null; return { topLeft: { x: minX, y: minY }, topRight: { x: maxX, y: minY }, bottomRight: { x: maxX, y: maxY }, bottomLeft: { x: minX, y: maxY }, confidence: Math.min(.55, .25 + hits / (photo.width * photo.height / step / step) * 2), method: 'gradient-bounds-v1' }; }
function mix(a, b, t) { return a + (b - a) * t; }
export function rectifyScreenRegion(photo, quad, width, height) { const outputWidth = Math.max(1, Math.min(4096, Math.floor(width))); const outputHeight = Math.max(1, Math.min(4096, Math.floor(height))); const data = new Uint8ClampedArray(outputWidth * outputHeight * 4); for (let y = 0; y < outputHeight; y += 1) {
    const v = y / Math.max(1, outputHeight - 1);
    const lx = mix(quad.topLeft.x, quad.bottomLeft.x, v);
    const ly = mix(quad.topLeft.y, quad.bottomLeft.y, v);
    const rx = mix(quad.topRight.x, quad.bottomRight.x, v);
    const ry = mix(quad.topRight.y, quad.bottomRight.y, v);
    for (let x = 0; x < outputWidth; x += 1) {
        const u = x / Math.max(1, outputWidth - 1);
        const sx = Math.max(0, Math.min(photo.width - 1, Math.round(mix(lx, rx, u))));
        const sy = Math.max(0, Math.min(photo.height - 1, Math.round(mix(ly, ry, u))));
        const source = (sy * photo.width + sx) * 4;
        const target = (y * outputWidth + x) * 4;
        data[target] = photo.data[source];
        data[target + 1] = photo.data[source + 1];
        data[target + 2] = photo.data[source + 2];
        data[target + 3] = photo.data[source + 3];
    }
} return { width: outputWidth, height: outputHeight, data, mimeType: 'image/raw', name: 'Rectified probable screen', metadata: { realityResearch: true, sourceWidth: photo.width, sourceHeight: photo.height, quad, limitations: ['Probable screen region only; manual confirmation required.', 'Bilinear quadrilateral correction is not camera calibration.'] } }; }
//# sourceMappingURL=reality.js.map