"""Original secret royal champions, authored with Blender 5.2.

blender -b --python blender/scripts/author_secret_champions.py
Only the two secret entries are added to the current models manifest.
The V3 deform rigs replace the earlier reviews without changing gameplay.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer as A
import author_army as army
import articulation
from author_archer import cube, ellipsoid, cylinder, rod, custom, torus, mat

ROOT=A.ROOT;OUT=ROOT/'public/assets/models';PORTRAITS=ROOT/'public/assets/army'
SOURCES=ROOT/'blender/scenes';REVIEWS=ROOT/'blender/renders/secret-champions-v3'
ART_VERSION='champions-v7.10';DESIGN_REVISION=10
for folder in (OUT,PORTRAITS,SOURCES,REVIEWS):folder.mkdir(parents=True,exist_ok=True)


def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']


def pivot(name,position=(0,0,0),parts=()):
    obj=articulation.pivot(name,position);articulation.attach(parts,obj);return obj


def arc(name,points,radius,material,vertices=8):
    return [rod(name,a,b,radius,material,vertices) for a,b in zip(points,points[1:])]


def fuse(parts,name,material,budget=900,voxel=.014):
    return A.cohesive.fuse(parts,name,voxel,budget,material)


def royal_palette():
    return dict(cream=mat('Royal cream silk','eee3c7'),blue=mat('Royal blue velvet','325c9b'),
                gold=mat('Royal engraved gold','d8af58',.72),silver=mat('Bright silver plate','c8d1d3',.78),
                steel=mat('Honed silver blade','dae6e7',.78),leather=mat('Fine chestnut leather','654632'),
                dark=mat('Royal dark seam','273446'),skin=mat('Warm human skin','e9b699'),
                white=mat('Horse ivory white coat','f1eee6'),mane=mat('Horse pearly white mane','fff9e8'),
                hoof=mat('Horse pale grey hoof','777e83'),hair=mat('Claire golden blonde hair','d8b865'),
                hairlight=mat('Claire blonde strand light','f1d48c'),eyewhite=mat('Warm eye whites','f9f3e4'),
                iris=mat('Clear green eyes','388956'),pupil=mat('Dark eye pupils','142722'),
                lips=mat('Claire rosy smile','a36560'),mouth=mat('Claire smiling mouth','674345'),
                magic=mat('Claire blue staff focus','86c8f3',.08,1.4),stone=mat('Royal pale limestone','adb4a0'),
                stoneedge=mat('Royal stone pedestal edge','66766b'))


def pedestal(p,radius=.44):
    cylinder('Octagonal royal footing',(0,0,.055),radius,.11,p['stoneedge'],8)
    cylinder('Beveled royal stone top',(0,0,.125),radius*.945,.07,p['stone'],8,top=radius*.89)
    torus('Golden secret champion inlay',(0,0,.166),radius*.805,.015,p['gold'])


def lady_claire():
    import secret_claire_v3
    return secret_claire_v3.build(sys.modules[__name__])


def lord_bernhard():
    import secret_bernhard_v3
    return secret_bernhard_v3.build(sys.modules[__name__])


def export_rigged(file):
    """Preserve real skin weights, bone transforms and authored Blender actions.

    The generic army exporter deliberately flattens rigid figures and disables
    animations. Applying that path here would destroy the deform rigs.
    """
    bpy.context.view_layer.update()
    originals=meshes();copies=[]
    # Production uses one skin batch per material/attachment. Keep the many
    # individual editable anatomical/clothing parts in the .blend source.
    groups={}
    for obj in originals:
        key=(obj.parent,obj.parent_type,obj.parent_bone,tuple(obj.data.materials))
        groups.setdefault(key,[]).append(obj)
    try:
        for key,parts in groups.items():
            bpy.ops.object.select_all(action='DESELECT');batch=[]
            for obj in parts:
                copy=obj.copy();copy.data=obj.data.copy()
                bpy.context.collection.objects.link(copy);copy.select_set(True);batch.append(copy)
            bpy.context.view_layer.objects.active=batch[0]
            # Blender joins/remaps named vertex groups, retaining skin weights
            # and the shared armature modifier on the active export copy.
            if len(batch)>1:bpy.ops.object.join()
            output=batch[0];output.name='Export '+(key[3][0].name if key[3] else 'surface')
            copies.append(output)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in copies:obj.select_set(True)
        for obj in bpy.context.scene.objects:
            if obj.type in ('EMPTY','ARMATURE'):obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',
            use_selection=True,export_apply=False,export_extras=True,
            export_skins=True,export_animations=True,export_animation_mode='ACTIONS',
            export_force_sampling=True,export_rest_position_armature=True,
            export_reset_pose_bones=True,export_anim_single_armature=True,
            export_cameras=False,export_lights=False)
    finally:
        for obj in copies:
            if obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
    return sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in originals)


def rig_metadata():
    rigs=[obj for obj in bpy.context.scene.objects if obj.type=='ARMATURE']
    clips={action.name:round((action.frame_range[1]-action.frame_range[0])/bpy.context.scene.render.fps,5)
        for action in bpy.data.actions if action.name in ('Idle','Attack')}
    return dict(articulationRevision=2,rigType='deform-armature',
        attackReleaseFraction=.36,animationClips=clips,
        attackJoints=sorted({bone.name for rig in rigs for bone in rig.data.bones}),
        bones=sum(len(rig.data.bones) for rig in rigs))


def bounds():
    bpy.context.view_layer.update();points=[o.matrix_world@vertex.co for o in meshes() for vertex in o.data.vertices]
    low=[min(point[i] for point in points) for i in range(3)];high=[max(point[i] for point in points) for i in range(3)]
    return dict(min=[round(x,5) for x in low],max=[round(x,5) for x in high],size=[round(high[i]-low[i],5) for i in range(3)])


def camera_frame(camera,dimensions,resolution=(360,420),view=(-3.3,6,2.9)):
    centre=Vector(tuple((dimensions['min'][i]+dimensions['max'][i])/2 for i in range(3)))
    camera.location=centre+Vector(view);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
    projected=[camera.matrix_world.inverted()@(o.matrix_world@Vector(v)) for o in meshes() for v in o.bound_box]
    width=max(point.x for point in projected)-min(point.x for point in projected);height=max(point.y for point in projected)-min(point.y for point in projected)
    aspect=resolution[0]/resolution[1];camera.data.ortho_scale=max(width,height*aspect)*1.15 if aspect>=1 else max(height,width/aspect)*1.15
    scene=bpy.context.scene;scene.render.resolution_x=resolution[0];scene.render.resolution_y=resolution[1];scene.render.resolution_percentage=100;scene.cycles.samples=32


def generate(render=True,family=None):
    requested=set(family.split(',')) if family else {'ladyclaire','lordbernhard'}
    if not requested or not requested.issubset({'ladyclaire','lordbernhard'}):
        raise ValueError('Unknown requested secret champion family')
    entries=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    for family,name,builder in [('ladyclaire','Lady Claire',lady_claire),('lordbernhard','Lord Bernhard',lord_bernhard)]:
        if family not in requested:continue
        army.clear();builder()
        asset_version='designed-defenders-v8' if family=='ladyclaire' else ART_VERSION
        design_revision=11 if family=='ladyclaire' else DESIGN_REVISION
        scene=bpy.context.scene;scene.frame_set(0)
        dimensions=bounds();scene['Champion']=name;scene['Family']=family;scene['DesignRevision']=design_revision;scene['SecretChampion']=True
        scene['AssetRevision']=asset_version;scene['Identity']='Original V3 anatomical face, individually formed hands, layered gown, natural blonde hairline and sculpted golden crown' if family=='ladyclaire' else 'Armoured seated rider with articulated plate joints, closed ornate helmet, anatomically shaped horse, saddle and stirrup contacts'
        root=scene.objects.get('secret_champion_'+family) or pivot('secret_champion_'+family,(0,0,0),[o for o in scene.objects if not o.parent]);root['secret']=True;root['assetRevision']=asset_version;root['designName']=name;root['attackReleaseFraction']=.36
        file='advanced_'+family+'.glb';triangles=export_rigged(file)
        camera=A.configure_scene();camera_frame(camera,dimensions)
        scene['NativeBounds']=json.dumps(dimensions);bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/(family+'_design_v3.blend')))
        if render:
            portrait=PORTRAITS/(family+'-t1.png');scene.render.filepath=str(portrait);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(portrait)
            camera_frame(camera,dimensions,(1100,1300),(0,6,1.8));scene.cycles.samples=48
            review=REVIEWS/(family+'-front.png');scene.render.filepath=str(review);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(review)
            camera_frame(camera,dimensions,(1100,1300),(0,-6,1.8))
            review=REVIEWS/(family+'-back.png');scene.render.filepath=str(review);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(review)
            for side,direction in [('left',(-7,0,1.5)),('right',(7,0,1.5))]:
                camera_frame(camera,dimensions,(1100,1300),direction)
                review=REVIEWS/(family+'-'+side+'.png');scene.render.filepath=str(review);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(review)
        entries=[entry for entry in entries if not(entry.get('kind')=='tower' and entry.get('family')==family)]
        metadata=rig_metadata()
        if family=='ladyclaire':metadata['articulationRevision']=3
        entries.append(dict(id=family+'-t1',file=file,kind='tower',family=family,tier=1,style='designed-defenders-v8' if family=='ladyclaire' else ART_VERSION,assetRevision=asset_version,authoring='Blender',secret=True,triangles=triangles,designRevision=design_revision,name=name,source='blender/scenes/'+family+'_design_v3.blend',bounds=dimensions,**metadata))
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
        print('SECRET_CHAMPION '+family+' '+str(triangles)+' triangles '+str(dimensions['size']),flush=True)
    print('SECRET_CHAMPIONS requested native sources and GLBs complete'+(' with portraits' if render else ' without rendering'),flush=True)


def review_gallery(render=True):
    """Keep a paired, editable native source review alongside the portraits."""
    army.clear()
    for family,offset in [('ladyclaire',-.72),('lordbernhard',.77)]:
        with bpy.data.libraries.load(str(SOURCES/(family+'_design_v3.blend')),link=False) as (source,target):
            target.objects=source.objects
        objects=[obj for obj in target.objects if obj is not None and obj.type in ('MESH','EMPTY','ARMATURE')]
        for obj in objects:bpy.context.scene.collection.objects.link(obj)
        for obj in objects:
            if not obj.parent:obj.location.x+=offset
    dimensions=bounds();camera=A.configure_scene();camera_frame(camera,dimensions,(1600,1450),(-2.0,8.0,3.1))
    scene=bpy.context.scene;scene.cycles.samples=56;scene['NativeReview']='Lady Claire and Lord Bernhard; secret champions v0.2.8; original Blender 5.2 native sources'
    scene['ModelSources']='ladyclaire_design_v3.blend / lordbernhard_design_v3.blend'
    scene.render.filepath=str(REVIEWS/'secret-champions-pair.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/'secret_champions_review_v3.blend'))
    if render:
        bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(REVIEWS/'secret-champions-pair.png')
    print('SECRET_CHAMPIONS editable paired review complete',flush=True)


if __name__=='__main__':
    render='--no-render' not in sys.argv
    family=sys.argv[sys.argv.index('--family')+1] if '--family' in sys.argv else None
    if '--gallery-only' in sys.argv:review_gallery(render=render)
    else:
        generate(render=render,family=family)
        if not family and render:review_gallery()
