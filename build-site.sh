#!/bin/bash
# Builds the deployable Cloud Club web app into ./site from ./cloud-club and ./site-src
set -e
cd "$(dirname "$0")"
mkdir -p site && find site -mindepth 1 -maxdepth 1 ! -name .vercel -exec rm -rf {} + && mkdir -p site/icons
cp cloud-club/app.js cloud-club/dsp.js cloud-club/analyze.js cloud-club/club.js site/
[ -d cloud-club/models ] && cp -R cloud-club/models site/
cp site-src/icons/*.png site-src/icons/icon.svg site/icons/
cat > site/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Cloud Club DJ</title>
<meta name="description" content="Cloud Club: a full two-deck DJ controller in your browser, with sync, loops, hot cues, FX and a virtual club crowd.">
<meta name="theme-color" content="#060C16">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon-64.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cloud Club">
<meta property="og:title" content="Cloud Club DJ">
<meta property="og:description" content="Mix two decks in your browser. Sync, loops, hot cues, Beat FX and a crowd that reacts to your mixing.">
<meta property="og:image" content="https://cloudclub.brightsite.app/icons/icon-512.png">
</head>
<body>
HTML
grep -v -e '^<meta charset' -e '^<title>' cloud-club/index.html >> site/index.html
printf '\n</body>\n</html>\n' >> site/index.html
cat > site/manifest.webmanifest <<'JSON'
{
  "name": "Cloud Club DJ",
  "short_name": "Cloud Club",
  "description": "Two-deck DJ controller in your browser.",
  "start_url": "/",
  "scope": "/",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#060C16",
  "theme_color": "#060C16",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
JSON
cat > site/vercel.json <<'JSON'
{
  "cleanUrls": true,
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ] },
    { "source": "/(.*)\\.(js|html|webmanifest)", "headers": [ { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/models/(.*)", "headers": [ { "key": "Cache-Control", "value": "public, max-age=604800" } ] }
  ]
}
JSON
echo "built site/:"; ls -la site site/icons
