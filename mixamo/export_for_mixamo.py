# Make a Mixamo upload from a crowd GLB: raise the arms from hanging straight down into an A-pose (Mixamo's
# auto-rigger reads that reliably), bake the pose into the mesh, drop the old skeleton, and write one FBX with
# its textures embedded.
# Blender -b --python export_for_mixamo.py -- <in.glb> <out.fbx>
import bpy, sys, math
from mathutils import Matrix, Vector

src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 100]

# swing each upper arm outward until it sits ~40 degrees below horizontal, whatever angle it starts at
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
for side, name in ((1, 'upper_arm.L'), (-1, 'upper_arm.R')):
    if name not in arm.pose.bones: continue
    pb = arm.pose.bones[name]
    head = arm.matrix_world @ pb.head; tail = arm.matrix_world @ pb.tail
    d = (tail - head).normalized()
    now = math.atan2(d.x * side, -d.z)                  # 0 = straight down, 90 = straight out
    turn = math.radians(50) - now
    if abs(turn) < math.radians(3): continue
    R = Matrix.Rotation(-turn * side, 4, 'Y')           # about the front-back axis
    pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(head) @ R @ Matrix.Translation(-head)) @ arm.matrix_world @ pb.matrix
    bpy.context.view_layer.update()
    print('ARM %s %.0f deg -> 50 deg' % (name, math.degrees(now)))
bpy.ops.object.mode_set(mode='OBJECT')

# bake the posed shape into each mesh, then the skeleton can go
for o in meshes:
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        if m.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=m.name)
for o in list(bpy.data.objects):
    if o not in meshes:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
    o.vertex_groups.clear()
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
low = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
obj.location.z -= low
bpy.ops.object.transform_apply(location=True)
h = max(v.co.z for v in obj.data.vertices)

bpy.ops.export_scene.fbx(filepath=dst, use_selection=False, object_types={'MESH'},
                         path_mode='COPY', embed_textures=True, apply_scale_options='FBX_SCALE_ALL',
                         axis_forward='-Z', axis_up='Y', mesh_smooth_type='FACE', add_leaf_bones=False)
print('WROTE %s verts=%d height=%.2fm' % (dst, len(obj.data.vertices), h))
