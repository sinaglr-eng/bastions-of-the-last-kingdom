"""Source-specific finishing geometry for thirteen V6 enemies.

Pure scene helper: no native, concept, manifest, render or export IO. Original
six-view sheets were actually opened before these individual recipes. All
coordinates are native metres, +Y forward and Z up. Physical review is separate.
"""
import math
from mathutils import Vector
from geometric_roster_builder import ell, cone, annulus, leaf
from geometric_champion_shapes_v5 import material, tree

SECONDARY_WAVES=(6,11,13,14,17,21,22,26,31,33,38,43,44)

def apply_source06_mushrooms_v6(b,h):
 """Place six real fungi around the canopy; no scene or export IO."""
 assert b.id=='host_06' and not b.root.get('enemyVisibleMushroomsSource06V6')
 torso=h.pivot(b,'torso_pivot')
 body=h.sem(b,'V6 source anatomical thorax')
 lo,hi=h.bound(body);c=(lo+hi)/2;w=hi.x-lo.x
 moss=h.sem(b,('V6 detail actual source organic moss back hump','V6 detail source irregular high canopy growth','V6 detail irregular overlapping moss canopy'))
 assert body and moss
 old=h.sem(b,('V6 detail irregular mushroom contacting stalk','V6 detail irregular source mushroom cap'))
 removed=[h.semantic(ob)for ob in old];h.gone(b,old)
 material(b,'v6_source06_fungus_cap','C7A46A',metal=0)
 material(b,'v6_source06_fungus_stem','BBA986',metal=0)
 bearing_tree=tree(moss);contacts=[];parts=[]
 def register(ob,bearing):
  ob['semanticPart']=h.semantic(ob)+' / visible fungus '+str(len(contacts))
  contacts.append({'name':'actual source06 fungus '+h.semantic(ob),'leftParts':[h.semantic(ob)],'rightParts':sorted({h.semantic(o)for o in bearing}),'leftScopeJoint':torso.name,'rightScopeJoint':torso.name})
  parts.append(h.semantic(ob));return ob
 # The previous row of small mushrooms coincided with the rune stones. The
 # source spreads caps around their sides and rear, above the actual moss.
 for j,(xf,dy)in enumerate([(-.43,.11),(.43,.11),(-.43,-.15),(.43,-.15),(-.20,-.21),(.20,-.21)]):
  target=Vector((c.x+w*xf,lo.y+dy,hi.z+.60))
  p,n,_,distance=bearing_tree.find_nearest(target)
  assert p is not None
  top=p+Vector(((-.012 if xf<0 else .012),0,.105+.015*(j%3)))
  stem=register(h.bend(b,'V6 detail irregular mushroom contacting stalk',[p-Vector((0,0,.008)),p.lerp(top,.5),top],[.015,.014,.011],'v6_source06_fungus_stem',torso,8),moss)
  register(ell(b,'V6 detail irregular source mushroom cap',top,(.070+.005*(j%3),.061,.033),'v6_source06_fungus_cap',torso,8,3),[stem])
 b.root['enemyVisibleMushroomsSource06V6']=True
 return {'physicalContacts':contacts,'removedActualSemanticParts':removed,'newActualMeshParts':parts,'sourceWave':6,'originalReferencesModified':False}

def apply_source_long_mantles_v6(b,h):
 """Actual contacting root beard/bark mantle21 and folded trailing cloak33."""
 wave=int(b.id.split('_')[1]);assert wave in(21,33)
 assert not b.root.get('enemyLongSourceMantleV6')
 torso=h.pivot(b,'torso_pivot')
 body=h.sem(b,('V6 source anatomical thorax','V6 source anatomical pelvis'))
 lo,hi=h.bound(body);c=(lo+hi)/2;w=hi.x-lo.x
 hip=min(h.pivot(b,'upper_leg_'+side).matrix_world.translation.z for side in('L','R'))
 moss=h.sem(b,('V6 detail actual source organic moss back hump','V6 detail source irregular high canopy growth','V6 detail irregular overlapping moss canopy'))if wave==21 else[]
 mantle_bearings=body+moss
 surface=tree(mantle_bearings);body_surface=tree(body);contacts=[];parts=[]
 def register(ob,bearing):
  ob['semanticPart']=h.semantic(ob)+' / long mantle '+str(len(contacts))
  contacts.append({'name':'actual source long mantle '+h.semantic(ob),'leftParts':[h.semantic(ob)],'rightParts':sorted({h.semantic(o)for o in bearing}),'leftScopeJoint':torso.name,'rightScopeJoint':torso.name})
  parts.append(h.semantic(ob));return ob
 def bearing(x,z,sign):
  origin=Vector((x,hi.y+1 if sign>0 else lo.y-1,z))
  p,n,_,distance=surface.ray_cast(origin,Vector((0,-sign,0)),4)
  if p is None:p,n,_,distance=surface.find_nearest(origin)
  assert p is not None
  return p,n
 if wave==21:
  material(b,'v6_long_root_bark','624C36',metal=0)
  material(b,'v6_long_root_moss','66733D',metal=0)
  for sign,count in[(1,11),(-1,11)]:
   for j in range(count):
    xf=(j-(count-1)/2)/(count-1)*.83
    start,n=bearing(c.x+w*xf,hi.z+(.065 if sign<0 else-.035)-.018*(j%3),sign)
    endz=max(.12,hip-(.17 if sign>0 else .40)+.035*(j%3))
    path=[]
    for k in range(12):
     f=k/11;x=start.x*(1-f*.54)+c.x*f*.54+w*.022*math.sin(f*math.pi*2+j)
     z=start.z+(endz-start.z)*f
     p,_=bearing(x,max(lo.z+.008,z),sign)
     y=p.y+sign*(.023+.018*f)
     if sign<0:
      lower_origin=Vector((x,lo.y-1,max(lo.z+.008,hip+.025)))
      lower,_,_,_=body_surface.ray_cast(lower_origin,Vector((0,1,0)),4)
      if lower is None:lower,_,_,_=body_surface.find_nearest(lower_origin)
      # A canopy ray changes abruptly to the narrow lower torso. A continuous
      # drape from the real canopy bearing avoids a horizontal shelf of roots.
      y=(start.y-.012)*(1-f)+(lower.y-.065)*f-.026*math.sin(f*math.pi)
     path.append(Vector((x,y,z)))
    radii=[(.049+.012*math.sin(j*1.7))*(1-(k/11)*.72)+.006 for k in range(12)]
    root=register(h.bend(b,'V6 detail source long contacting root beard'if sign>0 else'V6 detail source long tapered rear bark mantle',path,radii,'v6_long_root_bark',torso,7),mantle_bearings)
    for k in(1+j%2,3+j%3,7+j%2):
     p,n,_,distance=tree([root]).find_nearest(path[k]+Vector((0,sign*.14,.02)))
     register(ell(b,'V6 detail source root mantle seated irregular moss',p+n*.012,(.061+.012*(j%3),.050,.074 if sign<0 else .058),'v6_long_root_moss',torso,5+j%3,3),[root])
 else:
  material(b,'v6_long_wraith_cloth','644878',metal=0)
  for j in range(9):
   xf=(j-4)/8*.83;start,n=bearing(c.x+w*xf,hi.z-.10-.02*(j%2),-1)
   endz=max(.10,hip-.47+.055*(j%3));xs=5;zs=8;verts=[]
   for inner in(0,1):
    for row in range(zs):
     f=row/(zs-1);z=start.z+(endz-start.z)*f
     cx=start.x*(1-f*.34)+c.x*f*.34+w*.035*math.sin(f*math.pi+j*.61)
     breadth=w*.145*(1-f*.65)
     for col in range(xs):
      u=(col-2)/2;x=cx+u*breadth
      p,_=bearing(x,max(lo.z+.006,z),-1)
      y=p.y-.004-.025*math.sin(f*math.pi)-.028*(1-u*u)+inner*.022
      zz=z+(.052*abs(u)if row==zs-1 else 0)
      verts.append((x,y,zz))
   N=xs*zs;faces=[]
   for row in range(zs-1):
    for col in range(xs-1):
     q=(row*xs+col,row*xs+col+1,(row+1)*xs+col+1,(row+1)*xs+col)
     faces.extend([q,tuple(reversed(tuple(index+N for index in q)))])
   edge=list(range(xs))+[row*xs+xs-1 for row in range(1,zs)]+list(range((zs-1)*xs+xs-2,(zs-1)*xs-1,-1))+[row*xs for row in range(zs-2,0,-1)]
   for a,z in zip(edge,edge[1:]+edge[:1]):faces.append((a,a+N,z+N,z))
   register(b.mesh('V6 detail source long folded ragged trailing purple cloak',verts,faces,'v6_long_wraith_cloth',torso),body)
 b.root['enemyLongSourceMantleV6']=True
 return {'physicalContacts':contacts,'newActualMeshParts':parts,'sourceWave':wave,'originalReferencesModified':False}

def apply_secondary_details_v6(b,entry,h):
 wave=int(entry['id'].split('_')[1])
 if wave not in SECONDARY_WAVES:return {'applied':False,'recipes':[],'physicalContacts':[]}
 assert not b.root.get('enemySecondaryDetailsV6'),(b.id,'requires an immutable incoming scene')
 sem=h.sem;gone=h.gone;bound=h.bound;pivot=h.pivot
 torso=pivot(b,'torso_pivot');head=pivot(b,'head_pivot')
 body=sem(b,('V6 source anatomical thorax','Tailored continuous bodice','Faceted species chest','Separated phantom armor upper chest plate'))
 lo,hi=bound(body);c=(lo+hi)/2;w=hi.x-lo.x;d=hi.y-lo.y
 hip=min(pivot(b,'upper_leg_'+s).matrix_world.translation.z for s in('L','R'))
 before=set(b.objects);recipes=[];contacts=[]
 for key,color,metallic in [('v6_detail_moss','657039',0),('v6_detail_moss_light','828743',0),('v6_detail_stone','7C7D76',0),('v6_detail_bark','6F5337',0),('v6_detail_horn','B28B57',0),('v6_detail_dark_iron','494847',.65),('v6_detail_silver','A8ACA9',.6),('v6_detail_wraith_belt','DADCD6',.12),('v6_detail_amber','CB8B43',.4),('v6_detail_purple','644878',0),('v6_detail_charcoal','42463F',0)]:material(b,key,color,metal=metallic)
 def rm(prefix,pa=None):gone(b,sem(b,prefix,pa))
 def near(nodes,target):
  point,normal,_,distance=tree(nodes).find_nearest(Vector(target))
  assert point is not None,('missing actual nearest surface',b.id)
  return point,normal
 def rod(name,pts,r,mat,pa,n=8):return h.bend(b,'V6 detail '+name,list(map(Vector,pts)),[r]*len(pts) if isinstance(r,(float,int)) else r,mat,pa,n)
 def register(ob,bearing):
  # One exact mesh identity per physical relation, even for repeated moss and
  # paired shoulder decorations. A passing sibling cannot hide a floating part.
  ob['semanticPart']=h.semantic(ob)+' / secondary '+str(len(contacts))
  rel={'name':'actual secondary detail '+h.semantic(ob),'leftParts':[h.semantic(ob)],'rightParts':sorted(set(h.semantic(o)for o in bearing))}
  if ob.parent:rel['leftScopeJoint']=ob.parent.name
  parents={o.parent.name for o in bearing if o.parent}
  if len(parents)==1:rel['rightScopeJoint']=next(iter(parents))
  contacts.append(rel)
  return ob
 def rivets(nodes,pa):
  if not nodes:return
  al,ah=bound(nodes);ac=(al+ah)/2
  for x,z in [(al.x+(ah.x-al.x)*.2,al.z+(ah.z-al.z)*.2),(ah.x-(ah.x-al.x)*.2,ah.z-(ah.z-al.z)*.2)]:
   p,n=near(nodes,(x,ah.y+.05,z));register(ell(b,'V6 detail source seated exposed armor rivet',p+n*.002,(.012,.012,.012),'v6_detail_silver',pa,7,3),nodes)
 def collar_layers(mat,levels=3,back_only=False):
  for level in range(levels):
   for k in range(14):
    a=(k+.12*(level%2))*math.tau/14
    if back_only and math.cos(a)>.30:continue
    z=hi.z-.032-level*(hi.z-hip)*.19
    p,n=near(body,(c.x+w*.55*math.sin(a),c.y+d*.58*math.cos(a),z))
    tip=p+Vector(((.085 if wave==33 else .035)*math.sin(a),(.070 if wave==33 else .038)*math.cos(a),-(.22 if wave==33 else .12)-.045*(k%3==0)))
    register(leaf(b,'V6 detail source overlapping pointed mantle',p,tip,w*(.09 if wave==38 else .235 if wave==33 else .11),mat,torso),body)
 def skirt_layers(mat,levels=2):
  for level in range(levels):
   for k in range(12):
    a=(k+.35*(level%2))*math.tau/12
    p,n=near(body,(c.x+w*.48*math.sin(a),c.y+d*.53*math.cos(a),hip+.075-level*.065))
    length=.18+.055*(k%3==0)+.045*level
    tip=p+Vector((.032*math.sin(a),.037*math.cos(a),-length))
    register(leaf(b,'V6 detail source contacting torn pointed skirt',p,tip,w*.10,mat,torso),body)
 def chest_strap(sign,mat='leather',back=False):
  nodes=body;yy=lo.y-.025 if back else hi.y+.025
  p,_=near(nodes,(c.x+sign*w*.30,yy,hi.z-.065));q,_=near(nodes,(c.x-sign*w*.23,yy,hip+.095))
  mid,_=near(nodes,p.lerp(q,.5)+Vector((0,-.035 if back else .035,0)))
  return register(rod('fitted continuous source diagonal strap',[p,mid,q],[(.024,.016)]*3,mat,torso),nodes)

 if wave in(31,33):
  # The retained generic phantom has a separate upper chest and waist. The
  # source wraith's icy torso bears through its belt into the two bare legs.
  # Reconstruct that actual volume before fitting the pointed skirt to it.
  pelvis=sem(b,'V6 source anatomical pelvis')
  if not pelvis:
   top=lo.z+.024;bottom=hip-.030
   icy=b.loft('V6 source anatomical pelvis',[b.ring(c.x,c.y,bottom,w*.35,d*.39,12),b.ring(c.x,c.y,hip+.08,w*.43,d*.47,12),b.ring(c.x,c.y,top-.030,w*.42,d*.45,12),b.ring(c.x,c.y,top,w*.45,d*.46,12)],'skin',torso)
   register(icy,body);body=body+[icy];lo,hi=bound(body);c=(lo+hi)/2;w=hi.x-lo.x;d=hi.y-lo.y
   recipes.append('Actual icy waist/pelvis volume connects the upper torso and bare leg bearings beneath the source silver belt')

 if wave in(6,21):
  rm(('V6 source broad irregular moss-covered back mass','V6 source engraved moss runestone groove','V6 source moss cluster','V6 source irregular moss','Moss shoulder cluster','Runestone back','Mushroom hexagonal cap','Mushroom stalk'))
  moss=[]
  hump=register(ell(b,'V6 detail actual source organic moss back hump',(c.x,lo.y-.030,hi.z-.025),(w*.55,.205,.255 if wave==21 else .195),'v6_detail_moss',torso,11,5),body);moss.append(hump)
  # Small closed, irregular faceted growths sit on the actual hump surface.
  # A torso-only scatter left the distinctive high source canopy invisible.
  for k in range(36):
   a=k*2.399963229728653;f=(k*.7548776662466927+.17)%1
   target=(c.x+w*.49*math.sin(a),lo.y-.05+.20*math.cos(a),hi.z-.17+f*.34)
   p,n=near([hump],target)
   register(ell(b,'V6 detail source irregular high canopy growth',p+n*.014,(.045+.030*((k*.4142135623730951)%1),.043+.025*((k*.7320508075688772)%1),.040+.050*f),'v6_detail_moss_light'if k%5==0 else'v6_detail_moss',torso,5+(k%3),3),[hump])
  for k in range(29):
   a=k*2.399963229728653+.61;f=(k*.5698402909980532+.31)%1
   p,n=near([hump],(c.x+w*.49*math.sin(a),lo.y-.065+.215*math.cos(a),hi.z-.24+f*.43))
   ob=register(ell(b,'V6 detail irregular overlapping moss canopy',p+n*.018,(w*(.105+.095*((k*.4142135623730951)%1)),.058+.054*f,.060+.069*((k*.7320508075688772)%1)),'v6_detail_moss'if k%3 else'v6_detail_moss_light',torso,5+(k%4),3),[hump]);moss.append(ob)
  for side in('L','R'):
   ap=pivot(b,'upper_arm_'+side);skin=sem(b,'V6 source anatomical upper arm '+side,ap);al,ah=bound(skin)
   for k in range(4):
    p,n=near(skin,((al.x+ah.x)/2+(-.07 if side=='L'else .07),al.y-.08,ah.z-.055-k*.046))
    register(ell(b,'V6 detail source shoulder moss tuft',p+n*.025,(.10,.09,.065),'v6_detail_moss',ap,7,3),skin)
  if wave==6:
   for j,x in enumerate([c.x,c.x-w*.36,c.x+w*.37]):
    base,_=near(moss,(x,lo.y-.025,hi.z+.50));height=.30 if j==0 else .15
    stone=register(b.loft('V6 detail large faceted standing rune stone',[b.ring(base.x,base.y,base.z-.015,.10 if j==0 else .08,.075,7),b.ring(base.x+.015,base.y-.012,base.z+height*.65,.093 if j==0 else .07,.070,7),b.ring(base.x-.014,base.y,base.z+height,.024,.026,7)],'v6_detail_stone',torso),moss)
    for sign in(-1,1):
     p,n=near([stone],(base.x+sign*.022,base.y+.10,base.z+height*.45));q=p+Vector((sign*.025,0,.026))
     register(rod('actual seated carved stone rune',[p,p+Vector((0,0,.045)),q],.006,'dark',torso,6),[stone])
   contacts.extend(apply_source06_mushrooms_v6(b,h)['physicalContacts'])
   recipes.append('Large three-dimensional moss canopy, three differently sized real rune stones and six contacting irregular mushrooms')
  else:
   rm(('Woodland','Rotroot','Tree troll','Troll actual tree','V6 Rotroot'))
   # Native arm volumes remain articulated and continuous, but the source
   # species has bark-covered arms rather than bare green arms with thin straps.
   for ob in sem(b,('V6 source anatomical upper arm ','V6 source anatomical forearm ','V6 source anatomical palm ')):
    ob.data.materials.clear();ob.data.materials.append(b.M['v6_detail_bark'])

   for k in range(9):
    x=c.x+(k-4)*w*.075;p,n=near(body,(x,lo.y-.055,hi.z-.26-.03*(k%2)));end=p+Vector(((k-4)*w*.065,-.045,.34+.045*((k+1)%3)))
    trunk=register(rod('Rotroot curved contacting crown trunk',[p,p.lerp(end,.52)+Vector((.030*math.sin(k),-.030,0)),end],[.084,.065,.036],'v6_detail_bark',torso),body)
    fork=end-Vector((0,0,.14));tip=fork+Vector(((-1 if k%2 else 1)*.11,-.014,.16));branch=register(rod('Rotroot genuine curved fork',[fork,fork.lerp(tip,.45)+Vector((0,0,.035)),tip],[.034,.028,.010],'v6_detail_bark',torso),[trunk])
    register(leaf(b,'V6 detail Rotroot attached crown leaf',tip-Vector((0,0,.01)),tip+Vector((.06 if k%2 else-.06,0,.06)),.037,'moss',torso),[branch])
   for side in('L','R'):
    for part in('upper_arm','forearm','hand'):
     pa=pivot(b,part+'_'+side);skin=sem(b,'V6 source anatomical '+('palm'if part=='hand'else part.replace('_',' '))+' '+side,pa)
     if not skin:continue
     sl,sh=bound(skin)
     for j in range(5):
      target=((sl.x+sh.x)/2+(j-2)*.031,sh.y+.04,(sl.z+sh.z)/2);p,n=near(skin,target)
      end=p+Vector(((-1 if side=='L'else 1)*.015,-.015,-(sh.z-sl.z)*.32))
      register(rod('Rotroot fitted gnarled arm and fist bark',[p,p.lerp(end,.5)+n*.018,end],[.046,.05,.024],'v6_detail_bark',pa),skin)
      if j%2==0:register(ell(b,'V6 detail Rotroot contacting fist moss',p+n*.020,(.040,.034,.033),'moss',pa,6,3),skin)
   collar_layers('v6_detail_bark',2,True);recipes.append('Curved forked tree crown with attached leaves, fitted bark volume and massive gnarled wooden forearms and fists')

 if wave==11:
  chest_strap(-1);chest_strap(1)
  for side in('L','R'):
   pa=pivot(b,'forearm_'+side);skin=sem(b,'V6 source anatomical forearm '+side,pa);sl,sh=bound(skin)
   p,_=near(skin,((sl.x+sh.x)/2,sh.y+.04,(sl.z+sh.z)/2))
   plate=register(b.box('V6 detail hookbearer fitted source leather wrist plate',p,(sh.x-sl.x,.045,(sh.z-sl.z)*.70),'leather',.025,pa),skin);rivets([plate],pa)
  previous=body
  chain_anchor,chain_normal=near(body,(c.x,hi.y+.035,hip+.095))
  for j in range(5):
   p=chain_anchor+chain_normal*.008+Vector((-.010 if j%2 else .010,0,-.026-j*.063))
   link=annulus(b,'V6 detail hookbearer actual connected hanging chain link '+str(j),p,.044,.012,'v6_detail_silver',torso,True,n=10,m=5);register(link,previous);previous=[link]
  recipes.append('Large asymmetric skull/helmet shoulders retained, with fitted wrist armor, crossed carrying harness and five physically linked belt chain rings')

 if wave==13:
  faces=sem(b,'Observed face',head);fl,fh=bound(faces);fc=(fl+fh)/2;hw=fh.x-fl.x
  for sign in(-1,1):
   braid=sem(b,'V6 source intertwined segmented red braid',head);bb=[o for o in braid if h.center([o]).x*sign>0]
   if bb:
    bl,bh=bound(bb);p=Vector(((bl.x+bh.x)/2,(bl.y+bh.y)/2,bl.z+(bh.z-bl.z)*.22))
    register(annulus(b,'V6 detail huntress contacting silver braid clasp',p,hw*.080,.012,'v6_detail_silver',head,n=10,m=5),bb)
  for sign in(-1,1):
   p,n=near(body,(c.x+sign*w*.21,hi.y+.03,hi.z-.16));plate=register(ell(b,'V6 detail huntress fitted leather breast armor',p+n*.011,(w*.24,.050,(hi.z-hip)*.19),'leather',torso,8,3),body);rivets([plate],torso)
  chest_strap(-1,back=True);chest_strap(1,back=True)
  skirt_layers('leather',1)
  p,n=near(body,(c.x-w*.28,hi.y+.04,hip+.06));ring=register(annulus(b,'V6 detail huntress actual waist iron ring',p+Vector((0,.021,-.045)),.047,.015,'v6_detail_silver',torso,True,n=12,m=5),body)
  rod('huntress contacting ring belt hanger',[p,p+Vector((0,.021,-.024))],.018,'leather',torso)
  pa=pivot(b,'weapon_R');blade=sem(b,'V6 source red huntress actual continuous crescent forged blade',pa)
  if blade:
   al,ah=bound(blade);ac=(al+ah)/2;p,n=near(blade,(ac.x,ah.y+.02,ac.z))
   register(leaf(b,'V6 detail huntress dark inset within real red axe blade',p-Vector((0,0,.095)),p+Vector((.006,0,.11)),.052,'v6_detail_dark_iron',pa),blade)
  recipes.append('Segmented red braids with silver clasps, fitted leather chest/skirt layers, real waist ring and dark inset inside forged red axe')

 if wave==14:
  pa=pivot(b,'weapon_L');shield=sem(b,'V6 source black mirror actual shield body',pa)
  if shield:
   sl,sh=bound(shield);sc=(sl+sh)/2;p,n=near(shield,(sc.x,sh.y+.04,sc.z))
   register(b.jewel('V6 detail mirror shield contacting faceted silver inset',p,.064,.130,.025,'v6_detail_silver',pa),shield)
   # The worn iron frame follows the actual exported shield outline.
   yy=sh.y-.025
   outline=[Vector((sl.x+.035,yy,sh.z-.09)),Vector((sh.x-.035,yy,sh.z-.09)),Vector((sh.x-.018,yy,sl.z+.14)),Vector((sc.x,yy,sl.z+.015)),Vector((sl.x+.018,yy,sl.z+.14))]
   register(rod('mirror shield continuous contacting iron perimeter',outline+[outline[0]],.029,'v6_detail_silver',pa),shield)
   for rivet in sem(b,'V6 source black mirror attached exposed rim rivet',pa):
    rc=h.center([rivet]);point,normal=near(shield,rc);delta=point+normal*.004-rc;inv=rivet.matrix_world.inverted()
    for vertex in rivet.data.vertices:vertex.co=inv@(rivet.matrix_world@vertex.co+delta)
    rivet.data.update()
  chest_strap(-1,back=True);chest_strap(1,back=True);skirt_layers('v6_detail_dark_iron',1)
  recipes.append('Actual shield-top spikes and rear grips retained; raised faceted mirror inset, continuous iron frame, crossed back straps and segmented metal tabard added')

 if wave==17:
  skulls=sem(b,'V6 totem actual shaped strapped rear skull actual carved cranial shell')
  for ob in skulls:
   sl,sh=bound([ob]);sc=(sl+sh)/2
   for sign in(-1,1):
    p,n=near([ob],(sc.x+sign*.07,sl.y-.015,sc.z-.04));rod('totem real crossed rear skull rope',[p,p+Vector((-sign*.10,-.02,.11))],.012,'leather',torso)
  chest_strap(-1,back=True);chest_strap(1,back=True);skirt_layers('leather',1)
  # The source-specific equipment helper already authors the long upward
  # gnarled club. Keep that entire actual held assembly and its endpoint.
  recipes.append('Three actual carved skulls remain on fitted back frame; source crossed ropes/harness and ragged skirt, retaining the complete source-specific long upward gnarled club')

 if wave==22:
  horns=sem(b,'V6 source curved contacting helmet horn',head);gone(b,horns)
  caps=sem(b,'V6 source fitted rounded metal cap',head);fl,fh=bound(sem(b,'Observed face',head));fc=(fl+fh)/2;hw=fh.x-fl.x
  for sign in(-1,1):
   root,_=near(caps,(fc.x+sign*hw*.50,fc.y,fh.z+.03));points=[root];radii=[hw*.15]
   for k in range(9):
    a=math.radians(122)+k*math.radians(253)/8
    points.append(Vector((fc.x+sign*hw*(.73+.31*math.cos(a)),fc.y-.015,fh.z+hw*(.24+.31*math.sin(a)))))
    radii.append(hw*(.16-.014*k))
   register(rod('Iron Ram actual curved heavy spiral horn',points,radii,'v6_detail_horn',head,10),caps)
  for sign in(-1,1):chest_strap(sign);chest_strap(sign,back=True)
  skirt_layers('v6_detail_dark_iron',1);recipes.append('Heavy curved spiral ram horns physically rooted on fitted cap, round plate/strap layers and contacting segmented metal skirt')

 if wave==26:
  rm('V6 runebinder actual engraved orange collar rune')
  stones=sem(b,'V6 runebinder contacting irregular obsidian rune collar stone')
  for j,stone in enumerate(stones):
   stone['semanticPart']=h.semantic(stone)+' / exact rune rock '+str(j)
   sl,sh=bound([stone]);sc=(sl+sh)/2;radial=Vector((sc.x-c.x,sc.y-c.y,0)).normalized();p,n=near([stone],sc+radial*.2)
   u=Vector((radial.y,-radial.x,0));v=Vector((0,0,1));r=.026+.003*(j%3)
   points=[p+u*(-r),p+v*(r*1.35),p+u*r,p-v*(r*1.25),p-u*r]
   points=[near([stone],q)[0]+near([stone],q)[1]*.001 for q in points]
   register(rod('varied orange rune physically seated in collar rock',points,.006,'v6_detail_amber',torso,6),[stone])
  skirt_layers('leather',1);recipes.append('Nine irregular dark collar stones retain their actual attachment, each with its own closed orange glyph; ragged leather layers and asymmetric spiked mace')

 if wave in(31,33,38,44):
  if wave in(33,38):
   rm(('V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer','V6 inquisitor contacting torn parchment rune seal'))
   if wave==33:
    for ob in body+sem(b,('Upper arm ','Forearm ','Muscular upper arm ','Muscular heavy forearm ','Connected shoulder ','Heavy connected deltoid ','Elbow contacting articulated joint ')):
     ob.data.materials.clear();ob.data.materials.append(b.M['skin'])
   collar_layers('v6_detail_purple'if wave==33 else'v6_detail_charcoal',3)
   skirt_layers('v6_detail_purple'if wave==33 else'v6_detail_charcoal',2)
   if wave==33:
    for side in('L','R'):
     ap=pivot(b,'upper_arm_'+side);arm=sem(b,('Upper arm '+side,'Connected shoulder '+side),ap);al,ah=bound(arm)
     for k in range(3):
      a=(k-1)*math.pi*.52;p,n=near(arm,((al.x+ah.x)/2,((al.y+ah.y)/2)+.18*math.sin(a),ah.z+.07))
      tip=p+Vector(((-1 if side=='L'else 1)*.055,.050*math.sin(a),-.16-.035*(k%2)))
      register(leaf(b,'V6 detail wraith actual torn shoulder cape',p,tip,.103,'v6_detail_purple',ap),arm)
    rm('V6 spectral swordsman actual contacting silver waist belt')
    register(b.loft('V6 detail wraith source exposed silver waist girdle',[b.ring(c.x,c.y,hip+.075,w*.51,d*.61,14),b.ring(c.x,c.y,hip+.135,w*.51,d*.61,14)],'v6_detail_wraith_belt',torso),body)
    mantle=sem(b,'V6 detail source overlapping pointed mantle',torso)
    p,n=near(mantle,(c.x,hi.y+.35,hi.z-.13))
    frame=register(b.jewel('V6 detail wraith fitted silver-framed purple chest focus',p+n*.007,.054,.085,.026,'steel',torso),mantle)
    register(b.jewel('V6 detail wraith contacting inner purple chest crystal',p+n*.020,.037,.062,.020,'purple',torso),[frame])
   else:
    for sign in(-1,1):chest_strap(sign)
    for sign in(-1,1):
     p,n=near(body,(c.x+sign*w*.34,hi.y+.02,hip+.06));register(b.box('V6 detail knifeman fitted leather side pouch',p+n*.022,(.083,.054,.114),'leather',.013,torso),body)
   recipes.append('Fitted three-tier pointed shoulder/back mantle, overlapping torn skirt and source-specific exposed body/details')
  if wave==31:
   rm(('V6 inquisitor contacting torn parchment rune seal','V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer','Inquisitor long golden robe facing','Distinct order protective seal','Carved ivory skull','Skull square socket','Skull lower jaw','Inquisitor actual parchment shoulder seal','Belt buckle'))
   material(b,'v6_inquisitor_robe','3C3B41');material(b,'v6_inquisitor_shield','34323D')
   # The source is a full gold-trimmed robe. Its real closed cloth volume
   # reaches the ankles; short diamond layers did not reproduce that silhouette.
   robe=register(b.loft('V6 detail inquisitor continuous folded source robe',[
    b.ring(c.x,c.y,.105,w*.61,d*.69,14),b.ring(c.x,c.y,hip-.14,w*.54,d*.61,14),
    b.ring(c.x,c.y,hip+.06,w*.47,d*.53,14),b.ring(c.x,c.y,hi.z-.10,w*.48,d*.53,14)
   ],'v6_inquisitor_robe',torso),body)
   for sign in(-1,1):
    nodes=[robe];path=[]
    for z in(hi.z-.12,hip+.07,.16):
     p,n=near(nodes,(c.x+sign*w*(.24 if z>.3 else .39),hi.y+.20,z));path.append(p+n*.004)
    register(rod('inquisitor real gold front robe facing',path,.018,'gold',torso),nodes)
    path=[]
    for z in(hi.z-.12,hip+.07,.16):
     p,n=near(nodes,(c.x+sign*w*(.24 if z>.3 else .39),lo.y-.20,z));path.append(p+n*.004)
    register(rod('inquisitor real gold rear robe facing',path,.015,'gold',torso),nodes)
   for back in(False,True):
    for k in range(3):
     p,n=near([robe],(c.x,lo.y-.2 if back else hi.y+.2,hi.z-.22-k*.17))
     frame=register(b.jewel('V6 detail inquisitor contacting gold source robe seal',p+n*.007,.047,.056,.014,'gold',torso),[robe])
     register(b.jewel('V6 detail inquisitor recessed robe seal core',p+n*.010,.026,.032,.014,'v6_inquisitor_robe',torso),[frame])
   rm('Continuous leather waist belt')

   faces=sem(b,'Observed face',head);fl,fh=bound(faces);fc=(fl+fh)/2;hw=fh.x-fl.x;hh=fh.z-fl.z;hd=fh.y-fl.y
   pts=[(-.49,-.44),(-.52,-.18),(-.50,.24),(-.33,.43),(0,.60),(.33,.43),(.50,.24),(.52,-.18),(.49,-.44),(0,-.52),(-.49,-.44)]
   hood=sem(b,'V6 source fitted domed cloth hood',head)
   register(rod('inquisitor fitted golden aperture trim',[(fc.x+x*hw,fc.y+hd*.50+.003,fc.z+z*hh)for x,z in pts],.012,'gold',head),hood)
   for sign in(-1,1):
    ap=pivot(b,'upper_arm_'+('R'if sign>0 else'L'));skull=sem(b,'V6 inquisitor actual contacting ivory shoulder skull actual carved cranial shell',ap)
    if skull:
     arm=sem(b,('Upper arm ','Connected shoulder '),ap);al,ah=bound(arm)
     seat,normal=near(arm,((al.x+ah.x)/2,ah.y+.1,ah.z-.025))
     delta=seat+normal*.048+Vector((0,0,.015))-h.center(skull)
     for piece in sem(b,'V6 inquisitor actual contacting ivory shoulder skull',ap):
      inv=piece.matrix_world.inverted()
      for vertex in piece.data.vertices:vertex.co=inv@(piece.matrix_world@vertex.co+delta)
      piece.data.update()
     register(skull[0],arm)
     sl,sh=bound(skull);p,n=near(skull,((sl.x+sh.x)/2,sh.y+.04,sl.z+.025))
     seal=register(b.panel('V6 detail inquisitor contacting hanging parchment seal',[(p.x-.025,p.y,p.z),(p.x+.025,p.y,p.z),(p.x+.036,p.y+.006,p.z-.18),(p.x-.033,p.y+.004,p.z-.16)],.013,'ivory',ap),skull)
     for k in range(3):rod('inquisitor actual parchment rune strokes',[(p.x-.012,p.y+.014,p.z-.04-k*.035),(p.x+.012,p.y+.014,p.z-.043-k*.035)],.004,'dark',ap,6)
   pa=pivot(b,'weapon_L');rm(('Inquisitor actual hollow sun shield seal','Inquisitor golden sun seal ray'),pa);shield=sem(b,('Shield','Inquisitor shield'),pa)
   if shield:
    for ob in shield:
     ob.data.materials.clear();ob.data.materials.append(b.M['v6_inquisitor_shield'])
    sl,sh=bound(shield);sc=(sl+sh)/2;p,n=near(shield,(sc.x,sh.y+.035,sc.z))
    register(annulus(b,'V6 detail inquisitor real contacting gold shield sun',p,.064,.013,'gold',pa,True,n=12,m=5),shield)
    for k in range(8):
     a=k*math.tau/8;start=p+Vector((math.sin(a)*.06,0,math.cos(a)*.06));tip=p+Vector((math.sin(a)*.13,0,math.cos(a)*.13));cone(b,'V6 detail inquisitor shield attached gold sun ray',start,tip,.018,'gold',pa,5)
   recipes.append('Full ankle-length folded charcoal robe with real gold front/back facings and three framed seals, twin hood trim, shoulder parchment and dark gold-sun shield')
  if wave==44:
   p,n=near(body,(c.x,hi.y+.03,hi.z-.12));register(b.jewel('V6 detail executioner broad framed amber chest focus',p,.075,.105,.025,'v6_detail_amber',torso),body)
   b.jewel('V6 detail executioner inner orange recessed chest gem',p+Vector((0,.014,0)),.052,.074,.020,'rune',torso)
   faces=sem(b,'Observed face',head)
   if faces:
    fl,fh=bound(faces);fc=(fl+fh)/2
    for sign in(-1,1):
     hood=sem(b,'V6 source fitted domed cloth hood',head);p,n=near(hood,(fc.x+sign*(fh.x-fl.x)*.42,fc.y,fh.z-.02));register(cone(b,'V6 detail executioner short side ivory crown point',p,p+Vector((sign*.012,0,.11)),.035,'ivory',head,6),hood)
   recipes.append('Large source amber throat focus, ivory forehead and side points, fitted orange facings and complete crescent axe')

 if wave==43:
  # The source ogre has a naked potbelly under harness, not a generic cuirass.
  rm('V6 source curved fitted breastplate')
  for sign in(-1,1):chest_strap(sign);chest_strap(sign,back=True)
  skirt_layers('leather',1)
  for ob in sem(b,('V6 source angled fitted shoulder plate','V6 source wrapped wrist armor','V6 source articulated leg armor')):rivets([ob],ob.parent)
  recipes.append('Exposed natural potbelly, crossed fitted leather cage harness, rough riveted shoulder/wrist/leg plates and source spiked metal mace')
 if wave in(11,13,14,22):
  for ob in sem(b,('V6 source curved fitted breastplate','V6 source angled fitted shoulder plate','V6 source wrapped wrist armor','V6 source articulated leg armor')):rivets([ob],ob.parent)
 if wave in(21,33):
  contacts.extend(apply_source_long_mantles_v6(b,h)['physicalContacts'])
  recipes.append('Actual contacting long root beard and tapered rear bark mantle'if wave==21 else'Closed folded trailing purple cloak extends below the waist with varied ragged hems')
 b.root['enemySecondaryDetailsV6']=True
 return {'applied':True,'sourceWave':wave,'recipes':recipes,'physicalContacts':contacts,'newActualMeshParts':[h.semantic(o)for o in b.objects if o not in before],'originalReferencesModified':False,'sourceDimensionsAreCalibrated':False}
