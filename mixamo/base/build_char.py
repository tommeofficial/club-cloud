# Build one crowd character for the club: a free MPFB body in the Mixamo skeleton, dressed and recoloured, with the club's existing
# Mixamo clips, written as a GLB. Blender -b --python build_char.py -- <spec.json> <out.glb>
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

spec = json.load(open(sys.argv[sys.argv.index('--') + 1])); out = sys.argv[sys.argv.index('--') + 2]
female = spec['sex'] == 'female'
data = LocationService.get_user_data(); f = lambda *p: os.path.join(data, *p)
TMP = os.path.join('/tmp', 'cc_tex_' + os.path.basename(out))
CLIPS_FROM = '/Users/tomconroy/Documents/club-cloud/cloud-club/models/crowd_leon.glb'
KEEP = ['idle', 'lookaround', 'talk', 'dance', 'dance2', 'dance3', 'dance4', 'dance5', 'hype', 'cheer', 'clap', 'handsup', 'boo', 'sing', 'laugh']

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- body
macro = TargetService.get_default_macro_info_dict()
macro['gender'] = 0.0 if female else 1.0
for k, v in spec.get('macro', {}).items():
    if k == 'race': macro['race'] = v
    else: macro[k] = v
body = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=False, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
body.name = 'body'
skin = spec['skin']
HumanService.set_character_skin(f('skins', skin, skin + '.mhmat'), body, skin_type='GAMEENGINE')
# the skin material also wires the same picture in as an alpha map, which the glTF exporter mangles into blocky garbage: make the skin plainly opaque
for slot in body.material_slots:
    nt = slot.material.node_tree
    for n in [n for n in nt.nodes if n.name == 'AlphaMapTexture']: nt.nodes.remove(n)
    for n in nt.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            for l in [l for l in nt.links if l.to_node == n and l.to_socket.name == 'Alpha']: nt.links.remove(l)
            n.inputs['Alpha'].default_value = 1.0
rig = HumanService.add_builtin_rig(body, 'mixamo', import_weights=True)
rig.name = 'Armature'

# ---- pieces
objs = {}
def add(kind, folder, name, key):
    p = f(folder, name, name + '.mhclo')
    if not os.path.exists(p): print('MISSING', name); return
    objs[key] = HumanService.add_mhclo_asset(p, body, asset_type=kind, material_type='GAMEENGINE')
add('Eyes', 'eyes', 'low-poly', 'eyes'); add('Eyebrows', 'eyebrows', spec.get('brows', 'eyebrow001'), 'brows'); add('Eyelashes', 'eyelashes', 'eyelashes01', 'lashes')
add('Hair', 'hair', spec['hair'], 'hair')
for i, it in enumerate(spec['items']): add('Clothes', 'clothes', it['name'], f'cloth{i}')

# ---- recolour: shift hue / saturation / brightness of a piece's textures
def recolour(obj, hue=0.0, sat=1.0, val=1.0, maxpx=512, tint=None):
    if obj is None or os.environ.get('NO_RECOLOUR'): return
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes: continue
        for n in mat.node_tree.nodes:
            if n.type != 'TEX_IMAGE' or not n.image: continue
            img = n.image
            if max(img.size) > maxpx: img.scale(maxpx, max(1, int(img.size[1] * maxpx / img.size[0])) if img.size[0] >= img.size[1] else maxpx)
            if n.image.colorspace_settings.name != 'sRGB': continue          # leave normal / AO maps alone
            a = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(a); a = a.reshape(-1, 4)
            r, g, b = a[:, 0], a[:, 1], a[:, 2]
            mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
            hh = np.zeros_like(mx); m = d > 1e-6
            rc = np.where(m, (mx - r) / np.where(m, d, 1), 0); gc = np.where(m, (mx - g) / np.where(m, d, 1), 0); bc = np.where(m, (mx - b) / np.where(m, d, 1), 0)
            hh = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc)); hh = (hh / 6.0) % 1.0; hh = np.where(m, hh, 0)
            ss = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0)
            hh = (hh + hue) % 1.0; ss = np.clip(ss * sat, 0, 1); vv = np.clip(mx * val, 0, 1)
            i = np.floor(hh * 6).astype(int) % 6; ff = hh * 6 - np.floor(hh * 6)
            p_ = vv * (1 - ss); q_ = vv * (1 - ss * ff); t_ = vv * (1 - ss * (1 - ff))
            R = np.choose(i, [vv, q_, p_, p_, t_, vv]); G = np.choose(i, [t_, vv, vv, q_, p_, p_]); B = np.choose(i, [p_, p_, t_, vv, vv, q_])
            a[:, 0], a[:, 1], a[:, 2] = R, G, B
            if tint: a[:, 0] *= tint[0]; a[:, 1] *= tint[1]; a[:, 2] *= tint[2]; a[:, :3] = np.clip(a[:, :3], 0, 1)
            opaque = float(a[:, 3].min()) > 0.99
            new = bpy.data.images.new(img.name + '_v', img.size[0], img.size[1], alpha=not opaque); new.colorspace_settings.name = 'sRGB'; new.pixels.foreach_set(a.ravel())
            os.makedirs(TMP, exist_ok=True); path = os.path.join(TMP, new.name.replace('/', '_') + ('.jpg' if opaque else '.png'))
            new.file_format = 'JPEG' if opaque else 'PNG'; new.filepath_raw = path; new.save(quality=84)
            reloaded = bpy.data.images.load(path); reloaded.colorspace_settings.name = 'sRGB'; n.image = reloaded
for i, it in enumerate(spec['items']):
    c = it.get('color', {}); recolour(objs.get(f'cloth{i}'), c.get('hue', 0), c.get('sat', 1), c.get('val', 1), tint=c.get('tint'))
hc = spec.get('hair_color', {}); recolour(objs.get('hair'), hc.get('hue', 0), hc.get('sat', 1), hc.get('val', 1), tint=hc.get('tint'))
for k in ('eyes', 'brows', 'lashes'): recolour(objs.get(k))
recolour(body, maxpx=1024)

if not os.environ.get('SKIP_TPOSE'):
    # ---- the body mesh is in an A-pose but the Mixamo skeleton is a T: lift the mesh arms to match so the clips fit
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        if m.data.shape_keys:
            bpy.context.view_layer.objects.active = m; m.select_set(True); bpy.ops.object.shape_key_remove(all=True, apply_mix=True); m.select_set(False)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='POSE'); bpy.context.view_layer.update()
    mw = rig.matrix_world
    def centre(group):
        gi = body.vertex_groups[group].index; pts = [body.matrix_world @ v.co for v in body.data.vertices if any(g.group == gi and g.weight > 0.9 for g in v.groups)]
        return sum(pts, Vector()) / max(1, len(pts))
    for side in ('Left', 'Right'):
        pb = rig.pose.bones[f'mixamorig:{side}Arm']
        d = centre(f'mixamorig:{side}ForeArm') - centre(f'mixamorig:{side}Arm')
        t = Vector((1 if d.x > 0 else -1, 0, 0)); q = d.normalized().rotation_difference(t); head = mw @ pb.head
        pb.matrix = mw.inverted() @ (Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)) @ (mw @ pb.matrix); bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    for m in meshes:
        bpy.context.view_layer.objects.active = m
        if m is not body and len(m.data.vertices) > 5000:
            dm = m.modifiers.new('Decimate', 'DECIMATE'); dm.ratio = 5000 / len(m.data.vertices)
        for mod in list(m.modifiers):
            if mod.type in ('ARMATURE', 'MASK', 'DECIMATE'):
                try: bpy.ops.object.modifier_apply(modifier=mod.name)
                except Exception as e: print('APPLYFAIL', m.name, mod.name, e)
        am = m.modifiers.new('Armature', 'ARMATURE'); am.object = rig
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.transforms_clear(); bpy.ops.object.mode_set(mode='OBJECT')

# ---- clips are shared by the club (one set for every character); only work out how this body's hips compare, so the travel can be scaled
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CLIPS_FROM)
src_arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o not in before)
src_hip = (src_arm.matrix_world @ src_arm.data.bones['mixamorig:Hips'].head_local).z
my_hip = (rig.matrix_world @ rig.data.bones['mixamorig:Hips'].head_local).z
for o in set(bpy.data.objects) - before: bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
print('HIPSCALE %.4f HEIGHT %.3f' % (my_hip / src_hip, body.dimensions.z))
if spec.get('anims'):
    # animation-only export: the skeleton plus the club's clips, written from THIS skeleton so every bone's rest frame matches the characters
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CLIPS_FROM)
    src_arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o not in before)
    for o in list(set(bpy.data.objects) - before):
        if o is not src_arm: bpy.data.objects.remove(o, do_unlink=True)
    src_hip = (src_arm.matrix_world @ src_arm.data.bones['mixamorig:Hips'].head_local).z
    bpy.data.objects.remove(src_arm, do_unlink=True)
    my_hip = (rig.matrix_world @ rig.data.bones['mixamorig:Hips'].head_local).z
    k = my_hip / src_hip
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    rig.animation_data_create()
    for name in KEEP:
        act = bpy.data.actions.get(name)
        if not act: continue
        curves = getattr(act, 'fcurves', None) or [fc for l in act.layers for s_ in l.strips for cb in s_.channelbags for fc in cb.fcurves]
        for fc in curves:
            if 'mixamorig:Hips"' in fc.data_path and fc.data_path.endswith('location'):
                for p in fc.keyframe_points: p.co.y *= k; p.handle_left.y *= k; p.handle_right.y *= k
        act.use_fake_user = True
        tr = rig.animation_data.nla_tracks.new(); tr.name = name
        st = tr.strips.new(name, int(act.frame_range[0]), act)
        if hasattr(st, 'action_slot') and act.slots: st.action_slot = act.slots[0]
    for a in list(bpy.data.actions):
        if a.name not in KEEP: bpy.data.actions.remove(a)
    for m in [o for o in bpy.data.objects if o.type == 'MESH']: bpy.data.objects.remove(m, do_unlink=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_force_sampling=True, export_frame_step=2, export_optimize_animation_size=True, export_yup=True)
    print('HIPREF %.4f' % my_hip); print('WROTE', out, '%.2f MB' % (os.path.getsize(out) / 1e6)); sys.exit(0)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False,
                          export_image_format='JPEG', export_jpeg_quality=84, export_yup=True)
print('WROTE', out, '%.2f MB' % (os.path.getsize(out) / 1e6))
