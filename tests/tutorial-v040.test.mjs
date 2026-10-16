import test from 'node:test';
import assert from 'node:assert/strict';
import {GuidedTutorial,TUTORIAL_STEPS} from '../ui/tutorial.js';

function fixture(){
  const previous=Object.fromEntries(['document','window','innerWidth','innerHeight'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const node=()=>({style:{},dataset:{},hidden:false,disabled:false,textContent:'',listeners:new Map(),addEventListener(type,callback){this.listeners.set(type,callback);}});
  const highlight=node(),card=node(),layer=node(),fields=new Map(['h2','p','.tutorial-progress','[data-tour="back"]','[data-tour="next"]'].map(selector=>[selector,node()]));card.querySelector=selector=>fields.get(selector);card.offsetHeight=180;
  layer.querySelector=selector=>selector==='.tutorial-card'?card:highlight;
  const targets=new Map(),rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  const target=(selector,box,visible=true)=>{const element={getClientRects:()=>visible?[box]:[],getBoundingClientRect:()=>box};targets.set(selector,element);return element;};
  target('#battlefield',rect(10,80,900,500));target('#map-start [data-action="maze"]',rect(750,570,160,48),false);target('.map-tools > summary',rect(930,90,44,44));
  const document={body:{append(value){assert.equal(value,layer);}},createElement:()=>layer,querySelector:selector=>selector==='dialog[open]'?(document.dialogOpen?{}:null):targets.get(selector)||null,dialogOpen:false};
  const window={listeners:new Map(),addEventListener(type,callback){this.listeners.set(type,callback);}};
  Object.assign(globalThis,{document,window,innerWidth:1024,innerHeight:768});
  return {layer,card,highlight,fields,document,window,target,rect,click(action){layer.listeners.get('click')({target:{closest:()=>({dataset:{tour:action}})}});},restore(){for(const [key,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('the actual seven-step tour retains Next/Back/End and anchors Maze to visible Map tools when the Ready dock is hidden',()=>{
  const view=fixture();let finished=0;
  try{
    const tour=new GuidedTutorial({onFinish:()=>finished++});tour.start();assert.equal(tour.active,true);assert.equal(tour.index,0);assert.equal(view.fields.get('[data-tour="back"]').disabled,true);
    view.click('next');view.click('next');assert.equal(tour.index,2);assert.equal(view.highlight.style.left,'926px');assert.equal(view.highlight.style.top,'86px');assert.equal(view.highlight.style.width,'52px');assert.equal(view.fields.get('h2').textContent,TUTORIAL_STEPS[2].title);
    view.click('back');assert.equal(tour.index,1);view.click('next');
    view.target('#map-start [data-action="maze"]',view.rect(750,570,160,48),true);tour.refresh();assert.equal(view.highlight.style.left,'746px');assert.equal(view.highlight.style.width,'168px','Ready uses its actual visible Maze button');
    while(tour.index<TUTORIAL_STEPS.length-1)view.click('next');assert.equal(view.fields.get('[data-tour="next"]').textContent,'Play');assert.match(view.fields.get('p').textContent,/Speed 1× \/ 2×.*dock/);view.click('next');assert.equal(tour.active,false);assert.equal(view.layer.hidden,true);assert.equal(finished,1);
    tour.start();assert.equal(tour.index,0);view.click('skip');assert.equal(tour.active,false);assert.equal(finished,2);
  }finally{view.restore();}
});

test('Escape ends the actual optional tour only after the active dialog has closed',()=>{
  const view=fixture();let finished=0,prevented=0,stopped=0;
  try{
    const tour=new GuidedTutorial({onFinish:()=>finished++}),key={key:'Escape',preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}};tour.start();view.document.dialogOpen=true;view.window.listeners.get('keydown')(key);assert.equal(tour.active,true);assert.equal(finished,0);assert.equal(prevented,0);
    view.document.dialogOpen=false;view.window.listeners.get('keydown')(key);assert.equal(tour.active,false);assert.equal(finished,1);assert.equal(prevented,1);assert.equal(stopped,1);view.window.listeners.get('keydown')(key);assert.equal(finished,1);
  }finally{view.restore();}
});
