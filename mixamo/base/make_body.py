# Make one base character with MPFB (a free Blender add-on) on the Mixamo skeleton, so the Mixamo animations we already use fit it.
# Skin, hair, eyes and clothes are separate pieces, so a character is just a choice of them (and the body can be male or female).
# Blender -b --python make_body.py -- <female|male> <out_prefix> [skin] [hair] [outfit] [shoes]
import bpy, sys, os
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

args = sys.argv[sys.argv.index('--') + 1:]
sex, out = args[0], args[1]
female = sex == 'female'
skin = args[2] if len(args) > 2 else ('young_african_female' if female else 'young_african_male')
hair = args[3] if len(args) > 3 else ('long01' if female else 'short02')
outfit = args[4] if len(args) > 4 else ('female_casualsuit01' if female else 'male_casualsuit01')
shoes = args[5] if len(args) > 5 else 'shoes02'
data = LocationService.get_user_data()
def f(*p): return os.path.join(data, *p)

bpy.ops.wm.read_factory_settings(use_empty=True)
macro = TargetService.get_default_macro_info_dict()
macro['gender'] = 0.0 if female else 1.0
macro['muscle'] = 0.45 if female else 0.6
body = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=False, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
body.name = f'body_{sex}'
HumanService.set_character_skin(f('skins', skin, skin + '.mhmat'), body, skin_type='GAMEENGINE')
rig = HumanService.add_builtin_rig(body, 'mixamo', import_weights=True)
print('RIG', rig.name, len(rig.data.bones))

def add(kind, folder, name, **kw):
    path = f(folder, name, name + '.mhclo')
    if not os.path.exists(path): print('MISSING', path); return None
    o = HumanService.add_mhclo_asset(path, body, asset_type=kind, material_type='GAMEENGINE', **kw)
    print('ADDED', kind, name, o.name if o else None)
    return o
add('Eyes', 'eyes', 'low-poly')
add('Eyebrows', 'eyebrows', 'eyebrow001')
add('Eyelashes', 'eyelashes', 'eyelashes01')
add('Hair', 'hair', hair)
add('Clothes', 'clothes', outfit)
add('Clothes', 'clothes', shoes)
bpy.ops.wm.save_as_mainfile(filepath=out + '.blend')
print('SAVED', out)
