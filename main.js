// Portfolio interactions. Content is fully readable without this file.
(() => {
  window.__siteReady = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---- hero entrance
  requestAnimationFrame(() => $('.hero')?.classList.add('ready'));

  // ---- reveal on scroll + chart bars + counters
  const countUp = (el) => {
    const end = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.split('.')[1] || '').length;
    if (reduce) { el.textContent = end.toFixed(dec); return; }
    const dur = 1400; const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      el.textContent = (end * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in');
        if (el.dataset.count) countUp(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('[data-reveal], .chart, [data-count]').forEach((el) => io.observe(el));
  } else {
    $$('[data-reveal], .chart').forEach((el) => el.classList.add('in'));
    $$('[data-count]').forEach((el) => { el.textContent = el.dataset.count; });
  }

  // ---- typed role line
  const typed = $('.typed');
  if (typed) {
    const roles = JSON.parse(typed.dataset.roles);
    if (reduce) { typed.textContent = roles[0]; }
    else {
      let i = 0, j = 0, del = false;
      const tick = () => {
        const word = roles[i];
        j += del ? -1 : 1;
        typed.textContent = word.slice(0, j);
        let wait = del ? 28 : 55;
        if (!del && j === word.length) { del = true; wait = 1700; }
        else if (del && j === 0) { del = false; i = (i + 1) % roles.length; wait = 280; }
        setTimeout(tick, wait);
      };
      typed.textContent = '';
      setTimeout(tick, 900);
    }
  }

  // ---- scroll: progress bar, nav state, back-to-top, timeline fill
  const progress = $('.progress');
  const nav = $('.nav');
  const toTop = $('.to-top');
  const timelines = $$('.timeline');
  const onScroll = () => {
    const h = document.documentElement;
    const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    progress?.style.setProperty('--p', p.toFixed(4));
    nav?.classList.toggle('scrolled', h.scrollTop > 20);
    toTop?.classList.toggle('show', h.scrollTop > 900);
    timelines.forEach((tl) => {
      const r = tl.getBoundingClientRect();
      const v = Math.min(1, Math.max(0, (innerHeight * 0.75 - r.top) / r.height));
      tl.style.setProperty('--tp', reduce ? 1 : v.toFixed(3));
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- active nav link
  const links = $$('.nav ul a[href^="#"]');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => so.observe(s));
  }

  // ---- project filters
  const chips = $$('.chip');
  const cards = $$('.project');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    const show = (c) => f === 'all' || c.dataset.tracks.split(' ').includes(f);
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
          c.style.animationDelay = (k++ * 60) + 'ms';
          void c.offsetWidth; c.classList.add('is-entering');
          c.querySelectorAll('.chart').forEach((ch) => ch.classList.add('in'));
        }
      });
    }, 260);
    const live = $('#filter-status');
    if (live) live.textContent = `${cards.filter(show).length} projects shown`;
  }));

  // ---- cursor spotlight + subtle tilt on the hero card
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    cards.forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
    const hc = $('.term-card');
    const hero = $('.hero');
    const spot = $('.hero .spot');
    if (hero) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        spot?.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        spot?.style.setProperty('--sy', (e.clientY - r.top) + 'px');
        if (hc && innerWidth > 1020) {
          const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
          hc.style.setProperty('--ry', (-7 + x * 10).toFixed(2) + 'deg');
          hc.style.setProperty('--rx', (3 - y * 7).toFixed(2) + 'deg');
        }
      });
      hero.addEventListener('pointerleave', () => { hc?.style.removeProperty('--ry'); hc?.style.removeProperty('--rx'); });
    }
    // magnetic buttons
    $$('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        b.style.transform = `translate(${x * 0.22}px, ${y * 0.32}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  // ---- hero results terminal
  const term = $('.term-card');
  if (term) {
    const data = JSON.parse(term.dataset.term);
    const tabs = $$('.tc-tab', term);
    const cmd = $('.tc-cmd', term), rowsEl = $('.tc-rows', term);
    const note = $('.tc-note', term), link = $('.tc-link', term);
    const bar = $('.tc-progress', term);
    const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    let cur = 0, timers = [], paused = false, auto = true, t0 = 0, dwell = 0, raf = 0;
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
      dwell = 250 + d.cmd.length * 55 + 260 + rows.length * 190 + 3200;
      t0 = performance.now();
    };

    let last = performance.now();
    const loop = (now) => {
      if (!auto) { bar.style.setProperty('--tp', 0); return; }
      if (paused) t0 += now - last; // hold progress while hovered
      last = now;
      const p = Math.min(1, (now - t0) / dwell);
      bar.style.setProperty('--tp', p.toFixed(3));
      if (p >= 1) show((cur + 1) % data.length, true);
      raf = requestAnimationFrame(loop);
    };

    tabs.forEach((t, i) => t.addEventListener('click', () => {
      auto = false; cancelAnimationFrame(raf); bar.style.setProperty('--tp', 0);
      show(i, !reduce);
    }));
    term.addEventListener('pointerenter', () => { paused = true; });
    term.addEventListener('pointerleave', () => { paused = false; });

    if (reduce) { show(0, false); }
    else { show(0, true); setTimeout(() => { raf = requestAnimationFrame(loop); }, 400); }
  }

  // ---- hero network background
  const canvas = $('.hero canvas.net');
  if (canvas && !reduce && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const heroEl = $('.hero');
    let W = 0, H = 0, dpr = 1, pts = [], mouse = { x: -9999, y: -9999 }, running = true, visible = true, rafN = 0;
    const COLORS = ['200,245,106', '111,220,242', '245,154,183'];
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, Math.max(28, (W * H) / 16000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8, c: COLORS[Math.random() < 0.7 ? 0 : Math.random() < 0.6 ? 1 : 2],
      }));
    };
    const LINK = 130, MLINK = 190;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
        if (d < MLINK && d > 1) { p.x += dx / d * 0.25; p.y += dy / d * 0.25; }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${a.c},${(1 - d / LINK) * 0.22})`;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const md = Math.hypot(mouse.x - a.x, mouse.y - a.y);
        if (md < MLINK) {
          ctx.strokeStyle = `rgba(${a.c},${(1 - md / MLINK) * 0.55})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${a.c},0.75)`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      if (running && visible) rafN = requestAnimationFrame(frame);
    };
    const start = () => { cancelAnimationFrame(rafN); if (running && visible) rafN = requestAnimationFrame(frame); };
    resize(); start();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    heroEl.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    heroEl.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; start(); }).observe(heroEl);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; start(); });
  }

  // ---- screenshot lightbox
  const dlg = $('dialog.lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    const img = $('img', dlg), cap = $('p', dlg);
    $$('button.shot').forEach((b) => b.addEventListener('click', () => {
      const src = $('img', b);
      img.src = src.currentSrc || src.src; img.alt = src.alt; cap.textContent = b.dataset.caption || src.alt;
      dlg.showModal();
    }));
    $('.close', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
})();
