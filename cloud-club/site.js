// The website's header and footer (shared by every page), the account icon and the mobile burger menu.
// Sign-in itself is auth.js: a magic link to the person's email.
const here = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
const link = (href, text) => `<a href="${href}"${here === href ? ' aria-current="page"' : ''}>${text}</a>`;
const USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/></svg>';
const BURGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

document.body.insertAdjacentHTML('afterbegin', `<header class="sh">
  <a class="brand" href="/"><i aria-hidden="true"></i>CLUB CLOUD</a>
  <nav id="mainnav" aria-label="Main">${link('/', 'Home')}${link('/about', 'About')}${link('/pricing', 'Pricing')}<a href="/app">Play the decks</a></nav>
  <div class="tools">
    <a class="cta" href="/pricing">GO PRO</a>
    <button class="acct" type="button" aria-label="Account" aria-haspopup="menu" aria-expanded="false">${USER}</button>
    <button class="burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mainnav">${BURGER}</button>
    <div class="menu" role="menu" hidden></div>
  </div>
</header>`);
document.body.insertAdjacentHTML('beforeend', `<footer class="sf"><div class="wrap">
  <div><a href="/about">About</a><a href="/pricing">Pricing</a><a href="/terms">Terms</a><a href="https://www.instagram.com/tommeofficial/" target="_blank" rel="noopener">Instagram</a></div>
  <div>© Club Cloud</div></div></footer>`);

const nav = document.getElementById('mainnav'), burger = document.querySelector('.sh .burger'), acct = document.querySelector('.sh .acct'), menu = document.querySelector('.sh .menu');
const closeAll = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); burger.innerHTML = BURGER; menu.hidden = true; acct.setAttribute('aria-expanded', 'false'); };
burger.addEventListener('click', (e) => { e.stopPropagation(); const open = !nav.classList.contains('open'); closeAll(); if (open) { nav.classList.add('open'); burger.setAttribute('aria-expanded', 'true'); burger.innerHTML = CLOSE; } });
nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeAll(); });
document.addEventListener('click', (e) => { if (!e.target.closest('.sh .menu, .sh .acct')) menu.hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
addEventListener('resize', () => { if (innerWidth > 760) closeAll(); });

// the account icon: signed out it opens the sign-in popup; signed in it opens a small menu
const render = () => {
  const A = window.__auth, on = !!(A && A.signedIn);
  acct.classList.toggle('on', on);
  menu.innerHTML = on
    ? `<div class="who">${String(A.email).replace(/[<>&"]/g, '')}</div><a href="/app" role="menuitem">Open the app</a><a href="/pricing" role="menuitem">Plans and pricing</a><button type="button" role="menuitem" data-out>Sign out</button>`
    : '';
};
acct.addEventListener('click', async (e) => {
  e.stopPropagation();
  const A = window.__auth;
  if (!A || !A.signedIn) { closeAll(); if (A) A.require('Club Cloud'); return; }
  render(); menu.hidden = !menu.hidden; acct.setAttribute('aria-expanded', String(!menu.hidden));
});
menu.addEventListener('click', async (e) => { if (e.target.closest('[data-out]')) { await window.__auth.signOut(); closeAll(); render(); } });
addEventListener('cc-auth', render);
render();

// sign-in needs auth.js; load it here so every page can use it
const s = document.createElement('script'); s.type = 'module'; s.src = 'auth.js?v=4'; document.head.appendChild(s);
