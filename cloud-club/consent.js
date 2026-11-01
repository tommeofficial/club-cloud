// Cookie notice: essential storage only for now; optional cookies would only be switched on after "accept".
(() => {
  let v = null; try { v = localStorage.getItem('cc-consent'); } catch (_) {}
  window.__consent = v;
  if (v) return;
  const b = document.createElement('div'); b.id = 'ccconsent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookies');
  b.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:520px;margin:0 auto;background:#0d0d0e;color:#b4b7bb;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px 18px;font:400 13.5px/1.55 Inter,system-ui,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.6)';
  b.innerHTML = '<div>We use essential cookies to keep you signed in and make the club work, plus optional ones only if you agree. <a href="/cookies" style="color:#f4f4f2">Cookie policy</a> · <a href="/privacy" style="color:#f4f4f2">Privacy</a></div><div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end"><button data-v="no" style="all:unset;cursor:pointer;padding:9px 14px;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#f4f4f2;font-weight:500">Decline optional</button><button data-v="yes" style="all:unset;cursor:pointer;padding:9px 14px;border-radius:8px;background:#f4f4f2;color:#050505;font-weight:600">Accept cookies</button></div>';
  b.addEventListener('click', (e) => { const x = e.target.closest('[data-v]'); if (!x) return; try { localStorage.setItem('cc-consent', x.dataset.v); } catch (_) {} window.__consent = x.dataset.v; b.remove(); });
  document.body.appendChild(b);
})();
