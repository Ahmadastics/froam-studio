function splitStyleKey(key) {
    const match = key.match(/^(__froamState:[^:]+:)(.+)$/);
    return match ? { prefix: match[1], property: match[2] } : { prefix: '', property: key };
}
function withPrefix(prefix, property) {
    return `${prefix}${property}`;
}
function splitShadows(value) {
    const shadows = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (character === '(')
            depth += 1;
        if (character === ')')
            depth = Math.max(0, depth - 1);
        if (character === ',' && depth === 0) {
            shadows.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    shadows.push(value.slice(start).trim());
    return shadows.filter(Boolean);
}
function boxShadowToTextShadow(value) {
    if (!value || value === 'none')
        return 'none';
    return splitShadows(value).map((shadow) => {
        const tokens = shadow.replace(/\binset\b/gi, '').trim().split(/\s+(?![^()]*\))/);
        const lengths = [];
        const rest = [];
        tokens.forEach((token) => {
            if (/^-?(?:\d+|\d*\.\d+)(?:px|em|rem)?$/i.test(token) && rest.length === 0)
                lengths.push(token);
            else
                rest.push(token);
        });
        const [x = '0', y = '0', blur = '0'] = lengths;
        return [x, y, blur, ...rest].join(' ').trim();
    }).join(', ');
}
function borderParts(value) {
    if (!value || value === 'none' || value === '0')
        return { width: '0px', color: '' };
    const width = value.match(/(?:^|\s)(-?(?:\d+|\d*\.\d+)(?:px|em|rem))/i)?.[1] ?? '';
    const color = value.match(/(#[\da-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|color-mix\([^)]*\)|[a-z]+)\s*$/i)?.[1] ?? '';
    return { width, color };
}
function isImageFill(value) {
    return /(?:gradient|url|image-set)\(/i.test(value);
}
function isClearFill(value) {
    return !value || value === 'none' || value === 'transparent' || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value);
}
/**
 * Converts box-oriented visual styles into glyph-oriented equivalents.
 * Typography, transforms, opacity, filters, and layout remain untouched.
 */
export function projectTextLayerStyles(styles) {
    const projected = {};
    const propertiesByPrefix = new Map();
    Object.keys(styles).forEach((key) => {
        const { prefix, property } = splitStyleKey(key);
        const properties = propertiesByPrefix.get(prefix) ?? new Set();
        properties.add(property);
        propertiesByPrefix.set(prefix, properties);
    });
    Object.entries(styles).forEach(([key, value]) => {
        const { prefix, property } = splitStyleKey(key);
        const properties = propertiesByPrefix.get(prefix) ?? new Set();
        const hasImageFill = [...properties].some((candidate) => {
            if (candidate !== 'background' && candidate !== 'backgroundImage')
                return false;
            return isImageFill(styles[withPrefix(prefix, candidate)] ?? '');
        });
        const hasExplicitTextColor = properties.has('color') || properties.has('WebkitTextFillColor');
        const write = (nextProperty, nextValue) => { projected[withPrefix(prefix, nextProperty)] = nextValue; };
        if (property === 'background' || property === 'backgroundColor') {
            if (isImageFill(value)) {
                write('backgroundImage', value);
                write('backgroundClip', 'text');
                write('WebkitBackgroundClip', 'text');
                write('color', 'transparent');
                write('WebkitTextFillColor', 'transparent');
            }
            else if (isClearFill(value)) {
                write('backgroundImage', 'none');
                write('backgroundClip', 'border-box');
                write('WebkitBackgroundClip', 'border-box');
                write('WebkitTextFillColor', 'currentColor');
            }
            else if (!hasExplicitTextColor) {
                write('color', value);
                write('WebkitTextFillColor', value);
                write('backgroundImage', 'none');
            }
            return;
        }
        if (property === 'backgroundImage') {
            if (isClearFill(value)) {
                write('backgroundImage', 'none');
                write('backgroundClip', 'border-box');
                write('WebkitBackgroundClip', 'border-box');
                write('WebkitTextFillColor', 'currentColor');
            }
            else {
                write('backgroundImage', value);
                write('backgroundClip', 'text');
                write('WebkitBackgroundClip', 'text');
                write('color', 'transparent');
                write('WebkitTextFillColor', 'transparent');
            }
            return;
        }
        if (property === 'color' || property === 'WebkitTextFillColor') {
            if (!hasImageFill) {
                write('color', value);
                write('WebkitTextFillColor', value);
                write('backgroundImage', 'none');
            }
            return;
        }
        if (property === 'boxShadow') {
            write('textShadow', boxShadowToTextShadow(value));
            return;
        }
        if (property === 'borderBottom') {
            const border = borderParts(value);
            write('textDecorationLine', border.width === '0px' ? 'none' : 'underline');
            if (border.width)
                write('textDecorationThickness', border.width);
            if (border.color)
                write('textDecorationColor', border.color);
            return;
        }
        if (property === 'border' || property === 'outline') {
            const border = borderParts(value);
            if (border.width)
                write('WebkitTextStrokeWidth', border.width);
            if (border.color)
                write('WebkitTextStrokeColor', border.color);
            return;
        }
        if (property === 'borderWidth' || property === 'outlineWidth') {
            write('WebkitTextStrokeWidth', value);
            return;
        }
        if (property === 'borderColor' || property === 'outlineColor') {
            write('WebkitTextStrokeColor', value);
            return;
        }
        if (/^border(?:Top|Right|Bottom|Left)?(?:Style|Radius)$/.test(property) || /^border(?:TopLeft|TopRight|BottomRight|BottomLeft)Radius$/.test(property) || property === 'backdropFilter')
            return;
        projected[key] = value;
    });
    return projected;
}
//# sourceMappingURL=text-style-projection.js.map