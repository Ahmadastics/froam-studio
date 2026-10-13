import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Go Live — what was saved, onto the real site (lib/go-live.mjs does it).
 *
 * The sheet says plainly where it goes and what goes, before anything
 * happens: a commit and a push are seen by everyone who visits the site, so
 * nothing leaves without "Put it live". It names what rides along (earlier
 * commits not pushed yet) and what stays behind (other changed files), and
 * it only says "Live" once the bridge has read the change back off the site.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Globe, Loader2, Rocket, X } from 'lucide-react';
import { bridgeHeaders, bridgeUrl } from '../lib/bridge.js';
const GIT_STEPS = [['commit', 'Commit what Froam saved'], ['push', 'Send it to your repo'], ['deploy', 'Your host builds it'], ['check', 'Check the live site']];
const PUBLISH_STEPS = [['build', 'Get the site ready'], ['login', 'Check you’re signed in'], ['publish', 'Upload it'], ['check', 'Check the live site']];
const SHOWN_FILES = 8;
async function bridgeJson(path, init = {}) {
    const response = await window.fetch(bridgeUrl(path), { cache: 'no-store', ...init, headers: bridgeHeaders({ 'Content-Type': 'application/json', ...init.headers }) });
    return { status: response.status, data: await response.json().catch(() => null) };
}
export default function FroamGoLive({ open, onClose, saveFirst, job, onJob }) {
    const [plan, setPlan] = useState(null);
    const [phase, setPhase] = useState('loading');
    const [problem, setProblem] = useState(null);
    const [address, setAddress] = useState('');
    const [editingAddress, setEditingAddress] = useState(false);
    const [starting, setStarting] = useState(false);
    const [startedId, setStartedId] = useState(null);
    // A remote picked here, when the repo has more than one; sent with the plan and the go.
    const [remoteChoice, setRemoteChoice] = useState(null);
    // Which steps the job has been through, so finished steps read as done and skipped ones as skipped.
    const [seenSteps, setSeenSteps] = useState([]);
    const primaryRef = useRef(null);
    const loadPlan = useCallback(async (save, remote = null) => {
        setPhase('loading');
        setProblem(null);
        try {
            if (save)
                await saveFirst();
            const { status, data } = await bridgeJson(`/__froam/live${remote ? `?remote=${encodeURIComponent(remote)}` : ''}`);
            if (!data?.success || !data.plan)
                throw new Error(data?.error ?? (status === 403 ? 'Only your computer, or a phone paired with it, can put the site live.' : 'Froam couldn’t work out what would go live.'));
            setPlan(data.plan);
            if (data.job && !data.job.done) {
                onJob(data.job);
                setStartedId(data.job.id);
            }
            setPhase('plan');
        }
        catch (error) {
            setProblem(error instanceof Error ? error.message : 'Froam couldn’t reach your computer.');
            setPhase('error');
        }
    }, [saveFirst, onJob]);
    useEffect(() => {
        if (!open)
            return;
        setStartedId(job && !job.done ? job.id : null);
        setRemoteChoice(null);
        setSeenSteps([]);
        void loadPlan(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    // The events stream carries progress; this catches up if it dropped (a phone waking up).
    useEffect(() => {
        if (!open || !startedId || job?.done)
            return;
        const timer = window.setInterval(async () => {
            try {
                const { data } = await bridgeJson('/__froam/live/job');
                if (data?.job)
                    onJob(data.job);
            }
            catch { /* next tick */ }
        }, 3000);
        return () => window.clearInterval(timer);
    }, [open, startedId, job?.done, onJob]);
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
    useEffect(() => { if (open && phase === 'plan')
        primaryRef.current?.focus(); }, [open, phase]);
    useEffect(() => {
        if (job?.step)
            setSeenSteps((seen) => (seen.includes(job.step) ? seen : [...seen, job.step]));
    }, [job?.step]);
    async function goLive() {
        if (!plan)
            return;
        setStarting(true);
        setProblem(null);
        try {
            const { status, data } = await bridgeJson('/__froam/live', { method: 'POST', body: JSON.stringify({ token: plan.token, ...(remoteChoice ? { remote: remoteChoice } : {}) }) });
            if (data?.success && data.job) {
                onJob(data.job);
                setStartedId(data.job.id);
            }
            else {
                if (data?.plan)
                    setPlan(data.plan);
                setProblem(status === 409 && data?.plan ? 'Something changed since you looked — here’s what would go now.' : data?.error ?? 'It didn’t start.');
            }
        }
        catch {
            setProblem('Froam couldn’t reach your computer. Is froam dev still running?');
        }
        finally {
            setStarting(false);
        }
    }
    async function saveAddress() {
        const { data } = await bridgeJson('/__froam/live/site', { method: 'POST', body: JSON.stringify({ url: address }) });
        if (!data?.success) {
            setProblem(data?.error ?? 'That address didn’t save.');
            return;
        }
        setAddress('');
        setEditingAddress(false);
        void loadPlan(false, remoteChoice);
    }
    if (!open)
        return null;
    const current = startedId && job?.id === startedId ? job : null;
    const steps = (current?.mode ?? plan?.mode) === 'publish' ? PUBLISH_STEPS : GIT_STEPS;
    const stepAt = current ? steps.findIndex(([id]) => id === current.step) : -1;
    const lastSeen = steps.reduce((at, [id], index) => (seenSteps.includes(id) ? index : at), -1);
    const stepState = (id, index) => {
        if (!current)
            return 'todo';
        if (!current.done)
            return index < stepAt ? 'done' : index === stepAt ? 'now' : seenSteps.includes(id) ? 'done' : 'todo';
        if (!current.ok)
            return index < lastSeen ? 'done' : index === lastSeen ? 'failed' : 'todo';
        return index <= lastSeen && seenSteps.includes(id) ? 'done' : index < lastSeen ? 'done' : 'skipped';
    };
    const files = plan?.files ?? [];
    const where = plan?.where ?? {};
    // More than one remote and nothing to say which a host builds from: the person picks, Froam doesn't guess.
    const asking = Boolean(where.needsChoice && !remoteChoice);
    return (_jsx("div", { className: "froam-golive", "data-chef-editor-root": "true", onClick: (event) => { if (event.target === event.currentTarget && !(current && !current.done))
            onClose(); }, children: _jsxs("div", { className: "froam-golive__card", role: "dialog", "aria-modal": "true", "aria-labelledby": "froam-golive-title", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-golive__head", children: [_jsxs("h2", { id: "froam-golive-title", children: [current?.done && current.outcome === 'live' ? _jsx(Check, { size: 18, className: "froam-golive__ok" }) : current?.done && !current.ok ? _jsx(AlertTriangle, { size: 18, className: "froam-golive__warn" }) : _jsx(Rocket, { size: 18 }), current ? (current.done ? (current.ok ? (current.outcome === 'live' ? 'Live' : current.outcome === 'preview' ? 'Preview ready' : 'Sent') : 'Didn’t go live') : 'Going live…') : 'Put this live?'] }), _jsx("button", { type: "button", className: "froam-golive__close", onClick: onClose, "aria-label": "Close", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "froam-golive__body", "aria-live": "polite", children: [!current && phase === 'loading' && _jsxs("p", { className: "froam-golive__quiet", children: [_jsx(Loader2, { size: 15, className: "froam-golive__spin" }), " Saving, and checking what\u2019s ready to go\u2026"] }), !current && phase === 'error' && _jsx("p", { className: "froam-golive__problem", children: problem }), !current && phase === 'plan' && plan && (_jsxs(_Fragment, { children: [plan.mode === 'git' && (where.remotes?.length ?? 0) > 1 && (_jsxs("div", { className: `froam-golive__remote${asking ? ' is-asking' : ''}`, children: [_jsx("label", { htmlFor: "froam-golive-remote", children: asking ? 'This repo has more than one remote. Which one does your site deploy from?' : 'Send to' }), _jsxs("select", { id: "froam-golive-remote", value: remoteChoice ?? (asking ? '' : where.remote), onChange: (event) => { setRemoteChoice(event.target.value); void loadPlan(false, event.target.value); }, children: [asking && _jsx("option", { value: "", disabled: true, children: "Pick one" }), where.remotes.map((remote) => (_jsxs("option", { value: remote.name, children: [remote.name, " \u2014 ", remote.repo, remote.deploys ? ` · ${remote.deploys} deploys from here` : ''] }, remote.name)))] })] })), plan.mode !== 'none' && (_jsxs("div", { className: "froam-golive__where", children: [_jsx(Globe, { size: 15 }), _jsxs("div", { children: [plan.mode === 'git'
                                                    ? _jsxs(_Fragment, { children: [_jsx("strong", { children: where.repo }), " \u00B7 ", where.branch, where.newBranch ? _jsx("span", { children: " (new there)" }) : null, where.host ? _jsx("div", { className: "froam-golive__host", children: where.hostReported ? `${where.host} deploys your site from ${where.defaultBranch ?? 'here'}` : `This project deploys with ${where.host}` }) : null] })
                                                    : _jsxs(_Fragment, { children: [_jsx("strong", { children: where.host }), " \u00B7 ", where.project] }), where.url && (_jsxs("div", { className: "froam-golive__url", children: [where.url.replace(/^https?:\/\//, ''), where.urlSource && _jsxs("span", { className: "froam-golive__source", children: [" \u00B7 from ", where.urlSource] }), plan.mode === 'git' && !editingAddress && _jsx("button", { type: "button", className: "froam-golive__link", onClick: () => { setAddress(where.url ?? ''); setEditingAddress(true); }, children: "Not right?" })] }))] })] })), plan.blocked
                                    ? _jsx("p", { className: "froam-golive__blocked", children: plan.blocked })
                                    : (_jsxs(_Fragment, { children: [files.length > 0 && (_jsxs("div", { className: "froam-golive__section", children: [_jsx("h3", { children: "What goes" }), _jsxs("ul", { className: "froam-golive__files", children: [files.slice(0, SHOWN_FILES).map((file) => (_jsxs("li", { title: file.path, children: [_jsx("span", { children: file.label }), _jsx("i", { "data-change": file.change, children: file.change })] }, file.path))), files.length > SHOWN_FILES && _jsxs("li", { className: "froam-golive__more", children: ["and ", files.length - SHOWN_FILES, " more"] })] })] })), plan.mode === 'git' && where.production === false && (_jsxs("p", { className: "froam-golive__note is-warning", children: [where.branch, " isn\u2019t your live branch", where.defaultBranch ? ` (${where.defaultBranch})` : '', ". On most hosts this makes a preview, not your site."] })), (plan.earlier?.length ?? 0) > 0 && (() => {
                                                const count = Math.max(plan.earlierCount ?? 0, plan.earlier.length);
                                                const shown = plan.earlier.slice(0, 5);
                                                return (_jsxs("div", { className: "froam-golive__note is-warning", children: ["Also sends ", count === 1 ? 'an earlier commit' : `${count} earlier commits`, " of yours that ", where.repo, " doesn\u2019t have yet:", _jsxs("ul", { children: [shown.map((commit) => _jsx("li", { children: commit.subject }, commit.hash)), count > shown.length && _jsxs("li", { className: "froam-golive__more", children: ["and ", count - shown.length, " more"] })] })] }));
                                            })(), plan.mode === 'git' && where.github && !where.github.reachable && where.github.reason && (_jsxs("p", { className: "froam-golive__note", children: ["Froam can\u2019t follow what ", where.host ?? 'your host', " does with it: ", where.github.reason, where.url ? ' It will read your site’s address instead.' : ''] })), (plan.others ?? 0) > 0 && _jsxs("p", { className: "froam-golive__note", children: [plan.others, " other changed file", plan.others === 1 ? '' : 's', " in your project stay", plan.others === 1 ? 's' : '', " as ", plan.others === 1 ? 'it is' : 'they are', ": only what Froam saved goes."] }), plan.offline && _jsxs("p", { className: "froam-golive__note", children: ["Couldn\u2019t reach ", where.repo, " to look for newer work. If there is some, the push is refused and nothing is lost."] }), plan.warnings?.map((warning) => _jsx("p", { className: "froam-golive__note is-warning", children: warning }, warning))] })), plan.mode === 'git' && (!where.url || editingAddress) && !plan.blocked && (_jsxs("form", { className: "froam-golive__address", onSubmit: (event) => { event.preventDefault(); void saveAddress(); }, children: [_jsx("label", { htmlFor: "froam-golive-address", children: "Your site\u2019s address, so Froam can tell you when it\u2019s live" }), _jsxs("div", { children: [_jsx("input", { id: "froam-golive-address", type: "url", inputMode: "url", placeholder: "https://your-site.com", value: address, onChange: (event) => setAddress(event.target.value) }), _jsx("button", { type: "submit", disabled: !address.trim(), children: "Save" })] })] })), problem && _jsx("p", { className: "froam-golive__problem", children: problem })] })), current && (_jsxs(_Fragment, { children: [_jsx("ol", { className: "froam-golive__steps", children: steps.map(([id, label], index) => {
                                        const state = stepState(id, index);
                                        return (_jsxs("li", { "data-state": state, children: [state === 'done' ? _jsx(Check, { size: 14 }) : state === 'now' ? _jsx(Loader2, { size: 14, className: "froam-golive__spin" }) : state === 'failed' ? _jsx(AlertTriangle, { size: 14 }) : _jsx("span", { className: "froam-golive__dot" }), _jsx("span", { children: label })] }, id));
                                    }) }), _jsx("p", { className: current.done && !current.ok ? 'froam-golive__problem' : 'froam-golive__quiet', children: current.message }), current.done && current.url && (_jsxs("a", { className: "froam-golive__open", href: current.url, target: "_blank", rel: "noreferrer", children: [current.linkLabel ?? `Open ${current.url.replace(/^https?:\/\//, '')}`, " ", _jsx(ExternalLink, { size: 13 })] }))] }))] }), _jsx("div", { className: "froam-golive__foot", children: current?.done || (!current && (phase === 'error' || plan?.blocked))
                        ? (_jsxs(_Fragment, { children: [current?.done && !current.ok && _jsx("button", { type: "button", className: "froam-golive__secondary", onClick: () => { setStartedId(null); onJob(null); void loadPlan(false); }, children: "Try again" }), _jsx("button", { type: "button", className: "froam-golive__primary", onClick: onClose, children: "Done" })] }))
                        : current
                            ? _jsx("span", { className: "froam-golive__quiet", children: "You can close this; Froam keeps going and tells you when it\u2019s done." })
                            : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "froam-golive__secondary", onClick: onClose, children: "Not now" }), _jsxs("button", { ref: primaryRef, type: "button", className: "froam-golive__primary", disabled: phase !== 'plan' || starting || Boolean(plan?.busy) || asking, onClick: () => { void goLive(); }, children: [starting ? _jsx(Loader2, { size: 15, className: "froam-golive__spin" }) : _jsx(Rocket, { size: 15 }), "Put it live"] })] })) })] }) }));
}
//# sourceMappingURL=FroamGoLive.js.map