"""Seven original creatures, modeled for the approved 37-champion edition.

Blender +Z is up and +Y is the face. Organic forms are voxel-unioned;
wing membranes, layered feathers and riding equipment remain separate.
"""
import bpy, math
from mathutils import Vector

FAMILIES={'embercrown','worldfire','starfall','thunderheart','phoenix','rangermentor','griffinbomber'}


def palette(a,family):
    return {k:a.mat('V6 '+family+' '+k,c,metal,glow) for k,c,metal,glow in [
        ('hide',{'embercrown':'d66a37','worldfire':'863642','starfall':'365f92','thunderheart':'456f89','phoenix':'453d70','rangermentor':'71563e','griffinbomber':'ab8150'}[family],0,0),
        ('light',{'embercrown':'ffd38c','worldfire':'eb9967','starfall':'b5e4ef','thunderheart':'b1ced8','phoenix':'aa8caf','rangermentor':'c49b63','griffinbomber':'f0e4ba'}[family],0,0),
        ('gold','d6af5b',.65,0),('dark','25333d',.25,0),('ivory','ece0bf',0,0),
        ('cloth','61477c' if family=='phoenix' else '2e6773',0,0),('skin','d7a579',0,0),
        ('glow','99e7ff' if family=='starfall' else 'ffba56',.1,1.5),('leather','54392d',0,0),
        ('steel','b6c5ce',.7,0),('stone','87918a',0,0)]}


def footing(a,p,r=.46):
    a.cylinder('V6 beast basalt plinth',(0,0,.055),r,.11,p['dark'],12)
    a.cylinder('V6 carved stone top',(0,0,.125),r*.96,.065,p['stone'],12,top=r*.89)
    a.torus('V6 plinth bronze inlay',(0,0,.164),r*.79,.009,p['gold'])


def organic(a,name,parts,p,voxel=.026,budget=2400):
    return a.A.cohesive.fuse(parts,name,voxel,budget,p)


def tapered_leaf(a,name,start,end,width,material):
    s,e=Vector(start),Vector(end);d=(e-s).normalized()
    cross=d.cross(Vector((0,1,0))).normalized()*width
    mid=s.lerp(e,.35)
    o=a.custom(name,[s,mid+cross,e,mid-cross,mid+Vector((0,.025,0))],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)],material)
    return o


def feather_wing(a,p,side,z=1.18,span=1.2,raised=.28):
    shoulder=Vector((side*.22,-.11,z));elbow=Vector((side*.65,-.12,z+raised));tip=Vector((side*span,-.12,z+raised-.12))
    a.rod('V6 feathered wing leading edge',shoulder,elbow,.075,p['light'],10,end=.06)
    a.rod('V6 feathered wing wrist',elbow,tip,.06,p['light'],8,end=.027)
    for j in range(9):
        t=j/8;start=elbow.lerp(tip,t)
        end=start+Vector((side*(.04+.16*t),-.12,-(.30+.22*t)))
        tapered_leaf(a,'V6 overlapping primary flight feather',start,end,.09-.025*t,p['light'] if j%3 else p['hide'])
    for j in range(6):
        t=j/5;start=shoulder.lerp(elbow,t)
        tapered_leaf(a,'V6 layered wing covert',start,start+Vector((side*.10,.04,-.26)),.09,p['hide'])


def dragon_wing(a,p,side,z=1.01,span=1.20,raised=.65):
    root=(side*.21,-.04,z);wrist=(side*.62,-.13,z+raised)
    fingers=[(side*span,-.19,z+raised*.68),(side*(span*.89),-.22,z-.22),(side*.58,-.24,z-.32)]
    bone=p['light'];membrane=a.mat('V6 warm translucent-looking dragon sail','b75c47' if p['hide'].name.find('worldfire')>=0 else 'b77c69')
    a.rod('V6 wing muscular upperarm',root,wrist,.072,p['hide'],10,end=.035)
    for target in fingers:a.rod('V6 articulated wing finger',wrist,target,.023,bone,7,end=.008)
    verts=[root,wrist,*fingers,(side*.31,-.1,z-.15)]
    wing=a.custom('V6 scalloped dragon wing sail',verts,[(0,1,2),(0,2,3),(0,3,4),(0,4,5)],membrane)
    mod=wing.modifiers.new('Double sided wing thickness','SOLIDIFY');mod.thickness=.014
    bpy.context.view_layer.objects.active=wing;bpy.ops.object.modifier_apply(modifier=mod.name)
    a.rod('V6 wing thumb claw',wrist,(side*.66,-.1,z+raised+.13),.038,p['ivory'],7,end=.002)


def dragon(a,p,family):
    baby=family=='embercrown';mother=family=='worldfire';mounted=family in ('thunderheart','phoenix')
    footing(a,p,.48)
    parts=[]
    e=lambda n,pos,s:parts.append(a.ellipsoid(n,pos,s,p['hide'],16,8)) or parts[-1]
    r=lambda n,s,t,w,end=None:parts.append(a.rod(n,s,t,w,p['hide'],10,end=end)) or parts[-1]
    e('Dragon sculpt chest',(0,.12,.67),(.30,.37,.38))
    e('Dragon sculpt abdomen',(0,-.19,.55),(.32,.4,.26))
    e('Dragon sculpt rising neck',(0,.38,.97),(.19,.23,.35))
    e('Dragon sculpt skull',(0,.50,1.25),(.23 if baby else .19,.24,.23 if baby else .17))
    e('Dragon sculpt muzzle',(0,.72,1.17),(.19 if baby else .14,.21,.095))
    for side in [-1,1]:
        for y in [-.31,.27]:
            e('Dragon sculpt hip',(side*.24,y,.50),(.16,.19,.20))
            r('Dragon sculpt lower leg',(side*.25,y,.48),(side*.31,y+.11,.22),.095,end=.065)
            e('Dragon sculpt paw',(side*.31,y+.16,.22),(.115,.15,.07))
    tail=[(0,-.45,.52),(.28,-.64,.47),(.46,-.56,.38),(.56,-.33,.30)] if mother else [(0,-.43,.53),(-.16,-.65,.47),(-.34,-.71,.62),(-.43,-.69,.75)]
    for j,(s,t) in enumerate(zip(tail,tail[1:])):r('Dragon sculpt curled tail',s,t,.095-j*.024,end=.07-j*.023)
    organic(a,'V6 unified dragon anatomy',parts,p['hide'],.023,2600)
    for side in [-1,1]:
        eye_z=1.29 if baby else 1.26
        a.ellipsoid('V6 dragon bronze eye socket',(side*.185,.624,eye_z),(.055,.031,.04),p['light'],10,6)
        a.ellipsoid('V6 dragon glowing eye',(side*.19,.647,eye_z),(.025,.012,.025),p['glow'],10,6)
        a.rod('V6 dragon swept horn',(side*.14,.41,1.38),(side*.24,.29,1.64 if mother else 1.51),.055,p['ivory'],8,end=.004)
        for y in [-.31,.27]:
            for dx in [-.06,0,.06]:a.rod('V6 dragon foot talon',(side*.31+dx,y+.23,.23),(side*.31+dx,y+.33,.18),.021,p['ivory'],6,end=.002)
        dragon_wing(a,p,side,1.00,span=.86 if baby else (1.24 if mother else 1.12),raised=.47 if baby else .66)
    for j in range(6):
        y=.15-j*.13;z=.89 if j<3 else .72
        a.cylinder('V6 dragon spinal fin',(0,y,z),.06,.21,p['gold'] if mother else p['light'],5,top=0)
    for j in range(4):
        plate=a.ellipsoid('V6 layered dragon belly scale',(0,.35+j*.09,.56+j*.13),(.21-j*.025,.05,.105),p['light'],12,6)
        plate.rotation_euler[0]=-.38
    a.rod('V6 dragon mouth crease',(-.13,.842,1.13),(.13,.842,1.13),.008,p['dark'],6)
    for x in [-.095,.095]:a.cylinder('V6 dragon tiny fang',(x,.834,1.135),.018,.064,p['ivory'],6,top=0).rotation_euler[0]=math.pi
    if not mounted:
        a.ellipsoid('V6 living ember in breath',(0,.88,1.16),(.046,.06,.045),p['glow'],10,6)
        if mother:
            for side in [-1,1]:
                a.rod('V6 matriarch secondary horn',(side*.07,.37,1.40),(side*.085,.23,1.75),.035,p['gold'],8,end=.003)
                a.ellipsoid('V6 matriarch bronze neck plate',(side*.18,.24,1.07),(.09,.16,.13),p['gold'],12,6)
        else:
            for side in [-1,1]:a.ellipsoid('V6 hatchling ear sail',(side*.26,.42,1.36),(.08,.045,.13),p['light'],12,6)
    else:
        rider(a,p,family,seat=(0,-.13,1.08),mage=family=='phoenix')
        for side in [-1,1]:a.rod('V6 riding reins',(side*.16,-.06,1.32),(side*.15,.55,1.15),.011,p['leather'],6)
        if family=='phoenix':
            spell=a.mat('V6 venomfire spell','9cde98',.1,1.5)
            ring=a.torus('V6 mage rider floating spell circle',(-.38,-.10,1.79),.16,.013,p['gold']);ring.rotation_euler[0]=math.pi/2
            a.ellipsoid('V6 poisonous ember globe',(-.38,-.06,1.79),(.09,.09,.09),spell,12,6)
    return p


def rider(a,p,family,seat=(0,0,1.02),mage=False,dwarf=False):
    x,y,z=seat
    a.cube('V6 embossed saddle',(x,y,z-.04),(.36,.32,.09),p['leather'],.03)
    body=[]
    torso=a.ellipsoid('V6 rider tailored torso',(x,y,z+.20),(.14 if not dwarf else .19,.115,.22),p['cloth'],14,8);body.append(torso)
    for side in [-1,1]:
        body.append(a.rod('V6 bent riding thigh',(x+side*.08,y,z+.04),(x+side*.24,y+.02,z-.08),.07,p['cloth'],8))
        a.rod('V6 riding boot',(x+side*.24,y+.02,z-.08),(x+side*.25,y+.15,z-.30),.064,p['dark'],8)
        body.append(a.rod('V6 rider sleeve',(x+side*.14,y,z+.30),(x+side*.25,y+.12,z+.13),.063,p['cloth'],8))
        a.ellipsoid('V6 rider glove',(x+side*.26,y+.14,z+.12),(.05,.055,.047),p['leather'],10,5)
    organic(a,'V6 seamless rider tunic',body,p['cloth'],.014,850)
    head=[a.ellipsoid('V6 rider cheek and cranium',(x,y+.012,z+.49),(.125,.11,.15),p['skin'],14,8),a.ellipsoid('V6 rider neck',(x,y,z+.37),(.055,.06,.085),p['skin'],10,6),a.ellipsoid('V6 rider nose',(x,y+.122,z+.48),(.028,.028,.035),p['skin'],10,6)]
    organic(a,'V6 sculpted rider face',head,p['skin'],.009,600)
    for side in [-1,1]:a.ellipsoid('V6 rider focused eye',(x+side*.05,y+.11,z+.525),(.018,.012,.013),p['dark'],8,5)
    a.cylinder('V6 rider waist sash',(x,y,z+.085),.15,.06,p['gold'],12)
    if mage:
        a.cylinder('V6 mage riding hat brim',(x,y,z+.625),.20,.025,p['cloth'],12)
        a.cylinder('V6 mage conical crown',(x,y,z+.76),.15,.29,p['cloth'],12,top=.022)
        a.rod('V6 mage dragon staff',(x+.28,y+.12,z-.28),(x+.28,y+.12,z+.91),.019,p['gold'],8)
        a.ellipsoid('V6 mage dragon staff crystal',(x+.28,y+.12,z+.94),(.066,.066,.1),p['glow'],10,6)
    elif dwarf:
        for j in range(5):a.rod('V6 dwarf copper beard braid',(x+(j-2)*.037,y+.12,z+.43),(x+(j-2)*.025,y+.16,z+.25),.035,p['light'],8,end=.018)
        a.ellipsoid('V6 bomber flight cap',(x,y-.01,z+.59),(.136,.11,.10),p['leather'],12,6)
        for side in [-1,1]:
            g=a.torus('V6 brass flight goggles',(x+side*.05,y+.121,z+.54),.034,.009,p['gold']);g.rotation_euler[0]=math.pi/2
            a.ellipsoid('V6 blue goggles glass',(x+side*.05,y+.124,z+.54),(.027,.009,.024),p['glow'],10,5)
    else:
        a.ellipsoid('V6 dragon rider helmet',(x,y-.02,z+.60),(.14,.12,.08),p['steel'],12,6)
        a.cylinder('V6 dragon rider brow band',(x,y,z+.57),.138,.035,p['gold'],12)
        for side in [-1,1]:a.rod('V6 dragon rider helm horn',(x+side*.11,y,z+.65),(x+side*.19,y-.03,z+.76),.025,p['gold'],7,end=.003)
        a.rod('V6 rider lance',(x+.31,y+.13,z-.4),(x+.31,y+.13,z+.95),.02,p['leather'],8)
        a.cylinder('V6 lance lightning tip',(x+.31,y+.13,z+1.04),.05,.22,p['glow'],6,top=0)


def bird(a,p):
    footing(a,p)
    parts=[a.ellipsoid('Thunderbird sculpt breast',(0,0,.95),(.24,.23,.36),p['hide'],16,8),a.ellipsoid('Thunderbird sculpt neck',(0,.12,1.26),(.14,.17,.24),p['hide'],14,8),a.ellipsoid('Thunderbird sculpt head',(0,.22,1.44),(.17,.17,.17),p['hide'],14,8)]
    organic(a,'V6 unified thunderbird anatomy',parts,p['hide'],.019,1600)
    for side in [-1,1]:
        a.rod('V6 thunderbird scaled leg',(side*.12,0,.74),(side*.14,.07,.27),.055,p['gold'],8)
        for dx in [-.07,0,.07]:a.rod('V6 thunderbird gripping talon',(side*.14,.08,.27),(side*.14+dx,.25,.20),.024,p['dark'],6,end=.003)
        feather_wing(a,p,side,1.13,1.24,.40)
        a.ellipsoid('V6 thunderbird luminous eye',(side*.137,.307,1.47),(.031,.015,.025),p['glow'],10,5)
        for j in range(3):tapered_leaf(a,'V6 thunderbird swept head plume',(side*.03,.13,1.51),(side*(.08+j*.08),.08,1.78-j*.04),.035,p['light'])
    a.rod('V6 thunderbird hooked beak',(0,.32,1.44),(0,.53,1.40),.067,p['gold'],8,end=.013)
    a.rod('V6 beak hooked end',(0,.52,1.41),(0,.53,1.34),.025,p['gold'],7,end=.003)
    for j in range(5):tapered_leaf(a,'V6 thunderbird long tail fan',((j-2)*.025,-.12,.90),((j-2)*.12,-.38,.27),.07,p['light'] if j%2 else p['hide'])
    for side in [-1,1]:
        pts=[(side*.23,.07,1.60),(side*.34,.07,1.78),(side*.23,.07,1.75),(side*.35,.07,1.96)]
        for s,t in zip(pts,pts[1:]):a.rod('V6 feather lightning arc',s,t,.012,p['glow'],5)
    return p


def bear(a,p):
    footing(a,p,.50)
    parts=[]
    for n,pos,scale in [('Bear sculpt haunch',(0,-.21,.69),(.38,.40,.38)),('Bear sculpt powerful chest',(0,.19,.85),(.35,.36,.43)),('Bear sculpt neck',(0,.38,1.15),(.24,.24,.27)),('Bear sculpt head',(0,.51,1.32),(.26,.24,.24)),('Bear sculpt muzzle',(0,.72,1.24),(.19,.20,.12))]:parts.append(a.ellipsoid(n,pos,scale,p['hide'],16,8))
    for side in [-1,1]:
        for y in [-.31,.29]:
            parts.append(a.rod('Bear sculpt heavy leg',(side*.28,y,.69),(side*.31,y+.02,.23),.13,p['hide'],10,end=.115))
            parts.append(a.ellipsoid('Bear sculpt rounded paw',(side*.31,y+.08,.23),(.15,.18,.07),p['hide'],12,6))
        parts.append(a.ellipsoid('Bear sculpt ear',(side*.2,.45,1.51),(.09,.07,.10),p['hide'],12,6))
    organic(a,'V6 unified royal bear anatomy',parts,p['hide'],.025,3000)
    a.ellipsoid('V6 royal bear nose',(0,.878,1.30),(.092,.046,.045),p['dark'],12,6)
    for side in [-1,1]:
        a.ellipsoid('V6 bear amber eye',(side*.19,.675,1.40),(.038,.017,.022),p['glow'],10,6)
        for y in [-.31,.29]:
            for dx in [-.07,0,.07]:a.rod('V6 bear ivory claw',(side*.31+dx,y+.20,.25),(side*.31+dx,y+.26,.19),.022,p['ivory'],6,end=.002)
        a.ellipsoid('V6 emerald druid shoulder plate',(side*.29,.05,1.01),(.12,.21,.14),p['cloth'],12,6)
        for j in range(3):tapered_leaf(a,'V6 bear druid leaf mantle',(side*.29,.06-j*.08,1.08),(side*.45,.06-j*.08,.9),.06,p['light'])
    a.cylinder('V6 Bearking circlet',(0,.46,1.50),.23,.07,p['gold'],12)
    for j in range(5):
        ang=j*math.tau/5
        a.cylinder('V6 Bearking crown leaf',(math.cos(ang)*.21,.46+math.sin(ang)*.17,1.62),.035,.23,p['gold'],5,top=0)
    a.ellipsoid('V6 Bearking venom emerald',(0,.65,1.53),(.05,.022,.055),a.mat('V6 royal venomstone','92ca77',.2,.5),10,6)
    return p


def griffin(a,p):
    footing(a,p,.50)
    parts=[a.ellipsoid('Griffin sculpt feline body',(0,-.15,.68),(.28,.42,.29),p['hide'],16,8),a.ellipsoid('Griffin sculpt eagle chest',(0,.18,.91),(.26,.24,.32),p['light'],16,8),a.ellipsoid('Griffin sculpt feather neck',(0,.32,1.15),(.16,.17,.25),p['light'],14,8),a.ellipsoid('Griffin sculpt eagle head',(0,.41,1.34),(.19,.18,.18),p['light'],14,8)]
    organic(a,'V6 unified griffin golden body',[parts[0]],p['hide'],.022,900)
    organic(a,'V6 unified griffin eagle anatomy',parts[1:],p['light'],.019,1300)
    for side in [-1,1]:
        for y in [-.30,.24]:
            a.rod('V6 griffin supporting leg',(side*.22,y,.65),(side*.27,y+.07,.23),.071,p['hide'] if y<0 else p['gold'],10,end=.051)
            for dx in [-.045,0,.045]:a.rod('V6 griffin hooked talon',(side*.27,y+.08,.25),(side*.27+dx,y+.23,.20),.019,p['dark'],6,end=.003)
        feather_wing(a,p,side,1.0,1.10,.22)
        a.ellipsoid('V6 griffin alert eye',(side*.142,.509,1.39),(.03,.017,.026),p['dark'],10,6)
        tapered_leaf(a,'V6 griffin swept ear plume',(side*.12,.34,1.45),(side*.21,.28,1.67),.047,p['light'])
    a.rod('V6 griffin golden hooked beak',(0,.53,1.34),(0,.72,1.27),.067,p['gold'],8,end=.016)
    a.rod('V6 griffin beak hooked end',(0,.70,1.28),(0,.71,1.22),.02,p['gold'],6,end=.002)
    tail=[(0,-.44,.70),(.2,-.63,.79),(.36,-.66,.90)]
    for s,t in zip(tail,tail[1:]):a.rod('V6 griffin lion tail',s,t,.043,p['hide'],8,end=.025)
    a.ellipsoid('V6 griffin tail plume',tail[-1],(.07,.06,.1),p['light'],12,6)
    rider(a,p,'griffinbomber',seat=(0,-.17,1.10),dwarf=True)
    for side in [-1,1]:
        a.cube('V6 leather bomb pannier',(side*.31,-.22,.77),(.17,.32,.24),p['leather'],.022)
        for j in range(2):
            bomb=(side*.36,-.30+j*.16,.97)
            a.ellipsoid('V6 griffin bomber iron charge',bomb,(.09,.09,.10),p['dark'],12,6)
            a.rod('V6 bomb copper fuse',Vector(bomb)+Vector((0,0,.085)),Vector(bomb)+Vector((.03,0,.14)),.009,p['gold'],5)
            a.ellipsoid('V6 lit bomb fuse',Vector(bomb)+Vector((.03,0,.14)),(.018,.018,.018),p['glow'],8,5)
    return p


def build(family,a):
    p=palette(a,family)
    if family in ('embercrown','worldfire','thunderheart','phoenix'):return dragon(a,p,family)
    if family=='starfall':return bird(a,p)
    if family=='rangermentor':return bear(a,p)
    if family=='griffinbomber':return griffin(a,p)
    raise ValueError(f'Unknown creature {family}')
