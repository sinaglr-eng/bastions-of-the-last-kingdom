"""Approved variant-B Engineer, Frost Warden and Stormcaller rank equipment.

Only authoring geometry lives here.  Base, materials, export, rank effects and
the final dwarf transform belong to the shared Builder and central generator.
All coordinates use the unscaled Ranger frame: +Y front, Z up, soles at .12.
"""

import math


def _attach_since(b, start, parent):
    b.attach(b.objects[start:], parent)


def _facet(b, name, outline, depth, mat, bump=.025):
    """Closed convex faceted plate with a shallow front ridge."""
    n = len(outline)
    back = [(x, y-depth, z) for x, y, z in outline]
    center = tuple(sum(p[k] for p in outline)/n for k in range(3))
    front_center = (center[0], center[1]+bump, center[2])
    back_center = (center[0], center[1]-depth, center[2])
    verts = list(outline)+back+[front_center, back_center]
    faces = [(i, (i+1) % n, 2*n) for i in range(n)]
    faces += [(n+(i+1) % n, n+i, 2*n+1) for i in range(n)]
    faces += [(i, n+i, n+(i+1) % n, (i+1) % n) for i in range(n)]
    return b.mesh(name, verts, faces, mat)


def _disc(b, name, center, radius, depth, mat, sides=8):
    x, y, z = center
    outline = [(x+radius*math.cos(2*math.pi*i/sides), y,
                z+radius*math.sin(2*math.pi*i/sides)) for i in range(sides)]
    return b.panel(name, outline, depth, mat)


def _goggle_rim(b, name, center):
    x, y, z = center
    verts = []
    for yy, r in ((y, .047), (y, .034), (y-.022, .047),
                  (y-.022, .034)):
        verts += [(x+r*math.cos(2*math.pi*i/8), yy,
                   z+r*math.sin(2*math.pi*i/8)) for i in range(8)]
    faces = []
    for i in range(8):
        j = (i+1) % 8
        faces += [(i, j, 8+j, 8+i),
                  (16+j, 16+i, 24+i, 24+j),
                  (i, 16+i, 16+j, j),
                  (8+j, 24+j, 24+i, 8+i)]
    return b.mesh(name, verts, faces, 'steel')


def _shoulder_guards(b, prefix):
    start = len(b.objects)
    for s, side in ((1, 'Right'), (-1, 'Left')):
        outline = [(s*.120, .166, 1.535), (s*.246, .140, 1.552),
                   (s*.346, .028, 1.455), (s*.311, .102, 1.411),
                   (s*.174, .191, 1.455)]
        _facet(b, prefix+'_'+side+'_Shoulder_Plate', outline, .138,
               'steel', .016)
    _attach_since(b, start, b.torso)


def _winter_collar(b):
    # A single connected collar band, deliberately broad rather than furry.
    inner = []
    outer = []
    for i in range(8):
        a = math.pi/2+2*math.pi*i/8
        inner.append((.116*math.cos(a), .116*math.sin(a), 1.593))
        outer.append((.329*math.cos(a), .205*math.sin(a),
                      1.491+(.028 if i in (0, 4) else 0)))
    top = inner+outer
    verts = top+[(x, y, z-.053) for x, y, z in top]
    faces = []
    for i in range(8):
        j = (i+1) % 8
        faces += [(i, j, 8+j, 8+i),
                  (16+i, 24+i, 24+j, 16+j),
                  (i, 16+i, 16+j, j),
                  (8+i, 8+j, 24+j, 24+i)]
    return b.mesh('Winter_One_Piece_Ivory_Collar', verts, faces, 'ivory')


def _crystal(b, name, center, width, height, mat='ice'):
    x, y, z = center
    # A continuous double-pointed crystal, with only one widest cross-section.
    r = width/2
    verts = [(x, y, z-height/2), (x-r, y, z-height*.045),
             (x, y-r*.78, z-height*.045),
             (x+r, y, z-height*.045),
             (x, y+r*.78, z-height*.045), (x, y, z+height/2)]
    faces = [(0, 2, 1), (0, 3, 2), (0, 4, 3), (0, 1, 4),
             (5, 1, 2), (5, 2, 3), (5, 3, 4), (5, 4, 1)]
    return b.mesh(name, verts, faces, mat)


def _engineer_head(b):
    start = len(b.objects)
    b.rings('Carpenter_Workcap_Crown', [
        (0, -.008, 1.951, .172, .155),
        (0, -.012, 1.992, .177, .152),
        (.010, -.026, 2.094, .137, .125),
        (.012, -.039, 2.129, .074, .075)], 'boots')
    b.rings('Carpenter_Workcap_Broad_Band', [
        (0, -.004, 1.940, .182, .163),
        (0, -.004, 1.986, .183, .164)], 'belt')
    beard = [(-.125, .187, 1.812), (-.060, .214, 1.799),
             (0, .224, 1.810), (.060, .214, 1.799),
             (.125, .187, 1.812), (.117, .193, 1.672),
             (.073, .211, 1.604), (0, .225, 1.529),
             (-.073, .211, 1.604), (-.117, .193, 1.672)]
    _facet(b, 'Carpenter_One_Piece_Copper_Beard', beard, .073,
           'copper', .027)
    # Small side hair patches visibly connect the beard to the workcap.
    for s, side in ((1, 'Right'), (-1, 'Left')):
        b.panel('Carpenter_'+side+'_Side_Hair', [
            (s*.137, .132, 1.958), (s*.146, .103, 1.900),
            (s*.144, .126, 1.739), (s*.116, .177, 1.763),
            (s*.122, .173, 1.927)], .052, 'copper')
    if b.rank >= 3:
        for s, side in ((1, 'Right'), (-1, 'Left')):
            p = (s*.073, .184, 2.039)
            _goggle_rim(b, 'Carpenter_'+side+'_Goggle_Rim', p)
            _disc(b, 'Carpenter_'+side+'_Dark_Goggle_Lens',
                  (p[0], p[1]+.002, p[2]), .032, .016, 'eyes')
        b.box('Carpenter_Goggle_Bridge', (0, .184, 2.039),
              (.052, .025, .020), 'belt', bevel=.006)
    _attach_since(b, start, b.head)


def _engineer_apron(b):
    if b.rank < 2:
        return
    start = len(b.objects)
    wide = b.rank >= 4
    top = 1.437 if wide else 1.382
    bottom = .775 if wide else .873
    wt, wb = (.161, .181) if wide else (.124, .149)
    outline = [(-wt, .151, top), (wt, .151, top),
               (wb, .161, bottom+.031), (wb*.78, .163, bottom),
               (-wb*.78, .163, bottom), (-wb, .161, bottom+.031)]
    b.panel('Carpenter_Connected_Long_Apron' if wide else
            'Carpenter_Plain_Leather_Apron', outline, .032, 'boots')
    for s, side in ((1, 'Right'), (-1, 'Left')):
        b.panel('Carpenter_'+side+'_Apron_Strap', [
            (s*.073, .163, top-.019), (s*.098, .142, 1.507),
            (s*.123, .134, 1.507), (s*.096, .169, top-.019)],
            .015, 'belt')
    b.box('Carpenter_Apron_Waist_Strap', (0, .177, 1.106),
          (wb*2+.018, .033, .049), 'belt', bevel=.006)
    b.box('Carpenter_Apron_Buckle', (0, .201, 1.106),
          (.047, .020, .044), 'buckle', bevel=.004)
    if b.rank >= 5:
        b.box('Carpenter_Broad_Apron_Reinforcement', (0, .202, 1.113),
              (.348, .031, .076), 'steel', bevel=.008)
        b.box('Carpenter_Reinforced_Apron_Buckle', (0, .226, 1.111),
              (.064, .025, .060), 'steel', bevel=.007)
    if b.rank >= 6:
        _facet(b, 'Carpenter_Single_Protective_Breast_Panel', [
            (-.145, .171, 1.433), (.145, .171, 1.433),
            (.167, .184, 1.172), (.128, .198, 1.145),
            (-.128, .198, 1.145), (-.167, .184, 1.172)],
            .028, 'steel', .018)
    _attach_since(b, start, b.torso)


def _engineer_ruler(b):
    start = len(b.objects)
    # One simple rectangular ruler, tilted along the free-hand side of belt.
    b.panel('Carpenter_Straight_Measuring_Ruler', [
        (-.185, .227, 1.207), (-.142, .227, 1.213),
        (-.102, .232, .851), (-.146, .232, .846)], .023, 'ivory')
    for i in range(7):
        z = .898+i*.041
        x = -.129-(z-.898)*.112
        length = .021 if i % 2 == 0 else .013
        b.box('Carpenter_Ruler_Tick_%02d' % (i+1),
              (x+.005, .236, z), (length, .004, .004),
              'eyes', bevel=0)
    _attach_since(b, start, b.torso)


def _engineer_hammer(b):
    start = len(b.objects)
    x, y = .548, .115
    b.rod('Carpenter_Wooden_Hammer_Handle', (x, y, .940),
          (x, y, 1.638), .025 if b.rank < 6 else .030, 'wood', sides=8)
    if b.rank <= 3:
        b.box('Carpenter_Wood_Mallet_Head' if b.rank == 1 else
              'Carpenter_Iron_Hammer_Head', (x, y, 1.636),
              (.264, .163, .175), 'wood' if b.rank == 1 else 'steel',
              bevel=.010)
    else:
        master = b.rank == 6
        b.box('Carpenter_Master_Hammer_Face' if master else
              'Carpenter_Claw_Hammer_Face',
              (x+.042, y, 1.647),
              (.279 if master else .213, .194 if master else .174,
               .224 if master else .193), 'steel', bevel=.012)
        # One wide angular claw: a clean carpenter profile, no tiny teeth.
        b.panel('Carpenter_Master_Angular_Claw' if master else
                'Carpenter_Broad_Angular_Claw', [
            (x-.030, y+.092, 1.559), (x-.030, y+.092, 1.743),
            (x-.157, y+.092, 1.723), (x-.245, y+.092, 1.639),
            (x-.214, y+.092, 1.609), (x-.132, y+.092, 1.660)],
            .184, 'steel')
    _attach_since(b, start, b.weapon['right'])
    b.focus((x+.044, y, 1.651))


def _build_engineer(b):
    b.body(hood=False, mantle=True, cape='short' if b.rank == 6 else False,
           dwarf=True)
    right_arm = b.arm('right', (.368, .048, 1.230), (.548, .115, 1.182),
                      metal=b.rank >= 5)
    b.arm('left', (-.304, .031, 1.125), (-.354, .050, .953),
          metal=b.rank >= 5)
    _engineer_head(b)
    _engineer_apron(b)
    _engineer_ruler(b)
    if b.rank >= 3 and b.rank < 5:
        start = len(b.objects)
        # Added rank-III leather forearm armor stays visibly on the tool arm.
        b.limb('Carpenter_Tool_Arm_Leather_Bracer', [
            (.417, .067, 1.215, .088, .083),
            (.495, .097, 1.192, .079, .076)], 'boots', sides=8)
        _attach_since(b, start, right_arm[1])
    _engineer_hammer(b)


def _frost_staff(b):
    start = len(b.objects)
    x, y = .526, .120
    crystal_h = .215 if b.rank <= 3 else (.378 if b.rank == 4 else .425)
    crystal_w = .080 if b.rank <= 3 else (.116 if b.rank == 4 else .140)
    crystal_base = 1.820
    if b.rank == 6:
        crystal_h, crystal_w, crystal_base = .493, .151, 1.785
    center_z = crystal_base+crystal_h/2
    b.rod('Frost_Thin_Wood_Staff', (x, y, .160),
          (x, y, crystal_base+.091), .0215 if b.rank < 5 else .024,
          'wood', sides=8)
    b.rings('Frost_Plain_Crystal_Socket', [
        (x, y, crystal_base-.010, .038, .037),
        (x, y, crystal_base+.078, .032, .032)],
        'wood' if b.rank < 6 else 'steel')
    _crystal(b, 'Frost_Master_Double_Ended_Ice_Crystal' if b.rank == 6
             else 'Frost_Single_Ice_Crystal',
             (x, y, center_z), crystal_w, crystal_h)
    if b.rank == 6:
        b.rings('Frost_Master_Central_Socket_Band', [
            (x, y, center_z-.021, crystal_w*.54, crystal_w*.43),
            (x, y, center_z+.016, crystal_w*.54, crystal_w*.43)], 'steel')
    _attach_since(b, start, b.weapon['right'])
    b.focus((x, y, center_z))


def _frost_shield(b):
    if b.rank < 3:
        return
    start = len(b.objects)
    x, y, z = -.429, .268, 1.103
    width, height = ((.342, .551) if b.rank < 5 else
                     ((.462, .872) if b.rank == 5 else (.492, .914)))
    w, h = width/2, height/2
    outline = [(x, y, z+h), (x+w, y, z+h*.49),
               (x+w*.88, y, z-h*.37), (x, y, z-h),
               (x-w*.88, y, z-h*.37), (x-w, y, z+h*.49)]
    # A broad recessed perimeter around one uninterrupted ice face.
    _facet(b, 'Frost_Large_Faceted_Ice_Shield' if b.rank >= 5 else
           'Frost_Small_Faceted_Ice_Shield', outline, .066, 'ice', .040)
    inner = [(x+(xx-x)*.86, yy+.012, z+(zz-z)*.88)
             for xx, yy, zz in outline]
    _facet(b, 'Frost_Shield_Broad_Inner_Face', inner, .016, 'ice',
           .076 if b.rank < 5 else .105)
    b.rod('Frost_Shield_Rear_Grip', (x-.070, .177, z),
          (x+.070, .177, z), .022, 'boots', sides=6)
    b.rod('Frost_Shield_Hand_Connector', (x, .126, z),
          (x, .220, z), .025, 'boots', sides=6)
    _attach_since(b, start, b.weapon['left'])


def _build_frost(b):
    b.body(hood=True, mantle=b.rank == 1,
           cape='long' if b.rank >= 5 else 'short')
    b.arm('right', (.345, .042, 1.207), (.526, .120, 1.127),
          metal=b.rank >= 4)
    b.arm('left', (-.306, .024, 1.142), (-.429, .126, 1.103),
          metal=b.rank >= 4)
    if b.rank >= 2:
        start = len(b.objects)
        _winter_collar(b)
        _attach_since(b, start, b.torso)
    if b.rank >= 6:
        _shoulder_guards(b, 'Frost')
    _frost_staff(b)
    _frost_shield(b)


def _storm_hair(b):
    start = len(b.objects)
    # Tapered loft, one continuous mesh.  Rows sweep backwards and narrow into
    # an angled crest instead of leaving a broad rectangular extrusion face.
    rows = [
        [(-.110, .159, 1.950), (.110, .159, 1.950),
         (.155, .061, 1.890), (.161, -.109, 1.830),
         (.092, -.210, 1.790), (-.090, -.210, 1.790),
         (-.161, -.109, 1.830), (-.155, .061, 1.890)],
        [(-.114, .134, 2.015), (.120, .134, 2.015),
         (.178, .024, 2.030), (.184, -.160, 1.966),
         (.112, -.270, 1.911), (-.120, -.265, 1.928),
         (-.180, -.141, 1.999), (-.168, .028, 2.040)],
        [(-.075, .040, 2.065), (.073, .031, 2.070),
         (.140, -.060, 2.116), (.106, -.177, 2.140),
         (.051, -.218, 2.100), (-.064, -.212, 2.130),
         (-.142, -.118, 2.105), (-.118, -.020, 2.107)]]
    verts = [p for row in rows for p in row]+[(0, -.113, 2.147)]
    faces = [tuple(reversed(range(8)))]
    for row in range(2):
        for i in range(8):
            j = (i+1) % 8
            faces.append((row*8+i, row*8+j, (row+1)*8+j, (row+1)*8+i))
    faces += [(16+i, 16+(i+1) % 8, 24) for i in range(8)]
    b.mesh('Storm_One_Piece_Swept_Back_Hair', verts, faces, 'hair')
    if b.rank >= 2:
        low, high = ((1.944, 1.969) if b.rank < 5 else (1.928, 1.972))
        b.rings('Storm_Broad_Master_Circlet' if b.rank >= 5 else
                'Storm_Thin_Forehead_Circlet', [
            (0, .011, low, .173, .174),
            (0, .011, high, .172, .174)], 'gold')
    _attach_since(b, start, b.head)


def _storm_lightning(b):
    start = len(b.objects)
    x, y, z = .514, .139, 1.482
    height = (.230, .230, .341, .375, .496, .547)[b.rank-1]
    if b.rank < 5:
        # One simple solid zigzag, not a rod skeleton or collection of shards.
        shape = [(.182, 1), (-.231, .517), (-.016, .456),
                 (-.132, 0), (.286, .535), (.083, .608)]
    else:
        # Connected three-prong glyph; three points preserve Storm's class cue.
        shape = [(0, 0), (.102, .342), (.206, .479),
                 (.288, .785), (.163, .611), (.142, .455),
                 (.058, .384), (.130, .552), (.039, .605),
                 (.100, 1), (-.049, .563), (.025, .515),
                 (-.071, .453), (-.212, .776), (-.186, .467),
                 (-.066, .331), (-.035, .285)]
    outline = [(x+xx*height, y, z+zz*height) for xx, zz in shape]
    b.panel('Storm_Master_Three_Prong_Lightning' if b.rank >= 5 else
            'Storm_Single_Solid_Lightning', outline, .025, 'ice')
    _attach_since(b, start, b.weapon['right'])
    # The projectile still leaves the raised hand, independent of glyph size.
    b.focus((x, y, z+.035))


def _build_storm(b):
    b.body(hood=False, mantle=b.rank >= 2,
           cape=('long' if b.rank >= 4 else
                 ('short' if b.rank >= 2 else False)))
    b.arm('right', (.354, .067, 1.198), (.514, .118, 1.397),
          metal=b.rank >= 3)
    b.arm('left', (-.303, .031, 1.125), (-.352, .050, .949),
          metal=b.rank >= 4)
    _storm_hair(b)
    if b.rank >= 2:
        start = len(b.objects)
        _crystal(b, 'Storm_Plain_Mantle_Clasp', (0, .177, 1.540),
                 .047, .071, 'buckle')
        _attach_since(b, start, b.torso)
    if b.rank >= 6:
        _shoulder_guards(b, 'Storm')
        start = len(b.objects)
        _facet(b, 'Storm_Master_Casting_Hand_Guard', [
            (.464, .182, 1.449), (.557, .182, 1.449),
            (.577, .183, 1.403), (.548, .190, 1.353),
            (.474, .190, 1.361), (.456, .184, 1.403)],
            .029, 'steel', .019)
        _attach_since(b, start, b.hand['right'])
    _storm_lightning(b)


def build(b):
    """Build one specialist at b.rank, with shared basic-class articulation."""
    if not 1 <= b.rank <= 6:
        raise ValueError('Specialist rank must be 1..6')
    if b.family in ('runebreaker', 'engineer'):
        _build_engineer(b)
    elif b.family == 'frostwarden':
        _build_frost(b)
    elif b.family == 'stormcaller':
        _build_storm(b)
    else:
        raise ValueError('Unsupported specialist family: '+b.family)
    return b.objects
