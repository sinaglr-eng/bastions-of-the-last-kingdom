"""Independently compare all saved V3 native parts with imported staged GLBs.

Run with Blender 5.2, for example:
  blender -b --python-exit-code 1 --python tools/verify_defender_roundtrip_v3.py

This is an export fidelity check, not a claim of pixel-perfect concept fidelity.
Only the source lineup root's X/Y offset is subtracted; the physical foundation,
root lift, scale, orientation and every evaluated modifier are retained.
"""
import hashlib
import json
import re
import traceback
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'output/design/hooded-turnarounds-v3'
SCENES=ROOT/'blender/scenes/hooded-turnarounds-v3'
FAMILIES=('soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller')
VERTEX_LIMIT=1e-5
COLOR_LIMIT=1e-6


def sha256(path):
    result=hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b''):result.update(chunk)
    return result.hexdigest()


def excluded(obj):
    return obj.name.startswith('Preview_') or any(
        coll.get('exportExcluded',False) or coll.name.startswith('PREVIEW FX')
        for coll in obj.users_collection)


def holding_hand(obj):
    ancestor=obj.parent
    while ancestor:
        name=re.sub(r'\.\d+$','',ancestor.name)
        match=re.fullmatch(r'(hand_[LR])(?:_[IV]+)?',name)
        if match:return match.group(1)
        ancestor=ancestor.parent
    return None


def base_color(material):
    assert material and material.use_nodes,'Mesh needs a real node material'
    nodes=[n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED']
    assert len(nodes)==1,(material.name,'one Principled material expected')
    return tuple(float(c) for c in nodes[0].inputs['Base Color'].default_value)


def snapshot(root, lineup=False):
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    shift=Vector((root.matrix_world.translation.x,root.matrix_world.translation.y,0)) if lineup else Vector((0,0,0))
    groups={}
    for obj in root.children_recursive:
        if obj.type!='MESH' or excluded(obj):continue
        part=obj.get('part')
        assert isinstance(part,str) and part,(obj.name,'missing semantic part')
        group=groups.setdefault(part,dict(points=[],triangles=0,objects=0,hands=set(),colors={}))
        group['objects']+=1;group['hands'].add(holding_hand(obj))
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            world=[evaluated.matrix_world@vertex.co-shift for vertex in mesh.vertices]
            group['points'].extend(tuple(p) for p in world)
            group['triangles']+=len(mesh.loop_triangles)
            for triangle in mesh.loop_triangles:
                polygon=mesh.polygons[triangle.polygon_index]
                color=base_color(mesh.materials[polygon.material_index])
                color_group=group['colors'].setdefault(color,dict(points=[],triangles=0))
                color_group['triangles']+=1
                color_group['points'].extend(tuple(world[i]) for i in triangle.vertices)
        finally:evaluated.to_mesh_clear()
    assert groups,'Empty native/imported semantic model'
    return groups


def nearest_error(source,target):
    assert source and target,'No vertices for bidirectional comparison'
    tree=KDTree(len(target))
    for index,point in enumerate(target):tree.insert(Vector(point),index)
    tree.balance()
    return max(tree.find(Vector(point))[2] for point in source)


def vertex_error(a,b):
    return max(nearest_error(a,b),nearest_error(b,a))


def compare_part(part,native,exported):
    assert native['objects']==exported['objects'],(part,'semantic object count',native['objects'],exported['objects'])
    assert native['triangles']==exported['triangles'],(part,'triangle count')
    assert native['hands']==exported['hands'],(part,'holding hand ancestry',native['hands'],exported['hands'])
    distance=vertex_error(native['points'],exported['points'])
    assert distance<=VERTEX_LIMIT,(part,'world-space vertex mismatch',distance)
    native_colors=native['colors'];export_colors=exported['colors']
    assert len(native_colors)==len(export_colors),(part,'material color count')
    unmatched=set(export_colors);color_max=0;color_surface_max=0;materials=[]
    for color,source in native_colors.items():
        matched=min(unmatched,key=lambda c:max(abs(a-b) for a,b in zip(color,c)))
        delta=max(abs(a-b) for a,b in zip(color,matched))
        assert delta<=COLOR_LIMIT,(part,'linear Principled Base Color RGBA',delta,color,matched)
        unmatched.remove(matched);target=export_colors[matched]
        assert source['triangles']==target['triangles'],(part,'material triangle assignment',color)
        surface_error=vertex_error(source['points'],target['points'])
        assert surface_error<=VERTEX_LIMIT,(part,'material assigned to different surface',surface_error)
        color_max=max(color_max,delta);color_surface_max=max(color_surface_max,surface_error)
        materials.append(dict(nativeLinearRGBA=list(color),importedLinearRGBA=list(matched),
                              maxChannelError=delta,triangles=source['triangles'],
                              coloredSurfaceVertexError=surface_error))
    return dict(part=part,objects=native['objects'],nativeVertices=len(native['points']),
                importedVertices=len(exported['points']),triangles=native['triangles'],
                bidirectionalWorldVertexError=distance,materialMaxChannelError=color_max,
                materialSurfaceMaxVertexError=color_surface_max,
                holdingHands=sorted(native['hands'],key=lambda value:value or ''),materials=materials)


def verify():
    manifest=json.loads((REPORTS/'asset-manifest.json').read_text(encoding='utf-8'))
    assert len(manifest)==48,'Exactly 48 staged entries are required'
    by_key={(entry['family'],entry['tier']):entry for entry in manifest}
    rows=[];failures=[]
    for family in FAMILIES:
        scene_path=SCENES/f'{family}_ranks.blend'
        scene_hash=sha256(scene_path)
        bpy.ops.wm.open_mainfile(filepath=str(scene_path),load_ui=False)
        for rank in range(1,7):
            imported=[]
            try:
                entry=by_key[(family,rank)];file=REPORTS/'glb'/entry['file']
                roots=[obj for obj in bpy.data.objects if obj.get('assetRevision')=='hooded-turnarounds-v3'
                    and obj.get('family')==family and obj.get('tier')==rank]
                assert len(roots)==1,(family,rank,'one source root expected')
                native=snapshot(roots[0],lineup=True)
                before=set(bpy.data.objects)
                bpy.ops.import_scene.gltf(filepath=str(file))
                imported=[obj for obj in bpy.data.objects if obj not in before]
                actual_roots=[obj for obj in imported if obj.get('assetRevision')=='hooded-turnarounds-v3'
                    and obj.get('family')==family and obj.get('tier')==rank]
                assert len(actual_roots)==1,(family,rank,'one imported root expected')
                exported=snapshot(actual_roots[0])
                assert set(native)==set(exported),(family,rank,'semantic part set',set(native)-set(exported),set(exported)-set(native))
                parts=[compare_part(name,native[name],exported[name]) for name in sorted(native)]
                triangles=sum(part['triangles'] for part in parts)
                assert triangles==entry['triangles'],(family,rank,'manifest triangles',triangles,entry['triangles'])
                row=dict(family=family,rank=rank,status='passed',nativeScene=scene_path.relative_to(ROOT).as_posix(),
                    nativeSceneSha256=scene_hash,glb=file.relative_to(ROOT).as_posix(),glbSha256=sha256(file),
                    semanticParts=len(parts),triangles=triangles,
                    maximumBidirectionalWorldVertexError=max(p['bidirectionalWorldVertexError'] for p in parts),
                    maximumMaterialChannelError=max(p['materialMaxChannelError'] for p in parts),
                    maximumMaterialSurfaceVertexError=max(p['materialSurfaceMaxVertexError'] for p in parts),parts=parts)
                rows.append(row)
                print(f'ROUNDTRIP EXACT {family} {rank}: {len(parts)} parts, {triangles} triangles, vertexError={row["maximumBidirectionalWorldVertexError"]:.3g}',flush=True)
            except Exception as error:
                failures.append(dict(family=family,rank=rank,error=str(error),traceback=traceback.format_exc()))
                print(f'ROUNDTRIP FAILED {family} {rank}: {error}',flush=True)
            finally:
                for obj in imported:
                    if obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
    report=dict(blenderVersion=bpy.app.version_string,status='passed' if not failures and len(rows)==48 else 'failed',
        modelsPassed=len(rows),modelsExpected=48,vertexTolerance=VERTEX_LIMIT,linearRGBATolerance=COLOR_LIMIT,
        method='Saved native evaluated meshes vs actual Blender-imported staged GLBs; exact semantic part/object/triangle/hand sets, bidirectional nearest vertices and color-assigned surface vertices. Subtract only source lineup root X/Y; retain foundation, root Z lift, orientation and scale.',
        excludes='Native Preview/FX collections only',
        limits='Proves native-to-GLB export fidelity, not agreement with the 2D concept drawings.',
        maximumBidirectionalWorldVertexError=max((r['maximumBidirectionalWorldVertexError'] for r in rows),default=None),
        maximumMaterialChannelError=max((r['maximumMaterialChannelError'] for r in rows),default=None),
        maximumMaterialSurfaceVertexError=max((r['maximumMaterialSurfaceVertexError'] for r in rows),default=None),
        models=rows,failures=failures)
    (REPORTS/'roundtrip-qa.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f'ROUNDTRIP TOTAL {len(rows)}/48 status={report["status"]}',flush=True)
    assert report['status']=='passed',f'{len(failures)} model roundtrip failures; inspect roundtrip-qa.json'


if __name__=='__main__':verify()
