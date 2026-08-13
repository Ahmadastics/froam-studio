import { Check, ChevronDown, RotateCw, Sparkles, X } from 'lucide-react'
import type { FroamIntentState } from './froam-intent-model'

type Props = { state: FroamIntentState; onAllow: () => void; onNotNow: () => void; onKeep: () => void; onRetry: () => void; onCancel: () => void; onDismiss: () => void }
const BUSY_COPY: Partial<Record<FroamIntentState['phase'], string>> = { preparing: 'Froam is understanding...', requesting: 'Froam is understanding...', retrying: 'Froam is understanding another direction...', 'plan-ready': 'Preparing experiment...', 'creating-prototype': 'Preparing experiment...', adopting: 'Applying...' }

export default function FroamIntentResult(props: Props) {
  const { state } = props
  if (state.phase === 'idle') return null
  if (state.phase === 'awaiting-consent') return <aside className="froam-intent-result is-consent" data-chef-editor-root="true" aria-label="Froam intelligence consent">
    <header><Sparkles size={14}/><strong>Ask Froam</strong></header>
    <p>Froam can use the configured intelligence provider to prepare this protected experiment.</p>
    <small>It sends bounded interface observations, not source code, credentials, cookies or raw screenshots.</small>
    <div className="froam-intent-result__actions"><button type="button" className="is-primary" onClick={props.onAllow}>Allow</button><button type="button" onClick={props.onNotNow}>Not now</button></div>
  </aside>
  const busy = BUSY_COPY[state.phase]
  if (busy) return <aside className="froam-intent-result is-busy" data-chef-editor-root="true" role="status" aria-live="polite" aria-atomic="true"><span className="froam-intent-result__pulse"/><strong>{busy}</strong><button type="button" onClick={props.onCancel}>Cancel</button></aside>
  if (state.phase === 'previewing' && state.session) return <aside className="froam-intent-result is-preview" data-chef-editor-root="true" aria-label="Froam experiment result">
    <header><div><span>Prototype</span><strong>{state.session.prototypeName}</strong></div><em>{state.session.attempt}/{state.session.maxAttempts}</em></header>
    <p>Froam changed {state.session.changeCount} thing{state.session.changeCount === 1 ? '' : 's'}</p>
    <details><summary><ChevronDown size={12}/> What changed</summary>{state.session.rationale && <p>{state.session.rationale}</p>}<ul>{state.session.changeSummaries?.map((summary, index) => <li key={index}>{summary}</li>)}</ul></details>
    <div className="froam-intent-result__actions"><button type="button" className="is-primary" onClick={props.onKeep}><Check size={13}/> Keep</button><button type="button" onClick={props.onRetry}><RotateCw size={13}/> Try again</button><button type="button" onClick={props.onCancel}><X size={13}/> Cancel</button></div>
  </aside>
  if (state.phase === 'error') return <aside className="froam-intent-result is-error" data-chef-editor-root="true" role="alert"><strong>{state.message}</strong><div className="froam-intent-result__actions">{state.session && state.session.attempt < state.session.maxAttempts && <button type="button" onClick={props.onRetry}><RotateCw size={13}/> Try again</button>}<button type="button" onClick={state.session ? props.onCancel : props.onDismiss}>{state.session ? 'Cancel' : 'Dismiss'}</button></div></aside>
  if (state.phase === 'completed') return <aside className="froam-intent-result is-complete" data-chef-editor-root="true" role="status" aria-live="polite"><Check size={14}/><strong>{state.message}</strong><button type="button" aria-label="Dismiss result" onClick={props.onDismiss}><X size={13}/></button></aside>
  return null
}
