const panels=new WeakMap();
const text=(node,value)=>{const next=String(value??'');if(node.textContent!==next){node.textContent=next;return true;}return false;};
const attribute=(node,name,value)=>{const next=String(value);if(node.getAttribute(name)!==next){node.setAttribute(name,next);return true;}return false;};

// Native portrait decoding adds an attribute to the IMG. Comparing serialized
// innerHTML with a template therefore replaces the portrait on every HUD tick.
// Patch semantic fields in mounted nodes instead, retaining the native decoder.
export function updatePinnedGoal(host,plan,images={}, {visible=true}={}){
  const hidden=!visible||!plan;let changed=host.hidden!==hidden;host.hidden=hidden;
  if(!plan)return changed;
  let panel=panels.get(host);
  if(!panel){
    const document=host.ownerDocument,open=document.createElement('button'),image=document.createElement('img'),copy=document.createElement('span'),name=document.createElement('strong'),progress=document.createElement('small'),missing=document.createElement('small'),unpin=document.createElement('button');
    open.type='button';open.className='pinned-goal-open';open.dataset.action='inspector-plan';image.alt='';missing.className='pinned-missing-basics';
    unpin.type='button';unpin.className='text-button';unpin.dataset.action='pin';unpin.textContent='Unpin';
    copy.append(name,progress,missing);open.append(image,copy);host.replaceChildren(open,unpin);
    panel={open,image,name,progress,missing,unpin};panels.set(host,panel);changed=true;
  }
  const tier=plan.tier||1,source=images[`${plan.family}:${tier}`]||(tier===1?images[plan.family]:'')||'';
  if(source)changed=attribute(panel.image,'src',source)||changed;
  else if(panel.image.hasAttribute('src')){panel.image.removeAttribute('src');changed=true;}
  panel.image.hidden=!source;
  changed=text(panel.name,plan.name)||changed;
  changed=text(panel.progress,`✓ ${plan.counts.built} built · ◆ ${plan.counts.draft} this round · ○ ${plan.counts.missing} missing`)||changed;
  changed=text(panel.missing,`Missing basics: ${plan.missingBasics?.summary||'None'}`)||changed;
  changed=attribute(panel.open,'aria-label',`Open pinned ${plan.name}`)||changed;
  changed=attribute(panel.unpin,'data-id',plan.recipe.id)||changed;
  changed=attribute(panel.unpin,'aria-label',`Unpin ${plan.name}`)||changed;
  return changed;
}
