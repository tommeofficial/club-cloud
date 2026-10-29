# Make a Mixamo upload from a crowd GLB: raise the arms from hanging straight down into an A-pose (Mixamo's
# auto-rigger reads that reliably), bake the pose into the mesh, drop the old skeleton, and write one FBX with
# its textures embedded.
# Blender -b --python export_for_mixamo.py -- <in.glb> <out.fbx>
import bpy, sys, math
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[:2]
ANGLE = float(args[2]) if len(args) > 2 else 50   # degrees out from hanging straight down; 90 is a full T-pose
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
    turn = math.radians(ANGLE) - now
    if abs(turn) < math.radians(3): continue
    R = Matrix.Rotation(-turn * side, 4, 'Y')           # about the front-back axis
    pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(head) @ R @ Matrix.Translation(-head)) @ arm.matrix_world @ pb.matrix
    bpy.context.view_layer.update()
    print('ARM %s %.0f deg -> %d deg' % (name, math.degrees(now), ANGLE))
# bent elbows and wrists upset the rigger too (the DJ has her hands up by her face): lay each forearm and hand straight
# out along the upper arm
for side, sfx in ((1, 'L'), (-1, 'R')):
    ua = arm.pose.bones.get('upper_arm.' + sfx)
    if not ua: continue
    for name in ('forearm.' + sfx, 'hand.' + sfx):
        pb = arm.pose.bones.get(name)
        if not pb: continue
        bpy.context.view_layer.update()
        head = arm.matrix_world @ pb.head; tail = arm.matrix_world @ pb.tail
        want = ((arm.matrix_world @ ua.tail) - (arm.matrix_world @ ua.head)).normalized()
        R = (tail - head).normalized().rotation_difference(want).to_matrix().to_4x4()
        pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(head) @ R @ Matrix.Translation(-head)) @ arm.matrix_world @ pb.matrix
bpy.context.view_layer.update()
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
# scans leave dozens of loose scraps floating about; they upset Mixamo's auto-rigger, so drop the tiny ones
import bmesh
MIN_PART = int(args[3]) if len(args) > 3 else 0
if MIN_PART:
    bm = bmesh.new(); bm.from_mesh(obj.data)
    seen, drop = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        part, st = [v], [v]; seen.add(v.index)
        while st:
            x = st.pop()
            for e in x.link_edges:
                w = e.other_vert(x)
                if w.index not in seen: seen.add(w.index); st.append(w); part.append(w)
        if len(part) < MIN_PART: drop += part
    bmesh.ops.delete(bm, geom=drop, context='VERTS'); bm.to_mesh(obj.data); bm.free()
    print('CLEAN removed %d verts in loose scraps' % len(drop))
# a big hat upsets Mixamo's rigger: take it off (found by colour: pale and unsaturated up at head height), save it on its
# own with the bare body's size and place, and it goes back on the rigged head afterwards (see build_mixamo.py)
HAT_Z = float(args[4]) if len(args) > 4 else 0
if HAT_Z:
    import json
    img = next(i for i in bpy.data.images if i.size[0] > 4)
    W, H = img.size; px = list(img.pixels)
    me = obj.data; uvd = me.uv_layers.active.data
    acc = [[0, 0, 0, 0] for _ in me.vertices]
    for l in me.loops:
        u, v = uvd[l.index].uv; x = min(W - 1, max(0, int(u * W))); y = min(H - 1, max(0, int(v * H))); i = (y * W + x) * 4
        c = acc[l.vertex_index]; c[0] += px[i]; c[1] += px[i + 1]; c[2] += px[i + 2]; c[3] += 1
    hatv = set()
    for v in me.vertices:
        c = acc[v.index]
        if not c[3] or v.co.z < HAT_Z: continue
        r, g, b = c[0] / c[3], c[1] / c[3], c[2] / c[3]; mx, mn = max(r, g, b), min(r, g, b)
        if mx > 0.35 and (mx - mn) / max(mx, 1e-5) < 0.25: hatv.add(v.index)
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    hatf = [f.index for f in bm.faces if sum(v.index in hatv for v in f.verts) >= 2]
    hbm = bm.copy(); hbm.faces.ensure_lookup_table(); hs = set(hatf)
    bmesh.ops.delete(hbm, geom=[f for f in hbm.faces if f.index not in hs], context='FACES')
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in hatf], context='FACES')
    bm.to_mesh(me); bm.free()
    hm = me.copy(); hbm.to_mesh(hm); hbm.free()
    hobj = bpy.data.objects.new('hat', hm); bpy.context.collection.objects.link(hobj)
    ps = [v.co for v in me.vertices]
    json.dump(dict(zmin=min(p.z for p in ps), zmax=max(p.z for p in ps), cx=(min(p.x for p in ps) + max(p.x for p in ps)) / 2, cy=(min(p.y for p in ps) + max(p.y for p in ps)) / 2, hatverts=len(hatv)), open(dst.rsplit('.', 1)[0] + '_hat.json', 'w'))
    bpy.ops.object.select_all(action='DESELECT'); hobj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=dst.rsplit('.', 1)[0] + '_hat.glb', use_selection=True, export_format='GLB', export_image_format='JPEG')
    bpy.data.objects.remove(hobj, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    print('HAT removed %d verts' % len(hatv))
low = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
obj.location.z -= low
bpy.ops.object.transform_apply(location=True)
h = max(v.co.z for v in obj.data.vertices)

bpy.ops.export_scene.fbx(filepath=dst, use_selection=False, object_types={'MESH'},
                         path_mode='COPY', embed_textures=True, apply_scale_options='FBX_SCALE_ALL',
                         axis_forward='-Z', axis_up='Y', mesh_smooth_type='FACE', add_leaf_bones=False)
print('WROTE %s verts=%d height=%.2fm' % (dst, len(obj.data.vertices), h))
