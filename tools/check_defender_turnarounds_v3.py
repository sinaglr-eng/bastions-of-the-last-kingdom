"""Independent Blender structural QA for saved v3 native defender scenes.

Run with Blender 5.2: blender -b --python tools/check_defender_turnarounds_v3.py
Inspects evaluated actual meshes, physical hands, materials, rigid parents and
rank equipment. It does not replace the separate raster-fidelity comparison,
claim invisible-shape accuracy, or treat successful export as visual approval.
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import re
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
FAMILIES = ['soldier', 'archer', 'druid', 'mage', 'cleric', 'runebreaker',
            'frostwarden', 'stormcaller']
COLORS = ['3989ed', '3eac63', '9555d8', 'eee9db', 'e7b43f', 'ffd969']


def part(obj):
    return str(obj.get('part', obj.name))


def material_key(mat):
    return mat.name.split('.')[0].removeprefix('MAT_')


def materials(obj):
    return {material_key(m) for m in obj.data.materials if m}


def ancestor_hand(obj):
    parent = obj.parent
    while parent:
        match = re.match(r'^hand_([LR])(?:_|\.|$)', parent.name)
        if match:
            return 'left' if match.group(1) == 'L' else 'right'
        parent = parent.parent
    return None


def connected_components(bm):
    pending = set(bm.verts)
    count = 0
    while pending:
        count += 1
        stack = [pending.pop()]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in pending:
                    pending.remove(neighbor)
                    stack.append(neighbor)
    return count


def material_report(mat):
    shader = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    rgba = list(shader.inputs['Base Color'].default_value) if shader else list(mat.diffuse_color)
    srgb = [x*12.92 if x <= .0031308 else 1.055*x**(1/2.4)-.055 for x in rgba[:3]]
    return {'name': mat.name, 'key': material_key(mat), 'baseColorLinearRGBA': rgba,
            'baseColorSRGB': srgb, 'alphaMode': mat.surface_render_method}


def mesh_report(obj, graph, root_translation):
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    points = [evaluated.matrix_world@v.co for v in mesh.vertices]
    normalized = [p-root_translation for p in points]
    areas = [(points[t.vertices[1]]-points[t.vertices[0]]).cross(
        points[t.vertices[2]]-points[t.vertices[0]]).length/2 for t in mesh.loop_triangles]
    degenerate = sum((points[t.vertices[1]]-points[t.vertices[0]]).cross(
        points[t.vertices[2]]-points[t.vertices[0]]).length < 1e-10
        for t in mesh.loop_triangles)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    result = {'part': part(obj), 'object': obj.name,
              'vertices': len(mesh.vertices), 'triangles': len(mesh.loop_triangles),
              'degenerateTriangles': degenerate,
              'nonFiniteVertices': sum(not all(math.isfinite(v) for v in p) for p in points),
              'nonManifoldEdges': sum(not e.is_manifold for e in bm.edges),
              'boundaryEdges': sum(e.is_boundary for e in bm.edges),
              'wireEdges': sum(e.is_wire for e in bm.edges),
              'connectedComponents': connected_components(bm),
              'signedVolumeLocal': float(bm.calc_volume(signed=True)),
              'signedVolumeWorld': float(bm.calc_volume(signed=True)*evaluated.matrix_world.to_3x3().determinant()),
              'minimumTriangleAreaWorld': min(areas) if areas else None,
              'minimumPolygonAreaLocal': min(p.area for p in mesh.polygons) if mesh.polygons else None,
              'boundsWithoutLayoutTranslation': {
                  'min': [min(p[i] for p in normalized) for i in range(3)],
                  'max': [max(p[i] for p in normalized) for i in range(3)]},
              'materials': sorted(materials(obj)),
              'materialSlots': [material_report(m) for m in obj.data.materials if m],
              'handAncestor': ancestor_hand(obj)}
    bm.free()
    evaluated.to_mesh_clear()
    return result


def linear_hex(value):
    values = [int(value[i:i+2], 16)/255 for i in (0, 2, 4)]
    return [x/12.92 if x <= .04045 else ((x+.055)/1.055)**2.4 for x in values]


def check_unit(root, meshes, objects):
    family, rank = str(root['family']), int(root['tier'])
    graph = bpy.context.evaluated_depsgraph_get()
    root_translation = root.matrix_world.translation.copy()
    reports = [mesh_report(obj, graph, root_translation) for obj in meshes]
    checks = []

    def check(name, passed, actual=None, expected=None):
        checks.append({'name': name, 'passed': bool(passed),
                       'actual': actual, 'expected': expected})

    def exact(tag):
        return [o for o in meshes if part(o) == tag]

    def matching(fragment):
        return [o for o in meshes if fragment.lower() in part(o).lower()]

    def count(tag, number):
        actual = len(exact(tag))
        check('inventory:'+tag, actual == number, actual, number)

    def fragments(fragment, number):
        actual = len(matching(fragment))
        check('inventory:'+fragment, actual == number, actual, number)

    def role(tag, side):
        selected = exact(tag)
        check('hand:'+tag, bool(selected) and all(ancestor_hand(o) == side for o in selected),
              [ancestor_hand(o) for o in selected], side)
        inverse = root.matrix_world.inverted()
        centroid_x = []
        for o in selected:
            p = [inverse@(o.matrix_world@v.co) for v in o.data.vertices]
            centroid_x.append(sum(v.x for v in p)/len(p))
        sign = -1 if side == 'left' else 1
        check('anatomical_side:'+tag, bool(centroid_x) and all(x*sign > .01 for x in centroid_x),
              centroid_x, side+' half-space')

    check('evaluated_meshes_have_no_degenerate_triangles',
          all(r['degenerateTriangles'] == 0 for r in reports),
          sum(r['degenerateTriangles'] for r in reports), 0)
    check('evaluated_meshes_have_finite_vertices',
          all(r['nonFiniteVertices'] == 0 for r in reports),
          sum(r['nonFiniteVertices'] for r in reports), 0)
    check('evaluated_solid_meshes_are_watertight',
          all(r['nonManifoldEdges'] == 0 for r in reports),
          {r['part']: r['nonManifoldEdges'] for r in reports if r['nonManifoldEdges']}, 0)
    check('evaluated_closed_meshes_have_positive_volume',
          all(r['signedVolumeLocal'] > 1e-12 for r in reports),
          {r['part']: r['signedVolumeLocal'] for r in reports if r['signedVolumeLocal'] <= 1e-12}, '>0')
    hand_joints = [o for o in objects if o.type == 'EMPTY' and re.match(r'^hand_[LR](?:_|\.|$)', o.name)]
    check('exactly_two_rigid_hand_joints', len(hand_joints) == 2,
          [o.name for o in hand_joints], 2)
    hand_meshes = [o for o in meshes if 'glove_mitten' in part(o) or
                   part(o) == 'storm_right_open_brown_casting_palm']
    check('exactly_two_physical_hand_meshes', len(hand_meshes) == 2,
          [part(o) for o in hand_meshes], 2)
    check('one_physical_hand_per_own_side',
          Counter(ancestor_hand(o) for o in hand_meshes) == {'left': 1, 'right': 1},
          dict(Counter(ancestor_hand(o) for o in hand_meshes)), {'left': 1, 'right': 1})
    check('runtime_family_and_rank_identity', family in FAMILIES and rank in range(1, 7),
          [family, rank], 'stable basic family, I..VI')
    check('rank_color_root_property', root.get('rankColor', '').lower() == '#'+COLORS[rank-1],
          root.get('rankColor'), '#'+COLORS[rank-1])
    blue = {m for obj in meshes for m in obj.data.materials if m and material_key(m) == 'blue'}
    expected_color = linear_hex(COLORS[rank-1])
    errors = []
    for mat in blue:
        shader = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
        rgb = list(shader.inputs['Base Color'].default_value[:3]) if shader else list(mat.diffuse_color[:3])
        errors.append(max(abs(rgb[i]-expected_color[i]) for i in range(3)))
    check('actual_cloth_material_color', bool(errors) and max(errors) < 1e-6,
          max(errors) if errors else None, 'linear sRGB delta <1e-6')
    if family == 'soldier':
        count('wooden_spear_shaft', int(rank == 1))
        count('wooden_spear_point', int(rank == 1))
        count('sword_blade', int(rank >= 2))
        count('wooden_shield', int(rank in (3, 4)))
        count('iron_shield', int(rank >= 5))
        count('breastplate', int(rank >= 4))
        count('closed_helm', int(rank == 6))
        count('helmet', int(2 <= rank <= 5))
        if rank == 1:
            role('wooden_spear_shaft', 'right')
        else:
            role('sword_blade', 'right')
        if rank >= 3:
            role('wooden_shield' if rank < 5 else 'iron_shield', 'left')
        fragments('shoulder_plate_', 2 if rank >= 5 else 0)
        fragments('armored_greave_', 2 if rank >= 5 else 0)
    elif family == 'archer':
        count('Continuous_Recurve_Bow', 1)
        count('Single_Right_Back_Quiver', 1)
        fragments('Arrow_Shaft_', 3)
        count('leather_jerkin', int(rank >= 3))
        count('silver_chest_edging', int(rank == 6))
        fragments('shoulder_plate_', 2 if rank >= 5 else 0)
        role('Continuous_Recurve_Bow', 'left')
        q = exact('Single_Right_Back_Quiver')[0]
        p = [root.matrix_world.inverted()@(q.matrix_world@v.co) for v in q.data.vertices]
        check('single_quiver_own_right_back', all(v.x > 0 and v.y < 0 for v in p),
              [min(v.x for v in p), max(v.y for v in p)], 'X>0,Y<0')
    elif family == 'druid':
        count('Druid_One_Crooked_Oak_Staff_Shaft', 1)
        count('Druid_One_Broad_Green_Staff_Leaf', int(rank <= 3))
        count('Druid_Left_Broad_Staff_Leaf', int(rank >= 4))
        count('Druid_Right_Broad_Staff_Leaf', int(rank >= 4))
        count('Druid_One_Green_Seed_Stone', int(rank >= 5))
        fragments('_Two_End_Antler_Main', 2 if rank >= 3 else 0)
        fragments('_Two_End_Antler_Inner_Prong', 2 if rank >= 3 else 0)
        role('Druid_One_Crooked_Oak_Staff_Shaft', 'right')
    elif family in ('mage', 'cleric'):
        prefix = 'Mage_Spellbook' if family == 'mage' else 'Cleric_Devotional_Book'
        count(prefix+'_One_Plain_Page_Block', int(rank in (4, 5)))
        count(prefix+'_Left_One_Open_Page_Block', int(rank == 6))
        count(prefix+'_Right_One_Open_Page_Block', int(rank == 6))
        if rank in (4, 5):
            role(prefix+'_One_Plain_Page_Block', 'left')
        if rank == 6:
            role(prefix+'_Left_One_Open_Page_Block', 'left')
            role(prefix+'_Right_One_Open_Page_Block', 'left')
        if family == 'mage':
            count('Mage_Exactly_One_Violet_Diamond_Crystal', 1)
            count('Mage_One_Plain_Wooden_Staff_Shaft', 1)
            count('Mage_Pointed_No_Brim_Cap', int(rank == 1))
            count('Mage_One_Broad_Thin_Wizard_Brim', int(rank >= 2))
            role('Mage_One_Plain_Wooden_Staff_Shaft', 'right')
        else:
            cross = 'Cleric_Exactly_One_Plain_Gold_Latin_Cross'
            count(cross, 1)
            count('Cleric_One_Plain_Wooden_Cross_Staff_Shaft', 1)
            count('Cleric_Plain_Deep_Mitre_Two_Front_Back_Peaks', int(rank >= 2))
            count('Cleric_One_Broad_Front_Stole', int(rank >= 2))
            role(cross, 'right')
            fragments('sun', 0)
            o = exact(cross)[0]
            check('cross_is_gold_only', materials(o) == {'gold'}, sorted(materials(o)), ['gold'])
            z = sorted(set(round(v.co.z, 6) for v in o.data.vertices))
            check('cross_lower_stem_longer_than_upper', len(z) == 4 and z[1]-z[0] > (z[-1]-z[-2])*1.5,
                  z, 'lower stem >1.5 times upper')
    elif family == 'runebreaker':
        count('engineer_plain_faceted_workcap', 1)
        count('engineer_one_copper_beard_wedge', 1)
        count('engineer_single_left_hip_straight_ruler', 1)
        count('engineer_wooden_hammer_handle', 1)
        count('engineer_whole_wooden_mallet_head', int(rank == 1))
        count('engineer_plain_iron_hammer_head', int(rank in (2, 3)))
        count('engineer_single_broad_carpenter_claw', int(rank in (4, 5)))
        count('engineer_single_master_carpenter_claw', int(rank == 6))
        count('engineer_plain_leather_apron', int(rank in (2, 3)))
        count('engineer_long_wide_leather_apron', int(rank >= 4))
        fragments('_cap_top_goggle_lens', 2 if rank >= 3 else 0)
        count('engineer_right_working_forearm_wide_leather_bracer', int(rank in (3, 4)))
        count('engineer_single_front_protective_chest_panel', int(rank == 6))
        role('engineer_wooden_hammer_handle', 'right')
    elif family == 'frostwarden':
        spear = 'frost_entire_continuous_ice_spear'
        count(spear, 1)
        role(spear, 'right')
        count('frost_one_connected_ivory_winter_collar', int(rank >= 2))
        count('frost_small_hexagonal_ice_shield', int(rank in (3, 4)))
        count('frost_large_hexagonal_ice_shield', int(rank >= 5))
        fragments('_shoulder_plate', 2 if rank == 6 else 0)
        o = exact(spear)[0]
        check('entire_spear_is_ice_only', materials(o) == {'ice'}, sorted(materials(o)), ['ice'])
        mr = next(r for r in reports if r['part'] == spear)
        check('entire_spear_is_one_connected_mesh', mr['connectedComponents'] == 1,
              mr['connectedComponents'], 1)
        if rank >= 3:
            role('frost_small_hexagonal_ice_shield' if rank < 5 else 'frost_large_hexagonal_ice_shield', 'left')
            count('frost_shield_rear_handle', 1)
    elif family == 'stormcaller':
        count('storm_one_connected_swept_back_hair', 1)
        count('storm_one_simple_zigzag_lightning', int(rank <= 4))
        count('storm_one_three_prong_lightning', int(rank >= 5))
        count('storm_plain_thin_circlet', int(2 <= rank <= 4))
        count('storm_plain_broad_circlet', int(rank >= 5))
        count('storm_right_small_silver_hand_back_plate', int(rank == 6))
        count('storm_right_open_brown_casting_palm', 1)
        count('Storm_Long_Two_Point_Cape', int(rank >= 4))
        fragments('_shoulder_plate', 2 if rank == 6 else 0)
        role('storm_one_simple_zigzag_lightning' if rank <= 4 else 'storm_one_three_prong_lightning', 'right')
        for fragment in ('staff', 'orb', 'shield', 'hood'):
            fragments(fragment, 0)
        if rank >= 4:
            cape = exact('Storm_Long_Two_Point_Cape')[0]
            hem_points = [v.co.z for v in list(cape.data.vertices)[-7:]]
            lowest = min(hem_points)
            tips = sum(abs(z-lowest) < 1e-6 for z in hem_points)
            check('storm_cape_has_two_lowest_tips', tips == 2, tips, 2)
    # Actual forearm steel assignment must match each specialist progression.
    if family in ('runebreaker', 'frostwarden', 'stormcaller'):
        for side in ('left', 'right'):
            obj = exact(side+'_bracer')[0]
            expected = (rank >= 5 if family == 'runebreaker' else rank >= 4
                        if family == 'frostwarden' or side == 'left' else rank >= 3)
            check('steel_forearm:'+side, ('steel' in materials(obj)) == expected,
                  sorted(materials(obj)), 'steel' if expected else 'brown')
    body_reports = [r for r in reports if r['part'] != 'Foundation_Hexagonal_Stone']
    face = next((r for r in reports if r['part'] == 'Angular_Face'), None)
    body_bounds = {'min': [min(r['boundsWithoutLayoutTranslation']['min'][i] for r in body_reports) for i in range(3)],
                   'max': [max(r['boundsWithoutLayoutTranslation']['max'][i] for r in body_reports) for i in range(3)]}
    bare_h = face['boundsWithoutLayoutTranslation']['max'][2] if face else None
    joints = [{'name': o.name, 'worldPosition': list(o.matrix_world.translation),
               'positionWithoutLayoutTranslation': list(o.matrix_world.translation-root_translation)} for o in hand_joints]
    check('physical_body_solesshare_zero_without_foundation', abs(body_bounds['min'][2]) < .002,
          body_bounds['min'][2], '0 ± .002')
    return {'family': family, 'rank': rank, 'sceneRoot': root.name,
            'layoutRootTranslation': list(root_translation),
            'layoutRootScale': list(root.matrix_world.to_scale()),
            'measurementCoordinateRule': 'Subtract world root translation only; preserve actual dwarf scale, geometry and orientation.',
            'physicalBodyBoundsWithoutFoundation': body_bounds,
            'bareBodyHMeasured': bare_h,
            'bareBodyHFromAuthoringConfig': 1.682*root.matrix_world.to_scale().z,
            'bareBodyHMeaning': 'Measured Angular_Face skull maximum Z above sole, omitting headgear/equipment/foundation. Closed Soldier VI omits hidden face, so measured H is null and only inferred authoring H is supplied.',
            'handJoints': joints,
            'meshCount': len(meshes), 'triangles': sum(r['triangles'] for r in reports),
            'passed': all(c['passed'] for c in checks),
            'checks': checks, 'evaluatedMeshReports': reports,
            'limitations': ['No raster-fidelity or anatomical-landmark pass is inferred.',
                            'General overlapping-volume/self-intersection analysis is not performed; modular seams and intentionally nested clothing need visual review.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--family')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    root_dir = args.root.resolve()
    selected = args.family.split(',') if args.family else FAMILIES
    reports, missing = [], []
    for family in selected:
        path = root_dir/f'blender/scenes/hooded-turnarounds-v3/{family}_ranks.blend'
        if not path.exists():
            missing.extend((family, r) for r in range(1, 7))
            continue
        bpy.ops.wm.open_mainfile(filepath=str(path))
        bpy.context.view_layer.update()
        roots = [o for o in bpy.data.objects if o.get('assetRevision') == 'hooded-turnarounds-v3'
                 and o.get('family') == family and o.type == 'EMPTY']
        for rank in range(1, 7):
            matches = [o for o in roots if o.get('tier') == rank]
            if len(matches) != 1:
                missing.append((family, rank))
                continue
            unit = matches[0]
            objects = list(unit.children_recursive)
            preview_objects = [o for o in objects if o.get('previewOnly') or
                               part(o).lower().startswith('preview_')]
            meshes = [o for o in objects if o.type == 'MESH' and o not in preview_objects]
            result = check_unit(unit, meshes, objects)
            result['excludedPreviewObjects'] = [o.name for o in preview_objects]
            result['sceneFile'] = str(path.relative_to(root_dir))
            reports.append(result)
            failures = [c['name'] for c in result['checks'] if not c['passed']]
            print(f"STRUCTURAL {family} {rank}: {'PASS' if result['passed'] else 'FAIL'} {failures}", flush=True)
    summary = {'blenderVersion': bpy.app.version_string, 'expectedUnits': len(selected)*6,
               'checkedUnits': len(reports), 'passedUnits': sum(r['passed'] for r in reports),
               'failedUnits': sum(not r['passed'] for r in reports), 'missingUnits': missing,
               'scope': 'Independent evaluated native-mesh topology, degeneracy, material, physical-hand and rank-inventory checks.',
               'passed': len(reports) == len(selected)*6 and all(r['passed'] for r in reports),
               'visualFidelityEvaluated': False}
    output = root_dir/'output/design/hooded-turnarounds-v3/structural-qa.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'summary': summary, 'units': reports}, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == '__main__':
    main()
