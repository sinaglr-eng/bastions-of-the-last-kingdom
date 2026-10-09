import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {defenderCode} from '../game/core/unit-label.js';
import {defenderPortrait} from '../game/release.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {masteryPanelMarkup} from '../ui/mastery-panel.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {icon} from '../ui/icons.js';
import {drawnTower,drawKeeperKey,keepDrawKeeper,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const basics=Object.keys(data.towers).filter(family=>!data.towers[family].advanced);
const images=Object.fromEntries(Object.entries(data.towers).flatMap(([family,stats])=>[
  [family,`wrong-family-only-fallback-${family}.png`],
  ...Array.from({length:stats.advanced?1:6},(_,index)=>[`${family}:${index+1}`,defenderPortrait(family,index+1)]),
]));
images.ruin='data:image/png;base64,approved-wall';
const sources=html=>[...html.matchAll(/<img src="([^"]*)"/g)].map(match=>match[1]);
const state=game=>JSON.stringify({draws:game.draft.draws,towers:game.towers,selected:game.selected,activeDraw:game.activeDraw,phase:game.phase,cp:game.commandPoints.value,mastery:game.economy.mastery,occupied:[...game.grid.occupied]});
function placed(family='soldier',tier=2){
  const game=new Game(data,{seed:42});game.draft.forced={family,tier};game.draft.roll(game.economy.mastery);
  for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  return game;
}
function assertSiblingButtons(html){
  let open=false;
  for(const match of html.matchAll(/<button\b[^>]*>|<\/button>/g)){
    if(match[0].startsWith('</')){assert.equal(open,true);open=false;}
    else{assert.equal(open,false,'Card, Keep and Merge must be separate native controls');open=true;}
  }
  assert.equal(open,false);
}

test('all eight basic families retain the exact approved portrait for each of their six ranks',()=>{
  assert.equal(basics.length,8);
  for(const family of basics)for(let tier=1;tier<=6;tier++){
    const game=placed(family,tier);game.select(drawnTower(game,0).id);
    game.draft.rng=()=>{throw new Error('Presentation must not consume draft RNG');};
    const before=state(game),html=draftCardsMarkup(game,data,images),url=defenderPortrait(family,tier);
    assert.deepEqual(sources(html),Array(5).fill(url),`${family} ${tier}: family-only fallback cannot replace the actual rank`);
    assert.ok(existsSync(new URL(`../public/assets/geometric/portraits/${family}-${tier}.png`,import.meta.url)));
    assert.ok(html.includes(`<span class="tier-pips">${defenderCode(data.towers[family],tier)}</span>`));
    assert.equal((html.match(/class="draw-name"/g)||[]).length,5);
    assert.equal((html.match(/class="index">0[1-5]</g)||[]).length,5);
    assert.equal(state(game),before,'Large portrait presentation is read-only');
  }
});

test('rendering the odds and five mystery cards never reveals latent defender identities or consumes RNG',()=>{
  const game=new Game(data,{seed:1});
  game.draft.rng=()=>{throw new Error('Rendering must leave the random placement reveal untouched');};
  const before=state(game);
  for(let pass=0;pass<4;pass++){
    const html=draftCardsMarkup(game,data,images)+masteryPanelMarkup(game.economy,data.balance);
    assert.equal((html.match(/Unrevealed defender\. Build/g)||[]).length,5);
    assert.equal((html.match(/class="draw-slot/g)||[]).length,5);
    assert.doesNotMatch(html,/<img|data-action="keep-draw"|data-action="merge-tower"|Construction mastery|mastery-heading/);
  }
  assert.equal(state(game),before);
});

test('separate Keep and Merge buttons address the selected candidate with current validation tokens',()=>{
  for(const action of ['keep','merge']){
    const game=placed(),tower=drawnTower(game,0);game.select(tower.id);
    const html=draftCardsMarkup(game,data,images);assertSiblingButtons(html);
    const keep=html.match(/<button\b[^>]*data-action="keep-draw"[^>]*>/)?.[0];
    const merge=[...html.matchAll(/<button\b[^>]*data-action="merge-tower"[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes(`data-tower-id="${tower.id}"`));
    assert.ok(keep);assert.ok(merge);
    assert.ok(keep.includes(`data-keeper-key="${drawKeeperKey(game,0)}"`));
    assert.ok(merge.includes(`data-merge-key="${mergeTowerKey(game,tower.id)}"`));
    assert.ok(keep.includes(`aria-label="Keep ${data.towers.soldier.name}"`));
    assert.match(merge,/type="button".*aria-label="Merge .* rank III here"/);
    assert.equal(action==='keep'?keepDrawKeeper(game,0,tower.id,drawKeeperKey(game,0)):mergeTowerFromBadge(game,tower.id,mergeTowerKey(game,tower.id)),true);
    assert.equal(game.phase,'ready');assert.equal(tower.state,'active');assert.equal(tower.tier,action==='keep'?2:3);
    assert.doesNotMatch(draftCardsMarkup(game,data,images),/data-action="keep-draw"|data-action="merge-tower"/);
  }
});

test('pending and returning reserve keep their exact rank portrait, fixed position and five-slot boundary',()=>{
  const game=placed('frostwarden',6),reserved=drawnTower(game,0),position=[reserved.x,reserved.z];
  game.select(reserved.id);assert.equal(game.reserve(),true);
  let before=state(game),html=draftCardsMarkup(game,data,images);
  assert.equal((html.match(/class="draw-slot/g)||[]).length,5);
  assert.deepEqual(sources(html),Array(5).fill(defenderPortrait('frostwarden',6)));
  assert.match(html,/reserved-pending[^>]*disabled/);assert.match(html,/Reserved for next draft/);assert.match(html,/Inactive · blocks path/);
  assert.doesNotMatch(html,/data-action="keep-draw" data-index="0"/);assert.equal(state(game),before);
  game.select(drawnTower(game,1).id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);game.completeWave();
  before=state(game);html=draftCardsMarkup(game,data,images);
  assert.deepEqual(sources(html),[defenderPortrait('frostwarden',6)]);
  assert.equal((html.match(/Unrevealed defender\. Build/g)||[]).length,4);
  assert.match(html,/Reserved from previous draft/);assert.match(html,/Fixed position/);
  assert.equal(game.towers.find(tower=>tower.id===reserved.id),reserved);assert.deepEqual([reserved.x,reserved.z],position);
  assert.equal(state(game),before);
});

test('a committed champion and discarded castle walls retain their existing separate portrait ownership',()=>{
  const family=Object.keys(data.towers).find(key=>data.towers[key].advanced),game=placed(family,1),tower=drawnTower(game,0);
  game.select(tower.id);assert.equal(game.keep(),true);
  const before=state(game),html=draftCardsMarkup(game,data,images);
  assert.deepEqual(sources(html),[defenderPortrait(family,1),...Array(4).fill(images.ruin)]);
  assert.doesNotMatch(html,/wrong-family-only-fallback/);assert.equal(state(game),before);
});

test('production draft refresh retains local horizontal scroll and reveals a newly selected card without moving the page or using RNG',()=>{
  const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),start=source.indexOf('function renderDraft('),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start);
  const game=new Game(data,{seed:137}),control=new Game(data,{seed:137}),host={dataset:{},writes:0};let strip;
  const createStrip=()=>{
    let left=0;return {get scrollLeft(){return left;},set scrollLeft(value){left=Math.max(0,Math.min(130,value));},getBoundingClientRect:()=>({left:10,right:380}),querySelector(selector){
      const index=Number(selector.match(/data-index="(\d+)"/)?.[1]);return Number.isInteger(index)?{closest:()=>({getBoundingClientRect:()=>({left:10+index*101-left,right:106+index*101-left})})}:null;
    }};
  };
  Object.defineProperty(host,'innerHTML',{get:()=>host.markup||'',set:markup=>{host.writes++;host.markup=markup;strip=createStrip();}});host.querySelector=selector=>selector==='.draws'?strip:null;
  const render=new Function('game','$','icon','commandPointsMarkup','data','images','draftCardsMarkup',source.slice(start,end)+';return renderDraft;')(game,()=>host,icon,commandPointsMarkup,data,images,draftCardsMarkup);
  const before=state(game);render();assert.equal(strip.scrollLeft,0);strip.scrollLeft=113;
  for(let pass=0;pass<20;pass++){render();assert.equal(strip.scrollLeft,113);assert.equal((host.innerHTML.match(/class="draw-slot/g)||[]).length,5);assert.doesNotMatch(host.innerHTML,/<img/);}
  assert.equal(state(game),before);assert.equal(game.rng(),control.rng());
  game.activeDraw=4;render();assert.equal(strip.scrollLeft,130,'Newly chosen last slot is exposed within the local strip');
  game.activeDraw=0;render();assert.equal(strip.scrollLeft,0,'Choosing the first slot exposes it without page scrolling');
});
