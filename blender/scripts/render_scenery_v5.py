"""Additional inspection views of the actual editable V5 native scene."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/scenes/royal-castle-v5.blend'))
scene=bpy.context.scene
scene.cycles.samples=16
scene.render.resolution_x=1440
scene.render.resolution_y=1080
camera=scene.camera
for name,location,target,scale in [
    ('royal-western-wall-v5',(-29,-22,15),(-8,0,2),23),
    ('royal-stream-footprints-v5',(13,9,84),(13,9,0),81),
]:
    camera.location=location
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale
    scene.render.filepath=str(ROOT/'artifacts'/(name+'.png'))
    bpy.ops.render.render(write_still=True)
