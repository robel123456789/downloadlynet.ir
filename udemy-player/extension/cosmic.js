// Cosmic background: 3-layer parallax starfield, twinkling, shooting stars, drifting dust.
// Also injects the shared SVG gradient (#cx-grad) used by the timer rings.
// Lightweight by design: capped DPR, ~30fps, pauses when the tab is hidden, honours reduced-motion.
(function () {
  if (window.__cosmic) return;
  window.__cosmic = true;

  function boot() {
    var d = document, b = d.body;
    if (!b) return;

    // shared gradient for ring strokes etc.
    var NS = 'http://www.w3.org/2000/svg';
    var defs = d.createElementNS(NS, 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs.innerHTML = '<defs><linearGradient id="cx-grad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop id="cx-s0" offset="0" stop-color="#a590ff"/><stop id="cx-s1" offset=".55" stop-color="#5b8bff"/>' +
      '<stop id="cx-s2" offset="1" stop-color="#38e1ff"/></linearGradient></defs>';
    function paintGrad() {
      var P = window.__zdPal; if (!P) return;
      var a = d.getElementById('cx-s0'), m = d.getElementById('cx-s1'), z = d.getElementById('cx-s2');
      if (a) a.setAttribute('stop-color', P.acc); if (m) m.setAttribute('stop-color', P.mid); if (z) z.setAttribute('stop-color', P.acc2);
    }
    paintGrad();
    b.insertBefore(defs, b.firstChild);

    var aurora = d.createElement('div'); aurora.id = 'cx-aurora'; aurora.setAttribute('aria-hidden', 'true');
    var cv = d.createElement('canvas'); cv.id = 'cx-sky'; cv.setAttribute('aria-hidden', 'true');
    b.insertBefore(cv, b.firstChild); b.insertBefore(aurora, b.firstChild);

    var ctx = cv.getContext('2d');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var stars = [], dust = [], shooters = [];
    var mx = 0, my = 0, tx = 0, ty = 0;
    var DEF_COLORS = ['255,255,255', '200,190,255', '160,225,255', '255,205,240', '255,230,170'];
    var DEF_DUST = ['124,92,255', '56,225,255', '255,95,210'];
    var COLORS = DEF_COLORS, DUST = DEF_DUST;
    function readPal() {
      var P = window.__zdPal || {};
      COLORS = P.stars && P.stars.length ? P.stars : DEF_COLORS;
      DUST = P.dust && P.dust.length ? P.dust : DEF_DUST;
    }
    readPal();

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function seed() {
      var area = W * H, n = Math.max(90, Math.min(260, Math.round(area / 7500)));
      stars = [];
      for (var i = 0; i < n; i++) {
        var layer = i % 3; // 0 far, 1 mid, 2 near
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: [rnd(.3, .7), rnd(.5, 1.0), rnd(.8, 1.7)][layer],
          z: [.012, .03, .065][layer],
          a: rnd(.35, 1), tw: rnd(.4, 2.2), ph: rnd(0, 6.28),
          c: COLORS[(Math.random() * COLORS.length) | 0]
        });
      }
      dust = [];
      for (var j = 0; j < 7; j++) {
        dust.push({
          x: Math.random() * W, y: Math.random() * H, r: rnd(180, 380),
          vx: rnd(-.05, .05), vy: rnd(-.03, .03),
          c: DUST[j % 3], a: rnd(.035, .08)
        });
      }
    }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
      if (reduce) frame(0);
    }

    function spawnShooter() {
      var fromLeft = Math.random() < .5, sp = rnd(7, 12);
      shooters.push({
        x: fromLeft ? rnd(-50, W * .5) : rnd(W * .5, W + 50), y: rnd(-20, H * .45),
        vx: (fromLeft ? 1 : -1) * sp, vy: sp * rnd(.35, .6), life: 1
      });
    }

    var last = 0, nextShoot = 2500, t0 = performance.now();
    function frame(now) {
      var dt = Math.min(64, now - last); last = now;
      var t = (now - t0) / 1000;
      tx += (mx - tx) * .05; ty += (my - ty) * .05;
      ctx.clearRect(0, 0, W, H);

      // nebula dust
      for (var i = 0; i < dust.length; i++) {
        var p = dust[i];
        if (!reduce) { p.x += p.vx * dt * .06; p.y += p.vy * dt * .06; }
        if (p.x < -p.r) p.x = W + p.r; else if (p.x > W + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = H + p.r; else if (p.y > H + p.r) p.y = -p.r;
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(' + p.c + ',' + p.a + ')'); g.addColorStop(1, 'rgba(' + p.c + ',0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }

      // stars (parallax with cursor, slow upward drift)
      for (var k = 0; k < stars.length; k++) {
        var s = stars[k];
        if (!reduce) { s.y -= s.z * dt * .12; if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; } }
        var sx = s.x - tx * s.z * 60, sy = s.y - ty * s.z * 60;
        var tw = reduce ? 1 : .6 + .4 * Math.sin(t * s.tw + s.ph);
        var al = s.a * tw;
        ctx.fillStyle = 'rgba(' + s.c + ',' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, 6.2832); ctx.fill();
        if (s.r > 1.25) { // glow + cross-flare on the brightest ones
          ctx.fillStyle = 'rgba(' + s.c + ',' + (al * .12).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(sx, sy, s.r * 4, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = 'rgba(' + s.c + ',' + (al * .35).toFixed(3) + ')'; ctx.lineWidth = .6;
          ctx.beginPath(); ctx.moveTo(sx - s.r * 4, sy); ctx.lineTo(sx + s.r * 4, sy);
          ctx.moveTo(sx, sy - s.r * 4); ctx.lineTo(sx, sy + s.r * 4); ctx.stroke();
        }
      }

      // shooting stars
      if (!reduce) {
        nextShoot -= dt;
        if (nextShoot <= 0) { spawnShooter(); nextShoot = rnd(3500, 9000); }
        for (var m = shooters.length - 1; m >= 0; m--) {
          var o = shooters[m];
          o.x += o.vx * dt * .06 * 4; o.y += o.vy * dt * .06 * 4; o.life -= dt / 1100;
          if (o.life <= 0 || o.x < -200 || o.x > W + 200 || o.y > H + 100) { shooters.splice(m, 1); continue; }
          var L = 110, nx = o.vx, ny = o.vy, n = Math.sqrt(nx * nx + ny * ny);
          var x2 = o.x - nx / n * L, y2 = o.y - ny / n * L;
          var lg = ctx.createLinearGradient(o.x, o.y, x2, y2);
          lg.addColorStop(0, 'rgba(255,255,255,' + (.9 * o.life).toFixed(3) + ')');
          lg.addColorStop(.3, 'rgba(160,225,255,' + (.45 * o.life).toFixed(3) + ')');
          lg.addColorStop(1, 'rgba(124,92,255,0)');
          ctx.strokeStyle = lg; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(x2, y2); ctx.stroke();
        }
      }
    }

    // ~30fps loop, paused when hidden
    var raf = 0, acc = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      acc += now - (loop.p || now); loop.p = now;
      if (acc < 30) return; acc = 0;
      frame(now);
    }
    function isCosmic() { return d.documentElement.getAttribute('data-theme') === 'cosmic'; }
    function start() { if (!raf && !reduce && isCosmic() && !d.hidden) { loop.p = 0; last = performance.now(); raf = requestAnimationFrame(loop); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    window.addEventListener('zd-colors', function () { readPal(); paintGrad(); seed(); });
    window.addEventListener('resize', resize);
    d.addEventListener('visibilitychange', function () { d.hidden ? stop() : start(); });
    window.addEventListener('mousemove', function (e) {
      mx = (e.clientX / W - .5) * 2; my = (e.clientY / H - .5) * 2;
    }, { passive: true });

    // Dark theme = no stars: stop the loop; Cosmic = (re)start it
    new MutationObserver(function () { if (isCosmic()) { resize(); start(); } else stop(); })
      .observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize(); start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
