# Cloud Club DJ

Two-deck browser DJ controller with a reactive 3D crowd. Live at https://cloudclub.brightsite.app

## Layout
- `app/` — the DJ app source (index.html, app.js, dsp.js, analyze.js, club.js, models/)
- `site-src/icons/` — app icon source + generated PNGs
- `build-site.sh` — builds `site-deploy/` (adds manifest, meta tags, vercel.json) for deployment
- `site-deploy/` — last built output, deployed via `vercel deploy --prod --yes` (Vercel project: cloud-club, team: brightsiteapp)
- `crowd-raw/` — Rodin generation attempts (all timed out; stand-in Blender characters used instead), `make_crowd.py` is the Blender script that builds/rigs/animates the 3 stand-in characters into `app/models/*.glb`

## Run locally
cd app && python3 -m http.server 8765
