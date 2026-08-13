import { performance } from 'node:perf_hooks'
import { createProjectDocument, emptyProjectState } from '../dist/project/event-log.js'
import { analyzeReferenceReconstructions } from '../dist/project/reference-intelligence.js'
import { createDeterministicReferenceBuildPlan, createReferenceBuildPrototype, runBoundedReferenceCorrections, validateReferenceBuildCandidate } from '../dist/project/reference-build.js'

const region = (id, x, y, width, height, family = 'cards') => ({ id, nodeId: `node:${id}`, x, y, width, height, kind: 'container', confidence: .9, semanticRole: 'card', averageColor: '#334155', componentFamilyId: family })
const reconstruction = (id, width, columns) => { const cardWidth = Math.floor((width - 80 - (columns - 1) * 16) / columns); const regions = Array.from({ length: 12 }, (_, index) => region(`${id}:${index}`, 40 + (index % columns) * (cardWidth + 16), 160 + Math.floor(index / columns) * 150, cardWidth, 132)); return { analysis: { schemaVersion: 1, id: `analysis:${id}`, kind: 'screenshot-reconstruction', targetIds: regions.map((item) => item.nodeId), createdAt: 1, provider: 'fixture', local: true, confidence: .9, result: { validation: null } }, nodes: [{ id: `root:${id}`, kind: 'frame', source: 'imported' }, ...regions.map((item) => ({ id: item.nodeId, kind: 'element', parentId: `root:${id}`, source: 'imported' }))], relations: [], dna: [], regions, rootNodeId: `root:${id}`, references: [{ id, width, height: 900 }], ocr: [{ provider: 'fixture', available: false, lines: [], warnings: [] }], correctionPasses: [] } }
const refs = [['mobile',390,1],['tablet',768,2],['laptop',1024,3],['desktop',1440,4]]
const understanding = analyzeReferenceReconstructions({ schemaVersion: 1, id: 'benchmark-reference', references: refs.map(([id,width]) => ({ id, viewport: { width, height: 900 }, source: 'screenshot', media: { id: `opaque:${id}`, width, height: 900 } })) }, refs.map(([id,width,columns]) => reconstruction(id,width,columns)))
const target = { kind: 'selected', nodeId: 'hero', path: 'section:1', routeKey: '/', label: 'Hero', authorizedNodeIds: ['hero'], explicit: true }
const state = emptyProjectState(); state.nodes.hero = { id:'hero',kind:'element',source:'host-dom',locator:{path:'section:1',routeKey:'/',viewport:'desktop'} }
const project = createProjectDocument({ id:'benchmark',name:'Benchmark',actorId:'benchmark',initialState:state,now:1,idFactory:(()=>{let i=0;return()=>`id-${++i}`})() })
const snapshot = { node:state.nodes.hero,routeKey:'/',viewport:'desktop',path:'section:1',relationships:[] }
const sample = (width) => ({ width, targetFound:true, targetWidthRatio:.9, gridColumns:width<=480?1:width<=800?2:width<=1100?3:4, overflowX:false, collisions:0, clipped:0, hiddenCritical:0, touchTargetFailures:0 })
const median = (values) => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
const measure = async (name, run, iterations=100) => { const timings=[]; for(let index=0;index<iterations;index+=1){const started=performance.now();await run(index);timings.push(performance.now()-started)} console.log(`${name}: median=${median(timings).toFixed(3)}ms p95=${[...timings].sort((a,b)=>a-b)[Math.floor(timings.length*.95)].toFixed(3)}ms n=${iterations}`) }

let plan
await measure('reference-understanding -> build-plan',()=>{plan=createDeterministicReferenceBuildPlan({understanding,target,sourceBranchId:'main',now:10})})
plan=createDeterministicReferenceBuildPlan({understanding,target,sourceBranchId:'main',now:10})
await measure('build-plan -> protected-prototype',(_,)=>{createReferenceBuildPrototype(project,{plan,branchId:`prototype-${_}`,name:'Benchmark',actorId:'benchmark',selectionSnapshot:snapshot,now:20+_})},50)
for(const count of [3,6,12]) await measure(`candidate-validation-${count}-widths`,()=>validateReferenceBuildCandidate(plan,plan.validationWidths.slice(0,count).map(sample)),250)
await measure('bounded-correction-loop',()=>runBoundedReferenceCorrections({initial:0,evaluate:async(value)=>({score:value/3,failures:value>=3?[]:['grid mismatch']}),correct:async(value)=>value+1}),100)
