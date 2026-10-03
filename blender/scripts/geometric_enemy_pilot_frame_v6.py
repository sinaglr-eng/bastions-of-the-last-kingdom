"""Actual source-24 riveted pilot frame and armor, without file or export IO.

The original six source/model pairs were inspected. Scene coordinates are
native metres, +Y forward, Z up. Final rendering and physical review are separate.
"""
import re,math
from mathutils import Vector
from geometric_roster_builder import ell
from geometric_champion_shapes_v5 import material,tree


def apply_source24_side_bearings_v6(b,h):
 """Prominent source side axle housings seated on the real copper cage."""
 assert not b.root.get('enemyPilotSideBearingsSource24V6'),b.id
 head=h.pivot(b,'head_pivot')
 columns=h.sem(b,'V6 source24 deep riveted copper pilot cage side',head)
 face=h.sem(b,'Observed face',head)
 assert len(columns)==2 and face,(b.id,'actual copper frame and pilot required')
 fl,fh=h.bound(face);fc=(fl+fh)/2;fw=fh.x-fl.x
 contacts=[];new=[]
 def register(ob,bearing):
  ob['semanticPart']=h.semantic(ob)+' / pilot24-side '+str(len(contacts))
  relation={'name':'actual source24 side housing '+h.semantic(ob),'leftParts':[h.semantic(ob)],'rightParts':sorted({h.semantic(o)for o in bearing}),'leftObjectNames':[ob.name],'rightObjectNames':[o.name for o in bearing],'leftScopeJoint':head.name,'rightScopeJoint':head.name}
  contacts.append(relation);new.append(ob);return ob
 for column in columns:
  cl,ch=h.bound([column]);sign=-1 if (cl.x+ch.x)/2<fc.x else 1
  outer=cl.x if sign<0 else ch.x
  centre=Vector((outer,(cl.y+ch.y)/2,fc.z))
  radius=min(fw*.34,(ch.z-cl.z)*.39,(ch.y-cl.y)*.44)
  axle=Vector((sign,0,0))
  base=register(b.rod('V6 source24 circular copper cage side bearing housing',centre-axle*.012,centre+axle*.035,radius,'v6_pilot_weathered_copper',head,16),[column])
  iron=register(b.rod('V6 source24 contacting circular iron bearing inset',centre+axle*.021,centre+axle*.051,radius*.72,'v6_pilot_worn_iron',head,12),[base])
  register(ell(b,'V6 source24 domed copper axle terminal hub',centre+axle*.056,(.024,radius*.34,radius*.34),'v6_pilot_dark_copper',head,12,4),[iron])
  for j in range(6):
   a=j*math.tau/6;target=centre+axle*.09+Vector((0,math.cos(a)*radius*.83,math.sin(a)*radius*.83))
   point,normal,_,_=tree([base]).find_nearest(target);assert point is not None
   register(ell(b,'V6 source24 seated circular cage bearing rivet',point+normal*.002,(.012,.012,.012),'v6_pilot_rivet_iron',head,8,3),[base])
 b.root['enemyPilotSideBearingsSource24V6']=True
 return {'applied':True,'physicalContacts':contacts,'newPhysicalMeshes':[o.name for o in new],'sourceRecipes':['Two actual circular copper cage side bearing housings with contacting iron insets, axle end caps and six seated rim rivets per side'],'finalVisualAcceptance':False}


def apply_final_source24_v6(b,entry,h):
 if entry['id']!='host_24':return {'applied':False,'physicalContacts':[]}
 assert not b.root.get('enemyPilotFrameSource24V6'),b.id
 sem=h.sem;bound=h.bound;pivot=h.pivot
 head=pivot(b,'head_pivot');torso=pivot(b,'torso_pivot')
 faces=sem(b,'Observed face',head)
 posts=sem(b,'V6 mutant real contacting small pilot cage upright',head)
 body=sem(b,('Mutant actual wood chest chassis','V6 source anatomical thorax','Tailored continuous bodice','Faceted species chest'))
 assert faces and posts and body,(b.id,'source pilot skin, fitted cage and actual chassis required')
 fl,fh=bound(faces);sl,sh=bound(posts);bl,bh=bound(body)
 fc=(fl+fh)/2;fw=fh.x-fl.x
 front=fh.y+.025;rear=min(sl.y,fl.y)-.035
 low=min(fl.z-.065,sl.z);high=max(fh.z+.065,sh.z)
 material(b,'v6_pilot_weathered_copper','855C42',metal=.65)
 material(b,'v6_pilot_dark_copper','624734',metal=.55)
 material(b,'v6_pilot_worn_iron','73736D',metal=.65)
 material(b,'v6_pilot_rivet_iron','9D9C8F',metal=.6)
 contacts=[];new=[]
 def register(ob,bearing):
  ob['semanticPart']=h.semantic(ob)+' / pilot24 '+str(len(contacts))
  relation={'name':'actual source24 '+h.semantic(ob),'leftParts':[h.semantic(ob)],'rightParts':sorted({h.semantic(o)for o in bearing}),'leftObjectNames':[ob.name],'rightObjectNames':[o.name for o in bearing]}
  if ob.parent:relation['leftScopeJoint']=ob.parent.name
  parents={o.parent.name for o in bearing if o.parent}
  if len(parents)==1:relation['rightScopeJoint']=next(iter(parents))
  contacts.append(relation);new.append(ob);return ob
 def rivet(bearing,target,pa):
  point,normal,_,_=tree(bearing).find_nearest(Vector(target))
  assert point is not None
  return register(ell(b,'V6 source24 physically seated domed armor rivet',point+normal*.002,(.013,.013,.013),'v6_pilot_rivet_iron',pa,8,3),bearing)
 # Full-depth closed copper columns encompass the actual old cage struts.
 # The pilot remains visible through the central front opening.
 columns=[]
 for sign in(-1,1):
  ob=register(b.box('V6 source24 deep riveted copper pilot cage side',
   (fc.x+sign*fw*.64,(front+rear)/2,(low+high)/2),
   (fw*.205,front-rear,high-low),'v6_pilot_weathered_copper',.014,head),posts)
  columns.append(ob)
  for z in [low+.055,(low+high)/2,high-.055]:
   rivet([ob],(fc.x+sign*fw*.64,front+.07,z),head)
 roof=register(b.box('V6 source24 broad contacting copper cage roof',
  (fc.x,(front+rear)/2,high-.042),(fw*1.52,front-rear,.092),
  'v6_pilot_dark_copper',.013,head),columns)
 floor=register(b.box('V6 source24 contacting copper pilot window sill',
  (fc.x,(front+rear)/2,low+.035),(fw*1.50,front-rear,.083),
  'v6_pilot_weathered_copper',.012,head),columns)
 for ob,z in [(roof,high-.042),(floor,low+.035)]:
  for sign in(-1,1):rivet([ob],(fc.x+sign*fw*.39,front+.07,z),head)
 # The source has a steel rear inspection plate on the copper chest housing.
 point,normal,_,_=tree(body).find_nearest(Vector(((bl.x+bh.x)/2,bl.y-.2,(bl.z+bh.z)/2)))
 assert point is not None
 plate=register(b.box('V6 source24 fitted rear iron chassis inspection plate',
  point+normal*.012,((bh.x-bl.x)*.78,.058,(bh.z-bl.z)*.72),
  'v6_pilot_worn_iron',.022,torso),body)
 pl,ph=bound([plate])
 for sx in(-1,1):
  for zz in [pl.z+.046,ph.z-.046]:
   rivet([plate],((pl.x+ph.x)/2+sx*(ph.x-pl.x)*.35,pl.y-.08,zz),torso)
 # Recolor actual covering mechanical plates, rather than a hidden skin shell.
 # Original pilot skin, chassis wood and motion/joint transforms stay intact.
 painted=[]
 for ob in list(b.objects):
  label=h.semantic(ob)
  if ob in new or re.search(r'observed face|eye|tooth|tusk|skin|wood chest|pilot cage',label,re.I):continue
  if not re.search(r'armor|armour|steel|iron|gauntlet|plated|rivet|mechanical|gear|toothed fist|wrapped wrist|construct grounded shoe|mutant actual boxlike upper arm',label,re.I):continue
  key='v6_pilot_worn_iron'if re.search(r'joint|gear|axle|rivet square',label,re.I)else'v6_pilot_weathered_copper'
  ob.data.materials.clear();ob.data.materials.append(b.M[key]);painted.append(ob)
 # Source limb plate rivets sit on individually selected real armor surfaces.
 for pa_name in ['upper_arm_L','upper_arm_R','forearm_L','forearm_R','shin_L','shin_R','foot_L','foot_R']:
  pa=pivot(b,pa_name)
  choices=[ob for ob in painted if h.descendants(ob,pa) and not re.search(r'joint|axle|strut|gear',h.semantic(ob),re.I)]
  if not choices:continue
  # Largest actual plate, with independent unique rivets; a sibling cannot
  # stand in for its contact relation.
  ob=max(choices,key=lambda o:(lambda q:(q[1]-q[0]).length)(bound([o])))
  al,ah=bound([ob])
  for sign in(-1,1):rivet([ob],((al.x+ah.x)/2+sign*(ah.x-al.x)*.26,ah.y+.1,(al.z+ah.z)/2),pa)
 bearings=apply_source24_side_bearings_v6(b,h)
 contacts.extend(bearings['physicalContacts'])
 b.root['enemyPilotFrameSource24V6']=True
 return {'applied':True,'sourceRecipes':['Full-depth riveted copper pilot frame with a clear front window, contacting sill and roof','Actual steel rear inspection plate and weathered copper articulated limb armor'],
  'physicalContacts':contacts,'newPhysicalMeshes':[o.name for o in new]+bearings['newPhysicalMeshes'],'sideBearings':bearings,
  'actualPaintedCoveringMeshes':[o.name for o in painted],'sourcePixelsModified':False,'finalVisualAcceptance':False}
