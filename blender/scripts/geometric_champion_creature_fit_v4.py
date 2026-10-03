"""0.3.3 physical fit and explicit human review overrides.

Native +Y forward, +X anatomical right, Z up. This module owns geometry only,
never stats, exports, manifests, shared basics or runtime code. Animal necks
are excluded from the humanoid flush-head override.
"""
import math, json
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def descendants(ob,parent):
 while ob:
  if ob==parent:return True
  ob=ob.parent
 return False

def semantic(ob):return ob.get('semanticPart',ob.name)

def points(ob):
 bpy.context.view_layer.update()
 return [ob.matrix_world@v.co for v in ob.data.vertices]

def remove(b,objects):
 for ob in list(objects):
  if ob not in b.objects:continue
  b.objects.remove(ob);mesh=ob.data;bpy.data.objects.remove(ob,do_unlink=True)
  if mesh.users==0:bpy.data.meshes.remove(mesh)

def position(ob,p):
 bpy.context.view_layer.update();m=ob.matrix_world.copy();m.translation=Vector(p);ob.matrix_world=m;bpy.context.view_layer.update()

def child_node(parent,prefix):
 return next((o for o in parent.children if o.type=='EMPTY' and o.name.split('.')[0]==prefix),None)

def flush_human_head(b,head,torso):
 """Fit the real face/helmet chin to real chest; remove visible neck shafts.

The entire rigid head subtree moves once. All headgear remains registered to
its head. The 12 mm physical insertion accommodates actual idle head poses.
"""
 body=[o for o in b.objects if descendants(o,torso) and not descendants(o,head) and semantic(o).startswith(('Tailored continuous bodice','Faceted species chest','Heavy species broad faceted thorax','Mutant actual wood chest chassis','Bodice','Construct source main','Golem source','Mechanical source','Soul drinker solid rear torso','Separated phantom armor upper chest plate'))]
 faces=[o for o in b.objects if descendants(o,head) and semantic(o).startswith(('Observed face','Face'))]
 if not body:return None
 bearing=faces or [o for o in b.objects if descendants(o,head) and semantic(o).startswith(('Helmet integrated crown cheeks','Helmet single integrated','Helmet solid crown shell','Construct continuous chamfered head','Golem low bulbous'))]
 if not bearing:return None
 bottom=min(p.z for o in bearing for p in points(o));top=max(p.z for o in body for p in points(o))
 shift=max(0,bottom-top+.012)
 if shift>.28:raise AssertionError((b.id,'head/chest requires source diagnosis',shift))
 necks=[o for o in b.objects if descendants(o,head) and semantic(o).startswith('Connected neck inside collar')]
 if b.id=='ladyclaire':necks+=[o for o in b.objects if semantic(o)=='Neck']
 remove(b,necks)
 if shift>.00001:position(head,head.matrix_world.translation-Vector((0,0,shift)))
 # The top of a rounded or hollow chest is not necessarily under the chin.
 # Fit against actual triangulated material, beyond the initial box estimate.
 def tree(objects):
  vv=[];ff=[]
  for ob in objects:
   base=len(vv);vv.extend(points(ob));ff.extend(tuple(base+i for i in poly.vertices)for poly in ob.data.polygons)
  return BVHTree.FromPolygons(vv,ff,all_triangles=False,epsilon=.000001)
 chest=tree(body);extra=0
 while not chest.overlap(tree(bearing)):
  position(head,head.matrix_world.translation-Vector((0,0,.001)));extra+=.001
  if shift+extra>.28:raise AssertionError((b.id,'actual chin/chest surface fit failed',shift+extra))
 if extra:
  # A further six millimetres is inside the real structural chest, rather
  # than a decorative jewel. It accommodates live idle head articulation.
  position(head,head.matrix_world.translation-Vector((0,0,.006)));extra+=.006
 shift+=extra
 head['humanoidHeadFlushV4']=True
 return {'head':head.name,'bearingParts':[semantic(o)for o in bearing],'structuralBodyParts':[semantic(o)for o in body],'downwardHeadFitM':shift,'additionalActualSurfaceFitM':extra,'exposedNeckMeshesRemoved':len(necks),'physicalInsertionM':.012,'animalNeckChanged':False}

def integrated_helmet(b,c):
 """One real hollow armor shell, including visor, with actual eye apertures."""
 from geometric_roster_builder import ell
 head=c['head'];P=c['P'];w=c['fw'];h=c['fh'];z=c['facez'];scale=c['scale']
 remove(b,[o for o in b.objects if descendants(o,head) and semantic(o).startswith('Helmet ')])
 def ring(zz,rx,ry):return [P((x,y,zz)) for x,y in [(-.65*rx,ry),(.65*rx,ry),(rx,.52*ry),(rx,-.52*ry),(.65*rx,-ry),(-.65*rx,-ry),(-rx,-.52*ry),(-rx,.52*ry)]]
 dims=[(z-h*.48,w*.46,w*.35),(z-h*.19,w*.55,w*.40),(z+h*.29,w*.54,w*.40),(z+h*.52,w*.42,w*.34),(z+h*.67,w*.19,w*.18)]
 outer=[ring(*q)for q in dims]
 inner=[ring(zz-(.030 if j==len(dims)-1 else 0),rx-.025,ry-.025)for j,(zz,rx,ry) in enumerate(dims)]
 n=8;nr=len(dims);verts=sum(outer,[])+sum(inner,[]);faces=[]
 for layer in range(nr-1):
  for j in range(n):
   k=(j+1)%n;a=layer*n;b0=(layer+1)*n;t=nr*n
   faces.append((a+j,a+k,b0+k,b0+j));faces.append((t+a+j,t+b0+j,t+b0+k,t+a+k))
 for j in range(n):k=(j+1)%n;faces.append((j,nr*n+j,nr*n+k,k))
 faces.append(tuple((nr-1)*n+j for j in range(n)))
 faces.append(tuple(reversed([nr*n+(nr-1)*n+j for j in range(n)])))
 metal='cloth' if b.id=='archangel' else 'steel_light'
 shell=b.mesh('Helmet single integrated hollow armored visor shell',verts,faces,metal,head)
 # Subtract two physical holes through the front wall into the hollow interior.
 for side in (-1,1):
  cutter=b.box('temporary actual visor aperture cutter',P((side*w*.22,w*.405,z+h*.09)),c['SZ']((w*.17,.16,h*.15)),'dark',.003*scale)
  bpy.context.view_layer.objects.active=shell;mod=shell.modifiers.new('Actual open eye aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.ops.object.modifier_apply(modifier=mod.name);remove(b,[cutter])
 shell['singleIntegratedHelmetV4']=True;shell['physicalOpenEyeApertures']=2
 # Dark interiors are inside real apertures, not another oval helmet surface.
 for side in (-1,1):b.box('Helmet recessed aperture interior',P((side*w*.22,w*.29,z+h*.09)),c['SZ']((w*.20,.016,h*.18)),'dark',.002*scale,head)
 if b.id=='kingdomprotector':
  b.box('Helmet touching source transverse gold crest',P((0,0,z+h*.71)),c['SZ']((w*.64,.08,h*.14)),'gold',.008*scale,head)
  b.box('Helmet touching source crest upright',P((0,0,z+h*.73)),c['SZ']((w*.11,.10,h*.35)),'gold',.007*scale,head)
 else:b.panel('Helmet fitted source blue fin crest',[P((0,-w*.21,z+h*.50)),P((0,-w*.09,z+h*.88)),P((0,w*.12,z+h*.54))],.043*scale,'cloth_light',head,.015*scale)
 b.coverage=[x for x in b.coverage if x.get('type')!='closed-helmet'];b.coverage.append({'type':'closed-helmet','shell':shell.name,'hiddenSkinMeshes':0,'rule':'One hollow closed manifold shell with two physical visor eye apertures; no underlying skin or oval cap.'})

def layered_royal_hair(b,c):
 head=c['head'];P=c['P'];w=c['fw'];h=c['fh'];z=c['facez'];sc=c['scale']
 remove(b,[o for o in b.objects if descendants(o,head) and semantic(o).startswith(('Hair ','Royal flowing ivory side hair','Elven king broad long ivory hair','Elven king flowing ivory rear hair'))])
 b.loft('Royal layered hair contacting sculpted crown',[ [P(v)for v in b.ring(0,-.026,zz,rx,ry,12)]for zz,rx,ry in [(z+h*.18,w*.52,w*.34),(z+h*.46,w*.55,w*.36),(z+h*.64,w*.39,w*.27)]],'ivory',head)
 for side in (-1,1):
  # Curving broad locks share the fitted cap and sweep around the visible face.
  paths=[[(side*w*.02,w*.315,z+h*.48),(side*w*.22,w*.36,z+h*.39),(side*w*.43,w*.32,z+h*.22),(side*w*.53,w*.23,z-h*.02)],[(side*w*.43,.02,z+h*.42),(side*w*.57,.055,z+h*.13),(side*w*.61,.08,z-h*.23),(side*w*.57,.10,z-h*.65),(side*w*.68,.04,z-h*.91)],[(side*w*.44,-w*.22,z+h*.41),(side*w*.59,-w*.25,z+h*.07),(side*w*.62,-w*.22,z-h*.37),(side*w*.53,-w*.24,z-h*.82)]]
  for j,path in enumerate(paths):b.limb('Royal curved layered ivory hair lock',[P(v)for v in path],[(w*.14*sc,w*.065*sc),(w*.15*sc,w*.068*sc),(w*.13*sc,w*.064*sc)]+([(w*.085*sc,w*.049*sc)]*(len(path)-3)),'ivory',head,8)
 for j in range(-2,3):
  path=[(j*w*.16,-w*.30,z+h*.43),(j*w*.18,-w*.37,z+h*.10),(j*w*.19,-w*.37,z-h*.36),(j*w*.16,-w*.34,z-h*(.89+.05*(j==0)))]
  b.limb('Royal curved overlapping ivory rear hair lock',[P(v)for v in path],[(w*.13*sc,w*.065*sc),(w*.145*sc,w*.068*sc),(w*.13*sc,w*.066*sc),(w*.04*sc,w*.034*sc)],'ivory',head,8)

def crossbow_fit(b,row,c):
 # Reuse the independently tested source grip construction without modifying
 # its frozen v3 module; the aliased identity chooses its crossbow branch only.
 from geometric_champion_fit_v3 import apply_source_fit_v3
 if b.id in ('rimewatch','royalranger'):return
 before=set(b.objects);old=b.root.get('sourceFitV3Revision');b.root.pop('sourceFitV3Revision',None)
 # A seated rider has a shorter local torso than a standing ranger. Fit the
 # same real stock below its face, instead of putting the rail through eyes.
 originalP=c['P'];drop=.31 if c['mounted'] else 0
 if drop:c['P']=lambda p:originalP((p[0],p[1],p[2]-drop))
 apply_source_fit_v3(b,{**row,'id':'rimewatch'},c);c['P']=originalP
 # Both palms now hold the crossbow. The old reins were rigid children of the
 # left weapon and would stretch away from the animal after that grip moved.
 remove(b,[o for o in b.objects if semantic(o)=='Rider connected leather reins' and descendants(o,c['weapons']['L'])])
 if old is not None:b.root['sourceFitV3Revision']=old
 for ob in set(b.objects)-before:
  if semantic(ob).startswith('Crossbow source frost crystal bolt tip'):
   ob.data.materials.clear();ob.data.materials.append(b.M['steel_light']);ob['semanticPart']='Crossbow source metal bolt point'
 b.root['sourceCrossbowFitV4']=True;b.root['sourceWeaponKind']=row['spec'].get('weapon','crossbow')

def highking_grip(b,c):
 from geometric_roster_builder import ell
 P=c['P'];sc=c['scale'];SZ=c['SZ'];hands={'R':(.085,.41,.72),'L':(-.06,.435,.91)};elbows={'R':(.295,.22,.90),'L':(-.29,.245,.97)}
 for sn in ('R','L'):
  upper=c['arms'][sn];fore=child_node(upper,'forearm_'+sn);hand=child_node(fore,'hand_'+sn);weapon=c['weapons'][sn];sh=upper.matrix_world.translation.copy()
  remove(b,[o for o in b.objects if descendants(o,upper) and semantic(o).startswith(('Connected shoulder','Upper arm','Forearm','Elbow contacting','Grasping hand','Broad cuff'))])
  position(fore,P(elbows[sn]));position(hand,P(hands[sn]));position(weapon,P(hands[sn]));c['hands'][sn]=P(hands[sn])
  ell(b,'Kingslayer contacting armored shoulder '+sn,tuple(sh),SZ((.14,.14,.13)),'steel_dark',upper,10,4)
  b.limb('Kingslayer anatomically fitted upper arm '+sn,[tuple(sh),P(elbows[sn])],[.12*sc,.108*sc],'steel_dark',upper,8)
  b.limb('Kingslayer real angled armored forearm '+sn,[P(elbows[sn]),P(hands[sn])],[.107*sc,.087*sc],'steel_dark',fore,8)
  ell(b,'Kingslayer contacting elbow '+sn,P(elbows[sn]),SZ((.11,.11,.11)),'steel_dark',fore,10,3)
  ell(b,'Kingslayer actual gripping gauntlet '+sn,P(hands[sn]),SZ((.091,.089,.094)),'steel_dark',hand,8,3)
  for j in (-1,0,1):b.box('Kingslayer visible curled knuckle '+sn,P((hands[sn][0]+j*.047,hands[sn][1]+.073,hands[sn][2])),SZ((.038,.054,.068)),'steel',.009*sc,hand)
 remove(b,[o for o in b.objects if semantic(o).startswith(('Two handed sword','Kingslayer long diagonal blade','Greatsword guard','Greatsword round','Breastplate fitted shell'))])
 low=Vector(c['hands']['R']);high=Vector(c['hands']['L']);d=(high-low).normalized();u=Vector((d.z,0,-d.x)).normalized();base=low-d*.15*sc;guard=high+d*.115*sc;pa=c['weapons']['R']
 b.rod('Kingslayer two hands continuous actual hilt',tuple(base),tuple(guard),.037*sc,'leather',pa,10)
 start=guard+d*.05*sc;end=start+d*.96*sc;width=.104*sc
 b.panel('Kingslayer source straight broad true greatsword',[tuple(start-u*width),tuple(start+u*width),tuple(end-d*.17*sc+u*width*.79),tuple(end),tuple(end-d*.17*sc-u*width*.79)],.062*sc,'steel_light',pa,.026*sc)
 b.rod('Kingslayer fitted source crossguard',tuple(guard-u*.21*sc),tuple(guard+u*.21*sc),.034*sc,'steel',pa,8);ell(b,'Kingslayer source round pommel',tuple(base),SZ((.063,.058,.063)),'steel',pa,10,3)
 for name,sn in [('greatsword_right_grip','R'),('greatsword_left_grip','L')]:b.pivot(name,c['hands'][sn],pa)
 b.pivot('attack_muzzle',tuple(end),pa)
 # Contoured chest sits behind the actual grip; no broad rectangular blocker.
 z=(c['shoulder']+c['belt'])/2;tw=c['tw'];b.panel('Kingslayer source contoured chest armor',[P(q)for q in [(-tw*.73,.275,z+.19),(0,.29,z+.24),(tw*.73,.275,z+.19),(tw*.64,.285,z-.18),(0,.30,z-.22),(-tw*.64,.285,z-.18)]],.055*sc,'steel_dark',c['torso'],.012*sc)
 b.root['greatswordGripContract']='right-lower-left-upper-actual-hilt-v4'

def royal_clothes(b,c):
 remove(b,[o for o in b.objects if semantic(o).startswith(('Shoulder folded cape','Gilded front garment trim'))])
 P=c['P'];sc=c['scale'];sh=c['shoulder'];be=c['belt']
 for side in (-1,1):
  b.panel('Royal ranger fitted blue folded source collar',[P(q)for q in [(side*.04,.235,sh+.025),(side*.28,.08,sh+.025),(side*.25,.265,sh-.071),(side*.075,.28,sh-.10)]],.028*sc,'cloth',c['torso'],.013*sc)
  b.limb('Royal ranger actual gold tunic edge',[P((side*.095,.244,be-.03)),P((side*.11,.273,be-.10)),P((side*.16,.29,.50))],[.014*sc]*3,'gold',c['torso'],6)

def riders_ahead_of_wings(b,c):
 # Native +Y is forward. Wing roots stay registered to the animal shoulders;
 # rider hips/thighs/knees move forward together, including the real saddle.
 if b.id not in ('thunderheart','phoenix','griffinbomber'):return
 # Clearance is to the physical leading-root surface, including its radius,
 # rather than merely to the empty wing pivot's centre.
 shift=.28 if b.id!='griffinbomber' else .26
 for upper in c['legs'].values():position(upper,upper.matrix_world.translation+Vector((0,shift,0)))
 for ob in b.objects:
  if semantic(ob).startswith(('Rider visible seated pelvis','Rider fitted saddle cushion','Rider contacting saddle pommel','Rider actual fitted hanging stirrup','Rider stirrup suspension')):
   bpy.context.view_layer.update();m=ob.matrix_world.copy();m.translation.y+=shift;ob.matrix_world=m
 b.root['sourceRiderLegFitV4']='physical thighs/knees/stirrups forward of wing roots'
 if b.id=='thunderheart':
  for pa in [o for o in b.coll.all_objects if o.type=='EMPTY' and o.name.split('.')[0]in('wing_R','wing_L')]:
   for ob in [o for o in b.objects if descendants(o,pa)]:
    inv=ob.matrix_world.inverted();root=pa.matrix_world.translation.copy()
    for v in ob.data.vertices:
     p=ob.matrix_world@v.co;p.x=root.x+(p.x-root.x)*1.17;p.z=root.z+(p.z-root.z)*1.12;v.co=inv@p
    ob.data.update()
  b.root['dragonriderWingUserOverrideV4']='larger wings: span117%, vertical fan112% about true shoulder roots'

def horse_details(b,c):
 if b.id not in ('frostblade','roseguard'):return
 from geometric_roster_builder import ell
 head=next(o for o in b.coll.all_objects if o.type=='EMPTY' and o.name=='mount_head_pivot');root=next(o for o in b.coll.all_objects if o.type=='EMPTY' and o.name=='mount_torso_pivot')
 for side in (-1,1):
  ell(b,'Horse source anatomical rounded jaw mass',(side*.109,.76,1.173),(.065,.114,.092),'steel_light' if b.id=='frostblade' else 'copper',head,12,5)
  b.limb('Horse actual lower jaw tendon',[(side*.103,.47,1.215),(side*.123,.65,1.168),(side*.106,.81,1.077)],[(.047,.055),(.045,.053),(.028,.035)],'steel_light' if b.id=='frostblade' else 'copper',head,10)
  b.limb('Horse actual fitted split forelock',[(side*.025,.55,1.512),(side*.061,.62,1.483),(side*.079,.70,1.428)],[(.037,.037),(.033,.031),(.019,.022)],'steel_dark' if b.id=='frostblade' else 'hair',head,8)
 for sn in ('FL','FR','BL','BR'):
  fp=next(o for o in b.coll.all_objects if o.type=='EMPTY' and o.name=='foot_'+sn);p=fp.matrix_world.translation
  # Slight inset heel bulb and hoof cleft express an actual equine foot while
  # remaining entirely within the old grounded hoof and contact chain.
  b.box('Horse anatomical hoof central dark cleft',(p.x,p.y+.154,.065),(.014,.012,.071),'dark',.003,fp)
  ell(b,'Horse anatomical fitted rounded heel bulb',(p.x,p.y-.057,.118),(.074,.056,.047),'steel_light' if b.id=='frostblade' else 'copper',fp,10,3)

def build_integrated_nature_v4(b,row):
 """One continuous living trunk and face volume, never a separate head."""
 from geometric_roster_builder import ell,leaf,joints,cone
 from geometric_game_common import linear
 for key,hexcolor,emission in [('nature_v4_livingwood','B09469',0),('nature_v4_woodlight','C7AC82',0),('nature_v4_luminous','A9D974',.55)]:
  mat=bpy.data.materials.new(key);mat.use_nodes=True;rgba=tuple(linear(int(hexcolor[j:j+2],16)/255)for j in(0,2,4))+(1,);mat.diffuse_color=rgba;mat['source_srgb']='#'+hexcolor
  shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=rgba;shader.inputs['Emission Color'].default_value=rgba;shader.inputs['Emission Strength'].default_value=emission;b.M[key]=mat
 wood='nature_v4_livingwood'
 tor=b.pivot('torso_pivot',(0,0,.66));head=b.pivot('head_pivot',(0,0,1.26),tor)
 dims=[(.365,.041,.045,0),(.49,.11,.10,.21),(.67,.16,.13,.50),(.85,.18,.15,.74),(1.015,.225,.185,.30),(1.135,.31,.23,.06),(1.31,.31,.235,0),(1.465,.27,.218,0),(1.575,.17,.139,0),(1.62,.062,.057,0)]
 rings=[]
 for zz,rx,ry,turn in dims:
  rings.append([(rx*(1+.16*math.cos(j*math.tau/12*3+turn*4))*math.sin(j*math.tau/12+turn),ry*(1+.16*math.cos(j*math.tau/12*3+turn*4))*math.cos(j*math.tau/12+turn),zz)for j in range(12)])
 living=b.loft('Nature unified living wood leaf body with integrated face',rings,wood,tor)
 # The source lower trunk twists as real roots. Fuse three overlapping root
 # lobes into the SAME body volume, rather than attach decorative sticks or a
 # second head. Broad overlaps make the resulting surface watertight.
 for j in range(3):
  phase=j*math.tau/3
  sections=[(.385,.030,.041),(.49,.077,.065),(.64,.118,.078),(.80,.132,.078),(.96,.155,.071),(1.085,.151,.055)]
  path=[(r*math.sin(phase+(zz-.385)*2.85),r*.78*math.cos(phase+(zz-.385)*2.85),zz)for zz,r,rad in sections]
  root=b.limb('temporary living trunk root union',path,[rad for zz,r,rad in sections],wood,tor,10)
  bpy.context.view_layer.objects.active=living;mod=living.modifiers.new('Actual unified interwoven living root','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=root
  bpy.ops.object.modifier_apply(modifier=mod.name);remove(b,[root])
 living['actualUnifiedRootLobes']=3
 living.data.materials.append(b.M['moss']);living.data.materials.append(b.M['cloth_light']);living.data.materials.append(b.M['nature_v4_woodlight'])
 for poly in living.data.polygons:
  zz=sum(living.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)
  if zz>1.045:poly.material_index=1 if poly.index%3 else 2
  elif poly.index%3==1:poly.material_index=3
 living['integratedNatureFaceBody']=True
 for side in (-1,1):
  # The organic eyes are recessed into the single body's front leaf plane.
  x=side*.116;y=.241;z=1.322
  b.panel('Nature integrated recessed leaf eye socket',[(x-.062,y,z),(x-.021,y+.006,z+.034),(x+.057,y,z+.012),(x+.025,y+.002,z-.034)],.032,'dark',tor,.004)
  b.panel('Nature integrated luminous almond eye',[(x-.042,y+.010,z),(x-.010,y+.014,z+.023),(x+.038,y+.010,z+.008),(x+.011,y+.014,z-.019)],.014,'nature_v4_luminous',tor,.003)['visualCue']='natureSpiritEyes'
  for j in range(4):
   leaf(b,'Nature living layered leaf shoulder collar',(side*.035,.12,1.15-j*.035),(side*(.31+j*.035),.15,1.03-j*.04),.083,'moss',tor)
  for tier in range(3):
   for j in range(5):
    a=side*(1.08+j*.47);zz=1.56-tier*.15;aa=(.32*math.sin(a),.25*math.cos(a),zz);cc=(.405*math.sin(a),.33*math.cos(a),zz-.245)
    leaf(b,'Nature integrated broad layered side back living leaf',aa,cc,.125,'moss' if j%2 else 'cloth_light',tor)
  antler=[(side*.17,-.055,1.50),(side*.26,-.064,1.64),(side*.40,-.085,1.73),(side*.40,-.08,1.86)]
  b.limb('Nature living wood crown branching antler',antler,[.067,.058,.048,.030],wood,head,8)
  forks=[[(side*.26,-.064,1.64),(side*.13,-.058,1.74),(side*.17,-.057,1.89)],[(side*.40,-.085,1.73),(side*.53,-.081,1.75),(side*.51,-.077,1.90)],[(side*.17,-.055,1.50),(side*.08,-.045,1.61),(side*.09,-.04,1.76)]]
  for fork in forks:
   b.limb('Nature actual crooked source woody antler fork',fork,[.049,.039,.025],wood,head,7);end=Vector(fork[-1]);b.jewel('Nature actual green branch bud',tuple(end+Vector((0,0,.049))),.060,.084,.051,'moss',head)
  b.jewel('Nature terminal green source antler bud',(side*.40,-.08,1.925),.057,.084,.051,'moss',head)
  sn='R'if side>0 else'L';sh=(side*.285,0,1.10);el=(side*.475,.048,.967);ha=(side*.63,.135,1.075);up,fore,wrist,weap=joints(b,sh,el,ha,sn,tor)
  b.limb('Nature integrated living root upper arm '+sn,[sh,(side*.38,.025,1.06),el],[.13,.11,.094],wood,up,8)
  b.limb('Nature living curved branch forearm '+sn,[el,(side*.55,.09,1.01),ha],[.097,.11,.11],wood,fore,8);ell(b,'Nature actual contacting branch elbow '+sn,el,(.105,.103,.106),wood,fore,8,3);ell(b,'Nature actual root palm '+sn,ha,(.103,.096,.085),wood,wrist,8,3)
  for j in (-1,0,1):leaf(b,'Nature living leaf hand fingers',(ha[0]+j*.047,ha[1],ha[2]),(ha[0]+j*.075,ha[1]+.03,ha[2]+.16),.041,'moss',wrist)
  b.jewel('Nature source held green living elemental crystal',(ha[0],ha[1]+.035,ha[2]+.195),.108,.18,.089,'moss',weap);b.pivot('attack_muzzle',(ha[0],ha[1]+.16,ha[2]+.195),weap)
 for j in (-1,0,1):b.jewel('Nature source floating root crystal',(j*.265,0,.175+abs(j)*.08),.114,.145,.107,'moss',b.root)
 b.root['locomotion']='flying';b.root['attackStyle']='staff';b.root['integratedHeadInTorso']=True;b.root['natureSpiritFaceContract']='unified-living-wood-leaf-body-face-v4';b.root['sourceUserOverrideV4']='No human flesh or separate head: continuous living wood/leaf body contains the face.'
 b.root['anatomyRevision']='geometric-source-fit-v4';return b

def apply_source_fit_v4(b,row):
 if b.root.get('sourceFitV4')=='review-0.3.3':return b
 contexts=getattr(b,'humanContexts',[])
 for c in contexts:
  if b.id in ('kingdomprotector','archangel'):integrated_helmet(b,c)
  if b.id in ('crownofages','elvenking'):layered_royal_hair(b,c)
  if row['spec'].get('weapon')=='crossbow' and b.id not in ('rimewatch','royalranger'):crossbow_fit(b,row,c)
  if b.id=='highking':highking_grip(b,c)
  if b.id=='royalranger':royal_clothes(b,c)
  riders_ahead_of_wings(b,c);horse_details(b,c)
 results=[]
 for c in contexts:
  result=flush_human_head(b,c['head'],c['torso'])
  if result:results.append(result)
 # Source-special humanoids have bespoke constructors rather than contexts.
 if not contexts and row['spec'].get('bodyKind')not in ('horse','dragon','bird','beast','bat','wyvern','siege','elemental'):
  head=next((o for o in b.coll.all_objects if o.type=='EMPTY'and o.name=='head_pivot'),None);torso=next((o for o in b.coll.all_objects if o.type=='EMPTY'and o.name=='torso_pivot'),None)
  if head and torso:
   result=flush_human_head(b,head,torso)
   if result:results.append(result)
 if results or b.id in ('mothernature','frostblade','roseguard','crownofages','elvenking','kingdomprotector','archangel','highking','royalranger','thunderheart','phoenix','griffinbomber','wyvernhunter','kingsrangerguard','host_25','host_28'):
  b.root['sourceFitV4']='review-0.3.3';b.root['humanoidHeadFitDetailsV4']=json.dumps(results);b.root['sourceHumanoidNeckUserOverrideV4']='Humanlike heads physically flush with body, no exposed neck; actual animal necks preserved.';b.root['anatomyRevision']='geometric-source-fit-v4'
 return b
