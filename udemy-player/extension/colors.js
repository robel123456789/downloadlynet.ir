// Colors & Background settings — shared by planner, library, player and popup.
// Every color is editable per theme (dark / cosmic). Saved in localStorage (+ mirrored to chrome.storage).
// Works by setting CSS variables on <html>; the stylesheets read them with built-in fallbacks,
// so anything you leave untouched keeps the theme's original look.
(function () {
  'use strict';
  if (window.__zdColors) return;
  window.__zdColors = true;

  var K = 'zd:colors', KIMG = 'zd:bgimg';
  var root = document.documentElement;

  // ---------- defaults shown in the pickers (match the stylesheets) ----------
  var D = {
    cosmic: {
      acc: '#8f78ff', acc2: '#38e1ff', acc3: '#ff5fd2',
      ok: '#00f5b4', warn: '#ffd166', err: '#ff5f72', info: '#4fc3f7',
      text: '#f1efff', text2: '#c3bfe6', muted: '#9a95c8', faint: '#4a4a70',
      panel: '#12102a', card: '#1e1a46', card2: '#3c3282', border: '#aa96ff',
      onacc: '#07051a', t1: '#c9bcff', t2: '#7fe9ff', t3: '#ffb3ec', star: '#ffffff',
      bg1: '#05040f', bg2: '#080616', panelA: 0.42, bgAngle: 160, bgDim: 0.35
    },
    dark: {
      acc: '#9a8cff', acc2: '#38e1ff', acc3: '#ff5fd2',
      ok: '#34d399', warn: '#fbbf24', err: '#f87171', info: '#60a5fa',
      text: '#ececf1', text2: '#a3a3ad', muted: '#74747f', faint: '#4a4a52',
      panel: '#070709', card: '#0c0c0f', card2: '#131317', border: '#ffffff',
      onacc: '#000000', btn: '#f2f2f5',
      bg1: '#000000', bg2: '#0b0b12', bgAngle: 160, bgDim: 0.35
    }
  };

  // ---------- groups rendered in the panel ----------
  var GROUPS = [
    { title: 'Accent', rows: [
      ['acc', 'Main accent'], ['acc2', 'Accent 2 · gradients & rings'], ['acc3', 'Accent 3 · glow']] },
    { title: 'Status', rows: [
      ['ok', 'Success / done'], ['warn', 'Warning'], ['err', 'Error / delete'], ['info', 'Info']] },
    { title: 'Text', rows: [
      ['text', 'Main text'], ['text2', 'Secondary text'], ['muted', 'Muted text'], ['faint', 'Faint text']] },
    { title: 'Surfaces', rows: [
      ['panel', 'Panels & sidebars'], ['card', 'Cards'], ['card2', 'Raised cards'], ['border', 'Borders']] },
    { title: 'Buttons & headings', rows: [
      ['onacc', 'Text on buttons'], ['btn', 'Primary button', 'dark'],
      ['t1', 'Heading gradient 1', 'cosmic'], ['t2', 'Heading gradient 2', 'cosmic'], ['t3', 'Heading gradient 3', 'cosmic']] }
  ];

  var PRESETS = [
    { n: 'Default', sw: ['#8f78ff', '#38e1ff', '#05040f'], c: {} },
    { n: 'Midnight', sw: ['#5b8bff', '#38e1ff', '#071330'], bgMode: 'gradient',
      c: { acc: '#5b8bff', acc2: '#38e1ff', acc3: '#a78bfa', panel: '#0b1530', card: '#14234a', card2: '#1d3366', border: '#7aa2ff', bg1: '#020617', bg2: '#0b1b3a' } },
    { n: 'Aurora', sw: ['#34d399', '#38bdf8', '#04201c'], bgMode: 'gradient',
      c: { acc: '#34d399', acc2: '#38bdf8', acc3: '#a78bfa', panel: '#06241f', card: '#0b3b33', card2: '#115247', border: '#6ee7b7', bg1: '#02140f', bg2: '#052e2b', t1: '#a7f3d0', t2: '#bae6fd', t3: '#ddd6fe' } },
    { n: 'Sunset', sw: ['#ff7a59', '#ffb347', '#2a0f1f'], bgMode: 'gradient',
      c: { acc: '#ff7a59', acc2: '#ffb347', acc3: '#ff5fa2', panel: '#2a0f1f', card: '#451a30', card2: '#612444', border: '#ffa38a', bg1: '#1a0a14', bg2: '#3b0f2a', onacc: '#2a0f1f', t1: '#ffd0bf', t2: '#ffe0b0', t3: '#ffc0dc' } },
    { n: 'Rose', sw: ['#ff6ba6', '#c084fc', '#1c0816'], bgMode: 'gradient',
      c: { acc: '#ff6ba6', acc2: '#c084fc', acc3: '#ffc2e0', panel: '#2a0c22', card: '#431436', card2: '#5c1c4a', border: '#ff9ac6', bg1: '#1a0612', bg2: '#2b0a22', t1: '#ffc2e0', t2: '#e9d5ff', t3: '#fbcfe8' } },
    { n: 'Mono', sw: ['#e5e7eb', '#9ca3af', '#0a0a0a'], bgMode: 'solid',
      c: { acc: '#e5e7eb', acc2: '#9ca3af', acc3: '#6b7280', panel: '#0a0a0a', card: '#141414', card2: '#1c1c1c', border: '#ffffff', bg1: '#000000', bg2: '#111111', onacc: '#000000', t1: '#ffffff', t2: '#d1d5db', t3: '#9ca3af' } },
    { n: 'Ocean', sw: ['#22d3ee', '#3b82f6', '#06202b'], bgMode: 'gradient',
      c: { acc: '#22d3ee', acc2: '#3b82f6', acc3: '#2dd4bf', panel: '#06202b', card: '#0b3547', card2: '#114b63', border: '#67e8f9', bg1: '#021018', bg2: '#06283a', onacc: '#031018', t1: '#a5f3fc', t2: '#bfdbfe', t3: '#99f6e4' } }
  ];

  // ---------- helpers ----------
  function isHex(v) { return /^#[0-9a-f]{6}$/i.test(v || ''); }
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function toHex(a) { return '#' + a.map(function (n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }).join(''); }
  function trip(h) { return rgb(h).join(','); }
  function rgba(h, a) { return 'rgba(' + trip(h) + ',' + a + ')'; }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function theme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'cosmic'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- state ----------
  var cfg = { dark: {}, cosmic: {} };
  var img = null; // background image data-URL (shared by both themes)
  function load() {
    try { var j = JSON.parse(localStorage.getItem(K) || 'null'); if (j && typeof j === 'object') { cfg = { dark: j.dark || {}, cosmic: j.cosmic || {} }; return true; } } catch (e) { }
    return false;
  }
  var saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var s = JSON.stringify(cfg);
      try { localStorage.setItem(K, s); } catch (e) { }
      try { if (window.chrome && chrome.storage) { var o = {}; o[K] = s; chrome.storage.local.set(o); } } catch (e) { }
    }, 200);
  }
  function setImg(v) {
    img = v;
    try { if (window.chrome && chrome.storage) { if (v) { var o = {}; o[KIMG] = v; chrome.storage.local.set(o); } else chrome.storage.local.remove(KIMG); } } catch (e) { }
  }

  // ---------- apply ----------
  var applied = [];
  function sv(n, v) { root.style.setProperty(n, v); applied.push(n); }
  var styleEl = null;
  function ensureStyle() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'zd-colors-style'; }
    var host = document.head || root;
    if (styleEl.parentNode !== host || host.lastElementChild !== styleEl) host.appendChild(styleEl);
  }

  function apply() {
    var t = theme(), c = cfg[t] || {}, d = D[t];
    applied.forEach(function (n) { root.style.removeProperty(n); }); applied = [];
    function has(k) { return isHex(c[k]); }
    function g(k) { return has(k) ? c[k] : d[k]; }

    // accents + status (flow through --zd-* fallbacks wired into every stylesheet)
    if (has('acc') || has('acc2')) { sv('--zd-accmid', mix(g('acc'), g('acc2'), 0.5)); }
    ['acc', 'acc2', 'acc3', 'ok', 'warn', 'err'].forEach(function (k) {
      if (has(k)) { sv('--zd-' + k, c[k]); sv('--zd-' + k + '-rgb', trip(c[k])); }
    });
    if (has('info')) sv('--blue', c.info);

    // text
    if (has('text')) { sv('--text', c.text); sv('--tx', c.text); sv('--text-primary', c.text); }
    if (has('text2')) sv('--text-secondary', c.text2);
    if (has('muted')) { sv('--muted', c.muted); sv('--mu', c.muted); sv('--text-muted', c.muted); }
    if (has('faint')) sv('--muted2', c.faint);

    // borders
    if (has('border')) {
      var a1 = t === 'dark' ? 0.07 : 0.20, a2 = t === 'dark' ? 0.14 : 0.38;
      ['--border', '--line', '--border-default'].forEach(function (n) { sv(n, rgba(c.border, a1)); });
      ['--border2', '--border-strong'].forEach(function (n) { sv(n, rgba(c.border, a2)); });
      if (t === 'cosmic') { sv('--cx-edge', rgba(c.border, a1)); sv('--cx-edge-hi', rgba(c.border, a2)); }
    }

    // surfaces
    if (t === 'cosmic') {
      var pa = typeof c.panelA === 'number' ? c.panelA : d.panelA;
      if (has('panel') || typeof c.panelA === 'number') {
        var p = g('panel');
        sv('--cx-glass', rgba(p, pa)); sv('--cx-glass-hi', rgba(p, Math.min(pa + 0.16, 0.95)));
        sv('--surface', rgba(p, pa)); sv('--bg-elevated', rgba(p, pa));
        sv('--zd-nav', rgba(p, Math.min(pa + 0.1, 0.92)));
        sv('--zd-input', rgba(mix(p, '#000000', 0.4), 0.5));
        sv('--zd-input-focus', rgba(mix(p, g('acc'), 0.18), 0.68));
      }
      if (has('card') || typeof c.panelA === 'number') {
        var cd = g('card');
        sv('--zd-inner', rgba(cd, Math.min(pa * 0.76 + 0.02, 0.9)));
        sv('--card', rgba(cd, Math.min(pa * 0.9 + 0.02, 0.92))); sv('--bg-surface', rgba(cd, Math.min(pa * 0.86 + 0.02, 0.92)));
      }
      if (has('card2') || typeof c.panelA === 'number') {
        var c2 = g('card2');
        sv('--card2', rgba(c2, Math.min(pa * 0.8 + 0.02, 0.9))); sv('--bg-surface-2', rgba(c2, Math.min(pa * 0.9 + 0.02, 0.92)));
      }
      if (has('t1')) sv('--zd-t1', c.t1); if (has('t2')) sv('--zd-t2', c.t2); if (has('t3')) sv('--zd-t3', c.t3);
    } else {
      if (has('panel')) { sv('--surface', c.panel); sv('--bg-elevated', c.panel); }
      if (has('card')) { sv('--card', c.card); sv('--bg-surface', c.card); }
      if (has('card2')) { sv('--card2', c.card2); sv('--bg-surface-2', c.card2); }
      if (has('btn')) { sv('--btn-primary-bg', c.btn); sv('--btn-primary-bg-hover', mix(c.btn, '#808080', 0.15)); }
    }
    if (has('onacc')) { sv('--zd-onacc', c.onacc); sv('--btn-primary-text', c.onacc); }

    // page background
    var mode = c.bgMode || 'default', css = '', sel = 'html[data-theme="' + t + '"]';
    var b1 = g('bg1'), b2 = g('bg2');
    if (mode !== 'default') {
      var bgv = null;
      if (mode === 'solid') bgv = 'linear-gradient(' + b1 + ',' + b1 + ')';
      else if (mode === 'gradient') bgv = 'linear-gradient(' + (typeof c.bgAngle === 'number' ? c.bgAngle : d.bgAngle) + 'deg,' + b1 + ',' + b2 + ')';
      else if (mode === 'image' && img) {
        var dm = typeof c.bgDim === 'number' ? c.bgDim : d.bgDim;
        bgv = 'linear-gradient(rgba(0,0,0,' + dm + '),rgba(0,0,0,' + dm + ')),url("' + img + '")';
      }
      if (bgv) {
        css += sel + '{background:' + bgv + '!important;background-color:' + b1 + '!important;background-attachment:fixed!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important}';
        css += sel + ' body{background:transparent!important}';
        if (t === 'dark') { sv('--bg', b1); sv('--bg-base', b1); }
      }
    }
    if (t === 'cosmic') {
      if (c.stars === false) css += sel + ' #cx-sky{display:none!important}';
      if (c.aurora === false) css += sel + ' #cx-aurora{display:none!important}';
    }
    ensureStyle(); styleEl.textContent = css;

    // palette for the canvas starfield + ring gradient
    var accOn = has('acc') || has('acc2') || has('acc3');
    window.__zdPal = {
      acc: g('acc'), acc2: g('acc2'), mid: has('acc') || has('acc2') ? mix(g('acc'), g('acc2'), 0.5) : '#5b8bff',
      stars: has('star') ? ['255,255,255', trip(c.star), trip(c.star)] : null,
      dust: accOn ? [trip(g('acc')), trip(g('acc2')), trip(g('acc3'))] : null
    };
    if (!(has('acc') || has('acc2'))) { window.__zdPal.acc = '#a590ff'; window.__zdPal.acc2 = '#38e1ff'; }
    try { window.dispatchEvent(new Event('zd-colors')); } catch (e) { }
  }

  // ---------- boot (before first paint) ----------
  var hadLocal = load();
  apply();
  try {
    if (window.chrome && chrome.storage) {
      chrome.storage.local.get([K, KIMG], function (v) {
        if (!hadLocal && v && v[K]) { try { var j = JSON.parse(v[K]); cfg = { dark: j.dark || {}, cosmic: j.cosmic || {} }; try { localStorage.setItem(K, v[K]); } catch (e) { } } catch (e) { } }
        if (v && v[KIMG]) img = v[KIMG];
        apply();
      });
      chrome.storage.onChanged.addListener(function (ch, area) {
        if (area !== 'local') return;
        if (ch[KIMG]) { img = ch[KIMG].newValue || null; apply(); }
      });
    }
  } catch (e) { }
  window.addEventListener('storage', function (e) { if (e.key === K) { load(); apply(); if (open) render(); } });
  new MutationObserver(function () { apply(); if (open) render(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('DOMContentLoaded', function () { ensureStyle(); injectButtons(); });

  // ================= UI =================
  var open = false, panel = null;
  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>';

  function injectButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      if (b.nextElementSibling && b.nextElementSibling.hasAttribute('data-zd-paint')) return;
      var n = document.createElement('button');
      n.className = b.className; n.setAttribute('data-zd-paint', ''); n.type = 'button';
      n.title = 'Colors & background'; n.setAttribute('aria-label', 'Colors & background');
      n.innerHTML = ICON + (b.classList.contains('hbtn') ? '&nbsp;COLORS' : '');
      n.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      b.parentNode.insertBefore(n, b.nextSibling);
    });
  }

  var CSS = '' +
    '#zd-cp{position:fixed;top:0;right:0;bottom:0;width:372px;max-width:100vw;z-index:2147483000;background:#0e0e15;color:#ececf4;' +
    'font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;border-left:1px solid #2a2a3a;box-shadow:-18px 0 60px rgba(0,0,0,.6)}' +
    '#zd-cp *{box-sizing:border-box}' +
    '#zd-cp .h{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #23232f}' +
    '#zd-cp .h b{font-size:15px;flex:1}' +
    '#zd-cp .x{background:none;border:0;color:#aaa;font-size:20px;cursor:pointer;padding:2px 8px;border-radius:8px}#zd-cp .x:hover{background:#1c1c28;color:#fff}' +
    '#zd-cp .b{flex:1;overflow:auto;padding:12px 16px 20px}' +
    '#zd-cp h4{margin:18px 0 8px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#8a8aa6;font-weight:600}' +
    '#zd-cp h4:first-child{margin-top:4px}' +
    '#zd-cp .seg{display:flex;gap:4px;background:#161620;padding:3px;border-radius:10px}' +
    '#zd-cp .seg button{flex:1;padding:7px 6px;border:0;border-radius:8px;background:none;color:#aeaec6;cursor:pointer;font:inherit}' +
    '#zd-cp .seg button.on{background:#2b2b40;color:#fff}' +
    '#zd-cp .pre{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}' +
    '#zd-cp .pr{border:1px solid #2a2a3a;background:#14141d;border-radius:10px;padding:6px;cursor:pointer;color:#cfcfe2;font:inherit;font-size:11px}' +
    '#zd-cp .pr:hover{border-color:#5a5a80}' +
    '#zd-cp .pr i{display:block;height:22px;border-radius:6px;margin-bottom:5px}' +
    '#zd-cp .r{display:flex;align-items:center;gap:8px;padding:5px 0}' +
    '#zd-cp .r label{flex:1;color:#d6d6e6}' +
    '#zd-cp input[type=color]{width:34px;height:26px;border:1px solid #33334a;border-radius:7px;background:none;padding:0;cursor:pointer}' +
    '#zd-cp input[type=text]{width:78px;background:#161620;border:1px solid #2a2a3a;border-radius:7px;color:#ddd;padding:4px 6px;font:12px ui-monospace,Consolas,monospace}' +
    '#zd-cp .rs{background:none;border:0;color:#6c6c88;cursor:pointer;font-size:14px;width:20px;padding:0}#zd-cp .rs:hover{color:#fff}#zd-cp .rs.off{visibility:hidden}' +
    '#zd-cp select{background:#161620;border:1px solid #2a2a3a;color:#ddd;border-radius:8px;padding:6px 8px;font:inherit;width:100%}' +
    '#zd-cp input[type=range]{flex:1;accent-color:#8f78ff}#zd-cp .v{width:38px;text-align:right;color:#9a9ab4;font-size:12px}' +
    '#zd-cp .chk{display:flex;align-items:center;gap:8px;padding:5px 0;color:#d6d6e6;cursor:pointer}' +
    '#zd-cp .btn{background:#1b1b28;border:1px solid #2f2f45;color:#e4e4f2;border-radius:9px;padding:7px 11px;cursor:pointer;font:inherit}#zd-cp .btn:hover{border-color:#6a6a9a}' +
    '#zd-cp .f{display:flex;gap:6px;flex-wrap:wrap;padding:11px 16px;border-top:1px solid #23232f}' +
    '#zd-cp .note{color:#7c7c98;font-size:12px;margin:4px 0 0}';

  function toggle() { open ? close() : openPanel(); }
  function close() { open = false; if (panel) { panel.remove(); panel = null; } document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function openPanel() {
    open = true; ensureUiStyle();
    panel = document.createElement('div'); panel.id = 'zd-cp'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Colors and background');
    document.body.appendChild(panel); document.addEventListener('keydown', onKey, true); render();
  }
  function ensureUiStyle() {
    if (document.getElementById('zd-cp-style')) return;
    var s = document.createElement('style'); s.id = 'zd-cp-style'; s.textContent = CSS; (document.head || root).appendChild(s);
  }

  function cur() { return cfg[theme()]; }
  function val(k) { var c = cur(); return isHex(c[k]) ? c[k] : D[theme()][k]; }
  function changed(k) { return isHex(cur()[k]); }
  function touch() { apply(); save(); }

  function render() {
    if (!panel) return;
    var t = theme(), c = cur(), d = D[t], h = '';
    h += '<div class="h"><b>Colors &amp; background</b><button class="x" data-a="close" aria-label="Close">×</button></div><div class="b">';
    h += '<h4>Editing theme</h4><div class="seg"><button data-a="theme" data-v="dark"' + (t === 'dark' ? ' class="on"' : '') + '>Dark</button><button data-a="theme" data-v="cosmic"' + (t === 'cosmic' ? ' class="on"' : '') + '>Cosmic</button></div>';
    h += '<p class="note">Each theme keeps its own colors. Changes apply instantly and are saved.</p>';

    h += '<h4>Presets</h4><div class="pre">' + PRESETS.map(function (p, i) {
      return '<button class="pr" data-a="preset" data-i="' + i + '"><i style="background:linear-gradient(135deg,' + p.sw[0] + ',' + p.sw[1] + ' 60%,' + p.sw[2] + ')"></i>' + p.n + '</button>';
    }).join('') + '</div>';

    // background
    var mode = c.bgMode || 'default';
    h += '<h4>Background</h4><select data-a="bgmode">' +
      [['default', 'Theme default'], ['solid', 'Solid color'], ['gradient', 'Gradient'], ['image', 'Image']].map(function (o) { return '<option value="' + o[0] + '"' + (mode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    if (mode === 'solid' || mode === 'gradient') h += colorRow('bg1', mode === 'solid' ? 'Background color' : 'Gradient start');
    if (mode === 'gradient') {
      h += colorRow('bg2', 'Gradient end');
      var an = typeof c.bgAngle === 'number' ? c.bgAngle : d.bgAngle;
      h += '<div class="r"><label>Angle</label><input type="range" min="0" max="360" step="5" value="' + an + '" data-a="num" data-k="bgAngle"><span class="v">' + an + '°</span></div>';
    }
    if (mode === 'image') {
      var dm = typeof c.bgDim === 'number' ? c.bgDim : d.bgDim;
      h += '<div class="r" style="margin-top:6px"><button class="btn" data-a="pickimg">Choose image…</button>' + (img ? '<button class="btn" data-a="rmimg">Remove</button>' : '') + '<span class="v" style="width:auto">' + (img ? 'image set' : 'none yet') + '</span></div>';
      h += '<div class="r"><label>Darken image</label><input type="range" min="0" max="0.9" step="0.05" value="' + dm + '" data-a="num" data-k="bgDim"><span class="v">' + Math.round(dm * 100) + '%</span></div>';
      h += '<p class="note">The image is saved inside the extension and is shared by both themes.</p>';
    }
    if (t === 'cosmic') {
      h += '<label class="chk"><input type="checkbox" data-a="flag" data-k="stars"' + (c.stars !== false ? ' checked' : '') + '> Animated stars</label>';
      h += '<label class="chk"><input type="checkbox" data-a="flag" data-k="aurora"' + (c.aurora !== false ? ' checked' : '') + '> Aurora glow</label>';
      h += colorRow('star', 'Star color');
      var pa = typeof c.panelA === 'number' ? c.panelA : d.panelA;
      h += '<div class="r"><label>Glass opacity</label><input type="range" min="0.05" max="0.9" step="0.01" value="' + pa + '" data-a="num" data-k="panelA"><span class="v">' + Math.round(pa * 100) + '%</span></div>';
    }

    GROUPS.forEach(function (g) {
      var rows = g.rows.filter(function (r) { return !r[2] || r[2] === t; });
      if (!rows.length) return;
      h += '<h4>' + g.title + '</h4>' + rows.map(function (r) { return colorRow(r[0], r[1]); }).join('');
    });
    h += '</div><div class="f"><button class="btn" data-a="reset">Reset this theme</button><button class="btn" data-a="export">Export</button><button class="btn" data-a="import">Import</button></div>';
    panel.innerHTML = h;
  }

  function colorRow(k, label) {
    var v = val(k);
    return '<div class="r"><label>' + label + '</label><input type="color" value="' + v + '" data-a="color" data-k="' + k + '"><input type="text" value="' + v + '" maxlength="7" spellcheck="false" data-a="hex" data-k="' + k + '"><button class="rs' + (changed(k) ? '' : ' off') + '" title="Reset to theme default" data-a="rs" data-k="' + k + '">↺</button></div>';
  }

  function setColor(k, v, row) {
    cur()[k] = v; touch();
    if (row) {
      var col = row.querySelector('[data-a=color]'), hx = row.querySelector('[data-a=hex]'), rs = row.querySelector('.rs');
      if (col && col.value !== v) col.value = v; if (hx && hx.value !== v) hx.value = v; if (rs) rs.classList.remove('off');
    }
  }

  document.addEventListener('input', function (e) {
    var el = e.target; if (!panel || !panel.contains(el)) return;
    var a = el.getAttribute('data-a'), k = el.getAttribute('data-k');
    if (a === 'color') setColor(k, el.value.toLowerCase(), el.closest('.r'));
    else if (a === 'hex') { var v = el.value.trim(); if (v[0] !== '#') v = '#' + v; if (isHex(v)) setColor(k, v.toLowerCase(), el.closest('.r')); }
    else if (a === 'num') {
      var n = parseFloat(el.value); cur()[k] = n; touch();
      var sp = el.parentNode.querySelector('.v'); if (sp) sp.textContent = k === 'bgAngle' ? n + '°' : Math.round(n * 100) + '%';
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!panel || !panel.contains(el)) return;
    var a = el.getAttribute('data-a'), k = el.getAttribute('data-k');
    if (a === 'bgmode') { cur().bgMode = el.value; touch(); render(); }
    else if (a === 'flag') { cur()[k] = el.checked; touch(); }
  });

  function fileDialog(accept, cb) {
    var f = document.createElement('input'); f.type = 'file'; f.accept = accept; f.style.display = 'none';
    f.addEventListener('change', function () { if (f.files && f.files[0]) cb(f.files[0]); f.remove(); });
    document.body.appendChild(f); f.click();
  }
  function shrink(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var M = 2200, w = im.width, h = im.height, s = Math.min(1, M / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.86));
      };
      im.onerror = function () { alert('Could not read that image.'); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-a]') : null; if (!el || !panel || !panel.contains(el)) return;
    var a = el.getAttribute('data-a'), k = el.getAttribute('data-k'), t = theme();
    if (a === 'close') close();
    else if (a === 'theme') { if (el.getAttribute('data-v') !== t) { var tb = document.querySelector('[data-theme-toggle]'); if (tb) tb.click(); } }
    else if (a === 'rs') { delete cur()[k]; touch(); render(); }
    else if (a === 'preset') {
      var p = PRESETS[+el.getAttribute('data-i')], keep = { stars: cur().stars, aurora: cur().aurora };
      var n = clone(p.c); if (p.bgMode) n.bgMode = p.bgMode;
      cfg[t] = n; if (keep.stars === false) n.stars = false; if (keep.aurora === false) n.aurora = false;
      touch(); render();
    }
    else if (a === 'reset') { if (confirm('Reset all ' + (t === 'dark' ? 'Dark' : 'Cosmic') + ' theme colors to default?')) { cfg[t] = {}; touch(); render(); } }
    else if (a === 'pickimg') fileDialog('image/*', function (f) { shrink(f, function (u) { setImg(u); cur().bgMode = 'image'; touch(); render(); }); });
    else if (a === 'rmimg') { setImg(null); touch(); render(); }
    else if (a === 'export') {
      var blob = new Blob([JSON.stringify({ zdColors: 1, dark: cfg.dark, cosmic: cfg.cosmic }, null, 2)], { type: 'application/json' });
      var u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'udemy-player-colors.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
    }
    else if (a === 'import') fileDialog('application/json,.json', function (f) {
      var fr = new FileReader(); fr.onload = function () {
        try { var j = JSON.parse(fr.result); if (!j || typeof j !== 'object') throw 0; cfg = { dark: j.dark || {}, cosmic: j.cosmic || {} }; touch(); render(); }
        catch (x) { alert('That file is not a valid colors export.'); }
      }; fr.readAsText(f);
    });
  });

  window.zdColors = { open: openPanel, close: close, toggle: toggle };
})();
