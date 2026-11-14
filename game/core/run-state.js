import {Game} from './game.js';
// Indexed object graph: identities shared by projectiles, statuses, pulses and
// removed actors are restored exactly, including Maps/Sets and cyclic references.
function graphEncode(root){const seen=new Map(),nodes=[];function visit(v){if(v===undefined)return {u:1};if(typeof v==='number'&&!Number.isFinite(v))throw Error('Non-finite save state.');if(v===null||typeof v!=='object')return v;if(seen.has(v))return {r:seen.get(v)};const id=nodes.length;seen.set(v,id);const node={type:Array.isArray(v)?'array':v instanceof Map?'map':v instanceof Set?'set':'object',value:null};nodes.push(node);node.value=node.type==='map'?[...v].map(([k,x])=>[visit(k),visit(x)]):node.type==='set'?[...v].map(visit):node.type==='array'?v.map(visit):Object.fromEntries(Object.entries(v).filter(([,x])=>typeof x!=='function').map(([k,x])=>[k,visit(x)]));return {r:id};}return {root:visit(root),nodes};}
function graphDecode(graph){if(!graph||!Array.isArray(graph.nodes)||graph.nodes.length>300000)throw Error('Invalid save graph.');const values=graph.nodes.map(n=>n.type==='array'?[]:n.type==='map'?new Map():n.type==='set'?new Set():Object.create(null));const read=v=>v&&typeof v==='object'?'r'in v?values[v.r]:'u'in v?undefined:v:v;graph.nodes.forEach((n,i)=>{const v=values[i];if(n.type==='array')v.push(...n.value.map(read));else if(n.type==='map')for(const[k,x]of n.value)v.set(read(k),read(x));else if(n.type==='set')for(const x of n.value)v.add(read(x));else for(const[k,x]of Object.entries(n.value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Invalid save key.');v[k]=read(x);}});return read(graph.root);}
const fields=(o,excluded)=>Object.fromEntries(Object.entries(o).filter(([k,v])=>!excluded.includes(k)&&typeof v!=='function'));
export function serializeRun(game){
 const state={game:fields(game,['data','rng','listeners','grid','economy','commandPoints','draft','combat','commandMove','mvp','general','progress','waveCache','spaceCheck']),rng:game.rng.getState(),grid:fields(game.grid,[]),economy:fields(game.economy,['balance']),commandPoints:fields(game.commandPoints,['config','costs']),draft:fields(game.draft,['data','rng','commandPoints']),combat:fields(game.combat,['game']),commandMove:fields(game.commandMove,['game']),mvp:fields(game.mvp,['game']),general:fields(game.general,['game','loadout']),progress:fields(game.progress,['game'])};
 return {schema:1,ruleset:game.data.rulesetRevision,factionId:game.factionId,mode:game.mode,seed:game.seed,loadout:{...game.general.loadout},graph:graphEncode(state)};
}
export function restoreRun(data,snapshot){
 if(snapshot?.schema!==1||snapshot.ruleset!==data.rulesetRevision||snapshot.factionId!==data.factionId||!['endless','campaign'].includes(snapshot.mode))throw Error('This save uses incompatible game rules.');
 const g=new Game(data,{seed:snapshot.seed,mode:snapshot.mode,loadout:snapshot.loadout}),s=graphDecode(snapshot.graph);
 if(!s?.game||!Number.isSafeInteger(s.game.round)||s.game.round<1||!['build','select','ready','combat','reward','won','lost'].includes(s.game.phase))throw Error('Invalid saved run.');
 for(const[k,v]of Object.entries(s.game))if(k!=='factionId')g[k]=v;
 for(const key of ['grid','economy','commandPoints','draft','combat','commandMove','mvp','general','progress'])Object.assign(g[key],s[key]);
 g.rng.setState(s.rng);g.draft.rng=g.rng;Object.defineProperty(g.towers,'general',{value:g.general,configurable:true});g.journal=[];g.recordCommands=true;return g;
}
