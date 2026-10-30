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

let box = null, resolver = null, mode = 'in', reasonText = '';
function close(ok) { if (box) box.hidden = true; if (resolver) { resolver(!!ok); resolver = null; } }
const say = (t, bad) => { const m = box.querySelector('.smsg'); m.textContent = t || ''; m.className = 'smsg' + (bad ? ' err' : ''); };
const niceError = (err) => {
  const m = String((err && err.message) || '');
  if (/invalid login/i.test(m)) return 'That email or password isn\u2019t right.';
  if (/not confirmed/i.test(m)) return 'Confirm your email first: we sent you a link.';
  if (/already|registered/i.test(m)) return 'There\u2019s already an account with that email. Try signing in.';
  if (/password/i.test(m) && /(short|least|weak|characters)/i.test(m)) return 'Use a password with at least 8 characters.';
  if (/rate|limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  return 'Something went wrong. Check your details and try again.';
};
function draw() {
  const create = mode === 'up', forgot = mode === 'forgot', reset = mode === 'reset';
  box.innerHTML = `<div class="sbox"><button class="sclose" aria-label="Close">\u2715</button>
    <h3>${reset ? 'Set a new password' : forgot ? 'Reset your password' : `${create ? 'Create your account' : 'Sign in'} to ${esc(reasonText || 'continue')}`}</h3>
    ${forgot || reset ? '' : `<div class="stabs"><button data-mode="in" class="${create ? '' : 'on'}">Sign in</button><button data-mode="up" class="${create ? 'on' : ''}">Create account</button></div>`}
    <div class="sform">
      ${forgot ? '<p>Enter your email and we\u2019ll send you a link to choose a new password.</p>' : reset ? '' : `<p>${create ? 'Make an account to watch streams, play the decks and keep your deck time.' : 'Welcome back. Sign in to keep going.'}</p>`}
      ${reset ? '' : '<input class="semail" type="email" placeholder="Email" autocomplete="email" inputmode="email">'}
      ${forgot ? '' : `<input class="spass" type="password" placeholder="${reset ? 'New password' : create ? 'Choose a password (8+ characters)' : 'Password'}" autocomplete="${create || reset ? 'new-password' : 'current-password'}">`}
      <button class="ssend">${reset ? 'Save password' : forgot ? 'Send reset link' : create ? 'Create account' : 'Sign in'}</button>
      <p class="smsg" role="status"></p>
      ${mode === 'in' ? '<p class="sfoot"><a href="#" data-mode="forgot">Forgot your password?</a></p>' : forgot ? '<p class="sfoot"><a href="#" data-mode="in">Back to sign in</a></p>' : ''}
    </div>
    <div class="sdone" hidden><p></p></div></div>`;
  const first = box.querySelector('input'); if (first) first.focus();
}
async function submit() {
  const db = backend.supabase, email = (box.querySelector('.semail') || {}).value?.trim() || '', pass = (box.querySelector('.spass') || {}).value || '';
  const btn = box.querySelector('.ssend');
  if (mode !== 'reset' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('Enter a valid email address.', true);
  if (mode !== 'forgot' && (mode === 'in' ? pass.length < 1 : pass.length < 8)) return say(mode === 'in' ? 'Enter your password.' : 'Use a password with at least 8 characters.', true);
  btn.disabled = true; say('One moment\u2026');
  const site = location.origin + location.pathname + location.search;
  const done = (msg) => { box.querySelector('.sform').hidden = true; const d = box.querySelector('.sdone'); d.hidden = false; d.querySelector('p').innerHTML = msg; };
  try {
    if (mode === 'in') {
      const { error } = await db.auth.signInWithPassword({ email, password: pass }); if (error) throw error;
      await refresh(); close(true); return;
    }
    if (mode === 'up') {
      await refresh();
      if (user && user.is_anonymous) {                        // a guest keeps their account: the email and password are added to it
        const { data, error } = await db.auth.updateUser({ email, password: pass }, { emailRedirectTo: site }); if (error) throw error;
        await refresh();
        if (A.signedIn) { close(true); return; }
        return done(`Almost there. We sent a link to <b>${esc(email)}</b>. Open it to confirm your email, then sign in.`);
      }
      const { data, error } = await db.auth.signUp({ email, password: pass, options: { emailRedirectTo: site } }); if (error) throw error;
      if (data.session) { await refresh(); close(true); return; }
      return done(`Almost there. We sent a link to <b>${esc(email)}</b>. Open it to confirm your email, then sign in.`);
    }
    if (mode === 'forgot') {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' }); if (error) throw error;
      return done(`If there\u2019s an account for <b>${esc(email)}</b>, we sent a link to choose a new password.`);
    }
    if (mode === 'reset') {
      const { error } = await db.auth.updateUser({ password: pass }); if (error) throw error;
      await refresh(); return done('Your password is saved. You\u2019re signed in.');
    }
  } catch (err) { console.warn('sign-in', err); say(niceError(err), true); btn.disabled = false; }
}
function show(reason, startMode = 'in') {
  reasonText = reason; mode = startMode;
  if (!box) {
    box = document.createElement('div'); box.id = 'signin'; document.body.appendChild(box);
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.closest('.sclose')) { close(false); return; }
      const m = e.target.closest('[data-mode]'); if (m) { e.preventDefault(); mode = m.dataset.mode; draw(); return; }
      if (e.target.closest('.ssend')) submit();
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') submit(); if (e.key === 'Escape') close(false); });
  }
  draw(); box.hidden = false;
  return new Promise((res) => { resolver = res; });
}

// ask before doing something that needs an account. Resolves true if already signed in; otherwise shows the prompt (and resolves false).
A.require = async (reason) => {
  if (!ready || !backend?.supabase) return true;      // where there is no backend (local testing) nothing is locked
  await refresh();
  if (A.signedIn) return true;
  return await show(reason);
};
A.signOut = async () => { await backend.supabase.auth.signOut(); await refresh(); };

async function init() {
  /* no guest session is made here: visitors to the website should not each become an account */
  try { backend = await import('./backend.js?v=2'); if (!backend.supabase) return; } catch (e) { console.warn('sign-in is not available here', e); return; }
  ready = true; A.ready = true;
  backend.supabase.auth.onAuthStateChange((event) => { setTimeout(refresh, 0); if (event === 'PASSWORD_RECOVERY') setTimeout(() => show('', 'reset'), 300); });   // not inside the callback itself: calling the auth client from there can deadlock
  await refresh();
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act=signin]'); if (!b) return;
    if (A.signedIn) { if (confirm(`Sign out of ${A.email}?`)) await A.signOut(); } else show('get started', 'in');
  });
}
Object.defineProperty(A, 'isReady', { get: () => ready });
window.__auth = A;
init();
