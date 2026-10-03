"""Owned append-only V6 author for 32 unmounted enemy source repairs.

Inputs are frozen V5 MF/native/source bytes. Outputs have new V6 paths and a
separate stage manifest; this script never updates the current public manifest.
"""
import bpy,bmesh,json,hashlib,sys,argparse,math,shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from geometric_game_common import Builder,metrics,export_and_check,geometry_digest,studio
from geometric_enemy_creature_anatomy_v6 import apply_creature_anatomy_v6
from geometric_enemy_humanoid_equipment_v6 import apply_humanoid_equipment_v6,UNMOUNTED
from geometric_champion_creature_fit_v4 import semantic
from geometric_champion_shapes_v5 import material
OUT=ROOT/'output/design/geometric-game-v6'
VIEWS=[('front',0),('back',180),('left',-90),('right',90),('three-quarter-front',35),('three-quarter-back',145)]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def adapter(aid):
 root=bpy.data.objects[aid];b=Builder.__new__(Builder);b.id=aid;b.root=root;b.coll=next(c for c in root.users_collection if c.name.startswith('MODEL'));b.objects=[o for o in b.coll.all_objects if o.type=='MESH'];b.coverage=[];b.M={};b.palette={}
 for ob in b.objects:
  for mat in ob.data.materials:
   if mat:b.M.setdefault(mat.name.split('.')[0],mat)
 for mat in bpy.data.materials:b.M.setdefault(mat.name.split('.')[0],mat)
 for key,color in({'dark':'202124','ivory':'D9D2B7','steel':'A9ADB0','steel_dark':'555962','skin_light':'899258','moss':'536F37'}).items():
  if key not in b.M:material(b,key,color)
 return b
def render(b,where,size):
 where.mkdir(parents=True,exist_ok=True);cam,target=studio(b.objects,(size,round(size*1.15)));bpy.context.scene.cycles.samples=12;before=geometry_digest(b.objects);out=[]
 for name,az in VIEWS:
  a=math.radians(az);e=math.radians(12);cam.location=target+Vector((8*math.sin(a)*math.cos(e),8*math.cos(a)*math.cos(e),8*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();p=where/(name+'.png');bpy.context.scene.render.filepath=str(p);assert before==geometry_digest(b.objects);bpy.ops.render.render(write_still=True);out.append({'view':name,'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'geometrySha256':before,'cameraPosition':list(cam.location),'orthoScale':cam.data.ortho_scale})
 return out

def preserve_source_boss_height(b,before):
 current=metrics(b.objects);factor=max(1,before['boundsSize'][2]/current['boundsSize'][2])
 if factor<=1+1e-7:return {'factor':1,'baselineHeightM':before['boundsSize'][2],'finalHeightM':current['boundsSize'][2]}
 # Scale the actual whole physical rig and geometry about its grounded sole,
 # preserving natural source proportions and every real interface.
 for ob in b.root.children_recursive:
  if ob.type=='MESH':
   for v in ob.data.vertices:v.co*=factor
   ob.data.update()
  ob.location*=factor
 bpy.context.view_layer.update()
 return {'factor':factor,'baselineHeightM':before['boundsSize'][2],'finalHeightM':metrics(b.objects)['boundsSize'][2]}

CURRENT_CLOTH_SCOPES_V6={
 'host_07':('V6 marsh dense contacting wraparound reed leaf mantle',),
 'host_08':('V6 shadowblood continuous folded fitted dark back hide','V6 shadowblood actual overlapping ragged upper hide fold'),
 'host_09':('V6 dust dancer source fitted overlapping ragged rear leather cloak',),
 'host_18':('V6 silent executioner real long folded charcoal rune cloak',),
 'host_23':('V6 source overlapping ragged mantle tier',),
 'host_31':('V6 detail inquisitor continuous folded source robe / secondary 1',),
 'host_33':('V6 detail source long folded ragged trailing purple cloak / long mantle','V6 detail source overlapping pointed mantle / secondary'),
 'host_38':('V6 detail source overlapping pointed mantle / secondary',),
 'host_44':('V6 ash executioner real ankle length folded dark purple robe','V6 ash executioner actual fitted dark purple shoulder mantle flap')
}
EXACT_GROUND_ACTORS_V6={'host_08','host_17','host_20','host_21','host_32','host_49'}

def finalize_actual_ground_and_cloth_v6(b,aid):
 """Fit actual rest soles and bind legacy cloth audit to replacement surfaces.

 Only source18/31 receive new closed physical middle drape stations. Their
 original station and bearing vertices stay fixed; new rings have a small
 genuine contour fold, applied consistently to both cloth surfaces. Scope
 metadata selects meshes; independent exported triangles decide acceptance.
 """
 proof={'ground':None,'cloth':None};cloth=[]
 if aid in CURRENT_CLOTH_SCOPES_V6:
  prefixes=CURRENT_CLOTH_SCOPES_V6[aid];cloth=[o for o in b.objects if any(semantic(o).startswith(p)for p in prefixes)];assert cloth,(aid,'actual replacement cloth missing')
  if aid in('host_18','host_31'):
   for ob in cloth:
    old=[ob.matrix_world@v.co for v in ob.data.vertices];heights={round(p.z,7)for p in old};lo=Vector(tuple(min(p[k]for p in old)for k in range(3)));hi=Vector(tuple(max(p[k]for p in old)for k in range(3)));c=(lo+hi)/2;size=hi-lo
    bm=bmesh.new();bm.from_mesh(ob.data);edges=[e for e in bm.edges if abs((ob.matrix_world@e.verts[0].co).z-(ob.matrix_world@e.verts[1].co).z)>.00001];bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True);bm.to_mesh(ob.data);bm.free();inv=ob.matrix_world.inverted();folded=0
    for v in ob.data.vertices:
     p=ob.matrix_world@v.co
     if round(p.z,7)in heights:continue
     if aid=='host_18':p.y+=.0018*math.cos(p.x/max(size.x,.01)*math.tau*3)*math.sin((p.z-lo.z)/max(size.z,.01)*math.pi)
     else:
      radial=Vector((p.x-c.x,p.y-c.y,0));a=math.atan2(radial.y,radial.x);radial.normalize();p+=radial*(.0020*math.cos(3*a)*math.sin((p.z-lo.z)/max(size.z,.01)*math.pi))
     v.co=inv@p;folded+=1
    ob.data.update();assert folded>0,(aid,'new actual middle folds required')
   bpy.context.view_layer.update()
  legacy=json.loads(b.root['foldedCloakV5']);parts=sorted(set(semantic(o)for o in cloth))
  for garment in legacy['garments']:
   garment['parts']=parts;garment['currentPhysicalScopeRevision']='geometric-game-v6';garment['previousV5PartReferenceRetainedForHistory']=True
  b.root['foldedCloakV5']=json.dumps(legacy)
  proof['cloth']={'parts':parts,'actualNativeVertices':sum(len(o.data.vertices)for o in cloth),'actualDrapeElevations':len({round((o.matrix_world@v.co).z,5)for o in cloth for v in o.data.vertices}),'newPhysicalMiddleFoldAmplitudeM':.0018 if aid=='host_18'else .0020 if aid=='host_31'else 0}
 if aid in EXACT_GROUND_ACTORS_V6:
  before=metrics(b.objects);offset=Vector((0,0,-before['boundsMin'][2]))
  # Translate every immediate rig child once, including marker empties. Moving
  # only feet or a render root would disconnect real joints or be normalized
  # away by the production loader.
  for child in list(b.root.children):
   m=child.matrix_world.copy();m.translation+=offset;child.matrix_world=m
  bpy.context.view_layer.update();after=metrics(b.objects);assert abs(after['boundsMin'][2])<.000001,(aid,'exact actual ground',after['boundsMin'][2]);assert abs(after['boundsSize'][2]-before['boundsSize'][2])<.000001,(aid,'whole height invariant')
  if b.root.get('headProportionV5'):
   head=json.loads(b.root['headProportionV5'])
   for assembly in head.get('assemblies',[]):
    bearing=[o for o in b.objects if semantic(o)in assembly.get('bearingParts',[])];assert bearing
    assembly['baseBeforeM']=metrics(bearing)['boundsMin'][2]
   b.root['headProportionV5']=json.dumps(head)
  proof['ground']={'previousMinimumM':before['boundsMin'][2],'worldZOffsetM':offset.z,'actualFinalMinimumM':after['boundsMin'][2],'actualHeightBeforeM':before['boundsSize'][2],'actualHeightAfterM':after['boundsSize'][2],'allImmediateRigChildrenMovedTogether':True}
 b.root['finalPhysicalGroundClothBindingsV6']=json.dumps(proof)
 return proof

def main(args):
 mfpath=(ROOT/args.baseline_manifest).resolve();stage=(ROOT/args.stage_manifest).resolve();assert mfpath!=stage
 mfhash=sha(mfpath);mf=json.loads(mfpath.read_text(encoding='utf8'));entries=mf['entries'];chosen=set(args.ids.split(','))if args.ids else{f'host_{w:02d}'for w in UNMOUNTED};assert chosen<={f'host_{w:02d}'for w in UNMOUNTED}
 prior=json.loads(stage.read_text(encoding='utf8'))if stage.exists()else{'revision':'geometric-game-v6','stageOwner':'humanoidAndEquipment','baselineManifest':mfpath.relative_to(ROOT).as_posix(),'baselineManifestSha256':mfhash,'entries':[]};outrows={r['id']:r for r in prior['entries']};reports=[]
 for row0 in entries:
  if row0['id']not in chosen:continue
  row=json.loads(json.dumps(row0));aid=row['id'];old=ROOT/row['native'];assert 'geometric-game-v6'not in old.as_posix(),(aid,'input must be immutable V5 native');oldhash=sha(old);src=ROOT/'output/design/geometric-turnarounds-v1'/row['source'];sourcehash=sha(src);assert sourcehash==row['sourceSha256']
  bpy.ops.wm.open_mainfile(filepath=str(old));b=adapter(aid);before=metrics(b.objects)
  anatomy=apply_creature_anatomy_v6(b,row);equipment=apply_humanoid_equipment_v6(b,row,anatomy=anatomy)
  if aid in('host_10','host_20'):equipment['actualBossHeightPreservation']=preserve_source_boss_height(b,before)
  equipment['finalPhysicalGroundClothBindings']=finalize_actual_ground_and_cloth_v6(b,aid)
  # Repair only rare almost-collinear legacy/Boolean triangulations with the
  # existing fixed area threshold. No tolerance relaxations or invisible skin.
  repairs=[]
  for name in metrics(b.objects)['degenerateParts']:
   ob=next(o for o in b.objects if o.name==name);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY');bm.to_mesh(ob.data);bm.free();ob.data.update()
   if metrics([ob])['degenerateTriangles']:
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.dissolve_degenerate(bm,dist=.00002,edges=list(bm.edges));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
   assert not metrics([ob])['degenerateTriangles'];repairs.append({'part':name,'maximumEdgeCollapseM':.00002})
  q=metrics(b.objects);assert q['nonManifoldEdges']==0,(aid,q['nonManifoldEdges']);assert abs(q['boundsMin'][2])<.002,(aid,'ground contact',q['boundsMin'])
  if aid in('host_10','host_20'):assert q['boundsSize'][2]>=before['boundsSize'][2]-1e-5,(aid,'source boss cannot shrink below retained user V5 height',before['boundsSize'][2],q['boundsSize'][2])
  b.root['assetRevision']='geometric-game-v6';b.root['sourceEnemyRepairV6']=json.dumps({'anatomy':anatomy,'equipment':equipment,'baselineNativeSha256':oldhash,'baselineSourceSha256':sourcehash});b.root['sourceSha256']=sourcehash
  # Bind actual structural names after replacement; retain contracts only when
  # their referenced geometry still exists. Root QA samples actual triangles.
  actualsem={semantic(o)for o in b.objects}
  for key in('humanoidHeadFitDetailsV4','humanoidHeadFitV4'):
   if b.root.get(key):
    try:
     value=json.loads(b.root[key]);items=value if isinstance(value,list)else[value]
     for item in items:
      if isinstance(item,dict)and'bearingParts'in item:item['bearingParts']=['Observed face']if'Observed face'in actualsem else['V6 revenant continuous actual open armored helmet shell']
     b.root[key]=json.dumps(value)
    except(TypeError,ValueError):pass
  glb=ROOT/'public/assets/geometric/enemies-v6'/(aid+'.glb');q=export_and_check(b,glb);views=render(b,OUT/'enemies/renders'/aid,args.size)
  portrait=ROOT/'public/assets/geometric/portraits-v6'/(aid+'.png');portrait.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/views[4]['path'],portrait)
  native=ROOT/'blender/scenes/geometric-game-v6/enemies'/(aid+'.blend');native.parent.mkdir(parents=True,exist_ok=True);assert old.resolve()!=native.resolve();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(native));assert sha(old)==oldhash and sha(src)==sourcehash and sha(mfpath)==mfhash
  eyes=[o for o in b.objects if semantic(o)in('Eye L','Eye R')]
  landmarks={semantic(o):list(sum((o.matrix_world@v.co for v in o.data.vertices),Vector())/len(o.data.vertices))for o in eyes}
  row.update({'file':glb.relative_to(ROOT/'public/assets/geometric').as_posix(),'portrait':portrait.relative_to(ROOT/'public/assets/geometric').as_posix(),'native':native.relative_to(ROOT).as_posix(),'qa':q,'views':views,'sourceRepairRevision':'geometric-game-v6','baselineNativeSha256':oldhash,'baselineGlbSha256':row0['qa']['fileSha256'],'sourceRepairsV6':{'anatomy':anatomy,'equipment':equipment},'landmarksNative':landmarks})
  q['baselineJointContactsV5']=row0['qa'].get('jointSurfaceContactsRest',[]);q['baselineContactsAreFreshV6']=False
  outrows[aid]=row;prior['entries']=list(outrows.values());stage.parent.mkdir(parents=True,exist_ok=True);stage.write_text(json.dumps(prior,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  reports.append({'id':aid,'baselineNative':row0['native'],'baselineNativeSha256':oldhash,'finalNative':row['native'],'finalNativeSha256':sha(native),'finalGlbSha256':q['fileSha256'],'sourceSha256':sourcehash,'geometrySha256':q['geometrySha256'],'sourceAnatomy':anatomy,'sourceEquipment':equipment,'roundtripBoundsError':q['roundtripBoundsError'],'fixedThresholdMicroedgeRepairs':repairs,'views':views,'sourceReviewRequired':True});print('V6_AUTHOR_COMPLETE '+aid,flush=True)
 dest=OUT/'humanoid-author-report.json';oldreports=json.loads(dest.read_text(encoding='utf8'))if dest.exists()else[];combined={r['id']:r for r in oldreports};combined.update({r['id']:r for r in reports});dest.write_text(json.dumps(list(combined.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf8');assert sha(mfpath)==mfhash
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--baseline-manifest',default='output/design/geometric-game-v6/baseline-v5-manifests/geometric-enemies.json');p.add_argument('--stage-manifest',default='output/design/geometric-game-v6/stage-humanoid-enemies.json');p.add_argument('--ids',default='');p.add_argument('--size',type=int,default=300);main(p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[]))
