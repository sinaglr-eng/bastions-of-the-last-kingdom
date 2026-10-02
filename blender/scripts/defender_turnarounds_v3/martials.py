"""Measured Soldier/Archer reconstructions of the approved four-view sheets.

All coordinates are authored in one +Y-forward model frame.  Equipment is
never made camera-facing.  The cross-view bow-plane ambiguity is documented
in martials-measurements.json; a single diagonal plane satisfies the strongest
front and profile evidence while retaining physical depth.
"""
import math
import bpy
from mathutils import Vector


def _attach(b, obj, parent):
    b.attach(obj, parent)
    return obj


def hair(b):
    """Broad low faceted crown, short sides and back; no separate locks."""
    _attach(b, b.rings('short_hair', [
        (0, .070, 1.605, .196, .170),
        (0, .062, 1.720, .204, .164),
        (0, .055, 1.784, .080, .076)], 'hair'), b.head)
    for s in (-1, 1):
        _attach(b, b.panel('short_hair_side_' + str(s), [
            (s*.140, .221, 1.642), (s*.204, .151, 1.623),
            (s*.195, .141, 1.423), (s*.123, .221, 1.461)],
            .151, 'hair'), b.head)
    _attach(b, b.panel('short_hair_back', [
        (-.160, -.024, 1.637), (.160, -.024, 1.637),
        (.138, -.017, 1.407), (0, -.046, 1.378),
        (-.138, -.017, 1.407)], .062, 'hair', True), b.head)
    # One front hairline with a restrained central peak rather than spikes.
    _attach(b, b.panel('short_hair_front', [
        (-.161, .241, 1.698), (0, .263, 1.738),
        (.161, .241, 1.698), (.141, .258, 1.616),
        (.058, .262, 1.637), (-.047, .262, 1.594),
        (-.154, .249, 1.618)], .029, 'hair'), b.head)


def helmet(b, closed=False):
    if closed:
        _attach(b, b.rings('closed_helm', [
            (0, .050, 1.352, .193, .212),
            (0, .060, 1.667, .218, .224),
            (0, .042, 1.824, .108, .150)], 'steel'), b.head)
        _attach(b, b.panel('closed_helm_eye_slit', [
            (-.145, .286, 1.574), (.145, .286, 1.574),
            (.145, .288, 1.602), (-.145, .288, 1.602)],
            .004, 'eyes'), b.head)
    else:
        _attach(b, b.rings('helmet', [
            (0, .084, 1.619, .213, .216),
            (0, .073, 1.747, .205, .198),
            (0, .080, 1.824, .078, .106)], 'steel'), b.head)
        for s in (-1, 1):
            _attach(b, b.panel('helmet_cheek_' + str(s), [
                (s*.132, .264, 1.654), (s*.214, .214, 1.614),
                (s*.204, .212, 1.373), (s*.128, .267, 1.401)],
                .094, 'steel'), b.head)
        _attach(b, b.panel('helmet_back', [
            (-.177, -.040, 1.676), (.177, -.040, 1.676),
            (.184, -.045, 1.397), (0, -.060, 1.377),
            (-.184, -.045, 1.397)], .054, 'steel', True), b.head)


def breastplate(b, leather=False, trim=False):
    mat = 'boots' if leather else 'steel'
    part = 'leather_jerkin' if leather else 'breastplate'
    y = .161 if leather else .181
    _attach(b, b.panel(part, [
        (-.190, y, 1.244), (0, y+.022, 1.204),
        (.190, y, 1.244), (.170, y+.012, .942),
        (.110, y+.016, .875), (-.110, y+.016, .875),
        (-.170, y+.012, .942)], .043, mat, True), b.torso)
    if leather:
        # A single vest shell has real back/side surfaces under the cloak.
        _attach(b, b.panel('leather_jerkin_back', [
            (-.168, -.121, 1.228), (.168, -.121, 1.228),
            (.170, -.137, .877), (-.170, -.137, .877)],
            .018, mat), b.torso)
        for s in (-1, 1):
            _attach(b, b.panel('leather_jerkin_side_' + str(s), [
                (s*.192, .101, 1.233), (s*.194, -.120, 1.227),
                (s*.175, -.130, .879), (s*.177, .108, .879)],
                .013, mat), b.torso)
    if trim:
        _attach(b, b.panel('silver_chest_edging', [
            (-.195, y+.033, 1.258), (0, y+.057, 1.188),
            (.195, y+.033, 1.258), (.188, y+.036, 1.224),
            (0, y+.059, 1.153), (-.188, y+.036, 1.224)],
            .014, 'steel'), b.torso)


def shoulders(b, small=False):
    # One connected faceted shell per shoulder; no spherical armor layers.
    for side, s in [('left', -1), ('right', 1)]:
        x0, x1 = (.188, .336) if small else (.181, .361)
        z0, z1 = (1.327, 1.230) if small else (1.354, 1.205)
        verts = [(s*x0, .118, z0), (s*(x1-.018), .085, z0-.024),
                 (s*x1, .103, z1), (s*(x0+.011), .158, z1+.023),
                 (s*x0, -.133, z0), (s*(x1-.018), -.127, z0-.024),
                 (s*x1, -.130, z1), (s*(x0+.011), -.145, z1+.023)]
        faces = [(0,1,2,3), (4,7,6,5), (0,4,5,1),
                 (1,5,6,2), (2,6,7,3), (3,7,4,0)]
        _attach(b, b.mesh('shoulder_plate_'+side, verts, faces, 'steel'),
                b.upper.get(side) or b.torso)


def cloth_tabard(b):
    # Ranks V/VI put their large rank-colored cloth over the steel breastplate;
    # IV alone exposes the plate. The physical underlying armor is retained.
    _attach(b,b.panel('Rank_Cloth_Front_Tabard',[
        (-.196,.214,1.254),(0,.228,1.205),(.196,.214,1.254),
        (.180,.214,.942),(.124,.214,.882),(-.124,.214,.882),
        (-.180,.214,.942)],.018,'blue',True),b.torso)


def sword(b):
    x, y, z = .472, .450, .955
    parent = b.weapon['right']
    _attach(b, b.rod('sword_grip', (x,y,z-.125), (x,y,z+.039),
                    .031, 'boots'), parent)
    _attach(b, b.box('sword_guard', (x,y,z+.077),
                    (.224,.070,.037), 'steel', .007), parent)
    top = 1.888 if b.rank < 6 else 1.941
    _attach(b, b.panel('sword_blade', [
        (x-.035,y+.025,z+.093), (x+.035,y+.025,z+.093),
        (x+.043,y+.025,top-.148), (x,y+.025,top),
        (x-.043,y+.025,top-.148)], .050, 'steel', True), parent)


def shield(b, metal=False):
    x, y = -.455, .304
    large = b.rank == 6
    half = .220 if large else .210
    top, bottom = (1.330, .366) if large else (1.288, .400)
    outline = [(x-half,y,top-.155), (x,y,top),
               (x+half,y,top-.155), (x+half*.87,y,.691),
               (x,y,bottom), (x-half*.87,y,.691)]
    parent = b.weapon['left']
    mat, part = ('steel','iron_shield') if metal else ('wood','wooden_shield')
    _attach(b, b.panel(part, outline, .072, mat, metal), parent)
    # A broad simple edge, not separate decorative rivets or heraldry.
    for i, a in enumerate(outline):
        d = outline[(i+1)%len(outline)]
        _attach(b, b.rod(part+'_edge_'+str(i), a, d, .020,
                        'steel' if metal else 'belt', 4), parent)
    if not metal:
        for j, dx in enumerate((-.085, .085)):
            _attach(b, b.rod('wooden_shield_panel_seam_'+str(j),
                            (x+dx,y+.007,.558), (x+dx,y+.007,1.177),
                            .005, 'belt', 4), parent)
    # Back grip intentionally differs from shield front and connects to hand.
    _attach(b, b.box('shield_rear_hand_grip', (x,.207,.939),
                    (.152,.038,.036), 'belt', .004), parent)
    for dx in (-.075,.075):
        _attach(b, b.rod('shield_grip_anchor_'+str(dx),
                        (x+dx,.211,.939), (x+dx,.258,.939),
                        .014,'belt',4),parent)


def plate_legs(b):
    for s in (-1, 1):
        x = s*.190
        _attach(b, b.panel('armored_knee_'+str(s), [
            (x-.086,.133,.555), (x,.157,.594),
            (x+.086,.133,.555), (x+.078,.154,.443),
            (x,.176,.415), (x-.078,.154,.443)],
            .072, 'steel', True), b.root)
        _attach(b, b.rings('armored_greave_'+str(s), [
            (x,-.006,.128,.068,.074),
            (x,-.008,.261,.073,.079),
            (x,-.007,.428,.092,.091)], 'steel'), b.root)
    for obj in b.objects:
        if 'boot' in obj.get('part','').lower():
            obj.data.materials.clear()
            obj.data.materials.append(b.m['steel'])


def wrapped_cape(b, hem, two_tips=False):
    """A single front-open cloth shell wraps shoulders and back in 3D.

    The lateral cloth surface is required by the strict profile references;
    a thin planar panel would collapse into an unsupported diagonal stripe.
    """
    for obj in list(b.objects):
        if obj.get('part') in ('Broad_Pointed_Back_Cape','Archer_Long_Two_Point_Cape'):
            b.objects.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
    section=[(-1,.00),(-1,-.08),(-.64,-.165),(-.33,-.18),
             (0,-.182),(.33,-.18),(.64,-.165),(1,-.08),(1,.00)]
    rear=.450 if hem>=.45 else .540
    low_y=[.045,-rear*.52,-rear*.89,-rear*.97,-rear,
           -rear*.97,-rear*.89,-rear*.52,.045]
    low_z=[hem+.135,hem+.092,hem+.041,hem,hem+.220,
           hem,hem+.041,hem+.092,hem+.135] if two_tips else [hem+.045]*9
    if not two_tips:low_z[4]=hem
    verts=[(sx*.238,y,1.26) for sx,y in section]
    verts += [(sx*.310,low_y[i],low_z[i]) for i,(sx,y) in enumerate(section)]
    faces=[(i,i+1,10+i,9+i) for i in range(8)]
    name='Archer_Long_Two_Point_Cape' if two_tips else b.family+'_Wrapped_Back_Cape'
    obj=b.mesh(name,verts,faces,'blue')
    solid=obj.modifiers.new('Measured cape cloth thickness','SOLIDIFY')
    solid.thickness=.023
    _attach(b,obj,b.torso)


def soldier(b):
    r = b.rank
    b.body(hood=False, mantle=True, cape='long' if r >= 5 else 'short')
    if r==6:
        # The closed solid miniature helmet completely occludes the face.
        # Omit that hidden geometry rather than let shared open-face detail
        # penetrate the visor as other classes' profile anatomy is refined.
        for obj in list(b.objects):
            if obj.get('part')=='Angular_Face' or obj.get('part','').startswith('Dark_Eye_'):
                b.objects.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
        b.root['occludedFaceOmitted']=True
    wrapped_cape(b,.240 if r>=5 else .480)
    b.arm('right', (.335,.140,.970), (.472,.450,.955), metal=r>=5)
    b.arm('left', (-.327,.021,1.040), (-.425,.159,.915), metal=r>=5)
    # Brown mitten fists remain visible beyond silver cuffs in V/VI source.
    for obj in b.objects:
        if 'glove_mitten' in obj.get('part',''):
            obj.data.materials.clear();obj.data.materials.append(b.m['boots'])
    if r == 1:
        hair(b)
        parent = b.weapon['right']
        _attach(b,b.rod('wooden_spear_shaft',(.472,.450,.015),
                       (.472,.450,1.765),.025,'wood'),parent)
        _attach(b,b.panel('wooden_spear_point', [
            (.472,.481,1.958),(.401,.481,1.758),
            (.472,.481,1.667),(.543,.481,1.758)],
            .062,'wood',True),parent)
    else:
        helmet(b, r==6)
        sword(b)
        if r >= 3: shield(b,r>=5)
        if r >= 4: breastplate(b)
        if r >= 5:
            cloth_tabard(b)
            shoulders(b)
            plate_legs(b)
    b.pivot('attack_muzzle', (.472,.450,1.200), b.weapon['right'])


def _bow(b):
    r = b.rank
    grip = Vector((-.488,.520,.926))
    # Author one physically fixed diagonal plane; both lateral projections
    # naturally contain a narrower curve, with a thin nonbillboard section.
    u = Vector((-.7071,.7071,0))
    n = Vector((.7071,.7071,0))
    lo, hi = [( .205,1.580),(.205,1.580),(.117,1.720),
              (.026,1.864),(.024,1.860),(.021,1.860)][r-1]
    if r <= 2:
        curve=[(lo,-.018),(.390,.033),(.659,.110),(.926,0),
               (1.199,.094),(1.439,.040),(hi,-.017)]
    elif r == 3:
        curve=[(lo,-.035),(.230,.021),(.483,.137),(.730,.096),
               (.926,0),(1.142,.092),(1.438,.130),
               (1.656,.018),(hi,-.035)]
    elif r == 4:
        curve=[(lo,-.007),(.285,.030),(.570,.080),(.926,0),
               (1.249,.072),(1.576,.047),(hi,-.009)]
    else:
        curve=[(lo,-.045),(.164,.037),(.369,.154),(.602,.134),
               (.812,.018),(.926,0),(1.044,.018),(1.267,.134),
               (1.497,.157),(1.725,.041),(hi,-.045)]
    centers=[grip + u*off + Vector((0,0,z-grip.z)) for z,off in curve]
    width = .024 if r<5 else .029 if r==5 else .036
    depth = .018 if r<5 else .026
    verts=[]
    for j,c in enumerate(centers):
        tangent=(centers[min(j+1,len(centers)-1)]-
                 centers[max(0,j-1)]).normalized()
        across=n.cross(tangent).normalized()
        for a,d in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            verts.append(tuple(c + across*width*a + n*depth*d))
    faces=[(3,2,1,0)]+[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i)
        for j in range(len(centers)-1) for i in range(4)]
    faces.append(tuple((len(centers)-1)*4+i for i in range(4)))
    bow=b.weapon['left'];bow.name='bow_pivot'
    shape=_attach(b,b.mesh('Continuous_Recurve_Bow',verts,faces,'wood'),bow)
    if r>=5:
        shape.data.materials.append(b.m['ivory' if r==5 else 'steel'])
        # Wide laminated strips at the tips and midlimbs, not extra weapons.
        for p in shape.data.polygons:
            z=sum(shape.data.vertices[i].co.z for i in p.vertices)/len(p.vertices)
            if z<.265 or z>1.672 or .450<z<.640 or 1.230<z<1.490:
                p.material_index=1
    top, bottom = tuple(centers[-1]), tuple(centers[0])
    b.pivot('bow_tip_upper',top,bow);b.pivot('bow_tip_lower',bottom,bow)
    string_pivot=b.pivot('authored_bowstring',tuple(grip),bow)
    _attach(b,b.rod('Taut_Bow_String',bottom,top,.004,'belt',4),string_pivot)
    _attach(b,b.rod('bow_wrapped_grip',(-.488,.520,.851),
                    (-.488,.520,1.001),.036,'boots',6),bow)
    b.pivot('bow_nock',(.310,.066,.740),b.hand['right'])
    b.pivot('attack_muzzle',tuple(grip),bow)


def _quiver(b):
    # Right-side cylinder and arrows all share the same diagonal attachment.
    r=b.rank
    bottom=Vector((.173,-.229,.927 if r==1 else .876))
    mouth=Vector((.306,-.215,1.386 if r==1 else 1.428))
    axis=(mouth-bottom).normalized()
    radius=.090 if r==1 else .099
    _attach(b,b.limb('Single_Right_Back_Quiver',[
        (*bottom,radius*.85,radius*.86),
        (*(bottom+axis*.045),radius,radius),
        (*mouth,radius,radius)],'boots',6),b.torso)
    _attach(b,b.limb('Quiver_Mouth_Band',[
        (*(mouth-axis*.030),radius*1.06,radius*1.06),
        (*mouth,radius*1.06,radius*1.06)],'belt',6),b.torso)
    for i,dx in enumerate((-.037,0,.037)):
        start=mouth+Vector((dx,-.002,-.04))
        end=start+axis*(.255+(i%2)*.022)
        _attach(b,b.rod('Arrow_Shaft_'+str(i),tuple(start),tuple(end),
                       .008,'wood',5),b.torso)
        # One broad ivory feather per visible arrow; no extra phantom shafts.
        feather=end-axis*.056
        _attach(b,b.limb('Arrow_Fletching_'+str(i),[
            (*feather,.019,.014),(*end,.016,.012)],'ivory',4),b.torso)


def archer(b):
    r=b.rank
    b.root['bowRestPose']='lowered-hand'
    b.body(hood=True,mantle=r>=2,
           cape=False if r==1 else 'long' if r>=4 else 'short')
    if r>=2:wrapped_cape(b,.700 if r==2 else .500 if r==3 else .200,r>=4)
    if r==6:
        for obj in b.objects:
            if obj.get('part')=='Pointed_Open_Hood_Shell':
                for vertex in obj.data.vertices:
                    vertex.co.y += .022 if vertex.co.y>.020 else -.018
    b.arm('left',(-.334,.150,.950),(-.488,.520,.926))
    b.arm('right',(.301,.016,.994),(.310,.066,.740))
    if r>=3:
        # Widen each existing bracer radially without adding duplicate armor.
        for side, elbow, hand in [
                ('left',(-.334,.150,.950),(-.488,.520,.926)),
                ('right',(.301,.016,.994),(.310,.066,.740))]:
            e,h=Vector(elbow),Vector(hand);axis=(h-e).normalized()
            for obj in b.objects:
                if obj.get('part') != side+'_bracer': continue
                matrix=obj.matrix_world.copy();inverse=matrix.inverted()
                for vertex in obj.data.vertices:
                    p=matrix@vertex.co;c=e+axis*(p-e).dot(axis)
                    vertex.co=inverse@(c+(p-c)*1.17)
    if r>=3: breastplate(b,leather=True,trim=r==6)
    if r>=5: shoulders(b,small=True)
    _bow(b)
    _quiver(b)


def build(b):
    if b.family == 'soldier': return soldier(b)
    if b.family == 'archer': return archer(b)
    raise ValueError('martials cannot build '+b.family)
