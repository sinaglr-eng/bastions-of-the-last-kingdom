import {achievementById} from './war-table-view.js';
import {achievementArtwork,medalAmount,escapeProgression as esc} from './progression-art.js';

export class AchievementNotices{
 constructor({player,onView=()=>{}}){
  this.player=player;this.onView=onView;this.queue=[];this.seen=new Set();this.current=null;this.timer=null;this.remaining=8000;
  this.root=document.createElement('aside');this.root.className='achievement-notices';this.root.setAttribute('aria-label','Achievement notifications');document.body.append(this.root);
  this.root.addEventListener('pointerenter',()=>{this.hovered=true;this.pause();});this.root.addEventListener('pointerleave',()=>{this.hovered=false;if(!this.root.contains(document.activeElement))this.resume();});
  this.root.addEventListener('focusin',()=>this.pause());this.root.addEventListener('focusout',()=>queueMicrotask(()=>{if(!this.root.contains(document.activeElement))this.resume();}));
  this.root.addEventListener('click',e=>void this.click(e));
 }
 push(event){
  if(!this.player.user)return;
  if(this.owner!==this.player.user.id){clearTimeout(this.timer);this.timer=null;this.owner=this.player.user.id;this.queue=[];this.current=null;this.root.innerHTML='';this.seen=new Set();try{this.seen=new Set(JSON.parse(localStorage.getItem('war-achievement-notices:'+this.owner)||'[]'));}catch{}}
  if(event.type==='summary'){if(event.count)this.enqueue({type:'summary',count:event.count,key:'summary:'+Date.now()});return;}
  if(event.type==='claimed'){this.enqueue({...event,key:'claimed:'+event.id});return;}
  const rows=event.rows||[],fresh=rows.filter(g=>!this.seen.has(event.type+':'+g.id));
  for(const row of fresh.slice(0,3)){
   if(event.type==='ready'){
    this.queue=this.queue.filter(q=>!(q.type==='pending'&&q.id===row.id));
    if(this.current?.type==='pending'&&this.current.id===row.id){this.current=null;clearTimeout(this.timer);this.root.innerHTML='';}
   }
   this.enqueue({...row,type:event.type,key:event.type+':'+row.id});
  }
  if(fresh.length>3)this.enqueue({type:'summary',count:fresh.length-3,key:'summary:'+fresh.map(r=>r.id).join('|')});
 }
 enqueue(event){if(this.seen.has(event.key)||this.queue.some(q=>q.key===event.key)||this.current?.key===event.key)return;this.queue.push(event);this.showNext();}
 showNext(){
  if(this.current||!this.queue.length)return;
  this.current=this.queue.shift();const n=this.current;this.seen.add(n.key);try{localStorage.setItem('war-achievement-notices:'+this.owner,JSON.stringify([...this.seen].filter(k=>!k.startsWith('summary:')).slice(-2000)));}catch{}
  const {data,row}=n.id?achievementById(n.id):{},name=row?.secret&&n.type!=='pending'?data.towers[n.id.split(':').at(-1)]?.name||row.name:row?.name||'Achievement';
  const summary=n.type==='summary',claimed=n.type==='claimed',pending=n.type==='pending';
  this.root.innerHTML=`<section class="achievement-notice ${claimed?'is-celebration':''}" data-notice><button class="achievement-notice-close" aria-label="Dismiss achievement notification">×</button>${row?`<img class="achievement-notice-art" src="${esc(achievementArtwork(row,data,!pending))}" alt="">`:''}<div class="achievement-notice-copy"><div class="achievement-notice-live" role="status" aria-live="polite" aria-atomic="true"><small>${claimed?'REWARD CLAIMED':pending?'MILESTONE REACHED':'WELL DONE, COMMANDER!'}</small><h2>${summary?`${n.count} rewards ready`:esc(name)}</h2><p>${claimed?`+${n.reward||row?.reward||0} ${(n.reward||row?.reward||0)===1?'medal':'medals'} added to your treasury`:pending?'Verification pending — saved locally.':summary?'Visit your collection to claim each reward.':'Achievement ready'}</p></div>${!summary&&!claimed?medalAmount(n.reward||row?.reward||0,pending?'after verification':'to claim'):''}<div class="achievement-notice-actions">${!summary&&!claimed&&!pending?'<button data-notice-claim>Claim reward</button>':''}${!claimed?'<button data-notice-view>View achievements</button>':''}</div><p class="achievement-notice-error" role="status"></p></div></section>`;
  this.remaining=claimed?3500:8000;this.resume();
 }
 pause(){if(this.timer){clearTimeout(this.timer);this.remaining=Math.max(0,this.remaining-(performance.now()-this.started));this.timer=null;}}
 resume(){if(!this.current||this.timer||this.hovered||this.root.contains(document.activeElement))return;this.started=performance.now();this.timer=setTimeout(()=>this.dismiss(),Math.max(500,this.remaining));}
 dismiss(){clearTimeout(this.timer);this.timer=null;this.current=null;this.root.innerHTML='';this.showNext();}
 async click(e){const b=e.target.closest('button');if(!b||b.disabled)return;if(b.classList.contains('achievement-notice-close'))return this.dismiss();if(b.hasAttribute('data-notice-view')){const id=this.current?.id;this.dismiss();await this.onView(id);return;}if(b.hasAttribute('data-notice-claim')){this.pause();b.disabled=true;const notice=this.current;try{await this.player.claimAchievement(notice.id);this.dismiss();}catch(error){if(this.current===notice){this.root.querySelector('.achievement-notice-error').textContent=error.message;b.disabled=false;}}}}
}
