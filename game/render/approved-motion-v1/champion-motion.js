// Local motion prototypes only. Approved GLBs and live combat code are read-only.
export const SUPPORTED_IDS = Object.freeze(['rimewatch','frostblade','roseguard','highking','crownofages','thornwarden','verdantguard','tempest','stormcitadel','embercrown','worldfire','starfall','thunderheart','phoenix','greenheart','eldergrove','kingsreach','sunward','winterhold','dawnspire','royalmarshal','stonewarden','wyvernhunter','royalarsenal','rangermentor','kingdomprotector','mothernature','royalranger','kingsrangerguard','elvenking','fireballista','emeraldgolem','griffinbomber','mechanicalgolem','monk','archbishop','archangel','ladyclaire']);
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const curve=(p,keys)=>{for(let i=1;i<keys.length;i++){if(p<=keys[i][0]){const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*smooth(a,b,p);}}return keys.at(-1)[1];};
const cycle=(t,d)=>((t%d)+d)%d/d;

export function createChampionMotion(THREE,scene,entry,helpers){
  const id=entry.id,rig=helpers.createRig(THREE,scene),channels=[],notes=[];
  const duration=CHAMPION_DURATIONS[id]||1;
  const owned=new Set(),visibility=new Map(),bindingGroups=[];
  // GLTF multi-material children retain mesh-definition names, while the
  // authored semantic name lives on their actual ancestor node.
  const semantic=new Map();
  for(const[name,node]of rig.nodes){let current=node,label=name;while(current&&current!==scene){if(typeof current.userData?.name==='string'){label=current.userData.name;break;}current=current.parent;}semantic.set(name,label);}
  const label=name=>semantic.get(name)||name;
  const find=regex=>[...rig.nodes.keys()].filter(name=>{regex.lastIndex=0;if(regex.test(label(name)))return true;regex.lastIndex=0;return regex.test(name);});
  const own=(names,description)=>{for(const n of names){if(owned.has(n))throw new Error('Overlapping champion part ownership: '+n);owned.add(n);}if(names.length){channels.push(description+' ('+names.length+' mesh parts)');bindingGroups.push({channel:description,actualRuntimePrimitiveNames:[...names],actualAuthoredNodeNames:[...new Set(names.map(label))]});}return names;};
  const deform=(key,names,label)=>names.length?rig.deformer(key,own(names,label)):null;
  const turn=(point,pivot,axis,angle,weight=1)=>{
    if(!weight||!angle)return;
    point.sub(pivot).applyAxisAngle(axis,angle*weight).add(pivot);
  };
  const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
  const handlers=[];
  const required=(condition,text)=>{if(!condition)notes.push('NOT IMPLEMENTED: '+text);return condition;};
  let releaseTime=id==='embercrown'?null:duration*.4,status='partial';

  if(id==='rimewatch'){
    const arms=find(/Watchman.*(?:LEFT|RIGHT)/i),sword=find(/Watchman.*single.*greatsword/i);
    if(required(arms.length>=8&&sword.length>=2,'exact two complete arm assemblies and both coherent sword parts are required')){
      const pivot=rig.center(find(/Watchman.*fitted.*palm/i));
      const field=deform('watchman-shared-grip',[...arms,...sword],'Shared two-hand hilt and sword cut with shoulder attachment falloff');
      handlers.push((time,options,p)=>{
        if(options.mode==='idle')return;
        const angle=curve(p,[[0,0],[.20,-.18],[.34,-.24],[.48,.86],[.67,.58],[1,0]]);
        field.apply((point,name)=>{
          const rigid=/palm|greatsword/i.test(name);
          const w=rigid?1:1-smooth(.65,.735,point.y);
          turn(point,pivot,X,angle,w);
          turn(point,pivot,Z,-angle*.28,w);
        });
      });
      notes.push('Hands, hilt and complete blade receive the same rigid transform; arm/sleeve vertices blend to stationary shoulders. Lower body, helmet and feet remain fixed.');
      notes.push('Visible shared-grip sword slash with anticipation and diagonal follow-through; independent elbow articulation and full collision/contact approval remain pending.');
    }
  }else if(['embercrown','worldfire','thunderheart','phoenix'].includes(id)){
    // The two actual multi-material GLB nodes have retained temporary mesh
    // definition names. GLTFLoader gives their primitive meshes those names,
    // rather than the authored Body/Throat group names. Bind these exact two
    // recorded definitions, keeping skin and ivory underside requirements separate.
    const all=find(/./);
    const body=find(/^Body|^TEMP[ _]V8[ _]source[ _]broad[ _]octagonal[ _]thorax[ _]abdomen[ _]pelvis[ _]geometry(?:_\d+)?$/i);
    const throat=find(/^Throat|^TEMP[ _]V8[ _]complete[ _]broad[ _]convex[ _]exterior[ _]ivory[ _]source[ _]planes[ _]geometry(?:_\d+)?$/i);
    const leftWing=find(/^Wing.*left/i),rightWing=find(/^Wing.*right/i),jaw=find(/^Head.*mandible/i);
    if(required(body.length>0&&throat.length>0&&leftWing.length>0&&rightWing.length>0&&jaw.length>0,'continuous skin, complete ivory underside, both wing assemblies and actual lower jaw are required')){
      const field=deform('dragon-continuous-breath',all,'Localized continuous chest/neck breath, wing-tip flex and lower jaw');
      const bodyBox=rig.bounds(body),jawBox=rig.bounds(jaw),h=bodyBox.max.y;
      const jawPivot=new THREE.Vector3((jawBox.min.x+jawBox.max.x)/2,jawBox.max.y,jawBox.min.z);
      const rootX=Math.max(Math.abs(bodyBox.min.x),Math.abs(bodyBox.max.x))*.88;
      const rootZ=bodyBox.min.z+(bodyBox.max.z-bodyBox.min.z)*.66;
      const leftRoot=new THREE.Vector3(rootX,h*.84,rootZ),rightRoot=new THREE.Vector3(-rootX,h*.84,rootZ);
      const jawSet=new Set(jaw),wingSet=new Set([...leftWing,...rightWing]);
      const auraOnly=id==='embercrown'||id==='worldfire';
      handlers.push((time,options,p)=>{
        const breath=Math.sin(time*2*Math.PI/(id==='embercrown'?3.6:4.4)),wing=Math.sin(time*2*Math.PI/4.8+.5);
        const mouth=auraOnly?.5+.5*breath:options.mode==='idle'?.12+.08*breath:curve(p,[[0,.08],[.25,.22],[.43,1],[.62,.9],[1,.08]]);
        field.apply((point,name)=>{
          // One continuous scene-rest field on every part preserves shared
          // attachment coordinates. Feet and distal tail have exactly zero weight.
          const chest=smooth(h*.31,h*.68,point.y)*(1-smooth(h*.89,h*1.15,point.y))*smooth(bodyBox.min.z,rootZ,point.z)*(1-smooth(bodyBox.max.z*.64,bodyBox.max.z*1.12,point.z));
          point.x*=1+.010*breath*chest;
          point.z+=h*.007*breath*chest;
          if(wingSet.has(name)){
            const left=point.x>0,root=left?leftRoot:rightRoot;
            const rootFade=smooth(rootX*1.1,rootX*2.1,Math.abs(point.x));
            turn(point,root,Z,(left?1:-1)*.12*wing,rootFade);
          }
          if(jawSet.has(name))turn(point,jawPivot,X,.42*mouth);
        });
      });
      if(auraOnly)releaseTime=null;
      notes.push(auraOnly?'Continuous aura-only breathing with visibly opening real mandible; no shot, hit, projectile or damage gate.':'Actual mouth opens for the ordinary attack; continuous heat and conditional lightning remain independently governed combat effects.');
      notes.push('The localized cloned body field leaves floor contacts stationary; this is not whole-body bobbing.');
      notes.push('Partial prototype: jaw, chest field and root-faded wing motion require visual contact review; no full anatomical skeleton is claimed.');
    }
  }else if(['kingsreach','fireballista','emeraldgolem'].includes(id)){
    const limbs=find(/Ballista.*(?:curved.*laminate|limb.*collar|exposed.*limb.*bolt|top.*clamp)/i),strings=find(/Ballista.*drawn.*bowstring/i);
    const bolt=find(/Ballista.*(?:loaded.*bolt|steel.*bolt.*head)/i),latch=find(/Ballista.*trigger.*latch/i),winch=find(/Ballista.*(?:transverse.*winch.*barrel|winch.*hub.*rim)/i);
    if(required(limbs.length>=4&&strings.length>=3&&bolt.length>=4,'both physical limbs, three rope strands and complete four-part loaded bolt are required')){
      const field=deform('ballista-working-mechanism',[...new Set([...limbs,...strings,...bolt,...latch,...winch])],'Matched bow-limb flex, actual rope nock, latch, winch and departing bolt');
      const boltSet=new Set(bolt),strSet=new Set(strings),limbSet=new Set(limbs),latchSet=new Set(latch),winchSet=new Set(winch);
      const winchPivot=rig.center(winch),latchPivot=rig.center(latch);
      const ropeBox=rig.bounds(strings),ropeCenter=ropeBox.getCenter(new THREE.Vector3()),ropeHalf=(ropeBox.max.x-ropeBox.min.x)/2;
      const nockAdvance=(ropeBox.max.z-ropeBox.min.z)*.98,limbFlex=ropeHalf*.028,flight=rig.bounds(bolt).getSize(new THREE.Vector3()).z*.52;
      scene.traverse(node=>{if(boltSet.has(node.name))visibility.set(node,node.visible);});
      handlers.push((time,options,p)=>{
        if(options.mode==='idle')return;
        const snap=curve(p,[[0,0],[.35,0],[.41,1],[.54,1],[.91,0],[1,0]]);
        const fly=p>=.40&&p<.55?smooth(.40,.55,p):0;
        for(const[node,rest]of visibility)node.visible=rest&&!(p>=.55&&p<.91);
        field.apply((point,name)=>{
          if(strSet.has(name))point.z+=nockAdvance*snap*(1-smooth(0,ropeHalf,Math.abs(point.x-ropeCenter.x)));
          else if(limbSet.has(name))point.z+=limbFlex*snap*smooth(ropeHalf*.16,ropeHalf*.95,Math.abs(point.x-ropeCenter.x));
          else if(boltSet.has(name))point.z+=flight*fly;
          else if(latchSet.has(name))turn(point,latchPivot,X,-.09*snap);
          else if(winchSet.has(name))turn(point,winchPivot,X,p>.55?(1-snap)*Math.PI*.5:0);
        });
      });
      notes.push('Four wheels, rail and carriage stay fixed. Original rope strands deform from recorded rest; original bolt geometry translates together, is hidden only after departure, and returns during visual reload.');
      notes.push('Partial mechanism: target flight, ammunition sourcing, contact certification and a physically exact elastic laminate solve are not implemented.');
      if(id==='emeraldgolem'){
        const head=find(/Golem.*source.*angular.*head/i);
        if(head.length){own(head,'Actual stone head gaze and aiming');rig.joint('golem-gaze',{names:head,pivot:rig.center(head).toArray()});handlers.push((time,options)=>{rig.rotate('golem-gaze',0,options.proc==='stone-gaze'?.17*Math.sin(time*.5):.04*Math.sin(time*1.2),0);});}
      }
    }
  }else if(id==='frostblade'){
    const arm=find(/Rider.*RIGHT/i),spear=find(/Frost.*Knight.*(?:spear.*point|icy.*shaft)/i);
    if(required(arm.length>=3&&spear.length>=2,'complete actual right arm and both spear parts are required')){
      const pivot=rig.center(find(/Rider.*RIGHT.*palm/i));
      const field=deform('mounted-shared-spear-grip',[...arm,...spear],'Right-hand spear presentation with anchored rider shoulder');
      handlers.push((time,options,p)=>{
        if(options.mode==='idle')return;
        const thrust=curve(p,[[0,0],[.26,-.15],[.38,-.12],[.47,1],[.62,.62],[1,0]]);
        field.apply((point,name)=>{
          const rigid=/palm|spear|shaft/i.test(name),w=rigid?1:1-smooth(1.30,1.389,point.y);
          turn(point,pivot,X,.33*thrust,w);
          point.z+=.09*thrust*w;
        });
      });
      notes.push('One shared transform preserves right palm/shaft/point grip. Shield, left rein hand, tack, rider pelvis, horse and hooves stay fixed.');
      notes.push('Partial lance presentation only; full couching, horse gait, torso compensation and independent elbows remain pending rather than falsely simulated by horse bob.');
    }
  }else if(id==='ladyclaire'){
    const right=find(/^(?:Arm|Hand).*right|^Clothing.*right.*sleeve|^Weapon/i),left=find(/^(?:Arm|Hand).*left|^Clothing.*left.*sleeve/i),crystals=find(/^VFX.*amber.*crystal/i);
    // Each actual crystal node has two material primitives in the GLB; keep
    // those two meshes together rather than mistaking them for six crystals.
    const crystalGroups=[1,2,3].map(i=>crystals.filter(name=>new RegExp('crystal[ _]+'+i+'(?:[ _]|$)','i').test(name)));
    const completeCrystals=crystalGroups.every(names=>names.length>0)&&crystalGroups.flat().length===crystals.length;
    if(required(right.length>=8&&left.length>=3&&completeCrystals,'complete right staff/grip/sleeves, left arm/sleeve and exactly three complete crystal groups are required')){
      const field=deform('claire-complete-cast',[...right,...left],'Connected staff-and-grasp casting island and empty blessing arm');
      const rightSet=new Set(right),handPivot=rig.center(find(/^Hand.*right/i)),leftPivot=new THREE.Vector3(.11,.585,0);
      const shoulderR=new THREE.Vector3(-.11,.595,0);
      handlers.push((time,options,p)=>{
        const melancholy=options.melancholy===true||options.proc==='melancholy';
        const cast=options.mode==='idle'?0:melancholy?-.42:curve(p,[[0,0],[.24,-.20],[.38,-.10],[.47,1],[.65,.45],[1,0]]);
        field.apply((point,name)=>{
          if(rightSet.has(name)){
            const rigid=/^Weapon|^Hand/i.test(name),w=rigid?1:smooth(.035,.18,point.distanceTo(shoulderR));
            turn(point,handPivot,X,.035*cast,w);
          }else{
            const w=/^Hand/i.test(name)?1:smooth(.025,.16,point.distanceTo(leftPivot));
            turn(point,leftPivot,X,-.13*cast,w);turn(point,leftPivot,Z,.09*cast,w);
          }
        });
      });
      for(let i=0;i<crystalGroups.length;i++){
        const names=own(crystalGroups[i],'Amber crystal '+(i+1)+' independent spin and vertical response'),key='claire-crystal-'+i;
        rig.joint(key,{names,pivot:rig.center(names).toArray()});
        handlers.push((time,options)=>{const muted=options.melancholy||options.proc==='melancholy';rig.rotate(key,0,time*(muted?.12:.55),0);rig.translate(key,0,.008*Math.sin(time*(muted?.7:1.8)+i*2.1),0);});
      }
      notes.push('Staff shaft, ferrules, ring and grasp share the same transform; sleeve and anatomical chain use shoulder falloff on cloned buffers. Feet, gown and seven-point crown stay fixed.');
      notes.push('Melancholy is externally selected state only: lowered pose suppresses the preview cast. No random proc, lightning damage, actual game event or automatic state duration is implemented.');
    }
  }
  if(!handlers.length)buildAdditionalChampion({THREE,scene,id,rig,find,label,own,deform,turn,channels,notes,handlers,visibility,duration});
  if(!handlers.length)notes.push('NOT IMPLEMENTED: no model-appropriate channels bound; no generic bobbing is substituted for articulation.');
  const summary=channels.length?'Partial local champion prototype. '+notes.join(' '):'No safe champion articulation bound. '+notes.join(' ');
  const reset=()=>{rig.reset();for(const[node,visible]of visibility)node.visible=visible;};
  return {duration,releaseTime,status,channels,summary,bindingGroups,
    update(time,options={}){
      reset();
      const opts={mode:'attack',...options};
      const clock=Number.isFinite(time)?time:0,p=cycle(clock,duration);
      for(const fn of handlers)fn(clock,opts,p);
    },reset,dispose(){reset();rig.dispose?.();}};
}

const CHAMPION_DURATIONS={rimewatch:1,frostblade:.8,roseguard:1,highking:.75,crownofages:.65,thornwarden:.8,verdantguard:.7,tempest:.5,stormcitadel:.5,embercrown:3.6,worldfire:4.4,starfall:1,thunderheart:1,phoenix:.6,greenheart:.5,eldergrove:.5,kingsreach:.8,sunward:1,winterhold:1,dawnspire:.6,royalmarshal:.6,stonewarden:.5,wyvernhunter:.6,royalarsenal:.25,rangermentor:.5,kingdomprotector:.6,mothernature:.5,royalranger:.5,kingsrangerguard:.6,elvenking:.6,fireballista:.5,emeraldgolem:.5,griffinbomber:.6,mechanicalgolem:1,monk:.6,archbishop:1,archangel:1,ladyclaire:.5};

function buildAdditionalChampion(C){
  const {THREE,scene,id,rig,find,label,own,deform,turn,notes,handlers,visibility}=C;
  const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
  const all=find(/./),box=rig.bounds(all),height=box.max.y-box.min.y;
  const pose=p=>curve(p,[[0,0],[.23,-.20],[.35,-.18],[.48,1],[.65,.55],[1,0]]);
  const uniq=names=>[...new Set(names)];
  const rArm=find(/^(?:RIGHT\b.*\b(?:arm|hand)\b|(?:Arm|Hand)\b.*\bright\b)|\b(?:rider|pilot|Firebomber)\s+RIGHT\b|^Clothing.*right.*sleeve|^Armor.*right.*(?:vambrace|wrist|gauntlet|glove)/i);
  const lArm=find(/^(?:LEFT\b.*\b(?:arm|hand)\b|(?:Arm|Hand)\b.*\bleft\b)|\b(?:rider|pilot|Firebomber)\s+LEFT\b|^Clothing.*left.*sleeve|^Armor.*left.*(?:vambrace|wrist|gauntlet|glove)/i);
  const palms=names=>names.filter(n=>/palm|\bhand\b/i.test(label(n)));
  const handCenter=names=>rig.center(palms(names).length?palms(names):names);
  const shoulder=(names,hand)=>{const b=rig.bounds(names);return new THREE.Vector3(hand.x<0?b.max.x:b.min.x,b.max.y,b.min.z+(b.max.z-b.min.z)*.20);};
  const weight=(point,root,hand)=>smooth(height*.018,Math.max(height*.075,root.distanceTo(hand)*.70),point.distanceTo(root));
  function wingMotion(pattern,amplitude=.14){
    const names=find(pattern);if(!names.length)return;
    const field=deform('wing-support-'+handlers.length,names,'Actual feather-wing root flex and delayed tip response');
    const wb=rig.bounds(names),xExtent=Math.max(Math.abs(wb.min.x),Math.abs(wb.max.x));
    const rootY=wb.min.y+(wb.max.y-wb.min.y)*.30;
    handlers.push((time,options,p)=>{const flap=Math.sin(time*2.4)+(options.mode==='idle'?0:pose(p)*.7);field.apply(point=>{const left=point.x>0;turn(point,new THREE.Vector3((left?1:-1)*xExtent*.18,rootY,wb.getCenter(new THREE.Vector3()).z),Z,(left?1:-1)*amplitude*flap,smooth(xExtent*.18,xExtent*.56,Math.abs(point.x)));});});
  }
  function armAndProp(right,left,prop,{kind='staff',leftProp=[],angle=.23}={}){
    if(!right.length||!prop.length)throw new Error(id+': actual complete right-arm/held-prop group missing');
    const names=uniq([...right,...left,...prop,...leftProp]),field=deform('complete-'+kind,names,'Connected '+kind+' attack: actual grasp, complete held prop, anatomical arm and fitted cuffs');
    const rs=new Set(right),ls=new Set(left),ps=new Set(prop),lp=new Set(leftProp);
    const rp=new Set(palms(right)),llp=new Set(palms(left));
    const hr=handCenter(right),sr=shoulder(right,hr),hl=left.length?handCenter(left):null,sl=left.length?shoulder(left,hl):null;
    handlers.push((time,options,p)=>{
      const value=options.mode==='idle'?0:pose(p);
      field.apply((point,name)=>{
        if(ps.has(name)||rs.has(name)){
          const rigid=ps.has(name)||rp.has(name),w=rigid?1:weight(point,sr,hr);
          turn(point,kind==='throw'?sr:hr,X,angle*value,w);
          if(kind==='sword'||kind==='hammer')turn(point,hr,Z,-angle*.23*value,w);
        }else if(hl&&(ls.has(name)||lp.has(name))){
          const w=lp.has(name)||llp.has(name)?1:weight(point,sl,hl);
          turn(point,sl,X,-.36*value,w);turn(point,sl,Z,.15*value,w);
        }
      });
    });
    notes.push('Authored-node ancestry groups every material primitive with its actual arm/prop. Grasp and held prop remain one transform; connected sleeves fall to fixed shoulders. No damage is generated by the preview.');
  }
  const archers=['thornwarden','verdantguard','wyvernhunter','royalranger','kingsrangerguard','elvenking'];
  const elfCasters=['tempest','stormcitadel','greenheart','eldergrove','mothernature','royalarsenal'];
  const clergy=['sunward','monk','archbishop','archangel'];
  if(archers.includes(id)){
    const strings=find(/^Actual.*string.*nock/i),bow=find(/^(?:Bow\b|Upper bow|Lower bow|Obsidian bow)/i),arrow=find(/^Drawn arrow/i);
    if(!strings.length||!bow.length||!rArm.length||!lArm.length)throw new Error(id+': physical bow, drawn strings or complete arms missing');
    const branches=[1,2].map(i=>strings.filter(n=>new RegExp('nock '+i+'$','i').test(label(n))));
    if(branches.some(x=>!x.length))throw new Error(id+': both real string branches required');
    const inverse=scene.matrixWorld.clone().invert();
    function points(names){const out=[],seen=new Set(),v=new THREE.Vector3();for(const n of names){const m=rig.nodes.get(n),matrix=inverse.clone().multiply(m.matrixWorld),a=m.geometry.getAttribute('position');for(let k=0;k<a.count;k++){v.fromBufferAttribute(a,k).applyMatrix4(matrix);const key=v.toArray().map(x=>x.toFixed(7)).join(',');if(!seen.has(key)){seen.add(key);out.push(v.clone());}}}return out;}
    const bp=branches.map(points);let best=Infinity,nock=null;
    for(const a of bp[0])for(const b of bp[1]){const d=a.distanceToSquared(b);if(d<best){best=d;nock=a.clone().add(b).multiplyScalar(.5);}}
    const tips=bp.map(list=>list.reduce((a,b)=>a.distanceToSquared(nock)>b.distanceToSquared(nock)?a:b).clone());
    const middle=tips[0].clone().add(tips[1]).multiplyScalar(.5),axis=nock.clone().sub(middle).normalize();
    if(axis.lengthSq()<.5)throw new Error(id+': degenerate actual bowstring draw axis');
    const forward=axis.clone().negate(),hand=handCenter(rArm),root=shoulder(rArm,hand),bs=new Set(bow),ss=new Set(strings),as=new Set(arrow),rs=new Set(rArm);
    const handParts=new Set(palms(rArm));
    const limbWeight=point=>clamp(Math.abs(point.y-middle.y)/Math.max(Math.abs(tips[0].y-middle.y),Math.abs(tips[1].y-middle.y),height*.2));
    const sets=branches.map(x=>new Set(x)),field=deform('real-bow-draw',uniq([...strings,...bow,...arrow,...rArm]),'Actual bowstring draw, coordinated drawing hand, limb flex and physical nocked arrow');
    for(const n of arrow){const node=rig.nodes.get(n);visibility.set(node,node.visible);}
    handlers.push((time,options,p)=>{
      if(options.mode==='idle')return;
      const reach=smooth(0,.22,p)*(1-smooth(.78,1,p)),draw=curve(p,[[0,0],[.32,1],[.40,1],[.45,.1],[.78,.1],[1,0]]);
      const extra=axis.clone().multiplyScalar(height*.065*draw);
      const handTarget=nock.clone().add(axis.clone().multiplyScalar(height*.065*Math.max(draw,p>.4&&p<.7?.85:0)));
      handTarget.addScaledVector(axis,height*.012*draw*limbWeight(nock));
      const handDelta=handTarget.sub(hand).multiplyScalar(reach);
      const snap=smooth(.40,.455,p)*(1-smooth(.84,.97,p));
      const nockDelta=extra.clone().add(middle.clone().sub(nock).multiplyScalar(snap));
      const flight=smooth(.405,.61,p);
      for(const n of arrow)rig.nodes.get(n).visible=visibility.get(rig.nodes.get(n))&&!(p>.61&&p<.89);
      field.apply((point,name)=>{
        if(rs.has(name))point.addScaledVector(handDelta,handParts.has(name)?1:weight(point,root,hand));
        else if(ss.has(name)){
          const which=sets[0].has(name)?0:1,length=tips[which].distanceTo(nock);
          const flex=limbWeight(point);
          point.addScaledVector(nockDelta,clamp(1-point.distanceTo(nock)/Math.max(length,1e-6)));
          point.addScaledVector(axis,height*.012*draw*flex);
        }else if(as.has(name)){
          point.add(extra);
          if(p>=.405&&p<.61)point.addScaledVector(forward,height*1.05*flight);
        }else if(bs.has(name)){
          const limb=limbWeight(point);
          point.addScaledVector(axis,height*.012*draw*limb);
        }
      });
    });
    notes.push('Nock and tips come from the closest actual rest-vertex contact between the two authored rope branches. Drawing hand reaches that same nock before release; tips stay on the original bow. One simultaneous volley, never one draw per target.');
  }else if(elfCasters.includes(id)||clergy.includes(id)){
    const prop=find(/^Weapon|\bstaff\b|crozier/i).filter(n=>!rArm.includes(n)&&!lArm.includes(n)&&!/\barm\b|\bhand\b/i.test(label(n)));
    const book=find(/\bbook\b/i);
    armAndProp(rArm,lArm,prop,{kind:'staff',leftProp:book,angle:elfCasters.includes(id)?.20:.13});
    if(id==='archangel')wingMotion(/^Wing/i,.10);
    const floats=find(/^(?:VFX|Magic)|woodland.*spirit|floating.*(?:spirit|crystal)|lower.*seed/i).filter(n=>!prop.includes(n)&&!rArm.includes(n)&&!lArm.includes(n)&&!book.includes(n));
    const grouped=new Map();for(const n of floats){const key=label(n);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(n);}
    for(const[key,names]of grouped){if(/halo|wing|neck|collar/i.test(key))continue;own(names,'Existing '+key+' support-focus response');const k='float-'+handlers.length+'-'+names[0];rig.joint(k,{names,pivot:rig.center(names).toArray()});handlers.push((time,options,p)=>{rig.rotate(k,0,time*.32,0);rig.translate(k,0,height*.006*Math.sin(time*1.4+names.length),0);});}
  }else if(['roseguard','highking','crownofages'].includes(id)){
    const arm=find(/^Rider RIGHT/i),prop=find(/^(?:Lionheart|Kingslayer|King royal).*(?:spear|lance|greatsword)/i);
    armAndProp(arm,[],prop,{kind:id==='roseguard'?'lance':'sword',angle:id==='roseguard'?.36:.68});
    notes.push('Horse, reins, left shield hand, saddle, pelvis, stirrups and hooves remain in their actual supported rest; attack is real rider arm and held-weapon articulation.');
  }else if(['winterhold','dawnspire','kingdomprotector'].includes(id)){
    armAndProp(rArm,[],find(/^Weapon/i),{kind:id==='kingdomprotector'?'hammer':'sword',angle:id==='kingdomprotector'?.78:.72});
    wingMotion(/^Wing/i,id==='dawnspire'?.12:.06);
  }else if(['royalmarshal','griffinbomber','mechanicalgolem'].includes(id)){
    const bombs=find(/\bbomb\b/i),twoHand=id==='royalmarshal',arms=twoHand?uniq([...rArm,...lArm]):rArm;
    if(!arms.length||!bombs.length)throw new Error(id+': attached bomb and complete throwing arm missing');
    const hand=twoHand?rig.center([...palms(rArm),...palms(lArm)]):handCenter(rArm),root=shoulder(rArm.length?rArm:arms,hand),bs=new Set(bombs),leftSet=new Set(lArm),leftRoot=twoHand?shoulder(lArm,handCenter(lArm)):root;
    const palmParts=new Set(palms(arms));
    const field=deform('real-bomb-throw',uniq([...arms,...bombs]),'Actual dwarf arm, grasp and bomb throw with connected shoulder falloff');
    for(const n of bombs){const node=rig.nodes.get(n);visibility.set(node,node.visible);}
    handlers.push((time,options,p)=>{
      if(options.mode==='idle')return;
      const value=pose(p),angle=-.85*value,flight=smooth(.43,.64,p);
      for(const n of bombs)rig.nodes.get(n).visible=visibility.get(rig.nodes.get(n))&&!(p>=.64&&p<.9);
      field.apply((point,name)=>{
        const rigid=bs.has(name)||palmParts.has(name),w=rigid?1:weight(point,twoHand&&leftSet.has(name)?leftRoot:root,hand);
        turn(point,root,X,angle,w);
        if(bs.has(name)&&p>=.43&&p<.64){point.z+=height*.65*flight;point.y+=height*.25*Math.sin(Math.PI*flight);}
      });
    });
    if(id==='griffinbomber')wingMotion(/^Griffin.*flight feather/i,.09);
    if(id==='mechanicalgolem'){
      const propellers=find(/propeller/i);
      const left=propellers.filter(n=>/blade 1 |hub 1$/i.test(label(n))),right=propellers.filter(n=>/blade -1 |hub -1$/i.test(label(n)));
      for(const[side,names]of [['left',left],['right',right]])if(names.length){own(names,'Actual '+side+' airship propeller rotation');const k='propeller-'+side,b=rig.bounds(names),size=b.getSize(new THREE.Vector3()),axis=size.x<size.y&&size.x<size.z?0:size.y<size.z?1:2;rig.joint(k,{names,pivot:b.getCenter(new THREE.Vector3()).toArray()});handlers.push(time=>{const a=[0,0,0];a[axis]=time*5;rig.rotate(k,...a);});}
    }
    notes.push(twoHand?'Both actual palms and the supported bomb share the casting transform; this preserves the authored two-hand cradle rather than separating a hand from its prop.':'Actual free throwing arm and bomb move; left rein/rail hand stays fixed. No carrier bob is counted as the attack.');
  }else if(id==='stonewarden'){
    const beam=find(/^Catapult.*(?:throwing beam|bowl|arm seating)/i),stone=find(/^Catapult.*loaded stone/i),rope=find(/^Catapult.*loading tension rope/i),pivotParts=find(/^Catapult.*(?:true source transverse timber pivot|physical pivot axle)/i);
    if(!beam.length||!stone.length||!pivotParts.length)throw new Error('Catapult real lever/bowl/stone/pivot missing');
    const pivot=rig.center(pivotParts),beamSet=new Set(beam),stoneSet=new Set(stone),ropeSet=new Set(rope),field=deform('actual-catapult-lever',uniq([...beam,...stone,...rope]),'Actual lever and stone bowl pivot, release stone and attached loading rope');
    for(const n of stone){const node=rig.nodes.get(n);visibility.set(node,node.visible);}
    handlers.push((time,options,p)=>{if(options.mode==='idle')return;const value=curve(p,[[0,0],[.25,-.08],[.41,1],[.58,1],[1,0]]),fly=smooth(.41,.64,p);for(const n of stone)rig.nodes.get(n).visible=visibility.get(rig.nodes.get(n))&&!(p>.64&&p<.91);field.apply((point,name)=>{turn(point,pivot,X,.95*value,ropeSet.has(name)?smooth(pivot.y-height*.18,pivot.y+height*.25,point.y):1);if(stoneSet.has(name)&&p>=.41&&p<.64){point.z+=height*1.1*fly;point.y+=height*.7*Math.sin(Math.PI*fly);}});});
  }else if(id==='rangermentor'){
    const names=find(/^Nature Spirit/i);if(!names.length)throw new Error('Actual leaf spirit body missing');
    const field=deform('leaf-spirit-cast',names,'Nonhuman leaf-arm opening and connected upper swirl twist');
    const center=rig.center(names),b=rig.bounds(names),span=b.max.x-b.min.x;
    handlers.push((time,options,p)=>{const value=options.mode==='idle'?.08*Math.sin(time):pose(p);field.apply(point=>{const upper=smooth(b.min.y,b.max.y,point.y);turn(point,center,Y,.28*value,upper);point.x+=Math.sign(point.x-center.x)*span*.07*value*smooth(span*.12,span*.35,Math.abs(point.x-center.x))*upper;});});
    notes.push('The actual leaf planes and energy-core surfaces twist and fan; there are no invented human legs, bear paws or held weapon.');
  }else if(id==='starfall'){
    wingMotion(/^Wing|^Magic.*wing/i,.38);
    const jaw=find(/lower avian mandible/i);if(jaw.length){const b=rig.bounds(jaw),pivot=new THREE.Vector3(b.getCenter(new THREE.Vector3()).x,b.max.y,b.min.z),field=deform('bird-beak',jaw,'Actual lower avian beak release');handlers.push((time,options,p)=>{field.apply(point=>turn(point,pivot,X,.18*(options.mode==='idle'?.12:Math.max(0,pose(p)))));});}
    if(!handlers.length)throw new Error('Thunderbird actual wing/beak assemblies missing');
  }
}
