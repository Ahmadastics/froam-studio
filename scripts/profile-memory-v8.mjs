import { packProjectDocument, unpackProjectDocument } from '../dist/project/storage-codec.js'
import { syntheticProject } from './v8-fixture.mjs'
if(typeof global.gc!=='function') throw new Error('Run with node --expose-gc scripts/profile-memory-v8.mjs')
function oneCycle(project){ const packed=packProjectDocument(project); const restored=unpackProjectDocument(packed); if(restored.id!==project.id) throw new Error('Memory profile round trip failed'); return process.memoryUsage().heapUsed }
const results=[]
for(const size of [5000,10000]) { global.gc(); const before=process.memoryUsage().heapUsed; const project=syntheticProject(size); global.gc(); const projectRetained=process.memoryUsage().heapUsed; let peak=projectRetained; for(let cycle=0;cycle<5;cycle+=1){ peak=Math.max(peak,oneCycle(project)); global.gc() } await new Promise((resolve)=>setImmediate(resolve)); global.gc(); const after=process.memoryUsage().heapUsed; results.push({nodes:size,beforeBytes:before,projectRetainedBytes:projectRetained-before,peakAdditionalBytes:peak-projectRetained,retainedAfterCyclesBytes:after-projectRetained,cycles:5}) }
console.log(JSON.stringify({procedure:'forced-GC retained heap; five exact pack/unpack cycles',results},null,2))
