"""Reconstruct, render and verify all 48 current four-view basic defenders.

blender -b --python blender/scripts/author_defender_turnarounds_v3.py
Optional: --family archer --ranks 1,6 --quick --no-render --publish-assets.
Publishing assets copies only this pack after native export verification.
"""
import argparse,json,math,sys,shutil,hashlib
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer_design_study as studio
from defender_turnarounds_v3.common import Builder
from defender_turnarounds_v3 import martials,casters,specialists
OUT=ROOT/'public/assets/models'
SCENES=ROOT/'blender/scenes/hooded-turnarounds-v3'
RENDERS=ROOT/'blender/renders/hooded-turnarounds-v3'
REPORTS=ROOT/'output/design/hooded-turnarounds-v3'
EXPORTS=REPORTS/'glb'
PORTRAITS=REPORTS/'portraits'
REFS=ROOT/'blender/references/hooded-turnarounds-v3'
if not REFS.exists():REFS=ROOT/'output/design/basic-defender-turnarounds-v1'
RANK_COLORS=['3989ed','3eac63','9555d8','eee9db','e7b43f','ffd969']
ROMAN=['I','II','III','IV','V','VI']
BASIC=['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller']
VIEWS={'front':(0,7,1.1),'back':(0,-7,1.1),'left':(-7,0,1.1),'right':(7,0,1.1),'three-quarter':(4,7,3.0)}

def equipment():
    return json.loads((Path(__file__).parent/'defender_turnarounds_v3/equipment.json').read_text())
EQUIPMENT=equipment()

def palette(rank):
    colors={'blue':RANK_COLORS[rank-1],'navy':'303E50','skin':'D9B483','wood':'775237',
      'boots':'64432C','trousers':'353638','belt':'61442D','buckle':'CBC4B2',
      'eyes':'151718','stone':'B9B4A5','fletching':'EEE9DB','steel':'9EA8B2',
      'ivory':'EEE9DB','gold':'D8AD4F','green':'789857','violet':'A465E7',
      'ice':'9BD9EE','hair':'39302D','bark':'685136','copper':'A36236'}
    return {key:studio.material(key,val,.72) for key,val in colors.items()}

def metrics(objects):
    graph=bpy.context.evaluated_depsgraph_get();triangles=0;points=[];degenerate=0;parts=[]
    for obj in objects:
        if obj.type!='MESH':continue
        ev=obj.evaluated_get(graph);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        triangles+=len(mesh.loop_triangles)
        world=[ev.matrix_world@v.co for v in mesh.vertices];points+=world
        degenerate+=sum((world[t.vertices[1]]-world[t.vertices[0]]).cross(world[t.vertices[2]]-world[t.vertices[0]]).length<1e-10 for t in mesh.loop_triangles)
        parts.append({'name':obj.get('part',obj.name),'materials':[m.name for m in obj.data.materials],'triangles':len(mesh.loop_triangles)})
        ev.to_mesh_clear()
    assert points and all(math.isfinite(v) for p in points for v in p)
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    return dict(triangles=triangles,bounds_min=lo,bounds_max=hi,degenerateTriangles=degenerate,editableParts=parts)

def export(b,path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in b.collection.objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=b.root
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    bpy.ops.object.select_all(action='DESELECT')

def roundtrip(path,expected,family,rank):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported=[o for o in bpy.data.objects if o not in before];bpy.context.view_layer.update()
    actual=metrics(imported)
    error=max(abs(actual[k][i]-expected[k][i]) for k in ('bounds_min','bounds_max') for i in range(3))
    roots=[o for o in imported if o.get('assetRevision')=='hooded-turnarounds-v3' and o.get('family')==family and o.get('tier')==rank]
    assert len(roots)==1,(family,rank,'root identity')
    names={o.name.split('.')[0] for o in imported}
    required={'torso_pivot','head_pivot','upper_arm_L','upper_arm_R','forearm_L','forearm_R','hand_L','hand_R','weapon_R','bow_pivot' if family=='archer' else 'weapon_L','attack_muzzle'}
    assert required.issubset(names),(family,rank,required-names)
    assert error<1e-5,(family,rank,'roundtrip bounds',error)
    assert actual['triangles']==expected['triangles'],(family,rank,'roundtrip triangles')
    assert actual['degenerateTriangles']==0,(family,rank,'degenerate geometry')
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    return {'passed':True,'boundsError':error,'triangles':actual['triangles'],'hierarchyNamesVerified':sorted(required),'materialCount':len({m for p in actual['editableParts'] for m in p['materials']})}

def render(camera,b,view,path,quick):
    scene=bpy.context.scene
    studio.camera_view(camera,'CAM_'+view,VIEWS[view],(0,0,1.1),2.42,(256,288) if quick else (384,432))
    scene.render.film_transparent=True;scene.cycles.samples=8 if quick else 16
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)

def pack_reference(family):
    file=REFS/f'{"engineer" if family=="runebreaker" else family}-variant-b-turnaround.png'
    image=bpy.data.images.load(str(file));image.pack()
    coll=studio.make_collection('REFERENCE - packed four-view sheet');coll.hide_render=True;coll.hide_viewport=True
    obj=bpy.data.objects.new('Approved_Turnaround_Sheet',None);coll.objects.link(obj);obj.empty_display_type='IMAGE';obj.data=image

def preview_effects(b,rank):
    """Native presentation only; created AFTER verified GLB selection export.

    Dimensions and mote count follow game/render/ranks.js. The thin native
    golden halo approximates the game's additive screen-facing sprite.
    """
    coll=studio.make_collection(f'PREVIEW FX ONLY - {b.family} {ROMAN[rank-1]}')
    coll['exportExcluded']=True;coll['runtimeOwner']='game/render/ranks.js'
    root=bpy.data.objects.new('Preview_Rank_Effects',None);coll.objects.link(root)
    b.attach(root,b.root)
    mat=studio.material('preview_rank_ring',RANK_COLORS[rank-1],.8)
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value=mat.diffuse_color
    shader.inputs['Emission Strength'].default_value=.7
    vertices=[]
    for radius in (.40,.46):
        vertices.extend((radius*math.cos(i*math.tau/32),radius*math.sin(i*math.tau/32),.172) for i in range(32))
    data=bpy.data.meshes.new('Preview_Ring_Mesh')
    data.from_pydata(vertices,[],[(i,(i+1)%32,32+(i+1)%32,32+i) for i in range(32)])
    ring=bpy.data.objects.new('Preview_Rank_Colored_Ring',data);coll.objects.link(ring)
    data.materials.append(mat);b.attach(ring,root)
    if rank==6:
        gold=studio.material('preview_eight_motes','FFF1B7',.6)
        s=gold.node_tree.nodes.get('Principled BSDF');s.inputs['Emission Color'].default_value=gold.diffuse_color;s.inputs['Emission Strength'].default_value=2
        for i in range(8):
            a=i*math.pi/4
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.027,location=(math.cos(a)*.51,math.sin(a)*.51,.3+(i%3)*.28))
            obj=studio.relocate(bpy.context.object,coll);obj.name=f'Preview_Golden_Mote_{i+1}';obj.data.materials.append(gold);b.attach(obj,root)
        halo=studio.material('preview_subtle_golden_halo','FFEDAD',.8)
        shader=halo.node_tree.nodes.get('Principled BSDF');shader.inputs['Emission Color'].default_value=halo.diffuse_color;shader.inputs['Emission Strength'].default_value=.8
        curve=bpy.data.curves.new('Preview_Golden_Aura_Halo_Curve','CURVE');curve.dimensions='3D';curve.bevel_depth=.007;curve.bevel_resolution=0
        line=curve.splines.new('POLY');line.points.add(63)
        for i,p in enumerate(line.points):
            a=i*math.tau/64;p.co=(.76*math.cos(a),-.25,.92+.91*math.sin(a),1)
        line.use_cyclic_u=True
        obj=bpy.data.objects.new('Preview_Subtle_Golden_Aura',curve);coll.objects.link(obj);curve.materials.append(halo);b.attach(obj,root)
    return coll

def generate(families=None,render=True,quick=False,manifest=True,ranks=None,publish=False):
    for folder in (SCENES,RENDERS,REPORTS,EXPORTS,PORTRAITS):folder.mkdir(parents=True,exist_ok=True)
    selected=families.split(',') if families else BASIC
    selected_ranks=[int(r) for r in ranks.split(',')] if ranks else list(range(1,7))
    assert all(f in BASIC for f in selected) and all(r in range(1,7) for r in selected_ranks)
    entries=[]
    for family in selected:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        camera,stage=studio.configure(quick);scene=bpy.context.scene
        scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.65
        scene.render.film_transparent=True
        for obj in stage.objects:
            if obj.name=='Studio_Floor':obj.hide_render=True
        units=[];reports=[]
        for rank in selected_ranks:
            coll=studio.make_collection(f'{family} - Rank {ROMAN[rank-1]}');b=Builder(coll,palette(rank),family,rank)
            module=martials if family in ('soldier','archer') else casters if family in ('druid','mage','cleric') else specialists
            module.build(b);b.finish(EQUIPMENT[family][rank-1]);bpy.context.view_layer.update()
            raw=metrics(b.objects)
            assert raw['triangles']<10000 and raw['degenerateTriangles']==0,(family,rank,raw['triangles'],raw['degenerateTriangles'])
            assert raw['bounds_min'][2]>=-.002 and raw['bounds_max'][2]<2.4,(family,rank,'bounds')
            if render:
                for view in VIEWS:
                    render_view=globals()['render']
                    render_view(camera,b,view,RENDERS/f'{family}-t{rank}-{view}.png',quick)
                studio.camera_view(camera,'CAM_Rank_Portrait',(3.4,6,3.1),(0,0,1.1),2.5,(360,420))
                scene.render.film_transparent=True;scene.cycles.samples=8 if quick else 16
                scene.render.filepath=str(PORTRAITS/f'{family}-t{rank}.png');bpy.ops.render.render(write_still=True)
            # A small planted game foundation is a separate technical part and
            # excluded from the measured reference renders above.
            b.root.location.z=.12;bpy.context.view_layer.update()
            base=studio.base(coll,b.m['stone']);base['part']='Foundation_Hexagonal_Stone';b.objects.append(base);b.attach(base,b.root)
            bpy.context.view_layer.update();game_metrics=metrics(b.objects)
            filename=f'human_{family}_t{rank}.glb';export(b,EXPORTS/filename)
            verified=roundtrip(EXPORTS/filename,game_metrics,family,rank)
            joints=sorted(o.name for o in coll.objects if o.type=='EMPTY' and o.get('articulation'))
            entry=dict(file=filename,kind='tower',family=family,tier=rank,style='hooded-turnarounds-v3',authoring='Blender',triangles=game_metrics['triangles'],articulationRevision=1,attackJoints=joints,rankColor='#'+RANK_COLORS[rank-1],equipment=EQUIPMENT[family][rank-1],source=f'blender/scenes/hooded-turnarounds-v3/{family}_ranks.blend')
            entries.append(entry)
            reports.append(dict(family=family,tier=rank,bodyMetrics=raw,exportMetrics=game_metrics,roundtrip=verified,equipment=EQUIPMENT[family][rank-1],rankColor=entry['rankColor'],file=filename,sha256=hashlib.sha256((EXPORTS/filename).read_bytes()).hexdigest(),landmarks={o.name:list(o.matrix_world.translation) for o in coll.objects if o.type=='EMPTY'}))
            fx=preview_effects(b,rank)
            if render:
                studio.camera_view(camera,'CAM_Presentation',(4,7,3.0),(0,0,1.1),2.55,(384,432))
                scene.render.filepath=str(RENDERS/f'{family}-t{rank}-effects.png');bpy.ops.render.render(write_still=True)
            fx.hide_render=True
            units.append((b.root,coll,fx))
            for obj in coll.objects:obj.name+='_'+ROMAN[rank-1]
            coll.hide_render=True
            print(f'V3 VERIFIED {family} {rank}: {game_metrics["triangles"]} triangles, roundtrip bounds {verified["boundsError"]:.2g}',flush=True)
        for index,(root,coll,fx) in enumerate(units):
            coll.hide_render=False;fx.hide_render=False;root.location+=Vector(((index%3-1)*2.2,(index//3)*2.5,0))
        pack_reference(family)
        scene['DesignRevision']='hooded-turnarounds-v3';scene['Family']=family
        scene['BlenderVersion']=bpy.app.version_string;scene['CoordinateFrame']='+Y front, +X anatomical right, Z up; exported glTF Y up and -Z front'
        studio.camera_view(camera,'CAM_Six_Rank_Review',(5,10,8),(0,1.2,1),7.5,(1440,960))
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(SCENES/f'{family}_ranks.blend'),compress=True)
        (REPORTS/f'{family}-metrics.json').write_text(json.dumps(reports,indent=2)+'\n')
    previous=json.loads((REPORTS/'asset-manifest.json').read_text()) if (REPORTS/'asset-manifest.json').exists() else []
    changed={(e['family'],e['tier']) for e in entries}
    stage=[e for e in previous if (e['family'],e['tier']) not in changed]+entries
    stage.sort(key=lambda e:(BASIC.index(e['family']),e['tier']))
    (REPORTS/'asset-manifest.json').write_text(json.dumps(stage,indent=2)+'\n')
    (REPORTS/'equipment.json').write_text(json.dumps(EQUIPMENT,indent=2)+'\n')
    if publish:
        live=json.loads((OUT/'manifest.json').read_text())
        for entry in entries:
            family,rank=entry['family'],entry['tier']
            shutil.copyfile(EXPORTS/entry['file'],OUT/entry['file'])
            if render:shutil.copyfile(PORTRAITS/f'{family}-t{rank}.png',ROOT/f'public/assets/army/{family}-t{rank}.png')
            live=[e for e in live if not(e.get('kind')=='tower' and e.get('family')==family and e.get('tier')==rank)];live.append(entry)
        if manifest:(OUT/'manifest.json').write_text(json.dumps(live,indent=2)+'\n')
    return entries

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--family');parser.add_argument('--ranks')
    parser.add_argument('--no-render',action='store_true');parser.add_argument('--quick',action='store_true')
    parser.add_argument('--publish-assets',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    generate(args.family,not args.no_render,args.quick,ranks=args.ranks,publish=args.publish_assets)
