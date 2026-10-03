"""Actual mesh selections for independent strict V6 triangle/ray inspection.

This file only selects interfaces. Neither names nor these records provide a
pass. Missing selections, disconnected solids or obstructed rays fail in QA.
"""
import json
from geometric_champion_creature_fit_v4 import semantic,descendants

def bind_enemy_physical_scopes_v6(b,entry):
 w=int(entry['id'].split('_')[1]);parts={semantic(o)for o in b.objects}
 def names(prefix):return sorted(x for x in parts if x.startswith(prefix))
 contacts=[];cavities=[];helmets=[];magic=[]
 def contact(name,left,right):
  if left and right:contacts.append({'name':name,'leftParts':left,'rightParts':right})
 body=names(('V6 source anatomical thorax','V6 rider source seated thorax','Tailored continuous bodice','Faceted species chest','Separated phantom armor upper chest plate','Mutant actual wood chest chassis'))
 face=names('Observed face')
 head=names(('V6 revenant continuous actual open armored helmet shell',))if w==46 else face
 contact('Actual rebuilt head-to-structural torso seating',head,body)
 for side in('L','R'):
  upper=names(('V6 source anatomical upper arm '+side,'V6 scrap source broad upper arm '+side,'Upper arm '+side,'V6 rider actual connected upper arm '+side));fore=names(('V6 source anatomical forearm '+side,'V6 scrap source broad forearm '+side,'Forearm '+side,'V6 rider actual connected forearm '+side));palm=names(('V6 source anatomical palm '+side,'Grasping hand '+side,'V6 rider actual source grasping palm '+side))
  contact('Actual '+side+' shoulder bearing',upper,body);contact('Actual '+side+' elbow interface',upper,fore);contact('Actual '+side+' wrist interface',fore,palm)
  thigh=names(('V6 source anatomical thigh '+side,'V6 scrap source short thick thigh '+side,'Upper leg '+side,'V6 rider actual connected seated thigh '+side));shin=names(('V6 source anatomical shin '+side,'V6 scrap source short thick calf '+side,'Lower leg '+side,'V6 rider actual naturally hanging shin '+side));pelvis=names(('V6 source anatomical pelvis','V6 rider source contacting seated pelvis'))or names(('Leather ragged skirt','Connected ragged leather battle skirt','Continuous flared garment hem','V6 source contacting ragged skirt layer','V6 detail source contacting torn pointed skirt','V6 revenant source contacting fitted segmented iron hip lamella'))or body
  contact('Actual '+side+' pelvis thigh bearing',pelvis,thigh);contact('Actual '+side+' knee interface',thigh,shin)
  contact('Actual mask band-to-skin structural contact',names('V6 mask actual contacting side fastening band'),face)
 if w in(4,10,11,14,22,25,35,41,42,45,47):helmets.append({'name':'Actual source fitted steel cap depth','coverParts':names(('V6 source fitted rounded metal cap','V6 source seated metal cap rim')),'depthToWidth':[.45,1.15]})
 def cavity(feature,shell,inside,direction=None):
  row={'name':'Actual source opening '+feature,'sourceFeature':feature,'shellParts':names(shell),'interiorParts':names(inside),'minimumRecessM':.008}
  if direction:row['nativeRayDirection']=direction
  cavities.append(row)
 if w in(16,34,39,44):
  for side in('L','R'):cavity(('skull-'if w==34 else'')+'mask-eye-'+side,'V6 source continuous fitted mask with real eye openings','Eye '+side)
 if w==12:
  contact('Actual source bell support straps seat on carrier torso',names('V6 temple actual source shoulder bell supporting leather strap'),body)
  contact('Actual source bell rim meets real shoulder support straps',names('V6 temple actual source shoulder bell supporting leather strap'),names('V6 temple actual thick hollow bronze bell with open underside'))
  cavity('bell-underside','V6 temple actual thick hollow bronze bell with open underside','V6 temple actual recessed inner bronze roof',[0,0,1]);cavity('bell-front-crack','V6 temple actual thick hollow bronze bell with open underside','V6 temple actual recessed back bronze patch behind open crack')
 if w==32:cavity('open-chest-cage',('V6 source anatomical thorax','V6 source actual curved connected ivory chest rib','V6 soul drinker actual chest lantern cage actual continuous cage upright'),'V6 soul drinker actual chest lantern cage genuinely suspended turquoise soul')
 if w==46:cavity('hollow-armor-recess',('Separated phantom armor upper chest plate','V6 revenant actual armored open chest side bearing','V6 revenant actual source front chest flank plate','V6 revenant actual source continuous back to chest flank metal'),'V6 revenant actual recessed chest darkness')
 if w==49:cavity('belly-mouth',('V6 source anatomical thorax','V6 Greatmaw contacting curved second-jaw tooth'),'V6 Greatmaw actual deep mouth interior')
 skull_prefix={7:('V6 marsh actual carved crocodile skull hood','skull-eye'),10:('V6 gatebreaker actual carved iron skull mace','mace-skull-eye'),11:('V6 hookbearer source huge shoulder skull','skull-eye'),20:('V6 Patriarch actual attached staff ivory skull','staff-skull-eye')}.get(w)
 if skull_prefix:
  prefix,feature=skull_prefix
  for shell in [o for o in b.objects if semantic(o)==prefix+' actual carved cranial shell']:
   centre=shell.matrix_world.translation
   # Each actual object is selected separately, preserving all of its
   # exported material faces. These names only select real ray surfaces.
   verts=[shell.matrix_world@v.co for v in shell.data.vertices];cx=(min(v.x for v in verts)+max(v.x for v in verts))/2
   eyes=[o for o in b.objects if semantic(o)==prefix+' genuine recessed eye cavity'and o.parent==shell.parent]
   near=sorted(eyes,key=lambda o:abs(sum((o.matrix_world@v.co).z for v in o.data.vertices)/len(o.data.vertices)-sum(v.z for v in verts)/len(verts)))[:2]
   for side in('L','R'):
    eye=min(near,key=lambda o:(1 if side=='L'else-1)*sum((o.matrix_world@v.co).x for v in o.data.vertices)/len(o.data.vertices))
    row={'name':'Actual separately carved source '+feature+' '+side+' '+shell.name,'sourceFeature':feature+'-'+side,'shellParts':[semantic(shell)],'interiorParts':[semantic(eye)],'shellObjectNames':[shell.name],'interiorObjectNames':[eye.name],'minimumRecessM':.008}
    if w==7:row['nativeRayDirection']=[1 if side=='L'else-1,0,0]
    cavities.append(row)
 for p in parts:
  if any(x in p for x in('genuinely suspended','genuinely orbiting','Three separate silver mirror protections','Phalanx source upper protective crystal','actual physically recessed cyan chest soul')):magic.append(p)
 b.root['enemyPhysicalContractV6']=json.dumps({'revision':'geometric-game-v6','scopeIsSelectionOnly':True,'contacts':contacts,'cavities':cavities,'helmetRatios':helmets,'intentionalMagicParts':sorted(magic)},ensure_ascii=False)
 return json.loads(b.root['enemyPhysicalContractV6'])
