# Blender -b out/<x>.blend --python pose.py -- <clip> <frame> <out.png>
# Borrows a clip from an existing crowd model (same Mixamo skeleton) and puts the character into it at one frame.
import bpy, sys, math
args = sys.argv[sys.argv.index('--') + 1:]
clip, frame = args[0], float(args[1])
rig = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath='/Users/tomconroy/Documents/club-cloud/cloud-club/models/crowd_leon.glb')
act = bpy.data.actions[clip]
for o in set(bpy.data.objects) - before: bpy.data.objects.remove(o, do_unlink=True)
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
rig.animation_data_create(); rig.animation_data.action = act
if hasattr(rig.animation_data, 'action_slot') and act.slots: rig.animation_data.action_slot = act.slots[0]
bpy.context.scene.frame_set(int(frame))
bpy.context.view_layer.update()
print('POSED', clip, frame, rig.pose.bones['mixamorig:LeftHand'].head.copy())

exec(open('/Users/tomconroy/Documents/club-cloud/mixamo/base/render.py').read())
