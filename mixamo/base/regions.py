# Blender -b --python regions.py -- <glb> <out.json>: per-polygon region labels with their UV points
import bpy, sys, json
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
ob = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 1000][0]
me = ob.data
vg = {g.index: g.name.replace('mixamorig:', '') for g in ob.vertex_groups}
N = len(me.vertices)
W = {n: np.zeros(N) for n in set(vg.values())}
for v in me.vertices:
    for g in v.groups: W[vg[g.group]][v.index] += g.weight
P = np.array([ob.matrix_world @ v.co for v in me.vertices])
head = (W['Head'] + W.get('HeadTop_End', 0)) > 0.5
zs = P[head, 2]; zmin, zmax = zs.min(), zs.max(); H = zmax - zmin
yc = P[head, 1].mean(); xw = np.abs(P[head, 0]).max()
print('HEAD', 'z', round(float(zmin), 3), round(float(zmax), 3), 'H', round(float(H), 3), 'ycenter', round(float(yc), 3), 'halfwidth', round(float(xw), 3), 'n', int(head.sum()), 'total', N)
hand = sum(W[k] for k in W if 'Hand' in k) > 0.5
foot = sum(W.get(k, 0) for k in ('LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase')) > 0.5
lab = np.full(N, 5, dtype=np.uint8)
face = head & (P[:, 1] < yc - 0.005) & (P[:, 2] < zmin + 0.74 * H) & (np.abs(P[:, 0]) < 0.9 * xw)
arms = sum(W[k] for k in W if ('Arm' in k or 'Hand' in k)) > 0.5
upper = ~head & ~arms & (P[:, 2] > zmin - 0.40)       # 7: shoulders, chest and upper back, where long hair drapes
lab[upper] = 7; lab[head] = 1; lab[face] = 2; lab[hand] = 3; lab[foot] = 4
legs = sum(W.get(k, 0) for k in ('LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg')) > 0.5
lab[legs & ~foot] = 8   # trousers or skirt
neck = (W['Neck'] > 0.5) & ~head & (P[:, 2] > zmin - 0.10); lab[neck] = 6
uv = me.uv_layers.active.data
polys = []
for poly in me.polygons:
    ls = [int(lab[me.loops[i].vertex_index]) for i in poly.loop_indices]
    k = max(set(ls), key=ls.count)
    polys.append([k, [[float(uv[i].uv[0]), float(1 - uv[i].uv[1])] for i in poly.loop_indices]])
json.dump(polys, open(a[1], 'w'))
print('DONE', len(polys))
