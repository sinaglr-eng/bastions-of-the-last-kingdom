"""Bounded 0.3.2 source equipment and user-requested spirit face repairs.

Native coordinates: +Y front, +X anatomical right, Z up. Invoke
``apply_source_fit_v3(b, row, ctx)`` after humanoid decoration/equipment and
with ``ctx=None`` after the Mothernature construct is assembled. This module
owns no exports or manifests. It retains canonical joints, head coverings,
body/leg geometry and named effect endpoints; only the explicitly selected
arm/equipment or nature-face meshes are rebuilt.
"""


def apply_source_fit_v3(b, row, c=None):
    import bpy
    from mathutils import Vector
    from geometric_game_common import linear
    from geometric_roster_builder import cone, ell

    identity = row['id']
    if identity not in ('rimewatch', 'royalranger', 'greenheart', 'mothernature'):
        return False
    revision = 'champion-source-fit-v3'
    if b.root.get('sourceFitV3Revision') == revision:
        return False

    def below(ob, parent):
        while ob:
            if ob == parent:
                return True
            ob = ob.parent
        return False

    def remove(parent, prefixes):
        for ob in list(b.objects):
            name = ob.get('semanticPart', ob.name)
            if ob.type == 'MESH' and below(ob, parent) and name.startswith(prefixes):
                mesh = ob.data
                b.objects.remove(ob)
                bpy.data.objects.remove(ob, do_unlink=True)
                if mesh.users == 0:
                    bpy.data.meshes.remove(mesh)

    def node(name):
        return next((ob for ob in b.coll.all_objects
                     if ob.type == 'EMPTY' and ob.name.split('.')[0] == name), None)

    def position(ob, point):
        bpy.context.view_layer.update()
        transform = ob.matrix_world.copy()
        transform.translation = Vector(point)
        ob.matrix_world = transform
        bpy.context.view_layer.update()

    def endpoint(parent, name, point):
        ob = node(name)
        if ob is None:
            return b.pivot(name, point, parent)
        b.attach(ob, parent)
        position(ob, point)
        return ob

    def fresh_material(key, color, emission=0):
        if key not in b.M:
            rgba = tuple(linear(int(color[i:i + 2], 16) / 255)
                         for i in (0, 2, 4)) + (1,)
            mat = bpy.data.materials.new(key)
            mat.use_nodes = True
            mat.diffuse_color = rgba
            mat['source_srgb'] = '#' + color
            shader = mat.node_tree.nodes['Principled BSDF']
            shader.inputs['Base Color'].default_value = rgba
            shader.inputs['Roughness'].default_value = .62
            if emission:
                shader.inputs['Emission Color'].default_value = rgba
                shader.inputs['Emission Strength'].default_value = emission
            b.M[key] = mat
            b.palette[key] = color
        return key

    if identity in ('rimewatch', 'royalranger'):
        assert c is not None, 'Humanoid source-fit requires its measured context'
        P, SZ, scale = c['P'], c['SZ'], c['scale']
        weapon = c['weapons']['R']
        # Remove only held weapon meshes. Quiver, plume, cape, identity marks,
        # shoulder decorations and every canonical rigid joint are preserved.
        remove(weapon, ('Crossbow ', 'Loaded crossbow ', 'Connected crossbow '))
        remove(c['weapons']['L'], ('Continuous open bow stave',
               'Bow contacting wrapped grip', 'Physical bowstring'))
        for name in ('bow_grip', 'bow_nock', 'bow_string_top', 'bow_string_bottom'):
            obsolete = node(name)
            if obsolete is not None:
                bpy.data.objects.remove(obsolete, do_unlink=True)

        # The rear RIGHT palm wraps the trigger grip; the LEFT palm is forward
        # and slightly lower, underneath the fore-stock. Neither hand grips
        # a transverse bow tip. Shoulders retain their anatomical source side.
        grips = {'R': (.035, .235, .785), 'L': (-.025, .505, .765)}
        elbows = {'R': (.245, .150, .885), 'L': (-.245, .285, .895)}
        sleeve = 'cloth'
        hand_material = 'leather' if identity == 'rimewatch' else 'skin'
        for side in ('R', 'L'):
            upper, fore, hand = c['arms'][side], node('forearm_' + side), node('hand_' + side)
            assert fore and hand
            bpy.context.view_layer.update()
            shoulder = upper.matrix_world.translation.copy()
            remove(upper, ('Connected shoulder ' + side, 'Upper arm ' + side,
                   'Forearm ' + side, 'Elbow contacting articulated joint ' + side,
                   'Grasping hand ' + side, 'Broad cuff ' + side,
                   'Crossbow fitted sleeve', 'Crossbow physical forearm',
                   'Crossbow contacting elbow', 'Crossbow gripping palm'))
            # Set existing joints without changing their ownership hierarchy.
            position(fore, P(elbows[side]))
            position(hand, P(grips[side]))
            position(c['weapons'][side], P(grips[side]))
            c['hands'][side] = P(grips[side])
            radius = .095 * scale
            ell(b, 'Crossbow contacting shoulder ' + side, tuple(shoulder),
                SZ((.13, .135, .12)), sleeve, upper, 8, 3)
            b.limb('Crossbow fitted sleeve upper arm ' + side,
                   [tuple(shoulder), P(elbows[side])], [radius * 1.18, radius],
                   sleeve, upper, 8)
            b.limb('Crossbow physical forearm sleeve ' + side,
                   [P(elbows[side]), P(grips[side])], [radius, radius * .88],
                   sleeve, fore, 8)
            ell(b, 'Crossbow contacting elbow ' + side, P(elbows[side]),
                SZ((.101, .099, .100)), sleeve, fore, 8, 3)
            ell(b, 'Crossbow gripping palm ' + side, P(grips[side]),
                SZ((.090, .089, .093)), hand_material, hand, 8, 3)
            cuff = Vector(elbows[side]).lerp(Vector(grips[side]), .80)
            b.limb('Crossbow source cuff ' + side,
                   [P(cuff), P(Vector(grips[side]).lerp(Vector(elbows[side]), .05))],
                   [radius * 1.03, radius * .96],
                   'ivory' if identity == 'rimewatch' else 'gold', fore, 8)

        # A true stock/rail, butt, trigger grip, curved transverse bow and
        # cocked V-string share one weapon_R rigid assembly. The bolt axis
        # is +Y, corresponding to -Z after the GLTF authoring conversion.
        royal = identity == 'royalranger'
        wood, band = 'wood', 'gold' if royal else 'steel_light'
        rail_z = .867
        b.box('Crossbow connected fore-stock', P((0, .395, rail_z)),
              SZ((.146, .755, .112)), wood, .014 * scale, weapon)
        b.box('Crossbow shaped rear shoulder butt', P((0, .070, rail_z + .006)),
              SZ((.206, .214, .148)), wood, .024 * scale, weapon)
        b.box('Crossbow rear butt binding', P((0, -.023, rail_z + .007)),
              SZ((.222, .045, .158)), band, .010 * scale, weapon)
        b.limb('Crossbow right trigger grip',
               [P((.020, .245, .705)), P((.020, .228, .853))],
               [.042 * scale, .044 * scale], wood, weapon, 6)
        b.box('Crossbow front supported hand grip', P((0, .505, .819)),
              SZ((.152, .140, .083)), wood, .015 * scale, weapon)
        for y in (.323, .658):
            b.box('Crossbow stock top metal binding', P((0, y, rail_z + .010)),
                  SZ((.158, .054, .127)), band, .007 * scale, weapon)
        b.box('Crossbow visible recessed bolt rail', P((0, .416, rail_z + .060)),
              SZ((.033, .643, .010)), 'dark', .001 * scale, weapon)
        for sign in (-1, 1):
            points = [(0, .665, .883), (sign * .21, .601, .880),
                      (sign * .38, .465, .870)]
            b.limb('Crossbow physically curved transverse limb', [P(q) for q in points],
                   [.044 * scale, .041 * scale, .033 * scale],
                   'gold' if royal else wood, weapon, 6)
            b.box('Crossbow bow-tip string binding', P(points[-1]),
                  SZ((.048, .073, .082)), band, .007 * scale, weapon)
        left, right, nock = (-.38, .465, .870), (.38, .465, .870), (0, .235, .926)
        string = b.limb('Crossbow cocked two-segment physical string',
                        [P(left), P(nock), P(right)], [.006 * scale] * 3, 'ivory', weapon, 4)
        string['visualCue'] = 'crossbowString'
        b.rod('Loaded crossbow straight bolt', P((0, .202, .926)),
              P((0, .810, .926)), .013 * scale, 'steel', weapon, 6)
        cone(b, 'Crossbow source frost crystal bolt tip' if not royal else 'Crossbow royal bolt point',
             P((0, .792, .926)), P((0, .916, .926)), .051 * scale,
             'iceblue' if not royal else 'steel_light', weapon, 4)
        # A small real trigger guard is underneath the rear rail and surrounds
        # the right index-finger area, rather than crossing the support palm.
        guard = [(.018, .291, .847), (.018, .325, .797),
                 (.018, .302, .727), (.018, .242, .729)]
        b.limb('Crossbow physical trigger guard', [P(q) for q in guard],
               [.012 * scale] * 4, band, weapon, 6)
        for name, point in [('crossbow_trigger_grip', grips['R']),
                            ('crossbow_foregrip', grips['L']),
                            ('crossbow_string_left', left),
                            ('crossbow_string_right', right),
                            ('crossbow_nock', nock),
                            ('attack_muzzle', (0, .916, .926))]:
            endpoint(weapon, name, P(point))
        weapon['crossbowGripContract'] = 'rear-trigger-front-support-v3'
        b.root['crossbowGripContract'] = 'rear-trigger-front-support-v3'
        b.root['attackStyle'] = 'crossbow'
        b.root['equipmentOverrideV3'] = 'crossbow-two-hand'
        # Historical metadata is retained separately, so the user override
        # remains explicit without changing any damage/projectile statistics.
        b.root['sourceWeaponKind'] = row['spec'].get('weapon', 'crossbow')

    elif identity == 'greenheart':
        assert c is not None
        scale = c['scale']
        x, y, z = c['hands']['R']
        weapon = c['weapons']['R']
        remove(weapon, ('Connected staff handle', 'Staff leaf focus',
                       'Staff crystal', 'Staff genuine hollow ring'))
        def Q(dx, dy, dz):
            return (x + dx * scale, y + dy * scale, z + dz * scale)
        stem = [Q(0, 0, -.65), Q(0, 0, 0), Q(-.006, 0, .36),
                Q(-.025, 0, .57), Q(-.040, 0, .76)]
        b.limb('Greenheart continuous curved staff shaft and leaf stem', stem,
               [.028 * scale, .033 * scale, .035 * scale, .037 * scale, .027 * scale],
               'wood', weapon, 6)
        forks = [[Q(-.007, 0, .34), Q(.112, 0, .46), Q(.138, 0, .65)],
                 [Q(-.025, 0, .55), Q(.085, 0, .62), Q(.102, 0, .77)]]
        for points in forks:
            b.limb('Greenheart source connected branch fork', points,
                   [.030 * scale, .032 * scale, .022 * scale], 'wood', weapon, 5)
        # The broad, leaning geometric leaf overlaps the curved stem at its
        # lower tip. Every wooden branch is physically joined to that shaft.
        leaf = [Q(-.040, .011, .724), Q(-.151, .011, .865),
                Q(-.144, .011, 1.045), Q(-.086, .011, 1.095),
                Q(.038, .011, .917), Q(.012, .011, .793)]
        focus = b.panel('Greenheart source broad connected faceted staff leaf', leaf,
                        .046 * scale, 'moss', weapon, .058 * scale)
        focus['connectedStaffFocus'] = True
        endpoint(weapon, 'staff_tip', Q(-.058, .025, .905))
        endpoint(weapon, 'attack_muzzle', Q(-.058, .065, .905))
        b.root['staffFocusContract'] = 'connected-wood-fork-leaf-v3'

    else:
        head = node('head_pivot')
        assert head is not None
        remove(head, ('Observed face nature', 'Construct square eye'))
        dark = fresh_material('nature_spirit_recess', '233d27')
        bark = fresh_material('nature_spirit_bark', '51653c')
        glow = fresh_material('nature_spirit_luminous', '8fd684', .72)
        # A closed thick leaf mask has a physical recessed cavity. Its tapered
        # chin, faceted brow and inner walls replace the human skin rectangle;
        # the source antlers, leaf hood, trunk and hovering crystals stay exact.
        outline = [(0, 1.505), (.130, 1.463), (.218, 1.365),
                   (.183, 1.241), (0, 1.148), (-.183, 1.241),
                   (-.218, 1.365), (-.130, 1.463)]
        inner = [(x * .77, 1.328 + (z - 1.328) * .78) for x, z in outline]
        count = len(outline)
        front = [(x, .257, z) for x, z in outline]
        back = [(x, .125, z) for x, z in outline]
        lip = [(x, .254, z) for x, z in inner]
        cavity = [(x, .165, z) for x, z in inner]
        vertices = front + back + lip + cavity
        faces = []
        for i in range(count):
            j = (i + 1) % count
            faces.extend([(i, j, count + j, count + i),
                          (i, count * 2 + i, count * 2 + j, j),
                          (count * 2 + i, count * 3 + i, count * 3 + j, count * 2 + j),
                          (count + i, count + j, count * 3 + j, count * 3 + i)])
        mask = b.mesh('Nature spirit physical leaf head mask with hollow recess',
                      vertices, faces, bark, head)
        mask['natureSpiritFace'] = True
        b.panel('Nature spirit deep opaque face cavity', cavity, .025, dark, head)
        # The new spirit mask has a real organic support inside the existing
        # opaque leaf hood. Its lower trunk contact and upper chin contact are
        # physical surfaces, not an empty head pivot or a floating face plate.
        b.limb('Nature spirit concealed root neck branch',
               [(0, 0, 1.105), (0, .120, 1.215)],
               [.080, .080], 'wood', head, 8)
        # Non-square leaf eyes glow from within the actual dark cavity.
        for sign in (-1, 1):
            x = sign * .084
            eye = [(x - sign * .055, .194, 1.350),
                   (x + sign * .039, .194, 1.377),
                   (x + sign * .050, .194, 1.360),
                   (x - sign * .034, .194, 1.339)]
            ob = b.panel('Nature spirit luminous almond leaf eye', eye,
                         .012, glow, head, .007)
            ob['visualCue'] = 'natureSpiritEyes'
            b.limb('Nature spirit carved brow root',
                   [(x - sign * .061, .237, 1.385),
                    (x + sign * .048, .237, 1.402)],
                   [.015, .018], 'wood', head, 5)
        b.root['faceOverrideV3'] = 'ethereal-leaf-spirit'
        b.root['natureSpiritFaceContract'] = 'recessed-leaf-mask-no-human-skin-v3'

    b.root['sourceFitV3Revision'] = revision
    return True
