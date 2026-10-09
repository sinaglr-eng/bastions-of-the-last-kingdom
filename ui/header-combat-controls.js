import {icon} from './icons.js';

// Header buttons stay mounted through inspection, hit and modal updates.
export function updateHeaderCombatControls(host,game){
  if(!host.querySelector('[data-action="pause"]'))host.innerHTML=`<button type="button" class="text-button" data-action="pause" aria-label="Pause game"><span class="header-pause-icon">${icon('pause')}</span><span class="header-pause-label">Pause</span></button><button type="button" class="text-button gold" data-action="speed" aria-label="Game speed 1×">1×</button>`;
  host.hidden=game.phase!=='combat';
  const pause=host.querySelector('[data-action="pause"]'),speed=host.querySelector('[data-action="speed"]'),label=game.paused?'Resume':'Pause';
  if(pause.getAttribute('aria-label')!==`${label} game`){pause.setAttribute('aria-label',`${label} game`);pause.querySelector('.header-pause-label').textContent=label;pause.querySelector('.header-pause-icon').innerHTML=icon(game.paused?'play':'pause');}
  pause.setAttribute('aria-pressed',String(!!game.paused));pause.title=`${label} game · Space`;
  const rate=`${game.speed}×`;if(speed.textContent!==rate)speed.textContent=rate;speed.setAttribute('aria-label',`Game speed ${rate}`);speed.title=`${rate} game speed · click to change`;
  pause.disabled=host.hidden;speed.disabled=host.hidden;
}
