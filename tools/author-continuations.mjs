// Original three-defender combinations cover every basic rank and continue as ascensions.
import {readFileSync,writeFileSync} from 'node:fs';
const towers=JSON.parse(readFileSync('data/towers.json')),recipes=JSON.parse(readFileSync('data/recipes.json'));
const additions=[
 ['soldier','SG','bannerwarden','Banner Warden','#b8a570',{damage:180,interval:.8,range:3,melee:true,cleave:.8,cleaveRadius:2,cleaveType:'pure',bossBonus:1.5,aura:{range:4,damageBonus:.15}},'A shield captain who rallies nearby allies and cleaves the ground warband.'],
 ['archer','BW','galehunter','Gale Hunter','#a1cab3',{damage:85,interval:.28,range:6,multishot:3,penetration:.3},'A wind ranger whose three arrows pierce armor at every crossing.'],
 ['druid','OK','oakherald','Oak Herald','#91b76c',{damage:30,interval:.75,range:6,poisonDps:155,dotDuration:5,shred:10},'Living thorns poison the host and expose its armor.'],
 ['mage','AM','arcaneseer','Arcane Seer','#ae94db',{damage:120,interval:.85,range:6,cleave:.9,cleaveRadius:3,cleaveType:'pure',type:'arcane'},'An observatory mage sends pure shockwaves through resistant enemies.'],
 ['cleric','SL','sunhierophant','Sun Hierophant','#e5cb8a',{damage:22,interval:.8,range:6,type:'holy',aura:{range:6,haste:.5,damageBonus:.2,stackKey:'hierophant'}},'A sunlit hierophant sustains the formation with a distinct blessing.'],
 ['runebreaker','RB','ironrune','Ironrune Marshal','#b3a2c1',{damage:100,interval:.65,range:5,shred:28,penetration:.25},'A rune marshal breaks armor so the entire formation can strike harder.'],
 ['frostwarden','FW','winterregent','Winter Regent','#a3d7de',{damage:72,interval:.65,range:7,type:'frost',slow:.48,slowDuration:3,effectsRadius:1.5},'A winter regent chills clustered invaders at the checkpoint crossings.'],
 ['stormcaller','SC','tempestherald','Tempest Herald','#dfcb8c',{damage:110,interval:.7,range:7,type:'arcane',multishot:3,chain:2,chainChance:.35},'A crowned storm herald threads lightning through several enemies.']
];
for(const [basic,unitCode,family,name,color,stats,description] of additions){
 towers[basic].unitCode=unitCode;
 towers[family]={name,short:name,unitCode:unitCode+'H',advanced:true,stage:'Formation',color,icon:'crown',type:'physical',projectileSpeed:22,unitKind:'champion',modelBase:basic,model:basic,role:description,description,strong:description,weak:basic==='cleric'?'Needs nearby allies':'Requires three exact ranks',...stats};
 for(const [suffix,ranks,tier] of [['',[1,2,3],1],['-royal',[4,5,6],5]]){
  const recipe={id:family+suffix,resultFamily:family,resultTier:tier,level:1,stage:tier===1?'Formation':'Royal formation',ingredients:ranks.map(tier=>({family:basic,tier}))};
  const old=recipes.findIndex(r=>r.id===recipe.id);if(old>=0)recipes[old]=recipe;else recipes.push(recipe);
 }
}
for(const [path,data]of [['data/towers.json',towers],['data/recipes.json',recipes]])writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(`${Object.values(towers).filter(t=>t.advanced).length} champions; ${recipes.length} three-defender recipes plus repeatable ascensions.`);
