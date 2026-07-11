import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
import { ImagePlus, Trash2, X, Link, Download, ZoomIn } from 'lucide-react';
const STORAGE_KEY = 'froam-inspiration-v1';
const MAX_IMAGES = 60;
function loadImages() {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function saveImages(images) {
    if (typeof window === 'undefined')
        return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
}
function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export default function FroamInspirationPanel({ onToast }) {
    const [images, setImages] = useState(() => loadImages());
    const [urlInput, setUrlInput] = useState('');
    const [lightbox, setLightbox] = useState(null);
    const [draggingOver, setDraggingOver] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);
    useEffect(() => {
        saveImages(images);
    }, [images]);
    // Paste from clipboard (images)
    useEffect(() => {
        function handlePaste(e) {
            const items = e.clipboardData?.items;
            if (!items)
                return;
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file)
                        readFile(file);
                }
            }
        }
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
        // readFile is redeclared each render, so this effect re-registers when it changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images.length, onToast]);
    function readFile(file) {
        if (images.length >= MAX_IMAGES) {
            onToast('Max 60 images reached');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const url = typeof reader.result === 'string' ? reader.result : null;
            if (!url)
                return;
            addImage(url, file.name.replace(/\.[^.]+$/, ''));
        };
        reader.readAsDataURL(file);
    }
    const addImage = useCallback((url, label = '') => {
        const img = { id: makeId(), url, label: label || 'Inspiration', addedAt: Date.now() };
        setImages((prev) => [img, ...prev].slice(0, MAX_IMAGES));
        onToast('Added to inspiration board');
    }, [onToast]);
    function handleFileInput(e) {
        const files = Array.from(e.target.files ?? []);
        files.forEach(readFile);
        e.target.value = '';
    }
    function handleUrlAdd() {
        const trimmed = urlInput.trim();
        if (!trimmed)
            return;
        addImage(trimmed, trimmed.split('/').pop()?.split('?')[0] ?? 'Image');
        setUrlInput('');
    }
    function handleDrop(e) {
        e.preventDefault();
        setDraggingOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        files.forEach(readFile);
        // Also handle dropped image URLs (from browser drag)
        const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (!files.length && url && (url.startsWith('http') || url.startsWith('data:'))) {
            addImage(url);
        }
    }
    function removeImage(id) {
        setImages((prev) => prev.filter((img) => img.id !== id));
        if (lightbox?.id === id)
            setLightbox(null);
    }
    function renameImage(id, label) {
        setImages((prev) => prev.map((img) => img.id === id ? { ...img, label } : img));
        setEditingId(null);
    }
    function downloadImage(img) {
        const a = document.createElement('a');
        a.href = img.url;
        a.download = `${img.label || 'inspiration'}.${img.url.startsWith('data:image/png') ? 'png' : img.url.startsWith('data:image/webp') ? 'webp' : 'jpg'}`;
        a.click();
    }
    return (_jsxs("div", { className: "fs-inspiration", "data-chef-editor-root": "true", children: [_jsxs("div", { ref: dropZoneRef, className: `fs-inspiration__dropzone ${draggingOver ? 'is-over' : ''}`, onDragOver: (e) => { e.preventDefault(); setDraggingOver(true); }, onDragLeave: () => setDraggingOver(false), onDrop: handleDrop, onClick: () => fileInputRef.current?.click(), children: [_jsx(ImagePlus, { size: 18 }), _jsx("span", { children: draggingOver ? 'Drop to add' : 'Drop images, paste, or click to upload' })] }), _jsxs("div", { className: "fs-row", style: { gap: 6, marginTop: 8 }, children: [_jsx("input", { type: "text", className: "fs-input", value: urlInput, onChange: (e) => setUrlInput(e.target.value), placeholder: "Paste image URL\u2026", style: { flex: 1 }, onKeyDown: (e) => { if (e.key === 'Enter')
                            handleUrlAdd(); } }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: handleUrlAdd, disabled: !urlInput.trim(), children: [_jsx(Link, { size: 12 }), " Add"] })] }), images.length > 0 && (_jsxs("p", { style: { margin: '8px 0 4px', fontSize: '0.72rem', color: 'var(--fs-text-tertiary)' }, children: [images.length, " / ", MAX_IMAGES, " images"] })), images.length === 0 ? (_jsx("p", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem', marginTop: 12 }, children: "No inspiration images yet. Add screenshots, references, or mood board images here." })) : (_jsx("div", { className: "fs-inspiration__grid", children: images.map((img) => (_jsxs("div", { className: "fs-inspiration__item", "data-chef-editor-root": "true", children: [_jsx("img", { src: img.url, alt: img.label, className: "fs-inspiration__img", onClick: () => setLightbox(img), loading: "lazy", decoding: "async" }), _jsxs("div", { className: "fs-inspiration__item-bar", "data-chef-editor-root": "true", children: [editingId === img.id ? (_jsx("input", { className: "fs-input", style: { flex: 1, fontSize: '0.7rem', height: 22, padding: '0 4px' }, defaultValue: img.label, autoFocus: true, onBlur: (e) => renameImage(img.id, e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                                        renameImage(img.id, e.target.value); } })) : (_jsx("span", { className: "fs-inspiration__label", title: img.label, onClick: () => setEditingId(img.id), children: img.label })), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "View", onClick: () => setLightbox(img), children: _jsx(ZoomIn, { size: 11 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Download", onClick: () => downloadImage(img), children: _jsx(Download, { size: 11 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__btn--danger", title: "Remove", onClick: () => removeImage(img.id), children: _jsx(Trash2, { size: 11 }) })] })] }, img.id))) })), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", multiple: true, className: "fs-hidden-input", "data-chef-editor-root": "true", onChange: handleFileInput }), lightbox && (_jsxs("div", { className: "fs-inspiration__lightbox", "data-chef-editor-root": "true", onClick: () => setLightbox(null), children: [_jsx("button", { type: "button", className: "fs-inspiration__lightbox-close", "data-chef-editor-root": "true", onClick: () => setLightbox(null), children: _jsx(X, { size: 18 }) }), _jsx("img", { src: lightbox.url, alt: lightbox.label, className: "fs-inspiration__lightbox-img", "data-chef-editor-root": "true", onClick: (e) => e.stopPropagation() }), _jsx("p", { className: "fs-inspiration__lightbox-label", "data-chef-editor-root": "true", children: lightbox.label })] }))] }));
}
//# sourceMappingURL=FroamInspirationPanel.js.map