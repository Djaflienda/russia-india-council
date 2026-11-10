'use strict';
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const controls = hero.querySelector('.hero-controls');
  const toggle = hero.querySelector('.motion-toggle');
  const scenes = [...hero.querySelectorAll('[data-scene-select]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let visible = true;
  let scene = 0;
  let timer;

  function selectScene(index) {
    scene = index;
    hero.dataset.scene = String(index);
    scenes.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }
  function update() {
    clearInterval(timer);
    const stopped = paused || reduced.matches || document.hidden || !visible;
    hero.classList.toggle('is-paused', stopped);
    toggle.setAttribute('aria-pressed', String(paused));
    const english = document.documentElement.lang === 'en';
    toggle.setAttribute('aria-label', english ? (paused ? 'Play animation' : 'Pause animation') : (paused ? 'Продолжить анимацию' : 'Приостановить анимацию'));
    scenes.forEach((button, i) => button.setAttribute('aria-label', `${english ? 'Background view' : 'Ракурс'} ${i + 1}`));
    if (!stopped) timer = setInterval(() => selectScene((scene + 1) % scenes.length), 8500);
  }
  toggle.addEventListener('click', () => { paused = !paused; update(); });
  scenes.forEach((button, index) => button.addEventListener('click', () => { selectScene(index); update(); }));
  reduced.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    update();
  }).observe(hero);
  controls.hidden = false;
  update();
})();
