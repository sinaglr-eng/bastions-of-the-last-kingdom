"""Kushek: an inactive human craftswoman design reserved for future use.

Only her undershirt and the standard pedestal inlay use the rank color. Black
overalls, rubber boots, blonde ponytail and green eyes retain one identity.
The live runebreaker family uses Engineer again. The preserved scene is
blender/scenes/kushek_design_v1.blend, and the six exports and portraits are
public/assets/designs/kushek/. This module is intentionally not dispatched by
author_army.basic; it remains available for a future Kushek role.
"""
import math
import bpy


def _fuse(a, parts, name, material, budget=650, voxel=.014):
    return a.A.cohesive.fuse(parts, name, voxel, budget, material)


def _arm(a, p, shoulder, elbow, hand):
    upper, lower, wrist, weapon = a.articulation.limb(shoulder, elbow, hand)
    sleeve = [
        a.ellipsoid('Kushek rounded shirt shoulder', shoulder, (.122, .125, .128), p['cloth'], 14, 7),
        a.rod('Kushek short shirt sleeve', shoulder,
              tuple(shoulder[i]*.47+elbow[i]*.53 for i in range(3)),
              .092, p['cloth'], 12, end=.087),
    ]
    sleeve = _fuse(a, sleeve, 'Kushek continuous short sleeve', p['cloth'], 420)
    a.articulation.attach([sleeve], upper)
    mid = tuple(shoulder[i]*.40+elbow[i]*.60 for i in range(3))
    exposed = [a.rod('Kushek exposed upper arm', mid, elbow, .065, p['skin'], 12),
               a.ellipsoid('Kushek smooth elbow', elbow, (.067, .066, .068), p['skin'], 12, 6)]
    exposed = _fuse(a, exposed, 'Kushek upper arm anatomy', p['skin'], 330)
    a.articulation.attach([exposed], upper)
    forearm = a.rod('Kushek bare forearm', elbow, hand, .069, p['skin'], 14, end=.052)
    for face in forearm.data.polygons:
        if len(face.vertices) == 4: face.use_smooth = True
    a.articulation.attach([forearm], lower)
    grip = [a.ellipsoid('Kushek shaped hand', hand, (.068, .059, .073), p['skin'], 14, 7),
            a.ellipsoid('Kushek gripping thumb', (hand[0]-.043, hand[1]+.043, hand[2]+.015),
                        (.032, .036, .039), p['skin'], 10, 5)]
    hand_mesh = _fuse(a, grip, 'Kushek continuous gripping hand', p['skin'], 360, .010)
    a.articulation.attach([hand_mesh], wrist)
    fingers = []
    for offset in (-.030, -.009, .012, .033):
        fingers.append(a.rod('Kushek curled finger', (hand[0]-.039, hand[1]+.045, hand[2]+offset),
                            (hand[0]+.025, hand[1]+.049, hand[2]+offset), .010, p['skin'], 6))
    a.articulation.attach(fingers, wrist)
    return weapon


def build(rank, a):
    p = {
        'cloth': a.mat('Rank_%s_Kushek cotton undershirt' % rank, a.A.COLORS[rank-1]),
        'black': a.mat('Kushek black canvas overalls', '202326'),
        'rubber': a.mat('Kushek black rubber wellingtons', '242b2b'),
        'sole': a.mat('Kushek boot tread rubber', '161c1c'),
        'skin': a.mat('Kushek warm human skin', 'e9b699'),
        'hair': a.mat('Kushek blonde hair', 'd8b865'),
        'hairlight': a.mat('Kushek blonde hair highlights', 'f0d38a'),
        'eyewhite': a.mat('Kushek warm eye whites', 'f9f3e4'),
        'green': a.mat('Kushek green eyes', '388956'),
        'pupil': a.mat('Kushek eye pupils', '142722'),
        'lip': a.mat('Kushek natural lips', 'a36560'),
        'trim': a.mat('Kushek brass overall buckles', 'c6a86a', .6),
        'steel': a.mat('Kushek polished hammer steel', 'b4c1c3', .7),
        'wood': a.mat('Kushek hammer ash handle', '967354'),
        'ivory': a.mat('Kushek ivory carpenter ruler', 'eee6ca'),
        'dark': a.mat('Kushek ruler ink', '343c3c'),
    }
    edge = a.mat('Kushek pedestal cut stone sides', '66766b')
    stone = a.mat('Kushek pedestal weathered limestone', 'adb4a0')
    a.cylinder('Kushek octagonal footing', (0, 0, .055), .44, .11, edge, 8)
    a.cylinder('Kushek beveled stone top', (0, 0, .125), .415, .07, stone, 8, top=.385)
    a.torus('Kushek rank inlay', (0, 0, .166), .353, .013, p['cloth'])

    # Taller human proportions replace the dwarf; the planted boots are practical rubber wellies.
    for side, y in ((-1, .035), (1, -.027)):
        x = side*.128
        sole = a.cube('Kushek wellington tread sole', (x, y+.065, .211), (.198, .31, .071), p['sole'], .028)
        boot = [a.ellipsoid('Kushek rubber boot toe', (x, y+.087, .27), (.103, .158, .082), p['rubber'], 14, 7),
                a.rod('Kushek rubber boot shaft', (x, y, .28), (x, y, .58),
                      .092, p['rubber'], 14, end=.087)]
        _fuse(a, boot, 'Kushek seamless rubber wellington', p['rubber'], 620, .012)
        a.cylinder('Kushek rolled rubber boot top', (x, y, .583), .095, .032, p['rubber'], 14)
        for groove in range(3):
            a.cube('Kushek toe grip tread', (x, y+.205-groove*.032, .186),
                   (.166, .018, .014), p['sole'], .003)
    trousers = [a.ellipsoid('Kushek overall fitted hips', (0, 0, .91), (.205, .152, .17), p['black'], 16, 8)]
    for side, y in ((-1, .035), (1, -.027)):
        trousers.append(a.rod('Kushek canvas trouser leg', (side*.128, y, .58),
                              (side*.107, 0, .94), .076, p['black'], 14, end=.108))
    _fuse(a, trousers, 'Kushek continuous black overall trousers', p['black'], 1100, .017)
    shirt = [a.ellipsoid('Kushek fitted cotton shirt body', (0, .002, 1.183), (.228, .162, .249), p['cloth'], 18, 9),
             a.cylinder('Kushek cotton shirt lower hem', (0, 0, 1.016), .194, .08, p['cloth'], 14, top=.18)]
    _fuse(a, shirt, 'Kushek seamless fitted rank shirt', p['cloth'], 1000, .015)
    # The charcoal bib, black straps and black pocket do not recolor with rank.
    a.cube('Kushek black overall front bib', (0, .158, 1.164), (.264, .054, .306), p['black'], .035)
    a.cube('Kushek black overall back bib', (0, -.143, 1.165), (.277, .044, .291), p['black'], .026)
    for side in (-1, 1):
        x = side*.117
        points = [(x, .173, 1.272), (x, .134, 1.366), (x, -.063, 1.393), (x, -.153, 1.276)]
        for first, second in zip(points, points[1:]):
            a.rod('Kushek black canvas overall strap', first, second, .021, p['black'], 8)
        a.cube('Kushek brass overall strap buckle', (x, .199, 1.266), (.038, .012, .042), p['trim'], .006)
        a.cube('Kushek buckle black inset', (x, .207, 1.27), (.017, .007, .022), p['black'], .003)
    a.cube('Kushek bib chest pocket', (0, .196, 1.175), (.148, .024, .094), p['black'], .016)
    a.rod('Kushek pocket topstitch', (-.065, .212, 1.217), (.065, .212, 1.217), .004, p['dark'], 5)
    for side in (-1, 1):
        a.cube('Kushek overall side pocket', (side*.186, .059, .94), (.052, .114, .129), p['black'], .015)
        a.ellipsoid('Kushek overall side brass button', (side*.198, .113, .994), (.013, .010, .013), p['trim'], 8, 4)

    # Sculpt the head and neck into one skin surface; eyebrows/eyes retain detailed geometry.
    face = [a.rod('Kushek human neck', (0, .012, 1.373), (0, .012, 1.545), .066, p['skin'], 14),
            a.ellipsoid('Kushek oval human head', (0, .018, 1.686), (.156, .128, .201), p['skin'], 20, 10),
            a.ellipsoid('Kushek soft jaw', (0, .067, 1.590), (.118, .096, .094), p['skin'], 16, 8),
            a.ellipsoid('Kushek cheek contours', (0, .113, 1.654), (.127, .041, .099), p['skin'], 16, 8),
            a.ellipsoid('Kushek small nose', (0, .163, 1.674), (.027, .034, .038), p['skin'], 12, 6)]
    for side in (-1, 1):
        face.append(a.ellipsoid('Kushek human ear', (side*.153, .018, 1.683), (.022, .027, .041), p['skin'], 12, 6))
    _fuse(a, face, 'Kushek sculpted human face and neck', p['skin'], 1500, .009)
    for side in (-1, 1):
        x = side*.059
        a.ellipsoid('Kushek eye white', (x, .144, 1.716), (.041, .015, .025), p['eyewhite'], 14, 7)
        a.ellipsoid('Kushek green iris', (x-side*.002, .158, 1.716), (.017, .007, .019), p['green'], 12, 6)
        a.ellipsoid('Kushek dark eye pupil', (x-side*.002, .165, 1.716), (.008, .0038, .012), p['pupil'], 10, 5)
        a.ellipsoid('Kushek eye catchlight', (x-.004, .169, 1.723), (.0035, .002, .004), p['eyewhite'], 8, 4)
        a.rod('Kushek blonde expressive eyebrow', (x-side*.033, .157, 1.751),
              (x+side*.033, .147, 1.752), .008, p['hair'], 7)
    a.rod('Kushek gentle natural smile', (-.031, .156, 1.595), (.031, .156, 1.595), .006, p['lip'], 7)
    # A swept cap and long gathered ponytail make the new silhouette recognizable from behind.
    hair = [a.ellipsoid('Kushek blonde swept hair cap', (0, -.019, 1.818), (.164, .129, .089), p['hair'], 18, 9),
            a.ellipsoid('Kushek blonde swept back hair', (0, -.077, 1.749), (.148, .085, .148), p['hair'], 16, 8),
            a.rod('Kushek swept blonde fringe', (-.119, .082, 1.836), (.08, .111, 1.819), .038, p['hair'], 12, end=.019)]
    _fuse(a, hair, 'Kushek continuous blonde swept hair', p['hair'], 900, .012)
    ponytail = [a.ellipsoid('Kushek gathered ponytail root', (0, -.166, 1.814), (.065, .068, .064), p['hair'], 14, 7),
                a.rod('Kushek long blonde ponytail upper', (0, -.19, 1.80), (.07, -.268, 1.614), .064, p['hair'], 14, end=.049),
                a.rod('Kushek long blonde ponytail curl', (.07, -.268, 1.614), (.035, -.305, 1.466), .052, p['hair'], 14, end=.018)]
    _fuse(a, ponytail, 'Kushek flowing blonde ponytail', p['hair'], 760, .011)
    tie = a.torus('Kushek black ponytail tie', (0, -.178, 1.806), .054, .009, p['black'])
    tie.rotation_euler[0] = math.pi/2
    for side in (-1, 1):
        a.rod('Kushek blonde hair strand highlight', (side*.082, -.085, 1.867),
              (side*.114, -.109, 1.771), .006, p['hairlight'], 6)

    right = _arm(a, p, (.221, 0, 1.351), (.326, .071, 1.168), (.387, .18, 1.069))
    left = _arm(a, p, (-.221, 0, 1.351), (-.31, .10, 1.188), (-.35, .241, 1.129))
    before = set(a.meshes())
    a.rod('Kushek carpenter hammer ash handle', (.387, .18, .839), (.387, .18, 1.378), .026, p['wood'], 12)
    a.cube('Kushek one-handed claw hammer head', (.387, .18, 1.375), (.255, .114, .121), p['steel'], .021)
    a.cube('Kushek hammer striking face', (.521, .18, 1.378), (.025, .123, .126), p['steel'], .008)
    for side in (-1, 1):
        a.rod('Kushek claw hammer fork', (.274, .18+side*.032, 1.364),
              (.229, .18+side*.048, 1.412), .018, p['steel'], 8, end=.01)
    for z in (.975, 1.024, 1.073):
        a.cylinder('Kushek hammer handle grip ridge', (.387, .18, z), .028, .012, p['black'], 12)
    a.articulation.attach(set(a.meshes())-before, right)
    before = set(a.meshes())
    a.cube('Kushek measuring ruler held in left hand', (-.35, .26, 1.169), (.075, .034, .62), p['ivory'], .007)
    for index in range(12):
        z = .885+index*.049
        length = .051 if index % 5 == 0 else .024
        a.rod('Kushek measuring ruler graduation', (-.382, .280, z),
              (-.382+length, .280, z), .0035, p['dark'], 4)
    a.cube('Kushek measuring ruler brass end', (-.35, .26, 1.479), (.079, .037, .022), p['trim'], .004)
    a.articulation.attach(set(a.meshes())-before, left)
    bpy.context.scene['Defender'] = 'Kushek'
    bpy.context.scene['DesignRevision'] = 7
    bpy.context.scene['Identity'] = 'Human woman, blonde ponytail, green eyes, black overalls and rubber wellington boots'
    bpy.context.scene['RankColor'] = 'Cotton undershirt and standard pedestal inlay only'
    return p
