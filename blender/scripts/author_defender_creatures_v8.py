"""Build, export and reimport every v8 creature/engine owned in this batch.

Writes a metadata patch in artifacts; deliberately never writes manifest/data.
Usage: blender -b -t 8 --python blender/scripts/author_defender_creatures_v8.py
Optional --families comma,separated; --no-review; --review-only.
"""
import bpy, sys, json, math, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'blender/scripts'))
import author_archer as A
import author_army as army
import defender_creatures_v8 as C
import defender_engines_v8 as E

OUT=ROOT/'public/assets/models';PORTRAITS=ROOT/'public/assets/army';SOURCE=ROOT/'blender/scenes'
REVIEWS=ROOT/'blender/renders/defenders-v8-creatures';ARTIFACTS=ROOT/'artifacts'
for folder in (OUT,PORTRAITS,SOURCE,REVIEWS,ARTIFACTS):folder.mkdir(parents=True,exist_ok=True)
DATA=json.loads((ROOT/'data/towers.json').read_text(encoding='utf-8'))
OWNED=sorted(C.FAMILIES|E.FAMILIES)

def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']
def clear():
    army.clear()
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)

def bounds():
    bpy.context.view_layer.update();depsgraph=bpy.context.evaluated_depsgraph_get();points=[]
    for obj in meshes():
        evalobj=obj.evaluated_get(depsgraph);mesh=evalobj.to_mesh()
        points.extend(evalobj.matrix_world@v.co for v in mesh.vertices);evalobj.to_mesh_clear()
    lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
    return dict(min=lo,max=hi,size=[hi[i]-lo[i] for i in range(3)])

def camera_setup(size=(480,600),view=(-2.8,7,2.2)):
    camera=A.configure_scene();scene=bpy.context.scene;scene.cycles.samples=12
    # Render actual model with the same studio as the game portraits.
    dims=bounds();centre=Vector([(dims['min'][i]+dims['max'][i])*.5 for i in range(3)])
    camera.location=centre+Vector(view);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update();pts=[camera.matrix_world.inverted()@(o.matrix_world@Vector(v)) for o in meshes() for v in o.bound_box]
    width=max(v.x for v in pts)-min(v.x for v in pts);height=max(v.y for v in pts)-min(v.y for v in pts);aspect=size[0]/size[1]
    camera.data.ortho_scale=max(height,width/aspect)*1.15
    scene.render.resolution_x,scene.render.resolution_y=size;scene.render.resolution_percentage=100
    return camera

def camera_view(camera,view,size=(480,600)):
    dims=bounds();centre=Vector([(dims['min'][i]+dims['max'][i])*.5 for i in range(3)])
    camera.location=centre+Vector(view);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
    pts=[camera.matrix_world.inverted()@(o.matrix_world@Vector(v)) for o in meshes() for v in o.bound_box]
    width=max(v.x for v in pts)-min(v.x for v in pts);height=max(v.y for v in pts)-min(v.y for v in pts);aspect=size[0]/size[1]
    camera.data.ortho_scale=max(height,width/aspect)*1.13
    bpy.context.scene.render.resolution_x,bpy.context.scene.render.resolution_y=size

def render_image(path):
    bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(path)

def detail(camera,centre,view,scale,path,size=(800,800)):
    centre=Vector(centre);camera.location=centre+Vector(view);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale;scene=bpy.context.scene;scene.render.resolution_x,scene.render.resolution_y=size;scene.cycles.samples=16;render_image(path)

def export(file):
    originals=meshes();copies=[];groups={}
    for obj in originals:groups.setdefault(tuple(obj.data.materials),[]).append(obj)
    try:
        for key,parts in groups.items():
            bpy.ops.object.select_all(action='DESELECT');batch=[]
            for obj in parts:
                copy=obj.copy();copy.data=obj.data.copy();bpy.context.collection.objects.link(copy);copy.select_set(True);batch.append(copy)
            bpy.context.view_layer.objects.active=batch[0]
            if len(batch)>1:bpy.ops.object.join()
            output=batch[0];output.name='Production '+(key[0].name if key else 'surface');copies.append(output)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in copies:obj.select_set(True)
        for obj in bpy.context.scene.objects:
            if obj.type in ('ARMATURE','EMPTY'):obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_apply=False,export_extras=True,
            export_skins=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
            export_rest_position_armature=True,export_reset_pose_bones=True,export_anim_single_armature=True,
            export_cameras=False,export_lights=False)
    finally:
        for obj in copies:
            if obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
    return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in originals)

def generate(families,render=True):
    patch=ARTIFACTS/'defender-creatures-v8-metadata.json'
    entries=json.loads(patch.read_text(encoding='utf-8')) if patch.exists() else []
    for family in families:
        print('BUILD_V8 '+family,flush=True);clear()
        if family in C.FAMILIES:C.build(family)
        else:E.build(family)
        scene=bpy.context.scene;scene.frame_set(0);rig=C.RIG
        root=bpy.data.objects.new('defender_'+family,None);bpy.context.collection.objects.link(root);rig.parent=root
        root['designName']=DATA[family]['name'];root['articulationRevision']=3;root['modelRevision']='v8';root['attackReleaseFraction']=.36
        dimensions=bounds();source=SOURCE/(family+'_design_v8.blend');file='advanced_'+family+'.glb'
        camera=camera_setup((360,420));scene['Champion']=DATA[family]['name'];scene['Family']=family
        scene['ModelRevision']='v8';scene['AnimationContract']='Idle 2.4 s; Attack 1 s; release 0.36'
        bpy.ops.wm.save_as_mainfile(filepath=str(source));triangles=export(OUT/file)
        if render:render_image(PORTRAITS/(family+'-t1.png'))
        entry=dict(id=family+'-t1',file=file,kind='tower',family=family,tier=1,style='designed-defenders-v8',assetRevision='designed-defenders-v8',
            authoring='Blender',triangles=triangles,designRevision=11,modelRevision='v8',name=DATA[family]['name'],
            source='blender/scenes/'+source.name,bounds=dimensions,articulationRevision=3,rigType='deform-armature',
            attackReleaseFraction=.36,animationClips={'Idle':2.4,'Attack':1},attackJoints=sorted(b.name for b in rig.data.bones),
            bones=len(rig.data.bones))
        entries=[e for e in entries if e['family']!=family];entries.append(entry);patch.write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
        print('EXPORT_V8 '+family+' '+str(triangles)+' triangles '+json.dumps(dimensions['size']),flush=True)

def review_contact_details(families):
    """Inspect the actual reimported saddle and grip in attack poses."""
    for family in families:
        if family not in ('thunderheart','phoenix','griffinbomber'):continue
        clear();scene=bpy.context.scene;scene.render.fps=50
        bpy.ops.import_scene.gltf(filepath=str(OUT/('advanced_'+family+'.glb')))
        rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.animation_data_create()
        for track in rig.animation_data.nla_tracks:track.mute=True
        rig.animation_data.action=next(a for a in bpy.data.actions if 'Attack' in a.name)
        scene.frame_set(0);camera=camera_setup()
        y=-.21 if family=='griffinbomber' else -.24;z=.94 if family=='griffinbomber' else .92
        for label,frame in [('prepare',9),('release',18),('follow',26)]:
            scene.frame_set(frame);bpy.context.view_layer.update()
            detail(camera,(-.14,y+.035,z-.16),(-5,-3,1),.74,REVIEWS/(family+'-saddle-'+label+'.png'))
            detail(camera,(.19,y+.258,z+.17),(2.2,5,2),.38,REVIEWS/(family+'-rider-grip-'+label+'.png'))
        print('CONTACT_REVIEW_V8 '+family+' complete',flush=True)

def review(families):
    audits=[]
    for family in families:
        print('REIMPORT_V8 '+family,flush=True);clear();scene=bpy.context.scene;scene.render.fps=50
        modelpath=OUT/('advanced_'+family+'.glb');modelhash=hashlib.sha256(modelpath.read_bytes()).hexdigest()
        bpy.ops.import_scene.gltf(filepath=str(modelpath))
        rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.animation_data_create()
        idle=next(a for a in bpy.data.actions if 'Idle' in a.name);attack=next(a for a in bpy.data.actions if 'Attack' in a.name)
        for track in rig.animation_data.nla_tracks:track.mute=True
        rig.animation_data.action=idle;scene.frame_set(0);camera=camera_setup()
        for label,view in [('front',(0,7,1.5)),('back',(0,-7,1.5)),('left',(-7,0,1.5)),('right',(7,0,1.5)),('three-quarter',(-2.8,7,2.0))]:
            camera_view(camera,view);render_image(REVIEWS/(family+'-'+label+'.png'))
        if family in ('embercrown','worldfire','thunderheart','phoenix'):
            detail(camera,(0,.77,1.32),(-3,5,1.7),.67,REVIEWS/(family+'-head.png'))
            detail(camera,(.85,-.16,1.10),(0,5,1.2),1.22,REVIEWS/(family+'-wing.png'))
        if family in ('thunderheart','phoenix','griffinbomber'):
            y=-.21 if family=='griffinbomber' else -.24;z=.94 if family=='griffinbomber' else .92
            detail(camera,(.19,y+.258,z+.17),(2.2,5,2),.30,REVIEWS/(family+'-rider-grip.png'))
            detail(camera,(-.14,y+.035,z-.16),(-5,-3,1),.74,REVIEWS/(family+'-saddle.png'))
            detail(camera,(0,y+.02,z+.55),(-2,5,1),.37,REVIEWS/(family+'-rider-face.png'))
        if family in ('winterhold','emeraldgolem','mechanicalgolem'):
            detail(camera,(.43,.16,.85),(2.2,5,1.4),.40,REVIEWS/(family+'-hand.png'))
            detail(camera,(0,.02,1.79),(-2,5,1),.41,REVIEWS/(family+'-face.png'))
        rig.animation_data.action=attack
        frames=[]
        for frame in range(51):
            scene.frame_set(frame);bpy.context.view_layer.update();socket=bpy.data.objects.get('attack_muzzle')
            contacts={}
            for nameA,nameB in [('rider_seat_contact','saddle_contact'),('boot_sole_L','stirrup_tread_L'),('boot_sole_R','stirrup_tread_R')]:
                a,b=bpy.data.objects.get(nameA),bpy.data.objects.get(nameB)
                if a and b:contacts[nameA]=(a.matrix_world.translation-b.matrix_world.translation).length
            frames.append(dict(frame=frame,muzzle=list(socket.matrix_world.translation),bounds=bounds(),contacts=contacts))
        for label,frame in [('prepare',9),('release',18),('follow',26),('return',50)]:
            scene.frame_set(frame);camera_view(camera,(-2.8,7,2));render_image(REVIEWS/(family+'-attack-'+label+'.png'))
        # Exported GLB full attack proof, all phases at 25fps; actual bone poses.
        framefolder=ARTIFACTS/(family+'-v8-attack-frames');framefolder.mkdir(exist_ok=True)
        camera_view(camera,(-2.8,7,2),(320,400));scene.cycles.samples=6
        for frame in range(0,51,2):
            scene.frame_set(frame);render_image(framefolder/('%03d.png'%(frame//2)))
        audit=dict(family=family,source='Fresh production GLB import in Blender 5.2',modelSha256=modelhash,bones=len(rig.data.bones),
            idle=list(idle.frame_range),attack=list(attack.frame_range),fps=50,meshes=len(meshes()),frames=frames)
        audits.append(audit);(ARTIFACTS/(family+'-v8-roundtrip-audit.json')).write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
        all_audits=[json.loads(path.read_text(encoding='utf-8')) for path in sorted(ARTIFACTS.glob('*-v8-roundtrip-audit.json')) if path.name in {f+'-v8-roundtrip-audit.json' for f in OWNED}]
        (ARTIFACTS/'defender-creatures-v8-roundtrip-audit.json').write_text(json.dumps(all_audits,indent=2)+'\n',encoding='utf-8')
        print('REVIEW_V8 '+family+' '+str(len(rig.data.bones))+' bones complete',flush=True)

if __name__=='__main__':
    families=sys.argv[sys.argv.index('--families')+1].split(',') if '--families' in sys.argv else OWNED
    if any(f not in OWNED for f in families):raise ValueError('Non-owned requested family')
    if '--contacts-only' in sys.argv:review_contact_details(families)
    else:
        if '--review-only' not in sys.argv:generate(families,render='--no-render' not in sys.argv)
        if '--no-review' not in sys.argv and '--no-render' not in sys.argv:
            review(families);review_contact_details(families)
