const KEY='bastions.profile.v1';
export function loadProfile() {
  try {
    const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
    return {discoveries:Array.isArray(raw.discoveries)?raw.discoveries.filter(x=>typeof x==='string'):[],muted:raw.muted===true,bestWave:Math.max(0,Number(raw.bestWave)||0),bestScore:Math.max(0,Number(raw.bestScore)||0),wins:Math.max(0,Number(raw.wins)||0),tutorial:raw.tutorial!==false,tutorialDecision:['accepted','skipped','complete'].includes(raw.tutorialDecision)?raw.tutorialDecision:null};
  }catch{return {discoveries:[],muted:false,bestWave:0,bestScore:0,wins:0,tutorial:true};}
}
export function saveProfile(profile){try{localStorage.setItem(KEY,JSON.stringify(profile));return true;}catch{return false;}}
