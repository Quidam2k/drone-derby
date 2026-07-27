"""Shared Blender helpers for the Drone Derby art scripts.

`robots.py` (the four chassis) and `tiles.py` (the board tile kit) build their
geometry the same way, in the same conventions:

    1.0 = one board tile.  Z up, +Y = north.  No randomness, no clock.
    (glTF turns Blender +Z into three.js +Y and Blender +Y into three.js -Z,
    so a mesh modelled facing +Y arrives on the board facing north.)

Everything here was lifted out of `robots.py` when the tile kit needed the
same primitives, so there is exactly one place a bevel -- or a colour
conversion, or a Blender executable -- is defined.

Blender 3.6 is the target. The socket lookups also cover 4.x, where the
Principled BSDF renamed several of its inputs.
"""

import bpy
import math
import sys
from mathutils import Vector

# --------------------------------------------------------------------- args

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default


def flag(name):
    return name in ARGV


# ------------------------------------------------------------------- colors


def srgb(h):
    """Hex string -> linear RGB. Blender's colour sockets are linear."""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def set_input(node, names, value):
    """Set the first socket that exists. 4.x renamed several Principled inputs."""
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def mat(name, base, metallic=0.0, rough=0.4, emit=None, emit_strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    set_input(b, ['Base Color'], (*base, 1))
    set_input(b, ['Metallic'], metallic)
    set_input(b, ['Roughness'], rough)
    set_input(b, ['Clearcoat', 'Coat Weight'], coat)
    if emit:
        set_input(b, ['Emission', 'Emission Color'], (*emit, 1))
        set_input(b, ['Emission Strength'], emit_strength)
    return m


# ------------------------------------------------------------------ geometry


def finish(ob, material, bevel, segments):
    ob.data.materials.append(material)
    b = ob.modifiers.new('bevel', 'BEVEL')
    b.width = bevel
    b.segments = segments
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(30)
    b.harden_normals = True
    ob.data.use_auto_smooth = True
    ob.data.auto_smooth_angle = math.radians(40)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def frustum(name, bc, bs, bz, tc, ts, tz, material, bevel=0.02, segments=4):
    """Hexahedron from a bottom ring and a top ring, then bevelled.

    Sharp 90-degree edges are the single biggest tell that something was
    modelled rather than manufactured -- everything gets a bevel.
    """
    def ring(c, s, z):
        return [
            (c[0] - s[0] / 2, c[1] - s[1] / 2, z),
            (c[0] + s[0] / 2, c[1] - s[1] / 2, z),
            (c[0] + s[0] / 2, c[1] + s[1] / 2, z),
            (c[0] - s[0] / 2, c[1] + s[1] / 2, z),
        ]
    me = bpy.data.meshes.new(name)
    me.from_pydata(ring(bc, bs, bz) + ring(tc, ts, tz), [], [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
    ])
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return finish(ob, material, bevel, segments)


def box(name, center, size, material, bevel=0.014, segments=3):
    return frustum(name,
                   (center[0], center[1]), (size[0], size[1]), center[2] - size[2] / 2,
                   (center[0], center[1]), (size[0], size[1]), center[2] + size[2] / 2,
                   material, bevel, segments)


def cylinder(name, center, radius, depth, axis, material, verts=28, bevel=0.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius,
                                        depth=depth, location=center)
    ob = bpy.context.active_object
    ob.name = name
    if axis == 'x':
        ob.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'y':
        ob.rotation_euler = (math.radians(90), 0, 0)
    return finish(ob, material, bevel, 2)


def dome(name, center, radii, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=center)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = radii
    ob.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return ob


def strut(name, p0, p1, r, material, bevel=0.01):
    """Box spanning two 3D points -- legs, roll bars, arms."""
    v = Vector(p1) - Vector(p0)
    ob = box(name, (0, 0, 0), (r * 2, r * 2, v.length), material, bevel=bevel, segments=2)
    ob.location = (Vector(p0) + Vector(p1)) / 2
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = v.to_track_quat('Z', 'Y')
    return ob


def bar(name, p0, p1, width, thick, z, material, bevel=0.008, segments=2):
    """Flat rectangular bar laid in the XY plane, spanning two 2D points.

    `strut` makes a square cross-section pointing anywhere in 3D; belts,
    spokes and chevron arms want a wide, thin plate lying on the deck.
    """
    v = Vector((p1[0] - p0[0], p1[1] - p0[1]))
    ob = box(name, (0, 0, 0), (v.length, width, thick), material, bevel, segments)
    ob.location = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z)
    ob.rotation_euler = (0, 0, math.atan2(v.y, v.x))
    return ob


# ------------------------------------------------------- per-vertex surfacing


def paint(ob, color):
    """Bake a flat linear colour into the mesh's COLOR_0 attribute.

    The tile kit is one shared PBR material for the whole board, so the
    palette has to travel in the mesh: glTF multiplies COLOR_0 into the base
    colour, which is what lets 11 pieces share one material and still be a
    grey deck, a yellow wall and an orange gear.

    Byte, not float: the exporter round-trips both to the exact same linear
    values, but a float layer costs 16 bytes a vertex against 8 -- worth
    ~95 KB across the tile kit.
    """
    me = ob.data
    layer = me.color_attributes.get('Col')
    if layer is None:
        layer = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    rgba = (color[0], color[1], color[2], 1.0)
    for i in range(len(me.loops)):
        layer.data[i].color = rgba
    try:
        me.color_attributes.active_color_index = 0
        me.color_attributes.render_color_index = 0
    except (AttributeError, TypeError):
        pass
    return ob


def project_uvs(ob, scale=1.0):
    """Box-project world-space UVs, per face, from its dominant normal axis.

    The kit's texture is a tiling wear pass, not an atlas, so it wants a
    world-scale projection and nothing else. Doing it by hand rather than
    through `bpy.ops.uv.cube_project` keeps it out of operator-context
    trouble in `--background`.
    """
    me = ob.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    mw = ob.matrix_world
    world = [mw @ v.co for v in me.vertices]
    for poly in me.polygons:
        n = poly.normal
        axis = max(range(3), key=lambda i: abs(n[i]))
        ui, vi = ((1, 2), (0, 2), (0, 1))[axis]
        for li in poly.loop_indices:
            co = world[me.loops[li].vertex_index]
            uv.data[li].uv = (co[ui] * scale, co[vi] * scale)
    return ob
