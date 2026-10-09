import test from 'node:test';
import assert from 'node:assert/strict';
import {connectResultLeaderboard,renderLeaderboard,resultScoreVersionMarkup} from '../ui/leaderboard.js';

// Only the DOM surface consumed by these functions. HTML writes deliberately fail.
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.matches=new Map();this.listeners=new Map();this.textContent='';}
  set innerHTML(value){throw new Error('Leaderboard content must be written as text');}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  querySelector(selector){return this.matches.get(selector)||null;}
  addEventListener(type,handler){this.listeners.set(type,handler);}
  async submit(){const event={prevented:false,preventDefault(){this.prevented=true;}};const handler=this.listeners.get('submit');assert.ok(handler,'Submit must be handled before the initial fetch completes');await handler(event);return event;}
}
function fixture(){
  const container=new Element(),form=new Element('form'),input=new Element('input'),button=new Element('button');
  const status=new Element('p'),message=new Element('p'),rows=new Element(),caption=new Element('p');
  form.matches.set('input',input);form.matches.set('button',button);form.matches.set('.score-status',message);
  container.matches.set('form',form);container.matches.set('.leaderboard-status',status);container.matches.set('.leaderboard-rows',rows);container.matches.set('.leaderboard-caption',caption);
  return {container,form,input,button,status,message,rows,caption};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const standings=(rank=null)=>({top:Array.from({length:10},(_,i)=>({id:`other-${i}`,rank:i+1,name:`Player ${i}`,score:1000-i,wavesSurvived:5})),current:rank?{id:'current',rank,name:'Kushek',score:500,wavesSurvived:3}:null});
const withDocument=async work=>{const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};try{await work();}finally{globalThis.document=previous;}};

test('saving before the initial leaderboard completes prevents navigation and a late response cannot erase the saved rank',async()=>withDocument(async()=>{
  const f=fixture(),initial=deferred();let submitted=0;
  const connection=connectResultLeaderboard(f.container,{leaderboard:()=>initial.promise,saveScore:async name=>{assert.equal(name,'Kushek');submitted++;return standings(15);}});
  f.input.value=' Kushek ';const event=await f.form.submit();
  assert.equal(event.prevented,true);assert.equal(submitted,1);assert.equal(f.status.textContent,'Your rank: 15.');
  assert.equal(f.button.disabled,true);assert.equal(f.input.disabled,true);
  initial.resolve(standings());await connection;
  assert.equal(f.status.textContent,'Your rank: 15.');assert.match(f.message.textContent,/ranked 15/);
  const table=f.rows.children[0],body=table.children[1];assert.equal(body.children.length,12);
  assert.equal(body.children.at(-1).className,'current-player');assert.equal(body.children.at(-1).children[0].textContent,'15');
}));

test('a pending score submission ignores duplicate submits and initial loading failures cannot overwrite success',async()=>withDocument(async()=>{
  const f=fixture(),initial=deferred(),saving=deferred();let submitted=0;
  const connection=connectResultLeaderboard(f.container,{leaderboard:()=>initial.promise,saveScore:()=>{submitted++;return saving.promise;}});
  f.input.value='Kushek';const first=f.form.submit();const duplicate=await f.form.submit();
  assert.equal(duplicate.prevented,true);assert.equal(submitted,1);assert.equal(f.button.disabled,true);
  saving.resolve(standings(2));await first;initial.reject(new Error('Slow leaderboard failed'));await connection;
  assert.equal(f.status.textContent,'Your rank: 2.');assert.match(f.message.textContent,/ranked 2/);
  const again=await f.form.submit();assert.equal(again.prevented,true);assert.equal(submitted,1);
}));

test('invalid HTML names never submit and failed saves leave the form usable with the initial ranking',async()=>withDocument(async()=>{
  const f=fixture();let submitted=0;
  await connectResultLeaderboard(f.container,{leaderboard:async()=>standings(),saveScore:async()=>{submitted++;throw new Error('Offline; retry');}});
  f.input.value='<script>';const invalid=await f.form.submit();assert.equal(invalid.prevented,true);assert.equal(submitted,0);
  assert.match(f.message.textContent,/Use 1–24/);assert.equal(f.button.disabled,false);
  f.input.value='Kushek';await f.form.submit();assert.equal(submitted,1);assert.equal(f.button.disabled,false);
  assert.equal(f.status.textContent,'Save your score to see your rank.');assert.equal(f.message.textContent,'Offline; retry');
  const unsafe=standings(20);unsafe.current.name='<img onerror=alert(1)>';renderLeaderboard(f.container,unsafe);
  assert.equal(f.rows.children[0].children[1].children.at(-1).children[1].textContent,'<img onerror=alert(1)>');
}));

test('the mixed-version Top 10 and out-of-top player show each original version as text with a five-column gap',async()=>withDocument(async()=>{
  const f=fixture(),result=standings(15);result.version='all';result.mode=10;result.top.forEach((row,index)=>row.version=index%2?'0.2.7':'0.3.24');result.current.version='0.3.22';
  renderLeaderboard(f.container,result);const table=f.rows.children[0],head=table.children[0].children[0],body=table.children[1];
  assert.deepEqual(head.children.map(cell=>cell.textContent),['Rank','Commander','Score','Waves','Version']);assert.equal(body.children[0].children[4].textContent,'0.3.24');assert.equal(body.children[1].children[4].textContent,'0.2.7');assert.equal(body.children.at(-1).children[4].textContent,'0.3.22');assert.equal(body.children.at(-2).children[0].colSpan,5);assert.match(f.caption.textContent,/All game versions · 10-wave campaign/);
  result.current.version='<svg onload=bad()>';renderLeaderboard(f.container,result);assert.equal(f.rows.children[0].children[1].children.at(-1).children[4].textContent,'<svg onload=bad()>');
}));

test('legacy service responses disclose their single-version scope and never assign unknown old scores to the current game',async()=>withDocument(async()=>{
  const f=fixture(),old=standings();old.version='0.2.7';old.olderService=true;renderLeaderboard(f.container,old);
  assert.equal(f.rows.children[0].children[1].children[0].children[4].textContent,'0.2.7');assert.match(f.caption.textContent,/only this game version/);assert.match(f.caption.textContent,/Earlier scores remain stored/);
  delete old.version;renderLeaderboard(f.container,old);assert.equal(f.rows.children[0].children[1].children[0].children[4].textContent,'Not recorded');
}));

test('the sixth result tile identifies the played version and the actual known or unknown best-score origin',()=>{
  const known=resultScoreVersionMarkup({bestScore:500,bestScores:[{score:500,version:'0.3.22'}]},{version:'0.3.24'});assert.match(known,/<strong>0\.3\.24<\/strong><small>Game version<\/small>/);assert.match(known,/Best score version: 0\.3\.22/);
  const historical=resultScoreVersionMarkup({bestScore:600,bestScores:[{score:600,version:null}]},{version:'0.3.24'});assert.match(historical,/Best score version: Version not recorded/);assert.doesNotMatch(historical,/Best score version: 0\.3\.24/);
  assert.doesNotMatch(resultScoreVersionMarkup({bestScore:0},{version:'<svg onload=bad()>'}),/<svg/);
});
