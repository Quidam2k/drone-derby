"""Drone Derby -- the board tile kit, modelled in Blender.

Run headless (never opens a window, never renders, never touches Cycles):

    blender --background --python scripts/blender/tiles.py -- --out public/models/tiles.glb

(or `npm run art:tiles`.)

One .glb for the whole kit: a single fetch, a single parse, and named nodes
the loader pulls out by hand. Each piece becomes one instanced mesh on the
3D board, so a 12x17 composed board is still a handful of draw calls.

    floor        deck plate under every non-pit tile
    conveyor     recessed belt bed, rails and rollers; belt runs +Y
    chevron      the scrolling belt arrow (also the gear's direction arrow)
    gear         one toothed wheel -- replaces a disc plus eight tooth instances
    pit_shaft    shaft floor and lining, sunk below the slab
    pit_rim      hazard curb around the hole
    checkpoint   glowing ring
    spawn        painted dock frame
    wall         hazard barrier, long in X, sitting on a cell edge
    laser_body   wall-mounted emitter housing
    laser_lens   the muzzle glow

TWO MATERIALS for the whole kit. `tile_pbr` samples a generated wear texture;
the palette rides in per-vertex COLOR_0, which glTF multiplies into the base
colour -- that is what lets a grey deck, a yellow wall and an orange gear
share one material. `tile_glow` is the emissive one, for the checkpoint ring
and the laser lens; the board tints those from code, so they stay
parameterised (express vs normal, checkpoint green vs laser red).

Local frames match the procedural geometry each piece replaces in
`src/components/board3d/boardMesh.ts`, so the board's placements are
unchanged and a missing .glb falls straight back to primitives.

Units: 1.0 = one board tile. Z up, +Y = north.
Deterministic: no randomness, no clock -- the textures are summed sines.
"""

import bpy
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402  (Blender needs the path set first)
    arg, bar, box, cylinder, frustum, mat, paint, project_uvs, srgb,
)

OUT = arg('--out', 'public/models/tiles.glb')
TEX = int(arg('--tex', '256'))
# One texture repeat per tile. Higher and the tread pattern turns to noise at
# the ~60px a tile actually occupies on a 12x17 board.
UV_SCALE = 1.0


# ------------------------------------------------------------------ palette
# Industrial factory floor, deliberately NOT the DOM board's flat panel
# palette -- see the phase note. Hazard yellow is kept at the DOM board's
# --wall so "wall" still reads as the same colour it always did.

class C:
    # Rendered, not authored: these are albedos under a 2.4 key, so they land
    # a good deal lighter on screen than they look here. The deck is kept
    # dark on purpose -- it is the background the whole board reads against,
    # and a mid-grey floor swallows the hazard yellow and the belt arrows.
    DECK = '#43474e'
    DECK_DARK = '#25282e'
    GRIME = '#1b1d22'
    STEEL = '#8e97a6'
    STEEL_DARK = '#3e434d'
    # Deck bolts and belt lips catch the key light on their bevels anyway. At
    # full steel there are four bright dots on every one of 204 tiles and they
    # out-shout the belt arrows, which are the thing you actually have to read.
    BOLT = '#5a6270'
    BELT_BED = '#191c25'
    ROLLER = '#6b7280'
    HAZARD_Y = '#e8b830'
    HAZARD_K = '#20232b'
    GEAR_BODY = '#c88f3c'
    GEAR_DARK = '#7d5620'
    PIT = '#0a0b11'
    DOCK = '#93a0bd'
    GLOW = '#ffffff'


# ----------------------------------------------------------------- textures


def _fbm(x, y):
    """Tiling value noise from summed sines. Integer frequencies keep the
    texture seamless; fixed phases keep the export byte-stable."""
    v = np.zeros_like(x)
    for f, a, px, py in ((2, 0.50, 0.13, 0.71), (5, 0.27, 0.37, 0.19),
                         (11, 0.15, 0.83, 0.44), (23, 0.08, 0.05, 0.61)):
        v += a * np.sin((x * f + px) * 2 * np.pi) * np.sin((y * f + py) * 2 * np.pi)
    return v / 1.0


def _image(name, rgb, colorspace):
    """Pack a HxWx3 float array (already encoded for `colorspace`) as an image."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    px = np.ones((h, w, 4), dtype=np.float32)
    px[:, :, :3] = rgb
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def _encode_srgb(lin):
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.clip(lin, 0, None) ** (1 / 2.4) - 0.055)


def wear_textures():
    """Base colour and a glTF-packed ORM for the whole kit.

    The base colour is near-white on purpose: it is a wear pass that COLOR_0
    tints, not the colour itself. Tread plate carries the industrial read at
    distance; the low-frequency blotches carry grime up close.

    The second image is packed the way glTF wants it -- R unused, G rough,
    B metal -- so grime reads as scuffed paint over metal rather than as a
    uniformly shiny floor.
    """
    y, x = np.mgrid[0:TEX, 0:TEX].astype(np.float32) / TEX
    n = _fbm(x, y)

    # Raised diamond tread: two crossed triangle waves, thresholded.
    a = np.abs(((x * 6 + y * 6) % 1.0) - 0.5) * 2
    b = np.abs(((x * 6 - y * 6) % 1.0) - 0.5) * 2
    plate = np.clip((np.minimum(a, b) - 0.55) * 4.0, 0, 1)

    lum = np.clip(0.94 + n * 0.13 + plate * 0.10, 0.55, 1.0)
    # Grime pools in the low spots and goes warm, so the metal doesn't read
    # as evenly tinted plastic once COLOR_0 multiplies in.
    dirt = np.clip(-n * 1.6, 0, 1)
    rgb = np.stack([
        lum * (1.0 - dirt * 0.06),
        lum * (1.0 - dirt * 0.15),
        lum * (1.0 - dirt * 0.26),
    ], axis=-1)

    rough = np.clip(0.56 - plate * 0.16 + n * 0.28 + dirt * 0.22, 0.24, 0.95)
    # Painted deck plate, not bare aluminium. The first pass ran metal at
    # 0.78 and the environment simply took the surface over -- the board went
    # near-white and every functional piece on it lost its contrast.
    metal = np.clip(0.40 - dirt * 0.28 + plate * 0.14, 0.06, 0.62)
    orm = np.stack([np.ones_like(rough), rough, metal], axis=-1).astype(np.float32)

    return (_image('tile_wear', _encode_srgb(rgb).astype(np.float32), 'sRGB'),
            _image('tile_orm', orm, 'Non-Color'))


def materials():
    """The kit's two materials.

    Both node graphs are the shapes the glTF exporter recognises verbatim:
    an image straight into Base Color, and one image split into Roughness
    and Metallic. Anything else in between -- a mix node to fold the vertex
    palette in, say -- and the exporter would have to bake or drop it. It
    doesn't need to: glTF's base colour is already factor x texture x
    COLOR_0, so the palette multiplies in on its own.
    """
    base_img, orm_img = wear_textures()

    pbr = mat('tile_pbr', srgb('#ffffff'), metallic=1.0, rough=1.0)
    nodes = pbr.node_tree.nodes
    links = pbr.node_tree.links
    bsdf = nodes['Principled BSDF']
    pbr.use_backface_culling = True

    tex = nodes.new('ShaderNodeTexImage')
    tex.image = base_img
    tex.location = (-520, 220)
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])

    orm = nodes.new('ShaderNodeTexImage')
    orm.image = orm_img
    orm.location = (-720, -120)
    split = nodes.new('ShaderNodeSeparateColor')
    split.location = (-460, -120)
    links.new(orm.outputs['Color'], split.inputs['Color'])
    links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
    links.new(split.outputs['Blue'], bsdf.inputs['Metallic'])

    glow = mat('tile_glow', srgb('#ffffff'), metallic=0.0, rough=0.25,
               emit=srgb('#ffffff'), emit_strength=3.0)
    glow.use_backface_culling = True
    return pbr, glow


# -------------------------------------------------------------- piece frames
# Every piece is built at the origin and parented to an empty of the same
# name; the loader merges that empty's descendants into one BufferGeometry.

PBR = None
GLOW = None


def part(ob, color):
    paint(ob, srgb(color))
    return ob


def piece(name, build):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    before = set(bpy.data.objects)
    build()
    for ob in bpy.data.objects:
        if ob in before or ob.type != 'MESH':
            continue
        if not ob.data.color_attributes:
            paint(ob, srgb(C.DECK))
        project_uvs(ob, UV_SCALE)
        ob.parent = root


# ------------------------------------------------------------------- pieces


def floor_plate():
    """Deck plate. Replaces BoxGeometry(0.94, 0.05, 0.94) at y = -0.015.

    A dark base plate 0.005 lower than a raised panel, so every tile has a
    shadowed seam around it -- the grid has to stay readable once the flat
    panel colours are gone.
    """
    part(box('deck_base', (0, 0, -0.005), (0.94, 0.94, 0.05), PBR, bevel=0.008, segments=2),
         C.DECK_DARK)
    part(box('deck_panel', (0, 0, 0.0), (0.84, 0.84, 0.05), PBR, bevel=0.016, segments=3),
         C.DECK)
    for sx in (-1, 1):
        for sy in (-1, 1):
            part(cylinder('rivet', (0.445 * sx, 0.445 * sy, 0.018), 0.026, 0.022, 'z',
                          PBR, verts=8, bevel=0.005), C.BOLT)


def conveyor_bed():
    """Belt running +Y: side rails, a sunken bed, rollers across it.

    The bed is BELOW the deck and the rails ABOVE it, so the scrolling
    chevrons (y 0.014 upward, unchanged) ride in a channel instead of
    floating over a flat square.
    """
    part(box('belt_base', (0, 0, -0.005), (0.94, 0.94, 0.05), PBR, bevel=0.008, segments=2),
         C.DECK_DARK)
    for side in (-1, 1):
        part(box('belt_rail', (0.405 * side, 0, 0.0), (0.13, 0.94, 0.09), PBR,
                 bevel=0.014, segments=3), C.STEEL_DARK)
        part(box('belt_lip', (0.405 * side, 0, 0.048), (0.10, 0.94, 0.014), PBR,
                 bevel=0.005, segments=1), C.BOLT)
    part(box('belt_bed', (0, 0, -0.045), (0.70, 0.94, 0.05), PBR, bevel=0.008, segments=2),
         C.BELT_BED)
    for i in range(4):
        part(cylinder('roller', (0, -0.33 + i * 0.22, -0.018), 0.034, 0.68, 'x',
                      PBR, verts=12, bevel=0.005), C.ROLLER)


def chevron_arm():
    """The belt arrow. Points +Y, lies flat, origin-centred.

    Footprint is held to the extruded shape it replaces (x +-0.30,
    y -0.10..0.17, z 0..0.05) -- `tick()` scrolls this within its own tile
    and a different size would break the belt reading as continuous.
    """
    for side in (-1, 1):
        part(bar('chev', (0.30 * side, -0.075), (0.0, 0.147), 0.115, 0.05, 0.025,
                 PBR, bevel=0.010, segments=2), C.GLOW)


def gear_wheel():
    """One toothed wheel. Replaces a disc instance plus eight tooth instances.

    Teeth stay at r 0.40-ish with the same 0.14 x 0.13 x 0.09 footprint the
    eight separate instances had, so a gear is the same size it was.
    """
    part(cylinder('gear_rim', (0, 0, 0.0), 0.38, 0.10, 'z', PBR, verts=32, bevel=0.010),
         C.GEAR_BODY)
    part(cylinder('gear_web', (0, 0, -0.005), 0.29, 0.07, 'z', PBR, verts=32, bevel=0.008),
         C.GEAR_DARK)
    part(cylinder('gear_hub', (0, 0, 0.012), 0.115, 0.105, 'z', PBR, verts=16, bevel=0.008),
         C.STEEL)
    part(cylinder('gear_bore', (0, 0, 0.052), 0.045, 0.03, 'z', PBR, verts=12, bevel=0.004),
         C.GRIME)
    for i in range(6):
        a = (i / 6) * math.pi * 2
        part(bar('gear_spoke',
                 (math.sin(a) * 0.08, math.cos(a) * 0.08),
                 (math.sin(a) * 0.30, math.cos(a) * 0.30),
                 0.075, 0.055, 0.008, PBR, bevel=0.008, segments=2), C.STEEL_DARK)
    for i in range(8):
        a = (i / 8) * math.pi * 2
        tooth = frustum('gear_tooth',
                        (0, 0), (0.155, 0.145), -0.045,
                        (0, 0), (0.125, 0.115), 0.045,
                        PBR, bevel=0.012, segments=2)
        tooth.location = (math.sin(a) * 0.395, math.cos(a) * 0.395, 0.0)
        tooth.rotation_euler = (0, 0, -a)
        part(tooth, C.GEAR_BODY)


def pit_shaft():
    """Shaft floor plus a lining, sunk to y = -0.62.

    The lining is inset to +-0.47 so it cannot z-fight the neighbouring
    slabs' side faces at +-0.50; its top lands just under deck level, which
    closes the gap a pit's missing slab used to leave.
    """
    part(box('shaft_floor', (0, 0, 0), (0.92, 0.92, 0.08), PBR, bevel=0.010, segments=2),
         C.PIT)
    for i in (-1, 1):
        part(box('shaft_wall_x', (0.465 * i, 0, 0.31), (0.05, 0.94, 0.54), PBR,
                 bevel=0.008, segments=1), C.GRIME)
        part(box('shaft_wall_y', (0, 0.465 * i, 0.31), (0.88, 0.05, 0.54), PBR,
                 bevel=0.008, segments=1), C.STEEL_DARK)
    for i in range(3):
        part(bar('shaft_grate', (-0.42, -0.26 + i * 0.26), (0.42, -0.26 + i * 0.26),
                 0.07, 0.03, 0.055, PBR, bevel=0.006, segments=1), C.STEEL_DARK)


def pit_curb():
    """Hazard curb around the hole, standing 0.03 proud of the deck.

    A square frame, not a torus: on a square tile the frame reads as the
    edge of the hole rather than as a decal lying on top of it.
    """
    n = 5
    for i in (-1, 1):
        for k in range(n):
            t = -0.39 + k * (0.78 / (n - 1))
            c = C.HAZARD_Y if k % 2 == 0 else C.HAZARD_K
            part(box('curb_x', (0.44 * i, t, 0.015), (0.10, 0.78 / n, 0.09), PBR,
                     bevel=0.006, segments=1), c)
            part(box('curb_y', (t, 0.44 * i, 0.015), (0.78 / n, 0.10, 0.09), PBR,
                     bevel=0.006, segments=1), c)
    for sx in (-1, 1):
        for sy in (-1, 1):
            part(box('curb_corner', (0.44 * sx, 0.44 * sy, 0.015), (0.10, 0.10, 0.095),
                     PBR, bevel=0.008, segments=2), C.HAZARD_K)


def checkpoint_ring():
    """Emissive ring. Already flat in XY, so no rotate on the way in."""
    bpy.ops.mesh.primitive_torus_add(major_radius=0.335, minor_radius=0.048,
                                     major_segments=32, minor_segments=8,
                                     location=(0, 0, 0))
    ring = bpy.context.active_object
    ring.name = 'check_ring'
    ring.data.materials.append(GLOW)
    bpy.ops.object.shade_smooth()
    part(ring, C.GLOW)
    for i in range(4):
        a = math.pi / 4 + (i / 4) * math.pi * 2
        part(bar('check_tab',
                 (math.sin(a) * 0.30, math.cos(a) * 0.30),
                 (math.sin(a) * 0.46, math.cos(a) * 0.46),
                 0.075, 0.045, 0.0, GLOW, bevel=0.008, segments=2), C.GLOW)


def spawn_dock():
    """Painted dock frame -- one instance where there were four bars.

    Sits half-sunk in the deck so it reads as paint, not as a kerb the robot
    would have to climb.
    """
    for i in (-1, 1):
        part(box('dock_x', (0.355 * i, 0, 0), (0.07, 0.60, 0.05), PBR,
                 bevel=0.008, segments=2), C.DOCK)
        part(box('dock_y', (0, 0.355 * i, 0), (0.60, 0.07, 0.05), PBR,
                 bevel=0.008, segments=2), C.DOCK)
    for sx in (-1, 1):
        for sy in (-1, 1):
            part(box('dock_corner', (0.355 * sx, 0.355 * sy, 0.008), (0.11, 0.11, 0.055),
                     PBR, bevel=0.010, segments=2), C.STEEL)


def wall_barrier():
    """Hazard barrier on a cell edge. Long in X, thin in Y, 0.34 tall.

    Yellow stays the wall colour it is on the DOM board -- black uprights
    give it the hazard read without spending the cue that says "wall".
    """
    part(box('wall_foot', (0, 0, -0.14), (0.98, 0.17, 0.06), PBR, bevel=0.010, segments=2),
         C.STEEL_DARK)
    part(box('wall_panel', (0, 0, 0.005), (0.90, 0.10, 0.27), PBR, bevel=0.014, segments=3),
         C.HAZARD_Y)
    for x in (-0.29, -0.09, 0.11, 0.31):
        part(box('wall_stripe', (x, 0, 0.005), (0.075, 0.116, 0.27), PBR,
                 bevel=0.006, segments=1), C.HAZARD_K)
    for i in (-1, 1):
        part(box('wall_post', (0.455 * i, 0, 0.0), (0.09, 0.17, 0.34), PBR,
                 bevel=0.012, segments=3), C.STEEL_DARK)
    part(box('wall_rail', (0, 0, 0.155), (0.94, 0.15, 0.045), PBR, bevel=0.012, segments=3),
         C.STEEL)


def laser_housing():
    """Wall-mounted emitter, barrel pointing +Y.

    The muzzle has to land near y = 0.19, where the board places the lens
    instance -- the two pieces are positioned independently and only look
    like one object if they agree.
    """
    part(box('laser_mount', (0, -0.155, 0), (0.24, 0.07, 0.26), PBR, bevel=0.012, segments=3),
         C.STEEL_DARK)
    part(box('laser_case', (0, -0.02, 0), (0.19, 0.28, 0.16), PBR, bevel=0.018, segments=3),
         C.DECK_DARK)
    part(box('laser_warn', (0, -0.02, 0.082), (0.13, 0.20, 0.014), PBR, bevel=0.005, segments=1),
         C.HAZARD_Y)
    for i in range(3):
        part(box('laser_fin', (0, -0.10 + i * 0.06, 0.095), (0.20, 0.022, 0.05), PBR,
                 bevel=0.005, segments=1), C.STEEL)
    part(cylinder('laser_barrel', (0, 0.135, 0), 0.05, 0.19, 'y', PBR, verts=16, bevel=0.006),
         C.STEEL_DARK)
    part(cylinder('laser_muzzle', (0, 0.205, 0), 0.068, 0.032, 'y', PBR, verts=16, bevel=0.006),
         C.STEEL)


def laser_lens():
    """The muzzle glow. Tiny -- it is a lens, and the beam is the drama."""
    part(cylinder('lens', (0, 0, 0), 0.052, 0.036, 'y', GLOW, verts=16, bevel=0.006), C.GLOW)
    part(cylinder('lens_glow', (0, 0.022, 0), 0.032, 0.02, 'y', GLOW, verts=12, bevel=0.004),
         C.GLOW)


PIECES = [
    ('floor', floor_plate),
    ('conveyor', conveyor_bed),
    ('chevron', chevron_arm),
    ('gear', gear_wheel),
    ('pit_shaft', pit_shaft),
    ('pit_rim', pit_curb),
    ('checkpoint', checkpoint_ring),
    ('spawn', spawn_dock),
    ('wall', wall_barrier),
    ('laser_body', laser_housing),
    ('laser_lens', laser_lens),
]


def build():
    global PBR, GLOW
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PBR, GLOW = materials()
    for name, fn in PIECES:
        piece(name, fn)


def export(path):
    build()
    out = path if os.path.isabs(path) else os.path.join(os.getcwd(), path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=False,
        # Bevels live in modifiers; without this the whole kit exports with the
        # raw 90-degree edges the bevels exist to get rid of.
        export_apply=True,
    )
    print('DD_WROTE %s' % out)


export(OUT)

