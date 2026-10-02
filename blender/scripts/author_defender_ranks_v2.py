"""Author the approved 48 faceted defenders with editable six-rank native scenes.

Blender -b --python blender/scripts/author_defender_ranks_v2.py
Optional --family soldier,archer --no-render --quick --no-manifest.
Runtime owns colored rings and Mythic effects; source previews exclude them from GLB.
"""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer_design_study as studio
from defender_ranks_v2.common import Builder
from defender_ranks_v2 import martials,casters,specialists
OUT=ROOT/'public/assets/models';PORTRAITS=ROOT/'public/assets/army'
SCENES=ROOT/'blender/scenes/hooded-ranks-v2';RENDERS=ROOT/'blender/renders/hooded-ranks-v2'
REPORTS=ROOT/'output/design/hooded-ranks-v2'
EQUIPMENT=json.loads((Path(__file__).parent/'defender_ranks_v2/equipment.json').read_text())
RANK_COLORS=['3989ed','3eac63','9555d8','eee9db','e7b43f','ffd969']
ROMAN=['I','II','III','IV','V','VI']
BASIC=list(EQUIPMENT)

def palette(rank):
    mats=studio.palette()
    mats['blue'].diffuse_color=studio.color(RANK_COLORS[rank-1]);mats['blue'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mats['blue'].diffuse_color
    for name,color in {'steel':'9EA8B2','ivory':'EEE9DB','gold':'CEAC55','green':'6F8C4E','violet':'A06BDD','ice':'9BD9EE','hair':'39302D','bark':'685136','copper':'A36236'}.items():mats[name]=studio.material(name,color,.7)
    return mats

def metrics(b):
    graph=bpy.context.evaluated_depsgraph_get();triangles=0;points=[]
    for obj in b.objects:
        if obj.type!='MESH':continue
        ev=obj.evaluated_get(graph);mesh=ev.to_mesh();mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles)
        points += [tuple(ev.matrix_world@v.co) for v in mesh.vertices];ev.to_mesh_clear()
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    assert all(math.isfinite(v) for p in points for v in p)
    assert triangles<10000,(b.family,b.rank,triangles)
    assert lo[2]>=-.001 and hi[2]<2.4,(b.family,b.rank,lo,hi)
    return dict(triangles=triangles,bounds_min=lo,bounds_max=hi,editable_parts=len(b.objects))

def export(b,path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in b.collection.objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=b.root
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    bpy.ops.object.select_all(action='DESELECT')

def preview_effects(b,rank):
    coll=studio.make_collection(f'PREVIEW FX {ROMAN[rank-1]} - excluded from export')
    glow=studio.material('preview_ring_'+ROMAN[rank-1],RANK_COLORS[rank-1],.4)
    glow.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=studio.color(RANK_COLORS[rank-1])
    glow.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.5
    bpy.ops.mesh.primitive_torus_add(major_radius=.435,minor_radius=.005,major_segments=32,minor_segments=4,location=(0,0,.126))
    ring=studio.relocate(bpy.context.object,coll);ring.name='Preview Rank Ring';ring.data.materials.append(glow)
    if rank==6:
        for i in range(8):
            a=i*math.pi/4
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.028,location=(math.cos(a)*.58,math.sin(a)*.48,.4+(i%3)*.36))
            mote=studio.relocate(bpy.context.object,coll);mote.name='Preview Mythic Mote';mote.data.materials.append(glow)
    return coll

def clean_png(path):
    png=path.read_bytes();chunks=[png[:8]];offset=8
    while offset<len(png):
        length=int.from_bytes(png[offset:offset+4],'big');end=offset+length+12
        if png[offset+4:offset+8] not in (b'tEXt',b'zTXt',b'iTXt',b'eXIf'):chunks.append(png[offset:end])
        offset=end
    path.write_bytes(b''.join(chunks))

def generate(families=None,render=True,quick=False,manifest=True):
    for folder in (OUT,PORTRAITS,SCENES,RENDERS,REPORTS):folder.mkdir(parents=True,exist_ok=True)
    selected=families.split(',') if families else BASIC
    assert all(f in BASIC for f in selected),selected
    entries=json.loads((OUT/'manifest.json').read_text())
    for family in selected:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        camera,stage=studio.configure(quick);scene=bpy.context.scene
        scene.render.resolution_x=360;scene.render.resolution_y=420;scene.cycles.samples=16 if quick else 24
        collections=[];roots=[];effects=[];reports=[]
        for rank in range(1,7):
            coll=studio.make_collection(f'{family} - Rank {ROMAN[rank-1]}');mats=palette(rank)
            b=Builder(coll,mats,family,rank)
            module=martials if family in ('soldier','archer') else casters if family in ('druid','mage','cleric') else specialists
            module.build(b);b.finish(EQUIPMENT[family][rank-1])
            foot=studio.base(coll,mats['stone']);foot.name='Foundation_Hexagonal_Stone';b.objects.append(foot);b.attach(foot,b.root)
            bpy.context.view_layer.update();report=metrics(b)
            joints=sorted(o.name for o in coll.objects if o.type=='EMPTY' and o.get('articulation'))
            file=f'human_{family}_t{rank}.glb';export(b,OUT/file)
            report.update(family=family,tier=rank,file=file,attackJoints=joints,equipment=EQUIPMENT[family][rank-1]);reports.append(report)
            entry=dict(file=file,kind='tower',family=family,tier=rank,style='hooded-ranks-v2',authoring='Blender',triangles=report['triangles'],articulationRevision=1,attackJoints=joints,rankColor='#'+RANK_COLORS[rank-1],equipment=EQUIPMENT[family][rank-1],source=f'blender/scenes/hooded-ranks-v2/{family}_ranks.blend')
            entries=[e for e in entries if not(e.get('kind')=='tower' and e.get('family')==family and e.get('tier')==rank)];entries.append(entry)
            fx=preview_effects(b,rank);effects.append(fx)
            studio.camera_view(camera,'CAM_Rank_Portrait',(3.4,6,3.5),(0,0,1.12),2.8,(360,420))
            scene.cycles.samples=16 if quick else 24
            if render:
                path=PORTRAITS/f'{family}-t{rank}.png';scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);clean_png(path)
            collections.append(coll);roots.append(b.root)
            # Free exact joint names before authoring the next rank. Export happened at origin.
            for obj in coll.objects:obj.name+='_'+ROMAN[rank-1]
            coll.hide_render=True;fx.hide_render=True
            print(f'HOODED RANKS: {family} {rank} {report["triangles"]} triangles',flush=True)
        for i,(coll,root,fx) in enumerate(zip(collections,roots,effects)):
            coll.hide_render=False;fx.hide_render=False
            offset=Vector(((1-i%3)*2.3,(i//3-1)*2.9,0));root.location+=offset
            for obj in fx.objects:obj.location+=offset
            bpy.ops.object.text_add(location=(offset.x,offset.y+.57,.14),rotation=(math.pi/2,0,math.pi))
            label=studio.relocate(bpy.context.object,stage);label.data.body=ROMAN[i];label.data.align_x='CENTER';label.data.size=.16;label.data.materials.append(studio.material('label_'+str(i),'353B40'))
        bpy.context.view_layer.update()
        studio.camera_view(camera,'CAM_Six_Rank_Review',(3.1,9,9),(0,-1.45,1.0),8.1,(1800,1200))
        scene.cycles.samples=16 if quick else 32
        scene['DesignRevision']='hooded-ranks-v2';scene['Family']=family;scene['Purpose']='Approved variant B: six cumulative equipment ranks, shared faceted Ranger family.'
        reference=ROOT/f'output/design/basic-defender-ranks-v1/variant-b-{ "engineer" if family=="runebreaker" else family}.png'
        if reference.exists():
            image=bpy.data.images.load(str(reference));image.pack();ref=studio.make_collection('REFERENCE - packed approved rank sheet');ref.hide_render=True;ref.hide_viewport=True
            obj=bpy.data.objects.new('Approved_Rank_Concept',None);ref.objects.link(obj);obj.empty_display_type='IMAGE';obj.data=image
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(SCENES/f'{family}_ranks.blend'))
        if render:
            scene.render.filepath=str(RENDERS/f'{family}-ranks.png');bpy.ops.render.render(write_still=True);clean_png(RENDERS/f'{family}-ranks.png')
        (REPORTS/f'{family}-metrics.json').write_text(json.dumps(reports,indent=2)+'\n')
        if manifest:(OUT/'manifest.json').write_text(json.dumps(entries,indent=2)+'\n')
    return entries

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--family');parser.add_argument('--no-render',action='store_true');parser.add_argument('--quick',action='store_true');parser.add_argument('--no-manifest',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    generate(args.family,not args.no_render,args.quick,not args.no_manifest)
