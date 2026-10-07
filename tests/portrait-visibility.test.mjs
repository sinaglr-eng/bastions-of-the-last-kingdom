import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectApprovedPortraitVisibility} from '../ui/portrait-visibility.js';

const state='data-approved-portrait-state';
const portrait=(family='soldier-1',revision='approved')=>`/assets/geometric/portraits/${family}.png?v=${revision}`;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

// The fixture follows native mutation delivery: records are batched in a
// microtask before painting, while decoder promises can settle independently.
function documentFixture(){
  const document={baseURI:'https://example.test/bastions/index.html',observers:[]};
  class Observer{
    constructor(callback){this.callback=callback;this.records=[];this.active=false;this.queued=false;this.disconnects=0;document.observers.push(this);}
    observe(root,options){this.root=root;this.options=options;this.active=true;}
    record(record){
      if(!this.active||!(this.root===record.target||(this.options.subtree&&this.root.contains(record.target))))return;
      if(record.type==='attributes'&&(!this.options.attributes||!this.options.attributeFilter.includes(record.attributeName)))return;
      if(record.type==='childList'&&!this.options.childList)return;
      this.records.push(record);
      if(!this.queued){this.queued=true;queueMicrotask(()=>{this.queued=false;const records=this.records.splice(0);if(this.active&&records.length)this.callback(records,this);});}
    }
    disconnect(){this.active=false;this.records=[];this.disconnects++;}
  }
  document.defaultView={MutationObserver:Observer};
  document.notify=record=>document.observers.forEach(observer=>observer.record(record));
  class Element{
    constructor(tag='div'){this.nodeType=1;this.tagName=tag.toUpperCase();this.ownerDocument=document;this.attributes=new Map();this.children=[];this.parentNode=null;this.listeners=new Map();}
    getAttribute(name){return this.attributes.get(name)??null;}
    setAttribute(name,value){this.attributes.set(name,String(value));document.notify({type:'attributes',target:this,attributeName:name});}
    removeAttribute(name){if(this.attributes.delete(name))document.notify({type:'attributes',target:this,attributeName:name});}
    append(...nodes){for(const node of nodes){node.parentNode?.remove(node);node.parentNode=this;this.children.push(node);}document.notify({type:'childList',target:this,addedNodes:nodes,removedNodes:[]});}
    remove(node){const index=this.children.indexOf(node);assert.notEqual(index,-1);this.children.splice(index,1);node.parentNode=null;document.notify({type:'childList',target:this,addedNodes:[],removedNodes:[node]});}
    replace(oldNode,newNode){const index=this.children.indexOf(oldNode);assert.notEqual(index,-1);this.children[index]=newNode;oldNode.parentNode=null;newNode.parentNode=this;document.notify({type:'childList',target:this,addedNodes:[newNode],removedNodes:[oldNode]});}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    querySelectorAll(selector){assert.equal(selector,'img');return this.children.flatMap(child=>[...(child.tagName==='IMG'?[child]:[]),...child.querySelectorAll('img')]);}
    addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
    removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
    dispatch(type){for(const listener of [...(this.listeners.get(type)||[])])listener({type,target:this});}
    get listenerCount(){return [...this.listeners.values()].reduce((sum,listeners)=>sum+listeners.size,0);}
  }
  class Image extends Element{
    constructor(src,{decode=true,cached=false,beforeDecode=null,throws=false}={}){
      super('img');this.attributes.set('src',src);this.complete=cached;this.naturalWidth=cached?96:0;this.currentSrc=cached?this.src:'';this.requests=[];
      this.decode=decode?()=>{
        beforeDecode?.(this);if(throws)throw new Error('Native decode failed');
        const pending=deferred(),source=this.src;
        const request={source,resolve:()=>{if(this.src===source){this.complete=true;this.naturalWidth=96;this.currentSrc=source;}pending.resolve();},reject:()=>{if(this.src===source){this.complete=true;this.naturalWidth=0;this.currentSrc=source;}pending.reject(new Error('Invalid approved image'));}};
        this.requests.push(request);if(cached)request.resolve();return pending.promise;
      }:undefined;
    }
    get src(){return this.getAttribute('src')?new URL(this.getAttribute('src'),document.baseURI).href:'';}
    setAttribute(name,value){if(name==='src'){this.complete=false;this.naturalWidth=0;this.currentSrc='';}super.setAttribute(name,value);}
    loaded(){this.complete=true;this.naturalWidth=96;this.currentSrc=this.src;this.dispatch('load');}
    failed(){this.complete=true;this.naturalWidth=0;this.currentSrc=this.src;this.dispatch('error');}
  }
  const root=new Element();return {document,root,Element,Image};
}

test('existing approved portraits hide synchronously before native decode, including decoded cache hits',async()=>{
  const {root,Image,document}=documentFixture(),states=[];
  const image=new Image(portrait(),{cached:true,beforeDecode:image=>states.push(image.getAttribute(state))});root.append(image);
  const connection=connectApprovedPortraitVisibility(root);
  assert.equal(image.getAttribute(state),'loading');assert.deepEqual(states,['loading']);assert.equal(image.requests.length,1);
  await flush();assert.equal(image.getAttribute(state),'ready');assert.equal(document.observers.length,1);connection.dispose();
});

test('rapid A to B changes cannot reveal A even when its promise callback precedes the src observer',async()=>{
  const {root,Image}=documentFixture(),image=new Image(portrait('soldier-1'));root.append(image);
  const connection=connectApprovedPortraitVisibility(root),first=image.requests[0];
  first.resolve();image.setAttribute('src',portrait('mage-2'));await flush();
  assert.equal(image.getAttribute(state),'loading');assert.equal(image.requests.length,2);
  image.requests[1].resolve();await flush();assert.equal(image.getAttribute(state),'ready');connection.dispose();
});

test('late rejection for an older source cannot hide the current decoded portrait',async()=>{
  const {root,Image}=documentFixture(),image=new Image(portrait('soldier-1'));root.append(image);const connection=connectApprovedPortraitVisibility(root),first=image.requests[0];
  image.setAttribute('src',portrait('mage-2'));await flush();image.requests[1].resolve();await flush();assert.equal(image.getAttribute(state),'ready');
  first.reject();await flush();assert.equal(image.getAttribute(state),'ready');connection.dispose();
});

test('A to B to A within one mutation batch decodes the final request afresh instead of retaining the invalid original promise',async()=>{
  const {root,Image}=documentFixture(),source=portrait('soldier-1'),image=new Image(source);root.append(image);const connection=connectApprovedPortraitVisibility(root),first=image.requests[0];
  image.setAttribute('src',portrait('mage-2'));image.setAttribute('src',source);await flush();
  assert.equal(image.requests.length,2,'the two src mutations produce exactly one new decoder for the final request');assert.equal(image.getAttribute(state),'loading');
  first.reject();await flush();assert.equal(image.getAttribute(state),'loading');image.requests[1].resolve();await flush();assert.equal(image.getAttribute(state),'ready');connection.dispose();
});

test('a changed source is hidden in the mutation microtask before the next paint and revision URLs are distinct',async()=>{
  const {root,Image,document}=documentFixture(),states=[];
  const image=new Image(portrait('soldier-1','a'),{beforeDecode:image=>states.push(image.getAttribute(state))});root.append(image);
  const connection=connectApprovedPortraitVisibility(root);image.requests[0].resolve();await flush();assert.equal(image.getAttribute(state),'ready');
  image.setAttribute('src',portrait('soldier-1','b'));await Promise.resolve();
  assert.equal(image.getAttribute(state),'loading','the next paint can only see the hidden image');assert.deepEqual(states,['loading','loading']);
  assert.deepEqual(document.observers[0].options,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  image.setAttribute('alt','Approved Soldier');image.setAttribute('class','new-layout');await flush();assert.equal(image.requests.length,2,'unrelated attributes do not trigger a new decode');
  image.requests[1].resolve();await flush();assert.equal(image.getAttribute(state),'ready');connection.dispose();
});

test('current native decode failures stay unavailable with their original source and never create a fallback',async()=>{
  const {root,Image}=documentFixture(),image=new Image(portrait());root.append(image);const connection=connectApprovedPortraitVisibility(root);
  const original=image.src;image.requests[0].reject();await flush();assert.equal(image.getAttribute(state),'unavailable');assert.equal(image.src,original);
  image.loaded();await flush();assert.equal(image.getAttribute(state),'unavailable','a load event does not overrule native decode failure');assert.equal(image.requests.length,1);connection.dispose();
});

test('synchronous native decode errors fail hidden without removing their layout node',()=>{
  const {root,Image}=documentFixture(),image=new Image(portrait(),{throws:true});root.append(image);const connection=connectApprovedPortraitVisibility(root);
  assert.equal(image.getAttribute(state),'unavailable');assert.equal(root.children[0],image);assert.equal(image.getAttribute('src'),portrait());connection.dispose();
});

test('fallback accepts a cached complete image or the current load and removes listeners after settlement',async()=>{
  const {root,Image}=documentFixture(),cached=new Image(portrait('soldier-1'),{decode:false,cached:true}),loading=new Image(portrait('mage-2'),{decode:false});root.append(cached,loading);
  const connection=connectApprovedPortraitVisibility(root);assert.equal(cached.getAttribute(state),'ready');assert.equal(cached.listenerCount,0);
  assert.equal(loading.getAttribute(state),'loading');assert.equal(loading.listenerCount,2);loading.loaded();
  assert.equal(loading.getAttribute(state),'ready');assert.equal(loading.listenerCount,0);await flush();connection.dispose();
});

test('fallback ignores stale load and error events until the image reports its current complete source',async()=>{
  const {root,Image}=documentFixture(),image=new Image(portrait('soldier-1'),{decode:false});root.append(image);const connection=connectApprovedPortraitVisibility(root),first=image.src;
  image.setAttribute('src',portrait('mage-2'));await flush();assert.equal(image.listenerCount,2);
  image.dispatch('error');assert.equal(image.getAttribute(state),'loading');
  image.complete=true;image.naturalWidth=96;image.currentSrc=first;image.dispatch('load');assert.equal(image.getAttribute(state),'loading');
  image.loaded();assert.equal(image.getAttribute(state),'ready');assert.equal(image.listenerCount,0);connection.dispose();
});

test('fallback current error remains unavailable and a new source starts a fresh ownership cycle',async()=>{
  const {root,Image}=documentFixture(),image=new Image(portrait(),{decode:false});root.append(image);const connection=connectApprovedPortraitVisibility(root);
  image.failed();assert.equal(image.getAttribute(state),'unavailable');assert.equal(image.listenerCount,0);
  image.setAttribute('src',portrait('mage-2'));await flush();assert.equal(image.getAttribute(state),'loading');assert.equal(image.listenerCount,2);
  image.loaded();assert.equal(image.getAttribute(state),'ready');connection.dispose();
});

test('new nested and replacement nodes each require their own decode and removed nodes lose pending ownership',async()=>{
  const {root,Image,Element}=documentFixture(),panel=new Element(),first=new Image(portrait());panel.append(first);root.append(panel);const connection=connectApprovedPortraitVisibility(root);
  const replacement=new Image(portrait());panel.replace(first,replacement);await flush();assert.equal(replacement.getAttribute(state),'loading');assert.equal(replacement.requests.length,1);
  first.requests[0].resolve();await flush();assert.equal(first.getAttribute(state),'loading','a detached node cannot become ready');assert.equal(replacement.getAttribute(state),'loading');
  replacement.requests[0].resolve();await flush();assert.equal(replacement.getAttribute(state),'ready');
  const nested=new Element(),late=new Image(portrait('mage-2'));nested.append(late);root.append(nested);await flush();assert.equal(late.getAttribute(state),'loading');assert.equal(late.requests.length,1);connection.dispose();
});

test('a newly inserted image whose src changes in the same batch decodes only its final request',async()=>{
  const {root,Image}=documentFixture(),connection=connectApprovedPortraitVisibility(root),image=new Image(portrait('soldier-1'));
  root.append(image);image.setAttribute('src',portrait('mage-2'));await flush();
  assert.equal(image.getAttribute(state),'loading');assert.equal(image.requests.length,1);assert.equal(image.requests[0].source,image.src);
  image.requests[0].resolve();await flush();assert.equal(image.getAttribute(state),'ready');connection.dispose();
});

test('removed fallback nodes and changed ineligible sources release all listeners without touching unrelated images',async()=>{
  const {root,Image}=documentFixture(),fallback=new Image(portrait(),{decode:false}),unrelated=new Image('/icons/crown.png');
  unrelated.setAttribute(state,'external-marker');root.append(fallback,unrelated);const connection=connectApprovedPortraitVisibility(root);assert.equal(fallback.listenerCount,2);
  root.remove(fallback);await flush();assert.equal(fallback.listenerCount,0);fallback.loaded();assert.equal(fallback.getAttribute(state),'loading');
  const changed=new Image(portrait('mage-2'),{decode:false});root.append(changed);await flush();changed.setAttribute('src','data:image/png;base64,wall');await flush();
  assert.equal(changed.listenerCount,0);assert.equal(changed.getAttribute(state),null);assert.equal(unrelated.getAttribute(state),'external-marker');assert.equal(unrelated.requests.length,0);connection.dispose();
});

test('enemy, data wall, unknown and unrelated images are untouched while portable defender URLs are gated',()=>{
  const {root,Image}=documentFixture(),excluded=[portrait('host_enemy_01_skull'),portrait('host_enemy'),'data:image/png;base64,wall','/assets/geometric/enemies/soldier.png','/legacy/portraits/mage.png',''];
  const images=excluded.map(src=>new Image(src));const portable=new Image('assets/geometric/portraits/ladyclaire.png?v=approved');root.append(...images,portable);
  const connection=connectApprovedPortraitVisibility(root);
  images.forEach((image,index)=>{assert.equal(image.getAttribute(state),null);assert.equal(image.getAttribute('src'),excluded[index]);assert.equal(image.requests.length,0);});
  assert.equal(portable.getAttribute(state),'loading');assert.equal(portable.requests.length,1);connection.dispose();
});

test('dispose disconnects once, removes listeners, invalidates pending decodes and prevents later node binding',async()=>{
  const {root,Image,document}=documentFixture(),native=new Image(portrait()),fallback=new Image(portrait('mage-2'),{decode:false});root.append(native,fallback);
  const connection=connectApprovedPortraitVisibility(root);connection.dispose();connection.dispose();assert.equal(document.observers[0].disconnects,1);assert.equal(fallback.listenerCount,0);
  native.requests[0].resolve();fallback.loaded();const late=new Image(portrait('archer-3'));root.append(late);await flush();
  assert.equal(native.getAttribute(state),'loading');assert.equal(fallback.getAttribute(state),'loading');assert.equal(late.getAttribute(state),null);assert.equal(late.requests.length,0);
});

test('repeated connection calls share one observer and a disposed root can connect again',async()=>{
  const {root,Image,document}=documentFixture(),image=new Image(portrait());root.append(image);
  const connection=connectApprovedPortraitVisibility(root);assert.equal(connectApprovedPortraitVisibility(root),connection);assert.equal(document.observers.length,1);assert.equal(image.requests.length,1);
  connection.dispose();const next=connectApprovedPortraitVisibility(root);assert.notEqual(next,connection);assert.equal(document.observers.length,2);assert.equal(image.requests.length,2);
  image.requests[0].resolve();await flush();assert.equal(image.getAttribute(state),'loading');image.requests[1].resolve();await flush();assert.equal(image.getAttribute(state),'ready');next.dispose();
});

test('CSS preserves portrait layout and hides only pending or unavailable approved image states',()=>{
  const css=readFileSync(new URL('../ui/portrait-visibility.css',import.meta.url),'utf8');
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];assert.equal(rules.length,1);
  assert.deepEqual(rules[0][1].trim().split(/,\s*/),['img[data-approved-portrait-state="loading"]','img[data-approved-portrait-state="unavailable"]']);
  assert.equal(rules[0][2].trim(),'visibility: hidden;');
});
