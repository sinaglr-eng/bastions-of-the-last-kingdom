import test from 'node:test';
import assert from 'node:assert/strict';
import {connectResultLeaderboard,renderLeaderboard,resultScoreVersionMarkup,resultLeaderboardMarkup} from '../ui/leaderboard.js';

import {GAME_VERSION} from '../game/release.js';

// Only the DOM surface consumed by these functions. HTML writes deliberately fail.
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.matches=new Map();this.listeners=new Map();this.textContent='';this.dataset={};this.attributes=new Map();}
  set innerHTML(value){throw new Error('Leaderboard content must be written as text');}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  focus(){document.activeElement=this;}
  async click(){return this.listeners.get('click')?.();}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  querySelector(selector){return this.matches.get(selector)||null;}
  addEventListener(type,handler){this.listeners.set(type,handler);}
  async submit(){const event={prevented:false,preventDefault(){this.prevented=true;}};const handler=this.listeners.get('submit');assert.ok(handler,'Submit must be handled before the initial fetch completes');await handler(event);return event;}
}
function fixture(){
  const container=new Element(),form=new Element('form'),input=new Element('input'),button=new Element('button');
  const status=new Element('p'),message=new Element('p'),rows=new Element(),caption=new Element('p'),tabs=new Element('nav');
  form.matches.set('input',input);form.matches.set('button',button);form.matches.set('.score-status',message);
  container.matches.set('form',form);container.matches.set('.leaderboard-status',status);container.matches.set('.leaderboard-rows',rows);container.matches.set('.leaderboard-caption',caption);container.matches.set('.leaderboard-versions',tabs);
  return {container,form,input,button,status,message,rows,caption,tabs};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const standings=(rank=null,version=GAME_VERSION)=>({version,mode:50,versions:[version,'0.2.7'],top:Array.from({length:10},(_,i)=>({id:`other-${i}`,version,rank:i+1,name:`Player ${i}`,score:1000-i,wavesSurvived:5})),current:rank?{id:'current',version,rank,name:'Kushek',score:500,wavesSurvived:3}:null});
const withDocument=async work=>{const previous=globalThis.document;globalThis.document={activeElement:null,createElement:tag=>new Element(tag)};try{await work();}finally{globalThis.document=previous;}};

test('saving before the initial leaderboard completes prevents navigation and a late response cannot erase the saved rank',async()=>withDocument(async()=>{
  const f=fixture(),initial=deferred();let submitted=0;
  const connection=connectResultLeaderboard(f.container,{leaderboard:()=>initial.promise,saveScore:async name=>{assert.equal(name,'Kushek');submitted++;return standings(15);}});
  f.input.value=' Kushek ';const event=await f.form.submit();
  assert.equal(event.prevented,true);assert.equal(submitted,1);assert.equal(f.status.textContent,`Your rank in ${GAME_VERSION}: 15.`);
  assert.equal(f.button.disabled,true);assert.equal(f.input.disabled,true);
  initial.resolve(standings());await connection;
  assert.equal(f.status.textContent,`Your rank in ${GAME_VERSION}: 15.`);assert.match(f.message.textContent,/rank.*15/);
  const table=f.rows.children[0],body=table.children[1];assert.equal(body.children.length,12);
  assert.equal(body.children.at(-1).className,'current-player');assert.equal(body.children.at(-1).children[0].textContent,'15');
}));

test('a pending score submission ignores duplicate submits and initial loading failures cannot overwrite success',async()=>withDocument(async()=>{
  const f=fixture(),initial=deferred(),saving=deferred();let submitted=0;
  const connection=connectResultLeaderboard(f.container,{leaderboard:()=>initial.promise,saveScore:()=>{submitted++;return saving.promise;}});
  f.input.value='Kushek';const first=f.form.submit();const duplicate=await f.form.submit();
  assert.equal(duplicate.prevented,true);assert.equal(submitted,1);assert.equal(f.button.disabled,true);
  saving.resolve(standings(2));await first;initial.reject(new Error('Slow leaderboard failed'));await connection;
  assert.equal(f.status.textContent,`Your rank in ${GAME_VERSION}: 2.`);assert.match(f.message.textContent,/rank.*2/);
  const again=await f.form.submit();assert.equal(again.prevented,true);assert.equal(submitted,1);
}));

test('invalid HTML names never submit and failed saves leave the form usable with the initial ranking',async()=>withDocument(async()=>{
  const f=fixture();let submitted=0;
  await connectResultLeaderboard(f.container,{leaderboard:async()=>standings(),saveScore:async()=>{submitted++;throw new Error('Offline; retry');}});
  f.input.value='<script>';const invalid=await f.form.submit();assert.equal(invalid.prevented,true);assert.equal(submitted,0);
  assert.match(f.message.textContent,/Use 1–24/);assert.equal(f.button.disabled,false);
  f.input.value='Kushek';await f.form.submit();assert.equal(submitted,1);assert.equal(f.button.disabled,false);
  assert.equal(f.status.textContent,`No saved score for this run in version ${GAME_VERSION}.`);assert.equal(f.message.textContent,'Offline; retry');
  const unsafe=standings(20);unsafe.current.name='<img onerror=alert(1)>';renderLeaderboard(f.container,unsafe);
  assert.equal(f.rows.children[0].children[1].children.at(-1).children[1].textContent,'<img onerror=alert(1)>');
}));

test('single-version Top 10 and out-of-top player retain original edition and a five-column gap; mixed responses cannot render',async()=>withDocument(async()=>{
  const f=fixture(),result=standings(15,'0.3.24');renderLeaderboard(f.container,result);const table=f.rows.children[0],head=table.children[0].children[0],body=table.children[1];
  assert.deepEqual(head.children.map(cell=>cell.textContent),['Rank','Commander','Score','Waves','Version']);assert.ok(body.children.filter(row=>row.children.length===5).every(row=>row.children[4].textContent==='0.3.24'));assert.equal(body.children.at(-2).children[0].colSpan,5);assert.match(f.caption.textContent,/Version 0.3.24 · 50-wave campaign/);
  const before=f.rows.children[0];result.top[0].version='0.2.7';assert.throws(()=>renderLeaderboard(f.container,result),/could not be verified/);assert.equal(f.rows.children[0],before);
  result.version='all';assert.throws(()=>renderLeaderboard(f.container,result),/could not be verified/);result.version='<svg onload=bad()>';assert.throws(()=>renderLeaderboard(f.container,result),/could not be verified/);
}));

test('older single-version services can omit redundant row versions, while an unknown response edition is never assigned to the current game',async()=>withDocument(async()=>{
  const f=fixture(),old=standings(null,'0.2.7');for(const row of old.top)delete row.version;renderLeaderboard(f.container,old);
  assert.equal(f.rows.children[0].children[1].children[0].children[4].textContent,'0.2.7');assert.match(f.caption.textContent,/Scores from earlier versions remain stored/);
  delete old.version;assert.throws(()=>renderLeaderboard(f.container,old),/could not be verified/);
}));

test('the name form precedes Top 10 and current-version navigation has no mixed-version view',()=>{
  const html=resultLeaderboardMarkup();assert.ok(html.indexOf('class="score-form"')<html.indexOf('<h3>Top 10 commanders</h3>'));assert.match(html,new RegExp(`aria-pressed="true" data-score-version="${GAME_VERSION.replaceAll('.','\\.')}`));assert.match(html,/aria-label="Score versions"/);assert.doesNotMatch(html,/All game versions|data-score-version="all"/);
});

test('version subtabs default to this run, load exact historical ranks, and reject stale cross-tab responses',async()=>withDocument(async()=>{
  const f=fixture(),old=deferred(),calls=[];const client={tracker:{version:GAME_VERSION},leaderboard:async version=>{calls.push(version);return version==='0.2.7'?old.promise:standings(3,version);},saveScore:async()=>standings(3)};
  await connectResultLeaderboard(f.container,client);assert.deepEqual(calls,[GAME_VERSION]);assert.equal(f.tabs.children.find(tab=>tab.textContent===GAME_VERSION).getAttribute('aria-pressed'),'true');
  const oldTab=f.tabs.children.find(tab=>tab.textContent==='0.2.7');oldTab.focus();const waiting=oldTab.click();assert.equal(document.activeElement.dataset.scoreVersion,'0.2.7');assert.equal(f.rows.children.length,0);assert.match(f.status.textContent,/Loading version 0.2.7/);
  const currentTab=f.tabs.children.find(tab=>tab.textContent===GAME_VERSION);currentTab.focus();await currentTab.click();assert.equal(document.activeElement.dataset.scoreVersion,GAME_VERSION);assert.match(f.status.textContent,new RegExp(`Your rank in ${GAME_VERSION}: 3`));old.resolve(standings(12,'0.2.7'));await waiting;
  assert.match(f.status.textContent,new RegExp(`Your rank in ${GAME_VERSION}: 3`));assert.ok(f.rows.children[0].children[1].children.filter(row=>row.children.length===5).every(row=>row.children[4].textContent===GAME_VERSION));
}));

test('saving while browsing an older version returns the saved run to its own version, and historical tabs remain usable',async()=>withDocument(async()=>{
  const f=fixture(),calls=[];const client={tracker:{version:GAME_VERSION},leaderboard:async version=>{calls.push(version);return standings(version==='0.2.7'?14:2,version);},saveScore:async()=>standings(2)};
  await connectResultLeaderboard(f.container,client);await f.tabs.children.find(tab=>tab.textContent==='0.2.7').click();assert.equal(f.status.textContent,'Your rank in 0.2.7: 14.');f.input.value='Kushek';await f.form.submit();assert.equal(f.status.textContent,`Your rank in ${GAME_VERSION}: 2.`);assert.equal(f.input.disabled,true);
  await f.tabs.children.find(tab=>tab.textContent==='0.2.7').click();assert.equal(f.status.textContent,'Your rank in 0.2.7: 14.');assert.equal(f.button.textContent,'Saved');assert.deepEqual(calls,[GAME_VERSION,'0.2.7','0.2.7']);
}));

test('version navigation sorts numeric editions and never offers an all-version or untrusted label',async()=>withDocument(async()=>{
  const f=fixture(),result=standings();result.versions=['0.9.9','0.10.1','all','<img src=x>',GAME_VERSION,'0.2.7','0.2.7'];
  await connectResultLeaderboard(f.container,{leaderboard:async()=>result,saveScore:async()=>standings(1)});
  const names=f.tabs.children.map(tab=>tab.textContent);assert.deepEqual(names,['0.10.1','0.9.9',GAME_VERSION,'0.2.7']);assert.equal(f.tabs.children.filter(tab=>tab.getAttribute('aria-pressed')==='true').length,1);assert.equal(f.tabs.children.find(tab=>tab.getAttribute('aria-pressed')==='true').textContent,GAME_VERSION);
}));

test('the sixth result tile identifies the played version and the actual known or unknown best-score origin',()=>{
  const known=resultScoreVersionMarkup({bestScore:500,bestScores:[{score:500,version:'0.3.22'}]},{version:'0.3.24'});assert.match(known,/<strong>0\.3\.24<\/strong><small>Game version<\/small>/);assert.match(known,/Best score version: 0\.3\.22/);
  const historical=resultScoreVersionMarkup({bestScore:600,bestScores:[{score:600,version:null}]},{version:'0.3.24'});assert.match(historical,/Best score version: Version not recorded/);assert.doesNotMatch(historical,/Best score version: 0\.3\.24/);
  assert.doesNotMatch(resultScoreVersionMarkup({bestScore:0},{version:'<svg onload=bad()>'}),/<svg/);
});
