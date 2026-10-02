"""Lady Claire's original royal redesign, authored in Blender 5.2.

The face is a new, adult oval surface with inset eyes and a closed smile.  No
mesh, face, proportions or wardrobe are imported from the Kushek character.
The shared export driver calls ``build(H)`` and owns export/render metadata.
"""
import math

import bpy
from mathutils import Vector

import articulation
import cohesive
from author_archer import cube, custom, cylinder, ellipsoid, mat, rod, torus


def _smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def _ring_surface(name, rings, material, segments=24, pleat=0):
    """Make a fitted continuous fabric surface without stacked sphere joints."""
    vertices = []
    for row, (z, width, depth, centre_y) in enumerate(rings):
        for index in range(segments):
            angle = math.tau * index / segments
            fold = 1 + pleat * math.cos(angle * 8 + row * .10)
            vertices.append((math.cos(angle) * width * fold,
                             centre_y + math.sin(angle) * depth * fold, z))
    faces = [(row * segments + i, row * segments + (i + 1) % segments,
              (row + 1) * segments + (i + 1) % segments, (row + 1) * segments + i)
             for row in range(len(rings) - 1) for i in range(segments)]
    faces += [tuple(reversed(range(segments))),
              tuple((len(rings) - 1) * segments + i for i in range(segments))]
    return _smooth(custom(name, vertices, faces, material))


def _skirt_front(rings, z, x, outset=.024):
    """Sample the gown's curved front for an inset that cannot cut through it."""
    row = next((index for index in range(len(rings) - 1)
                if rings[index][0] >= z >= rings[index + 1][0]), len(rings) - 2)
    upper, lower = rings[row], rings[row + 1]
    amount = max(0, min(1, (upper[0] - z) / (upper[0] - lower[0])))
    width = upper[1] + (lower[1] - upper[1]) * amount
    depth = upper[2] + (lower[2] - upper[2]) * amount
    centre_y = upper[3] + (lower[3] - upper[3]) * amount
    phase = (row + amount) * .10
    low, high = 0, math.pi / 2
    for _ in range(24):
        angle = (low + high) / 2
        folded_x = width * math.cos(angle) * (1 + .035 * math.cos(angle * 8 + phase))
        if folded_x > abs(x):
            low = angle
        else:
            high = angle
    angle = (low + high) / 2
    return centre_y + depth * math.sin(angle) * (1 + .035 * math.cos(angle * 8 + phase)) + outset


def _face(p):
    # Adult facial proportions: chin to scalp is .29 m, compared with a full
    # figure of 1.77 m above its footing.  The brow is only .052 m below the
    # front hairline, avoiding the previous unnaturally tall bare forehead.
    # Each ring has independent front/back depth; the front cheek plane stays
    # gentle and flatter than the curved skull behind it.
    rings = [
        (1.638, .032, .043, .029),
        (1.653, .052, .070, .045),
        (1.682, .074, .082, .069),
        (1.714, .091, .087, .082),
        (1.750, .106, .095, .090),
        (1.786, .110, .091, .098),
        (1.823, .104, .080, .099),
        (1.857, .093, .062, .090),
        (1.888, .067, .042, .064),
        (1.911, .028, .018, .025),
        (1.916, .003, .002, .003),
    ]
    count = 28
    vertices = []
    for z, width, front, back in rings:
        for index in range(count):
            angle = math.tau * index / count
            sine = math.sin(angle)
            vertices.append((width * math.cos(angle),
                             -.003 + sine * (front if sine >= 0 else back), z))
    faces = [(row * count + i, row * count + (i + 1) % count,
              (row + 1) * count + (i + 1) % count, (row + 1) * count + i)
             for row in range(len(rings) - 1) for i in range(count)]
    faces.extend([tuple(reversed(range(count))),
                  tuple((len(rings) - 1) * count + i for i in range(count))])
    face = _smooth(custom('Claire newly sculpted adult oval face', vertices, faces, p['skin']))
    face['identitySource'] = 'New original royal portrait: independent adult oval topology'
    face['frontHairlineZ'] = 1.843
    face['eyeLineZ'] = 1.786
    # A slender nasal bridge with a softly defined tip; no chunky button nose.
    nose = custom('Claire delicate sculpted nose', [
        (-.012, .080, 1.788), (.012, .080, 1.788),
        (-.013, .100, 1.758), (0, .114, 1.756), (.013, .100, 1.758),
        (-.009, .094, 1.746), (0, .104, 1.744), (.009, .094, 1.746),
    ], [(0, 1, 3), (0, 3, 2), (1, 4, 3), (2, 3, 6, 5),
        (3, 4, 7, 6), (5, 6, 7), (0, 2, 5), (1, 7, 4)], p['skin'])
    _smooth(nose)
    for side in (-1, 1):
        x = side * .040
        # Whites sit almost flush with the facial plane rather than protruding
        # as large spheres.  Upper lids cover part of each small green iris.
        ellipsoid('Claire small inset almond eye white', (x, .087, 1.786),
                  (.024, .0060, .0116), p['eyewhite'], 12, 6)
        ellipsoid('Claire natural green iris', (x, .0933, 1.786),
                  (.0082, .0030, .0091), p['iris'], 10, 6)
        ellipsoid('Claire understated dark pupil', (x, .0961, 1.786),
                  (.0035, .0014, .0053), p['pupil'], 8, 5)
        ellipsoid('Claire tiny eye light', (x - .0022, .0974, 1.7892),
                  (.0017, .0010, .0017), p['eyewhite'], 6, 4)
        upper = [(x - .025, .090, 1.784), (x - .014, .096, 1.796),
                 (x + .008, .096, 1.797), (x + .025, .090, 1.785)]
        for first, second in zip(upper, upper[1:]):
            rod('Claire fine upper eyelid', first, second, .0029, p['skin'], 6)
        lower = [(x - .024, .089, 1.784), (x, .095, 1.775),
                 (x + .024, .089, 1.785)]
        for first, second in zip(lower, lower[1:]):
            rod('Claire soft lower eyelid', first, second, .0025, p['skin'], 6)
        brow = [(x - .023, .084, 1.812), (x - .006, .087, 1.818),
                (x + .015, .085, 1.815), (x + .024, .079, 1.811)]
        for first, second in zip(brow, brow[1:]):
            rod('Claire finely shaped blonde eyebrow', first, second, .0025, p['brow'], 5)
        ellipsoid('Claire softly shaped human ear', (side * .104, -.015, 1.747),
                  (.014, .013, .031), p['skin'], 10, 6)
        ellipsoid('Claire elegant pearl drop earring', (side * .116, .002, 1.712),
                  (.009, .008, .015), p['pearl'], 10, 6)
        rod('Claire earring gold link', (side * .112, .001, 1.731),
            (side * .116, .002, 1.722), .004, p['gold'], 6)
    # Two tiny closed lip surfaces make a subtle, welcoming smile.  There are
    # deliberately no modeled teeth, open dark cavity or over-wide mouth.
    _smooth(custom('Claire closed gently smiling upper lip', [
        (-.026, .086, 1.716), (-.012, .091, 1.717), (0, .094, 1.714),
        (.012, .091, 1.717), (.026, .086, 1.716),
        (.014, .094, 1.711), (0, .096, 1.710), (-.014, .094, 1.711),
    ], [(0, 1, 7), (1, 2, 6, 7), (2, 3, 5, 6), (3, 4, 5)], p['lips']))
    _smooth(custom('Claire closed soft lower lip', [
        (-.026, .086, 1.716), (-.014, .094, 1.711), (0, .096, 1.710),
        (.014, .094, 1.711), (.026, .086, 1.716),
        (.012, .094, 1.704), (0, .095, 1.702), (-.012, .094, 1.704),
    ], [(0, 1, 7), (1, 2, 6, 7), (2, 3, 5, 6), (3, 4, 5)], p['lips']))
    for first, second in zip([(-.025, .087, 1.716), (0, .097, 1.710)],
                             [(0, .097, 1.710), (.025, .087, 1.716)]):
        rod('Claire fine closed smile seam', first, second, .00125, p['lipshade'], 5)


def _hair(H, p):
    # A continuous scalp shell follows a deliberately low curved hairline.
    # Its open forehead is real scalp geometry, not a high detached hair cap.
    segments, rows = 32, 7
    vertices = []
    for row in range(rows):
        amount = row / (rows - 1)
        for index in range(segments):
            angle = math.tau * index / segments
            front = max(0, math.sin(angle))
            hairline = 1.710 + .133 * front ** 1.50
            polar_bottom = math.acos((hairline - 1.786) / .149)
            polar = polar_bottom * (1 - amount) + .025 * amount
            strand = 1 + .020 * math.cos(angle * 12)
            vertices.append((.116 * math.sin(polar) * math.cos(angle) * strand,
                             -.011 + .108 * math.sin(polar) * math.sin(angle) * strand,
                             1.786 + .149 * math.cos(polar)))
    faces = [(row * segments + i, row * segments + (i + 1) % segments,
              (row + 1) * segments + (i + 1) % segments, (row + 1) * segments + i)
             for row in range(rows - 1) for i in range(segments)]
    cap = _smooth(custom('Claire continuous low hairline blonde scalp', vertices, faces, p['hair']))
    cap['hairlineMinimumFront'] = 1.843
    cap['bangs'] = False
    # Loose wavy rear hair reaches well below the shoulders, with separately
    # tapered locks rather than a ponytail, hard flat block or bangs.
    parts = [ellipsoid('Claire rear flowing blonde hair', (0, -.104, 1.572),
                       (.132, .052, .250), p['hair'], 16, 9),
             ellipsoid('Claire long loose wavy hair ends', (0, -.110, 1.377),
                       (.151, .051, .115), p['hair'], 16, 8)]
    for side in (-1, 1):
        parts += [rod('Claire long loose side hair', (side * .105, -.015, 1.759),
                      (side * .137, -.029, 1.540), .032, p['hair'], 10, end=.030),
                  rod('Claire gentle shoulder hair wave', (side * .137, -.029, 1.540),
                      (side * .151, -.073, 1.342), .030, p['hair'], 10, end=.015)]
    H.fuse(parts, 'Claire softly flowing loose blonde hair below shoulders', p['hair'], 1150, .009)
    # Swept parted strands originate at the temples and crown and continue
    # into the rear volume.  All are thin, restrained sculpt details.
    for side in (-1, 1):
        H.arc('Claire blonde temple strand', [(side * .025, .061, 1.910),
              (side * .081, .064, 1.867), (side * .108, .013, 1.775),
              (side * .132, -.014, 1.601), (side * .145, -.054, 1.399)],
              .0035, p['hairlight'], 5)
        for index in range(3):
            offset = side * (.032 + index * .031)
            H.arc('Claire fine rear blonde wave', [(offset, -.105, 1.872),
                  (offset * 1.08, -.156, 1.690),
                  (offset * .95, -.169, 1.487),
                  (offset * 1.16, -.150, 1.300 + index * .006)],
                  .0038, p['hairlight'], 5)


def _crown(H, p):
    band = torus('Claire lavish royal gold crown band', (0, -.012, 1.897), .112, .012, p['gold'])
    band.scale.y = .91
    # Six sculpted fleur-like arches grow from a real gold circlet.  The central
    # front jewel is clear above the hairline and leaves her forehead visible.
    for index in range(8):
        angle = math.tau * index / 8
        x, y = .112 * math.cos(angle), -.012 + .102 * math.sin(angle)
        height = .112 if math.sin(angle) > .70 else .077
        outward_x, outward_y = math.cos(angle), math.sin(angle)
        centre = (x * 1.06, -.012 + (y + .012) * 1.06, 1.897 + height)
        H.arc('Claire gold crown sculpted lily arch', [
              (x - outward_y * .024, y + outward_x * .024, 1.895),
              (x - outward_y * .019, y + outward_x * .019, 1.946),
              centre,
              (x + outward_y * .019, y - outward_x * .019, 1.946),
              (x + outward_y * .024, y - outward_x * .024, 1.895)],
              .0065, p['gold'], 6)
        ellipsoid('Claire crown pearl finial', centre, (.010, .010, .014), p['pearl'], 8, 5)
        if index % 2 == 0:
            ellipsoid('Claire crown radiant amber jewel',
                      (x * 1.075, -.012 + (y + .012) * 1.075, 1.927),
                      (.010, .010, .015), p['amber'], 8, 5)


def build(H):
    p = H.royal_palette()
    p.update(skin=mat('Claire natural peach porcelain skin', 'efc9ad'),
             cream=mat('Claire warm ivory satin gown', 'f7efdd'),
             silkshadow=mat('Claire champagne silk inset', 'dbc48e'),
             gold=mat('Claire luminous chased royal gold', 'edc45d', .74, .24),
             goldlight=mat('Claire radiant filigree gold', 'ffe49a', .65, .70),
             hair=mat('Claire natural honey blonde hair', 'd4ad55'),
             hairlight=mat('Claire subtle warm blonde strands', 'ecd193'),
             brow=mat('Claire natural blonde brow', '9d7535'),
             lips=mat('Claire soft natural rose lips', 'b87670'),
             lipshade=mat('Claire subtle closed lip seam', '875651'),
             pearl=mat('Claire luminous ivory pearl', 'fff4da', .14, .15),
             amber=mat('Claire radiant warm crown jewels', 'ffce6b', .18, .95))
    for key, roughness in [('skin', .59), ('cream', .38), ('silkshadow', .42),
                           ('gold', .27), ('goldlight', .29), ('hair', .56)]:
        p[key].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = roughness
    H.pedestal(p, .44)
    torso = H.pivot('torso_pivot', (0, 0, 1.118))
    before = set(H.meshes())
    # A tailored adult silhouette: narrow natural waist, shaped bodice and a
    # flowing full-length skirt; there is no workwear, cape or oversized puff.
    _ring_surface('Claire tailored ivory sweetheart silk bodice', [
        (1.502, .157, .092, 0), (1.455, .165, .108, .003),
        (1.376, .149, .106, .003), (1.276, .124, .087, 0),
        (1.143, .116, .079, 0),
    ], p['cream'], 28)
    chest = [ellipsoid('Claire graceful exposed upper chest', (0, -.001, 1.530),
                       (.148, .086, .073), p['skin'], 16, 8),
             rod('Claire slender human neck', (0, -.007, 1.529),
                 (0, -.004, 1.664), .041, p['skin'], 14, end=.038)]
    H.fuse(chest, 'Claire natural neck and collarbone anatomy', p['skin'], 650, .007)
    gown_rings = [
        (1.147, .119, .084, 0), (1.061, .166, .120, -.003),
        (.940, .191, .143, -.010), (.777, .227, .173, -.017),
        (.568, .274, .207, -.026), (.356, .333, .255, -.036),
        (.211, .376, .296, -.045),
    ]
    _ring_surface('Claire flowing ivory pleated royal gown', gown_rings, p['cream'], 40, .035)
    # Long champagne inset ribbons taper up to a slim gold belt, giving the
    # dress richness through fabric and embroidery rather than rank blue.
    panel_rows = [(1.140, .036), (1.061, .050), (.940, .070), (.777, .090),
                  (.568, .116), (.356, .141), (.214, .150)]
    front_panel = [(x, _skirt_front(gown_rings, z, x), z)
                   for z, width in panel_rows for x in (-width, 0, width)]
    panel_faces = [(row * 3 + column, row * 3 + column + 1,
                    (row + 1) * 3 + column + 1, (row + 1) * 3 + column)
                   for row in range(len(panel_rows) - 1) for column in range(2)]
    _smooth(custom('Claire champagne embroidered gown inset', front_panel,
                   panel_faces, p['silkshadow']))
    belt = torus('Claire delicate fitted golden dress belt', (0, 0, 1.145), .119, .008, p['gold'])
    belt.scale.y = .70
    hem = torus('Claire flowing gown luminous gold hem', (0, -.045, .220), .377, .006, p['goldlight'])
    hem.scale.y = .785
    for side in (-1, 1):
        H.arc('Claire fine gold gown embroidery',
              [(side * width, _skirt_front(gown_rings, z, side * width, .028), z)
               for z, width in panel_rows], .0038, p['gold'], 5)
        H.arc('Claire sweetheart neckline gold silk fold', [(side * .147, .025, 1.511),
              (side * .122, .076, 1.500), (side * .071, .104, 1.473),
              (0, .108, 1.476)], .008, p['gold'], 7)
        ellipsoid('Claire ivory satin slipper', (side * .094, .087, .188),
                  (.047, .086, .022), p['cream'], 10, 5)
    H.arc('Claire delicate gold necklace', [(-.075, .073, 1.585),
          (-.042, .092, 1.552), (0, .100, 1.543),
          (.042, .092, 1.552), (.075, .073, 1.585)], .0044, p['gold'], 6)
    ellipsoid('Claire necklace golden sun pendant', (0, .105, 1.528),
              (.015, .006, .021), p['goldlight'], 10, 6)
    articulation.attach(set(H.meshes()) - before, torso)

    before = set(H.meshes())
    _face(p)
    detail_before = set(H.meshes())
    _hair(H, p)
    hairline = H.pivot('natural_hairline', (0, .080, 1.843), set(H.meshes()) - detail_before)
    detail_before = set(H.meshes())
    _crown(H, p)
    crown = H.pivot('royal_crown', (0, -.012, 1.897), set(H.meshes()) - detail_before)
    head = H.pivot('head_pivot', (0, -.003, 1.773),
                   [obj for obj in set(H.meshes()) - before if not obj.parent])
    head['identitySource'] = 'Original Claire V2 adult face; sculpted independently'
    articulation.parent_keep_world(hairline, head)
    articulation.parent_keep_world(crown, head)
    articulation.parent_keep_world(head, torso)

    for shoulder, elbow, hand in [
        ((.159, 0, 1.512), (.259, .046, 1.280), (.294, .142, 1.152)),
        ((-.159, 0, 1.512), (-.262, .028, 1.292), (-.321, .179, 1.337)),
    ]:
        upper, lower, wrist, weapon = articulation.limb(shoulder, elbow, hand)
        articulation.parent_keep_world(upper, torso)
        before = set(H.meshes())
        pieces = [ellipsoid('Claire softly shaped feminine shoulder', shoulder,
                            (.052, .058, .052), p['skin'], 12, 7),
                  rod('Claire slender natural upper arm', shoulder, elbow,
                      .043, p['skin'], 12, end=.035)]
        H.fuse(pieces, 'Claire continuous graceful upper arm', p['skin'], 430, .007)
        sleeve = Vector(shoulder).lerp(Vector(elbow), .21)
        rod('Claire ivory folded off shoulder satin sleeve',
            Vector(shoulder).lerp(Vector(elbow), .04),
            Vector(shoulder).lerp(Vector(elbow), .29), .056, p['cream'], 12, end=.047)
        rod('Claire sleeve delicate gold border', sleeve,
            Vector(shoulder).lerp(Vector(elbow), .26), .050, p['gold'], 12)
        articulation.attach(set(H.meshes()) - before, upper)
        before = set(H.meshes())
        H.fuse([ellipsoid('Claire natural elbow', elbow, (.036, .037, .038), p['skin'], 10, 6),
                rod('Claire slim natural forearm', elbow, hand, .034, p['skin'], 12, end=.023)],
               'Claire continuous slender forearm', p['skin'], 330, .006)
        rod('Claire fine engraved gold bracelet',
            Vector(elbow).lerp(Vector(hand), .89),
            Vector(elbow).lerp(Vector(hand), .96), .027, p['gold'], 12)
        articulation.attach(set(H.meshes()) - before, lower)
        before = set(H.meshes())
        palm = ellipsoid('Claire small relaxed human palm', hand,
                         (.033, .027, .040), p['skin'], 12, 7)
        for offset in (-.019, -.006, .006, .019):
            rod('Claire fine natural hand finger',
                (hand[0] - .023, hand[1] + .015, hand[2] + offset),
                (hand[0] + .020, hand[1] + .024, hand[2] + offset),
                .0052, p['skin'], 6)
        articulation.attach(set(H.meshes()) - before, wrist)
        if shoulder[0] > 0:
            before = set(H.meshes())
            x, y = hand[:2]
            rod('Claire slender royal gold magic staff', (x, y, .202),
                (x, y, 2.005), .014, p['gold'], 12)
            for z in (.34, .83, 1.165, 1.845):
                cylinder('Claire staff ornamental gold collar', (x, y, z), .021, .033, p['goldlight'], 10)
            for side in (-1, 1):
                H.arc('Claire gilded staff lotus focus cradle', [(x, y, 1.920),
                      (x + side * .063, y, 1.974),
                      (x + side * .058, y, 2.067), (x, y, 2.102)],
                      .0085, p['gold'], 7)
            ellipsoid('Claire luminous amber staff focus', (x, y, 2.025),
                      (.038, .038, .061), p['amber'], 12, 7)
            articulation.attach(set(H.meshes()) - before, weapon)
            articulation.pivot('staff_tip', (x, y, 2.025), weapon)
            articulation.pivot('attack_muzzle', (x, y, 2.025), weapon)

    # Exactly three independently editable orb pivots, separate from the face,
    # crown, staff and body.  Their radius remains the established runtime .46.
    for index, (position, color) in enumerate([
        ((.460, -.040, 1.520), 'f1d397'),
        ((-.445, .100, 1.587), 'f8e9bc'),
        ((-.095, -.450, 1.823), 'ffd577'),
    ]):
        before = set(H.meshes())
        material = mat('Claire radiant separate magic orb ' + str(index), color, .12, 1.65)
        ellipsoid('Claire separate magic orb ' + str(index), position,
                  (.054, .054, .054), material, 12, 7)
        ring = torus('Claire separate orb gold orbital ring ' + str(index),
                     position, .071, .005, p['goldlight'])
        ring.rotation_euler = (.75, .33, index * .65)
        orb = H.pivot('secret_orb_' + str(index), position, set(H.meshes()) - before)
        orb['secretOrbIndex'] = index
        orb['orbitRadius'] = .46
    # Bound this redesign independently of the mounted champion's larger
    # allowance.  Small eyes, lips, crown details and fingers retain topology;
    # only the larger cloth/anatomy surfaces receive silhouette retopology.
    cohesive.budget_meshes(9650)
    return p
