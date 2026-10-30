# Mixamo's clips are made against a T-pose rest. MPFB's body rests in an A-pose, so arms fold up wrongly. Raise the arms to a T,
# bake that into the meshes and make it the rest pose. Blender -b out/<x>.blend --python tpose.py -- <out.blend>
import bpy, sys
from mathutils import Vector, Matrix
out = sys.argv[sys.argv.index('--') + 1]
rig = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
print('MESHES', [m.name for m in meshes])
bpy.ops.object.select_all(action='DESELECT')
for m in meshes:                                   # bake the body shape (its macro sliders are shape keys) so the pose can be applied
    if m.data.shape_keys:
        bpy.context.view_layer.objects.active = m; m.select_set(True)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True); m.select_set(False)
bpy.context.view_layer.objects.active = rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
bpy.context.view_layer.update()
mw = rig.matrix_world
body = bpy.data.objects[[m.name for m in meshes if '.' not in m.name][0]]
def centre(group):   # where the body mesh really has this bone's flesh, in world space
    gi = body.vertex_groups[group].index; pts = []
    for v in body.data.vertices:
        w = next((g.weight for g in v.groups if g.group == gi), 0)
        if w > 0.9: pts.append(body.matrix_world @ v.co)
    return sum(pts, Vector()) / max(1, len(pts))
for side in ('Left', 'Right'):
    pb = rig.pose.bones[f'mixamorig:{side}Arm']
    d = centre(f'mixamorig:{side}ForeArm') - centre(f'mixamorig:{side}Arm')   # the mesh's own arm direction (A-pose, slopes down)
    t = Vector((1 if d.x > 0 else -1, 0, 0))
    q = d.normalized().rotation_difference(t)     # the lift that makes the mesh arm horizontal like the skeleton
    head = mw @ pb.head
    R = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
    pb.matrix = mw.inverted() @ R @ (mw @ pb.matrix)
    bpy.context.view_layer.update()
    print('ARM', side, 'mesh dir', [round(v, 2) for v in d.normalized()], 'lift deg', round(q.angle * 57.3, 1))
bpy.ops.object.mode_set(mode='OBJECT')
for m in meshes:                                   # bake the pose into each mesh, then make it the rest pose
    bpy.context.view_layer.objects.active = m
    for mod in list(m.modifiers):
        if mod.type == 'ARMATURE':
            try: bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception as e: print('APPLYFAIL', m.name, e)
    mod = m.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.transforms_clear()
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVEDT', out)
