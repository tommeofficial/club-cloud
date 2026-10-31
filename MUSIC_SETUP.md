# Music library (Epidemic Sound), switched OFF until you turn it on

Private testing: add `MUSIC_ALLOWED_EMAILS` in Vercel (the email you sign in to Club Cloud with; several allowed, comma separated). Only those
accounts see the MUSIC item and can call the API. Remove it later to open the library to every signed-in person.


What it is: a MUSIC item in the app's MENU (shown only when switched on and the person is signed in). It lists genres (Tech House,
Groovy House, Afro House, Techno, House, Minimal House) and tracks from the Epidemic Sound Partner API. ADD downloads a track into
that browser tab and puts it in the library for the session. Tracks are never saved on the device (the API's terms limit caching
to 60 minutes) and are never stored by us. Genre buttons use the library's own genres where the names match, otherwise a text search.

Before you switch it on
1. Confirm in writing with Epidemic Sound that your plan or API agreement covers: end users playing tracks in a DJ app, live-streaming
   the mix to listeners, and recording. The API's free tier is for prototyping only and has no commercial licence.
2. In the Epidemic Developer Portal, add `https://clubcloud.vip` to the allowed (CORS) sites, or downloads will be blocked.
3. In Vercel (project `cloud-club`, Environment Variables) add `EPIDEMIC_API_KEY` with the API key from the portal. Put it in yourself;
   it is a secret. Redeploy. The MUSIC item then appears. Remove the variable to switch it off again.

Notes: the key lives only on the server (`cloud-club/api/music.js`). Only signed-in people (not guests) can call it.
The panel shows "Music by Epidemic Sound" as the credit.

Letting another service or agent use the library without the Epidemic key
Set `MUSIC_AGENT_TOKEN` in Vercel to a long random string you generate (for example `openssl rand -hex 32`) and give that string to the other
agent. It then calls `https://clubcloud.vip/api/music?a=tracks&genre=<id>` with `Authorization: Bearer <that string>`
(also `a=genres`, `a=file&id=<trackId>`). The Epidemic key stays only in Vercel. To cut the agent off, change or remove `MUSIC_AGENT_TOKEN`.
