"""Reimport actual production GLBs and render multi-angle/contact/attack proof.

Uses Eevee for repeatable all-family galleries; actual model animations, skins,
materials and sockets are loaded from the exported binary, never substituted.
"""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'blender/scripts'))
import author_archer as A
from defender_humans_v8 import BASIC,FAMILIES,frame_camera,bounds
from author_army import clear,clean_portrait_metadata
OUT=ROOT/'blender/renders/defenders-v8-humans';OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;scene.render.fps=30
families=sys.argv[sys.argv.index('--family')+1].split(',') if '--family' in sys.argv else BASIC+FAMILIES
full='--full' in sys.argv;animation='--animation' in sys.argv
reports=[]
for family in families:
    clear()
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    path=ROOT/'public/assets/models'/(f'human_{family}_t1.glb' if family in BASIC else f'advanced_{family}.glb')
    bpy.ops.import_scene.gltf(filepath=str(path));rig=next(o for o in scene.objects if o.type=='ARMATURE')
    idle=next(a for a in bpy.data.actions if 'Idle' in a.name);attack=next(a for a in bpy.data.actions if 'Attack' in a.name)
    for track in rig.animation_data.nla_tracks:track.mute=True
    rig.animation_data.action=idle;scene.frame_set(0);camera=A.configure_scene();scene.render.engine='CYCLES';scene.cycles.samples=12
    dim=bounds();scene.render.image_settings.color_mode='RGBA'
    def render(label,where=(0,7,1.4),centre=None,scale=.40,size=(600,800),frame=0):
        scene.frame_set(int(frame),subframe=frame-int(frame))
        if centre is None:frame_camera(camera,dim,where,size)
        else:
            c=Vector(centre);camera.location=c+Vector(where);camera.rotation_euler=(c-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
            scene.render.resolution_x,scene.render.resolution_y=size
        scene.render.filepath=str(OUT/(family+'-glb-'+label+'.png'));bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath))
    for label,where in [('front',(0,7,1.4)),('back',(0,-7,1.4)),('left',(-7,0,1.4)),('right',(7,0,1.4))]:render(label,where,size=(440,600))
    if full:
        centre=rig.data.bones['head'].head_local.lerp(rig.data.bones['head'].tail_local,.52)
        render('face',(0,6,.5),centre,scale=.41,size=(800,1000))
        for side in ('R','L'):
            centre=rig.data.bones['hand_'+side].head_local
            render('hand-'+side,(2 if side=='R' else -2,5,1),centre,scale=.24,size=(850,900))
    rig.animation_data.action=attack;scene.frame_set(0)
    muzzle=bpy.data.objects['attack_muzzle'];proof=[]
    for frame in range(31):
        scene.frame_set(frame);bpy.context.view_layer.update();proof.append({'frame':frame,'muzzle':list(muzzle.matrix_world.translation)})
    for label,frame in [('prepare',6),('release',10.8),('follow',15),('return',30)]:render('attack-'+label,(-2.1,7,1.5),size=(440,600),frame=frame)
    if animation:
        directory=ROOT/'artifacts'/('defender-v8-attack-'+family);directory.mkdir(parents=True,exist_ok=True)
        scene.render.film_transparent=False;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.022,.039,.031,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7;scene.cycles.samples=8
        for frame in range(0,31,2):
            scene.frame_set(frame);frame_camera(camera,dim,(-2.1,7,1.5),(360,480));scene.render.filepath=str(directory/('%03d.png'%(frame//2)));bpy.ops.render.render(write_still=True)
    record={'family':family,'source':str(path),'bones':len(rig.data.bones),'actions':{'Idle':list(idle.frame_range),'Attack':list(attack.frame_range)},'meshes':len([o for o in scene.objects if o.type=='MESH']),'muzzle':proof,'bounds':dim}
    reports.append(record)
    (ROOT/'artifacts'/('defender-humans-v8-roundtrip-'+families[0]+'.json')).write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
    print('V8_GLB_REVIEW '+family,flush=True)
