// Portfolio interactions. Content is fully readable without this file.
//
// One requestAnimationFrame loop runs the page: Lenis advances the smooth
// scroll, then each scroll-driven part reads the shared scroll position and
// writes transform/opacity directly. Section positions are measured on resize
// only, never inside the loop, so a frame does no layout work.
(() => {
  window.__siteReady = true;
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reduce;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const finePointer = matchMedia('(pointer: fine)').matches;

  if (motion) root.classList.add('motion');

  // ---------------------------------------------------------------- smooth scroll
  let lenis = null;
  if (motion && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  }
  const scrollToY = (y, duration = 1.4) => {
    if (lenis) lenis.scrollTo(y, { duration });
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    const target = hash === '#top' ? 0 : document.getElementById(hash.slice(1));
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: target === 0 ? 0 : -72, duration: 1.6 });
    history.replaceState(null, '', hash === '#top' ? location.pathname : hash);
    if (target !== 0) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });

  // ---------------------------------------------------------------- measurements
  let vw = innerWidth, vh = innerHeight;
  const pins = {}; // name -> {el, top, h}
  const pinned = (name, sel) => { const el = $(sel); if (el) pins[name] = { el, top: 0, h: 1 }; };
  pinned('hero', '.hero-journey');
  pinned('pipe', '#pipeline');
  pinned('reel', '#reel');
  const parallax = motion ? $$('[data-parallax]').filter((el) => !el.closest('.pin')).map((el) => ({ el, f: parseFloat(el.dataset.parallax), top: 0, h: 0 })) : [];
  const timelines = $$('.timeline').map((el) => ({ el, top: 0, h: 1 }));
  const reelTrack = $('.reel-track');
  const frames = $$('.frame').map((el) => ({ el, img: $('img', el), left: 0, w: 0 }));
  let docH = 1;
  const absTop = (el) => el.getBoundingClientRect().top + scrollY;
  const measure = () => {
    vw = innerWidth; vh = innerHeight;
    // clear transforms we own so offsets are the untransformed layout
    Object.values(pins).forEach((p) => { p.top = absTop(p.el); p.h = p.el.offsetHeight; });
    parallax.forEach((p) => { const t = p.el.style.transform; p.el.style.transform = ''; p.top = absTop(p.el); p.h = p.el.offsetHeight; p.el.style.transform = t; });
    timelines.forEach((t) => { t.top = absTop(t.el); t.h = t.el.offsetHeight; });
    frames.forEach((f) => { f.left = f.el.offsetLeft; f.w = f.el.offsetWidth; });
    docH = root.scrollHeight;
    dirty = true;
  };
  const prog = (p, y) => (p ? clamp((y - p.top) / Math.max(1, p.h - vh)) : 0);
  let dirty = true;

  // ---------------------------------------------------------------- reveal + counters
  const countUp = (el) => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const end = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.split('.')[1] || '').length;
    if (reduce) { el.textContent = end.toFixed(dec); return; }
    const dur = 1200, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = (end * (1 - Math.pow(1 - k, 4))).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const heroCounts = $$('.hero [data-count]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        if (en.target.dataset.count) countUp(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('[data-reveal], .chart').forEach((el) => io.observe(el));
    // in the pinned hero the stats are on screen but invisible until the results phase
    if (!motion) heroCounts.forEach((el) => io.observe(el));
  } else {
    $$('[data-reveal], .chart').forEach((el) => el.classList.add('in'));
    $$('[data-count]').forEach((el) => { el.textContent = el.dataset.count; });
  }

  // ---------------------------------------------------------------- typed role line
  const typed = $('.typed');
  if (typed) {
    const roles = JSON.parse(typed.dataset.roles);
    if (reduce) typed.textContent = roles[0];
    else {
      let i = 0, j = roles[0].length, del = false;
      const tick = () => {
        const word = roles[i];
        j += del ? -1 : 1;
        typed.textContent = word.slice(0, j);
        let wait = del ? 28 : 55;
        if (!del && j === word.length) { del = true; wait = 1900; }
        else if (del && j === 0) { del = false; i = (i + 1) % roles.length; wait = 280; }
        setTimeout(tick, wait);
      };
      setTimeout(() => { del = true; tick(); }, 2600);
    }
  }

  // ---------------------------------------------------------------- results terminal
  const term = $('.term-card');
  let startTerm = () => {};
  if (term) {
    const data = JSON.parse(term.dataset.term);
    const tabs = $$('.tc-tab', term);
    const cmd = $('.tc-cmd', term), rowsEl = $('.tc-rows', term);
    const note = $('.tc-note', term), link = $('.tc-link', term);
    const bar = $('.tc-progress', term);
    const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    let cur = 0, timers = [], paused = false, auto = true, t0 = 0, dwell = 0, raf = 0, started = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const show = (i, animate) => {
      clear(); cur = i;
      const d = data[i];
      term.dataset.track = d.track;
      tabs.forEach((t, k) => t.setAttribute('aria-pressed', String(k === i)));
      note.textContent = d.note;
      link.href = 'https://github.com/SritarunLakkaraju/' + d.repo;
      link.textContent = d.repo + ' ↗';
      rowsEl.innerHTML = d.rows.map(([k, v]) => `<div class="tc-row"><span class="k">${esc(k)}</span><span class="dots"></span><span class="v">${esc(v)}</span></div>`).join('');
      const rows = $$('.tc-row', rowsEl);
      if (!animate) {
        cmd.innerHTML = `<span class="pr">${esc(d.prompt)}</span> <span class="cmd">${esc(d.cmd)}</span><span class="tc-caret"></span>`;
        rows.forEach((r) => r.classList.add('on'));
        return;
      }
      cmd.innerHTML = `<span class="pr">${esc(d.prompt)}</span> <span class="cmd"></span><span class="tc-caret"></span>`;
      const c = $('.cmd', cmd);
      let j = 0;
      const type = () => {
        c.textContent = d.cmd.slice(0, ++j);
        if (j < d.cmd.length) later(type, 34 + Math.random() * 40);
        else rows.forEach((r, k) => later(() => r.classList.add('on'), 260 + k * 190));
      };
      later(type, 250);
      dwell = 250 + d.cmd.length * 55 + 260 + rows.length * 190 + 3400;
      t0 = performance.now();
    };
    let last = performance.now();
    const loop = (now) => {
      if (!auto) { bar.style.setProperty('--tp', 0); return; }
      if (paused) t0 += now - last;
      last = now;
      const p = Math.min(1, (now - t0) / dwell);
      bar.style.setProperty('--tp', p.toFixed(3));
      if (p >= 1) show((cur + 1) % data.length, true);
      raf = requestAnimationFrame(loop);
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => {
      started = true; auto = false; cancelAnimationFrame(raf); bar.style.setProperty('--tp', 0);
      show(i, !reduce);
    }));
    term.addEventListener('pointerenter', () => { paused = true; });
    term.addEventListener('pointerleave', () => { paused = false; });
    show(0, false);
    startTerm = () => {
      if (started || reduce) return;
      started = true;
      show(0, true); last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    if (!motion) startTerm();
  }

  // ---------------------------------------------------------------- hero (pinned)
  const hero = $('.hero');
  const L = (name) => $(`[data-layer="${name}"]`);
  const H = {
    veil: L('veil'), hud: L('hud'), title: L('title'), big: $('.hero h1 .big'), copy: L('copy'), results: L('results'),
    grid: L('grid'), p1: L('p1'), p2: L('p2'), p3: L('p3'), clock: $('.hud-clock'), tests: $('.hud-tests'),
  };
  const base = {};
  ['p1', 'p2', 'p3'].forEach((k) => { if (H[k]) base[k] = parseFloat(getComputedStyle(H[k]).opacity) || 1; });
  const wideHero = matchMedia('(min-width: 861px)');
  const isPinned = () => hero && getComputedStyle(hero).position === 'sticky';
  let heroPinned = false, heroP = 0, veilK = 1;
  // The landing plays its opening by itself: a ~1 s boot log on the veil, the veil clears,
  // then the desk, the name and the intro arrive (hero progress 0 -> INTRO_END over ~3.4 s).
  // Scrolling continues from there, so the visitor never lands on an empty screen.
  const INTRO_END = 0.34;
  const introT0 = performance.now();
  const introAt = (t) => {
    const s = (t - introT0) / 1000;
    if (s < 1.0) return 0;
    if (s < 1.6) return 0.14 * easeOut((s - 1.0) / 0.6);
    return Math.min(INTRO_END, 0.14 + (INTRO_END - 0.14) * easeOut(Math.min(1, (s - 1.6) / 1.8)));
  };
  let introP = 0;
  const heroDraw = (scrollP) => Math.min(1, introP + scrollP * (1 - INTRO_END));
  const scrollFor = (drawP) => Math.max(0, (drawP - INTRO_END) / (1 - INTRO_END));
  const tf = (el, s) => { if (el) el.style.transform = s; };
  const op = (el, v) => { if (el) el.style.opacity = v.toFixed(3); };
  const two = (n) => String(Math.floor(n)).padStart(2, '0');
  const drawHero = (p) => {
    heroP = p;
    veilK = range(p, 0, 0.14);
    op(H.veil, 1 - veilK);
    tf(H.veil, `translate3d(0,${(-veilK * 22).toFixed(2)}vh,0) scale(${(1 + veilK * 0.2).toFixed(4)})`);
    if (H.veil) H.veil.style.visibility = veilK >= 1 ? 'hidden' : '';
    op(H.hud, range(p, 0.04, 0.12) * (1 - range(p, 0.88, 0.97)));

    const settle = easeOut(range(p, 0, 0.5));
    const exit = range(p, 0.82, 1);
    const fadeIn = range(p, 0.02, 0.2);
    tf(H.grid, `translate3d(0,${(lerp(22, 0, settle) - exit * 14).toFixed(2)}vh,0)`);
    tf(H.p1, `translate3d(${lerp(-5, 0, settle).toFixed(2)}vw,${(lerp(12, 0, settle) - p * 6 - exit * 16).toFixed(2)}vh,0) scale(${lerp(1.1, 1, settle).toFixed(4)})`);
    tf(H.p2, `translate3d(${lerp(6, 0, settle).toFixed(2)}vw,${(lerp(22, 0, settle) - p * 10 - exit * 30).toFixed(2)}vh,0) scale(${lerp(1.08, 1, settle).toFixed(4)})`);
    const near = easeOut(range(p, 0.1, 0.55));
    tf(H.p3, `translate3d(0,${(lerp(44, 0, near) - exit * 60).toFixed(2)}vh,0) rotate(${lerp(-3, 0, near).toFixed(2)}deg)`);
    const k3 = window.__hero3d ? 0.4 : 1; // with the 3D desk on screen the flat panels step back
    if (H.p1) op(H.p1, base.p1 * fadeIn * (1 - exit * 0.7));
    if (H.p2) op(H.p2, k3 * base.p2 * fadeIn * (1 - exit * 0.7));
    if (H.p3) op(H.p3, k3 * base.p3 * range(p, 0.1, 0.3) * (1 - exit * 0.7) * (1 - range(p, 0.5, 0.6) * 0.5));
    if (window.__hero3d) window.__hero3d.canvas.style.opacity = (1 - range(p, 0.63, 0.7)).toFixed(3);

    // title resolves: tracking closes in, blur clears; then it yields to the results
    const tIn = easeOut(range(p, 0.1, 0.26)), tOut = range(p, 0.44, 0.52);
    op(H.title, tIn * (1 - tOut));
    tf(H.title, `translate3d(0,${(-p * 6 - tOut * 6).toFixed(2)}vh,0)`);
    const ls = wideHero.matches ? 0.16 : 0.24; // left-aligned beside the 3D desk on wide screens
    if (H.big) H.big.style.letterSpacing = lerp(ls + 0.46, ls, tIn).toFixed(4) + 'em';
    if (H.title) H.title.style.filter = tIn < 0.99 ? `blur(${((1 - tIn) * 6).toFixed(2)}px)` : '';

    const cIn = easeOut(range(p, 0.2, 0.32)), cOut = range(p, 0.44, 0.52);
    op(H.copy, cIn * (1 - cOut));
    tf(H.copy, `translate3d(0,${((1 - cIn) * 30 - cOut * 40).toFixed(1)}px,0)`);
    hero.classList.toggle('copy-off', cIn * (1 - cOut) < 0.5);

    const rIn = easeOut(range(p, 0.58, 0.68)), rOut = range(p, 0.86, 0.97);
    op(H.results, rIn * (1 - rOut));
    tf(H.results, `translate3d(0,${((1 - rIn) * 50 - rOut * 60).toFixed(1)}px,0) scale(${lerp(0.96, 1, rIn).toFixed(4)})`);
    hero.classList.toggle('results-on', rIn * (1 - rOut) > 0.5);
    if (rIn > 0.4) { startTerm(); heroCounts.forEach(countUp); }

    const secs = p * 5400;
    if (H.clock) H.clock.textContent = `T+ ${two(secs / 3600)}:${two((secs % 3600) / 60)}:${two(secs % 60)}`;
    if (H.tests) H.tests.textContent = String(Math.round(range(p, 0.1, 0.6) * 51));
  };
  // Keyboard users: tabbing into a part of the hero that is faded out scrolls to where it shows.
  if (hero) {
    hero.addEventListener('focusin', (e) => {
      if (!heroPinned) return;
      const P = pins.hero, span = P.h - vh;
      if (H.results && H.results.contains(e.target) && !hero.classList.contains('results-on')) scrollToY(P.top + span * scrollFor(0.74), 0.9);
      else if (H.copy && H.copy.contains(e.target) && hero.classList.contains('copy-off')) scrollToY(P.top + span * scrollFor(0.38), 0.9);
    });
  }

  // ---------------------------------------------------------------- glyph field (the "dust")
  const canvas = $('canvas.glyphs');
  const glyph = { ctx: null, W: 0, H: 0, dpr: 1, motes: [], last: 0, sprites: new Map(), tick: 0 };
  const GL = '{}[]()<>=;:/*+-01#&|λΣ∂→'.split('');
  const COLS = ['234,242,238', '127,220,240', '184,166,255'];
  const sizeGlyphs = () => {
    if (!canvas) return;
    glyph.dpr = Math.min(2, devicePixelRatio || 1);
    glyph.W = canvas.clientWidth; glyph.H = canvas.clientHeight;
    canvas.width = Math.round(glyph.W * glyph.dpr); canvas.height = Math.round(glyph.H * glyph.dpr);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = Math.round(clamp((glyph.W * glyph.H) / 9000, 60, 170));
    glyph.motes = Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), s: 0.3 + rnd(), a: 0.15 + rnd() * 0.6,
      z: rnd() < 0.6 ? 11 : rnd() < 0.7 ? 14 : 18, ch: GL[Math.floor(rnd() * GL.length)], c: COLS[rnd() < 0.7 ? 0 : rnd() < 0.6 ? 1 : 2] }))
;
    // Each (character, size, colour) is drawn once into a small canvas; frames then stamp
    // copies with drawImage, which is far cheaper than fillText for every glyph every frame.
    glyph.sprites.clear();
    glyph.motes.forEach((m) => {
      const key = m.ch + m.z + m.c;
      if (!glyph.sprites.has(key)) {
        const sc = document.createElement('canvas');
        const px = Math.ceil(m.z * 1.4 * glyph.dpr);
        sc.width = px; sc.height = px;
        const g = sc.getContext('2d');
        g.scale(glyph.dpr, glyph.dpr);
        g.font = `${m.z}px "JetBrains Mono", monospace`;
        g.textBaseline = 'middle'; g.textAlign = 'center';
        g.fillStyle = `rgb(${m.c})`;
        g.fillText(m.ch, (m.z * 1.4) / 2, (m.z * 1.4) / 2);
        glyph.sprites.set(key, sc);
      }
      m.img = glyph.sprites.get(key);
      m.half = (m.z * 1.4) / 2;
    });
  };
  const drawGlyphs = (t, still) => {
    const g = glyph, ctx = g.ctx;
    if (!ctx) return;
    const dt = g.last ? Math.min(0.1, (t - g.last) / 1000) : 1 / 60;
    // once the veil has cleared the field is faint and slow: 30 fps is plenty
    if (!still && veilK >= 1 && (g.tick++ & 1)) return;
    g.last = t;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.W, g.H);
    const dense = 1 - veilK; // thick under the veil, a faint field afterwards
    const lift = heroP * 0.5;
    for (const m of g.motes) {
      if (!still) {
        m.y -= 0.012 * m.s * dt;
        m.x += 0.002 * m.s * dt;
        if (m.y < 0) m.y += 1;
        if (m.x > 1) m.x -= 1;
      }
      const yy = ((m.y - lift) % 1 + 1) % 1;
      ctx.globalAlpha = m.a * (0.12 + 0.88 * dense);
      ctx.drawImage(m.img, m.x * g.W - m.half, yy * g.H - m.half, m.half * 2, m.half * 2);
    }
    ctx.globalAlpha = 1;
  };
  if (canvas && canvas.getContext) {
    glyph.ctx = canvas.getContext('2d');
    sizeGlyphs();
    if (reduce) { veilK = 1; drawGlyphs(0, true); }
  }

  // ---------------------------------------------------------------- pipeline drawn on scroll
  const pipe = {
    legs: $$('.pipe-svg .ink'), nodes: $$('.pipe-svg .node'), packet: $('.pipe-svg .packet'),
    items: $$('.legs .leg'), bars: $$('.leg-bar i'), count: $('.q-count'), cur: -1, lens: [],
  };
  pipe.lens = pipe.legs.map((p) => (p.getTotalLength ? p.getTotalLength() : 0));
  const setLeg = (s) => {
    if (s === pipe.cur) return;
    pipe.cur = s;
    pipe.items.forEach((li, i) => li.classList.toggle('on', i === s));
    pipe.bars.forEach((b, i) => b.classList.toggle('on', i <= s));
  };
  const drawPipe = (p) => {
    const n = pipe.legs.length;
    const u = range(p, 0.08, 0.9) * n;
    const s = clamp(Math.floor(u), 0, n - 1);
    setLeg(s);
    pipe.legs.forEach((path, i) => {
      const k = easeOut(clamp(u - i));
      path.style.strokeDashoffset = (1 - k).toFixed(4);
      if (i === s && pipe.packet && path.getPointAtLength) {
        const pt = path.getPointAtLength(pipe.lens[i] * k);
        pipe.packet.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      }
    });
    pipe.nodes.forEach((nd, i) => nd.classList.toggle('on', i === 0 ? p > 0.04 : u >= i - 0.02));
    if (pipe.count) pipe.count.textContent = String(Math.round(range(p, 0.08, 0.9) * 362));
  };
  if (!motion && pipe.items.length) pipe.items.forEach((li) => li.classList.add('on'));

  // ---------------------------------------------------------------- build-log reel
  const rc = { i: $('.rc-i'), bar: $('.rc-bar i'), cur: -1 };
  const drawReel = (p) => {
    if (!reelTrack || !frames.length) return;
    const k = range(p, 0.04, 0.96);
    const f0 = frames[0], fn = frames[frames.length - 1];
    const s0 = vw / 2 - (f0.left + f0.w / 2), s1 = vw / 2 - (fn.left + fn.w / 2);
    const shift = lerp(s0, s1, k);
    reelTrack.style.transform = `translate3d(${shift.toFixed(1)}px,0,0)`;
    let nearest = 0, best = Infinity;
    frames.forEach((f, i) => {
      const off = (f.left + f.w / 2 + shift - vw / 2) / vw;
      const a = clamp(Math.abs(off) * 1.6);
      f.el.style.opacity = (1 - a * 0.6).toFixed(3);
      f.el.style.transform = `scale(${(1 - a * 0.08).toFixed(4)})`;
      if (f.img) f.img.style.transform = `translate3d(${(off * -28).toFixed(1)}px,0,0)`;
      if (Math.abs(off) < best) { best = Math.abs(off); nearest = i; }
    });
    if (rc.bar) rc.bar.style.transform = `scaleX(${k.toFixed(4)})`;
    if (rc.i && nearest !== rc.cur) { rc.cur = nearest; rc.i.textContent = String(nearest + 1).padStart(2, '0'); }
  };

  // ---------------------------------------------------------------- chrome: progress, nav, back-to-top, timelines
  const progress = $('.progress'), nav = $('.nav'), toTop = $('.to-top');
  const drawChrome = (y) => {
    progress && progress.style.setProperty('--p', (y / Math.max(1, docH - vh)).toFixed(4));
    nav && nav.classList.toggle('scrolled', y > 20);
    toTop && toTop.classList.toggle('show', y > Math.max(900, heroPinned ? pins.hero.top + pins.hero.h - vh * 0.5 : 0));
    timelines.forEach((t) => t.el.style.setProperty('--tp', reduce ? 1 : clamp((y + vh * 0.75 - t.top) / t.h).toFixed(3)));
  };
  const drawParallax = (y) => {
    for (const p of parallax) {
      if (p.top + p.h < y - 200 || p.top > y + vh + 200) continue;
      const d = p.top + p.h / 2 - (y + vh / 2);
      p.el.style.transform = `translate3d(0,${(d * p.f).toFixed(1)}px,0)`;
    }
  };

  // ---------------------------------------------------------------- cursor follower
  let cursor = null;
  const cur = { x: -100, y: -100, tx: -100, ty: -100, on: false };
  const ptr = { x: 0, y: 0 }; // pointer, -0.5..0.5, for the 3D desk's tilt
  if (motion && finePointer) {
    addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.x = 0; ptr.y = 0; });
  }
  if (motion && finePointer) {
    cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    addEventListener('pointermove', (e) => {
      cur.tx = e.clientX; cur.ty = e.clientY;
      if (!cur.on) { cur.on = true; cur.x = cur.tx; cur.y = cur.ty; cursor.classList.add('on'); }
      const hot = e.target.closest && e.target.closest('a, button, summary, .chip, [role="button"]');
      cursor.classList.toggle('hover', !!hot);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { cur.on = false; cursor.classList.remove('on'); });
    addEventListener('pointerdown', () => cursor.classList.add('down'));
    addEventListener('pointerup', () => cursor.classList.remove('down'));
  }

  // ---------------------------------------------------------------- the loop
  let lastY = -1, lastT = 0;
  const frame = (t) => {
    if (lenis) lenis.raf(t);
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    const y = lenis ? lenis.scroll : scrollY;
    if (motion && introP < INTRO_END) { introP = introAt(t); dirty = true; }
    if (y !== lastY || dirty) {
      lastY = y; dirty = false;
      drawChrome(y);
      if (motion) {
        if (heroPinned) drawHero(heroDraw(prog(pins.hero, y)));
        if (pins.pipe && pinnedNow.pipe && y > pins.pipe.top - vh && y < pins.pipe.top + pins.pipe.h) drawPipe(prog(pins.pipe, y));
        if (pins.reel && pinnedNow.reel && y > pins.reel.top - vh && y < pins.reel.top + pins.reel.h) drawReel(prog(pins.reel, y));
        drawParallax(y);
      }
    }
    // glyphs drift continuously, but only while the hero is on screen and the tab is visible
    if (motion && glyph.ctx && pins.hero && y < pins.hero.top + pins.hero.h) drawGlyphs(t, false);
    // the 3D desk renders only while it can be seen (it fades out as the camera enters the screen)
    if (window.__hero3d && heroPinned && heroP < 0.71) window.__hero3d.frame(t, heroP, ptr.x, ptr.y);
    if (cursor && cur.on) {
      const k = 1 - Math.exp(-dt * 16); // frame-rate independent smoothing
      cur.x += (cur.tx - cur.x) * k; cur.y += (cur.ty - cur.y) * k;
      cursor.style.transform = `translate3d(${cur.x.toFixed(1)}px,${cur.y.toFixed(1)}px,0)`;
    }
    requestAnimationFrame(frame);
  };
  const pinnedNow = { pipe: false, reel: false };
  const remeasure = () => {
    heroPinned = motion && isPinned();
    pinnedNow.pipe = motion && !!$('#pipeline .pin') && getComputedStyle($('#pipeline .pin')).position === 'sticky';
    pinnedNow.reel = motion && !!$('#reel .pin') && getComputedStyle($('#reel .pin')).position === 'sticky';
    if (!heroPinned && hero) { // short screens: hero is static, clear any inline styles
      [H.veil, H.title, H.copy, H.results].forEach((el) => { if (el) { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; } });
    }
    if (!pinnedNow.reel && reelTrack) { reelTrack.style.transform = ''; frames.forEach((f) => { f.el.style.opacity = ''; f.el.style.transform = ''; if (f.img) f.img.style.transform = ''; }); }
    if (!pinnedNow.pipe && motion) { pipe.legs.forEach((l) => { l.style.strokeDashoffset = '0'; }); pipe.items.forEach((li) => li.classList.add('on')); pipe.cur = -1; }
    if (reelTrack) reelTrack.style.transform = '';
    measure();
    sizeGlyphs();
  };
  remeasure();
  requestAnimationFrame(frame);
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(remeasure, 120); });
  addEventListener('load', remeasure);
  document.fonts && document.fonts.ready.then(remeasure);
  if ('ResizeObserver' in window) {
    let pending = 0;
    new ResizeObserver(() => { cancelAnimationFrame(pending); pending = requestAnimationFrame(measure); }).observe($('main') || document.body);
  }

  // ---------------------------------------------------------------- project filters
  const chips = $$('.chip');
  const cards = $$('.project');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    const show = (c) => f === 'all' || c.dataset.tracks.split(' ').includes(f);
    const live = $('#filter-status');
    if (live) live.textContent = `${cards.filter(show).length} projects shown`;
    if (reduce) { cards.forEach((c) => c.classList.toggle('is-hidden', !show(c))); return; }
    cards.forEach((c) => { if (!c.classList.contains('is-hidden') && !show(c)) c.classList.add('is-leaving'); });
    setTimeout(() => {
      let k = 0;
      cards.forEach((c) => {
        c.classList.remove('is-leaving', 'is-entering');
        const vis = show(c);
        c.classList.toggle('is-hidden', !vis);
        if (vis) {
          c.classList.add('in');
          c.style.animationDelay = (k++ * 70) + 'ms';
          void c.offsetWidth; c.classList.add('is-entering');
          c.querySelectorAll('.chart').forEach((ch) => ch.classList.add('in'));
        }
      });
    }, 320);
  }));

  // ---------------------------------------------------------------- active nav link
  const links = $$('.nav ul a[href^="#"]');
  const sections = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => so.observe(s));
  }

  // ---------------------------------------------------------------- card spotlight + magnetic buttons
  if (motion && finePointer) {
    cards.forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
    $$('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        b.style.transform = `translate3d(${(x * 0.22).toFixed(1)}px,${(y * 0.32).toFixed(1)}px,0)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  // ---------------------------------------------------------------- screenshot lightbox
  const dlg = $('dialog.lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    const img = $('img', dlg), cap = $('p', dlg);
    $$('button.shot').forEach((b) => b.addEventListener('click', () => {
      const src = $('img', b);
      img.src = src.currentSrc || src.src; img.alt = src.alt; cap.textContent = b.dataset.caption || src.alt;
      dlg.showModal();
      lenis && lenis.stop();
    }));
    $('.close', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { lenis && lenis.start(); });
  }
})();
