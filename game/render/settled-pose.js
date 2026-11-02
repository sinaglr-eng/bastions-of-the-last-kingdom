const frozen=new WeakMap();
// A completed fall remains fully visible until the ordinary wave cleanup.
// Its private world matrices no longer need recomposing every render frame.
export function freezeSettledPose(root){
  if(!root?.userData.death?.settled||frozen.has(root))return false;
  root.updateWorldMatrix(true,true);const records=[];
  root.traverse(node=>{records.push([node,node.matrixAutoUpdate,node.matrixWorldAutoUpdate]);node.matrixAutoUpdate=false;node.matrixWorldAutoUpdate=false;});frozen.set(root,records);return true;
}
export function restoreSettledPose(root){
  const records=frozen.get(root);if(!records)return false;
  for(const[node,local,world]of records){node.matrixAutoUpdate=local;node.matrixWorldAutoUpdate=world;}frozen.delete(root);return true;
}
