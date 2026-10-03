"""Source physical surface selections; contains no pass flags or measurements."""
import json,bpy
from geometric_champion_creature_fit_v4 import semantic,descendants

def write_mounted_scope_v6(b,entry,mount,rider=None):
 wave=int(entry['id'].split('_')[1]);previous=json.loads(b.root.get('enemyPhysicalContractV6','{}'));contacts=list(previous.get('contacts',[]));cavities=list(previous.get('cavities',[]));helmets=list(previous.get('helmetRatios',[]))
 def choose(prefix):return list(dict.fromkeys(semantic(o)for o in b.objects if semantic(o).startswith(prefix)))
 def rel(name,a,c):
  assert a and c,(b.id,'missing actual physical source scope',name,a,c)
  contacts.append({'name':name,'leftParts':a,'rightParts':c})
 def human_rel(name,a,c,leftJoint,rightJoint):
  assert a and c,(b.id,'missing actual independently scoped rider relation',name)
  contacts.append({'name':name,'leftParts':a,'rightParts':c,'leftScopeJoint':leftJoint,'rightScopeJoint':rightJoint})
 def cavity(name,feature,shell,interior,joint=None):
  assert shell and interior,(b.id,'missing actual cavity',name)
  rec={'name':name,'sourceFeature':feature,'shellParts':shell,'interiorParts':interior,'minimumRecessM':.012,'nativeRayDirection':[0,-1,0]}
  if joint:rec['scopeJoint']=joint
  cavities.append(rec)
 body=choose(mount['thorax']);neck=choose(mount['neck']);skull=choose(mount['skull'])
 if wave==27:body+=choose('V6 Spectral bat actual contacting scapular wing bearing')+choose('V6 Spectral bat actual contacting articulated pelvic bone')
 if set(body)!=set(neck):rel('Actual thorax supports real cervical root',body,neck)
 if set(neck)!=set(skull):rel('Actual cervical volume touches skull bearing',neck,skull)
 if wave==28:
  rel('Actual bored engines seat into timber sidewalls',choose('V6 gyro actual cylindrical deeply bored side engine'),choose('V6 gyro source separate sidewall timber plank'))
 elif wave not in(19,37,47):
  for side in('L','R'):
   lead=choose('V6 source mounted wing shoulder elbow wrist bone '+side)or choose('V6 manta actual contacting fin leading forelimb')
   rel('Actual wing '+side+' forelimb touches anatomical thorax',body,lead)
   membrane=choose('V6 source mounted closed scalloped membrane '+side)or choose('V6 manta actual swept curved broad pectoral fin')
   rel('Actual wing '+side+' membrane joins its forelimb',lead,membrane)
 if wave in(19,37,47,50):
  labels=('BL','BR')if wave==50 else('FL','FR','BL','BR')
  for s in labels:
   thigh=choose('V6 mount anatomical thigh '+s);shin=choose('V6 mount anatomical shin '+s);paw=choose('V6 mount anatomical paw '+s)
   rel('Actual mount hip '+s+' enters torso',body,thigh);rel('Actual mount knee '+s+' joins thigh and shin',thigh,shin);rel('Actual mount ankle '+s+' joins paw',shin,paw)
 elif wave in(5,15,25,27,29,30,34,35,42,45,48):
  for s in('L','R'):
   thigh=choose('V6 bat actual contacting hind thigh '+s);shin=choose('V6 bat actual hind shin and ankle '+s);foot=choose('V6 bat actual contacting tarsal palm '+s)
   rel('Actual bat hip '+s+' joins thorax',body,thigh);rel('Actual bat knee '+s+' joins thigh and shin',thigh,shin);rel('Actual bat ankle '+s+' joins clawed palm',shin,foot)
 if wave not in(40,):
  rel('Actual rider pelvis bears into fitted source saddle or harness',choose('V6 rider source contacting seated pelvis'),choose('V6 rider real fitted source saddle seat')or choose('V6 hanging goblin source waist suspension harness'))
  rel('Actual rider thorax touches seated pelvis',choose('V6 rider source seated thorax'),choose('V6 rider source contacting seated pelvis'))
 if wave==25 and rider.get('actualSourceQuiverContact'):
  quiver=rider['actualSourceQuiverContact'];rel('Actual source rear quiver bears against fitted rider thorax',[quiver['quiverPart']],[quiver['bodyPart']])
  rel('Actual source back arrow shafts seat inside real quiver base',choose('V6 Iron Bat source actual whole seated back arrow shaft'),[quiver['quiverPart']])
 if wave==45:
  for prefix in('','drummer_'):
   torsoJoint=prefix+'torso_pivot'
   actualRider=rider['secondDrummer']if prefix else rider
   human_rel('Actual '+prefix+'rider head seated on its own structural thorax',['Observed face'],choose('V6 rider source seated thorax'),prefix+'head_pivot',torsoJoint)
   human_rel('Actual '+prefix+'rider thorax seats on its own pelvis',choose('V6 rider source seated thorax'),choose('V6 rider source contacting seated pelvis'),torsoJoint,torsoJoint)
   for side in('L','R'):
    human_rel('Actual '+prefix+side+' shoulder connects to its own thorax',['Upper arm '+side],choose('V6 rider source seated thorax'),prefix+'upper_arm_'+side,torsoJoint)
    human_rel('Actual '+prefix+side+' upper arm elbow interface',['Upper arm '+side],['Forearm '+side],prefix+'upper_arm_'+side,prefix+'forearm_'+side)
    human_rel('Actual '+prefix+side+' wrist meets its own grasping palm',['Forearm '+side],['Grasping hand '+side],prefix+'forearm_'+side,prefix+'hand_'+side)
    upperJoint=actualRider['actualRiderLegJoints'][side];upper=bpy.data.objects[upperJoint]
    shin=next(o for o in upper.children if o.type=='EMPTY'and o.name.startswith(prefix+'shin_'))
    human_rel('Actual '+prefix+side+' seated pelvis thigh bearing',choose('V6 rider source contacting seated pelvis'),choose('V6 rider actual connected seated thigh '+side),torsoJoint,upperJoint)
    human_rel('Actual '+prefix+side+' thigh knee interface',choose('V6 rider actual connected seated thigh '+side),choose('V6 rider actual naturally hanging shin '+side),upperJoint,shin.name)
 if wave==40:
  cavity('Actual dragon open jaw reaches deep interior','skull-mouth',skull+choose('V6 Hollow King actual open curved source lower jaw'),choose('V6 Hollow King actual deep open jaw interior'))
  cavity('Actual curved open rib cage exposes recessed captive soul','open-rib-cage',body+choose('Sky king broad dark shoulder mantle'),choose('Sky king central large green soul heart'))
 if wave==50:
  cavity('Actual thin source jaw seam opens into mouth','head-mouth',skull,choose('V6 Bernhard real deep jaw interior'))
  for side,k in(('L',0),('R',1)):
   e=mount['actualEyes'][k];cavity('Actual recessed amber eye '+side,'eye-'+side,skull,[semantic(bpy.data.objects[e['eye']])])
 if wave==27:
  cavity('Actual skeletal bat open angular jaw reaches deep interior','mount-skull-mouth',skull,choose('V6 Spectral bat actual deep dark jaw interior'),'mount_head_pivot')
  for side,k in(('L',0),('R',1)):
   e=mount['actualEyes'][k];cavity('Actual skeletal bat separate hollow square eye '+side,'mount-skull-eye-'+side,skull,[semantic(bpy.data.objects[e['eye']])],'mount_head_pivot')
  cavity('Actual source skeletal bat ribs surround physically open chest','open-rib-cage',choose('V6 Spectral bat actual open curved anatomical rib'),choose(mount['thorax']),'mount_torso_pivot')
 if wave==34:
  for side,k in(('L',0),('R',1)):
   e=mount['actualEyes'][k];cavity('Actual source bat ivory skull-mask aperture '+side,'mount-mask-eye-'+side,choose('V6 Bonecarrier bat source hollow ivory skull mask'),[semantic(bpy.data.objects[e['eye']])],'mount_head_pivot')
 if wave==47:
  for side in('L','R'):
   cavity('Actual canine ivory skull-mask eye socket '+side,'mount-mask-eye-'+side,choose('V6 Last Howl actual ivory wolf skull mask'),choose('V6 Last Howl skull mask actual deep red eye cavity '+side),'mount_head_pivot')
 if wave in(34,39):
  cavities=[r for r in cavities if r['sourceFeature']not in(('skull-mask-eye-L','skull-mask-eye-R')if wave==34 else('mask-eye-L','mask-eye-R'))]
  for side in('L','R'):
   cavity('Actual source mask eye aperture '+side,('skull-mask-eye-'if wave==34 else'mask-eye-')+side,choose('V6 source continuous fitted mask with real eye openings'),['Eye '+side],'head_pivot')
 if wave in(25,35,42,45,47):
  helmets=[r for r in helmets if not any(s.startswith('V6 source fitted rounded metal cap')or s.startswith('V6 source seated metal cap rim')for s in r['coverParts'])]
  for h in(('head_pivot','drummer_head_pivot')if wave==45 else('head_pivot',)):
   helmets.append({'name':'Actual rider source metal cap sagittal depth '+h,'coverParts':choose('V6 source fitted rounded metal cap')+choose('V6 source seated metal cap rim'),'depthToWidth':[.45,1.15],'scopeJoint':h})
 magic=list(dict.fromkeys(previous.get('intentionalMagicParts',[])+choose('Sky king central large green soul heart')))
 contract={'revision':'geometric-game-v6','selectionOnly':True,'contacts':contacts,'cavities':cavities,'helmetRatios':helmets,'intentionalMagicParts':magic}
 b.root['enemyPhysicalContractV6']=json.dumps(contract);return contract
