"""Final surface polish/export from editable V8 sources, only owned humans.

Removes decorative dark crease lines that were too visible in close renders.
Finger anatomy is defined by the actual continuous curved skin, not paint.
"""
import bpy,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'blender/scripts'))
from defender_humans_v8 import BASIC,FAMILIES,DATA,OUT,PORTRAITS,SCENES,REVIEW,set_colour,export_model,frame_camera,bounds
import author_archer as A
from author_army import clean_portrait_metadata
rows=[]
families=sys.argv[sys.argv.index('--family')+1].split(',') if '--family' in sys.argv else BASIC+FAMILIES
for family in families:
    source=SCENES/(family+'_design_v8.blend');bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;scene.frame_set(0)
    for obj in list(scene.objects):
        if 'subtle finger flexion crease' in obj.name:bpy.data.objects.remove(obj,do_unlink=True)
    rig=next(obj for obj in scene.objects if obj.type=='ARMATURE');cloth=next(m for m in bpy.data.materials if m.name.startswith(family+' V8 Rank_') or m.name==family+' V8 rank cloth')
    dim=bounds();camera=scene.camera;frame_camera(camera,dim);scene.cycles.samples=16
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    for rank in range(1,7) if family in BASIC else [1]:
        if family in BASIC:set_colour(cloth,A.COLORS[rank-1]);cloth.name=family+' V8 Rank_'+str(rank)+'_cloth'
        file=f'human_{family}_t{rank}.glb' if family in BASIC else f'advanced_{family}.glb';triangles=export_model(OUT/file)
        scene.render.filepath=str(PORTRAITS/(family+'-t'+str(rank)+'.png'));bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath))
        if rank==1:
            frame_camera(camera,dim,(0,7,1.4),(600,800));scene.render.filepath=str(REVIEW/(family+'-front.png'));bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath));frame_camera(camera,dim)
        rows.append({'id':family+'-t'+str(rank),'file':file,'kind':'tower','family':family,'tier':rank,'style':'designed-defenders-v8','assetRevision':'designed-defenders-v8','designRevision':11,'modelRevision':'v8','authoring':'Blender','triangles':triangles,'name':DATA[family]['name'],'source':'blender/scenes/'+source.name,'bounds':dim,'articulationRevision':3,'rigType':'deform-armature','attackReleaseFraction':.36,'animationClips':{'Idle':2.4,'Attack':1.0},'bones':len(rig.data.bones),'attackJoints':sorted(b.name for b in rig.data.bones),'materials':len({m for obj in scene.objects if obj.type=='MESH' for m in obj.data.materials})})
        print('V8_FINAL_EXPORT '+family+' '+str(rank)+' '+str(triangles),flush=True)
    (ROOT/'artifacts'/('defender-humans-v8-final-metadata-'+families[0]+'.json')).write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
