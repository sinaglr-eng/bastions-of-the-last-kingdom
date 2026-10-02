"""Visual proof from the actual GLB after a fresh Blender import."""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'blender/scripts'))
from author_archer import configure_scene
from author_secret_champions import camera_frame, bounds
from author_army import clean_portrait_metadata
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
scene=bpy.context.scene;scene.render.fps=50
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/advanced_ladyclaire.glb'))
rig=next(o for o in scene.objects if o.type=='ARMATURE')
attack=next(a for a in bpy.data.actions if 'Attack' in a.name)
idle=next(a for a in bpy.data.actions if 'Idle' in a.name)
rig.animation_data.action=idle
for track in rig.animation_data.nla_tracks:track.mute=True
scene.frame_set(0);camera=configure_scene();scene.cycles.samples=22
OUT=ROOT/'blender/renders/secret-champions-v3';OUT.mkdir(parents=True,exist_ok=True)
def set_camera(centre,where,scale,size):
    c=Vector(centre);camera.location=c+Vector(where)
    camera.rotation_euler=(c-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale
    scene.render.resolution_x,scene.render.resolution_y=size;scene.render.resolution_percentage=100
def render(name):
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    clean_portrait_metadata(Path(scene.render.filepath))
dimensions=bounds()
if '--animation-only' not in sys.argv:
    for name,where in [('front',(0,6,1.2)),('back',(0,-6,1.2)),('left',(-6,0,1.0)),('right',(6,0,1.0)),('three-quarter',(-2.2,6,1.3))]:
        set_camera((.02,0,1.10),where,2.48,(1000,1250));render('ladyclaire-'+name)
    if '--views-only' in sys.argv:sys.exit()
    set_camera((0,0,1.790),(0,5,.22),.39,(1100,1250));render('ladyclaire-face')
    set_camera((.331,.155,1.217),(2,4,1.0),.22,(1100,1000));render('ladyclaire-grip')
    set_camera((-.275,.145,1.391),(-2,4,.65),.22,(1100,1000));render('ladyclaire-casting-hand')
rig.animation_data.action=attack
proof=[]
for frame in range(51):
    scene.frame_set(frame);bpy.context.view_layer.update()
    a=bpy.data.objects['staff_tip'].matrix_world.translation
    b=bpy.data.objects['attack_muzzle'].matrix_world.translation
    proof.append({'frame':frame,'staffFocus':list(a),'muzzleFocusDistance':(a-b).length})
audit={'source':'Actual production GLB, reimported fresh in Blender 5.2',
       'attack':attack.name,'idle':idle.name,'attackFrameRange':list(attack.frame_range),
       'idleFrameRange':list(idle.frame_range),'fps':50,'bones':len(rig.data.bones),
       'meshes':len([o for o in scene.objects if o.type=='MESH']),
       'frames':proof,'normalMapImages':[i.name for i in bpy.data.images if 'normal' in i.name.lower()]}
(ROOT/'artifacts/claire-v3-imported-glb-audit.json').write_text(json.dumps(audit,indent=2))
if '--animation-only' not in sys.argv:
    set_camera((.02,0,1.10),(-2.2,6,1.3),2.48,(1000,1250))
    for label,frame in [('prepare',10),('release',18),('follow',25),('return',50)]:
        scene.frame_set(frame);render('ladyclaire-attack-'+label)
set_camera((.03,.02,1.10),(-2.2,6,1.5),2.35,(480,600));scene.cycles.samples=8
scene.render.film_transparent=False;scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.024,.044,.035,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
directory=ROOT/'artifacts/claire-v3-imported-attack-frames';directory.mkdir(parents=True,exist_ok=True)
for index,frame in enumerate(range(0,51,2)):
    scene.frame_set(frame);scene.render.filepath=str(directory/('%03d.png'%index));bpy.ops.render.render(write_still=True)
print('CLAIRE_V3_GLB_ROUNDTRIP_COMPLETE '+json.dumps({k:v for k,v in audit.items() if k!='frames'}),flush=True)
