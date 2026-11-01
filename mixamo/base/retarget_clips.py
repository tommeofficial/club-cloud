# Retarget the Mixamo dance clips onto the crowd's MPFB skeleton by WORLD-SPACE bone rotation, so every bone ends up pointing where Mixamo's does.
# Why: the MPFB 'mixamo' rig has the same bone names but different bone frames (the clavicles point up instead of down, the neck is flipped), so copying
# Mixamo's local rotations straight across (what an action assignment does) swings the arms in across the chest and twists the neck.
# For every frame and every bone both rigs share:  target world rotation = (source world rotation x source rest world rotation^-1) x target rest world rotation.
# Hips travel is scaled by the hip-height ratio. The result is written as the club's shared clip set (the skeleton plus NLA tracks), like build_char.py's anims branch.
# Blender -b --python retarget_clips.py -- <target.glb (the skeleton; add --keep-mesh for a whole character)> <out.glb> [--keep-mesh]
# A rig whose rest pose is an A-pose (the scanned characters, the robot) is handled too: each bone's rest direction is first swung to Mixamo's own T-pose direction.
import bpy, sys, os, re
from mathutils import Matrix, Vector

SRC_DIR = '/Users/tomconroy/Documents/Club Cloud/3D Models'
BAR = 7.68   # 16 beats at 125bpm, so the dances loop on the beat
CLIPS = [   # club clip name, Mixamo download, seconds kept (as build_mixamo.py)
    ('idle', 'Breathing Idle', 6.0), ('dance', 'Hip Hop Dancing', BAR), ('dance2', 'House Dancing', BAR), ('dance3', 'Shuffling', BAR),
    ('dance4', 'Hip Hop Dancing (2)', BAR), ('dance5', 'Hip Hop Dancing (4)', BAR), ('hype', 'Arms Hip Hop Dance', BAR), ('cheer', 'Cheering', 3.7),
    ('clap', 'Clapping', 2.3), ('handsup', 'Rallying', 5.0), ('boo', 'Offensive Idle', 5.0), ('lookaround', 'Neutral Idle', 6.0),
    ('sing', 'Excited', 6.0), ('laugh', 'Happy', 6.0), ('talk', 'Happy Idle', 5.8),
]
argv = sys.argv[sys.argv.index('--') + 1:]
target_glb, out = argv[0], argv[1]
KEEP_MESH = '--keep-mesh' in argv        # a full character (mesh, textures and rig) with the new clips, instead of the shared clips-only file

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=target_glb)
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
if not KEEP_MESH:
    for o in [o for o in bpy.data.objects if o.type == 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
rig.animation_data_create()
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
mw_t = rig.matrix_world.copy(); mw_t_inv = mw_t.inverted(); R_mw_t_inv = mw_t_inv.to_3x3()
hip_t = (mw_t @ rig.data.bones['mixamorig:Hips'].head_local).z

def depth(b):
    n = 0
    while b.parent: b = b.parent; n += 1
    return n
order = sorted(rig.pose.bones, key=lambda p: depth(p.bone))

def rest_dir(r, b): return ((r.matrix_world @ b.matrix_local).to_3x3() @ Vector((0, 1, 0))).normalized()

def tpose_rest(r):   # every bone's rest matrix in world space
    return {b.name: r.matrix_world @ b.matrix_local for b in r.data.bones}

FINGER = re.compile(r'Hand(Thumb|Index|Middle|Ring|Pinky)')   # the MPFB fingers' bone frames are too different to copy: they stay in their relaxed rest pose
ONLY = os.environ.get('ONLY')
for club_name, fbx, secs in CLIPS:
    if ONLY and club_name != ONLY: continue
    path = os.path.join(SRC_DIR, fbx + '.fbx')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    src = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o not in before)
    new = set(bpy.data.objects) - before
    sact = src.animation_data.action
    s_rest = tpose_rest(src)
    Rfix = {}
    for tb in rig.data.bones:
        if tb.name in src.data.bones:
            q = rest_dir(rig, tb).rotation_difference(rest_dir(src, src.data.bones[tb.name]))   # swing this bone's rest direction onto Mixamo's, so an A-pose rig is treated as the T-pose rig the clips were made for
            Rfix[tb.name] = q.to_matrix()
    hip_s = s_rest['mixamorig:Hips'].translation.z
    k = hip_t / hip_s
    f0 = int(sact.frame_range[0]); fps = bpy.context.scene.render.fps
    f1 = f0 + int(round(secs * fps))
    act = bpy.data.actions.new(club_name); act.use_fake_user = True
    rig.animation_data.action = act
    for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    shared = [pb for pb in order if pb.name in src.pose.bones]
    hips_rest_s = s_rest['mixamorig:Hips'].translation.copy()
    # the dance's own hip height differs a little from the rest pose, so the travel is measured from the first frame
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f); bpy.context.view_layer.update()
        M = {}                                                     # target armature-space pose matrices, built parent-first
        for pb in order:
            b = pb.bone
            Brest = b.matrix_local
            if b.parent:
                Prest = b.parent.matrix_local; Mp = M[b.parent.name]
                nob = Mp @ Prest.inverted() @ Brest                # where the bone would sit with no pose of its own
            else:
                Prest = None; nob = Brest.copy()
            if pb.name in src.pose.bones and not FINGER.search(pb.name):
                spb = src.pose.bones[pb.name]
                Sw = src.matrix_world @ spb.matrix                 # source bone, world
                D = Sw.to_3x3() @ s_rest[pb.name].to_3x3().inverted()    # how far it has turned from its rest, in world space
                Rt_world = D @ Rfix.get(pb.name, Matrix.Identity(3)) @ (mw_t @ Brest).to_3x3()             # the same turn on the target's rest
                Mdes = Matrix.Translation(nob.translation) @ (R_mw_t_inv @ Rt_world).to_4x4()
                if pb.name == 'mixamorig:Hips':                    # travel: the source hips' movement from its rest position, scaled to this body
                    dw = (Sw.translation - hips_rest_s) * k
                    Mdes = Matrix.Translation(Brest.translation + R_mw_t_inv @ dw) @ (R_mw_t_inv @ Rt_world).to_4x4()
                basis = (Brest.inverted() @ Mdes) if not b.parent else (Brest.inverted() @ Prest @ Mp.inverted() @ Mdes)
                q = basis.to_quaternion(); loc = basis.to_translation() if pb.name == 'mixamorig:Hips' else Vector((0, 0, 0))
                pb.rotation_quaternion = q; pb.location = loc
                used = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
            else:
                used = Matrix.Identity(4)
            M[pb.name] = nob @ used
            if pb.name in src.pose.bones and not FINGER.search(pb.name):
                pb.keyframe_insert('rotation_quaternion', frame=f - f0 + 1)
                if pb.name == 'mixamorig:Hips': pb.keyframe_insert('location', frame=f - f0 + 1)
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a.name.startswith('Armature|') or 'mixamo.com' in a.name: bpy.data.actions.remove(a)
    cv = getattr(act, 'fcurves', None) or [fc for l in act.layers for s_ in l.strips for cb in s_.channelbags for fc in cb.fcurves]
    print('CLIP', club_name, fbx, f1 - f0 + 1, 'frames', 'fps', fps, 'curves', len(cv), 'keys', sum(len(fc.keyframe_points) for fc in cv), 'range', tuple(act.frame_range))

rig.animation_data.action = None
for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.ops.object.select_all(action='SELECT')
# Mixamo's files run at 60fps: sample every 4th frame (15 per second, as the club's clips always were)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_frame_step=4, export_optimize_animation_size=True, export_yup=True)
print('WROTE', out, '%.2f MB' % (os.path.getsize(out) / 1e6))
