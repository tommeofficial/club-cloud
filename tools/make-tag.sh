#!/bin/bash
# Make the Club Cloud voice tag with ElevenLabs and save it where the app looks for it.
# Your API key and the voice you chose stay in YOUR terminal: nothing here stores them.
#
#   export ELEVENLABS_API_KEY="paste your key here"
#   export VOICE_ID="the voice id from your ElevenLabs voice library"
#   ./tools/make-tag.sh                       # or: ./tools/make-tag.sh "Your own wording."
#
# Use a voice your plan lets you use commercially, and never clone someone's voice without their permission.
set -euo pipefail
: "${ELEVENLABS_API_KEY:?set ELEVENLABS_API_KEY first}"
: "${VOICE_ID:?set VOICE_ID first}"
TEXT="${1:-Thank you... for using... Club Cloud.}"   # the dots slow it down and make it breathier
OUT="$(cd "$(dirname "$0")/.." && pwd)/cloud-club/sounds/club-cloud-tag.mp3"
curl -sS -f -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128" \
  -H "xi-api-key: ${ELEVENLABS_API_KEY}" -H "Content-Type: application/json" -H "Accept: audio/mpeg" \
  -d "$(printf '{"text":%s,"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.4,"similarity_boost":0.8,"style":0.5}}' "$(printf '%s' "$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")" \
  -o "$OUT"
echo "Saved $OUT ($(du -h "$OUT" | cut -f1)). Reload the app and the tag will use this voice."
