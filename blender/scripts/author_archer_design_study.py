"""Two independent Archer design prototypes, authored and reviewed in Blender.

Run: blender --background --python blender/scripts/author_archer_design_study.py
Optional arguments after --: --only geometric|ranger|comparison, --quick
Writes only dedicated study files. It does not replace the game's approved assets.
"""
from pathlib import Path
import argparse
import json
import math
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODULES = Path(__file__).resolve().parent / 'archer_design_study'
sys.path.insert(0, str(MODULES))
SCENES = ROOT / 'blender/scenes/archer-design-study-v1'
RENDERS = ROOT / 'blender/renders/archer-design-study-v1'
EXPORTS = ROOT / 'output/design/archer-models-v1'
CONCEPTS = ROOT / 'output/design/archer-concepts'
for folder in (SCENES, RENDERS, EXPORTS):
    folder.mkdir(parents=True, exist_ok=True)


def color(hex_color):
    def linear(v):
        v = int(v, 16) / 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return tuple(linear(hex_color[i:i + 2]) for i in (0, 2, 4)) + (1,)


def material(name, hex_color, roughness=.8):
    mat = bpy.data.materials.new('MAT_' + name)
    mat.use_nodes = True
    mat.diffuse_color = color(hex_color)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = roughness
    return mat


def palette():
    return {key: material(key, value) for key, value in {
        'blue': '2C497A', 'navy': '1E3255', 'skin': 'D4AB76',
        'wood': '5B3E2A', 'boots': '443126', 'trousers': '363639',
        'fletching': 'D2C8AE', 'belt': '503A29', 'buckle': 'BEB092',
        'eyes': '222529', 'stone': 'C8B99D',
    }.items()}


def relocate(obj, collection):
    for old in tuple(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def make_collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def base(collection, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.47, depth=.12,
                                        location=(0, 0, .06))
    obj = relocate(bpy.context.object, collection)
    obj.name = 'Foundation_Hexagonal_Stone'
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Small consistent edge bevel', 'BEVEL')
    bevel.width = .013
    bevel.segments = 1
    obj['role'] = 'foundation'
    return obj


def configure(quick=False):
    scene = bpy.context.scene
    scene.name = 'Archer design study'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24 if quick else 64
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -.15
    world = bpy.data.worlds.new('Warm neutral studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.62, .66, .74, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
    scene.world = world
    studio = make_collection('STUDIO - cameras, lights and floor')
    floor_mat = material('studio_floor', 'EAE4D9', .95)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
    floor = relocate(bpy.context.object, studio)
    floor.name = 'Studio_Floor'
    floor.data.materials.append(floor_mat)
    for name, pos, power, size, rgb in [
        ('Key_Softbox', (-3.5, 4.5, 6), 550, 4, (1, .95, .86)),
        ('Fill_Softbox', (4, 1.5, 4), 350, 3.5, (.86, .92, 1)),
        ('Rim_Softbox', (-1, -4, 5), 650, 3, (1, .93, .82)),
    ]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        obj = relocate(bpy.context.object, studio)
        obj.name = name
        obj.data.energy = power
        obj.data.shape = 'DISK'
        obj.data.size = size
        obj.data.color = rgb
        obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=(3.4, 6, 3.5))
    camera = relocate(bpy.context.object, studio)
    camera.name = 'CAM_01_Hero'
    camera.data.type = 'ORTHO'
    camera.data.lens = 55
    scene.camera = camera
    scene['purpose'] = 'Compare geometric and hooded Archer designs before selecting the final design.'
    scene['model_status'] = 'Editable static design prototype'
    return camera, studio


def camera_view(camera, name, pos, target, scale, resolution):
    camera.name = name
    camera.location = pos
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = resolution
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.shading.type = 'MATERIAL'
                space.overlay.show_overlays = False
                space.region_3d.view_perspective = 'CAMERA'
                space.region_3d.view_camera_zoom = 8
                space.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
                space.region_3d.view_location = Vector(target)
                space.region_3d.view_distance = scale * 1.5


def add_reference(filename, title):
    coll = make_collection('REFERENCE - ' + title + ' (packed concept image)')
    image = bpy.data.images.load(str(CONCEPTS / filename), check_existing=True)
    image.pack()
    obj = bpy.data.objects.new(title + '_Concept_Sheet', None)
    coll.objects.link(obj)
    obj.empty_display_type = 'IMAGE'
    obj.data = image
    obj.empty_display_size = 3
    obj.location = (0, -1, 1.1)
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.hide_render = True
    coll.hide_viewport = True
    coll.hide_render = True
    return coll


def build_character(kind, mats):
    import importlib
    module = importlib.import_module(kind)
    coll = make_collection('MODEL - ' + ('01 Geometric Archer' if kind == 'geometric' else '03 Hooded Ranger'))
    objects = module.build(coll, mats)
    objects.append(base(coll, mats['stone']))
    for obj in objects:
        obj['design'] = kind
    return coll, objects


def metrics(objects):
    graph = bpy.context.evaluated_depsgraph_get()
    tris, vertices, points, parts = 0, 0, [], []
    for obj in objects:
        if obj.type not in ('MESH', 'CURVE'):
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        count = len(mesh.loop_triangles)
        tris += count
        vertices += len(mesh.vertices)
        for vertex in mesh.vertices:
            point = evaluated.matrix_world @ vertex.co
            if not all(math.isfinite(float(v)) for v in point):
                raise ValueError('Non-finite geometry in ' + obj.name)
            points.append(tuple(point))
        parts.append({'name': obj.name, 'triangles': count})
        evaluated.to_mesh_clear()
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert tris < 10000, ('Design exceeds normal defender budget', tris)
    assert low[2] > -.01 and high[2] < 2.3, ('Unexpected Z bounds', low, high)
    return {'triangles': tris, 'evaluated_vertices': vertices, 'editable_parts': len(parts),
            'bounds_min': low, 'bounds_max': high, 'parts': parts}


def export_glb(kind, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in objects if o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=str(EXPORTS / ('archer-' + kind + '-v1.glb')),
                              export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_extras=True, export_animations=False)
    bpy.ops.object.select_all(action='DESELECT')


def save(path):
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path))


def render(filename):
    bpy.context.scene.render.filepath = str(RENDERS / filename)
    bpy.ops.render.render(write_still=True)


def standalone(kind, quick=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = palette()
    camera, studio = configure(quick)
    coll, objects = build_character(kind, mats)
    add_reference('archer-01-geometric.png' if kind == 'geometric' else 'archer-03-hooded-ranger.png', kind)
    report = metrics(objects)
    export_glb(kind, objects)
    camera_view(camera, 'CAM_01_Hero', (3.4, 6, 3.5), (-.13, 0, 1.06), 2.7, (1200, 1200))
    path = SCENES / ('archer-' + kind + '-v1.blend')
    bpy.context.scene.render.filepath = str(RENDERS / (kind + '-hero.png'))
    save(path)
    render(kind + '-hero.png')
    for name, pos in [('front', (-.12, 6, 1.12)), ('back', (.12, -6, 1.12)), ('side', (-6, 0, 1.12))]:
        view_camera = camera.copy()
        view_camera.data = camera.data.copy()
        studio.objects.link(view_camera)
        camera_view(view_camera, 'CAM_' + name.title(), pos, (-.12, 0, 1.12), 2.5, (1000, 1200))
        render(kind + '-' + name + '.png')
    game_camera = camera.copy()
    game_camera.data = camera.data.copy()
    studio.objects.link(game_camera)
    camera_view(game_camera, 'CAM_05_Game_Angle', (3.4, 5, 6), (-.13, 0, 1), 2.55, (1000, 1000))
    render(kind + '-game-angle.png')
    camera_view(camera, 'CAM_01_Hero', (3.4, 6, 3.5), (-.13, 0, 1.06), 2.7, (1200, 1200))
    bpy.context.scene.render.filepath = str(RENDERS / (kind + '-hero.png'))
    save(path)
    report.update({'source': str(path.relative_to(ROOT)),
                   'glb': str((EXPORTS / ('archer-' + kind + '-v1.glb')).relative_to(ROOT)),
                   'reference': 'archer-01-geometric.png' if kind == 'geometric' else 'archer-03-hooded-ranger.png'})
    (EXPORTS / (kind + '-metrics.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('STUDY_COMPLETE', kind, report['triangles'], report['editable_parts'], flush=True)


def label(text, camera, studio, xy, mat):
    data = bpy.data.curves.new(text, type='FONT')
    data.body = text
    data.size = .125
    data.align_x = 'CENTER'
    obj = bpy.data.objects.new(text, data)
    studio.objects.link(obj)
    obj.parent = camera
    obj.location = (xy[0], xy[1], -5)
    obj.data.materials.append(mat)
    return obj


def comparison(quick=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = palette()
    camera, studio = configure(quick)
    horizontal = Vector((-6, 3.4, 0)).normalized()
    for kind, amount in [('geometric', -1), ('ranger', 1)]:
        coll, objects = build_character(kind, mats)
        offset = horizontal * amount * .93
        for obj in objects:
            if obj.parent is None:
                obj.location += offset
        add_reference('archer-01-geometric.png' if kind == 'geometric' else 'archer-03-hooded-ranger.png', kind)
    camera_view(camera, 'CAM_Comparison', (3.4, 6, 3.5), (-.13, 0, 1.04), 4.5, (1800, 1200))
    label('01 / GEOMETRIC', camera, studio, (-.9, 1.27), mats['eyes'])
    label('03 / HOODED RANGER', camera, studio, (.96, 1.27), mats['eyes'])
    bpy.context.scene.render.filepath = str(RENDERS / 'archer-comparison.png')
    save(SCENES / 'archer-comparison-v1.blend')
    render('archer-comparison.png')
    print('COMPARISON_COMPLETE', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', choices=('geometric', 'ranger', 'comparison'))
    parser.add_argument('--quick', action='store_true')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = parser.parse_args(argv)
    if args.only in (None, 'geometric'):
        standalone('geometric', args.quick)
    if args.only in (None, 'ranger'):
        standalone('ranger', args.quick)
    if args.only in (None, 'comparison'):
        comparison(args.quick)


if __name__ == '__main__':
    main()
