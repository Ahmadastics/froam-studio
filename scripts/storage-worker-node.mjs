import { parentPort } from 'node:worker_threads'
import { packProjectDocument } from '../dist/project/storage-codec.js'
parentPort.on('message',(project)=>{ const started=performance.now(); const packed=packProjectDocument(project); parentPort.postMessage({elapsedMs:performance.now()-started,packedBytes:Buffer.byteLength(JSON.stringify(packed))}) })
