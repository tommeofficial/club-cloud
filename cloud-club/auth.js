// Sign-in. Everyone starts as a guest (an anonymous session, so chat and the club just work), but watching a stream or playing the decks
// needs a real account, because deck time, Pro and recordings belong to an account. Signing in uses a magic link sent to the person's email.
// A guest who signs in keeps their guest account (the email is linked to it), so their username and deck time carry over.
let backend = null, user = null, ready = false;
const A = { signedIn: false, ready: false, email: '' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function refresh() {
  if (!backend || !backend.supabase) return;
  const { data } = await backend.supabase.auth.getSession();
  user = data.session ? data.session.user : null;
  A.signedIn = !!(user && !user.is_anonymous && user.email);
  A.email = (user && user.email) || '';
  document.querySelectorAll('[data-act=signin]').forEach((b) => { b.textContent = A.signedIn ? A.email.split('@')[0].toUpperCase() : 'SIGN IN'; b.classList.toggle('on', A.signedIn); b.title = A.signedIn ? `Signed in as ${A.email}. Press to sign out.` : 'Sign in to watch streams and play the decks'; });
  dispatchEvent(new CustomEvent('cc-auth', { detail: { signedIn: A.signedIn, email: A.email } }));
}

let box = null, resolver = null;
function close(ok) { if (box) box.hidden = true; if (resolver) { resolver(!!ok); resolver = null; } }
function show(reason) {
  if (!box) {
    box = document.createElement('div'); box.id = 'signin'; document.body.appendChild(box);
    box.addEventListener('click', async (e) => {
      if (e.target === box || e.target.closest('.sclose')) { close(false); return; }
      if (!e.target.closest('.ssend')) return;
      const input = box.querySelector('input'), msg = box.querySelector('.smsg'), email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = 'Enter a valid email address.'; msg.className = 'smsg err'; return; }
      const btn = e.target.closest('.ssend'); btn.disabled = true; msg.className = 'smsg'; msg.textContent = 'Sending…';
      try {
        const db = backend.supabase;
        const redirect = location.origin + location.pathname + location.search;
        const guest = user && user.is_anonymous;
        // a guest links the email to the account they already have; anyone else gets a normal sign-in link
        const { error } = guest ? await db.auth.updateUser({ email }, { emailRedirectTo: redirect }) : await db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        box.querySelector('.sform').hidden = true; box.querySelector('.sdone').hidden = false; box.querySelector('.sdone b').textContent = email;
      } catch (err) { console.warn('sign-in', err); msg.textContent = /rate|limit/i.test(String(err.message)) ? 'Too many tries. Wait a minute and try again.' : 'Couldn’t send the link. Check the address and try again.'; msg.className = 'smsg err'; btn.disabled = false; }
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') box.querySelector('.ssend').click(); if (e.key === 'Escape') close(false); });
  }
  box.innerHTML = `<div class="sbox"><button class="sclose" aria-label="Close">✕</button>
    <h3>Sign in to ${esc(reason || 'continue')}</h3>
    <div class="sform"><p>Watching streams and playing the decks need an account, so your deck time and settings stay with you. Enter your email and we’ll send a sign-in link. No password needed.</p>
      <input type="email" placeholder="name@company.com" autocomplete="email" inputmode="email">
      <button class="ssend">Send sign-in link</button><p class="smsg"></p></div>
    <div class="sdone" hidden><p>Check your inbox. We sent a link to <b></b>. Open it on this device and you’ll be signed in.</p></div></div>`;
  box.hidden = false; box.querySelector('input').focus();
  return new Promise((res) => { resolver = res; });
}

// ask before doing something that needs an account. Resolves true if already signed in; otherwise shows the prompt (and resolves false).
A.require = async (reason) => {
  if (!ready || !backend?.supabase) return true;      // where there is no backend (local testing) nothing is locked
  await refresh();
  if (A.signedIn) return true;
  await show(reason); return false;
};
A.signOut = async () => { await backend.supabase.auth.signOut(); await refresh(); };

async function init() {
  /* no guest session is made here: visitors to the website should not each become an account */
  try { backend = await import('./backend.js?v=2'); if (!backend.supabase) return; } catch (e) { console.warn('sign-in is not available here', e); return; }
  ready = true; A.ready = true;
  backend.supabase.auth.onAuthStateChange(() => { setTimeout(refresh, 0); });   // not inside the callback itself: calling the auth client from there can deadlock
  await refresh();
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act=signin]'); if (!b) return;
    if (A.signedIn) { if (confirm(`Sign out of ${A.email}?`)) await A.signOut(); } else show('get started');
  });
}
Object.defineProperty(A, 'isReady', { get: () => ready });
window.__auth = A;
init();
