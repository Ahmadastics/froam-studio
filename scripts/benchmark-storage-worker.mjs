import { Worker } from 'node:worker_threads'
import { performance } from 'node:perf_hooks'
import { packProjectDocument } from '../dist/project/storage-codec.js'
import { syntheticProject } from './v8-fixture.mjs'

async function heartbeat(work) { let last=performance.now(); let maxLag=0; let beats=0; const timer=setInterval(()=>{ const now=performance.now(); maxLag=Math.max(maxLag,now-last-10); last=now; beats+=1 },10); await new Promise((resolve)=>setTimeout(resolve,30)); const started=performance.now(); const value=await work(); const wallMs=performance.now()-started; await new Promise((resolve)=>setTimeout(resolve,30)); clearInterval(timer); return {wallMs,maxHeartbeatLagMs:maxLag,heartbeats:beats,value} }
function workerPack(project) { return new Promise((resolve,reject)=>{ const worker=new Worker(new URL('./storage-worker-node.mjs',import.meta.url)); worker.once('message',(value)=>{resolve(value);void worker.terminate()}); worker.once('error',reject); worker.postMessage(project) }) }
const results=[]
for(const size of [5000,10000]) { const project=syntheticProject(size); const blocking=await heartbeat(()=>packProjectDocument(project)); const worker=await heartbeat(()=>workerPack(project)); results.push({nodes:size,blocking:{wallMs:blocking.wallMs,maxHeartbeatLagMs:blocking.maxHeartbeatLagMs,heartbeats:blocking.heartbeats},worker:{wallMs:worker.wallMs,maxHeartbeatLagMs:worker.maxHeartbeatLagMs,heartbeats:worker.heartbeats,encodeMs:worker.value.elapsedMs,packedBytes:worker.value.packedBytes}}) }
console.log(JSON.stringify({environment:{node:process.version,platform:process.platform},results},null,2))
