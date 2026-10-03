"""Source-specific creature proportions for the requested 0.3.2 revision.

Broad wedge heads, crouched muscle volumes, surface-fitted cream plates and
species-specific wings replace the preceding generic primitive assemblies.
Native +Y forward / +X own right / Z up; closed meshes and original rig contract.
"""
import math,bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from geometric_game_common import linear

def material(b,key,hexcode,metal=0):
 if key in b.M:return
 rgba=tuple(linear(int(hexcode[i:i+2],16)/255) for i in (0,2,4))+(1,)
 m=bpy.data.materials.new(key);m.use_nodes=True;m.diffuse_color=rgba;m['source_srgb']='#'+hexcode
 n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=rgba;n.inputs['Roughness'].default_value=.66;n.inputs['Metallic'].default_value=metal;b.M[key]=m

def octsection(y,w,low,high,cx=0):
 h=high-low;q=h*.18
 return [(cx-w*.68,y,low),(cx+w*.68,y,low),(cx+w,y,low+q),(cx+w,y,high-q),(cx+w*.65,y,high),(cx-w*.65,y,high),(cx-w,y,high-q),(cx-w,y,low+q)]

def surface_tree(obs):
 bpy.context.view_layer.update();vs=[];fs=[]
 for o in obs:
  k=len(vs);vs.extend(o.matrix_world@v.co for v in o.data.vertices);fs.extend(tuple(k+i for i in p.vertices) for p in o.data.polygons)
 return BVHTree.FromPolygons(vs,fs,all_triangles=False)

def grid_closed(b,name,grid,rows,cols,offset,mat,parent):
 n=len(grid);assert n==rows*cols;vs=list(grid)+[tuple(Vector(p)+Vector(offset)) for p in grid];fs=[]
 for r in range(rows-1):
  for c in range(cols-1):
   i=r*cols+c;fs.extend([(i,i+1,i+cols+1),(i,i+cols+1,i+cols),(i+n,i+cols+n,i+cols+1+n),(i+n,i+cols+1+n,i+1+n)])
 edge=list(range(cols))+[r*cols+cols-1 for r in range(1,rows)]+list(range((rows-1)*cols+cols-2,(rows-1)*cols-1,-1))+[r*cols for r in range(rows-2,0,-1)]
 for j,i in enumerate(edge):k=edge[(j+1)%len(edge)];fs.append((i,k,k+n,i+n))
 return b.mesh(name,vs,fs,mat,parent)

def front_plates(b,obs,levels,widths,parent):
 """Cream band samples the actual front structural surfaces, no white bulb."""
 tree=surface_tree(obs);points=[]
 # Dense samples prevent straight inter-row chords sinking inside convex
 # chest facets. This is actual opaque surface fit, not an offset white bulb.
 densez=[];densew=[]
 for j in range(len(levels)-1):
  count=max(1,math.ceil((levels[j+1]-levels[j])/.018))
  for k in range(count):
   t=k/count;densez.append(levels[j]*(1-t)+levels[j+1]*t);densew.append(widths[j]*(1-t)+widths[j+1]*t)
 densez.append(levels[-1]);densew.append(widths[-1]);levels,widths=densez,densew
 for z,w in zip(levels,widths):
  for f in (-1,-.75,-.5,-.25,0,.25,.5,.75,1):
   x=w*f;hit=tree.ray_cast(Vector((x,3,z)),Vector((0,-1,0)),6)
   assert hit[0] is not None,(b.id,'cream band outside actual chest/neck',x,z)
   points.append((x,hit[0].y+.009,z))
 grid_closed(b,'Dragon fitted flat continuous ivory throat belly plates',points,len(levels),9,(0,-.024,0),'ivory',parent)
 # Subtle source segment rims stay on the same fitted surface.
 for r in range(5,len(levels)-1,6):
  row=points[r*9:(r+1)*9];b.limb('Dragon fitted cream plate transverse seam',row,[.004]*9,'ivory',parent,6)

def fitted_front_eye(b,name,mesh,cx,z,w,h,parent):
 tree=surface_tree([mesh]);points=[]
 for zz in (z-h/2,z,z+h/2):
  for xx in (cx-w/2,cx,cx+w/2):
   hit=tree.ray_cast(Vector((xx,3,zz)),Vector((0,-1,0)),6)
   assert hit[0] is not None,(name,'eye outside actual head',xx,zz)
   points.append((xx,hit[0].y+.009,zz))
 return grid_closed(b,name,points,3,3,(0,-.021,0),'eyes',parent)

def tail_band(b,pts,radii,parent,tailmesh):
 grid=[];tree=surface_tree([tailmesh])
 for j,(p,r) in enumerate(zip(pts,radii)):
  d=(Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(0,j-1)])).normalized();out=Vector((0,-d.z,d.y)).normalized()
  for f in (-1,0,1):
   probe=Vector(p)+Vector((f*r[0]*.50,0,0))
   if j==0:probe+=d*.003
   elif j==len(pts)-1:probe-=d*.003
   hit=tree.ray_cast(probe+out*3,-out,6)
   assert hit[0] is not None,('tail band outside actual tail',j,f)
   grid.append(tuple(hit[0]+out*.008))
 # Thickness follows each local curve rather than one unrelated flat board.
 n=len(grid);back=[]
 for j,p in enumerate(grid):
  k=j//3;d=(Vector(pts[min(k+1,len(pts)-1)])-Vector(pts[max(0,k-1)])).normalized();out=Vector((0,-d.z,d.y)).normalized();back.append(tuple(Vector(p)-out*.025))
 fs=[]
 for r in range(len(pts)-1):
  for c in range(2):
   i=r*3+c;fs.extend([(i,i+1,i+4,i+3),(i+n,i+3+n,i+4+n,i+1+n)])
 edge=[0,1,2]+[r*3+2 for r in range(1,len(pts))]+list(range(n-2,n-4,-1))+[r*3 for r in range(len(pts)-2,0,-1)]
 for j,i in enumerate(edge):k=edge[(j+1)%len(edge)];fs.append((i,k,k+n,i+n))
 b.mesh('Dragon fitted ivory underside along curved tail',grid+back,fs,'ivory',parent)

def feet(b,root,ell,coat,species):
 horse=species=='horse';bear=species=='bear';griff=species=='griffin';baby=species=='baby'
 for front,y in [(True,.29 if horse else .30 if griff else .24),(False,-.46 if horse else -.43 if griff else -.40)]:
  for side in (-1,1):
   label=('F' if front else 'B')+('R' if side>0 else 'L')
   if horse:
    hip=(side*.245,y,.87);knee=(side*.245,y+(.045 if front else -.085),.355);hock=(side*.255,y+(.025 if front else -.13),.195);ank=(side*.255,y+.045,.125)
    thigh=[(.15,.145),(.131,.117),(.105,.095)];shinr=[(.103,.095),(.086,.078),(.074,.073)];paw=(.117,.146)
   elif bear:
    hip=(side*.30,y,.60);knee=(side*.345,y+.02,.285);hock=(side*.355,y+.045,.18);ank=(side*.355,y+.085,.115)
    thigh=[(.24,.24),(.225,.225),(.18,.185)];shinr=[(.18,.185),(.175,.18),(.162,.165)];paw=(.178,.197)
   elif griff:
    hip=(side*.265,y,.665);knee=(side*.28,y+(.02 if front else -.15),.31);hock=(side*.295,y+(.035 if front else -.08),.19);ank=(side*.295,y+.08,.12)
    thigh=[(.165,.185),(.147,.16),(.117,.13)];shinr=[(.117,.13),(.102,.113),(.092,.105)];paw=(.151,.177)
   else:
    hip=(side*(.265 if baby else .315),y,.56 if baby else .57);knee=(side*(.30 if baby else .375),y+(.05 if front else -.15),.265 if front else .235);hock=(side*(.305 if baby else .38),y+(.04 if front else -.035),.16);ank=(side*(.305 if baby else .365),y+.10,.115)
    thigh=[(.17,.185),(.15,.16),(.119,.127)] if baby else [(.20,.22),(.19,.21),(.132,.142)];shinr=[(.12,.13),(.105,.113),(.087,.097)];paw=(.136,.155) if baby else (.155,.176)
   up=b.pivot('upper_leg_'+label,hip,root);sh=b.pivot('shin_'+label,knee,up);fp=b.pivot('foot_'+label,ank,sh)
   b.limb('Animal upper leg '+label,[hip,Vector(hip).lerp(Vector(knee),.46),knee],thigh,coat,up,10)
   b.limb('Animal shin '+label,[knee,hock,ank],shinr,coat,sh,10)
   ell(b,'Animal contacting anatomical knee '+label,knee,(shinr[0][0],shinr[0][1],.12 if not horse else .091),coat,sh,10,4)
   ell(b,'Animal contacting articulated fetlock '+label,ank,(shinr[-1][0]*1.07,shinr[-1][1]*1.07,min(.088,ank[2]-.006)),coat,fp,10,4)
   x,yy,z=ank;rx,ry=paw
   if horse:
    b.loft('Animal grounded foot '+label,[b.ring(x,yy+.022,0,rx*.90,ry*.90,10),b.ring(x,yy+.023,.028,rx,ry,10),b.ring(x,yy+.017,.122,rx*.76,ry*.72,10)],'dark',fp)
    b.limb('Horse pale sock contacting fetlock '+label,[(x,yy,.112),(x,yy-.009,.220)],[(.068,.071),(.079,.073)],'ivory',sh,10)
   else:
    b.loft('Animal grounded foot '+label,[b.ring(x,yy+.023,0,rx*.9,ry*.92,10),b.ring(x,yy+.031,.035,rx,ry,10),b.ring(x,yy+.018,.133,rx*.87,ry*.86,10),b.ring(x,yy,.178,rx*.67,ry*.65,10)],coat,fp)
    count=4 if bear or griff else 3
    for j in range(count):
     xx=x+(j-(count-1)/2)*rx*.43;fronty=yy+ry*.84
     b.limb('Animal contacting toe and curved claw',[(xx,fronty,.078),(xx,fronty+.045,.049),(xx,fronty+.059,.009)],[(.025,.023),(.025,.020),(.007,.007)],'dark' if bear or griff else 'ivory',fp,8)

def wing_membranes(b,root,z,span,top,coat,membrane,baby=False):
 for side in (-1,1):
  a=(side*.23,-.02,z);el=(side*span*.45,-.065,z+(top-z)*.38);w=(side*span*.60,-.13 if baby else -.19,top)
  pa=b.pivot('wing_'+('R' if side>0 else 'L'),a,root)
  sweep=.56 if baby else .79
  tips=[(side*span,-sweep,z-.05),(side*span*.77,-sweep*.77,z+.045),(side*span*.65,-sweep*.72,z-.10),(side*span*.47,-sweep*.50,z+.015),(side*span*.36,-sweep*.37,z-.09),(side*.22,-.02,z-.02)]
  outline=[a,el,w]+tips
  b.panel('Dragon source broad scalloped closed wing membrane',outline,.023,membrane,pa,.009)
  b.limb('Dragon wing shoulder elbow wrist leading edge',[a,el,w],[.063 if baby else .087,.053 if baby else .071,.04 if baby else .057],coat,pa,10)
  for tip in (tips[0],tips[2],tips[4]):b.limb('Dragon source fitted wing finger strut',[w,Vector(w).lerp(Vector(tip),.52),tip],[.035 if baby else .044,.025,.010],coat,pa,8)
  b.limb('Dragon contacting wing thumb',[w,(w[0]+side*.017,w[1],w[2]+.078)],[.030,.006],coat if baby else 'ivory',pa,8)

def fitted_helmet(b,c,crest,metal):
 head=c['head'];P=c['P'];w=c['fw'];h=c['fh'];z=c['facez'];scale=c['scale']
 for ob in list(b.objects):
  if ob.parent==head and ob.name.startswith('Helmet '):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
 def ring(zz,rx,ry):
  return [P((x,y,zz)) for x,y in [(-.68*rx,ry),(.68*rx,ry),(rx,.48*ry),(rx,-.50*ry),(.65*rx,-ry),(-.65*rx,-ry),(-rx,-.50*ry),(-rx,.48*ry)]]
 # The visor is literally the front faces of this one closed shell; no
 # separate unsupported slab floats in front of a rounded cap.
 shell=b.loft('Helmet integrated crown cheeks and fitted visor',[ring(z-h*.47,w*.45,w*.36),ring(z-h*.22,w*.54,w*.415),ring(z+h*.29,w*.54,w*.415),ring(z+h*.53,w*.43,w*.36),ring(z+h*.67,w*.23,w*.21)],metal,head)
 eyez=z+h*.09
 for side in (-1,1):
  b.box('Helmet genuine horizontal shadowed eye slit',P((side*w*.215,w*.421,eyez)),c['SZ']((w*.26,.014,h*.11)),'dark',.002*scale,head)
  ellpos=P((side*w*.539,0,z+h*.035))
  b.box('Helmet contacting side hinge rivet',ellpos,c['SZ']((.013,.055,.055)),'gold',.004*scale,head)
 b.limb('Helmet contacting armored neck gorget',[P((0,-.012,z-h*.72-.05)),P((0,0,z-h*.44)),P((0,0,z-h*.29))],[w*.23*scale,w*.26*scale,w*.29*scale],metal,head,10)
 if crest:b.panel('Helmet fitted fin crest',[P((0,-w*.22,z+h*.52)),P((0,-w*.14,z+h*.98)),P((0,w*.10,z+h*.93)),P((0,w*.17,z+h*.55))],.056*scale,'cloth' if b.id=='frostblade' else 'rider_navy',head,.015*scale)
 shell['fittedVisorNoSeparateFloatingPlate']=True

def seated_rider(b,row,root,seat,ell,annulus,humanoid,horse=False,dwarf=False):
 ident=b.id;s=row['spec'];scale=.84 if horse else .68 if dwarf else .77
 material(b,'rider_navy','25476b');material(b,'rider_steel','c3ced7',.28);material(b,'rider_ivory','e6e3d7');material(b,'rider_gold','d9b15f',.28);material(b,'dwarf_leather','62452f')
 saddlepos=(0,-.10,seat-.065);b.limb('Rider fitted saddle cushion contacting back',[(0,.075,seat-.065),(0,-.275,seat-.065)],[(.24,.086),(.25,.092)],'leather',root,12)
 for yy in (.155,-.30):b.limb('Rider contacting saddle pommel and cantle',[(-.245,yy,seat-.04),(0,yy,seat+.044),(.245,yy,seat-.04)],[.038]*3,'leather',root,10)
 spec={**s,'bodyKind':'humanoid','mounted':False,'wingStyle':None,'wings':False,'helmet':ident in ('frostblade','thunderheart'),'hood':False,'hat':'cone' if ident=='phoenix' else None,'crown':False,'armorPlates':ident in ('roseguard','thunderheart'),'cloak':'short' if ident=='roseguard' else False,'beard':dwarf,'compact':dwarf,'bulky':True}
 before=set(b.objects)
 ctx=humanoid(b,{**row,'spec':spec},True,(0,-.10,seat-.04*scale),scale,True,{'sourceCompactTorso':dwarf,'faceWidth':.53 if horse else .53 if dwarf else .49,'seatHipX':.20,'seatHipY':-.01,'seatKneeX':.49 if horse else .56 if dwarf else .54,'seatKneeY':.10,'seatKneeZ':-.16,'seatAnkleX':.51 if horse else .59 if dwarf else .57,'seatAnkleY':.08,'seatAnkleZ':-.40})
 b.attach(ctx['torso'],root)
 for leg in ctx['legs'].values():b.attach(leg,root)
 ell(b,'Rider visible seated pelvis and thighs at saddle',(0,-.105,seat+.018),(.205,.177,.093),'rider_navy' if ident=='thunderheart' else 'dwarf_leather' if dwarf else 'leather',ctx['torso'],12,4)
 for ob in set(b.objects)-before:
  for j,mt in enumerate(ob.data.materials):
   if ident=='thunderheart':
    if mt in (b.M['cloth'],b.M['cloth_light'],b.M['riderpurple']):ob.data.materials[j]=b.M['rider_navy']
    elif mt in (b.M['steel'],b.M['steel_dark'],b.M['steel_light'],b.M['riderarmor']):ob.data.materials[j]=b.M['rider_steel']
    elif mt==b.M['gold']:ob.data.materials[j]=b.M['rider_gold']
   elif ident=='phoenix' and mt in (b.M['cloth'],b.M['cloth_light']):ob.data.materials[j]=b.M['riderpurple']
   elif dwarf and mt in (b.M['cloth'],b.M['cloth_light']):ob.data.materials[j]=b.M['dwarf_leather']
 if ident in ('frostblade','thunderheart'):fitted_helmet(b,ctx,True,'rider_steel')
 if ident=='roseguard':
  head=ctx['head'];P=ctx['P'];fw=ctx['fw'];fh=ctx['fh'];fz=ctx['facez']
  for ob in list(b.objects):
   if ob.parent==head and ob.name.startswith('Hair '):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  cap=b.hood('Continuous wrapped hood Lionheart source burgundy fitted cap',P((0,-.008,fz+fh*.12)),fw*1.22*scale,fh*1.60*scale,fw*.76*scale,'cloth',head)
  # Keep the approved outer silhouette; lower only the internal roof 3 mm
  # so it physically seats on the forehead rather than leaving a 5 mm gap.
  bpy.context.view_layer.update();inv=cap.matrix_world.inverted()
  for j in (18,19,26,27,28,35):
   v=cap.data.vertices[j];v.co=inv@((cap.matrix_world@v.co)-Vector((0,0,.003)))
  cap.data.update()
 if ident=='phoenix':
  head=ctx['head'];P=ctx['P'];fw=ctx['fw'];fh=ctx['fh'];fz=ctx['facez']
  for ob in list(b.objects):
   if ob.parent==head and ob.name=='Wizard pointed cap':b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  b.loft('Wizard source continuous crooked fitted pointed cap',[[P(v) for v in b.ring(x,-.006,z,rx,ry,12)] for x,z,rx,ry in [(0,fz+fh*.48,fw*.54,fw*.39),(-fw*.025,fz+fh*.92,fw*.39,fw*.29),(-fw*.10,fz+fh*1.42,fw*.22,fw*.17),(-fw*.27,fz+fh*1.90,fw*.041,fw*.033),(-fw*.46,fz+fh*1.71,fw*.012,fw*.014)]],'riderpurple',head)
 if ident=='thunderheart':
  for ob in list(b.objects):
   if ob.parent==ctx['weapons']['R'] and ob.name.startswith('Spear faceted metal tip'):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  for side in (-1,1):
   sn='R' if side>0 else 'L';leg=ctx['legs'][sn];sh=next(o for o in b.coll.all_objects if o.name=='shin_'+sn);fp=next(o for o in b.coll.all_objects if o.name=='foot_'+sn)
   knee=ctx['P']((side*.54,.10,-.16));ank=ctx['P']((side*.57,.08,-.40))
   b.limb('Dragonrider distinct steel fitted thigh plate',[ctx['P']((side*.23,.075,.02)),knee],[(.09,.047),(.081,.041)],'rider_steel',leg,8)
   ell(b,'Dragonrider distinct ivory steel knee armor',knee,(.095,.083,.089),'rider_ivory',sh,10,4)
   b.limb('Dragonrider distinct navy gold trimmed greave',[knee,ank],[(.076,.071),(.067,.064)],'rider_navy',sh,10)
   b.box('Dragonrider distinct steel sabaton toe',(ank[0],ank[1]+.06,ank[2]-.034),(.19,.22,.13),'rider_steel',.018,fp)
  b.root['riderArmorUserOverride']='All armor navy/steel/ivory/gold contrasting purple mount; historical purple rider palette superseded.'
 for side in (-1,1):
  ank=ctx['P']((side*(.51 if horse else .59 if dwarf else .57),.08,-.40));st=(ank[0],ank[1]+.07,ank[2]-.063)
  annulus(b,'Rider actual fitted hanging stirrup',st,.054,.011,'steel',root,True,10,4);b.limb('Rider stirrup suspension on saddle',[(side*.235,-.10,seat-.04),(st[0],st[1]-.02,st[2]+.038)],[.018]*2,'leather',root,8)
 if dwarf:
  fz=ctx['P']((0,0,ctx['facez']))[2];fw=ctx['fw']*scale;head=ctx['head'];hy=ctx['P']((0,ctx['fw']*.30,ctx['facez']))[1]
  for ob in list(b.objects):
   if ob.name.startswith(('Dwarf pilot actual silver','Dwarf pilot dark glass')):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
   elif ob.parent==head and ob.name in ('Eye L','Eye R'):
    bpy.context.view_layer.update();inv=ob.matrix_world.inverted();center=sum((ob.matrix_world@v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices)
    for v in ob.data.vertices:
     p=ob.matrix_world@v.co;v.co=inv@Vector((center.x+(p.x-center.x)*1.22,p.y,center.z+(p.z-center.z)*1.30))
    ob.data.update()
   elif ob.name.startswith('Dwarf full copper fivefacet beard lobe'):
    # Source eyes sit in a visible skin window above the full copper beard.
    # Lower only the beard top edge; retain its three lobes and full lower mass.
    bpy.context.view_layer.update();top=max((ob.matrix_world@v.co).z for v in ob.data.vertices);inv=ob.matrix_world.inverted()
    for v in ob.data.vertices:
     p=ob.matrix_world@v.co
     if p.z>top-.005:v.co=inv@(p-Vector((0,0,.034)))
    ob.data.update()
  b.limb('Dwarf contacting full leather cap band',[(0,-.10,fz+.09),(0,-.10,fz+.17)],[(fw*.58,fw*.47),(fw*.48,fw*.37)],'dwarf_leather',head,10)
  b.box('Dwarf actual silver goggle connecting forehead band',(0,hy+.011,fz+.096),(fw*1.18,.043,.048),'steel',.008,head)
  for side in (-1,1):b.box('Dwarf actual silver square goggle lens',(side*fw*.23,hy+.028,fz+.096),(.078,.050,.062),'steel',.008,head);b.box('Dwarf actual inset gray glass',(side*fw*.23,hy+.054,fz+.096),(.049,.010,.034),'dark',.004,head)
 if horse:
  for side in (-1,1):b.limb('Horse rider contacting actual leather rein',[ctx['hands']['L'],(side*.14,.89,1.035)],[.010]*2,'leather',ctx['weapons']['L'],6)
 if ident=='roseguard':
  pts=[ctx['P']((-.29,-.24,.62)),ctx['P']((.29,-.24,.62)),(.36,-.50,1.18),(.34,-.75,1.07),(0,-.78,1.015),(-.34,-.75,1.07),(-.36,-.50,1.18)]
  b.panel('Lionheart source fitted maroon cape',pts,.033,'cloth',ctx['torso'],.023)
  for j in range(len(pts)):b.rod('Lionheart cape wide contacting gold hem',pts[j],pts[(j+1)%len(pts)],.021,'gold',ctx['torso'],8)
 return ctx

def source_horse(b,row,ell,cone,leaf,annulus,humanoid,lion):
 from geometric_creature_anatomy_v2 import cloth_grid
 coat='steel_light' if b.id=='frostblade' else 'copper';root=b.pivot('mount_torso_pivot',(0,-.10,.89));poll=(0,.59,1.35);head=b.pivot('mount_head_pivot',poll,root)
 ell(b,'Horse source shaped barrel and ribs',(0,-.09,.89),(.35,.56,.335),coat,root,12,5);ell(b,'Horse source defined withers chest',(0,.23,.945),(.31,.27,.35),coat,root,12,5);ell(b,'Horse source broad rounded croup',(0,-.43,.89),(.33,.29,.335),coat,root,12,5)
 b.limb('Horse continuous swept muscular neck',[(0,.22,1.03),(0,.28,1.18),(0,.39,1.38),poll],[(.225,.245),(.205,.225),(.175,.193),(.153,.163)],coat,root,12)
 b.loft('Horse source tapered equine forehead cheek muzzle',[octsection(y,w,lo,hi) for y,w,lo,hi in [(.47,.175,1.21,1.49),(.64,.19,1.16,1.47),(.77,.16,1.05,1.33),(.895,.154,.988,1.18),(.951,.142,.983,1.122)]],coat,head)
 jaw=b.pivot('mouth_pivot',(0,.88,1.025),head);b.loft('Horse contacting short rounded pale muzzle',[octsection(y,w,lo,hi) for y,w,lo,hi in [(.88,.151,.991,1.109),(.95,.157,.985,1.110),(.987,.131,1.001,1.082)]],'ivory',jaw);b.pivot('attack_muzzle',(0,.995,1.043),jaw)
 for side in (-1,1):
  b.box('Horse visible fitted lateral eye',(side*.185,.695,1.332),(.025,.062,.066),'eyes',.006,head)
  b.box('Horse visible short nostril',(side*.076,.989,1.07),(.032,.010,.020),'dark',.004,jaw)
  b.limb('Horse source pointed external ear',[(side*.105,.535,1.439),(side*.117,.517,1.570),(side*.123,.491,1.628)],[(.050,.062),(.033,.040),(.006,.009)],coat,head,8)
  b.limb('Horse source cupped dark ear recess',[(side*.108,.568,1.471),(side*.116,.542,1.563)],[.023,.007],'leather',head,8)
 b.limb('Horse fitted arched contact mane',[(0,.16,1.19),(0,.27,1.39),(0,.415,1.49),(0,.55,1.505)],[(.055,.059),(.054,.051),(.048,.046),(.039,.037)],'hair' if b.id=='roseguard' else 'steel_dark',root,10)
 feet(b,root,ell,coat,'horse')
 b.limb('Horse source full faceted curved tail',[(0,-.62,1.055),(0,-.735,.945),(0,-.80,.70),(0,-.87,.41)],[(.13,.13),(.14,.13),(.115,.095),(.055,.047)],'hair' if b.id=='roseguard' else 'steel_light',root,10)
 for side in (-1,1):
  grid=[(side*.255,.35,1.13),(side*.25,-.12,1.21),(side*.24,-.55,1.12),(side*.373,.40,.84),(side*.385,-.12,.86),(side*.365,-.56,.86),(side*.365,.32,.59),(side*.39,-.12,.46),(side*.355,-.54,.58)]
  cloth_grid(b,'Horse source fitted three draped caparison sections',grid,'cloth',root,(-side*.029,0,0))
  for a,c in [(6,7),(7,8),(8,5),(3,6)]:b.rod('Horse source broad integral caparison hem',grid[a],grid[c],.030,'gold' if b.id=='roseguard' else 'ivory',root,8)
  if b.id=='roseguard':lion(b,(side*.411,-.10,.71),.13,root,side=side)
  else:b.panel('Knight caparison ivory side diamond',[(side*.405,-.105,.879),(side*.405,-.020,.74),(side*.405,-.105,.601),(side*.405,-.190,.74)],.024,'ivory',root,.009)
 chest=[(-.25,.51,1.00),(.25,.51,1.00),(.265,.53,.55),(0,.545,.485),(-.265,.53,.55)];b.panel('Horse pointed fitted front cloth plate',chest,.035,'cloth',root,.017)
 for a,c in [(2,3),(3,4)]:b.rod('Horse chest source hem',chest[a],chest[c],.029,'gold' if b.id=='roseguard' else 'ivory',root,8)
 if b.id=='roseguard':lion(b,(0,.583,.72),.13,root)
 else:b.jewel('Horse front source ivory diamond',(0,.579,.70),.082,.137,.028,'ivory',root)
 if b.id=='frostblade':
  # A short contacting brow plate leaves both actual eyes and cheek exposed.
  b.panel('Horse source fitted short chanfron',[(-.096,.645,1.459),(0,.551,1.497),(.096,.645,1.459),(.092,.784,1.263),(0,.835,1.238),(-.092,.784,1.263)],.030,'steel',head,.011)
 for side in (-1,1):b.limb('Horse contacting bridle cheek strap',[(side*.168,.509,1.469),(side*.180,.68,1.27),(side*.160,.906,1.056)],[.018]*3,'leather',head,8)
 b.limb('Horse source fitted noseband',[(-.155,.906,1.058),(0,.998,1.054),(.155,.906,1.058)],[.018]*3,'leather',head,8)
 seated_rider(b,row,root,1.225,ell,annulus,humanoid,horse=True);return root

def source_dragon(b,row,ell,cone,leaf,annulus,humanoid):
 ident=b.id;baby=ident=='embercrown';mother=ident=='worldfire';mounted=bool(row['spec'].get('mounted'));coat='cloth';z=.51 if not baby else .49
 root=b.pivot('mount_torso_pivot' if mounted else 'torso_pivot',(0,-.11,z));struct=[]
 struct.append(ell(b,'Dragon source low full faceted rib barrel',(0,-.12,z),(.34,.44,.295) if baby else (.40,.55,.325),coat,root,10,5))
 struct.append(ell(b,'Dragon source crouched chest and shoulders',(0,.16,z+.09),(.285,.27,.30) if baby else (.32,.30,.33),coat,root,10,5))
 hz=1.29 if mother else .99 if baby else 1.03;hy=.49 if not mother else .47
 neck=[(0,.18,z+.14),(0,.275,.77 if not mother else .83),(0,hy-.06,hz-.10),(0,hy,hz)]
 radii=[(.19,.20),(.18,.18),(.157,.16),(.145,.147)] if not mother else [(.20,.21),(.18,.18),(.148,.151),(.129,.132)]
 struct.append(b.limb('Dragon connected swept curved muscular neck',neck,radii,coat,root,10))
 head=b.pivot('mount_head_pivot' if mounted else 'head_pivot',(0,hy,hz),root);fac=.82 if mother else 1
 sections=[(hy-.18,.23*fac,hz-.19*fac,hz+.12*fac),(hy-.015,.30*fac,hz-.23*fac,hz+.205*fac),(hy+.15,.275*fac,hz-.235*fac,hz+.14*fac),(hy+.265,.188*fac,hz-.235*fac,hz-.005*fac),(hy+.375,.173*fac,hz-.218*fac,hz-.025*fac)]
 skull=b.loft('Dragon sculpted faceted cranial volume source broad wedge',[octsection(y,w,lo,hi) for y,w,lo,hi in sections[:-1]],coat,head)
 b.loft('Dragon source short broad flattened upper muzzle',[octsection(y,w,lo,hi) for y,w,lo,hi in sections[-2:]],coat,head)
 jaw=b.pivot('mouth_pivot',(0,hy+.20,hz-.185*fac),head)
 b.loft('Dragon contacting closed broad flattened lower jaw',[octsection(y,w,lo,hi) for y,w,lo,hi in [(hy+.035,.20*fac,hz-.236*fac,hz-.174*fac),(hy+.26,.178*fac,hz-.236*fac,hz-.18*fac),(hy+.367,.158*fac,hz-.223*fac,hz-.178*fac)]],coat,jaw)
 b.pivot('attack_muzzle',(0,hy+.384,hz-.12*fac),jaw)
 for side in (-1,1):
  fitted_front_eye(b,'Dragon source front visible surface fitted square eye',skull,side*.190*fac,hz+.060*fac,.074*fac,.086*fac,head)
  b.box('Dragon two short square nostrils',(side*.098*fac,hy+.381,hz-.064*fac),(.022,.008,.016),'dark',.002,head)
  b.limb('Dragon source swept faceted broad horn',[(side*.18*fac,hy-.072,hz+.148*fac),(side*.23,hy-.19,hz+.33),(side*.238,hy-.27,hz+.385)],[(.089,.080),(.057,.060),(.008,.009)],'wood' if baby else 'gold',head,8)
 if ident=='phoenix':b.limb('Mage dragon third contacting swept horn',[(0,hy-.115,hz+.16),(0,hy-.24,hz+.32),(0,hy-.30,hz+.38)],[(.067,.065),(.039,.035),(.006,.006)],'gold',head,8)
 feet(b,root,ell,coat,'baby' if baby else 'dragon')
 front_plates(b,struct,[.23,.36,.53,.68,.77,.89 if not mother else 1.03,1.145 if mother else .92],[.041,.14,.179,.172,.144,.118,.103],root)
 # Source profile: a curved tail leaves the croup and rises without a tall
 # straight mast. Baby cream undersurface and flame are structural contact.
 tail=[(0,-.43,z+.018),(0,-.60,z-.009),(0,-.75,z+.028),(0,-.86,z+.10),(0,-.945,z+.22),(0,-.99,z+.36),(0,-1.005,z+.51),(0,-1.00,z+.67),(0,-.977,z+.81)] if baby else [(0,-.52,z+.03),(0,-.73,z-.02),(.035,-.94,z-.03),(.09,-1.14,z+.015),(.14,-1.28,z+.115),(.15,-1.30,z+.25)]
 tailr=[(.142*(1-j/(len(tail)-1))+.037*j/(len(tail)-1),.13*(1-j/(len(tail)-1))+.036*j/(len(tail)-1))for j in range(len(tail))]
 tailmesh=b.limb('Dragon source continuously curved faceted tail',tail,tailr,coat,root,10)
 if baby:
  tail_band(b,tail,tailr,root,tailmesh);p=Vector(tail[-1])
  b.loft('Baby source contacting amber flame volume',[b.ring(p.x+dx,p.y,p.z+dz,rx,ry,8) for dz,rx,ry,dx in [(-.015,.025,.023,0),(.035,.079,.061,0),(.14,.155,.119,0),(.25,.122,.093,-.006),(.35,.079,.061,-.013),(.49,.004,.004,-.029)]],'orange',root)
 elif ident=='thunderheart':
  p=Vector(tail[-1]);b.panel('Dragon source gold lightning tail tip',[tuple(p+Vector(q))for q in [(-.075,0,-.035),(.014,0,.17),(.044,0,.036),(.19,0,.125),(.035,0,-.105),(.06,0,.022)]],.044,'gold',root,.014)
 elif ident=='phoenix':
  fork=[tail[3],(-.095,-1.24,z+.14),(-.27,-1.36,z+.20)];b.limb('Mage dragon source forked second tail',fork,[(.080,.080),(.065,.060),(.023,.021)],coat,root,10)
  for p in (tail[-1],fork[-1]):b.jewel('Mage dragon source golden forked tail spear',p,.068,.115,.050,'gold',root)
 else:
  tree=surface_tree(struct)
  for zz in (.91,1.065,1.19):
   hit=tree.ray_cast(Vector((0,-3,zz)),Vector((0,1,0)),6)
   assert hit[0] is not None,('mother neck plate actual surface',zz)
   b.jewel('Mother source contacting faceted orange neck dorsal plate',(0,hit[0].y-.021,zz),.069,.099,.059,'orange',root)
  for j in range(7):
   p=Vector((0,.12-j*.175,.855 if j<3 else .77-(j-3)*.09));b.limb('Mother source fitted swept flame dorsal plate',[p,p+Vector((0,-.065,.12)),p+Vector((0,-.09,.19))],[(.068,.055),(.045,.033),(.005,.005)],'orange',root,8)
 wing_membranes(b,root,.785 if baby else .805,.73 if baby else 1.13,1.02 if baby else 1.80 if mother else 1.49,coat,'orange' if baby else 'ivory',baby)
 if mounted:seated_rider(b,row,root,.93,ell,annulus,humanoid)
 return root

def source_bear(b,row,ell,cone,leaf,annulus):
 material(b,'bear_fur','8c5938');material(b,'bear_muzzle','e8d3ab');material(b,'bear_mantle','426348');material(b,'bear_trim','d9ae60')
 root=b.pivot('torso_pivot',(0,-.11,.65));head=b.pivot('head_pivot',(0,.34,1.025),root)
 ell(b,'Bear source broad deep rounded rib barrel',(0,-.13,.65),(.43,.57,.46),'bear_fur',root,10,5);ell(b,'Bear source high shoulder chest mass',(0,.20,.74),(.40,.33,.41),'bear_fur',root,10,5);ell(b,'Bear source rounded haunches',(0,-.46,.65),(.39,.32,.42),'bear_fur',root,10,5)
 b.limb('Bear actual broad contacting structural neck',[(0,.22,.85),(0,.32,1.025)],[.29,.31],'bear_fur',root,10)
 skull=ell(b,'Bear source wide rounded faceted cranium',(0,.37,1.065),(.475,.328,.336),'bear_fur',head,12,5)
 jaw=b.pivot('mouth_pivot',(0,.59,.94),head);b.loft('Bear source short rounded cream muzzle',[octsection(y,w,lo,hi)for y,w,lo,hi in [(.57,.217,.793,1.119),(.75,.20,.823,1.110),(.815,.139,.849,1.075)]],'bear_muzzle',jaw)
 b.panel('Bear source broad black pentagonal nose',[(-.097,.826,1.032),(.097,.826,1.032),(.092,.83,.949),(0,.837,.909),(-.092,.83,.949)],.025,'dark',jaw,.006)
 b.pivot('attack_muzzle',(0,.845,.965),jaw)
 for side in (-1,1):
  fitted_front_eye(b,'Bear source fitted square frontal eye',skull,side*.176,1.178,.078,.081,head)
  ell(b,'Bear source solid rounded cupped ear',(side*.385,.315,1.33),(.135,.095,.137),'bear_fur',head,8,4)
  ell(b,'Bear source dark inset ear cup',(side*.389,.395,1.339),(.083,.023,.085),'leather',head,8,3)
 feet(b,root,ell,'bear_fur','bear');ell(b,'Bear source short round tail',(0,-.681,.764),(.116,.103,.12),'bear_fur',root,8,4)
 from geometric_roster_builder import crown
 crown(b,(0,.33,1.378),.36,parent=head,points=3)
 for side in (-1,1):
  grid=[(side*.17,.14,1.093),(side*.17,-.24,1.105),(side*.17,-.56,1.016),(side*.43,.19,.917),(side*.465,-.24,.916),(side*.43,-.58,.85),(side*.445,.15,.58),(side*.467,-.23,.442),(side*.435,-.57,.56)]
  grid_closed(b,'Bear source curved fitted green saddle side panel',grid,3,3,(-side*.027,0,0),'bear_mantle',root)
  for a,c in [(0,3),(3,6),(6,7),(7,8),(8,5),(5,2),(2,1),(1,0)]:b.rod('Bear source broad contacting golden saddle hem',grid[a],grid[c],.030,'bear_trim',root,8)
  x=side*.483;y=-.19;z=.72
  b.rod('Bear gold source leaf crest stem',(x,y,z-.09),(x,y,z+.15),.018,'bear_trim',root,6)
  for dy,dz in [(0,.16),(-.10,.055),(.10,.055)]:
   b.panel('Bear gold source three leaf crest',[(x,y,z),(x,y+dy*.56-.037,z+dz*.50),(x,y+dy,z+dz),(x,y+dy*.56+.037,z+dz*.50)],.020,'bear_trim',root,.009)
 # One fitted bridge follows the real rounded back, closing the panel seam.
 grid=[(-.19,.12,1.087),(0,.12,1.105),(.19,.12,1.087),(-.19,-.24,1.10),(0,-.24,1.119),(.19,-.24,1.10),(-.19,-.56,1.011),(0,-.56,1.03),(.19,-.56,1.011)]
 grid_closed(b,'Bear source contacting green mantle across back',grid,3,3,(0,0,-.028),'bear_mantle',root)
 b.panel('Bear source small green chest bib',[(-.17,.494,.79),(.17,.494,.79),(.12,.52,.51),(0,.531,.455),(-.12,.52,.51)],.025,'bear_mantle',root,.012)
 for side in (-1,1):b.rod('Bear source golden bib chevron',(side*.086,.557,.52),(0,.562,.60),.026,'bear_trim',root,6)
 return root

def griffin_feathers(b,root):
 for side in (-1,1):
  origin=(side*.23,-.075,.83);elbow=(side*.44,-.105,1.10);wrist=(side*.68,-.14,1.35);pa=b.pivot('wing_'+('R' if side>0 else 'L'),origin,root)
  b.limb('Griffin full feathered shoulder elbow wrist',[origin,elbow,wrist],[.13,.13,.095],'ivory',pa,10)
  for j,(x,z) in enumerate([(1.04,1.84),(1.16,1.60),(1.16,1.32),(1.01,1.085),(.88,.905)]):
   start=(side*(.43+j*.016),-.105,.99-j*.047);end=(side*x,-.35-j*.14,z);a=Vector(start);c=Vector(end);mid=a.lerp(c,.57)+Vector((side*.025,-.045,.02))
   b.limb('Griffin source broad overlapping ivory primary feather',[a,mid,c],[(.085,.048),(.168,.061),(.008,.008)],'ivory',pa,8)
  for j,(x,z) in enumerate([(.81,1.48),(.88,1.19),(.74,.94)]):
   a=(side*.27,-.05,.90-j*.025);c=(side*x,-.22-j*.23,z);b.limb('Griffin source rounded layered wing covert',[a,Vector(a).lerp(Vector(c),.60)+Vector((0,-.03,0)),c],[(.092,.056),(.15,.061),(.009,.008)],'ivory',pa,8)

def source_griffin(b,row,ell,cone,leaf,annulus,humanoid):
 material(b,'griff_lion','c99343');material(b,'griff_mane','f1e2c5');material(b,'griff_beak','d4a036')
 root=b.pivot('mount_torso_pivot',(0,-.16,.61));head=b.pivot('mount_head_pivot',(0,.43,1.01),root)
 ell(b,'Griffin source long full lion rib barrel',(0,-.17,.61),(.32,.565,.335),'griff_lion',root,10,5);ell(b,'Griffin source leonine chest and shoulders',(0,.22,.68),(.32,.26,.345),'griff_lion',root,10,5);ell(b,'Griffin source powerful rear lion haunches',(0,-.48,.59),(.29,.275,.325),'griff_lion',root,10,5)
 b.limb('Griffin source contacting feathered eagle neck',[(0,.19,.76),(0,.32,.94),(0,.43,1.04)],[(.225,.228),(.215,.224),(.197,.197)],'griff_mane',root,10)
 skull=ell(b,'Griffin source rounded faceted avian cranium',(0,.48,1.057),(.248,.238,.233),'griff_mane',head,10,5)
 jaw=b.pivot('mouth_pivot',(0,.65,.965),head)
 b.loft('Griffin source hooked yellow upper eagle beak',[octsection(y,w,lo,hi)for y,w,lo,hi in [(.62,.125,.975,1.124),(.80,.119,.947,1.089),(.875,.063,.891,1.002),(.872,.020,.823,.883)]],'griff_beak',head)
 b.limb('Griffin source contacting lower eagle beak',[(0,.62,.963),(0,.78,.944)],[.073,.018],'griff_beak',jaw,8);b.pivot('attack_muzzle',(0,.889,.950),jaw)
 for side in (-1,1):
  fitted_front_eye(b,'Griffin source fitted eagle eye',skull,side*.163,1.086,.060,.064,head)
  for j in range(4):
   a=(side*(.09+j*.023),.34+j*.045,1.19-j*.085);c=(side*(.27+j*.025),.47+j*.03,1.10-j*.12)
   b.limb('Griffin source layered white cheek ruff',[a,Vector(a).lerp(Vector(c),.49),c],[(.078,.046),(.102,.052),(.009,.008)],'griff_mane',head,8)
 for j in range(5):
  x=(j-2)*.065;a=(x,.50,1.015);c=(x*1.58,.54,.714+abs(j-2)*.047);b.limb('Griffin dense broad ivory throat feather ruff',[a,Vector(a).lerp(Vector(c),.43),c],[(.067,.063),(.084,.065),(.008,.008)],'griff_mane',head,8)
 for j in (-1,0,1):b.limb('Griffin source swept eagle crest',[(j*.073,.38,1.185),(j*.12,.29,1.28),(j*.145,.23,1.294)],[.063,.046,.006],'griff_mane',head,8)
 feet(b,root,ell,'griff_lion','griffin');griffin_feathers(b,root)
 tail=[(0,-.62,.71),(0,-.83,.55),(0,-1.03,.60),(0,-1.12,.76)];b.limb('Griffin source curved lion tail',tail,[.070,.062,.052,.042],'griff_lion',root,10);ell(b,'Griffin source broad dark lion tail tuft',tail[-1],(.115,.11,.137),'hair',root,8,4)
 for side in (-1,1):
  pos=(side*.40,-.085,.55);b.limb('Griffin source actual bomb suspension strap',[(side*.235,-.09,.96),(side*.40,-.085,.72)],[.025]*2,'leather',root,8)
  ell(b,'Griffin source hanging full faceted bomb',pos,(.145,.13,.172),'dark',root,8,4);b.box('Griffin source bomb silver top collar',(pos[0],pos[1],.716),(.107,.10,.059),'steel',.007,root)
  b.jewel('Griffin source hanging bomb gold diamond',(pos[0],pos[1]+.134,.55),.048,.074,.018,'gold',root)
 ctx=seated_rider(b,row,root,.965,ell,annulus,humanoid,dwarf=True)
 # A proper broad diagonal leather harness rests on the feather/lion chest.
 for side in (-1,1):b.limb('Griffin source contacting fitted chest harness',[(side*.205,.34,.96),(side*.19,.43,.72),(0,.474,.57)],[.037,.037,.041],'leather',root,8)
 b.jewel('Griffin source harness gold chest diamond',(0,.503,.593),.064,.092,.029,'gold',root)
 return root

def build_source_creature_v3(b,row,ell,cone,leaf,annulus,humanoid,lion):
 if b.id in ('frostblade','roseguard'):root=source_horse(b,row,ell,cone,leaf,annulus,humanoid,lion)
 elif b.id=='rangermentor':root=source_bear(b,row,ell,cone,leaf,annulus)
 elif b.id=='griffinbomber':root=source_griffin(b,row,ell,cone,leaf,annulus,humanoid)
 else:root=source_dragon(b,row,ell,cone,leaf,annulus,humanoid)
 b.root['anatomyRevision']='geometric-source-anatomy-v3';b.root['sourceSpecificCreatureRevision']='0.3.2';return root
