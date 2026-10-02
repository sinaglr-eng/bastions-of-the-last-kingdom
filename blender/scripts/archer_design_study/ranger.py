"""Editable low-poly hooded archer study, facing +Y.  No scene side effects."""
import math
import bpy
import bmesh
from mathutils import Vector


def build(collection, materials):
    objects = []

    def mesh(name, verts, faces, material):
        data = bpy.data.meshes.new('Ranger_' + name + '_mesh')
        data.from_pydata(verts, [], faces)
        data.update()
        bm = bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new('Ranger_' + name, data)
        collection.objects.link(obj)
        if material:
            obj.data.materials.append(materials[material])
        for poly in data.polygons:
            poly.use_smooth = False
        obj['design'] = '03 Hooded Ranger'
        obj['part'] = name
        objects.append(obj)
        return obj

    # Octagonal, continuous sections create faceted cloth and anatomy without
    # spheres at the joints.  Dimensions are half-width and half-depth.
    section = [(-.66, 1), (.66, 1), (1, .50), (1, -.54),
               (.66, -1), (-.66, -1), (-1, -.54), (-1, .50)]

    def rings(name, rows, material):
        verts = [(x + rx * sx, y + ry * sy, z)
                 for x, y, z, rx, ry in rows for sx, sy in section]
        faces = [tuple(reversed(range(8)))]
        for j in range(len(rows) - 1):
            for i in range(8):
                faces.append((j * 8 + i, j * 8 + (i + 1) % 8,
                              (j + 1) * 8 + (i + 1) % 8,
                              (j + 1) * 8 + i))
        faces.append(tuple((len(rows) - 1) * 8 + i for i in range(8)))
        return mesh(name, verts, faces, material)

    def limb(name, nodes, material, sides=8):
        # Constant cross-section orientation produces the clean polygon bands
        # visible in the concept, even as an elbow changes direction.
        centers = [Vector(p[:3]) for p in nodes]
        verts = []
        for j, node in enumerate(nodes):
            tangent = centers[min(j + 1, len(nodes) - 1)] - centers[max(0, j - 1)]
            tangent.normalize()
            axis = Vector((0, 1, 0))
            if abs(axis.dot(tangent)) > .95:
                axis = Vector((1, 0, 0))
            u = tangent.cross(axis).normalized()
            v = tangent.cross(u).normalized()
            for i in range(sides):
                a = 2 * math.pi * (i + .5) / sides
                p = centers[j] + u * math.cos(a) * node[3] + v * math.sin(a) * node[4]
                verts.append(tuple(p))
        faces = [tuple(reversed(range(sides)))]
        for j in range(len(nodes) - 1):
            for i in range(sides):
                faces.append((j * sides + i, j * sides + (i + 1) % sides,
                              (j + 1) * sides + (i + 1) % sides,
                              (j + 1) * sides + i))
        faces.append(tuple((len(nodes) - 1) * sides + i for i in range(sides)))
        return mesh(name, verts, faces, material)

    def solid_panel(name, outline, depth, material, triangulated=False):
        n = len(outline)
        verts = list(outline) + [(x, y - depth, z) for x, y, z in outline]
        if triangulated:
            center = tuple(sum(p[k] for p in outline) / n for k in range(3))
            verts.extend([center, (center[0], center[1] - depth, center[2])])
            faces = [(i, (i + 1) % n, 2 * n) for i in range(n)]
            faces += [(n + (i + 1) % n, n + i, 2 * n + 1) for i in range(n)]
        else:
            faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
        faces += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
        return mesh(name, verts, faces, material)

    # Tall boots: a single mesh per boot, including the ankle and plain cuff.
    for sign, label in [(-1, 'Left'), (1, 'Right')]:
        foot_x = sign * .163
        # Foot projects forward; the slight asymmetric toe makes the idle stance
        # read naturally from an isometric game camera.
        toe_offset = sign * .016
        outline = [(-.054, .203), (.059, .203), (.084, .118),
                   (.080, -.025), (.054, -.067), (-.054, -.067),
                   (-.078, -.017), (-.078, .129)]
        verts = []
        for z, scale, shift in [(.12, 1, 0), (.16, 1, 0), (.23, .72, -.034)]:
            verts += [(foot_x + toe_offset + x * scale, y * scale + shift, z)
                      for x, y in outline]
        # Blend the broad toe into a narrow ankle and then broaden at the calf.
        for z, rx, ry, cx, cy in [(.285, .059, .065, foot_x, -.006),
                                 (.39, .063, .070, foot_x, -.014),
                                 (.56, .086, .091, foot_x - sign * .006, -.005),
                                 (.596, .091, .098, foot_x - sign * .006, -.002)]:
            verts += [(cx + rx * sx, cy + ry * sy, z) for sx, sy in section]
        faces = [tuple(reversed(range(8)))]
        for j in range(6):
            faces += [(j * 8 + i, j * 8 + (i + 1) % 8,
                       (j + 1) * 8 + (i + 1) % 8, (j + 1) * 8 + i)
                      for i in range(8)]
        faces.append(tuple(48 + i for i in range(8)))
        mesh(label + '_Boot', verts, faces, 'boots')
        rings(label + '_Boot_Cuff', [
            (foot_x - sign * .006, -.002, .581, .094, .100),
            (foot_x - sign * .006, -.002, .607, .097, .103),
        ], 'boots')
        rings(label + '_Trouser', [
            (foot_x, -.005, .575, .062, .062),
            (sign * .147, .024, .652, .063, .066),
            (sign * .122, .013, .83, .079, .079),
            (sign * .102, -.008, 1.035, .062, .075),
        ], 'trousers')

    rings('Fitted_Tunic_Bodice', [
        (0, -.008, 1.061, .148, .097),
        (0, -.008, 1.18, .154, .106),
        (0, -.008, 1.40, .210, .123),
        (0, -.016, 1.503, .221, .114),
        (0, -.016, 1.552, .096, .081),
    ], 'blue')

    # One skirt extends directly from the belt around the back and both sides.
    # The open strip ends at the front produce two natural hanging tunic tails.
    # Three rows give the cloth a waist, a gentle flare, and a pointed hem.
    skirt_rows = [
        [(-.002, .102, 1.136), (-.097, .102, 1.136),
         (-.151, .048, 1.136), (-.151, -.064, 1.136),
         (-.097, -.113, 1.136), (0, -.113, 1.136),
         (.097, -.113, 1.136), (.151, -.064, 1.136),
         (.151, .048, 1.136), (.097, .102, 1.136), (.002, .102, 1.136)],
        [(-.012, .130, .988), (-.110, .140, .988),
         (-.187, .058, .995), (-.187, -.079, .995),
         (-.121, -.142, .990), (0, -.142, .990),
         (.121, -.142, .990), (.187, -.079, .995),
         (.187, .058, .995), (.110, .140, .988), (.012, .130, .988)],
        [(-.027, .146, .800), (-.090, .143, .778),
         (-.224, .068, .857), (-.220, -.095, .837),
         (-.147, -.167, .824), (0, -.167, .826),
         (.147, -.167, .824), (.220, -.095, .837),
         (.224, .068, .857), (.090, .143, .778), (.027, .146, .800)],
    ]
    front = [p for row in skirt_rows for p in row]
    verts = front + [(x * .965, y * .94, z) for x, y, z in front]
    n = len(front)
    faces = []
    for row in range(2):
        for col in range(10):
            a = row * 11 + col
            faces += [(a, a + 1, a + 12, a + 11),
                      (n + a + 11, n + a + 12, n + a + 1, n + a)]
    perimeter = list(range(11)) + [21, 32] + list(range(31, 21, -1)) + [11]
    faces += [(a, n + a, n + perimeter[(i + 1) % len(perimeter)],
               perimeter[(i + 1) % len(perimeter)]) for i, a in enumerate(perimeter)]
    skirt = mesh('Continuous_Split_Tunic_Skirt', verts, faces, 'blue')
    for label, indices in [('Left_Front_Tail', [0, 1, 2, 11, 12, 13, 22, 23, 24]),
                           ('Right_Front_Tail', [8, 9, 10, 19, 20, 21, 30, 31, 32])]:
        group = skirt.vertex_groups.new(name=label)
        group.add(indices + [n + index for index in indices], 1.0, 'REPLACE')

    rings('Plain_Leather_Belt', [
        (0, -.014, 1.079, .161, .108),
        (0, -.014, 1.148, .165, .113),
    ], 'belt')
    solid_panel('Single_Pale_Buckle', [(-.025, .107, 1.072),
                                      (.025, .107, 1.072),
                                      (.025, .107, 1.157),
                                      (-.025, .107, 1.157)], .016, 'buckle')

    rings('Neck', [(0, .021, 1.52, .054, .054),
                   (0, .021, 1.754, .063, .058)], 'skin')

    # Downward free arm, continuous elbow; bow arm reaches outward gently.
    limb('Right_Sleeve', [(.219, -.012, 1.422, .087, .089),
                         (.281, .005, 1.307, .077, .076),
                         (.346, .033, 1.099, .063, .064)], 'trousers')
    limb('Right_Long_Bracer', [(.342, .033, 1.108, .072, .072),
                             (.354, .043, .956, .052, .056)], 'boots')
    limb('Right_Glove_Mitten', [(.354, .043, .966, .054, .056),
                              (.367, .057, .887, .063, .059),
                              (.362, .070, .850, .043, .041)], 'boots')
    limb('Right_Glove_Thumb', [(.324, .076, .927, .025, .027),
                             (.313, .097, .866, .023, .023)], 'boots', 6)

    limb('Left_Sleeve', [(-.219, -.012, 1.423, .086, .087),
                        (-.300, .009, 1.301, .078, .076),
                        (-.374, .049, 1.181, .067, .064),
                        (-.448, .069, 1.155, .061, .060)], 'trousers')
    limb('Left_Long_Bracer', [(-.429, .064, 1.162, .069, .068),
                            (-.577, .094, 1.145, .052, .055)], 'boots')
    limb('Left_Bow_Grip_Mitten', [(-.573, .095, 1.145, .059, .058),
                                (-.635, .111, 1.137, .067, .065),
                                (-.670, .108, 1.142, .053, .052)], 'boots')
    limb('Left_Bow_Grip_Thumb', [(-.604, .139, 1.177, .025, .027),
                               (-.650, .140, 1.159, .025, .026)], 'boots', 6)

    # Broad cape, four simple lengthwise facets and a clean central point.
    rows = [(1.550, .269, -.170), (1.28, .274, -.179),
            (1.015, .326, -.228), (.802, .369, -.269)]
    cols = [-1, -.49, 0, .49, 1]
    front = []
    for row_idx, (z, width, y) in enumerate(rows):
        for c in cols:
            lower_z = z
            if row_idx == 0:
                lower_z -= .063 * abs(c)
            if row_idx == len(rows) - 1:
                lower_z -= .102 * (1 - abs(c))
            front.append((c * width, y - .025 * (1 - abs(c)), lower_z))
    verts = front + [(x, y - .026, z) for x, y, z in front]
    n = len(front)
    faces = []
    for j in range(3):
        for i in range(4):
            a = j * 5 + i
            faces += [(a, a + 1, a + 6, a + 5),
                      (n + a + 5, n + a + 6, n + a + 1, n + a)]
    perimeter = [0, 1, 2, 3, 4, 9, 14, 19, 18, 17, 16, 15, 10, 5]
    faces += [(a, n + a, n + perimeter[(i + 1) % len(perimeter)],
               perimeter[(i + 1) % len(perimeter)]) for i, a in enumerate(perimeter)]
    mesh('Broad_Pointed_Back_Cape', verts, faces, 'blue')

    # A single annular shoulder garment has one clean connected silhouette.
    # Its rear edge meets the cape beneath the hood, while its side edge drapes
    # over the sleeves.  No stacked panels or decorative shard-like wrinkles.
    neck_ring = [(0, .105, 1.600), (.078, .074, 1.595),
                 (.113, 0, 1.584), (.079, -.086, 1.598),
                 (0, -.118, 1.598), (-.079, -.086, 1.598),
                 (-.113, 0, 1.584), (-.078, .074, 1.595)]
    shoulder_ring = [(0, .164, 1.501), (.209, .122, 1.464),
                     (.315, .016, 1.406), (.269, -.158, 1.488),
                     (0, -.192, 1.550), (-.269, -.158, 1.488),
                     (-.315, .016, 1.406), (-.209, .122, 1.464)]
    top = neck_ring + shoulder_ring
    verts = top + [(x, y, z - .015) for x, y, z in top]
    faces = []
    for i in range(8):
        k = (i + 1) % 8
        faces += [(i, k, 8 + k, 8 + i),
                  (16 + i, 24 + i, 24 + k, 16 + k),
                  (i, 16 + i, 16 + k, k),
                  (8 + i, 8 + k, 24 + k, 24 + i)]
    mesh('Continuous_Shoulder_Mantle', verts, faces, 'blue')

    # A deliberately polygonal face; the very shallow central ridge is the nose.
    boundary = [(-.098, .165, 1.948), (.098, .165, 1.948),
                (.119, .170, 1.864), (.089, .174, 1.762),
                (.038, .186, 1.716), (-.038, .186, 1.716),
                (-.089, .174, 1.762), (-.119, .170, 1.864)]
    boundary = [(x * 1.10, y, 1.831 + (z - 1.831) * 1.10) for x, y, z in boundary]
    verts = boundary + [(x * .88, -.062, z) for x, y, z in boundary]
    verts += [(0, .201, 1.820), (0, -.080, 1.831)]
    faces = [(i, (i + 1) % 8, 16) for i in range(8)]
    faces += [(8 + (i + 1) % 8, 8 + i, 17) for i in range(8)]
    faces += [(i, 8 + i, 8 + (i + 1) % 8, (i + 1) % 8) for i in range(8)]
    mesh('Angular_Face', verts, faces, 'skin')
    for sign, label in [(-1, 'Left'), (1, 'Right')]:
        eye_outline = [
            (sign * .039, .189, 1.879),
            (sign * .082, .180, 1.896),
            (sign * .079, .183, 1.864),
            (sign * .067, .188, 1.851),
            (sign * .049, .192, 1.856),
        ]
        eye_outline = [(x * 1.10, y + .002, 1.831 + (z - 1.831) * 1.10)
                       for x, y, z in eye_outline]
        solid_panel(label + '_Expressive_Eye', eye_outline, .007, 'eyes')

    # Hood: an open front annulus, deep navy lining, and a closed pointed back.
    # No polygon crosses the face opening.
    outer = [(0, .019, 2.140), (.127, .049, 2.057),
             (.217, .088, 1.966), (.284, .106, 1.746),
             (.210, .151, 1.635), (0, .181, 1.570),
             (-.210, .151, 1.635), (-.284, .106, 1.746),
             (-.217, .088, 1.966), (-.127, .049, 2.057)]
    opening = [(0, .201, 1.982), (.101, .205, 1.944),
               (.143, .202, 1.893), (.203, .185, 1.743),
               (.135, .181, 1.651), (0, .184, 1.588),
               (-.135, .181, 1.651), (-.203, .185, 1.743),
               (-.143, .202, 1.893), (-.101, .205, 1.944)]
    back = [(x * .92, -.174, z + (.012 if i in (0, 1, 9) else 0))
            for i, (x, y, z) in enumerate(outer)]
    verts = outer + opening + back + [(0, -.267, 1.854)]
    faces = []
    for i in range(10):
        k = (i + 1) % 10
        faces += [(i, k, 10 + k, 10 + i),
                  (i, 20 + i, 20 + k, k),
                  (20 + i, 30, 20 + k)]
    mesh('Pointed_Open_Hood_Shell', verts, faces, 'blue')
    interior = [(x * .92, -.109, z) for x, y, z in opening]
    verts = opening + interior + [(0, -.122, 1.801)]
    faces = []
    for i in range(10):
        k = (i + 1) % 10
        faces += [(i, k, 10 + k, 10 + i), (10 + i, 10 + k, 20)]
    mesh('Deep_Hood_Interior', verts, faces, 'navy')

    # A continuous mildly recurved wooden strip, idle in the left mitten.
    control = [(-.639, .245), (-.622, .315), (-.635, .412),
               (-.692, .625), (-.726, .829), (-.694, 1.024),
               (-.650, 1.139), (-.691, 1.317), (-.746, 1.554),
               (-.741, 1.750), (-.681, 1.948), (-.650, 2.043),
               (-.666, 2.104)]
    path = []
    # Cubic interpolation keeps the bow one continuous readable silhouette.
    for i in range(len(control) - 1):
        p0 = Vector(control[max(0, i - 1)])
        p1 = Vector(control[i])
        p2 = Vector(control[i + 1])
        p3 = Vector(control[min(len(control) - 1, i + 2)])
        for j in range(3):
            t = j / 3
            p = .5 * ((2 * p1) + (-p0 + p2) * t +
                       (2*p0 - 5*p1 + 4*p2 - p3) * t*t +
                       (-p0 + 3*p1 - 3*p2 + p3) * t*t*t)
            path.append(p)
    path.append(Vector(control[-1]))
    verts = []
    for i, point in enumerate(path):
        tangent = (path[min(len(path) - 1, i + 1)] - path[max(0, i - 1)]).normalized()
        normal = Vector((-tangent.y, tangent.x))
        t = i / (len(path) - 1)
        half_width = .018 + .009 * math.sin(math.pi * t)
        for a, y in [(-1, .083), (1, .083), (1, .119), (-1, .119)]:
            p = point + normal * a * half_width
            verts.append((p.x, y, p.y))
    faces = [(3, 2, 1, 0)]
    for i in range(len(path) - 1):
        faces += [(4*i+j, 4*i+(j+1)%4, 4*(i+1)+(j+1)%4, 4*(i+1)+j)
                  for j in range(4)]
    faces.append(tuple(4 * (len(path) - 1) + j for j in range(4)))
    mesh('Continuous_Recurve_Bow', verts, faces, 'wood')
    limb('Taut_Bow_String', [(control[0][0], .101, control[0][1], .0024, .0024),
                             (control[-1][0], .101, control[-1][1], .0024, .0024)],
         'fletching', 6)

    # Plain narrow quiver sits diagonally against the back, with three arrows.
    limb('Diagonal_Rear_Quiver', [(.176, -.289, 1.125, .056, .047),
                                 (.269, -.263, 1.611, .074, .056),
                                 (.278, -.261, 1.672, .075, .057)], 'wood', 4)
    limb('Quiver_Top_Rim', [(.272, -.261, 1.641, .080, .062),
                           (.279, -.259, 1.680, .080, .062)], 'belt', 4)
    for i, (dx, dz) in enumerate([(-.043, .008), (0, .048), (.043, .023)], 1):
        start = Vector((.228 + dx, -.270, 1.480))
        end = Vector((.320 + dx * 1.22, -.259, 1.902 + dz))
        limb('Arrow_%d_Shaft' % i, [(*start, .0058, .0058), (*end, .0058, .0058)],
             'wood', 6)
        d = (end - start).normalized()
        low = end - d * .130
        high = end - d * .015
        across = Vector((1, 0, 0))
        across = (across - d * across.dot(d)).normalized()
        for vane, axis in enumerate((across, Vector((0, 1, 0))), 1):
            v = [tuple(low), tuple(low + axis * .028 + d * .025),
                 tuple(high + axis * .025), tuple(end),
                 tuple(high - axis * .025), tuple(low - axis * .028 + d * .025)]
            obj = mesh('Arrow_%d_Ivory_Fletching_%d' % (i, vane), v,
                       [(0, 1, 2, 3, 4, 5)], 'fletching')
            mod = obj.modifiers.new('Fletching_thickness', 'SOLIDIFY')
            mod.thickness = .003
    return objects
