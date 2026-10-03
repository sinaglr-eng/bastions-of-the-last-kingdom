"""Append-only native V5 work from current manifest-backed V4/V5 scenes.

Only current public model/portrait/manifest pointers advance. Earlier scenes,
renders, reports, original source rasters and release ZIPs are never modified.
"""
import bpy,bmesh,sys,json,hashlib,argparse,shutil,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from geometric_game_common import Builder,export_and_check,geometry_digest,studio,metrics,linear
from geometric_character_proportions_v5 import apply_head_proportions_v5,apply_folded_cloak_v5,normalize_mage_body_v5,improve_mage_source_v5,fit_mage_back_garment_v5
VIEWS=[('front',0),('back',180),('left',-90),('right',90),('three-quarter-front',35),('three-quarter-back',145)]

def adapter(aid):
 root=next(o for o in bpy.data.objects if o.name==aid and o.type=='EMPTY')
 coll=next(c for c in root.users_collection if c.name.startswith('MODEL'))
 b=Builder.__new__(Builder);b.id=aid;b.root=root;b.coll=coll;b.objects=[o for o in coll.all_objects if o.type=='MESH'];b.coverage=[];b.M={}
 for ob in b.objects:
  for m in ob.data.materials:
   if m:b.M.setdefault(m.name.split('.')[0],m)
 for name,color in [('ivory','F1E4C9'),('gold','D8AC52'),('leather','694B35')]:
  if name in b.M:continue
  mt=bpy.data.materials.new(name);mt.use_nodes=True;rgba=tuple(linear(int(color[i:i+2],16)/255)for i in (0,2,4))+(1,);mt.diffuse_color=rgba;mt['source_srgb']='#'+color;shader=mt.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=rgba;shader.inputs['Roughness'].default_value=.68;shader.inputs['Metallic'].default_value=.25 if name=='gold'else 0;b.M[name]=mt
 return b

def render(b,dest,size):
 dest.mkdir(parents=True,exist_ok=True);cam,target=studio(b.objects,(size,round(size*1.15)));scene=bpy.context.scene
 scene.cycles.samples=8;before=geometry_digest(b.objects);out=[]
 for name,az in VIEWS:
  a=math.radians(az);e=math.radians(12);cam.location=target+Vector((8*math.sin(a)*math.cos(e),8*math.cos(a)*math.cos(e),8*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();path=dest/(name+'.png');scene.render.filepath=str(path);assert before==geometry_digest(b.objects);bpy.ops.render.render(write_still=True)
  out.append({'view':name,'path':path.relative_to(ROOT).as_posix(),'file':path.relative_to(ROOT).as_posix(),'geometrySha256':before,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'cameraPosition':list(cam.location),'orthoScale':cam.data.ortho_scale})
 return out

def run(args):
 cat=args.category;current_manifest=ROOT/'public/assets/geometric'/('geometric-'+cat+'.json')
 manifest_path=(ROOT/args.output_manifest).resolve() if args.output_manifest else current_manifest
 input_manifest=(ROOT/args.baseline_manifest).resolve() if args.baseline_manifest else current_manifest
 if args.baseline_manifest:assert input_manifest!=manifest_path,'Baseline input is immutable; output must be a different manifest path.'
 input_sha=hashlib.sha256(input_manifest.read_bytes()).hexdigest()
 manifest=json.loads(input_manifest.read_text(encoding='utf8'));key='assets'if cat=='defenders'else'entries';rows=manifest[key]
 manifest_path.parent.mkdir(parents=True,exist_ok=True)
 selected=[row for row in rows if not args.ids or row['id']in args.ids.split(',')]
 out=ROOT/'output/design/geometric-game-v5'/cat;report_path=out/'proportion-pass-report.json';reports=json.loads(report_path.read_text(encoding='utf8'))if report_path.exists()else[]
 for row in selected:
  aid=row['id'];native_key='nativeFile'if cat=='defenders'else'native';old_path=ROOT/row[native_key]
  if args.force and cat=='defenders':old_path=ROOT/'blender/scenes/geometric-game-v1/defenders'/(aid+'.blend')
  bpy.ops.wm.open_mainfile(filepath=str(old_path));b=adapter(aid)
  if b.root.get('geometricProportionsV5Completed') and not args.force and not args.cloth_only and not args.mage_yoke_fit:
   print('V5_SKIP_COMPLETED '+aid,flush=True);continue
  previous_glb=hashlib.sha256((ROOT/'public/assets/geometric'/row['file']).read_bytes()).hexdigest();old_native_sha=hashlib.sha256(old_path.read_bytes()).hexdigest()
  if args.cloth_only and b.root.get('foldedCloakV5'):del b.root['foldedCloakV5']
  if cat=='defenders'and row.get('family')=='mage'and not args.cloth_only and not args.mage_yoke_fit:normalize_mage_body_v5(b);improve_mage_source_v5(b,int(row['rank']));fit_mage_back_garment_v5(b)
  elif args.mage_yoke_fit:fit_mage_back_garment_v5(b)
  heads=apply_head_proportions_v5(b)if cat!='enemies'else{'applied':False,'reason':'Enemy head anatomy retained; requested tower proportion change only.'}
  cloak=apply_folded_cloak_v5(b);changed=heads.get('applied')or cloak.get('applied')or(cat=='defenders'and row.get('family')=='mage')or'geometric-game-v5'in old_path.as_posix()
  if not changed:
   reports=[r for r in reports if r['id']!=aid];reports.append({'id':aid,'changed':False,'inheritedGlbSha256':previous_glb,'inheritedNativeSha256':old_native_sha,'head':heads,'cloak':cloak});print('V5_INHERIT '+aid,flush=True);continue
  b.root['assetRevision']='geometric-game-v5';b.root['geometricProportionsV5Completed']=True;b.root['headProportionUserOverrideV5']='Slightly smaller tower human head assemblies; seated jaw maintained. Enemy and animal anatomy retained.'
  # Slight contraction may expose a historical almost-collinear polygon's
  # triangulation below the fixed area threshold. Beautify triangulation first;
  # if needed collapse only edges below20micrometres, retaining a closed mesh.
  bad=metrics(b.objects)['degenerateParts'];repairs=[]
  for ob in [o for o in b.objects if o.name in bad]:
   before_vertices=len(ob.data.vertices);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY');bm.to_mesh(ob.data);bm.free();ob.data.update()
   if metrics([ob])['degenerateTriangles']:
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.dissolve_degenerate(bm,dist=.00002,edges=list(bm.edges));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
   assert not metrics([ob])['degenerateTriangles'] and not metrics([ob])['nonManifoldEdges'],(aid,'microedge repair',ob.name,metrics([ob]))
   repairs.append({'part':ob.name,'beforeVertices':before_vertices,'afterVertices':len(ob.data.vertices),'maxEdgeCollapseDistanceM':.00002,'fixedAreaThresholdUnchanged':True})
  b.root['nativeMicroedgeRepairsV5']=json.dumps(repairs)
  old_q=row['metrics']if cat=='defenders'else row['qa'];b.coverage=old_q.get('coverage',[])
  dest=ROOT/'public/assets/geometric'/row['file'];q=export_and_check(b,dest)
  assert q['nonManifoldEdges']==0,(aid,'nonmanifold',q['nonManifoldEdges'])
  if cat=='defenders':assert abs(q['boundsMin'][2])<.001,(aid,'grounding',q['boundsMin'])
  q['jointSurfaceContactsRest']=old_q.get('jointSurfaceContactsRest',[])
  if 'headCoverage'in old_q:q['headCoverage']=old_q['headCoverage']
  # Previous contacts remain available as baseline; final V5 actual exported
  # vertex contacts/posed coverage are independently audited by release tools.
  q['baselineContactRevision']='V4 contact records retained as provenance, not asserted as fresh V5 posed contact checks.'
  q['headProportionV5']=heads;q['foldedCloakV5']=cloak
  if cat=='defenders'and row.get('family')=='mage':q['magePhysicalScaleV5']=json.loads(b.root['mageRankPhysicalScaleV5'])
  views=render(b,out/'renders'/aid,args.size)if not args.no_render else[]
  if views:
   portrait=ROOT/'public/assets/geometric'/row['portrait'];shutil.copy2(out/'renders'/aid/'three-quarter-front.png',portrait)
  native=ROOT/'blender/scenes/geometric-game-v5'/cat/(aid+'.blend');native.parent.mkdir(parents=True,exist_ok=True);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(native))
  assert hashlib.sha256(old_path.read_bytes()).hexdigest()==old_native_sha or old_path==native,(aid,'historical scene changed')
  row[native_key]=native.relative_to(ROOT).as_posix();row['metrics'if cat=='defenders'else'qa']=q
  if cat=='defenders':q['views']=views
  else:row['views']=views
  row['proportionRevision']='geometric-game-v5';row['baselineGlbSha256']=previous_glb;row['sourceUserOverridesV5']={'humanoidHeadsSlightlySmaller':cat!='enemies','allCloaksFolded':cloak.get('applied',False)}
  report={'id':aid,'changed':True,'previousGlbSha256':previous_glb,'actualGlbSha256':q['fileSha256'],'actualNativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'native':row[native_key],'sourceSha256':row['sourceSha256'],'geometrySha256':q['geometrySha256'],'head':heads,'cloak':cloak,'roundtripBoundsError':q['roundtripBoundsError'],'actualRenderViews':views}
  reports=[r for r in reports if r['id']!=aid];reports.append(report);manifest['revision']='geometric-game-v5';manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n');out.mkdir(parents=True,exist_ok=True);(out/'proportion-pass-report.json').write_text(json.dumps(reports,indent=2)+'\n',encoding='utf8',newline='\n');print('V5_COMPLETE '+aid+' '+q['fileSha256'],flush=True)
 out.mkdir(parents=True,exist_ok=True);(out/'proportion-pass-report.json').write_text(json.dumps(reports,indent=2)+'\n',encoding='utf8',newline='\n')
 if args.baseline_manifest:assert hashlib.sha256(input_manifest.read_bytes()).hexdigest()==input_sha,'Baseline input changed during authoring.'
 print('V5_ALL_COMPLETE '+cat+' '+str(len(reports)),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--category',choices=['defenders','champions','enemies'],required=True);parser.add_argument('--ids',default='');parser.add_argument('--size',type=int,default=300);parser.add_argument('--no-render',action='store_true');parser.add_argument('--force',action='store_true');parser.add_argument('--cloth-only',action='store_true');parser.add_argument('--mage-yoke-fit',action='store_true');parser.add_argument('--baseline-manifest',help='Read-only input manifest path; default is current public manifest.');parser.add_argument('--output-manifest',help='Separate writable output manifest path; default is current public manifest.');run(parser.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[]))
