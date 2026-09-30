// Original characters, using the user's Gem TD reference for roles, rank ratios and recipe topology.
// Damage is scaled ×3; 100 source range units = one cell. Soldier has adapted melee range.
import {readFileSync,writeFileSync} from 'node:fs';
const write=(file,data)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n');
const source='https://dota2.fandom.com/wiki/Gem_TD';
const towers={},recipes=[];
function basic(id,name,gem,code,color,icon,type,damage,interval,range,role,description,extra){
  const levels=damage.map((n,i)=>({damage:n*3,interval:Array.isArray(interval)?interval[i]:interval,range:Array.isArray(range)?range[i]:range,...extra(i)}));
  towers[id]={name,short:name,referenceGem:gem,referenceCode:code,source,color,icon,type,weight:1,projectileSpeed:20,role,description,strong:role,weak:id==='soldier'?'Flying enemies and distant targets':id==='cleric'?'Low solo damage; needs allies':id==='archer'?'Heavy armor':id==='druid'?'Poison resistance':id==='runebreaker'?'Low solo damage; needs physical allies':'Resistant or scattered enemies',...levels[0],levels};
}
basic('soldier','Soldier','Diamond','D','#80b7c9','swords','physical',[5,10,20,40,80,460],[1,1,1,1,1,.7],2.5,'Heavy single-target sword strikes','A determined shieldbearer. Mythic rank delivers a devastating, faster sword strike.',()=>({melee:true}));
basic('archer','Archer','Aquamarine','Q','#d7b578','bow','physical',[2,4,8,16,24,80],[.25,.25,.25,.25,.25,.1],[4,4,4,4,4,5],'Rapid single-target arrows','A feather-capped ranger whose Mythic bow releases ten arrows a second.',()=>({}));
basic('druid','Druid','Emerald','G','#a5d37b','flask','poison',[2,4,6,8,10,12],1,5,'Poison lasting five seconds','A forest guardian with a mushroom companion. Stronger thorns refresh poison instead of endlessly stacking.',i=>({poisonDps:[2,4,8,16,32,128][i]*3,dotDuration:5}));
basic('mage','Mage','Ruby','R','#c59aef','spark','arcane',[4,8,12,24,48,150],1,5,'Arcane hit with pure splash damage','An apprentice with an oversized hat. Impacts send an armor-ignoring shockwave into nearby foes.',i=>({cleave:[.3,.4,.5,.6,.7,1][i],cleaveRadius:[3,3.5,4,4.5,5,7][i],cleaveType:'pure'}));
basic('cleric','Cleric','Opal','E','#eddaa0','sun','holy',[1,2,3,4,5,6],1,5,'Attack-speed blessing','A cheerful keeper of the light. Different blessing ranks combine; duplicates of the same rank do not.',i=>({aura:{range:5,haste:[.2,.3,.4,.5,.6,.7][i],stackKey:`opal-${i+1}`}}));
basic('runebreaker','Runebreaker','Amethyst','P','#b795d8','hammer','physical',[2,4,6,8,10,70],.6,5,'Shatters enemy armor','A dwarf with an enchanted hammer. Runic bolts expose armor for nearby archers and soldiers.',i=>({shred:[2,4,8,16,32,64][i]}));
basic('frostwarden','Frost Warden','Sapphire','B','#9bdfe9','snow','frost',[2,4,6,8,10,36],[1,1,1,1,1,.6],6,'Slows enemy movement','A winter sentinel. Mythic frost also chills enemies beside the target.',i=>({slow:[.12,.18,.24,.3,.36,.75][i],slowDuration:3,...(i===5?{effectsRadius:.5}:{})}));
basic('stormcaller','Stormcaller','Topaz','Y','#e6cb70','spark','arcane',[3,6,9,18,36,200],[1.3,1.3,1.3,1.3,1.3,.6],[6,5,5,5,5,50],'Strikes three enemies at once','A gleeful storm conjurer. Mythic rank reaches across the battlefield with three simultaneous bolts.',()=>({multishot:3}));

const codes={D:'soldier',Q:'archer',G:'druid',R:'mage',E:'cleric',P:'runebreaker',B:'frostwarden',Y:'stormcaller'};
function special(id,name,reference,stage,ingredients,damage,interval,range,role,extra={}){
  towers[id]={name,short:name,referenceTower:reference,source,stage,advanced:true,color:'#d8c69a',icon:'crown',type:'physical',damage:damage*3,interval,range,projectileSpeed:22,role,description:role,strong:role,weak:'Requires exact recipe ingredients',...extra};
  recipes.push({id,level:1,stage,referenceTower:reference,ingredients:ingredients.map(token=>/^[DQGREPBY][1-6]$/.test(token)?{family:codes[token[0]],tier:Number(token[1])}:{family:token,tier:1})});
}
special('rimewatch','Rimewatch Keep','Silver','Basic',['B1','D1','Y1'],40,1,6,'Heavy shots slow advancing troops',{type:'frost',slow:.18,slowDuration:3,color:'#a4d4db',model:'frost'});
special('frostblade','Frostblade Guard','Silver Knight','Intermediate',['rimewatch','Q2','R3'],140,.8,7,'Slowing strikes with a pure shockwave',{slow:.24,slowDuration:3,cleave:.5,cleaveRadius:4,cleaveType:'pure',model:'frost'});
special('roseguard','Roseguard Champion','Pink Diamond','Intermediate',['D5','D3','Y3'],80,1,6,'Ten percent chance of a fivefold critical hit',{critChance:.1,critMultiplier:5,color:'#dda3b9',model:'ballista'});
special('highking','High King’s Bastion','Huge Pink Diamond','Advanced',['roseguard','frostblade','rimewatch'],400,.75,10,'Critical hits, slowing shots and pure cleave',{critChance:.1,critMultiplier:5,cleave:.5,cleaveRadius:4,cleaveType:'pure',slow:.24,slowDuration:3,model:'ballista'});
special('crownofages','Crown of Ages','Koh-i-noor Diamond','Mythic',['highking','P6','D6'],900,.65,12,'Mythic armor-breaking critical strikes',{critChance:.1,critMultiplier:5,shred:64,model:'ballista',color:'#f8de8e'});
special('thornwarden','Thornwarden Lodge','Malachite','Basic',['E1','G1','Q1'],15,.8,6,'Four simultaneous hunting arrows',{multishot:4,model:'archer',color:'#afca88'});
special('verdantguard','Verdant Guard','Vivid Malachite','Intermediate',['thornwarden','D2','Y3'],50,.7,7,'Seven simultaneous arrows',{multishot:7,model:'archer',color:'#b1d982'});
special('tempest','Tempest Choir','Uranium-238','Intermediate',['Y5','B3','E2'],100,.5,7,'Five simultaneous storm bolts',{multishot:5,type:'arcane',model:'mage',color:'#b8b4ec'});
special('stormcitadel','Storm Citadel','Uranium-235','Advanced',['tempest','thornwarden','verdantguard'],240,.5,8,'Ten simultaneous storm bolts',{multishot:10,type:'arcane',model:'mage',color:'#a5cfee'});
special('embercrown','Embercrown Beacon','Asteriated Ruby','Basic',['R2','R1','P1'],0,.5,6,'Continuous burning aura around the beacon',{type:'fire',burnAura:240,model:'fire',color:'#efaa75'});
special('worldfire','Worldfire Spire','Volcano','Intermediate',['embercrown','R4','P3'],0,.5,6,'A stronger continuous burning aura',{type:'fire',burnAura:1200,model:'fire',color:'#efa876'});
special('starfall','Starfall Observatory','Bloodstone','Intermediate',['R5','Q4','P3'],35,1,7,'Twenty percent chance of chain lightning',{type:'arcane',chain:4,chainChance:.2,model:'mage',color:'#cda3ed'});
special('thunderheart','Thunderheart Sanctum','Antique Bloodstone','Advanced',['starfall','worldfire','R2'],70,1,8,'Forked lightning with a burning aura',{type:'arcane',chain:5,chainChance:.25,chainDamage:1500,burnAura:1200,model:'mage',color:'#cfa1e4'});
special('phoenix','Phoenix Crown','The Crown Prince','Mythic',['thunderheart','R6','G6'],400,.6,10,'Mythic fire, forked lightning and poison',{type:'fire',chain:5,chainChance:.3,chainDamage:2400,burnAura:1800,poisonDps:384,dotDuration:5,model:'fire',color:'#ffc17c'});
special('greenheart','Greenheart Grove','Jade','Basic',['G3','E3','B2'],10,.5,8,'Rapid poisonous thorns',{type:'poison',poisonDps:24,dotDuration:5,model:'alchemist',color:'#b5d491'});
special('eldergrove','Eldergrove Watch','Grey Jade','Intermediate',['greenheart','B4','Q3'],30,.5,8,'Poison and three extra tiles of ally range',{type:'poison',poisonDps:48,dotDuration:5,aura:{range:8,rangeBonus:3},model:'alchemist',color:'#a7c88b'});
special('kingsreach','Kingsreach Forge','Gold','Intermediate',['P5','P4','D2'],60,.8,6,'Strips thirty points of enemy armor',{shred:30,model:'ballista',color:'#e7bf6b'});
special('sunward','Sunward Sanctuary',"Chrysoberyl Cat’s Eye",'Intermediate',['E5','D4','Q3'],6,1,5,'Allies attack sixty percent faster and hit fifty percent harder',{type:'holy',aura:{range:5,haste:.6,damageBonus:.5,stackKey:'opal-5'},model:'temple',color:'#f0d895'});
special('winterhold','Winterhold Citadel','Yellow Sapphire','Intermediate',['B5','R4','Y4'],20,1,6,'A chilling aura slows nearby enemies by seventy-five percent',{type:'frost',slowAura:.75,model:'frost',color:'#aedfe9'});
special('dawnspire','Dawnspire Redoubt','Star Sapphire','Mythic',['winterhold','B6','E6'],150,.6,9,'Mythic winter aura and an attack blessing',{type:'holy',slowAura:.75,aura:{range:6,haste:.7,stackKey:'opal-6'},model:'temple',color:'#f2dd9f'});
const {CHAMPIONS,SIEGE_KINDS}=await import('../game/render/champion-catalog.js');
for(const [id,unit] of Object.entries(CHAMPIONS))if(towers[id])Object.assign(towers[id],{name:unit.name,short:unit.name,description:unit.description,model:unit.kind,unitKind:SIEGE_KINDS.includes(unit.kind)?'siege':'champion'});
towers.embercrown.role='An enchanted ember basket radiates continuous fire';
towers.worldfire.role='A dragon furnace radiates a stronger burning field';
write('data/towers.json',towers);write('data/recipes.json',recipes);
const balance=JSON.parse(readFileSync('data/balance.json','utf8'));
balance.tiers=['Militia','Trained','Veteran','Elite','Royal','Mythic'];
balance.tierDamage=[1,1.85,3.3,5.6,9,24];balance.tierRange=[0,.35,.7,1.05,1.4,2];
for(const row of balance.mastery)row.weights=[...row.weights.slice(0,5),0];
write('data/balance.json',balance);
console.log('Authored eight defenders × six ranks and twenty branching recipes.');
await import('./author-continuations.mjs');
