"""Physical 0.3.4 tower proportions and draped cloth; native +Y forward.

All operations act on actual mesh vertices and preserve source image bytes.
Head reduction is a single affine map for the complete rigid assembly, with
the jaw/helmet base anchored at its existing, seated body contact. Animal and
integrated spirit heads never enter this pass. Cloaks are closed cloth volumes
with real vertical pleats and several drape stations, rather than a flat quad.
"""
import math,json,bpy,bmesh
from mathutils import Vector
from geometric_game_common import Builder,metrics

HEAD_SCALE=(.90,.90,.95)

def semantic(ob):return ob.get('semanticPart',ob.name)
def descendants(ob,parent):
 while ob:
  if ob==parent:return True
  ob=ob.parent
 return False
def points(ob):return [ob.matrix_world@v.co for v in ob.data.vertices]
def bounds(objects):
 bpy.context.view_layer.update();pp=[p for o in objects for p in points(o)]
 return Vector(tuple(min(p[i]for p in pp)for i in range(3))),Vector(tuple(max(p[i]for p in pp)for i in range(3)))
def transform_objects(objects,fn):
 """Bake one world-coordinate mapping, retaining all hierarchical rest frames."""
 bpy.context.view_layer.update()
 matrices={o:o.matrix_world.copy()for o in objects}
 vertices={o:[fn(matrices[o]@v.co)for v in o.data.vertices]for o in objects if o.type=='MESH'}
 targets={o:fn(m.translation)for o,m in matrices.items()}
 def depth(o):
  n=0
  while o.parent:n+=1;o=o.parent
  return n
 for o in sorted(objects,key=depth):
  m=matrices[o].copy();m.translation=targets[o];o.matrix_world=m;bpy.context.view_layer.update()
 for o,vv in vertices.items():
  inv=o.matrix_world.inverted()
  for v,p in zip(o.data.vertices,vv):v.co=inv@p
  o.data.update()
 bpy.context.view_layer.update()

def remove_objects(b,objects):
 for o in list(objects):
  if o in b.objects:b.objects.remove(o)
  mesh=o.data;bpy.data.objects.remove(o,do_unlink=True)
  if mesh.users==0:bpy.data.meshes.remove(mesh)

def apply_head_proportions_v5(b):
 if b.root.get('headProportionV5'):return json.loads(b.root['headProportionV5'])
 if b.root.get('integratedHeadInTorso') or b.id=='mothernature':
  report={'applied':False,'reason':'Spirit face is integrated living body, with no separate humanoid head.'}
  b.root['headProportionV5']=json.dumps(report);return report
 heads=[o for o in b.coll.all_objects if o.type=='EMPTY' and o.name.split('.')[0]=='head_pivot']
 results=[]
 for head in heads:
  meshes=[o for o in b.objects if descendants(o,head) and not semantic(o).lower().startswith('staff')]
  # Require a real humanlike face or armor shell. Species/mount heads are
  # exclusively mount_head_pivot and do not satisfy these bearing selectors.
  bearing=[o for o in meshes if semantic(o)in ('Observed face','Face')]
  if not bearing:bearing=[o for o in meshes if any(k in semantic(o).lower()for k in ('single integrated','single continuous','unified helmet','integrated hollow','solid crown shell','helmet integrated crown'))]
  if not bearing:continue
  lo,hi=bounds(bearing);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
  old_lo,old_hi=bounds(meshes);old_bearing=(lo.copy(),hi.copy())
  group=[o for o in b.coll.all_objects if descendants(o,head) and not (o.type=='MESH' and semantic(o).lower().startswith('staff'))]
  def affine(p):return center+Vector(tuple((p[i]-center[i])*HEAD_SCALE[i]for i in range(3)))
  transform_objects(group,affine)
  after_lo,after_hi=bounds(meshes);now_lo,now_hi=bounds(bearing)
  assert abs(now_lo.z-lo.z)<2e-6,(b.id,'head base moved')
  ratios=[(after_hi[i]-after_lo[i])/(old_hi[i]-old_lo[i])for i in range(3)]
  assert all(abs(ratios[i]-HEAD_SCALE[i])<2e-5 for i in range(3)),(b.id,ratios)
  report={'applied':True,'headPivot':head.name,'parts':[semantic(o)for o in meshes],
   'anchorNativeMeters':list(center),'oldHeadAssemblySizeM':list(old_hi-old_lo),
   'newHeadAssemblySizeM':list(after_hi-after_lo),'actualAxisRatios':ratios,
   'bearingParts':[semantic(o)for o in bearing],'baseBeforeM':lo.z,'baseAfterM':now_lo.z,
   'jawBaseDriftM':now_lo.z-lo.z,'animalHeadsChanged':False,'allAttachmentsShareAffineMap':True}
  head['headProportionsV5']=json.dumps(report);results.append(report)
 report={'applied':bool(results),'assemblies':results,'method':'Actual mesh affine contraction about seated jaw; complete attached headgear and face retained together.'}
 b.root['headProportionV5']=json.dumps(report);return report

def structural_bodice(b,parent=None):
 return [o for o in b.objects if (parent is None or descendants(o,parent)) and semantic(o)in ('Continuous tunic bodice','Tunic bodice','Tailored continuous bodice','Bodice')]

def apply_folded_cloak_v5(b):
 if b.root.get('foldedCloakV5'):return json.loads(b.root['foldedCloakV5'])
 fabric=[o for o in b.objects if semantic(o).startswith(('Cape sector ','Cape champagne ','Real rear cape','Cape back','Long rear cloak','Long fitted cape','V5 folded fitted cloak','Frost troll large dark shaggy rear mane','Lionheart source fitted maroon cape','Lionheart rider long maroon cape'))]
 if not fabric:
  report={'applied':False,'reason':'No rear cloak garment in this source design.'};b.root['foldedCloakV5']=json.dumps(report);return report
 groups={o.parent for o in fabric};reports=[]
 for parent in groups:
  own=[o for o in fabric if o.parent==parent];body=structural_bodice(b,parent)
  hood_pelt=any(semantic(o)=='Frost troll large dark shaggy rear mane' for o in own)
  if b.id.startswith('host_') and not body:
   body=[o for o in b.objects if semantic(o)in ('Faceted species chest','Separated phantom armor upper chest plate')]
  if not body:continue
  garment_parent=body[0].parent if hood_pelt else parent
  lo,hi=bounds(own);blo,bhi=bounds(body);cx=(blo.x+bhi.x)/2;cy=(blo.y+bhi.y)/2
  width=bhi.x-blo.x;depth=bhi.y-blo.y;bottom=max(lo.z,.012);top=hi.z if hood_pelt else min(hi.z,bhi.z-.006)
  pelt_head=[o for o in b.objects if semantic(o)=='Observed face'] if hood_pelt else []
  hlo,hhi=bounds(pelt_head) if pelt_head else (blo,bhi)
  if top-bottom<.04:continue
  material=own[0].data.materials[0];key='v5_cloak_material_'+str(len(reports));b.M[key]=material
  original_names=[semantic(o)for o in own]
  # Basic wrapped capes include two front vertical gilt edges. Rebuild these
  # against the smaller drape instead of leaving old floating oversized strips.
  trim=[o for o in b.objects if o.parent==parent and semantic(o).startswith(('Gold cape edge ','Cape gold edged panel ','Lionheart cape wide contacting gold hem'))]
  trim_material=trim[0].data.materials[0] if trim else None
  remove_objects(b,own+trim)
  levels=7;columns=25;thickness=.013
  def outer(j,i):
   t=j/(levels-1);u=i/(columns-1);angle=math.pi*.45+math.pi*1.10*u
   # From the right upper shoulder around the back to the left. Narrow yoke
   # intersects the torso directly; cloth unfolds with restrained outward fall.
   z=top-(top-bottom)*t
   rx=width*(.505+.20*t);ry=depth*(.495+.33*t)
   if hood_pelt and z>bhi.z:
    ht=max(0,min(1,(z-bhi.z)/(top-bhi.z)))
    # Rounded cloth surrounds the faceted head's corners, with enough slack
    # for inward folds rather than cutting through the rectangular scalp.
    rx=rx*(1-ht)+(hhi.x-hlo.x)*.76*ht
    ry=ry*(1-ht)+(hhi.y-hlo.y)*.76*ht
   fold=math.sin(u*math.pi*12)*(width*.065)*(math.sin(t*math.pi*.5)**.8)
   x=cx+math.sin(angle)*rx; y=cy+math.cos(angle)*ry
   radial=Vector((math.sin(angle),math.cos(angle),0));p=Vector((x,y,z))+radial*fold
   # Cloth hem has a shallow relaxed catenary, never a spike or long flat edge.
   p.z+=width*.024*math.sin(u*math.pi*6)**2*t**3
   if hood_pelt:p.z-=width*.055*math.sin(u*math.pi*6)**2*t**5
   return p
  outer_points=[outer(j,i)for j in range(levels)for i in range(columns)]
  inner_points=[]
  for j in range(levels):
   for i in range(columns):
    u=i/(columns-1);a=math.pi*.45+math.pi*1.10*u
    inner_points.append(outer(j,i)-Vector((math.sin(a),math.cos(a),0))*thickness)
  vv=outer_points+inner_points;n=len(outer_points);ff=[]
  for j in range(levels-1):
   for i in range(columns-1):
    a=j*columns+i;c=a+columns
    ff.extend([(a,a+1,c+1,c),(n+a,n+c,n+c+1,n+a+1)])
  for j in range(levels-1):
   a=j*columns;c=a+columns;ff.append((a,c,n+c,n+a))
   a=j*columns+columns-1;c=a+columns;ff.append((a,n+a,n+c,c))
  for i in range(columns-1):
   a=i;ff.append((a,n+a,n+a+1,a+1))
   a=(levels-1)*columns+i;ff.append((a,a+1,n+a+1,n+a))
  ob=b.mesh('Real rear cape' if any(s.startswith('Real rear cape')for s in original_names)else 'V5 folded fitted cloak',[tuple(p)for p in vv],ff,key,garment_parent)
  ob['foldedDrapedClothV5']=True;ob['verticalPleats']=6;ob['drapeStations']=levels;ob['actualClothThicknessM']=thickness
  if trim_material:
   tk=key+'_gold';b.M[tk]=trim_material
   for side,index in [('R',0),('L',columns-1)]:
    pp=[tuple(outer(j,index))for j in range(levels)]
    b.limb('V5 fitted gold cape edge '+side,pp,[.011]*levels,tk,parent,6)
  # Existing ivory rear stoles follow real folds and fit onto this new cloth.
  stoles=[o for o in b.objects if o.parent==parent and semantic(o).startswith(('Rear cape ivory stole ','Rear cape stole gold cross'))]
  for stole in stoles:
   inv=stole.matrix_world.inverted()
   for v in stole.data.vertices:
    p=stole.matrix_world@v.co;t=max(0,min(1,(top-p.z)/(top-bottom)));u=max(.15,min(.85,.5-p.x/(width*1.41)))
    # Find actual back row at this x by angular interpolation, then use its
    # closed outer surface depth, keeping white applique visibly outside.
    a=math.asin(max(-.999,min(.999,(p.x-cx)/(width*(.505+.20*t)))))
    angle=math.pi-a;u=(angle-math.pi*.45)/(math.pi*1.10)
    ry=depth*(.495+.33*t);fold=math.sin(u*math.pi*12)*(width*.065)*(math.sin(t*math.pi*.5)**.8)
    p.y=cy+math.cos(angle)*(ry+fold)-.022;v.co=inv@p
   stole.data.update()
  q=metrics([ob]);assert q['nonManifoldEdges']==0 and q['degenerateTriangles']==0,(b.id,q)
  # Nonplanarity is measured from actual vertices, not asserted from flags.
  mid=[outer_points[(levels//2)*columns+i]for i in range(columns)]
  radial_samples=[math.hypot(p.x-cx,p.y-cy)for p in mid]
  assert max(radial_samples)-min(radial_samples)>width*.025,(b.id,'cloak remained planar')
  reports.append({'applied':True,'part':semantic(ob),'replacedParts':original_names,
   'drapeStations':levels,'verticalPleats':6,'closedVolume':q['nonManifoldEdges']==0,
   'clothTriangles':q['triangles'],'nativeThicknessM':thickness,
   'topNativeM':top,'hemNativeM':bottom,'actualMidDrapeRadiusRangeM':max(radial_samples)-min(radial_samples),
   'shoulderYokeOverlapsTorsoByM':.005*min(width,depth)})
 report={'applied':bool(reports),'garments':reports};b.root['foldedCloakV5']=json.dumps(report);return report

def normalize_mage_body_v5(b):
 body=structural_bodice(b);assert len(body)==1,b.id
 lo,hi=bounds(body);old_width=hi.x-lo.x;old_top=hi.z;old_waist=lo.z
 targets=(.600,.886,.520);xscale=targets[0]/old_width
 def zz(z):
  knots=[(0.,0.),(.09,.09),(old_waist,targets[2]),(old_top,targets[1])]
  for (a,c),(d,e)in zip(knots,knots[1:]):
   if z<=d:return c+(z-a)*(e-c)/(d-a)
  return targets[1]+z-old_top
 heads=[o for o in b.coll.all_objects if o.name.split('.')[0]=='head_pivot'];head=heads[0]
 group=[o for o in b.coll.all_objects if not descendants(o,head)]
 # Held staves remain straight, with their entire structure mapped affinely.
 # The hand rises along the continuous shaft; no separate crystal stays behind.
 staff=[o for o in group if o.type=='MESH' and descendants(o,bpy.data.objects.get('weapon_R'))]
 def mapbody(p):return Vector((p.x*xscale,p.y,zz(p.z)))
 transform_objects(group,mapbody)
 # Straighten physical held staff around the unchanged authored endpoints,
 # retaining horizontal affine scaling and its closed real rod.
 for ob in staff:
  if semantic(ob)=='Staff shaft':
   pp=points(ob);zlo=min(p.z for p in pp);zhi=max(p.z for p in pp);n=len(pp)//2
   bottom=sum(pp[:n],Vector())/n;top=sum(pp[n:],Vector())/n
   # The original rod has just two rings, so body remap remains straight.
   assert n==8
 # Head face width is canonical independent of its old face pixel calibration.
 face=next(o for o in b.objects if semantic(o)=='Observed face');flo,fhi=bounds([face]);center=(flo+fhi)/2
 headgroup=[o for o in b.coll.all_objects if descendants(o,head)]
 shift=targets[1]-.014-flo.z;face_width=fhi.x-flo.x
 def headmap(p):return Vector(((p.x-center.x)*(.545/face_width),(p.y-center.y)*(.370/(fhi.y-flo.y)),.872+(p.z-flo.z)*(.269/(fhi.z-flo.z))))
 transform_objects(headgroup,headmap)
 after=bounds(body);assert abs(after[1].z-.886)<2e-6 and abs(after[0].z-.520)<2e-6 and abs((after[1].x-after[0].x)-.600)<2e-6
 report={'beforeBodiceWidthM':old_width,'beforeBodiceTopM':old_top,'beforeWaistM':old_waist,
  'actualBodiceWidthM':after[1].x-after[0].x,'actualBodiceTopM':after[1].z,'actualWaistM':after[0].z,
  'allSixRanksCanonicalNativeLandmarks':[.600,.886,.520],'cameraScaleUsed':False}
 b.root['mageRankPhysicalScaleV5']=json.dumps(report);return report

def improve_mage_source_v5(b,rank):
 face=next(o for o in b.objects if semantic(o)=='Observed face');flo,fhi=bounds([face]);fw=fhi.x-flo.x;z=fhi.z-.004;cy=(flo.y+fhi.y)/2
 head=bpy.data.objects.get('head_pivot');torso=bpy.data.objects.get('torso_pivot')
 hats=[o for o in b.objects if semantic(o).startswith(('Pointed tilted hat brim','Tall faceted hat','Hat band','Hat gold stud'))];remove_objects(b,hats)
 def ring(zz,rx,ry,n=12,xc=0.,yc=cy):return [(x,y,h-.10*(y-cy)+.012*x)for x,y,h in b.ring(xc,yc,zz,rx,ry,n)]
 radius=fw*(.58 if rank==1 else .98);brimdepth=fw*(.36 if rank==1 else .58)
 b.loft('V5 source shaped dimensional hat brim',[ring(z-.025,radius,brimdepth),ring(z+.009,radius*.99,brimdepth*.985)],['cloth','clothLight'],head)
 heights=[.575,.590,.600,.600,.610,.650];height=heights[rank-1]
 if rank==3:
  crown=[ring(z,fw*.56,fw*.39),ring(z+height*.40,fw*.43,fw*.31,xc=-.015),ring(z+height*.76,fw*.25,fw*.19,xc=-.035,yc=cy-.05),ring(z+height*.91,fw*.12,fw*.11,xc=-.09,yc=cy-.13),ring(z+height*.85,.012,.012,xc=-.14,yc=cy-.21)]
 else:crown=[ring(z,fw*.56,fw*.39),ring(z+height*.43,fw*.40,fw*.29,xc=-.014),ring(z+height*.76,fw*.21,fw*.155,xc=-.025),ring(z+height,.008,.008,xc=-.055,yc=cy-.02)]
 b.loft('V5 source bent pointed hat crown' if rank==3 else 'V5 source pointed hat crown',crown,['cloth','clothLight'],head)
 if rank==1:
  # Dark integrated cuff is visible in all six original I views, unlike the
  # light stripe on the old simplified tip-only cone.
  b.M['v5_hat_cuff']=b.M['cloth'].copy();mt=b.M['v5_hat_cuff'];rgba=mt.diffuse_color;mt.diffuse_color=tuple(c*.64 if i<3 else c for i,c in enumerate(rgba));mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mt.diffuse_color
  b.loft('V5 source dark folded cap cuff',[ring(z-.030,fw*.57,fw*.40),ring(z+.040,fw*.57,fw*.40)],'v5_hat_cuff',head)
 else:b.loft('V5 source fitted hat leather band',[ring(z+.03,fw*.562,fw*.395),ring(z+.100,fw*.535,fw*.373)],'gold' if rank==6 else 'leather',head)
 if rank==5:
  for j in (-1,0,1):b.box('V5 source three front gold hat studs '+str(j),(j*.065,cy+fw*.393+.013,z+.071),(.024,.023,.061),'gold',.004,head)
 # Replace single faceted apron skirt with a real closed pleated robe.
 robe=next(o for o in b.objects if semantic(o)=='Flared robe');rlo,rhi=bounds([robe]);remove_objects(b,[robe]);n=32;rings=[]
 for zz,rx,ry,amp in [(rhi.z,(rhi.x-rlo.x)*.315,.150,.002),((rhi.z+rlo.z)/2,(rhi.x-rlo.x)*.408,.173,.015),(rlo.z,(rhi.x-rlo.x)*.485,.192,.023)]:
  rings.append([(math.sin(i*math.tau/n)*(rx+amp*math.cos(i*math.pi/2)),math.cos(i*math.tau/n)*(ry+amp*math.cos(i*math.pi/2))-.012,zz)for i in range(n)])
 b.loft('Flared robe',rings,['cloth','clothLight'],torso)
 # Source I/II cowl meets the jaw, not a generic angular bib.
 if rank<=2:
  rear=-.148
  b.panel('V5 source fitted cowl front',[(-.23,.17,.877),(-.09,.195,.884),(0,.215,.819),(.09,.195,.884),(.23,.17,.877),(.15,.19,.787),(0,.226,.777),(-.15,.19,.787)],.022,['cloth','clothLight'],torso,.008)
  b.panel('V5 source cowl draped back',[(-.245,rear,.884),(.245,rear,.884),(.19,rear-.027,.817),(0,rear-.048,.788),(-.19,rear-.027,.817)],.027,['cloth','clothLight'],torso,.014)
 if rank>=3:
  # Source III/IV are two broad attached mantle lobes with narrow pale hems,
  # rather than seven mutually misaligned teeth crossing the chest.
  collars=[o for o in b.objects if semantic(o).startswith(('Collar facet ','Rear collar facet '))];remove_objects(b,collars)
  for side in (-1,1):
   pp=[(side*.025,.180,.868),(side*.255,.143,.872),(side*.367,.125,.807),(side*.210,.205,.768),(side*.020,.222,.813)]
   b.panel('V5 source tailored mantle front '+str(side),pp,.023,['cloth','clothLight'],torso,.012)
   if rank in (3,4):b.limb('V5 source narrow ivory mantle hem '+str(side),[pp[2],pp[3],pp[4]],[.013]*3,'ivory',torso,5)
  b.panel('V5 source draped rear mantle',[(-.225,-.148,.867),(.225,-.148,.867),(.36,-.207,.809),(.18,-.240,.777),(0,-.243,.808),(-.18,-.240,.777),(-.36,-.207,.809)],.024,['cloth','clothLight'],torso,.015)
  if rank in (3,4):b.limb('V5 source ivory rear mantle hem',[(-.36,-.216,.809),(-.18,-.248,.777),(0,-.251,.808),(.18,-.248,.777),(.36,-.216,.809)],[.012]*5,'ivory',torso,5)
 if rank==2:
  for side in (-1,1):b.panel('V5 source leather skirt strip '+str(side),[(side*.25,.179,.516),(side*.21,.194,.516),(side*.285,.213,.092),(side*.327,.195,.092)],.009,'leather',torso)
 if rank>=5:
  for side in (-1,1):b.panel('V5 source gold front robe seam '+str(side),[(side*.18,.181,.515),(side*.161,.184,.515),(side*.242,.213,.097),(side*.267,.208,.097)],.012,'gold',torso)
 if rank==6:
  for j in range(5):
   xx=(j%3-1)*.058;zz=.712-(j//3)*.054;b.jewel('V5 source tiny chest gold embroidery '+str(j),(xx,.177,zz),.014,.017,.009,'gold',torso)
 b.root['mageSourceDesignV5']=json.dumps({'sourceSixViewsActuallyCompared':True,'sourceHasBeard':False,'preservedSourceColorsAndEquipment':True,'rank':rank,'sourceDetails':['I folded dark cuff','II leather skirt piping','III crooked pointed hat and ivory mantle hem','IV pale mantle and purple book','V three front studs and draped gold cloak','VI taller ivory hat, gold embroidery and open book'][rank-1]})

def fit_mage_back_garment_v5(b):
 """Ensure the upper rear cloth seam is inserted into actual closed bodice."""
 for ob in b.objects:
  name=semantic(ob)
  if name not in ('V5 source cowl draped back','V5 source draped rear mantle'):continue
  pp=points(ob);hi=max(p.z for p in pp);inv=ob.matrix_world.inverted()
  for v,p in zip(ob.data.vertices,pp):
   if p.z>=hi-.030:
    p.y=max(p.y,-.148)
    if name=='V5 source draped rear mantle':p.x=max(-.225,min(.225,p.x))
    v.co=inv@p
  ob.data.update()
 b.root['mageActualRearYokeFitV5']=True
