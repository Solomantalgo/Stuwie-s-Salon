/* Sticky category navigation over the existing, always-visible service groups. */
(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.service-tabs');
  const listing = nav?.closest('section');
  if (!header || !nav || !listing) return;
  const tabs = [...nav.querySelectorAll('.service-tab')];
  const sections = [...listing.querySelectorAll('.service-category')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let headerHeight = 0, navHeight = 0, starts = [], activationOffset = 0;
  let active = 'all', frame = 0, measureFrame = 0, pending = null, pendingTimer = 0;
  let observer;
  const motion = () => reducedMotion.matches ? 'auto' : 'smooth';

  function centerTab(tab) {
    if (nav.scrollWidth <= nav.clientWidth) return;
    const rect = tab.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const left = nav.scrollLeft + rect.left - navRect.left - (nav.clientWidth - rect.width) / 2;
    // Scroll only the category strip, never the document.
    nav.scrollTo({ left: Math.max(0, Math.min(left, nav.scrollWidth - nav.clientWidth)), behavior: motion() });
  }

  function setActive(category) {
    if (active === category) return;
    active = category;
    tabs.forEach(tab => {
      const selected = tab.dataset.panel === category;
      tab.classList.toggle('active', selected);
      if (selected) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
    centerTab(tabs.find(tab => tab.dataset.panel === category));
  }

  function update() {
    frame = 0;
    if (pending) {
      if (Math.abs(window.scrollY - pending.top) <= 2) releaseNavigation();
      else return;
    }
    const probe = window.scrollY + activationOffset;
    let candidate = -1;
    starts.forEach((top, index) => { if (top <= probe) candidate = index; });
    const current = sections.findIndex(section => section.dataset.category === active);
    // A small dead band prevents oscillation at category boundaries in either direction.
    if (candidate > current && starts[candidate] > probe - 6) return;
    if (candidate < current && current >= 0 && starts[current] <= probe + 6) return;
    setActive(candidate < 0 ? 'all' : sections[candidate].dataset.category);
  }

  function queueUpdate() { if (!frame) frame = requestAnimationFrame(update); }
  function releaseNavigation() { pending = null; clearTimeout(pendingTimer); }
  function interruptNavigation() { if (pending) { releaseNavigation(); queueUpdate(); } }

  function measure() {
    measureFrame = 0;
    headerHeight = header.getBoundingClientRect().height;
    navHeight = nav.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--service-header-height', `${headerHeight}px`);
    document.documentElement.style.setProperty('--service-tabs-height', `${navHeight}px`);
    starts = sections.map(section => section.getBoundingClientRect().top + window.scrollY);
    // Activate the approaching category about 40–72px below the sticky strip.
    activationOffset = Math.min(innerHeight - 1, headerHeight + navHeight + Math.max(40, Math.min(72, (innerHeight - headerHeight - navHeight) * .1)));
    observer?.disconnect();
    if ('IntersectionObserver' in window) {
      const bottom = Math.max(0, innerHeight - activationOffset - 1);
      observer = new IntersectionObserver(queueUpdate, { rootMargin: `-${activationOffset}px 0px -${bottom}px 0px`, threshold: 0 });
      sections.forEach(section => observer.observe(section));
    }
    queueUpdate();
  }
  function queueMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }

  function navigate(category, smooth = true, anchor = null) {
    const target = anchor || (category === 'all' ? listing : sections.find(section => section.dataset.category === category));
    if (!target) return;
    measure();
    const offset = headerHeight + (category === 'all' ? 0 : navHeight) + 16;
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const top = Math.max(0, Math.min(target.getBoundingClientRect().top + scrollY - offset, maximum));
    clearTimeout(pendingTimer);
    pending = { top };
    setActive(category);
    centerTab(tabs.find(tab => tab.dataset.panel === category));
    // Keep the chosen state during a smooth journey past intermediate categories.
    pendingTimer = setTimeout(() => { releaseNavigation(); queueUpdate(); }, 2000);
    window.scrollTo({ top, behavior: smooth ? motion() : 'instant' });
    queueUpdate();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => navigate(tab.dataset.panel));
    tab.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus({ preventScroll: true });
      centerTab(tabs[next]);
    });
  });

  // Cached section positions make this fallback just five number comparisons per frame.
  // It also handles large scroll jumps that skip an observer's narrow activation band.
  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueMeasure, { passive: true });
  window.addEventListener('wheel', interruptNavigation, { passive: true });
  window.addEventListener('touchstart', interruptNavigation, { passive: true });
  window.addEventListener('keydown', event => {
    if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key) && !nav.contains(event.target)) interruptNavigation();
  });
  if ('ResizeObserver' in window) {
    const sizes = new ResizeObserver(queueMeasure);
    [header, nav, listing, ...sections].forEach(element => sizes.observe(element));
  }
  function followHash(smooth = false) {
    const id = location.hash.slice(1);
    const target = document.getElementById(id);
    const section = target?.closest('.service-category');
    if (section && listing.contains(section)) navigate(section.dataset.category, smooth, target);
    else if (id === listing.id) navigate('all', smooth);
  }
  window.addEventListener('hashchange', () => followHash(true));
  window.addEventListener('pageshow', queueMeasure);
  document.fonts?.ready.then(queueMeasure);
  measure();
  if (location.hash) requestAnimationFrame(() => followHash(false));
})();
