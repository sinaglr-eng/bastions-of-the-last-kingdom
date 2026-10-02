"""Independent native authoring / review CLI for Lady Claire only."""
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_secret_champions as H
import secret_claire_v3 as C
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'blender/renders/secret-champions-v3'
OUT.mkdir(parents=True,exist_ok=True)
H.army.clear();C.build(H)
scene=bpy.context.scene;scene['Champion']='Lady Claire';scene['DesignRevision']=10
scene['AssetRevision']='champions-v7.10';scene['OriginalTopology']=True
scene.render.fps=30;scene.frame_set(0)
rig=bpy.data.objects.get('Lady_Claire_Rig')
dimensions=H.bounds()
camera=H.A.configure_scene();scene.cycles.samples=40
scene.view_settings.view_transform='AgX'
def view(name,where,centre=None,size=(1000,1250),scale=None,frame=0,attack=False):
    rig.animation_data.action=bpy.data.actions['Attack' if attack else 'Idle']
    scene.frame_set(int(frame),subframe=frame-int(frame))
    if centre is None:
        H.camera_frame(camera,dimensions,size,where)
    else:
        centre=Vector(centre);camera.location=centre+Vector(where)
        camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=scale
        scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    H.army.clean_portrait_metadata(OUT/(name+'.png'))
if '--export' in sys.argv:
    H.export_rigged('advanced_ladyclaire.glb')
    print('EXPORTED CLAIRE V3',flush=True)
H.camera_frame(camera,dimensions,(360,420),(-2.7,7,2.1))
scene['NativeBounds']=json.dumps(dimensions)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/scenes/ladyclaire_design_v3.blend'))
if '--quick' in sys.argv:
    view('ladyclaire-front',(0,6,1.2),size=(760,1000))
    view('ladyclaire-face',(0,5,.22),centre=(0,0,1.790),size=(900,1050),scale=.40)
elif '--fast-final' in sys.argv:
    view('ladyclaire-front',(0,6,1.2),size=(1000,1250))
    view('ladyclaire-grip',(2,4,1.0),centre=(.331,.155,1.217),size=(1000,950),scale=.22)
    view('ladyclaire-casting-hand',(-2,4,.65),centre=(-.275,.145,1.391),size=(1000,950),scale=.22)
    rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
    H.camera_frame(camera,dimensions,(360,420),(-2.7,7,2.1))
    scene.render.filepath=str(ROOT/'public/assets/army/ladyclaire-t1.png');bpy.ops.render.render(write_still=True)
    H.army.clean_portrait_metadata(ROOT/'public/assets/army/ladyclaire-t1.png')
else:
    for name,where in [('front',(0,6,1.2)),('back',(0,-6,1.2)),('left',(-6,0,1.0)),('right',(6,0,1.0))]:view('ladyclaire-'+name,where)
    view('ladyclaire-face',(0,5,.22),centre=(0,0,1.790),size=(1100,1250),scale=.39)
    view('ladyclaire-grip',(2,4,1.0),centre=(.306,.115,1.217),size=(1100,1000),scale=.22)
    view('ladyclaire-casting-hand',(-2,4,.65),centre=(-.275,.145,1.391),size=(1100,1000),scale=.22)
    for label,frame in [('prepare',6),('release',10.8),('follow',15),('return',30)]:
        view('ladyclaire-attack-'+label,(-2.2,6,1.3),frame=frame,attack=True)
    rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
    H.camera_frame(camera,dimensions,(360,420),(-2.7,7,2.1))
    scene.render.filepath=str(ROOT/'public/assets/army/ladyclaire-t1.png');bpy.ops.render.render(write_still=True)
    H.army.clean_portrait_metadata(ROOT/'public/assets/army/ladyclaire-t1.png')
metrics={'triangles':sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in H.meshes()),
         'meshes':len(H.meshes()),'materials':len(set(m for o in H.meshes() for m in o.data.materials)),
         'bones':len(rig.data.bones),'bounds':dimensions,
         'actions':[{ 'name':a.name,'frames':list(a.frame_range)} for a in bpy.data.actions]}
(OUT/'ladyclaire-metrics.json').write_text(json.dumps(metrics,indent=2))
print('CLAIRE_V3_METRICS '+json.dumps(metrics),flush=True)
