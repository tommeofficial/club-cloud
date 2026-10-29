# Build a crowd member straight from the Mixamo downloads: Mixamo's own rig, Mixamo's own skin weights,
# Mixamo's own motion. No retargeting at all, so nothing can shear. Every file holds the same character and
# the same skeleton, so each action drops onto the first one's armature as-is.
# Blender -b --python build_mixamo.py -- <out.glb> [max_texture_px]
import bpy, sys, os

SRC_DIR = '/Users/tomconroy/Documents/Club Cloud/3D Models'
BAR = 7.68   # 16 beats at 125bpm, so the dances loop on the beat
CLIPS = [
    ('idle',       'Breathing Idle',      6.0),
    ('dance',      'Hip Hop Dancing',     BAR),
    ('dance2',     'House Dancing',       BAR),
    ('dance3',     'Shuffling',           BAR),
    ('dance4',     'Hip Hop Dancing (2)', BAR),
    ('dance5',     'Hip Hop Dancing (4)', BAR),
    ('hype',       'Arms Hip Hop Dance',  BAR),
    ('cheer',      'Cheering',            3.7),
    ('clap',       'Clapping',            2.3),
    ('handsup',    'Rallying',            5.0),
    ('boo',        'Offensive Idle',      5.0),
    ('lookaround', 'Neutral Idle',        6.0),
    ('sing',       'Excited',             6.0),
    ('laugh',      'Happy',               6.0),
    ('talk',       'Happy Idle',          5.8),
    ('listen',     'Old Man Idle',        6.0),
]

argv = sys.argv[sys.argv.index('--') + 1:]
out_glb = argv[0]
max_px = int(argv[1]) if len(argv) > 1 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)

def trim(action, seconds, fps):
    """keep the first N seconds and start at frame 1, so every clip lines up with the player's time maths"""
    f0 = int(action.frame_range[0])
    cut = f0 + int(round(seconds * fps))
    curves = getattr(action, 'fcurves', None)
    if curves is None:                            # Blender 5 keeps keys in layers > strips > channelbags
        curves = [fc for layer in action.layers for strip in layer.strips for cb in strip.channelbags for fc in cb.fcurves]
    for fc in list(curves):
        for i in range(len(fc.keyframe_points) - 1, -1, -1):   # back to front, so indices stay valid
            if fc.keyframe_points[i].co.x > cut:
                fc.keyframe_points.remove(fc.keyframe_points[i], fast=True)
        fc.update()
        for kp in fc.keyframe_points:
            d = f0 - 1
            kp.co.x -= d; kp.handle_left.x -= d; kp.handle_right.x -= d

arm = None
for name, fbx, secs in CLIPS:
    path = os.path.join(SRC_DIR, fbx + '.fbx')
    if not os.path.exists(path):
        print('MISSING ' + path); continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    added = [o for o in bpy.data.objects if o not in before]
    a = next(o for o in added if o.type == 'ARMATURE')
    fps = bpy.context.scene.render.fps
    act = a.animation_data.action
    act.name = name
    act.use_fake_user = True
    trim(act, secs, fps)
    if arm is None:
        arm = a                                   # the first import brings the character in with it
        for o in added:
            if o is not a and o.type != 'MESH':
                bpy.data.objects.remove(o, do_unlink=True)
    else:
        for o in added:                           # later imports are only here for their animation
            bpy.data.objects.remove(o, do_unlink=True)
    print('CLIP %-11s <- %-22s %5.2fs' % (name, fbx, secs))

# narrow the shoulders. He is bound in a T-pose, so the bulk you see at his shoulder once the arms come down is the
# TOP of the baggy sleeve folding over. Flatten that top surface toward the arm's own axis, strongest over the
# shoulder point and fading out along the arm, and leave the underside, neck and hands alone.
import math
def narrow_shoulders(mesh, arm, squash=0.58):
    mw = mesh.matrix_world; inv = mw.inverted()
    moved = 0
    for side, bone in ((1, 'mixamorig:LeftArm'), (-1, 'mixamorig:RightArm')):
        jt = arm.matrix_world @ arm.data.bones[bone].head_local          # the shoulder joint
        for v in mesh.data.vertices:
            p = mw @ v.co
            ax = p.x * side
            if ax < jt.x * side - 0.10 or ax > jt.x * side + 0.34: continue
            up = p.z - jt.z
            if up <= 0: continue                                         # top of the sleeve only
            if abs(p.y - jt.y) > 0.20 or up > 0.20: continue             # stay on this arm's sleeve
            t = (ax - (jt.x * side - 0.10)) / 0.44                        # 0 inboard of the joint, 1 down the arm
            w = math.sin(math.pi * min(1, max(0, t))) ** 1.5
            p.z = jt.z + up * (1 - squash * w)
            v.co = inv @ p; moved += 1
    print('NARROW moved %d verts (sleeve tops flattened up to %d%%)' % (moved, squash * 100))

for o in bpy.data.objects:
    if o.type == 'MESH' and o.parent is arm:
        narrow_shoulders(o, arm)

FINGERS = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
def curves_of(action):
    c = getattr(action, 'fcurves', None)
    return list(c) if c is not None else [fc for l in action.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]
def bag_of(action, fc):
    for l in action.layers:
        for s in l.strips:
            for cb in s.channelbags:
                if fc in list(cb.fcurves): return cb
for act in [a for a in bpy.data.actions if a.use_fake_user]:
    for fc in curves_of(act):
        dp = fc.data_path
        # fingers are invisible at crowd distance: drop them, they are half the animation data
        if any(f in dp for f in FINGERS):
            bag_of(act, fc).fcurves.remove(fc); continue
        # in place: take the hips' travel across the floor out, keep the sway around it (two-second running mean)
        if 'mixamorig:Hips"' in dp and dp.endswith('location') and fc.array_index in (0, 2):
            pts = fc.keyframe_points; n = len(pts)
            if n < 3: continue
            xs = [p.co.y for p in pts]; win = 60
            mean = [sum(xs[max(0, i - win):i + win + 1]) / len(xs[max(0, i - win):i + win + 1]) for i in range(n)]
            for i, p in enumerate(pts):
                dv = xs[i] - mean[i] + xs[0] - p.co.y
                p.co.y += dv; p.handle_left.y += dv; p.handle_right.y += dv
            fc.update()

arm.animation_data.action = None

for img in bpy.data.images:                       # the crowd is small on screen; 1k textures are plenty
    if img.size[0] > max_px or img.size[1] > max_px:
        w, h = img.size
        k = max_px / max(w, h)
        img.scale(int(w * k), int(h * k))

print('ACTIONS ' + ','.join(sorted(a.name for a in bpy.data.actions)))
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_bake_animation=False, export_optimize_animation_size=True,
                          export_force_sampling=True, export_frame_step=2,   # 30 samples a second
                          export_image_format='JPEG', export_jpeg_quality=86,   # textures as JPEG: a fraction of the PNG size
                          export_yup=True)
print('WROTE %s %.2f MB' % (out_glb, os.path.getsize(out_glb) / 1e6))
