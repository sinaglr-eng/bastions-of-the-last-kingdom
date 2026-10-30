import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../../../../game/core/campaign-roster.js';
import {createFactionData} from '../../../../game/core/factions.js';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const out=resolve(root,'output/releases/v0.6.2/fr001');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(k=>[k,read(`data/${k}.json`)]));
const current={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const registry=read('data/factions-v060.json');
const datasets=[['Human','crown'],['Dwarves implemented','forge'],['Elves implemented','grove']].map(([name,id])=>({name,id,approved:true,data:createFactionData(current,registry,id)}));
const factorial=[1,1,2,6,24,120];
function eventProbability(required,probabilities){
 const entries=[...required],sum=entries.reduce((n,[,v])=>n+v,0);
 if(sum>5)return 0;
 const ps=entries.map(([key])=>probabilities.get(key)||0);
 if(ps.some(p=>p===0))return 0;
 const other=1-ps.reduce((n,p)=>n+p,0);
 let result=0;
 function walk(i,used,denominator,product){
  if(i===entries.length){const rest=5-used;result+=factorial[5]/(denominator*factorial[rest])*product*other**rest;return;}
  const minimumRest=entries.slice(i+1).reduce((n,[,v])=>n+v,0);
  for(let n=entries[i][1];n<=5-used-minimumRest;n++)walk(i+1,used+n,denominator*factorial[n],product*ps[i]**n);
 }
 walk(0,0,1,1);return result;
}
function recipeDemand(recipe){const required=new Map();for(const i of recipe.ingredients){const k=`${i.family}/${i.tier}`;required.set(k,(required.get(k)||0)+1);}return required;}
function unionProbability(recipes,probabilities){
 let probability=0;
 const n=recipes.length;
 for(let mask=1;mask<2**n;mask++){
  let bits=0;const required=new Map();
  for(let i=0;i<n;i++)if(mask&(1<<i)){bits++;for(const [key,amount]of recipeDemand(recipes[i]))required.set(key,Math.max(required.get(key)||0,amount));}
  if([...required.values()].reduce((n,v)=>n+v,0)>5)continue;
  probability+=(bits%2?1:-1)*eventProbability(required,probabilities);
 }
 return Math.max(0,Math.min(1,probability));
}
const results=datasets.map(({name,id,approved,data})=>{
 const basics=Object.entries(data.towers).filter(([,t])=>!t.advanced);
 const ordinary=data.recipes.filter(r=>!r.currentRoundOnly&&r.ingredients.every(i=>!data.towers[i.family].advanced));
 const claire=data.recipes.find(r=>r.id==='ladyclaire');
 const rows=data.balance.mastery.map((row,index)=>{
  const sum=row.weights.reduce((a,b)=>a+b,0),probabilities=new Map();
  for(const [family]of basics)row.weights.forEach((w,n)=>probabilities.set(`${family}/${n+1}`,w/sum/basics.length));
  return {mastery:index,weights:row.weights,ordinaryDirectRecipeProbability:unionProbability(ordinary,probabilities),claireProbability:eventProbability(recipeDemand(claire),probabilities),recipes:ordinary.map(r=>({id:r.id,name:data.towers[r.id].name,probability:eventProbability(recipeDemand(r),probabilities)}))};
 });
 return {name,id,approved,ordinaryDirectRecipes:ordinary.length,rows};
});
const human=results[0],forge=results[1],grove=results[2];
assert.equal(human.rows[0].ordinaryDirectRecipeProbability,forge.rows[0].ordinaryDirectRecipeProbability);
assert.equal(human.rows[0].ordinaryDirectRecipeProbability,grove.rows[0].ordinaryDirectRecipeProbability);
for(const result of results)for(let i=0;i<result.rows.length;i++)assert.ok(Math.abs(result.rows[i].claireProbability-human.rows[i].claireProbability)<1e-14);
const report={date:'2026-10-30',requirementId:'FR-001',method:'Exact multinomial event probabilities and inclusion-exclusion across all ordinary recipes whose three inputs are basics. Five independent fresh draws at each actual mastery row, eight equal family weights. No retained inventory, reserve, reroll, merge or champion ingredients. This is acquisition opportunity, not a campaign or power estimate.',results,sourceHashes:Object.fromEntries(['data/balance.json','data/factions-v060.json','data/recipes.json','game/core/factions.js','game/core/campaign-roster.js'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]))};
writeFileSync(resolve(out,'acquisition-balance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({name:r.name,directRecipes:r.ordinaryDirectRecipes,rows:r.rows.map(row=>({mastery:row.mastery,ordinaryPercent:+(100*row.ordinaryDirectRecipeProbability).toFixed(4),clairePercent:+(100*row.claireProbability).toFixed(6)}))})),null,2));
