/* Olem Electrical — motion layer
   Lenis smooth scroll + GSAP ScrollTrigger + SplitText.
   Everything is gated behind prefers-reduced-motion. */

(function () {
  'use strict';

  var doc = document;
  var body = doc.body;
  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  // ?motion=on forces the motion layer on. Windows Server and many locked-down
  // Windows installs ship with "Animation effects" off, which Edge reports as
  // prefers-reduced-motion:reduce — a machine setting, not always a real
  // preference. The override lets you demo the page on such a machine.
  var forceMotion = /[?&]motion=on(&|$)/.test(window.location.search);
  if (forceMotion) document.documentElement.classList.add('force-motion');
  var reduce = !forceMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ---------------- always-on, no-motion basics ---------------- */

  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // mobile menu
  var burger = $('.burger');
  var sheet = $('.sheet');
  if (burger && sheet) {
    burger.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    $$('a', sheet).forEach(function (a) {
      a.addEventListener('click', function () {
        body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
        sheet.setAttribute('aria-hidden', 'true');
      });
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) burger.click();
    });
  }

  // nav hairline once scrolled
  var nav = $('.nav');
  var onScrollNav = function () {
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 12);
  };
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  /* ---------------- reduced motion / no GSAP: stop here ---------------- */

  /* ---------------- sticky action bar ---------------- */
  /* The bar carries the same action as the hero button and the form's submit.
     Two of them on screen at once reads as a duplicate, so the bar stays down
     while either of those is in view and rises once neither is. Lives before
     the reduced-motion bail-out: it is the page's main action on a phone. */
  function stickyBar() {
    var bar = doc.querySelector('.actionbar');
    if (!bar) return;
    var rivals = [
      doc.querySelector('.hero .btn-row'),
      doc.querySelector('#quote .quote__send')
    ].filter(Boolean);

    // no observer, or nothing to clash with: the bar is simply always up
    if (!rivals.length || !window.IntersectionObserver) {
      bar.classList.add('is-on');
      return;
    }

    var onScreen = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = rivals.indexOf(e.target);
        if (i > -1) onScreen[i] = e.isIntersecting;
      });
      var clash = onScreen.some(Boolean);
      bar.classList.toggle('is-on', !clash);
    });
    rivals.forEach(function (r) { io.observe(r); });
  }

  // the quote form is the page's transaction, not an animation: it is wired up
  // before the reduced-motion bail-out so it works with every effect switched off
  quoteForm();
  stickyBar();

  if (reduce || !hasGSAP) {
    body.classList.remove('is-loading');
    $$('[data-count]').forEach(function (el) { el.textContent = '100'; });
    $$('[data-step]').forEach(function (s) { s.classList.add('is-active'); });
    // anchor links still need to work
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var canSplit = typeof window.SplitText !== 'undefined';
  if (canSplit) gsap.registerPlugin(SplitText);

  /* ---------------- Lenis <-> ScrollTrigger ---------------- */

  var lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      syncTouch: false
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  // in-page anchors through Lenis
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var t = doc.querySelector(id);
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -70, duration: 1.2 });
      else t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------------- loader ---------------- */

  function runLoader(done) {
    var loader = $('.loader');
    if (!loader) { done(); return; }
    var num = $('[data-count]', loader);
    var bar = $('.loader__bar', loader);
    var o = { v: 0 };

    var tl = gsap.timeline({
      onComplete: function () {
        body.classList.remove('is-loading');
        loader.style.display = 'none';
        done();
      }
    });

    tl.to(o, {
      v: 100, duration: 1.15, ease: 'power2.inOut',
      onUpdate: function () { if (num) num.textContent = Math.round(o.v); }
    }, 0)
      .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.15, ease: 'power2.inOut' }, 0)
      .to([num, $('.loader__word', loader)], { y: -28, opacity: 0, duration: .45, ease: 'power2.in' }, 1.2)
      .to(loader, { yPercent: -100, duration: .85, ease: 'expo.inOut' }, 1.35);
  }

  /* ---------------- magnetic buttons ---------------- */

  if (!coarse) {
    $$('[data-magnetic]').forEach(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
      var my = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.32);
        my((e.clientY - (r.top + r.height / 2)) * 0.42);
      });
      el.addEventListener('mouseleave', function () { mx(0); my(0); });
    });
  }

  /* ---------------- scroll progress ---------------- */

  gsap.to('.progress', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: .25 }
  });

  /* ---------------- headline line reveals ---------------- */

  function lineReveals() {
    $$('.reveal-line > span').forEach(function (span) {
      gsap.set(span, { yPercent: 110 });
    });

    $$('h1, h2').forEach(function (h) {
      var spans = $$('.reveal-line > span', h);
      if (!spans.length) return;
      gsap.to(spans, {
        yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: .09,
        scrollTrigger: { trigger: h, start: 'top 88%', once: true }
      });
    });
  }

  /* ---------------- paragraph line reveals (SplitText) ---------------- */

  function paraReveals() {
    if (!canSplit) return;
    $$('.lead, .hero__lead').forEach(function (p) {
      try {
        var split = new SplitText(p, { type: 'lines', linesClass: 'sline' });
        gsap.set(p, { opacity: 1 });
        gsap.from(split.lines, {
          yPercent: 60, opacity: 0, duration: .9, ease: 'power3.out', stagger: .055,
          scrollTrigger: { trigger: p, start: 'top 90%', once: true }
        });
      } catch (err) { /* leave the paragraph as plain text */ }
    });
  }

  /* ---------------- generic fade-ups ---------------- */

  function fades() {
    $$('[data-fade]').forEach(function (el) {
      // skip anything already animated elsewhere — a second gsap.from() on the same
      // element records opacity:0 as its end value and the element never reappears.
      if (el.classList.contains('lead') || el.classList.contains('hero__lead')) return;
      if (el.closest('.hero')) return;                 // hero entrance timeline owns these
      gsap.from(el, {
        y: 34, opacity: 0, duration: .95, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true }
      });
    });

    var railBox = $('[data-rail]');
    if (railBox) {
      gsap.from(railBox, {
        y: 40, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: railBox, start: 'top 90%', once: true }
      });
    }
  }

  /* ---------------- clip-path image reveals + parallax ---------------- */

  function images() {
    $$('[data-clip]').forEach(function (box) {
      var img = $('img', box);
      gsap.fromTo(box,
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out',
          scrollTrigger: { trigger: box, start: 'top 86%', once: true }
        });
      if (img) {
        gsap.fromTo(img, { scale: 1.35 }, {
          scale: 1, duration: 1.6, ease: 'expo.out',
          scrollTrigger: { trigger: box, start: 'top 86%', once: true }
        });
        // drift while in view
        gsap.fromTo(img, { yPercent: -5 }, {
          yPercent: 5, ease: 'none',
          scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      }
      box.addEventListener('mouseenter', function () { if (img) gsap.to(img, { scale: 1.045, duration: .7, ease: 'power3' }); });
      box.addEventListener('mouseleave', function () { if (img) gsap.to(img, { scale: 1, duration: .7, ease: 'power3' }); });
    });

    var band = $('[data-band-img]');
    if (band) {
      gsap.fromTo(band, { yPercent: -14 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
  }

  /* ---------------- marquee ---------------- */

  function marquee() {
    var box = $('[data-marquee]');
    if (!box) return;
    var first = $('.marquee__row', box);
    if (!first) return;

    var w = first.getBoundingClientRect().width;
    if (!w) return;
    var copies = Math.ceil((window.innerWidth * 2) / w) + 1;
    for (var i = 0; i < copies; i++) box.appendChild(first.cloneNode(true));

    var rows = $$('.marquee__row', box);
    var tween = gsap.to(rows, {
      x: -w, duration: w / 90, ease: 'none', repeat: -1
    });

    var proxy = { skew: 0 };
    var setSkew = gsap.quickSetter(rows, 'skewX', 'deg');
    var clamp = gsap.utils.clamp(-14, 14);

    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = self.getVelocity();
        var s = clamp(v / 220);
        if (Math.abs(s) > Math.abs(proxy.skew)) {
          proxy.skew = s;
          gsap.to(tween, { timeScale: gsap.utils.clamp(1, 5, 1 + Math.abs(v) / 900), duration: .3, overwrite: true });
          gsap.to(proxy, {
            skew: 0, duration: .7, ease: 'power3',
            overwrite: true,
            onUpdate: function () { setSkew(proxy.skew); },
            onComplete: function () { gsap.to(tween, { timeScale: 1, duration: .6 }); }
          });
        }
      }
    });
  }

  /* ---------------- services rail ----------------
     Runs itself, pauses to be read, drags, and hurries along with the scroll. */

  function rail() {
    var box = $('[data-rail]');
    var track = $('[data-rail-track]');
    if (!box || !track) return;

    var cards = $$('.scard', track);
    if (!cards.length) return;

    var gap = parseFloat(getComputedStyle(track).gap) || 0;
    // One cycle is every card plus one gap each, so a clone starts exactly where
    // the original set did and the loop has no seam.
    var cycle = cards.reduce(function (a, c) { return a + c.getBoundingClientRect().width; }, 0)
              + cards.length * gap;
    if (!cycle) return;

    var need = Math.ceil((box.clientWidth + cycle) / cycle) + 1;
    for (var n = 0; n < need; n++) {
      cards.forEach(function (c) {
        var clone = c.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        $$('img', clone).forEach(function (im) { im.setAttribute('alt', ''); });
        track.appendChild(clone);
      });
    }

    if (window.__glassRedress) window.__glassRedress();

    var wrapX = gsap.utils.wrap(-cycle, 0);
    var setX = gsap.quickSetter(track, 'x', 'px');
    var pos = 0;
    var SPEED = 0.042;                 // px per millisecond
    var mult = 1, multTarget = 1;
    var paused = false, dragging = false, onScreen = true;

    gsap.ticker.add(function (time, delta) {
      multTarget += (1 - multTarget) * 0.05;
      mult += (multTarget - mult) * 0.12;
      if (!dragging && !paused && onScreen) pos -= SPEED * delta * mult;
      pos = wrapX(pos);
      setX(pos);
    });

    box.addEventListener('pointerenter', function () { paused = true; });
    box.addEventListener('pointerleave', function () { paused = false; });
    box.addEventListener('focusin', function () { paused = true; });
    box.addEventListener('focusout', function () { paused = false; });

    new IntersectionObserver(function (es) {
      es.forEach(function (e) { onScreen = e.isIntersecting; });
    }, { rootMargin: '150px' }).observe(box);

    var startX = 0, startPos = 0;
    box.addEventListener('pointerdown', function (e) {
      dragging = true; startX = e.clientX; startPos = pos;
      box.classList.add('is-dragging');
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
    });
    box.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      pos = wrapX(startPos + (e.clientX - startX));
      setX(pos);
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      box.classList.remove('is-dragging');
      try { box.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);

    function nudge(dir) {
      var step = cards[0].getBoundingClientRect().width + gap;
      var proxy = { v: pos };
      paused = true;
      gsap.to(proxy, {
        v: pos + dir * step, duration: .75, ease: 'power3.out',
        onUpdate: function () { pos = wrapX(proxy.v); setX(pos); },
        onComplete: function () { paused = false; }
      });
    }
    var prev = $('[data-rail-prev]'), next = $('[data-rail-next]');
    if (prev) prev.addEventListener('click', function () { nudge(1); });
    if (next) next.addEventListener('click', function () { nudge(-1); });

    ScrollTrigger.create({
      onUpdate: function (self) {
        multTarget = gsap.utils.clamp(1, 4.5, 1 + Math.abs(self.getVelocity()) / 900);
      }
    });
  }

  /* ---------------- process steps ---------------- */

  function process() {
    var steps = $$('[data-step]');
    var media = $('[data-proc-media]');
    var shots = media ? $$('img', media) : [];

    steps.forEach(function (step, i) {
      var bar = $('.step__bar i', step);

      function light() {
        steps.forEach(function (s) { s.classList.remove('is-active'); });
        step.classList.add('is-active');
        shots.forEach(function (img, j) { img.classList.toggle('is-on', j === i); });
      }
      // onEnter/onEnterBack only: the step you last passed stays lit, so the
      // section never ends with every step greyed out.
      ScrollTrigger.create({
        trigger: step,
        start: 'top 68%',
        end: 'bottom 45%',
        onEnter: light,
        onEnterBack: light
      });

      if (bar) {
        gsap.fromTo(bar, { scaleX: 0 }, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: step, start: 'top 72%', end: 'bottom 55%', scrub: .4 }
        });
      }
    });

    if (steps[0]) steps[0].classList.add('is-active');
  }

  /* ---------------- supply band background grid (2D canvas) ---------------- */

  function supplyGrid() {
    var cv = doc.getElementById('grid-canvas');
    if (!cv) return;
    var ctx = cv.getContext('2d', { alpha: true });
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = 0, H = 0, cols = 0, rows = 0, gap = 34;
    var running = false, raf = 0, t = 0;

    function size() {
      var r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = W < 700 ? 26 : 34;
      cols = Math.ceil(W / gap) + 1;
      rows = Math.ceil(H / gap) + 1;
    }

    function frame() {
      if (!running) return;
      t += 0.012;
      ctx.clearRect(0, 0, W, H);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var px = x * gap, py = y * gap;
          var wave = Math.sin((px * 0.012) + (py * 0.016) - t * 1.7);
          var a = (wave + 1) / 2;                   // 0..1
          var r = 0.9 + a * 1.5;
          if (a > 0.88) {
            ctx.fillStyle = 'rgba(255,122,61,' + (a * 0.85) + ')';
          } else {
            ctx.fillStyle = 'rgba(76,125,196,' + (0.12 + a * 0.44) + ')';
          }
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    size();
    window.addEventListener('resize', function () { size(); }, { passive: true });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !running) { running = true; size(); frame(); }
        else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
      });
    }, { rootMargin: '120px' });
    io.observe(cv);
  }

  /* ---------------- quote form -> WhatsApp ---------------- */
  /* This client has no email address and the site has no backend, so the form
     composes the enquiry into one WhatsApp message and opens it. Everything the
     quote needs arrives together, and it works on any static host. */
  function quoteForm() {
    var form = doc.querySelector('[data-quote]');
    if (!form) return;
    var phone = form.getAttribute('data-wa');
    var FIELDS = [
      ['job', 'Job'], ['where', 'Where'], ['size', 'Size'],
      ['name', 'Name'], ['detail', 'Details']
    ];
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var lines = ['Quote request from the website', ''];
      FIELDS.forEach(function (f) {
        var v = (data.get(f[0]) || '').toString().trim();
        if (v) lines.push(f[1] + ': ' + v);
      });
      var text = encodeURIComponent(lines.join('\n'));
      window.open('https://wa.me/' + phone + '?text=' + text, '_blank', 'noopener');
    });
  }

  /* ---------------- boot ---------------- */

  function boot() {
    lineReveals();
    paraReveals();
    fades();
    images();
    marquee();
    rail();
    process();
    supplyGrid();
    ScrollTrigger.refresh();

    // hero entrance
    var tl = gsap.timeline({ delay: .05 });
    tl.to('.hero h1 .reveal-line > span', { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: .1 }, 0)
      .from('.hero__side > *', { y: 30, opacity: 0, duration: .9, ease: 'power3.out', stagger: .09 }, .25)
      .from('.nav .wrap > *', { y: -22, opacity: 0, duration: .7, ease: 'power3.out', stagger: .07 }, .1)
      .from('.hero__cue', { opacity: 0, duration: .6 }, .9);
  }

  function start() {
    if (lenis) lenis.stop();
    runLoader(function () {
      if (lenis) lenis.start();
      boot();
    });
  }

  if (doc.fonts && doc.fonts.ready) {
    doc.fonts.ready.then(start).catch(start);
  } else {
    window.addEventListener('load', start);
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
