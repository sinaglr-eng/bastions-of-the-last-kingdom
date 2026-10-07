const stateAttribute='data-approved-portrait-state';
const connections=new WeakMap();

function sourceOf(image){
  const attribute=image.getAttribute('src'),source=image.src;
  if(!attribute||!source)return null;
  try{
    const url=new URL(source,image.ownerDocument?.baseURI),match=url.pathname.match(/\/assets\/geometric\/portraits\/([^/]+)$/i);
    if(!match||/^host_enemy(?:[_\-.]|$)/i.test(match[1])||/^host_\d+\.png$/i.test(match[1]))return null;
    return {attribute,source:url.href};
  }catch{return null;}
}

// One observer belongs to each persistent app root. A portrait's own native
// decoder is the authority; no extra image, preload, or replacement is created.
export function connectApprovedPortraitVisibility(root){
  if(connections.has(root))return connections.get(root);
  const Observer=(root?.ownerDocument||root)?.defaultView?.MutationObserver||globalThis.MutationObserver;
  if(!root?.querySelectorAll||!Observer)return {dispose(){}};
  let disposed=false;
  const pending=new Map();
  const inside=image=>image===root||root.contains(image);
  const current=(image,record)=>{
    if(disposed||pending.get(image)!==record||!inside(image))return false;
    const source=sourceOf(image);
    return source?.source===record.source&&source.attribute===record.attribute;
  };
  const forget=(image,{clearState=false}={})=>{
    const record=pending.get(image);
    if(record){record.cleanup?.();pending.delete(image);}
    if(clearState)image.removeAttribute(stateAttribute);
  };
  const finish=(image,record,state)=>{
    if(!current(image,record))return;
    record.cleanup?.();record.cleanup=null;
    image.setAttribute(stateAttribute,state);
  };
  const track=(image,{changed=false}={})=>{
    if(image.tagName!=='IMG'||!inside(image))return;
    const source=sourceOf(image),previous=pending.get(image);
    if(!source){if(previous)forget(image,{clearState:true});return;}
    if(!changed&&previous?.source===source.source&&previous.attribute===source.attribute)return;
    forget(image);
    const record={...source,cleanup:null};pending.set(image,record);
    // Mutation observers run before the next paint. Hide synchronously before
    // invoking decode, including for images already present in the cache.
    image.setAttribute(stateAttribute,'loading');
    if(typeof image.decode==='function'){
      try{
        Promise.resolve(image.decode()).then(
          ()=>finish(image,record,image.naturalWidth>0?'ready':'unavailable'),
          ()=>finish(image,record,'unavailable')
        );
      }catch{finish(image,record,'unavailable');}
      return;
    }
    const settle=()=>{
      if(!current(image,record)||!image.complete)return;
      // A delayed load/error event has no source field. The image itself must
      // report the currently requested resource before the fallback accepts it.
      if(image.currentSrc&&new URL(image.currentSrc,image.ownerDocument?.baseURI).href!==record.source)return;
      finish(image,record,image.naturalWidth>0?'ready':'unavailable');
    };
    image.addEventListener('load',settle);image.addEventListener('error',settle);
    record.cleanup=()=>{image.removeEventListener('load',settle);image.removeEventListener('error',settle);};
    settle();
  };
  const visit=node=>{
    if(!node?.querySelectorAll)return;
    track(node);node.querySelectorAll?.('img').forEach(image=>track(image));
  };
  const observer=new Observer(records=>{
    if(disposed)return;
    const changed=new Set(),added=[];
    for(const record of records){
      if(record.type==='attributes')changed.add(record.target);
      else if(record.type==='childList')added.push(...record.addedNodes);
    }
    // Rebind once per batch, even when A → B → A leaves the final URL equal to
    // its old value. Native decoding of the original request was invalidated.
    for(const image of changed)track(image,{changed:true});
    for(const node of added)visit(node);
    // Retire replaced panels instead of retaining their image/listener trees.
    for(const image of pending.keys())if(!inside(image))forget(image);
  });
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  visit(root);
  const connection={dispose(){
    if(disposed)return;disposed=true;observer.disconnect();
    for(const image of pending.keys())forget(image);
    connections.delete(root);
  }};
  connections.set(root,connection);return connection;
}
