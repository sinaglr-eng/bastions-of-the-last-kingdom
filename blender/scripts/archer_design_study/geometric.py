"""Editable, primitive-only geometric Archer concept.

Front is +Y, feet sit on Z=.12, and the cap peaks at Z=2.12.
No scene state is cleared; every component belongs to the supplied collection.
"""

import bpy
from mathutils import Vector


def _mesh(collection, name, vertices, faces, material, bevel=0.014):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Geo_" + name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Small_One_Segment_Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.affect = "EDGES"
        mod.limit_method = "ANGLE"
        mod.angle_limit = 0.35
        mod.harden_normals = True
        normal = obj.modifiers.new("Weighted_Flat_Normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        normal.weight = 40
    return obj


def _box(collection, name, center, size, material, bevel=0.014,
         top_width=None, top_depth=None):
    x, y, z = center
    w, d, h = size
    wt = w if top_width is None else top_width
    dt = d if top_depth is None else top_depth
    verts = [(x + sx * ww / 2, y + sy * dd / 2, z + zz * h / 2)
             for ww, dd, zz in ((w, d, -1), (wt, dt, 1))
             for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return _mesh(collection, name, verts, faces, material, bevel)


def _beam(collection, name, start, end, width, depth, material,
          bevel=0.014, end_width=None, end_depth=None):
    start, end = Vector(start), Vector(end)
    axis = end - start
    obj = _box(collection, name, (0, 0, 0), (width, depth, axis.length),
               material, bevel, end_width, end_depth)
    obj.location = (start + end) / 2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = axis.to_track_quat("Z", "Y")
    return obj


def _boot(collection, name, x, material):
    # A single broad block toe: the upper toe slopes, never a separate sphere.
    section = [(-0.16, .12), (.235, .12), (.235, .225),
               (.105, .295), (-.16, .295)]
    verts = [(x + side * .117, y, z)
             for side in (-1, 1) for y, z in section]
    n = len(section)
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    return _mesh(collection, name, verts, faces, material)


def _angular_bow(collection, material):
    # The limbs and grip are one continuous extruded angular profile.
    points = [(-.535, .255), (-.710, .570), (-.745, 1.225),
              (-.655, 1.675), (-.535, 2.120)]
    widths = [.055, .070, .085, .078, .057]
    left, right = [], []
    for i, (x, z) in enumerate(points):
        a = Vector(points[max(0, i-1)])
        b = Vector(points[min(len(points)-1, i+1)])
        tangent = (b-a).normalized()
        normal = Vector((-tangent.y, tangent.x))
        offset = normal * widths[i] / 2
        left.append((x + offset.x, z + offset.y))
        right.append((x - offset.x, z - offset.y))
    outline = left + list(reversed(right))
    n = len(outline)
    verts = [(x, y, z) for y in (.024, .100) for x, z in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    return _mesh(collection, "Angular_Bow_Continuous_Limbs", verts, faces,
                 material, bevel=.008)


def build(collection, materials):
    """Create semantic editable meshes, returning only this model's objects."""
    objects = []

    def add(obj):
        objects.append(obj)
        return obj

    # Two short sturdy legs and broad forward-facing block boots.
    for x, side in ((.169, "Right"), (-.169, "Left")):
        add(_boot(collection, side + "_Block_Boot_Toe", x, materials["boots"]))
        add(_box(collection, side + "_Boot_Shaft", (x, -.022, .405),
                 (.201, .242, .252), materials["boots"]))
        add(_box(collection, side + "_Blue_Trouser_Leg", (x, -.007, .638),
                 (.213, .272, .322), materials["blue"],
                 top_width=.228, top_depth=.278))

    # Minimal tunic: one taper above, one flare below, one plain belt.
    add(_box(collection, "Flared_Lower_Tunic", (0, 0, .839),
             (.640, .444, .205), materials["blue"],
             top_width=.551, top_depth=.397))
    add(_box(collection, "Torso", (0, -.006, 1.174),
             (.553, .391, .492), materials["blue"],
             top_width=.565, top_depth=.412))
    add(_box(collection, "Flat_Front_Tunic_Panel", (0, .199, 1.184),
             (.502, .023, .423), materials["blue"], bevel=.010,
             top_width=.513))
    add(_box(collection, "Plain_Waist_Belt", (0, -.003, .947),
             (.574, .419, .078), materials["belt"], bevel=.007))
    add(_box(collection, "Short_Neck", (0, .016, 1.412),
             (.237, .216, .099), materials["skin"], bevel=.010))

    # Relaxed right arm, bent left arm. Sleeve ends overlap at elbows.
    add(_beam(collection, "Right_Straight_Sleeve",
              (.317, -.005, 1.299), (.458, .012, .925),
              .199, .267, materials["blue"], end_width=.210,
              end_depth=.258))
    add(_box(collection, "Right_Square_Mitten", (.469, .025, .837),
             (.205, .238, .237), materials["skin"], bevel=.025,
             top_width=.189, top_depth=.223))
    add(_beam(collection, "Left_Upper_Angular_Sleeve",
              (-.318, -.006, 1.299), (-.477, .023, 1.082),
              .200, .256, materials["blue"], end_width=.191,
              end_depth=.246))
    add(_beam(collection, "Left_Raised_Forearm_Sleeve",
              (-.460, .026, 1.078), (-.638, .059, 1.065),
              .192, .244, materials["blue"], end_width=.179,
              end_depth=.231))
    add(_box(collection, "Left_Bow_Grip_Mitten", (-.699, .060, 1.049),
             (.209, .237, .225), materials["skin"], bevel=.025))

    # Big beveled cube head. Eyes are flush square dark tiles, no added nose.
    add(_box(collection, "Beveled_Cuboid_Head", (0, .035, 1.628),
             (.625, .504, .454), materials["skin"], bevel=.027))
    for x, side in ((.166, "Right"), (-.166, "Left")):
        add(_box(collection, side + "_Flat_Square_Eye", (x, .2885, 1.643),
                 (.059, .004, .072), materials["eyes"], bevel=0))

    # The cap is only a broad rectangular band and one triangular wedge.
    add(_box(collection, "Navy_Cap_Rectangular_Band", (0, .033, 1.884),
             (.681, .566, .177), materials["navy"], bevel=.012))
    cap_verts = [(-.339, -.249, 1.968), (.339, -.249, 1.968),
                 (.119, -.249, 2.120), (-.339, .315, 1.968),
                 (.339, .315, 1.968), (.119, .315, 2.120)]
    cap_faces = [(0, 1, 2), (5, 4, 3), (3, 4, 1, 0),
                 (4, 5, 2, 1), (5, 3, 0, 2)]
    add(_mesh(collection, "Navy_Cap_Simple_Wedge", cap_verts, cap_faces,
              materials["navy"], bevel=.004))

    # Plain diagonal rectangular quiver, three shafts, chunky ivory feathers.
    add(_beam(collection, "Rear_Rectangular_Quiver",
              (.224, -.247, 1.035), (.417, -.257, 1.595),
              .262, .182, materials["wood"], bevel=.012))
    for index, offset in enumerate((-.088, 0, .088), 1):
        shaft_start = Vector((.348+offset, -.305, 1.423))
        shaft_end = Vector((.498+offset, -.305, 1.900))
        add(_beam(collection, "Arrow_%02d_Square_Shaft" % index,
                  shaft_start, shaft_end, .027, .027,
                  materials["wood"], bevel=.003))
        direction = (shaft_end-shaft_start).normalized()
        feather_start = shaft_end-direction*.172
        add(_beam(collection, "Arrow_%02d_Chunky_Ivory_Fletching" % index,
                  feather_start, shaft_end+direction*.012, .078, .068,
                  materials["fletching"], bevel=.008))

    add(_angular_bow(collection, materials["wood"]))
    # String endpoints terminate exactly at the tip center positions.
    add(_beam(collection, "Taut_Thin_Bowstring", (-.535, .062, .255),
              (-.535, .062, 2.120), .007, .007,
              materials["belt"], bevel=0))

    for obj in objects:
        obj["design"] = "01 Geometric Archer"
        obj["modeling_note"] = "Editable flat mesh; consistent one-segment bevel"
    return objects
