# Blender -b --python view_glb.py -- in.glb out.png
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
print('OBJECTS', [(o.name, o.type) for o in bpy.data.objects])
exec(open('/Users/tomconroy/Documents/club-cloud/mixamo/base/render.py').read().replace("out = args[-1]", "out = '%s'" % a[1]))
