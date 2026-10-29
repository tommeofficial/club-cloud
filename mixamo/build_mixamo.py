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
base_fbx = argv[2] if len(argv) > 2 else None
hat_glb = argv[3] if len(argv) > 3 else None   # a hat saved apart by export_for_mixamo.py, to go back on the rigged head   # another Mixamo-rigged character to dance with the same clips

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
if base_fbx:
    bpy.ops.import_scene.fbx(filepath=base_fbx)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    base_hip = (arm.matrix_world @ arm.data.bones['mixamorig:Hips'].head_local).z
    print('BASE %s hips at %.3fm' % (base_fbx, base_hip))
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
        arm = a                                  # the first import brings the character in with it
        for o in added:
            if o is not a and o.type != 'MESH':
                bpy.data.objects.remove(o, do_unlink=True)
        base_hip = None
    else:
        if base_hip is None:
            base_hip = (arm.matrix_world @ arm.data.bones['mixamorig:Hips'].head_local).z
        src_hip = (a.matrix_world @ a.data.bones['mixamorig:Hips'].head_local).z
        if base_fbx and abs(src_hip / base_hip - 1) > 0.02:   # taller or shorter body: scale the hips' travel to match
            k = base_hip / src_hip
            for fc in [f for f in (getattr(act, 'fcurves', None) or [f for l in act.layers for s in l.strips for cb in s.channelbags for f in cb.fcurves]) if 'mixamorig:Hips"' in f.data_path and f.data_path.endswith('location')]:
                for p in fc.keyframe_points: p.co.y *= k; p.handle_left.y *= k; p.handle_right.y *= k
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

for o in ([] if base_fbx else bpy.data.objects):
    if o.type == 'MESH' and o.parent is arm:
        narrow_shoulders(o, arm)

# put the saved hat back: scale and place it by the bare body's size, then skin it to the head bone so it follows
if hat_glb:
    import json
    from mathutils import Matrix, Vector
    info = json.load(open(hat_glb.rsplit('.', 1)[0] + '.json'))
    body = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent is arm]
    pts = [o.matrix_world @ v.co for o in body for v in o.data.vertices]
    rz0, rz1 = min(p.z for p in pts), max(p.z for p in pts)
    rcx, rcy = (min(p.x for p in pts) + max(p.x for p in pts)) / 2, (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    k = (rz1 - rz0) / (info['zmax'] - info['zmin'])
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=hat_glb)
    hat = next(o for o in bpy.data.objects if o not in before and o.type == 'MESH')
    for o in [o for o in bpy.data.objects if o not in before and o is not hat]: bpy.data.objects.remove(o, do_unlink=True)
    hat.parent = None
    hat.matrix_world = Matrix.Translation(Vector((rcx, rcy, rz0))) @ Matrix.Scale(k, 4) @ Matrix.Translation(Vector((-info['cx'], -info['cy'], -info['zmin'])))
    bpy.context.view_layer.objects.active = hat; hat.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vg = hat.vertex_groups.new(name='mixamorig:Head'); vg.add(list(range(len(hat.data.vertices))), 1.0, 'REPLACE')
    hat.parent = arm; hat.matrix_parent_inverse = arm.matrix_world.inverted()
    mod = hat.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    print('HAT placed: scale %.3f, body z %.2f..%.2f' % (k, rz0, rz1))

# optional scan clean-up (CLEAN_K=6.5 blender ...): drop the stretched triangles that bridge gaps in a scan (a ragged sleeve ribbon),
# the thin slivers along torn edges, and any small floating scraps. Done to the mesh before it is exported.
CLEAN_K = float(os.environ.get('CLEAN_K', '0'))
if CLEAN_K and base_fbx:
    import bmesh, statistics
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.parent is arm and o.name != 'hat' and len(o.data.vertices) > 2000]:
        bm = bmesh.new(); bm.from_mesh(o.data); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        med = statistics.median(e.calc_length() for e in bm.edges)
        bad = []
        for f in bm.faces:
            ls = [e.calc_length() for e in f.edges]; ar = f.calc_area()
            if max(ls) > CLEAN_K * med or (ar > 0 and max(ls) ** 2 / (2 * ar) > 14): bad.append(f)
        bmesh.ops.delete(bm, geom=bad, context='FACES_ONLY')
        # then small floating pieces
        seen, drop = set(), []
        for v in bm.verts:
            if v.index in seen: continue
            part, st = [v], [v]; seen.add(v.index)
            while st:
                x = st.pop()
                for e in x.link_edges:
                    w = e.other_vert(x)
                    if w.index not in seen: seen.add(w.index); st.append(w); part.append(w)
            if len(part) < 120: drop += part
        bmesh.ops.delete(bm, geom=drop, context='VERTS')
        loose = [v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm, geom=loose, context='VERTS')
        print('CLEAN %s: %d bad faces, %d scrap verts removed' % (o.name, len(bad), len(drop)))
        bm.to_mesh(o.data); bm.free()

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
