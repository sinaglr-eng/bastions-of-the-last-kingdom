"""Create actual native and game models for the 88 geometric roster subjects."""
import sys,json,hashlib,math,argparse,shutil
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from geometric_roster_builder import build
from geometric_game_common import metrics,export_and_check,geometry_digest,studio,head_coverage,Builder

OUT=ROOT/'public/assets/geometric'
NATIVE=ROOT/'blender/scenes/geometric-game-v1'
RENDER=ROOT/'blender/renders/geometric-game-v1'
REPORT=ROOT/'output/design/geometric-game-v1'

def clear():
 bpy.ops.wm.read_factory_settings(use_empty=True)

def coverage(b):
 covers=[o for o in b.objects if any(s in o.name for s in ('Continuous wrapped hood','Helmet '))]
 faces=[o for o in b.objects if o.name.startswith('Observed face')]
 result=[]
 for cover in [o for o in covers if 'Continuous wrapped hood' in o.name]:
  ownfaces=[o for o in faces if o.parent==cover.parent]
  if ownfaces:result.append(head_coverage(ownfaces,[cover]))
 if any(c['type']=='closed-helmet' for c in b.coverage):
  helmetparents={o.parent for o in covers if 'Helmet ' in o.name}
  result.append(head_coverage([o for o in faces if o.parent in helmetparents],[o for o in covers if o.parent in helmetparents],True))
 return result

def render(b,where,size):
 cam,target=studio(b.objects,(size,size));scene=bpy.context.scene
 scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
 # Fixed six cameras share a single geometry, pose and orthographic scale.
 before=geometry_digest(b.objects);rows=[];where.mkdir(parents=True,exist_ok=True)
 for name,az in [('front',0),('back',180),('left',-90),('right',90),('three-quarter-front',35),('three-quarter-back',145)]:
  a=math.radians(az);e=math.radians(12);cam.location=target+Vector((8*math.sin(a)*math.cos(e),8*math.cos(a)*math.cos(e),8*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();path=where/(name+'.png');scene.render.filepath=str(path);assert before==geometry_digest(b.objects);bpy.ops.render.render(write_still=True)
  rows.append({'view':name,'file':str(path.relative_to(ROOT)).replace('\\','/'),'geometrySha256':before,'cameraPosition':list(cam.location),'orthoScale':cam.data.ortho_scale})
 return rows

def claire(row):
 # Reuse the directly measured physical Claire sculpture, rather than downgrade
 # her approved scene to a generic new humanoid.
 path=ROOT/'blender/scenes/lady-claire-geometric-v1/lady-claire.blend'
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):
  dst.collections=[n for n in src.collections if n.startswith('MODEL') or n.startswith('FX')]
 coll=next(c for c in dst.collections if c.name.startswith('MODEL'));bpy.context.scene.collection.children.link(coll)
 for extra in [c for c in dst.collections if c!=coll]:
  for ob in list(extra.objects):coll.objects.link(ob);extra.objects.unlink(ob)
 b=Builder(row['id'],{'ivory':'f0e3ca','gold':'d6ad58'});bpy.data.objects.remove(b.root,do_unlink=True);bpy.data.collections.remove(b.coll);b.coll=coll;b.objects=[o for o in coll.all_objects if o.type=='MESH']
 oldroots=[o for o in coll.all_objects if o.type=='EMPTY' and not o.parent]
 b.root=oldroots[0] if oldroots else bpy.data.objects.new('ladyclaire',None)
 if not oldroots:coll.objects.link(b.root)
 b.root.name='ladyclaire';b.root['geometricRig']=True;b.root['locomotion']='biped';b.root['attackStyle']='staff';b.root['sourceFile']=row['source'];b.root['sourceSha256']=row['sha256']
 tor=b.pivot('torso_pivot',(0,0,1.01));head=b.pivot('head_pivot',(0,0,1.72),tor)
 arms={}
 for side in (-1,1):
  name='R' if side>0 else 'L';up=b.pivot('upper_arm_'+name,(side*.24,0,1.45),tor);fore=b.pivot('forearm_'+name,(side*.34,.07,1.26),up);hand=b.pivot('hand_'+name,(side*.46,.15,1.19),fore);weapon=b.pivot('weapon_'+name,(side*.46,.15,1.19),hand);arms[name]=(up,fore,hand,weapon)
  thigh=b.pivot('upper_leg_'+name,(side*.17,0,.77));shin=b.pivot('shin_'+name,(side*.18,0,.30),thigh);foot=b.pivot('foot_'+name,(side*.19,.03,.08),shin)
 for ob in b.objects:
  name=ob.name.lower();bpy.context.view_layer.update();c=sum((ob.matrix_world@Vector(q) for q in ob.bound_box),Vector())/8;side='R' if c.x>0 else 'L'
  if 'orb_' in name:
   if ob.parent:ob.parent['sourceOrbitGem']=True
   else:b.attach(ob,b.root)
  elif any(s in name for s in ('eye','face','hair','crown')):b.attach(ob,head)
  elif 'staff' in name:b.attach(ob,arms['R'][3])
  elif any(s in name for s in ('hand','thumb')):b.attach(ob,arms[side][2])
  elif any(s in name for s in ('arm','sleeve','cuff')):b.attach(ob,arms[side][0])
  elif any(s in name for s in ('boot','shoe')):b.attach(ob,bpy.data.objects.get('foot_'+side))
  else:b.attach(ob,tor)
 # Packed amber materials are preserved rather than recolored as gold trim.
 for ob in b.objects:
  if 'amber' in ob.name.lower():
   for mt in ob.data.materials:
    if mt and 'Amber' in mt.name:
     mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,.34,.007,1)
     mt.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,.24,.004,1)
     mt.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.12
 # The approved visible meshes remain exact. Proper hidden legs now connect
 # the ankles to knees under the opaque gown, rather than rigging isolated
 # shoes to empty leg joints. The narrow shafts remain inside the dress.
 b.root['approvedOuterGeometrySha256']=geometry_digest(b.objects)
 b.root['anatomyRevision']='geometric-contact-anatomy-v2'
 neck=next(o for o in b.objects if o.name=='Neck');bpy.context.view_layer.update()
 top=max((neck.matrix_world@v.co).z for v in neck.data.vertices);inverse=neck.matrix_world.inverted()
 for v in neck.data.vertices:
  p=neck.matrix_world@v.co
  if p.z>top-.002:v.co=inverse@(p+Vector((0,0,.012)))
 neck.data.update();b.root['claireHiddenNeckExtensionM']=.012
 shoe=next(o for o in b.objects if any(k in o.name.lower() for k in ('boot','shoe')))
 b.M['hidden_claire_leg']=shoe.data.materials[0]
 for side in (-1,1):
  sn='R' if side>0 else 'L';thigh=bpy.data.objects.get('upper_leg_'+sn);shin=bpy.data.objects.get('shin_'+sn);foot=bpy.data.objects.get('foot_'+sn)
  b.limb('Claire covered anatomical upper leg '+sn,[(side*.17,0,.77),(side*.175,0,.52),(side*.18,0,.30)],[.072,.065,.060],'hidden_claire_leg',thigh,10)
  b.limb('Claire covered anatomical shin '+sn,[(side*.18,0,.30),(side*.184,.012,.20),(side*.19,.03,.08)],[.060,.058,.052],'hidden_claire_leg',shin,10)
  b.limb('Claire contacting covered ankle shaft '+sn,[(side*.19,.03,.08),(side*.185,.017,.155)],[.056,.055],'hidden_claire_leg',foot,10)
 return b

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='*');ap.add_argument('--no-render',action='store_true');ap.add_argument('--resolution',type=int,default=300);ap.add_argument('--category');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 rows=json.loads((REPORT/'source-measurements.json').read_text(encoding='utf-8'))['subjects'];selected=[r for r in rows if (not args.only or r['id'] in args.only) and (not args.category or r['category']==args.category)]
 entries=[]
 for row in selected:
  clear();cat='enemies' if row['category']=='enemies' else 'champions';b=claire(row) if row['id']=='ladyclaire' else build(row)
  native=metrics(b.objects);assert native['degenerateTriangles']==0,(b.id,native);assert native['nonManifoldEdges']==0,(b.id,native)
  # Ground every grounded assembly once. Flying mounts keep their intentional
  # gap; their death pose is grounded independently in game.
  if b.root.get('locomotion')!='flying':
   feet=[o for o in b.objects if any(v in o.name for v in ('Grounded boot','Grounded shoe','Animal grounded foot','Construct grounded shoe','Boot_'))]
   dz=-min((min((o.matrix_world@v.co).z for v in o.data.vertices) for o in feet),default=native['boundsMin'][2])
   if abs(dz)>1e-7:b.root.location.z+=dz;bpy.context.view_layer.update()
   # All physical meshes, not merely named soles, must remain above terrain.
   floor=metrics(b.objects)['boundsMin'][2]
   below=[o.name for o in b.objects if min((o.matrix_world@v.co).z for v in o.data.vertices)<-.002]
   assert floor>=-.002,(b.id,'physical geometry below floor',floor,below)
  glb=OUT/cat/(b.id+'.glb');q=export_and_check(b,glb);q['headCoverage']=coverage(b)
  assert all(t['passed'] for t in q['headCoverage']),(b.id,q['headCoverage'])
  ref=ROOT/'public/geometric-turnarounds-v1'/row['source'];im=bpy.data.images.load(str(ref));im.name='REFERENCE six views '+b.id;im.use_fake_user=True;im.pack();b.root['referenceImage']=im.name
  views=[] if args.no_render else render(b,RENDER/cat/b.id,args.resolution)
  if views:
   portrait=OUT/'portraits'/(b.id+'.png');portrait.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(RENDER/cat/b.id/'three-quarter-front.png',portrait)
  blend=NATIVE/cat/(b.id+'.blend');blend.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(blend))
  rowout={'id':b.id,'kind':'enemy' if cat=='enemies' else 'tower','family':b.id,'tier':1,'file':cat+'/'+b.id+'.glb','portrait':'portraits/'+b.id+'.png','source':row['source'],'sourceSha256':row['sha256'],'native':str(blend.relative_to(ROOT)).replace('\\','/'),'locomotion':b.root['locomotion'],'attackStyle':b.root['attackStyle'],'geometricRig':True,'anatomyRevision':b.root.get('anatomyRevision','geometric-game-v1'),'qa':q,'views':views,'accuracy':{'absoluteScaleCertified':False,'sourceDimensionsKnown':False,'silhouetteThreshold':.97,'certifiedThresholdPassed':False,'note':'Actual six views provided; source generated drawings vary and have no absolute dimensions.'}}
  if b.root.get('approvedOuterGeometrySha256'):rowout['approvedOuterGeometrySha256']=b.root['approvedOuterGeometrySha256']
  eyes=[o for o in b.objects if o.name in ('Eye R','Eye L')]
  rowout['landmarksNative']={o.name:list(sum((o.matrix_world@v.co for v in o.data.vertices),Vector())/len(o.data.vertices)) for o in eyes}
  rowout['landmarksSource']={'eyesFrontPx':row['eyes_front_px'],'assumedMetersPerSourcePixel':1.8/352,'assumedFrontSoleYpx':410,'frontCentreXpx':row['face_center_px'][0],'sourceUncertaintyPx':row['uncertainty_px']}
  entries.append(rowout);print('FINISHED '+b.id+' '+json.dumps({'triangles':q['triangles'],'headCoverage':q['headCoverage']}),flush=True)
  for group in ['enemies','champions']:
   if not any(r['file'].startswith(group+'/') for r in entries):continue
   path=OUT/('geometric-'+group+'.json');old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'entries':[]};maps={r['id']:r for r in old['entries']};maps.update({r['id']:r for r in entries if r['file'].startswith(group+'/')});path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps({'revision':'geometric-game-v1','entries':list(maps.values())},ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')

if __name__=='__main__':main()
