"""Three bulky source constructs; a single articulated sculpture for six views.

Source front silhouettes set the short legs, large palms and protruding heads.
The generated references have no dimensional ruler: 1.8 m is a nominal scale.
All components are closed solids, including open-mouthed cannon/exhaust tubes.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix
from geometric_game_common import linear

def material(b, key, color, metallic=0):
    rgba = tuple(linear(int(color[i:i+2], 16)/255) for i in (0, 2, 4))+(1,)
    mt = bpy.data.materials.new(key); mt.use_nodes = True; mt.diffuse_color = rgba
    sh = mt.node_tree.nodes.get('Principled BSDF')
    sh.inputs['Base Color'].default_value = rgba
    sh.inputs['Roughness'].default_value = .72
    sh.inputs['Metallic'].default_value = metallic
    mt['source_srgb'] = '#'+color; b.M[key] = mt

def rock(b, name, pos, radii, mats, parent, moss=False):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    verts = [(pos[0]+v.co.x*radii[0], pos[1]+v.co.y*radii[1], pos[2]+v.co.z*radii[2]) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    ob = b.mesh(name, verts, faces, mats, parent)
    # Clustered material patches form moss on the stone itself, rather than
    # unsupported green leaf ribbons or an image plane pasted on the body.
    for i, p in enumerate(ob.data.polygons):
        c = p.center; phase = math.sin(c.x*23+c.z*14)+math.cos(c.y*18-c.z*8)
        p.material_index = 2 if moss and phase > 1.12 else (1 if i % 7 == 0 else 0)
    return ob

def hollow_tube(b, name, a, c, ro, ri, mat, parent, n=8):
    a, c = Vector(a), Vector(c); axis = (c-a).normalized()
    u = axis.cross(Vector((1, 0, 0))).normalized(); v = axis.cross(u)
    verts = []
    # The inner cavity stops before the closed back cap.
    for center, r in [(a, ro), (c, ro), (c, ri), (a+axis*.024, ri)]:
        verts.extend(tuple(center+r*(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))) for i in range(n))
    faces = []
    for i in range(n):
        j = (i+1)%n
        faces.extend([(i,j,n+j,n+i),(n+i,n+j,2*n+j,2*n+i),(2*n+i,2*n+j,3*n+j,3*n+i)])
    faces.extend([tuple(reversed(range(n))), tuple(range(3*n,4*n))])
    return b.mesh(name, verts, faces, mat, parent)

def arms(b, side, shoulder, elbow, palm, torso):
    sn = 'R' if side > 0 else 'L'
    up = b.pivot('upper_arm_'+sn, shoulder, torso)
    fore = b.pivot('forearm_'+sn, elbow, up)
    hand = b.pivot('hand_'+sn, palm, fore)
    weapon = b.pivot('weapon_'+sn, palm, hand)
    return up, fore, hand, weapon

def crystal(b, name, pos, rx, rz, depth, parent, angle=0):
    ob = b.jewel(name, pos, rx, rz, depth, 'source_crystal', parent)
    if angle:
        pivot = b.pivot(name+' source outward tilt', pos, parent)
        b.attach(ob, pivot); pivot.rotation_euler.y = angle
    return ob

def stone_or_ice(b, row, ell):
    ice = b.id == 'winterhold'
    for key, color in [('source_rock', 'aac6ef' if ice else 'b8aa94'),
                       ('source_facet', 'c1d9f5' if ice else 'c9baa5'),
                       ('source_moss', '829446'),
                       ('source_crystal', '7cc6fa' if ice else '568831')]:
        material(b, key, color)
    mats = ['source_rock','source_facet'] if ice else ['source_rock','source_facet','source_moss']
    torso = b.pivot('torso_pivot', (0,0,.70))
    headz = 1.02 if ice else 1.10
    head = b.pivot('head_pivot', (0,.12,headz), torso)
    rock(b, 'Construct broad continuous faceted chest', (0,0,.73), (.39,.30,.31), mats, torso, not ice)
    rock(b, 'Construct continuous rear crystal bearing shoulder mantle', (0,-.12,1.065 if ice else 1.13), (.31,.22,.19), mats, torso, not ice)
    rock(b, 'Construct broad short pelvis', (0,0,.425), (.26,.24,.135), mats, torso, not ice)
    b.box('Construct protruding chamfered block head', (0,.18,headz), (.54 if ice else .59,.43,.35 if ice else .39), 'source_rock', .049, head)
    # Source eyes sit on the flat face, entirely inside the solid head border.
    for side in (-1,1):
        b.box('Eye '+('R' if side>0 else 'L'), (side*.115,.401,headz+.005), (.073,.014,.090), 'eyes', .002, head)
        sn = 'R' if side>0 else 'L'
        hip=(side*.235,0,.43); knee=(side*.28,.025,.235); ankle=(side*.30,.045,.095)
        thigh=b.pivot('upper_leg_'+sn, hip); shin=b.pivot('shin_'+sn,knee,thigh); foot=b.pivot('foot_'+sn,ankle,shin)
        rock(b,'Construct short chunky thigh', (side*.25,0,.355),(.155,.185,.18),mats,thigh,not ice)
        rock(b,'Construct thick short shin', (side*.29,.02,.195),(.18,.19,.175),mats,shin,not ice)
        b.box('Construct grounded shoe', (side*.30,.08,.085), (.405,.44,.17), 'source_rock', .032,foot)
        shoulder=(side*.405,0,.915 if ice else .975)
        elbow=(side*.50,.035,.70); palm=(side*(.565 if ice else .585),.10,.425 if ice else .47)
        up,fore,hand,weapon=arms(b,side,shoulder,elbow,palm,torso)
        rock(b,'Construct boulder shoulder',shoulder,(.215,.23,.225),mats,up,not ice)
        rock(b,'Construct short upper arm',(side*.465,.025,.785),(.145,.17,.18),mats,up,not ice)
        rock(b,'Construct thick forearm',(side*.535,.055,.61),(.18,.20,.20),mats,fore,not ice)
        # The reference Golem has a substantially larger anatomical right fist.
        rad = (.31,.29,.335) if ice else (.365,.31,.375) if side>0 else (.235,.235,.275)
        rock(b,'Construct massive source '+sn+' fist',palm,rad,mats,hand,not ice)
        if side>0:b.pivot('attack_muzzle',(palm[0],palm[1]+rad[1],palm[2]),weapon)
    if ice:
        crystal(b,'Central tallest ice crystal',(0,-.12,1.48),.185,.32,.145,torso)
        for side in (-1,1):
            crystal(b,'Tall paired tilted ice crystal',(side*.325,-.10,1.32),.14,.285,.13,torso,side*.28)
            crystal(b,'Small outer shoulder ice crystal',(side*.595,-.055,1.025),.105,.16,.10,torso,side*.43)
    else:
        crystal(b,'Central tallest green stone crystal',(0,-.16,1.545),.185,.25,.145,torso)
        for side in (-1,1):
            crystal(b,'Paired green stone shoulder crystal',(side*.32,-.12,1.35),.13,.185,.11,torso,side*.27)
            crystal(b,'Small outer moss stone projection',(side*.505,-.07,1.15),.09,.11,.085,torso,side*.38)
    b.root['attackStyle']='punch'

def mechanical(b, row, ell, annulus, gear):
    material(b,'source_machine','708b91',.30)
    material(b,'source_machine_facet','91a5a7',.30)
    material(b,'source_machine_dark','45555b',.45)
    material(b,'source_machine_gold','d4aa66',.48)
    blue='source_machine'; gold='source_machine_gold'; dark='source_machine_dark'
    torso=b.pivot('torso_pivot',(0,0,.98)); head=b.pivot('head_pivot',(0,.055,1.385),torso)
    b.box('Mechanical continuous broad torso',(0,0,1.00),(.73,.47,.51),blue,.055,torso)
    b.box('Mechanical frontal armored plate',(0,.252,1.00),(.60,.06,.43),blue,.024,torso)
    for side in (-1,1):
        b.box('Mechanical tall golden chest binding',(side*.323,.18,1.00),(.115,.18,.49),gold,.012,torso)
        for zz in (.805,1.19):ell(b,'Chest visible gold rivet',(side*.277,.294,zz),(.019,.016,.019),gold,torso,6,2)
    annulus(b,'Source chest cog continuous hollow hub',(0,.302,1.00),.096,.027,gold,torso,True,16,4)
    for j in range(8):
        a=j*math.tau/8;dx,dz=math.sin(a),math.cos(a)
        b.rod('Source chest cog one of eight actual teeth',(dx*.099,.302,1+dz*.099),(dx*.148,.302,1+dz*.148),.026,gold,torso,4)
    b.box('Mechanical protruding square source head',(0,.055,1.385),(.44,.36,.33),blue,.036,head)
    for side in (-1,1):
        b.box('Eye '+('R' if side>0 else 'L'),(side*.106,.241,1.385),(.067,.014,.083),'eyes',.002,head)
        for xx in (side*.13,):ell(b,'Head small flush gold rivet',(xx,.238,1.49),(.009,.007,.009),gold,head,5,2)
    b.box('Mechanical short central hip',(0,0,.62),(.29,.34,.31),dark,.033,torso)
    b.box('Mechanical gold pelvis shield',(0,.18,.62),(.23,.075,.28),gold,.024,torso)
    ell(b,'Pelvis central metal bolt',(0,.225,.66),(.037,.018,.037),'steel_dark',torso,8,2)
    for side in (-1,1):
        sn='R' if side>0 else 'L'
        hip=(side*.235,0,.60); knee=(side*.29,.03,.375); ankle=(side*.325,.04,.12)
        thigh=b.pivot('upper_leg_'+sn,hip); shin=b.pivot('shin_'+sn,knee,thigh); foot=b.pivot('foot_'+sn,ankle,shin)
        b.limb('Mechanical short armored thigh',[hip,knee],[.155,.15],blue,thigh,6)
        b.limb('Mechanical thick armored shin',[knee,ankle],[.15,.185],blue,shin,6)
        b.box('Construct grounded shoe',(side*.325,.10,.095),(.37,.44,.19),blue,.032,foot)
        b.box('Mechanical boot actual gold toe',(side*.325,.28,.10),(.31,.13,.17),gold,.026,foot)
        for pos,parent in [(knee,shin),(ankle,foot)]:
            b.rod('Leg visible axial gold hinge',(pos[0]-.15,pos[1],pos[2]),(pos[0]+.15,pos[1],pos[2]),.105,gold,parent,8)
            ell(b,'Leg outside dark steel hinge cap',(pos[0]+side*.158,pos[1],pos[2]),(.017,.078,.078),dark,parent,8,2)
        shoulder=(side*.46,0,1.16); elbow=(side*.585,.045,.915); palm=(side*.655,.14,.63 if side>0 else .52)
        up,fore,hand,weapon=arms(b,side,shoulder,elbow,palm,torso)
        rock(b,'Mechanical bulky faceted shoulder',shoulder,(.23,.235,.19),[blue,'source_machine_facet'],up)
        b.box('Mechanical golden shoulder front strap',(side*.44,.196,1.145),(.095,.09,.36),gold,.014,up)
        ell(b,'Golden shoulder strap bolt',(side*.44,.249,1.055),(.032,.018,.032),gold,up,8,2)
        b.limb('Mechanical upper arm dark piston',[shoulder,elbow],[.115,.13],dark,up,8)
        b.rod('Mechanical elbow actual gold hinge',(elbow[0]-.15,elbow[1],elbow[2]),(elbow[0]+.15,elbow[1],elbow[2]),.13,gold,fore,8)
        b.limb('Mechanical bulky armored forearm',[elbow,palm],[.18,.225],blue,fore,8)
        b.limb('Mechanical broad golden wrist band',[(palm[0],palm[1],palm[2]+.07),(palm[0],palm[1],palm[2]+.19)],[.241,.231],gold,fore,8)
        for j in range(3):ell(b,'Wrist band actual visible rivet',(palm[0]+(j-1)*.12,palm[1]+.236,palm[2]+.13),(.018,.013,.018),gold,fore,6,2)
        if side>0:
            b.box('Mechanical twin cannon hand housing',(palm[0],.19,palm[2]),(.405,.33,.31),blue,.036,weapon)
            for j in (-1,1):
                xx=palm[0]+j*.109
                hollow_tube(b,'Mechanical actual hollow cannon barrel',(xx,.16,palm[2]),(xx,.60,palm[2]),.098,.071,dark,weapon)
                hollow_tube(b,'Mechanical octagonal gold muzzle',(xx,.53,palm[2]),(xx,.625,palm[2]),.111,.073,gold,weapon)
            b.pivot('attack_muzzle',(palm[0]-.109,.635,palm[2]),weapon)
        else:
            rock(b,'Mechanical enormous armored left fist',(palm[0],palm[1]+.02,palm[2]),(.245,.255,.29),[blue,'source_machine_facet'],hand)
            for j in range(3):b.box('Mechanical distinct massive front knuckle',(palm[0]+(j-1)*.119,palm[1]+.255,palm[2]+.025),(.109,.075,.215),blue,.014,hand)
    # Two long, outward leaning hollow exhausts mounted behind the shoulders.
    for side in (-1,1):
        a=(side*.255,-.185,1.25); c=(side*.385,-.24,1.745)
        hollow_tube(b,'Mechanical hollow exhaust chimney',a,c,.113,.077,'steel_dark',torso)
        axis=(Vector(c)-Vector(a)).normalized()
        hollow_tube(b,'Mechanical chimney gold mouth rim',tuple(Vector(c)-axis*.035),tuple(Vector(c)+axis*.035),.134,.078,gold,torso)
        hollow_tube(b,'Mechanical chimney gold basal band',tuple(Vector(a)+axis*.02),tuple(Vector(a)+axis*.075),.124,.114,gold,torso)
        b.box('Mechanical rear golden chimney mount',(side*.25,-.257,1.14),(.135,.09,.23),gold,.018,torso)
    b.box('Mechanical back armored spine',(0,-.277,1.01),(.28,.10,.57),blue,.023,torso)
    b.root['attackStyle']='dartCannon'

def build_source_construct(b,row,ell,cone,leaf,annulus,gear):
    if b.id=='mechanicalgolem':mechanical(b,row,ell,annulus,gear)
    else:stone_or_ice(b,row,ell)
