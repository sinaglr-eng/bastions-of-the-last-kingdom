import Decimal from 'decimal.js';
import {seededRandom} from './math.js';
const median=rows=>{const a=[...rows].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
const expectedHp=(type,data)=>{const e=data.enemies[type],variants=e.variants?.length?e.variants:[{}];return variants.reduce((s,v)=>s+(v.hp??e.hp),0)/variants.length;};
export function endlessReference(data){
 const ordinary=data.waves.slice(40,49).filter(w=>!w.boss),budgets=ordinary.map(w=>w.groups.reduce((s,g)=>s+g.count*expectedHp(g.type,data)*(g.hp??w.hp??1),0));
 const boss=data.waves[49];return {hp:median(budgets),bossHp:boss.groups.reduce((s,g)=>s+g.count*expectedHp(g.type,data)*(g.hp??boss.hp??1),0)};
}
export function endlessWave(data,seed,number){
 if(!Number.isSafeInteger(number)||number<51)throw Error('Invalid Endless wave.');
 const rng=seededRandom((seed>>>0)^Math.imul(number,0x9e3779b1)),pool=data.waves.slice(0,49).map((w,i)=>({w,i})).filter(x=>!x.w.boss),chosen=[];
 const count=2+Math.floor(rng()*2);for(let i=0;i<count;i++){const at=Math.floor(rng()*pool.length);chosen.push(pool.splice(at,1)[0]);}
 const boss=number%10===0,total=boss?27:28,groups=chosen.flatMap(({w,i})=>w.groups.map(g=>({...g,hp:g.hp??w.hp??1,armor:g.armor??w.armor??0,sourceWave:i+1})));
 const weights=groups.map(g=>g.count),sum=weights.reduce((s,n)=>s+n,0),raw=weights.map(n=>n/sum*total),counts=raw.map(Math.floor);
 let left=total-counts.reduce((s,n)=>s+n,0);const order=raw.map((n,i)=>({i,remainder:n-counts[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);for(let i=0;i<left;i++)counts[order[i].i]++;
 const active=groups.map((g,i)=>({...g,count:counts[i]})).filter(g=>g.count),reference=endlessReference(data),base=active.reduce((s,g)=>s+g.count*expectedHp(g.type,data)*g.hp,0),k=number-50;
 const multiplier=new Decimal('1.08').pow(k),logMultiplier=k*Math.log(1.08),scaleLog=Math.max(0,logMultiplier+Math.log(Math.max(reference.hp,reference.bossHp))-Math.log(1e100));
 for(const g of active){const scale=reference.hp/base;g.hp=Math.exp(Math.log(g.hp*scale)+logMultiplier-scaleLog);g.armor+=.5*k;g.healthScaleLog=scaleLog;}
 if(boss){const bosses=data.waves.slice(0,50).map((w,i)=>({w,i})).filter(x=>x.w.boss),pick=bosses[Math.floor(rng()*bosses.length)],g=pick.w.groups[0];active.push({...g,count:1,sourceWave:pick.i+1,hp:Math.exp(Math.log(reference.bossHp/expectedHp(g.type,data))+logMultiplier-scaleLog),armor:(g.armor??pick.w.armor??0)+.5*k,healthScaleLog:scaleLog});}
 return {name:`Endless ${number} · ${chosen.map(x=>x.w.name).join(' / ')}`,boss,number,groups:active,hp:1,endless:true,healthScaleLog:scaleLog,scaling:{hp:multiplier.toString(),armor:.5*k},sourceWaves:chosen.map(x=>x.i+1),interleave:true};
}
