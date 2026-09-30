// Authoring utility for the initial campaign. Run deliberately: this replaces the expansion entries in data/.
import {readFileSync,writeFileSync} from 'node:fs';
const read=k=>JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)));
const write=(k,v)=>writeFileSync(new URL(`../data/${k}.json`,import.meta.url),JSON.stringify(v,null,2)+'\n');
const towers=read('towers');
Object.assign(towers,{
 crossbow:{name:'Crossbow Bastion',short:'Crossbow',role:'Heavy armor-piercing bolts',color:'#d5b6a1',icon:'bolt',weight:1,damage:33,interval:1.3,range:5.7,projectileSpeed:23,type:'piercing',penetration:0.8,strong:'Shieldbearers, ogres',weak:'Unarmored swarms',description:'A reinforced fighting platform with a heavy windlass crossbow.'},
 fire:{name:'Fire Watchtower',short:'Fire',role:'Explosive fire & lingering burns',color:'#eab078',icon:'fire',weight:1,damage:17,interval:1.35,range:4.8,projectileSpeed:11,type:'fire',splash:1.4,burn:0.22,dotDuration:3.2,strong:'Packed infantry and regenerating trolls',weak:'Fire wards, distant targets',description:'Watchfires that once warned the valley now turn the horde to ash.'},
 alchemist:{name:'Alchemist Workshop',short:'Alchemist',role:'Poison & armor reduction',color:'#afc97a',icon:'flask',weight:1,damage:9,interval:1.1,range:5,projectileSpeed:10,type:'poison',poison:0.35,dotDuration:4,shred:12,strong:'Armored targets with physical support',weak:'Poison resistance, lone defense',description:'Herbal brews and caustic oils delivered in clay flasks.'},
 temple:{name:'Temple of Light',short:'Temple',role:'Holy damage & nearby attack aura',color:'#eddaa0',icon:'sun',weight:1,damage:17,interval:1.2,range:5.3,projectileSpeed:16,type:'holy',aura:{range:3.5,haste:0.12},bossBonus:1.4,strong:'Shamans, bosses; supports adjacent towers',weak:'Isolated placement, enemy magic wards',description:'A fortified wayshrine whose bells call the defenders to stand together.'},
 embercrown:{name:'Embercrown Fortress',short:'Embercrown',role:'Enchanted siege fire & burning blast',color:'#efaa75',icon:'crown',advanced:true,damage:350,interval:2.2,range:10,projectileSpeed:13,type:'fire',splash:2.5,burn:0.18,dotDuration:4,strong:'Dense armies, regeneration',weak:'Fast scattered enemies, fire resistance',description:'Siege engineers bind a watchfire to every enormous bolt.'},
 sunward:{name:'Sunward Sanctuary',short:'Sunward',role:'Blessing aura & holy volleys',color:'#e3d79d',icon:'crown',advanced:true,damage:100,interval:0.95,range:6.5,projectileSpeed:18,type:'holy',multishot:2,bossBonus:1.6,aura:{range:5.2,haste:0.32},strong:'Magic users and groups of friendly towers',weak:'Requires nearby damage towers',description:'A ring of sworn wardens amplifies the courage of every nearby defender.'},
 thornwarden:{name:'Thornwarden Lodge',short:'Thornwarden',role:'Three-shot volleys, bleed & beast hunting',color:'#b9cb8c',icon:'crown',advanced:true,damage:62,interval:0.65,range:6.8,projectileSpeed:22,type:'physical',multishot:3,bleed:0.2,beastBonus:1.75,strong:'Wolf riders, wyverns and swarms',weak:'Heavy armor without support',description:'Hunters of the ancient forest bring their barbed arrows to the human walls.'},
 winterhold:{name:'Winterhold Citadel',short:'Winterhold',role:'Area frost, freeze & brittle armor',color:'#acdfeb',icon:'crown',advanced:true,damage:135,interval:1.25,range:7,projectileSpeed:16,type:'frost',splash:2.4,slow:0.5,slowDuration:3,freeze:0.28,strong:'Fast formations; physical follow-up damage',weak:'Frost resistance, modest boss damage',description:'Frozen enemies take 25% extra physical damage while immobilized.'},
 kingsreach:{name:'Kingsreach Engine',short:'Kingsreach',role:'Enormous-range explosive siege bolts',color:'#d4b48c',icon:'crown',advanced:true,damage:590,interval:3.2,range:12.5,projectileSpeed:24,type:'piercing',penetration:0.9,splash:1.9,strong:'Armored warlords and siege beasts',weak:'Very slow rate of fire',description:'A colossal timber-and-iron torsion engine built by the royal siege guild.'},
 dawnspire:{name:'Dawnspire Redoubt',short:'Dawnspire',role:'Royal holy volleys & powerful blessing',color:'#f0db9f',icon:'crown',advanced:true,damage:285,interval:0.65,range:8.5,projectileSpeed:20,type:'holy',multishot:3,bossBonus:1.9,aura:{range:6,haste:0.45},strong:'Shamans, warlords and clustered defenders',weak:'Demanding late-game ingredients',description:'The kingdom’s final banner is raised over a radiant redoubt.'}
});
write('towers',towers);
const recipes=read('recipes').slice(0,2);
recipes.push(
 {id:'embercrown',level:4,ingredients:[{family:'fire',tier:4},{family:'ballista',tier:3},{family:'mage',tier:3}]},
 {id:'sunward',level:3,ingredients:[{family:'temple',tier:3},{family:'crossbow',tier:2},{family:'frost',tier:2}]},
 {id:'thornwarden',level:2,ingredients:[{family:'archer',tier:2},{family:'archer',tier:2},{family:'alchemist',tier:1}]},
 {id:'winterhold',level:4,ingredients:[{family:'frost',tier:4},{family:'mage',tier:3},{family:'ballista',tier:2}]},
 {id:'kingsreach',level:5,ingredients:[{family:'ballista',tier:4},{family:'crossbow',tier:4},{family:'alchemist',tier:3}]},
 {id:'dawnspire',level:6,ingredients:[{family:'temple',tier:5},{family:'archer',tier:4},{family:'mage',tier:4}]}
);write('recipes',recipes);
const enemies=read('enemies');
Object.assign(enemies,{
 berserker:{name:'Orc Berserker',hp:115,speed:2,armor:4,gold:6,xp:5,color:'#886e54',size:0.9,threat:'Enrages below half health · slow or burst'},
 wolf:{name:'Wolf Rider',hp:145,speed:3.2,armor:8,gold:7,xp:6,color:'#637568',size:0.85,beast:true,threat:'Fast elite beast · frost and beast hunters'},
 shaman:{name:'Orc Shaman',hp:210,speed:1.5,armor:4,resists:{magic:0.42},gold:10,xp:8,color:'#7d795d',size:1,threat:'Magic resistant · hastens nearby allies'},
 sapper:{name:'Goblin Sapper',hp:115,speed:2.35,armor:2,gold:6,xp:5,color:'#889166',size:0.7,threat:'Scorches barricades · briefly weakens adjacent towers'},
 warlock:{name:'Orc Warlock',hp:260,speed:1.4,armor:6,resists:{magic:0.2,fire:0.2},gold:11,xp:9,color:'#6c686b',size:1,threat:'Magic ward aura · use physical and piercing'},
 wyvern:{name:'Wyvern Rider',hp:130,speed:2.8,armor:3,gold:9,xp:7,color:'#898568',size:0.95,beast:true,flying:true,threat:'Flying · ignores your maze, follows checkpoints'},
 warlord:{name:'Ghorun, the Hollow Crown',hp:2800,speed:1.15,armor:52,resists:{magic:0.2,poison:0.3},gold:160,xp:100,color:'#787b64',size:2.1,boss:true,leak:12,threat:'Legendary warlord · piercing, holy and a long maze'}
});write('enemies',enemies);
const waves=read('waves').slice(0,10);
const group=(type,count,interval)=>({type,count,interval});
const add=(name,hp,reward,groups,extra={})=>waves.push({name,hp,reward,groups,...extra});
add('Blood on the wind',2.1,65,[group('berserker',14,.55),group('wolf',8,.7)]);
add('Shadows over the valley',1.8,70,[group('wyvern',12,.8),group('grunt',14,.45)]);
add('Ash and splinters',2.3,75,[group('sapper',12,.5),group('shield',16,.55)]);
add('The wolves of winter',2.5,80,[group('wolf',22,.4),group('troll',6,1.1)]);
add('Drums of the spirit host',2.5,90,[group('shaman',5,.9),group('shield',18,.3),group('berserker',12,.45)]);
add('A sky of teeth',2.8,85,[group('wyvern',18,.55),group('wolf',14,.4)]);
add('The cauldron march',3,95,[group('warlock',5,1.3),group('troll',12,.7),group('sapper',12,.4)]);
add('Iron against the earth',3.3,100,[group('shield',26,.4),group('ogre',2,2)]);
add('No quiet in the dark',3.4,110,[group('wolf',20,.3),group('berserker',24,.4),group('shaman',6,.8)]);
add('The broken crown',2.2,180,[group('warlord',1,2),group('ogre',3,1.6),group('warlock',5,.7)],{boss:true});
add('The second horde',4,115,[group('grunt',32,.22),group('troll',12,.6),group('wyvern',12,.5)]);
add('Scorched foundations',4.2,120,[group('sapper',24,.25),group('berserker',26,.3)]);
add('Wings and wards',4.4,125,[group('warlock',8,.7),group('wyvern',26,.42),group('shaman',8,.6)]);
add('The iron tide',4.6,130,[group('shield',36,.35),group('ogre',5,1.6)]);
add('Hunters become the hunted',5,145,[group('wolf',32,.25),group('troll',18,.5),group('shaman',8,.5)]);
add('Blackened blessings',5.2,150,[group('warlock',12,.6),group('berserker',32,.3),group('sapper',18,.3)]);
add('Storm above the walls',5.5,160,[group('wyvern',36,.38),group('shield',24,.3)]);
add('The unending host',5.8,170,[group('troll',20,.45),group('ogre',6,1.3),group('wolf',28,.3)]);
add('Before the last dawn',6.2,180,[group('shaman',10,.5),group('warlock',10,.5),group('shield',30,.3),group('wyvern',22,.3)]);
add('Ghorun, the Hollow Crown',5.8,500,[group('ogre',5,1),group('warlord',1,2),group('shaman',12,.4),group('berserker',32,.25),group('wyvern',20,.3)],{boss:true});
write('waves',waves);
console.log(`Campaign authored: ${Object.keys(towers).length} towers, ${recipes.length} recipes, ${Object.keys(enemies).length} enemies, ${waves.length} waves.`);

await import('./author-roster.mjs');
