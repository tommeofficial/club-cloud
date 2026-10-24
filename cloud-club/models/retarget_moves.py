# Bake Mixamo mocap onto the crowd's own 20-bone rig, so every avatar gets the new moves without re-rigging.
# Both rigs sit in the same world space at the same scale, so copying world-space rotations is enough; the rest
# poses differ (crowd arms down, Mixamo arms out) and that is exactly what a world-space copy absorbs.
# Blender -b --python retarget.py -- <in.glb> <out.glb>
import bpy, sys, os, math

SRC_DIR = '/Users/tomconroy/Documents/Club Cloud/3D Models'
# Mixamo exports at 60fps; the importer sets the scene to match, so read it rather than assuming

# crowd bone <- mixamo bone
MAP = {
    'hips': 'Hips', 'spine': 'Spine', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head',
    'shoulder.L': 'LeftShoulder', 'upper_arm.L': 'LeftArm', 'forearm.L': 'LeftForeArm', 'hand.L': 'LeftHand',
    'shoulder.R': 'RightShoulder', 'upper_arm.R': 'RightArm', 'forearm.R': 'RightForeArm', 'hand.R': 'RightHand',
    'thigh.L': 'LeftUpLeg', 'shin.L': 'LeftLeg', 'foot.L': 'LeftFoot',
    'thigh.R': 'RightUpLeg', 'shin.R': 'RightLeg', 'foot.R': 'RightFoot',
}

# clip name -> (mixamo file, seconds to keep). Dances are cut near a 16-beat bar at ~125bpm so they loop cleanly.
BAR = 7.68
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

src_glb, out_glb = sys.argv[sys.argv.index('--') + 1:][:2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src_glb)
tgt = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for a in bpy.data.actions:
    a.use_fake_user = True                      # keep the clips we are not replacing

def retarget(fbx_path, clip_name, seconds):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    added = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in added if o.type == 'ARMATURE')
    act = src.animation_data.action
    fps = bpy.context.scene.render.fps
    f0 = int(act.frame_range[0])
    f1 = min(int(act.frame_range[1]), f0 + int(round(seconds * fps)))

    bpy.context.view_layer.objects.active = tgt
    bpy.ops.object.mode_set(mode='POSE')
    for pb in tgt.pose.bones:
        pb.select = pb.name in MAP          # Blender 5 keeps bone selection on the pose bone
    for tb, sb in MAP.items():
        pb = tgt.pose.bones[tb]
        for c in list(pb.constraints):
            pb.constraints.remove(c)
        r = pb.constraints.new('COPY_ROTATION')
        r.target, r.subtarget = src, 'mixamorig:' + sb
        r.target_space = r.owner_space = 'WORLD'
        if tb == 'hips':                         # only the hips travel; the rest follow the hierarchy
            l = pb.constraints.new('COPY_LOCATION')
            l.target, l.subtarget = src, 'mixamorig:' + sb
            l.target_space = l.owner_space = 'WORLD'

    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, step=2, only_selected=True, visual_keying=True,
                     clear_constraints=True, clear_parents=False, use_current_action=False,
                     bake_types={'POSE'})   # every other frame: 30 samples a second is plenty for a crowd
    baked = tgt.animation_data.action
    old = bpy.data.actions.get(clip_name)
    if old and old is not baked:
        old.name = clip_name + '__old'
        old.use_fake_user = False
    baked.name = clip_name
    baked.use_fake_user = True
    # start every clip at frame 1 so the player's time maths lines up with the other clips
    if f0 != 1:
        for fc in baked.fcurves:
            for kp in fc.keyframe_points:
                kp.co.x -= (f0 - 1); kp.handle_left.x -= (f0 - 1); kp.handle_right.x -= (f0 - 1)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in added:
        bpy.data.objects.remove(o, do_unlink=True)
    print('CLIP %-11s <- %-22s %5.2fs @%dfps' % (clip_name, os.path.basename(fbx_path)[:-4], (f1 - f0) / fps, fps))

for name, fbx, secs in CLIPS:
    p = os.path.join(SRC_DIR, fbx + '.fbx')
    if not os.path.exists(p):
        print('MISSING ' + p); continue
    retarget(p, name, secs)

# every avatar shares this one rig, so the moves ship once as their own file rather than baked into ten copies:
# keep the new clips only, drop the meshes, and the club merges them onto each character at load
KEEP = {name for name, _f, _s in CLIPS}
for a in list(bpy.data.actions):
    if a.name not in KEEP:
        bpy.data.actions.remove(a)
    else:
        a.use_fake_user = True
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
tgt.animation_data.action = None
print('ACTIONS ' + ','.join(sorted(a.name for a in bpy.data.actions)))

bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_bake_animation=False, export_optimize_animation_size=True,
                          export_yup=True)
print('WROTE %s %.2f MB' % (out_glb, os.path.getsize(out_glb) / 1e6))
