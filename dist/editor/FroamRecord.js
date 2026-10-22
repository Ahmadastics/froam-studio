import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The record — who changed what, who approved it, and when (lib/record.mjs).
 *
 * The sheet reads the project's record through the bridge: newest first,
 * grouped by day, each entry one sentence with what changed underneath. At the
 * top it says whether the record checks out (nothing changed or removed since
 * it was written), and the name the owner's own saves go under, which can be
 * set here. The whole record prints as a report, or downloads as a
 * spreadsheet, for whoever asks for it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, FileDown, Loader2, Pencil, Printer, ScrollText, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { bridgeHeaders, bridgeUrl } from '../lib/bridge.js';
const PAGE = 100;
const KINDS = [
    ['all', 'Everything', () => true],
    ['requests', 'Asked & approved', (type) => type.startsWith('request.')],
    ['saves', 'Saves', (type) => type.startsWith('saved')],
    ['live', 'Go Live', (type) => type.startsWith('live.')],
    ['people', 'People', (type) => type.startsWith('room.')],
];
async function bridgeFetch(path, init = {}) {
    return window.fetch(bridgeUrl(path), { cache: 'no-store', ...init, headers: bridgeHeaders({ 'Content-Type': 'application/json', ...init.headers }) });
}
const dayOf = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (date.toDateString() === today.toDateString())
        return 'Today';
    if (date.toDateString() === yesterday.toDateString())
        return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const timeOf = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
export default function FroamRecord({ open, onClose }) {
    const [entries, setEntries] = useState([]);
    const [verification, setVerification] = useState(null);
    const [you, setYou] = useState(null);
    const [phase, setPhase] = useState('loading');
    const [problem, setProblem] = useState(null);
    const [kind, setKind] = useState('all');
    const [more, setMore] = useState(false);
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(null);
    const closeRef = useRef(null);
    const load = useCallback(async () => {
        setPhase('loading');
        setProblem(null);
        try {
            const response = await bridgeFetch(`/__froam/record?limit=${PAGE}`);
            const data = await response.json().catch(() => null);
            if (!data?.success)
                throw new Error(data?.error ?? (response.status === 404 ? 'This version of froam dev has no record yet. Update Froam, then open it again.' : 'Froam couldn’t read the record.'));
            setEntries(data.entries ?? []);
            setVerification(data.verification ?? null);
            setYou(data.you ?? null);
            setMore((data.entries?.length ?? 0) >= PAGE);
            setPhase('ready');
        }
        catch (error) {
            setProblem(error instanceof Error ? error.message : 'Froam couldn’t reach your computer.');
            setPhase('error');
        }
    }, []);
    useEffect(() => {
        if (!open)
            return;
        setKind('all');
        setNaming(false);
        void load();
    }, [open, load]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => { if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
        } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    useEffect(() => { if (open)
        closeRef.current?.focus(); }, [open]);
    async function older() {
        const last = entries.at(-1);
        if (!last)
            return;
        setBusy('older');
        try {
            const data = await (await bridgeFetch(`/__froam/record?limit=${PAGE}&before=${last.seq}`)).json();
            setEntries((shown) => [...shown, ...(data.entries ?? [])]);
            setMore((data.entries?.length ?? 0) >= PAGE);
        }
        catch {
            setProblem('Couldn’t load older entries.');
        }
        finally {
            setBusy(null);
        }
    }
    /** The report and the spreadsheet come through the bridge with this device's key, then open from here. */
    async function download(format) {
        setBusy(format);
        // Opened before the wait, or a phone's browser treats it as a pop-up and blocks it.
        const tab = format === 'report' ? window.open('', '_blank') : null;
        try {
            const response = await bridgeFetch(`/__froam/record/report${format === 'csv' ? '?format=csv' : ''}`);
            if (!response.ok)
                throw new Error();
            const blob = new Blob([await response.text()], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            if (tab)
                tab.location.href = url;
            else {
                // A spreadsheet, or a report whose tab was blocked: saved as a file instead.
                const link = document.createElement('a');
                link.href = url;
                link.download = format === 'csv' ? 'froam-record.csv' : 'froam-record.html';
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch {
            tab?.close();
            setProblem(format === 'csv' ? 'The spreadsheet didn’t download.' : 'The report didn’t open.');
        }
        finally {
            setBusy(null);
        }
    }
    async function saveName() {
        if (!name.trim())
            return;
        setBusy('name');
        try {
            const data = await (await bridgeFetch('/__froam/record/name', { method: 'POST', body: JSON.stringify({ name }) })).json();
            if (!data.success)
                throw new Error(data.error);
            setYou(data.you ?? name.trim());
            setNaming(false);
        }
        catch (error) {
            setProblem(error instanceof Error && error.message ? error.message : 'That name didn’t save.');
        }
        finally {
            setBusy(null);
        }
    }
    if (!open)
        return null;
    const matcher = KINDS.find(([id]) => id === kind)?.[2] ?? (() => true);
    const shown = entries.filter((entry) => matcher(entry.type));
    const days = [];
    for (const entry of shown) {
        const day = dayOf(entry.at);
        const last = days.at(-1);
        if (last && last[0] === day)
            last[1].push(entry);
        else
            days.push([day, [entry]]);
    }
    return (_jsx("div", { className: "froam-golive", "data-chef-editor-root": "true", onClick: (event) => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "froam-golive__card froam-record__card", role: "dialog", "aria-modal": "true", "aria-labelledby": "froam-record-title", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-golive__head", children: [_jsxs("h2", { id: "froam-record-title", children: [_jsx(ScrollText, { size: 18 }), " Record"] }), _jsx("button", { ref: closeRef, type: "button", className: "froam-golive__close", onClick: onClose, "aria-label": "Close", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "froam-golive__body", children: [_jsx("p", { className: "froam-golive__note", children: "Who changed what on this site, who approved it, and when. Kept in your project and sent with every Go Live." }), phase === 'loading' && _jsxs("p", { className: "froam-golive__quiet", children: [_jsx(Loader2, { size: 15, className: "froam-golive__spin" }), " Reading the record\u2026"] }), phase === 'error' && _jsx("p", { className: "froam-golive__problem", children: problem }), phase === 'ready' && (_jsxs(_Fragment, { children: [verification && verification.count > 0 && (_jsxs("div", { className: `froam-record__check${verification.ok ? '' : ' is-broken'}`, role: "status", children: [verification.ok ? _jsx(ShieldCheck, { size: 16 }) : _jsx(ShieldAlert, { size: 16 }), _jsxs("div", { children: [verification.ok
                                                    ? _jsxs(_Fragment, { children: [_jsx("strong", { children: "Checks out." }), " ", verification.count, " entr", verification.count === 1 ? 'y' : 'ies', ", each linked to the one before; none changed since it was written."] })
                                                    : _jsxs(_Fragment, { children: [_jsxs("strong", { children: ["Doesn\u2019t check out at line ", verification.problem?.line, "."] }), " ", verification.problem?.reason, " Entries before it are intact."] }), _jsxs("div", { className: "froam-record__hash", title: verification.head, children: ["Latest hash ", verification.head.slice(0, 16), "\u2026"] })] })] })), _jsx("div", { className: "froam-record__you", children: naming
                                        ? (_jsxs("form", { onSubmit: (event) => { event.preventDefault(); void saveName(); }, children: [_jsx("label", { htmlFor: "froam-record-name", children: "Your saves are recorded as" }), _jsxs("div", { children: [_jsx("input", { id: "froam-record-name", value: name, maxLength: 60, autoFocus: true, onChange: (event) => setName(event.target.value), placeholder: "Your full name" }), _jsx("button", { type: "submit", disabled: !name.trim() || busy === 'name', children: "Save" })] })] }))
                                        : (_jsxs("span", { children: ["Your saves are recorded as ", _jsx("strong", { children: you ?? 'Owner' }), _jsxs("button", { type: "button", className: "froam-golive__link", onClick: () => { setName(you ?? ''); setNaming(true); }, children: [_jsx(Pencil, { size: 12 }), " Change"] })] })) }), entries.length > 0 && (_jsx("div", { className: "froam-record__kinds", role: "group", "aria-label": "Show", children: KINDS.map(([id, label]) => (_jsx("button", { type: "button", "aria-pressed": kind === id, onClick: () => setKind(id), children: label }, id))) })), entries.length === 0 && (_jsx("p", { className: "froam-golive__blocked", children: "Nothing recorded yet. Froam writes here the first time someone saves, asks for a change, approves one, or goes live." })), entries.length > 0 && shown.length === 0 && _jsx("p", { className: "froam-golive__quiet", children: "Nothing of that kind in what\u2019s loaded." }), days.map(([day, list]) => (_jsxs("div", { className: "froam-record__day", role: "group", "aria-label": day, children: [_jsx("h3", { children: day }), _jsx("ol", { children: list.map((entry) => _jsx(RecordRow, { entry: entry }, entry.seq)) })] }, day))), more && (_jsxs("button", { type: "button", className: "froam-golive__secondary froam-record__older", disabled: busy === 'older', onClick: () => { void older(); }, children: [busy === 'older' ? _jsx(Loader2, { size: 14, className: "froam-golive__spin" }) : _jsx(ChevronDown, { size: 14 }), " Older entries"] })), problem && _jsx("p", { className: "froam-golive__problem", children: problem })] }))] }), _jsxs("div", { className: "froam-golive__foot", children: [_jsxs("button", { type: "button", className: "froam-golive__secondary", disabled: phase !== 'ready' || !entries.length || busy === 'csv', onClick: () => { void download('csv'); }, children: [busy === 'csv' ? _jsx(Loader2, { size: 15, className: "froam-golive__spin" }) : _jsx(FileDown, { size: 15 }), " Spreadsheet"] }), _jsxs("button", { type: "button", className: "froam-golive__primary", disabled: phase !== 'ready' || !entries.length || busy === 'report', onClick: () => { void download('report'); }, children: [busy === 'report' ? _jsx(Loader2, { size: 15, className: "froam-golive__spin" }) : _jsx(Printer, { size: 15 }), " Report to print"] })] })] }) }));
}
function RecordRow({ entry }) {
    const changes = entry.changes ?? [];
    const total = entry.count ?? changes.length;
    const tone = entry.type === 'request.approved' || entry.type === 'live.finished' ? 'good'
        : entry.type === 'request.sent-back' || entry.type === 'request.reverted' || entry.type === 'live.failed' ? 'warn'
            : entry.type === 'request.submitted' ? 'ask' : 'plain';
    return (_jsxs("li", { className: "froam-record__entry", "data-tone": tone, children: [_jsx("time", { dateTime: entry.at, children: timeOf(entry.at) }), _jsxs("div", { children: [_jsxs("p", { children: [entry.summary, entry.by.role && entry.by.role !== 'owner' && _jsx("span", { className: "froam-record__role", children: entry.by.role })] }), (entry.by.via || entry.viewport) && _jsx("p", { className: "froam-record__meta", children: [entry.by.via, entry.viewport && entry.viewport !== 'desktop' ? `${entry.viewport} view` : null, entry.refs?.commit ? `commit ${entry.refs.commit}` : null].filter(Boolean).join(' · ') }), entry.note && _jsxs("p", { className: "froam-record__note", children: ["\u201C", entry.note, "\u201D"] }), entry.result && !entry.type.startsWith('live.') && _jsx("p", { className: "froam-record__meta", children: entry.result }), changes.length > 0 && (_jsxs("details", { children: [_jsx("summary", { children: total === 1 ? 'What changed' : `What changed (${total})` }), _jsxs("ul", { children: [changes.map((change, index) => (_jsxs("li", { children: [_jsx("span", { children: change.label }), (change.before || change.after) && (_jsxs("span", { className: "froam-record__diff", children: [change.before && _jsx("del", { children: change.before }), change.before && change.after && ' → ', change.after && _jsx("ins", { children: change.after })] }))] }, index))), total > changes.length && _jsxs("li", { className: "froam-golive__more", children: ["and ", total - changes.length, " more"] })] })] }))] })] }));
}
//# sourceMappingURL=FroamRecord.js.map