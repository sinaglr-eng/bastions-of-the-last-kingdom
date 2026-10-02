"""Approved Variant B Druid, Mage and Cleric, built with common.Builder.

Every part stays an ordinary editable mesh.  Weapons are on the right hand for
the game's existing caster animation; books are genuinely held by the left.
"""
import math


def _recolor(builder, objects, name_fragment, material):
    for obj in objects:
        if name_fragment.lower() in obj.name.lower() and obj.type == 'MESH':
            obj.data.materials.clear()
            obj.data.materials.append(builder.m[material])


def _diamond(b, name, center, radius, height, material):
    x, y, z = center
    verts = [(x, y, z - height * .5), (x, y, z + height * .5)]
    for i in range(6):
        a = math.tau * i / 6
        verts.append((x + radius * math.cos(a), y + radius * math.sin(a), z))
    faces = []
    for i in range(6):
        a, c = 2 + i, 2 + (i + 1) % 6
        faces += [(0, c, a), (1, a, c)]
    return b.mesh(name, verts, faces, material)


def _leaf(b, name, base, tip, width, material='green'):
    # Six large triangles describe a folded leaf without tiny veins or textures.
    ax, ay, az = base
    tx, ty, tz = tip
    dx, dz = tx - ax, tz - az
    length = max(.001, math.hypot(dx, dz))
    px, pz = -dz / length * width, dx / length * width
    mx, my, mz = ax + dx * .54, ay + (ty - ay) * .54, az + dz * .54
    outline = [(ax, ay, az), (mx + px, my, mz + pz),
               (tx, ty, tz), (mx - px, my, mz - pz)]
    verts = outline + [(mx, my + .022, mz)]
    verts += [(x, y - .012, z) for x, y, z in outline]
    faces = [(i, (i + 1) % 4, 4) for i in range(4)]
    faces += [(5, 8, 7, 6)]
    faces += [(i, 5 + i, 5 + (i + 1) % 4, (i + 1) % 4) for i in range(4)]
    return b.mesh(name, verts, faces, material)


def _cowl(b):
    """Low open cowl under the wizard cap or mitre; it never fills the face."""
    start = len(b.objects)
    outer = [(0, .068, 2.030), (.196, .071, 1.984),
             (.260, .100, 1.742), (.191, .153, 1.631), (0, .180, 1.576),
             (-.191, .153, 1.631), (-.260, .100, 1.742), (-.196, .071, 1.984)]
    opening = [(0, .203, 1.992), (.142, .206, 1.955),
               (.198, .188, 1.741), (.130, .183, 1.651), (0, .185, 1.589),
               (-.130, .183, 1.651), (-.198, .188, 1.741), (-.142, .206, 1.955)]
    back = [(x * .91, -.173, z) for x, y, z in outer]
    verts = outer + opening + back + [(0, -.232, 1.813)]
    faces = []
    for i in range(8):
        k = (i + 1) % 8
        faces += [(i, k, 8 + k, 8 + i), (i, 16 + i, 16 + k, k),
                  (16 + i, 24, 16 + k)]
    b.mesh('Low_Open_Cowl', verts, faces, 'blue')
    back_inner = [(x * .94, -.105, z) for x, y, z in opening]
    verts = opening + back_inner + [(0, -.115, 1.80)]
    faces = []
    for i in range(8):
        k = (i + 1) % 8
        faces += [(i, k, 8 + k, 8 + i), (8 + i, 8 + k, 16)]
    b.mesh('Cowl_Deep_Interior', verts, faces, 'navy')
    b.attach(b.objects[start:], b.head)


def _leaf_mantle(b, wide=False):
    scale = 1.13 if wide else 1
    # Both surface loops belong to one solid garment, with broad leaf-like tips.
    outer = [(0, .169, 1.478), (.085, .166, 1.425),
             (.156, .127, 1.473), (.274, .069, 1.397),
             (.316, -.018, 1.448), (.239, -.154, 1.494),
             (0, -.193, 1.551), (-.239, -.154, 1.494),
             (-.316, -.018, 1.448), (-.274, .069, 1.397),
             (-.156, .127, 1.473), (-.085, .166, 1.425)]
    outer = [(x * scale, y * (1.06 if wide else 1), z + .020) for x, y, z in outer]
    neck = []
    for x, y, z in outer:
        length = max(.001, math.hypot(x, y))
        neck.append((x / length * .101, y / length * .095, 1.598))
    n = len(outer)
    verts = neck + outer
    verts += [(x, y, z - .015) for x, y, z in verts]
    faces = []
    for i in range(n):
        k = (i + 1) % n
        faces += [(i, k, n + k, n + i),
                  (2*n + i, 3*n + i, 3*n + k, 2*n + k),
                  (i, 2*n + i, 2*n + k, k),
                  (n + i, n + k, 3*n + k, 3*n + i)]
    obj = b.mesh('Connected_Leaf_Shoulder_Mantle', verts, faces, 'green')
    b.attach([obj], b.torso)


def _leaf_cape(b):
    cols = [-1, -.66, -.32, 0, .32, .66, 1]
    rows = [(1.52, .265, -.176), (1.16, .302, -.222), (.79, .377, -.282)]
    hem = [.715, .575, .69, .535, .69, .575, .715]
    front = []
    for j, (z, width, y) in enumerate(rows):
        for i, c in enumerate(cols):
            zz = z - .063 * abs(c) if j == 0 else (hem[i] if j == 2 else z)
            front.append((c * width, y - .024 * (1 - abs(c)), zz))
    n = len(front)
    verts = front + [(x, y - .019, z) for x, y, z in front]
    faces = []
    for j in range(2):
        for i in range(6):
            a = j * 7 + i
            faces += [(a, a + 1, a + 8, a + 7),
                      (n + a + 7, n + a + 8, n + a + 1, n + a)]
    perimeter = list(range(7)) + [13, 20] + list(range(19, 13, -1)) + [7]
    faces += [(a, n + a, n + perimeter[(i + 1) % len(perimeter)],
               perimeter[(i + 1) % len(perimeter)]) for i, a in enumerate(perimeter)]
    obj = b.mesh('Long_Three_Tip_Leaf_Cape', verts, faces, 'blue')
    b.attach([obj], b.torso)


def _antlers(b):
    start = len(b.objects)
    for side, sign in [('Left', -1), ('Right', 1)]:
        b.limb(side + '_Antler_Main', [
            (sign * .143, -.015, 2.024, .026, .025),
            (sign * .218, -.025, 2.107, .024, .022),
            (sign * .250, -.026, 2.192, .019, .018),
            (sign * .242, -.025, 2.282, .013, .012),
        ], 'wood', sides=6)
        b.limb(side + '_Antler_Inner_Prong', [
            (sign * .215, -.023, 2.111, .020, .019),
            (sign * .157, -.026, 2.180, .015, .014),
            (sign * .162, -.027, 2.245, .010, .010),
        ], 'wood', sides=6)
    b.attach(b.objects[start:], b.head)


def _caster_arms(b, book=False, bark=False):
    start = len(b.objects)
    b.arm('right', (.375, .049, 1.181), (.600, .110, 1.145))
    if book:
        b.arm('left', (-.290, .020, 1.300), (-.390, .200, 1.120))
    else:
        b.arm('left', (-.337, .032, 1.107), (-.357, .054, .885))
    if bark:
        _recolor(b, b.objects[start:], 'bracer', 'bark')


def _druid(b):
    r = b.rank
    b.body(hood=True, mantle=False, cape='short' if r < 4 else False)
    if r in (2, 3):
        for obj in b.objects:
            if obj.get('part') == 'Broad_Pointed_Back_Cape':
                for vertex in obj.data.vertices:
                    if vertex.co.z > 1.43:
                        vertex.co.z -= .030
    _caster_arms(b, bark=r >= 5)
    if r >= 2:
        _leaf_mantle(b, wide=r == 6)
    if r >= 3:
        _antlers(b)
    if r >= 4:
        _leaf_cape(b)

    start = len(b.objects)
    # The crooked oak shaft remains one continuous mesh through the hand grip.
    radius = .027 if r < 6 else .033
    b.limb('Crooked_Oak_Staff', [
        (.600, .110, .133, radius, radius),
        (.600, .110, 1.145, radius, radius),
        (.605, .110, 1.660, radius, radius),
        (.557, .110, 1.797, radius, radius),
        (.600, .110, 1.877, radius, radius),
    ], 'wood', sides=6)
    if r <= 3:
        b.limb('Single_Leaf_Staff_Fork', [
            (.600, .110, 1.873, .028, .025),
            (.615, .110, 2.036, .023, .020),
            (.673, .110, 2.102, .018, .016),
        ], 'wood', sides=6)
        _leaf(b, 'One_Broad_Staff_Leaf', (.618, .114, 1.991),
              (.803, .112, 2.074), .054)
    else:
        size = 1.13 if r == 6 else 1
        for side, sign in [('Left', -1), ('Right', 1)]:
            b.limb(side + '_Oak_Staff_Fork', [
                (.600, .110, 1.873, .030, .027),
                (.600 + sign * .083 * size, .110, 1.965, .025, .023),
                (.600 + sign * .116 * size, .110, 2.097, .021, .018),
            ], 'wood', sides=6)
            _leaf(b, side + '_Broad_Staff_Leaf',
                  (.600 + sign * .097 * size, .118, 2.031),
                  (.600 + sign * .240 * size, .115, 2.121), .061 * size)
        if r >= 5:
            _diamond(b, 'One_Green_Seed_Stone', (.600, .113, 2.038),
                     .057 if r == 5 else .069, .216 if r == 5 else .258, 'green')
    b.attach(b.objects[start:], b.weapon['right'])
    b.focus((.600, .110, 2.055 if r >= 5 else 2.015))


def _wizard_hat(b):
    start = len(b.objects)
    r = b.rank
    if r >= 2:
        b.rings('Wide_Wizard_Hat_Brim', [
            (0, -.019, 1.979, .355, .268),
            (0, -.019, 2.010, .355, .268),
            (0, -.019, 2.023, .317, .230),
        ], 'blue')
    if r == 1:
        rows = [(0, -.018, 1.990, .205, .175),
                (0, -.022, 2.081, .129, .116),
                (.010, -.033, 2.196, .064, .055),
                (.020, -.040, 2.278, .002, .002)]
    else:
        taller = .015 if r >= 5 else 0
        rows = [(0, -.018, 1.994, .223, .185),
                (.012, -.025, 2.108, .145, .126),
                (.045, -.033, 2.217 + taller, .079, .073),
                (.133, -.039, 2.264 + taller, .047, .045),
                (.271, -.038, 2.210 + taller, .002, .002)]
    b.rings('Faceted_Pointed_Wizard_Cap', rows, 'blue')
    b.attach(b.objects[start:], b.head)


def _collar_edge(b):
    # A quiet silver rim, not extra armor plates, follows the plain navy mantle.
    inner = [(0, .166, 1.517), (.200, .117, 1.480), (.299, .013, 1.422),
             (.255, -.151, 1.503), (0, -.186, 1.565),
             (-.255, -.151, 1.503), (-.299, .013, 1.422), (-.200, .117, 1.480)]
    outer = [(0, .169, 1.499), (.213, .126, 1.462), (.317, .017, 1.405),
             (.271, -.160, 1.486), (0, -.195, 1.549),
             (-.271, -.160, 1.486), (-.317, .017, 1.405), (-.213, .126, 1.462)]
    verts = inner + outer
    faces = [(i, (i + 1) % 8, 8 + (i + 1) % 8, 8 + i) for i in range(8)]
    obj = b.mesh('Plain_Silver_Shoulder_Collar_Edge', verts, faces, 'steel')
    b.attach([obj], b.torso)


def _book(b, opened=False, name='Spellbook'):
    start = len(b.objects)
    x, y, z = -.315, .259, 1.238
    if not opened:
        b.box(name + '_Plain_Pages', (x, y, z), (.192, .044, .266), 'ivory', bevel=.003)
        b.box(name + '_Front_Leather_Cover', (x, y + .031, z),
              (.211, .016, .291), 'boots', bevel=.004)
        b.box(name + '_Rear_Leather_Cover', (x, y - .031, z),
              (.211, .016, .291), 'boots', bevel=.004)
        b.box(name + '_Leather_Spine', (x - .103, y, z),
              (.018, .073, .290), 'belt', bevel=.003)
    else:
        for side, sign in [('Left', -1), ('Right', 1)]:
            outline = [(x, .269, 1.110), (x + sign * .178, .323, 1.136),
                       (x + sign * .178, .323, 1.392), (x, .269, 1.365)]
            b.panel(name + '_' + side + '_Leather_Cover',
                    [(xx, yy - .021, zz) for xx, yy, zz in outline], .013, 'boots')
            b.panel(name + '_' + side + '_Plain_Open_Pages', outline, .018, 'ivory')
        b.box(name + '_Open_Spine', (x, .246, 1.237), (.022, .036, .281), 'belt', bevel=.003)
    b.attach(b.objects[start:], b.weapon['left'])


def _mage(b):
    r = b.rank
    start = len(b.objects)
    b.body(hood=False, mantle=r >= 3,
           cape=('long' if r >= 5 else 'short') if r >= 2 else False, robe=True)
    if r in (4, 6):
        _recolor(b, b.objects[start:], 'mantle', 'navy')
    _cowl(b)
    _wizard_hat(b)
    _caster_arms(b, book=r >= 4)
    if r == 6:
        _collar_edge(b)
    if r >= 4:
        _book(b, opened=r == 6)

    start = len(b.objects)
    stem_top = 1.926 if r <= 4 else 1.881
    b.rod('Plain_Wooden_Mage_Staff', (.600, .110, .132),
          (.600, .110, stem_top), .021 if r <= 4 else .026, 'wood', sides=8)
    if r >= 5:
        for side, sign in [('Left', -1), ('Right', 1)]:
            b.limb(side + '_Broad_Crystal_Prongs', [
                (.600, .110, stem_top, .027, .025),
                (.600 + sign * .085, .110, 1.958, .024, .022),
                (.600 + sign * .101, .110, 2.074, .018, .017),
            ], 'wood', sides=6)
        radius, height = (.079, .316) if r == 5 else (.091, .356)
        center_z = 2.053
    else:
        b.limb('Small_Crystal_Staff_Socket', [
            (.600, .110, stem_top - .038, .025, .024),
            (.600, .110, stem_top + .010, .032, .030),
        ], 'wood', sides=8)
        radius, height = (.038, .165) if r <= 2 else (.058, .237)
        center_z = 2.002 if r <= 2 else 2.027
    _diamond(b, 'Single_Violet_Diamond_Crystal', (.600, .110, center_z),
             radius, height, 'violet')
    b.attach(b.objects[start:], b.weapon['right'])
    b.focus((.600, .110, center_z))


def _mitre(b):
    start = len(b.objects)
    r = b.rank
    width = .176 if r <= 4 else .206
    peak = 2.223 if r <= 4 else 2.273
    if r == 6:
        outline = [(-.181, .126, 1.995), (.181, .126, 1.995),
                   (.214, .126, 2.096), (.172, .126, 2.290),
                   (.052, .126, 2.162), (0, .126, 2.104),
                   (-.052, .126, 2.162), (-.172, .126, 2.290),
                   (-.214, .126, 2.096)]
    else:
        outline = [(-width * .77, .126, 1.995), (width * .77, .126, 1.995),
                   (width, .126, 2.071), (0, .126, peak), (-width, .126, 2.071)]
    b.panel('Plain_Two_Point_Mitre' if r == 6 else 'Plain_Low_Mitre',
            outline, .251, 'blue', faceted=r != 6)
    strip_top = 2.102 if r == 6 else peak - .004
    b.panel('Single_Ivory_Mitre_Band', [(-.030, .136, 1.994),
                                      (.030, .136, 1.994),
                                      (.037, .136, strip_top - .030),
                                      (0, .136, strip_top),
                                      (-.037, .136, strip_top - .030)],
            .006, 'gold' if r == 4 else 'ivory')
    b.attach(b.objects[start:], b.head)


def _stole(b):
    rows = [(1.510, .173, .043), (1.335, .133, .043),
            (1.146, .124, .040), (.944, .157, .046), (.518, .178, .058)]
    front = []
    for z, y, width in rows:
        front += [(-width, y, z), (width, y, z)]
    n = len(front)
    verts = front + [(x, y - .008, z) for x, y, z in front]
    faces = []
    for j in range(4):
        a = 2 * j
        faces += [(a, a + 1, a + 3, a + 2),
                  (n + a + 2, n + a + 3, n + a + 1, n + a)]
    perimeter = [0, 1, 3, 5, 7, 9, 8, 6, 4, 2]
    faces += [(a, n + a, n + perimeter[(i + 1) % len(perimeter)],
               perimeter[(i + 1) % len(perimeter)]) for i, a in enumerate(perimeter)]
    obj = b.mesh('One_Broad_Plain_Front_Stole', verts, faces,
                 'gold' if b.rank == 4 else 'ivory')
    b.attach([obj], b.torso)


def _sun_disc(b, center, radius):
    x, y, z = center
    n = 12
    verts = []
    for yy, rr in [(y - .026, radius * .88), (y - .016, radius),
                   (y + .019, radius), (y + .029, radius * .88)]:
        for i in range(n):
            angle = math.tau * i / n
            verts.append((x + rr * math.cos(angle), yy, z + rr * math.sin(angle)))
    faces = [tuple(reversed(range(n)))]
    for j in range(3):
        faces += [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
                  for i in range(n)]
    faces.append(tuple(3*n+i for i in range(n)))
    b.mesh('One_Flat_Golden_Sun_Disc', verts, faces, 'gold')


def _sun_rays(b, center, radius, number, length):
    x, y, z = center
    verts, faces = [], []
    for i in range(number):
        angle = math.tau * i / number
        dx, dz = math.cos(angle), math.sin(angle)
        px, pz = -dz, dx
        base = radius * .88
        half_width = .027 if number == 4 else .024
        outline = [(x + dx * base + px * half_width, y + .014,
                    z + dz * base + pz * half_width),
                   (x + dx * (radius + length), y + .014, z + dz * (radius + length)),
                   (x + dx * base - px * half_width, y + .014,
                    z + dz * base - pz * half_width)]
        start = len(verts)
        verts += outline + [(xx, yy - .036, zz) for xx, yy, zz in outline]
        faces += [(start, start + 1, start + 2),
                  (start + 5, start + 4, start + 3),
                  (start, start + 3, start + 4, start + 1),
                  (start + 1, start + 4, start + 5, start + 2),
                  (start + 2, start + 5, start + 3, start)]
    b.mesh('Sun_Head_%d_Broad_Rays' % number, verts, faces, 'gold')


def _cleric(b):
    r = b.rank
    start = len(b.objects)
    b.body(hood=r == 1, mantle=True,
           cape=False if r < 4 else ('short' if r == 4 else 'long'), robe=True)
    if r == 4:
        _recolor(b, b.objects[start:], 'mantle', 'navy')
    if r >= 2:
        _cowl(b)
        _mitre(b)
        _stole(b)
    _caster_arms(b, book=r >= 4)
    if r >= 4:
        _book(b, opened=r == 6, name='Devotional_Book')

    start = len(b.objects)
    center = (.600, .110, 2.013)
    radius = .078 if r <= 2 else (.094 if r <= 4 else .115)
    b.rod('Plain_Sun_Staff_Shaft', (.600, .110, .132),
          (.600, .110, center[2] - radius * .60), .022 if r <= 4 else .026,
          'wood', sides=8)
    _sun_disc(b, center, radius)
    if r >= 3:
        _sun_rays(b, center, radius, 8 if r == 6 else 4, .090 if r >= 5 else .067)
    b.attach(b.objects[start:], b.weapon['right'])
    b.focus(center)


def build(builder):
    family = str(builder.family).lower().replace(' ', '').replace('_', '')
    if family == 'druid':
        _druid(builder)
    elif family == 'mage':
        _mage(builder)
    elif family == 'cleric':
        _cleric(builder)
    else:
        raise ValueError('casters.build supports only Druid, Mage and Cleric')
    return builder.objects
