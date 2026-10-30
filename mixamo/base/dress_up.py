# Build one dressed character (no rig) for previews. Blender -b --python dress_up.py -- <female|male> <out.blend> <hair> <item> [item ...]
import bpy, sys, os
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
a = sys.argv[sys.argv.index('--') + 1:]
sex, out, hair, items = a[0], a[1], a[2], a[3:]
female = sex == 'female'
data = LocationService.get_user_data(); f = lambda *p: os.path.join(data, *p)
bpy.ops.wm.read_factory_settings(use_empty=True)
macro = TargetService.get_default_macro_info_dict(); macro['gender'] = 0.0 if female else 1.0; macro['muscle'] = 0.45 if female else 0.6
skin = 'young_caucasian_female' if female else 'young_caucasian_male'
b = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=False, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
HumanService.set_character_skin(f('skins', skin, skin + '.mhmat'), b, skin_type='GAMEENGINE')
for kind, folder, name in [('Eyes', 'eyes', 'low-poly'), ('Eyebrows', 'eyebrows', 'eyebrow001'), ('Eyelashes', 'eyelashes', 'eyelashes01'), ('Hair', 'hair', hair)] + [('Clothes', 'clothes', i) for i in items]:
    p = f(folder, name, name + '.mhclo')
    if not os.path.exists(p): print('MISSING', name); continue
    try: HumanService.add_mhclo_asset(p, b, asset_type=kind, material_type='GAMEENGINE', set_up_rigging=False)
    except Exception as e: print('FAIL', name, e)
bpy.ops.wm.save_as_mainfile(filepath=out); print('BUILT', out)
