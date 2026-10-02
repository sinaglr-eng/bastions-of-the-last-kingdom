"""Render the actual production GLB and exported Flight bones, not author meshes."""
import bpy,sys,json,hashlib
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import final_boss_v4 as B
ROOT=B.ROOT;OUT=B.REVIEW
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=50
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/enemies/host_50.glb'))
scene=bpy.context.scene;rig=next(obj for obj in scene.objects if obj.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
idle=next(action for action in bpy.data.actions if 'Idle' in action.name)
rig.animation_data.action=idle;scene.frame_set(0)
B.staging(None,(1100,850));camera=scene.camera;scene.cycles.samples=20
def render(name):
 scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
def view(centre,direction,scale):
 centre=Vector(centre);camera.location=centre+Vector(direction);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
if '--clip-only' not in sys.argv:
 for label,direction in [('front',(0,15,4)),('back',(0,-15,4)),('left',(-15,0,3)),('right',(15,0,3)),('three-quarter',(8,15,5))]:
  view((0,-.65,2.16),direction,10.8);render('morvath-'+label)
 for label,centre,direction,scale in [('crown',(0,-.25,3.21),(1.3,4,1),.85),('sword-hand',(.62,.24,3.2),(2.0,3,.6),.45),('reins-hand',(-.31,.37,2.6),(-2,3,.5),.47),('saddle',(0,-.27,2.06),(-4,1,1.2),1.95),('wyvern-head',(0,1.15,2.57),(3,5,1.5),1.75),('wing',(-2.7,-.7,2.54),(-1,2,5),5.0)]:
  view(centre,direction,scale);render('morvath-'+label)
 view((0,-.65,2.16),(8,15,5),10.8)
 for label,frame in [('neutral',0),('upstroke',15),('downstroke',45)]:
  scene.frame_set(frame);render('morvath-flight-'+label)
proof=[]
for frame in range(121):
 scene.frame_set(frame);bpy.context.view_layer.update()
 point=lambda name:bpy.data.objects[name].matrix_world.translation
 proof.append(dict(frame=frame,seatDistance=(point('rider_seat_contact')-point('saddle_seat')).length,swordTip=list(point('sword_tip')),wingL=list(rig.pose.bones['wing_wrist_L'].matrix.to_quaternion())))
(ROOT/'artifacts/final-boss-v4-native-flight-audit.json').write_text(json.dumps(dict(source='Production GLB reimported in Blender 5.2',modelSha256=hashlib.sha256((ROOT/'public/assets/enemies/host_50.glb').read_bytes()).hexdigest(),clip=idle.name,bones=len(rig.data.bones),frames=proof),indent=2)+'\n')
view((0,-.65,2.16),(8,15,5),10.8);scene.render.resolution_x=720;scene.render.resolution_y=540;scene.cycles.samples=8
frames=ROOT/'artifacts/final-boss-v4-flight-frames';frames.mkdir(parents=True,exist_ok=True)
for index,frame in enumerate(range(0,121,4)):
 scene.frame_set(frame);scene.render.filepath=str(frames/('%03d.png'%index));bpy.ops.render.render(write_still=True)
print('FINAL_BOSS_V4_GLB_REVIEW_COMPLETE',flush=True)
