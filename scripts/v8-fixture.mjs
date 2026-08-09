import { createProjectDocument } from '../dist/project/event-log.js'
import { dnaFromScan } from '../dist/project/scan.js'

export function syntheticProject(size) {
  const state = { legacyStore:{},nodes:{},relations:{},flows:{},interactions:{},dna:{},assets:{},scans:{},archive:{},analyses:{},responsive:{} }
  for (let index=0; index<size; index+=1) { const nodeId=`node-${index}`; const scan={ schemaVersion:1,id:`scan-${index}`,node:{nodeId,path:`div:${index+1}`},capturedAt:1,signals:[{kind:'layout',origin:'observed',source:'computed-style',values:{display:'grid',rect:{x:0,y:index*40,width:960,height:36},padding:'8px',gap:'8px'}},{kind:'appearance',origin:'observed',source:'computed-style',values:{color:'rgb(20,20,20)',backgroundColor:index%2?'rgb(255,255,255)':'rgb(248,248,248)',fontFamily:'Inter',fontSize:'16px',lineHeight:'24px'}},{kind:'semantics',origin:'inferred',source:'heuristic',confidence:.7,values:{role:index%13===0?'button':'card',label:`Synthetic node ${index}`}}],childNodeIds:[],siblingNodeIds:[]}; state.nodes[nodeId]={id:nodeId,kind:'element',name:`Node ${index}`,source:'host-dom',locator:{path:`div:${index+1}`}}; state.scans[nodeId]=scan; state.dna[nodeId]=dnaFromScan(scan); if(index) state.relations[`contains:${index-1}:${index}`]={id:`contains:${index-1}:${index}`,kind:'contains',from:`node-${index-1}`,to:nodeId} }
  return createProjectDocument({id:`v8-benchmark-${size}`,name:'v8 benchmark',actorId:'benchmark',now:1,idFactory:()=>`checkpoint-${size}`,initialState:state})
}
