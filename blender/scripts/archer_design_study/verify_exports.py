"""Verify that both review GLBs retain the geometry saved in their Blender source."""
from pathlib import Path
import json
import math
import bpy

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'output/design/archer-models-v1'


def measure(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices = []
    triangles = 0
    materials = set()
    for obj in objects:
        if obj.type != 'MESH':
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        vertices += [tuple(evaluated.matrix_world @ v.co) for v in mesh.vertices]
        materials.update(m.name for m in obj.data.materials if m)
        evaluated.to_mesh_clear()
    low = [min(v[i] for v in vertices) for i in range(3)]
    high = [max(v[i] for v in vertices) for i in range(3)]
    assert all(math.isfinite(v) for v in low + high)
    return {'triangles': triangles, 'bounds_min': low, 'bounds_max': high,
            'material_count': len(materials)}


reports = {}
for kind in ('geometric', 'ranger'):
    scene_path = ROOT / 'blender/scenes/archer-design-study-v1' / ('archer-' + kind + '-v1.blend')
    bpy.ops.wm.open_mainfile(filepath=str(scene_path))
    collection = next(c for c in bpy.data.collections if c.name.startswith('MODEL - '))
    original = measure(collection.all_objects)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT / ('archer-' + kind + '-v1.glb')))
    exported = measure(bpy.context.scene.objects)
    assert original['triangles'] == exported['triangles'], (kind, original, exported)
    for field in ('bounds_min', 'bounds_max'):
        assert all(abs(a - b) < .0001 for a, b in zip(original[field], exported[field])), (kind, field)
    assert original['material_count'] == exported['material_count'], (kind, 'material mismatch')
    assert exported['triangles'] < 10000
    reports[kind] = {'source': original, 'glb': exported, 'status': 'PASS'}

(OUT / 'export-verification.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
print('EXPORT_VERIFICATION_PASS', json.dumps(reports), flush=True)
