// Club backend: profiles, room state and chat, on Supabase.
// The browser never touches the database directly except through these functions.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const configured = !SUPABASE_URL.includes('YOUR-PROJECT-REF');
export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function requireBackend() {
  if (!supabase) throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.');
  return supabase;
}

// Sign in once per browser. Writes need a session, so the first call creates an anonymous one.
export async function ensureSession() {
  const db = requireBackend();
  const { data } = await db.auth.getSession();
  if (data.session) return data.session.user;
  const { data: anon, error } = await db.auth.signInAnonymously();
  if (error) throw error;
  return anon.user;
}

// Claim a unique username for this user. Returns the profile row, or throws if taken.
export async function claimUsername(username, displayName) {
  const db = requireBackend();
  const user = await ensureSession();
  const name = username.trim().toLowerCase();
  const { data, error } = await db
    .from('profiles')
    .upsert({ id: user.id, username: name, display_name: displayName || name }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  await db.from('rooms').upsert({ username: name }, { onConflict: 'username', ignoreDuplicates: true });
  return data;
}

// Publish the room's state (OFFLINE, LIVE-PUBLIC or LIVE-PRIVATE) plus the crowd meter.
export async function publishRoomState(username, { state, hype, mood }) {
  const db = requireBackend();
  const { error } = await db
    .from('rooms')
    .update({ state, hype: Math.round(hype), mood: mood ? mood.slice(0, 60) : null, updated_at: new Date().toISOString() })
    .eq('username', username);
  if (error) throw error;
}

export async function loadRoom(username) {
  const { data, error } = await requireBackend().from('rooms').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadRecentChat(room, limit = 50) {
  const { data, error } = await requireBackend()
    .from('messages')
    .select('*')
    .eq('room', room)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.reverse();
}

export async function sendChat(room, author, body) {
  const text = body.trim().slice(0, 300);
  if (!text) return;
  const { error } = await requireBackend().from('messages').insert({ room, author, body: text });
  if (error) throw error;
}

// Call onMessage for every new chat line in a room. Returns an unsubscribe function.
export function subscribeChat(room, onMessage) {
  const db = requireBackend();
  const channel = db
    .channel(`chat:${room}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${room}` }, (payload) => onMessage(payload.new))
    .subscribe();
  return () => db.removeChannel(channel);
}

// Call onRoom whenever this room's state row changes.
export function subscribeRoom(room, onRoom) {
  const db = requireBackend();
  const channel = db
    .channel(`room:${room}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `username=eq.${room}` }, (payload) => onRoom(payload.new))
    .subscribe();
  return () => db.removeChannel(channel);
}

// The signed-in user's profile, or null if they haven't picked a username yet.
export async function getMyProfile() {
  const db = requireBackend();
  const user = await ensureSession();
  const { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return data;
}

// A live, unsaved channel for a room: shout-out and song requests, accepts, tips, recorded shout-outs and
// video-call signalling all go through it. Every client (the sender included) gets every event.
export function openClubChannel(room, onEvent) {
  const db = requireBackend();
  const channel = db.channel(`club:${room}`, { config: { broadcast: { self: true } } })
    .on('broadcast', { event: 'ev' }, ({ payload }) => onEvent(payload))
    .subscribe();
  return {
    send: (payload) => channel.send({ type: 'broadcast', event: 'ev', payload }),
    close: () => db.removeChannel(channel),
  };
}

// The lobby: one shared channel that every browser joins. A DJ who is live (and chose to be listed) puts a small card on it with
// presence; presence is dropped the moment they leave, so the list never holds a stream that has ended.
export function openLobby(me, onList) {
  const db = requireBackend();
  const channel = db.channel('lobby', { config: { presence: { key: me } } });
  const emit = () => {
    const list = [];
    for (const [dj, metas] of Object.entries(channel.presenceState())) { const m = metas[metas.length - 1]; if (m && m.live) list.push({ ...m, dj }); }
    onList(list);
  };
  channel.on('presence', { event: 'sync' }, emit).subscribe();
  return {
    announce: (card) => channel.track({ ...card, live: true }),
    withdraw: () => channel.untrack(),
    close: () => db.removeChannel(channel),
  };
}
