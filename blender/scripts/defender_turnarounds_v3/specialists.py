"""New orthographic-reference authoring for the three specialist families.

Geometry is expressed in the v3 modelling frame (+Y front, +X own right,
soles Z=0), independently of the old v2 primitive assembly.  Every rank is a
single physical construction: the renderer is not allowed to move equipment
between views.  The dwarf transform is owned by common.Builder.
"""

import math
import bpy
from mathutils import Vector


def _attach_since(b, start, parent):
    b.attach(b.objects[start:], parent)


def _plate(b, name, outline, depth, mat, ridge=.02):
    """Closed broad-facet plate; +Y is its visible face."""
    n = len(outline)
    c = tuple(sum(p[i] for p in outline)/n for i in range(3))
    verts = list(outline)+[(x, y-depth, z) for x, y, z in outline]
    verts += [(c[0], c[1]+ridge, c[2]), (c[0], c[1]-depth, c[2])]
    faces = [(i, (i+1) % n, 2*n) for i in range(n)]
    faces += [(n+(i+1) % n, n+i, 2*n+1) for i in range(n)]
    faces += [(i, n+i, n+(i+1) % n, (i+1) % n) for i in range(n)]
    return b.mesh(name, verts, faces, mat)


def _disc(b, name, center, radius, depth, mat, sides=10):
    x, y, z = center
    p = [(x+radius*math.cos(2*math.pi*i/sides), y,
          z+radius*math.sin(2*math.pi*i/sides)) for i in range(sides)]
    return b.panel(name, p, depth, mat)


def _annulus(b, name, center, outer, inner, depth, mat, sides=10):
    x, y, z = center
    verts = []
    for yy, r in ((y, outer), (y, inner), (y-depth, outer),
                  (y-depth, inner)):
        verts.extend((x+r*math.cos(2*math.pi*i/sides), yy,
                      z+r*math.sin(2*math.pi*i/sides)) for i in range(sides))
    faces = []
    for i in range(sides):
        j = (i+1) % sides
        faces.extend(((i, j, sides+j, sides+i),
                      (2*sides+j, 2*sides+i, 3*sides+i, 3*sides+j),
                      (i, 2*sides+i, 2*sides+j, j),
                      (sides+j, 3*sides+j, 3*sides+i, sides+i)))
    return b.mesh(name, verts, faces, mat)


def _shoulder_plates(b, family):
    # Two broad steel facets, deliberately unornamented.
    start = len(b.objects)
    for sign, side in ((1, 'right'), (-1, 'left')):
        _plate(b, family+'_'+side+'_shoulder_plate', [
            (sign*.15, .14, 1.32), (sign*.27, .11, 1.35),
            (sign*.37, .06, 1.25), (sign*.34, .13, 1.20),
            (sign*.20, .18, 1.23)], .27, 'steel', .025)
    _attach_since(b, start, b.torso)


def _winter_collar(b):
    # One closed connected band.  Its broad angular lobes are not fur hairs.
    n = 10
    inner, outer = [], []
    for i in range(n):
        a = math.pi/2+2*math.pi*i/n
        inner.append((.125*math.cos(a), .115*math.sin(a), 1.36))
        outer.append((.34*math.cos(a), .215*math.sin(a),
                      1.26+(.025 if i % 2 == 0 else -.006)))
    verts = inner+outer+[(x, y, z-.062) for x, y, z in inner+outer]
    faces = []
    for i in range(n):
        j = (i+1) % n
        faces.extend(((i, j, n+j, n+i),
                      (2*n+i, 3*n+i, 3*n+j, 2*n+j),
                      (i, 2*n+i, 2*n+j, j),
                      (n+i, n+j, 3*n+j, 3*n+i)))
    return b.mesh('frost_one_connected_ivory_winter_collar', verts, faces,
                  'ivory')


def _whole_ice_spear(b):
    """One connected mesh, one ice material, including the hidden grip."""
    x, y = .49, .48
    tip = (1.80, 1.80, 1.80, 1.87, 1.91, 1.98)[b.rank-1]
    head_h = (.47, .47, .47, .56, .60, .67)[b.rank-1]
    head_w = (.15, .15, .15, .20, .23, .27)[b.rank-1]
    shaft_r = .022 if b.rank <= 3 else .025
    bottom = .016
    neck = tip-head_h
    # All cross sections have four vertices: narrow shaft facets meet the
    # double-tapered head directly, without a hidden socket or metal collar.
    rows = [(bottom, shaft_r*.63, shaft_r*.63),
            (bottom+.035, shaft_r, shaft_r),
            (neck-.015, shaft_r, shaft_r),
            (neck+.025, shaft_r*1.08, shaft_r*1.08),
            (neck+head_h*.39, head_w/2, head_w*.30),
            (tip-.001, .001, .001)]
    sec = [(-1, 0), (0, 1), (1, 0), (0, -1)]
    verts = [(x+rx*sx, y+ry*sy, z) for z, rx, ry in rows for sx, sy in sec]
    faces = [(3, 2, 1, 0)]
    for row in range(len(rows)-1):
        for i in range(4):
            j = (i+1) % 4
            faces.append((row*4+i, row*4+j, (row+1)*4+j, (row+1)*4+i))
    k = (len(rows)-1)*4
    faces.append((k, k+1, k+2, k+3))
    obj = b.mesh('frost_entire_continuous_ice_spear', verts, faces, 'ice')
    obj['construction'] = 'Single connected all-ice shaft, grip and head; no socket'
    obj['holdingHand'] = 'right'
    b.attach(obj, b.weapon['right'])
    b.focus((x, y, tip-.05))


def _ice_shield(b):
    if b.rank < 3:
        return
    x, y, z = -.45, .40, .93
    width, height = (.30, .60) if b.rank < 5 else (.48, .92)
    if b.rank == 6:
        width, height = .51, .98
    w, h = width/2, height/2
    outline = [(x, y, z+h), (x+w, y, z+h*.46),
               (x+w*.87, y, z-h*.42), (x, y, z-h),
               (x-w*.87, y, z-h*.42), (x-w, y, z+h*.46)]
    start = len(b.objects)
    obj = _plate(b, 'frost_large_hexagonal_ice_shield' if b.rank >= 5
                 else 'frost_small_hexagonal_ice_shield', outline, .055,
                 'ice', .075 if b.rank >= 5 else .052)
    obj['holdingHand'] = 'left'
    # Only a rear handle: no second decorative face copied onto the back.
    b.rod('frost_shield_rear_handle', (x-.06, .32, z),
          (x+.06, .32, z), .019, 'boots', sides=6)
    b.rod('frost_shield_hand_join', (x, .34, z),
          (x, .38, z), .020, 'boots', sides=6)
    _attach_since(b, start, b.weapon['left'])


def _build_frost(b):
    b.body(hood=True, mantle=b.rank == 1,
           cape='long' if b.rank >= 5 else 'short')
    b.arm('right', (.35, .15, .95), (.49, .48, .97),
          metal=b.rank >= 4)
    if b.rank < 3:
        b.arm('left', (-.31, .035, .98), (-.36, .08, .72), metal=False)
    else:
        b.arm('left', (-.33, .12, 1.02), (-.45, .34, .93),
              metal=b.rank >= 4)
    if b.rank >= 2:
        start = len(b.objects)
        _winter_collar(b)
        _attach_since(b, start, b.torso)
    if b.rank == 6:
        _shoulder_plates(b, 'frost')
    _whole_ice_spear(b)
    _ice_shield(b)


def _engineer_head(b):
    start = len(b.objects)
    b.rings('engineer_plain_faceted_workcap', [
        (0, .065, 1.58, .205, .178),
        (0, .065, 1.65, .207, .177),
        (.018, .060, 1.76, .166, .145),
        (.014, .058, 1.79, .055, .085)], 'boots')
    b.rings('engineer_broad_brown_cap_band', [
        (0, .086, 1.565, .222, .19),
        (0, .086, 1.622, .222, .19)], 'belt')
    # Front beard and connected sideburns are one closed copper wedge mesh.
    front = [(-.146, .186, 1.44), (-.085, .228, 1.466),
             (0, .236, 1.441), (.085, .228, 1.466),
             (.146, .186, 1.44), (.147, .18, 1.335),
             (.076, .239, 1.238), (0, .275, 1.140),
             (-.076, .239, 1.238), (-.147, .18, 1.335)]
    # The reconciled face is forward at +Y=.283. Beard roots must meet that
    # physical jaw; the copper wedge projects beyond it rather than clipping.
    front = [(x, y+.11, z) for x, y, z in front]
    _plate(b, 'engineer_one_copper_beard_wedge', front, .073,
           'copper', .025)
    for sign, side in ((1, 'right'), (-1, 'left')):
        b.panel('engineer_'+side+'_connected_sideburn', [
            (sign*.166, .236, 1.574), (sign*.187, .215, 1.530),
            (sign*.168, .277, 1.390), (sign*.128, .305, 1.428)],
            .064, 'copper')
    if b.rank >= 3:
        for sign, side in ((1, 'right'), (-1, 'left')):
            p = (sign*.092, .249, 1.696)
            _annulus(b, 'engineer_'+side+'_cap_top_goggle_rim', p,
                     .059, .041, .023, 'steel', sides=10)
            _disc(b, 'engineer_'+side+'_cap_top_goggle_lens',
                  (p[0], p[1]-.009, p[2]), .040, .018, 'eyes', sides=10)
        b.box('engineer_goggle_bridge', (0, .245, 1.696),
              (.066, .052, .022), 'belt', bevel=.004)
    _attach_since(b, start, b.head)


def _engineer_apron(b):
    if b.rank < 2:
        return
    start = len(b.objects)
    wide = b.rank >= 4
    top, bottom = (1.20, .46) if wide else (1.15, .53)
    wt, wb = (.16, .225) if wide else (.14, .19)
    b.panel('engineer_long_wide_leather_apron' if wide
            else 'engineer_plain_leather_apron', [
                (-wt, .167, top), (wt, .167, top),
                (wb, .19, bottom), (-wb, .19, bottom)], .028, 'boots')
    # Straps run over the shoulders and down the back; back has no apron.
    for sign, side in ((1, 'right'), (-1, 'left')):
        b.panel('engineer_'+side+'_front_apron_shoulder_strap', [
            (sign*.075, .172, top-.005), (sign*.102, .148, 1.274),
            (sign*.132, .139, 1.268), (sign*.105, .177, top-.005)],
            .019, 'belt')
        b.panel('engineer_'+side+'_back_apron_shoulder_strap', [
            (sign*.08, -.154, .84), (sign*.145, -.135, 1.264),
            (sign*.175, -.132, 1.257), (sign*.115, -.156, .84)],
            .017, 'belt')
    b.box('engineer_apron_waist_band', (0, .196, .88),
          (wb*2+.022, .031, .052), 'belt', bevel=.005)
    b.box('engineer_apron_simple_buckle', (0, .219, .88),
          (.067, .020, .057), 'steel', bevel=.004)
    if b.rank >= 5:
        b.box('engineer_broad_grey_apron_reinforcement', (0, .218, .89),
              (.448, .028, .103), 'steel', bevel=.007)
    if b.rank == 6:
        _plate(b, 'engineer_single_front_protective_chest_panel', [
            (-.157, .193, 1.185), (.157, .193, 1.185),
            (.185, .213, .976), (.146, .215, .948),
            (-.146, .215, .948), (-.185, .213, .976)],
            .028, 'steel', .014)
    _attach_since(b, start, b.torso)


def _engineer_ruler(b):
    start = len(b.objects)
    # Own left hip (-X), visible also in the left profile.
    b.panel('engineer_single_left_hip_straight_ruler', [
        (-.238, .238, .951), (-.183, .238, .96),
        (-.124, .247, .488), (-.18, .247, .48)], .025, 'ivory')
    for i in range(9):
        z = .516+i*.044
        x = -.162-(z-.516)*.125
        b.box('engineer_ruler_measure_mark_%02d' % (i+1),
              (x+.009, .251, z), (.021 if i % 2 == 0 else .013,
                                   .003, .004), 'belt', bevel=0)
    _attach_since(b, start, b.torso)


def _hammer(b):
    start = len(b.objects)
    x, y, z = .51, .48, 1.37
    # The slight forward slope is shared by every view.
    b.rod('engineer_wooden_hammer_handle', (x-.024, y-.025, .875),
          (x+.023, y+.039, z+.085), .025 if b.rank < 6 else .030,
          'wood', sides=8)
    if b.rank <= 3:
        b.box('engineer_whole_wooden_mallet_head' if b.rank == 1
              else 'engineer_plain_iron_hammer_head',
              (x+.023, y+.039, z+.082), (.31, .255, .22),
              'wood' if b.rank == 1 else 'steel', bevel=.014)
    else:
        master = b.rank == 6
        # Head + broad rear carpenter claw form one coherent tool profile.
        b.box('engineer_master_hammer_striking_face' if master
              else 'engineer_carpenter_hammer_striking_face',
              (x+.070, y+.04, z+.077),
              (.245 if master else .195, .255 if master else .225,
               .245 if master else .212), 'steel', bevel=.014)
        b.panel('engineer_single_master_carpenter_claw' if master
                else 'engineer_single_broad_carpenter_claw', [
                    (x-.048, y+.167, z+.17),
                    (x-.205, y+.167, z+.147),
                    (x-.288, y+.167, z+.048),
                    (x-.224, y+.167, z+.026),
                    (x-.143, y+.167, z+.088),
                    (x-.048, y+.167, z+.063)],
                .255 if master else .225, 'steel')
    _attach_since(b, start, b.weapon['right'])
    b.focus((x+.07, y+.04, z+.08))


def _tool_leather_bracer(b, lower_joint):
    start = len(b.objects)
    a = Vector((.385, .237, .969))
    c = Vector((.462, .386, 1.000))
    b.limb('engineer_right_working_forearm_wide_leather_bracer', [
        (*a, .101, .095), (*c, .094, .087)], 'boots', sides=6)
    # Two large pins are visible in III/IV only, not decorative II rivets.
    axis = (c-a).normalized()
    normal = (Vector((0, 1, 0))-axis*axis.y).normalized()
    for label, t in (('upper', .22), ('lower', .75)):
        pin = a.lerp(c, t)+normal*.088
        b.rod('engineer_tool_bracer_'+label+'_pin', pin, pin+normal*.014,
              .012, 'steel', sides=6)
    _attach_since(b, start, lower_joint)


def _build_engineer(b):
    b.body(hood=False, mantle=True, cape='short' if b.rank == 6 else False,
           dwarf=True)
    # The dwarf's planted boots have visibly wider toes/cuffs than the shared
    # human shell; widen actual foot meshes without changing the leg spacing.
    for obj in b.objects:
        part = obj.get('part', '')
        if part.startswith('Boot_') or part.startswith('Boot_Cuff_'):
            center = .190 if part.endswith('_1') else -.190
            for vertex in obj.data.vertices:
                vertex.co.x = center+(vertex.co.x-center)*1.15
    ra = b.arm('right', (.34, .15, .95), (.49, .44, 1.012),
               metal=b.rank >= 5)
    b.arm('left', (-.32, .05, .95), (-.38, .09, .71),
          metal=b.rank >= 5)
    _engineer_head(b)
    _engineer_apron(b)
    _engineer_ruler(b)
    if b.rank in (3, 4):
        _tool_leather_bracer(b, ra[1])
    _hammer(b)


def _storm_hair(b):
    """A single connected swept back hair shell, never separate spikes."""
    start = len(b.objects)
    # A deliberately irregular crown provides the faceted reference outline.
    front = [(-.16, .128, 1.58), (-.243, .099, 1.50),
             (-.262, .09, 1.576), (-.215, .117, 1.611),
             (-.274, .105, 1.68), (-.179, .115, 1.724),
             (-.158, .105, 1.779), (-.04, .094, 1.800),
             (.016, .086, 1.817), (.137, .077, 1.773),
             (.186, .061, 1.747), (.267, .093, 1.672),
             (.231, .120, 1.632), (.259, .1, 1.576),
             (.199, .128, 1.543), (.158, .143, 1.597)]
    # Same index order; the back cap steps down into long rear facets.
    back = [(-.16, -.215, 1.434), (-.243, -.24, 1.495),
            (-.255, -.25, 1.562), (-.207, -.264, 1.62),
            (-.266, -.247, 1.656), (-.19, -.265, 1.72),
            (-.16, -.24, 1.756), (-.04, -.193, 1.80),
            (.016, -.17, 1.81), (.135, -.217, 1.764),
            (.20, -.255, 1.72), (.277, -.245, 1.65),
            (.226, -.275, 1.626), (.254, -.249, 1.56),
            (.199, -.244, 1.482), (.12, -.22, 1.432)]
    n = len(front)
    verts = front+back+[(0, .102, 1.68), (0, -.287, 1.63)]
    faces = [(i, (i+1) % n, 2*n) for i in range(n)]
    faces += [(n+(i+1) % n, n+i, 2*n+1) for i in range(n)]
    faces += [(i, n+i, n+(i+1) % n, (i+1) % n) for i in range(n)]
    b.mesh('storm_one_connected_swept_back_hair', verts, faces, 'hair')
    if b.rank >= 2:
        z = 1.565
        thickness = .028 if b.rank < 5 else .042
        b.rings('storm_plain_broad_circlet' if b.rank >= 5
                else 'storm_plain_thin_circlet', [
                    (0, .005, z, .236, .192),
                    (0, .005, z+thickness, .236, .192)], 'gold')
    _attach_since(b, start, b.head)


def _lightning(b):
    start = len(b.objects)
    x, y, z = .49, .46, 1.30
    height = (.35, .35, .48, .50, .61, .67)[b.rank-1]
    if b.rank < 5:
        shape = [(.14, 1), (-.25, .51), (-.02, .43),
                 (-.13, 0), (.31, .54), (.06, .63)]
    else:
        # A single filled outline with exactly three large upper prongs.
        shape = [(0, 0), (.135, .35), (.29, .55), (.40, .79),
                 (.20, .66), (.15, .52), (.063, .405),
                 (.115, .61), (.056, .65), (.055, 1),
                 (-.074, .63), (-.035, .535), (-.12, .445),
                 (-.34, .76), (-.31, .44), (-.17, .31), (-.055, .22)]
    outline = [(x+xx*height, y, z+zz*height) for xx, zz in shape]
    obj = b.panel('storm_one_three_prong_lightning' if b.rank >= 5
                  else 'storm_one_simple_zigzag_lightning', outline,
                  .028, 'ice')
    obj['holdingHand'] = 'right'
    obj['construction'] = 'Single connected fixed-thickness cyan glyph'
    _attach_since(b, start, b.weapon['right'])
    b.focus((x, y, z+.04))


def _casting_gauntlet(b):
    start = len(b.objects)
    _plate(b, 'storm_right_small_silver_hand_back_plate', [
        (.43, .475, 1.274), (.51, .475, 1.296),
        (.548, .475, 1.250), (.519, .479, 1.218),
        (.451, .477, 1.23)], .025, 'steel', .010)
    _attach_since(b, start, b.hand['right'])


def _open_casting_palm(b):
    # The common neutral mitten is appropriate for tools, but the approved
    # Stormcaller has a cupped, visibly open casting hand.  Replace only that
    # physical right-hand mesh, once, independently of the render camera.
    for obj in list(b.objects):
        part = obj.get('part', obj.name).lower()
        if 'right' in part and ('glove' in part or 'mitten' in part):
            b.objects.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
    obj = b.panel('storm_right_open_brown_casting_palm', [
        (.429, .458, 1.224), (.455, .463, 1.208),
        (.502, .466, 1.228), (.547, .458, 1.255),
        (.551, .457, 1.304), (.527, .459, 1.316),
        (.511, .464, 1.274), (.460, .465, 1.261),
        (.446, .461, 1.295), (.427, .458, 1.276)],
        .104, 'boots')
    obj['construction'] = 'One open cupped palm, brown glove base'
    b.attach(obj, b.hand['right'])


def _build_storm(b):
    b.body(hood=False, mantle=b.rank >= 2,
           cape='long' if b.rank >= 4 else ('short' if b.rank >= 2 else False))
    if b.rank >= 4:
        for obj in list(b.objects):
            if obj.get('part') == 'Broad_Pointed_Back_Cape':
                b.objects.remove(obj)
                bpy.data.objects.remove(obj, do_unlink=True)
        b.cape_shell('Storm_Long_Two_Point_Cape', hem=.24, spread=.43,
                     rear=-.54, tips='two', material='blue')
    b.arm('right', (.34, .14, 1.04), (.49, .40, 1.24),
          metal=b.rank >= 3)
    b.arm('left', (-.31, .04, .98), (-.37, .08, .72),
          metal=b.rank >= 4)
    _open_casting_palm(b)
    _storm_hair(b)
    if b.rank >= 2:
        start = len(b.objects)
        _disc(b, 'storm_simple_round_mantle_clasp', (0, .186, 1.245),
              .030, .016, 'buckle', sides=8)
        _attach_since(b, start, b.torso)
    if b.rank == 6:
        _shoulder_plates(b, 'storm')
        _casting_gauntlet(b)
    _lightning(b)


def build(b):
    if not 1 <= b.rank <= 6:
        raise ValueError('Specialist rank must be I..VI')
    if b.family in ('runebreaker', 'engineer'):
        _build_engineer(b)
    elif b.family == 'frostwarden':
        _build_frost(b)
    elif b.family == 'stormcaller':
        _build_storm(b)
    else:
        raise ValueError('Unsupported specialist family: '+b.family)
    return b.objects
