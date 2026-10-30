#!/bin/zsh
cd /Users/tomconroy/Documents/club-cloud/mixamo/base
build() { n=$1; /Applications/Blender.app/Contents/MacOS/Blender -b --python build_char.py -- specs/$n.json glb/$n.glb 2>&1 | grep -E "HIPSCALE|WROTE|Traceback|APPLYFAIL|MISSING" | sed "s/^/$n /"; python3 slim_glb.py glb/$n.glb glb/$n.glb | sed "s/^/$n /"; }
export -f build 2>/dev/null
for n in g01 g02 g03 g04 b01 b02 b03 b04; do build $n & done; wait
for n in g05 g06 g07 g08 b05 b06 b07 b08; do build $n & done; wait
for n in g09 g10 b09 b10; do build $n & done; wait
echo ALLDONE
