"""Small production sculpt pass: fuse anatomy, retain equipment and articulation."""
import bpy, math
from mathutils import Vector


def fuse(objects, name, voxel=.015, triangle_budget=1400, material=None):
    parts=[o for o in objects if o and o.type=='MESH']
    if not parts:return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    o=parts[0];bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if len(parts)>1:bpy.ops.object.join()
    o.name=name
    bpy.context.view_layer.update()
    extent=max(p.z for p in (o.matrix_world@Vector(v) for v in o.bound_box))-min(p.z for p in (o.matrix_world@Vector(v) for v in o.bound_box))
    voxel=min(voxel,max(.003,extent/42))
    # Voxel union removes the intersecting spheres at the neck, cheeks and nose.
    m=o.modifiers.new('Continuous sculpted surface','REMESH');m.mode='VOXEL';m.voxel_size=voxel;m.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Relax sculpt','SMOOTH');m.factor=.7;m.iterations=4
    bpy.ops.object.modifier_apply(modifier=m.name)
    count=sum(len(p.vertices)-2 for p in o.data.polygons)
    if count>triangle_budget:
        m=o.modifiers.new('Game silhouette retopology','DECIMATE');m.ratio=triangle_budget/count
        bpy.ops.object.modifier_apply(modifier=m.name)
    if material:
        o.data.materials.clear();o.data.materials.append(material)
        for p in o.data.polygons:p.material_index=0
    for p in o.data.polygons:p.use_smooth=True
    return o


def soften_surfaces(objects):
    """Round cloth, skin and leather normals; retain deliberate hard metal edges."""
    hard=('blade','shield','rune','crystal','shard','lightning','arrowhead','steel','plate','plank','chassis','stock','banner','mitre','crest','spike','bone','fang','tusk')
    for o in objects:
        if o.type!='MESH':continue
        if any(tag in o.name.lower() for tag in hard):continue
        # Cylinders keep flat end caps, while their sides shade as a curved surface.
        for p in o.data.polygons:
            if len(p.vertices)<=4:p.use_smooth=True


def human():
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    head=[o for o in objects if o.name.split('.')[0] in ('Neck','Head','Cheek planes','Nose')]
    skin=next((m for o in head for m in o.data.materials if m.name.startswith('Warm skin')),None)
    fuse(head,'Unified face and neck',.012,1200,skin)
    for prefixes,name in [
        (('Fitted leather jerkin','Front leather breastplate'),'Tailored seamless jerkin'),
        (('Sleeve shoulder','Cloth upper arm'),'Continuous archer sleeves'),
        (('Shaped shoulder','Tailored upper sleeve'),'Continuous tailored sleeves'),
    ]:
        pieces=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(prefixes)]
        if len(pieces)>1:fuse(pieces,name,.017,650,pieces[0].data.materials[0])
    # The fitted neck extends to the torso rather than stopping at a visible sphere.
    soften_surfaces([o for o in bpy.context.scene.objects if o.type=='MESH'])


def hostile():
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    head=[o for o in objects if o.name.split('.')[0] in ('Neck','Orc cranium','Heavy lower jaw','Broad nose','Angry brow','Pointed ear')]
    skin=next((m for o in head for m in o.data.materials if m.name.startswith('Skin')),None)
    fuse(head,'Sculpted warband face',.013,1500,skin)
    torso=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.split('.')[0] in ('Barrel torso','Sculpted chest','Deltoid','Upper arm')]
    if torso:fuse(torso,'Continuous muscular torso',.022,1450,torso[0].data.materials[0])
    soften_surfaces([o for o in bpy.context.scene.objects if o.type=='MESH'])


def elemental():
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(('Elemental leg','Elemental foot','Massive arm','Faceted torso','Ancient head'))]
    if parts:fuse(parts,'Continuous elemental body',.028,2100,parts[0].data.materials[0])
    soften_surfaces([o for o in bpy.context.scene.objects if o.type=='MESH'])


def budget_meshes(maximum=9600):
    """Keep the tiny game figures bounded while preserving small face/gear details."""
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
    counts={o:sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects}
    total=sum(counts.values())
    if total>maximum:
        small=sum(n for n in counts.values() if n<220)
        ratio=max(.35,(maximum-small)/(total-small))*.98
        for o,n in counts.items():
            if n<220:continue
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            m=o.modifiers.new('Realtime triangle allowance','DECIMATE');m.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=m.name)
    for o in objects:o.data.validate(clean_customdata=False);o.data.update()
