"""Drone Derby -- the board tile kit, modelled in Blender.

Run headless (never opens a window, never renders, never touches Cycles):

    blender --background --python scripts/blender/tiles.py -- --out public/models/tiles.glb

(or `npm run art:tiles`.)

One .glb for the whole kit: a single fetch, a single parse, and named nodes
the loader pulls out by hand. Each piece becomes one instanced mesh on the
3D board, so a 12x17 composed board is still a handful of draw calls.

    floor        deck plate under every non-pit tile
    conveyor     recessed belt bed, rails and rollers; belt runs +Y
    conveyor_curve  the bed bent 90 degrees, +X edge to +Y edge (CW frame)
    chevron      the scrolling belt arrow (also the gear's direction arrow)
    gear         one toothed wheel -- replaces a disc plus eight tooth instances
    pit_shaft    shaft floor and lining, sunk below the slab
    pit_rim      hazard curb around the hole
    checkpoint   glowing ring
    spawn        painted dock frame
    wrench       repair-site service hatch with the tool on it
    wall         hazard barrier, long in X, sitting on a cell edge
    laser_body   wall-mounted emitter housing
    laser_lens   the muzzle glow
    pusher_housing  wall-mounted piston housing, pushing +Y
    pusher_plate    the hazard-striped piston face (tinted by code per variant)

The ten expansion elements (phase 46). Six of these keep their CODE material
-- their colour is a rule or a per-instance tint, not art -- so for those the
kit contributes SHAPE ONLY and the COLOR_0 palette below is inert. They are
marked (shape), and they have to read through silhouette: a relief detail on
a uniformly emissive material is invisible, which is exactly how the
radiation trefoil got moved OFF that list.

    drain_grate     one grate over the whole drain opening (5 bar instances)
    trapdoor_hatch  twin-leaf floor hatch, hinged N and S
    radiation_disc  yellow trefoil painted on a dark disc
    waste_puddle    (shape) lobed spill, deliberately not a circle
    portal_ring     (shape) ring; the pair colour is per-instance
    portal_core     (shape) the disc inside the ring
    teleporter_pad  notched landing ring
    teleporter_core (shape) emissive disc inside the pad
    repulsor_coil   octagonal drum with windings
    repulsor_core   (shape) the floating emissive bead
    oneway_slab     (shape) ribbed slab; red/green is code's to give
    crusher_post    hydraulic ram, one of four per crusher
    crusher_head    toothed press plate, teeth pointing down
    flamer_nozzle   burner head with a ring of jets

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
    # Expansion elements. The three that keep a kit material match the code
    # material they replace, so a kit board and a fallback board read the same.
    GRATE = '#39415a'
    HATCH = '#20242f'
    TELE_RING = '#7d3436'
    COIL = '#33241f'


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


def conveyor_curve():
    """Curved belt section: the bed bends 90 degrees around the NE corner,
    connecting the +X edge to the +Y edge -- the CW curve's local frame with
    exit +Y (entered travelling -X, turned to +Y). The bed itself is
    direction-agnostic (the scrolling chevrons carry the direction), so
    boardMesh reuses this one piece for CCW curves with a different yaw.

    Same vocabulary as conveyor_bed -- dark base, sunken bed, side rails,
    rollers -- swept along the quarter arc as rotated segments. Radii match
    the straight bed: centreline 0.5 from the corner, bed 0.70 wide, rails
    at 0.5 +- 0.405, so a curve butts cleanly against a straight neighbour.
    """
    part(box('curve_base', (0, 0, -0.005), (0.94, 0.94, 0.05), PBR, bevel=0.008, segments=2),
         C.DECK_DARK)
    cx = cy = 0.5  # arc centre: the tile's NE corner
    n = 6
    for k in range(n):
        a = math.radians(180 + (k + 0.5) * 90 / n)
        seg = box('curve_bed', (0, 0, -0.045), (0.70, 0.26, 0.05), PBR,
                  bevel=0.008, segments=1)
        seg.location = (cx + 0.5 * math.cos(a), cy + 0.5 * math.sin(a), 0)
        seg.rotation_euler = (0, 0, a)
        part(seg, C.BELT_BED)
    for r, w, segs in ((0.095, 0.16, 3), (0.905, 0.27, n)):
        for k in range(segs):
            a = math.radians(180 + (k + 0.5) * 90 / segs)
            rail = box('curve_rail', (0, 0, 0.0), (0.13, w, 0.09), PBR,
                       bevel=0.014, segments=2)
            rail.location = (cx + r * math.cos(a), cy + r * math.sin(a), 0)
            rail.rotation_euler = (0, 0, a)
            part(rail, C.STEEL_DARK)
    for k in range(4):
        a = math.radians(180 + (k + 0.5) * 90 / 4)
        roller = cylinder('curve_roller', (0, 0, 0), 0.034, 0.68, 'x',
                          PBR, verts=12, bevel=0.005)
        roller.location = (cx + 0.5 * math.cos(a), cy + 0.5 * math.sin(a), -0.018)
        # Rz(a) after the axis-x tilt: euler XYZ composes as Rz @ Ry @ Rx.
        roller.rotation_euler = (0, math.radians(90), a)
        part(roller, C.ROLLER)


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


def wrench_hatch():
    """Repair site. Replaces CylinderGeometry(0.36, 0.36, 0.04) at y = 0.025.

    A round service hatch with a green paint ring (repair's colour cue, kept
    duller than the checkpoint's emissive so the two never read as the same
    thing) and an open-end wrench lying diagonally across it, SW to NE.
    """
    part(cylinder('hatch', (0, 0, 0), 0.36, 0.04, 'z', PBR, verts=24, bevel=0.008),
         C.STEEL_DARK)
    part(cylinder('hatch_paint', (0, 0, 0.022), 0.30, 0.010, 'z', PBR, verts=24, bevel=0.003),
         '#2b6e5a')
    for i in range(4):
        a = math.pi / 4 + (i / 4) * math.pi * 2
        part(cylinder('hatch_bolt', (math.sin(a) * 0.325, math.cos(a) * 0.325, 0.022),
                      0.022, 0.018, 'z', PBR, verts=8, bevel=0.004), C.BOLT)
    # The tool: ring pommel -- handle -- open jaw, along the SW-NE diagonal.
    d = math.sqrt(0.5)
    part(bar('wr_handle', (-0.14, -0.14), (0.14, 0.14), 0.075, 0.05, 0.052, PBR,
             bevel=0.010, segments=2), C.STEEL)
    part(cylinder('wr_pommel', (-0.185, -0.185, 0.052), 0.062, 0.05, 'z', PBR,
                  verts=16, bevel=0.008), C.STEEL)
    for s in (-1, 1):
        px, py = 0.185 + d * 0.055 * s, 0.185 - d * 0.055 * s
        part(bar('wr_prong', (px, py), (px + d * 0.12, py + d * 0.12), 0.048, 0.05,
                 0.052, PBR, bevel=0.008, segments=2), C.STEEL)


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


def pusher_housing():
    """Wall-mounted piston housing, pushing +Y.

    Replaces BoxGeometry(0.72, 0.2, 0.14) placed 0.42 behind the cell centre
    along the push direction -- the same mounting the laser body uses. The
    piston rods reach +Y toward where the board places the plate instance
    (0.14 in front of the housing's centre), so the two pieces read as one
    machine while staying independently placeable.
    """
    part(box('pusher_mount', (0, -0.048, 0), (0.68, 0.05, 0.24), PBR, bevel=0.010, segments=2),
         C.STEEL_DARK)
    part(box('pusher_case', (0, 0.0, 0), (0.72, 0.10, 0.20), PBR, bevel=0.014, segments=3),
         C.DECK_DARK)
    part(box('pusher_warn', (0, 0.0, 0.102), (0.56, 0.08, 0.014), PBR, bevel=0.005, segments=1),
         C.HAZARD_Y)
    for i in (-1, 1):
        part(cylinder('pusher_rod', (0.18 * i, 0.095, -0.01), 0.028, 0.11, 'y', PBR,
                      verts=12, bevel=0.005), C.STEEL)


def pusher_plate():
    """The piston face: a hazard-striped bar the housing's rods carry.

    Replaces BoxGeometry(0.6, 0.14, 0.08) placed 0.28 behind the cell centre.
    The board tints the whole plate per register variant (1/3/5 amber, 2/4
    steel-blue) with its own material, so the geometry stays neutral -- the
    stripes are relief, and the colour is code's to give.
    """
    part(box('plate_face', (0, 0, 0), (0.60, 0.08, 0.14), PBR, bevel=0.012, segments=3),
         C.HAZARD_Y)
    for x in (-0.20, 0.0, 0.20):
        part(box('plate_stripe', (x, 0.01, 0), (0.075, 0.075, 0.15), PBR,
                 bevel=0.005, segments=1), C.HAZARD_K)


# ------------------------------------------------- expansion elements (46)
# Seven of these are overridden by a code material in boardMesh.ts (the tint
# is a game rule or a per-instance pair colour), so they have to read purely
# through silhouette and relief -- there is no colour coming to save them.


def drain_grate():
    """One grate over the whole opening. Replaces FIVE bar instances.

    The primitive path scales each bar by sqrt(1-(off/0.44)^2) to fit a round
    torus rim; the kit's pit_rim is a SQUARE curb, so the kit grate is square
    too and boardMesh places exactly one of it (see the `kit?.drain_grate`
    branch). Instance sits at y = -0.01, just under the deck.
    """
    for i in range(5):
        ty = -0.28 + i * 0.14
        part(bar('grate_bar', (-0.40, ty), (0.40, ty), 0.075, 0.055, 0.0,
                 PBR, bevel=0.008, segments=2), C.GRATE)
    for sx in (-1, 1):
        part(bar('grate_rail', (0.36 * sx, -0.40), (0.36 * sx, 0.40), 0.06, 0.05, 0.006,
                 PBR, bevel=0.006, segments=2), C.STEEL_DARK)
    for sx in (-1, 1):
        for sy in (-1, 1):
            part(cylinder('grate_bolt', (0.36 * sx, 0.36 * sy, 0.022), 0.022, 0.02, 'z',
                          PBR, verts=8, bevel=0.004), C.BOLT)


def trapdoor_hatch():
    """Twin-leaf hatch. Replaces BoxGeometry(0.82, 0.06, 0.82) at y = 0.035.

    Hinged on the N and S edges with the seam across the middle, so the thing
    reads as something that OPENS -- the open state is engine-side only, so
    the closed pose has to carry the whole idea. Everything stays under
    z = 0.05: the register label sits 0.05 above the instance.
    """
    part(box('hatch_frame', (0, 0, -0.005), (0.82, 0.82, 0.05), PBR, bevel=0.008, segments=2),
         C.GRIME)
    for s in (-1, 1):
        part(box('hatch_leaf', (0, 0.195 * s, 0.012), (0.76, 0.37, 0.045), PBR,
                 bevel=0.010, segments=2), C.HATCH)
        part(cylinder('hatch_hinge', (0, 0.378 * s, 0.026), 0.026, 0.60, 'x', PBR,
                      verts=10, bevel=0.005), C.STEEL_DARK)
        part(bar('hatch_warn', (-0.30, 0.058 * s), (0.30, 0.058 * s), 0.05, 0.012, 0.038,
                 PBR, bevel=0.004, segments=1), C.HAZARD_Y)


def radiation_disc():
    """Trefoil on a dark disc. Replaces CylinderGeometry(0.36, 0.36, 0.03).

    Painted, not just raised. The first pass left boardMesh's emissive
    yellow-green material in place and modelled the trefoil as pure relief --
    which disappeared completely, because uniform emission flattens exactly
    the shading that makes relief legible. Hazard yellow on HAZARD_K is the
    DOM board's read, and it survives being one tile wide on a 12x19 board.
    """
    part(cylinder('rad_disc', (0, 0, 0), 0.36, 0.03, 'z', PBR, verts=24, bevel=0.006),
         C.HAZARD_K)
    for i in range(3):
        a = math.radians(90 + i * 120)
        part(bar('rad_blade',
                 (math.cos(a) * 0.10, math.sin(a) * 0.10),
                 (math.cos(a) * 0.29, math.sin(a) * 0.29),
                 0.19, 0.026, 0.026, PBR, bevel=0.006, segments=2), C.HAZARD_Y)
    part(cylinder('rad_hub', (0, 0, 0.024), 0.078, 0.03, 'z', PBR, verts=16, bevel=0.005),
         C.HAZARD_Y)


def waste_puddle():
    """(shape) Lobed spill. Replaces CylinderGeometry(0.44, 0.46, 0.035).

    Four fixed lobes off a central pool -- the point of the piece is that the
    outline ISN'T a circle. boardMesh still yaws and squashes each instance,
    so no two puddles on a board present the same profile.
    """
    part(cylinder('waste_pool', (0, 0, 0), 0.42, 0.035, 'z', PBR, verts=20, bevel=0.010),
         '#3f7d36')
    for lx, ly, lr in ((0.30, 0.17, 0.14), (-0.25, 0.27, 0.12),
                       (-0.31, -0.19, 0.13), (0.21, -0.30, 0.11)):
        part(cylinder('waste_lobe', (lx, ly, -0.002), lr, 0.030, 'z', PBR,
                      verts=12, bevel=0.008), '#3f7d36')
    part(cylinder('waste_film', (0, 0, 0.020), 0.29, 0.012, 'z', PBR, verts=20, bevel=0.005),
         '#58c470')


def portal_ring():
    """(shape) Portal ring. Replaces TorusGeometry(0.32, 0.06) laid flat.

    Four mounting tabs break the outline so a portal never reads as the
    checkpoint ring, which is the same idea at a similar radius. The pair
    colour is per-instance, so the tabs are the only thing telling them apart
    at a glance.
    """
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.055,
                                     major_segments=28, minor_segments=8,
                                     location=(0, 0, 0))
    ring = bpy.context.active_object
    ring.name = 'portal_torus'
    ring.data.materials.append(PBR)
    bpy.ops.object.shade_smooth()
    part(ring, C.GLOW)
    for i in range(4):
        a = (i / 4) * math.pi * 2
        part(box('portal_tab', (math.cos(a) * 0.355, math.sin(a) * 0.355, -0.012),
                 (0.13, 0.13, 0.045), PBR, bevel=0.010, segments=2), C.GLOW)


def portal_core():
    """(shape) The disc inside the ring. Replaces CylinderGeometry(0.16, 0.16, 0.025)."""
    part(cylinder('pcore_disc', (0, 0, 0), 0.16, 0.025, 'z', PBR, verts=20, bevel=0.005),
         C.GLOW)
    part(cylinder('pcore_iris', (0, 0, 0.014), 0.095, 0.02, 'z', PBR, verts=16, bevel=0.004),
         C.GLOW)


def teleporter_pad():
    """Notched landing ring. Replaces TorusGeometry(0.36, 0.055) laid flat."""
    bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.05,
                                     major_segments=28, minor_segments=8,
                                     location=(0, 0, 0))
    ring = bpy.context.active_object
    ring.name = 'tele_torus'
    ring.data.materials.append(PBR)
    bpy.ops.object.shade_smooth()
    part(ring, C.TELE_RING)
    for i in range(6):
        a = (i / 6) * math.pi * 2
        notch = box('tele_notch', (0, 0, 0.006), (0.10, 0.14, 0.055), PBR,
                    bevel=0.008, segments=2)
        notch.location = (math.cos(a) * 0.36, math.sin(a) * 0.36, 0.006)
        notch.rotation_euler = (0, 0, a)
        part(notch, C.STEEL)


def teleporter_core():
    """(shape) Emissive disc inside the pad. Replaces CylinderGeometry(0.2, 0.2, 0.025)."""
    part(cylinder('tcore_disc', (0, 0, 0), 0.20, 0.025, 'z', PBR, verts=20, bevel=0.005),
         C.GLOW)
    for i in range(3):
        part(cylinder('tcore_ring', (0, 0, 0.010), 0.155 - i * 0.05, 0.018 - i * 0.004, 'z',
                      PBR, verts=16, bevel=0.003), C.GLOW)


def repulsor_coil():
    """Octagonal drum with windings. Replaces CylinderGeometry(0.4, 0.44, 0.14, 8).

    Eight verts, matching the primitive's octagon, so the silhouette is the
    one the fallback board draws -- only the windings and the rim are new.
    """
    part(cylinder('coil_drum', (0, 0, 0), 0.42, 0.14, 'z', PBR, verts=8, bevel=0.010),
         C.COIL)
    for i in range(3):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.40, minor_radius=0.022,
                                         major_segments=8, minor_segments=6,
                                         location=(0, 0, -0.042 + i * 0.042))
        winding = bpy.context.active_object
        winding.name = 'coil_winding'
        winding.data.materials.append(PBR)
        bpy.ops.object.shade_smooth()
        part(winding, C.GEAR_BODY)
    part(cylinder('coil_rim', (0, 0, 0.062), 0.30, 0.03, 'z', PBR, verts=8, bevel=0.008),
         C.STEEL_DARK)


def repulsor_core():
    """(shape) The floating bead. Replaces SphereGeometry(0.09).

    An ICOsphere, not `common.dome`'s UV sphere, and that is load-bearing: a
    UV sphere exports as quads, the glTF exporter triangulates them on the way
    out, and that triangulation is NOT stable run to run -- it was the only
    thing in the whole kit that moved between two exports (2.5 KB of index
    buffer, everything else byte-identical). An icosphere is triangles
    already, so there is no triangulation step left to wander. It also has no
    poles to pinch, which a bead this small only benefits from.
    """
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.09, location=(0, 0, 0))
    bead = bpy.context.active_object
    bead.name = 'rcore_bead'
    bead.data.materials.append(PBR)
    bpy.ops.object.shade_smooth()
    part(bead, C.GLOW)


def oneway_slab():
    """(shape) Ribbed half-thickness slab. Replaces BoxGeometry(0.98, 0.34, 0.055).

    Thin in Y: two of these stack back to back on one wall edge, red on the
    blocked side and green on the passable one, both tinted by code. Ribs run
    vertical so the pair still reads as one barrier from the side.
    """
    part(box('ow_panel', (0, 0, 0), (0.94, 0.05, 0.30), PBR, bevel=0.010, segments=2),
         C.STEEL)
    for x in (-0.36, -0.12, 0.12, 0.36):
        part(box('ow_rib', (x, 0, 0), (0.07, 0.062, 0.26), PBR, bevel=0.006, segments=1),
             C.STEEL)
    for i in (-1, 1):
        part(box('ow_post', (0.465 * i, 0, 0), (0.06, 0.055, 0.34), PBR,
                 bevel=0.008, segments=2), C.STEEL)


def crusher_post():
    """Hydraulic ram, one of four. Replaces BoxGeometry(0.1, 0.52, 0.1).

    Kept inside the primitive's +-0.26 so the press's four legs land exactly
    where the fallback board puts them.
    """
    part(cylinder('post_sleeve', (0, 0, -0.13), 0.048, 0.26, 'z', PBR, verts=10, bevel=0.006),
         C.STEEL_DARK)
    part(cylinder('post_rod', (0, 0, 0.135), 0.030, 0.25, 'z', PBR, verts=10, bevel=0.004),
         C.STEEL)
    for z in (-0.255, -0.005, 0.255):
        part(cylinder('post_flange', (0, 0, z), 0.062, 0.028, 'z', PBR, verts=10, bevel=0.005),
             C.STEEL_DARK)


def crusher_head():
    """Toothed press plate. Replaces BoxGeometry(0.72, 0.09, 0.72) at y = 0.5.

    Teeth point DOWN, which is the whole threat of the piece. They stop at
    z = -0.06 -- barely below the primitive's own underside at -0.045 -- so a
    robot passing under a raised press doesn't clip them. The top stays under
    z = 0.05, where the register label sits.
    """
    part(box('head_plate', (0, 0, 0.010), (0.72, 0.72, 0.055), PBR, bevel=0.010, segments=2),
         C.STEEL_DARK)
    for x in (-0.22, 0.0, 0.22):
        part(bar('head_warn', (x, -0.30), (x, 0.30), 0.10, 0.012, 0.043, PBR,
                 bevel=0.004, segments=1), C.HAZARD_Y)
    for ix in (-1, 0, 1):
        for iy in (-1, 0, 1):
            part(frustum('head_tooth',
                         (ix * 0.23, iy * 0.23), (0.11, 0.11), -0.060,
                         (ix * 0.23, iy * 0.23), (0.02, 0.02), -0.014,
                         PBR, bevel=0.006, segments=2), C.STEEL)


def flamer_nozzle():
    """Burner head. Replaces CylinderGeometry(0.14, 0.18, 0.1) at y = 0.05.

    The flame cone above it stays a primitive -- phase 48 animates it, and an
    animated cone wants to keep its own clean geometry.
    """
    part(cylinder('noz_base', (0, 0, -0.024), 0.175, 0.05, 'z', PBR, verts=14, bevel=0.008),
         C.STEEL_DARK)
    part(cylinder('noz_head', (0, 0, 0.020), 0.125, 0.05, 'z', PBR, verts=14, bevel=0.008),
         C.STEEL)
    part(cylinder('noz_throat', (0, 0, 0.040), 0.062, 0.02, 'z', PBR, verts=12, bevel=0.004),
         C.GRIME)
    for i in range(6):
        a = (i / 6) * math.pi * 2
        part(cylinder('noz_jet', (math.cos(a) * 0.095, math.sin(a) * 0.095, 0.042),
                      0.021, 0.016, 'z', PBR, verts=8, bevel=0.003), C.GRIME)


PIECES = [
    ('floor', floor_plate),
    ('conveyor', conveyor_bed),
    ('conveyor_curve', conveyor_curve),
    ('chevron', chevron_arm),
    ('gear', gear_wheel),
    ('pit_shaft', pit_shaft),
    ('pit_rim', pit_curb),
    ('checkpoint', checkpoint_ring),
    ('spawn', spawn_dock),
    ('wrench', wrench_hatch),
    ('wall', wall_barrier),
    ('laser_body', laser_housing),
    ('laser_lens', laser_lens),
    ('pusher_housing', pusher_housing),
    ('pusher_plate', pusher_plate),
    ('drain_grate', drain_grate),
    ('trapdoor_hatch', trapdoor_hatch),
    ('radiation_disc', radiation_disc),
    ('waste_puddle', waste_puddle),
    ('portal_ring', portal_ring),
    ('portal_core', portal_core),
    ('teleporter_pad', teleporter_pad),
    ('teleporter_core', teleporter_core),
    ('repulsor_coil', repulsor_coil),
    ('repulsor_core', repulsor_core),
    ('oneway_slab', oneway_slab),
    ('crusher_post', crusher_post),
    ('crusher_head', crusher_head),
    ('flamer_nozzle', flamer_nozzle),
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

