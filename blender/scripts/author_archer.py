"""Original Blender-authored ranger. Run with blender -b --python this_file.

Editable named parts, six rank materials, GLBs, transparent portraits and review scene.
This is deliberately independent of the older procedural defender geometry.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import cohesive

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/models'
PORTRAITS = ROOT / 'public/assets/archer'
SCENES = ROOT / 'blender/scenes'
for folder in (OUT, PORTRAITS, SCENES): folder.mkdir(parents=True, exist_ok=True)
COLORS = ['3989ed', '3eac63', '9555d8', 'eee9db', 'e7b43f', 'ffd969']
NAMES = ['Azure recruit', 'Verdant scout', 'Violet ranger', 'Ivory sentinel', 'Golden warden', 'Radiant exemplar']

def linear(c):
    v = int(c, 16) / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def mat(name, color, metal=0, glow=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    rgba = (*[linear(color[i:i+2]) for i in (0, 2, 4)], 1)
    m.diffuse_color = rgba; s = m.node_tree.nodes.get('Principled BSDF')
    s.inputs['Base Color'].default_value = rgba
    s.inputs['Roughness'].default_value = .62 if metal else .83
    s.inputs['Metallic'].default_value = metal
    s.inputs['Emission Color'].default_value = rgba
    s.inputs['Emission Strength'].default_value = glow
    return m

def finish(o, name, material):
    o.name = name; o.data.materials.append(material)
    return o

def cube(name, pos, scale, material, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos); o = bpy.context.object
    o.dimensions = scale; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Rounded crafted edges', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, material)

def ellipsoid(name, pos, scale, material, segments=12, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=pos)
    o = bpy.context.object; o.scale = scale
    for p in o.data.polygons:p.use_smooth=True
    return finish(o, name, material)

def cylinder(name, pos, radius, depth, material, vertices=12, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if top is None else top, depth=depth, location=pos)
    return finish(bpy.context.object, name, material)

def rod(name, a, b, r, material, vertices=6, end=None):
    a,b = Vector(a),Vector(b)
    o = cylinder(name, (a+b)/2, r, (b-a).length, material, vertices, end)
    o.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return o

def custom(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(vertices, [], faces); mesh.update()
    o = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(o)
    return finish(o, name, material)

def torus(name, pos, radius, tube, material):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=4, location=pos, major_radius=radius, minor_radius=tube)
    return finish(bpy.context.object, name, material)

def build_archer(rank):
    before=set(bpy.context.scene.objects)
    cloth=mat('Rank_%s_cloth'%rank,COLORS[rank-1]); lining=mat('Rank_%s_shadow'%rank, ['184775','205a37','482969','8c9299','8f611d','b98b30'][rank-1])
    trim=mat('Antique brass','c9a764',.65); leather=mat('Chestnut leather','60412e'); dark=mat('Dark seams and boots','302c29')
    skin=mat('Warm skin','d7a27c'); lightSkin=mat('Face highlights','efbd91'); hair=mat('Auburn hair','623922')
    stone=mat('Weathered limestone','adb4a0'); edge=mat('Cut stone sides','66766b'); steel=mat('Steel arrowhead','b5c7c8',.65)
    ivory=mat('Linen and fletching','e7ddbb'); eye=mat('Eyes','18272d'); glow=mat('Exemplar radiance','ffe5a0',.35,2.2)
    cylinder('Octagonal footing',(0,0,.055),.44,.11,edge,8)
    cylinder('Beveled limestone top',(0,0,.125),.415,.07,stone,8,top=.385)
    torus('Rank inlay',(0,0,.166),.353,.013,cloth)
    # A grounded asymmetric stance, with individually modeled boots, cuffs and knees.
    for x,y,angle in [(-.135,.075,-.1),(.145,-.035,.12)]:
        foot=cube('Leather boot toe',(x,y+.065,.24),(.18,.29,.16),dark,.028); foot.rotation_euler[2]=angle
        rod('Boot shaft',(x,y,.28),(x*.93,y-.018,.59),.083,leather,8,end=.074)
        cylinder('Boot cuff',(x*.93,y-.018,.58),.09,.064,trim,8)
        rod('Trouser leg',(x*.93,y-.018,.6),(x*.65,0,.88),.078,lining,8,end=.102)
        cube('Shin guard',(x,y+.073,.415),(.098,.027,.2),leather,.012)
        rod('Shin seam',(x-.029,y+.092,.34),(x-.029,y+.092,.48),.005,trim,4)
    cylinder('Tunic skirt',(0,0,.845),.26,.23,cloth,8,top=.19)
    for x in [-.16,0,.16]:
        panel=cube('Split tunic hem',(x,.127,.827),(.11,.07,.24),cloth,.018); panel.rotation_euler[1]=x*.45
        cube('Tunic hem stitching',(x,.17,.724),(.08,.011,.016),trim,.004)
    # Tapered leather cuirass with colored sleeves, broad enough to read at game scale.
    cylinder('Fitted leather jerkin',(0,0,1.12),.19,.38,leather,8,top=.255)
    cube('Front leather breastplate',(0,.163,1.135),(.29,.063,.26),leather,.035)
    for x in [-.1,.1]:
        rod('Breastplate seam',(x,.203,1.03),(x*1.22,.207,1.24),.006,trim,4)
    cylinder('Waist belt',(0,0,.97),.209,.073,dark,12)
    cube('Belt buckle',(0,.212,.97),(.074,.026,.064),trim,.008)
    cube('Buckle inset',(0,.23,.972),(.036,.01,.033),dark,.003)
    pouch=cube('Belt pouch',(.205,.077,.918),(.105,.1,.135),leather,.016)
    cube('Pouch clasp',(.205,.132,.942),(.026,.015,.028),trim,.002)
    # Flowing, asymmetric cape: pleated mesh with a pointed hem, not a flat slab.
    verts=[]
    for z,width,y in [(1.43,.24,-.055),(1.18,.29,-.19),(.88,.33,-.29),(.61,.38,-.31)]:
        for j in range(7):
            t=j/6; verts.append(((t-.5)*width*2,y+(.045 if j%2 else -.025),z+(abs(t-.5)*.11 if z<.7 else 0)))
    faces=[(r*7+j,r*7+j+1,(r+1)*7+j+1,(r+1)*7+j) for r in range(3) for j in range(6)]
    cape=custom('Sculpted seven-pleat cape',verts,faces,cloth)
    solid=cape.modifiers.new('Cape thickness','SOLIDIFY');solid.thickness=.022;bpy.context.view_layer.objects.active=cape;bpy.ops.object.modifier_apply(modifier=solid.name)
    for j in (0,6):
        for r in range(3): rod('Cape stitched border',verts[r*7+j],verts[(r+1)*7+j],.009,trim,5)
    # Collar, neck and a face inside a deep open hood.
    cylinder('Neck',(0,.015,1.425),.085,.16,skin,10)
    cylinder('Mantle collar',(0,0,1.39),.268,.11,cloth,10,top=.19)
    ellipsoid('Head',(0,.035,1.68),(.17,.14,.215),skin,16,8)
    ellipsoid('Cheek planes',(0,.127,1.64),(.145,.055,.115),lightSkin,10,5)
    ellipsoid('Nose',(0,.198,1.672),(.036,.038,.047),skin,8,4)
    for x in [-.066,.066]:
        cube('Eye white',(x,.179,1.705),(.052,.012,.025),ivory,.005)
        cube('Focused pupil',(x-.005,.188,1.706),(.022,.009,.024),eye,.003)
        brow=cube('Auburn eyebrow',(x,.186,1.741),(.06,.014,.013),hair,.003); brow.rotation_euler[1]=-x
    rod('Mouth',(-.041,.182,1.594),(.041,.182,1.594),.006,leather,5)
    # Hood shell connects an open face arch to the rear, with a sculpted crown.
    arch=[(-.175,.173,1.535),(-.212,.164,1.69),(-.196,.13,1.847),(-.10,.127,1.942),(0,.138,1.985),(.10,.127,1.942),(.196,.13,1.847),(.212,.164,1.69),(.175,.173,1.535)]
    rear=[(x*.91,-.142,z-.035) for x,y,z in arch]
    hv=arch+rear+[(0,-.203,1.74)]
    hf=[(i,i+1,10+i,9+i) for i in range(8)]+[(9+i,10+i,18) for i in range(8)]+[(17,9,18)]
    custom('Open hood shell',hv,hf,cloth)
    for i in range(8): rod('Hood contrast piping',arch[i],arch[i+1],.014,lining,6)
    for x in [-.137,.137]: rod('Loose hair lock',(x,.117,1.79),(x*.97,.137,1.55),.025,hair,5,end=.008)
    # Stretched bow arm and bent drawing arm; separate bracers, gloves and fingers.
    arms=[((-.22,.005,1.33),(-.4,.16,1.35),(-.60,.25,1.36)),((.22,.005,1.33),(.41,.08,1.24),(.095,.275,1.40))]
    for a,b,c in arms:
        ellipsoid('Sleeve shoulder',a,(.12,.12,.13),cloth,10,5)
        rod('Cloth upper arm',a,b,.082,cloth,8,end=.069)
        rod('Leather bracer',b,c,.078,leather,8,end=.058)
        mid=Vector(b).lerp(Vector(c),.18);end=Vector(b).lerp(Vector(c),.30)
        rod('Bracer brass binding',mid,end,.08,trim,8)
        ellipsoid('Gloved hand',c,(.075,.062,.066),leather,10,5)
        for d in [-.03,0,.03]: rod('Glove finger',(c[0]-.038,c[1]+.034,c[2]+d),(c[0]+.025,c[1]+.049,c[2]+d),.01,skin,5)
    # Recurve bow with laminated limbs and separate taut bowstring.
    bow=[(-.59,.25,.76),(-.67,.25,.86),(-.72,.25,1.02),(-.695,.25,1.18),(-.625,.25,1.36),(-.695,.25,1.54),(-.72,.25,1.70),(-.67,.25,1.86),(-.59,.25,1.96)]
    for i in range(len(bow)-1):
        rod('Recurve bow limb',bow[i],bow[i+1],.026 if i in (0,7) else .034,leather,7)
        a,b=bow[i],bow[i+1];rod('Bow laminate', (a[0]-.023,a[1]+.009,a[2]),(b[0]-.023,b[1]+.009,b[2]),.009,trim,5)
    for z in [1.32,1.35,1.38,1.41]: cube('Bow grip wrapping',(-.639,.25,z),(.055,.071,.012),dark,.003)
    nock=(.10,.28,1.405)
    rod('Upper drawn bowstring',bow[-1],nock,.006,ivory,4);rod('Lower drawn bowstring',bow[0],nock,.006,ivory,4)
    rod('Nocked arrow',(-.85,.29,1.405),nock,.012,ivory,6)
    arrow=cylinder('Leaf arrowhead',(-.889,.29,1.405),.041,.10,steel,4,top=0);arrow.rotation_euler[1]=-math.pi/2
    custom('Arrow fletching',[(.02,.28,1.405),(.09,.28,1.405),(.09,.28,1.454),(.035,.28,1.44)],[(0,1,2,3)],cloth)
    # Diagonal chest strap and a full quiver behind the right shoulder.
    rod('Quiver shoulder strap',(-.18,.174,1.34),(.15,.207,1.01),.032,leather,6)
    cube('Strap clasp',(-.09,.197,1.25),(.039,.028,.045),trim,.004)
    rod('Quiver body',(.20,-.22,.91),(.28,-.23,1.43),.093,leather,10,end=.103)
    rod('Quiver rim',(.273,-.229,1.383),(.282,-.231,1.445),.111,trim,10)
    for j in range(4):
        x=.235+(j%2)*.065;y=-.23+(j//2)*.062;z=1.68+(j%3)*.045
        rod('Spare arrow shaft',(x-.05,y,1.16),(x,y,z),.009,ivory,5)
        custom('Spare arrow feather',[(x,y,z),(x-.034,y,z-.05),(x-.034,y,z-.13),(x,y,z-.09),(x+.034,y,z-.05),(x+.034,y,z-.13)],[(0,1,2,3),(0,4,5,3)],cloth)
    # Rank readability is color first. Equipment grows subtly, retaining one approved silhouette.
    for j in range(rank):
        x=-.105+j*.042
        cube('Rank stitching %s'%(j+1),(x,.221,1.102),(.018,.012,.032),trim,.003)
    if rank>=3:
        ellipsoid('Reinforced shoulder guard',(.235,-.005,1.397),(.143,.14,.075),leather,10,5)
        for x in [.17,.235,.30]: ellipsoid('Shoulder rivet',(x,.115,1.4),(.012,.012,.012),trim,6,3)
    if rank>=5:
        ellipsoid('Warden clasp',(0,.234,1.31),(.054,.023,.07),trim,8,4)
        ellipsoid('Warden gem',(0,.258,1.315),(.025,.012,.037),cloth,8,4)
    if rank==6:
        torus('Radiant ankle halo',(0,0,.23),.455,.012,glow)
        for j in range(8):
            a=j*math.tau/8
            ellipsoid('Floating light mote',(.46*math.cos(a),.46*math.sin(a),.48+(j%3)*.16),(.013,.013,.034),glow,6,4)
    return [o for o in bpy.context.scene.objects if o.type=='MESH' and o not in before]

def configure_scene():
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.cycles.use_denoising=True;scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX'
    scene.world.color=(.16,.19,.22)
    for name,pos,power,size,color in [('Key',(-3,4,6),480,4,(1,.90,.76)),('Cool fill',(4,2,4),320,3,(.65,.80,1)),('Rim',(-1,-4,5),620,3,(1,.86,.56))]:
        bpy.ops.object.light_add(type='AREA', location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(-3.3,6,3.5));cam=bpy.context.object;cam.name='Review camera';cam.data.type='ORTHO';cam.data.ortho_scale=2.5
    cam.rotation_euler=(Vector((-.15,0,1.02))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
    return cam

def generate(render=True):
    manifest_path=OUT/'manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else []
    manifest=[e for e in manifest if not(e.get('kind')=='tower' and e.get('family')=='archer')]
    rank_collections=[]
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for rank in range(1,7):
        collection=bpy.data.collections.new('ARCHER %s — %s'%(rank,NAMES[rank-1]));bpy.context.scene.collection.children.link(collection)
        build_archer(rank);cohesive.human()
        cohesive.budget_meshes()
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
        for o in objects:
            for c in list(o.users_collection):c.objects.unlink(o)
            collection.objects.link(o)
        # Join temporary copies by material for the game; keep named source parts editable.
        bpy.ops.object.select_all(action='DESELECT')
        copies=[]
        for material in {o.data.materials[0] for o in objects}:
            pieces=[]
            for original in objects:
                if original.data.materials[0]!=material:continue
                copy=original.copy();copy.data=original.data.copy();bpy.context.collection.objects.link(copy);pieces.append(copy)
            bpy.ops.object.select_all(action='DESELECT')
            for o in pieces:o.select_set(True)
            bpy.context.view_layer.objects.active=pieces[0]
            if len(pieces)>1:bpy.ops.object.join()
            copies.append(pieces[0])
        bpy.ops.object.select_all(action='DESELECT')
        for o in copies:o.select_set(True)
        file='human_archer_t%s.glb'%rank
        bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
        for o in copies:bpy.data.objects.remove(o,do_unlink=True)
        tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
        manifest.append(dict(file=file,kind='tower',family='archer',tier=rank,style='archer-v2',triangles=tris,authoring='Blender',rankColor='#'+COLORS[rank-1]))
        rank_collections.append(collection)
        for o in objects:o.hide_render=True;o.hide_set(True)
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    cam=configure_scene();scene=bpy.context.scene
    if render:
        scene.render.resolution_x=480;scene.render.resolution_y=560;scene.render.resolution_percentage=100
        for rank,col in enumerate(rank_collections,1):
            for o in col.objects:o.hide_render=False;o.hide_set(False)
            scene.render.filepath=str(PORTRAITS/('archer-t%s.png'%rank));bpy.ops.render.render(write_still=True)
            for o in col.objects:o.hide_render=True;o.hide_set(True)
    # All ranks spaced in the native authoring scene; a single camera frames the lineup.
    for i,col in enumerate(rank_collections):
        for o in col.objects:o.hide_render=False;o.hide_set(False);o.location.x+=(2.5-i)*1.62
    cam.location=(0,12,5.6);cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=10.8
    scene.render.resolution_x=2100;scene.render.resolution_y=700
    scene['Design status']='Archer V2: continuous sculpted anatomy, rounded leather, tailored sleeves.'
    scene['Ranks']='I blue / II green / III purple / IV ivory white / V gold / VI radiant gold'
    bpy.ops.wm.save_as_mainfile(filepath=str(SCENES/'archer_design_v1.blend'))
    if render:
        scene.render.filepath=str(PORTRAITS/'archer-lineup.png');bpy.ops.render.render(write_still=True)
    print('ARCHER V2: six sculpted Blender models, portraits and editable review scene ready.')

if __name__=='__main__':generate(render='--no-render' not in sys.argv)
