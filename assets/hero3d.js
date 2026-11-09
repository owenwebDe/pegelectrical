/* Olem Electrical — hero WebGL
   A field of conductors seen in perspective: a grid of upright bars whose
   height is the load they are carrying. A current pulse travels across the
   grid, bars rise on the crest and light from dusk blue up to sunset orange.
   Olem does no solar, so the flat panel field of the sister sites would have
   been the wrong picture.

   Quality governor, in order of preference:
     full      — animated, pointer- and scroll-reactive        (GPU present)
     lightened — animated at pixel ratio 1                     (45fps > rate > 30fps)
     still     — one rendered frame, loop stopped, zero cost   (software GL,
                                                                reduced motion,
                                                                or under 30fps)
   The still frame is the same scene, so the page looks identical in a screenshot
   and costs nothing on a machine that cannot animate it. */

const canvas = document.getElementById('gl');

const forceMotion = /[?&]motion=on(&|$)/.test(window.location.search);
const reduce = !forceMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (canvas && hasWebGL()) {
  init().catch(() => { canvas.style.display = 'none'; });
} else if (canvas) {
  canvas.style.display = 'none';
}

async function init() {
  const THREE = await import('three');

  const small = window.innerWidth < 860;
  const COLS = small ? 28 : 44;
  const ROWS = small ? 15 : 22;
  const STEP = 0.78;
  const COUNT = COLS * ROWS;

  const scene = new THREE.Scene();
  // the page ground colour, so the far edge of the field dissolves into the paper
  scene.fog = new THREE.Fog(0x0A1120, small ? 18 : 22, small ? 38 : 48);

  const camera = new THREE.PerspectiveCamera(small ? 42 : 36, 1, 0.1, 140);
  /* lower than the panel sites: the bars are read across, not looked down on */
  const camBase = new THREE.Vector3(0, small ? 4.4 : 3.6, small ? 16 : 18);
  camera.position.copy(camBase);

  /* ---------- is this a software renderer? (probe context, discarded) ---------- */
  let software = false;
  try {
    const probe = document.createElement('canvas').getContext('webgl');
    const ext = probe && probe.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(probe.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    software = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(name);
    const lose = probe && probe.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { /* assume hardware */ }

  let mode = (reduce || software) ? 'still' : 'full';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !small,
    alpha: true,
    powerPreference: small ? 'low-power' : 'high-performance',
    // one frame only: without this the browser clears the buffer after
    // compositing and the canvas goes blank
    preserveDrawingBuffer: mode === 'still'
  });
  renderer.setClearColor(0x000000, 0);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xD6E6FF, 0x0B1322, 0.62));
  const key = new THREE.DirectionalLight(0xFFF2DC, 2.1);
  key.position.set(-6, 10, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xFF9A63, 0.95);
  rim.position.set(7, 4, -6);
  scene.add(rim);

  /* ---------- the cell field ---------- */
  const geo = new THREE.BoxGeometry(0.3, 1, 0.3);
  geo.translate(0, 0.5, 0);          // pivot at the foot, so it rises not centres
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.46 });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const colPanel  = new THREE.Color('#1B2740');   // idle conductor
  const colDeep   = new THREE.Color('#2E568F');   // current arriving
  const colBrand  = new THREE.Color('#6898DA');   // conducting
  const colAccent = new THREE.Color('#FF7A3D');   // peak load

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const xs = new Float32Array(COUNT);
  const zs = new Float32Array(COUNT);
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      xs[i] = (c - (COLS - 1) / 2) * STEP;
      zs[i] = (r - (ROWS - 1) / 2) * STEP;
      i++;
    }
  }

  // create the per-instance colour attribute up front: if it only appears
  // during the first setColorAt, a single-render (still) page can composite
  // before the shader picks up the instancing-colour define and draws white.
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  mesh.rotation.x = -0.02;
  mesh.position.y = -1.6;
  mesh.position.z = -1.0;
  scene.add(mesh);

  /* ---------- pointer + scroll ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse && mode !== 'still') {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let scrollN = 0;
  const hero = document.querySelector('.hero');
  function readScroll() {
    if (!hero) return;
    const h = hero.offsetHeight || window.innerHeight;
    scrollN = Math.min(1, Math.max(0, window.scrollY / h));
  }
  if (mode !== 'still') {
    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });
  }

  /* ---------- resize ---------- */
  let ratioCap = small ? 1.3 : 1.6;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', () => { resize(); if (mode === 'still') drawOnce(); }, { passive: true });

  /* ---------- the field, at time t ---------- */
  let t = 0;

  function updateField() {
    camera.position.x = camBase.x + pointer.x * 2.4;
    camera.position.y = camBase.y - pointer.y * 0.7 + scrollN * 3.4;
    camera.position.z = camBase.z + scrollN * 3.4;
    camera.lookAt(0, -0.2 - scrollN * 1.1, 0);

    mesh.rotation.y = Math.sin(t * 0.09) * 0.07 + scrollN * 0.22;

    const px = pointer.x * 9;
    const pz = pointer.y * 5;

    for (let k = 0; k < COUNT; k++) {
      const x = xs[k], z = zs[k];

      const d = x * 0.30 + z * 0.42;
      const pulse = Math.sin(d - t * 1.5);
      const swell = Math.sin(x * 0.17 - t * 0.55) * 0.35;

      const dist = Math.hypot(x - px, z - pz);
      const ripple = Math.cos(Math.min(dist, 7) * 0.85 - t * 2.6) * Math.max(0, 1 - dist / 7);

      const lift = pulse * 0.52 + swell + ripple * 0.85;

      /* a bar never inverts: the wave is the load on top of a resting height */
      const hgt = 0.34 + Math.max(0, lift + 1.1) * 1.22;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, 0, 0);
      const w = 1 + Math.max(0, lift) * 0.1;
      dummy.scale.set(w, hgt, w);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);

      const a = Math.min(1, Math.max(0, (lift + 1.1) / 2.3));
      if (a < 0.46) {
        col.copy(colPanel).lerp(colDeep, a / 0.46);
      } else if (a < 0.72) {
        col.copy(colDeep).lerp(colBrand, (a - 0.46) / 0.26);
      } else {
        col.copy(colBrand).lerp(colAccent, (a - 0.72) / 0.28);
      }
      mesh.setColorAt(k, col);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function drawOnce() {
    updateField();
    renderer.render(scene, camera);
  }

  /* ---------- still mode: one frame, then nothing ---------- */
  if (mode === 'still') {
    t = 2.35;                 // a wave shape with a good spread of crests
    pointer.x = -0.18;
    mat.needsUpdate = true;
    drawOnce();
    drawOnce();               // second pass: the program is compiled by now
    canvas.classList.add('is-on');
    return;
  }

  /* ---------- animated mode ---------- */
  let visible = true, hidden = false, raf = 0;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { visible = e.isIntersecting; schedule(); }),
    { rootMargin: '80px' }
  );
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; schedule(); });

  function schedule() {
    cancelAnimationFrame(raf);
    if (mode !== 'stopped' && visible && !hidden) raf = requestAnimationFrame(frame);
  }

  // quality governor
  let samples = 0, elapsed = 0;

  const clock = new THREE.Clock();

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    pointer.x += (pointer.tx - pointer.x) * 0.055;
    pointer.y += (pointer.ty - pointer.y) * 0.055;

    updateField();
    renderer.render(scene, camera);

    if (samples < 48) {
      samples++;
      elapsed += dt;
      if (samples === 48) {
        const avgMs = (elapsed / samples) * 1000;
        if (avgMs > 34) {              // under ~30fps: settle on a still frame
          mode = 'stopped';
          cancelAnimationFrame(raf);
          freezeToImage();             // must run in this same frame
        } else if (avgMs > 22) {       // under ~45fps: cheaper pixels
          ratioCap = 1;
          resize();
        }
      }
    }
  }

  // Called straight after a render, while the drawing buffer is still intact:
  // copies the frame into an <img> and drops the live GL context entirely.
  function freezeToImage() {
    let url = '';
    try { url = canvas.toDataURL('image/png'); } catch (e) { /* tainted or lost */ }
    if (!url) return;                       // leave the canvas as it is
    const still = document.createElement('img');
    still.src = url;
    still.alt = '';
    still.setAttribute('aria-hidden', 'true');
    still.className = 'hero__still is-on';
    canvas.parentNode.insertBefore(still, canvas);
    try { io.disconnect(); renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    canvas.remove();
  }

  resize();
  frame();
  requestAnimationFrame(() => canvas.classList.add('is-on'));
}
