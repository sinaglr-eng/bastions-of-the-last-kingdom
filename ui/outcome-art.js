// Outcome scenes are presentation only. Their random choice is independent of
// the seeded game simulation and remains stable while an ended run is reviewed.
export const OUTCOME_ART_REVISION='outcome-scenes-20261018-v2';
const scene=(id,outcome,path,alt)=>Object.freeze({id,outcome,path,alt});
export const OUTCOME_ART_SCENES=Object.freeze({
  lost:Object.freeze([
    scene('defeat-01','lost','assets/ui/results/v044/defeat.png','The victorious Marsh Orc Hunter and Orc Ash Executioner stand beside defeated Frost Knight and Lionheart Champion'),
    scene('defeat-02','lost','assets/ui/results/v045/defeat-02.png','Mogrok, the Gatebreaker and an Orc Mirror Shieldbearer triumph above the defeated Elven Mage and Elven Ranger'),
    scene('defeat-03','lost','assets/ui/results/v045/defeat-03.png','A Silent Orc Executioner and Bloodwolf Orc Rider triumph above the defeated Paladin and Baby Fire Dragon')
  ]),
  won:Object.freeze([
    scene('victory-01','won','assets/ui/results/v044/victory.png','Frost Knight, Lionheart Champion and Master Druid celebrate above the defeated Lord Bernhard and his wyvern'),
    scene('victory-02','won','assets/ui/results/v045/victory-02.png','King and Elven Elite Warrior celebrate above the defeated Lord Bernhard, his wyvern and an Orc Dual-Seal Inquisitor'),
    scene('victory-03','won','assets/ui/results/v045/victory-03.png','Lady Claire and Archangel celebrate above the defeated Lord Bernhard, his wyvern and Mogrok, the Gatebreaker')
  ])
});

export function createOutcomeArtSelector({random=()=>Math.random()}={}){
  const attempts=new WeakMap(),previous={won:null,lost:null};
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
    if(attempt.scene?.outcome===game.phase)return attempt.scene;
    const choices=OUTCOME_ART_SCENES[game.phase].filter(art=>art.id!==previous[game.phase]);
    const sample=Number(random()),index=Number.isFinite(sample)?Math.min(choices.length-1,Math.max(0,Math.floor(sample*choices.length))):0;
    attempt.scene=choices[index];previous[game.phase]=attempt.scene.id;
    return attempt.scene;
  };
}

export const selectOutcomeArt=createOutcomeArtSelector();
