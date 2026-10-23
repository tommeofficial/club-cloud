// Two-tab WebRTC test. One DJ sends a stream to every Fan in the room.
// Signalling goes through server.js; media goes browser to browser.

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const videoEl = $('video');

const myId = crypto.randomUUID();
let role = null;
let ws = null;
let localStream = null;
const peers = new Map(); // remote id -> RTCPeerConnection (DJ side only)
let fanPc = null;        // the single connection a Fan holds to the DJ

function log(line) {
  statusEl.textContent += `\n${line}`;
}

function send(msg) {
  ws.send(JSON.stringify({ ...msg, from: myId }));
}

function connectSignalling(room) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', room, id: myId, role }));
    log(`joined room "${room}" as ${role} (${myId.slice(0, 8)})`);
    // Announce ourselves so the other side can start negotiating.
    send({ type: role === 'dj' ? 'dj-hello' : 'fan-hello' });
  };
  ws.onmessage = (event) => handleSignal(JSON.parse(event.data));
  ws.onclose = () => log('signalling closed');
}

// Fallback audio source: a quiet 440 Hz tone, so the test works without a mic.
function makeToneStream() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  osc.frequency.value = 440;
  gain.gain.value = 0.05;
  osc.connect(gain).connect(dest);
  osc.start();
  return dest.stream;
}

async function getDjStream() {
  if ($('useWebcam').checked) {
    const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return cam;
  }
  const tone = makeToneStream();
  // Canvas gives a video track so the viewer sees something moving.
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const g = canvas.getContext('2d');
  setInterval(() => {
    g.fillStyle = `hsl(${(Date.now() / 20) % 360}, 80%, 50%)`;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }, 100);
  tone.addTrack(canvas.captureStream(15).getVideoTracks()[0]);
  return tone;
}

function newPeer(remoteId, onTrack) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ type: 'ice', to: remoteId, candidate: e.candidate });
  };
  pc.onconnectionstatechange = () => log(`peer ${remoteId.slice(0, 8)}: ${pc.connectionState}`);
  if (onTrack) pc.ontrack = onTrack;
  return pc;
}

async function djOffer(fanId) {
  const pc = newPeer(fanId);
  peers.set(fanId, pc);
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send({ type: 'offer', to: fanId, sdp: pc.localDescription });
}

async function handleSignal(msg) {
  // Ignore our own echoes and anything addressed to someone else.
  if (msg.from === myId) return;
  if (msg.to && msg.to !== myId) return;

  if (msg.type === 'dj-hello' && role === 'fan') {
    send({ type: 'fan-hello' }); // DJ will answer with an offer
  }

  if (msg.type === 'fan-hello' && role === 'dj') {
    await djOffer(msg.from);
  }

  if (msg.type === 'offer' && role === 'fan') {
    fanPc = newPeer(msg.from, (e) => {
      videoEl.srcObject = e.streams[0];
    });
    await fanPc.setRemoteDescription(msg.sdp);
    const answer = await fanPc.createAnswer();
    await fanPc.setLocalDescription(answer);
    send({ type: 'answer', to: msg.from, sdp: fanPc.localDescription });
  }

  if (msg.type === 'answer' && role === 'dj') {
    const pc = peers.get(msg.from);
    if (pc) await pc.setRemoteDescription(msg.sdp);
  }

  if (msg.type === 'ice') {
    const pc = role === 'dj' ? peers.get(msg.from) : fanPc;
    if (pc) await pc.addIceCandidate(msg.candidate);
  }
}

$('asDj').onclick = async () => {
  role = 'dj';
  statusEl.textContent = 'starting DJ...';
  localStream = await getDjStream();
  videoEl.srcObject = localStream;
  videoEl.muted = true; // avoid feedback from our own audio
  connectSignalling($('room').value.trim() || 'test-room');
};

$('asFan').onclick = () => {
  role = 'fan';
  statusEl.textContent = 'joining as fan...';
  videoEl.muted = false;
  connectSignalling($('room').value.trim() || 'test-room');
};
