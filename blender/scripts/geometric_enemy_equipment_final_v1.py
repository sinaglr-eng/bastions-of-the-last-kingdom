"""Bounded, physical equipment repairs from the final six-view enemy sources.

Call after humanoid decoration/equipment. Coordinates follow the native author:
+Y faces front, +X is anatomical right, Z is up. Only explicitly owned equipment
meshes are replaced; every existing hand, shoulder, head and weapon pivot stays.
No gameplay/stat field is changed. The module writes no export or manifest.
"""


def apply_source_equipment_final(b, row, c):
    import bpy
    from mathutils import Vector
    from geometric_game_common import linear
    from geometric_roster_builder import ell, gear, mask_skull, skull

    wave = row['spec'].get('wave', 0)
    if wave not in (4, 10, 20, 36, 41):
        return False
    revision = 'source-equipment-final-v1'
    if b.root.get('sourceEquipmentFinalRevision') == revision:
        return False
    P, SZ = c['P'], c['SZ']
    scale, tw, sh = c['scale'], c['tw'], c['shoulder']
    torso, head = c['torso'], c['head']

    def below(ob, parent):
        node = ob.parent
        while node:
            if node == parent:
                return True
            node = node.parent
        return False

    def remove(parent, prefixes):
        # Never remove pivots, hand skin, unrelated meshes or shared materials.
        for ob in list(b.objects):
            name = ob.get('semanticPart', ob.name)
            if ob.type == 'MESH' and below(ob, parent) and name.startswith(prefixes):
                mesh = ob.data
                b.objects.remove(ob)
                bpy.data.objects.remove(ob, do_unlink=True)
                if mesh.users == 0:
                    bpy.data.meshes.remove(mesh)

    def endpoint(parent, name, position):
        nodes = [ob for ob in b.coll.all_objects
                 if ob.type == 'EMPTY' and below(ob, parent)
                 and ob.name.split('.')[0] == name]
        node = nodes[0] if nodes else b.pivot(name, position, parent)
        bpy.context.view_layer.update()
        matrix = node.matrix_world.copy()
        matrix.translation = Vector(position)
        node.matrix_world = matrix
        return node

    def material(key, color):
        if key not in b.M:
            rgba = tuple(linear(int(color[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1,)
            mat = bpy.data.materials.new(key)
            mat.use_nodes = True
            mat.diffuse_color = rgba
            mat['source_srgb'] = '#' + color
            shader = mat.node_tree.nodes['Principled BSDF']
            shader.inputs['Base Color'].default_value = rgba
            shader.inputs['Roughness'].default_value = .43
            b.M[key] = mat
            b.palette[key] = color
        return key

    def shoulder(side, tiers):
        arm = c['arms']['R' if side > 0 else 'L']
        remove(arm, ('Shoulder plate ',))
        for j in range(tiers):
            # The old .19 front plane was inside the ogre's .24-deep actual
            # shoulder. Both surfaces and the top binding now wrap its real
            # outside, so the source metal remains visible in BACK as well.
            x = side * (tw + (.13 if tiers == 1 else .075) + j * .025)
            z = sh + (-.085 if tiers == 1 else .050) - j * .100
            w = (.35 if tiers == 1 else .37) + j * .018
            top, bottom = (.070, -.195) if tiers == 1 else (.070, -.110)
            front, rear = (.175, -.140) if tiers == 1 else (.285 + j * .006, -.270 - j * .006)
            for y in (front, rear):
                outline = [P((x - w / 2, y, z + top)),
                           P((x + w / 2, y, z + top - .025)),
                           P((x + w / 2, y, z + bottom)),
                           P((x - w / 2, y, z + bottom + .020))]
                b.panel('Source layered riveted shoulder iron', outline, .042 * scale,
                        'steel', arm)
                for dx, dz in ((-.112, top - .036), (.112, top - .041),
                               (-.112, bottom + .032), (.112, bottom + .032)):
                    yy = y + (.018 if y > 0 else -.058)
                    ell(b, 'Source shoulder actual exposed rivet',
                        P((x + dx, yy, z + dz)), SZ((.020, .018, .020)),
                        'steel_dark', arm, 6, 2)
            b.box('Source shoulder metal top continuous wrap',
                  P((x, (front + rear) / 2, z + top - .012)),
                  SZ((w, front - rear, .048)), 'steel', .010 * scale, arm)

    def clear_main_weapon():
        pa = c['weapons']['R']
        remove(pa, ('Connected hammer handle', 'Connected ram handle',
                    'Massive transverse hammer head', 'Massive transverse ram head',
                    'Hammer metal end binding'))
        return pa, c['hands']['R']

    if wave == 4:
        remove(head, ('Scrap helmet actual gear',))
        # Real crank and braced wooden crate sit behind the torso, not the head.
        for xx in (-.095, .315):
            b.box('Scrap backpack rear vertical iron binding',
                  P((xx, -.511, sh - .13)), SZ((.040, .040, .57)),
                  'steel_dark', .007 * scale, torso)
        for zz in (sh + .095, sh - .34):
            b.box('Scrap backpack rear horizontal iron binding',
                  P((.11, -.534, zz)), SZ((.48, .030, .054)),
                  'steel', .006 * scale, torso)
            for xx in (-.085, .305):
                ell(b, 'Scrap backpack exposed fastening bolt', P((xx, -.558, zz)),
                    SZ((.019, .015, .019)), 'steel_dark', torso, 6, 2)
        gx = tw + .075
        b.rod('Scrap backpack raised wooden gear support', P((gx, -.39, sh + .075)),
              P((gx, -.48, sh + .41)), .040 * scale, 'wood', torso, 6)
        gear(b, 'Source backpack top actual cogwheel', P((gx, -.50, sh + .43)),
             .145 * scale, 'steel_dark', torso)
        b.rod('Scrap backpack crank axle', P((-.13, -.39, sh - .12)),
              P((-.34, -.39, sh - .12)), .036 * scale, 'steel_dark', torso, 6)
        b.rod('Scrap backpack crank offset arm', P((-.34, -.39, sh - .12)),
              P((-.34, -.39, sh - .25)), .028 * scale, 'steel_dark', torso, 6)
        b.rod('Scrap backpack actual crank grip', P((-.34, -.39, sh - .25)),
              P((-.47, -.39, sh - .25)), .038 * scale, 'wood', torso, 6)
        shoulder(-1, 1)

    elif wave == 10:
        pa, (x, y, z) = clear_main_weapon()
        b.rod('Gatebreaker source skull mace wooden handle',
              (x, y, z - .25 * scale), (x, y, z + .43 * scale),
              .043 * scale, 'wood', pa, 8)
        for zz in (z - .15 * scale, z + .32 * scale):
            b.box('Gatebreaker iron mace hilt binding', (x, y, zz),
                  SZ((.115, .105, .070)), 'steel_dark', .010 * scale, pa)
        center = (x, y + .045 * scale, z + .53 * scale)
        ell(b, 'Gatebreaker closed iron skull mace cranium', center,
            SZ((.225, .18, .235)), ['steel_dark', 'steel'], pa, 8, 3)
        before = set(b.objects)
        mask_skull(b, (x, y + .225 * scale, center[2]), .225 * scale, pa)
        for ob in set(b.objects) - before:
            for slot in ob.material_slots:
                if slot.material == b.M['ivory']:
                    slot.material = b.M['steel']
            ob['semanticPart'] = 'Gatebreaker mace ' + ob.get('semanticPart', ob.name)
        endpoint(pa, 'attack_muzzle', (x, y + .305 * scale, center[2]))
        shoulder(-1, 3)
        shoulder(1, 3)

    elif wave == 20:
        pa, (x, y, z) = clear_main_weapon()
        b.rod('Bone Patriarch physical segmented staff shaft',
              (x, y, z - .29 * scale), (x, y, z + .85 * scale),
              .027 * scale, 'wood', pa, 6)
        for j in range(5):
            skull(b, (x, y + .008 * scale, z + (.16 + j * .145) * scale),
                  .085 * scale, pa)
        b.box('Bone Patriarch staff ivory foot ferrule',
              (x, y, z - .265 * scale), SZ((.080, .075, .100)),
              'ivory', .014 * scale, pa)
        endpoint(pa, 'staff_tip', (x, y + .058 * scale, z + .83 * scale))
        endpoint(pa, 'attack_muzzle', (x, y + .063 * scale, z + .83 * scale))
        b.root['attackStyle'] = 'staff'

    elif wave in (36, 41):
        pa = c['weapons']['L']
        x, y, z = c['hands']['L']
        z -= .03 * scale
        remove(pa, ('Shield real back and rim', 'Shield inset front',
                    'Shield diamond emblem', 'Shield small relief', 'Shield raised jewel',
                    'Shield front diamond boss'))
        # Include the generic emblem by its exact semantic family; leave FX
        # pivot and its refraction stones intact until the explicit 41 rebuild.
        remove(pa, ('Shield central ',))
        if wave == 36:
            # A genuinely missing jagged edge. The closed concave prism has
            # no fake dark line across a complete, otherwise unbroken shield.
            offsets = [(-.262, .352), (0, .448), (.262, .352),
                       (.231, .228), (.112, .179), (.223, .092),
                       (.098, .020), (.218, -.071), (.139, -.120),
                       (.221, -.224), (0, -.504), (-.221, -.224)]
            outline = [(x + dx * scale, y + .160 * scale, z + dz * scale)
                       for dx, dz in offsets]
            b.panel('Oathbreaker actual broken black shield volume', outline,
                    .075 * scale, 'dark', pa)
            for j in range(len(outline)):
                a = Vector(outline[j]) + Vector((0, .017 * scale, 0))
                q = Vector(outline[(j + 1) % len(outline)]) + Vector((0, .017 * scale, 0))
                b.rod('Oathbreaker gold rim along real fractured boundary',
                      a, q, .016 * scale, 'gold', pa, 5)
            cy, cz = y + .205 * scale, z + .010 * scale
            crest = [(x + dx * scale, cy, cz + dz * scale)
                     for dx, dz in [(-.13, -.060), (-.155, .110), (-.065, .016),
                                    (0, .155), (.065, .016), (.155, .110), (.13, -.060)]]
            b.panel('Oathbreaker actual raised golden crown shield crest', crest,
                    .028 * scale, 'gold', pa)
            b.box('Oathbreaker crown continuous lower band', (x, cy + .008 * scale, cz - .052 * scale),
                  SZ((.27, .038, .033)), 'gold', .005 * scale, pa)
        else:
            remove(pa, ('Shield separate protective node',))
            main = material('source_crystal_shield_cyan', '719E9F')
            light = material('source_crystal_shield_light', '9FC7C5')
            outline = [(x + dx * scale, y + .16 * scale, z + dz * scale)
                       for dx, dz in [(-.262, .352), (0, .448), (.262, .352),
                                      (.221, -.224), (0, -.504), (-.221, -.224)]]
            b.panel('Phalanx actual continuous cyan crystal shield', outline,
                    .075 * scale, [main, light], pa, .037 * scale)
            for j in range(len(outline)):
                a = Vector(outline[j]) + Vector((0, .018 * scale, 0))
                q = Vector(outline[(j + 1) % len(outline)]) + Vector((0, .018 * scale, 0))
                b.rod('Phalanx pale cyan cut crystal boundary', a, q,
                      .011 * scale, light, pa, 5)
            shards = next((ob for ob in b.coll.all_objects if ob.type == 'EMPTY'
                           and below(ob, pa) and ob.name.split('.')[0] == 'refraction_shards'), pa)
            for j in range(3):
                ob = b.jewel('Phalanx source upper protective crystal',
                             (x + (j - 1) * .12 * scale, y + .225 * scale,
                              z + (.450 if j == 1 else .375) * scale),
                             .048 * scale, .073 * scale, .039 * scale, 'rune', shards)
                ob['visualCue'] = 'refraction'

    b.root['sourceEquipmentFinalRevision'] = revision
    return True
