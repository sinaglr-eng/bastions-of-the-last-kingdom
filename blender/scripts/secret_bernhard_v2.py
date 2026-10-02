"""Lord Bernhard's second native design: a seated, fully armoured royal rider.

Coordinates use Blender Z-up and +Y-forward. The saddle and the rider pelvis
share an authored contact plane; the horse has equine stifle/hock anatomy rather
than four interchangeable straight legs. This module never exports assets.
"""
import bpy
import math
from mathutils import Vector
from author_archer import cube, ellipsoid, cylinder, rod, custom, torus, mat
import articulation


def tube(name, points, radii, material, sides=10):
    """A tapered, continuous surface for flowing hair and anatomical contours."""
    vertices=[]
    for j,point in enumerate(points):
        p=Vector(point)
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)])
        tangent.normalize()
        across=tangent.cross(Vector((1,0,0)))
        if across.length < .01:across=tangent.cross(Vector((0,1,0)))
        across.normalize();other=tangent.cross(across).normalized()
        for k in range(sides):
            angle=math.tau*k/sides
            vertices.append(tuple(p+radii[j]*(math.cos(angle)*across+math.sin(angle)*other)))
    faces=[tuple(range(sides-1,-1,-1))]
    for j in range(len(points)-1):
        for k in range(sides):
            a=j*sides+k;b=j*sides+(k+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(points)-1)*sides+k for k in range(sides)))
    result=custom(name,vertices,faces,material)
    for face in result.data.polygons:face.use_smooth=True
    return result


def horse(H,p):
    # Adult warmblood proportions: a substantial long barrel, small head,
    # withers above the croup, and slender lower limbs below muscular thighs.
    parts=[
        ellipsoid('Bernhard horse long ribcage',(0,-.075,1.010),(.245,.445,.242),p['whitehorse'],18,10),
        ellipsoid('Bernhard horse muscular croup',(0,-.390,1.035),(.257,.227,.243),p['whitehorse'],16,8),
        ellipsoid('Bernhard horse shoulder mass',(0,.250,1.068),(.227,.241,.272),p['whitehorse'],16,8),
        ellipsoid('Bernhard horse lower chest',(0,.287,.979),(.173,.180,.210),p['whitehorse'],14,8),
        ellipsoid('Bernhard horse raised withers',(0,.170,1.233),(.153,.170,.095),p['whitehorse'],14,7),
        tube('Bernhard horse swept anatomical neck',[(0,.257,1.115),(0,.330,1.286),(0,.416,1.466),(0,.513,1.577)],[.181,.151,.115,.089],p['whitehorse'],14),
        ellipsoid('Bernhard horse poll',(0,.526,1.575),(.094,.107,.108),p['whitehorse'],14,8),
        ellipsoid('Bernhard horse tapered facial bone',(0,.639,1.492),(.085,.142,.109),p['whitehorse'],14,8),
        ellipsoid('Bernhard horse fine muzzle',(0,.765,1.397),(.090,.075,.061),p['whitehorse'],14,8),
    ]
    body=H.fuse(parts,'Bernhard continuous adult white horse anatomy',p['whitehorse'],2600,.011)
    body_joint=H.pivot('horse_body',(0,-.075,1.010),[body])
    body_joint['anatomy']='adult warmblood: long barrel, raised withers, arched neck'
    for side in (-1,1):
        # Small upright ears are attached to the poll, not oversized rabbit ears.
        tube('Bernhard horse tapered ear',[(side*.063,.491,1.642),(side*.072,.486,1.698),(side*.076,.482,1.738)],[.029,.021,.003],p['whitehorse'],8)
        ellipsoid('Bernhard horse soft inner ear',(side*.066,.507,1.684),(.014,.005,.027),p['ear'],8,5)
        ellipsoid('Bernhard horse dark almond eye',(side*.085,.568,1.573),(.009,.022,.016),p['dark'],10,6)
        ellipsoid('Bernhard horse eye glint',(side*.091,.576,1.581),(.004,.005,.004),p['ivorylight'],6,4)
        ellipsoid('Bernhard horse fine nostril',(side*.064,.794,1.407),(.020,.005,.010),p['nostril'],10,6)
        H.arc('Bernhard horse delicate muzzle line',[(side*.083,.780,1.374),(side*.045,.823,1.368),(0,.829,1.369)],.0035,p['nostril'],5)

    for side,label in [(-1,'L'),(1,'R')]:
        for rear in (True,False):
            before=set(H.meshes())
            if rear:
                hip=(side*.164,-.382,1.054)
                stifle=(side*.184,-.253,.788)
                hock=(side*.180,-.475,.535)
                fetlock=(side*.178,-.425,.304)
                thigh=ellipsoid('Bernhard horse muscular rear thigh',(side*.163,-.362,.963),(.109,.131,.181),p['whitehorse'],12,7)
                parts=[thigh,rod('Bernhard horse stifle upper limb',hip,stifle,.075,p['whitehorse'],10,end=.054),rod('Bernhard horse rear gaskin',stifle,hock,.054,p['whitehorse'],10,end=.027),ellipsoid('Bernhard horse pointed rear hock',hock,(.036,.041,.040),p['whitehorse'],10,6),rod('Bernhard horse rear cannon bone',hock,fetlock,.026,p['whitehorse'],10,end=.022)]
            else:
                hip=(side*.153,.284,1.106)
                elbow=(side*.157,.225,.929)
                knee=(side*.161,.330,.659)
                fetlock=(side*.163,.313,.303)
                parts=[ellipsoid('Bernhard horse front upper muscle',(side*.151,.253,.987),(.081,.108,.156),p['whitehorse'],12,7),rod('Bernhard horse forearm',elbow,knee,.051,p['whitehorse'],10,end=.031),ellipsoid('Bernhard horse rounded fore knee',knee,(.035,.040,.036),p['whitehorse'],10,6),rod('Bernhard horse front cannon bone',knee,fetlock,.026,p['whitehorse'],10,end=.022)]
            parts.extend([ellipsoid('Bernhard horse fetlock',fetlock,(.032,.037,.037),p['whitehorse'],10,6),rod('Bernhard horse angled pastern',fetlock,(fetlock[0],fetlock[1]+.025,.242),.025,p['whitehorse'],10,end=.029)])
            H.fuse(parts,'Bernhard horse '+label+(' rear leg with stifle and hock' if rear else ' front leg with fore knee'),p['whitehorse'],600,.007)
            # The hoof sole is exactly Z=.160, the native plinth's top plane.
            hoof=cylinder('Bernhard horse natural dark hoof',(fetlock[0],fetlock[1]+.035,.2015),.046,.083,p['hoof'],10,top=.033)
            hoof.scale.y=1.18
            joint=H.pivot('leg_horse_'+label+('_rear' if rear else '_front'),hip,set(H.meshes())-before)
            joint['gaitPhase']=0 if (side>0)==rear else math.pi
            joint['anatomy']='stifle-hock-pastern' if rear else 'elbow-carpus-pastern'

    # The mane follows the rear of the neck. Flowing tail surfaces have rounded
    # cross sections and taper smoothly; no blocky elbow-shaped hair rods.
    for j in range(4):
        x=(j-1.5)*.020
        tube('Bernhard horse silky ivory mane',[(x,.476,1.655),(x,.403,1.551),(x,.309,1.377),(x,.178,1.194)],[.028,.041,.038,.006],p['mane'],8)
    for j in range(4):
        x=(j-1.5)*.020
        tube('Bernhard horse flowing ivory tail',[(x,-.558,1.114),(x,-.652,.980),(x*1.25,-.719,.787),(x*1.35,-.743,.571),(x*1.5,-.701,.391)],[.038,.044,.034,.023,.003],p['mane'],9)

    # The small golden saddle cloth conforms to the horse's flanks and leaves
    # the neck and musculature readable from both sides.
    blanket=custom('Bernhard royal GOLD saddle cloth',[
        (-.183,-.318,1.221),(.183,-.318,1.221),(.261,-.330,1.087),(.278,-.318,.929),
        (.276,.097,.951),(.250,.124,1.113),(.167,.108,1.253),(-.167,.108,1.253),
        (-.250,.124,1.113),(-.276,.097,.951),(-.278,-.318,.929),(-.261,-.330,1.087)],
        [(0,1,6,7),(1,2,5,6),(2,3,4,5),(7,8,11,0),(8,9,10,11)],p['goldcloth'])
    solid=blanket.modifiers.new('Woven saddle cloth thickness','SOLIDIFY');solid.thickness=.012
    bpy.context.view_layer.objects.active=blanket;bpy.ops.object.modifier_apply(modifier=solid.name)
    for side in (-1,1):
        H.arc('Bernhard gold saddlecloth embroidery',[(side*.281,-.318,.937),(side*.278,.10,.959),(side*.254,.124,1.113)],.006,p['brightgold'],6)
        ellipsoid('Bernhard saddle cloth sun badge',(side*.283,-.116,1.067),(.009,.041,.044),p['brightgold'],10,6)
        H.arc('Bernhard fine leather horse bridle',[(side*.086,.482,1.628),(side*.090,.605,1.522),(side*.084,.745,1.414)],.009,p['leather'],7)
        ellipsoid('Bernhard bridle golden rosette',(side*.096,.599,1.526),(.009,.018,.018),p['brightgold'],8,5)
        tube('Bernhard gentle hanging rein',[(side*.086,.778,1.403),(side*.13,.59,1.304),(side*.18,.36,1.339),(-.17,.178,1.457)],[.006]*4,p['leather'],6)
    H.arc('Bernhard fine noseband',[(-.080,.788,1.425),(0,.837,1.424),(.080,.788,1.425)],.009,p['leather'],8)

    saddle=cube('Bernhard fitted leather SADDLE seat',(0,-.109,1.238),(.326,.279,.057),p['leather'],.019)
    saddle['seatSurfaceZ']=1.2665
    seat_joint=H.pivot('saddle_seat',(0,-.109,1.238),[saddle])
    seat_joint['surfaceZ']=1.2665
    for y,z in [(-.248,1.273),(.023,1.279)]:
        H.arc('Bernhard sculpted gold saddle bow',[(-.150,y,z),(-.079,y,z+.025),(0,y,z+.030),(.079,y,z+.025),(.150,y,z)],.016,p['gold'],8)
    marker=H.pivot('saddle_seat_surface',(0,-.109,1.2665));marker['surface']='saddle-top';marker['contactTolerance']=.02


def closed_helmet(H,p,torso):
    before=set(H.meshes())
    # The entire enclosed head is armour: the dark sight slot contains no human
    # face or eyeballs. Sloping cheek/chin plates avoid a featureless bucket.
    rings=[(1.832,.096,.079),(1.858,.124,.096),(1.973,.135,.103),(2.071,.125,.098),(2.121,.079,.067),(2.136,.015,.014)]
    vertices=[];sides=14
    for z,rx,ry in rings:
        for k in range(sides):
            a=math.tau*k/sides
            vertices.append((rx*math.cos(a),-.088+ry*math.sin(a),z))
    faces=[tuple(range(sides-1,-1,-1))]
    for j in range(len(rings)-1):
        for k in range(sides):faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    faces.append(tuple((len(rings)-1)*sides+k for k in range(sides)))
    helm=custom('Bernhard FULL CLOSED regal great helm',vertices,faces,p['silver'])
    helm['fullyClosed']=True
    # A proud convex visor, a narrow black sight seam, and a raised centre ridge.
    custom('Bernhard CLOSED convex silver face visor',[(-.112,.010,1.973),(0,.041,1.982),(.112,.010,1.973),(.102,.008,1.879),(0,.035,1.849),(-.102,.008,1.879)],[(0,1,4,5),(1,2,3,4)],p['silver'])
    H.arc('Bernhard helmet black enclosed sight seam',[(-.098,.018,1.977),(0,.047,1.985),(.098,.018,1.977)],.005,p['dark'],6)
    H.arc('Bernhard visor embossed gold spine',[(0,.044,1.974),(0,.047,1.917),(0,.038,1.860)],.007,p['brightgold'],6)
    H.arc('Bernhard royal helmet golden brow',[(-.111,.005,2.017),(-.055,.020,2.036),(0,.031,2.048),(.055,.020,2.036),(.111,.005,2.017)],.009,p['brightgold'],7)
    for side in (-1,1):
        H.arc('Bernhard helmet gold cheek scroll',[(side*.112,.009,1.963),(side*.098,.018,1.903),(side*.049,.030,1.875)],.005,p['gold'],6)
        for j in range(3):
            ellipsoid('Bernhard closed visor ventilation rivet',(side*(.043+j*.021),.031-j*.005,1.920-j*.010),(.006,.003,.006),p['dark'],7,4)
        ellipsoid('Bernhard gilded helmet temple rosette',(side*.131,-.080,1.998),(.008,.026,.025),p['brightgold'],10,6)
    # Gold diadem around the great helm, with five restrained crown points and
    # a sculpted central sun crest. No exposed skin under this crown.
    ring=torus('Bernhard great helm gold coronet',(0,-.088,2.098),.107,.008,p['brightgold']);ring.scale.y=.78
    for x,zz in [(-.081,2.157),(-.043,2.183),(0,2.217),(.043,2.183),(.081,2.157)]:
        base=(x,-.014,2.101);tip=(x,-.015,zz)
        rod('Bernhard glorious crown fleur point',base,tip,.014,p['gold'],7,end=.003)
        ellipsoid('Bernhard coronet pearl',(x,-.015,zz),(.010,.009,.010),p['ivorylight'],8,5)
    custom('Bernhard raised golden royal crest',[(0,-.169,2.086),(0,-.119,2.144),(0,-.187,2.251),(0,-.264,2.165),(0,-.210,2.087)],[(0,1,2,3,4)],p['brightgold'])
    head=H.pivot('head_pivot',(0,-.088,1.978),set(H.meshes())-before)
    head['fullyClosedHelmet']=True;articulation.parent_keep_world(head,torso)


def build(H):
    p=H.royal_palette()
    p['whitehorse']=p['white']
    p.update(goldcloth=mat('Bernhard royal GOLD damask','c49536',.22,.06),
             brightgold=mat('Bernhard luminous gilt highlights','ffd879',.72,.27),
             ivorylight=mat('Bernhard pearl highlights','fff6d5',.15,.12),
             ear=mat('Bernhard horse inner ear','bfb4a4'),
             nostril=mat('Bernhard horse soft muzzle shadow','786f65'),
             silver=mat('Bernhard polished luminous silver armour','e1e3dc',.83,.08),
             gold=mat('Bernhard burnished royal gold','dbac49',.78,.18))
    for key in ('silver','gold','brightgold'):
        p[key].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.33
    footing_before=set(H.meshes())
    H.pedestal(p,.50)
    # An oval footing supports both fore and hind hooves, while the width stays
    # within one miniature cell. This includes the inset ring and stone tiers.
    for part in set(H.meshes())-footing_before:part.scale.y*=1.45
    horse(H,p)
    torso=H.pivot('torso_pivot',(0,-.109,1.302));before=set(H.meshes())
    # Pelvis lower surface is 1.256, only 0.0105 inside the saddle surface.
    # Thus the rider's seat touches the saddle instead of hovering above it.
    pelvis=ellipsoid('Bernhard seated armoured PELVIS in saddle',(0,-.109,1.326),(.147,.115,.070),p['silver'],14,8)
    pelvis['seatContactZ']=1.256
    rod('Bernhard fitted gold padded torso',(0,-.108,1.344),(0,-.108,1.697),.139,p['goldcloth'],14,end=.181)
    ellipsoid('Bernhard radiant shaped silver CUIRASS',(0,-.024,1.575),(.168,.096,.201),p['silver'],16,8)
    for j in range(3):
        cube('Bernhard articulated silver abdominal plate',(0,.003,1.463-j*.052),(.274-j*.025,.054,.074),p['silver'],.018)
    for side in (-1,1):
        H.arc('Bernhard chest engraved gold border',[(side*.135,.006,1.728),(side*.158,.056,1.592),(side*.127,.044,1.448)],.007,p['brightgold'],7)
        # Seated legs wrap the saddle, while the boots rest in the stirrups.
        hip=(side*.105,-.108,1.313);knee=(side*.300,.112,1.104);ankle=(side*.295,.010,.835)
        rod('Bernhard seated silver thigh',hip,knee,.066,p['silver'],12,end=.059)
        ellipsoid('Bernhard shaped riding knee plate',knee,(.075,.061,.068),p['silver'],12,7)
        rod('Bernhard angled silver riding greave',knee,ankle,.052,p['silver'],12,end=.041)
        ellipsoid('Bernhard pointed silver riding sabaton',(side*.295,.072,.814),(.051,.087,.037),p['silver'],12,7)
        H.arc('Bernhard golden greave engraving',[(side*.295,.145,1.097),(side*.295,.105,.959),(side*.295,.054,.845)],.005,p['brightgold'],6)
        H.arc('Bernhard leather stirrup strap',[(side*.162,-.032,1.249),(side*.293,-.005,1.026),(side*.295,.015,.806)],.012,p['leather'],6)
        ring=torus('Bernhard GOLD riding stirrup',(side*.295,.042,.799),.047,.007,p['gold']);ring.rotation_euler[1]=math.pi/2;ring.scale.y=.75
    ellipsoid('Bernhard gold radiant sun chest medallion',(0,.077,1.647),(.038,.011,.045),p['brightgold'],12,7)
    for j in range(8):
        a=math.tau*j/8
        rod('Bernhard royal chest sun ray',(math.sin(a)*.046,.081,1.647+math.cos(a)*.048),(math.sin(a)*.061,.081,1.647+math.cos(a)*.063),.004,p['gold'],5)
    # Sweeping golden damask cloak ends over the horse's rump, not below its legs.
    verts=[]
    for z,w,y in [(1.766,.162,-.172),(1.571,.196,-.263),(1.363,.222,-.350),(1.151,.251,-.486)]:
        for j in range(7):
            t=j/6
            verts.append(((t-.5)*w*2,y+(.020 if j%2 else -.020),z+(abs(t-.5)*.049 if z<1.2 else 0)))
    cape=custom('Bernhard GOLD pleated royal mantle',verts,[(r*7+j,r*7+j+1,(r+1)*7+j+1,(r+1)*7+j) for r in range(3) for j in range(6)],p['goldcloth'])
    solid=cape.modifiers.new('Gold damask mantle thickness','SOLIDIFY');solid.thickness=.015;bpy.context.view_layer.objects.active=cape;bpy.ops.object.modifier_apply(modifier=solid.name)
    for j in (0,6):H.arc('Bernhard golden mantle embroidered edge',[verts[r*7+j] for r in range(4)],.006,p['brightgold'],6)
    H.arc('Bernhard mantle gold lower hem',verts[21:28],.007,p['brightgold'],6)
    cylinder('Bernhard full armoured neck gorget',(0,-.088,1.782),.083,.113,p['silver'],14,top=.091)
    torus('Bernhard gold gorget rim',(0,-.088,1.827),.085,.006,p['gold'])
    articulation.attach(set(H.meshes())-before,torso)
    seated_joint=H.pivot('rider_seat',(0,-.109,1.326),[pelvis])
    seated_joint['seatContactZ']=1.256
    articulation.parent_keep_world(seated_joint,torso)
    seat=H.pivot('rider_seat_contact',(0,-.109,1.256));seat['surface']='pelvis-bottom';articulation.parent_keep_world(seat,torso)
    torso['saddleContactGap']=-.0105
    closed_helmet(H,p,torso)

    arms=[((.172,-.097,1.734),(.286,-.062,1.919),(.251,.025,2.139)),
          ((-.172,-.097,1.734),(-.271,.006,1.549),(-.17,.178,1.457))]
    for shoulder,elbow,hand in arms:
        upper,lower,wrist,weapon=articulation.limb(shoulder,elbow,hand);articulation.parent_keep_world(upper,torso)
        before=set(H.meshes())
        ellipsoid('Bernhard generous silver shoulder pauldron',shoulder,(.096,.103,.075),p['silver'],14,7)
        for j in range(2):
            ellipsoid('Bernhard layered gilded shoulder lame',(shoulder[0],shoulder[1],shoulder[2]-.041-j*.028),(.099-j*.008,.095-j*.008,.021),p['gold'],12,6)
        rod('Bernhard shaped silver upper arm',shoulder,elbow,.056,p['silver'],12,end=.049)
        articulation.attach(set(H.meshes())-before,upper);before=set(H.meshes())
        ellipsoid('Bernhard gold elbow couter',elbow,(.055,.052,.059),p['gold'],12,6)
        rod('Bernhard silver plate forearm',elbow,hand,.049,p['silver'],12,end=.038)
        rod('Bernhard luminous gold wrist cuff',Vector(elbow).lerp(Vector(hand),.78),Vector(elbow).lerp(Vector(hand),.87),.046,p['gold'],10)
        articulation.attach(set(H.meshes())-before,lower);before=set(H.meshes())
        ellipsoid('Bernhard closed silver riding gauntlet',hand,(.045,.038,.053),p['silver'],12,7)
        for j in range(3):cube('Bernhard articulated gauntlet finger plate',(hand[0]+(j-1)*.018,hand[1]+.031,hand[2]),(.014,.017,.044),p['silver'],.004)
        articulation.attach(set(H.meshes())-before,wrist)
        if shoulder[0]>0:
            before=set(H.meshes());x,y,z=hand
            rod('Bernhard raised sword GOLD bound grip',(x,y,z-.050),(x,y,z+.110),.018,p['goldcloth'],10)
            for zz in (z-.035,z+.008,z+.052,z+.094):cylinder('Bernhard golden sword grip filigree',(x,y,zz),.020,.008,p['gold'],10)
            H.arc('Bernhard elaborate raised sword gold crossguard',[(x-.126,y,z+.105),(x-.078,y,z+.128),(x,y,z+.125),(x+.078,y,z+.128),(x+.126,y,z+.105)],.015,p['brightgold'],8)
            ellipsoid('Bernhard golden sword pearl pommel',(x,y,z-.075),(.027,.024,.031),p['brightgold'],10,6)
            blade=[(x-.039,y-.012,z+.160),(x+.039,y-.012,z+.160),(x+.027,y-.012,z+.664),(x,y-.012,z+.835),(x-.027,y-.012,z+.664),
                   (x-.039,y+.013,z+.160),(x+.039,y+.013,z+.160),(x+.027,y+.013,z+.664),(x,y+.013,z+.835),(x-.027,y+.013,z+.664)]
            custom('Bernhard upright radiant silver SWORD blade',blade,[(0,1,2,3,4),(9,8,7,6,5)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)],p['silver'])
            rod('Bernhard luminous gold blade fuller',(x,y+.014,z+.183),(x,y+.014,z+.638),.004,p['brightgold'],5)
            articulation.attach(set(H.meshes())-before,weapon)
            articulation.pivot('attack_muzzle',(x,y,z+.720),weapon)
    return p
