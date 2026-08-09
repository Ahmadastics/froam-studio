import { packProjectDocument } from './storage-codec'
import type { FroamProjectDocument } from './types'

type Request = { id: number; project: FroamProjectDocument }
type Response = { id: number; packed?: ReturnType<typeof packProjectDocument>; error?: string }
const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(value: Response): void }
scope.onmessage = (event) => { try { scope.postMessage({ id: event.data.id, packed: packProjectDocument(event.data.project) }) } catch (error) { scope.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Project packing failed' }) } }

