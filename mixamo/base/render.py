# Blender -b <file.blend> --python render.py -- <out.png> [pose_action_name]
import bpy, sys, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
out = args[-1]
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 700, 1000
sc.render.filepath = out
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.09, 1); world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.0, -4.3, 0.95); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50
for loc, energy in (((2, -3, 3), 700), ((-3, -2, 2), 350), ((0, 3, 3), 400)):
    l = bpy.data.objects.new('l', bpy.data.lights.new('l', 'AREA')); l.data.energy = energy; l.data.size = 3; l.location = loc
    l.rotation_euler = (math.radians(60), 0, math.radians(20 if loc[0] > 0 else -20)); sc.collection.objects.link(l)
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
