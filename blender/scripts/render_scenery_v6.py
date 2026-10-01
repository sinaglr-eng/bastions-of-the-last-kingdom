"""Inspection renders from the actual editable V6 native scenes."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v6 as V6
for scene_name,views in [
    ('royal-castle-v6',[
        ('royal-frontier-wall-v6',(-35,-27,37),(-8,16,1.9),68),
        ('royal-natural-pastures-v6',(29,-46,38),(14,-14,0),52),
        ('royal-dry-footprints-v6',(11,10,90),(11,10,0),98)
    ]),
    ('fortified-warcamp-v6',[
        ('warcamp-natural-woodland-v6',(38,-49,49),(-15,1,1.8),77)
    ])
]:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/scenes'/(scene_name+'.blend')))
    if scene_name=='royal-castle-v6':
        V6.S.P=V6.S.palette();V6.main_river_review()
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/scenes'/(scene_name+'.blend')))
    scene=bpy.context.scene;scene.cycles.samples=16;scene.render.resolution_x=1440;scene.render.resolution_y=1080;camera=scene.camera
    for name,location,target,scale in views:
        camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
        scene.render.filepath=str(ROOT/'artifacts'/(name+'.png'));bpy.ops.render.render(write_still=True)
