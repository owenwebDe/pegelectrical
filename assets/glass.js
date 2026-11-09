/* Fidotech & Sons Energy — liquid glass
   A vanilla port of the lens maths from repos/liquid-glass (@samasante/liquid-glass).

   The CSS class .glass already gives frost, tint, a rim light and a specular
   sweep in every browser. This file adds the part CSS cannot do: a real
   refraction, by building a spherical-cap displacement map on a canvas and
   running it through an SVG filter as backdrop-filter, so the live page behind
   the panel actually bends at the rim — no screenshot, no stale pixels.

   It is strictly an upgrade. If anything here is unavailable the page keeps the
   CSS material and looks the same minus the bend. */

(function () {
  'use strict';

  var force  = /[?&]motion=on(&|$)/.test(window.location.search);
  // ?lens=on bypasses the GPU check — for inspecting the refraction on a
  // machine whose detection is (correctly) conservative.
  var forceLens = /[?&]lens=on(&|$)/.test(window.location.search);
  var reduce = !force && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // backdrop-filter: url() is Chromium-only. Elsewhere the CSS material stands.
  if (!window.CSS || !CSS.supports || !CSS.supports('backdrop-filter', 'url(#x)')) return;

  // No GPU means the compositor re-runs this filter on every scrolled frame.
  var software = false;
  try {
    var gl = document.createElement('canvas').getContext('webgl');
    var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    var name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    software = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(name);
    var lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { /* assume hardware */ }
  if (software && !forceLens) return;

  /* ---------- lens maths (from displacement.ts) ---------- */

  var ERF_K = Math.sqrt(Math.PI);
  function erf(x) { return Math.tanh(ERF_K * x); }

  // Mean of the dome gradient x/sqrt(R^2 - x^2) over [0, H]; closed form, used
  // to normalise the spherical-cap profile so the average displacement is 0.5.
  function domeMean(R, H) { return H > 0 ? (R - Math.sqrt(R * R - H * H)) / H : 0; }

  // Spherical-cap radius from chord half-width a and cap height h: R = (a²+h²)/2h
  function domeConstants(cap, halfW, halfH) {
    var c = Math.max(0.01, Math.min(cap, Math.min(halfW, halfH) - 1));
    var Rx = (halfW * halfW + c * c) / (2 * c);
    var Ry = (halfH * halfH + c * c) / (2 * c);
    var mx = domeMean(Rx, halfW), my = domeMean(Ry, halfH);
    return { Rx: Rx, Ry: Ry, sx: mx > 0 ? 0.5 / mx : 1, sy: my > 0 ? 0.5 / my : 1 };
  }

  function domeGradient(d, R, s) {
    var inside = Math.min(d, R * (1 - 1e-3));   // keep the sqrt real at the rim
    return (inside / Math.sqrt(R * R - inside * inside)) * s;
  }

  var clamp255 = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; };

  var MAP = 160;   // map raster; the filter stretches it to the element

  // dx -> R, dy -> G, both signed around 0.5. Neutral (128,128) outside the shape.
  function lensMapUri(w, h, radius, depth, curvature) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = MAP;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(MAP, MAP);
    var d = img.data;

    var halfW = w / 2, halfH = h / 2, minHalf = Math.min(halfW, halfH);
    var rad = Math.max(0, Math.min(radius, minHalf));
    var depthPx = Math.max(1, Math.min(depth * minHalf, minHalf - 1));
    var falloff = Math.SQRT1_2 / depthPx;
    var dome = domeConstants(curvature * minHalf, halfW, halfH);
    var stepX = (2 * halfW) / MAP, stepY = (2 * halfH) / MAP;

    var i = 0;
    for (var y = 0; y < MAP; y++) {
      var py = (y + 0.5) * stepY - halfH;
      var ay = Math.abs(py);
      var oy = ay - (halfH - rad);
      for (var x = 0; x < MAP; x++) {
        var px = (x + 0.5) * stepX - halfW;
        var ax = Math.abs(px);
        var ox = ax - (halfW - rad);

        // signed distance to the rounded rect: negative inside, 0 on the rim
        var sdf = (ox > 0 || oy > 0)
          ? Math.sqrt(Math.max(ox, 0) * Math.max(ox, 0) + Math.max(oy, 0) * Math.max(oy, 0)) - rad
          : Math.max(ox, oy) - rad;

        var dx = 0, dy = 0;
        if (sdf < 0) {
          // 1 at the rim, falling to ~0 once you are depthPx inside
          var edge = 0.5 * (1 + erf((sdf + depthPx) * falloff));
          dx = -domeGradient(ax, dome.Rx, dome.sx) * (px < 0 ? -1 : 1) * edge;
          dy = -domeGradient(ay, dome.Ry, dome.sy) * (py < 0 ? -1 : 1) * edge;
        }

        d[i]     = clamp255((0.5 + dx) * 255 + 0.5);
        d[i + 1] = clamp255((0.5 + dy) * 255 + 0.5);
        d[i + 2] = 128;
        d[i + 3] = 255;
        i += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  /* ---------- the SVG filter ---------- */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var host = null;
  var cache = Object.create(null);
  var seq = 0;

  var DISPERSION = 0.22;   // red is displaced this much more than blue

  function ensureHost() {
    if (host) return host;
    host = document.createElementNS(SVG_NS, 'svg');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('width', '0');
    host.setAttribute('height', '0');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.appendChild(host);
    return host;
  }

  function el(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function buildFilter(w, h, radius, o) {
    var key = w + 'x' + h + ':' + radius + ':' + o.blur;
    if (cache[key]) return cache[key];

    var id = 'lg-' + (++seq);
    var f = el('filter', {
      id: id,
      x: '-15%', y: '-15%', width: '130%', height: '130%',
      'color-interpolation-filters': 'sRGB'
    });

    f.appendChild(el('feImage', {
      result: 'map', preserveAspectRatio: 'none',
      x: 0, y: 0, width: w, height: h, href: lensMapUri(w, h, radius, o.depth, o.curvature)
    }));
    f.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: o.blur, result: 'blurred' }));
    f.appendChild(el('feColorMatrix', { in: 'blurred', type: 'saturate', values: o.saturate, result: 'sat' }));

    var s = o.scale;
    [['dr', s * (1 + DISPERSION)], ['dg', s * (1 + DISPERSION / 2)], ['db', s]].forEach(function (p) {
      f.appendChild(el('feDisplacementMap', {
        in: 'sat', in2: 'map', scale: p[1], result: p[0],
        xChannelSelector: 'R', yChannelSelector: 'G'
      }));
    });

    // keep one channel from each pass, then screen them back together
    f.appendChild(el('feColorMatrix', { in: 'dr', result: 'cr', values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' }));
    f.appendChild(el('feColorMatrix', { in: 'dg', result: 'cg', values: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' }));
    f.appendChild(el('feColorMatrix', { in: 'db', result: 'cb', values: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' }));
    f.appendChild(el('feBlend', { in: 'cr', in2: 'cg', mode: 'screen', result: 'crg' }));
    f.appendChild(el('feBlend', { in: 'crg', in2: 'cb', mode: 'screen' }));

    ensureHost().appendChild(f);
    cache[key] = id;
    return id;
  }

  /* ---------- apply ---------- */

  // Static surfaces only. A lensed .scard__body would look lovely, but the rail
  // moves every frame and backdrop-filter re-runs the whole chain per card per
  // frame — thirteen cloned cards x nine primitives is a frame-rate disaster.
  // The cards keep the CSS material, which already reads as glass over a photo.
  // A 1440x76 bar is nearly all rim: at full depth the dome gradient smears the
  // backdrop vertically and reads as a glitch. The bars get a shallow, gentle
  // lens; the small rounded pill can take the full curvature.
  var TARGETS = [
    { sel: '.nav',        depth: 0.40, curvature: 0.16, scale: 5,  blur: 10, saturate: 1.45 },
    { sel: '.actionbar',  depth: 0.40, curvature: 0.16, scale: 5,  blur: 10, saturate: 1.45 },
    { sel: '.hero__cue',  depth: 0.75, curvature: 0.50, scale: 9,  blur: 6,  saturate: 1.40 },
    { sel: '.rail__btn',  depth: 0.80, curvature: 0.55, scale: 8,  blur: 5,  saturate: 1.35 }
  ];

  function radiusOf(node) {
    var r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    return r;
  }

  function dress(node, o) {
    var r = node.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w < 24 || h < 16) return;
    try {
      var id = buildFilter(w, h, radiusOf(node), o);
      node.style.backdropFilter = 'url(#' + id + ')';
      node.style.webkitBackdropFilter = 'url(#' + id + ')';
      node.classList.add('is-lensed');
    } catch (e) { /* keep the CSS material */ }
  }

  function dressAll() {
    TARGETS.forEach(function (o) {
      Array.prototype.forEach.call(document.querySelectorAll(o.sel), function (n) { dress(n, o); });
    });
  }

  function start() {
    dressAll();
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(dressAll, 220);
    }, { passive: true });
  }

  // after fonts, so the panels are at their final size
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { setTimeout(start, 350); }).catch(start);
  } else {
    window.addEventListener('load', start);
  }

  window.__glassRedress = dressAll;   // the rail calls this after it clones cards
})();
