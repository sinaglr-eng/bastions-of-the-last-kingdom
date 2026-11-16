import {RunStore} from './run-store.js';
import {serializeRun,restoreRun} from './core/run-state.js';
import {currentFactionData} from './core/current-data.js';
import {Game} from './core/game.js';
import {accountRank,newlyAvailableSkills,canonicalAchievementId} from './core/account-progression.js';
import {canonicalAchievementRows,achievementIdSet} from './achievement-client-state.js';

// A restored legacy snapshot may already include unsent commands in the
// immutable outbox. Append the rules boundary after those batches; never edit
// their command bodies or replay old global promotion from the current UI.
function adoptCurrentCommanderRules(game){if(game.general?.commanderRulesVersion===1&&!['lost','won'].includes(game.phase))game.adoptCommanderRules(2);}

export class PlayerClient{
 constructor({store=new RunStore(),fetcher=globalThis.fetch,base='./api',onChange=()=>{},onNotice=()=>{},onAchievement=()=>{},onPromotion=()=>{},onReset=()=>{}}={}){this.store=store;this.fetcher=(...args)=>fetcher(...args);this.base=base.replace(/\/$/,'');this.onChange=onChange;this.onNotice=onNotice;this.onAchievement=onAchievement;this.onPromotion=onPromotion;this.onReset=onReset;this.progressionEpoch='initial';this.resetPromise=Promise.resolve();this.resultReceipts=new Map();this.user=null;this.profile=null;this.online=false;this.game=null;this.writeChain=Promise.resolve();this.profileWrites=Promise.resolve();this.sync={sequence:0,nextSequence:0};this.lastSave=0;this.busy=false;this.status='Guest · local continuation only';this.nextRetry=0;this.pendingNotices=new Set();globalThis.addEventListener?.('online',()=>{void this.recoverFinishedRun();void this.recoverArtifactMutation();});}
 get owner(){return this.user?.id||'guest';}
 async request(path,body){const r=await this.fetcher(this.base+path,{method:body?'POST':'GET',credentials:'include',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||data.message||'Account request failed.'),{status:r.status});return data;}
 async initialize(){try{const s=await this.request('/player/session');this.user=s.user;this.profile=s.profile;this.progressionEpoch=s.progressionEpoch||s.profile?.progressionEpoch||'initial';this.authOptions=s.auth||{providers:[],emailPassword:!!s.mailMode};this.mailMode=s.mailMode;this.online=true;this.status=this.user?'Account connected':'Guest · local continuation only';this.cacheIdentity();await this.clearStaleProgressionSave();await this.recoverFinishedRun();}catch{this.online=false;this.authOptions={providers:[],emailPassword:false};try{this.user=JSON.parse(localStorage.getItem('fr010.lastIdentity')||'null');if(this.user)this.profile=JSON.parse(localStorage.getItem('fr010.cachedProfile:'+this.user.id)||'null');this.progressionEpoch=this.profile?.progressionEpoch||localStorage.getItem('fr010.progressionEpoch')||'initial';}catch{}this.status=this.user?'Offline continuation · sign in to sync':'Account service unavailable · Guest play is available';}if(this.online&&this.user)await this.recoverArtifactMutation();this.onChange();}
 cacheIdentity(){try{localStorage.setItem('fr010.progressionEpoch',this.progressionEpoch);if(this.user){localStorage.setItem('fr010.lastIdentity',JSON.stringify(this.user));if(this.profile)localStorage.setItem('fr010.cachedProfile:'+this.user.id,JSON.stringify(this.profile));}else localStorage.removeItem('fr010.lastIdentity');}catch{}}
 async auth(action,body){const result=await this.request('/auth/'+action,body);if(action==='sign-out'){this.user=null;this.profile=null;this.cacheIdentity();this.game=null;this.status='Guest · local continuation only';}else if(action==='sign-in/email'){await this.initialize();}this.onChange();return result;}
 async beginSocial(provider,callbackURL){if(!this.authOptions?.providers.includes(provider))throw Error('This sign-in option is not available yet.');const result=await this.request('/auth/sign-in/social',{provider,callbackURL,errorCallbackURL:callbackURL,disableRedirect:true});const url=new URL(result.url);if(url.protocol!=='https:'||url.username||url.password||!(provider==='google'&&url.hostname==='accounts.google.com'||provider==='apple'&&url.hostname==='appleid.apple.com'||provider==='facebook'&&url.hostname==='www.facebook.com'))throw Error('Invalid sign-in redirect.');return url.href;}
 async deleteAccount(){const owner=this.owner;await this.request('/player/delete-account',{confirmation:'DELETE'});await this.store.deleteOwner(owner);try{localStorage.removeItem('fr010.cachedProfile:'+owner);}catch{}this.user=null;this.profile=null;this.game=null;this.cacheIdentity();this.status='Account deleted · Guest play is available';this.onChange();}
 applyProfile(profile){if(!this.profile||profile.revision>=this.profile.revision){if((this.profile?.artifacts?.revision||0)>(profile.artifacts?.revision||0))profile={...profile,artifacts:this.profile.artifacts};this.profile=profile;this.cacheIdentity();if(profile.progressionEpoch&&profile.progressionEpoch!==this.progressionEpoch){this.progressionEpoch=profile.progressionEpoch;this.resetPromise=this.clearStaleProgressionSave();}}return this.profile;}
 get readyAchievements(){const claimed=achievementIdSet(this.profile?.grants);return canonicalAchievementRows(this.profile?.eligible).filter(g=>!claimed.has(g.id));}
 changeProfile(action,body={},onResponse=()=>{}){const operation=async()=>{if(!this.user||!this.online)throw Error('Connect and sign in to manage your general.');const requestId=crypto.randomUUID();for(let attempt=0;attempt<3;attempt++){try{const response=await this.request('/player/'+action,{...body,revision:this.profile.revision,requestId});onResponse(response);this.applyProfile(response);this.onChange();return this.profile;}catch(error){if(error.status!==409||attempt===2)throw error;this.applyProfile(await this.request('/player/profile'));}}};this.profileWrites=this.profileWrites.catch(()=>{}).then(operation);return this.profileWrites;}
 async claimAchievement(id){
  id=canonicalAchievementId(id);if(achievementIdSet(this.profile?.grants).has(id))return this.profile;
  this.achievementClaims??=new Map();if(this.achievementClaims.has(id))return this.achievementClaims.get(id);
  const claim=(async()=>{const xpBefore=this.profile?.xpTotal||0,row=this.readyAchievements.find(g=>g.id===id),reward=row?.reward;let receipt=null;
   await this.changeProfile('achievements/claim',{achievementId:id},response=>{receipt=response.claimReceipt||null;});
   if(achievementIdSet(this.profile?.grants).has(id)){const amount=receipt?.amount??row?.xp??0;this.onAchievement({type:'claimed',id,reward,xp:amount});this.onPromotion(receipt||{receiptId:'achievement:'+id,status:'confirmed',xpBefore,xpAfter:xpBefore+amount,amount,levelBefore:accountRank(xpBefore).level,levelAfter:accountRank(xpBefore+amount).level,newSkills:newlyAvailableSkills(xpBefore,xpBefore+amount)});}
   return this.profile;
  })();this.achievementClaims.set(id,claim);
  try{return await claim;}finally{this.achievementClaims.delete(id);}
 }
 announceAchievements(previous){const known=achievementIdSet([...(previous?.eligible||[]),...(previous?.grants||[])]);const ready=this.readyAchievements.filter(g=>!known.has(g.id));if(ready.length)this.onAchievement({type:'ready',rows:ready});}
 async artifactMutation(action,body={},resume=null){
  const operation=async()=>{
   if(!this.user||!this.online)throw Error('Connect and sign in to manage artifacts.');
   const owner=this.owner,key='fr011.pending:'+owner;let pending=resume;
   if(!pending){try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{}if(pending&&(pending.action!==action||JSON.stringify(pending.body)!==JSON.stringify(body)))throw Error('Finish the pending artifact operation first. Reconnect or retry.');}
   pending??={action,body,requestId:crypto.randomUUID()};try{localStorage.setItem(key,JSON.stringify(pending));}catch{}
   for(let attempt=0;attempt<3;attempt++)try{
    const result=await this.request('/player/artifacts/'+pending.action,{...pending.body,requestId:pending.requestId,revision:this.profile?.artifacts?.revision||0});
    if(owner!==this.owner)throw Error('Account changed. Reopen your Commander.');this.profile={...this.profile,artifacts:result.artifacts};this.lastArtifactReceipt=result.receipt;this.cacheIdentity();try{localStorage.removeItem(key);}catch{}this.onChange();return result;
   }catch(error){if(error.status===409&&attempt<2){this.applyProfile(await this.request('/player/profile'));continue;}if(error.status&&error.status<500){try{localStorage.removeItem(key);}catch{}}throw error;}
  };const result=this.profileWrites.catch(()=>{}).then(operation);this.profileWrites=result.catch(()=>{});return result;
 }
 async recoverArtifactMutation(){if(!this.user||!this.online)return;let pending;try{pending=JSON.parse(localStorage.getItem('fr011.pending:'+this.owner)||'null');}catch{}if(!pending)return;try{await this.artifactMutation(pending.action,pending.body,pending);}catch(error){this.status='Artifact operation pending · '+error.message;}}
 async newRun(factionId,{replace=false}={}){
  await this.resetPromise;await this.clearStaleProgressionSave();await this.recoverFinishedRun({strict:true});
  if(this.game){await this.save();if(this.game.accountId){while(this.busy)await new Promise(r=>setTimeout(r,50));await this.flush();if(this.sync.sequence<this.sync.nextSequence)throw Error('Sync the current account run before replacing it.');}}
  if(this.user){if(!this.online)throw Error('Connect and sign in to start an account run. You can continue the saved run offline.');const {run,profile}=await this.request('/player/runs',{factionId,replace,commanderRulesVersion:2,artifactVersion:2});if(profile)this.applyProfile(profile);return {game:restoreRun(currentFactionData(factionId),run.snapshot),sequence:run.sequence,nextSequence:run.sequence};}
  return {game:new Game(currentFactionData(factionId),{seed:Date.now(),mode:'endless',runId:crypto.randomUUID()}),sequence:0,nextSequence:0};
 }
 async attach(game,{sequence=0,nextSequence=sequence,revision=null,discardRun=null}={}){
  await this.resetPromise;game.progressionEpoch=this.progressionEpoch;this.game=game;this.sync={sequence,nextSequence};this.storageRevision=revision??(await this.store.get(this.owner))?.revision??0;this.lastSave=0;this.nextRetry=0;this.status=this.user?'Pending verification':'Guest · local continuation only';this.onChange();await this.save({discardRun});if(game.accountId)try{await this.refreshResultReceipts();}catch{}
 }
 prepareBatches(game){
  const batches=[];if(!game.accountId||game.developerMode){game.journal=[];return batches;}
  while(game.journal.length){const commands=[];let ticks=0;while(game.journal.length&&commands.length<400){const c=game.journal[0];if(c.action==='advance'){const take=Math.min(c.ticks,600-ticks);if(!take)break;commands.push({action:'advance',ticks:take});ticks+=take;if(take===c.ticks)game.journal.shift();else c.ticks-=take;}else commands.push(game.journal.shift());if(ticks>=600)break;}batches.push({runId:game.runId,accountId:game.accountId,batchId:crypto.randomUUID(),sequence:this.sync.nextSequence++,commands,elapsedSeconds:game.elapsedSeconds});}
  return batches;
 }
 queueWrite(operation){const next=this.writeChain.catch(()=>{}).then(operation);this.writeChain=next;return next;}
 async save({discardRun=null}={}){
  const game=this.game;if(!game)return;
  return this.queueWrite(async()=>{if(this.game!==game)return;let batches=[];
   try{const snapshot=serializeRun(game);batches=this.prepareBatches(game);const envelope={revision:this.storageRevision||0,meta:{runId:game.runId,accountId:game.accountId,progressionEpoch:this.progressionEpoch,factionId:game.factionId,round:game.round,phase:game.phase,elapsedSeconds:game.elapsedSeconds,developerMode:!!game.developerMode},snapshot,sync:{...this.sync}};const saved=await this.store.put(game.accountId||'guest',envelope,batches,{discardRun});this.storageRevision=saved.revision;this.lastSave=performance.now();return saved;}catch(error){game.journal.unshift(...batches.flatMap(b=>b.commands));this.sync.nextSequence-=batches.length;this.status=error.message;this.onChange();throw error;}
  });
 }
 async flush(){
  if(this.busy||!this.user||this.user.id!==this.game?.accountId||this.game.developerMode||Date.now()<this.nextRetry)return;this.busy=true;
  try{await this.save();const game=this.game;for(let i=0;i<8&&this.game===game;i++){const batch=await this.store.batch(game.runId,this.sync.sequence+1);if(!batch)break;const result=await this.request(`/player/runs/${game.runId}/commands`,batch);if(this.user?.id!==game.accountId)break;const previous=this.profile;this.applyProfile(result.profile);this.online=true;if(this.game!==game){await this.resetPromise;break;}await this.queueWrite(async()=>{const saved=await this.store.acknowledge(game.accountId,this.storageRevision,game.runId,result.sequence);this.storageRevision=saved.revision;this.sync.sequence=result.sequence;});this.announceAchievements(previous);}
   if(game.progress?.campaign||['lost','won'].includes(game.phase))await this.refreshResultReceipts();
   this.status=this.sync.sequence<this.sync.nextSequence?'Pending verification':'Progress verified';this.onChange();
  }catch(error){if(error.status===409&&/Account progress reset/.test(error.message)){await this.initialize();this.onReset();return;}this.online=false;this.status=error.status===409?'Save conflict · return to the menu to choose a continuation':error.status===401?'Sign in again to sync this account run':'Offline · progress saved locally; rewards pending';this.nextRetry=Date.now()+10000;this.onChange();}finally{this.busy=false;}
 }
 update(){if(!this.game||this.recovering)return;const now=performance.now();if(now-this.lastSave>5000){this.lastSave=now;void this.save().then(()=>this.flush()).catch(()=>{});if(!this.online&&this.game.accountId&&!this.game.developerMode){const known=achievementIdSet([...(this.profile?.eligible||[]),...(this.profile?.grants||[])]);this.pendingNotices=new Set([...this.pendingNotices].map(canonicalAchievementId));for(const g of canonicalAchievementRows(this.game.progress.grants()))if(!known.has(g.id)&&!this.pendingNotices.has(g.id)){this.pendingNotices.add(g.id);this.onAchievement({type:'pending',rows:[g]});}}}}
 resultReceipt(kind){return this.resultReceipts.get(this.game?.runId+':'+kind)||null;}
 async clearStaleProgressionSave(){
  const owner=this.owner,epoch=this.progressionEpoch;
  if(this.game&&(this.game.progressionEpoch||'initial')!==epoch){this.game.paused=true;this.game=null;this.sync={sequence:0,nextSequence:0};this.resultReceipts.clear();this.onReset();}
  return this.queueWrite(async()=>{const saved=await this.store.get(owner);if(saved&&(saved.meta.progressionEpoch||'initial')!==epoch){await this.store.deleteOwner(owner);this.storageRevision=0;this.status='Progression reset · begin a new defense';}});
 }
 async recoverFinishedRun({strict=false}={}){
  if(!this.user||this.busy||this.recovering)return null;this.recovering=true;
  try{
   let saved=await this.store.get(this.owner);const owner=this.owner,id=saved?.meta.runId,beforeRecovery=this.profile?.xpTotal||0;
   if(!saved||saved.meta.accountId!==owner||!['lost','won'].includes(saved.meta.phase)||saved.meta.developerMode)return null;
   for(let count=0;saved.sync.sequence<saved.sync.nextSequence;count++){
    if(count>=2000)throw Error('Your previous result is still syncing. Please retry before starting a new defense.');
    const batch=await this.store.batch(id,saved.sync.sequence+1);if(!batch)throw Error('Your saved result has a missing command batch. Keep this save and retry recovery.');
    const result=await this.request('/player/runs/'+id+'/commands',batch);if(this.owner!==owner)return null;
    const previous=this.profile;this.applyProfile(result.profile);saved=await this.store.acknowledge(owner,saved.revision,id,result.sequence);this.announceAchievements(previous);
    if(this.game?.runId===id){this.sync.sequence=result.sequence;this.storageRevision=saved.revision;}
   }
   const result=await this.request('/player/runs/'+id+'/results',{kind:'end'});if(this.owner!==owner)return null;
   this.resultReceipts.set(id+':end',result.receipt);this.applyProfile(result.profile);this.online=true;this.status='Previous result verified · account XP saved';this.onPromotion({...result.receipt,receiptId:'recovery:'+id,xpBefore:beforeRecovery,xpAfter:this.profile.xpTotal,levelBefore:accountRank(beforeRecovery).level,levelAfter:accountRank(this.profile.xpTotal).level});return result.receipt;
  }catch(error){this.status=error.status===409?'Saved result conflicts with the cloud. Your local commands are preserved. Choose a continuation before replacing them.':'Previous result verification pending · saved locally';if(strict)throw error;return null;}
  finally{this.recovering=false;this.onChange();}
 }
 get campaignPending(){const r=this.resultReceipt('campaign');return !!r&&!r.acknowledged&&!this.game?.campaignResultAcknowledged;}
 async refreshResultReceipts(){
  const game=this.game;if(!game?.accountId||game.developerMode)return;
  const {receipts}=await this.request('/player/runs/'+game.runId+'/results');
  for(const receipt of receipts||[])this.resultReceipts.set(game.runId+':'+receipt.kind,receipt);
  let ack=false;try{ack=localStorage.getItem('account-campaign-ack:'+game.accountId+':'+game.runId)==='1';}catch{}
  if(ack&&receipts?.some(r=>r.kind==='campaign'&&!r.acknowledged)){const r=await this.request('/player/runs/'+game.runId+'/results',{kind:'campaign',acknowledge:true});this.resultReceipts.set(game.runId+':campaign',r.receipt);this.applyProfile(r.profile);}
 }
 async settleResult(kind){
  const game=this.game;if(!game?.accountId||game.developerMode)return null;
  await this.save();
  for(let attempt=0;attempt<100;attempt++){
   while(this.busy)await new Promise(resolve=>setTimeout(resolve,30));
   this.nextRetry=0;await this.flush();
   if(!this.online)throw Error('Verification pending. Progress is saved locally; reconnect to receive your XP.');
   if(this.sync.sequence>=this.sync.nextSequence)break;
   if(attempt===99)throw Error('Verification pending. Your saved command queue is still syncing.');
  }
  const result=await this.request('/player/runs/'+game.runId+'/results',{kind});
  this.resultReceipts.set(game.runId+':'+kind,result.receipt);this.applyProfile(result.profile);this.onChange();return result.receipt;
 }
 acknowledgeCampaign(){
  const game=this.game;if(!game)return;game.campaignResultAcknowledged=true;
  try{localStorage.setItem('account-campaign-ack:'+(game.accountId||'guest')+':'+game.runId,'1');}catch{}
  const receipt=this.resultReceipt('campaign');if(receipt)this.resultReceipts.set(game.runId+':campaign',{...receipt,acknowledged:true});
  if(game.accountId&&this.online)void this.request('/player/runs/'+game.runId+'/results',{kind:'campaign',acknowledge:true}).then(r=>{this.resultReceipts.set(game.runId+':campaign',r.receipt);this.applyProfile(r.profile);}).catch(()=>{});
 }

 async continuation(){
  await this.resetPromise;await this.clearStaleProgressionSave();
  const local=await this.store.get(this.owner);let remote=null;
  if(this.user)try{remote=(await this.request('/player/active')).run;this.online=true;}catch{this.online=false;}
  const usable=local&&(!['lost','won'].includes(local.meta.phase)||!!local.meta.accountId&&local.sync.sequence<local.sync.nextSequence);
  if(!this.user)return usable?{local}:null;
  if(!remote)return usable?{local}:null;
  if(!usable)return {remote};
  if(local.meta.runId===remote.id){if(remote.sequence===local.sync.sequence)return {local};const match=await this.store.batch(remote.id,remote.sequence);if(remote.sequence>local.sync.sequence&&match?.batchId===remote.lastBatch)return {local:{...local,sync:{...local.sync,sequence:remote.sequence}}};}
  return {conflict:true,local,remote};
 }
 async resume(choice){
  const e=choice.local;if(e){if((e.meta.accountId||'guest')!==this.owner)throw Error('Sign in to the owner of this save.');const game=restoreRun(currentFactionData(e.meta.factionId),e.snapshot);if((game.progressionEpoch||'initial')!==this.progressionEpoch)throw Error('Account progress reset. Start a new defense.');adoptCurrentCommanderRules(game);game.paused=true;await this.attach(game,{...e.sync,revision:e.revision});return game;}
  const remote=choice.remote;if(!remote)throw Error('No saved run.');const game=restoreRun(currentFactionData(remote.factionId),remote.snapshot);if((game.progressionEpoch||'initial')!==this.progressionEpoch)throw Error('Account progress reset. Start a new defense.');adoptCurrentCommanderRules(game);game.paused=true;await this.attach(game,{sequence:remote.sequence,discardRun:remote.id});return game;
 }
 async excludeDeveloper(){if(!this.game?.accountId)return;try{await this.request(`/player/runs/${this.game.runId}/developer`,{});}catch{this.onNotice('Developer exclusion pending. This run cannot submit further commands.');}this.game.journal=[];}
}
