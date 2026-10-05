export const TUTORIAL_STEPS=[
  {target:'#draft',title:'1. Inspect the wave, then build',text:'Review enemy numbers and the main threat tags before opening the defender draft. The Wave Preview above the command panel remains available while choosing. Click Open defender draft, then place all five on empty grid tiles; each placement reveals a random defender.'},
  {target:'#draft',title:'2. Choose your keeper',text:'The five cards below the map show this round’s defenders. Select one and press Keep, or double-click its figure on the map or its card. On a touchscreen, double-tap. The other four become walls.'},
  {target:'.map-controls [data-action="maze"]',title:'3. Plan the route',text:'Open Maze plans here, or press M. Blue tiles show suggested walls; gold tiles reserve central firing positions. Enemies must visit checkpoints 1 → 2 → 3 → 4 → 5. Leave their route open. Walls can be demolished for free between waves.'},
  {target:'#economy',title:'4. Your kingdom grows',text:'Kills earn Kingdom XP for recipe unlocks. Construction mastery follows construction rounds and reaches 15 before wave 25, regardless of kills or leaks. Completed waves award 50 gold, or 200 for a boss. Gold lets you lower a draft defender by one rank and keep it.'},
  {target:'.header-actions [data-action="codex"]',title:'5. Craft champions',text:'The Grimoire lists champion recipes. Pin a recipe to keep its ingredients visible in the sidebar. Each champion needs the exact three ingredients shown; expand its tree to see how to build them.'},
  {target:'#wave-intelligence',title:'6. Read your army’s strengths',text:'Wave Preview compares the next wave’s threats with retained, active defenders. WEAK, FAIR, GOOD and STRONG describe available tools; positioning still matters. Open enemy details for exact statistics. Further ahead, intelligence is partial, and boss traits appear as the boss approaches.'},
  {target:'#map-start',fallback:'#battlefield',title:'7. Start the siege',text:'After choosing a keeper, Start wave appears above the center of the field. Click it or press Space. During battle, use Pause and 1× / 2× / 3× below the map. Survive the last wave or lose all keep health to see the leaderboard and save your score.'}
];

// A click-through tour: the highlighted controls remain usable throughout.
export class GuidedTutorial {
  constructor({onFinish=()=>{}}={}){
    this.onFinish=onFinish;this.index=0;this.active=false;
    this.layer=document.createElement('div');this.layer.className='tutorial-layer';this.layer.hidden=true;
    this.layer.innerHTML='<div class="tutorial-highlight" aria-hidden="true"></div><section class="tutorial-card" role="region" aria-label="Game tutorial"><div class="tutorial-progress"></div><h2></h2><p></p><nav aria-label="Tutorial steps"><button class="text-button" data-tour="skip">End tutorial</button><button class="text-button" data-tour="back">Back</button><button class="primary-button" data-tour="next">Next</button></nav></section>';
    document.body.append(this.layer);this.card=this.layer.querySelector('.tutorial-card');this.highlight=this.layer.querySelector('.tutorial-highlight');
    this.layer.addEventListener('click',e=>{const action=e.target.closest('[data-tour]')?.dataset.tour;if(action==='skip')this.finish();if(action==='back')this.show(this.index-1);if(action==='next')this.index===TUTORIAL_STEPS.length-1?this.finish():this.show(this.index+1);});
    this.reposition=()=>this.position();window.addEventListener('resize',this.reposition);window.addEventListener('scroll',this.reposition,true);
    this.key=e=>{if(this.active&&e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopImmediatePropagation();this.finish();}};window.addEventListener('keydown',this.key,true);
  }
  start(){this.active=true;this.layer.hidden=false;this.show(0);}
  show(index){this.index=Math.max(0,Math.min(TUTORIAL_STEPS.length-1,index));const step=TUTORIAL_STEPS[this.index];this.card.querySelector('h2').textContent=step.title;this.card.querySelector('p').textContent=step.text;this.card.querySelector('.tutorial-progress').textContent=`FIELD GUIDE · ${this.index+1} / ${TUTORIAL_STEPS.length}`;this.card.querySelector('[data-tour="back"]').disabled=this.index===0;this.card.querySelector('[data-tour="next"]').textContent=this.index===TUTORIAL_STEPS.length-1?'Play':'Next';this.position();}
  refresh(){if(this.active)this.position();}
  position(){
    if(!this.active)return;const step=TUTORIAL_STEPS[this.index];let target=document.querySelector(step.target);
    if(!target||!target.getClientRects().length)target=document.querySelector(step.fallback||'#battlefield');
    const rect=target?.getBoundingClientRect();if(!rect)return;
    Object.assign(this.highlight.style,{left:`${Math.max(2,rect.left-4)}px`,top:`${Math.max(2,rect.top-4)}px`,width:`${Math.min(innerWidth-8,rect.width+8)}px`,height:`${Math.min(innerHeight-8,rect.height+8)}px`});
    const width=Math.min(360,innerWidth-24),height=this.card.offsetHeight||230;
    let x=rect.right+16;if(x+width>innerWidth-12)x=Math.max(12,rect.left-width-16);if(rect.width>innerWidth*.6)x=24;
    const y=Math.max(12,Math.min(innerHeight-height-12,rect.height>innerHeight*.5?rect.top+100:rect.top-height-16));
    Object.assign(this.card.style,{left:`${Math.min(innerWidth-width-12,x)}px`,top:`${y}px`});
  }
  finish(){if(!this.active)return;this.active=false;this.layer.hidden=true;this.onFinish();}
}
