# Shrink a GLB: re-encode opaque PNG textures as JPEG (Blender's exporter keeps them PNG). python3 slim_glb.py in.glb [out.glb]
import json, struct, sys, io
from PIL import Image
src = sys.argv[1]; dst = sys.argv[2] if len(sys.argv) > 2 else src
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
bl_off = 20 + jl; bl = struct.unpack('<I', b[bl_off:bl_off + 4])[0]; bin_ = b[bl_off + 8:bl_off + 8 + bl]
bvs = j['bufferViews']; blobs = [bin_[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in bvs]
for im in j.get('images', []):
    if im.get('mimeType') != 'image/png': continue
    img = Image.open(io.BytesIO(blobs[im['bufferView']]))
    if img.mode == 'RGBA' and img.getchannel('A').getextrema()[0] < 250: continue      # real transparency: keep
    buf = io.BytesIO(); img.convert('RGB').save(buf, 'JPEG', quality=84, optimize=True)
    blobs[im['bufferView']] = buf.getvalue(); im['mimeType'] = 'image/jpeg'
out = bytearray(); off = 0
for v, blob in zip(bvs, blobs):
    pad = (-len(out)) % 4; out += b'\0' * pad
    v['byteOffset'] = len(out); v['byteLength'] = len(blob); out += blob
out += b'\0' * ((-len(out)) % 4)
j['buffers'][0]['byteLength'] = len(out)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb); print('slim %.2f -> %.2f MB' % (len(b) / 1e6, len(glb) / 1e6))
