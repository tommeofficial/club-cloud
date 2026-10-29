# Put the DJ's own moves (play, idle, wave, hype, kiss) onto her Mixamo rig. Mixamo has no deck-mixing, wave or kiss, so
# instead of swapping the motion, each bone of the new rig is aimed the way the same bone of the old rig points in every frame
# (spine, neck, head, shoulders, arms, forearms, hands). Pointing bones, not copying rotations, is what keeps the skin from tearing.
# Blender -b --python build_dj.py -- <old_dj.glb> <rigged.fbx> <out.glb> [max_texture_px]
import bpy, sys, os, math
from mathutils import Matrix
a = sys.argv[sys.argv.index('--') + 1:]
old_glb, new_fbx, out_glb = a[:3]; max_px = int(a[3]) if len(a) > 3 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=old_glb); old = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=new_fbx); added = [o for o in bpy.data.objects if o not in before]
new = next(o for o in added if o.type == 'ARMATURE')
for act in list(bpy.data.actions):
    if act not in [x for x in bpy.data.actions if old.animation_data and old.animation_data.action == x]: pass
MAP = [('hips', 'Hips'), ('spine', 'Spine'), ('chest', 'Spine2'), ('neck', 'Neck'), ('head', 'Head'),
       ('shoulder.L', 'LeftShoulder'), ('upper_arm.L', 'LeftArm'), ('forearm.L', 'LeftForeArm'), ('hand.L', 'LeftHand'),
       ('shoulder.R', 'RightShoulder'), ('upper_arm.R', 'RightArm'), ('forearm.R', 'RightForeArm'), ('hand.R', 'RightHand')]
clips = {x.name: x for x in bpy.data.actions if x.name in ('play', 'idle', 'wave', 'hype', 'kiss')}
for o in added:
    if o.type == 'MESH': o.hide_viewport = True          # aiming is faster without the skin being recomputed each step
if new.animation_data: new.animation_data.action = None
for pb in new.pose.bones: pb.rotation_mode = 'QUATERNION'
bpy.context.view_layer.objects.active = new
bpy.ops.object.mode_set(mode='POSE')
sc = bpy.context.scene
def aim(pb, want):
    head = new.matrix_world @ pb.head; tail = new.matrix_world @ pb.tail
    R = (tail - head).normalized().rotation_difference(want).to_matrix().to_4x4()
    pb.matrix = new.matrix_world.inverted() @ (Matrix.Translation(head) @ R @ Matrix.Translation(-head)) @ new.matrix_world @ pb.matrix
    bpy.context.view_layer.update()
made = {}
for name, act in clips.items():
    old.animation_data_create(); old.animation_data.action = act
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    out = bpy.data.actions.new(name); out.use_fake_user = True
    new.animation_data_create(); new.animation_data.action = out
    if not new.animation_data.action_slot: new.animation_data.action_slot = out.slots.new('OBJECT', 'Armature')
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        for ob, nb in MAP:
            pb = old.pose.bones[ob]
            want = ((old.matrix_world @ pb.tail) - (old.matrix_world @ pb.head)).normalized()
            aim(new.pose.bones['mixamorig:' + nb], want)
        for pb in new.pose.bones: pb.keyframe_insert('rotation_quaternion', frame=f - f0 + 1)
    q = new.pose.bones['mixamorig:LeftArm'].rotation_quaternion
    print('DBG', name, [round(x, 3) for x in q], [len(cb.fcurves) for l in out.layers for st in l.strips for cb in st.channelbags])
    made[name] = f1 - f0 + 1
    print('CLIP', name, made[name], 'frames')
for n in made:
    new.animation_data.action = bpy.data.actions[n]; new.animation_data.action_slot = new.animation_data.action.slots[0]; sc.frame_set(10)
    print('CHECK', n, new.animation_data.action_slot.name_display if new.animation_data.action_slot else None, [round(x, 3) for x in new.pose.bones['mixamorig:LeftArm'].rotation_quaternion])
# the Mixamo T-pose action, if any, and the old rig have no place in the output
new.animation_data.action = None
for pb in new.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)
bpy.ops.object.mode_set(mode='OBJECT')
for o in added:
    if o.type == 'MESH': o.hide_viewport = False
for o in [o for o in bpy.data.objects if o not in added]: bpy.data.objects.remove(o, do_unlink=True)
for x in list(bpy.data.actions):
    if x.name not in made: bpy.data.actions.remove(x)
for img in bpy.data.images:
    if img.size[0] > max_px or img.size[1] > max_px:
        w, h = img.size; k = max_px / max(w, h); img.scale(int(w * k), int(h * k))
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_frame_step=1, export_image_format='JPEG', export_jpeg_quality=86, export_yup=True)
print('WROTE %s %.2f MB' % (out_glb, os.path.getsize(out_glb) / 1e6))
