// Independently required actual rider chains. Author scope declarations cannot
// substitute a sibling rider with the same semantic labels for these surfaces.
import {physicalSurfaceGap} from '../game/render/geometric-contacts.js';
import {partSemanticV5 as semantic} from './audit-geometric-proportions-v5.mjs';

const mountedHumans=new Set(['host_05','host_15','host_19','host_25','host_27','host_28','host_29','host_30','host_34','host_35','host_37','host_39','host_42','host_45','host_47','host_48','host_50']);
const below=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
const originalName=node=>node.userData?.name||node.name;
const starts=(node,name)=>node.name.startsWith(name)||originalName(node).startsWith(name);
const matches=(node,name)=>node.name===name||originalName(node)===name;

export function inspectActualRiderAnatomyV6(actor,meshes,{id,toleranceM=.004}={}){
 if(!mountedHumans.has(id))return [];
 const checks=[],joints=[];actor.traverse(node=>{if(!node.isMesh)joints.push(node);});
 const check=(name,passed,measurements)=>checks.push({name,passed:!!passed,measurements});
 const regions=(joint,test)=>joint?meshes.filter(node=>below(node,joint)&&test(semantic(node))):[];
 const heads=joints.filter(joint=>/(?:^|_)head_pivot$/.test(originalName(joint))&&regions(joint,part=>['Observed face','Face'].includes(part)).length&&regions(joint.parent,part=>part.startsWith('V6 rider source seated thorax')).length);
 const expected=id==='host_45'?2:1;
 check('independent actual rider count matches the original source',heads.length===expected,{expected,actualHeads:heads.map(originalName),criterion:'Actual skin surfaces in distinct native head/torso chains, not an author-declared rider count'});
 for(const head of heads){
  const name=originalName(head),prefix=name.slice(0,-'head_pivot'.length),label=prefix||'main_',torso=head.parent;
  const surface={head:regions(head,part=>['Observed face','Face'].includes(part)),thorax:regions(torso,part=>part.startsWith('V6 rider source seated thorax')),pelvis:regions(torso,part=>part.startsWith('V6 rider source contacting seated pelvis'))};
  const pair=(key,a,b)=>{
   const left=surface[a]||[],right=surface[b]||[],actual=physicalSurfaceGap(left,right);
   check('mandatory actual '+label+'rider '+key,left.length&&right.length&&!left.some(node=>right.includes(node))&&actual.gap<=toleranceM,{partsA:left.map(node=>({part:semantic(node),mesh:node.name})),partsB:right.map(node=>({part:semantic(node),mesh:node.name})),actualGapM:Number.isFinite(actual.gap)?actual.gap:null,toleranceM,actualTriangleIntersection:!!actual.intersecting,actualSolidContainment:!!actual.contained,criterion:'Independent per-rider actual triangle surfaces; repeated labels cannot select another rider'});
  };
  pair('head to thorax','head','thorax');pair('thorax to pelvis','thorax','pelvis');
  for(const side of ['L','R']){
   const upper=joints.find(joint=>joint.parent===torso&&matches(joint,prefix+'upper_arm_'+side)),fore=joints.find(joint=>joint.parent===upper&&matches(joint,prefix+'forearm_'+side)),hand=joints.find(joint=>joint.parent===fore&&matches(joint,prefix+'hand_'+side));
   const skin=kind=>part=>part.toLowerCase().includes(kind)&&!/(plate|shell|armor|armour|rivet|spike|cuff)/i.test(part);
   surface['upper'+side]=regions(upper,skin('upper arm')).filter(node=>!fore||!below(node,fore));surface['fore'+side]=regions(fore,skin('forearm')).filter(node=>!hand||!below(node,hand));surface['hand'+side]=regions(hand,part=>part.startsWith('Grasping hand')||part.includes('source grasping palm')||part==='Crossbow gripping palm '+side);
   // Mount hips can use the old unprefixed names. Select the actual rider
   // thighs first, so an animal's identically named hip cannot satisfy this.
   const hips=joints.filter(joint=>starts(joint,prefix+'upper_leg_'+side)&&regions(joint,part=>part.startsWith('V6 rider actual connected seated thigh '+side)).length);
   const hip=hips.length===1?hips[0]:null,shin=joints.find(joint=>joint.parent===hip&&starts(joint,prefix+'shin_'+side)),foot=joints.find(joint=>joint.parent===shin&&starts(joint,prefix+'foot_'+side));
   surface['thigh'+side]=regions(hip,part=>part.startsWith('V6 rider actual connected seated thigh '+side));surface['shin'+side]=regions(shin,part=>part.startsWith('V6 rider actual naturally hanging shin '+side));surface['foot'+side]=regions(foot,part=>part.startsWith('Grounded boot '+side)||part.startsWith('V6 rider actual source boot '+side));
   pair(side+' shoulder','thorax','upper'+side);pair(side+' elbow','upper'+side,'fore'+side);pair(side+' wrist','fore'+side,'hand'+side);pair(side+' hip','pelvis','thigh'+side);pair(side+' knee','thigh'+side,'shin'+side);pair(side+' ankle','shin'+side,'foot'+side);
  }
 }
 return checks;
}
