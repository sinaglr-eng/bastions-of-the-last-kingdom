"""Original v6 siege engines and construct champions, authored in Blender.

Builders use +Y as the firing/front direction and Z as up.  Every design has its
own silhouette and equipment; none derives from the former siege/elemental mesh.
The catapult's complete throwing assembly is parented to the siege_arm pivot.
"""
import math
import bpy
from mathutils import Vector


FAMILIES = {
    'highking', 'kingsreach', 'stonewarden', 'royalarsenal', 'fireballista',
    'winterhold', 'emeraldgolem', 'mechanicalgolem',
}


def _palette(a, identity):
    colors = {
        'highking': ('384a71', 'ead49a', '726651', '8596ac'),
        'kingsreach': ('704e31', 'b79759', '543b2d', '657173'),
        'stonewarden': ('825837', 'aa9470', '543925', '596164'),
        'royalarsenal': ('263c50', 'b2d6e5', '465263', '809bac'),
        'fireballista': ('4f302c', 'e2aa4e', '5e3523', '706969'),
        'winterhold': ('9adce9', 'e2f5f4', '5997b2', 'bfddeb'),
        'emeraldgolem': ('72817b', 'c0c7ad', '475a51', '839288'),
        'mechanicalgolem': ('b97846', 'd9b866', '57463b', '647881'),
    }
    body, trim, wood, steel = colors[identity]
    return {
        'body': a.mat(identity + ' signature', body, .25 if identity != 'emeraldgolem' else 0),
        'trim': a.mat(identity + ' crafted trim', trim, .65),
        'wood': a.mat(identity + ' structural wood', wood),
        'steel': a.mat(identity + ' forged steel', steel, .72),
        'dark': a.mat(identity + ' deep seams', '252c30', .2),
        'rope': a.mat(identity + ' braided hemp', 'baa886'),
        'leather': a.mat(identity + ' bound leather', '563c30'),
        'stone': a.mat(identity + ' limestone pedestal', 'a0ac98'),
        'edge': a.mat(identity + ' pedestal sides', '61746b'),
        'light': a.mat(identity + ' enchanted light', {
            'highking': '72c6ef', 'kingsreach': 'e6d1a3',
            'stonewarden': 'ccb5a1', 'royalarsenal': '86e1fa',
            'fireballista': 'ff9c36', 'winterhold': '96e7ff',
            'emeraldgolem': '63d293', 'mechanicalgolem': 'e8b655',
        }[identity], .1, .7),
    }


def _base(a, p, radius=.61):
    a.cylinder('Construct cut stone footing', (0, 0, .055), radius, .11, p['edge'], 12)
    a.cylinder('Construct beveled limestone top', (0, 0, .119), radius*.955, .055,
               p['stone'], 12, top=radius*.905)


def _wheel(a, p, x, y, radius=.245):
    z = .145 + radius
    rim = a.cylinder('Spoked wheel iron rim', (x, y, z), radius, .105, p['steel'], 14)
    rim.rotation_euler[1] = math.pi/2
    disc = a.cylinder('Inset wooden wheel face', (x + math.copysign(.056, x), y, z),
                      radius*.80, .016, p['wood'], 12)
    disc.rotation_euler[1] = math.pi/2
    exposed = x + math.copysign(.067, x)
    for index in range(6):
        angle = index*math.tau/6
        a.rod('Radial wheel spoke', (exposed, y, z),
              (exposed, y+math.sin(angle)*radius*.82,
               z+math.cos(angle)*radius*.82), .024, p['trim'], 5)
    hub = a.cylinder('Wheel axle pin', (exposed + math.copysign(.006, x), y, z),
                     .055, .038, p['steel'], 10)
    hub.rotation_euler[1] = math.pi/2


def _chassis(a, p, wheels=True, length=1.03):
    _base(a, p, .66)
    if wheels:
        for x in (-.49, .49):
            for y in (-.34, .34):
                _wheel(a, p, x, y)
        for y in (-.34, .34):
            a.rod('Chassis spanning axle', (-.56, y, .39), (.56, y, .39),
                  .04, p['steel'], 8)
    for x in (-.32, .32):
        a.cube('Solid chassis side rail', (x, 0, .49), (.105, length, .13), p['wood'], .023)
    for y in (-length*.39, 0, length*.39):
        a.cube('Chassis cross tie', (0, y, .505), (.77, .095, .1), p['wood'], .018)
    for x in (-.19, -.065, .065, .19):
        a.cube('Continuous fitted deck plank', (x, 0, .576), (.123, length*.91, .065), p['wood'], .008)
    for x in (-.31, .31):
        for y in (-length*.37, length*.37):
            a.cube('Riveted corner shoe', (x, y, .57), (.123, .13, .04), p['steel'], .007)
            a.ellipsoid('Chassis fastening stud', (x, y, .599), (.018, .018, .012), p['trim'], 6, 3)


def _handwheel(a, p, pos, radius=.13):
    wheel = a.torus('Aiming crank handwheel', pos, radius, .018, p['steel'])
    wheel.rotation_euler[1] = math.pi/2
    for index in range(3):
        angle = math.tau*index/3
        a.rod('Handwheel radial brace', pos,
              (pos[0], pos[1]+math.cos(angle)*radius, pos[2]+math.sin(angle)*radius),
              .014, p['trim'], 5)
    a.rod('Crank brass grip', (pos[0], pos[1]+radius, pos[2]),
          (pos[0]+.1, pos[1]+radius, pos[2]), .026, p['wood'], 8)


def _bow(a, p, z, forward=.36, spread=.65, royal=False, fiery=False):
    """A solid recurve bow with an actual drawn V string and a long bolt rail."""
    material = p['steel'] if royal else p['wood']
    for side in (-1, 1):
        points = [
            (side*.04, forward, z), (side*.24, forward+.12, z+.028),
            (side*.43, forward+.09, z+.05), (side*spread, forward-.05, z+.08),
        ]
        for first, second in zip(points, points[1:]):
            a.rod('Laminated recurve bow stave', first, second, .057, material, 8, end=.041)
            a.rod('Bow inlaid tension band', (first[0], first[1]+.018, first[2]+.052),
                  (second[0], second[1]+.018, second[2]+.045),
                  .011, p['light'] if fiery else p['trim'], 5)
        a.rod('Drawn braided bowstring', points[-1], (0, -.37, z+.012), .009, p['rope'], 5)
        a.ellipsoid('Bound bow end cap', points[-1], (.066, .052, .058), p['trim'], 8, 4)
    a.cube('Bolt guide stock', (0, .025, z-.095), (.17, .93, .125), p['wood'], .018)
    for x in (-.07, .07):
        a.rod('Polished bolt guide rail', (x, -.44, z-.013), (x, .6, z+.032),
              .015, p['steel'], 6)
    a.rod('Loaded oversized bolt shaft', (0, -.37, z+.032), (0, .83, z+.075),
          .023, p['light'] if fiery else p['wood'], 8)
    arrow = a.cylinder('Broadhead siege bolt', (0, .876, z+.078), .083, .16,
                       p['light'] if fiery else p['steel'], 4, top=0)
    arrow.rotation_euler[0] = -math.pi/2
    for side in (-1, 1):
        a.custom('Siege bolt stabilizing vane', [
            (side*.008, -.38, z+.04), (side*.095, -.43, z+.105),
            (side*.095, -.25, z+.098), (side*.008, -.18, z+.04),
        ], [(0, 1, 2, 3)], p['trim'])


def _arbalest(a, p):
    _chassis(a, p, length=1.10)
    a.cylinder('Royal rotating aiming pedestal', (0, -.05, .75), .18, .29, p['steel'], 12)
    a.cylinder('Royal pedestal gold collar', (0, -.05, .85), .197, .065, p['trim'], 12)
    for x in (-.22, .22):
        a.cube('Elevated arbalest cheek', (x, -.05, 1.015), (.095, .48, .38), p['body'], .027)
        a.rod('Regal cheek gilt spine', (x, -.28, 1.16), (x, .14, 1.19), .018, p['trim'], 6)
    _bow(a, p, 1.25, .39, .66, royal=True)
    a.cube('Kingslayer front shield plate', (0, .49, 1.028), (.45, .067, .3), p['body'], .025)
    for side in (-1, 1):
        a.rod('Swept gilt shield border', (side*.205, .536, 1.16),
              (side*.16, .536, .887), .024, p['trim'], 7)
    # A crown-shaped load-bearing rear gantry marks this as a royal heavy weapon.
    for x in (-.28, .28):
        a.rod('Crown gantry upright', (x, -.36, .67), (x, -.36, 1.52), .046, p['steel'], 8)
        a.rod('Crown gantry diagonal', (x, .22, .66), (x, -.36, 1.33), .029, p['trim'], 6)
    a.rod('Crown gantry top arch', (-.28, -.36, 1.52), (0, -.36, 1.64), .043, p['trim'], 8)
    a.rod('Crown gantry top arch', (0, -.36, 1.64), (.28, -.36, 1.52), .043, p['trim'], 8)
    for x, height in ((-.21, .13), (0, .24), (.21, .13)):
        a.cylinder('Royal three-point crown', (x, -.36, 1.58+height*.5), .044, height,
                   p['trim'], 5, top=0)
    _handwheel(a, p, (.32, -.10, 1.02))
    a.ellipsoid('Kingslayer central seal', (0, .539, 1.055), (.067, .025, .09), p['trim'], 10, 5)
    a.ellipsoid('Royal aiming focus', (0, .565, 1.055), (.026, .009, .052), p['light'], 8, 4)


def _ballista(a, p, fiery=False):
    _chassis(a, p)
    for x in (-.25, .25):
        a.rod('Ballista triangular upright', (x, -.31, .60), (x, .06, 1.04), .049, p['wood'], 6)
        a.rod('Ballista triangular front leg', (x, .34, .60), (x, .06, 1.04), .049, p['wood'], 6)
        a.cylinder('Vertical torsion rope bundle', (x, .34, 1.005), .09, .35, p['rope'], 12)
        for z in (.84, 1.17):
            a.cylinder('Torsion bundle metal clamp', (x, .34, z), .112, .048, p['steel'], 10)
        for offset in (-.045, 0, .045):
            a.rod('Braided torsion strand', (x+offset, .415, .88),
                  (x+offset*.72, .415, 1.135), .01, p['trim'], 5)
    _bow(a, p, 1.10, .37, .62, fiery=fiery)
    a.rod('Elevation threaded jack', (0, -.27, .61), (0, -.27, .97), .035, p['steel'], 8)
    for z in (.69, .74, .79, .84, .89):
        a.cylinder('Aiming screw thread', (0, -.27, z), .052, .024, p['trim'], 8)
    _handwheel(a, p, (.36, -.26, .84), .105)
    if fiery:
        # A flame-retort and forked copper channels, not a cannon with a new color.
        a.cylinder('Ember retort chamber', (0, -.33, 1.40), .15, .36, p['steel'], 10)
        a.cylinder('Ember retort flared chimney', (0, -.33, 1.61), .11, .105,
                   p['trim'], 10, top=.155)
        a.ellipsoid('Incandescent retort coal', (0, -.33, 1.67), (.075, .075, .095), p['light'], 10, 5)
        for side in (-1, 1):
            points = [(side*.07, -.33, 1.35), (side*.2, -.13, 1.19),
                      (side*.28, .31, 1.21), (side*.51, .44, 1.20)]
            for first, second in zip(points, points[1:]):
                a.rod('Copper fire transmission channel', first, second, .024, p['trim'], 7)
            a.cylinder('Forward ember brazier', (side*.25, .34, 1.24), .07, .11,
                       p['steel'], 8, top=.10)
            a.cylinder('Living ember flame', (side*.25, .34, 1.34), .061, .19,
                       p['light'], 6, top=0)
        for x in (-.13, .13):
            a.cube('Heat shield side plate', (x, -.31, 1.385), (.07, .30, .24), p['body'], .018)
    else:
        a.rod('Ballista range pennant pole', (-.34, -.38, .62), (-.34, -.38, 1.72),
              .018, p['steel'], 7)
        a.custom('Hardwood weapon range pennant', [
            (-.34, -.38, 1.65), (-.34, -.38, 1.42), (-.06, -.38, 1.42),
            (-.14, -.38, 1.54), (-.06, -.38, 1.65),
        ], [(0, 1, 2, 3, 4)], p['body'])
        for x in (-.28, -.21):
            a.rod('Range pennant stitching', (x, -.369, 1.46), (x, -.369, 1.61), .008, p['trim'], 4)


def _catapult(a, p):
    _chassis(a, p, length=1.14)
    for side in (-1, 1):
        x = side*.29
        a.cube('Catapult squared oak upright', (x, .035, .945), (.11, .13, .70), p['wood'], .018)
        for y in (-.43, .43):
            a.rod('Catapult diagonal structural brace', (x, y, .61), (x, .035, 1.15),
                  .047, p['wood'], 6)
        a.cube('Upright riveted iron plate', (x, .113, 1.065), (.122, .037, .21), p['steel'], .007)
        for z in (.995, 1.14):
            a.ellipsoid('Upright brass bolt', (x, .14, z), (.02, .012, .02), p['trim'], 6, 3)
    axle = (0, .035, 1.12)
    a.rod('Catapult iron throwing axle', (-.39, axle[1], axle[2]), (.39, axle[1], axle[2]),
          .073, p['steel'], 12)
    for x in (-.15, .15):
        bundle = a.cylinder('Catapult twisted torsion bundle', (x, axle[1], axle[2]),
                            .117, .16, p['rope'], 12)
        bundle.rotation_euler[1] = math.pi/2
        for offset in (-.07, 0, .07):
            a.rod('Torsion wrapping strand', (x-.065, axle[1]+offset, axle[2]+.09),
                  (x+.065, axle[1]+offset*.5, axle[2]+.1), .013, p['trim'], 5)
    a.rod('Impact stop crossbar', (-.34, .27, 1.285), (.34, .27, 1.285), .045, p['steel'], 8)
    a.rod('Rear winding spool axle', (-.38, -.37, .70), (.38, -.37, .70), .035, p['steel'], 8)
    drum = a.cylinder('Catapult winding spool', (0, -.37, .70), .086, .37, p['wood'], 10)
    drum.rotation_euler[1] = math.pi/2
    _handwheel(a, p, (.40, -.37, .70))
    a.rod('Crank wound draw rope', (0, -.37, .78), (0, -.30, 1.29), .009, p['rope'], 5)
    before = set(bpy.context.scene.objects)
    a.rod('Catapult continuous oak throwing beam', (0, .34, .83), (0, -.57, 1.77),
          .069, p['wood'], 8, end=.045)
    for t in (.32, .62, .85):
        point = Vector((0, .34, .83)).lerp(Vector((0, -.57, 1.77)), t)
        a.ellipsoid('Throwing beam metal collar', point, (.074, .073, .050), p['steel'], 8, 4)
    a.ellipsoid('Catapult hanging leather sling', (0, -.63, 1.655),
                (.20, .17, .074), p['leather'], 12, 5)
    stone = a.ellipsoid('Catapult ready slung boulder', (0, -.63, 1.768),
                       (.163, .147, .145), p['stone'], 10, 5)
    # Deliberate sculpting gives the projectile an irregular rock silhouette.
    for vertex in stone.data.vertices:
        vertex.co *= 1 + .065*math.sin(vertex.index*2.41)
    for side in (-1, 1):
        a.rod('Catapult sling suspension cord', (0, -.57, 1.80),
              (side*.18, -.65, 1.69), .014, p['rope'], 6)
        a.rod('Leather sling reinforced lip', (side*.17, -.54, 1.685),
              (side*.17, -.72, 1.685), .015, p['leather'], 6)
    a.ellipsoid('Throwing beam counterweight', (0, .32, .846), (.14, .115, .15), p['steel'], 10, 5)
    moving = set(bpy.context.scene.objects) - before
    pivot = bpy.data.objects.new('siege_arm', None)
    bpy.context.collection.objects.link(pivot)
    pivot.location = axle
    bpy.context.view_layer.update()
    for part in moving:
        world = part.matrix_world.copy()
        part.parent = pivot
        part.matrix_world = world


def _arsenal(a, p):
    _chassis(a, p, length=1.10)
    a.cylinder('Arsenal azimuth turret ring', (0, -.045, .69), .31, .18, p['steel'], 14)
    a.cylinder('Arsenal brass turret race', (0, -.045, .785), .324, .045, p['trim'], 14)
    a.cube('Arsenal three-barrel armored cradle', (0, -.04, .94), (.79, .64, .23), p['body'], .035)
    for x, z in ((-.25, 1.07), (0, 1.28), (.25, 1.07)):
        start, end = (x, -.32, z), (x, .69, z+.10)
        a.rod('Storm arsenal pressure barrel', start, end, .103, p['steel'], 12, end=.082)
        for t in (.19, .59, .92):
            point = Vector(start).lerp(Vector(end), t)
            a.rod('Barrel reinforced brass hoop', point, point+Vector((0, .047, .0047)),
                  .109-t*.02, p['trim'], 12)
        bore = a.cylinder('Storm arsenal dark muzzle bore', (x, .715, z+.102),
                          .061, .013, p['dark'], 12)
        bore.rotation_euler[0] = math.pi/2-.1
        for side in (-1, 1):
            a.rod('Storm barrel glowing conductor', (x+side*.079, -.20, z+.065),
                  (x+side*.065, .53, z+.14), .009, p['light'], 5)
    for x in (-.22, .22):
        a.cylinder('Arsenal alchemical pressure reservoir', (x, -.40, 1.27), .099, .46,
                   p['steel'], 10)
        for z in (1.09, 1.40):
            a.cylinder('Reservoir brass pressure collar', (x, -.40, z), .112, .034, p['trim'], 10)
        a.rod('Arsenal insulated power lead', (x, -.40, 1.48), (0, -.31, 1.61),
              .025, p['trim'], 7)
    a.cylinder('Storm reactor socket', (0, -.32, 1.48), .134, .14, p['steel'], 10)
    a.ellipsoid('Arsenal captured storm core', (0, -.32, 1.665), (.103, .103, .17), p['light'], 12, 7)
    for side in (-1, 1):
        a.rod('Storm core containment prong', (side*.10, -.32, 1.49),
              (side*.14, -.32, 1.78), .024, p['trim'], 7, end=.008)
    a.cube('Arsenal front armor shield', (0, .405, .91), (.73, .062, .27), p['body'], .024)
    for x in (-.28, 0, .28):
        a.rod('Royal arsenal shield brass rib', (x, .445, .81),
              (x, .445, 1.02), .016, p['trim'], 6)
    _handwheel(a, p, (.42, -.10, 1.015), .11)


def _ice_colossus(a, p):
    _base(a, p, .59)
    body = []
    # Long sweeping proportions differ from the stocky rock and articulated metal constructs.
    for side in (-1, 1):
        body.append(a.ellipsoid('Ice giant swept foot', (side*.17, .095, .252),
                                (.16, .255, .12), p['body'], 12, 6))
        body.append(a.rod('Ice giant continuous calf', (side*.17, -.025, .32),
                          (side*.19, -.03, .78), .14, p['body'], 12, end=.12))
        body.append(a.rod('Ice giant sloping thigh', (side*.19, -.03, .78),
                          (side*.13, 0, 1.11), .16, p['body'], 12, end=.19))
    body.append(a.ellipsoid('Ice giant sculpted pelvis', (0, 0, 1.07), (.30, .18, .235), p['body'], 16, 8))
    body.append(a.ellipsoid('Ice giant tapered chest', (0, 0, 1.37), (.355, .205, .31), p['body'], 16, 8))
    body.append(a.rod('Ice giant broad neck', (0, 0, 1.56), (0, .014, 1.74), .15, p['body'], 12))
    body.append(a.ellipsoid('Ice giant stern head', (0, .016, 1.83), (.178, .154, .213), p['body'], 16, 8))
    body.append(a.ellipsoid('Ice giant cheek and chin', (0, .118, 1.745), (.149, .076, .095), p['body'], 12, 6))
    body.append(a.ellipsoid('Ice giant nose ridge', (0, .165, 1.84), (.032, .045, .074), p['body'], 10, 5))
    for side in (-1, 1):
        body.append(a.ellipsoid('Ice giant connected shoulder', (side*.33, -.01, 1.52),
                                (.20, .195, .18), p['body'], 12, 6))
        body.append(a.rod('Ice giant curved upper arm', (side*.38, 0, 1.49),
                          (side*.48, .055, 1.15), .13, p['body'], 12, end=.105))
        body.append(a.rod('Ice giant curved forearm', (side*.48, .055, 1.15),
                          (side*.43, .165, .93), .13, p['body'], 12, end=.10))
        body.append(a.ellipsoid('Ice giant clenched hand', (side*.43, .17, .9),
                                (.133, .10, .14), p['body'], 12, 6))
    a.A.cohesive.fuse(body, 'Unified flowing glacial giant anatomy', .026, 2700, p['body'])
    for side in (-1, 1):
        a.rod('Ice giant luminous stern eye', (side*.042, .16, 1.875),
              (side*.111, .145, 1.883), .014, p['light'], 6)
        a.rod('Ice giant eyebrow ledge', (side*.035, .178, 1.92),
              (side*.126, .14, 1.91), .029, p['trim'], 7)
        for dx in (-.075, .075):
            a.cylinder('Ice shoulder projecting shard', (side*.36+dx, -.04, 1.67),
                       .064, .27, p['steel'], 5, top=0)
        for z in (.43, .69):
            a.rod('Frozen leg internal vein', (side*.185, .117, z),
                  (side*.16, .139, z+.13), .013, p['light'], 5)
    for x, height in ((-.14, .10), (-.075, .16), (0, .22), (.075, .16), (.14, .10)):
        a.cylinder('Natural glacial crown spire', (x, .015, 1.98+height*.5),
                   .055, height, p['steel'], 5, top=0)
    a.custom('Ice giant breastplate glacial facet', [
        (-.20, .19, 1.50), (0, .235, 1.59), (.20, .19, 1.50),
        (.16, .20, 1.30), (0, .235, 1.21), (-.16, .20, 1.30),
    ], [(0, 1, 4, 5), (1, 2, 3, 4)], p['steel'])
    for points in [[(-.14, .244, 1.48), (0, .25, 1.38), (.11, .234, 1.43)],
                   [(0, .25, 1.38), (-.035, .252, 1.30), (0, .254, 1.26)]]:
        for first, second in zip(points, points[1:]):
            a.rod('Internal glowing frozen fissure', first, second, .012, p['light'], 5)


def _rock_golem(a, p):
    _base(a, p, .64)
    mass = []
    for side in (-1, 1):
        mass.append(a.ellipsoid('Runic stone broad foot', (side*.23, .08, .267),
                                (.20, .255, .14), p['body'], 10, 5))
        mass.append(a.rod('Runic stone supporting leg', (side*.23, 0, .31),
                          (side*.19, -.025, .82), .18, p['body'], 9, end=.21))
    mass.append(a.ellipsoid('Runic golem connected hips', (0, -.025, .84), (.38, .23, .23), p['body'], 12, 6))
    mass.append(a.ellipsoid('Runic golem monumental chest', (0, -.02, 1.22), (.405, .235, .39), p['body'], 14, 7))
    mass.append(a.rod('Runic golem short neck', (0, -.02, 1.43), (0, 0, 1.65), .165, p['body'], 10))
    mass.append(a.ellipsoid('Runic golem sculpted head', (0, .008, 1.75), (.205, .17, .23), p['body'], 12, 6))
    mass.append(a.ellipsoid('Runic golem strong jaw', (0, .13, 1.65), (.167, .085, .115), p['body'], 10, 5))
    for side in (-1, 1):
        mass.append(a.ellipsoid('Runic golem joined shoulder', (side*.37, -.01, 1.40),
                                (.23, .22, .235), p['body'], 10, 5))
        mass.append(a.rod('Runic golem stone upper arm', (side*.40, 0, 1.36),
                          (side*.47, .025, 1.06), .18, p['body'], 9, end=.16))
        mass.append(a.rod('Runic golem stone forearm', (side*.47, .025, 1.06),
                          (side*.46, .09, .72), .16, p['body'], 9, end=.20))
        mass.append(a.ellipsoid('Runic golem huge stone fist', (side*.46, .12, .72),
                                (.20, .18, .18), p['body'], 10, 5))
    body = a.A.cohesive.fuse(mass, 'Sculpted monolithic runic statue', .03, 2450, p['body'])
    # Low amplitude deformation makes this a carved natural rock, not spherical body pieces.
    for vertex in body.data.vertices:
        vertex.co += vertex.normal * (.009*math.sin(vertex.index*.173))
    moss = a.mat('Golem naturally weathered moss', '687950')
    for side in (-1, 1):
        a.ellipsoid('Golem moss on shoulder ledge', (side*.38, -.02, 1.58),
                    (.17, .145, .042), moss, 10, 5)
        a.rod('Golem ancient illuminated eye', (side*.045, .159, 1.80),
              (side*.124, .143, 1.80), .017, p['light'], 6)
        for index in range(3):
            x = side*.46 + (index-1)*.055
            a.rod('Golem carved fist finger groove', (x, .291, .64),
                  (x, .288, .77), .005, p['dark'], 4)
    a.ellipsoid('Golem deep carved chest seal', (0, .217, 1.24), (.136, .022, .158), p['dark'], 12, 6)
    a.ellipsoid('Golem heart emerald', (0, .244, 1.24), (.084, .032, .117), p['light'], 8, 4)
    rune = [(-.11, .256, 1.24), (0, .256, 1.37), (.11, .256, 1.24),
            (0, .256, 1.11), (-.11, .256, 1.24)]
    for first, second in zip(rune, rune[1:]):
        a.rod('Golem carved diamond rune border', first, second, .013, p['trim'], 5)
    for points in [[(.02, .203, 1.04), (.10, .21, .96), (.07, .20, .86)],
                   [(-.17, .206, 1.47), (-.22, .205, 1.33), (-.29, .175, 1.29)],
                   [(.17, .203, 1.52), (.12, .213, 1.45), (.17, .211, 1.38)]]:
        for first, second in zip(points, points[1:]):
            a.rod('Emerald light through ancient stone crack', first, second, .008, p['light'], 5)
    a.cube('Golem squared ancient forehead', (0, .145, 1.88), (.28, .055, .09), p['steel'], .017)


def _gear(a, p, center, radius=.12, axis='X', teeth=10):
    gear = a.cylinder('Exposed automaton brass gear', center, radius*.85, .048, p['trim'], teeth)
    if axis == 'X':
        gear.rotation_euler[1] = math.pi/2
    elif axis == 'Y':
        gear.rotation_euler[0] = math.pi/2
    for index in range(teeth):
        angle = index*math.tau/teeth
        if axis == 'X':
            pos = (center[0], center[1]+math.cos(angle)*radius*.9, center[2]+math.sin(angle)*radius*.9)
            size = (.05, .047, .047)
        else:
            pos = (center[0]+math.cos(angle)*radius*.9, center[1], center[2]+math.sin(angle)*radius*.9)
            size = (.047, .05, .047)
        a.cube('Machined gear tooth', pos, size, p['trim'], .004)


def _mechanical_golem(a, p):
    _base(a, p, .63)
    for side in (-1, 1):
        x = side*.205
        a.cube('Automaton broad articulated boot', (x, .08, .247), (.29, .35, .20), p['steel'], .037)
        a.cube('Automaton copper instep plate', (x, .21, .283), (.255, .105, .125), p['body'], .018)
        a.rod('Automaton cylindrical shin piston', (x, 0, .33), (x, 0, .67),
              .111, p['steel'], 12)
        a.cube('Automaton fitted shin armor', (x, .10, .48), (.18, .065, .26), p['body'], .023)
        a.ellipsoid('Automaton knee bearing', (x, 0, .72), (.126, .12, .12), p['dark'], 12, 6)
        _gear(a, p, (x+side*.116, 0, .72), .089, teeth=8)
        a.rod('Automaton thigh hydraulic cylinder', (x, 0, .76), (side*.13, 0, .97),
              .126, p['steel'], 12, end=.14)
        a.rod('Automaton exposed lower piston', (x+side*.082, -.075, .36),
              (x+side*.082, -.075, .63), .022, p['trim'], 7)
    a.cube('Automaton articulated hip casing', (0, 0, .963), (.49, .34, .19), p['body'], .046)
    a.cylinder('Automaton spine rotary bearing', (0, 0, 1.085), .185, .10, p['dark'], 12)
    torso = [a.ellipsoid('Automaton curved boiler torso', (0, -.015, 1.345),
                         (.315, .225, .30), p['body'], 16, 8),
             a.cube('Automaton frontal breast casing', (0, .147, 1.35),
                    (.40, .14, .34), p['body'], .05)]
    a.A.cohesive.fuse(torso, 'Continuous rounded copper boiler casing', .021, 1050, p['body'])
    a.cylinder('Automaton neck gimbal', (0, 0, 1.64), .08, .13, p['steel'], 12)
    head = [a.ellipsoid('Automaton shaped helmet shell', (0, .01, 1.785),
                        (.165, .145, .19), p['steel'], 14, 7),
            a.cube('Automaton fitted face shell', (0, .123, 1.762), (.237, .069, .22), p['steel'], .034)]
    a.A.cohesive.fuse(head, 'Continuous automaton helmet casing', .014, 650, p['steel'])
    a.cube('Automaton dark optical visor', (0, .173, 1.814), (.224, .017, .052), p['dark'], .009)
    for x in (-.066, .066):
        lens = a.cylinder('Automaton amber optical lens', (x, .188, 1.815), .026, .018, p['light'], 12)
        lens.rotation_euler[0] = math.pi/2
    for x in (-.07, -.035, 0, .035, .07):
        a.cube('Automaton lower face ventilation slot', (x, .165, 1.708),
               (.012, .013, .04), p['dark'], .003)
    for side in (-1, 1):
        a.ellipsoid('Automaton shoulder ball bearing', (side*.33, 0, 1.48),
                    (.13, .135, .14), p['dark'], 12, 6)
        a.ellipsoid('Automaton curved shoulder armor', (side*.35, 0, 1.555),
                    (.168, .163, .105), p['body'], 12, 6)
        a.rod('Automaton upper arm piston body', (side*.375, 0, 1.41),
              (side*.46, .055, 1.14), .088, p['steel'], 12)
        a.rod('Automaton upper arm hydraulic rod', (side*.42, -.088, 1.4),
              (side*.49, -.02, 1.15), .021, p['trim'], 7)
        _gear(a, p, (side*.485, .04, 1.14), .091, teeth=8)
        a.rod('Automaton forearm brass sleeve', (side*.45, .06, 1.09),
              (side*.43, .15, .91), .106, p['body'], 12, end=.094)
        a.cube('Automaton palm block', (side*.43, .17, .842), (.20, .14, .135), p['steel'], .022)
        for index in range(3):
            a.rod('Automaton articulated finger', (side*.43+(index-1)*.055, .225, .854),
                  (side*.43+(index-1)*.055, .248, .75), .019, p['trim'], 7)
        a.rod('Automaton gripping thumb', (side*.335, .16, .86),
              (side*.32, .245, .82), .025, p['trim'], 7)
        # Back-mounted alchemical packs connect to the boiler with copper feed pipes.
        a.cylinder('Automaton alchemy pressure pack', (side*.20, -.26, 1.30),
                   .077, .35, p['steel'], 10)
        for z in (1.16, 1.43):
            a.cylinder('Alchemy pack retaining brass ring', (side*.20, -.26, z), .084, .028, p['trim'], 10)
        a.rod('Alchemy pack curved feed pipe', (side*.20, -.26, 1.47),
              (side*.26, -.13, 1.54), .025, p['trim'], 7)
    chest = a.cylinder('Automaton front reactor iris', (0, .241, 1.367), .096, .025, p['trim'], 14)
    chest.rotation_euler[0] = math.pi/2
    glow = a.cylinder('Automaton alchemy heart light', (0, .259, 1.367), .065, .018, p['light'], 12)
    glow.rotation_euler[0] = math.pi/2
    for x in (-.16, .16):
        for z in (1.24, 1.47):
            a.ellipsoid('Copper casing flush rivet', (x, .213, z), (.017, .012, .017), p['trim'], 6, 3)
    a.cylinder('Automaton rear exhaust chimney', (.12, -.175, 1.735), .05, .40, p['steel'], 10)
    a.cylinder('Automaton flared chimney cap', (.12, -.175, 1.955), .083, .05, p['trim'], 10, top=.057)
    a.rod('Automaton chimney brass seam', (.16, -.145, 1.57), (.16, -.145, 1.90), .01, p['trim'], 5)


def build(family, a):
    """Build the requested original model into the current Blender scene."""
    if family not in FAMILIES:
        raise ValueError('Unknown v6 engine or construct: ' + family)
    p = _palette(a, family)
    {
        'highking': lambda: _arbalest(a, p),
        'kingsreach': lambda: _ballista(a, p),
        'fireballista': lambda: _ballista(a, p, True),
        'stonewarden': lambda: _catapult(a, p),
        'royalarsenal': lambda: _arsenal(a, p),
        'winterhold': lambda: _ice_colossus(a, p),
        'emeraldgolem': lambda: _rock_golem(a, p),
        'mechanicalgolem': lambda: _mechanical_golem(a, p),
    }[family]()
    return p
