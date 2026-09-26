/**
 * Profile photos travel inside the room (the server keeps each person's
 * profile beside their name), so a phone photo must become a small square
 * before it goes anywhere: the room refuses anything over ~120 KB, and a
 * refused photo is a teammate who shows up as initials for no visible reason.
 */
const AVATAR_SIZE = 160;
/** Stays well under the room's limit even for a detailed photo. */
const MAX_DATA_URL_LENGTH = 60_000;
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('That image could not be read'));
        image.src = src;
    });
}
function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('That image could not be read')));
        reader.onerror = () => reject(new Error('That image could not be read'));
        reader.readAsDataURL(file);
    });
}
/** Centre-crop to a square, scale down, and re-encode until it is small. */
export async function shrinkAvatar(file) {
    if (!file.type.startsWith('image/'))
        throw new Error('Use an image file for your photo');
    const source = await readAsDataUrl(file);
    const image = await loadImage(source);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side)
        throw new Error('That image could not be read');
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context)
        return source;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    for (const quality of [0.86, 0.72, 0.58, 0.44]) {
        const url = canvas.toDataURL('image/jpeg', quality);
        if (url.length <= MAX_DATA_URL_LENGTH)
            return url;
    }
    throw new Error('That photo is too detailed — try another');
}
//# sourceMappingURL=avatar-image.js.map