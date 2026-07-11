import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useRef, useEffect } from 'react';
import { Circle, Triangle, Star, Square, Hexagon, ArrowRight, Heart, Minus, Diamond, Octagon, } from 'lucide-react';
const SHAPES = [
    { id: 'rectangle', label: 'Rectangle', icon: _jsx(Square, { size: 16 }) },
    { id: 'rounded', label: 'Rounded', icon: _jsx(Square, { size: 16 }) },
    { id: 'circle', label: 'Circle', icon: _jsx(Circle, { size: 16 }) },
    { id: 'triangle', label: 'Triangle', icon: _jsx(Triangle, { size: 16 }) },
    { id: 'star', label: 'Star', icon: _jsx(Star, { size: 16 }) },
    { id: 'hexagon', label: 'Hexagon', icon: _jsx(Hexagon, { size: 16 }) },
    { id: 'diamond', label: 'Diamond', icon: _jsx(Diamond, { size: 16 }) },
    { id: 'arrow', label: 'Arrow', icon: _jsx(ArrowRight, { size: 16 }) },
    { id: 'heart', label: 'Heart', icon: _jsx(Heart, { size: 16 }) },
    { id: 'line', label: 'Line', icon: _jsx(Minus, { size: 16 }) },
    { id: 'pill', label: 'Pill', icon: _jsx(Octagon, { size: 16 }) },
    { id: 'blob', label: 'Blob', icon: _jsx(Circle, { size: 16 }) },
];
const COLOR_SWATCHES = [
    '#ef4444', '#ff6c4f', '#f97316', '#f8c15c', '#22c55e', '#5eead4',
    '#38bdf8', '#6366f1', '#8b5cf6', '#ec4899', '#0f172a', '#ffffff',
];
function buildShapeSVG(type, fill, stroke, strokeWidth, w, h) {
    const sw = strokeWidth;
    const pad = sw / 2;
    switch (type) {
        case 'rectangle':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect x="${pad}" y="${pad}" width="${w - sw}" height="${h - sw}" rx="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
        case 'rounded':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect x="${pad}" y="${pad}" width="${w - sw}" height="${h - sw}" rx="${Math.min(w, h) * 0.16}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
        case 'circle':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${(w - sw) / 2}" ry="${(h - sw) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
        case 'triangle':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polygon points="${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
        case 'star': {
            const cx = w / 2, cy = h / 2;
            const outerR = Math.min(w, h) / 2 - pad;
            const innerR = outerR * 0.4;
            const points = [];
            for (let i = 0; i < 10; i++) {
                const r = i % 2 === 0 ? outerR : innerR;
                const angle = (Math.PI / 5) * i - Math.PI / 2;
                points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
            }
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
        }
        case 'hexagon': {
            const cx = w / 2, cy = h / 2;
            const r = Math.min(w, h) / 2 - pad;
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
            }
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
        }
        case 'diamond':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polygon points="${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
        case 'arrow':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polygon points="${pad},${h * 0.3} ${w * 0.6},${h * 0.3} ${w * 0.6},${pad} ${w - pad},${h / 2} ${w * 0.6},${h - pad} ${w * 0.6},${h * 0.7} ${pad},${h * 0.7}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
        case 'heart': {
            const s = Math.min(w, h);
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}"><path d="M${s / 2},${s * 0.85} C${s * 0.1},${s * 0.55} ${s * 0.02},${s * 0.3} ${s * 0.25},${s * 0.18} C${s * 0.38},${s * 0.1} ${s * 0.48},${s * 0.17} ${s / 2},${s * 0.3} C${s * 0.52},${s * 0.17} ${s * 0.62},${s * 0.1} ${s * 0.75},${s * 0.18} C${s * 0.98},${s * 0.3} ${s * 0.9},${s * 0.55} ${s / 2},${s * 0.85}Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
        }
        case 'line':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${Math.max(sw + 4, 8)}" width="${w}" height="${Math.max(sw + 4, 8)}"><line x1="${pad}" y1="${Math.max(sw + 4, 8) / 2}" x2="${w - pad}" y2="${Math.max(sw + 4, 8) / 2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
        case 'pill':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect x="${pad}" y="${pad}" width="${w - sw}" height="${h - sw}" rx="${Math.min(w, h) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
        case 'blob':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="M${w * 0.48},${pad} C${w * 0.72},${h * 0.02} ${w - pad},${h * 0.18} ${w * 0.94},${h * 0.42} C${w * 0.9},${h * 0.72} ${w * 0.74},${h - pad} ${w * 0.46},${h * 0.95} C${w * 0.18},${h * 0.91} ${pad},${h * 0.72} ${w * 0.08},${h * 0.46} C${w * 0.13},${h * 0.18} ${w * 0.24},${h * 0.02} ${w * 0.48},${pad}Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
        default:
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect x="${pad}" y="${pad}" width="${w - sw}" height="${h - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    }
}
export default function FroamShapeLibrary({ onInsertShape, onToast }) {
    const [fill, setFill] = useState('#5eead4');
    const [fillEnabled, setFillEnabled] = useState(false);
    const [stroke, setStroke] = useState('#0f172a');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [shapeWidth, setShapeWidth] = useState(200);
    const [shapeHeight, setShapeHeight] = useState(200);
    const previewRef = useRef(null);
    const [hoveredShape, setHoveredShape] = useState(null);
    // Update preview
    useEffect(() => {
        if (!previewRef.current || !hoveredShape)
            return;
        const svg = buildShapeSVG(hoveredShape, fillEnabled ? fill : 'transparent', stroke, strokeWidth, 80, 80);
        previewRef.current.innerHTML = svg;
    }, [hoveredShape, fill, fillEnabled, stroke, strokeWidth]);
    const handleInsert = useCallback((type) => {
        const svg = buildShapeSVG(type, fillEnabled ? fill : 'transparent', stroke, strokeWidth, shapeWidth, shapeHeight);
        onInsertShape(svg, shapeWidth, shapeHeight);
        onToast(`Inserted ${type}`);
    }, [fill, fillEnabled, stroke, strokeWidth, shapeWidth, shapeHeight, onInsertShape, onToast]);
    return (_jsxs("div", { className: "fs-shapes", "data-chef-editor-root": "true", children: [_jsx("div", { className: "fs-shapes__grid", children: SHAPES.map((shape) => (_jsxs("button", { type: "button", className: "fs-shapes__item", title: shape.label, onClick: () => handleInsert(shape.id), onMouseEnter: () => setHoveredShape(shape.id), onMouseLeave: () => setHoveredShape(null), children: [shape.icon, _jsx("span", { className: "fs-shapes__label", children: shape.label })] }, shape.id))) }), hoveredShape && (_jsx("div", { className: "fs-shapes__preview", "data-chef-editor-root": "true", children: _jsx("div", { ref: previewRef, className: "fs-shapes__preview-svg" }) })), _jsxs("div", { className: "fs-stack", style: { marginTop: 8 }, children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Fill" }), _jsx("input", { type: "color", className: "fs-color-input", value: fill, onChange: (e) => setFill(e.target.value) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Stroke" }), _jsx("input", { type: "color", className: "fs-color-input", value: stroke, onChange: (e) => setStroke(e.target.value) })] })] }), _jsxs("div", { className: "fs-shapes__fill-mode", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", className: `fs-pill ${!fillEnabled ? 'is-active' : ''}`, onClick: () => setFillEnabled(false), "data-chef-editor-root": "true", children: "Clear fill" }), _jsx("button", { type: "button", className: `fs-pill ${fillEnabled ? 'is-active' : ''}`, onClick: () => setFillEnabled(true), "data-chef-editor-root": "true", children: "Use fill" })] }), _jsx("div", { className: "fs-shapes__swatches", "data-chef-editor-root": "true", children: COLOR_SWATCHES.map((color) => (_jsx("button", { type: "button", className: "fs-shapes__swatch", style: { background: color }, title: `Use ${color} as fill`, onClick: () => { setFill(color); setFillEnabled(true); } }, color))) }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Stroke width" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "12", value: strokeWidth, onChange: (e) => setStrokeWidth(Number(e.target.value)) }), _jsx("span", { className: "fs-range-value", children: strokeWidth })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Width" }), _jsx("input", { type: "number", className: "fs-input", min: "20", max: "1200", value: shapeWidth, onChange: (e) => setShapeWidth(Number(e.target.value)) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Height" }), _jsx("input", { type: "number", className: "fs-input", min: "20", max: "1200", value: shapeHeight, onChange: (e) => setShapeHeight(Number(e.target.value)) })] })] })] })] }));
}
//# sourceMappingURL=FroamShapeLibrary.js.map