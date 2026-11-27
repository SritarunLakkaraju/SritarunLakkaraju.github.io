// 3D desk for the hero: a laptop (its lid opens with the scroll and its screen types
// real code from my repos), a mechanical keyboard whose keys press as the code types,
// a mouse and a few floating keycaps. Every model is built from three.js primitives
// here, so there are no model files to download.
//
// Loaded only when motion is on (see main.js); main.js calls window.__hero3d.frame()
// from its single animation loop with the hero's scroll progress and the pointer.
const root = document.documentElement;
if (root.classList.contains('motion')) init();

async function init() {
  const host = document.querySelector('.hero');
  if (!host) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'three';
  canvas.setAttribute('aria-hidden', 'true');
  let THREE, renderer;
  // the page (text, fonts, layout) comes first; the 680 KB 3D library after it has loaded
  if (document.readyState !== 'complete') await new Promise((r) => addEventListener('load', r, { once: true }));
  try {
    THREE = await import('./vendor/three.module.min.js');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return; // no WebGL: the hero keeps its 2D scene
  }
  host.insertBefore(canvas, host.querySelector('.hero-frame'));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // ---------------------------------------------------------- lighting + reflections
  // A tiny studio (dark room, a few bright panels) baked into an environment map gives
  // the metal and glossy plastic something to reflect without loading an HDR file.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x05080d, side: THREE.BackSide })));
  const panel = (c, i, x, y, z, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
  };
  panel(0xffffff, 3.0, -6, 9, 4, 8, 3);
  panel(0x7fdcf0, 2.2, 9, 2, -4, 4, 8);
  panel(0xb8a6ff, 1.6, -9, 1, -6, 4, 6);
  panel(0xffffff, 0.8, 0, 3, 12, 10, 2);
  scene.environment = pmrem.fromScene(studio, 0.03).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0a0f18, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 7, 6); scene.add(key);
  const rim = new THREE.PointLight(0x7fdcf0, 30, 18, 2); rim.position.set(3.5, 2.5, -3.5); scene.add(rim);
  const fill = new THREE.PointLight(0xb8a6ff, 14, 14, 2); fill.position.set(-5, 1, 2); scene.add(fill);

  // ---------------------------------------------------------- helpers
  // A rounded box: a rounded rectangle extruded with a bevel (core three.js only).
  const rbox = (w, h, d, r, seg = 3) => {
    const bev = Math.min(r * 0.6, h * 0.35);
    const iw = w - bev * 2, id = d - bev * 2, ir = Math.max(0.001, r - bev);
    const s = new THREE.Shape(), x = -iw / 2, y = -id / 2;
    s.moveTo(x + ir, y); s.lineTo(x + iw - ir, y); s.quadraticCurveTo(x + iw, y, x + iw, y + ir);
    s.lineTo(x + iw, y + id - ir); s.quadraticCurveTo(x + iw, y + id, x + iw - ir, y + id);
    s.lineTo(x + ir, y + id); s.quadraticCurveTo(x, y + id, x, y + id - ir);
    s.lineTo(x, y + ir); s.quadraticCurveTo(x, y, x + ir, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: seg, curveSegments: seg * 2 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(h - bev * 2) / 2, 0);
    return g;
  };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const blob = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const shadow = (w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  };
  const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';

  const alu = new THREE.MeshStandardMaterial({ color: 0x3a4656, metalness: 0.85, roughness: 0.32 });
  const darkAlu = new THREE.MeshStandardMaterial({ color: 0x1b232e, metalness: 0.8, roughness: 0.38 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.55 });
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0x111922, metalness: 0.2, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 });

  const desk = new THREE.Group(); scene.add(desk);

  // ---------------------------------------------------------- laptop
  const laptop = new THREE.Group(); desk.add(laptop);
  const base = new THREE.Mesh(rbox(3.2, 0.1, 2.15, 0.14), alu); laptop.add(base);
  const lkGeo = rbox(0.19, 0.03, 0.18, 0.035, 2);
  const lkeys = new THREE.InstancedMesh(lkGeo, keyMat, 13 * 5);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) {
    m4.makeTranslation(-1.33 + c * 0.222, 0.06, -0.83 + r * 0.2);
    lkeys.setMatrixAt(n, m4); lkeys.setColorAt(n, col.set(0x0e151d)); n++;
  }
  laptop.add(lkeys);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.62), new THREE.MeshStandardMaterial({ color: 0x2a3441, metalness: 0.6, roughness: 0.25 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.052, 0.62); laptop.add(pad);

  const lid = new THREE.Group(); lid.position.set(0, 0.085, -1.07); laptop.add(lid);
  const shellGeo = rbox(3.2, 0.07, 2.1, 0.14); shellGeo.rotateX(Math.PI / 2); shellGeo.translate(0, 1.05, -0.035);
  lid.add(new THREE.Mesh(shellGeo, alu));
  // screen: the code from my repos, typed live
  const SW = 1024, SH = 640;
  const scr = document.createElement('canvas'); scr.width = SW; scr.height = SH;
  const sg = scr.getContext('2d');
  const screenTex = new THREE.CanvasTexture(scr); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: 0x000000 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.96, 1.85), screenMat);
  screen.position.set(0, 1.07, 0.002); lid.add(screen);
  // logo on the back of the lid (seen while the laptop is closed)
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.32, 48), new THREE.MeshBasicMaterial({
    toneMapped: false, transparent: true,
    map: canvasTex(256, 256, (g, w) => {
      g.strokeStyle = '#7fdcf0'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 12, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#eaf2ee'; g.font = `600 92px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SL', w / 2, w / 2 + 4);
    }),
  }));
  logo.position.set(0, 1.05, -0.076); logo.rotation.set(0, Math.PI, Math.PI); lid.add(logo);
  const lshadow = shadow(4.6, 3.4); lshadow.position.y = -0.07; laptop.add(lshadow);

  // ---------------------------------------------------------- mechanical keyboard
  const kb = new THREE.Group(); desk.add(kb);
  kb.add(new THREE.Mesh(rbox(4.3, 0.16, 1.5, 0.12), darkAlu));
  const COLS = 15, ROWS = 5, KS = 0.245, GAP = 0.035;
  const kcGeo = rbox(KS, 0.11, KS, 0.045, 2);
  const kkeys = new THREE.InstancedMesh(kcGeo, keyMat, COLS * ROWS);
  const keyPos = [];
  n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = -((COLS - 1) / 2) * (KS + GAP) + c * (KS + GAP), z = -0.56 + r * (KS + GAP);
    keyPos.push([x, z]);
    m4.makeTranslation(x, 0.13, z); kkeys.setMatrixAt(n, m4);
    kkeys.setColorAt(n, col.set(r === 0 || c === 0 || c === COLS - 1 ? 0x2a3646 : 0x161f2a)); n++;
  }
  kb.add(kkeys);
  const keyBase = keyPos.map((_, i) => (kkeys.getColorAt(i, col), col.clone()));
  const press = new Float32Array(COLS * ROWS); // 0..1 per key
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.1), new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    map: canvasTex(512, 256, (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, '#7fdcf0'); lg.addColorStop(0.5, '#b8a6ff'); lg.addColorStop(1, '#ff9e6a');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      const mask = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.5);
      mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = mask; g.fillRect(0, 0, w, h);
    }),
  }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.09; glow.material.opacity = 0.45; kb.add(glow);

  // ---------------------------------------------------------- mouse
  const mouse = new THREE.Group(); desk.add(mouse);
  const mg = new THREE.SphereGeometry(0.5, 48, 32);
  const pos = mg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i); const z = pos.getZ(i);
    y = y < 0 ? y * 0.22 : y * (0.62 - z * 0.25); // flat underside, higher at the back
    pos.setY(i, y);
  }
  mg.computeVertexNormals(); mg.scale(1.2, 1, 1.9);
  mouse.add(new THREE.Mesh(mg, plastic));
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 24), new THREE.MeshBasicMaterial({ color: 0x7fdcf0, toneMapped: false }));
  wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.33, -0.42); mouse.add(wheel);
  const split = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.5), new THREE.MeshBasicMaterial({ color: 0x05080c }));
  split.position.set(0, 0.32, -0.62); mouse.add(split);
  const mshadow = shadow(1.8, 2.6); mshadow.position.y = -0.11; mouse.add(mshadow);

  // ---------------------------------------------------------- floating keycaps
  const LEGENDS = [['{ }', 0x7fdcf0], ['</>', 0xb8a6ff], ['λ', 0xf0d27a], ['⌘', 0xeaf2ee], [';', 0xff9e6a]];
  const capGeo = rbox(0.62, 0.34, 0.62, 0.12);
  const caps = LEGENDS.map(([txt, c], i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({ color: 0x1a2532, metalness: 0.1, roughness: 0.35, clearcoat: 0.6 })));
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({
      transparent: true, toneMapped: false,
      map: canvasTex(128, 128, (x, w) => {
        x.fillStyle = '#' + new THREE.Color(c).getHexString(); x.font = `500 ${txt.length > 1 ? 44 : 64}px ${MONO}`;
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, w / 2 + 3);
      }),
    }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.176; g.add(top);
    g.userData = { phase: i * 1.37, orbit: 2.7 + (i % 2) * 0.6, speed: 0.12 + i * 0.015, h: -0.2 + (i % 3) * 0.75 };
    desk.add(g);
    return g;
  });

  // ---------------------------------------------------------- screen content
  const SNIPS = [
    ['fast-gemm-cpp / gemm.h', [
      'for (; j + 8 <= jend; j += 8) {',
      '    float32x4_t c0 = vld1q_f32(c + j), c1 = vld1q_f32(c + j + 4);',
      '    c0 = vfmaq_f32(c0, a0, vld1q_f32(b0 + j));',
      '    c1 = vfmaq_f32(c1, a0, vld1q_f32(b0 + j + 4));',
      '    c0 = vfmaq_f32(c0, a1, vld1q_f32(b1 + j));',
      '    c1 = vfmaq_f32(c1, a1, vld1q_f32(b1 + j + 4));',
      '    vst1q_f32(c + j, c0);',
      '    vst1q_f32(c + j + 4, c1);',
      '}']],
    ['agentic-rag-adk / rag.py', [
      'def _rrf(*rankings, k0: int = 60):',
      '    """Reciprocal Rank Fusion: score = sum 1/(k0 + rank)."""',
      '    fused: dict[int, float] = {}',
      '    for ranking in rankings:',
      '        for rank, (idx, _) in enumerate(ranking):',
      '            fused[idx] = fused.get(idx, 0.0) + 1.0 / (k0 + rank + 1)',
      '    return sorted(fused.items(), key=lambda x: -x[1])']],
    ['budget-tracker / budget_progress.dart', [
      'double get rawFraction => limit <= 0 ? 0 : spent / limit;',
      '',
      'double get clampedFraction => rawFraction.clamp(0.0, 1.0);',
      '',
      'bool get isOverBudget => limit > 0 && spent > limit;',
      '',
      'bool get isNearLimit => !isOverBudget && rawFraction >= 0.8;']],
  ];
  const colour = (line) => {
    if (/^\s*(""")/.test(line)) return [[line, '#6f8791']];
    const out = []; let last = 0;
    line.replace(/\b(for|def|return|in|bool|double|get|int|float|dict|lambda|const|float32x4_t)\b|\b(v\w+_f32|enumerate|sorted|clamp|_rrf)\b|\b(\d+(?:\.\d+)?)\b/g, (m, k, f, num, i) => {
      if (i > last) out.push([line.slice(last, i), '#a8bcc4']);
      out.push([m, k ? '#b8a6ff' : f ? '#7fdcf0' : '#f0d27a']); last = i + m.length; return m;
    });
    if (last < line.length) out.push([line.slice(last), '#a8bcc4']);
    return out;
  };
  const typing = { snip: 0, chars: 0, hold: 0, last: 0 };
  const drawScreen = (now, power) => {
    const g = sg;
    g.fillStyle = '#060d16'; g.fillRect(0, 0, SW, SH);
    // title bar
    g.fillStyle = '#0c1a27'; g.fillRect(0, 0, SW, 52);
    ['#ff6b6b', '#ffc35a', '#5ad17a'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(30 + i * 24, 26, 7, 0, Math.PI * 2); g.fill(); });
    const [file, lines] = SNIPS[typing.snip];
    g.font = `400 20px ${MONO}`; g.fillStyle = '#6f8791'; g.fillText(file, 120, 33);
    g.fillStyle = '#7fdcf0'; g.fillText('● live', SW - 110, 33);
    // code, typed up to typing.chars
    g.font = `400 21px ${MONO}`;
    let left = typing.chars, y = 100, cx = 60, cy = 100;
    for (let li = 0; li < lines.length && left >= 0; li++) {
      g.fillStyle = '#2b4052'; g.fillText(String(li + 1).padStart(2, ' '), 14, y);
      let x = 60;
      for (const [t, c] of colour(lines[li])) {
        const vis = t.slice(0, Math.max(0, left));
        left -= t.length;
        g.fillStyle = c; g.fillText(vis, x, y);
        x += g.measureText(vis).width;
        if (left < 0) break;
      }
      cx = x; cy = y;
      left -= 1; y += 40;
    }
    if ((now / 500 | 0) % 2 === 0) { g.fillStyle = '#7fdcf0'; g.fillRect(cx + 2, cy - 19, 11, 24); }
    // status line
    g.fillStyle = '#0c1a27'; g.fillRect(0, SH - 44, SW, 44);
    g.fillStyle = '#6f8791'; g.font = `400 17px ${MONO}`;
    g.fillText('main  ·  17 repos  ·  every result measured', 22, SH - 16);
    screenMat.color.setScalar(power);
    screenTex.needsUpdate = true;
  };
  const totalChars = (s) => SNIPS[s][1].reduce((a, l) => a + l.length + 1, 0);

  // ---------------------------------------------------------- layout + timeline
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  let W = 1, H = 1, wide = true;
  const resize = () => {
    W = host.clientWidth; H = host.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, W < 700 ? 1.5 : 1.75));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    wide = W / H > 1.05;
  };
  resize();
  addEventListener('resize', resize);

  // resting layout of the desk (laptop centre-back, keyboard in front, mouse to the right)
  kb.position.set(0.1, -0.5, 2.75); kb.rotation.y = 0.05;
  mouse.position.set(2.55, -0.45, 2.6); mouse.rotation.y = -0.25;
  const camFrom = new THREE.Vector3(), camTo = new THREE.Vector3(), look = new THREE.Vector3(), look0 = new THREE.Vector3(), look1 = new THREE.Vector3();
  const screenWorld = new THREE.Vector3();
  const sm = { mx: 0, my: 0 };
  let lastT = 0, lastDraw = 0, pressAt = 0;
  canvas.style.opacity = '0';
  requestAnimationFrame(() => { canvas.style.opacity = ''; canvas.classList.add('on'); });

  const frame = (t, p, px, py) => {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    const k = 1 - Math.exp(-dt * 5);
    sm.mx += (px - sm.mx) * k; sm.my += (py - sm.my) * k;

    // the desk also runs its own entrance clock, so it never pops in fully formed if three.js arrives late
    const own = (t - born) / 1000;
    const enter = Math.min(ease(range(p, 0.0, 0.2)), ease(clamp(own / 1.6)));
    const open = Math.min(ease(range(p, 0.08, 0.32)), ease(clamp((own - 0.5) / 1.5)));
    const zoom = ease(range(p, 0.48, 0.64));
    const time = t / 1000;

    // where the desk sits: right half on wide screens, top band on tall ones
    const dist = wide ? 11.5 : Math.max(13, 5.0 / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * camera.aspect));
    desk.position.set(wide ? 2.6 : 0, lerp(-2.2, wide ? -0.1 : 2.6, enter), 0);
    desk.scale.setScalar(lerp(0.75, 1, enter) * (wide ? 0.82 : 1));
    desk.rotation.y = lerp(lerp(-0.9, -0.32, enter) + sm.mx * 0.22 + Math.sin(time * 0.3) * 0.04, 0, zoom);
    desk.rotation.x = lerp(sm.my * 0.08, 0, zoom);
    lid.rotation.x = lerp(lerp(Math.PI / 2 - 0.02, -0.3, open), 0, zoom);

    kb.position.y = -0.5 + Math.sin(time * 0.9) * 0.05 * (1 - zoom);
    mouse.position.y = -0.45 + Math.sin(time * 1.1 + 1) * 0.06 * (1 - zoom);
    mouse.rotation.z = Math.sin(time * 0.7) * 0.04;
    caps.forEach((c) => {
      const u = c.userData, a = u.phase + time * u.speed;
      c.position.set(Math.cos(a) * u.orbit + 0.3, u.h + 1.1 + Math.sin(time * 0.8 + u.phase) * 0.18, Math.sin(a) * u.orbit * 0.6 + 0.4);
      c.rotation.set(Math.sin(time * 0.5 + u.phase) * 0.5, a * 1.3, Math.cos(time * 0.4 + u.phase) * 0.4);
      c.visible = zoom < 0.95;
      c.scale.setScalar(enter);
    });

    // camera: a slow orbit, then a flight into the laptop screen
    camFrom.set(sm.mx * 0.6, 2.6 - sm.my * 0.4, dist);
    look0.set(wide ? 0.4 : 0, wide ? 0.2 : 0.9, 0);
    screen.getWorldPosition(screenWorld);
    camTo.set(screenWorld.x, screenWorld.y, screenWorld.z + 2.15 * desk.scale.x);
    look1.copy(screenWorld);
    camera.position.lerpVectors(camFrom, camTo, zoom);
    look.lerpVectors(look0, look1, zoom);
    camera.lookAt(look);

    // typing on the laptop screen + keys pressing on the keyboard
    const power = clamp(open * 1.15) * (1 - range(p, 0.82, 1));
    if (power > 0.02) {
      if (t - typing.last > 55) {
        typing.last = t;
        if (typing.hold > 0) typing.hold--;
        else if (typing.chars < totalChars(typing.snip)) { typing.chars += 2; pressAt = t; press[(Math.random() * press.length) | 0] = 1; }
        else { typing.hold = 30; typing.snip = (typing.snip + 1) % SNIPS.length; typing.chars = 0; }
      }
    }
    for (let i = 0; i < press.length; i++) {
      const v = press[i];
      press[i] = v * Math.exp(-dt * 9);
      const [x, z] = keyPos[i];
      m4.makeTranslation(x, 0.13 - press[i] * 0.06, z); kkeys.setMatrixAt(i, m4);
      kkeys.setColorAt(i, col.copy(keyBase[i]).lerp(new THREE.Color(0x7fdcf0), press[i] * 0.9));
    }
    kkeys.instanceMatrix.needsUpdate = true; kkeys.instanceColor.needsUpdate = true;
    glow.material.opacity = 0.35 + 0.15 * Math.sin(time * 1.4) + (t - pressAt < 120 ? 0.08 : 0);
    if (t - lastDraw > 60 || power === 0) { lastDraw = t; drawScreen(t, power); }

    renderer.render(scene, camera);
  };
  document.fonts && document.fonts.ready.then(() => { lastDraw = 0; });
  const born = performance.now();
  window.__hero3d = { frame, canvas };
}
