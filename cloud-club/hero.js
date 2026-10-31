// The home page reel: four clips of the app take turns behind the headline. Only the clip on screen plays, and nothing plays while the
// page is hidden or the hero is scrolled away. Reduced-motion visitors get the first still frame.
const hero = document.getElementById('hero');
const slides = [...hero.querySelectorAll('.slide')], dots = [...hero.querySelectorAll('#dots button')], line = document.getElementById('hline');
const SLIDE_S = 9, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cur = -1, timer = null, visible = true;
hero.style.setProperty('--slide', SLIDE_S + 's');

function show(n) {
  n = (n + slides.length) % slides.length;
  if (cur >= 0) { slides[cur].classList.remove('on'); dots[cur].classList.remove('on'); const prev = slides[cur], old = prev.querySelector('video'); setTimeout(() => { if (!prev.classList.contains('on')) old.pause(); }, 1000); }
  cur = n; const s = slides[n], v = s.querySelector('video');
  s.classList.add('on'); line.textContent = s.dataset.h;
  dots.forEach((d, i) => { d.classList.remove('on'); d.setAttribute('aria-selected', i === n); });
  void dots[n].offsetWidth; dots[n].classList.add('on');          // restart the progress bar
  if (!still) { v.preload = 'auto'; v.currentTime = 0; v.play().catch(() => {}); }
  const next = slides[(n + 1) % slides.length].querySelector('video'); if (next && next.preload === 'none') { next.preload = 'auto'; next.load(); }   // have the next clip ready
  clearTimeout(timer); if (!still) timer = setTimeout(() => { if (visible) show(cur + 1); else timer = setTimeout(() => show(cur + 1), 1000); }, SLIDE_S * 1000);
}
dots.forEach((d, i) => d.addEventListener('click', () => show(i)));
new IntersectionObserver(([e]) => { visible = e.isIntersecting; const v = slides[cur].querySelector('video'); if (!still) { if (visible) v.play().catch(() => {}); else v.pause(); } }, { threshold: 0.2 }).observe(hero);
document.addEventListener('visibilitychange', () => { const v = slides[cur].querySelector('video'); if (!still) { if (document.hidden) v.pause(); else if (visible) v.play().catch(() => {}); } });
show(0);
