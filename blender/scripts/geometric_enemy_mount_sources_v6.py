"""Source-specific V6 mounted creature sculptures on retained native rigs.

All mesh coordinates are world metres. This module has no IO; the owned stage
author writes append-only scenes/exports. It never regenerates humanoids from
the generic V1 builder. Each species uses its original six-view evidence.
"""
import bpy,math,json
from mathutils import Vector,Matrix
from geometric_roster_builder import ell,cone,annulus,leaf
from geometric_champion_creature_fit_v4 import semantic,remove,descendants,points
from geometric_champion_shapes_v5 import tree,boolean,material
from geometric_creature_anatomy_v3 import octsection,grid_closed
from geometric_enemy_creature_anatomy_v6 import closed_boolean_cleanup
from geometric_game_common import metrics

OWNED=(5,15,19,25,27,28,29,30,34,35,37,39,40,42,45,47,48,50)
def joint(b,name,p,parent=None):
 ob=bpy.data.objects.get(name)
 if ob is None:return b.pivot(name,p,parent)
 children={c:c.matrix_world.copy()for c in ob.children_recursive}
 ob.matrix_world=Matrix.Translation(Vector(p))
 if parent:b.attach(ob,parent)
 for c,m in children.items():c.matrix_world=m
 bpy.context.view_layer.update();return ob
def remove_mount(b):
 if b.id=='host_40':
  n=len(b.objects);remove(b,list(b.objects));return n
 protected=set()
 for name in('torso_pivot','head_pivot','drummer_torso_pivot'):
  root=bpy.data.objects.get(name)
  if root:protected.update(o for o in b.objects if descendants(o,root))
 for ob in b.objects:
  if semantic(ob).startswith(('Upper leg ','Lower leg ','Grounded boot ','Ankle contacting boot joint ','Knee contacting articulated joint ')):protected.add(ob)
 mounted=bpy.data.objects.get('mount_torso_pivot')
 animalhips=list(dict.fromkeys(o.parent for o in b.objects if semantic(o).startswith('Animal upper leg ')))
 body=[o for o in b.objects if o not in protected and (mounted and descendants(o,mounted)or any(descendants(o,h)for h in animalhips)or semantic(o).startswith(('Animal ','Wing ','Continuous faceted wing','Connected angular neck','Connected articulated tail')))]
 remove(b,body)
 return len(body)
def source_materials(b):
 for key,col,metal in [('v6_wolf_ash','68676A',0),('v6_wolf_rift','69637D',0),('v6_wolf_black','38383D',0),('v6_wolf_red','8C3028',0),('v6_wolf_purple','AA88D8',0),('v6_bat_coat','46414E',0),('v6_bat_red','924A4D',0),('v6_bat_taupe','8C827A',0),('v6_bat_purple','816089',0),('v6_bat_orange','C8753E',0),('v6_bat_bone','E0D6BF',0),('v6_bat_cyan','A5C9C6',0),('v6_bern_scale','423D47',.12),('v6_bern_membrane','8C431E',0),('v6_bern_bronze','AE7950',.45),('v6_bern_amber','E49C43',.2),('v6_bern_ivory','B7BABE',0)]:
  if key not in b.M:material(b,key,col,metal)
 for key,col in [('ivory','E9D6B1'),('steel','8B8B8D'),('steel_dark','53545A'),('leather','654B34'),('wood','745034'),('dark','27282C'),('rune','79CEC3'),('gold','D4A85A')]:
  if key not in b.M:material(b,key,col)
 material(b,'v6_bat_dusty_rose','7D5669');material(b,'v6_blood_bat_coat','633D47')
def eye_socket(b,body,x,z,rx,rz,color,parent,label):
 hit=tree([body]).ray_cast(Vector((x,4,z)),Vector((0,-1,0)),8)
 assert hit[0]is not None,(b.id,'actual eye source surface',x,z)
 y=hit[0].y
 cut=ell(b,'temporary V6 real eye cavity cutter',(x,y-.005,z),(rx,.055,rz),'dark',parent,12,5);boolean(b,body,cut,'DIFFERENCE');closed_boolean_cleanup(body)
 ob=b.jewel(label+' '+('L'if x<0 else'R'),(x,y-.028,z),rx*.85,rz*.55,.014,color,parent)
 ob['actualEyeRecessDepthM']=.028
 return {'shell':body.name,'eye':ob.name,'centerM':[x,y-.028,z],'frontSurfaceY':y,'recessDepthM':.028}

def paw_leg(b,label,hip,knee,hock,ank,coat,root,scale=1,claw='ivory'):
 up=joint(b,'upper_leg_'+label,hip,root);sh=joint(b,'shin_'+label,knee,up);foot=joint(b,'foot_'+label,ank,sh)
 # Muscular shoulder roots begin within the barrel; the canine lower limb
 # narrows toward a genuine hock and four separated broad toe pads.
 b.limb('V6 mount anatomical thigh '+label,[hip,Vector(hip).lerp(Vector(knee),.43),knee],[(.16*scale,.18*scale),(.16*scale,.17*scale),(.102*scale,.111*scale)],coat,up,12)
 b.limb('V6 mount anatomical shin '+label,[knee,hock,ank],[(.104*scale,.112*scale),(.077*scale,.084*scale),(.074*scale,.075*scale)],coat,sh,12)
 x,y,z=ank
 paw=b.loft('V6 mount anatomical paw '+label,[b.ring(x,y+.058,.001,.116*scale,.155*scale,12),b.ring(x,y+.054,.045,.13*scale,.168*scale,12),b.ring(x,y+.018,z+.052,.095*scale,.12*scale,12)],coat,foot)
 for k in range(4):
  xx=x+(k-1.5)*.055*scale
  ell(b,'V6 mount source rounded contacting toe '+label,(xx,y+.151*scale,.067),(.037*scale,.065*scale,.051),coat,foot,8,4)
  b.limb('V6 mount source curved contacting claw '+label,[(xx,y+.190*scale,.068),(xx,y+.223*scale,.041),(xx,y+.230*scale,.009)],[.019*scale,.013*scale,.003],claw,foot,8)
 return paw

def fit_dorsal_plate(b,body,cx,y,z,width,length,mat,parent,label,positive_dorsal_relief=False):
 # Each scale samples the actual dorsal surface; overlapping root is inside
 # that surface and the distal point follows the source swept layered shape.
 coords=[];t=tree([body])
 for xx,yy in[(cx-width/2,y-length*.30),(cx+width/2,y-length*.30),(cx+width*.41,y+length*.30),(cx,y+length*.52),(cx-width*.41,y+length*.30)]:
  hit=t.ray_cast(Vector((xx,yy,5)),Vector((0,0,-1)),10)
  if hit[0]is None:raise AssertionError((b.id,label,'plate outside actual dorsal surface',xx,yy))
  coords.append((xx,yy,hit[0].z+.015))
 if positive_dorsal_relief:
  # The dorsal face points +Z even on a declining back surface. A front-Y
  # panel normal can otherwise direct its raised centre into the animal.
  center=sum((Vector(p)for p in coords),Vector())/len(coords);center.z+=.106
  vs=[(x,yy,zz+.028)for x,yy,zz in coords]+[(x,yy,zz-.041)for x,yy,zz in coords]+[tuple(center)];n=len(coords)
  fs=[(i,(i+1)%n,2*n)for i in range(n)]+[tuple(reversed(range(n,2*n)))]+[(i,n+i,n+(i+1)%n,(i+1)%n)for i in range(n)]
  return b.mesh(label,vs,fs,mat,parent)
 return b.panel(label,coords,.041,mat,parent,.036)

def wolf(b,wave):
 coat={19:'v6_wolf_ash',37:'v6_wolf_rift',47:'v6_wolf_black'}[wave];root=joint(b,'mount_torso_pivot',(0,-.10,.75),b.root)
 rings=[octsection(y,w,lo,hi)for y,w,lo,hi in[(-.64,.19,.49,.83),(-.46,.29,.40,.95),(-.15,.31,.41,1.025),(.14,.295,.43,1.02),(.34,.24,.51,.97)]]
 body=b.loft('V6 mount continuous anatomical thorax',rings,coat,root)
 neck=b.limb('V6 wolf curved muscular neck',[(0,.18,.80),(0,.32,.96),(0,.49,1.12),(0,.59,1.19)],[(.25,.245),(.242,.237),(.19,.195),(.169,.177)],coat,root,14)
 head=joint(b,'mount_head_pivot',(0,.65,1.18),root)
 skull=b.loft('V6 wolf source faceted skull',[octsection(y,w,lo,hi)for y,w,lo,hi in[(.49,.18,1.035,1.37),(.62,.245,1.01,1.39),(.80,.205,.99,1.315),(.91,.153,.973,1.21),(1.07,.118,.984,1.153)]],coat,head)
 mouth=joint(b,'mouth_pivot',(0,.88,1.015),head)
 cut=ell(b,'temporary V6 wolf actual mouth recess',(0,1.025,1.036),(.115,.18,.024),'dark',mouth,12,5);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
 ell(b,'V6 wolf actual recessed dark mouth',(0,1.047,1.038),(.097,.018,.014),'dark',mouth,10,4)
 ell(b,'V6 wolf contacting broad dark nose',(0,1.073,1.110),(.098,.044,.050),'dark',mouth,12,5)
 sockets=[eye_socket(b,skull,side*.152,1.263,.036,.028,'v6_wolf_purple'if wave==37 else'v6_wolf_red',head,'V6 wolf actual recessed source eye')for side in(-1,1)]
 for side in(-1,1):
  b.limb('V6 wolf source upright pointed ear',[(side*.163,.568,1.30),(side*.19,.50,1.47),(side*.19,.482,1.57)],[(.076,.074),(.051,.048),(.005,.007)],coat,head,10)
  b.limb('V6 wolf real inner ear',[(side*.17,.597,1.34),(side*.19,.545,1.465),(side*.19,.511,1.519)],[(.041,.010),(.026,.010),(.003,.003)],'leather',head,8)
  for k in range(2):b.limb('V6 wolf contacting natural jaw fang',[(side*(.078+k*.028),.998-k*.056,1.048),(side*(.075+k*.027),1.002-k*.056,1.001)],[.015,.003],'ivory',mouth,8)
 for front,y in[(True,.25),(False,-.45)]:
  for side in(-1,1):
   label=('F'if front else'B')+('R'if side>0 else'L');hip=(side*.205,y,.79);knee=(side*.29,y+(.00 if front else-.12),.365);hock=(side*.30,y+(.035 if front else.005),.18);ank=(side*.30,y+.092,.115)
   paw_leg(b,label,hip,knee,hock,ank,coat,root,claw='dark')
 tail=[(0,-.48,.87),(0,-.67,.78),(.11,-.90,.78),(.22,-1.02,.93),(.25,-1.06,1.10),(.23,-1.05,1.21)]
 b.limb('V6 wolf source broad bushy curled tail',tail,[(.155,.143),(.163,.148),(.134,.131),(.112,.118),(.077,.09),(.010,.013)],coat,root,12)
 for k in range(4):
  p=Vector(tail[min(k+1,len(tail)-2)]);leaf(b,'V6 wolf overlapping swept tail fur lock',p+Vector((-.08,0,.04)),p+Vector((.12,-.105,-.035)),.060,coat,root)
 armor='v6_wolf_red'if wave==19 else'steel_dark';stripe='v6_wolf_purple'if wave==37 else armor if wave==19 else'ivory'
 for k,y in enumerate((-.45,-.29,-.13,.035,.20)):
  fit_dorsal_plate(b,body,0,y,1.0,.34,.245,armor,root,'V6 wolf fitted overlapping source dorsal plate')
  hit=tree([body]).ray_cast(Vector((0,y,5)),Vector((0,0,-1)),10)[0]
  b.limb('V6 wolf source contacting swept dorsal spike',[hit-Vector((0,0,.009)),hit+Vector((0,-.063,.12)),hit+Vector((0,-.10,.17))],[.065,.044,.004],stripe,root,8)
 for side in(-1,1):
  # Leather tack follows the actual flank and ties saddle to girth, instead
  # of leaving armour or reins as unrelated blocks.
  b.limb('V6 wolf source fitted flank leather girth',[(side*.22,-.14,1.0),(side*.32,-.14,.83),(side*.27,-.14,.55)],[.023]*3,'leather',root,8)
 if wave==47:
  mask=b.loft('V6 Last Howl actual ivory wolf skull mask',[octsection(y,w,lo,hi)for y,w,lo,hi in[(.713,.209,1.04,1.333),(.83,.185,1.02,1.30),(.985,.13,.987,1.185),(1.065,.10,.991,1.141)]],'ivory',head)
  for side in(-1,1):eye_socket(b,mask,side*.15,1.26,.048,.043,'v6_wolf_red',head,'V6 Last Howl skull mask actual deep red eye cavity')
  for side in(-1,1):
   for k in range(2):
    p=Vector((side*(.056+k*.035),1.0-k*.053,1.032));b.limb('V6 Last Howl skull mask source actual pointed contacting jaw tooth',[p,p+Vector((0,.023,-.055)),p+Vector((side*.007,.013,-.104))],[.026,.019,.003],'ivory',head,10)
   for k in range(2):
    p=Vector((side*(.105+k*.042),.756-k*.04,1.292+k*.026));b.limb('V6 Last Howl actual contacting swept ivory skull ridge',[p,p+Vector((side*.027,-.028,.10)),p+Vector((side*.024,-.06,.16))],[.041,.027,.003],'ivory',head,10)
  b.limb('V6 Last Howl source actual pointed central ivory forehead ridge',[(0,.782,1.293),(0,.760,1.40),(0,.745,1.462)],[.069,.038,.004],'ivory',head,10)
  cutter=ell(b,'temporary Last Howl real skull-mask nasal opening',(0,1.067,1.087),(.041,.11,.035),'dark',head,10,4);boolean(b,mask,cutter,'DIFFERENCE');closed_boolean_cleanup(mask)
  ell(b,'V6 Last Howl actual deep skull-mask nasal interior',(0,1.003,1.087),(.030,.015,.026),'dark',head,10,4)
  t=tree([body,neck])
  for side in(-1,1):
   for yy,zz in[(-.44,.70),(-.33,.85),(-.20,.73),(-.08,.87),(.045,.72),(.17,.86),(.29,.79),(.41,.98),(.48,1.11)]:
    hit=t.ray_cast(Vector((side*4,yy,zz)),Vector((-side,0,0)),8)[0]
    if hit is None:continue
    base=hit-Vector((side*.012,0,0));tip=hit+Vector((side*.072,-.142,-.073));leaf(b,'V6 Last Howl actual contacting layered shaggy flank fur',base,tip,.074,coat,root)
 else:
  # A short fitted forehead/cheek plate replaces the two floating angular
  # head blocks. It follows the source face and seats in the cranial volume.
  for side in(-1,1):
   b.limb('V6 wolf fitted source cheek armor',[(side*.175,.58,1.31),(side*.20,.72,1.235),(side*.168,.84,1.17)],[.074,.077,.050],armor,head,8)
   b.limb('V6 wolf source contacting cheek and neck tack',[(side*.13,.86,1.23),(side*.23,.73,1.19),(side*.20,.48,1.12),(side*.23,.31,.94)],[.018,.020,.022,.020],'leather',root,8)
  if wave==19:
   # Three separately swept pointed forehead scales leave the face readable.
   # Every root samples the actual skull instead of using a flat full-width lid.
   for cx,yy,ww,ll in[(0,.71,.19,.265),(-.13,.643,.14,.225),(.13,.643,.14,.225)]:
    fit_dorsal_plate(b,skull,cx,yy,1.4,ww,ll,armor,head,'V6 bloodwolf actual fitted jagged red forehead scale')
    hit=tree([skull]).ray_cast(Vector((cx,yy,5)),Vector((0,0,-1)),10)[0]
    b.limb('V6 bloodwolf actual contacting pointed red cranial harness spike',[hit-Vector((0,0,.01)),hit+Vector((cx*.15,-.030,.090)),hit+Vector((cx*.25,-.065,.13))],[.036,.027,.003],armor,head,8)
   t=tree([neck,skull])
   for side in(-1,1):
    for cz,cx in[(1.22,.185),(1.08,.163),(.97,.170)]:
     coords=[]
     for xx,zz in[(side*(cx-.041),cz+.062),(side*(cx+.034),cz+.037),(side*(cx+.037),cz-.012),(side*cx,cz-.092),(side*(cx-.040),cz-.009)]:
      hit=t.ray_cast(Vector((xx,4,zz)),Vector((0,-1,0)),8)[0]
      assert hit is not None,(b.id,'source red jagged cheek-neck harness bearing',xx,zz)
      coords.append((xx,hit.y+.012,zz))
     b.panel('V6 bloodwolf actual fitted jagged red cheek and neck harness plate',coords,.034,armor,root,.011)
  else:
   b.loft('V6 wolf continuous fitted source brow crown',[octsection(y,w,lo,hi)for y,w,lo,hi in[(.55,.186,1.293,1.395),(.65,.244,1.306,1.41),(.80,.192,1.267,1.344),(.872,.134,1.222,1.272)]],armor,head)
  for side in(-1,1):
   b.limb('V6 wolf fitted back crupper leather strap',[(side*.21,-.18,1.01),(side*.29,-.37,.91),(side*.23,-.55,.71)],[.022]*3,'leather',root,8)
 return {'species':'wolf','thorax':body.name,'neck':neck.name,'skull':skull.name,'actualEyes':sockets,'seatM':[0,-.13,1.04],'muzzleM':[0,1.105,1.079],'replacedGenericMount':True,'sourceIdentityWave':wave}

def bernhard(b):
 root=joint(b,'mount_torso_pivot',(0,-.13,.77),b.root);coat='v6_bern_scale'
 for name in('upper_leg_FL','upper_leg_FR','upper_leg_L','upper_leg_R'):
  ob=bpy.data.objects.get(name)
  if ob:
   for child in list(ob.children_recursive)[::-1]:bpy.data.objects.remove(child,do_unlink=True)
   bpy.data.objects.remove(ob,do_unlink=True)
 body=b.loft('V6 mount continuous anatomical thorax',[octsection(y,w,lo,hi)for y,w,lo,hi in[(-.61,.21,.45,.88),(-.40,.35,.41,1.05),(-.11,.39,.44,1.11),(.19,.34,.51,1.08),(.35,.28,.64,1.08)]],coat,root)
 path=[(0,.16,.86),(0,.32,1.04),(0,.45,1.25),(0,.58,1.47),(0,.70,1.66)]
 neck=b.limb('V6 Bernhard continuous curved segmented neck',path,[(.29,.27),(.27,.25),(.239,.231),(.204,.217),(.18,.197)],coat,root,14)
 neck.data.materials.append(b.M['v6_bern_ivory'])
 for polygon in neck.data.polygons:
  # Real forward-facing neck surface is ivory across the broad source throat,
  # with dark overlapping scales retained over the rear and sides.
  if polygon.normal.y>.25:polygon.material_index=len(neck.data.materials)-1
 head=joint(b,'mount_head_pivot',(0,.78,1.66),root)
 skull=b.loft('V6 Bernhard source jaw shell',[octsection(y,w,lo,hi)for y,w,lo,hi in[(.60,.17,1.49,1.91),(.79,.28,1.45,1.93),(.96,.254,1.397,1.83),(1.16,.20,1.35,1.68),(1.31,.15,1.32,1.60)]],coat,head)
 mouth=joint(b,'mouth_pivot',(0,1.02,1.40),head)
 cut=ell(b,'temporary Bernhard true jaw aperture',(0,1.15,1.435),(.210,.211,.022),'dark',mouth,14,6);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
 ell(b,'V6 Bernhard real deep jaw interior',(0,1.19,1.435),(.160,.024,.009),'dark',mouth,12,5)
 eyes=[eye_socket(b,skull,side*.19,1.754,.048,.035,'v6_bern_amber',head,'V6 Bernhard actual recessed amber eye')for side in(-1,1)]
 for side in(-1,1):
  for k in range(3):
   a=(side*(.205-.034*k),.81-.064*k,1.79+.034*k);c=(side*(.31+.018*k),.62-.055*k,2.01+.065*k);tip=(side*(.34+.013*k),.46-.06*k,2.08+.073*k)
   b.limb('V6 Bernhard source swept horn pair '+str(k+1),[a,c,tip],[(.086,.079),(.059,.047),(.006,.007)],coat,head,12)
   q=Vector(a)+Vector((side*.012,.044,.018));r=Vector(c)+Vector((side*.011,.026,.006));b.limb('V6 Bernhard actual amber inset swept horn', [q,r,Vector(tip)+Vector((0,.008,-.034))],[.024,.022,.003],'v6_bern_membrane',head,8)
  for k in range(3):
   yy=1.24-k*.082;b.limb('V6 Bernhard actual curved jaw fang',[(side*(.09+k*.038),yy,1.45),(side*(.087+k*.036),yy+.006,1.379)],[.022,.004],'ivory',mouth,8)
 # The continuous ivory throat surface follows each actual neck section.
 throat=[]
 for k,p in enumerate(path):
  r=(.27,.25,.231,.217,.197)[k];throat.append(Vector(p)+Vector((0,r-.012,0)))
 b.limb('V6 Bernhard fitted continuous ivory throat',throat,[(.225,.029),(.219,.030),(.19,.032),(.165,.030),(.144,.029)],'v6_bern_ivory',root,12)
 for k in range(4):
  p=throat[k].lerp(throat[k+1],.53);b.limb('V6 Bernhard ivory throat real segmented rim',[p+Vector((-.16,0,0)),p+Vector((0,.015,-.007)),p+Vector((.16,0,0))],[.009]*3,'v6_bern_ivory',root,8)
 necktree=tree([neck])
 for k,(z,w)in enumerate(((1.04,.22),(1.18,.209),(1.32,.182),(1.46,.158),(1.585,.135))):
  coords=[]
  for xx,zz in[(-w*.82,z+.075),(w*.82,z+.075),(w,z-.035),(0,z-.073),(-w,z-.035)]:
   hit=necktree.ray_cast(Vector((xx,4,zz)),Vector((0,-1,0)),8)[0]
   assert hit is not None,(b.id,'source throat real surface',xx,zz)
   coords.append((xx,hit.y+.016,zz))
  b.panel('V6 Bernhard source actual overlapping ivory throat plate',coords,.039,'v6_bern_ivory',root,.014)
 for k,(yy,w,lo,hi)in enumerate(((.67,.20,1.754,1.930),(.83,.244,1.704,1.917),(1.00,.214,1.598,1.800),(1.17,.18,1.51,1.682))):
  fit_dorsal_plate(b,skull,0,yy,hi,w*1.56,.18,coat,head,'V6 Bernhard actual overlapping angular forehead scale')
 for side in(-1,1):
  b.limb('V6 Bernhard source angular eye brow plate',[(side*.12,.77,1.837),(side*.21,.88,1.804),(side*.25,.91,1.738)],[(.064,.052),(.068,.054),(.048,.043)],coat,head,8)
  b.limb('V6 Bernhard source overlapping angular cheek jaw plate',[(side*.22,.88,1.65),(side*.219,1.04,1.548),(side*.15,1.23,1.50)],[(.066,.055),(.058,.052),(.037,.035)],coat,head,8)
 for front,y in[(False,-.20)]:
  for side in(-1,1):
   label='B'+('R'if side>0 else'L');paw_leg(b,label,(side*.245,y,.80),(side*.355,y-.12,.38),(side*.355,y-.035,.20),(side*.35,y+.12,.12),coat,root,1.2,claw='dark')
 tail=[(0,-.50,.89),(0,-.75,.79),(.13,-1.00,.83),(.30,-1.17,.99),(.40,-1.23,1.19),(.39,-1.20,1.40),(.32,-1.12,1.56)]
 tailmesh=b.limb('V6 Bernhard long curled armored anatomical tail',tail,[(.168,.15),(.149,.139),(.125,.12),(.105,.102),(.076,.083),(.052,.058),(.017,.02)],coat,root,14)
 for k,y in enumerate((-.43,-.245,-.055,.13)):
  fit_dorsal_plate(b,body,0,y,1.0,(.42,.56,.58,.48)[k],.30,coat,root,'V6 Bernhard source overlapped obsidian dorsal scale')
 for k,p in enumerate(path[1:-1]):
  for side in(-1,1):
   q=Vector(p)+Vector((side*(.215-k*.028),-.045,.035));b.limb('V6 Bernhard fitted overlapping lateral neck scale',[q,q+Vector((side*.025,-.12,-.065))],[(.07,.06),(.030,.035)],coat,root,8)
 for k in range(1,len(tail)-1):
  p=Vector(tail[k]);b.limb('V6 Bernhard actual fitted swept tail armor scale',[p+Vector((0,0,.065)),p+Vector((0,-.07,.13))],[.081-k*.008,.022],coat,root,8)
 for side in(-1,1):
  for k in range(3):
   p=(side*(.295+k*.004),-.30+k*.11,.86-k*.04);q=Vector(p)+Vector((side*.024,-.14,-.085))
   b.limb('V6 Bernhard actual overlapping lateral haunch armor',[p,q],[(.094,.082),(.064,.046)],coat,root,10)
 p=Vector(tail[-1]);b.panel('V6 Bernhard actual obsidian pointed tail tip',[tuple(p+Vector(q))for q in[(-.11,0,-.03),(0,0,.22),(.11,0,-.03),(0,0,-.09)]],.075,coat,root,.018)
 b.panel('V6 Bernhard actual orange inset tail tip',[tuple(p+Vector(q))for q in[(-.068,.028,-.025),(0,.028,.145),(.068,.028,-.025),(0,.028,-.064)]],.019,'v6_bern_membrane',root,.005)
 wings(b,root,1.075,1.46,.94,coat,'v6_bern_membrane',wave=50)
 # Fitted bronze chest harness straps sit across the real upper barrel.
 for side in(-1,1):
  b.limb('V6 Bernhard strapped source bronze chest plate',[(side*.13,.48,.94),(side*.245,.35,.80),(side*.23,.20,.65)],[(.089,.044),(.104,.042),(.081,.040)],'v6_bern_bronze',root,10)
  b.limb('V6 Bernhard source actual leather chest strap',[(side*.24,.18,1.07),(side*.33,.34,.88),(side*.26,.21,.66)],[.022]*3,'leather',root,8)
 chesttree=tree([body,neck])
 for level,z in enumerate((.79,.94,1.075)):
  coords=[]
  for xx,zz in[(-.18,z+.065),(.18,z+.065),(.205,z-.050),(0,z-.11),(-.205,z-.050)]:
   hit=chesttree.ray_cast(Vector((xx,4,zz)),Vector((0,-1,0)),8)[0];assert hit is not None,(b.id,'source actual chest bearing',xx,zz)
   coords.append((xx,hit.y+.014,zz))
  b.panel('V6 Bernhard actual fitted overlapping strapped bronze chest armor',coords,.038,'v6_bern_bronze',root,.024)
 return {'species':'wyvern','thorax':body.name,'neck':neck.name,'skull':skull.name,'actualEyes':eyes,'seatM':[0,-.16,1.13],'muzzleM':[0,1.35,1.435],'sourceHornPairs':3,'sourceIdentityWave':50,'longCurledTail':tailmesh.name}

def wings(b,root,z,span,rise,coat,membrane,wave):
 for side in(-1,1):
  sn='R'if side>0 else'L';a=(side*.22,-.01,z);el=(side*span*.46,-.03,z+rise*.42);w=(side*span*.64,-.075,z+rise)
  pa=joint(b,'wing_'+sn,a,root)
  tips=[(side*span,-.09,z+rise*.42),(side*span*.89,-.055,z-.18),(side*span*.66,-.03,z-.055),(side*span*.49,-.01,z-.20),(side*span*.35,.025,z-.09),(side*.22,.026,z-.15)]
  # Actual concave scallops join the finger tips; thickness follows a curved
  # surface. No triangular sails substitute for the source wing silhouette.
  outline=[a,el,w,tips[0]]
  for j in range(len(tips)-1):
   p=Vector(tips[j]);q=Vector(tips[j+1]);m=p.lerp(q,.52);m.z+=.12 if j%2 else.16;outline.extend([tuple(m),tuple(q)])
  b.panel('V6 source mounted closed scalloped membrane '+sn,outline,.027,membrane,pa,.017)
  b.limb('V6 source mounted wing shoulder elbow wrist bone '+sn,[a,el,w],[.097,.075,.046],coat,pa,12)
  for j in(0,2,4):
   tip=tips[j];b.limb('V6 source actual membrane finger '+sn,[w,Vector(w).lerp(Vector(tip),.49)+Vector((0,.012,.018)),tip],[.042,.026,.008],coat,pa,10)
  b.limb('V6 source actual contacting wing thumb claw '+sn,[w,Vector(w)+Vector((side*.035,0,.10)),Vector(w)+Vector((side*.03,.017,.145))],[.036,.018,.004],'ivory',pa,8)

def bat(b,wave):
 """Source profiles share bat anatomy, while garments, facial covers,
 membrane tears, horns and metal are individually authored source features."""
 hanging=wave in(5,34);skeletal=wave==27
 coat={5:'v6_bat_coat',15:'v6_bat_red',25:'v6_bat_coat',27:'v6_bat_bone',29:'v6_bat_purple',30:'v6_bat_coat',34:'v6_bat_coat',35:'v6_bat_purple',42:'v6_bat_coat',45:'v6_bat_coat',48:'v6_bat_purple'}[wave]
 if wave==15:coat='v6_blood_bat_coat'
 membrane={5:'v6_bat_dusty_rose',15:'v6_bat_red',25:'v6_bat_dusty_rose',27:'v6_bat_cyan',29:'v6_bat_purple',30:'v6_bat_red',34:'v6_bat_taupe',35:'v6_bat_purple',42:'v6_bat_orange',45:'v6_bat_red',48:'v6_bat_red'}[wave]
 if wave==34:
  material(b,'v6_bonecarrier_actual_taupe_membrane','6E5E4D')
  membrane='v6_bonecarrier_actual_taupe_membrane'
 if wave==35:
  material(b,'v6_eclipse_actual_dusty_pink_membrane','8E6373')
  membrane='v6_eclipse_actual_dusty_pink_membrane'
 z=1.56 if hanging else .69;span={5:1.19,15:1.23,25:1.16,27:1.17,29:1.16,30:1.42,34:1.22,35:1.19,42:1.23,45:1.28,48:1.22}[wave];rise=.70 if not hanging else .64
 root=joint(b,'mount_torso_pivot',(0,-.10,z),b.root);head=joint(b,'mount_head_pivot',(0,.27,z+.15),root)
 if skeletal:
  body=b.limb('V6 Spectral bat actual curved structural spine',[(0,-.34,z+.04),(0,-.16,z+.23),(0,.04,z+.25),(0,.19,z+.20)],[(.073,.063),(.080,.065),(.084,.067),(.068,.062)],coat,root,10)
  for k in range(5):
   yy=-.28+k*.10
   for side in(-1,1):
    b.limb('V6 Spectral bat actual open curved anatomical rib',[(0,yy,z+.24),(side*.19,yy,z+.16),(side*.28,yy,z-.055),(side*.18,yy,z-.22),(side*.018,yy,z-.235)],[.038,.035,.033,.029,.025],coat,root,10)
  b.limb('V6 Spectral bat actual curved contacting sternum',[(0,-.27,z-.23),(0,-.04,z-.23),(0,.20,z-.18)],[.047,.049,.043],coat,root,10)
  for side in(-1,1):
   b.limb('V6 Spectral bat actual contacting scapular wing bearing',[(0,-.01,z+.225),(side*.13,-.01,z+.21),(side*.22,-.01,z+.18)],[.061,.064,.077],coat,root,12)
   b.limb('V6 Spectral bat actual contacting articulated pelvic bone',[(0,-.17,z-.215),(side*.10,-.17,z-.19),(side*.18,-.17,z-.15)],[.059,.061,.076],coat,root,12)
 else:
  body=b.loft('V6 mount continuous anatomical thorax',[octsection(y,w,z+lo,z+hi)for y,w,lo,hi in[(-.40,.14,-.16,.12),(-.25,.249,-.29,.25),(0,.278,-.29,.30),(.20,.215,-.20,.27),(.30,.16,-.10,.22)]],coat,root)
 neck=b.limb('V6 bat actual muscular cervical root',[(0,.11,z+.12),(0,.27,z+.15)],[(.164,.152),(.155,.141)],coat,root,12)
 skull=b.loft('V6 bat source short faceted cranium',[octsection(y,w,z+lo,z+hi)for y,w,lo,hi in[(.16,.13,-.005,.325),(.28,.219,-.035,.326),(.43,.214,-.065,.282),(.55,.139,-.034,.195)]],coat,head)
 mouth=joint(b,'mouth_pivot',(0,.47,z+.03),head)
 if skeletal:
  # The source skull has separate square eye sockets and a small angular
  # jaw gape. Its brow and nasal bridge remain real bone between openings.
  cut=b.box('temporary spectral actual source angular jaw opening',(0,.53,z+.060),(.246,.22,.095),'dark',.016,head);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
  b.box('V6 Spectral bat actual deep dark jaw interior',(0,.445,z+.060),(.199,.020,.072),'dark',.013,head)
  for side in(-1,1):
   cut=b.box('temporary spectral actual nasal aperture',(side*.028,.55,z+.127),(.029,.14,.041),'dark',.007,head);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
 else:
  cut=ell(b,'temporary bat true narrow mouth',(0,.52,z+.025),(.140,.095,.020),'dark',mouth,12,5);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
  ell(b,'V6 bat actual deep narrow mouth interior',(0,.485,z+.027),(.112,.015,.010),'dark',mouth,10,4)
  material(b,'v6_bat_nose','BE8586');b.loft('V6 bat actual short flattened pink nose',[b.ring(0,.559,z+.040,.094,.029,8),b.ring(0,.555,z+.112,.093,.029,8)],'v6_bat_nose',mouth)
  for side in(-1,1):b.box('V6 bat actual small dark nostril',(side*.036,.581,z+.093),(.024,.012,.020),'dark',.005,mouth)
 eyes=[]
 for side in(-1,1):
  x=side*.110;zz=z+.211;hit=tree([skull]).ray_cast(Vector((x,4,zz)),Vector((0,-1,0)),8)[0]
  if hit is not None:
   cut=b.box('temporary actual bat square eye cavity',(x,hit.y-.006,zz),(.073,.084,.075),'dark',.010,head);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
   eye=b.box('V6 bat actual recessed dark source eye '+('L'if side<0 else'R'),(x,hit.y-.033,zz),(.049,.021,.052),'dark',.006,head);eyes.append({'shell':skull.name,'eye':eye.name,'recessDepthM':.033})
 for side in(-1,1):
  for k in range(2 if skeletal else 1):
   b.limb('V6 bat actual contacting anatomical fang',[(side*(.076+k*.051),.535,z+.054),(side*(.088+k*.047),.555,z-.036-(.03 if skeletal else 0))],[.021,.004],'ivory',mouth,8)
  outline=[(side*.13,.22,z+.27),(side*.35,.19,z+.66),(side*.29,.32,z+.40),(side*.20,.34,z+.19)]
  b.panel('V6 bat source tall pointed anatomical ear',outline,.059,coat,head,.026)
  inner=[(side*.181,.277,z+.31),(side*.321,.258,z+.57),(side*.27,.351,z+.39)]
  b.panel('V6 bat actual contacting recessed inner ear',inner,.018,'leather'if skeletal else'v6_bat_nose',head,.010)
 for side in(-1,1):
  sn='L'if side<0 else'R';hip=(side*.18,-.17,z-.15);knee=(side*.22,-.08,z-.37);ank=(side*.23,.035,z-.52 if hanging else .135)
  up=joint(b,'upper_leg_'+sn,hip,root);sh=joint(b,'shin_'+sn,knee,up);ft=joint(b,'foot_'+sn,ank,sh)
  b.limb('V6 bat actual contacting hind thigh '+sn,[hip,knee],[(.075,.069),(.064,.058)]if skeletal else[(.124,.129),(.099,.098)],coat,up,12)
  b.limb('V6 bat actual hind shin and ankle '+sn,[knee,ank],[(.064,.060),(.047,.043)]if skeletal else[(.099,.099),(.065,.069)],coat,sh,12)
  ax,ay,az=ank
  ell(b,'V6 bat actual contacting tarsal palm '+sn,(ax,ay+.030,az-.02),(.072,.091,.061),coat,ft,10,4)
  for j in range(3):
   a=(ax+(j-1)*.055,ay+.027,az-.030);tip=(ax+(j-1)*.065,ay+.137,max(.009,az-.106))
   b.limb('V6 bat real naturally curled hind toe '+sn,[a,Vector(a).lerp(Vector(tip),.53)+Vector((0,.011,.018)),tip],[.022 if skeletal else .030,.020,.006],coat,ft,10)
  if skeletal:
   for p in(hip,knee,ank):ell(b,'V6 spectral actual touching articulated bone knuckle',p,(.077,.062,.077),coat,up if p==hip else sh if p==knee else ft,10,4)
 wings(b,root,z+.18,span,rise,'ivory'if wave in(27,34)else coat,membrane,wave)
 if wave in(15,30):
  for side in(-1,1):
   wing=next(o for o in b.objects if semantic(o)=='V6 source mounted closed scalloped membrane '+('L'if side<0 else'R'))
   for j in range(2):
    x=side*span*(.76-.15*j);zz=z+.18+rise*(.27-.27*j);c=ell(b,'temporary true ragged membrane tear',(x,-.07,zz),(.041,.16,.077),'dark',wing.parent,10,4);boolean(b,wing,c,'DIFFERENCE');closed_boolean_cleanup(wing)
 if wave in(25,42):
  armor='steel'if wave==25 else'steel_dark'
  cover=b.loft('V6 bat source fitted metal forehead shell',[octsection(y,w,z+lo,z+hi)for y,w,lo,hi in[(.18,.135,.205,.344),(.29,.227,.226,.349),(.44,.202,.227,.302),(.52,.112,.152,.217)]],armor,head)
  for side in(-1,1):
   b.limb('V6 bat actual fitted riveted metal cheek',[(side*.178,.29,z+.242),(side*.19,.435,z+.161),(side*.147,.49,z+.036)],[(.046,.037),(.048,.038),(.043,.033)],armor,head,10)
   wing=bpy.data.objects['wing_'+('L'if side<0 else'R')];p=wing.matrix_world.translation;ell(b,'V6 bat real fitted wing root steel pauldron',p+Vector((side*.055,0,.040)),(.158,.083,.105),armor,wing,12,5)
  for k in range(3):
   zz=z-.10+k*.12;b.limb('V6 bat actual fitted overlapping belly guard',[(-.17,.20,zz),(0,.286,zz-.017),(.17,.20,zz)],[.032,.035,.032],armor,root,10)
 if wave in(29,48):
  gem='rune'if wave==29 else'gold'
  for side in(-1,1):
   for k in range(2):b.limb('V6 bat actual anchored source face prism',[(side*.135,.28,z+.274+k*.04),(side*(.20+.06*k),.22,z+.40+k*.115)],[.041,.003],gem,head,6)
   wing=bpy.data.objects['wing_'+('L'if side<0 else'R')];p=wing.matrix_world.translation
   b.limb('V6 bat actual attached wing root prism',[p+Vector((0,0,.03)),p+Vector((side*.11,-.025,.18))],[.052,.004],gem,wing,6)
  if wave==29:
   material(b,'v6_prismatic_source_gem','64CFC2',.15)
   # Source diamonds project in front of the brow/wing skin, rather than
   # being largely buried inside the generic cranium and dorsal thorax.
   b.jewel('V6 Prismatic actual broad attached forehead diamond',(0,.548,z+.263),.124,.205,.070,'v6_prismatic_source_gem',head)
   for side in(-1,1):
    wing=bpy.data.objects['wing_'+('L'if side<0 else'R')]
    b.jewel('V6 Prismatic actual broad attached wing-root diamond',(side*.405,.115,z+.095),.104,.184,.091,'v6_prismatic_source_gem',wing)
   b.jewel('V6 Prismatic actual broad fitted rear thorax diamond',(0,-.405,z+.033),.123,.183,.103,'v6_prismatic_source_gem',root)
 if wave==30:
  for side in(-1,1):
   b.limb('V6 bat king source curved golden temple horn',[(side*.15,.21,z+.17),(side*.39,.24,z-.05),(side*.46,.22,z+.18),(side*.38,.23,z+.50),(side*.27,.22,z+.60)],[.105,.12,.095,.058,.007],'gold',head,12)
   b.limb('V6 bat king contacting fitted gold chest chain',[(side*.16,.34,z+.23),(side*.25,.33,z-.10),(side*.17,.31,z-.24)],[.014]*3,'gold',root,10)
  fit_dorsal_plate(b,skull,0,.33,z+.30,.25,.22,'steel_dark',head,'V6 bat king source actual fitted forehead plate')
  for side in(-1,1):
   outline=[(side*.12,.28,z-.025),(side*.22,.27,z-.22),(side*.17,.29,z-.42),(side*.10,.29,z-.53),(side*.015,.28,z-.40)]
   b.panel('V6 bat king source actual layered ragged red chest caparison',outline,.028,'v6_bat_red',root,.023)
   for k in range(8):annulus(b,'V6 bat king source physical contacting chest chain',(side*.225,.30,z+.10-.057*k),.022,.009,'gold',root,True,10,4)
 if wave==35:
  for side in(-1,1):
   wing=bpy.data.objects['wing_'+('L'if side<0 else'R')];p=wing.matrix_world.translation
   # Source wing guards are broad real U-shaped silver crescents, not rods.
   cx=side*.40;cz=z+.32;n=16;vs=[]
   for yy,rr in((.047,.166),(.047,.097),(.004,.166),(.004,.097)):
    vs.extend((cx+math.cos(math.radians(135+270*j/n))*rr,yy,cz+math.sin(math.radians(135+270*j/n))*rr)for j in range(n+1))
   stride=n+1;fs=[]
   for j in range(n):
    fs.extend([(j,j+1,stride+j+1,stride+j),(2*stride+j,3*stride+j,3*stride+j+1,2*stride+j+1),(j,2*stride+j,2*stride+j+1,j+1),(stride+j,stride+j+1,3*stride+j+1,3*stride+j)])
   fs.extend([(0,stride,3*stride,2*stride),(n,2*stride+n,3*stride+n,stride+n)])
   b.mesh('V6 Eclipse actual broad silver open crescent wing-root guard',vs,fs,'steel',wing)
 if wave==34:
  mask=b.loft('V6 Bonecarrier bat source hollow ivory skull mask',[octsection(y,w,z+lo,z+hi)for y,w,lo,hi in[(.29,.225,.11,.337),(.43,.207,.066,.300),(.55,.140,.043,.211)]],'ivory',head)
  for side in(-1,1):
   cut=b.box('temporary bonecarrier real eye hole',(side*.11,.49,z+.215),(.083,.24,.077),'dark',.009,head);boolean(b,mask,cut,'DIFFERENCE');closed_boolean_cleanup(mask)
 # Source bridle joins cranial sides to the belly girth; buckles intersect.
 if not skeletal:
  for side in(-1,1):
   p=[(side*.11,.48,z+.017),(side*.225,.31,z+.12),(side*.242,.02,z+.17),(side*.22,-.28,z+.09),(side*.16,-.24,z-.22)]
   b.limb('V6 bat source contacting fitted leather bridle',p,[.025]*5,'leather',root,8)
   ell(b,'V6 bat fitted source exposed tack buckle',(side*.238,.015,z+.16),(.027,.022,.033),'steel',root,8,3)
 b.limb('V6 bat actual tapering caudal root',[(0,-.28,z-.11),(0,-.48,z-.12),(0,-.60,z-.19)],[.077,.047,.005],coat,root,10)
 seat=[0,-.14,.43 if hanging else z+.295]
 return {'species':'spectral-bat'if skeletal else'bat','thorax':body.name,'neck':neck.name,'skull':skull.name,'actualEyes':eyes,'seatM':seat,'muzzleM':[0,.584,z+.027],'sourceIdentityWave':wave,'suspendedRider':hanging,'sourceBoneAnatomy':skeletal}

def manta_source(b):
 material(b,'v6_manta_blue','738396');material(b,'v6_manta_belly','CEC9B9');coat='v6_manta_blue'
 root=joint(b,'mount_torso_pivot',(0,-.09,.66),b.root)
 body=b.loft('V6 manta source integrated rounded flattened trunk',[octsection(y,w,lo,hi)for y,w,lo,hi in[(-.66,.18,.58,.76),(-.43,.43,.53,.81),(-.11,.58,.49,.88),(.25,.51,.49,.84),(.50,.33,.53,.74),(.63,.28,.54,.665)]],coat,root)
 neck=body;head=joint(b,'mount_head_pivot',(0,.41,.69),root);mouth=joint(b,'mouth_pivot',(0,.59,.59),head)
 cut=ell(b,'temporary manta source real long mouth aperture',(0,.61,.603),(.277,.15,.040),'dark',mouth,16,6);boolean(b,body,cut,'DIFFERENCE');closed_boolean_cleanup(body)
 ell(b,'V6 manta actual deeply recessed long mouth',(0,.527,.603),(.232,.018,.026),'dark',mouth,16,5)
 eyes=[]
 for side in(-1,1):
  x=side*.243;zz=.721;hit=tree([body]).ray_cast(Vector((x,4,zz)),Vector((0,-1,0)),8)[0];assert hit
  cut=b.box('temporary manta actual eye aperture',(x,hit.y-.006,zz),(.073,.11,.068),'dark',.010,head);boolean(b,body,cut,'DIFFERENCE');closed_boolean_cleanup(body)
  eye=b.box('V6 manta actual recessed rectangular eye '+('L'if side<0 else'R'),(x,hit.y-.047,zz),(.049,.016,.045),'dark',.004,head);eyes.append({'shell':body.name,'eye':eye.name,'recessDepthM':.047})
  b.limb('V6 manta actual integrated curled cephalic front fin',[(side*.27,.43,.60),(side*.33,.59,.593),(side*.33,.697,.560),(side*.27,.715,.549),(side*.247,.652,.573)],[(.095,.056),(.091,.056),(.059,.051),(.040,.039),(.036,.032)],coat,head,12)
  pa=joint(b,'wing_'+('L'if side<0 else'R'),(side*.32,-.13,.675),root)
  outline=[(side*.31,.27,.715),(side*.72,.19,.73),(side*1.37,-.14,.973),(side*1.18,-.43,.700),(side*.91,-.63,.59),(side*.64,-.60,.544),(side*.34,-.42,.566)]
  fin=b.panel('V6 manta actual swept curved broad pectoral fin',outline,.057,coat,pa,.092)
  b.limb('V6 manta actual contacting fin leading forelimb',[(side*.32,.18,.689),(side*.71,.15,.714),(side*1.32,-.15,.934)],[(.11,.069),(.074,.043),(.014,.012)],coat,pa,12)
  # Angular source runes have actual thin thickness and lie on wing skin.
  for k in range(3):
   xx=side*(.82+.06*k);yy=-.15-k*.095;zz=.746-k*.028
   coords=[]
   for xxx,yyy in[(xx,yy),(xx+side*.065,yy+.030),(xx+side*.048,yy-.040)]:
    hit=tree([fin]).ray_cast(Vector((xxx,yyy,4)),Vector((0,0,-1)),8)[0];assert hit is not None,(b.id,'actual source wing rune seated surface',xxx,yyy)
    coords.append(hit+Vector((0,0,.008)))
   b.limb('V6 manta actual fitted ivory angular wing rune',coords,[.010]*3,'ivory',pa,6)
 tail=b.limb('V6 manta source long tapering articulate sting tail',[(0,-.56,.66),(0,-.84,.65),(.045,-1.08,.67),(.052,-1.36,.64),(.026,-1.58,.67),(0,-1.83,.66)],[(.099,.075),(.074,.051),(.049,.039),(.035,.029),(.027,.020),(.017,.015)],coat,root,10)
 b.jewel('V6 manta source actual pointed sting tip',(0,-1.92,.665),.100,.071,.150,coat,root)
 for k,y in enumerate((-.45,-.28,-.105,.075)):
  fit_dorsal_plate(b,body,0,y,.80,(.30,.52,.58,.49)[k],.24,'steel',root,'V6 manta actual fitted overlapping riveted dorsal plate',positive_dorsal_relief=True)
 for side in(-1,1):b.limb('V6 manta fitted source flank leather saddle strap',[(side*.22,-.38,.77),(side*.35,-.09,.86),(side*.39,.28,.72)],[.025]*3,'leather',root,10)
 return {'species':'manta','thorax':body.name,'neck':neck.name,'skull':body.name,'actualEyes':eyes,'seatM':[0,-.13,.89],'muzzleM':[0,.645,.603],'sourceIdentityWave':39,'longStingTail':tail.name}

def mechanical_bat_source(b):
 material(b,'v6_gyro_source_sail','AD8254');material(b,'v6_gyro_worn_iron','78756A',.25)
 root=joint(b,'mount_torso_pivot',(0,-.10,.70),b.root)
 # Real open-top box: five individual plank walls and strapped iron rails,
 # with pilot genuinely seated inside, not perched above a solid cube.
 body=b.box('V6 gyro source contacting lower timber chassis floor',(0,-.10,.49),(.70,.66,.097),'wood',.023,root)
 for side in(-1,1):
  for k in range(4):b.box('V6 gyro source separate sidewall timber plank',(side*.335,-.337+k*.153,.735),(.052,.145,.41),'wood',.010,root)
  for zz in(.555,.90):b.limb('V6 gyro fitted riveted chassis iron rail',[(side*.365,-.435,zz),(side*.365,.232,zz)],[.031]*2,'steel_dark',root,10)
  for yy in(-.38,.16):
   b.limb('V6 gyro real contacting vertical corner axle',[(side*.338,yy,.52),(side*.338,yy,1.00)],[.044]*2,'steel_dark',root,12)
   for zz in(.585,.875):ell(b,'V6 gyro actual seated chassis rivet',(side*.366,yy,zz),(.019,.022,.018),'steel',root,8,3)
 for k in range(4):b.box('V6 gyro source rear wall timber plank',((k-1.5)*.16,-.417,.735),(.153,.045,.40),'wood',.01,root)
 for k in range(4):b.box('V6 gyro source front wall timber plank',((k-1.5)*.16,.224,.735),(.153,.046,.40),'wood',.01,root)
 b.box('V6 gyro actual fitted front riveted iron chassis plate',(0,.258,.736),(.649,.039,.362),'v6_gyro_worn_iron',.029,root)
 for side in(-1,1):
  b.limb('V6 gyro actual contacting bronze chassis corner brace',[(side*.296,.276,.581),(side*.296,.276,.892)],[.033]*2,'leather',root,8)
  for k in range(4):ell(b,'V6 gyro actual contacting exposed chassis rivet',(side*.295,.304,.597+k*.092),(.014,.012,.014),'steel',root,8,3)
 for side in(-1,1):b.limb('V6 gyro source actual attached rear V chassis brace',[(side*.292,-.46,.876),(0,-.46,.572)],[.026]*2,'leather',root,8)
 b.limb('V6 gyro true front lower strapped rail',[(-.345,.217,.58),(.345,.217,.58)],[.047]*2,'steel_dark',root,12)
 for side in(-1,1):
  # Ring loft with a true deep bore, not a black disk painted on a cap.
  x=side*.44;pa=joint(b,'wing_'+('L'if side<0 else'R'),(x,-.065,.75),root)
  n=16;vs=[]
  for yy,r in((-.34,.121),(.17,.121),(.17,.077),(-.285,.077)):
   vs.extend((x+math.cos(j*math.tau/n)*r,yy,.715+math.sin(j*math.tau/n)*r)for j in range(n))
  fs=[]
  for band in range(4):
   nx=(band+1)%4
   fs.extend((band*n+j,band*n+(j+1)%n,nx*n+(j+1)%n,nx*n+j)for j in range(n))
  b.mesh('V6 gyro actual cylindrical deeply bored side engine',vs,fs,'steel_dark',pa)
  ell(b,'V6 gyro actual engine bore deep interior',(x,-.275,.715),(.067,.012,.067),'dark',pa,12,4)
  for yy in(-.32,.14):annulus(b,'V6 gyro actual contacting metal barrel rim',(x,yy,.715),.126,.017,'steel',pa,True,16,5)
  points=[(side*.36,-.09,.90),(side*.77,-.16,1.25),(side*1.05,-.33,.92),(side*.77,-.35,.43),(side*.40,-.10,.50)]
  b.panel('V6 gyro source fitted triangular timber wing sail',points,.031,'v6_gyro_source_sail',pa,.018)
  b.limb('V6 gyro actual enclosing structural wing leading spar',[points[0],points[1],points[2]],[.041,.029,.020],'wood',pa,10)
  for j in(2,3,4):b.limb('V6 gyro actual contacting diagonal wing frame strut',[points[1],points[j]],[.025,.019],'steel',pa,8)
 head=joint(b,'mount_head_pivot',(0,.20,.69),root);neck=body
 b.pivot('mouth_pivot',(0,.22,.60),head)
 return {'species':'mechanical-bat','thorax':body.name,'neck':neck.name,'skull':body.name,'actualEyes':[],'seatM':[0,-.055,.65],'muzzleM':[0,.24,.715],'sourceIdentityWave':28,'pilotInsideActualOpenChassis':True}

def hollow_king(b):
 # Reuse the dedicated exact source40 open rib sculpture, never the generic
 # filled animal body. All mutable mesh refinements are V6-only below.
 from geometric_hollow_sky_source_v2 import hollow_sky_king
 from geometric_roster_builder import wings as oldwings
 material(b,'ivory','D0BE9C');material(b,'steel_dark','4B4745',.25);material(b,'v6_hollow_membrane','847A6B')
 for ob in list(b.root.children_recursive)[::-1]:bpy.data.objects.remove(ob,do_unlink=True)
 row={'spec':{'wave':40}};hollow_sky_king(b,row,ell,cone,oldwings,leaf)
 root=bpy.data.objects['torso_pivot'];head=bpy.data.objects['head_pivot'];jaw=bpy.data.objects['mouth_pivot']
 skull=next(o for o in b.objects if semantic(o)=='Sky king faceted long ivory skull');remove(b,[skull])
 skull=b.loft('V6 Hollow King source long angular actual ivory cranial shell',[octsection(y,w,lo,hi)for y,w,lo,hi in[(.16,.202,1.625,1.976),(.32,.251,1.66,1.98),(.55,.213,1.605,1.884),(.79,.135,1.528,1.744)]],'ivory',head)
 old=[o for o in b.objects if semantic(o).startswith(('Sky king skull deep rectangular eye socket','Sky king dark open mouth cavity','Sky king hollow open lower jaw','Sky king upper hanging ivory tooth','Sky king lower ivory tooth','Sky king actual visible front triangular skull nose','Continuous faceted wing membrane','Wing leading forelimb','Wing membrane finger','Wing wrist claw','Animal grounded foot','Sky king large ivory toe claw'))];remove(b,old)
 # Source lower jaw wraps both sides of a genuinely open tall gape. The
 # curved bearing at its rear seats into the cervical/skull volume.
 jawmesh=b.limb('V6 Hollow King actual open curved source lower jaw',[(0,.245,1.60),(-.16,.435,1.385),(-.12,.74,1.384),(0,.81,1.429),(.12,.74,1.384),(.16,.435,1.385),(0,.245,1.60)],[(.090,.073),(.051,.049),(.052,.045),(.039,.037),(.052,.045),(.051,.049),(.090,.073)],'ivory',jaw,12)
 for side in(-1,1):
  for k in range(3):
   yy=.50+k*.106;xx=side*(.15-k*.030);zz=1.64-k*.042
   b.limb('V6 Hollow King source long contacting upper jaw fang',[(xx,yy,zz),(xx,yy+.025,zz-.07),(xx*.92,yy+.036,zz-.142)],[.031,.021,.004],'ivory',head,10)
   b.limb('V6 Hollow King source curved lower jaw tooth',[(side*(.125-k*.025),yy+.076,1.411),(side*(.12-k*.025),yy+.072,1.484)],[.025,.004],'ivory',jaw,10)
 eyes=[]
 for side in(-1,1):
  x=side*.124;z=1.794;hit=tree([skull]).ray_cast(Vector((x,4,z)),Vector((0,-1,0)),8)[0];assert hit
  cut=b.box('temporary hollow king real cranial eye aperture',(x,hit.y-.015,z),(.080,.16,.096),'dark',.013,head);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
  eye=b.box('V6 Hollow King actual deep open eye interior '+('L'if side<0 else'R'),(x,hit.y-.068,z),(.063,.024,.077),'dark',.008,head);eyes.append({'shell':skull.name,'eye':eye.name,'recessDepthM':.068})
 ell(b,'V6 Hollow King actual deep open jaw interior',(0,.385,1.507),(.115,.018,.079),'dark',jaw,12,4)
 b.panel('V6 Hollow King actual sharply hollow triangular nasal aperture',[(-.038,.801,1.657),(.038,.801,1.657),(0,.801,1.597)],.013,'dark',head)
 captive=bpy.data.objects['captive_soul_pivot'];remove(b,[o for o in b.objects if semantic(o)=='Sky king captive dark cowl'])
 b.hood('V6 Hollow King captive actual domed dark hood',(0,.151,1.272),.292,.290,.232,'steel_dark',captive)
 ell(b,'V6 Hollow King captive actual small clothed thorax',(0,.145,1.091),(.122,.094,.175),'leather',captive,12,5)
 b.limb('V6 Hollow King captive actual contacting anatomical neck',[(0,.207,1.202),(0,.268,1.236)],[.063,.061],'skin',captive,10)
 for side in(-1,1):
  b.limb('V6 Hollow King captive actual small connected bound arm',[(side*.086,.145,1.183),(side*.12,.228,1.103),(side*.090,.288,1.041)],[(.043,.040),(.038,.037),(.031,.027)],'leather',captive,10)
  ell(b,'V6 Hollow King captive actual small contacting green palm',(side*.091,.289,1.029),(.034,.032,.040),'skin',captive,8,4)
  for k in range(9):
   p=(side*(.14-.008*k),.291+.014*math.sin(k*.8),1.174-.036*k);annulus(b,'V6 Hollow King captive actual contacting bound soul chain',p,.021,.009,'steel_dark',captive,True,10,4)
 # Source tail/spine/ribs are thick and curved. Actual toe bones articulate
 # with the tarsals, with hollow spaces between the three ivory claws.
 for side in(-1,1):
  sn='L'if side<0 else'R';ft=bpy.data.objects['foot_'+sn];x=side*.33
  ell(b,'V6 Hollow King actual articulated dark tarsal',(x,.20,.104),(.107,.093,.077),'steel_dark',ft,12,4)
  for k in range(3):
   xx=x+(k-1)*.075;b.limb('V6 Hollow King source thick curved real toe claw',[(xx,.215,.109),(xx,.36,.073),(xx,.422,.011)],[.046,.032,.004],'ivory',ft,12)
 wings(b,root,1.31,1.29,.84,'ivory','v6_hollow_membrane',40)
 for side in(-1,1):
  wing=next(o for o in b.objects if semantic(o)=='V6 source mounted closed scalloped membrane '+('L'if side<0 else'R'))
  for k in range(2):
   p=(side*(.95-.14*k),-.066,1.31+.84*(.13-.15*k));cut=ell(b,'temporary Hollow King real ragged wing tear',p,(.055,.16,.115),'dark',wing.parent,10,5);boolean(b,wing,cut,'DIFFERENCE');closed_boolean_cleanup(wing)
 return {'species':'hollow-skeletal-dragon','thorax':'Sky king seven open ivory ribs per side','neck':'Sky king curved exposed cervical bones','skull':skull.name,'actualEyes':eyes,'seatM':[0,0,0],'muzzleM':[0,.741,1.53],'sourceIdentityWave':40,'noHumanoidRider':True,'captiveSourceAnatomyRetained':True}

def mounted_source_ornaments(b,entry,rider):
 """Physical source assemblies added after actual rider seating and gear."""
 wave=int(entry['id'].split('_')[1]);root=bpy.data.objects.get('mount_torso_pivot');tor=bpy.data.objects.get('torso_pivot');new=[]
 if wave in(19,37,47):
  material(b,'v6_wolf_rider_actual_brown_leather','604632')
  for ob in b.objects:
   if descendants(ob,tor)and semantic(ob).startswith(('Breastplate fitted shell','V6 rider source seated thorax')):
    ob.data.materials.clear();ob.data.materials.append(b.M['v6_wolf_rider_actual_brown_leather'])
    for polygon in ob.data.polygons:polygon.material_index=0
  remove(b,[o for o in b.objects if semantic(o).startswith(('Shoulder plate ','Armor shoulder spike','Source layered riveted shoulder iron','V6 source angled fitted shoulder plate','V6 source continuous shoulder top metal binding','V6 source contacting shoulder rivet','V6 bloodwolf rider actual thick','V6 bloodwolf rider actual contacting broad brown rear','V6 bloodwolf rider source contacting brown rear','V6 bloodwolf contacting stout'))or wave==19 and semantic(o).startswith(('Real rear cape','V5 fitted folded'))])
  armor='v6_wolf_red'if wave==19 else'leather'if wave==47 else'steel_dark'
  for side in('L','R'):
   pa=bpy.data.objects['upper_arm_'+side];p=pa.matrix_world.translation;sign=-1 if side=='L'else 1
   cover=ell(b,'V6 wolf rider source thick fitted spiked pauldron '+side,p+Vector((sign*.021,0,.015)),(.112,.099,.097)if wave==47 else(.174,.148,.143),armor,pa,12,5);new.append(cover.name)
   for k in range(0 if wave==47 else 3):
    a=p+Vector((sign*(.06+.04*k),-.05+.05*k,.095));b.limb('V6 wolf rider actual contacting curved shoulder spike '+side,[a,a+Vector((sign*.035,-.01,.085)),a+Vector((sign*.05,-.02,.17))],[.029,.019,.004],armor,pa,10)
   for yy in(-.07,.055):ell(b,'V6 wolf rider actual seated pauldron iron rivet',p+Vector((sign*.08,yy,.12)),(.015,.017,.010),'steel_dark',pa,8,3)
   fore=bpy.data.objects['forearm_'+side];q=fore.matrix_world.translation
   b.limb('V6 wolf rider actual contacting red wrist guard '+side,[q+Vector((0,0,.012)),q+Vector((0,0,-.09))],[(.108,.098),(.099,.094)],armor,fore,10)
  torso=next(o for o in b.objects if semantic(o)=='V6 rider source seated thorax');qa=metrics([torso]);lo=Vector(qa['boundsMin']);hi=Vector(qa['boundsMax']);tt=tree([torso])
  rear=[]
  for x,z in[(-.145,hi.z-.055),(.145,hi.z-.055),(.17,lo.z+.13),(0,lo.z+.05),(-.17,lo.z+.13)]:
   hit=tt.ray_cast(Vector((x,-4,z)),Vector((0,1,0)),8)[0];assert hit is not None,(b.id,'real source strapped rear torso',x,z);rear.append((x,hit.y+.013,z))
  b.panel('V6 wolf rider source broad fitted brown rear strapped cuirass',rear,.043,'leather',tor,.013)
  for sign in(-1,1):
   p=(sign*.12,lo.y-.013,lo.z+.10);q=(sign*.15,lo.y+.027,hi.z-.06);b.limb('V6 wolf rider source actual fitted rear brown torso strap',[p,q],[.023,.023],'wood',tor,8)
  if wave==47:
   # These generic straight rear straps lie behind a forward-inclined
   # rider and obscure the source pelt. The source mantle owns this area.
   remove(b,[o for o in b.objects if semantic(o).startswith(('V6 mounted source fitted brown rear crossed torso strap','V6 wolf rider source actual fitted rear brown torso strap'))])
   material(b,'v6_last_howl_actual_shaggy_hide','4B352B')
   material(b,'v6_last_howl_actual_shaggy_hide_tip','806047')
   for row in range(2):
    for k in range(11):
     a=(k+row*.43)*math.tau/11;radial=Vector((math.sin(a),math.cos(a),0));middle=(lo+hi)/2;origin=Vector((middle.x+radial.x*4,middle.y+radial.y*4,hi.z-.075-row*.085));surface,normal,_,_=tt.ray_cast(origin,-radial,8);assert surface is not None,(b.id,'actual outer mantle bearing',k,row);start=surface-normal*.008
     middleHit=tt.ray_cast(Vector((origin.x,origin.y,origin.z-.090)),-radial,8)[0];tipHit=tt.ray_cast(Vector((origin.x,origin.y,origin.z-.22-.031*(k%3))),-radial,8)[0];assert middleHit is not None and tipHit is not None,(b.id,'outer fitted mantle contour',k,row)
     mid=middleHit+radial*.069;tip=tipHit+radial*.077
     b.limb('V6 Last Howl source actual fitted overlapping shaggy mantle lock',[start,mid,tip],[(.044,.028),(.082,.043),(.004,.004)],['v6_last_howl_actual_shaggy_hide','v6_last_howl_actual_shaggy_hide_tip'],tor,8)
   hip=Vector(b.root['v6RiderHipAnchorM']);polex=-.26;yy=hip.y-.19;top=hip.z+1.15
   b.limb('V6 Last Howl source actual leather-strapped back banner pole',[(polex,yy,hip.z-.12),(polex,yy,top)],[.028,.025],'wood',tor,10)
   outline=[(polex,yy,top-.04),(polex-.30,yy-.025,top-.05),(polex-.62,yy-.018,top-.17),(polex-.51,yy-.022,top-.27),(polex-.67,yy-.026,top-.39),(polex-.42,yy-.020,top-.35),(polex-.52,yy-.026,top-.57),(polex-.24,yy-.016,top-.47),(polex,yy,top-.49)]
   b.panel('V6 Last Howl source actual folded ragged red wolf banner',outline,.027,'red',tor,.029)
   center=Vector((polex-.28,yy+.018,top-.27));shape=[(-.115,.13),(-.055,.060),(0,.085),(.063,.056),(.12,.14),(.115,-.023),(.049,-.106),(0,-.165),(-.064,-.113),(-.12,-.024)]
   b.panel('V6 Last Howl source actual black angular wolf banner insignia',[(center.x+x,center.y,center.z+z)for x,z in shape],.014,'dark',tor)
   for zz in(hip.z-.07,hip.z+.13):b.limb('V6 Last Howl actual contacting back-pole leather binding',[(polex-.042,yy,zz),(polex+.041,yy,zz)],[.021]*2,'leather',tor,8)
 if wave==25:
  body=next(o for o in b.objects if semantic(o)=='V6 rider source seated thorax');qa=metrics([body]);lo=Vector(qa['boundsMin']);hi=Vector(qa['boundsMax']);tt=tree([body]);surface=tt.ray_cast(Vector((hi.x*.72,-4,hi.z-.11)),Vector((0,1,0)),8)[0];assert surface is not None
  center=surface+Vector((.030,-.045,0));bottom=center.z-.295;top=center.z+.035;n=12;vs=[]
  for rr,zz in((.076,bottom),(.087,top),(.062,top),(.055,bottom+.019)):
   vs.extend((center.x+math.cos(j*math.tau/n)*rr,center.y+math.sin(j*math.tau/n)*rr,zz)for j in range(n))
  fs=[]
  for band in range(3):
   for j in range(n):k=(j+1)%n;fs.append((band*n+j,band*n+k,(band+1)*n+k,(band+1)*n+j))
  fs.extend([tuple(reversed(range(n))),tuple(range(3*n,4*n))])
  quiver=b.mesh('V6 Iron Bat actual contacting open leather rear quiver',vs,fs,'leather',tor)
  for jj in range(3):
   a=jj*math.tau/3;cx=center.x+math.cos(a)*.045;cy=center.y+math.sin(a)*.045;tipz=top+.215+.035*(jj%2)
   b.limb('V6 Iron Bat source actual whole seated back arrow shaft',[(cx,cy,bottom+.007),(cx,cy,tipz-.048)],[.009,.009],'wood',tor,8)
   cone(b,'V6 Iron Bat source actual contacting steel quiver arrowhead',(cx,cy,tipz-.058),(cx,cy,tipz+.027),.027,'steel',tor,6)
   for sign in(-1,1):b.panel('V6 Iron Bat actual contacting ivory arrow fletching',[(cx,cy,top+.021),(cx+sign*.039,cy,top+.072),(cx,cy,top+.105)],.008,'ivory',tor)
  for zz in(bottom+.069,top-.038):annulus(b,'V6 Iron Bat source actual fitted quiver rim binding',(center.x,center.y,zz),.081,.013,'steel_dark',tor,n=12,m=4)
  rider['actualSourceQuiverContact']={'quiverPart':semantic(quiver),'bodyPart':semantic(body)}
 if wave==35:
  material(b,'v6_eclipse_actual_brown_source_vest','5A4030')
  for ob in b.objects:
   if descendants(ob,tor)and semantic(ob).startswith(('Breastplate fitted shell','V6 rider source seated thorax','V6 source curved fitted breastplate','V6 source contacting small rear armor plate')):
    ob.data.materials.clear();ob.data.materials.append(b.M['v6_eclipse_actual_brown_source_vest'])
    for polygon in ob.data.polygons:polygon.material_index=0
 if wave in(37,42):
  weapon=bpy.data.objects['weapon_R'];shafts=[o for o in b.objects if descendants(o,weapon)and semantic(o)=='V6 source continuous held spear shaft'];assert len(shafts)==1,(b.id,'source physical pole shaft',len(shafts))
  sourceShaft=shafts[0];pts=points(sourceShaft);top=max(pts,key=lambda p:p.z);center=sum((p for p in pts if p.z>top.z-.012),Vector())/len([p for p in pts if p.z>top.z-.012])
  remove(b,[o for o in b.objects if descendants(o,weapon)and semantic(o)=='V6 source overlapping barbed spear metal'])
  if wave==37:
   material(b,'v6_rift_source_held_crystal','9166C9',.15)
   for sign in(-1,1):b.limb('V6 Riftwolf source actual contacting forged fork prong',[center+Vector((0,0,-.060)),center+Vector((sign*.091,0,.090)),center+Vector((sign*.073,0,.274))],[.041,.031,.007],'steel_dark',weapon,10)
   b.jewel('V6 Riftwolf actual physically seated purple fork crystal',center+Vector((0,0,.110)),.068,.179,.046,'v6_rift_source_held_crystal',weapon)
   endpoint=center+Vector((0,0,.289))
  else:
   material(b,'v6_fire_lancer_actual_orange_rune','E08836')
   blade=b.jewel('V6 Fire Lancer actual whole forged iron rune pike',center+Vector((0,0,.110)),.096,.211,.048,'steel_dark',weapon)
   rune=[];cx,cy,cz=center+Vector((0,0,.110))
   for dx,dz in[(0,.113),(.050,0),(0,-.113),(-.050,0),(0,.113)]:
    hit=tree([blade]).ray_cast(Vector((cx+dx,4,cz+dz)),Vector((0,-1,0)),8)[0];assert hit is not None
    rune.append(hit-Vector((0,.003,0)))
   b.limb('V6 Fire Lancer actual contacting orange diamond spear rune',rune,[.011]*5,'v6_fire_lancer_actual_orange_rune',weapon,8)
   endpoint=center+Vector((0,0,.321))
  marker=bpy.data.objects.get('attack_muzzle')
  if marker:marker.matrix_world=Matrix.Translation(endpoint);b.attach(marker,weapon)
 if wave==48:
  hp=bpy.data.objects['head_pivot'];faces=[o for o in b.objects if semantic(o)=='Observed face'];q=metrics(faces);cx=(q['boundsMin'][0]+q['boundsMax'][0])/2;back=q['boundsMin'][1]-.062;cz=q['boundsMax'][2]-.015
  for k in range(2):
   start=Vector((cx+(k-.5)*.044,back,cz-.07*k));coords=[start+Vector((0,.021,.038)),start+Vector((-.14,-.05,.046)),start+Vector((-.36,-.11,.009)),start+Vector((-.53,-.09,.04)),start+Vector((-.38,-.08,-.05)),start+Vector((-.21,-.035,-.024)),start+Vector((0,.021,-.036))]
   b.panel('V6 Blackfire source actual whole head-owned folded red scarf streamer',coords,.026,'red',hp,.018)
  for side in(-1,1):
   c=Vector((side*.20,.235,.53));annulus(b,'V6 Blackfire source actual neck-owned brass bell suspension',c+Vector((0,0,.089)),.024,.009,'gold',root,n=10,m=4)
   actualBody=bpy.data.objects[entry['_mount']['thorax']];hit=tree([actualBody]).ray_cast(Vector((c.x,4,c.z+.108)),Vector((0,-1,0)),8)[0]
   assert hit is not None,(b.id,'source bell actual thorax support',list(c))
   b.limb('V6 Blackfire actual contacting thorax to brass bell suspension strap',[hit-Vector((0,.008,0)),c+Vector((0,0,.108))],[.012,.011],'gold',root,8)
   n=12;vs=[]
   for rr,zz in((.046,.078),(.068,0),(.052,.008),(.026,.066)):
    vs.extend((c.x+math.cos(j*math.tau/n)*rr,c.y+math.sin(j*math.tau/n)*rr,c.z+zz)for j in range(n))
   fs=[]
   for band in range(4):
    nx=(band+1)%4;fs.extend((band*n+j,band*n+(j+1)%n,nx*n+(j+1)%n,nx*n+j)for j in range(n))
   b.mesh('V6 Blackfire source actual thick cast gold bell with open underside',vs,fs,'gold',root)
 if wave==50:
  remove(b,[o for o in b.objects if semantic(o).startswith(('Bernhard peaked throne','Throne angular side rail','Throne peaked rail','Bernhard chest actual amber focus'))])
  hip=Vector(b.root['v6RiderHipAnchorM']);y=hip.y-.245;base=hip.z-.09;top=hip.z+.92
  frame=b.box('V6 Bernhard actual strapped gothic throne timber back',(0,y,(base+top)*.5),(.49,.078,top-base),'steel_dark',.025,tor);new.append(frame.name)
  for j in range(3):
   x=(j-1)*.205;peak=top+(.13 if j==1 else .045)
   b.limb('V6 Bernhard source pointed ornate backtower column',[(x,y-.025,base),(x,y-.025,peak)],[.037,.030],'v6_bern_bronze',tor,10)
   b.panel('V6 Bernhard physical pointed backtower finial',[(x-.065,y-.066,peak-.015),(x,y-.066,peak+.16),(x+.065,y-.066,peak-.015)],.069,'steel_dark',tor,.019)
   for zz in(base+.15,base+.48,top-.15):
    b.limb('V6 Bernhard actual contacting ornate tower collar',[(x-.051,y-.025,zz),(x+.051,y-.025,zz)],[.019]*2,'v6_bern_bronze',tor,8)
  for side in(-1,1):
   b.limb('V6 Bernhard actual contacting tower shoulder suspension strap',[(side*.18,y+.05,base+.03),(side*.23,y+.05,top-.27),(side*.18,hip.y+.04,top-.20),(side*.17,hip.y+.13,base+.06)],[.026]*4,'leather',tor,10)
  b.panel('V6 Bernhard source actual ornate backtower amber crest',[(0,y-.074,top-.17),(-.074,y-.074,top-.34),(0,y-.074,top-.54),(.074,y-.074,top-.34)],.024,'v6_bern_membrane',tor,.026)
  # Real chain links are tangent/overlapping at alternate orientations;
  # physical skull relief seats into the backboard at the chain crossing.
  for side in(-1,1):
   for k in range(8):
    p=(side*(.22-.017*k),y-.082,base+.20+.039*k);annulus(b,'V6 Bernhard source actual attached backtower skull chain',p,.027,.010,'v6_bern_bronze',tor,True,10,5)
  skull=b.box('V6 Bernhard actual touching ivory throne skull relief',(0,y-.09,base+.27),(.146,.040,.134),'ivory',.028,tor)
  for side in(-1,1):
   cut=b.box('temporary Bernhard actual throne skull eye hole',(side*.035,y-.11,base+.285),(.039,.12,.043),'dark',.007,tor);boolean(b,skull,cut,'DIFFERENCE');closed_boolean_cleanup(skull)
   b.box('V6 Bernhard skull relief deep dark eye',(side*.035,y-.078,base+.285),(.026,.008,.030),'dark',.004,tor)
  for k in range(4):b.box('V6 Bernhard actual touching skull relief tooth',((k-1.5)*.023,y-.093,base+.19),(.019,.040,.040),'ivory',.004,tor)
 if wave==45:
  z=1.26;center=(0,-.04,z)
  drum=b.loft('V6 source physical cylindrical timber war drum',[b.ring(0,-.04,zz,rad,rad,16)for zz,rad in[(z-.29,.24),(z-.23,.286),(z+.20,.286),(z+.29,.241)]],'wood',root);new.append(drum.name)
  b.loft('V6 source actual contacting stretched drum hide',[b.ring(0,-.04,z+.285,.244,.244,16),b.ring(0,-.04,z+.302,.246,.246,16)],'ivory',root)
  for zz in(z-.245,z+.255):annulus(b,'V6 source contacting fitted drum iron hoop',(0,-.04,zz),.270,.019,'steel',root,n=16,m=6)
  for j in range(12):
   a=j*math.tau/12;xx=.285*math.sin(a);yy=-.04+.285*math.cos(a)
   b.limb('V6 source contacting individual barrel timber stave',[(xx,yy,z-.20),(xx,yy,z+.20)],[.013,.013],'leather',root,6)
  for side in(-1,1):
   b.limb('V6 source war drum fitted mount leather strap',[(side*.24,-.18,1.49),(side*.27,-.02,1.15),(side*.27,.05,.80)],[.025]*3,'leather',root,10)
  b.box('V6 source war drum touching ivory skull crest',(0,.257,z),(.142,.024,.113),'ivory',.025,root)
  for side in(-1,1):b.box('V6 drum skull actual dark recessed eye',(side*.032,.272,z+.01),(.026,.008,.029),'dark',.005,root)
  for prefix in('','drummer_'):
   for side in('L','R'):
    weapon=bpy.data.objects.get(prefix+'weapon_'+side)
    if not weapon:continue
    remove(b,[o for o in b.objects if descendants(o,weapon)])
    hand=weapon.parent;grips=[o for o in b.objects if o.parent==hand and semantic(o).startswith('Grasping hand')];g=sum((Vector(metrics([o])['boundsMin'])+Vector(metrics([o])['boundsMax'])for o in grips),Vector())/(2*len(grips))if grips else weapon.matrix_world.translation.copy()
    tip=g+Vector((-.07 if side=='L'else .07,-.01,.31));b.limb('V6 source actual contacting whole drum mallet shaft',[g-Vector((0,0,.045)),tip],[.016,.016],'wood',weapon,10);ell(b,'V6 source contacting solid faceted drum mallet head',tip,(.039,.037,.047),'wood',weapon,10,4)
 if wave in(19,37,47,15,25,29,30,35,39,42,48,50):
  # Complete reins curve from the real source muzzle tack to actual left
  # glove. Existing V1 reins were bound to the obsolete long muzzle.
  remove(b,[o for o in b.objects if 'rein'in semantic(o).lower()])
  hand=bpy.data.objects.get('hand_L');grips=[o for o in b.objects if o.parent==hand and semantic(o).startswith('Grasping hand')];g=sum((Vector(metrics([o])['boundsMin'])+Vector(metrics([o])['boundsMax'])for o in grips),Vector())/(2*len(grips))if grips else hand.matrix_world.translation.copy()
  muzzle=Vector(entry['_mount']['muzzleM'])
  for side in(-1,1):
   a=muzzle+Vector((side*.107,-.07,.08));b.limb('V6 source actual curved contacting muzzle to glove leather rein',[a,a.lerp(g,.37)+Vector((side*.07,0,-.055)),a.lerp(g,.72)+Vector((side*.04,0,-.025)),g],[.012]*4,'leather',root,8)
 return {'sourceWave':wave,'physicalOrnamentNewParts':new}

def apply_mount_source_v6(b,entry):
 wave=int(entry['id'].split('_')[1]);assert wave in OWNED
 source_materials(b);removed=remove_mount(b)
 if wave in(19,37,47):result=wolf(b,wave)
 elif wave==50:result=bernhard(b)
 elif wave in(5,15,25,27,29,30,34,35,42,45,48):result=bat(b,wave)
 elif wave==39:result=manta_source(b)
 elif wave==28:result=mechanical_bat_source(b)
 elif wave==40:result=hollow_king(b)
 else:raise NotImplementedError(('source-specific species construction pending',wave))
 result['removedGenericMountMeshCount']=removed
 b.root['enemyMountSourceV6']=json.dumps(result)
 return result
