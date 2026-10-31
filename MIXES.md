# 24/7 Club Cloud rooms (hour mixes)

Each room is one mix that plays on a loop for whoever has joined. Nothing runs on a server: pressing the card starts the room in that
person's browser, the crowd, lights and robot DJ are generated there from the audio, and everyone hears the same moment of the mix (it is
worked out from the clock, like a radio).

Add a mix
1. Put the MP3 in `cloud-club/mixes/` (about 128 to 192 kbps; an hour is roughly 57 to 86 MB. Vercel allows files up to 100 MB).
2. Add an entry to `cloud-club/mixes.json`:
   `[ { "id": "tech-house", "name": "Tech House", "genre": "Tech House", "url": "mixes/tech-house.mp3" } ]`
   (`id` is used in the link `/app?house=tech-house`; cards appear on the website and in the app's HOME grid for every entry.)
3. Redeploy. To take a room off, remove its entry.

Only use music you have the rights to broadcast.
