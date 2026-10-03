"""Append-only V6 source anatomy helpers; no file/export/manifest writes.

The native V5 rig and source PNGs are inputs. Explicit per-source profiles
replace retained generic bodies; named joints and materials remain usable by
the separate humanoid/equipment helper and runtime. Coordinates are metres,
+Y front, Z up. Hidden depth/absolute scale remain authored estimates.
"""
import bpy,bmesh,math
from mathutils import Vector
from geometric_roster_builder import ell,cone,leaf
from geometric_champion_creature_fit_v4 import semantic,remove,descendants,points
from geometric_champion_shapes_v5 import boolean,tree,material
from geometric_game_common import metrics

GIANTS=(3,6,8,10,11,12,17,20,21,22,24,26,32,43,46,49)
# shoulder half-width, belly half-width, front depth, arm volume, bare foot,
# specific source purpose. These are separate source designs, not color swaps.
PROFILES={
 3:(.44,.435,.32,.18,False,'one continuous round potbelly with broad soft forearms'),
 6:(.47,.34,.29,.20,True,'hunched moss-coated stone troll with broad gnarled fists'),
 8:(.46,.35,.265,.205,True,'lean long-armed blue stone troll with hooked ivory claws'),
 10:(.49,.39,.295,.19,False,'wide gatebreaker ogre seated inside fitted asymmetrical armor'),
 11:(.48,.36,.27,.20,False,'long-armed hookbearer with asymmetric salvaged armor'),
 12:(.33,.25,.225,.125,True,'small lean bell carrier supporting the actual bronze bell'),
 17:(.48,.37,.29,.21,True,'stooped woodland totem troll with strong branch-bearing wrists'),
 20:(.46,.36,.29,.20,True,'grey hulking bone patriarch with natural thick finger joints'),
 21:(.48,.39,.29,.205,True,'integrated bark and moss troll with gnarled wooden fists'),
 22:(.40,.33,.28,.16,False,'compact armored iron ram with fitted metal limb joints'),
 24:(.38,.32,.265,.17,False,'riveted pilot construct with actual axle-bearing mechanical joints'),
 26:(.49,.425,.32,.21,False,'massive rune-collar ogre with exposed muscular upper torso'),
 32:(.46,.37,.275,.21,True,'hunched soul drinker surrounding actual open curved ribs'),
 43:(.45,.42,.32,.19,False,'broad potbelly ogre carrying two shoulder lantern cages'),
 46:(.40,.34,.275,.18,False,'hollow armored revenant retaining its actual open soul volume'),
 49:(.51,.45,.325,.245,True,'heavy continuous stone greatmaw with true hollow second jaw')}

def joint(name):
 ob=bpy.data.objects.get(name)
 assert ob is not None,('missing retained joint',name)
 return ob
def J(name):return joint(name).matrix_world.translation.copy()
def with_z(p,z):return Vector((p.x,p.y,z))
def closed_boolean_cleanup(ob):
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY');bm.to_mesh(ob.data);bm.free();ob.data.update()
 if metrics([ob])['degenerateTriangles']:
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.dissolve_degenerate(bm,dist=.00002,edges=list(bm.edges));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
 q=metrics([ob]);assert q['nonManifoldEdges']==0 and q['degenerateTriangles']==0,(ob.name,q)
def center(obs):
 q=metrics(obs);return Vector(tuple((a+c)/2 for a,c in zip(q['boundsMin'],q['boundsMax'])))
def basic_parts(b):
 prefixes=('Tailored continuous bodice','Faceted species chest','Heavy species broad faceted thorax','Source wide potbelly abdomen','Potbellied ogre abdomen','Connected shoulder ','Heavy connected deltoid ','Upper arm ','Muscular upper arm ','Forearm ','Muscular heavy forearm ','Grasping hand ','Broad grasping orc fist ','Visible curled orc knuckle ','Upper leg ','Heavy short upper leg ','Lower leg ','Heavy short shin ','Knee contacting articulated joint ','Elbow contacting articulated joint ','Ankle contacting boot joint ')
 return[o for o in b.objects if semantic(o).startswith(prefixes)]

def source_fingers(b,side,palm,radius,mat,claws=False):
 pa=joint('hand_'+side);sgn=-1 if side=='L'else 1
 for j in range(3):
  x=palm.x+(j-1)*radius*.53
  a=Vector((x,palm.y+radius*.58,palm.z+radius*.10));c=Vector((x,palm.y+radius*.89,palm.z-radius*.52))
  b.limb('V6 source curled anatomical finger '+side,[a,a.lerp(c,.45)+Vector((0,.015,.025)),c],[(radius*.29,radius*.26),(radius*.27,radius*.24),(radius*.20,radius*.17)],mat,pa,8)
  if claws:
   mid=c+Vector((sgn*.008,.028,-radius*.23));tip=c+Vector((sgn*.014,.008,-radius*.48));tip.z=max(.009,tip.z);mid.z=max(.025,mid.z)
   b.limb('V6 source contacting curved ivory hand claw '+side,[c,mid,tip],[radius*.21,radius*.12,.004],'ivory',pa,8)

def rounded_giant(b,wave):
 sw,bw,depth,arm,bare,intent=PROFILES[wave]
 torso=joint('torso_pivot');heads=[o for o in b.objects if semantic(o)in('Observed face','Orc broad jaw','Orc actual broad exposed lower jaw')]
 headcenter=center(heads)if heads else J('head_pivot')
 hips=[J('upper_leg_'+s)for s in('L','R')];hipz=sum(p.z for p in hips)/2
 shoulderz=sum(J('upper_arm_'+s).z for s in('L','R'))/2
 old=basic_parts(b)
 # Heavy wood chassis and ghost rear torso are source structures. The
 # construct/revenant branch below retains/rebuilds them separately.
 remove(b,old)
 mat='skin'
 if wave in(6,21):material(b,'v6_bark_shadow','515F37');mat='skin'
 if wave==49:material(b,'v6_greatmaw_stone','787970');mat='v6_greatmaw_stone'
 cy=.015 if wave not in(6,17,21,32,49)else .045
 neckz=min(headcenter.z-.12,shoulderz+.17)
 rings=[]
 # Source ogre belly is widest below ribs and tapers smoothly into pelvis.
 sections=[(hipz-.105,bw*.73,depth*.74,cy),(hipz+.025,bw*.92,depth*.96,cy+.012),(hipz+.20,bw,depth,cy+.032),(shoulderz-.12,sw*.91,depth*.86,cy),(shoulderz+.045,sw*.78,depth*.74,cy-.014),(neckz,sw*.35,depth*.45,cy-.009)]
 if wave==3:
  # The original soft ogre has a genuinely forward convex potbelly. This
  # is part of its closed thorax, tapering to the unchanged physical pelvis
  # and shoulder/neck bearings rather than a separate sphere over the body.
  sections=[sections[0],(hipz+.025,bw*.94,depth*1.11,cy+.050),(hipz+.14,bw*1.105,depth*1.35,cy+.082),(hipz+.28,bw*1.075,depth*1.32,cy+.079),(shoulderz-.12,sw*.91,depth*.99,cy+.019),sections[-2],sections[-1]]
 for z,rx,ry,yy in sections:
  if rings and z<=rings[-1][0][2]+.001:z=rings[-1][0][2]+.025
  rings.append(b.ring(0,yy,z,rx,ry,12))
 body=b.loft('V6 source anatomical thorax',rings,mat,torso)
 pelvis=ell(b,'V6 source anatomical pelvis',(0,cy,hipz+.014),(bw*.77,depth*.72,.145),mat,torso,12,5)
 result={'sourceIntent':intent,'torso':body.name,'pelvis':pelvis.name,'bearingParts':[semantic(body),semantic(pelvis)],'headSeatM':[0,cy-.009,neckz-.012],'headSeatMethod':'Actual upper structural neck cap, with 12 mm permitted overlap; excludes canopy/armor decoration.','palms':{},'newAnatomicalParts':[body.name,pelvis.name]}
 for side in('L','R'):
  sgn=-1 if side=='L'else 1;sh=J('upper_arm_'+side);el=J('forearm_'+side);ha=J('hand_'+side)
  # Volume starts inside the real thorax before widening at deltoid, so the
  # retained source pose has a genuine shoulder/pelvis connection.
  shoulder=Vector((sgn*sw*.69,cy,sh.z));mid=sh.lerp(el,.44)+Vector((sgn*.01,-.011,.02))
  upper=b.limb('V6 source anatomical upper arm '+side,[shoulder,sh,mid,el],[(arm*1.03,arm*.97),(arm*1.18,arm*1.09),(arm*.97,arm*.94),(arm*.78,arm*.76)],mat,joint('upper_arm_'+side),12)
  fore=b.limb('V6 source anatomical forearm '+side,[el,el.lerp(ha,.48)+Vector((sgn*.012,.01,0)),ha],[(arm*.83,arm*.80),(arm*1.03,arm*.97),(arm*.81,arm*.78)],mat,joint('forearm_'+side),12)
  pr=arm*(1.08 if wave in(6,8,17,20,21,26,32,49)else .91)
  palm=ell(b,'V6 source anatomical palm '+side,ha,(pr,pr*.85,pr*.92),mat,joint('hand_'+side),12,5)
  source_fingers(b,side,ha,pr,mat,wave in(8,49));result['palms'][side]=palm.name
  hip=J('upper_leg_'+side);knee=J('shin_'+side);ank=J('foot_'+side)
  b.limb('V6 source anatomical thigh '+side,[hip+Vector((0,0,.028)),hip.lerp(knee,.43),knee],[(arm*.91,arm*.94),(arm*.97,arm*.89),(arm*.67,arm*.66)],mat,joint('upper_leg_'+side),12)
  b.limb('V6 source anatomical shin '+side,[knee,knee.lerp(ank,.52)+Vector((0,-.02,0)),ank],[(arm*.73,arm*.71),(arm*.71,arm*.73),(arm*.60,arm*.60)],mat,joint('shin_'+side),12)
  if bare:
   obsolete=[o for o in b.objects if o.parent==joint('foot_'+side)and semantic(o).startswith(('Grounded boot','Ground claw'))];remove(b,obsolete)
   x,y,z=ank;rx=arm*.83;ry=arm*1.12
   foot=b.loft('V6 source anatomical bare foot '+side,[b.ring(x,y+.055,.002,rx*.85,ry*.86,12),b.ring(x,y+.062,.047,rx,ry,12),b.ring(x,y+.037,max(.12,z+.045),rx*.66,ry*.72,12)],mat,joint('foot_'+side))
   for j in range(3):
    xx=x+(j-1)*rx*.56;base=(xx,y+ry*.71,.065)
    b.limb('V6 source connected bare toe '+side,[base,(xx,y+ry*.99,.055),(xx,y+ry*1.11,.025)],[(rx*.26,.030),(rx*.23,.027),(.009,.008)],mat,joint('foot_'+side),8)
    if wave in(8,49):b.limb('V6 source contacting foot ivory claw '+side,[(xx,y+ry*.99,.055),(xx,y+ry*1.13,.029),(xx,y+ry*1.18,.005)],[.026,.017,.004],'ivory',joint('foot_'+side),8)
  result['newAnatomicalParts']+= [upper.name,fore.name,palm.name]
 if wave in(6,17,21):source_wood_and_moss(b,body,wave,sw,shoulderz,mat)
 if wave==32:source_ribs(b,body,hipz,shoulderz)
 if wave==49:greatmaw(b,body,hipz,shoulderz)
 return result

def source_wood_and_moss(b,body,wave,width,shoulderz,mat):
 pa=joint('torso_pivot')
 if wave==21:
  remove(b,[o for o in b.objects if semantic(o).startswith(('Woodland','Rotroot','Tree troll','Troll actual tree'))])
  for k in range(9):
   a=k*math.tau/9;xx=math.sin(a)*width*.56;yy=-.16+math.cos(a)*.10
   stem=[(xx,yy,shoulderz-.09),(xx*1.22,yy-.06,shoulderz+.14),(xx*1.19,yy-.10,shoulderz+.37)]
   b.limb('V6 Rotroot integrated curved branching back bark',stem,[.105,.079,.018],'wood',pa,8)
   tip=Vector(stem[1])+Vector((.11 if k%2 else-.11,.025,.19));b.limb('V6 Rotroot contacting fork branch',[stem[1],tip],[.052,.007],'wood',pa,8)
 if wave in(6,21):
  for k in range(16):
   a=k*math.tau/16;p=(math.sin(a)*width*.82,-.06+math.cos(a)*.18,shoulderz+.019+(k%3)*.025)
   ell(b,'V6 source irregular overlapping moss volume',p,(.09+.012*(k%3),.10,.07+.014*(k%2)),'moss',pa,7,3)
  for k in range(6):
   p=((k-2.5)*.10,-.16,shoulderz+.10);b.limb('V6 source moss irregular rune stone',[p,(p[0]+.021,p[1]-.016,p[2]+.10)],[.065,.035],'steel_dark',pa,6)
   if wave==6:ell(b,'V6 source small irregular mushroom cap',(p[0]+.033,p[1]+.02,p[2]+.08),(.043,.036,.018),'ivory',pa,8,3)

def source_ribs(b,body,hipz,shoulderz):
 pa=joint('torso_pivot');old=[o for o in b.objects if semantic(o).startswith(('Open ribcage side spine','Separate open ivory rib','Soul drinker solid rear torso behind open frontal ribs'))];remove(b,old)
 # Carve the opening through the front skin volume, keeping a real solid
 # rear bearing and tapered side mass rather than a cage on a wood board.
 cutter=ell(b,'temporary V6 source open rib chest cutter',(0,.24,(hipz+shoulderz)/2+.08),(.285,.255,(shoulderz-hipz)*.51),'dark',pa,16,7);boolean(b,body,cutter,'DIFFERENCE');closed_boolean_cleanup(body)
 for side in(-1,1):
  spine=[(side*.25,.035,hipz+.02),(side*.31,.035,shoulderz-.07)];b.limb('V6 source curved rib bearing spine',spine,[.039,.042],'ivory',pa,10)
  for k in range(5):
   z=hipz+.07+k*(shoulderz-hipz-.08)/5
   b.limb('V6 source actual curved connected ivory chest rib',[(side*.275,.06,z+.028),(side*.295,.19,z),(side*.22,.29,z-.016),(side*.055,.32,z-.018)],[.030,.030,.027,.022],'ivory',pa,10)

def greatmaw(b,body,hipz,shoulderz):
 pa=joint('torso_pivot');remove(b,[o for o in b.objects if semantic(o).startswith(('Belly second maw recess','Maw ivory tooth','Belly soul glow'))])
 z=hipz+.17;cy=.35
 cut=ell(b,'temporary V6 true Greatmaw recessed second mouth',(0,cy,z),(.405,.26,.235),'dark',pa,16,8);boolean(b,body,cut,'DIFFERENCE');closed_boolean_cleanup(body)
 # Dark interior is genuinely inside the carved mouth, not a black board.
 ell(b,'V6 Greatmaw actual deep mouth interior',(0,.16,z),(.299,.032,.182),'dark',pa,12,5)
 shell=tree([body])
 for sign in(-1,1):
  for xx in(-.29,-.145,0,.145,.29):
   zz=z+sign*.235*math.sqrt(1-(xx/.405)**2)*1.06
   hit=shell.ray_cast(Vector((xx,4,zz)),Vector((0,-1,0)),8)[0]
   assert hit is not None,('Greatmaw actual source jaw root',xx,zz)
   root=hit-Vector((0,.018,0));mid=root+Vector((0,.047,-sign*.034));end=root+Vector((0,.051,-sign*.112))
   b.limb('V6 Greatmaw contacting curved second-jaw tooth upper'if sign>0 else'V6 Greatmaw contacting curved second-jaw tooth lower',[root,mid,end],[.055,.041,.004],'ivory',pa,10)
 b.jewel('V6 Greatmaw recessed living soul',(0,.215,z),.094,.122,.024,'rune',pa)

def mechanical_bearings(b):
 chassis=[o for o in b.objects if semantic(o)=='Mutant actual wood chest chassis'];top=metrics(chassis)['boundsMax'][2]
 result={'sourceIntent':PROFILES[24][-1],'bearingParts':['Mutant actual wood chest chassis'],'headSeatM':[0,.04,top-.008],'headSeatMethod':'Actual upper wood chassis inside pilot frame, excluding frame roof.','mechanicalBearings':[]}
 for name in('upper_arm_L','upper_arm_R','forearm_L','forearm_R','shin_L','shin_R','foot_L','foot_R'):
  pa=joint(name);p=pa.matrix_world.translation.copy()
  ob=b.limb('V6 Mutant actual transverse axle bearing '+name,[p+Vector((0,-.125,0)),p+Vector((0,.235,0))],[.097,.097],'steel_dark',pa,12)
  # The axle spans the hinge; both bright end caps seat on actual metal.
  for dy in(-.13,.23):ell(b,'V6 Mutant fitted bearing cap '+name,p+Vector((0,dy,0)),(.087,.031,.087),'steel',pa,12,4)
  result['mechanicalBearings'].append(ob.name)
 return result

def apply_creature_anatomy_v6(b,entry):
 wave=int(entry['id'].split('_')[1])
 if wave not in GIANTS:return {'applied':False,'reason':'Mounted/skeletal species use the separate owned source assembly author.'}
 if b.root.get('enemyCreatureAnatomyV6'):raise AssertionError((b.id,'V6 anatomy must start from immutable V5 input'))
 if wave==24:result=mechanical_bearings(b)
 elif wave==46:
  # Retain physically open soul armor; adding a fleshy thorax would violate
  # this source. Humanoid/equipment author reconstructs fitted hollow plates.
  plates=[o for o in b.objects if semantic(o)=='Separated phantom armor upper chest plate'];q=metrics(plates)
  result={'sourceIntent':PROFILES[46][-1],'bearingParts':['Separated phantom armor upper chest plate'],'headSeatM':[0,(q['boundsMin'][1]+q['boundsMax'][1])/2,q['boundsMax'][2]-.008],'headSeatMethod':'Actual structural upper chest armor cap; hollow soul volume retained.','retainHollowSoulVolume':True}
 else:result=rounded_giant(b,wave)
 result.update({'applied':True,'sourceWave':wave,'absoluteScaleCertified':False,'namedJointTransformsRetained':True})
 b.root['enemyCreatureAnatomyV6']=True
 return result
