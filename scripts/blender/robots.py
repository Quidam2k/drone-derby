"""Drone Derby -- the four robot chassis, modelled and rendered in Blender.

Run headless (never opens a window):

    blender --background --python scripts/blender/robots.py -- --all
    blender --background --python scripts/blender/robots.py -- --seat 1 --view hero
    blender --background --python scripts/blender/robots.py -- --export-glb

(or `npm run art` for the sprites, `npm run art -- --glb` for the meshes.)

`--export-glb` writes public/models/robot-<seat>.glb for the WebGL board
(Phase 3D-1). It runs the SAME `build(seat)` the renders use, then strips the
render scaffolding -- so the mesh in the browser is the mesh in the sprite, and
there is only ever one place a chassis is defined.

CPU ONLY. Todd's standing rule is to ask before using the GPU, so
`cycles.device` is pinned to CPU and the compute_device_type preference is
never touched.

Each seat gets its own chassis AND its own colour, so the four robots differ
by silhouette, not just hue -- they have to be told apart at a 24px mobile
tile, where colour alone is doing all the work today:

    0  tracked scout   two continuous tread bands, boxy hull
    1  hexapod walker  six legs radiating from a round pod
    2  hovercraft      smooth floating oval, no limbs, rear thrusters
    3  quad buggy      four corner wheels under an open roll cage

Renders are transparent PNGs with NO baked ground shadow -- the contact
shadow is a CSS gradient on the non-rotating `.robot` wrapper instead. A
baked shadow would rotate with the sprite and visibly swing around the
robot as it turns.

Units: 1.0 = one board tile. Every chassis is modelled facing +Y (north).
Deterministic: no randomness, no clock.

The primitives (`box`, `frustum`, `cylinder`, `dome`, `strut`, the bevel
`finish`) live in `common.py`, shared with the board tile kit in `tiles.py`.
"""

import bpy
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402  (Blender needs the path set first)
    arg, flag, srgb, mat, frustum, box, cylinder, dome, strut,
)

# --------------------------------------------------------------------- args

OUT_DIR = arg('--out-dir', 'public/robots')
VIEW = arg('--view', 'game')
ELEV = float(arg('--elev', '66'))
SAMPLES = int(arg('--samples', '180'))
# 192px is ~3.7x the 52px desktop tile, so there's headroom for a 3x DPR
# screen with none wasted. 256 cost 335 KB across the four sprites against a
# 115 KB gzipped JS bundle -- too much to add to an offline PWA's precache
# for detail nothing can display.
RES = int(arg('--res', '620' if VIEW == 'hero' else '192'))

SEAT_COLORS = ['#f94144', '#f9c74f', '#43aa8b', '#9d6bf2']

# ------------------------------------------------------------------- colors


class Mats:
    def __init__(self, body_hex):
        self.BODY = mat('body', srgb(body_hex), metallic=0.15, rough=0.34, coat=0.35)
        self.RUBBER = mat('rubber', srgb('#15171d'), rough=0.88)
        self.STEEL = mat('steel', srgb('#8b93a6'), metallic=1.0, rough=0.32)
        self.DARK = mat('dark', srgb('#3c4354'), metallic=1.0, rough=0.42)
        self.GLASS = mat('glass', srgb('#0e1420'), metallic=0.6, rough=0.16, coat=1.0)
        self.LAMP = mat('lamp', srgb('#4cc9f0'), emit=srgb('#4cc9f0'), emit_strength=5.0)
        self.THRUST = mat('thrust', srgb('#ff7a3d'), emit=srgb('#ff7a3d'), emit_strength=7.0)


# ------------------------------------------------------- chassis 0: tracked

def chassis0(M):
    """Tracked scout. Silhouette: two continuous dark bands either side."""
    for side in (-1, 1):
        cx = 0.375 * side
        frustum('pod', (cx, -0.01), (0.20, 0.86), 0.02,
                (cx, -0.01), (0.175, 0.76), 0.32, M.RUBBER, bevel=0.055, segments=5)
        # Ribs run ACROSS the track. Down its outer face they read as a comb.
        for i in range(11):
            box('rib', (cx, -0.335 + i * 0.067, 0.325), (0.215, 0.030, 0.035),
                M.DARK, bevel=0.007, segments=2)
        for t in (-0.295, 0.295):
            cylinder('sprocket', (cx + 0.101 * side, t, 0.165), 0.072, 0.030, 'x', M.STEEL)

    frustum('hull', (0, -0.02), (0.60, 0.74), 0.09,
            (0, -0.02), (0.50, 0.66), 0.44, M.BODY, bevel=0.025, segments=4)
    frustum('deck', (0, 0.24), (0.50, 0.26), 0.44,
            (0, 0.30), (0.34, 0.145), 0.55, M.BODY, bevel=0.018)
    # Gentle taper -- a hard one turns the canopy into a pyramid.
    frustum('canopy', (0, -0.06), (0.50, 0.40), 0.44,
            (0, -0.09), (0.435, 0.345), 0.74, M.BODY, bevel=0.03, segments=5)
    box('screen', (0, -0.09, 0.755), (0.36, 0.275, 0.045), M.GLASS)

    box('sink', (0, -0.305, 0.485), (0.32, 0.13, 0.10), M.DARK)
    for i in range(4):
        box('slat', (0, -0.352 + i * 0.031, 0.545), (0.27, 0.016, 0.038),
            M.STEEL, bevel=0.005, segments=2)

    box('lamp_housing', (0, 0.29, 0.55), (0.29, 0.155, 0.06), M.DARK)
    box('lamp', (0, 0.29, 0.588), (0.235, 0.105, 0.022), M.LAMP, bevel=0.006)
    for side in (-1, 1):
        cylinder('eye', (0.105 * side, -0.03, 0.779), 0.032, 0.012, 'z', M.LAMP)
    cylinder('mast', (0.155, -0.225, 0.85), 0.010, 0.22, 'z', M.STEEL, verts=12)


# ------------------------------------------------------- chassis 1: hexapod

def chassis1(M):
    """Hexapod walker. Silhouette: six legs radiating from a round pod."""
    cylinder('pod', (0, 0, 0.44), 0.30, 0.26, 'z', M.BODY, verts=8, bevel=0.03)
    cylinder('collar', (0, 0, 0.585), 0.235, 0.07, 'z', M.DARK, verts=8)
    dome('cap', (0, 0, 0.60), (0.20, 0.20, 0.135), M.BODY)
    cylinder('sensor_ring', (0, 0, 0.735), 0.105, 0.045, 'z', M.GLASS, verts=20)

    # Six legs: hip out to a raised knee, then down to a foot on the ground.
    for side in (-1, 1):
        for i, ly in enumerate((0.24, 0.0, -0.24)):
            hip = (0.24 * side, ly, 0.42)
            knee = (0.42 * side, ly + 0.05 * side * 0, 0.46)
            foot = (0.455 * side, ly, 0.03)
            strut('thigh', hip, knee, 0.042, M.DARK)
            strut('shin', knee, foot, 0.032, M.STEEL)
            cylinder('joint', (knee[0], knee[1], knee[2]), 0.055, 0.055, 'x', M.DARK)
            box('foot', (foot[0], foot[1], 0.022), (0.10, 0.13, 0.045), M.RUBBER, bevel=0.018)

    # Forward sensor cluster -- the facing cue. Must clear the pod: the
    # octagon's front flat sits at r*cos(22.5deg) = 0.277, and the first pass
    # put this at y=0.245, entirely inside the body.
    box('visor_housing', (0, 0.33, 0.50), (0.34, 0.17, 0.15), M.DARK, bevel=0.025)
    box('visor', (0, 0.405, 0.51), (0.26, 0.04, 0.075), M.LAMP, bevel=0.01)
    # Duplicate the cue on the upward face -- a board camera looks down, and a
    # purely forward-facing lamp is invisible from up there. It has to be big:
    # the tall dome dominates this chassis from above and a small lamp at the
    # rim just disappears at tile size.
    box('visor_top', (0, 0.325, 0.582), (0.28, 0.125, 0.028), M.LAMP, bevel=0.008)
    for side in (-1, 1):
        cylinder('antenna', (0.115 * side, -0.20, 0.80), 0.009, 0.24, 'z', M.STEEL, verts=10)


# ---------------------------------------------------- chassis 2: hovercraft

def chassis2(M):
    """Hovercraft. Silhouette: smooth floating oval, no limbs, rear glow."""
    skirt = cylinder('skirt', (0, 0, 0.115), 0.415, 0.145, 'z', M.RUBBER, verts=40, bevel=0.05)
    skirt.scale = (1.0, 1.10, 1.0)

    hull = cylinder('hull', (0, 0, 0.275), 0.40, 0.20, 'z', M.BODY, verts=40, bevel=0.07)
    hull.scale = (1.0, 1.10, 1.0)

    # Prow must clear the hull, whose scaled radius reaches y=0.44. The first
    # pass ended at 0.44 and vanished inside it, leaving the craft with no
    # front at all.
    frustum('prow', (0, 0.30), (0.42, 0.30), 0.30,
            (0, 0.40), (0.24, 0.26), 0.42, M.BODY, bevel=0.045, segments=5)

    # Cockpit: a body collar with the glass dome ON TOP of it. Nesting a
    # smaller glass dome inside a body dome just hides the glass completely.
    cylinder('collar', (0, 0.02, 0.40), 0.235, 0.12, 'z', M.BODY, verts=28, bevel=0.03)
    dome('screen', (0, 0.03, 0.42), (0.215, 0.26, 0.17), M.GLASS)

    # Rear thruster nacelles -- reads as the back end and as propulsion.
    for side in (-1, 1):
        cylinder('nacelle', (0.20 * side, -0.36, 0.29), 0.115, 0.22, 'y', M.DARK, verts=24)
        cylinder('nozzle', (0.20 * side, -0.465, 0.29), 0.082, 0.03, 'y', M.THRUST, verts=24)

    # Forward light bar, sitting proud on the prow deck so it reads from above.
    box('lightbar', (0, 0.395, 0.445), (0.22, 0.10, 0.03), M.LAMP, bevel=0.01)
    for side in (-1, 1):
        box('strake', (0.285 * side, -0.02, 0.365), (0.08, 0.34, 0.045), M.STEEL, bevel=0.018)


# ---------------------------------------------------- chassis 3: quad buggy

def chassis3(M):
    """Quad buggy. Silhouette: four corner wheels under an open roll cage."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            wx, wy = 0.345 * sx, 0.285 * sy
            w = cylinder('wheel', (wx, wy, 0.175), 0.175, 0.135, 'x', M.RUBBER, verts=32, bevel=0.035)
            cylinder('hubcap', (wx + 0.070 * sx, wy, 0.175), 0.082, 0.022, 'x', M.STEEL, verts=20)
            strut('axle', (wx - 0.07 * sx, wy, 0.175), (0.10 * sx, wy * 0.6, 0.20), 0.028, M.DARK)

    # Narrow spine, so the wheels stay the silhouette.
    frustum('spine', (0, -0.01), (0.34, 0.72), 0.16,
            (0, -0.01), (0.30, 0.62), 0.36, M.BODY, bevel=0.03, segments=4)
    frustum('prow', (0, 0.36), (0.30, 0.20), 0.19,
            (0, 0.42), (0.17, 0.09), 0.31, M.BODY, bevel=0.025, segments=4)
    box('seat', (0, -0.10, 0.40), (0.24, 0.24, 0.10), M.GLASS, bevel=0.02)

    # Open roll cage -- the read is the gap you can see the deck through.
    for sx in (-1, 1):
        strut('hoop_up', (0.15 * sx, -0.20, 0.36), (0.155 * sx, -0.135, 0.60), 0.021, M.STEEL)
        strut('hoop_fwd', (0.155 * sx, -0.135, 0.60), (0.13 * sx, 0.18, 0.55), 0.021, M.STEEL)
        strut('hoop_dn', (0.13 * sx, 0.18, 0.55), (0.135 * sx, 0.30, 0.33), 0.021, M.STEEL)
    strut('hoop_top', (-0.155, -0.135, 0.60), (0.155, -0.135, 0.60), 0.021, M.STEEL)
    strut('hoop_mid', (-0.13, 0.18, 0.55), (0.13, 0.18, 0.55), 0.021, M.STEEL)

    for side in (-1, 1):
        cylinder('headlight', (0.085 * side, 0.425, 0.285), 0.045, 0.035, 'y', M.LAMP, verts=18)
    # Light bar on the upward face of the nose. The forward-facing headlights
    # alone are nearly edge-on to a board camera and vanish at tile size.
    box('nosebar', (0, 0.395, 0.325), (0.215, 0.085, 0.032), M.LAMP, bevel=0.01)
    box('rollbar_pad', (0, -0.135, 0.635), (0.20, 0.05, 0.045), M.DARK, bevel=0.014)


CHASSIS = [chassis0, chassis1, chassis2, chassis3]


# ------------------------------------------------------------ scene assembly

def build(seat):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = Mats(SEAT_COLORS[seat])
    CHASSIS[seat](M)

    bpy.ops.object.empty_add(location=(0, 0, 0.34))
    aim = bpy.context.active_object

    def area(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy, d.size, d.color = energy, size, color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        o.constraints.new('TRACK_TO').target = aim

    # Key kept fairly high: the sprite is rotated by CSS, so a low raking key
    # would swing its highlight right around the robot as it turns.
    area('key', (-1.3, 0.9, 2.8), 300, 2.4)
    area('fill', (1.9, -0.6, 1.4), 80, 2.6, color=(0.72, 0.80, 1.0))
    area('rim', (0.5, -2.0, 1.9), 170, 1.6, color=(0.70, 0.86, 1.0))

    world = bpy.data.worlds.new('world')
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.05, 0.055, 0.075, 1)
    bg.inputs['Strength'].default_value = 1.1

    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.constraints.new('TRACK_TO').target = aim

    if VIEW == 'hero':
        cam_data.type = 'PERSP'
        cam_data.lens = 85
        el, az, dist = math.radians(26), math.radians(36), 4.2
    else:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = 1.12
        el, az, dist = math.radians(ELEV), 0.0, 4.0

    cam.location = (dist * math.cos(el) * math.sin(az),
                    -dist * math.cos(el) * math.cos(az),
                    dist * math.sin(el) + 0.34)

    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'          # Todd's rule: ask before using the GPU.
    s.cycles.samples = SAMPLES
    s.cycles.use_denoising = True
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    # No shadow catcher: the contact shadow is CSS on the non-rotating
    # wrapper, so it can't swing around as the sprite turns.
    s.render.film_transparent = (VIEW != 'hero')
    s.render.resolution_x = s.render.resolution_y = RES
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'Filmic'
    s.view_settings.look = 'Medium High Contrast'


def render(seat, path):
    build(seat)
    out = path if os.path.isabs(path) else os.path.join(os.getcwd(), path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('DD_WROTE %s' % out)


def export_glb(seat, path):
    """Chassis meshes only, as a .glb for three.js. Static -- rigging is 3D-3."""
    build(seat)

    # Lights, the camera and the TRACK_TO aim empty are render scaffolding.
    # Baked into the .glb they'd fight the WebGL scene's own lighting, so the
    # only things that travel are the meshes.
    for ob in list(bpy.data.objects):
        if ob.type != 'MESH':
            bpy.data.objects.remove(ob, do_unlink=True)

    out = path if os.path.isabs(path) else os.path.join(os.getcwd(), path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=False,
        # Bevels live in modifiers. Without this every chassis exports with the
        # raw 90-degree edges the bevels exist to get rid of.
        export_apply=True,
    )
    print('DD_WROTE %s' % out)


if flag('--export-glb'):
    glb_dir = arg('--out-dir', 'public/models')
    for seat in range(4):
        export_glb(seat, os.path.join(glb_dir, 'robot-%d.glb' % seat))
elif flag('--all'):
    for seat in range(4):
        render(seat, os.path.join(OUT_DIR, 'robot-%d.png' % seat))
else:
    seat = int(arg('--seat', '0'))
    name = 'hero-%d.png' % seat if VIEW == 'hero' else 'robot-%d.png' % seat
    render(seat, arg('--out', os.path.join(OUT_DIR, name)))
