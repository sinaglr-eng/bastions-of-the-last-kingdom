"""Focused proof render of the actual V7 royal native source."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/scenes/royal-castle-v7.blend'))
scene=bpy.context.scene;scene.cycles.samples=24;scene.render.resolution_x=1440;scene.render.resolution_y=1080
for name,location,target,scale in [
    ('royal-outer-defenses-v7',(-26,-2,16),(-11,10,1),34),
    ('royal-bridge-clearance-v7',(-23,-13,13),(-10,0,1),20)
]:
    camera=scene.camera;camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
    scene.render.filepath=str(ROOT/'blender/renders'/(name+'.png'));bpy.ops.render.render(write_still=True)
