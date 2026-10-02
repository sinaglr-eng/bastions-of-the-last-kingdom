"""Measured, editable Variant B caster reconstruction for Blender 5.2.

The current four-view sheets and final construction notes are the authority.
Coordinates are +Y front, +X anatomical right and sole Z=0.  This module
authors new geometry against the v3 body measurements, rather than scaling
the earlier prototype.  The cloak's reverse, leaf backs, book spine, and hat
depth are deliberately simple inferred constructions where drawings occlude
them.  All views use the same real parts and rigid articulation.
"""
import math
import bpy
import bmesh


def _outward_closed(obj):
    """Orient a closed cloth volume by geometry, without changing its shape."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    assert all(edge.is_manifold for edge in bm.edges), obj.name
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def _remove_parts(b, fragments):
    for obj in list(b.objects):
        part = str(obj.get('part', obj.name)).lower()
        if any(f.lower() in part for f in fragments):
            b.objects.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)


def _recolor(b, objects, fragments, material):
    for obj in objects:
        part = str(obj.get('part', obj.name)).lower()
        if obj.type == 'MESH' and any(f.lower() in part for f in fragments):
            obj.data.materials.clear()
            obj.data.materials.append(b.m[material])


def _diamond(b, name, center, radius, height, material):
    x, y, z = center
    vertices = [(x, y, z - height / 2), (x, y, z + height / 2)]
    vertices += [(x + radius * math.cos(i * math.tau / 6),
                  y + radius * math.sin(i * math.tau / 6), z)
                 for i in range(6)]
    faces = [(0, 2 + (i + 1) % 6, 2 + i) for i in range(6)]
    faces += [(1, 2 + i, 2 + (i + 1) % 6) for i in range(6)]
    return b.mesh(name, vertices, faces, material)


def _folded_leaf(b, name, base, tip, half_width, material='green'):
    """Closed solid folded leaf: one broad blade, no tiny ornament or veins."""
    ax, ay, az = base
    tx, ty, tz = tip
    dx, dz = tx - ax, tz - az
    length = max(.001, math.hypot(dx, dz))
    px, pz = -dz / length * half_width, dx / length * half_width
    mx, my, mz = ax + dx * .57, ay + (ty - ay) * .57, az + dz * .57
    edge = [(ax, ay, az), (mx + px, my, mz + pz),
            (tx, ty, tz), (mx - px, my, mz - pz)]
    vertices = edge + [(mx, my + .026, mz)]
    vertices += [(x, y - .022, z) for x, y, z in edge]
    vertices += [(mx, my - .035, mz)]
    faces = [(i, (i + 1) % 4, 4) for i in range(4)]
    faces += [(5 + (i + 1) % 4, 5 + i, 9) for i in range(4)]
    faces += [(i, 5 + i, 5 + (i + 1) % 4, (i + 1) % 4)
              for i in range(4)]
    return b.mesh(name, vertices, faces, material)


def _robe(b, cleric=False):
    """Continuous broad robe from shoulder to boot height, closed hem."""
    # Boots rise behind the low hem, so concealed upper trousers add no
    # silhouette and are omitted rather than piercing the narrow robe waist.
    _remove_parts(b, ['Continuous_Long_Robe', 'Trouser_'])
    # Dimensions read from the long robe's broad front and profile silhouettes.
    obj = b.rings('Caster_Continuous_Long_Robe', [
        (0, -.008, 1.275, .243, .150),
        (0, -.010, 1.090, .200, .132),
        (0, -.010, .875, .167, .120),
        (0, -.014, .540, .282, .188),
        (0, -.017, .220, .333, .214),
    ], 'blue')
    b.attach([obj], b.torso)
    if cleric and b.rank == 1:
        b.attach([b.panel('Cleric_Robe_Short_Front_Slit', [
            (-.011, .199, .223), (.011, .199, .223),
            (.004, .175, .545), (-.004, .175, .545)], .004, 'navy')], b.torso)


def _open_cowl(b, pointed=False):
    """Broad open cowl, with a measured face aperture and solid cloth depth."""
    start = len(b.objects)
    peak = 2.015 if pointed else 1.742
    outer = [(0, -.185 if pointed else .052, peak), (.181, .057, 1.744),
             (.287, .101, 1.508), (.227, .153, 1.365),
             (0, .202, 1.290), (-.227, .153, 1.365),
             (-.287, .101, 1.508), (-.181, .057, 1.744)]
    opening = [(0, .241, 1.699), (.122, .243, 1.657),
               (.178, .221, 1.510), (.137, .227, 1.377),
               (0, .234, 1.335), (-.137, .227, 1.377),
               (-.178, .221, 1.510), (-.122, .243, 1.657)]
    back = [(x * .89, -.215 if i == 0 and pointed else -.210,
             1.925 if i == 0 and pointed else z)
            for i, (x, y, z) in enumerate(outer)]
    # Shared boundaries make the cloth a closed solid with a dark cavity.
    inner = [(x * .98, -.112, z) for x, y, z in opening]
    vertices = outer + opening + back + [(0, -.247, 1.531)]
    vertices += inner + [(0, -.117, 1.512)]
    faces = []
    for i in range(8):
        j = (i + 1) % 8
        faces += [(i, j, 8 + j, 8 + i), (i, 16 + i, 16 + j, j),
                  (16 + i, 24, 16 + j)]
    inner_start = len(faces)
    for i in range(8):
        j = (i + 1) % 8
        faces += [(8+i, 8+j, 25+j, 25+i), (25+i, 25+j, 33)]
    obj = b.mesh('Mage_Pointed_No_Brim_Cap' if pointed else 'Caster_Open_Low_Cowl',
                 vertices, faces, 'blue')
    obj.data.materials.append(b.m['navy'])
    for polygon in obj.data.polygons:
        if polygon.index >= inner_start:
            polygon.material_index = 1
    _outward_closed(obj)
    b.attach(b.objects[start:], b.head)


def _mantle(b, material='blue', leaf=False, wide=False):
    """One closed continuous garment around the shoulders, not loose leaves."""
    if leaf:
        outline = [(0, .220, 1.155), (.105, .218, 1.226),
                   (.180, .185, 1.181), (.290, .106, 1.249),
                   (.365, .022, 1.188), (.375, -.072, 1.259),
                   (.255, -.186, 1.217), (0, -.237, 1.177),
                   (-.255, -.186, 1.217), (-.375, -.072, 1.259),
                   (-.365, .022, 1.188), (-.290, .106, 1.249),
                   (-.180, .185, 1.181), (-.105, .218, 1.226)]
    else:
        outline = [(0, .228, 1.174), (.210, .177, 1.239),
                   (.353, .058, 1.235), (.343, -.084, 1.236),
                   (.205, -.214, 1.221), (0, -.249, 1.165),
                   (-.205, -.214, 1.221), (-.343, -.084, 1.236),
                   (-.353, .058, 1.235), (-.210, .177, 1.239)]
    if wide:
        outline = [(x * 1.105, y * 1.06, z - .014) for x, y, z in outline]
    neck = []
    for x, y, z in outline:
        radius = max(.001, math.hypot(x, y))
        neck.append((x / radius * .119, y / radius * .118, 1.352))
    n = len(outline)
    # The leaf mantle drapes over the actual shoulder, rather than allowing
    # the dark upper sleeve to puncture its green surface in profile.
    shoulder = [(x*.77, y*.77, 1.330) for x, y, z in outline]
    rings = [neck, shoulder, outline] if leaf else [neck, outline]
    vertices = [point for ring in rings for point in ring]
    surface_count = len(vertices)
    vertices += [(x, y, z - .025) for x, y, z in vertices]
    faces = []
    for row in range(len(rings)-1):
        for i in range(n):
            j = (i + 1) % n
            a, c = row*n, (row+1)*n
            faces += [(a+i, a+j, c+j, c+i),
                      (surface_count+a+j, surface_count+a+i,
                       surface_count+c+i, surface_count+c+j)]
    last = (len(rings)-1)*n
    for i in range(n):
        j = (i+1) % n
        faces += [(i, surface_count+i, surface_count+j, j),
                  (last+i, last+j, surface_count+last+j, surface_count+last+i)]
    name = 'One_Connected_Green_Leaf_Mantle' if leaf else 'Plain_Caster_Shoulder_Mantle'
    obj = b.mesh(name, vertices, faces, material)
    b.attach([obj], b.torso)
    if b.family == 'mage' and b.rank == 6:
        # A single narrow rim around the same garment, not silver armor.
        rim = [(x, y, z + .008) for x, y, z in outline]
        inset = [(x * .95, y * .95, z + .021) for x, y, z in outline]
        verts = rim + inset + [(x, y, z - .010) for x, y, z in rim + inset]
        faces = []
        for i in range(n):
            j = (i + 1) % n
            faces += [(i, j, n + j, n + i),
                      (2*n + j, 2*n + i, 3*n + i, 3*n + j),
                      (i, 2*n + i, 2*n + j, j),
                      (n + i, n + j, 3*n + j, 3*n + i)]
        b.attach([b.mesh('Mage_One_Thin_Silver_Collar_Rim', verts, faces, 'steel')], b.torso)


def _cape(b, long=False, leaf=False):
    # A real open-front U wrap supplies cloth area in both profiles.  The old
    # nearly planar rear sheet could match FRONT/BACK but collapsed to a line
    # in SIDE. The seven-section physical garment retains a single topology.
    hem = .140 if leaf else .220 if long else .500
    integrated = b.family in ('mage', 'cleric') and not long
    spread = .430 if leaf else .410 if long else .315 if integrated else .400
    rear = -.520 if leaf else -.490 if long else -.315 if integrated else -.430
    name = 'Druid_Long_Three_Leaf_Tip_Cape' if leaf else ('Caster_Long_Back_Cape' if long else 'Caster_Short_Back_Cape')
    obj = b.cape_shell(name, hem=hem, spread=spread, rear=rear,
                       tips='three' if leaf else 'one', material='blue')
    if integrated:
        # The short shoulder drape follows the robe rather than flaring into
        # a second wide skirt; its hem remains short as the notes require.
        for i, vertex in enumerate(obj.data.vertices[7:14]):
            vertex.co.x *= .90
            vertex.co.y *= .90
    if leaf:
        for i, height in enumerate([.34, .22, .34, .14, .34, .22, .34]):
            obj.data.vertices[14+i].co.z = height


def _arms(b, book=False, sleeve_material='trousers', bark=False):
    start = len(b.objects)
    b.arm('right', (.358, .147, .997), (.460, .432, .956))
    if book:
        b.arm('left', (-.353, .022, .986), (-.446, .301, .965))
    else:
        b.arm('left', (-.354, .035, .921), (-.382, .081, .676))
    _recolor(b, b.objects[start:], ['sleeve'], sleeve_material)
    if bark:
        _recolor(b, b.objects[start:], ['bracer'], 'bark')


def _antlers(b):
    start = len(b.objects)
    for side, sign in [('Left', -1), ('Right', 1)]:
        b.limb(side + '_Two_End_Antler_Main', [
            (sign * .206, -.025, 1.748, .040, .037),
            (sign * .279, -.045, 1.835, .037, .034),
            (sign * .316, -.088, 1.929, .027, .025),
            (sign * .303, -.110, 2.020, .016, .015)], 'wood', sides=5)
        b.limb(side + '_Two_End_Antler_Inner_Prong', [
            (sign * .271, -.045, 1.829, .034, .032),
            (sign * .220, .025, 1.896, .026, .024),
            (sign * .226, .075, 1.958, .014, .013)], 'wood', sides=5)
    b.attach(b.objects[start:], b.head)


def _druid(b):
    rank = b.rank
    b.body(hood=True, mantle=False, cape=False)
    _arms(b, bark=rank >= 5)
    _mantle(b, material='blue' if rank == 1 else 'green',
            leaf=rank >= 2, wide=rank == 6)
    _cape(b, leaf=rank >= 4)
    if rank >= 3:
        _antlers(b)
    start = len(b.objects)
    x, y = .489, .450
    radius = .028 if rank < 6 else .036
    b.limb('Druid_One_Crooked_Oak_Staff_Shaft', [
        (x-.027, y, .010, radius, radius),
        (x, y, .956, radius, radius),
        (x-.028, y, 1.463, radius, radius),
        (x+.021, y, 1.622, radius, radius),
        (x-.023, y, 1.746, radius, radius)], 'wood', sides=6)
    if rank <= 3:
        b.limb('Druid_One_Leaf_Fork', [
            (x-.023, y, 1.741, .029, .027),
            (x+.020, y, 1.856, .025, .023),
            (x-.019, y, 1.958, .015, .014)], 'wood', sides=6)
        _folded_leaf(b, 'Druid_One_Broad_Green_Staff_Leaf',
                     (x-.008, y+.006, 1.779), (x+.199, y+.004, 1.866), .073)
        focus = (x, y, 1.90)
    else:
        spread = 1.10 if rank == 6 else 1.0
        for label, sign in [('Left', -1), ('Right', 1)]:
            b.limb('Druid_' + label + '_Fork', [
                (x-.023, y, 1.741, .032, .030),
                (x+sign*.079*spread, y, 1.844, .027, .025),
                (x+sign*.108*spread, y, 1.984, .022, .019)], 'wood', sides=6)
            _folded_leaf(b, 'Druid_' + label + '_Broad_Staff_Leaf',
                         (x+sign*.086*spread, y+.007, 1.881),
                         (x+sign*.253*spread, y+.006, 1.966), .075*spread)
        if rank >= 5:
            _diamond(b, 'Druid_One_Green_Seed_Stone', (x, y+.011, 1.919),
                     .067 if rank == 5 else .083, .293 if rank == 5 else .345, 'green')
        focus = (x, y, 1.970)
    b.attach(b.objects[start:], b.weapon['right'])
    b.focus(focus)


def _wizard_hat(b):
    if b.rank == 1:
        _open_cowl(b, pointed=True)
        return
    _open_cowl(b)
    start = len(b.objects)
    # Back/left bend is fixed in model space, never a per-camera deformation.
    height = .038 if b.rank >= 5 else 0
    # A physical annular cloth brim rises above the face and slopes down
    # behind the head. Twelve sections give the broad source contour in
    # FRONT and the clearly inclined brim in both SIDE views.
    n = 12
    inner, outer = [], []
    for i in range(n):
        a = math.tau*i/n
        x, y = math.sin(a), math.cos(a)
        ix, iy = .239*x, -.008+.203*y
        ox, oy = .453*x, -.014+.323*y
        inner.append((ix, iy, 1.745+.20*iy))
        outer.append((ox, oy, 1.700+.28*oy-.025*abs(x)))
    top = inner+outer
    vertices = top+[(x,y,z-.022) for x,y,z in top]
    faces = []
    for i in range(n):
        j = (i+1)%n
        faces += [(i,j,n+j,n+i), (2*n+j,2*n+i,3*n+i,3*n+j),
                  (i,2*n+i,2*n+j,j), (n+i,n+j,3*n+j,3*n+i)]
    _outward_closed(b.mesh('Mage_One_Broad_Thin_Wizard_Brim', vertices, faces, 'blue'))
    hat = b.rings('Mage_One_Left_Back_Bent_Wizard_Hat', [
        (0, -.008, 1.742, .243, .205),
        (.012, -.036, 1.907, .178, .151),
        (-.087, -.115, 2.074+height, .091, .078),
        (-.171, -.213, 2.083+height, .046, .040),
        (-.277, -.285, 1.995+height, .006, .005)], 'blue')
    # The final ring descends at the bent tip. Automatic recalculation can
    # choose the inward orientation for this closed shape; signed volume
    # establishes outward winding without changing any vertex or silhouette.
    _outward_closed(hat)
    b.attach(b.objects[start:], b.head)


def _book(b, opened=False, devotional=False):
    start = len(b.objects)
    name = 'Cleric_Devotional_Book' if devotional else 'Mage_Spellbook'
    x, y, z = -.379, .309, 1.056
    if not opened:
        b.box(name+'_One_Plain_Page_Block', (x, y, z), (.244, .055, .352), 'ivory', bevel=.003)
        b.box(name+'_Front_Leather_Cover', (x, y+.034, z), (.265, .019, .380), 'boots', bevel=.003)
        b.box(name+'_Rear_Leather_Cover', (x, y-.034, z), (.265, .019, .380), 'boots', bevel=.003)
        b.box(name+'_Leather_Spine', (x-.131, y, z), (.022, .085, .378), 'belt', bevel=.003)
    else:
        # A genuine book with one left hand under its spine, no third hand.
        for side, sign in [('Left', -1), ('Right', 1)]:
            outline = [(x, .289, .978), (x+sign*.201, .363, 1.015),
                       (x+sign*.201, .306, 1.230), (x, .232, 1.194)]
            b.panel(name+'_'+side+'_Open_Leather_Cover',
                    [(xx, yy-.020, zz) for xx, yy, zz in outline], .014, 'boots')
            b.panel(name+'_'+side+'_One_Open_Page_Block', outline, .025, 'ivory')
        b.box(name+'_Open_Leather_Spine', (x, .257, 1.086), (.029, .040, .237), 'belt', bevel=.002)
    b.attach(b.objects[start:], b.weapon['left'])


def _mage(b):
    rank = b.rank
    b.body(hood=False, mantle=False, cape=False, robe=True)
    _robe(b)
    if rank >= 4:
        _remove_parts(b, ['belt', 'buckle'])
    _wizard_hat(b)
    _arms(b, book=rank >= 4, sleeve_material='blue' if rank <= 2 else 'trousers')
    if rank >= 3:
        _mantle(b, 'navy' if rank in (4, 6) else 'blue', wide=rank == 6)
        _cape(b, long=rank >= 5)
    if rank >= 4:
        _book(b, opened=rank == 6)
    start = len(b.objects)
    x, y = .489, .450
    socket_z = 1.615 if rank <= 2 else (1.755 if rank <= 4 else 1.742)
    b.rod('Mage_One_Plain_Wooden_Staff_Shaft', (x, y, .010),
          (x, y, socket_z), .022 if rank <= 4 else .029, 'wood', sides=8)
    if rank >= 5:
        for label, sign in [('Left', -1), ('Right', 1)]:
            b.limb('Mage_'+label+'_Single_Broad_Crystal_Prongs', [
                (x, y, socket_z-.006, .032, .028),
                (x+sign*.097, y, 1.830, .025, .022),
                (x+sign*.121, y, 1.980, .019, .017)], 'wood', sides=6)
        radius, height = (.091, .345) if rank == 5 else (.104, .390)
        center_z = 1.934 if rank == 5 else 1.970
    else:
        b.limb('Mage_Small_Plain_Wooden_Crystal_Socket', [
            (x, y, socket_z-.030, .025, .023),
            (x-.040, y, socket_z+.055, .016, .015)], 'wood', sides=6)
        b.limb('Mage_Small_Plain_Wooden_Crystal_Socket_Other_Side', [
            (x, y, socket_z-.030, .025, .023),
            (x+.040, y, socket_z+.055, .016, .015)], 'wood', sides=6)
        radius, height = (.053, .240) if rank <= 2 else (.077, .312)
        center_z = 1.728 if rank <= 2 else 1.868
    _diamond(b, 'Mage_Exactly_One_Violet_Diamond_Crystal', (x, y, center_z), radius, height, 'violet')
    b.attach(b.objects[start:], b.weapon['right'])
    b.focus((x, y, center_z))


def _mitre(b):
    """Two front/back mitre peaks; fixed depth, no decorative horn additions."""
    start = len(b.objects)
    rank = b.rank
    width = .246 if rank <= 4 else .279
    peak = 2.046 if rank <= 4 else 2.136
    bottom = 1.666
    front_peak_y = .083 if rank == 6 else .046
    rear_peak_y = -.082 if rank == 6 else -.064
    valley_depth = .115 if rank == 6 else .042
    # Closed folded volume has the two bishop's peaks along front/back. A
    # front projection reads as the one apex in the supplied final VI sheet.
    outline = [(-width*.67, .126, bottom), (width*.67, .126, bottom),
               (width, .126, 1.819), (0, front_peak_y, peak), (-width, .126, 1.819)]
    # Three cross sections give genuine front/back peaks with a shallow
    # central crown valley, rather than a fake flat pentagonal roof prism.
    rear = [(x, rear_peak_y if i == 3 else -.143, z)
            for i, (x,y,z) in enumerate(outline)]
    middle = [(x, -.0085, z-(valley_depth if i == 3 else 0))
              for i, (x, y, z) in enumerate(outline)]
    vertices = outline + middle + rear
    n = len(outline)
    # The front and back crown each converge toward their own peak. A
    # centre fan preserves real flat lower facets and tapered upper facets,
    # avoiding a rectangular roof silhouette when seen from the side.
    vertices += [(0,.126,1.819), (0,-.143,1.819)]
    faces = [(i,(i+1)%n,3*n) for i in range(n)]
    faces += [(2*n+(i+1)%n,2*n+i,3*n+1) for i in range(n)]
    for section in range(2):
        for i in range(n):
            j = (i+1) % n
            faces.append((section*n+i, section*n+j, (section+1)*n+j, (section+1)*n+i))
    _outward_closed(b.mesh('Cleric_Plain_Deep_Mitre_Two_Front_Back_Peaks', vertices, faces, 'blue'))
    band_mat = 'gold' if rank == 4 else 'ivory'
    # The single ribbon continues over the crown onto the back, as drawn;
    # it is unrelated to the front-only torso stole.
    front_near_y = front_peak_y+.010+(.126-front_peak_y)*.077/(peak-1.819)
    rear_near_y = rear_peak_y-.010+(-.143-rear_peak_y)*.077/(peak-1.819)
    path = [(.136, bottom-.002, .040), (.136, 1.819, .040),
            (front_near_y, peak-.077, .033),
            (front_peak_y+.010, peak+.002, .006),
            (-.0085, peak-valley_depth+.002, .024),
            (rear_peak_y-.010, peak+.002, .006),
            (rear_near_y, peak-.077, .033), (-.153, 1.819, .040),
            (-.153, bottom-.002, .040)]
    vertices = []
    for i, (y, z, width) in enumerate(path):
        previous, following = path[max(i-1, 0)], path[min(i+1, len(path)-1)]
        dy, dz = following[0]-previous[0], following[1]-previous[1]
        length = max(.001, math.hypot(dy, dz))
        inner_y, inner_z = y-.009*dz/length, z+.009*dy/length
        vertices += [(-width, y, z), (width, y, z),
                     (width, inner_y, inner_z), (-width, inner_y, inner_z)]
    faces = [tuple(reversed(range(4)))]
    for row in range(len(path)-1):
        for i in range(4):
            j = (i+1) % 4
            faces.append((4*row+i, 4*row+j, 4*(row+1)+j, 4*(row+1)+i))
    faces.append(tuple(4*(len(path)-1)+i for i in range(4)))
    _outward_closed(b.mesh('Cleric_One_Connected_Front_Back_Mitre_Ribbon', vertices, faces, band_mat))
    b.attach(b.objects[start:], b.head)


def _stole(b):
    # One broad vertical front strip; its reverse is not copied onto the back.
    rows = [(1.300, .159, .071), (1.095, .136, .071),
            (.875, .125, .074), (.548, .179, .081), (.225, .203, .092)]
    surface = []
    for z, y, width in rows:
        surface += [(-width, y, z), (width, y, z)]
    n = len(surface)
    vertices = surface + [(x, y-.011, z) for x, y, z in surface]
    faces = []
    for row in range(4):
        a = row*2
        faces += [(a, a+1, a+3, a+2), (n+a+2, n+a+3, n+a+1, n+a)]
    border = [0, 1, 3, 5, 7, 9, 8, 6, 4, 2]
    for i, a in enumerate(border):
        c = border[(i+1) % len(border)]
        faces.append((a, n+a, n+c, c))
    b.attach([b.mesh('Cleric_One_Broad_Front_Stole', vertices, faces,
                     'gold' if b.rank == 4 else 'ivory')], b.torso)


def _latin_cross(b, x, y, bottom, width, height):
    """One closed Latin cross mesh; lower stem longer than upper stem."""
    stem = width * .237
    bar_z = bottom + height*.685
    bar_height = height*.216
    left, right = x-width/2, x+width/2
    outline = [(x-stem/2, y+.027, bottom), (x+stem/2, y+.027, bottom),
               (x+stem/2, y+.027, bar_z-bar_height/2),
               (right, y+.027, bar_z-bar_height/2),
               (right, y+.027, bar_z+bar_height/2),
               (x+stem/2, y+.027, bar_z+bar_height/2),
               (x+stem/2, y+.027, bottom+height),
               (x-stem/2, y+.027, bottom+height),
               (x-stem/2, y+.027, bar_z+bar_height/2),
               (left, y+.027, bar_z+bar_height/2),
               (left, y+.027, bar_z-bar_height/2),
               (x-stem/2, y+.027, bar_z-bar_height/2)]
    return b.panel('Cleric_Exactly_One_Plain_Gold_Latin_Cross', outline, .054, 'gold')


def _cleric(b):
    rank = b.rank
    b.body(hood=rank == 1, mantle=False, cape=False, robe=True)
    _robe(b, cleric=True)
    if rank >= 4:
        _remove_parts(b, ['belt', 'buckle'])
    if rank >= 2:
        _open_cowl(b)
        _mitre(b)
        _stole(b)
    _mantle(b, 'navy' if rank == 4 else 'blue')
    # The reference shows the cowl's short back cloth even in early ranks.
    _cape(b, long=rank >= 5)
    sleeve = 'trousers' if rank in (2, 3) else 'blue'
    _arms(b, book=rank >= 4, sleeve_material=sleeve)
    if rank >= 4:
        _book(b, opened=rank == 6, devotional=True)
    start = len(b.objects)
    x, y = .489, .450
    height = [.307, .307, .344, .344, .382, .410][rank-1]
    width = [.252, .252, .298, .298, .321, .345][rank-1]
    top = [1.706, 1.772, 1.866, 1.866, 1.940, 1.986][rank-1]
    bottom = top-height
    b.rod('Cleric_One_Plain_Wooden_Cross_Staff_Shaft', (x, y, .010),
          (x, y, bottom+.065), .024 if rank <= 4 else .030, 'wood', sides=8)
    _latin_cross(b, x, y, bottom, width, height)
    b.attach(b.objects[start:], b.weapon['right'])
    b.focus((x, y, top-height*.22))


def build(builder):
    family = str(builder.family).lower().replace(' ', '').replace('_', '')
    if family == 'druid':
        _druid(builder)
    elif family == 'mage':
        _mage(builder)
    elif family == 'cleric':
        _cleric(builder)
    else:
        raise ValueError('casters.build supports only Druid, Mage, Cleric')
    return builder.objects
