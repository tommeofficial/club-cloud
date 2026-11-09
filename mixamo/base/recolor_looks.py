# Better hair and clothes for the crowd's look textures (female_look_*.jpg, male_look_*.jpg).
# The looks are photo-baked UV atlases. Two things were off: the hair is blonde at the front but pale at the back (the back was filled in flat), and on the men the hair takes the
# colour of the clothes. This script (1) recolours the head-hair islands (found from the mesh: regions_<sex>.json, written by regions.py) with a natural hair colour that is the same
# front and back, (2) recolours the clothes with a varied palette, keeping the folds and shading of the original, and (3) smooths the flat 16-pixel blocks the photo bake left behind.
# python3 recolor_looks.py <models dir> <regions dir> <backup dir>
import sys, os, json, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

models, regions, backup = sys.argv[1:4]
os.makedirs(backup, exist_ok=True)
S = 1024

def masks(sex):
    polys = json.load(open(os.path.join(regions, f'regions_{sex}.json')))
    out = {}
    for k in (1, 2, 3, 4, 5, 6, 7, 8):
        im = Image.new('L', (S, S), 0); d = ImageDraw.Draw(im)
        for kk, pts in polys:
            if kk == k: d.polygon([(x * S, y * S) for x, y in pts], fill=255)
        out[k] = np.array(im) > 127
    return out

def lum(a): return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def hsv(a):
    mx = a.max(-1); mn = a.min(-1); d = mx - mn + 1e-6
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-6), mx

def recolour(img, mask, target, spread=1.0, floor=0.18):
    """Give the pixels in mask the target colour, keeping the original's light and dark (folds, strands) around its own median."""
    if mask.sum() < 50: return img
    L = lum(img); ref = np.median(L[mask]) + 1e-3
    r = np.clip(L / ref, 0.0, 3.0)
    r = np.clip(0.5 + (r - 1.0) * spread * 0.55 + 0.5, floor, 1.9)
    t = np.array(target, dtype=np.float32)
    out = img.copy(); out[mask] = np.clip(t * r[mask, None], 0, 1)
    return out

def deblock(img):
    """Smooth the flat 16x16 blocks (a nearest-neighbour fill in the areas the photo could not see)."""
    h, w, _ = img.shape
    t = 16; flat = np.zeros((h, w), bool)
    for y in range(0, h, t):
        for x in range(0, w, t):
            blk = img[y:y + t, x:x + t]
            if blk.std(axis=(0, 1)).max() < 0.012: flat[y:y + t, x:x + t] = True
    pil = Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
    soft = np.array(pil).astype(np.float32) / 255
    m = np.array(Image.fromarray((flat * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(np.float32)[..., None] / 255
    return img * (1 - m) + soft * m

HAIR_F = [(0.80, 0.62, 0.34), (0.23, 0.13, 0.08), (0.06, 0.05, 0.05), (0.45, 0.22, 0.10), (0.62, 0.42, 0.22), (0.33, 0.20, 0.12), (0.72, 0.52, 0.30), (0.50, 0.14, 0.08),
          (0.15, 0.09, 0.06), (0.86, 0.72, 0.50), (0.38, 0.26, 0.17), (0.10, 0.07, 0.06), (0.58, 0.30, 0.14), (0.70, 0.60, 0.46)]
HAIR_M = [(0.06, 0.05, 0.05), (0.20, 0.12, 0.08), (0.34, 0.22, 0.13), (0.62, 0.46, 0.26), (0.12, 0.08, 0.06), (0.42, 0.18, 0.08)]
# tops and bottoms are picked apart, from realistic clothing colours (a top is never the colour of the trousers)
TOPS_F = [None, (0.42, 0.07, 0.16), (0.85, 0.85, 0.82), (0.05, 0.30, 0.21), None, (0.10, 0.10, 0.12), (0.45, 0.60, 0.72), (0.58, 0.09, 0.11), (0.62, 0.36, 0.44),
          (0.12, 0.22, 0.45), (0.78, 0.70, 0.55), None, (0.31, 0.34, 0.16), (0.46, 0.48, 0.52)]
BOTS_F = [(0.07, 0.07, 0.08), (0.10, 0.15, 0.30), (0.17, 0.17, 0.19), (0.07, 0.07, 0.08), (0.18, 0.26, 0.44), (0.30, 0.25, 0.18), (0.10, 0.15, 0.30), (0.07, 0.07, 0.08),
          (0.25, 0.25, 0.28), (0.07, 0.07, 0.08), (0.14, 0.20, 0.36), (0.17, 0.12, 0.10), (0.07, 0.07, 0.08), (0.10, 0.15, 0.30)]
TOPS_M = [(0.85, 0.85, 0.83), (0.07, 0.07, 0.08), (0.12, 0.20, 0.38), (0.30, 0.33, 0.18), (0.40, 0.08, 0.12), (0.45, 0.46, 0.48)]
BOTS_M = [(0.10, 0.15, 0.30), (0.10, 0.15, 0.30), (0.07, 0.07, 0.08), (0.28, 0.24, 0.17), (0.17, 0.17, 0.19), (0.07, 0.07, 0.08)]

for sex, n, hairs, tops, bots in (('f', 14, HAIR_F, TOPS_F, BOTS_F), ('m', 6, HAIR_M, TOPS_M, BOTS_M)):
    M = masks(sex)
    name = 'female' if sex == 'f' else 'male'
    for i in range(n):
        path = os.path.join(models, f'{name}_look_{i}.jpg')
        keep = os.path.join(backup, f'{name}_look_{i}.jpg')
        if not os.path.exists(keep): shutil.copy(path, keep)
        img = np.array(Image.open(keep).convert('RGB')).astype(np.float32) / 255
        img = deblock(img)
        # skin reference from the hands and neck
        skinpix = img[M[3] | M[6]]; skinpix = skinpix[lum(skinpix) > 0.25]
        skin = np.median(skinpix, axis=0) if len(skinpix) > 200 else np.array([0.75, 0.55, 0.45])
        hue, sat, val = hsv(img)
        dskin = np.linalg.norm(img - skin, axis=-1)
        # skin-coloured pixels anywhere (any warm hue, not too dark): never recoloured
        skinlike = (hue >= 0) & (hue < 52) & (sat > 0.10) & (sat < 0.85) & (val > 0.24)
        # hair: the head islands that are not the face, plus draped strands on the shoulders and chest (saturated gold/brown, different from the skin)
        head_hair = M[1] & ~M[2]
        drape = M[7] & (val > 0.42) & (hue > 20) & (hue < 54) & (sat > 0.36) & (dskin > 0.10)
        hair = head_hair | drape
        img = recolour(img, hair, hairs[i % len(hairs)], spread=1.2, floor=0.25)
        # clothes: body islands and shoes that are dark or not warm-coloured (dresses, tees, trousers, boots), never skin or hair
        notskin = ~drape & ~(skinlike & (val > 0.36)) & ((val < 0.34) | (hue > 62) | (hue < 0))
        top = (M[5] | M[7]) & ~M[3] & ~M[6] & ~M[8] & notskin
        bot = M[8] & notskin
        shoes = M[4] & notskin
        if tops[i % len(tops)] is not None: img = recolour(img, top, tops[i % len(tops)], spread=1.0, floor=0.2)
        img = recolour(img, bot, bots[i % len(bots)], spread=1.0, floor=0.2)
        img = recolour(img, shoes, (0.09, 0.09, 0.10) if i % 3 else (0.80, 0.80, 0.80), spread=1.0, floor=0.2)
        Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(path, quality=92)
        print('done', name, i)
