# The crowd: 5 outfits each for girls and guys, in 4 colours each; 10 characters per sex (each outfit twice, in two different colours).
import json, random, os
os.makedirs('specs', exist_ok=True)
G = lambda **k: k
BLACK = dict(sat=0.1, val=0.3)
girls = {
 'halter':  dict(items=['toigo_halter_dress_knee_length', 'toigo_stiletto_booties'], variants=[
     [G(sat=0.08, val=0.3), G(**BLACK)], [G(hue=0.62), G(sat=0.1, val=0.3)], [G(hue=0.38), G(sat=0.1, val=0.3)], [G(), G(sat=0.1, val=0.3)]]),
 'tubemini': dict(items=['skalldyrssuppe_tube_top_funky_colors', 'frankyaye_mini_skirt_01', 'scailman_gogo_platform_boots'], variants=[
     [G(), G(), G(sat=0.1, val=0.3)], [G(hue=0.3), G(hue=0.55), G(sat=0.1, val=0.3)], [G(hue=0.62), G(sat=0.1, val=0.35), G(sat=0.1, val=0.3)], [G(hue=0.85), G(hue=0.12), G(sat=0.1, val=0.3)]]),
 'bodice':  dict(items=['toigo_bodice-style_top', 'toigo_tiered_mini_skirt', 'toigo_stiletto_booties'], variants=[
     [G(val=0.35), G(val=0.35), G(**BLACK)], [G(tint=[0.9, 0.12, 0.3]), G(tint=[0.9, 0.12, 0.3]), G(**BLACK)], [G(tint=[0.25, 0.4, 1.0]), G(tint=[0.25, 0.4, 1.0]), G(**BLACK)], [G(tint=[1.2, 1.15, 1.1]), G(tint=[1.2, 1.15, 1.1]), G(sat=0.1, val=0.5)]]),
 'haltermini': dict(items=['toigo_turtleneck_halter_top', 'frankyaye_mini_skirt_02', 'toigo_stiletto_booties'], variants=[
     [G(), G(), G(**BLACK)], [G(hue=0.45), G(hue=0.4), G(**BLACK)], [G(hue=0.7), G(sat=0.1, val=0.3), G(**BLACK)], [G(sat=0.1, val=0.3), G(hue=0.0), G(**BLACK)]]),
 'leopard': dict(items=['toigo_cut_out_dress', 'toigo_stiletto_booties'], variants=[
     [G(), G(**BLACK)], [G(hue=0.55), G(**BLACK)], [G(sat=0.0, val=0.4), G(**BLACK)], [G(hue=0.85), G(**BLACK)]]),
}
boys = {
 'shirt':   dict(items=['male_casualsuit01', 'shoes02'], variants=[[G(), G(val=0.3, sat=0.3)], [G(val=0.45), G(val=0.3, sat=0.3)], [G(hue=0.3), G(val=0.3, sat=0.3)], [G(hue=0.55), G(val=0.3, sat=0.3)]]),
 'striped': dict(items=['male_casualsuit03', 'shoes02'], variants=[[G(), G(val=0.3, sat=0.3)], [G(hue=0.4), G(val=0.3, sat=0.3)], [G(hue=0.65), G(val=0.3, sat=0.3)], [G(val=0.5, sat=0.5), G(val=0.3, sat=0.3)]]),
 'tee':     dict(items=['male_casualsuit06', 'shoes02'], variants=[[G(), G(val=0.3, sat=0.3)], [G(val=0.55), G(val=0.3, sat=0.3)], [G(hue=0.5, sat=1.3), G(val=0.3, sat=0.3)], [G(hue=0.1), G(val=0.3, sat=0.3)]]),
 'jacket':  dict(items=['male_casualsuit05', 'shoes02'], variants=[[G(), G(val=0.3, sat=0.3)], [G(hue=0.1), G(val=0.3, sat=0.3)], [G(hue=0.6), G(val=0.3, sat=0.3)], [G(val=0.5), G(val=0.3, sat=0.3)]]),
 'suit':    dict(items=['male_elegantsuit01', 'shoes02'], variants=[[G(val=0.45), G(val=0.2, sat=0.3)], [G(tint=[0.4, 0.5, 1.0]), G(val=0.2, sat=0.3)], [G(tint=[0.8, 0.2, 0.3]), G(val=0.2, sat=0.3)], [G(), G(val=0.2, sat=0.3)]]),
}
GSK = ['young_caucasian_female', 'young_african_female', 'young_asian_female', 'young_caucasian_female2', 'middleage_african_female', 'young_african_female', 'young_asian_female', 'young_caucasian_female', 'middleage_caucasian_female', 'young_caucasian_female2']
BSK = ['young_caucasian_male', 'young_african_male', 'young_asian_male', 'young_caucasian_male2', 'young_african_male', 'young_caucasian_male', 'middleage_african_male', 'young_asian_male', 'middleage_caucasian_male', 'young_african_male']
GH = ['long01', 'bob01', 'ponytail01', 'bob02', 'braid01', 'long01', 'ponytail01', 'bob01', 'braid01', 'bob02']
BH = ['short02', 'short01', 'short03', 'short04', 'afro01', 'short01', 'short02', 'short04', 'short03', 'afro01']
HAIR = [dict(), dict(val=0.35), dict(val=0.22), dict(hue=0.03, val=0.8), dict(tint=[1.15, 1.0, 0.7]), dict(val=0.5)]
rnd = random.Random(7)
def make(prefix, sex, outfits, skins, hairs):
    names = list(outfits)
    for i in range(10):
        o = outfits[names[i % 5]]; v = o['variants']; var = v[(i // 5) * 2 + (i % 2)] if False else v[[0, 2, 1, 3][(i // 5) * 2 + ((i // 1) % 2)] if False else (i // 5) * 2 + (i % 2) % 4]
        var = v[(i % 5 + (i // 5) * 2) % 4]
        spec = dict(sex=sex, skin=skins[i], hair=hairs[i], hair_color=HAIR[(i * 5 + 1) % len(HAIR)],
                    macro=dict(height=round(rnd.uniform(0.42, 0.62), 2), weight=round(rnd.uniform(0.38, 0.55), 2), muscle=round(rnd.uniform(0.4, 0.55) if sex == 'female' else rnd.uniform(0.5, 0.7), 2), age=0.5),
                    items=[dict(name=n, color=c) for n, c in zip(o['items'], var)], outfit=names[i % 5])
        json.dump(spec, open(f'specs/{prefix}{i + 1:02d}.json', 'w'), indent=1)
make('g', 'female', girls, GSK, GH); make('b', 'male', boys, BSK, BH)
print(sorted(os.listdir('specs')))
