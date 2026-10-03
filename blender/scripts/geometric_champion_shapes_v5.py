"""0.3.4 native champion corrections from the owner's reviewed 0.3.3 scene.

Coordinates are physical metres, +Y forward. This pass never regenerates a
champion from the original generic builder and never edits source references.
The shared head and cloth pass runs after these targeted assemblies are saved.
"""
import argparse, hashlib, json, math, shutil, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from geometric_game_common import Builder, metrics, export_and_check, geometry_digest, linear
from geometric_champion_creature_fit_v4 import descendants, points, semantic, remove, position
from geometric_roster_builder import ell, leaf

TARGETS=('frostblade','highking','crownofages','thunderheart','phoenix','mothernature','archbishop','archangel','ladyclaire')

def load_builder(entry):
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/entry['native']))
 root=bpy.data.objects[entry['id']]
 b=object.__new__(Builder);b.id=entry['id'];b.root=root
 b.coll=next(c for c in root.users_collection if c.name.startswith('MODEL'))
 b.objects=[o for o in root.children_recursive if o.type=='MESH']
 b.coverage=entry['qa'].get('coverage',[]);b.M={}
 for ob in b.objects:
  for mat in ob.data.materials:
   if mat:
    b.M[mat.name.split('.')[0]]=mat
 if 'dark'not in b.M:b.M['dark']=b.M.get('eyes')or material(b,'dark','14171A')
 return b

def material(b,key,color,metal=0,emission=0):
 rgba=tuple(linear(int(color[j:j+2],16)/255)for j in(0,2,4))+(1,)
 mat=bpy.data.materials.new(key);mat.use_nodes=True;mat.diffuse_color=rgba;mat['source_srgb']='#'+color
 sh=mat.node_tree.nodes['Principled BSDF'];sh.inputs['Base Color'].default_value=rgba
 sh.inputs['Metallic'].default_value=metal;sh.inputs['Roughness'].default_value=.43 if metal else .65
 sh.inputs['Emission Color'].default_value=rgba;sh.inputs['Emission Strength'].default_value=emission
 b.M[key]=mat;return mat

def tree(objects):
 vv=[];ff=[]
 for ob in objects:
  base=len(vv);vv.extend(points(ob));ff.extend(tuple(base+i for i in p.vertices)for p in ob.data.polygons)
 return BVHTree.FromPolygons(vv,ff,all_triangles=False,epsilon=.000001)

def boolean(b,subject,cutter,operation):
 bpy.context.view_layer.objects.active=subject
 mod=subject.modifiers.new('Physical '+operation,'BOOLEAN');mod.operation=operation;mod.solver='EXACT';mod.object=cutter
 bpy.ops.object.modifier_apply(modifier=mod.name);remove(b,[cutter])

def helmet(b,bottom,top,width,depth,metal,crest=True):
 """A continuous hollow crown, cheeks, chin and brow, cut by true apertures."""
 head=bpy.data.objects['head_pivot'];old=[o for o in b.objects if descendants(o,head)and semantic(o).startswith('Helmet ')]
 oldbounds=metrics(old);cy=(oldbounds['boundsMin'][1]+oldbounds['boundsMax'][1])/2
 remove(b,old)
 height=top-bottom
 dims=[(bottom,width*.38,depth*.36),(bottom+height*.24,width*.50,depth*.49),(bottom+height*.63,width*.49,depth*.50),(bottom+height*.85,width*.39,depth*.43),(top,width*.13,depth*.18)]
 def ring(z,rx,ry):
  # A central shallow front ridge is contiguous with the shell, not a plate.
  return [(x,cy+y,z)for x,y in[(-rx*.63,ry), (0,ry+.016), (rx*.63,ry),(rx,ry*.47),(rx,-ry*.48),(rx*.64,-ry),(-rx*.64,-ry),(-rx,-ry*.48),(-rx,ry*.47)]]
 outer=[ring(*q)for q in dims];inner=[ring(z-(.022 if j==4 else 0),rx-.023,ry-.023)for j,(z,rx,ry)in enumerate(dims)]
 n=9;nr=5;verts=sum(outer,[])+sum(inner,[]);fs=[];off=n*nr
 for k in range(nr-1):
  for j in range(n):
   jj=(j+1)%n;a=k*n;aa=(k+1)*n
   fs.extend([(a+j,a+jj,aa+jj,aa+j),(off+a+j,off+aa+j,off+aa+jj,off+a+jj)])
 for j in range(n):jj=(j+1)%n;fs.append((j,off+j,off+jj,jj))
 fs.append(tuple((nr-1)*n+j for j in range(n)))
 fs.append(tuple(reversed([off+(nr-1)*n+j for j in range(n)])))
 shell=b.mesh('Helmet V5 single continuous crown brow cheeks chin',verts,fs,metal,head)
 ez=bottom+height*.575;ey=cy+depth*.48
 for side in (-1,1):
  cut=b.box('temporary V5 actual visor aperture',(side*width*.21,ey,ez),(width*.21,.16,height*.095),'dark',.003)
  boolean(b,shell,cut,'DIFFERENCE')
  b.box('Helmet V5 shadow inside actual open eye aperture',(side*width*.21,ey-.045,ez),(width*.22,.009,height*.11),'dark',.001,head)
 shell['singleContinuousHelmetV5']=True;shell['physicalOpenEyeApertures']=2
 # Keep the retained head-seating contract bound to the actual replacement,
 # rather than leaving it pointed at the removed V4 shell.
 if b.root.get('humanoidHeadFitDetailsV4'):
  fit=json.loads(b.root['humanoidHeadFitDetailsV4'])
  for item in fit:
   if item.get('head')==head.name:item['bearingParts']=[semantic(shell)]
  b.root['humanoidHeadFitDetailsV4']=json.dumps(fit)
 if crest:
  b.panel('Helmet V5 fitted raised fin crest',[(0,cy-depth*.27,top-.045),(0,cy-depth*.11,top+.078),(0,cy+depth*.19,top-.023)],.035,'cloth',head,.010)
 b.coverage=[c for c in b.coverage if c.get('type')!='closed-helmet']+[{'type':'closed-helmet','shell':shell.name,'hiddenSkinMeshes':0,'rule':'One connected hollow armored helmet with actual visor apertures; no faceplate over an oval cap.'}]
 b.root['helmetShapeContractV5']='single-connected-hollow-shell-with-physical-apertures'
 return shell

def frostblade(b):
 # The reviewed chin remains in direct contact with the chest armor while
 # the new crown rises above it rather than becoming a wide pancake.
 material(b,'v5_knight_steel','CBD4D7',.58)
 shell=helmet(b,1.689,2.021,.404,.357,'v5_knight_steel')
 b.root['knightHelmetOverrideV5']='narrower, taller crown; chin seated on breastplate'
 return {'helmet':shell.name,'helmetWidthM':.404,'helmetHeightM':.332}

def highking(b):
 shell=helmet(b,.992,1.488,.475,.383,'steel_dark')
 return {'helmet':shell.name,'helmetWidthM':.475,'helmetHeightM':.496}

def king_shield(b):
 anchor=bpy.data.objects['weapon_L'].matrix_world.translation.copy()
 physical=[o for o in b.objects if descendants(o,bpy.data.objects['weapon_L'])and semantic(o).startswith(('Shield ','Royal fleur'))]
 assert physical
 # Actual straps and fleur-de-lis belong to the same enlargement about the
 # real held hand; the mounting point does not drift off the palm.
 for ob in physical:
  inv=ob.matrix_world.inverted()
  for v in ob.data.vertices:
   p=ob.matrix_world@v.co;d=p-anchor;v.co=inv@(anchor+Vector((d.x*1.26,d.y,d.z*1.26)))
  ob.data.update()
 b.root['kingShieldSizeOverrideV5']=1.26
 return {'scaledShieldParts':[o.name for o in physical],'scaleXZ':1.26,'heldAnchorM':list(anchor)}

def rider_body(b):
 torso=bpy.data.objects['torso_pivot'];shift=Vector((0,.28,0))
 # V4 correctly moved the thighs, real pelvis and saddle, but not the spine.
 # Move the whole torso/arms/head/weapon subtree once, preserving the already
 # forward physical pelvis so it cannot accidentally be translated twice.
 pelvis=[o for o in b.objects if semantic(o).startswith('Rider visible seated pelvis')]
 saved={o:o.matrix_world.copy()for o in pelvis}
 position(torso,torso.matrix_world.translation+shift)
 for ob,m in saved.items():ob.matrix_world=m
 bpy.context.view_layer.update()
 # The reins terminate at the actual unchanged mount muzzle after the hands
 # move. Their mesh is rebuilt from the new wrist rather than stretched.
 rein=[o for o in b.objects if semantic(o).startswith(('Rider connected leather reins','Horse rider contacting actual leather rein'))]
 remove(b,rein)
 weapon=bpy.data.objects['weapon_L'];start=weapon.matrix_world.translation
 mount=bpy.data.objects['mount_head_pivot'];endz=mount.matrix_world.translation.z-.20
 for side in (-1,1):b.rod('Rider V5 fitted actual rein from new wrist to muzzle',tuple(start),(side*.16,.76,endz),.012,'leather',weapon,6)
 b.root['wholeRiderSpineForwardV5']=.28
 return {'wholeTorsoSubtreeForwardM':.28,'pelvisTranslatedAgain':False,'legRootsM':{sn:list(bpy.data.objects['upper_leg_'+sn].matrix_world.translation)for sn in('R','L')},'torsoRootM':list(torso.matrix_world.translation)}

def nature(b):
 body=next(o for o in b.objects if o.get('integratedNatureFaceBody'));torso=bpy.data.objects['torso_pivot']
 remove(b,[o for o in b.objects if semantic(o).startswith(('Nature integrated recessed leaf eye socket','Nature integrated luminous almond eye'))])
 t=tree([body]);results=[]
 for side in(-1,1):
  x=side*.113;z=1.324
  hit=t.ray_cast(Vector((x,.6,z)),Vector((0,-1,0)),1)
  assert hit[0] is not None
  y=hit[0].y
  contour=[(x-.044,y+.013,z-.005),(x-.014,y+.013,z+.021),(x+.044,y+.013,z+.009),(x+.014,y+.013,z-.019)]
  cut=b.panel('temporary real shallow almond socket',contour,.064,'dark',torso)
  boolean(b,body,cut,'DIFFERENCE')
  # A thin luminous surface lies INSIDE the real material recess. It has no
  # protruding thick frame and follows the unified face's surface depth.
  eye=b.panel('Nature V5 flush recessed living almond light',[(x-.033,y-.006,z-.002),(x-.010,y-.006,z+.013),(x+.033,y-.006,z+.005),(x+.010,y-.006,z-.012)],.012,'nature_v4_luminous',torso)
  eye['visualCue']='natureSpiritEyes';eye['eyeRecessFromBodyM']=.006
  results.append({'side':side,'structuralSurfaceY':y,'eyeFrontY':y-.006,'eye':eye.name})
 # The source's living wreath overlaps into a leafy brow and collar, while
 # the face remains a portion of this single woody torso volume.
 for j in range(7):
  a=-math.pi*.43+j*math.pi*.86/6
  sx=.285*math.sin(a);zz=1.515+.050*math.cos(a)
  leaf(b,'Nature V5 overlapping crown leaf forming integrated living brow',(sx*.82,.095,zz+.06),(sx,.205,zz-.13),.077,'moss'if j%2 else'cloth_light',torso)
 for side in(-1,1):
  for j in range(3):
   leaf(b,'Nature V5 broad source leaf collar rosette',(side*.042,.12,1.118-j*.025),(side*(.18+j*.075),.235,1.005-j*.035),.096,'moss',torso)
 b.root['natureSpiritFaceContract']='unified-living-body-recessed-almond-eyes-v5'
 return {'eyes':results,'integratedFaceRetained':True,'protrudingEyeFrameRemoved':True}

def mitre(b):
 head=bpy.data.objects['head_pivot']
 front=next(o for o in b.objects if semantic(o)=='Archbishop high front mitre')
 rear=next(o for o in b.objects if semantic(o)=='Archbishop high rear mitre')
 lo=metrics([front,rear])['boundsMin'];hi=metrics([front,rear])['boundsMax']
 x=(lo[0]+hi[0])/2;z0=lo[2]+.05;zpeak=hi[2]-.020;width=(hi[0]-lo[0])*.95
 # A real convex internal crown fills the space between the front/back
 # points and slopes continuously across the two side roofs.
 outline=[(-width/2,z0),(-width/2,zpeak-.26),(x,zpeak),(width/2,zpeak-.26),(width/2,z0)]
 y0=lo[1]+.03;y1=hi[1]-.027
 vv=[(xx,yy,zz)for yy in(y0,y1)for xx,zz in outline];n=5
 fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,n+(j+1)%n,n+j)for j in range(n)]
 roof=b.mesh('Archbishop V5 fully closed internal mitre crown',vv,fs,'ivory',head)
 roof['fullyClosedMitreTop']=True
 b.root['archbishopMitreTopV5']='actual solid pitched crown between both front and rear lappets'
 return {'opaqueFullRoofMesh':roof.name}

def stretch_world(b,zfactor):
 # Bake a real anatomical proportion adjustment, including each named joint,
 # with feet grounded. Retain rotations and authored rigid attachments.
 bpy.context.view_layer.update();obs=[b.root]+list(b.root.children_recursive)
 matrices={o:o.matrix_world.copy()for o in obs}
 vertex_world={o:[o.matrix_world@v.co for v in o.data.vertices]for o in b.objects}
 def depth(o):return 0 if not o.parent else depth(o.parent)+1
 for ob in sorted(obs,key=depth):
  m=matrices[ob].copy();m.translation.z*=zfactor;ob.matrix_world=m
 bpy.context.view_layer.update()
 for ob,verts in vertex_world.items():
  inv=ob.matrix_world.inverted()
  for v,p in zip(ob.data.vertices,verts):v.co=inv@Vector((p.x,p.y,p.z*zfactor))
  ob.data.update()

def archangel(b):
 stretch_world(b,1.18)
 ivory=material(b,'v5_archangel_luminous_ivory','F4EBCF',.15)
 gold=material(b,'v5_archangel_warm_gold','D7AF59',.62)
 shade=material(b,'v5_archangel_deep_gold','A87F35',.55)
 light=material(b,'v5_archangel_divine_light','FFF4C2',.35,.24)
 for ob in b.objects:
  for j,m in enumerate(ob.data.materials):
   name=m.name.split('.')[0]
   if name in('cloth','cloth_light','steel','steel_light','steel_dark','trim','iceblue'):
    ob.data.materials[j]=ivory if name in('cloth','cloth_light')else shade if name=='steel_dark'else gold
  if semantic(ob).startswith('Helmet fitted source blue fin crest'):ob.data.materials.clear();ob.data.materials.append(gold)
  if semantic(ob).startswith('Helmet single integrated hollow armored visor shell'):
   ob.data.materials[0]=gold
 obsolete=[o for o in b.objects if descendants(o,bpy.data.objects['weapon_R'])and semantic(o).startswith(('Connected spear','Spear '))or semantic(o).startswith('Single offered ice orb')]
 remove(b,obsolete)
 for ob in list(b.root.children_recursive):
  if ob.type=='EMPTY'and ob.name.split('.')[0]in('staff_tip','attack_muzzle'):
   bpy.data.objects.remove(ob,do_unlink=True)
 wr=bpy.data.objects['weapon_R'];ha=wr.matrix_world.translation.copy();x,y,z=ha
 b.rod('Archangel divine sword fitted hilt',(x,y,z-.105),(x,y,z+.145),.030,'v5_archangel_deep_gold',wr,10)
 ell(b,'Archangel divine sword gold pommel',(x,y,z-.105),(.047,.043,.047),'v5_archangel_warm_gold',wr,10,4)
 guardz=z+.148
 b.panel('Archangel divine sword crossguard',[(x-.19,y,guardz-.018),(x-.17,y,guardz+.035),(x-.055,y,guardz+.032),(x,y,guardz+.070),(x+.055,y,guardz+.032),(x+.17,y,guardz+.035),(x+.19,y,guardz-.018)],.055,'v5_archangel_warm_gold',wr,.008)
 base=guardz+.043;tip=base+.72
 blade=b.panel('Archangel divine sword blade',[(x-.072,y,base),(x+.072,y,base),(x+.065,y,tip-.155),(x,y,tip),(x-.065,y,tip-.155)],.041,'v5_archangel_luminous_ivory',wr,.026)
 b.rod('Archangel divine sword luminous central fuller',(x,y+.024,base+.019),(x,y+.024,tip-.11),.007,'v5_archangel_divine_light',wr,6)
 # panel's authored outline is its front surface, with thickness behind it.
 # The tip endpoint is the centroid of the two actual apex vertices, not an
 # offset in front of the blade that drifts outside its bounds during a cut.
 vv=[blade.matrix_world@v.co for v in blade.data.vertices]
 apex_z=max(p.z for p in vv);apex=[p for p in vv if abs(p.z-apex_z)<1e-6]
 actual_tip=sum(apex,Vector())/len(apex)
 b.pivot('sword_tip',actual_tip,wr);b.pivot('attack_muzzle',actual_tip,wr)
 b.root['attackStyle']='sword';b.root['archangelDivineWeaponV5']='holy-sword';b.root['archangelHeightUserOverrideV5']=1.18
 b.root['archangelPaletteUserOverrideV5']='warm gold and ivory with divine light; no spear or hand orb'
 return {'swordBlade':blade.name,'swordTipM':list(actual_tip),'heightFactor':1.18,'freeHandOrbRemoved':True,'attackStyle':'sword'}

def repair_final_bindings_v5(b):
 """Update semantic contracts/markers without touching any mesh geometry."""
 changes={}
 if b.id in ('frostblade','highking'):
  shell=next(o for o in b.objects if o.get('singleContinuousHelmetV5'))
  fit=json.loads(b.root['humanoidHeadFitDetailsV4'])
  old=[dict(item)for item in fit]
  for item in fit:
   if item.get('head')==shell.parent.name:item['bearingParts']=[semantic(shell)]
  b.root['humanoidHeadFitDetailsV4']=json.dumps(fit)
  changes['actualHelmetBearingContract']={'before':old,'after':fit}
 if b.id=='archangel':
  blade=next(o for o in b.objects if semantic(o)=='Archangel divine sword blade')
  vv=[blade.matrix_world@v.co for v in blade.data.vertices]
  zz=max(p.z for p in vv);apex=[p for p in vv if abs(p.z-zz)<1e-6]
  actual_tip=sum(apex,Vector())/len(apex)
  assert len(apex)==2,('expected front/back actual blade apex',len(apex))
  weapon=bpy.data.objects['weapon_R']
  for name in ('sword_tip','attack_muzzle'):
   marker=bpy.data.objects[name];b.attach(marker,weapon);position(marker,actual_tip)
   marker['physicalApexCentroidBoundV5']=True
  changes['actualSwordApexBinding']={'apexVerticesM':[list(p)for p in apex],'centroidM':list(actual_tip),'markers':['sword_tip','attack_muzzle'],'parent':weapon.name}
 return changes

def repair_bindings_main(ids):
 path=ROOT/'public/assets/geometric/geometric-champions.json'
 manifest=json.loads(path.read_text(encoding='utf-8'));rows=[]
 for entry in manifest['entries']:
  if entry['id']not in ids:continue
  b=load_builder(entry);before=geometry_digest(b.objects)
  changes=repair_final_bindings_v5(b)
  assert geometry_digest(b.objects)==before,(b.id,'marker repair changed physical geometry')
  q={**entry['qa'],**export_and_check(b,ROOT/'public/assets/geometric'/entry['file'])}
  assert q['geometrySha256']==before and q['nonManifoldEdges']==0
  native=ROOT/entry['native'];bpy.context.preferences.filepaths.save_version=0
  bpy.ops.wm.save_as_mainfile(filepath=str(native));entry['qa']=q
  entry['finalBindingRepairV5']=changes
  rows.append({'id':b.id,'nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'glbSha256':q['fileSha256'],'geometrySha256':before,'changes':changes,'geometryUnchanged':True})
 path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 out=ROOT/'output/design/geometric-game-v5/champion-final-binding-repair.json'
 out.write_text(json.dumps({'revision':'geometric-game-v5','method':'Actual apex vertices and retained head surface contracts; mesh geometry is unchanged.','entries':rows},indent=2)+'\n',encoding='utf-8')
 print('FINAL_BINDING_REPAIR '+json.dumps(rows),flush=True)

def claire(b):
 weapon=bpy.data.objects['weapon_R'];ring=bpy.data.objects['Staff open faceted ring']
 fit=json.loads(b.root['humanoidHeadFitDetailsV4'])[0]['downwardHeadFitM']
 # V4 accidentally treated the staff ring as headwear. Restore its exact
 # approved vertical registration to its unchanged ring socket and shaft.
 m=ring.matrix_world.copy();m.translation.z+=fit;ring.matrix_world=m;b.attach(ring,weapon)
 tip=bpy.data.objects['staff_tip'];b.attach(tip,weapon)
 names=['Staff golden shaft','Staff foot','Staff ring socket','Staff open faceted ring']
 assert all(descendants(bpy.data.objects[n],weapon)for n in names)
 ring['wholePhysicalStaffRigidV5']=True;tip['physicalHeldStaffTipV5']=True
 b.root['claireStaffPhysicalRigV5']='all four actual shaft/socket/ring/foot meshes and staff_tip rigidly parented to weapon_R'
 return {'physicalHeldParts':names,'staffRingRestoredUpM':fit,'staffTipParent':tip.parent.name,'staffRingParent':ring.parent.name}

APPLIERS={'frostblade':frostblade,'highking':highking,'crownofages':king_shield,'thunderheart':rider_body,'phoenix':rider_body,'mothernature':nature,'archbishop':mitre,'archangel':archangel,'ladyclaire':claire}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='*',default=TARGETS);ap.add_argument('--repair-bindings',action='store_true')
 ap.add_argument('--baseline-manifest',type=Path,help='Read exact V4 input entries from this manifest for a clean V4 -> targeted V5 -> shared V5 rebuild; write the current public champion manifest.')
 args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[])
 if args.repair_bindings and args.baseline_manifest:ap.error('--repair-bindings operates on the current final assets and cannot use --baseline-manifest')
 if args.repair_bindings:return repair_bindings_main(args.only)
 path=(ROOT/'public/assets/geometric/geometric-champions.json').resolve()
 baseline=args.baseline_manifest
 if baseline and not baseline.is_absolute():baseline=ROOT/baseline
 if baseline:
  baseline=baseline.resolve()
  assert baseline!=path,'Baseline input is immutable; output must be a different manifest path.'
  baseline_sha=hashlib.sha256(baseline.read_bytes()).hexdigest()
 source=baseline or path
 manifest=json.loads(source.read_text(encoding='utf-8'));reports=[]
 if baseline:
  # The supplied immutable manifest is authoritative for ALL entries in this
  # authoring stage. A subsequent shared pass must start from this new output.
  # Never silently reapply geometry to a final V5 scene.
  for entry in manifest['entries']:
   if entry['id']in args.only:
    assert entry.get('championShapesRevision')!='geometric-champion-shapes-v5' and 'geometric-game-v5'not in entry['native'],('expected original V4 native',entry['id'],entry['native'])
 for entry in manifest['entries']:
  if entry['id']not in args.only:continue
  if entry.get('championShapesRevision')=='geometric-champion-shapes-v5':
   reports.append({'id':entry['id'],'changes':entry.get('targetedChangesV5',{}),'nativeSha256':hashlib.sha256((ROOT/entry['native']).read_bytes()).hexdigest(),'glbSha256':entry['qa']['fileSha256'],'geometrySha256':entry['qa']['geometrySha256'],'roundtripBoundsError':entry['qa']['roundtripBoundsError'],'awaitingSharedHeadCloakPassAndFreshViews':True,'previousCompletedPassRetained':True})
   continue
  prior={'nativeSha256':hashlib.sha256((ROOT/entry['native']).read_bytes()).hexdigest(),'glbSha256':entry['qa']['fileSha256']if baseline else hashlib.sha256((ROOT/'public/assets/geometric'/entry['file']).read_bytes()).hexdigest(),'native':entry['native']}
  if baseline:prior.update({'baselineManifest':baseline.relative_to(ROOT).as_posix()if baseline.is_relative_to(ROOT)else baseline.as_posix(),'baselineManifestSha256':baseline_sha,'glbEvidence':'Exact preserved V4 manifest digest; current GLB is overwritten by the clean rebuild.'})
  b=load_builder(entry);changes=APPLIERS[b.id](b)
  b.root['championShapesRevision']='geometric-champion-shapes-v5';b.root['assetRevision']='geometric-game-v5'
  q=export_and_check(b,ROOT/'public/assets/geometric'/entry['file']);assert q['nonManifoldEdges']==0,(b.id,q['nonManifoldEdges'])
  q['headCoverage']=entry['qa'].get('headCoverage',[])
  native=ROOT/f'blender/scenes/geometric-game-v5/champions/{b.id}.blend';native.parent.mkdir(parents=True,exist_ok=True)
  assert native.resolve()!=(ROOT/prior['native']).resolve(),(b.id,'historical native must be immutable')
  bpy.ops.wm.save_as_mainfile(filepath=str(native))
  assert hashlib.sha256((ROOT/prior['native']).read_bytes()).hexdigest()==prior['nativeSha256'],(b.id,'historical native changed during authoring')
  entry.update({'native':str(native.relative_to(ROOT)).replace('\\','/'),'qa':q,'attackStyle':b.root['attackStyle'],'championShapesRevision':'geometric-champion-shapes-v5','targetedChangesV5':changes})
  reports.append({'id':b.id,'prior':prior,'changes':changes,'nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'glbSha256':q['fileSha256'],'geometrySha256':q['geometrySha256'],'roundtripBoundsError':q['roundtripBoundsError'],'awaitingSharedHeadCloakPassAndFreshViews':True})
  path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
  print('TARGETED V5 '+b.id+' '+json.dumps(changes),flush=True)
 out=ROOT/'output/design/geometric-game-v5';out.mkdir(parents=True,exist_ok=True)
 reportpath=out/'targeted-champion-shape-pass.json'
 prior_reports={r['id']:r for r in json.loads(reportpath.read_text())['changes']}if reportpath.exists()and not baseline else{}
 for report in reports:
  if report['id']in prior_reports and 'prior'in prior_reports[report['id']]:report['prior']=prior_reports[report['id']]['prior']
  prior_reports[report['id']]=report
 reportpath.write_text(json.dumps({'reportStage':'intermediate-targeted-champion-shapes-before-shared-head-cloak-pass','changes':list(prior_reports.values()),'originalSourcesModified':False},indent=2)+'\n',encoding='utf-8')
 if baseline:assert hashlib.sha256(baseline.read_bytes()).hexdigest()==baseline_sha,'Baseline input changed during authoring.'

if __name__=='__main__':main()
