export function installDefenderTemplate(field,entry,scene){
  if(field.disposed)return false;
  field.imported.set(`${entry.family}:${entry.tier}`,scene);
  let changed=false;
  for(const tower of field.game.towers){
    const rank=field.game.data.towers[tower.family]?.advanced?1:tower.tier;
    if(tower.state==='ruin'||tower.family!==entry.family||rank!==entry.tier)continue;
    const model=field.models.get(tower.id);if(model){model.signature='';changed=true;}
  }
  if(changed)field.sync();return true;
}

// Figure selection must hit the elevated model, not the ground tile behind it.
export function pointedTower(raycaster,models){
  const objects=[];const ids=new Map();for(const [id,model] of models){objects.push(model.object);ids.set(model.object,id);}
  const hit=raycaster.intersectObjects(objects,true)[0];if(!hit)return null;
  for(let node=hit.object;node;node=node.parent)if(ids.has(node))return ids.get(node);
  return null;
}
