// Cookie notice: essential storage only for now; optional cookies would only be switched on after "accept".
(() => {
  let v = null; try { v = localStorage.getItem('cc-consent'); } catch (_) {}
  window.__consent = v;
  if (v) return;
  const b = document.createElement('div'); b.id = 'ccconsent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookies');
  b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:560px;margin:0 auto;background:#0b1220;color:#d5deea;border:1px solid rgba(143,233,255,.35);border-radius:12px;padding:14px 16px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.6)';
  b.innerHTML = '<div>We use essential cookies to keep you signed in and make the club work, plus optional ones only if you agree. <a href="/cookies" style="color:#8fe9ff">Cookie policy</a> · <a href="/privacy" style="color:#8fe9ff">Privacy</a></div><div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end"><button data-v="no" style="all:unset;cursor:pointer;padding:8px 14px;border:1px solid rgba(255,255,255,.3);border-radius:8px">DECLINE OPTIONAL</button><button data-v="yes" style="all:unset;cursor:pointer;padding:8px 14px;border-radius:8px;background:#8fe9ff;color:#07121d;font-weight:700">ACCEPT COOKIES</button></div>';
  b.addEventListener('click', (e) => { const x = e.target.closest('[data-v]'); if (!x) return; try { localStorage.setItem('cc-consent', x.dataset.v); } catch (_) {} window.__consent = x.dataset.v; b.remove(); });
  document.body.appendChild(b);
})();
