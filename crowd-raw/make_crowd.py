# Cloud Club crowd: builds rigged, animated stand-in clubbers and exports one GLB each.
# Run: Blender -b -P make_crowd.py -- <out_dir>
# Every character shares one skeleton and one set of actions, so Rodin meshes can replace the
# stand-in bodies later (bind to the same bones) without touching the animations.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Quaternion

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp'
FPS = 30

BONES = [  # name, head, tail, parent
    ('hips', (0, 0, 0.95), (0, 0, 1.08), None),
    ('spine', (0, 0, 1.08), (0, 0, 1.28), 'hips'),
    ('chest', (0, 0, 1.28), (0, 0, 1.45), 'spine'),
    ('neck', (0, 0, 1.45), (0, 0, 1.53), 'chest'),
    ('head', (0, 0, 1.53), (0, 0, 1.76), 'neck'),
]
for s, x in (('L', 1), ('R', -1)):
    BONES += [
        (f'shoulder.{s}', (0.04 * x, 0, 1.42), (0.17 * x, 0, 1.42), 'chest'),
        (f'upper_arm.{s}', (0.17 * x, 0, 1.42), (0.44 * x, 0, 1.42), f'shoulder.{s}'),
        (f'forearm.{s}', (0.44 * x, 0, 1.42), (0.68 * x, 0, 1.42), f'upper_arm.{s}'),
        (f'hand.{s}', (0.68 * x, 0, 1.42), (0.78 * x, 0, 1.42), f'forearm.{s}'),
        (f'thigh.{s}', (0.1 * x, 0, 0.95), (0.1 * x, 0, 0.52), 'hips'),
        (f'shin.{s}', (0.1 * x, 0, 0.52), (0.1 * x, 0, 0.09), f'thigh.{s}'),
        (f'foot.{s}', (0.1 * x, 0, 0.09), (0.1 * x, -0.15, 0.03), f'shin.{s}'),
    ]

CHARACTERS = [
    dict(name='crowd_ava', skin=(0.86, 0.62, 0.48), top=(1.0, 0.18, 0.55), pants=(0.05, 0.05, 0.06), shoes=(0.95, 0.95, 0.95),
         hair=(0.12, 0.07, 0.04), crop=True, ponytail=True, sleeves=False, build=0.92),
    dict(name='crowd_leo', skin=(0.55, 0.36, 0.24), top=(0.04, 0.04, 0.05), pants=(0.12, 0.2, 0.42), shoes=(0.95, 0.95, 0.95),
         hair=(0.03, 0.03, 0.03), crop=False, ponytail=False, sleeves=False, build=1.05),
    dict(name='crowd_kai', skin=(0.95, 0.76, 0.62), top=(0.1, 0.8, 0.95), pants=(0.07, 0.07, 0.08), shoes=(0.85, 0.15, 0.15),
         hair=(0.6, 0.45, 0.2), crop=False, ponytail=False, sleeves=True, hoodie=True, hat=(0.95, 0.85, 0.2), build=1.0),
]

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, rgb, rough=0.7, emit=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emit
    return m

def build_armature():
    arm = bpy.data.armatures.new('Rig')
    ob = bpy.data.objects.new('Rig', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, h, t, parent in BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        b.roll = 0
        if parent: b.parent = eb[parent]
        eb[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ob.pose.bones: pb.rotation_mode = 'QUATERNION'
    return ob

# ---------------------------------------------------------------- body
class Body:
    def __init__(self, ch):
        self.bm = bmesh.new()
        self.groups = {}  # vertex index ranges per bone
        self.mats = []
        self.ch = ch
        self.layer = self.bm.verts.layers.deform.verify()

    def mat(self, key, rgb, rough=0.7):
        for i, (k, _) in enumerate(self.mats):
            if k == key: return i
        self.mats.append((key, material(self.ch['name'] + '_' + key, rgb, rough)))
        return len(self.mats) - 1

    def add(self, bone, kind, loc, size, rot=(0, 0, 0), mat=0, seg=14):
        tmp = bmesh.new()
        if kind == 'cyl':
            bmesh.ops.create_cone(tmp, cap_ends=True, segments=seg, radius1=size[0], radius2=size[1], depth=size[2])
        elif kind == 'sph':
            bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=max(6, seg // 2), radius=1)
            bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        elif kind == 'box':
            bmesh.ops.create_cube(tmp, size=1)
            bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
            bmesh.ops.bevel(tmp, geom=tmp.edges[:] + tmp.verts[:], offset=min(size) * 0.25, segments=2, affect='EDGES')
        R = (Matrix.Rotation(math.radians(rot[2]), 4, 'Z') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') @ Matrix.Rotation(math.radians(rot[0]), 4, 'X'))
        bmesh.ops.transform(tmp, matrix=Matrix.Translation(Vector(loc)) @ R, verts=tmp.verts)
        me = bpy.data.meshes.new('tmp'); tmp.to_mesh(me); tmp.free()
        for p in me.polygons: p.material_index = mat; p.use_smooth = True
        gi = list(self.groups).index(bone) if bone in self.groups else len(self.groups)
        self.groups.setdefault(bone, gi)
        n0 = len(self.bm.verts)
        self.bm.from_mesh(me)
        self.bm.verts.ensure_lookup_table()
        for v in self.bm.verts[n0:]: v[self.layer][gi] = 1.0
        bpy.data.meshes.remove(me)

    def finish(self, rig):
        me = bpy.data.meshes.new(self.ch['name'] + '_body')
        self.bm.to_mesh(me); self.bm.free()
        for _, m in self.mats: me.materials.append(m)
        ob = bpy.data.objects.new(self.ch['name'], me)
        bpy.context.scene.collection.objects.link(ob)
        for bone, gi in sorted(self.groups.items(), key=lambda kv: kv[1]): ob.vertex_groups.new(name=bone)
        ob.parent = rig
        mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
        return ob

def build_body(ch, rig):
    b = Body(ch); k = ch['build']
    skin, top, pants, shoes, hair = (b.mat('skin', ch['skin'], 0.55), b.mat('top', ch['top'], 0.6), b.mat('pants', ch['pants'], 0.8),
                                    b.mat('shoes', ch['shoes'], 0.5), b.mat('hair', ch['hair'], 0.9))
    eye = b.mat('eye', (0.02, 0.02, 0.03), 0.2)
    # torso
    b.add('hips', 'cyl', (0, 0, 0.98), (0.15 * k, 0.16 * k, 0.2), mat=pants)
    b.add('spine', 'cyl', (0, 0, 1.18), (0.14 * k, 0.15 * k, 0.22), mat=skin if ch['crop'] else top)
    b.add('chest', 'cyl', (0, 0, 1.35), (0.18 * k, 0.15 * k, 0.22), mat=top)
    if ch.get('hoodie'):
        b.add('chest', 'cyl', (0, 0, 1.23), (0.17, 0.18, 0.2), mat=top)
        b.add('chest', 'sph', (0, 0.06, 1.47), (0.15, 0.1, 0.06), mat=top)
    b.add('neck', 'cyl', (0, 0, 1.5), (0.05, 0.055, 0.1), mat=skin)
    # head
    b.add('head', 'sph', (0, 0, 1.64), (0.105, 0.115, 0.125), mat=skin, seg=18)
    for x in (-0.04, 0.04): b.add('head', 'sph', (x, -0.105, 1.655), (0.014, 0.008, 0.016), mat=eye, seg=8)
    b.add('head', 'sph', (0, 0.012, 1.69), (0.112, 0.118, 0.1), mat=hair, seg=18)
    if ch['ponytail']:
        b.add('head', 'cyl', (0, 0.15, 1.6), (0.035, 0.02, 0.2), rot=(25, 0, 0), mat=hair)
    if ch.get('hat'):
        hat = b.mat('hat', ch['hat'], 0.8)
        b.add('head', 'cyl', (0, 0.01, 1.73), (0.125, 0.11, 0.09), mat=hat)
        b.add('head', 'cyl', (0, 0.01, 1.69), (0.19, 0.17, 0.02), mat=hat)
    # arms and legs
    for s, x in (('L', 1), ('R', -1)):
        b.add(f'shoulder.{s}', 'sph', (0.17 * x, 0, 1.42), (0.07 * k, 0.07, 0.07), mat=top)
        arm_mat = top if ch['sleeves'] else skin
        b.add(f'upper_arm.{s}', 'cyl', (0.305 * x, 0, 1.42), (0.055 * k, 0.045 * k, 0.27), rot=(0, 90, 0), mat=arm_mat)
        if not ch['sleeves']: b.add(f'upper_arm.{s}', 'cyl', (0.22 * x, 0, 1.42), (0.065 * k, 0.06 * k, 0.1), rot=(0, 90, 0), mat=top)
        b.add(f'forearm.{s}', 'cyl', (0.56 * x, 0, 1.42), (0.045, 0.036, 0.25), rot=(0, 90, 0), mat=top if ch['sleeves'] else skin)
        b.add(f'hand.{s}', 'sph', (0.73 * x, 0, 1.42), (0.06, 0.03, 0.045), mat=skin, seg=10)
        b.add(f'thigh.{s}', 'cyl', (0.1 * x, 0, 0.735), (0.085 * k, 0.065 * k, 0.45), mat=pants)
        b.add(f'shin.{s}', 'cyl', (0.1 * x, 0, 0.31), (0.06, 0.05, 0.44), mat=pants)
        b.add(f'foot.{s}', 'box', (0.1 * x, -0.05, 0.045), (0.1, 0.26, 0.09), mat=shoes)
    return b.finish(rig)

# ---------------------------------------------------------------- poses (armature-space rotations, applied per bone)
# Axes: character faces -Y, arms point along +X (left) / -X (right), Z is up.
REST = {}
def rot_local(rig, bone, rots):
    q = Quaternion()
    for axis, deg in rots:
        q = Quaternion(Vector({'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[axis]), math.radians(deg)) @ q
    M = rig.data.bones[bone].matrix_local.to_quaternion()
    return M.inverted() @ q @ M

BASE = {  # relaxed standing pose (arms down)
    'upper_arm.L': [('Y', 74), ('Z', -8)], 'upper_arm.R': [('Y', -74), ('Z', 8)],
    'forearm.L': [('Z', -18)], 'forearm.R': [('Z', 18)],
}

def pose(**over):
    p = {k: list(v) for k, v in BASE.items()}
    for k, v in over.items():
        k = k.replace('_L', '.L').replace('_R', '.R')
        if k in ('lift', 'sink'): p[k] = v
        else: p[k] = v
    return p

def key_action(rig, name, frames, loop=False):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    names = [b[0] for b in BONES]
    for f, p in frames:
        for bn in names:
            pb = rig.pose.bones[bn]
            pb.rotation_quaternion = rot_local(rig, bn, p.get(bn, []))
            pb.keyframe_insert('rotation_quaternion', frame=f)
            if bn == 'hips':
                # hips bone points up (+Z), so its local Y is world up
                pb.location = (0, p.get('lift', 0), 0)
                pb.keyframe_insert('location', frame=f)
    if loop:  # repeat first key at the end for a seamless cycle
        f0, p0 = frames[0]
        end = frames[-1][0] + (frames[1][0] - frames[0][0] if len(frames) > 1 else 1)
        key_frames = [(end, p0)]
        for f, p in key_frames:
            for bn in names:
                pb = rig.pose.bones[bn]
                pb.rotation_quaternion = rot_local(rig, bn, p.get(bn, []))
                pb.keyframe_insert('rotation_quaternion', frame=f)
                if bn == 'hips':
                    pb.location = (0, p.get('lift', 0), 0); pb.keyframe_insert('location', frame=f)
    rig.animation_data.action = None
    return act

def make_actions(rig):
    A = {}
    # idle sway (2 s loop)
    A['idle'] = key_action(rig, 'idle', [
        (0, pose(spine=[('Y', 2)], head=[('Z', -4)])),
        (30, pose(spine=[('Y', -2)], head=[('Z', 4)], lift=-0.005)),
    ], loop=True)
    # dance: 2-beat loop at 120 BPM (30 frames); knees bounce on each beat, arms swing
    dip = dict(thigh_L=[('X', -14)], thigh_R=[('X', -14)], shin_L=[('X', 26)], shin_R=[('X', 26)], foot_L=[('X', -12)], foot_R=[('X', -12)])
    A['dance'] = key_action(rig, 'dance', [
        (0, pose(lift=-0.06, **dip, spine=[('X', 6)], head=[('X', 10)], upper_arm_L=[('Y', 60), ('Z', -35)], upper_arm_R=[('Y', -70), ('Z', 10)], forearm_L=[('Z', -70)], forearm_R=[('Z', 30)])),
        (8, pose(lift=0.0, spine=[('Y', 4)], head=[('X', -4)], upper_arm_L=[('Y', 70)], upper_arm_R=[('Y', -60), ('Z', 35)], forearm_L=[('Z', -30)], forearm_R=[('Z', 70)])),
        (15, pose(lift=-0.06, **dip, spine=[('X', 6)], head=[('X', 10)], upper_arm_L=[('Y', 70), ('Z', -10)], upper_arm_R=[('Y', -60), ('Z', 35)], forearm_L=[('Z', -30)], forearm_R=[('Z', 70)])),
        (23, pose(lift=0.0, spine=[('Y', -4)], head=[('X', -4)], upper_arm_L=[('Y', 60), ('Z', -35)], upper_arm_R=[('Y', -70)], forearm_L=[('Z', -70)], forearm_R=[('Z', 30)])),
    ], loop=True)
    # hype: jumping fist pumps (2-beat loop)
    A['hype'] = key_action(rig, 'hype', [
        (0, pose(lift=-0.09, **dip, upper_arm_L=[('Y', -20), ('Z', -20)], forearm_L=[('Z', -40)], upper_arm_R=[('Y', 40)], forearm_R=[('Z', 60)], head=[('X', 14)])),
        (7, pose(lift=0.1, upper_arm_L=[('Y', -75)], forearm_L=[('Z', -5)], upper_arm_R=[('Y', 20)], forearm_R=[('Z', 40)], head=[('X', -10)])),
        (15, pose(lift=-0.09, **dip, upper_arm_L=[('Y', -20), ('Z', -20)], forearm_L=[('Z', -40)], upper_arm_R=[('Y', 40)], forearm_R=[('Z', 60)], head=[('X', 14)])),
        (22, pose(lift=0.1, upper_arm_L=[('Y', -75)], forearm_L=[('Z', -5)], upper_arm_R=[('Y', 20)], forearm_R=[('Z', 40)], head=[('X', -10)])),
    ], loop=True)
    up = dict(upper_arm_L=[('Y', -78)], upper_arm_R=[('Y', 78)])
    A['cheer'] = key_action(rig, 'cheer', [
        (0, pose()),
        (6, pose(lift=0.05, **up, forearm_L=[('Y', -20)], forearm_R=[('Y', 20)], head=[('X', -18)], spine=[('X', -8)])),
        (14, pose(lift=0.12, upper_arm_L=[('Y', -70), ('X', -15)], upper_arm_R=[('Y', 70), ('X', -15)], forearm_L=[('Y', -30)], forearm_R=[('Y', 30)], head=[('X', -22)])),
        (22, pose(lift=0.0, **up, forearm_L=[('Y', 10)], forearm_R=[('Y', -10)], head=[('X', -15)])),
        (30, pose(lift=0.12, upper_arm_L=[('Y', -70), ('X', -15)], upper_arm_R=[('Y', 70), ('X', -15)], forearm_L=[('Y', -30)], forearm_R=[('Y', 30)], head=[('X', -22)])),
        (45, pose()),
    ])
    thumbs = dict(upper_arm_L=[('Y', 50), ('Z', -60)], upper_arm_R=[('Y', -50), ('Z', 60)], forearm_L=[('Z', -20)], forearm_R=[('Z', 20)], hand_L=[('X', 90)], hand_R=[('X', 90)])
    A['boo'] = key_action(rig, 'boo', [
        (0, pose()),
        (8, pose(**thumbs, head=[('Z', -18), ('X', 8)], spine=[('X', 6)])),
        (16, pose(**thumbs, head=[('Z', 18), ('X', 8)], spine=[('X', 6)], lift=-0.02)),
        (24, pose(**thumbs, head=[('Z', -18), ('X', 8)], spine=[('X', 6)])),
        (32, pose(**thumbs, head=[('Z', 18), ('X', 8)], spine=[('X', 6)], lift=-0.02)),
        (45, pose()),
    ])
    A['fall'] = key_action(rig, 'fall', [
        (0, pose()),
        (8, pose(hips=[('X', -12)], spine=[('X', 10)], upper_arm_L=[('Y', -10), ('Z', -40)], upper_arm_R=[('Y', 10), ('Z', 40)], thigh_L=[('X', -20)], shin_L=[('X', 30)])),
        (20, pose(lift=-0.55, hips=[('X', -78)], spine=[('X', 6)], head=[('X', 25)], upper_arm_L=[('Y', -30)], upper_arm_R=[('Y', 30)], thigh_L=[('X', -70)], thigh_R=[('X', -50)], shin_L=[('X', 30)], shin_R=[('X', 10)])),
        (26, pose(lift=-0.6, hips=[('X', -88)], head=[('X', 10)], upper_arm_L=[('Y', -10)], upper_arm_R=[('Y', 10)], thigh_L=[('X', -75)], thigh_R=[('X', -60)], shin_L=[('X', 20)], shin_R=[('X', 5)])),
        (40, pose(lift=-0.62, hips=[('X', -90)], head=[('X', 5), ('Z', 20)], upper_arm_L=[('Y', 5)], upper_arm_R=[('Y', 20)], thigh_L=[('X', -78)], thigh_R=[('X', -62)], shin_L=[('X', 20)], shin_R=[('X', 5)])),
    ])
    A['throw'] = key_action(rig, 'throw', [
        (0, pose()),
        (8, pose(spine=[('Z', 25), ('X', -8)], upper_arm_R=[('Y', 70), ('Z', -30)], forearm_R=[('Y', 90)], thigh_R=[('X', 10)], head=[('Z', 10)])),
        (13, pose(spine=[('Z', -20), ('X', 12)], upper_arm_R=[('Y', 20), ('Z', 80)], forearm_R=[('Y', 10)], head=[('X', 6)])),
        (18, pose(spine=[('Z', -25), ('X', 16)], upper_arm_R=[('Y', -60), ('Z', 70)], forearm_R=[('Z', 10)], head=[('X', 8)])),
        (30, pose()),
    ])
    A['point'] = key_action(rig, 'point', [
        (0, pose()),
        (8, pose(upper_arm_R=[('Z', 88), ('Y', 6)], forearm_R=[('Z', 4)], head=[('X', 4)], spine=[('Z', -8)])),
        (24, pose(upper_arm_R=[('Z', 88), ('Y', 2)], forearm_R=[('Z', 4)], head=[('X', 4), ('Z', 6)], spine=[('Z', -8)])),
        (32, pose()),
    ])
    return A

def main():
    os.makedirs(OUT, exist_ok=True)
    for ch in CHARACTERS:
        clear()
        bpy.context.scene.render.fps = FPS
        rig = build_armature()
        body = build_body(ch, rig)
        make_actions(rig)
        # rest pose for export
        for pb in rig.pose.bones: pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
        for o in bpy.context.scene.objects: o.select_set(True)
        path = os.path.join(OUT, ch['name'] + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                                  export_force_sampling=True, export_optimize_animation_size=True, export_yup=True, export_apply=False)
        print('EXPORTED', path, os.path.getsize(path))

main()
