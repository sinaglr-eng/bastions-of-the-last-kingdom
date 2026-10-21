export const TUTORIAL_STEPS=[
  {id:'camera',target:'#battlefield',title:'Look around the battlefield',text:'Mouse: use WASD or the arrow keys to pan, Q / E to rotate, and the wheel to zoom. Touch / iPad: drag one finger to pan; pinch to zoom; drag two fingers to rotate. Tap an empty tile to build. You can end this guide at any time.'},
  {id:'place',target:'#draft',fallback:'#battlefield',title:'Place five recruits',text:'Tap or click five empty grid tiles. Each successful placement reveals a defender in the cards below. Keep the route through all five checkpoints open; an invalid placement spends nothing.',wait:'Place recruits on the map'},
  {id:'keeper',target:'#folio-actions',fallback:'#draft',title:'Choose your keeper',text:'Select a revealed recruit, then press Keep. You can also double-click or double-tap its card or figure. If a legal Merge or Create champion action is available, that also completes your choice. The other recruits become castle walls.',wait:'Choose a keeper, merge or champion'},
  {id:'recipes',target:'.header-actions [data-action="codex"]',title:'Plan a champion',text:'Open Recipes to inspect exact ingredients, ranks and abilities. Pin a recipe to keep its plan beside the battlefield. Looking and pinning spend nothing. Close the book to return here, then choose Next.'},
  {id:'waves',target:'.header-actions [data-action="warbands"]',fallback:'#next-wave-summary',title:'Read the approaching wave',text:'Enemy Waves shows enemy health, defenses and abilities. The map panel shows Next wave while building and Current wave during combat. Open either to inspect the threat. Close the atlas to return here, then choose Next.'},
  {id:'start',target:'#map-start',fallback:'#battlefield',title:'Start a wave',text:'Your defense is ready. Press Start wave above the battlefield, or press Space when a text field or button is not focused. You can remove castle walls between waves with Delete / Backspace. Retained defenders stay.',wait:'Press Start wave'},
  {id:'pause',target:'#header-combat-controls [data-action="pause"]',fallback:'#command-dock',title:'Try Pause',text:'Press Pause above the battlefield, or press Space while the battlefield has focus. Pause stops combat so you can inspect the field. Opening a book also pauses combat temporarily and restores the previous pause state when it closes.',wait:'Pause combat'},
  {id:'speed',target:'#header-combat-controls [data-action="speed"]',fallback:'#command-dock',title:'Choose the game speed',text:'Press the speed button once. It always cycles 1× → 2× → 3× → 5× → 1×. You can change it while paused. Resume continues the same battle; speed does not change the real elapsed-time clock.',wait:'Change the speed once'},
  {id:'finish',target:'#header-combat-controls',fallback:'#battlefield',title:'You have the command',text:'Use Resume if combat is paused. Each surviving wave brings five new recruits. At the end of a run, enter your name above the Top 10 to save your score. You can replay this guide from Game menu → How to play.'}
];

// The invitation belongs to a run, not a saved preference. A previous Skip or
// completed guide never suppresses the next ordinary run's explicit choice.
export class TutorialInvitation{
  constructor(){this.game=null;this.pending=false;}
  offer(game,{replacement=false}={}){
    if(!game||this.game===game)return false;
    this.game=game;this.pending=!replacement&&!game.developerMode;return this.pending;
  }
  decide(choice){
    if(!this.pending||!['accepted','skipped'].includes(choice))return false;
    this.pending=false;return true;
  }
}

export function tutorialInvitationMarkup(){
  return '<section class="tutorial-welcome" data-tutorial-choice aria-labelledby="tutorial-welcome-title"><div class="eyebrow">Welcome, commander</div><h2 id="tutorial-welcome-title">Learn to hold the valley?</h2><p>A short guide follows your real actions: place five recruits, choose a keeper, start a wave, then try Pause and Speed.</p><p>You can end the guide at any time and replay it from How to play. Your choice applies to this run.</p><div class="tutorial-welcome-actions"><button type="button" class="primary-button" data-action="tutorial-start" autofocus>Start tutorial</button><button type="button" class="text-button" data-action="tutorial-skip">Skip tutorial</button></div></section>';
}

export function tutorialFocusTarget(documentRef=document){
  return [...documentRef.querySelectorAll('#header-combat-controls button,#map-start button,#draft button,.player-menu > summary')].find(control=>!control.disabled&&control.getClientRects().length&&!control.closest('[hidden],[inert]'))||null;
}

const ended=game=>game?.phase==='won'||game?.phase==='lost';
const placed=game=>game?.draft?.draws?.filter(draw=>draw.placed).length||0;
export function tutorialStepComplete(step,game,{round=1,speed=1}={}){
  if(!game)return false;
  const later=game.round>round;
  if(step==='place')return later||placed(game)>=5||['select','ready','combat'].includes(game.phase);
  if(step==='keeper')return later||['ready','combat'].includes(game.phase);
  if(step==='start')return later||game.phase==='combat';
  if(step==='pause')return later||game.phase==='combat'&&game.paused===true;
  if(step==='speed')return later||game.phase==='combat'&&game.speed!==speed;
  return false;
}

// Nonmodal coaching observes ordinary actions only. It never places a recruit,
// chooses an outcome, consumes RNG, sets a transport value or changes a clock.
export class GuidedTutorial{
  constructor({onFinish=()=>{},focusReturn=()=>null,onInteract=()=>{}}={}){
    this.onFinish=onFinish;this.focusReturn=focusReturn;this.index=0;this.active=false;this.game=null;
    this.layer=document.createElement('div');this.layer.className='tutorial-layer';this.layer.hidden=true;
    this.layer.innerHTML='<div class="tutorial-highlight" aria-hidden="true"></div><section class="tutorial-card" role="region" aria-labelledby="tutorial-step-title" tabindex="-1"><div class="tutorial-progress" aria-live="polite"></div><h2 id="tutorial-step-title"></h2><details class="tutorial-instructions" open><summary>Show instructions</summary><p class="tutorial-copy"></p></details><p class="tutorial-task" role="status" aria-live="polite"></p><nav aria-label="Tutorial steps"><button type="button" class="text-button" data-tour="skip">End tutorial</button><button type="button" class="primary-button" data-tour="next">Next</button></nav></section>';
    document.body.append(this.layer);this.card=this.layer.querySelector('.tutorial-card');this.highlight=this.layer.querySelector('.tutorial-highlight');
    this.next=this.card.querySelector('[data-tour="next"]');
    this.instructions=this.card.querySelector('.tutorial-instructions');this.instructions.addEventListener('toggle',()=>this.position());
    this.card.addEventListener('pointerenter',onInteract);this.card.addEventListener('focusin',onInteract);
    this.layer.addEventListener('click',event=>{
      const button=event.target.closest('[data-tour]');if(!button||button.disabled||!this.active)return;
      if(button.dataset.tour==='skip')this.finish();
      if(button.dataset.tour==='next'&&!TUTORIAL_STEPS[this.index].wait){
        if(this.index===TUTORIAL_STEPS.length-1)this.finish({reason:'complete'});
        else this.show(this.index+1);
      }
    });
    this.reposition=()=>this.position();window.addEventListener('resize',this.reposition);window.addEventListener('scroll',this.reposition,true);
    window.visualViewport?.addEventListener?.('resize',this.reposition);window.visualViewport?.addEventListener?.('scroll',this.reposition);
    this.key=event=>{
      if(this.active&&event.key==='Escape'&&!document.querySelector('dialog[open]')){
        event.preventDefault();event.stopImmediatePropagation();this.finish();
      }
    };window.addEventListener('keydown',this.key,true);
  }
  start(game){
    this.finish({reason:'reset',restoreFocus:false});
    if(!game||ended(game))return false;
    this.game=game;this.round=game.round;this.active=true;this.layer.hidden=false;
    this.returnFocus=document.activeElement;this.show(0);this.card.focus({preventScroll:true});return true;
  }
  show(index){
    this.index=Math.max(0,Math.min(TUTORIAL_STEPS.length-1,index));this.speedAtStep=this.game?.speed;
    this.refresh();
  }
  refresh(game=this.game){
    if(!this.active)return;
    if(game!==this.game||ended(game)){this.finish({reason:'reset',restoreFocus:false});return;}
    // A book's temporary modal pause is not the player's Pause tutorial action.
    this.layer.hidden=!!document.querySelector('dialog[open]');if(this.layer.hidden)return;
    let step=TUTORIAL_STEPS[this.index];
    while(step.wait&&tutorialStepComplete(step.id,game,{round:this.round,speed:this.speedAtStep})){
      this.index++;step=TUTORIAL_STEPS[this.index];this.speedAtStep=game.speed;
    }
    this.card.querySelector('h2').textContent=step.title;this.card.querySelector('.tutorial-copy').textContent=step.text;
    this.card.querySelector('.tutorial-progress').textContent=`FIELD GUIDE · ${this.index+1} / ${TUTORIAL_STEPS.length}`;
    const task=step.id==='place'?`${Math.min(5,placed(game))} / 5 recruits placed`:step.wait||'';
    this.card.querySelector('.tutorial-task').textContent=task;
    const nextFocused=document.activeElement===this.next;
    this.next.disabled=!!step.wait;this.next.hidden=!!step.wait;this.next.textContent=step.id==='finish'?'Finish tutorial':'Next';
    if(this.next.disabled&&nextFocused)this.card.focus({preventScroll:true});
    this.position();
  }
  position(){
    if(!this.active||this.layer.hidden)return;const step=TUTORIAL_STEPS[this.index];let target=document.querySelector(step.target);
    if(!target||!target.getClientRects().length)target=document.querySelector(step.fallback||'#battlefield');
    const rect=target?.getBoundingClientRect();if(!rect)return;
    const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
    const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,right=left+width,bottom=top+height,gap=12;
    const compact=width<=750||height<=500,layout=String(compact),stepKey=String(this.index);
    if(this.card.dataset.compact!==layout||this.card.dataset.step!==stepKey){this.instructions.open=!compact;this.card.dataset.compact=layout;this.card.dataset.step=stepKey;this.card.scrollTop=0;}
    const x1=Math.max(left+2,rect.left-4),y1=Math.max(top+2,rect.top-4),x2=Math.min(right-2,rect.right+4),y2=Math.min(bottom-2,rect.bottom+4);
    this.highlight.hidden=x2<=x1||y2<=y1;
    Object.assign(this.highlight.style,{left:`${x1}px`,top:`${y1}px`,width:`${Math.max(0,x2-x1)}px`,height:`${Math.max(0,y2-y1)}px`});
    // Put the compact card outside the highlighted control whenever possible.
    // On short screens it can scroll internally instead of covering its actions.
    const cardWidth=Math.min(350,width-2*gap);this.card.style.width=`${cardWidth}px`;this.card.style.maxHeight=`${height-2*gap}px`;
    if(compact){
      const mapTarget=document.querySelector('#battlefield'),map=mapTarget?.getBoundingClientRect(),folio=document.querySelector('#preparation-folio'),folioRect=folio?.getClientRects().length?folio.getBoundingClientRect():null;
      const mapTop=Math.max(top,map?.top||top),mapBottom=Math.min(bottom,map?.bottom||bottom,folioRect?.top>mapTop?folioRect.top:bottom);
      // Coach above the usable grid, rather than filling the only exposed map
      // strip between the header and the mobile recruit folio. Actual transport
      // controls remain above their coaching card and can always be pressed.
      const transport=target!==mapTarget&&['start','pause','speed','finish'].includes(step.id),y=Math.max(top+gap,mapTop+gap,transport?rect.bottom+gap:0);
      const maxHeight=Math.max(112,Math.min(190,(mapBottom-y-gap)*.6,height-2*gap));
      Object.assign(this.card.style,{left:`${Math.max(left+gap,right-cardWidth-gap)}px`,top:`${Math.min(bottom-maxHeight-gap,y)}px`,maxHeight:`${maxHeight}px`});
      return;
    }
    const cardHeight=Math.min(this.card.offsetHeight||270,height-2*gap);
    let x=Math.max(left+gap,Math.min(right-cardWidth-gap,rect.left));
    let y=rect.top-cardHeight-gap,maxHeight=height-2*gap;
    if(y<top+gap)y=rect.bottom+gap;
    if(y+cardHeight>bottom-gap){
      const side=rect.right+gap+cardWidth<=right-gap?rect.right+gap:rect.left-gap-cardWidth;
      if(side>=left+gap&&side+cardWidth<=right-gap){x=side;y=top+gap;}
      else{
        const above=rect.top-top-2*gap,below=bottom-rect.bottom-2*gap;
        if(Math.max(above,below)>=140){maxHeight=Math.max(above,below);y=above>=below?top+gap:rect.bottom+gap;}
        else y=Math.max(top+gap,Math.min(bottom-cardHeight-gap,step.id==='camera'?top+76:rect.top-cardHeight-gap));
      }
    }
    Object.assign(this.card.style,{left:`${x}px`,top:`${y}px`,maxHeight:`${maxHeight}px`});
  }
  finish({reason='skipped',restoreFocus=true}={}){
    if(!this.active)return false;const focused=this.card.contains(document.activeElement);
    this.active=false;this.layer.hidden=true;this.game=null;
    if(restoreFocus&&focused){
      const previous=this.returnFocus,visible=previous?.isConnected&&previous.getClientRects?.().length&&!previous.closest?.('dialog:not([open])');
      (visible?previous:this.focusReturn())?.focus({preventScroll:true});
    }
    this.onFinish({reason,completed:reason==='complete'});return true;
  }
}
