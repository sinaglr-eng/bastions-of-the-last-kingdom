"""Actual exported Engineer left ruler grip, including moving contact poses."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'blender/scripts'))
from author_archer import configure_scene
from author_army import clear,clean_portrait_metadata
clear();scene=bpy.context.scene;scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/human_runebreaker_t1.glb'))
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
idle=next(a for a in bpy.data.actions if 'Idle' in a.name);attack=next(a for a in bpy.data.actions if 'Attack' in a.name)
rig.animation_data.action=idle;scene.frame_set(0);camera=configure_scene();scene.cycles.samples=16
OUT=ROOT/'blender/renders/defenders-v8-humans';OUT.mkdir(parents=True,exist_ok=True)
local=Vector((-.35821,.203,1.12201));rest=rig.pose.bones['hand_L'].matrix.copy()
def render(label,where):
    current=rig.pose.bones['hand_L'].matrix;centre=rig.matrix_world@current@rest.inverted()@local
    camera.location=centre+Vector(where);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.225
    scene.render.resolution_x=1000;scene.render.resolution_y=1000
    scene.render.filepath=str(OUT/('runebreaker-glb-ruler-'+label+'.png'));bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath))
for label,where in [('side',(-6,1,.6)),('inner',(-2,-5,1)),('top',(-2,2,5))]:render(label,where)
rig.animation_data.action=attack
for label,frame in [('prepare',6),('release',10.8),('follow',15),('return',30)]:
    scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update();render('attack-'+label,(-4,5,1))
print('ENGINEER_ACTUAL_GLB_GRIP_REVIEW_COMPLETE',flush=True)
