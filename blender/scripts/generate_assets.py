"""Original modular Bastions asset pack. Blender 4.x/5.x; no external assets.

Run: blender --background --python blender/scripts/generate_assets.py -- --output public/assets/models
Units are meters; Z up in Blender, Y up in exported glTF. One gameplay cell = 1 m.
"""
import bpy
import math
import json
import argparse
import sys
from pathlib import Path
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='public/assets/models')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
source_dir = Path(__file__).resolve().parents[1] / 'scenes'
source_dir.mkdir(parents=True, exist_ok=True)
manifest = []

COLORS = {'stone':'9b9e95','light':'c4c6b6','dark':'616b68','wood':'755234','edge':'b58b53','roof':'36576b','iron':'3d484a','gold':'c6a366','blue':'3d80a0','white':'ece0b9','skin':'d8ab82','frost':'a8e1e8','arcane':'b99be6','fire':'f2a052','leaf':'3c6850','poison':'9ab663','orc':'687652','red':'823f35'}
MATERIALS = {}
for name, value in COLORS.items():
    color = tuple(int(value[i:i+2], 16)/255 for i in (0,2,4))
    mat = bpy.data.materials.new('MAT_' + name)
    mat.diffuse_color = (*color,1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Roughness'].default_value = .85
    if name in ('frost','arcane','fire'):
        shader.inputs['Emission Color'].default_value = (*color,1)
        shader.inputs['Emission Strength'].default_value = .25
    MATERIALS[name] = mat

def begin():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def finish_obj(name, color):
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MATERIALS[color])
    return obj

def box(name, pos, size, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = finish_obj(name, color)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj

def cylinder(name,pos,radius,depth,color,vertices=8,top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if top is None else top, depth=depth, location=pos)
    return finish_obj(name,color)

def orb(name,pos,radius,color):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=radius,location=pos)
    return finish_obj(name,color)

def beam(name,a,b,width,color):
    start,end=Vector(a),Vector(b)
    obj=box(name,(start+end)/2,(width,width,(end-start).length),color)
    obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
    return obj

def flag(x,y,z,scale=1,color='blue'):
    cylinder('Banner_pole',(x,y,z+.8*scale),.025*scale,1.6*scale,'wood',6)
    box('Banner_cloth',(x+.17*scale,y,z+1.16*scale),(.34*scale,.035,.53*scale),color)
    box('Banner_heraldry',(x+.17*scale,y-.025,z+1.16*scale),(.055*scale,.02,.28*scale),'gold')
    cylinder('Banner_finial',(x,y,z+1.66*scale),.06*scale,.17*scale,'gold',4,0)

def crenels(z,w=.84):
    box('Stone_cornice',(0,0,z),(w,w,.12),'light')
    for x in [-1,1]:
        for y in [-1,1]:
            box('Merlon',(x*(w/2-.08),y*(w/2-.08),z+.15),(.2,.2,.25),'stone')

def bow(z,large=False):
    w=.84 if large else .62
    cylinder('Swivel_mount',(0,0,z-.12),.15,.22,'iron',8)
    box('Windlass_stock',(0,0,z),(.13,.84,.12),'wood')
    beam('Bow_limb_L',(-w/2,-.3,z),(0,-.48,z),.085,'edge')
    beam('Bow_limb_R',(w/2,-.3,z),(0,-.48,z),.085,'edge')
    beam('Bow_string_L',(-w/2,-.3,z),(0,.3,z),.014,'white')
    beam('Bow_string_R',(w/2,-.3,z),(0,.3,z),.014,'white')
    box('Siege_bolt',(0,-.1,z+.08),(.034,1,.035),'iron')

def tower(family,tier=1,advanced=False):
    box('Foundation',(0,0,.10),(.88,.88,.20),'dark')
    box('Plinth',(0,0,.25),(.76,.76,.13),'stone')
    if family == 'archer':
        for x in [-.29,.29]:
            for y in [-.29,.29]: box('Timber_column',(x,y,.72),(.105,.105,.85),'wood')
        beam('Diagonal_brace',(-.3,.3,.33),(.3,.3,1.06),.065,'edge')
        box('Firing_platform',(0,0,1.08),(.80,.80,.13),'edge')
        for y in [-.36,.36]: box('Timber_parapet',(0,y,1.25),(.8,.06,.20),'wood')
        cylinder('Archer_tunic',(0,0,1.3),.12,.24,'blue',5,.08)
        orb('Archer_head',(0,0,1.51),.09,'skin')
        cylinder('Archer_helmet',(0,0,1.60),.11,.12,'iron',6,0)
        beam('Archer_bow',(.2,-.05,1.25),(.24,-.05,1.65),.025,'edge')
    elif family in ('crossbow','ballista'):
        box('Stone_pier',(0,0,.54),(.63,.63,.49),'stone')
        crenels(.83)
        bow(1.1,family=='ballista')
    elif family=='mage':
        cylinder('Spire',(0,0,.92),.36,1.20,'stone',6,.27)
        cylinder('Crown',(0,0,1.52),.30,.18,'light',6,.40)
        for x in [-.3,.3]: box('Runic_inlay',(x,0,1.08),(.035,.11,.39),'arcane')
        cylinder('Focus_mount',(0,0,1.7),.12,.20,'gold',6,.05)
        obj=orb('Arcane_focus',(0,0,1.94),.25,'arcane');obj.scale.z=1.4
    elif family in ('frost','temple'):
        box('Sanctuary_nave',(0,0,.66),(.66,.68,.70),'light')
        roof=cylinder('Pavilion_roof',(0,0,1.28),.55,.57,'roof',4,0)
        roof.rotation_euler.z=math.pi/4
        box('Stained_glass',(0,-.355,.78),(.16,.035,.28),'frost' if family=='frost' else 'gold')
        cylinder('Bell_turret',(0,0,1.59),.11,.4,'light',6,.07)
        focus=orb('Sacred_focus',(0,0,1.87),.17,'frost' if family=='frost' else 'gold');focus.scale.z=1.2
    elif family=='fire':
        cylinder('Watchtower',(0,0,.82),.38,1.05,'stone',8,.31)
        crenels(1.35)
        cylinder('Brazier',(0,0,1.53),.15,.24,'iron',8,.30)
        cylinder('Flame',(0,0,1.87),.23,.6,'fire',5,0)
        cylinder('Flame_core',(0,0,1.85),.1,.53,'gold',5,0)
    elif family=='alchemist':
        box('Workshop',(0,0,.65),(.66,.7,.66),'wood')
        roof=cylinder('Workshop_roof',(0,0,1.19),.57,.51,'leaf',4,0);roof.rotation_euler.z=math.pi/4
        box('Stone_chimney',(.21,.21,1.19),(.14,.16,.64),'stone')
        orb('Reagent_flask',(-.28,-.4,.52),.15,'poison')
        cylinder('Flask_neck',(-.28,-.4,.69),.065,.20,'poison',6)
        cylinder('Cauldron',(.32,.1,.45),.21,.31,'iron',8,.16)
    if tier>=2 or advanced:
        for x in [-.36,.36]: box('Iron_reinforcement',(x,-.34,.62),(.10,.12,.6),'iron')
    if tier>=3 or advanced:
        box('Veteran_stone_course',(0,0,.41),(.86,.84,.25),'stone')
        box('Shield_badge',(0,-.44,.57),(.18,.045,.25),'blue')
    if tier>=4 or advanced: flag(-.35,.29,.45,.6)
    if tier>=5 or advanced:
        for x in [-.37,.37]:
            box('Royal_trim',(x,-.34,.76),(.07,.08,.74),'gold')
            cylinder('Royal_finial',(x,-.34,1.17),.08,.27,'gold',4,0)
    if advanced:
        for x in [-.43,.43]:
            cylinder('Flanking_turret',(x,.28,.78),.17,.9,'light',6,.13)
            cylinder('Flanking_roof',(x,.28,1.44),.2,.42,'roof',6,0)
        box('Gilded_foundation',(0,0,.22),(.94,.94,.09),'gold')

def tree():
    cylinder('Trunk',(0,0,.6),.14,1.2,'wood',5,.08)
    for z,r,h in [(1.5,.8,1.6),(2.15,.6,1.4),(2.75,.4,1.1)]: cylinder('Pine_canopy',(0,0,z),r,h,'leaf',7,0)

def character(kind):
    size={'goblin':.6,'grunt':.85,'troll':1.25,'ogre':1.75,'shaman':1,'warlord':2.1}[kind]
    for x in [-.13,.13]:
        box('Leg',(x,0,.24),(.15,.18,.38),'wood')
        box('Foot',(x,-.05,.07),(.18,.25,.12),'dark')
    cylinder('Torso',(0,0,.58),.16,.45,'orc',6,.22)
    orb('Head',(0,-.03,.93),.19,'orc')
    for x in [-.28,.28]: box('Arm',(x,0,.63),(.14,.17,.38),'orc')
    for x in [-.09,.09]: cylinder('Tusk',(x,-.2,.85),.025,.11,'white',4,0)
    if kind in ('ogre','warlord'): box('Shield',(-.34,-.16,.57),(.3,.10,.4),'iron')
    if kind=='shaman':
        beam('Shaman_staff',(.36,0,.12),(.36,0,1.32),.045,'wood')
        orb('Staff_focus',(.36,0,1.35),.13,'poison')
    else:
        beam('Axe_handle',(.31,0,.26),(.31,-.1,.9),.05,'wood')
        box('Axe_head',(.31,-.1,.91),(.24,.10,.18),'iron')
    for obj in bpy.context.scene.objects:
        obj.location*=size;obj.scale*=size
    # Simple source rig for later authored animation. Runtime uses lightweight procedural limbs.
    bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
    rig=bpy.context.object;rig.name='RIG_'+kind
    root=rig.data.edit_bones[0];root.name='root';root.head=(0,0,0);root.tail=(0,0,.5*size)
    bone=rig.data.edit_bones.new('spine');bone.head=root.tail;bone.tail=(0,0,1*size);bone.parent=root
    bpy.ops.object.mode_set(mode='OBJECT')

def export(name,kind='prop',**metadata):
    file=name+'.glb'
    # Join static pieces by material to reduce draw calls; keep origins at the grid center.
    if kind!='character':
        for mat in MATERIALS.values():
            pieces=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
            if not pieces: continue
            bpy.ops.object.select_all(action='DESELECT')
            for obj in pieces: obj.select_set(True)
            bpy.context.view_layer.objects.active=pieces[0]
            if len(pieces) > 1:
                bpy.ops.object.join()
            bpy.context.scene.cursor.location=(0,0,0)
            bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
            bpy.context.object.name=name+'_'+mat.name
    bpy.ops.export_scene.gltf(filepath=str(output/file),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    triangles=sum(len(o.data.loop_triangles) or sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
    manifest.append({'file':file,'kind':kind,'triangles':triangles,**metadata})
    # Save the modular source for the royal archer and rigged orc as representative authoring scenes.
    if name in ('human_archer_t5','orc_grunt'): bpy.ops.wm.save_as_mainfile(filepath=str(source_dir/(name+'.blend')))

# Shared geometry is generated by node tools/export-defender-meshes.mjs.
# Convert Three.js Y-up coordinates to Blender Z-up; glTF export reverses this.
hero_source = Path(__file__).resolve().parents[1] / 'generated' / 'defenders.json'
for hero in json.loads(hero_source.read_text()):
    if hero['family']=='archer': continue  # Authored directly in Blender below.
    begin()
    for part_index, part in enumerate(hero['parts']):
        color = part['color']
        key = 'hero_' + '_'.join(str(round(c,6)) for c in color)
        if key not in MATERIALS:
            mat = bpy.data.materials.new(key)
            mat.diffuse_color = (*color,1)
            mat.use_nodes = True
            shader = mat.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value = (*color,1)
            shader.inputs['Roughness'].default_value = .88
            MATERIALS[key] = mat
        positions = part['positions']
        vertices = [(positions[i],-positions[i+2],positions[i+1]) for i in range(0,len(positions),3)]
        indices = part['indices'] or list(range(len(vertices)))
        faces = [indices[i:i+3] for i in range(0,len(indices),3)]
        mesh = bpy.data.meshes.new('Defender_part')
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        obj = bpy.data.objects.new('Defender_part',mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(MATERIALS[key])
    name = f"advanced_{hero['family']}" if hero.get('advanced') else f"human_{hero['family']}_t{hero['tier']}"
    export(name,'tower',family=hero['family'],tier=hero['tier'],style=hero['style'])
begin();box('Ruin_base',(0,0,.08),(.86,.86,.16),'dark');box('Broken_wall',(0,.16,.29),(.77,.3,.32),'stone');box('Rubble',(-.13,-.18,.2),(.47,.28,.23),'light');export('barricade')
begin();tree();export('pine_tree')
begin();cylinder('Trunk',(0,0,.65),.12,1.3,'wood',6,.07);orb('Crown',(0,0,1.75),.85,'leaf');export('deciduous_tree')
begin();orb('Rock',(0,0,.3),.6,'dark');export('rock')
begin();box('Wall',(0,0,.7),(2,.5,1.4),'stone');[box('Merlon',(x,0,1.55),(.25,.55,.3),'light') for x in [-.8,-.4,0,.4,.8]];export('castle_wall')
begin();box('Keep',(0,0,1.4),(2.1,2.1,2.8),'stone');cylinder('Roof',(0,0,3.6),1.8,1.6,'roof',4,0);flag(0,0,4.4,.8);export('human_keep')
begin();box('House',(0,0,.5),(1.4,1.1,1),'light');cylinder('Roof',(0,0,1.45),1.05,.95,'wood',4,0);export('medieval_house')
begin();cylinder('Barrel',(0,0,.3),.24,.6,'wood',10);[cylinder('Iron_band',(0,0,z),.25,.04,'iron',10) for z in [.12,.47]];export('barrel')
begin();box('Crate',(0,0,.27),(.52,.52,.54),'edge');beam('Brace',(-.22,-.27,.05),(.22,-.27,.49),.06,'wood');export('crate')
begin();flag(0,0,0);export('human_banner')
begin();beam('Firewood',(-.35,-.2,.12),(.35,.2,.12),.12,'wood');cylinder('Flames',(0,0,.45),.23,.7,'fire',5,0);export('campfire')
begin();[box('Fence_post',(x,0,.4),(.1,.1,.8),'wood') for x in [-.6,0,.6]];box('Fence_rail',(0,0,.55),(1.4,.08,.09),'edge');export('wooden_fence')
begin();[orb('Cliff_block',(x,0,.7),1,'dark') for x in [-.8,.3,1]];export('cliff_module')
begin();cylinder('Orc_tent',(0,0,.8),1,1.6,'red',4,0);flag(.7,.4,0,.8,'red');export('orc_warcamp')
for kind in ['goblin','grunt','troll','ogre','shaman','warlord']:
    begin();character(kind);export('orc_'+kind,'character')
(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer
author_archer.OUT=output
author_archer.generate(render=False)
import author_army
author_army.OUT=output
author_army.generate(render=False)
print(f'BASTIONS: exported {len(manifest)+6} original GLB assets to {output}')
