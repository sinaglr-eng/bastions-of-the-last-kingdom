"""Pure, explicit source equipment recipes; actual volumes, apertures and rigs.

Called after the anatomy/head/fitted-cloth helper. No IO and no assertion of
visual acceptance. These constructs implement the initial per-source findings;
final source inspection remains separate from physical geometry inspection.
"""
import math,bpy
from mathutils import Vector
from geometric_roster_builder import ell,cone,annulus,leaf,gear,crescent
from geometric_champion_shapes_v5 import material,boolean,tree
from geometric_game_common import metrics

def apply_source_equipment_v6(b,entry,h):
 wave=int(entry['id'].split('_')[1]);sem=h.sem;gone=h.gone;bound=h.bound;pivot=h.pivot;bend=h.bend
 torso=pivot(b,'torso_pivot');head=pivot(b,'head_pivot')
 if not torso:return {'uniqueSourceRecipes':[],'intentionalMagicParts':[]}
 body=sem(b,('V6 source anatomical thorax','V6 rider source seated thorax','Tailored continuous bodice','Faceted species chest','Separated phantom armor upper chest plate','Mutant actual wood chest chassis'))
 lo,hi=bound(body);wc=hi.x-lo.x;cy=(lo.y+hi.y)/2;hip=pivot(b,'upper_leg_L').matrix_world.translation.z
 recipes=[];magic=[];contacts=[]
 material(b,'v6_obsidian','25262C');material(b,'v6_worn_iron','706D64');material(b,'v6_rust_steel','807466');material(b,'v6_soul_cyan','63DCCF',emission=2.0);material(b,'v6_soul_purple','A160E2',emission=1.3);material(b,'v6_bronze','B18945');material(b,'v6_ochre','D28A39')
 def rm(prefix,pa=None):gone(b,sem(b,prefix,pa))
 def obs(prefix,pa=None):return sem(b,prefix,pa)
 def weapon(side='R'):return pivot(b,'weapon_'+side)
 def grip(pa):return h.hand_grip(b,pa)
 def rod(name,pts,r,mat,pa,n=10):return bend(b,name,list(map(Vector,pts)),[r]*len(pts),mat,pa,n)
 def skull(name,c,w,pa,mat='ivory'):
  """Carved skull with actual two open sockets, nasal cavity and cheek jaws."""
  c=Vector(c);offset=c.copy()if wave==20 else Vector((0,0,0));before=set(b.objects)
  # Small repeated staff skulls are carved near the local origin. Keeping
  # their vertices small avoids Boolean roundoff slivers at world-height;
  # the completed connected assembly is then rigidly placed on the staff.
  if wave==20:c=Vector((0,0,0))
  outer=ell(b,name+' actual carved cranial shell',c,(w*.51,w*.36,w*.47),mat,pa,12,5)
  for sign in(-1,1):
   cut=ell(b,'temporary V6 eye socket cutter',c+Vector((sign*w*.205,w*.30,w*.08)),(w*.135,w*.24,w*.15),'dark',pa,10,4);boolean(b,outer,cut,'DIFFERENCE')
   ell(b,name+' genuine recessed eye cavity',c+Vector((sign*w*.205,w*.10,w*.08)),(w*.11,w*.035,w*.12),'dark',pa,8,3)
  cut=ell(b,'temporary V6 nasal cavity cutter',c+Vector((0,w*.34,-w*.10)),(w*.075,w*.20,w*.105),'dark',pa,8,3);boolean(b,outer,cut,'DIFFERENCE')
  ell(b,name+' genuine recessed nasal cavity',c+Vector((0,w*.19,-w*.10)),(w*.054,w*.03,w*.084),'dark',pa,8,3)
  rod(name+' contacting lower jaw',[(c.x-w*.38,c.y+w*.07,c.z-w*.17),(c.x-w*.30,c.y+w*.28,c.z-w*.36),(c.x+w*.30,c.y+w*.28,c.z-w*.36),(c.x+w*.38,c.y+w*.07,c.z-w*.17)],w*.068,mat,pa)
  for j in range(5):cone(b,name+' attached real pointed tooth',(c.x+(j-2)*w*.104,c.y+w*.33,c.z-w*.23),(c.x+(j-2)*w*.104,c.y+w*.34,c.z-w*.37),w*.035,mat,pa,5)
  from geometric_enemy_creature_anatomy_v6 import closed_boolean_cleanup
  closed_boolean_cleanup(outer)
  if wave==20:
   for ob in [o for o in b.objects if o not in before]:
    matrix=ob.matrix_world.copy();matrix.translation+=offset;ob.matrix_world=matrix
   bpy.context.view_layer.update()
  if wave==23:
   for ob in [o for o in b.objects if o not in before]:
    inv=ob.matrix_world.inverted()
    for v in ob.data.vertices:
     p=ob.matrix_world@v.co;p.z=c.z+(p.z-c.z)*1.50;v.co=inv@p
    ob.data.update()
  return outer
 def cage(name,c,r,height,pa):
  c=Vector(c);low=c.z-height*.48;high=c.z+height*.48
  for z in(low,high):annulus(b,name+' contacting bronze cage rim',(c.x,c.y,z),r,.023,'v6_bronze',pa,n=12,m=6)
  for k in range(8):
   a=k*math.tau/8;xx=c.x+r*math.sin(a);yy=c.y+r*math.cos(a);rod(name+' actual continuous cage upright',[(xx,yy,low),(xx,yy,high)],.022,'v6_bronze',pa)
  b.loft(name+' closed stepped bronze cage roof',[b.ring(c.x,c.y,high,r,.85*r,12),b.ring(c.x,c.y,high+.055,r*.67,r*.60,12),b.ring(c.x,c.y,high+.09,r*.27,r*.25,12)],'v6_bronze',pa)
  rod(name+' contacting roof suspension',[(c.x,c.y,high+.06),(c.x,c.y,high+.16)],.025,'steel_dark',pa)
  gem=b.jewel(name+' genuinely suspended turquoise soul',c,r*.51,height*.46,r*.36,'v6_soul_cyan',pa);magic.append(h.semantic(gem))
  return Vector((c.x,c.y,high+.15))
 def shaft(pa,name,g,top,bottom=.45,mat='wood'):
  rod(name+' whole continuous held shaft',[g-Vector((0,0,bottom)),top],.031,mat,pa);h.endpoint(b,pa,'attack_muzzle',top)
 def tuft_cloth(name,mat,levels=3):
  for level in range(levels):
   z=hi.z-.015-level*(hi.z-hip)*.25
   for k in range(14):
    a=k*math.tau/14;r=wc*.48;base=Vector((r*math.sin(a),cy+(hi.y-lo.y)*.46*math.cos(a),z));tip=base+Vector((math.sin(a)*.032,math.cos(a)*.035,-.24-.07*(k%3==0)))
    leaf(b,name+' contacting torn layered flap',base,tip,wc*.135,mat,torso)
 def axe(pa,g,name,r=.22,color='steel',crescent_shape=True):
  top=g+Vector((0,0,.40));shaft(pa,name,g,top,.25)
  # Concave crescent cutting perimeter and convex inner forged mass share
  # one thick closed solid with a substantial central socket at the shaft.
  pts=[]
  for j in range(10):
   a=-1.23+2.46*j/9;pts.append(top+Vector((r*1.35*math.cos(a),.0,r*math.sin(a))))
  for j in range(10):
   a=1.23-2.46*j/9;pts.append(top+Vector((r*.49*math.cos(a)-.055,0,r*.93*math.sin(a))))
  b.panel(name+' actual continuous crescent forged blade',list(map(tuple,pts)),.045,color,pa,.026)
  rod(name+' contacting central blade socket',[top+Vector((0,0,-.085)),top+Vector((0,0,.085))],.06,'steel_dark',pa)
 def shield(pa,name,g,mat='steel',broken=False,crystal=False):
  # Face is in front of hand; real arm strap and transverse hand grip connect
  # the shield rear to actual palm. Splits are real absent silhouette regions.
  c=g+Vector((0,.15,.06));w=.25 if wave not in(10,36)else .31;hei=.36 if wave!=10 else .48
  poly=[(-.78,1),(.56,1),(1,.66),(.94,-.65),(.45,-1),(-.61,-.93),(-1,-.54),(-1,.54)]
  if wave==41:poly=[(-.72,1),(.72,1),(1,.72),(.82,-.35),(0,-1.35),(-.82,-.35),(-1,.72)]
  if broken:poly=[(-.78,1),(.12,1),(.01,.43),(-.31,.21),(.06,-.13),(-.05,-.42),(.28,-.60),(.08,-.98),(-.61,-.93),(-1,-.54),(-1,.54)]
  outline=[(c.x+x*w,c.y,c.z+z*hei)for x,z in poly];shell=b.panel(name+' actual '+('broken split 'if broken else'')+'shield body',outline,.072,mat,pa,.052 if crystal else .028)
  # Additional broken island is still physically mounted to the common
  # horizontal back braces; the gap remains visible through the face.
  if broken:
   p=[(.47,1),(1,.66),(.94,-.65),(.61,-.89),(.58,-.48),(.31,-.24),(.54,.20),(.38,.43)]
   b.panel(name+' physically braced detached broken shield half',[(c.x+x*w,c.y,c.z+z*hei)for x,z in p],.072,mat,pa,.025)
  for z in(c.z-.14,c.z+.14):rod(name+' actual rear contacting cross brace',[(c.x-w*.81,c.y-.05,z),(c.x+w*.80,c.y-.05,z)],.027,'steel_dark',pa)
  rod(name+' real palm gripping shield handle',[(g.x-.13,g.y,g.z),(g.x+.13,g.y,g.z)],.040,'leather',pa)
  for sign in(-1,1):rod(name+' contacting rear arm strap',[(g.x+sign*.12,g.y-.014,g.z),(g.x+sign*.12,c.y-.04,c.z)],.032,'leather',pa)
  for sx in(-1,1):
   for z in(c.z-hei*.63,c.z+hei*.65):
    p,n,_,_=tree([shell]).find_nearest(Vector((c.x+sx*w*.72,c.y+.09,z)));ell(b,name+' attached exposed rim rivet',p+n*.003,(.016,.012,.016),'steel_dark',pa,8,3)
  return c,w,hei

 if wave in(1,4,11,12):
  material(b,'v6_source_fitted_brown_leather_vest','57402F')
  for ob in body:ob.data.materials.clear();ob.data.materials.append(b.M['v6_source_fitted_brown_leather_vest'])
  recipes.append('Actual continuous fitted torso surface is source brown leather vest beneath crossed carrying straps')
 if wave==38:
  material(b,'v6_knifeman_charcoal_cloth','343634')
  for side in('L','R'):
   ap=pivot(b,'upper_arm_'+side);fp=pivot(b,'forearm_'+side);arm=obs(('Upper arm '+side,'Connected shoulder '+side),ap);fore=obs('Forearm '+side,fp)
   for ob in arm:ob.data.materials.clear();ob.data.materials.append(b.M['skin'])
   for ob in fore:ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
   al,ah=bound(arm);ac=(al+ah)/2
   for j in range(5):
    a=j*math.tau/5;q,n,_,_=tree(arm).find_nearest(Vector((ac.x+.08*math.sin(a),ac.y+.13*math.cos(a),ah.z+.05)));piece=leaf(b,'V6 knifeman actual contacting charcoal ragged shoulder cloth',q-n*.008,q+Vector((.023*math.sin(a),.028*math.cos(a),-.13)),.105,'v6_knifeman_charcoal_cloth',ap)
    contacts.append({'name':'Actual ragged charcoal shoulder cloth seated above exposed green upper arm '+piece.name,'leftParts':[h.semantic(piece)],'leftObjectNames':[piece.name],'rightParts':sorted(set(h.semantic(o)for o in arm)),'rightObjectNames':[o.name for o in arm]})
  recipes.append('Bare green upper arms with brown leather wrist wraps and actual fitted ragged charcoal shoulder cloth')
 if wave==41:
  for ob in body+obs(('Upper arm ','Connected shoulder ','Forearm ','Elbow contacting articulated joint ','Upper leg ','Lower leg ','Knee contacting articulated joint ','Grounded boot','Leather ragged skirt')):ob.data.materials.clear();ob.data.materials.append(b.M['steel_dark'])
  recipes.append('Actual fitted steel torso/shoulder/forearm/waist/thigh/greave/boot surfaces retain green face and hands')
 if wave==4:
  plate=obs('V6 scrap single broad curved rusty rectangular shoulder shell')
  if not plate:plate=[o for o in b.objects if 'shoulder'in h.semantic(o).lower() and 'plate'in h.semantic(o).lower()]
  assert plate,('missing actual scrap shoulder plate',b.id)
  pl,ph=bound(plate);pc=(pl+ph)/2
  for xx in(pc.x-(ph.x-pl.x)*.28,pc.x+(ph.x-pl.x)*.28):
   for zz in(pl.z+(ph.z-pl.z)*.22,pc.z,ph.z-(ph.z-pl.z)*.18):
    q,n,_,_=tree(plate).find_nearest(Vector((xx,ph.y+.10,zz)));rivet=ell(b,'V6 scrap source physically seated shoulder rivet',q-n*.004,(.022,.018,.022),'steel_dark',plate[0].parent,8,3)
    contacts.append({'name':'Actual individual scrap shoulder rivet seated on metal '+rivet.name,'leftParts':[h.semantic(rivet)],'leftObjectNames':[rivet.name],'rightParts':sorted(set(h.semantic(o)for o in plate)),'rightObjectNames':[o.name for o in plate]})

 # Source-specific head structures missed by the general cover pass.
 fs=obs('Observed face',head)
 if fs:
  fl,fh=bound(fs);fc=(fl+fh)/2;hw=fh.x-fl.x;hd=fh.y-fl.y;hh=fh.z-fl.z
  if wave==3:
   rm(('Cooking pot helmet','Pot side handle'),head)
   b.loft('V6 cooking pot fitted inverted iron crown',[b.ring(fc.x,fc.y,fh.z-.015,hw*.57,hd*.58,12),b.ring(fc.x,fc.y,fh.z+.15,hw*.53,hd*.54,12),b.ring(fc.x,fc.y,fh.z+.18,hw*.43,hd*.44,12)],'v6_worn_iron',head)
   annulus(b,'V6 cooking pot seated thick iron rim',(fc.x,fc.y,fh.z-.005),hw*.55,.022,'steel_dark',head,n=12,m=6)
   for sign in(-1,1):rod('V6 pot genuine contacting curved side handle',[(fc.x+sign*hw*.52,fc.y,fh.z+.045),(fc.x+sign*hw*.71,fc.y,fh.z+.04),(fc.x+sign*hw*.71,fc.y,fh.z-.03),(fc.x+sign*hw*.52,fc.y,fh.z-.035)],.021,'steel_dark',head)
   recipes.append('Source fitted inverted cooking pot with contacting rim and handles')
  if wave==7:
   rm(('Crocodile','Marsh skull','Marsh hunter'),head)
   cover=h.source_hood(b,head,fc,hw,hh,hd,'hood');cover['semanticPart']='V6 marsh source fitted brown leather skull supporting hood';cover.data.materials.clear();cover.data.materials.append(b.M['leather'])
   name='V6 marsh actual carved crocodile skull hood';cc=Vector((fc.x,fc.y-.065,fh.z+hw*.19))
   shell=ell(b,name+' actual carved cranial shell',cc,(hw*.60,hw*.65,hw*.38),'ivory',head,12,4)
   for sign in(-1,1):
    ec=cc+Vector((sign*hw*.54,-hw*.04,hw*.025));cut=ell(b,'temporary V6 crocodile real skull eye cutter',ec,(hw*.31,hw*.19,hw*.155),'dark',head,10,4);boolean(b,shell,cut,'DIFFERENCE')
    ell(b,name+' genuine recessed eye cavity',cc+Vector((sign*hw*.30,-hw*.04,hw*.025)),(hw*.035,hw*.14,hw*.11),'dark',head,8,3)
   snout=b.loft('V6 marsh actual tapered long skull snout',[b.ring(fc.x,fc.y+hw*.63,fh.z-.028,hw*.39,hw*.70,10),b.ring(fc.x,fc.y+hw*.63,fh.z+.058,hw*.45,hw*.70,10),b.ring(fc.x,fc.y+hw*.55,fh.z+.108,hw*.34,hw*.64,10)],'ivory',head)
   for sign in(-1,1):
    cut=ell(b,'temporary V6 crocodile nostril',(fc.x+sign*hw*.18,fc.y+hw*1.28,fh.z+.044),(.024,.070,.022),'dark',head,8,3);boolean(b,snout,cut,'DIFFERENCE')
   for k in range(7):cone(b,'V6 crocodile externally attached curved fang',(fc.x+(k-3)*hw*.105,fc.y+hw*1.28,fh.z-.018),(fc.x+(k-3)*hw*.105,fc.y+hw*1.26,fh.z-hw*.15),hw*.043,'ivory',head,5)
   for k in range(4):
    p,n,_,_=tree([shell]).find_nearest(Vector((fc.x,fc.y-hw*(.34+.10*k),fh.z+hw*(.47-.035*k))))
    b.box('V6 marsh actual contacting stepped rear ivory skull ridge',p-n*.012,(hw*.84,.077,.067),'ivory',.016,head)
   rm(('Actual layered marsh cloak reed leaf','Layered leaf shoulder','V5 folded fitted cloak','Real rear cape'))
   for level in range(3):
    zz=hi.z-.022-level*(hi.z-hip)*.23
    for k in range(18):
     a=(k+.4*(level%2))*math.tau/18;p,n,_,_=tree(body).find_nearest(Vector((wc*.54*math.sin(a),cy+(hi.y-lo.y)*.56*math.cos(a),zz)));tip=p+Vector((.07*math.sin(a),.07*math.cos(a),-.30-.046*(k%3==0)))
     leaf(b,'V6 marsh dense contacting wraparound reed leaf mantle',p-n*.006,tip,wc*.245,'moss',torso)
   recipes.append('Elongated actual carved crocodile skull hood above exposed green face, long toothed snout and dense three-tier wraparound fitted reed mantle')
  if wave==20:
   rm(('Mammoth crown','Branched antler','Antler side fork','Bone throne','Crown continuous band','Crown tall tooth'),head);rm(('Bone throne',))
   for k in range(7):
    a=(k-3)*.36;start=Vector((hw*.52*math.sin(a),fc.y-hd*.39,fh.z-.025));side=math.sin(a);end=start+Vector((hw*.27*side,-.04,hh*(1.07+.13*(k%2))))
    pts=[start,start+Vector((hw*.22*side,.025,hh*.21)),start+Vector((hw*.43*side,.012,hh*.57)),end-Vector((hw*.045*side,.0,hh*.17)),end]
    h.bend(b,'V6 Patriarch actual curved contacting ivory crown rib',pts,[.070,.076,.063,.035,.006],'ivory',head,10)
   for sign in(-1,1):
    x=sign*wc*.32;y=lo.y-.040;rod('V6 Patriarch actual source strapped wooden bone carrier post',[(x,y,hip+.04),(x,y,hi.z+.13)],.049,'wood',torso)
    for j in range(5):b.box('V6 Patriarch actual attached shaped ivory carrier vertebra',(x,y-.012,hip+.14+j*(hi.z-hip-.08)/4),(.14,.135,.118),'ivory',.022,torso)
    rod('V6 Patriarch source shoulder carrier contacting leather binding',[(x,y,hi.z-.08),(sign*wc*.25,cy,hi.z-.04)],.035,'leather',torso)
   for z in(hip+.14,hip+.29,hi.z-.08):rod('V6 Patriarch real strapped wood carrier cross brace',[(-wc*.32,lo.y-.05,z),(wc*.32,lo.y-.05,z)],.046,'wood',torso)
   recipes.append('Curved ivory rib crown and contacting bone throne carrier')
   # The source has a broad fitted dark leather vest under its bone rig,
   # rather than bare green skin between thin harness straps.
   material(b,'v6_patriarch_dark_leather','503C2F')
   # Existing continuous thorax faces beneath the fitted vest carry the
   # same leather surface. This prevents tiny overlapping skin facets from
   # reading as bright green holes while retaining the exposed upper neck.
   for ob in body:
    index=len(ob.data.materials);ob.data.materials.append(b.M['v6_patriarch_dark_leather'])
    for polygon in ob.data.polygons:
     z=sum((ob.matrix_world@ob.data.vertices[i].co).z for i in polygon.vertices)/len(polygon.vertices)
     if hip+.07<z<hi.z-.06:polygon.material_index=index
   fitbody=list(set(body+obs('V6 source anatomical pelvis')));bv=tree(fitbody);cx=(lo.x+hi.x)/2
   for back in(False,True):
    side='back'if back else'front';sgn=-1 if back else 1
    def vest_y(x,z):
     q,n,_,_=bv.ray_cast(Vector((x,lo.y-.4 if back else hi.y+.4,z)),Vector((0,1 if back else-1,0)),2)
     if q is None:q,n,_,_=bv.find_nearest(Vector((x,lo.y-.3 if back else hi.y+.3,z)))
     return q.y+sgn*.035
    vest=h.grid_shell(b,'V6 Patriarch actual broad fitted dark leather vest '+side,[cx+wc*(-.43+.86*j/16)for j in range(17)],[hip+.11+(hi.z-.08-hip-.11)*j/12 for j in range(13)],vest_y,-.064 if back else .064,'v6_patriarch_dark_leather',torso)
    contacts.append({'name':'Actual dark leather vest seated on body '+side,'leftParts':[h.semantic(vest)],'leftObjectNames':[vest.name],'rightParts':sorted(set(h.semantic(o)for o in body)),'rightObjectNames':[o.name for o in body]})
   for side in('L','R'):
    ap=pivot(b,'upper_arm_'+side);arm=obs('V6 source anatomical upper arm '+side,ap);al,ah=bound(arm);ac=(al+ah)/2
    q,n,_,_=tree(arm).find_nearest(Vector((ac.x,ac.y,ah.z+.08)))
    cap=ell(b,'V6 Patriarch actual dark contacting leather shoulder cap '+side,q-n*.034,((ah.x-al.x)*.52,(ah.y-al.y)*.54,.103),'v6_patriarch_dark_leather',ap,10,3)
    contacts.append({'name':'Actual dark shoulder cap seated on upper arm '+side,'leftParts':[h.semantic(cap)],'leftObjectNames':[cap.name],'rightParts':sorted(set(h.semantic(o)for o in arm)),'rightObjectNames':[o.name for o in arm]})
   recipes.append('Broad actual surface-fitted dark brown front/back leather vest and physically seated dark shoulder caps')
  if wave==43:
   # A steel visor with two genuinely empty eye cells and nasal hole.
   ob=h.real_mask(b,head,fc,hw,hh,hd,'v6_worn_iron');cut=ell(b,'temporary V6 real iron visor nasal hole',(fc.x,fh.y+.064,fc.z-hh*.12),(hw*.052,.10,hh*.09),'dark',head,8,3);boolean(b,ob,cut,'DIFFERENCE')
   recipes.append('Source fitted iron visor with true eye and nose apertures')
  if wave==44:
   rod('V6 executioner one contacting long ivory forehead blade',[(fc.x,fh.y+.04,fh.z-.025),(fc.x,fh.y+.035,fh.z+.28)],.047,'ivory',head)
   recipes.append('Single fitted executioner ivory forehead blade')
  if wave in(14,41):
   xs=[fc.x+hw*q for q in(-.54,-.43,-.24,0,.24,.43,.54)]
   h.grid_shell(b,'V6 source actual curved fitted steel rear helmet neck guard',xs,[hi.z-.012,fc.z,fh.z+.025],lambda x,z:fc.y-hd*.57*math.sqrt(max(.02,1-((x-fc.x)/(hw*.56))**2)),.025,'steel_dark',head)
   for side in('L','R'):
    pa=pivot(b,'upper_leg_'+side);skin=obs('Upper leg '+side,pa)
    if not skin:continue
    al,ah=bound(skin);ac=(al+ah)/2;front=ah.y+.008
    b.panel('V6 source contacting fitted segmented steel waist tasset '+side,[(al.x-.02,front,hip+.07),(ah.x+.02,front,hip+.07),(ah.x+.025,front+.008,hip-.13),(ac.x,front+.011,hip-.16),(al.x-.025,front+.008,hip-.13)],.033,'steel_dark',torso,.010)
   if wave==41:
    for ob in obs(('V6 source angled fitted shoulder plate','V6 source wrapped wrist armor','V6 source articulated leg armor')):ob.data.materials.clear();ob.data.materials.append(b.M['steel'])
   recipes.append('Genuine curved rear helmet guard and source segmented steel tassets around real thigh bearings')
  if wave==27:
   rm(('Observed face','Eye '),head);ob=skull('V6 skeletal rider actual ivory skull under dark hood',fc,hw*.96,head);ob['semanticPart']='Observed face';recipes.append('Actual ivory skeletal skull with real eye/nose cavities inside source dark cowl')
  if wave==42:
   cap=obs('V6 source fitted rounded metal cap',head)
   if cap:
    p,n,_,_=tree(cap).find_nearest(Vector((fc.x,fh.y+.07,fh.z+.055)));rod('V6 fire bearer actual contacting cap amber fire rune',[p+Vector((-.027,0,-.024)),p,p+Vector((.027,0,.030))],.011,'v6_ochre',head)
   recipes.append('Physical fitted fire-rune cap and whole fire spear with attached crimson pennant')

 if wave==1:
  rm(('Carved ivory skull','Skull lower jaw','Skull square socket','Scavenger actual two-skull shoulder tray','Belt buckle'))
  pl,ph=bound(obs('Scavenger actual heavy rear sack'))
  for k in range(2):
   c=Vector((ph.x-.13+.095*k,ph.y-.040,ph.z+.078-.049*k));skull('V6 scavenger rear sack actual ivory skull',c,.21-.018*k,torso)
   rod('V6 scavenger actual contacting pack skull leather binding',[c+Vector((-.07,-.055,-.08)),c+Vector((.07,-.055,-.08))],.022,'leather',torso)
  skull('V6 scavenger source actual ivory belt skull',(0,hi.y+.055,hip+.025),.16,torso)
  recipes.append('Two actual carved source skulls visibly above worn rear sack, real belt skull and compact source cleaver')
 if wave in(2,10):
  rm(('Ground claw','Crossed leather baldric'))
  bv=tree(body)
  for rear in(False,True):
   for sign in(-1,1):
    pts=[]
    for k in range(12):
     t=k/11;p=Vector((sign*wc*(.36-.72*t),lo.y-.25 if rear else hi.y+.25,hi.z-.035-t*(hi.z-lo.z-.067)));direction=Vector((0,1 if rear else-1,0));q,n,_,_=bv.ray_cast(p,direction,2)
     if q is None:q,n,_,_=bv.find_nearest(p)
     pts.append(q-n*.005)
    rod('V6 '+('thornstrider'if wave==2 else'gatebreaker')+' source fitted crossed leather torso strap',pts,.022 if wave==2 else .038,'leather',torso)
  for side in('L','R')if wave==2 else():
   pa=pivot(b,'shin_'+side);p=pivot(b,'foot_'+side).matrix_world.translation
   annulus(b,'V6 thornstrider actual ankle bone cuff',(p.x,p.y,p.z+.155),.079,.024,'ivory',pa,n=10,m=5)
   for k in range(5):a=k*math.tau/5;rod('V6 thornstrider contacting ankle bone knot',[(p.x+.075*math.sin(a),p.y+.075*math.cos(a),p.z+.144),(p.x+.10*math.sin(a),p.y+.10*math.cos(a),p.z+.217)],.024,'ivory',pa)
  recipes.append('Actual ankle bone cuffs replacing erroneous forward boot claws')
 if wave==9:
  for ob in body:ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  bv=tree(body)
  for rear in(False,True):
   for sign in(-1,1):
    pts=[]
    for j in range(11):
     t=j/10;p=Vector((sign*wc*(.31-.62*t),lo.y-.22 if rear else hi.y+.22,hi.z-.035-t*(hi.z-lo.z-.070)));q,n,_,_=bv.ray_cast(p,Vector((0,1 if rear else-1,0)),2)
     if q is None:q,n,_,_=bv.find_nearest(p)
     pts.append(q-n*.005)
    rod('V6 dust dancer actual contacting crossed fitted leather tunic strap',pts,.020,'wood',torso)
  recipes.append('Actual fitted brown leather torso and overlapping contacting crossed leather straps beneath the brown hood and ragged rear cloak')
 if wave==11:
  for ob in obs('V6 source curved fitted breastplate'):
   al,ah=bound([ob]);cx=(al.x+ah.x)/2;bottom=max(lo.z+.12,hip+.21);top=hi.z-.11;inv=ob.matrix_world.inverted()
   for v in ob.data.vertices:
    p=ob.matrix_world@v.co;p.x=cx+(p.x-cx)*.79;p.z=bottom+(p.z-al.z)/(ah.z-al.z)*(top-bottom);v.co=inv@p
   ob.data.update()
 if wave==3:
  rm(('Frying pan','Ogre actual hanging iron frying pan','Pan belt'))
  p=Vector((wc*.44,hi.y-.07,hip-.014));annulus(b,'V6 ogre ONE contacting hanging iron pan rim',p,.145,.026,'steel_dark',torso,True,n=12,m=6)
  ell(b,'V6 ogre actual concave pan bowl',p+Vector((0,-.023,0)),(.14,.035,.14),'steel_dark',torso,12,4)
  rod('V6 ogre one hanging pan actual belt handle',[p+Vector((0,0,.125)),p+Vector((0,0,.27))],.026,'wood',torso)
  rm('Crossed leather baldric');recipes.append('One round source potbelly with contacting suspenders and exactly one pan')
 if wave==4:
  rm('Belt buckle')
  zz=hip+.17;yy=hi.y+.030
  b.panel('V6 scrap source actual diamond frame crossed strap buckle',[(-.070,yy,zz),(0,yy,zz+.068),(.070,yy,zz),(0,yy,zz-.068)],.025,'steel_dark',torso,.012)
  b.panel('V6 scrap actual contacting inset leather diamond buckle',[(-.046,yy+.026,zz),(0,yy+.026,zz+.044),(.046,yy+.026,zz),(0,yy+.026,zz-.044)],.016,'leather',torso,.002)
  zz=hip+.022;b.panel('V6 scrap source riveted front loincloth sheetmetal',[(-.132,hi.y+.01,zz+.065),(.132,hi.y+.01,zz+.065),(.12,hi.y+.025,zz-.066),(-.12,hi.y+.025,zz-.066)],.025,'v6_rust_steel',torso,.008)
  for sx in(-1,1):
   for z in(zz-.040,zz+.038):ell(b,'V6 scrap attached front loincloth metal rivet',(sx*.09,hi.y+.045,z),(.012,.009,.012),'steel_dark',torso,8,3)
  recipes.append('Crossed strap diamond-frame buckle and source riveted loincloth sheetmetal')
 if wave in(6,21):
  if wave==6:rm('Crossed leather baldric')
  rm(('Moss shoulder cluster','Runestone back','Mushroom hexagonal cap','Mushroom stalk'))
  for k in range(9):
   a=k*math.tau/9;p=Vector((wc*.38*math.sin(a),lo.y+.08+.13*math.cos(a),hi.z-.07+(k%3)*.035));ell(b,'V6 source broad irregular moss-covered back mass',p,(.18,.14,.12),'moss',torso,7,3)
   if wave==6:
    for j in range(2):rod('V6 source engraved moss runestone groove',[p+Vector((-.020,.114,.08+j*.035)),p+Vector((.020,.114,.095+j*.035))],.008,'rune',torso,6)
  recipes.append('Irregular source moss shoulder/back mass, carved runes and mushrooms')
 if wave==8:
  rm(('Frost troll overlapping thick shoulder mane','Troll actual long ivory finger claw','Actual teal regeneration arm shard'))
  # Refitted shorter ragged hide is source cloth; preserve actual folded V5
  # cloth construction while bringing its top to the new shoulders.
  cloth=obs('V5 folded fitted cloak')
  if cloth:
   cl,ch=bound(cloth)
   for o in cloth:
    inv=o.matrix_world.inverted()
    for v in o.data.vertices:
     p=o.matrix_world@v.co;p.z=hip+.06+(p.z-cl.z)/(ch.z-cl.z)*(hi.z-hip-.055);p.y=lo.y+.008-(cl.y-p.y)*.55;v.co=inv@p
    o.data.update()
  for side in('L','R'):
   pa=pivot(b,'forearm_'+side);p=h.center(obs('V6 source anatomical forearm '+side,pa))
   for j in range(3):b.jewel('V6 shadowblood contacting irregular turquoise forearm shard',p+Vector(((-1 if side=='L'else 1)*.12,.09,(j-1)*.09)),.042,.13+.015*j,.04,'v6_soul_cyan',pa)
  rm('Crossed leather baldric');recipes.append('Short fitted ragged dark hide and source irregular forearm crystals')
  material(b,'v6_shadowblood_hide','343439');material(b,'v6_shadowblood_teal','3B9E94')
  face=obs('Observed face',head);fl,fh=bound(face);fc=(fl+fh)/2;fw=fh.x-fl.x;hh=fh.z-fl.z;fd=fh.y-fl.y
  cowl=h.source_hood(b,head,fc,fw,hh,fd,'hood');cowl['semanticPart']='V6 shadowblood fitted dark hide scalp and side cowl';cowl.data.materials.clear();cowl.data.materials.append(b.M['v6_shadowblood_hide'])
  rm('V5 folded fitted cloak')
  xs=[wc*(j-4)*.11 for j in range(9)];zs=[hip+.06,hip+.16,hip+.32,hi.z-.20,hi.z-.10]
  hide=h.grid_shell(b,'V6 shadowblood continuous folded fitted dark back hide',xs,zs,lambda x,z:lo.y-.025-.060*math.cos(x/wc*math.tau*4),.033,'v6_shadowblood_hide',torso)
  bv=tree(body);inv=hide.matrix_world.inverted();N=len(xs)*len(zs)
  for i,v in enumerate(hide.data.vertices):
   p=hide.matrix_world@v.co;col=i%len(xs);row=(i%N)//len(xs);p.x*=.82+.18*row/(len(zs)-1)
   if row==0:p.z+=.075*(col%2)
   q,n,_,_=bv.find_nearest(Vector((p.x,lo.y-.18,p.z)));p=Vector((p.x,q.y-.008-.036*(1+math.cos(col*math.pi)),p.z))
   if i>=N:p.y+=.033
   v.co=inv@p
  hide.data.update()
  for k in range(7):
   xx=wc*(k-3)*.13;p,n,_,_=bv.find_nearest(Vector((xx,lo.y-.25,hi.z-.125)))
   leaf(b,'V6 shadowblood actual overlapping ragged upper hide fold',p-n*.006,(xx,lo.y-.09,hip+.10-.042*(k%3)),wc*.22,'v6_shadowblood_hide',torso)
  for k in range(13):
   a=k*math.tau/13;p=Vector((wc*.45*math.sin(a),cy+(hi.y-lo.y)*.50*math.cos(a),hip+.11));leaf(b,'V6 shadowblood source contacting dark ragged hide skirt',p,p+Vector((.021*math.sin(a),.021*math.cos(a),-.21-.05*(k%3==0))),wc*.13,'v6_shadowblood_hide',torso)
  for ob in obs('V6 shadowblood contacting irregular turquoise forearm shard'):ob.data.materials.clear();ob.data.materials.append(b.M['v6_shadowblood_teal'])
  for side in('L','R'):
   arm=obs('V6 source anatomical upper arm '+side);al,ah=bound(arm);p,n,_,_=tree(arm).find_nearest(Vector(((al.x+ah.x)/2,ah.y+.05,ah.z-.045)));b.jewel('V6 shadowblood actual contacting shoulder teal crystal',p-n*.008,.065,.12,.045,'v6_shadowblood_teal',pivot(b,'upper_arm_'+side))
  recipes.append('Source dark fitted cowl/whole folded back hide, dark ragged loincloth and visible nonemissive teal shoulder/forearm crystals')
 if wave==11:
  rm(('Carved ivory skull','Skull lower jaw','Skull square socket'))
  ap=pivot(b,'upper_arm_R');a=ap.matrix_world.translation.copy();p=Vector((a.x+.065,hi.y+.035,hi.z-.095));skull('V6 hookbearer source huge shoulder skull',p,.39,ap)
  rod('V6 hookbearer true contacting shoulder to skull leather mount',[a,p-Vector((0,.04,.14))],.056,'leather',ap)
  for sign in(-1,1):rod('V6 hookbearer shoulder skull contacting curled ivory horn',[(p.x+sign*.16,p.y,p.z+.20),(p.x+sign*.23,p.y-.025,p.z+.40),(p.x+sign*.17,p.y+.01,p.z+.47)],.050,'ivory',ap)
  ap=pivot(b,'upper_arm_L');p=ap.matrix_world.translation;b.loft('V6 hookbearer actual salvaged domed shoulder helmet',[b.ring(p.x,p.y,p.z+.03,.17,.14,10),b.ring(p.x,p.y,p.z+.15,.14,.12,10),b.ring(p.x,p.y,p.z+.21,.035,.031,10)],'v6_worn_iron',ap)
  cone(b,'V6 hookbearer source pointed salvaged grey shoulder helmet crest',(p.x,p.y,p.z+.195),(p.x,p.y,p.z+.295),.061,'v6_worn_iron',ap,6)
  recipes.append('Asymmetric horned ivory skull and salvaged shoulder cap with real hooks')
 if wave==12:
  rm(('Bell dark crack','Bell top suspension','Cracked temple bell'))
  # Cast bell is a single thick shell with open underside, flared thick rim
  # and a real jagged cut all the way through its front wall.
  fl,fh=bound(obs('Observed face',head));fc=(fl+fh)/2;c=Vector((0,fc.y-.26,fh.z+.025));r=.35;H=.54;N=18;vs=[]
  material(b,'v6_bronze','96764B')
  rings=[(0,r),(.075,r*.83),(.31,r*.61),(.43,r*.33),(.405,r*.24),(.30,r*.52),(.08,r*.73),(0,r*.89)]
  for j,(z,rx)in enumerate(rings):
   offset=[-.055,.070,-.055,.035,.035,-.055,.070,-.055][j]
   angles=[-.0675+offset,.0675+offset]+[.0675+offset+(math.tau-.135)*k/(N-1)for k in range(1,N-1)]
   vs += [(c.x+rx*math.sin(a),c.y+rx*math.cos(a),c.z+z*1.2)for a in angles]
  fs=[]
  for j in range(7):
   if j==3:continue # outer roof and inner roof have distinct real cap faces
   for k in range(1,N):fs.append((j*N+k,j*N+(k+1)%N,(j+1)*N+(k+1)%N,(j+1)*N+k))
  fs.append(tuple(range(4*N,5*N)));fs.append(tuple(reversed(range(3*N,4*N))))
  for k in range(1,N):fs.append((7*N+k,7*N+(k+1)%N,(k+1)%N,k))
  # Exposed thick fracture walls connect the genuine outer and inner bell
  # surfaces along a jagged angular path. The whole crack has empty space.
  for k in(0,1):
   for j in range(3):fs.append((j*N+k,(j+1)*N+k,(6-j)*N+k,(7-j)*N+k))
  fs.append((3*N,3*N+1,4*N+1,4*N))
  bell=b.mesh('V6 temple actual thick hollow bronze bell with open underside',vs,fs,'v6_bronze',torso)
  for sign in(-1,1):rod('V6 temple actual source shoulder bell supporting leather strap',[(sign*wc*.32,cy,hi.z-.075),(sign*r*.915,c.y,c.z+.055)],.039,'leather',torso)
  # Connected cutter covers whole bronze wall and forms an irregular open
  # crack, not a black stroke laid on the surface.
  b.loft('V6 temple actual recessed inner bronze roof',[b.ring(c.x,c.y,c.z+.468,.086,.086,12),b.ring(c.x,c.y,c.z+.498,.090,.090,12)],'v6_bronze',torso)
  b.box('V6 temple actual recessed back bronze patch behind open crack',(c.x-.007,c.y-r*.51,c.z+.276),(.022,.021,.0384),'v6_bronze',.004,torso)
  annulus(b,'V6 temple thick flared contacting lower bronze rim',c,r*.94,.037,'v6_bronze',torso,n=18,m=6)
  rod('V6 bell source contacting upper hanging loop',[(c.x-.055,c.y,c.z+H-.02),(c.x-.05,c.y,c.z+H+.09),(c.x+.05,c.y,c.z+H+.09),(c.x+.055,c.y,c.z+H-.02)],.021,'steel_dark',torso)
  for sign in(-1,1):
   for j in range(2):
    a=sign*1.95;zz=.17+j*.11
    pts=[]
    for k in range(9):
     angle=k*math.tau/8;z=zz+math.sin(angle)*.041;rx=r*(.83-(z-.075)/(.31-.075)*.22);theta=a+math.cos(angle)*.13;pts.append((c.x+rx*math.sin(theta),c.y+rx*math.cos(theta),c.z+z*1.2))
    rod('V6 bell contacting purple source closed glyph loop',pts,.009,'v6_soul_purple',torso,6)
  for side in('L','R'):
   pa=pivot(b,'foot_'+side);rm(('V6 source anatomical bare foot','V6 source connected bare toe'),pa);p=pa.matrix_world.translation
   b.loft('V6 bell carrier source short contacting leather boot '+side,[b.ring(p.x,p.y+.035,.001,.075,.102,8),b.ring(p.x,p.y+.035,.06,.082,.107,8),b.ring(p.x,p.y,.125,.053,.070,8)],'leather',pa)
  recipes.append('True jagged crack, thick flared rim, open bell underside, cast bronze and purple glyphs')
 if wave==13:
  rm('Crossed leather baldric')
  for ob in body:ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  annulus(b,'V6 huntress actual contacting bronze waist ring',(wc*.38,hi.y,hip+.08),.071,.017,'v6_bronze',torso,True,n=12,m=6);recipes.append('Red woven braids, dark fitted leather vest, real crescent axe and waist ring')
 if wave in(15,19):
  h.fitted_plate(b,'V6 bloodwolf rider fitted broad strapped brown breast',body,torso,'leather',.94)
  b.box('V6 bloodwolf rider actual contacting broad brown rear torso vest',(0,lo.y+.012,(lo.z+hi.z)/2),(wc*.96,.052,(hi.z-lo.z)*.88),'leather',.03,torso)
  for side in('L','R'):
   pa=pivot(b,'upper_arm_'+side);skin=obs(('Upper arm '+side,'Connected shoulder '+side),pa)
   if not skin:continue
   sl,sh=bound(skin);p=(sl+sh)/2;sgn=-1 if side=='L'else 1
   ob=ell(b,'V6 bloodwolf rider actual thick fitted red spiked pauldron',p+Vector((sgn*.022,0,.063)),((sh.x-sl.x)*.70,(sh.y-sl.y)*.62,.12),'red',pa,8,3)
   for j in range(3):
    root=p+Vector((sgn*.02,(j-1)*.065,.12));cone(b,'V6 bloodwolf contacting stout red shoulder armor spike',root,root+Vector((sgn*.08,.015,.14)),.038,'red',pa,5)
  for sign in(-1,1):rod('V6 bloodwolf rider source contacting brown rear vest harness',[(sign*wc*.29,lo.y-.010,lo.z+.04),(-sign*wc*.25,lo.y-.014,hi.z-.065)],.023,'leather',torso)
  recipes.append('Broad fitted brown strapped torso and thick source red spiked shoulders on crouched rider')
 if wave in(5,15,25,28,29,34,37,39,42,47,48):
  for ob in obs('V6 rider source seated thorax'):ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  for level in range(2):
   for k in range(12):
    a=k*math.tau/12;start=Vector((wc*.43*math.sin(a),cy+(hi.y-lo.y)*.46*math.cos(a),hip+.10-level*.05));tip=start+Vector((.025*math.sin(a),.025*math.cos(a),-.18-.035*(k%2)))
    leaf(b,'V6 mounted source contacting brown leather tunic skirt',start,tip,wc*.16,'leather',torso)
  for sign in(-1,1):rod('V6 mounted source fitted brown rear crossed torso strap',[(sign*wc*.29,lo.y+.008,hi.z-.055),(-sign*wc*.27,lo.y+.005,hip+.09)],.029,'leather',torso)
  recipes.append('Actual source brown leather fitted rider torso, ragged seated tunic skirt and rear harness')
 if wave in(28,29,34,37,39,47,48):
  for ob in obs('V6 source fitted domed cloth hood',head):ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  rm(('V6 source curved fitted breastplate','V6 source contacting small rear armor plate'))
  if wave in(37,39,48):
   material(b,'v6_shadow_rider_hood','29282F')
   for ob in obs('V6 source fitted domed cloth hood',head):ob.data.materials.clear();ob.data.materials.append(b.M['v6_shadow_rider_hood'])
 if wave in(25,35,41,42) and fs:
  if wave==35:material(b,'v6_eclipse_helmet','574A73')
  metal='v6_eclipse_helmet'if wave==35 else'steel'
  for sign in(-1,1):
   b.loft('V6 mounted knight actual continuous cap contacting cheek temple armor',[b.ring(fc.x+sign*hw*.495,fc.y,fc.z-hh*.42,hw*.085,hd*.41,8),b.ring(fc.x+sign*hw*.495,fc.y,fc.z+hh*.10,hw*.105,hd*.49,8),b.ring(fc.x+sign*hw*.49,fc.y,fh.z+.020,hw*.098,hd*.46,8)],metal,head)
  if wave==35:
   for ob in obs('V6 source fitted rounded metal cap',head):ob.data.materials.clear();ob.data.materials.append(b.M['v6_eclipse_helmet'])
  recipes.append('Fitted source rounded steel crown with physically contacting continuous temple and cheek protection around exposed face')
 if wave==30:
  rm('Curved segmented ram horn',head)
  rm(('V6 source curved fitted breastplate','V6 source contacting small rear armor plate'))
  for ob in obs('V6 rider source seated thorax'):ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  tuft_cloth('V6 warlord source actual layered red shoulder mantle','red',2)
  for sign in(-1,1):rod('V6 warlord source fitted brown rear crossed torso strap',[(sign*wc*.29,lo.y+.004,hi.z-.065),(-sign*wc*.27,lo.y+.008,hip+.065)],.029,'leather',torso)
  recipes.append('Brown strapped rider vest, layered red mantle and source crown without oversized side horns')
 if wave==34:
  for sign in(-1,1):ell(b,'V6 hanging source goblin actual contacting brown side supply pack',(sign*wc*.41,lo.y-.018,hi.z-.20),(.090,.085,.145),'leather',torso,8,4)
 if wave==45:
  for prefix in('','drummer_'):
   pa=pivot(b,prefix+'torso_pivot');pieces=obs('V6 rider source seated thorax',pa);tl,th=bound(pieces);tc=(tl+th)/2;tw=th.x-tl.x;td=th.y-tl.y;hz=pivot(b,prefix+'upper_leg_L').matrix_world.translation.z
   for ob in pieces:ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
   for k in range(12):
    a=k*math.tau/12;p=Vector((tc.x+tw*.44*math.sin(a),tc.y+td*.48*math.cos(a),hz+.085));leaf(b,'V6 source actual per drummer brown leather tunic skirt',p,p+Vector((.015*math.sin(a),.018*math.cos(a),-.19)),tw*.16,'leather',pa)
   for sign in(-1,1):rod('V6 source actual per drummer fitted rear brown vest strap',[(tc.x+sign*tw*.29,tl.y+.007,th.z-.044),(tc.x-sign*tw*.26,tl.y+.003,hz+.045)],.023,'leather',pa)
  for ob in obs(('V6 rider actual connected seated thigh ','V6 rider actual naturally hanging shin ')):ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  recipes.append('Two separately fitted source brown leather drummers with their own actual torso/hip coordinates and seated garments')
 if wave==48:
  for pa in(weapon('L'),weapon('R')):
   if pa:
    g=grip(pa);gone(b,[o for o in b.objects if h.descendants(o,pa)]);h.held_blade(b,pa,g,'dagger',.57,False,'steel')
  recipes.append('Two actual short physical source dagger blades, charcoal hood and brown strapped rider tunic')
 if wave==15:
  pa=weapon('R');g=grip(pa);tip=g+Vector((0,0,.76))
  for sign in(-1,1):rod('V6 mounted bloodwing actual steel forked spear prong',[tip-Vector((0,0,.06)),tip+Vector((sign*.11,0,.11)),tip+Vector((sign*.095,0,.32))],.027,'steel_dark',pa)
  recipes.append('Source twin physically connected steel spear fork prongs')
 if wave==16:
  rm('Heavy attached loot pouch')
  rm(('Crossed leather baldric','Leather ragged skirt'));material(b,'v6_pickpocket_dark_leather','363438');material(b,'gold','C49A43')
  gone(b,obs('V6 source continuous fitted mask with real eye openings',head))
  mask=h.grid_shell(b,'V6 source continuous fitted mask with real eye openings',[fc.x+hw*q for q in(-.49,-.31,-.12,0,.12,.31,.49)],[fc.z+hh*q for q in(-.45,-.06,.08,.28,.46)],lambda x,z:fh.y+.025+.13*max(0,1-abs(x-fc.x)/(hw*.50)),.022,'gold',head,((1,2),(4,2)))
  for ob in[mask]:
   inv=ob.matrix_world.inverted()
   for v in ob.data.vertices:
    p=ob.matrix_world@v.co
    if p.z<fc.z-hh*.02:p.x=fc.x+(p.x-fc.x)*(1-.58*min(1,(fc.z-p.z)/(hh*.45)));p.y+=(fc.z-p.z)*.09
    v.co=inv@p
   ob.data.update()
  b.loft('V6 pickpocket actual fitted dark leather jacket',[b.ring(0,cy,hip+.018,wc*.45,(hi.y-lo.y)*.53,12),b.ring(0,cy,hip+.14,wc*.52,(hi.y-lo.y)*.59,12),b.ring(0,cy,hi.z-.035,wc*.49,(hi.y-lo.y)*.57,12)],'v6_pickpocket_dark_leather',torso)
  for sign in(-1,1):
   x=sign*wc*.52;y=hi.y-.045;zz=hip+.04
   b.loft('V6 source large contacting gold side loot pouch',[b.ring(x,y,zz-.14,.085,.077,8),b.ring(x,y,zz-.03,.136,.10,8),b.ring(x,y,zz+.11,.107,.09,8)],'gold',torso)
   pa=pivot(b,'forearm_'+('R'if sign>0 else'L'));parts=obs('Forearm ',pa)
   if parts:h.fitted_plate(b,'V6 pickpocket actual fitted dark wrist bracer',parts,pa,'v6_pickpocket_dark_leather')
  tuft_cloth('V6 pickpocket dark fitted layered leather','v6_pickpocket_dark_leather',2);recipes.append('True gold eye mask with actual large rounded hanging gold pouches, dark fitted leather jacket/tiers and dark bracers')
  for k in range(7):
   x=(k-3)*wc*.125;p=Vector((x,hi.y+.003,hip+.075));leaf(b,'V6 pickpocket source contacting long ragged dark front hem',p,p+Vector((.016*math.sin(k),.020,-.235-.04*(k%2))),wc*.19,'v6_pickpocket_dark_leather',torso)
 if wave==18:
  rm(('V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer'))
  material(b,'v6_executioner_cloth','343139');material(b,'v6_executioner_rune','73508C')
  # The original has bare green upper arms and brown leather forearm wraps,
  # not inherited dark metal-coloured arms. Cloth shoulders remain fitted.
  for side in('L','R'):
   ap=pivot(b,'upper_arm_'+side);fp=pivot(b,'forearm_'+side);arm=obs(('Upper arm '+side,'Connected shoulder '+side),ap);fore=obs('Forearm '+side,fp)
   for ob in arm:ob.data.materials.clear();ob.data.materials.append(b.M['skin'])
   for ob in fore:ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
   al,ah=bound(arm);ac=(al+ah)/2;q,n,_,_=tree(arm).find_nearest(Vector((ac.x,ac.y,ah.z+.10)))
   cloth=ell(b,'V6 silent executioner actual fitted charcoal cloth shoulder '+side,q-n*.024,((ah.x-al.x)*.57,(ah.y-al.y)*.57,.066),'v6_executioner_cloth',ap,10,3)
   contacts.append({'name':'Actual charcoal shoulder cloth seated on green upper arm '+side,'leftParts':[h.semantic(cloth)],'leftObjectNames':[cloth.name],'rightParts':sorted(set(h.semantic(o)for o in arm)),'rightObjectNames':[o.name for o in arm]})
   for j in range(2):
    p,n,_,_=tree([cloth]).find_nearest(Vector((ac.x+(-1 if side=='L'else 1)*.045,ah.y+.12,ah.z+.045-j*.039)));gem=b.jewel('V6 silent executioner actual purple shoulder cloth diamond',p-n*.004,.020,.034,.012,'v6_executioner_rune',ap)
    contacts.append({'name':'Actual purple shoulder diamond seated on cloth '+gem.name,'leftParts':[h.semantic(gem)],'leftObjectNames':[gem.name],'rightParts':[h.semantic(cloth)],'rightObjectNames':[cloth.name]})
  hood=obs('V6 source fitted domed cloth hood',head);inv=hood[0].matrix_world.inverted();back=fc.y-hd*.56;front=fc.y+hd*.5
  for v in hood[0].data.vertices:
   p=hood[0].matrix_world@v.co
   if p.z>fc.z+hh*.48:
    t=min(1,max(0,(p.y-back)/(front-back)));p.z=fc.z+hh*.48+(p.z-fc.z-hh*.48)*(.25+.75*t)
   v.co=inv@p
  hood[0].data.update()
  for sign in(-1,1):
   for j in range(3):
    q,n,_,_=tree(hood).ray_cast(Vector((fc.x+sign*hw*1.1,fc.y-.035,fc.z+hh*(.82-j*.18))),Vector((-sign,0,0)),1)
    if q is None:q,n,_,_=tree(hood).find_nearest(Vector((fc.x+sign*hw*.60,fc.y-.035,fc.z+hh*(.82-j*.18))))
    gem=b.jewel('V6 silent executioner actual purple diamond on tapered hood side',q-n*.004,.014,.045,.024,'v6_executioner_rune',head)
    contacts.append({'name':'Actual purple hood-side diamond seated in tapered cloth '+gem.name,'leftParts':[h.semantic(gem)],'leftObjectNames':[gem.name],'rightParts':sorted(set(h.semantic(o)for o in hood)),'rightObjectNames':[o.name for o in hood]})
  b.loft('V6 silent executioner actual long folded charcoal skirt',[b.ring(0,cy,.145,wc*.56,(hi.y-lo.y)*.61,14),b.ring(0,cy,hip-.10,wc*.53,(hi.y-lo.y)*.59,14),b.ring(0,cy,hip+.08,wc*.45,(hi.y-lo.y)*.52,14)],'v6_executioner_cloth',torso)
  xs=[wc*(j-3)*.19 for j in range(7)];zs=[.15,hip-.10,hip+.11,hi.z-.025]
  cloak=h.grid_shell(b,'V6 silent executioner real long folded charcoal rune cloak',xs,zs,lambda x,z:lo.y+.010-.028*(hi.z-z)/(hi.z-.15)+.022*math.cos(x/wc*math.tau*3),.024,'v6_executioner_cloth',torso)
  inv=cloak.matrix_world.inverted()
  for i,v in enumerate(cloak.data.vertices):
   p=cloak.matrix_world@v.co
   if (i%(len(xs)*len(zs)))//len(xs)==0:p.z+=.075*(i%len(xs)%2);p.x*=.90
   v.co=inv@p
  cloak.data.update()
  skirt=obs('V6 silent executioner actual long folded charcoal skirt')
  for ob in skirt:
   low=bound([ob])[0].z;inv=ob.matrix_world.inverted()
   for i,v in enumerate(ob.data.vertices):
    p=ob.matrix_world@v.co
    if p.z<=low+.001:p.z+=.055*(i%14%2)
    v.co=inv@p
   ob.data.update()
  for sx in(-1,1):
   rod('V6 silent executioner actual contacting purple robe facing',[(sx*wc*.27,hi.y-.005,hi.z-.11),(sx*wc*.25,hi.y+.015,hip+.08),(sx*wc*.31,hi.y+.028,.19)],.025,'v6_executioner_rune',torso)
  cbv=tree([cloak]);cl,ch=bound([cloak]);center=Vector((0,cl.y-.20,hip+.12));corners=[center+Vector((-.094,0,0)),center+Vector((0,0,.125)),center+Vector((.094,0,0)),center-Vector((0,0,.125)),center+Vector((-.094,0,0))];path=[]
  # Dense rays hit the real OUTER rear surface. A straight five-point path
  # had crossed through intermediate cloth folds and looked like a C.
  for a,dst in zip(corners,corners[1:]):
   for k in range(8):
    p=a.lerp(dst,k/8);q,n,_,_=cbv.ray_cast(Vector((p.x,cl.y-.20,p.z)),Vector((0,1,0)),2);assert q is not None,('rear diamond outside actual cloak',b.id,p[:]);path.append(q+n*.005)
  path.append(path[0]);rune=rod('V6 silent executioner actual rear purple diamond rune',path,.010,'v6_executioner_rune',torso,6)
  contacts.append({'name':'Complete dense fitted rear diamond contacts its folded cloth','leftParts':[h.semantic(rune)],'leftObjectNames':[rune.name],'rightParts':[h.semantic(cloak)],'rightObjectNames':[cloak.name]})
  outline=[(-wc*.29,hi.y+.019,hi.z-.095),(wc*.29,hi.y+.019,hi.z-.095),(wc*.25,hi.y+.040,hip+.03),(-wc*.25,hi.y+.040,hip+.03)];b.panel('V6 silent executioner source fitted dark leather breast garment',outline,.030,'v6_executioner_cloth',torso,.014)
  h.real_mask(b,head,fc,hw,hh,hd,'leather');rm('V6 source continuous fitted mask with real eye openings',head)
  jaw=obs('Orc broad jaw',head);jl,jh=bound(jaw);my=max(fh.y,jh.y)+.010
  mask=b.panel('V6 silent executioner source leather lower face mask',[(fc.x-hw*.48,my,fc.z+hh*.02),(fc.x+hw*.48,my,fc.z+hh*.02),(fc.x+hw*.42,my+.009,fl.z+.004),(fc.x,my+.017,fl.z-.015),(fc.x-hw*.42,my+.009,fl.z+.004)],.040,'leather',head,.006)
  contacts.append({'name':'Actual broad leather chin mask seated over jaw','leftParts':[h.semantic(mask)],'leftObjectNames':[mask.name],'rightParts':sorted(set(h.semantic(o)for o in jaw)),'rightObjectNames':[o.name for o in jaw]})
  rm('Ivory tusk',head)
  for k in(-1,0,1):b.box('V6 silent executioner actual contacting ivory lower mask bar',(fc.x+k*hw*.19,my+.017,fc.z-hh*.23),(hw*.040,.023,hh*.15),'ivory',.002,head)
  for pa in(weapon('R'),weapon('L')):
   g=grip(pa);gone(b,[o for o in b.objects if h.descendants(o,pa)]);sgn=1 if pa==weapon('R')else-1;a=g-Vector((0,0,.14));rod('V6 silent executioner actual contacting held crescent leather grip',[g+Vector((0,0,.045)),a],.032,'leather',pa)
   pts=[(0,.03),(.12,.01),(.20,-.06),(.25,-.15),(.26,-.26),(.22,-.39),(.17,-.47),(.18,-.30),(.14,-.17),(.06,-.11),(0,-.12),(-.02,-.04)];b.panel('V6 silent executioner actual whole curved crescent cleaver',[(a.x+sgn*x,a.y,a.z+z)for x,z in pts],.036,'steel',pa,0)
  recipes.append('Long structured charcoal cloak, physical purple runes/facings, leather lower mask and whole held curved crescent cleavers')
 if wave==23:
  material(b,'skin','66A9A7');material(b,'skin_light','8AC6BE')
  for side in('L','R'):
   pa=pivot(b,'foot_'+side);rm(('Grounded boot','Ground claw'),pa);p=pa.matrix_world.translation
   b.loft('V6 soul warlock actual bare cyan contacting foot '+side,[b.ring(p.x,p.y+.042,.001,.081,.124,10),b.ring(p.x,p.y+.052,.052,.087,.133,10),b.ring(p.x,p.y,.135,.058,.078,10)],'skin',pa)
  rm(('Crossed leather baldric','Continuous leather waist belt','Belt buckle'));recipes.append('Bare cyan palms/feet and ragged dark blue robe without brown boots or crossed straps')
  # Source still has a broad brown leather girdle over the dark ragged robe,
  # and three framed cyan seals physically hanging from its lower edge.
  cloth=obs(('V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer'));fit=body+cloth;bv=tree(fit);cx=(lo.x+hi.x)/2;R=wc*.50;D=(hi.y-lo.y)*.59;rings=[]
  for z in(hip+.045,hip+.115):
   ring=[]
   for k in range(24):
    a=k*math.tau/24;radial=Vector((math.sin(a),math.cos(a),0));origin=Vector((cx+R*math.sin(a),cy+D*math.cos(a),z))+radial*.25;q,n,_,_=bv.ray_cast(origin,-radial,1)
    if q is None:q,n,_,_=bv.find_nearest(origin)
    ring.append(tuple(q+radial*.016))
   rings.append(ring)
  belt=b.loft('V6 soul warlock actual broad fitted brown leather waist belt',rings,'leather',torso)
  contacts.append({'name':'Actual brown warlock girdle seated on the outer ragged robe','leftParts':[h.semantic(belt)],'leftObjectNames':[belt.name],'rightParts':sorted(set(h.semantic(o)for o in fit)),'rightObjectNames':[o.name for o in fit]})
  bl,bh=bound([belt])
  for k in(-1,0,1):
   x=cx+k*wc*.27;q,n,_,_=tree([belt]).ray_cast(Vector((x,bh.y+.2,hip+.078)),Vector((0,-1,0)),1);assert q is not None
   p=q+n*.004;frame=b.jewel('V6 soul warlock actual brown framed hanging cyan belt seal',p-Vector((0,0,.109)),.053,.148,.028,'leather',torso)
   link=rod('V6 soul warlock actual contacting hanging seal leather link',[p-Vector((0,0,.008)),p-Vector((0,0,.079))],.016,'leather',torso,8)
   gem=b.jewel('V6 soul warlock actual connected cyan hanging belt gem',p-Vector((0,-.024,.109)),.037,.111,.023,'v6_soul_cyan',torso)
   contacts.extend([{'name':'Actual individual warlock belt link seated on girdle '+link.name,'leftParts':[h.semantic(link)],'leftObjectNames':[link.name],'rightParts':[h.semantic(belt)],'rightObjectNames':[belt.name]},{'name':'Actual hanging leather frame connected to its own link '+frame.name,'leftParts':[h.semantic(frame)],'leftObjectNames':[frame.name],'rightParts':[h.semantic(link)],'rightObjectNames':[link.name]},{'name':'Actual cyan hanging belt gem seated inside its own brown frame '+gem.name,'leftParts':[h.semantic(gem)],'leftObjectNames':[gem.name],'rightParts':[h.semantic(frame)],'rightObjectNames':[frame.name]}])
  for k in range(7):
   q,n,_,_=tree([belt]).ray_cast(Vector((cx+(k-3)*wc*.115,bh.y+.2,hip+.084)),Vector((0,-1,0)),1)
   if q:ell(b,'V6 soul warlock actual seated brown girdle stud',q-n*.002,(.012,.009,.012),'steel_dark',torso,8,3)
  recipes.append('Actual surface-fitted broad brown studded girdle and three genuinely connected brown-framed hanging cyan seals')
 if wave==26:
  for side in('L','R'):
   pa=pivot(b,'forearm_'+side);skin=obs('V6 source anatomical forearm '+side,pa);sl,sh=bound(skin);a=pa.matrix_world.translation.copy();hand=pivot(b,'hand_'+side);end=hand.matrix_world.translation.copy()if hand else(sl+sh)/2-Vector((0,0,(sh.z-sl.z)*.25));p0=a.lerp(end,.27);p1=a.lerp(end,.92)
   wrap=h.bend(b,'V6 runebinder actual thick source brown leather forearm wrap '+side,[p0,p0.lerp(p1,.5),p1],[(sh.x-sl.x)*.56]*3,'leather',pa,12)
   contacts.append({'name':'Actual brown leather wrap seated around its own green forearm '+side,'leftParts':[h.semantic(wrap)],'leftObjectNames':[wrap.name],'rightParts':sorted(set(h.semantic(o)for o in skin)),'rightObjectNames':[o.name for o in skin]})
  recipes.append('Conspicuous source brown leather forearm and wrist wraps over exposed green upper arms')
 if wave==17:
  rm(('Carved ivory skull','Skull lower jaw','Skull square socket','Tall cursed totem'))
  p=Vector((wc*.29,lo.y-.08,hip+.03));rod('V6 totem source contacting irregular wood spine',[p,p+Vector((-.045,-.05,hi.z-hip+.40))],.089,'wood',torso)
  for j in range(3):
   c=p+Vector((-.02,-.03,.20+j*.29));skull('V6 totem actual shaped strapped rear skull',c,.27,torso)
   annulus(b,'V6 totem actual contacting skull rope',c,.145,.019,'leather',torso,True,n=12,m=6)
   rod('V6 totem continuous side cage brace',[(c.x-.16,c.y-.06,c.z-.10),(c.x-.16,c.y-.06,c.z+.13)],.028,'wood',torso)
  recipes.append('Three shaped carved rear skulls on real contacting rope and wood braces')
 if wave==24:
  # Source small exposed pilot sits inside a real riveted frame. Rebuild the
  # obsolete huge head-owned frame around measured current skin, not a slab.
  rm(('Mutant enclosing','Pilot frame actual'),head)
  fl,fh=bound(obs('Observed face',head));p=(fl+fh)/2
  for sx in(-1,1):
   rod('V6 mutant real contacting small pilot cage upright',[(p.x+sx*(fh.x-fl.x)*.64,lo.y+.03,hi.z-.07),(p.x+sx*(fh.x-fl.x)*.64,lo.y+.03,fh.z+.055)],.032,'v6_worn_iron',head)
  rod('V6 mutant actual pilot cage contacting roof',[(-((fh.x-fl.x)*.64),lo.y+.03,fh.z+.055),(((fh.x-fl.x)*.64),lo.y+.03,fh.z+.055)],.035,'steel_dark',head)
  for side in('L','R'):
   for part in('upper_arm','forearm','shin'):
    pa=pivot(b,part+'_'+side);p=pa.matrix_world.translation;rod('V6 mutant source actual mechanical joint longitudinal strut',[p-Vector((0,0,.11)),p+Vector((0,0,.07))],.065,'steel_dark',pa)
  pa=weapon('L');g=grip(pa);rm(('Mutant huge handheld iron cogwheel',),pa)
  rod('V6 mutant real palm contacting iron gear axle',[g,g+Vector((0,.18,0))],.071,'steel_dark',pa);gear(b,'V6 mutant source physically mounted toothed fist wheel',g+Vector((0,.16,0)),.25,'v6_worn_iron',pa)
  for sign in(-1,1):rod('V6 mutant actual solid axle to hollow hub spoke',[g+Vector((0,.16,0)),g+Vector((0,.16,sign*.165))],.046,'v6_worn_iron',pa)
  recipes.append('Fitted riveted pilot cage, mechanical struts and palm-connected gear axle')
 if wave==26:
  rm(('Orc broad source projecting jaw','Long source ivory orc tusk','Rune collar','Source rune collar'))
  for j in range(9):
   a=j*math.tau/9;c=Vector((wc*.41*math.sin(a),cy+.24*math.cos(a),hi.z-.065+(j%2)*.04));ell(b,'V6 runebinder contacting irregular obsidian rune collar stone',c,(.098+.015*(j%3),.095,.13+.018*(j%2)),'v6_obsidian',torso,5,3)
   for k in range(2):rod('V6 runebinder actual engraved orange collar rune',[c+Vector((-.025,.087,-.06+k*.043)),c+Vector((.025,.087,-.025+k*.043))],.009,'v6_ochre',torso,6)
  skull('V6 runebinder real contacting skull belt buckle',(0,hi.y-.05,hip+.03),.17,torso);recipes.append('Varied irregular obsidian collar with physical orange rune grooves and skull buckle')
 if wave==31:
  tuft_cloth('V6 inquisitor contacting torn parchment rune seal','ivory',1)
  for sign in(-1,1):skull('V6 inquisitor actual contacting ivory shoulder skull',(sign*wc*.39,cy,hi.z-.04),.22,pivot(b,'upper_arm_'+('R'if sign>0 else'L')))
  recipes.append('Twin connected peaked hood with fitted gold mask, hollow sun ring staff and parchment seals')
 if wave==32:
  rm('Crossed leather baldric')
  rm(('Soul drinker lantern','Soul drinker actual','Soul lantern','Lantern','Visible suspended ghost core'))
  for ob in obs('V6 source curved rib bearing spine'):ob.data.materials.clear();ob.data.materials.append(b.M['ivory'])
  material(b,'v6_bronze','635240')
  center=Vector((0,.17,(hip+hi.z)/2));roof=cage('V6 soul drinker actual chest lantern cage',center,.105,.24,torso)
  rod('V6 soul drinker actual chest lantern hanging bone link',[roof,(0,.12,hi.z-.03)],.020,'ivory',torso)
  for k in range(15):
   a=k*math.tau/15;p=Vector((wc*.43*math.sin(a),cy+(hi.y-lo.y)*.49*math.cos(a),hip+.075));leaf(b,'V6 soul drinker source fitted torn leather skirt',p,p+Vector((.018*math.sin(a),.022*math.cos(a),-.23-.045*(k%3==0))),wc*.13,'leather',torso)
  recipes.append('True open curved ribs surrounding genuinely hanging caged turquoise lantern')
 if wave==33:
  # Actual ghost body bearing must remain connected while the decorative
  # cloth breaks into source ragged layers; skin limbs are exposed icy blue.
  for side in('L','R'):
   pa=pivot(b,'foot_'+side);rm('Grounded boot',pa);p=pa.matrix_world.translation
   b.loft('V6 spectral swordsman bare icy contacting foot '+side,[b.ring(p.x,p.y+.04,.001,.085,.13,10),b.ring(p.x,p.y+.055,.057,.091,.14,10),b.ring(p.x,p.y,.14,.057,.080,10)],'skin',pa)
  rm(('Continuous leather waist belt','Belt buckle','Crossed leather baldric'));b.loft('V6 spectral swordsman actual contacting silver waist belt',[b.ring(0,cy,hip+.04,wc*.43,.20,12),b.ring(0,cy,hip+.10,wc*.43,.20,12)],'steel',torso)
  recipes.append('Bare icy limbs, silver belt, ragged purple robe and actual faceted purple sword')
 if wave==46:
  # No skin is introduced: a true open metal shell surrounds recessed light.
  rm(('V6 source fitted domed cloth hood','V6 hollow helmet deep dark cavity','V6 revenant real armored hollow cheek','Revenant helmet','Revenant visible teal','Helmet','Phantom contacting physical armor neck collar'),head)
  chest=obs('Separated phantom armor upper chest plate');cl,ch=bound(chest);w=wc*.54;hh=w*.88;z0=ch.z-.012;c=Vector((0,cy,z0+hh*.5));d=w*.72
  # Continuous armored crown/back/side/chin shell with large genuine opening.
  cover=h.source_hood(b,head,c,w,hh,d,'hood');cover['semanticPart']='V6 revenant continuous actual open armored helmet shell';cover.data.materials.clear();cover.data.materials.append(b.M['steel_dark'])
  ell(b,'V6 revenant actual recessed dark helmet interior',(0,cy-d*.19,c.z),(w*.39,d*.12,hh*.34),'dark',head,10,4)
  b.jewel('V6 revenant actual recessed cyan helmet soul',(0,cy-d*.12,c.z),w*.17,hh*.42,d*.065,'v6_soul_cyan',head)
  rm(('Visible suspended ghost core','Hollow revenant actual teal waist soul flame','Crossed leather baldric','Leather ragged skirt','Continuous leather waist belt','Belt buckle','V6 source curved fitted breastplate','V6 source contacting small rear armor plate'))
  gone(b,chest)
  # Genuine structural rear/chest casting and connected curved front flanks
  # leave the central soul aperture open; no generic tunic or leather body.
  rear=b.box('Separated phantom armor upper chest plate',(0,lo.y+.039,(hi.z+hip+.05)/2),(wc*.81,.12,hi.z-hip+.05),'steel_dark',.038,torso)
  cut=b.box('temporary V6 revenant actual rear waist light slit',(0,lo.y+.039,hip+.079),(wc*.66,.32,.050),'dark',.006,torso);boolean(b,rear,cut,'DIFFERENCE')
  from geometric_enemy_creature_anatomy_v6 import closed_boolean_cleanup
  closed_boolean_cleanup(rear)
  for sign in(-1,1):
   plate=b.box('V6 revenant actual source front chest flank plate',(sign*wc*.30,cy+.15,hi.z-.14),(wc*.34,.075,.30),'steel_dark',.027,torso)
   pp,n,_,_=tree([plate]).find_nearest(Vector((sign*wc*.30,cy+.30,hi.z-.16)));gem=b.jewel('V6 revenant actual contacting cyan side breastplate gem '+str(sign),pp+n*.005,.047,.085,.026,'v6_soul_cyan',torso)
   contacts.append({'name':'Actual individual cyan side gem seated in dark steel breastplate '+str(sign),'leftParts':[h.semantic(gem)],'leftObjectNames':[gem.name],'rightParts':[h.semantic(plate)],'rightObjectNames':[plate.name]})
   rod('V6 revenant actual source continuous back to chest flank metal',[(sign*wc*.32,lo.y+.046,hi.z-.12),(sign*wc*.43,cy,hi.z-.12),(sign*wc*.29,cy+.15,hi.z-.12)],.052,'steel_dark',torso)
   side='R'if sign>0 else'L';pa=pivot(b,'upper_arm_'+side);old=obs('Upper arm '+side,pa);al,ah=bound(old);ac=(al+ah)/2;gone(b,old)
   rod('Upper arm '+side,[(sign*wc*.31,cy,hi.z-.12),ac,pivot(b,'forearm_'+side).matrix_world.translation],max(.065,(ah.x-al.x)*.42),'steel_dark',pa)
  # Retain the physically open armor upper chest; light sits within the open
  # chest/waist gap and behind front armor rim instead of external diamonds.
  for j in range(3):
   soul=b.jewel('V6 revenant actual physically recessed cyan chest soul chain '+str(j),(0,cy-.025,hip+.065+j*.072),.041,.065,.024,'v6_soul_cyan',torso);magic.append(h.semantic(soul))
  b.box('V6 revenant actual recessed chest darkness',(0,lo.y+.144,hip+.16),(.34,.045,.27),'dark',.025,torso)
  for sign in(-1,1):rod('V6 revenant actual armored open chest side bearing',[(sign*wc*.33,cy,hip+.02),(sign*wc*.40,cy,hi.z-.04)],.065,'steel_dark',torso)
  for k in range(12):
   a=k*math.tau/12;p=Vector((wc*.39*math.sin(a),cy+.18*math.cos(a),hip+.02));tip=p+Vector((.032*math.sin(a),.02*math.cos(a),-.21-.025*(k%2)))
   leaf(b,'V6 revenant source contacting fitted segmented iron hip lamella',p,tip,wc*.11,'steel_dark',torso)
  for z in(hip+.038,hi.z-.012):annulus(b,'V6 revenant actual contacting continuous iron soul aperture collar',(0,cy,z),wc*.37,.036,'steel',torso,n=12,m=6)
  b.loft('V6 revenant actual recessed continuous cyan waist soul seam',[b.ring(0,cy,hip+.065,wc*.37,.21,12),b.ring(0,cy,hip+.092,wc*.37,.21,12)],'v6_soul_cyan',torso)
  recipes.append('Hollow metal helmet and open armor with physically recessed cyan soul, no flesh or exterior soul diamonds')
 if wave in(14,36,41):
  pa=weapon('L');g=grip(pa);rm(tuple(h.semantic(o)for o in b.objects if h.descendants(o,pa)),pa)
  c,w,hei=shield(pa,'V6 source '+('broken spiked'if wave==36 else'prism crystal'if wave==41 else'black mirror'),g,'v6_obsidian'if wave in(14,36)else'rune',wave==36,wave==41)
  for k in range(3):
   p=c+Vector(((k-1)*w*.65,.014,hei*.84));cone(b,'V6 shield three actual contacting upper '+('cyan crystals'if wave==41 else'silver spikes'),p,p+Vector((0,.025,.22 if k==1 else .16)),.047,'v6_soul_cyan'if wave==41 else'steel',pa,5)
  if wave==36:
   rm(('Crossed leather baldric','Leather ragged skirt'))
   for k in(-1,0,1):
    p=Vector((k*wc*.14,hi.y+.019,hip+.08));leaf(b,'V6 fallen king actual short torn source red loincloth',p,p+Vector((.012*k,.011,-.24+.035*abs(k))),wc*.23,'red',torso)
   for ob in obs(('Upper leg ','Lower leg ','Knee contacting articulated joint ','Grounded boot')):ob.data.materials.clear();ob.data.materials.append(b.M['steel_dark'])
   for k in range(3):cone(b,'V6 fallen king actual contacting shield gold crown emblem tooth',(c.x+(k-1)*.065,c.y+.026,c.z-.02),(c.x+(k-1)*.085,c.y+.026,c.z+.085),.045,'gold',pa,4)
   rod('V6 fallen king shield physical gold crown emblem contacting band',[(c.x-.12,c.y+.026,c.z-.026),(c.x+.12,c.y+.026,c.z-.026)],.024,'gold',pa)
   recipes.append('Source deeply split dark shield with physical gold crown emblem, actual steel thighs/greaves/boots and short torn red loincloth')
  if wave==41:
   material(b,'v6_prismatic_glass','526E70');material(b,'v6_prismatic_glass_dark','3C5C62')
   poly=[(-.72,1),(.72,1),(1,.72),(.82,-.35),(0,-1.35),(-.82,-.35),(-1,.72)]
   b.panel('V6 phalanx actual faceted tinted prism shield inset',[(c.x+x*w*.85,c.y+.012,c.z+z*hei*.86)for x,z in poly],.026,['v6_prismatic_glass','v6_prismatic_glass_dark'],pa,.034)
   points=[Vector((c.x+x*w,c.y+.001,c.z+z*hei))for x,z in poly];rod('V6 phalanx actual continuous fitted metal shield perimeter frame',points+[points[0]],.017,'steel_dark',pa,8)
   recipes.append('Actual dark faceted tinted prism inset inside physically contacting continuous metal shield frame')
  recipes.append('Source shield real shape, contacting upper spikes, real rear braces/grip/arm straps')
 if wave==44:
  rm(('V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer','V6 executioner one contacting long ivory forehead blade'))
  material(b,'v6_executioner_robe','39333F')
  rings=[b.ring(0,cy,.115,wc*.54,(hi.y-lo.y)*.54,14),b.ring(0,cy,hip+.07,wc*.46,(hi.y-lo.y)*.53,14),b.ring(0,cy,hi.z-.07,wc*.44,(hi.y-lo.y)*.51,14)]
  rings[0]=[(x,y,z+.065*(k%2))for k,(x,y,z)in enumerate(rings[0])]
  robe=b.loft('V6 ash executioner real ankle length folded dark purple robe',rings,'v6_executioner_robe',torso)
  cone(b,'V6 executioner source genuinely pointed ivory forehead blade',(fc.x,fh.y+.037,fh.z-.035),(fc.x,fh.y+.043,fh.z+.30),.065,'ivory',head,6)
  for sx in(-1,1):rod('V6 executioner fitted orange robe facing',[(sx*wc*.24,hi.y-.011,hi.z-.08),(sx*wc*.19,hi.y-.005,hip-.10)],.025,'v6_ochre',torso)
  for sx in(-1,1):rod('V6 ash executioner actual long contacting orange robe trim',[(sx*wc*.21,hi.y+.005,hi.z-.10),(sx*wc*.22,hi.y+.007,hip+.02),(sx*wc*.29,cy+(hi.y-lo.y)*.54,.145)],.018,'v6_ochre',torso)
  b.jewel('V6 executioner actual contacting gold throat focus',(0,hi.y-.008,hi.z-.075),.045,.085,.024,'gold',torso);recipes.append('Orange robe facing and contacting gold throat focus')
 if wave==49:
  for o in b.objects:
   if h.semantic(o).startswith('V6 Greatmaw')and 'obsidian'in h.semantic(o):o.data.materials.clear();o.data.materials.append(b.M['v6_obsidian'])
  recipes.append('Naked stone continuous body, large jaw/tusks, true carved belly maw and fitted irregular obsidian crown/forearm armor')

 # Whole held source-specific equipment. Remove the previous entire physical
 # subtree before constructing the replacement around its real current palm.
 pa=weapon('R');g=grip(pa)if pa else None
 if pa and wave in(1,6,10,12,13,17,19,20,22,23,26,31,32,43,44,47,50):
  held=[o for o in b.objects if h.descendants(o,pa)];gone(b,held)
  if wave in(1,19):
   top=g+Vector((0,0,.21));shaft(pa,'V6 source cleaver',g,top,.12);points=[(-.06,-.025),(.20,-.10),(.25,.27),(.11,.34),(.03,.28),(-.05,.34)]
   b.panel('V6 source jagged rusty forged cleaver whole blade',[(top.x+x,top.y,top.z+z)for x,z in points],.042,'v6_rust_steel',pa,.032)
   if wave==19:rod('V6 wolf rider actual contacting red cleaver cutting edge',[(top.x+.20,top.y+.003,top.z-.10),(top.x+.25,top.y+.003,top.z+.27)],.019,'red',pa)
   recipes.append('Compact jagged rusty source cleaver physically held through connected shaft')
  elif wave==6:
   # Source club is a large round, irregular mossy boulder held low, with
   # its wooden handle continuously connecting the actual gripping palm.
   # Its lowest stone point rests beside the bare troll foot, not above it.
   c=Vector((g.x+.025,g.y+.090,.243));material(b,'v6_moss_club_stone','737B69')
   stone=ell(b,'V6 mossback source round irregular grounded boulder club',c,(.235,.220,.242),'v6_moss_club_stone',pa,11,5)
   inv=stone.matrix_world.inverted()
   for i,v in enumerate(stone.data.vertices):
    p=stone.matrix_world@v.co;q=p-c
    f=1+.060*math.sin(i*2.731)+.032*math.cos(i*1.427)
    p=c+Vector((q.x*f,q.y*f,q.z))
    v.co=inv@p
   stone.data.update()
   rod('V6 mossback whole actual wooden palm to boulder club handle',[g+Vector((0,0,.065)),g,g.lerp(c,.58),c+Vector((0,0,.065))],.047,'wood',pa,10)
   # Small surface growths intersect the genuine rock surface. The solid
   # rock remains visibly round; moss is a fitted coating rather than spikes.
   for k in range(7):
    a=k*math.tau/7;p0=c+Vector((.20*math.sin(a),.18*math.cos(a),.115+.018*(k%2)))
    p,n,_,_=tree([stone]).find_nearest(p0);ell(b,'V6 mossback club actual contacting round moss growth',p-n*.015,(.063,.051,.041),'moss',pa,7,3)
   h.endpoint(b,pa,'attack_muzzle',c+Vector((0,.22,0)));recipes.append('Large round irregular grounded stone club with fitted moss and continuous actual palm-held wooden handle; bare chest without leather cross straps')
  elif wave in(12,17,22):
   top=g+Vector((0,0,.32));shaft(pa,'V6 source heavy club or mallet',g,top,.28)
   if wave==17:
    rm('V6 source heavy club or mallet',pa)
    c=g+Vector((.025,.18,.33));rod('V6 totem source actual irregular knotted branch club',[g-Vector((0,0,.12)),g,c-Vector((.02,.04,.11)),c+Vector((.025,.02,.16))],.073,'wood',pa,8)
    ell(b,'V6 totem source actual long uneven gnarled wood club mass',c,(.16,.19,.27),'wood',pa,7,4)
    for j in range(7):a=j*math.tau/7;p=c+Vector((.10*math.sin(a),.13*math.cos(a),-.13+.041*j));ell(b,'V6 totem club contacting natural wood knot',p,(.088,.082,.105),'wood',pa,6+j%2,3)
   elif wave==12:
    ell(b,'V6 bell striker source rough round contacting bone mallet head',top,(.115,.112,.105),'ivory',pa,7,3)
   elif wave==22:
    box=b.box('V6 iron ram actual large riveted cuboid metal hammer head',top,(.40,.27,.31),'v6_worn_iron',.022,pa)
    for xx in(top.x-.13,top.x+.13):
     for zz in(top.z-.09,top.z+.09):
      q,n,_,_=tree([box]).find_nearest(Vector((xx,top.y+.30,zz)));ell(b,'V6 iron ram actual seated cuboid hammer rivet',q-n*.004,(.019,.014,.019),'steel_dark',pa,8,3)
   else:
    b.loft('V6 source uneven faceted '+('stone maul'if wave==6 else'iron hammer'if wave==22 else'bone mallet'),[b.ring(top.x-.16,top.y,top.z-.09,.17,.13,7),b.ring(top.x,top.y,top.z+.12,.23,.16,7)],'steel_dark'if wave==22 else'ivory'if wave==12 else'v6_worn_iron',pa)
   recipes.append('Actual irregular held source club/stone maul/compact hammer')
  elif wave==10:
   top=g+Vector((0,0,.43));shaft(pa,'V6 gatebreaker skull mace',g,top,.28);skull('V6 gatebreaker actual carved iron skull mace',top,.40,pa,'v6_worn_iron')
   for sign in(-1,1):rod('V6 gatebreaker actual curved skull mace horn',[(top.x+sign*.16,top.y-.02,top.z+.07),(top.x+sign*.25,top.y-.04,top.z+.24),(top.x+sign*.20,top.y+.01,top.z+.31)],.047,'ivory',pa)
   recipes.append('Held iron skull mace with genuine carved eye/nose cavities and curved horns')
  elif wave==44:
   top=g+Vector((0,0,.73));shaft(pa,'V6 ash executioner source long poleaxe',g,top,.50,'wood');r=.27;pts=[]
   for j in range(10):a=-1.23+2.46*j/9;pts.append(top+Vector((r*1.35*math.cos(a),0,r*math.sin(a))))
   for j in range(10):a=1.23-2.46*j/9;pts.append(top+Vector((r*.49*math.cos(a)-.055,0,r*.93*math.sin(a))))
   b.panel('V6 ash executioner actual broad curved faceted poleaxe blade',list(map(tuple,pts)),.045,'steel',pa,.024)
   rod('V6 ash executioner actual continuous poleaxe metal socket',[top-Vector((0,0,.14)),top+Vector((0,0,.14))],.064,'steel_dark',pa)
   cone(b,'V6 ash executioner actual separate contacting pointed upper halberd pike',top+Vector((0,0,.065)),top+Vector((0,0,.36)),.063,'steel',pa,6)
   recipes.append('Whole long wood-held poleaxe with actual broad curved steel blade, connected metal socket and genuinely pointed separate upper pike')
  elif wave in(13,47):axe(pa,g,'V6 source '+('red huntress'if wave==13 else'dark executioner'),.20,'red'if wave==13 else'steel_dark');recipes.append('Actual forged source crescent axe, attached central socket and continuous gripped shaft')
  elif wave==20:
   top=g+Vector((0,0,.92));shaft(pa,'V6 Patriarch source skull staff',g,top,.55)
   for j in range(6):skull('V6 Patriarch actual attached staff ivory skull',top-Vector((0,0,j*.143)),.158,pa)
   recipes.append('Whole held physical continuous skull staff with stacked carved ivory skulls')
  elif wave==23:
   top=g+Vector((0,0,.67));shaft(pa,'V6 source soul warlock bone fork staff',g,top,.46,'wood')
   for sign in(-1,1):rod('V6 source soul fork contacting branch',[(top.x,top.y,top.z-.20),(top.x+sign*.12,top.y,top.z-.03),(top.x+sign*.13,top.y,top.z+.12)],.035,'wood',pa)
   gem=b.jewel('V6 source held staff genuinely suspended turquoise soul',top,.115,.18,.07,'v6_soul_cyan',pa);magic.append(h.semantic(gem));skull('V6 source held staff genuine small ivory face mask',top+Vector((0,.08,0)),.16,pa)
   rm(('Separate floating ivory soul face mask','Floating mask square eye'))
   hood_top=bound(obs('V6 source fitted domed cloth hood',head))[1].z
   for k in range(3):
    a=k*math.tau/3;p=Vector((math.sin(a)*.49,cy+.08 if k==0 else-.10,hood_top+.20 if k==0 else hood_top-.09));gem=b.jewel('V6 source genuinely orbiting turquoise soul',p,.10,.16,.061,'v6_soul_cyan',b.root);magic.append(h.semantic(gem));skull('V6 source genuinely orbiting ivory soul mask',p+Vector((0,.07,0)),.15,b.root)
   recipes.append('Exactly four turquoise source souls with actual carved ivory masks; one held fork and three intentional orbits')
  elif wave==26:
   top=g+Vector((0,0,.34));shaft(pa,'V6 runebinder source spiked mace',g,top,.25);ell(b,'V6 runebinder actual asymmetric spiked iron ball',top,(.18,.17,.20),'v6_obsidian',pa,8,4)
   for k in range(7):a=k*math.tau/7;p=top+Vector((math.sin(a)*.14,.01,math.cos(a)*.17));cone(b,'V6 runebinder contacting varied mace spike',p,p+Vector((math.sin(a)*(.11+.018*(k%2)),.02,math.cos(a)*(.14+.02*(k%3)))),.052,'steel_dark',pa,5)
   recipes.append('Asymmetric spiked source iron ball mace rigidly held')
  elif wave==31:
   top=g+Vector((0,0,.77));shaft(pa,'V6 inquisitor source gold sun staff',g,top,.53,'gold');annulus(b,'V6 inquisitor genuine hollow contacting sun ring',top,.16,.033,'gold',pa,True,n=14,m=6)
   rod('V6 inquisitor source physical ring cross arms',[top+Vector((-.24,0,0)),top+Vector((.24,0,0))],.022,'gold',pa);b.jewel('V6 inquisitor contacting upper sun gem',top+Vector((0,0,.23)),.066,.12,.039,'gold',pa)
   recipes.append('Physical hollow gold sun ring staff with attached cross arms and top gem')
  elif wave==32:
   c=g+Vector((.10,0,.53));roof=cage('V6 soul drinker actual staff hanging lantern cage',c,.105,.23,pa);top=roof+Vector((-.10,0,.15));shaft(pa,'V6 soul drinker actual forked bone lantern staff',g,top,.48,'wood')
   for sign in(-1,1):rod('V6 soul drinker actual contacting curved ivory fork prong',[top-Vector((0,0,.025)),top+Vector((sign*.083,0,.055)),top+Vector((sign*.065,0,.145))],.039,'ivory',pa)
   rod('V6 soul drinker staff actual bent bone hanger',[top,top+Vector((.13,0,-.01)),roof],.024,'ivory',pa)
   recipes.append('Whole held bone fork with truly hanging turquoise caged lantern')
  elif wave==43:
   top=g+Vector((0,0,.37));shaft(pa,'V6 soul ogre source heavy metal mallet',g,top,.25);box=b.box('V6 soul ogre actual cuboid studded iron mallet head',top,(.37,.29,.39),'steel_dark',.025,pa)
   for k in range(8):
    xx=top.x+(-.115 if k%2 else .115);zz=top.z+(-.125 if k<4 else .125);yy=top.y+(-.24 if k%4<2 else .24);q,n,_,_=tree([box]).find_nearest(Vector((xx,yy,zz)));cone(b,'V6 soul ogre actual physically seated cuboid mallet stud',q-n*.004,q+n*.040,.027,'steel',pa,5)
   recipes.append('Whole actual cuboid studded iron mallet on continuous palm-held wooden handle')
  elif wave==50:
   h.held_blade(b,pa,g,'sword',1.1,False,'v6_obsidian');swords=obs('V6 source curved forged sword blade',pa);sl,sh=bound(swords);p=(sl+sh)/2
   for ob in obs('V6 source physical curved blade guard',pa):ob.data.materials.clear();ob.data.materials.append(b.M['gold'])
   rod('V6 Bernhard actual contacting amber sword rune channel',[(p.x-.015,sh.y+.009,sl.z+.06),(p.x+.10,sh.y+.009,sh.z-.04)],.011,'v6_ochre',pa)
   for j in range(3):b.jewel('V6 Bernhard contacting amber sword rune diamond',(p.x+.018*j,sh.y+.009,sl.z+.16+j*.15),.024,.041,.013,'v6_ochre',pa)
   for j in range(5):
    p0=Vector((p.x+.02,sh.y+.06,sl.z+.08+j*(sh.z-sl.z-.16)/4));pp,n,_,_=tree(swords).find_nearest(p0)
    b.jewel('V6 Bernhard actual source orange contacting sword flame rune',pp-n*.007,.038,.079,.022,'v6_ochre',pa)
   recipes.append('Whole source dark forged sword with actual attached orange flame/rune strip and golden physical crossguard; charcoal hood/robe and dark iron armor')
 if wave==10:
  pa=weapon('L');g=grip(pa);gone(b,[o for o in b.objects if h.descendants(o,pa)]);c,w,H=shield(pa,'V6 gatebreaker weathered wooden door',g,'wood')
  for j in range(5):b.box('V6 gatebreaker individual contacting worn wood door slat',(c.x+(j-2)*.113,c.y+.024,c.z),(.116,.059,H*1.95),'wood',.012,pa)
  for z in(c.z-.21,c.z+.21):rod('V6 gatebreaker continuous front iron cross brace',[(c.x-.27,c.y+.072,z),(c.x+.27,c.y+.072,z)],.029,'v6_worn_iron',pa)
  recipes.append('Weathered broad door shield, actual connected slats/braces/nails and palm straps')
 if wave==43:
  rm(('Soul cage','Soul gem actual','Suspended actual turquoise'))
  for sign in(-1,1):
   c=Vector((sign*wc*.56,lo.y-.045,hi.z+.02));roof=cage('V6 soul ogre source contacting shoulder lantern cage',c,.15,.31,torso)
   rod('V6 soul ogre actual shoulder lantern metal mount',[(sign*wc*.34,lo.y+.06,hi.z-.13),c-Vector((0,0,.15))],.043,'steel_dark',torso)
  recipes.append('Two actual stepped bronze shoulder cages physically mounted to source armor')
 return {'uniqueSourceRecipes':recipes,'intentionalMagicParts':sorted(set(magic)),'physicalContacts':contacts}
