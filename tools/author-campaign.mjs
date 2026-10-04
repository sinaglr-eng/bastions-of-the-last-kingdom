import {readFileSync,writeFileSync} from 'node:fs';
import {applyEnemyDesigns} from './enemy-designs.mjs';
const source='https://dota2.fandom.com/wiki/Gem_TD';
const legacy=JSON.parse(readFileSync('data/enemies.json','utf8'));
const enemies=Object.fromEntries(Object.entries(legacy).filter(([id])=>!id.startsWith('host_')));
// Wave order, movement classes and named traits transcribed from the supplied reference.
// Orc identities, numerical tuning and readable counterplay are original adaptations.
const rows=[
 ['Ashclaw Scouts','goblin','Frenzied Pig','ground',''],
 ['Reedfang Leapers','wolf','Swift Frog','ground',''],
 ['Ironbelly Brutes','grunt','Sturdy Yak','ground',''],
 ['Scrapjaw Tinkerers','sapper','Smart Robot','ground',''],
 ['Gloamwing Outriders','wyvern','Baby Panda / Balloon Badger','flying',''],
 ['Mossback Lumberers','troll','Tardy Stump','ground',''],
 ['Bogscale Hunters','grunt','Satisfied Lizard','ground',''],
 ['Veilfang Stalkers','assassin','Invisible Spider','ground','vitality,stealth'],
 ['Dustcloak Skirmishers','assassin','Dusky','ground','evasion'],
 ['Mogrok the Gatebreaker','ogre','Invincible Dog','ground',''],
 ['Bonehook Raiders','grunt','Sheep','ground',''],
 ['Hexdrum Saboteurs','shaman','Funny Alpaca','ground','disarm'],
 ['Redtusk Amazons','berserker','Pig Princess','ground',''],
 ['Mirrorhide Guard','shield','Bulldog','ground','refraction'],
 ['Moonbat Beastmasters','bat','Bamboo Addict / Cat & Dog','flying','vitality'],
 ['Ashvein Cutpurses','warlock','Young Demon','ground','magicImmune,thief'],
 ['Briarhex Shamans','shaman','Belted Chicken','ground','untouchable'],
 ['Nightveil Hexblades','assassin','Bajie','ground','stealth,disarm'],
 ['Bloodhowl Wolfpack','wolf','Donkeytrio','ground','rush'],
 ['Gorvash the Bone Giant','ogre','Shakbag','ground',''],
 ['Rotroot Juggernauts','troll','Crab','ground','vitality'],
 ['Blackplate Ironclads','shield','Lockyaw','ground','highArmor'],
 ['Mirrorwraith Warlocks','warlock','Flopjaw','ground','physicalImmune,refraction'],
 ['Scrapspine Marauders','sapper','Mech Donkey','ground','reactiveArmor'],
 ['Ironwing Corsairs','wyvern','Cosair','flying','highArmor'],
 ['Cinderseal Zealots','berserker','Skateboard Flamingo','ground','magicImmune'],
 ['Wraithwing Harriers','bat','LGD Goldfish / Jellyfish','flying','untouchable,physicalImmune'],
 ['Rivetwing Bombardiers','balloon','Timbersaw / IG Dragon','flying','reactiveArmor'],
 ['Prismbat Tricksters','bat','VG Fox','flying','evasion,refraction'],
 ['Zaruun the Stormrider','dragon','Carpet Rider / Zard-','flying',''],
 ['Twinseal Spellbreakers','warlock','Bookwyrm / Otterdragon','ground','splitImmunity,refraction'],
 ['Soulwell Channelers','shaman','Recharable Shark','ground','recharge'],
 ['Riftstep Revenants','assassin','Ribboned Zombie','ground','physicalImmune,blink'],
 ['Gallowswing Pickpockets','bat','Babybloody','flying','evasion,thief'],
 ['Eclipsewing Twins','wyvern','Black & White Fox','flying','splitImmunity'],
 ['Sunless Oathbreakers','shield','Jumo','ground','splitImmunity'],
 ['Riftfang Prowlers','wolf','Baeko','ground','blink'],
 ['Blackmire Knifemasters','assassin','Lilnova','ground','cloakDaggers'],
 ['Tempestscale Reavers','wyvern','Newt','flying','untouchable,krakenShell,evasion'],
 ['Vorlak the Hollow Sky','dragon','Thrilling Ghost','flying','krakenShell'],
 ['Crystalmaw Phalanx','shield','Azuremir / Jade Dragon','ground','refraction'],
 ['Wildfire Bat-Lancers','bat','Kupu','flying','magicImmune,rush'],
 ['Soulfed Hexguard','shaman','Furry fish','ground','untouchable,evasion,recharge'],
 ['Cinderblink Executioners','berserker','Shroomy','ground','magicImmune,blink'],
 ['Skyhex Drumguard','balloon','Chirpy','flying','disarm,warDrums'],
 ['Ghostplate Immortals','shield','Boooofus','ground','physicalImmune'],
 ['Doomchant Ravagers','berserker','Crummy','ground','magicImmune,untouchable,rush'],
 ['Nightfire Sky-Thieves','bat','Wabbit','flying','magicImmune,disarm,evasion,thief'],
 ['Deepmaw Soulkeepers','ogre','Drodo','ground','krakenShell,recharge'],
 ['Ghorun, Emperor of Ash','dragon','Baby / Golden / Platinum Baby Roshan','flying','krakenShell']
];
const labels={vitality:'Vitality',stealth:'Veil',evasion:'Evasion',disarm:'Disarm',refraction:'Mirror shields',magicImmune:'Magic immunity',physicalImmune:'Physical immunity',thief:'Plunder',untouchable:'Dread aura',rush:'Blood rush',highArmor:'Iron plate',reactiveArmor:'Reactive armor',recharge:'Soul recharge',blink:'Rift step',cloakDaggers:'Cloak & daggers',krakenShell:'Deep shell',splitImmunity:'Mixed immunity variants',warDrums:'War drums'};
const counters={vitality:'Regenerates health; focus damage.',stealth:'Cloaked beyond 2 tiles; Clerics reveal within 6.',evasion:'Can evade direct physical hits; use magic.',disarm:'Briefly disarms nearby defenders every 8 seconds.',refraction:'Shields absorb three direct hits; poison ticks and burning auras bypass them.',magicImmune:'Magic and magical status immunity; physical or pure damage wins.',physicalImmune:'Physical immunity; use magic or pure damage.',thief:'Steals gold on reaching the keep.',untouchable:'Nearby defenders attack more slowly.',rush:'Periodic bursts of movement speed.',highArmor:'Heavy armor; use armor reduction or magic.',reactiveArmor:'Direct hits build temporary armor.',recharge:'Periodically restores health.',blink:'Dashes forward along the route, still visiting checkpoints.',cloakDaggers:'Cycles between cloak and short close-range disarms.',krakenShell:'Reduces damage from individual direct hits.',splitImmunity:'Each invader independently has magic or physical immunity. Mix physical and magical damage, or use pure damage against both.',warDrums:'Pulses haste to nearby allies.'};
const waves=[];
// Only the first patrol gives a Tier I support defender time to hold a crossing.
// Counts, rewards and movement stay on the curve; waves two/three ease durability.
const openingPatrols=[
  {hp:9,speed:1.3,interval:2.4}
];
const earlyDurability={2:52,3:68};
rows.forEach(([name,model,referenceName,movement,skills],i)=>{
  const wave=i+1,boss=wave%10===0,flying=movement==='flying',traits=skills?skills.split(','):[],id=`host_${String(wave).padStart(2,'0')}`;
  const opening=openingPatrols[i];
  const pressure=1.15+Math.min(1.85,wave*.055);
  const hp=opening?.hp??earlyDurability[wave]??Math.round((32+wave*6)*Math.pow(1.105,wave-1)*(boss?11:1)*pressure),skin=['#72815b','#7f8861','#6a8378','#8a775d','#7a697d'][Math.floor(i/10)];
  const enemy={name,model,traits,hp,speed:boss?1.65:flying?2.5:2.05+(i%3)*.16,armor:Math.round(wave*.55),gold:boss?70+wave*4:3+Math.floor(wave/5),xp:boss?60:3+Math.floor(wave/10),color:skin,size:boss?1.75:model==='goblin'?.66:model==='troll'||model==='ogre'?1.15:.9,boss,flying,leak:boss?10:1,clan:Math.floor(i/10),threat:traits.length?traits.map(t=>labels[t]).join(' · '):flying?'Airborne raiders · guard the checkpoint crossings':'Ground warband · shape the route',counter:traits.map(t=>counters[t]).join(' ')};
  const plated=['shield','ogre','grunt'].includes(model),caster=['shaman','warlock','troll'].includes(model);
  enemy.armor=Math.round(wave*.65+(plated?5+wave*.22:0));
  if(['goblin','wolf','bat','assassin'].includes(model))enemy.armor=Math.round(enemy.armor*.6);
  if(plated&&!opening)enemy.counter+=' Plated armor reduces physical damage; break armor or add magic.';
  if(caster){enemy.resists={magic:+Math.min(.24,.12+wave*.003).toFixed(3)};enemy.counter+=' Ritual wards resist magic; physical and pure attacks remain effective.';}
  if(opening){
    enemy.speed=opening.speed;enemy.armor=0;
    enemy.threat='Opening patrol · no armor or resistances';
    enemy.counter='Keep a defender near a checkpoint or crossing, then strengthen your defense each round.';
  }
  if(['wolf','bat','wyvern','dragon'].includes(model))enemy.beast=true;
  enemy.counter=enemy.counter.trim();
  if(traits.includes('vitality'))enemy.regen=.05;
  if(traits.includes('stealth'))enemy.stealth=true;
  if(traits.includes('evasion'))enemy.evasion=.25;
  if(traits.includes('disarm'))enemy.disarm=true;
  if(traits.includes('refraction'))enemy.refraction=3;
  if(traits.includes('magicImmune'))enemy.magicImmune=true;
  if(traits.includes('physicalImmune'))enemy.physicalImmune=true;
  if(traits.includes('thief'))enemy.thief=50;
  if(traits.includes('untouchable'))enemy.untouchable=.35;
  if(traits.includes('rush'))enemy.rush=5;
  if(traits.includes('highArmor'))enemy.armor+=50;
  if(traits.includes('reactiveArmor'))enemy.reactiveArmor=8;
  if(traits.includes('recharge'))enemy.recharge=.12;
  if(traits.includes('blink'))enemy.blink=3;
  if(traits.includes('cloakDaggers')){enemy.cloakDaggers=true;enemy.disarm=true;enemy.variants=[{}, {name:'Blackmire Blooddrinkers',cloakDaggers:false,disarm:false,regen:.05}];}
  if(traits.includes('krakenShell'))enemy.krakenShell=8+wave*1.5;
  if(traits.includes('splitImmunity'))enemy.variants=[{magicImmune:true,physicalImmune:false,name:name+' · Cinder seal'},{physicalImmune:true,magicImmune:false,name:name+' · Wraith seal'}];
  if(traits.includes('warDrums'))enemy.hasteAura=1.18;
  if([5,15,27,28,29,41].includes(wave))enemy.variants=[{}, {name:`${name} · Moonclaw clan`,color:'#667e91',model:wave===5?'balloon':model}];
  // Each queued invader rolls its own variant. Keep both alternatives explicit
  // in authored descriptions rather than implying one form for the whole wave.
  if(wave===28){
    Object.assign(enemy.variants[1],{reactiveArmor:0,stealth:true,traits:['stealth']});
    enemy.threat='Reactive armor / Cloaked Moon Clan';
    enemy.counter='Each invader independently has reactive armor or continuous cloak. Direct hits build armor on normal Scrapwings; reveal Moon Clan Scrapwings near defenders, checkpoints or detectors.';
  }
  if(wave===31){
    enemy.threat='Mixed immunity variants · Mirror shields';
    enemy.counter='Each invader independently has magic or physical immunity. Mix physical and magical damage, or use pure damage against both. Three shields block direct hits; effective damage-over-time and auras bypass those shields.';
  }
  if(wave===35){
    enemy.threat='Mixed immunity variants';
    enemy.counter='Each invader independently has magic or physical immunity. Mix physical and magical damage, or use pure damage against both.';
  }
  if(wave===36){
    enemy.threat='Mixed immunity variants';
    enemy.counter='Each invader independently has magic or physical immunity. Reduce armor against Ashen fighters; use magic against Spectral fighters, or pure damage against both.';
  }
  if(wave===38){
    enemy.threat='Cloak & daggers / Regeneration';
    enemy.counter='Each invader independently becomes a cloaked Knifeman with close-range disarms or a regenerating Blood-Leech. Reveal Knifemen and block Blood-Leech healing.';
  }
  if(wave===50)enemy.variants=[{}, {name:'Ghorun, the Gilded Tyrant',magicImmune:true,color:'#b99d57'},{name:'Ghorun, the Pale Devourer',krakenShell:enemy.krakenShell*1.3,color:'#a4b9b5'}];
  enemies[id]=enemy;
  const count=boss?1:flying?8+Math.floor(wave*.22):8+Math.floor(wave*.48);
  waves.push({name,boss,hp:1,reward:boss?200:50,reference:{source,wave,name:referenceName,movement,traits:skills,...(wave===45?{note:'The source lists an undefined Level ? skill; War Drums is an authored replacement.'}:{})},groups:[{type:id,count,interval:opening?.interval??(boss?1:flying?.9:.6)}]});
});
applyEnemyDesigns(enemies,waves);
writeFileSync('data/enemies.json',JSON.stringify(enemies,null,2)+'\n');
writeFileSync('data/waves.json',JSON.stringify(waves,null,2)+'\n');
writeFileSync('docs/WAVE_REFERENCE.md',`# Fifty-wave orc campaign\n\nReference: [Gem TD](${source}), inspected 29 September 2026. Movement classes, tenth-wave bosses and trait order follow its wave table. Names, HP, speed, rewards, counters and exact ability timings are original browser-game adaptations. The undefined wave-45 ability becomes War Drums; ambiguous alternatives choose a deterministic seeded variant independently for each invader. Flying units follow ordered checkpoints directly.\n\n| Wave | Orc warband | Movement | Traits |\n|---:|---|---|---|\n`+waves.map(w=>{const e=enemies[w.groups[0].type];return `| ${w.reference.wave} | ${e.name} | ${e.boss?'Boss · ':''}${e.flying?'Flying':'Ground'} | ${e.traits.map(t=>labels[t]).join(', ')||'—'} |`;}).join('\n')+'\n');
console.log('Authored 50 orc waves, 5 bosses, movement/traits from the supplied reference.');
