import factionOutcomes from '../data/faction-outcome-scenes-v063.json' with {type:'json'};
export const FACTION_OUTCOME_ART_REVISION=factionOutcomes.revision;
export const FACTION_OUTCOME_ART_SCENES=Object.freeze(Object.fromEntries(Object.entries(factionOutcomes.groups).map(([id,g])=>[id,Object.freeze(Object.fromEntries(Object.entries(g).map(([o,scenes])=>[o,Object.freeze(scenes.map(s=>Object.freeze(s)))])))])));
// Outcome scenes are presentation only. Their random choice is independent of
// the seeded game simulation and remains stable while an ended run is reviewed.
export const OUTCOME_ART_REVISION='outcome-scenes-20261022-v3';
const scene=(id,outcome,path,alt)=>Object.freeze({id,outcome,path,alt});
export const OUTCOME_ART_SCENES=Object.freeze({
  lost:Object.freeze([
    scene('defeat-01','lost','assets/ui/results/v044/defeat.png','The victorious Marsh Orc Hunter and Orc Ash Executioner stand beside defeated Frost Knight and Lionheart Champion'),
    scene('defeat-02','lost','assets/ui/results/v045/defeat-02.png','Mogrok, the Gatebreaker and an Orc Mirror Shieldbearer triumph above the defeated Elven Mage and Elven Ranger'),
    scene('defeat-03','lost','assets/ui/results/v045/defeat-03.png','A Silent Orc Executioner and Bloodwolf Orc Rider triumph above the defeated Paladin and Baby Fire Dragon'),
    scene('defeat-v049-01','lost','assets/ui/results/v049/defeat-01.png','The Fallen Outpost: an Orc Skull Scavenger and Goblin Thornstrider triumph over the defeated Soldier and Archer at a captured forest outpost'),
    scene('defeat-v049-02','lost','assets/ui/results/v049/defeat-02.png','The Silenced Grove: a Mossback Troll and Ogre Glutton stand above the defeated Druid and Master Druid in an overrun woodland sanctuary'),
    scene('defeat-v049-03','lost','assets/ui/results/v049/defeat-03.png','The Extinguished Observatory: an Orc Spell Eater and Cursed Totem Troll triumph over the defeated Stormcaller and Elven Archmage on a ruined terrace'),
    scene('defeat-v049-04','lost','assets/ui/results/v049/defeat-04.png','The Broken Ice Crossing: a Silent Orc Executioner and Orc Wraith of the Shattered World overlook the defeated Frost Warden and Frozen Celestial on a broken bridge'),
    scene('defeat-v049-05','lost','assets/ui/results/v049/defeat-05.png','The Last Bell: an Orc Dual-Seal Inquisitor and Ogre Revenant in Hollow Armor stand victorious near the defeated Cleric and High Priest in a ruined chapel'),
    scene('defeat-v049-06','lost','assets/ui/results/v049/defeat-06.png','The Captured Workshop: an Orc Scrap Tinker and Riveted Goblin Mutant claim a captured Catapult beside the defeated Engineer in a breached workshop yard'),
    scene('defeat-v049-07','lost','assets/ui/results/v049/defeat-07.png','The Stolen Throne: Mogrok, the Gatebreaker and Gorvash, the Bone Patriarch triumph over the defeated Paladin and King in a roofless royal hall'),
    scene('defeat-v049-08','lost','assets/ui/results/v049/defeat-08.png','The Fallen Skywatch: an Iron Bat Orc Rider and Thunder Manta Orc Rider fly past the defeated Mother Fire Dragon and Thunderbird at a ruined watchtower'),
    scene('defeat-v049-09','lost','assets/ui/results/v049/defeat-09.png','The Lost River Road: a Black Marsh Knifeman and Riftwolf Orc Rider triumph over the defeated Elven Ranger and Master Ranger beside a ruined watergate'),
    scene('defeat-v049-10','lost','assets/ui/results/v049/defeat-10.png','Bernhard’s Final Banner: Lord Bernhard on the Wyvern Queen and Zaruun, Lord of Storm Wings triumph over the defeated Lady Claire and Archangel in the final keep')
  ]),
  won:Object.freeze([
    scene('victory-01','won','assets/ui/results/v044/victory.png','Frost Knight, Lionheart Champion and Master Druid celebrate above the defeated Lord Bernhard and his wyvern'),
    scene('victory-02','won','assets/ui/results/v045/victory-02.png','King and Elven Elite Warrior celebrate above the defeated Lord Bernhard, his wyvern and an Orc Dual-Seal Inquisitor'),
    scene('victory-03','won','assets/ui/results/v045/victory-03.png','Lady Claire and Archangel celebrate above the defeated Lord Bernhard, his wyvern and Mogrok, the Gatebreaker')
  ])
});

export function createOutcomeArtSelector({random=()=>Math.random()}={}){
  const attempts=new WeakMap(),previous=new Map(),remaining=new Map();
  return game=>{
    if(!game||typeof game!=='object')return null;
    let attempt=attempts.get(game);
    if(!['won','lost'].includes(game.phase)){
      if(attempt)attempt.scene=null;
      return null;
    }
    if(!attempt){
      attempt={scene:null};attempts.set(game,attempt);
      // Sandbox can replay the same wave on the same Game. An existing wave
      // event starts a new attempt even if the result UI was not opened between.
      // The listener retains only this small record; no external Game reference.
      game.on?.(type=>{if(type==='wave')attempt.scene=null;});
    }
    const factionId=Object.hasOwn(FACTION_OUTCOME_ART_SCENES,game.factionId)?game.factionId:null,cohort=(factionId||'legacy')+':'+game.phase;
    if(attempt.scene?.outcome===game.phase&&attempt.cohort===cohort)return attempt.scene;
    const scenes=factionId?FACTION_OUTCOME_ART_SCENES[factionId][game.phase]:OUTCOME_ART_SCENES[game.phase];
    // Draw without replacement so every approved scene appears before the next
    // cycle. Keep the cycle boundary from repeating the preceding result too.
    if(!remaining.has(cohort))remaining.set(cohort,[]);const bag=remaining.get(cohort);if(!bag.length)bag.push(...scenes);
    const choices=bag.length>1?bag.filter(art=>art.id!==previous.get(cohort)):bag;
    const sample=Number(random()),index=Number.isFinite(sample)?Math.min(choices.length-1,Math.max(0,Math.floor(sample*choices.length))):0;
    attempt.scene=choices[index];bag.splice(bag.indexOf(attempt.scene),1);previous.set(cohort,attempt.scene.id);attempt.cohort=cohort;
    return attempt.scene;
  };
}

export const selectOutcomeArt=createOutcomeArtSelector();
