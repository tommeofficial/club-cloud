# Virtual DJ Club

Stream test scaffold: one DJ streams to fans in the same room over WebRTC.
Media goes browser to browser. The Node server only relays setup messages.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:8080 in two browser tabs:

1. In the first tab, click **Start as DJ**.
2. In the second tab, click **Join as Fan**.

Both tabs must use the same room name. The fan tab should show a moving
colour test pattern and hear a 440 Hz tone (click play if the browser blocks autoplay).

Tick **DJ uses webcam** to send your camera and microphone instead of the test pattern.

## Not in this step

- Ads, the 99p skip and the free-room timer
- Stripe payments and tokens
- Music playback of any kind
- The 3D venue
- TURN relay (only STUN is configured, so some networks will not connect)
