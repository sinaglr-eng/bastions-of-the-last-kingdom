export const SKILL_COSTS=Object.freeze([5,10,20]);
export const GENERAL_SKILLS=Object.freeze({
 'deep-refit':{name:'Deep Refit',kind:'draft',values:[600,500,400],description:'Keep a current basic recruit after lowering it by exactly two ranks. Gold cost: 600 / 500 / 400.'},
 'recruitment-focus':{name:'Recruitment Focus',kind:'focus',cost:1,values:[.04,.08,.12],description:'Pay 1 CP to favour one class by 4 / 8 / 12 percentage points in the next draft, including its reroll.'},
 'field-logistics':{name:'Field Logistics',kind:'passive',values:[6,8,10],description:'Begin a new run with 6 / 8 / 10 additional Command Points.'},
 quartermaster:{name:'Quartermaster',kind:'passive',values:[400,600,1000],description:'Begin a new run with 400 / 600 / 1,000 additional gold.'},
 'morale-boost':{name:'Morale Boost',kind:'combat',cost:3,duration:20,values:[.4,.6,1],description:'All active defenders attack 40 / 60 / 100% faster for 20 combat seconds. Costs 3 CP.'},
 'war-horn':{name:'War Horn',kind:'combat',cost:3,duration:20,values:[.4,.6,.8],description:'Slow every enemy by 40 / 60 / 80% for 20 combat seconds, including immune enemies and bosses. Costs 3 CP.'},
 'blood-wrath':{name:'Blood Wrath',kind:'combat',cost:3,duration:20,values:[.4,.6,1],description:'All active defenders deal 40 / 60 / 100% more own damage for 20 combat seconds. Costs 3 CP.'},
});
export function generalLoadout(skills={},equipped=[]){
 if(!Array.isArray(equipped)||equipped.length>3||new Set(equipped).size!==equipped.length)throw Error('Equip up to three different skills.');
 const result={};for(const id of equipped){if(!Object.hasOwn(GENERAL_SKILLS,id)||!Number.isInteger(skills[id])||skills[id]<1||skills[id]>3)throw Error('Skill is not unlocked.');result[id]=skills[id];}
 return Object.freeze(result);
}
export function validateLoadout(loadout={}){return generalLoadout(loadout,Object.keys(loadout));}
export class General{
 constructor(game,loadout={}){this.game=game;this.loadout=validateLoadout(loadout);this.active={};this.pendingFocus=null;this.draftFocus=null;}
 level(id){return this.loadout[id]||0;}
 value(id){return GENERAL_SKILLS[id]?.values[this.level(id)-1]||0;}
 remaining(id){return Math.max(0,(this.active[id]||0)-this.game.combat.elapsed);}
 multiplier(id){return this.remaining(id)>1e-9?1+this.value(id):1;}
 get slow(){return this.remaining('war-horn')>1e-9?this.value('war-horn'):0;}
 activate(id,slot=null){
  const skill=GENERAL_SKILLS[id],g=this.game;
  if(!Object.hasOwn(GENERAL_SKILLS,id)||!this.level(id)||['won','lost'].includes(g.phase))return false;
  if(skill.kind==='focus'){
   if(this.pendingFocus||!['A','B','C','D','E','F','G','H'].includes(slot)||g.commandPoints.value<1)return false;
   g.commandPoints.value--;this.pendingFocus={slot,bonus:this.value(id),round:g.round+1};
  }else if(skill.kind==='combat'){
   if(g.phase!=='combat'||this.remaining(id)>1e-9||g.commandPoints.value<3)return false;
   g.commandPoints.value-=3;this.active[id]=g.combat.elapsed+20;
  }else return false;
  g.emit('general-activated',{id,slot,cost:skill.cost});g.emit('change');return true;
 }
 beginDraft(){this.draftFocus=this.pendingFocus;this.pendingFocus=null;this.active={};}
 finishDraft(){this.draftFocus=null;}
}
