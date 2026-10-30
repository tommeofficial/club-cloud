# Render a contact sheet of candidate outfits, each on its own body. Blender -b --python catalog.py -- <female|male> <out.png>
import bpy, sys, os, math
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
sex, out = sys.argv[sys.argv.index('--') + 1:][:2]
female = sex == 'female'
data = LocationService.get_user_data()
f = lambda *p: os.path.join(data, *p)
COMBOS = {
 'female': [
  ('F1 cut-out dress', ['toigo_cut_out_dress', 'toigo_stiletto_booties']),
  ('F2 halter dress', ['toigo_halter_dress_knee_length', 'toigo_stiletto_booties']),
  ('F3 tube top + mini skirt', ['skalldyrssuppe_tube_top_funky_colors', 'frankyaye_mini_skirt_01', 'scailman_gogo_platform_boots']),
  ('F4 keyhole tank + denim shorts', ['toigo_keyhole_tank_top', 'cortu_jeans_shorts', 'toigo_ankle_boots_female']),
  ('F5 bodice top + tiered mini', ['toigo_bodice-style_top', 'toigo_tiered_mini_skirt', 'toigo_stiletto_booties']),
  ('F6 strapless ruffle dress', ['toigo_strapless_ruffle_top_dress', 'toigo_stiletto_booties']),
  ('F7 camisole dress full skirt', ['toigo_camisole_dress_with_full_skirt', 'toigo_ballet_flats']),
  ('F8 halter midi dress', ['toigo_halter_dress_midi', 'toigo_stiletto_booties']),
  ('F9 shift dress', ['toigo_shift_dress', 'toigo_stiletto_booties']),
  ('F10 halter top + mini skirt 2', ['toigo_turtleneck_halter_top', 'frankyaye_mini_skirt_02', 'toigo_stiletto_booties']),
 ],
 'male': [
  ('M1 casual suit 1', ['male_casualsuit01', 'shoes02']),
  ('M2 casual suit 2', ['male_casualsuit02', 'shoes02']),
  ('M3 casual suit 3', ['male_casualsuit03', 'shoes02']),
  ('M4 casual suit 4', ['male_casualsuit04', 'shoes02']),
  ('M5 casual suit 5', ['male_casualsuit05', 'shoes02']),
  ('M6 casual suit 6', ['male_casualsuit06', 'shoes02']),
  ('M7 polo + cargo pants', ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'toigo_ankle_boots_male']),
  ('M8 tee + wool pants', ['elvs_crude_t-shirt_male', 'toigo_wool_pants', 'toigo_ankle_boots_male']),
  ('M9 elegant suit', ['male_elegantsuit01', 'shoes02']),
  ('M10 worksuit', ['male_worksuit01', 'shoes02']),
 ]}[sex]
bpy.ops.wm.read_factory_settings(use_empty=True)
macro = TargetService.get_default_macro_info_dict(); macro['gender'] = 0.0 if female else 1.0; macro['muscle'] = 0.45 if female else 0.6
skin = 'young_caucasian_female' if female else 'young_caucasian_male'
for i, (label, items) in enumerate(COMBOS):
    b = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=False, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
    HumanService.set_character_skin(f('skins', skin, skin + '.mhmat'), b, skin_type='GAMEENGINE')
    objs = [b]
    for it in items + ['EYEBROW']:
        if it == 'EYEBROW': folder, name, kind = 'eyebrows', 'eyebrow001', 'Eyebrows'
        else:
            folder, name, kind = 'clothes', it, 'Clothes'
        p = f(folder, name, name + '.mhclo')
        if not os.path.exists(p): print('MISSING', it); continue
        try: objs.append(HumanService.add_mhclo_asset(p, b, asset_type=kind, material_type='GAMEENGINE', set_up_rigging=False))
        except Exception as e: print('FAIL', it, e)
    hair = 'long01' if female else 'short02'
    objs.append(HumanService.add_mhclo_asset(f('hair', hair, hair + '.mhclo'), b, asset_type='Hair', material_type='GAMEENGINE', set_up_rigging=False))
    for o in objs:
        if o: o.location.x += i * 1.15
    print('BUILT', label)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'
n = len(COMBOS); sc.render.resolution_x, sc.render.resolution_y = 1900, 560
sc.render.filepath = out
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.09, 1)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = n * 1.15 + 0.2; cam.location = ((n - 1) * 1.15 / 2, -6, 0.85); cam.rotation_euler = (math.radians(90), 0, 0)
for loc, e in (((3, -4, 4), 900), ((-3, -4, 3), 500), ((8, 3, 4), 500)):
    l = bpy.data.objects.new('l', bpy.data.lights.new('l', 'AREA')); l.data.energy = e * 3; l.data.size = 8; l.location = (loc[0] + (n * 1.15) / 2, loc[1], loc[2]); l.rotation_euler = (math.radians(65), 0, 0); sc.collection.objects.link(l)
bpy.ops.render.render(write_still=True); print('RENDERED', out)
