#!/bin/zsh
# shoot.sh <sex> <label> <hair> items...   -> out/cat/<label>.png
B=/Applications/Blender.app/Contents/MacOS/Blender; D=/Users/tomconroy/Documents/club-cloud/mixamo/base
sex=$1; label=$2; hair=$3; shift 3
mkdir -p $D/out/cat
$B -b --python $D/dress_up.py -- $sex $D/out/cat/$label.blend $hair "$@" 2>&1 | grep -E "MISSING|FAIL|Traceback" 
$B -b $D/out/cat/$label.blend --python $D/render.py -- $D/out/cat/$label.png 2>&1 | grep -E "Traceback"
