"""Extra hand-angle evidence loaded from the actual Claire production GLB."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'blender/scripts'))
from author_archer import configure_scene
from author_army import clear,clean_portrait_metadata
clear();scene=bpy.context.scene;scene.render.fps=50
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/advanced_ladyclaire.glb'))
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=next(a for a in bpy.data.actions if 'Idle' in a.name)
scene.frame_set(0);camera=configure_scene();scene.cycles.samples=18
scene.render.resolution_x=1000;scene.render.resolution_y=1000;camera.data.ortho_scale=.19
OUT=ROOT/'blender/renders/secret-champions-v3'
for label,where in [('casting-oblique',(-6,2,.7)),('casting-dorsal',(-3,-5,.7)),('casting-top',(-2,2,5))]:
    centre=Vector((-.275,.145,1.381));camera.location=centre+Vector(where);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/('ladyclaire-'+label+'.png'));bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath))
print('CLAIRE_FINAL_HAND_ANGLES_COMPLETE',flush=True)
