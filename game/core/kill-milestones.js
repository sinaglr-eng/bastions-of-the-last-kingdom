const earlyTiers=new Map([[100,[1,2]],[1000,[2,4]],[5000,[3,6]]]);
const interval=10000;

export function nextKillTarget(claimedTarget=0){
  for(const target of earlyTiers.keys())if(target>claimedTarget)return target;
  return (Math.floor(claimedTarget/interval)+1)*interval;
}

export function killTargetFromId(id){
  const match=typeof id==='string'&&/^kills:global:([1-9]\d*)$/.exec(id);
  if(!match)return null;
  const target=Number(match[1]);
  return Number.isSafeInteger(target)&&(earlyTiers.has(target)||target%interval===0)?target:null;
}

export function killMilestone(target){
  if(!Number.isSafeInteger(target)||target<=0||!earlyTiers.has(target)&&target%interval!==0)return null;
  const [reward,xp]=earlyTiers.get(target)||[5,10];
  return {id:'kills:global:'+target,factionId:null,kind:'kills',name:'Seasonal enemy defeats',
    description:'Defeat enemies in verified account runs this season. All factions contribute to the same total.',
    target,reward,xp};
}
