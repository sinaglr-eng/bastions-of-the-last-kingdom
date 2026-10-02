"""Dark Host v3: fifty approved warbands and nine alternate native miniatures.

Blender 5.2: blender -b --python blender/scripts/author_enemies_v3.py
Optional --only host_50-tyrant, --no-render, --review. Original geometry only.
Native dimensions are intentional; never normalize the army to one height.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0, str(Path(__file__).resolve().parent))
import author_archer as A
from author_archer import cube, ellipsoid, cylinder, rod, custom, torus, mat

ROOT = A.ROOT
OUT = ROOT / 'public/assets/enemies'
SOURCES = ROOT / 'blender/scenes/enemies-v3'
REVIEWS = ROOT / 'blender/renders/enemies-v3'
DESIGNS = json.loads((ROOT / 'data/enemy-designs.json').read_text(encoding='utf-8'))
for directory in (OUT, SOURCES, REVIEWS): directory.mkdir(parents=True, exist_ok=True)


def clear():
    for obj in list(bpy.context.scene.objects): bpy.data.objects.remove(obj, do_unlink=True)
    for material in list(bpy.data.materials):
        if not material.users: bpy.data.materials.remove(material)


def meshes(): return [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']


def group(name, origin=(0, 0, 0), parts=()):
    obj = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(obj)
    obj.location = origin; obj['semanticPart'] = name
    bpy.context.view_layer.update()
    for part in parts:
        transform = part.matrix_world.copy(); part.parent = obj; part.matrix_world = transform
    return obj


def mark(name, builder):
    before = set(bpy.context.scene.objects); builder()
    return group(name, parts=[obj for obj in set(bpy.context.scene.objects)-before if not obj.parent])


def transform_parts(parts, scale=1, offset=(0, 0, 0)):
    bpy.context.view_layer.update()
    transform = Matrix.Translation(offset) @ Matrix.Diagonal((scale, scale, scale, 1))
    for obj in parts:
        if not obj.parent: obj.matrix_world = transform @ obj.matrix_world


def palette(wave, variant=''):
    colors = dict(Skin='789159', Shadow='465742', Dark='191923', Cloth='684739', Leather='49382c',
                  Iron='626a6e', Silver='bfc8cb', Copper='aa7042', Gold='d6ad52', Bone='e7d9b5',
                  Wood='64503c', Eye='f6d454', Soul='a1eacd', Rune='c789ee', Red='9a3f38', Moss='627a33')
    if wave in (3, 10, 22, 43): colors.update(Skin='a8937b', Shadow='716554')
    if wave in (8, 23, 27, 32, 33, 46) or variant == 'wraith': colors.update(Skin='a8bfc4', Shadow='5c7485', Soul='83dbd8', Cloth='526879')
    if wave in (16, 26, 31, 35, 36, 42, 44, 47, 48, 50) and variant != 'wraith': colors.update(Skin='444440', Shadow='262831', Rune='f2974c')
    if wave in (15, 19): colors.update(Shadow='632b30', Cloth='a84643', Eye='ed6660')
    if wave in (29, 37): colors.update(Shadow='272631', Cloth='503157', Rune='c69cef')
    if variant == 'devourer': colors.update(Skin='d3d1c9', Shadow='85858d', Iron='c1bdae', Rune='bfc8e7')
    if variant == 'tyrant': colors.update(Rune='ae73ef', Copper='d6ad52')
    result = {key: mat(key, color, .72 if key in ('Iron', 'Silver', 'Copper', 'Gold') else 0,
                       1.25 if key in ('Eye', 'Soul', 'Rune') else 0) for key, color in colors.items()}
    ghost = wave in (23, 27, 33, 46) or variant == 'wraith' and wave != 38
    if ghost:
        for key in ('Skin', 'Shadow', 'Cloth'):
            material=result[key]; material.diffuse_color=(*material.diffuse_color[:3], .62)
            material.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.62
            material.surface_render_method='DITHERED'
    return result


def arc(name, points, radius, material):
    for index, (a, b) in enumerate(zip(points, points[1:])): rod(name+str(index), a, b, radius, material, 7)


def skull(name, position, size, p):
    x,y,z=position
    ellipsoid(name+' skull', (x,y,z), (size*.8,size*.58,size), p['Bone'], 10, 6)
    cube(name+' lower jaw',(x,y+size*.24,z-size*.72),(size*1.04,size*.69,size*.43),p['Bone'],size*.04)
    for side in (-1,1): ellipsoid(name+' socket',(x+side*size*.31,y+size*.49,z+size*.15),(size*.24,size*.07,size*.24),p['Dark'],8,4)
    for j in range(3): cube(name+' tooth',(x+(j-1)*size*.27,y+size*.60,z-size*.50),(size*.13,size*.11,size*.22),p['Bone'],0)


def face(p, kind='orc', z=1.73, female=False):
    width = .23 if kind=='ogre' else .20 if kind=='troll' else .175 if kind=='goblin' else .19 if female else .21
    ellipsoid('anatomy cranium',(0,.035,z),(width,.17,.235),p['Skin'],14,8)
    ellipsoid('anatomy lower jaw',(0,.14,z-.11),(width*(.82 if female else .91),.105,.12),p['Skin'],12,6)
    ellipsoid('anatomy broad nose',(0,.223,z+.015),(.056 if kind!='troll' else .082,.075,.067),p['Skin'],10,5)
    for side in (-1,1):
        custom('anatomy pointed ear',[(side*width*.8,0,z+.05),(side*(width+.19),-.025,z+.20),(side*width,.065,z-.1),(side*(width+.04),.075,z+.04)],[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],p['Skin'])
        cube('deep eye socket',(side*.077,.174,z+.082),(.092,.029,.057),p['Dark'],.012)
        cube('hostile glowing eye',(side*.077,.195,z+.082),(.039,.013,.022),p['Eye'],.003)
        brow=cube('anatomy brow',(side*.077,.183,z+.124),(.108,.04,.035),p['Skin'],.012);brow.rotation_euler[1]=side*.20
        if kind!='goblin' or female:
            rod('ivory lower tusk',(side*.12,.228,z-.135),(side*.149,.255,z+.008),.032,p['Bone'],7,end=.002)
    rod('dark mouth',(-.064,.247,z-.10),(.064,.247,z-.10),.009,p['Dark'],6)


def humanoid(p, kind='orc', female=False, hollow=False):
    """Each species has different bone lengths and torso/face silhouette."""
    goblin=kind=='goblin'; troll=kind=='troll'; ogre=kind=='ogre'
    hip=.83 if goblin else .76; head=1.68 if goblin else 1.60 if troll else 1.68
    torso_width=.21 if goblin else .42 if ogre else .33 if troll else .28
    handx=.49 if troll else .46 if ogre else .37 if goblin else .43
    handz=.66 if troll else .91
    for side in (-1,1):
        before=set(meshes()); x=side*(.13 if goblin else .20 if ogre else .155)
        cube('hide toe boot',(x,.075,.105),(.15 if goblin else .25,.31,.18),p['Leather'],.025)
        rod('anatomy shin',(x,0,.20),(x,0,.49),.06 if goblin else .12 if ogre else .092,p['Skin'],9)
        rod('anatomy thigh',(x,0,.49),(side*.10,0,hip),.08 if goblin else .14 if ogre else .11,p['Skin'],9)
        group('leg_'+('L' if side<0 else 'R'),(side*.10,0,hip),set(meshes())-before)
    cylinder('ragged leather waist',(0,0,hip),torso_width*.83,.24,p['Leather'],10,top=torso_width*.72)
    if not hollow:
        ellipsoid('anatomy species torso',(0,-.045 if troll else 0,1.08),(torso_width,.27 if ogre else .20,.35),p['Skin'],16,9)
        if ogre: ellipsoid('anatomy enormous belly',(0,.18,.99),(.39,.22,.29),p['Skin'],14,8)
        for side in (-1,1):ellipsoid('anatomy pectoral',(side*torso_width*.42,.15,1.22),(torso_width*.52,.075,.13),p['Skin'],10,5)
    else:
        for side in (-1,1): rod('hollow torso side',(side*torso_width*.74,0,.86),(side*torso_width*.88,0,1.40),.075,p['Shadow'],8)
    cylinder('leather belt',(0,0,.87),torso_width*.86,.078,p['Leather'],12)
    cube('brass belt clasp',(0,.19,.87),(.095,.047,.07),p['Copper'],.01)
    for side in (-1,1):
        before=set(meshes()); shoulder=(side*torso_width,.01,1.35); elbow=(side*handx,.045,1.00 if troll else 1.14); hand=(side*handx,.17,handz)
        ellipsoid('anatomy shoulder',shoulder,(.11 if goblin else .16,.13,.17),p['Skin'],10,6)
        rod('anatomy upper arm',shoulder,elbow,.072 if goblin else .15 if ogre else .11,p['Skin'],9,end=.075 if goblin else .11)
        rod('anatomy lower arm',elbow,hand,.065 if goblin else .12,p['Skin'],9,end=.059 if goblin else .085)
        ellipsoid('anatomy broad hand',hand,(.074 if goblin else .115,.085,.09),p['Skin'],10,5)
        for finger in range(3):cube('hand knuckles',(hand[0]+(finger-1)*.048,hand[1]+.073,hand[2]),(.038,.034,.051),p['Skin'],.008)
        group('arm_'+('L' if side<0 else 'R'),shoulder,set(meshes())-before)
    cylinder('anatomy neck',(0,0,1.44),.088 if goblin else .145,.19,p['Skin'],10)
    face(p,kind,head,female)
    scale=.93 if goblin else 1.25 if troll else 1.34 if ogre else 1.06
    transform_parts(list(bpy.context.scene.objects),scale)
    return scale


def robe(p, name='tattered_robe', black=False):
    material=p['Dark'] if black else p['Cloth']
    verts=[]
    for z,width,y in [(1.44,.27,-.05),(1.14,.28,-.20),(.80,.33,-.28),(.40,.43,-.32)]:
        for j in range(7):verts.append(((j/6-.5)*width*2,y+(.035 if j%2 else -.03),z+(.13 if j%2 and z<.5 else 0)))
    faces=[(row*7+j,row*7+j+1,(row+1)*7+j+1,(row+1)*7+j) for row in range(3) for j in range(6)]
    cape=custom(name+' pleated cape',verts,faces,material)
    thickness=cape.modifiers.new('Double sided heavy cloth','SOLIDIFY');thickness.thickness=.018
    bpy.context.view_layer.objects.active=cape;bpy.ops.object.modifier_apply(modifier=thickness.name)
    cylinder(name+' collar',(0,-.01,1.43),.265,.11,material,10,top=.18)


def hood(p, black=False):
    material=p['Dark'] if black else p['Cloth']
    arch=[(-.23,.14,1.46),(-.25,.13,1.70),(-.16,.10,1.88),(0,.09,1.95),(.16,.10,1.88),(.25,.13,1.70),(.23,.14,1.46)]
    rear=[(x*.85,-.18,z-.025) for x,y,z in arch]
    obj=custom('open deep hood',arch+rear+[(0,-.25,1.68)],[(i,i+1,i+8,i+7) for i in range(6)]+[(i+7,i+8,14) for i in range(6)],material)
    thickness=obj.modifiers.new('Hood fabric','SOLIDIFY');thickness.thickness=.018;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=thickness.name)


def mask(p, stitched=False, red=False):
    cube('mask lower face',(0,.235,1.59),(.30,.065,.115),p['Red'] if red else p['Dark'],.018)
    if stitched:
        for j in range(5):rod('mask stitched mouth',(-.087+j*.043,.275,1.564),(-.073+j*.043,.275,1.617),.007,p['Bone'],5)


def axe(p, long=False, black=False, side=1):
    x=side*.47; length=2.02 if long else 1.40
    rod('axe wooden haft',(x,.17,.23),(x,.17,length),.032,p['Wood'],8)
    verts=[(x,.12,length),(x+side*.35,.12,length+.04),(x+side*.43,.12,length-.20),(x+side*.30,.12,length-.40),(x,.12,length-.27)]
    verts += [(vx,.20,vz) for vx,_,vz in verts]
    custom('black executioner axe blade' if black else 'broad axe blade',verts,[(0,1,2,3,4),(9,8,7,6,5)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)],p['Dark'] if black else p['Iron'])
    arc('axe bright cutting edge',[(x+side*.34,.109,length+.035),(x+side*.43,.109,length-.20),(x+side*.30,.109,length-.40)],.012,p['Silver'])


def spear(p, harpoon=False, curved=False):
    points=[(.43,.20,.10),(.43,.20,1.75),(.56,.20,2.10)] if curved else [(.43,.20,.10),(.43,.20,2.02)]
    arc('long spear shaft',points,.029,p['Wood']); x=points[-1][0];z=points[-1][2]
    rod('spear leaf head',(x,.20,z-.03),(x+.04,.20,z+.25),.073,p['Iron'],5,end=0)
    if harpoon:
        for side in (-1,1):rod('harpoon backward barb',(x,.20,z+.05),(x+side*.13,.20,z-.08),.025,p['Bone'],6,end=0)


def daggers(p, hook=False):
    for side in (-1,1):
        points=[(side*.43,.20,.88),(side*.54,.23,1.21),(side*.45,.23,1.40)]
        if hook:points.append((side*.32,.23,1.35))
        arc('hooked blade' if hook else 'curved dagger',points,.042,p['Iron'])
        rod('dagger sharpened tip',points[-2],points[-1],.024,p['Silver'],6,end=.003)


def armor(p, massive=False):
    material=p['Iron']; width=.73 if massive else .47
    cube('forged front cuirass',(0,.16,1.15),(width,.12,.34),material,.045)
    for j in range(3):cube('overlapping armored belly',(0,.18,1.03-j*.082),(width*.9-j*.035,.13,.13),material,.02)
    for side in (-1,1):
        ellipsoid('heavy shoulder pauldron',(side*width*.55,0,1.42),(.24 if massive else .18,.20,.10),material,10,5)
        for j in range(3):ellipsoid('armor brass rivet',(side*(width*.44+j*.047),.145,1.46),(.015,.015,.015),p['Copper'],6,4)
    cylinder('iron skullcap',(0,.025,1.95),.222,.18,material,10,top=.16)


def seals(p, z=1.35, orbit=False, silver=False):
    material=p['Silver'] if silver else p['Rune']; parts=[]
    for j in range(3):
        angle=j*math.tau/3; x=.42*math.cos(angle);y=.30*math.sin(angle)+.05
        shard=ellipsoid('protective shard '+str(j+1),(x,y,z),(.075,.043,.16),material,5,4);shard.rotation_euler[1]=.3*(j-1);parts.append(shard)
        shard['protectionIndex']=j
    group('refraction_shards',parts=parts)


def rune(p, location=(0,.22,1.21), size=.10):
    x,y,z=location
    arc('immunity rune',[ (x-size,y,z-size),(x,y,z+size),(x+size,y,z-size),(x-size*.5,y,z),(x+size*.5,y,z)],.012,p['Rune'])


def satchel(p, x=-.29, z=.84, gold=False):
    ellipsoid('stolen overflowing pouch',(x,.10,z),(.16,.13,.19),p['Leather'],10,6)
    for j in range(5):ellipsoid('looted coin',(x+(j%3-1)*.055,.177,z+.11+j//3*.04),(.035,.019,.035),p['Gold'] if gold else p['Copper'],8,4)


def bell(p, pos=(0,-.35,1.15), size=1):
    x,y,z=pos
    cylinder('cracked temple bell',(x,y,z),.34*size,.49*size,p['Copper'],12,top=.16*size)
    torus('flared bell lip',(x,y,z-.245*size),.35*size,.045*size,p['Copper'])
    rod('bell clapper',(x,y,z-.12*size),(x,y,z-.36*size),.033*size,p['Iron'],7)
    arc('bell black crack',[(x+.06*size,y+.28*size,z+.12*size),(x+.005*size,y+.29*size,z),(x+.08*size,y+.33*size,z-.23*size)],.009*size,p['Dark'])


def mushroom(p, x,y,z):
    rod('moss mushroom stem',(x,y,z),(x,y,z+.12),.021,p['Bone'],6)
    ellipsoid('moss mushroom cap',(x,y,z+.12),(.12,.09,.042),p['Red'],10,4)
    for j in (-1,1):ellipsoid('mushroom pale spot',(x+j*.033,y,z+.15),(.016,.014,.008),p['Bone'],6,3)


def thorn_roots(p):
    for side in (-1,1):
        arc('living root',[ (side*.18,.16,.77),(side*.29,.21,1.03),(side*.15,.24,1.30),(side*.36,.07,1.54)],.025,p['Wood'])
        for j in range(3):rod('fresh regenerating shoot',(side*(.18+j*.05),.14,1.16+j*.11),(side*(.22+j*.08),.19,1.29+j*.11),.015,p['Moss'],6,end=.004)


def chain(p, points, size=.045):
    for index,(a,b) in enumerate(zip(points,points[1:])):
        a=Vector(a);b=Vector(b);count=max(2,int((b-a).length/(size*1.45)))
        for j in range(count):
            ring=torus('interlocked iron chain',a.lerp(b,j/count),size,.010,p['Iron']);ring.rotation_euler[0]=math.pi/2 if j%2 else 0


def ground_design(p, wave, archetype, variant):
    species='goblin' if wave in (2,4,9,12,24) else 'ogre' if wave in (3,10,22,43,46) else 'troll' if wave in (6,8,17,20,21,32,49) or archetype=='blood-leech-troll' else 'orc'
    scale=humanoid(p,species,female=wave==13,hollow=wave in (32,46))
    if wave==33:
        for obj in list(meshes()):
            if obj.name.startswith(('anatomy species torso','anatomy pectoral','anatomy neck')):bpy.data.objects.remove(obj,do_unlink=True)
        for j,(x,z) in enumerate([(-.07,1.03),(.075,1.28)]):
            piece=ellipsoid('floating rift torso fragment',(x*scale,0,z*scale),(.21*scale,.16*scale,.092*scale),p['Skin'],9,5)
            group('rift_body_fragment_'+str(j),parts=[piece])
    if wave==46:
        for obj in list(meshes()):
            if obj.name.startswith(('anatomy','hand knuckles','ivory lower tusk','deep eye','hostile glowing','dark mouth')):bpy.data.objects.remove(obj,do_unlink=True)
    # Equipment is authored in the common anatomy coordinates, then transformed
    # by species scale; it follows the same silhouette, never a resized whole box.
    before=set(bpy.context.scene.objects)
    if wave==1:
        robe(p);hood(p);axe(p);satchel(p);skull('looted skull',(-.28,-.10,.90),.10,p)
    elif wave==2:
        spear(p,curved=True)
        for side in (-1,1):
            for j in range(3):rod('thorn reinforced boot',(side*.14,.12,.20+j*.07),(side*.25,.20,.25+j*.07),.025,p['Bone'],6,end=.002)
    elif wave==3:
        cylinder('stolen cooking pot helmet',(0,.025,1.98),.26,.21,p['Iron'],12)
        for side in (-1,1):arc('pot handle',[(side*.24,.01,2.06),(side*.34,.01,2.03),(side*.34,.01,1.95),(side*.24,.01,1.94)],.02,p['Iron'])
        rod('kitchen mallet handle',(.48,.15,.40),(.48,.15,1.45),.052,p['Wood'],8)
        cube('enormous kitchen mallet',(.48,.15,1.48),(.53,.32,.24),p['Wood'],.025)
        cylinder('hanging stolen frying pan',(-.29,.20,.78),.16,.04,p['Iron'],12).rotation_euler[0]=math.pi/2
        rod('frying pan handle',(-.29,.20,.87),(-.31,.20,1.17),.023,p['Iron'],6)
        for x in (-.08,.16):ellipsoid('hanging stolen meat',(x,.24,.77),(.07,.065,.13),p['Red'],9,5)
    elif wave==4:
        armor(p);axe(p)
        torus('stolen mill gear',(0,-.31,1.15),.30,.065,p['Iron'])
        for j in range(10):
            angle=j*math.tau/10; tooth=cube('mill gear teeth',(.32*math.cos(angle),-.31+.32*math.sin(angle),1.15),(.11,.11,.12),p['Copper'],.01);tooth.rotation_euler[2]=angle
        cube('tool spanner',(-.45,.18,1.14),(.07,.07,.51),p['Iron'],.01)
        for side in (-1,1):cube('spanner open jaw',(-.45+side*.06,.18,1.37),(.05,.07,.16),p['Iron'],.008)
    elif wave==6:
        for x,y,z in [(-.15,-.18,1.47),(.20,-.15,1.28),(0,-.27,1.54)]:
            ellipsoid('moss on hunch',(x,y,z),(.20,.11,.10),p['Moss'],10,5);mushroom(p,x,y,z+.05)
        for x in (-.13,.14):ellipsoid('moss covered runestone',(x,-.25,1.26),(.13,.09,.23),p['Iron'],7,5)
        rune(p,(-.13,-.33,1.26));rod('fallen tree club',(.49,.17,.55),(.49,.17,1.38),.095,p['Wood'],8,end=.06)
    elif wave==7:
        robe(p);spear(p,harpoon=True)
        skull('crocodile jaw helmet',(0,.045,1.86),.20,p)
        for side in (-1,1):
            for j in range(4):rod('crocodile helmet tooth',(side*.19,.18+j*.04,1.83),(side*.19,.18+j*.04,1.71),.024,p['Bone'],6,end=.002)
        for j in range(7):rod('reeds on cloak',((j-3)*.08,-.28,.8),((j-3)*.10,-.31,1.47+j%3*.08),.012,p['Moss'],5)
    elif wave==8:
        for side in (-1,1):arc('regeneration luminous wound',[(side*.10,.18,1.34),(side*.20,.19,1.18),(side*.13,.20,1.08)],.012,p['Soul'])
        for j in range(4):ellipsoid('smoky dissolving hem',((j-1.5)*.17,-.16,.54),(.11,.10,.21),p['Shadow'],8,5)
    elif wave==9:
        mask(p);robe(p);daggers(p)
        cube('dust dancer sash',(0,.195,1.06),(.38,.055,.15),p['Cloth'],.008)
    elif wave==10:
        armor(p,massive=True)
        cube('ripped castle door',(-.62,.31,.90),(.72,.14,1.49),p['Wood'],.024)
        for x in (-.94,-.75,-.55,-.30):cube('gate vertical planks',(x,.405,.90),(.018,.022,1.40),p['Dark'],0)
        for z in (.41,.86,1.39):cube('gate iron band',(-.62,.419,z),(.73,.07,.12),p['Iron'],.014)
        chain(p,[(-.40,.24,1.19),(-.59,.40,1.38),(-.71,.40,1.06)],.043)
        rod('ramming log',(.54,.19,.33),(.54,.19,1.58),.10,p['Wood'],10)
        ellipsoid('iron ram head',(.54,.19,1.57),(.22,.18,.18),p['Iron'],12,7)
        for side in (-1,1):arc('ram curled horn',[(.54+side*.15,.17,1.70),(.54+side*.28,.12,1.75),(.54+side*.32,.16,1.60),(.54+side*.25,.22,1.56)],.04,p['Bone'])
    elif wave==11:
        daggers(p,hook=True);chain(p,[(-.35,.20,1.31),(-.31,.25,.95),(.16,.24,.93)],.037)
        for side in (-1,1):cylinder('human helmet trophy',(side*.30,-.02,1.42),.14,.18,p['Iron'],10,top=.04)
    elif wave==12:
        robe(p);hood(p);bell(p)
        rod('bone bell mallet',(.43,.20,.73),(.43,.20,1.45),.035,p['Bone'],7)
        skull('mallet skull',(.43,.20,1.48),.12,p)
    elif wave==13:
        armor({**p,'Iron':p['Leather']});axe(p,long=True)
        for side in (-1,1):
            for j in range(7):ellipsoid('ruddy braided hair',(side*.185,-.025-j*.028,1.79-j*.068),(.051,.042,.052),p['Red'],8,5)
        for side in (-1,1):
            x=side*.12;cube('red handprint palm',(x,.229,1.20),(.07,.012,.073),p['Red'],.008)
            for j in range(4):rod('red handprint finger',(x+(j-1.5)*.02,.236,1.225),(x+(j-1.5)*.025,.236,1.29),.007,p['Red'],5)
    elif wave==14:
        armor(p);spear(p)
        cube('polished black mirror shield',(-.47,.29,1.05),(.47,.12,.80),p['Dark'],.052)
        for x in (-.65,-.29):rod('mirror silver border',(x,.357,.72),(x,.357,1.36),.015,p['Silver'],6)
        seals(p,silver=True)
    elif wave==16:
        hood(p);satchel(p,x=-.32,gold=True);satchel(p,x=.32,gold=True)
        cube('ash thief copper mask',(0,.235,1.70),(.30,.063,.29),p['Copper'],.026);rune(p)
    elif wave==17:
        rod('cursed root totem trunk',(-.51,-.09,.10),(-.51,-.09,2.21),.075,p['Wood'],8)
        for j in range(4):skull('stacked totem skull',(-.51,.00,.89+j*.34),.19,p)
        for side in (-1,1):arc('totem branching root',[(-.51,-.09,1.44),(-.51+side*.30,-.13,1.62),(-.51+side*.46,-.15,1.93)],.035,p['Wood'])
        robe(p)
    elif wave==18 or archetype=='swamp-knifer':
        hood(p,black=True);robe(p,black=True);mask(p,stitched=True);daggers(p,hook=True);rune(p,(.51,.25,1.15),.05)
    elif wave==20:
        for side in (-1,1):
            for j in range(3):arc('mammoth rib crown',[(side*(.13+j*.07),-.06,1.83),(side*(.29+j*.09),-.10,2.17+j*.11),(side*(.24+j*.07),-.12,2.37+j*.09),(side*(.10+j*.04),-.10,2.30+j*.08)],.041,p['Bone'])
        rod('giant spinal club',(.54,.17,.08),(.54,.17,2.09),.06,p['Bone'],9)
        for j in range(11):ellipsoid('spine club vertebra',(.54,.17,.38+j*.14),(.16,.12,.07),p['Bone'],8,5)
        for side in (-1,1):arc('back bone throne',[(side*.31,-.34,.86),(side*.36,-.33,1.65),(side*.27,-.35,2.10)],.045,p['Bone'])
        for j in range(4):rod('throne rib rail',(-.34,-.34,1.1+j*.21),(.34,-.34,1.1+j*.21),.027,p['Bone'],7)
    elif wave==21:
        thorn_roots(p);rune(p);rod('root cudgel',(.49,.17,.40),(.49,.17,1.70),.085,p['Wood'],9)
    elif wave==22:
        armor(p,massive=True)
        cube('closed ram visor',(0,.225,1.69),(.40,.13,.26),p['Iron'],.025)
        for side in (-1,1):arc('helmet ram horns',[(side*.15,.04,1.87),(side*.36,-.06,1.91),(side*.41,.07,1.69),(side*.25,.17,1.65)],.056,p['Bone'])
        rod('iron war mace haft',(.48,.17,.29),(.48,.17,1.39),.049,p['Iron'],8)
        ellipsoid('iron mace head',(.48,.17,1.44),(.23,.20,.24),p['Iron'],8,6)
    elif wave==23:
        robe(p);hood(p);seals(p);rune(p)
    elif wave==24:
        armor(p);axe(p)
        for side in (-1,1):
            for j in range(4):
                plate=cube('reactive riveted armor',(side*.34,.07,1.37-j*.15),(.18,.17,.15),p['Iron'],.017)
                for dy in (-.065,.065):ellipsoid('mutant armor rivet',(side*.34,.17+dy,1.37-j*.15),(.018,.018,.018),p['Copper'],6,3)
            arc('living iron framework',[(side*.31,-.09,.83),(side*.47,-.09,1.21),(side*.27,-.10,1.57)],.023,p['Copper'])
    elif wave==26:
        for j in range(6):ellipsoid('embedded spell eating obsidian',((j%3-1)*.15,.19,1.08+j//3*.24),(.08,.055,.115),p['Dark'],5,4)
        rune(p);arc('unnatural grin',[(-.17,.247,1.61),(-.06,.27,1.56),(.06,.27,1.56),(.17,.247,1.61)],.021,p['Dark'])
    elif wave==31:
        robe(p,black=variant!='wraith');hood(p,black=variant!='wraith');seals(p);rune(p)
        rod('inquisitor staff',(.44,.18,.05),(.44,.18,2.12),.035,p['Dark'],8)
        torus('inquisitor blazing seal',(.44,.18,2.07),.15,.027,p['Rune']).rotation_euler[0]=math.pi/2
    elif wave==32:
        for side in (-1,1):
            for j in range(5):arc('open chest ribs',[(side*.24,-.01,1.38-j*.085),(side*.23,.15,1.35-j*.085),(side*.065,.22,1.30-j*.085)],.023,p['Bone'])
        rod('lantern hanging chain',(0,.03,1.45),(0,.03,1.13),.014,p['Iron'],5)
        for side in (-1,1):rod('captive soul lantern frame',(side*.075,.05,.93),(side*.075,.05,1.20),.018,p['Iron'],6)
        ellipsoid('soul inside open ribs',(0,.075,1.065),(.077,.056,.11),p['Soul'],10,6)
    elif wave==33:
        # Split silhouettes keep three independent hover groups in native source.
        robe(p,black=True);hood(p,black=True);rune(p)
        for j in range(4):ellipsoid('floating rift fragment',((j-1.5)*.19,-.06,.66+j%2*.13),(.065,.075,.12),p['Skin'],7,5)
    elif wave==36:
        armor(p);axe(p);rune(p)
        for side in (-1,1):
            crest=cube('broken royal sigil',(side*.10,.232,1.29+side*.04),(.16,.019,.08),p['Gold'],.008);crest.rotation_euler[1]=side*.4
        rod('snapped heraldic crown',(0,.232,1.10),(0,.232,1.24),.018,p['Gold'],5)
    elif archetype=='blood-leech-troll':
        for side in (-1,1):
            ellipsoid('blood regeneration sack',(side*.18,-.29,1.33),(.20,.13,.31),p['Red'],12,7)
            arc('blood sack vein',[(side*.15,-.415,1.52),(side*.24,-.417,1.33),(side*.17,-.415,1.11)],.014,p['Soul'])
        thorn_roots(p)
    elif wave==41:
        armor(p);spear(p)
        custom('smoky crystal shield',[(-.65,.30,.70),(-.28,.30,.70),(-.23,.30,1.28),(-.45,.30,1.53),(-.70,.30,1.28),(-.45,.36,1.13)],[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5)],p['Shadow'])
        seals(p,z=1.54)
    elif wave==43:
        armor(p,massive=True)
        for side in (-1,1):
            x=side*.48
            for z in (1.45,1.97):cube('soul prison cage floor',(x,-.04,z),(.45,.37,.06),p['Iron'],.015)
            for dx in (-.19,.19):
                for y in (-.19,.11):rod('cage iron bar',(x+dx,y,1.47),(x+dx,y,1.96),.025,p['Iron'],6)
            for dx in (-.10,0,.10):rod('cage front bars',(x+dx,.12,1.47),(x+dx,.12,1.96),.018,p['Iron'],6)
            ellipsoid('soul prisoner',(x,-.035,1.70),(.095,.075,.17),p['Soul'],10,6)
        mask(p);axe(p)
    elif wave==44:
        armor(p);robe(p,black=True);axe(p,long=True,black=True);rune(p)
    elif wave==46:
        armor(p,massive=True)
        for side in (-1,1):
            rod('empty iron armored arm',(side*.4,.01,1.30),(side*.46,.17,.92),.135,p['Iron'],9,end=.10)
            cube('empty armored gauntlet',(side*.46,.18,.89),(.21,.19,.21),p['Iron'],.025)
            rod('empty ogre shin guard',(side*.20,0,.21),(side*.20,0,.62),.13,p['Iron'],9,end=.115)
            ellipsoid('ghost fire at armored elbow',(side*.46,.01,1.08),(.071,.07,.12),p['Soul'],7,5)
        for j in range(4):ellipsoid('ghost fire in empty armor',(0,.13,1.11+j*.10),(.10,.05,.17),p['Soul'],7,5)
        cube('empty ogre visor',(0,.215,1.70),(.35,.13,.25),p['Iron'],.02)
        cube('glowing empty eye slit',(0,.286,1.735),(.28,.017,.028),p['Soul'],.003)
    elif wave==49:
        armor(p,massive=True)
        ellipsoid('second belly maw',(0,.244,.99),(.22,.052,.18),p['Dark'],12,6)
        for j in range(7):
            angle=j*math.tau/7;x=.19*math.cos(angle);z=.99+.15*math.sin(angle)
            rod('maw bone tooth',(x,.299,z),(x*.64,.309,.99+(z-.99)*.45),.026,p['Bone'],6,end=.003)
        ellipsoid('soul light inside maw',(0,.303,.99),(.072,.025,.084),p['Soul'],9,5)
        for side in (-1,1):
            for j in range(3):ellipsoid('obsidian carapace',(side*(.20+j*.045),-.18,1.19+j*.17),(.18,.13,.10),p['Dark'],6,4)
    transform_parts(set(bpy.context.scene.objects)-before,scale)
    if wave in (10,20):transform_parts(list(bpy.context.scene.objects),1.20)
    if wave in (44,49):transform_parts(list(bpy.context.scene.objects),1.12)


def rider(p, position=(0,0,1.05), scale=.58, sorcerer=False, second=False):
    before=set(bpy.context.scene.objects)
    # Standalone anatomy creator scales only current scene objects. Exclude the
    # already-authored mount by temporarily unlinking it from the active scene.
    existing=list(bpy.context.scene.objects)
    for obj in existing:bpy.context.collection.objects.unlink(obj)
    humanoid(p,'goblin' if sorcerer else 'orc')
    robe(p,black=sorcerer)
    if sorcerer:
        cylinder('Ghorun black tapered robe',(0,0,1.02),.32,.66,p['Dark'],9,top=.18)
        for side in (-1,1):
            arc('inverted horn crown',[(side*.14,0,1.86),(side*.29,-.02,2.18),(side*.18,-.05,2.26),(side*.12,-.04,2.12)],.038,p['Gold'] if p.get('_variant')=='tyrant' else p['Bone'])
        rod('sorcerer soul staff',(.45,.20,.43),(.45,.20,2.45),.027,p['Dark'],8)
        for side in (-1,1):arc('staff captive soul cage',[(.45+side*.03,.20,2.07),(.45+side*.15,.20,2.25),(.45+side*.05,.20,2.46)],.021,p['Iron'])
        ellipsoid('captive soul in Ghorun staff',(.45,.20,2.29),(.08,.063,.12),p['Rune'],10,7)
    else:
        rod('rider lance',(.44,.20,.16),(.44,.20,1.97),.026,p['Wood'],7)
        rod('rider lance tip',(.44,.20,1.97),(.44,.20,2.21),.064,p['Iron'],5,end=0)
    transform_parts(list(bpy.context.scene.objects),scale,position)
    parts=list(bpy.context.scene.objects)
    for obj in existing:bpy.context.collection.objects.link(obj)
    return group('Ghorun_sorcerer' if sorcerer else 'second_drummer' if second else 'mounted_orc_rider',position,[obj for obj in parts if not obj.parent])


def bat(p, wave, variant=''):
    fur=p['Shadow']; membrane=p['Red'] if wave==15 else p['Cloth']
    if wave in (25,28):membrane=p['Dark']
    if wave in (35,42,48) and variant!='wraith':membrane=p['Dark']
    if wave==29:membrane=p['Rune']
    span=1.75 if wave not in (15,25,28,45) else 1.98
    if wave==30:span=2.83
    ellipsoid('bat flight chest',(0,0,1.12),(.25,.34,.26),fur,14,8)
    ellipsoid('bat furry head',(0,.35,1.23),(.20,.20,.21),fur,12,7)
    ellipsoid('bat piglike nose',(0,.52,1.19),(.09,.07,.08),p['Red'],10,5)
    for side in (-1,1):
        custom('bat enormous pointed ear',[(side*.10,.28,1.36),(side*.29,.21,1.90),(side*.34,.28,1.45),(side*.20,.37,1.35)],[(0,1,2),(0,2,3),(0,3,1),(1,3,2)],fur)
        custom('bat pale inner ear',[(side*.15,.294,1.41),(side*.275,.235,1.77),(side*.275,.295,1.44)],[(0,1,2)],p['Red'])
        ellipsoid('bat glowing eye',(side*.11,.51,1.31),(.035,.022,.027),p['Eye'],8,4)
        rod('bat hunting fang',(side*.063,.51,1.08),(side*.077,.55,.94),.025,p['Bone'],6,end=.001)
        before=set(meshes());anchor=(side*.18,-.05,1.23)
        verts=[anchor,(side*span*.48,.17,1.55),(side*span,.18,1.49),(side*span*.83,-.14,1.15),(side*span*.91,-.46,.92),(side*span*.56,-.36,1.01),(side*span*.46,-.70,.71),(side*span*.24,-.48,.94),(side*.19,-.27,.92)]
        custom('bat scalloped leather wing',verts,[(0,1,7),(1,2,3),(1,3,5),(3,4,5),(1,5,7),(5,6,7),(0,7,8)],membrane)
        for index in (2,4,6,7):rod('bat visible wing finger',anchor,verts[index],.032,fur,7,end=.011)
        rod('bat wing leading bone',verts[1],verts[2],.034,fur,7,end=.013)
        if wave in (15,30,42):
            for index in (2,4,6):rod('glowing wing vein',anchor,verts[index],.012,p['Rune'] if wave!=15 else p['Red'],5,end=.006)
        group('wing_'+('L' if side<0 else 'R'),anchor,set(meshes())-before)
        before=set(meshes());hip=(side*.13,-.23,1.04)
        rod('bat hind leg',hip,(side*.21,-.42,.79),.045,fur,8,end=.025)
        for j in range(3):rod('bat hooked foot claw',(side*.21+(j-1)*.035,-.42,.80),(side*.21+(j-1)*.045,-.37,.72),.017,p['Bone'],6,end=.001)
        group('leg_bat_'+str(side),hip,set(meshes())-before)
    arc('bat thin tail',[(0,-.24,1.10),(.06,-.53,.92),(.11,-.74,.84)],.023,fur)
    if wave==5:
        rider(p,(0,.07,-.20),.54)
        for side in (-1,1):rod('suspended scout leather harness',(side*.22,-.05,1.26),(side*.20,.09,.53),.018,p['Leather'],6)
    elif wave==45:
        rider(p,(0,.17,.85),.45);rider(p,(0,-.35,.84),.43,second=True)
        cylinder('troll hide war drum',(0,-.68,1.39),.23,.26,p['Wood'],12)
        cylinder('drum pale skin',(0,-.68,1.529),.225,.018,p['Bone'],12)
        for side in (-1,1):rod('drummer bone beater',(side*.17,-.43,1.57),(side*.18,-.66,1.72),.021,p['Bone'],6)
    else:rider(p,(0,-.045,.92),.61 if wave==30 else .48)
    if wave in (25,28):
        ellipsoid('bat riveted chest plate',(0,.13,1.26),(.24,.27,.18),p['Iron'],10,5)
        cube('bat iron facial mask',(0,.475,1.29),(.31,.09,.20),p['Iron'],.024)
        for side in (-1,1):
            for j in range(3):cube('bat reactive wing plate',(side*(.34+j*.29),-.04,1.35-j*.05),(.32,.20,.05),p['Iron'],.01)
        cube('rider crossbow stock',(-.26,.26,1.58),(.05,.34,.04),p['Wood'],.008)
        arc('rider crossbow bow',[(-.49,.31,1.59),(-.26,.26,1.62),(-.03,.31,1.59)],.015,p['Iron'])
    if wave in (27,34):
        skull('bat skeletal facial mask',(0,.54,1.26),.18,p)
        for side in (-1,1):
            for j in range(4):rod('bat visible skeletal rib',(side*.15,.16-j*.115,1.30),(side*.24,.15-j*.115,1.00),.018,p['Bone'],6)
    if wave in (29,35):seals(p,z=1.65)
    if wave in (34,48):
        satchel(p,x=.31,z=1.36,gold=True);satchel(p,x=-.31,z=1.31,gold=True)
        bell(p,(.27,-.26,1.37),.28)
        custom('long rider scarf',[(-.12,-.15,1.73),(.12,-.15,1.73),(.29,-.77,1.55),(.03,-.96,1.45)],[(0,1,2,3)],p['Cloth'])
    if wave in (35,42):rune(p,(0,.545,1.25))
    if wave==30:
        for side in (-1,1):arc('storm bat copper horn',[(side*.17,.31,1.46),(side*.30,.20,1.86),(side*.43,.28,1.95)],.044,p['Copper'])
        arc('storm battle scar',[(.12,.55,1.28),(.04,.56,1.17),(.13,.55,1.09)],.014,p['Soul'])


def wolf_design(p,wave):
    # Four-legged wolves, as opposed to two-legged airborne wyverns and bats.
    fur=p['Shadow']; factor=1.27 if wave==47 else 1.08 if wave==37 else 1
    ellipsoid('wolf lean trunk',(0,-.07,.65),(.24,.51,.28),fur,14,8)
    ellipsoid('wolf powerful shoulders',(0,.24,.79),(.27,.30,.31),fur,12,7)
    ellipsoid('wolf head',(0,.52,.87),(.20,.23,.22),fur,12,7)
    ellipsoid('wolf long muzzle',(0,.71,.78),(.13,.23,.095),fur,12,6)
    ellipsoid('wolf black nose',(0,.88,.80),(.12,.056,.07),p['Dark'],10,5)
    for side in (-1,1):
        rod('wolf pointed ear',(side*.135,.45,1.0),(side*.20,.40,1.24),.08,fur,7,end=.001)
        ellipsoid('wolf red eye',(side*.16,.64,.94),(.033,.025,.027),p['Rune'] if wave==37 else p['Red'],8,4)
        for y in (-.34,.28):
            before=set(meshes());hip=(side*.18,y,.68);knee=(side*.22,y-.11,.37);toe=(side*.21,y+.12,.09)
            rod('wolf thigh',hip,knee,.105,fur,9,end=.061);rod('wolf shin',knee,toe,.061,fur,8,end=.043)
            ellipsoid('wolf broad paw',toe,(.10,.16,.074),fur,10,5)
            for j in range(3):rod('wolf claws',(side*.21+(j-1)*.043,y+.20,.08),(side*.21+(j-1)*.043,y+.29,.037),.015,p['Bone'],6,end=.001)
            joint=group('leg_mount_'+str(side)+'_'+str(y),hip,set(meshes())-before)
            joint['gaitPhase']=0 if side*y>0 else math.pi
            joint['gaitPosition']=('left' if side<0 else 'right')+('_rear' if y<0 else '_front')
        for y in (.64,.74):rod('wolf fang',(side*.12,y,.74),(side*.14,y,.62),.023,p['Bone'],6,end=.001)
        rod('wolf leather reins',(side*.14,.73,.81),(side*.18,.15,1.31),.012,p['Leather'],5)
    arc('wolf sweeping tail',[(0,-.49,.72),(.12,-.71,.76),(.25,-.88,.61),(.31,-1.00,.40)],.073,fur)
    cube('wolf riding saddle',(0,-.01,.90),(.41,.36,.08),p['Leather'],.027)
    rider(p,(0,-.035,.71),.50)
    if wave==37:
        for side in (-1,1):arc('rift cracks in fur',[(side*.20,.27,.89),(side*.235,.09,.74),(side*.21,-.12,.81),(side*.20,-.27,.65)],.014,p['Rune'])
    if wave==47:
        skull('last howl bone mask',(0,.66,.97),.20,p);rune(p,(0,.884,.89),.065)
        for side in (-1,1):rod('wolf mask tusk',(side*.12,.77,.91),(side*.18,.85,.72),.034,p['Bone'],7,end=.001)
    transform_parts(list(bpy.context.scene.objects),factor)


def manta(p):
    ellipsoid('thunder manta broad armored body',(0,0,1.09),(.54,.64,.16),p['Dark'],16,8)
    for j in range(4):cube('manta interlocking carapace',(0,.22-j*.21,1.25),(.70-j*.055,.26,.08),p['Iron'],.055)
    for side in (-1,1):
        before=set(meshes());anchor=(side*.24,.06,1.15)
        verts=[anchor,(side*1.38,.44,1.26),(side*1.94,.10,1.09),(side*1.72,-.48,.92),(side*.72,-.74,1.02),(side*.26,-.40,1.11)]
        custom('manta wide ray wing',verts,[(0,1,5),(1,2,3),(1,3,4,5)],p['Cloth'])
        for index in (2,3,4):rod('manta wing cartilage',anchor,verts[index],.027,p['Bone'],7,end=.007)
        group('wing_'+('L' if side<0 else 'R'),anchor,set(meshes())-before)
    skull('manta bony head',(0,.64,1.12),.24,p)
    arc('manta whip tail',[(0,-.56,1.06),(.07,-1.06,1.03),(.19,-1.59,1.17)],.047,p['Dark'])
    rider(p,(0,0,.99),.49)
    cube('rider terrifying red mask',(0,.135,1.805),(.135,.028,.17),p['Red'],.015)


def wyvern(p,wave,variant):
    """Two hind legs, a serpentine neck and true wide flight wings."""
    isqueen=wave==50; span=5.30 if isqueen else 3.53
    body=p['Skin'] if variant=='devourer' else p['Dark'];bone=p['Bone']
    # Queen is 1.5x Vorlak in every principal body dimension, not importer scale.
    factor=1.5 if isqueen else 1.0
    if wave==40:
        ellipsoid('wyvern hollow hind body',(0,-.53,1.28),(.42,.37,.28),body,14,8)
        for side in (-1,1):ellipsoid('wyvern hollow chest side',(side*.39,.30,1.45),(.13,.46,.21),body,12,7)
    else:
        ellipsoid('wyvern muscled body',(0,-.10,1.28),(.48,.84,.36),body,16,9)
        ellipsoid('wyvern shoulder chest',(0,.45,1.48),(.49,.48,.37),body,14,8)
    neck=[(0,.56,1.49),(0,.90,1.59),(.11,1.15,1.92),(.06,1.44,2.12),(0,1.76,2.10)]
    for j,(a,b) in enumerate(zip(neck,neck[1:])):rod('wyvern long serpentine neck',a,b,.235-j*.032,body,12,end=.204-j*.032)
    ellipsoid('wyvern predatory skull',(0,1.92,2.13),(.24,.34,.18),body,14,8)
    ellipsoid('wyvern long hooked snout',(0,2.16,2.07),(.19,.31,.12),body,12,7)
    ellipsoid('wyvern lower bony jaw',(0,2.17,1.94),(.17,.29,.058),bone,12,6)
    for side in (-1,1):
        ellipsoid('wyvern deep black eye socket',(side*.19,1.99,2.22),(.078,.075,.049),p['Dark'],10,5)
        ellipsoid('wyvern burning eye',(side*.211,2.02,2.225),(.039,.035,.027),p['Rune'],8,5)
        for j in range(4):rod('wyvern visible jaw fang',(side*.15,2.02+j*.11,1.985),(side*.155,2.02+j*.11,1.86),.022,bone,7,end=.001)
        arc('ancient wyvern swept horn',[(side*.15,1.76,2.24),(side*.30,1.40,2.37),(side*.39,1.22,2.60)],.065,bone)
        before=set(meshes());hip=(side*.29,-.46,1.18)
        rod('wyvern muscular hind thigh',hip,(side*.44,-.69,.88),.16,body,10,end=.12)
        rod('wyvern hind shank',(side*.44,-.69,.88),(side*.34,-.42,.56),.105,body,9,end=.075)
        ellipsoid('wyvern clawed hind paw',(side*.34,-.31,.52),(.13,.19,.07),body,10,6)
        for j in range(3):arc('wyvern hooked foot talon',[(side*.34+(j-1)*.065,-.22,.54),(side*.34+(j-1)*.077,-.07,.47),(side*.34+(j-1)*.077,-.035,.39)],.027,bone)
        group('leg_wyvern_'+str(side),hip,set(meshes())-before)
        before=set(meshes());anchor=(side*.38,.22,1.61)
        # wing local span is scaled with the torso below. Final wingspans 7.06/10.59.
        localspan=span/factor
        verts=[anchor,(side*localspan*.45,.55,2.03),(side*localspan,.29,1.93),(side*localspan*.86,-.21,1.50),(side*localspan*.91,-.86,1.29),(side*localspan*.60,-.67,1.46),(side*localspan*.56,-1.28,1.07),(side*localspan*.27,-.82,1.27),(side*.25,-.38,1.27)]
        custom('ancient wyvern broad scalloped flight wing',verts,[(0,1,7),(1,2,3),(1,3,5),(3,4,5),(1,5,7),(5,6,7),(0,7,8)],p['Shadow'] if variant=='devourer' else p['Dark'] if isqueen else p['Cloth'])
        for index in (2,4,6,7):rod('wyvern wing long bone',anchor,verts[index],.058,bone if wave==40 or variant=='devourer' else body,9,end=.014)
        rod('wyvern wing strong leading edge',verts[1],verts[2],.072,body,9,end=.018)
        if isqueen:
            for index in (2,4,6):
                raised=[Vector(point)+Vector((0,0,.082)) for point in (anchor,Vector(anchor).lerp(Vector(verts[index]),.57),verts[index])]
                arc('queen glowing membrane vein',raised,.015,p['Rune'])
        group('wing_'+('L' if side<0 else 'R'),anchor,set(meshes())-before)
    tail=[(0,-.76,1.30),(.18,-1.17,1.15),(.42,-1.63,1.11),(.61,-2.14,1.38),(.54,-2.56,1.70),(.29,-2.70,1.81)]
    for j,(a,b) in enumerate(zip(tail,tail[1:])):rod('wyvern long sinuous tail',a,b,.145-j*.022,body,10,end=.121-j*.022)
    arc('tail terminal bone hook',[(.29,-2.70,1.81),(.06,-2.60,1.99),(.02,-2.42,1.96)],.049,bone)
    for j in range(7):
        y=.51-j*.22
        custom('obsidian back armor plate',[(-.19,y,1.50),(.19,y,1.50),(0,y-.09,2.00+(j%2)*.08),(0,y+.12,1.60)],[(0,1,2),(0,2,3),(1,3,2),(0,3,1)],p['Bone'] if variant=='devourer' else p['Dark'])
        if isqueen:arc('armor glowing fissure',[(-.16,y+.025,1.59),(0,y-.045,1.94+(j%2)*.08),(.14,y+.02,1.62)],.014,p['Rune'])
    if wave==40:
        # Hollow Vorlak carries his necromancer literally inside the open ribs.
        for side in (-1,1):
            for j in range(6):arc('wyvern open rib cage',[(side*.20,.45-j*.20,1.62),(side*.52,.42-j*.20,1.34),(side*.39,.43-j*.20,.99),(side*.09,.41-j*.20,.96)],.041,bone)
        soul=ellipsoid('necromancer glowing heart',(0,.33,1.27),(.13,.15,.24),p['Soul'],12,7)
        rider(p,(0,.13,.28),.47,sorcerer=True)
        group('necromancer_hollow_heart',parts=[soul])
    else:
        cube('Ghorun throne saddle',(0,-.06,1.80),(.56,.59,.16),p['Iron'],.045)
        cube('Ghorun tall throne back',(0,-.32,2.17),(.64,.15,.84),p['Dark'],.035)
        for side in (-1,1):
            rod('throne gilded spire',(side*.30,-.35,1.91),(side*.31,-.35,2.77),.035,p['Gold'],8,end=.009)
            chain(p,[(side*.17,.16,2.22),(side*.30,.69,1.88),(side*.22,1.30,2.00)],.041)
        rider(p,(0,-.035,1.44),.75,sorcerer=True)
        if variant=='tyrant':
            for y,z,r in [(.72,1.60,.25),(1.08,1.85,.215),(1.40,2.06,.18)]:
                hoop=torus('golden runic neck shackle',(0,y,z),r,.027,p['Gold']);hoop.rotation_euler[0]=math.pi/2
            for side in (-1,1):
                for j in range(3):
                    band=torus('golden wing rune ring',(side*(.74+j*.51),-.015,1.73),.13,.023,p['Gold']);band.rotation_euler[1]=math.pi/2
        if variant=='devourer':
            for side in (-1,1):
                for j in range(4):ellipsoid('massive pale bony carapace',(side*.29,-.18-j*.18,1.61),(.29,.16,.12),p['Bone'],7,5)
            for side in (-1,1):arc('black veins in pale queen',[(side*.21,1.14,1.97),(side*.15,1.43,2.16),(side*.23,1.77,2.15)],.015,p['Dark'])
    transform_parts(list(bpy.context.scene.objects),factor)


def bounds():
    bpy.context.view_layer.update()
    points=[obj.matrix_world @ vertex.co for obj in meshes() for vertex in obj.data.vertices]
    low=[min(point[index] for point in points) for index in range(3)]
    high=[max(point[index] for point in points) for index in range(3)]
    return dict(min=[round(x,5) for x in low],max=[round(x,5) for x in high],size=[round(high[i]-low[i],5) for i in range(3)])


def build(design,variant=''):
    wave=design['wave'];p=palette(wave,variant);p['_variant']=variant
    if wave==50:wyvern(p,wave,variant or 'dragon')
    elif wave==40:wyvern(p,wave,variant)
    elif wave==39:manta(p)
    elif wave in (5,15,25,27,28,29,30,34,35,42,45,48):bat(p,wave,variant)
    elif wave in (19,37,47):wolf_design(p,wave)
    else:ground_design(p,wave,design['archetype'],variant)
    group('design_'+design['archetype'].replace('-','_'))
    # Anatomy union is scoped per material and existing pivot. Retain all named
    # equipment and semantic cue empties; the native sources stay editable.
    parts=[obj for obj in meshes() if obj.name.startswith('anatomy') and not obj.parent]
    bymaterial={material:[obj for obj in parts if obj.data.materials[0]==material] for material in {obj.data.materials[0] for obj in parts}}
    for material,objects in bymaterial.items():A.cohesive.fuse(objects,'Unified '+material.name+' anatomy',.018,2400,material)
    A.cohesive.soften_surfaces(meshes());A.cohesive.budget_meshes(25000 if wave in (40,50) else 19000)
    size=bounds();zmin=size['min'][2]
    # Ground actors start exactly on their feet; flight models retain their
    # authored height above an origin at zero, used by runtime wing-root auras.
    if wave not in (5,15,25,27,28,29,30,34,35,39,40,42,45,48,50):
        transform_parts(list(bpy.context.scene.objects),1,(0,0,-zmin))
    return bounds()


def camera_for(points,resolution=(280,320)):
    cam=A.configure_scene()
    centre=Vector(tuple((points['min'][i]+points['max'][i])/2 for i in range(3)))
    cam.location=centre+Vector((-3.6,6.4,6.2 if points['size'][0]>3 else 3.4));cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    projected=[cam.matrix_world.inverted()@(obj.matrix_world@Vector(v)) for obj in meshes() for v in obj.bound_box]
    width=max(p.x for p in projected)-min(p.x for p in projected);height=max(p.y for p in projected)-min(p.y for p in projected)
    aspect=resolution[0]/resolution[1]
    cam.data.ortho_scale=max(width,height*aspect)*1.13 if aspect>=1 else max(height,width/aspect)*1.13
    scene=bpy.context.scene;scene.render.resolution_x=resolution[0];scene.render.resolution_y=resolution[1];scene.render.resolution_percentage=100
    scene.cycles.samples=12
    if points['size'][0]>6:
        for light in [obj for obj in scene.objects if obj.type=='LIGHT']:
            light.location*=2;light.data.energy*=4;light.data.size*=2
    return cam


def export(identifier):
    # Material batches preserve articulation and protection shards. Additional
    # semantic mesh children remain identifiable by their names in the native
    # source; semantic marker nodes in GLB describe the authored design.
    semantic_names=[obj.name for obj in meshes() if any(token in obj.name.lower() for token in ('bell','cage','rib','gate','ram','braid','mask','rune','reactive','throne','soul','hook','maw','carapace','obsidian','crossbow','scarf'))]
    for token in sorted(set(name.split('.')[0].replace(' ','_') for name in semantic_names)):
        marker=group('part_'+token);marker['authoredMeshCue']=True
    groups={}
    combat=json.loads((ROOT/'data/enemies.json').read_text(encoding='utf-8'))[identifier.split('-')[0]]
    matching=next((item for item in combat.get('variants',[]) if item.get('visualAsset')==identifier),None)
    if matching:combat={**combat,**matching}
    elif identifier in ('host_31','host_35','host_36'):combat={**combat,**combat['variants'][0]}
    cues=[('regen',('wound','regenerat','soul prisoner','soul inside','moss','fresh regenerating','maw','blood sack')),
          ('recharge',('armor glowing','glowing membrane')),
          ('blink',('rift','floating')),
          ('magicImmune',('immunity','embedded spell','ash thief','golden run','queen glowing','black veins')),
          ('physicalImmune',('ghost fire','ghost','smoky')),
          ('reactiveArmor',('reactive','living iron','riveted')),
          ('evasion',('dust dancer','long rider scarf')),
          ('disarm',('temple bell','bell lip','bell clapper','bell black','mallet skull','stitched mouth','executioner axe')),
          ('rush',('wolf red eye','bat glowing eye','glowing wing vein')),
          ('warDrums',('drum','beater')),
          ('refraction',('protective shard','mirror','crystal shield'))]
    for obj in meshes():
        keep=obj if obj.parent and obj.parent.name=='refraction_shards' else None
        cue=next((name for name,tokens in cues if any(token in obj.name.lower() for token in tokens)),None)
        if not cue and bpy.context.scene.get('Native ghost') and obj.data.materials[0].name.split('.')[0] in ('Skin','Shadow','Cloth'):cue='physicalImmune'
        if cue=='regen' and combat.get('recharge'):cue='recharge'
        if cue=='rush' and combat.get('regen'):cue='regen'
        ability={'warDrums':'hasteAura'}.get(cue,cue)
        if cue and not combat.get(ability):cue=None
        groups.setdefault((obj.parent,obj.data.materials[0],keep,cue),[]).append(obj)
    for (parent,material,_,cue),parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name='mesh_'+material.name+('_'+cue if cue else '')
        if cue:parts[0]['visualCue']=cue
    for obj in list(bpy.context.scene.objects):
        if obj.type in ('LIGHT','CAMERA'):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.object.select_all(action='SELECT')
    root=group('DarkHost_'+identifier,parts=[obj for obj in bpy.context.scene.objects if not obj.parent])
    design=next(item for item in DESIGNS['designs'] if item['id']==identifier.split('-')[0])
    root['designArchetype']=bpy.context.scene.get('Design archetype',design['archetype']);root['designName']=bpy.context.scene['Warband'];root['assetRevision']='dark-host-v3'
    bpy.ops.object.select_all(action='SELECT')
    triangles=sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in meshes())
    if triangles>30000:raise ValueError(f'{identifier}: {triangles} exceeds approved budget')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(identifier+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    return triangles,sorted(set(name.split('.')[0] for name in semantic_names))


def roster():
    entries=[(design['id'],design,'') for design in DESIGNS['designs']]
    for identifier, variants in DESIGNS['variants'].items():
        design=next(item for item in DESIGNS['designs'] if item['id']==identifier)
        for variant in variants:
            if variant['model'] in ('dragon','assassin'):continue
            entries.append((identifier+'-'+variant['model'],{**design,**{key:value for key,value in variant.items() if key!='model'}},variant['model']))
    return entries


def generate():
    only=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
    entries=json.loads((OUT/'manifest.json').read_text(encoding='utf-8')) if (OUT/'manifest.json').exists() else []
    selected=[item for item in roster() if not only or item[0] in only.split(',')]
    # The final boss owns a native deform rig; the static historical generator
    # must not overwrite it when reauthoring the otherwise unchanged Dark Host.
    native_final=[item[0] for item in selected if item[0].split('-')[0]=='host_50']
    if native_final:
        import final_boss_v4
        old_argv=list(sys.argv)
        try:
            sys.argv=[old_argv[0],'--only',','.join(native_final)]+(['--no-render'] if '--no-render' in old_argv else [])
            final_boss_v4.run()
        finally:
            sys.argv=old_argv
        rows=json.loads((ROOT/'artifacts/final-boss-v4-rows.json').read_text(encoding='utf-8'))
        entries=[item for item in entries if item['id'] not in native_final]+rows
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    selected=[item for item in selected if item[0] not in native_final]
    for identifier,design,variant in selected:
        clear();dimensions=build(design,variant);camera_for(dimensions)
        scene=bpy.context.scene;scene['Warband']=design['name'];scene['Design revision']='dark-host-v3';scene['Design archetype']=design['archetype'];scene['Approved appearance']=design['appearance']
        scene['Native ghost']=design['wave'] in (23,27,33,46) or variant=='wraith' and design['wave']!=38
        scene['Native dimension policy']='Intentionally different species and boss sizes. Import scale is 1.'
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/(identifier+'.blend')))
        if '--no-render' not in sys.argv:
            scene.render.filepath=str(OUT/(identifier+'.png'));bpy.ops.render.render(write_still=True)
        if '--no-render' not in sys.argv and ('--review' in sys.argv or identifier in ('host_01','host_03','host_05','host_10','host_12','host_13','host_17','host_20','host_32','host_38-wraith','host_40','host_43','host_49','host_50','host_50-tyrant','host_50-devourer')):
            camera=bpy.context.scene.camera;scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.cycles.samples=24
            camera.data.ortho_scale*=max(1,280/320/(1000/1100))
            scene.render.filepath=str(REVIEWS/(identifier+'.png'));bpy.ops.render.render(write_still=True)
        triangles,parts=export(identifier)
        entries=[item for item in entries if item['id']!=identifier]
        entries.append(dict(id=identifier,file=identifier+'.glb',portrait=identifier+'.png',style='dark-host-v3',revision='dark-host-v3',triangles=triangles,authoring='Blender 5.2',name=design['name'],archetype=design['archetype'],source='blender/scenes/enemies-v3/'+identifier+'.blend',bounds=dimensions,height=dimensions['size'][2],wingspan=dimensions['size'][0],nativeScale=1,semanticParts=parts,auraStage=design['auraStage']))
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print('DARK_HOST '+identifier+' '+str(triangles)+' triangles '+str(dimensions['size']),flush=True)
    if not only:
        active={identifier for identifier,_,_ in roster()}
        entries=[item for item in entries if item['id'] in active]
        entries.sort(key=lambda item:item['id'])
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


def review_scene():
    """Native, inspectable source galleries, rendered by the same Blender."""
    galleries=[('dark-host-v3-ground-lineup',
                ['host_01','host_02','host_03','host_06','host_13','host_12','host_17','host_32','host_38-wraith','host_43'],5,4.1,4.8,(1800,1100)),
               ('dark-host-v3-ghorun-variants',
                ['host_50','host_50-tyrant','host_50-devourer'],3,12.3,0,(2100,950)),
               ('dark-host-v3-mount-lineup',
                ['host_05','host_15','host_25','host_27','host_30','host_19','host_37','host_47','host_39','host_45'],5,6.1,5.4,(2000,1150))]
    for gallery,identifiers,columns,spacing,row_spacing,resolution in galleries:
        clear()
        for index,identifier in enumerate(identifiers):
            before=set(bpy.context.scene.objects)
            with bpy.data.libraries.load(str(SOURCES/(identifier+'.blend')),link=False) as (data_from,data_to):
                data_to.objects=[name for name in data_from.objects if name not in ('Review camera','Key','Cool fill','Rim')]
            for obj in data_to.objects:
                if obj and obj.type in ('MESH','EMPTY'):bpy.context.collection.objects.link(obj)
            imported=set(bpy.context.scene.objects)-before
            x=(index%columns-(columns-1)/2)*spacing;y=-(index//columns)*row_spacing
            transform_parts(imported,1,(x,y,0))
            group('Gallery_'+identifier,(x,y,0),[obj for obj in imported if not obj.parent])
        points=bounds();cam=camera_for(points,resolution)
        center=Vector(tuple((points['min'][i]+points['max'][i])/2 for i in range(3)))
        cam.location=center+Vector((-.8,22,16));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.view_layer.update()
        projection=[cam.matrix_world.inverted()@(obj.matrix_world@Vector(v)) for obj in meshes() for v in obj.bound_box]
        width=max(p.x for p in projection)-min(p.x for p in projection);height=max(p.y for p in projection)-min(p.y for p in projection)
        aspect=resolution[0]/resolution[1]
        cam.data.ortho_scale=max(width,height*aspect)*1.15 if aspect>=1 else max(height,width/aspect)*1.15
        floor=mat('Review dark green floor','263d37')
        cube('Source review ground',(center.x,center.y,-.18),(points['size'][0]*1.5,points['size'][1]*2.0,.1),floor,0)
        scene=bpy.context.scene;scene.render.film_transparent=False;scene.world.color=(.05,.065,.075);scene.cycles.samples=32
        scene['Authoring']='Original Blender 5.2 Dark Host v3. All native objects are editable.'
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/(gallery+'.blend')))
        scene.render.filepath=str(REVIEWS/(gallery+'.png'));bpy.ops.render.render(write_still=True)
        print('DARK_HOST_REVIEW '+gallery,flush=True)


if __name__=='__main__':
    if '--lineup' in sys.argv:review_scene()
    else:generate()
