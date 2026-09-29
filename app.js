(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};

  /* The board lives in a fixed "world" of 1600 x 688 units. Every player sees the same
     world, scaled to their screen, so piece positions can be shared as plain numbers. */
  var WW = 1600, WH = 688;
  var FX = 24, FY = 24, FW = 960, FH = 640;      /* frame (where the picture is built) */
  var TX = 1008, TY = 24, TW = 568, TH = 640;    /* tray (where loose pieces start) */
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var PALETTE = ['#e4572e', '#1d7fb8', '#2f9e5b', '#d99a00', '#c2418a', '#0f9d9a', '#7a5cd1', '#6b7280'];
  var CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function rid(n) { var s = '', i; for (i = 0; i < n; i++) s += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length)); return s; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  function setMsg(t, err) { var m = $('lobbyMsg'); m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- identity ---------- */
  var me = { id: lsGet('jp_id') || rid(10), name: (lsGet('jp_name') || '').slice(0, 12), color: PALETTE[0] };
  lsSet('jp_id', me.id);

  /* ---------- firebase ---------- */
  var db = null, TS = null, offset = 0;
  function initFirebase() {
    if (db) return true;
    if (!window.firebase || !CFG.firebase) return false;
    try {
      firebase.initializeApp(CFG.firebase);
      db = firebase.database();
      TS = firebase.database.ServerValue.TIMESTAMP;
      db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
      return true;
    } catch (e) { console.error(e); return false; }
  }
  function serverNow() { return Date.now() + offset; }

  /* ---------- pictures ---------- */
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function makeSampleArt() {
    var c = document.createElement('canvas'); c.width = FW; c.height = FH;
    var g = c.getContext('2d'), R = rng(11), i;
    var sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#141a45'); sky.addColorStop(0.55, '#b4526a'); sky.addColorStop(1, '#f5a45f');
    g.fillStyle = sky; g.fillRect(0, 0, FW, FH);
    for (i = 0; i < 110; i++) {
      g.fillStyle = 'rgba(255,248,230,' + (0.25 + R() * 0.6) + ')';
      g.beginPath(); g.arc(R() * FW, R() * 250, R() * 1.4 + 0.3, 0, 7); g.fill();
    }
    var glow = g.createRadialGradient(700, 150, 10, 700, 150, 190);
    glow.addColorStop(0, 'rgba(255,240,205,0.85)'); glow.addColorStop(1, 'rgba(255,240,205,0)');
    g.fillStyle = glow; g.fillRect(400, 0, 560, 400);
    g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(700, 150, 48, 0, 7); g.fill();
    g.fillStyle = 'rgba(214,190,150,0.35)';
    g.beginPath(); g.arc(686, 140, 12, 0, 7); g.arc(716, 168, 8, 0, 7); g.arc(708, 128, 6, 0, 7); g.fill();
    function ridge(base, amp, color, p) {
      g.fillStyle = color; g.beginPath(); g.moveTo(0, 460);
      for (var x = 0; x <= FW; x += 6) {
        g.lineTo(x, base - amp * (0.5 * Math.sin(x * 0.006 + p) + 0.3 * Math.sin(x * 0.017 + p * 2) + 0.2 * Math.sin(x * 0.041 + p * 3)));
      }
      g.lineTo(FW, 460); g.closePath(); g.fill();
    }
    ridge(330, 80, '#5a3f78', 1.2); ridge(375, 62, '#39346a', 3.4); ridge(415, 46, '#222650', 5.1);
    var lake = g.createLinearGradient(0, 430, 0, FH);
    lake.addColorStop(0, '#2b3a6e'); lake.addColorStop(1, '#0d1330');
    g.fillStyle = lake; g.fillRect(0, 430, FW, FH - 430);
    for (i = 0; i < 16; i++) {
      var rw = 90 - i * 3 + R() * 20;
      g.fillStyle = 'rgba(255,236,190,' + (0.5 - i * 0.028) + ')';
      g.fillRect(700 - rw / 2 + (R() - 0.5) * 18, 440 + i * 9, rw, 3);
    }
    function lantern(x, y, r, a) {
      var lg = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
      lg.addColorStop(0, 'rgba(255,190,90,' + a + ')'); lg.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = lg; g.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
      g.fillStyle = '#ffe2a8'; g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, 7); g.fill();
    }
    for (i = 0; i < 16; i++) lantern(60 + R() * 840, 200 + R() * 190, 3 + R() * 4, 0.55);
    for (i = 0; i < 26; i++) { var ly = 470 + R() * 150; lantern(40 + R() * 880, ly, 4 + (ly - 470) / 150 * 8, 0.75); }
    g.fillStyle = '#0a0d1f';
    for (i = 0; i < 7; i++) {
      var tx = 20 + i * 34 + R() * 12, th = 130 + R() * 90, tw = 26 + R() * 10;
      g.beginPath(); g.moveTo(tx, FH + 6); g.lineTo(tx + tw, FH + 6); g.lineTo(tx + tw / 2, FH + 6 - th); g.closePath(); g.fill();
    }
    for (i = 0; i < 5; i++) {
      var ux = 850 + i * 30 + R() * 10, uh = 90 + R() * 70;
      g.beginPath(); g.moveTo(ux, FH + 6); g.lineTo(ux + 24, FH + 6); g.lineTo(ux + 12, FH - uh); g.closePath(); g.fill();
    }
    return c;
  }
  var artCache = {};
  function loadArt(puzzle) {
    var key = puzzle ? puzzle.id : 'sample';
    if (artCache[key]) return Promise.resolve(artCache[key]);
    return new Promise(function (resolve) {
      function done(c) { artCache[key] = c; resolve(c); }
      if (!puzzle || !puzzle.src) { done(makeSampleArt()); return; }
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = FW; c.height = FH;
        var g = c.getContext('2d'), s = Math.max(FW / img.width, FH / img.height);
        var w = img.width * s, h = img.height * s;
        g.drawImage(img, (FW - w) / 2, (FH - h) / 2, w, h);
        done(c);
      };
      img.onerror = function () { done(makeSampleArt()); };
      img.src = puzzle.src;
    });
  }
  function findPuzzle(id) {
    var list = CFG.puzzles || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || { id: 'sample', title: 'サンプル', src: null };
  }

  /* ---------- geometry (same seed => same cut on every screen) ---------- */
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeGeo(cols, rows, seed) {
    var R = mulberry(seed), hs = [], vs = [], r, c;
    for (r = 0; r <= rows; r++) { hs[r] = []; for (c = 0; c < cols; c++) hs[r][c] = R() < 0.5 ? 1 : -1; }
    for (r = 0; r < rows; r++) { vs[r] = []; for (c = 0; c <= cols; c++) vs[r][c] = R() < 0.5 ? 1 : -1; }
    var pw = FW / cols, ph = FH / rows;
    return { cols: cols, rows: rows, pw: pw, ph: ph, t: Math.min(pw, ph) * 0.26, hs: hs, vs: vs };
  }
  function edge(p, x0, y0, x1, y1, s, t) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;
    function P(u, v) { return [x0 + dx * u + nx * v * t * s, y0 + dy * u + ny * v * t * s]; }
    if (!s) { p.lineTo(x1, y1); return; }
    var a = P(0.38, 0); p.lineTo(a[0], a[1]);
    var c1 = P(0.38, 0.25), c2 = P(0.29, 0.5), e = P(0.33, 0.8);
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    c1 = P(0.36, 1.08); c2 = P(0.64, 1.08); e = P(0.67, 0.8);
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    c1 = P(0.71, 0.5); c2 = P(0.62, 0.25); e = P(0.62, 0);
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    p.lineTo(x1, y1);
  }
  function piecePath(G, r, c, ox, oy) {
    var p = new Path2D(), pw = G.pw, ph = G.ph, t = G.t;
    var top = r > 0 ? -G.hs[r][c] : 0, bottom = r < G.rows - 1 ? G.hs[r + 1][c] : 0;
    var left = c > 0 ? -G.vs[r][c] : 0, right = c < G.cols - 1 ? G.vs[r][c + 1] : 0;
    p.moveTo(ox, oy);
    edge(p, ox, oy, ox + pw, oy, top, t);
    edge(p, ox + pw, oy, ox + pw, oy + ph, right, t);
    edge(p, ox + pw, oy + ph, ox, oy + ph, bottom, t);
    edge(p, ox, oy + ph, ox, oy, left, t);
    p.closePath();
    return p;
  }

  /* ---------- state ---------- */
  var stage = $('stage'), viewport = $('viewport');
  var code = null, base = '', meta = null, G = null, art = null, P = [], scale = 1;
  var lastVal = null, drag = null, pan = null, doneShown = false, curTimer = 0, lastCur = 0;
  var curEls = {}, timerId = null, totalMs = null, joined = false;
  var chosenPuzzle = null;

  function pref(i) { return db.ref(base + '/pieces/' + i); }

  /* ---------- layout & rendering ---------- */
  function layout() {
    var vw = viewport.clientWidth || 320, z = +$('zoom').value || 1;
    scale = (vw * z) / WW;
    stage.style.width = (WW * scale) + 'px';
    stage.style.height = (WH * scale) + 'px';
    var f = $('frame').style;
    f.left = (FX * scale) + 'px'; f.top = (FY * scale) + 'px'; f.width = (FW * scale) + 'px'; f.height = (FH * scale) + 'px';
    var t = $('tray').style;
    t.left = (TX * scale) + 'px'; t.top = (TY * scale) + 'px'; t.width = (TW * scale) + 'px'; t.height = (TH * scale) + 'px';
    var l = $('trayLabel').style; l.left = ((TX + 10) * scale) + 'px'; l.top = ((TY + 6) * scale) + 'px';
    var k = scale * dpr, w = Math.ceil(FW * k), h = Math.ceil(FH * k);
    [$('slots'), $('ghost')].forEach(function (cv) { cv.width = w; cv.height = h; });
    if (art) $('ghost').getContext('2d').drawImage(art, 0, 0, w, h);
    drawSlots();
  }
  function drawSlots() {
    if (!G) return;
    var cv = $('slots'), ctx = cv.getContext('2d'), k = scale * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.strokeStyle = getComputedStyle(stage).getPropertyValue('--slot') || 'rgba(0,0,0,.3)';
    ctx.lineWidth = 1 / scale;
    for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      ctx.save(); ctx.translate(c * G.pw, r * G.ph); ctx.stroke(piecePath(G, r, c, 0, 0)); ctx.restore();
    }
  }
  function renderPieces() {
    var k = scale * dpr, t = G.t, pw = G.pw, ph = G.ph, sw = pw + 2 * t, sh = ph + 2 * t;
    P.forEach(function (p) { if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    var pad = document.createElement('canvas');
    pad.width = Math.ceil((FW + 2 * t) * k); pad.height = Math.ceil((FH + 2 * t) * k);
    pad.getContext('2d').drawImage(art, t * k, t * k, FW * k, FH * k);
    P.forEach(function (p) {
      var cv = document.createElement('canvas');
      cv.width = Math.ceil(sw * k); cv.height = Math.ceil(sh * k);
      cv.style.width = (sw * scale) + 'px'; cv.style.height = (sh * scale) + 'px';
      cv.className = 'piece' + (p.locked ? ' locked' : '');
      var ctx = cv.getContext('2d'), path = piecePath(G, p.r, p.c, t, t);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.save(); ctx.clip(path);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(pad, p.c * pw * k, p.r * ph * k, sw * k, sh * k, 0, 0, sw * k, sh * k);
      ctx.restore();
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.2 / scale; ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.6 / scale; ctx.stroke(path);
      p.el = cv; p.ctx = ctx; p.tf = '';
      stage.appendChild(cv);
    });
    if (lastVal) applyRoom(lastVal);
  }

  /* ---------- applying the shared state ---------- */
  function playerColor(id, players) { return players && players[id] && players[id].color || '#888'; }
  function applyRoom(val) {
    lastVal = val;
    if (!val.pieces || !P.length) return;
    var ps = val.pieces, players = val.players || {}, allLocked = true, maxT = 0, solved = 0;
    P.forEach(function (p) {
      var s = ps[p.i];
      if (!s) { allLocked = false; return; }
      p.holder = s.holder || null;
      p.zSrv = s.z || 0;
      if (s.locked) {
        if (!p.locked) { p.locked = true; if (p.el) p.el.classList.add('locked'); }
        p.tx = p.hx; p.ty = p.hy; solved++;
        if (s.t && s.t > maxT) maxT = s.t;
        p.by = s.by || ''; p.byColor = s.byColor || '#888';
      } else {
        allLocked = false;
        if (!p.dragging) { p.tx = s.x; p.ty = s.y; }
      }
      if (!p.inited) { p.x = p.tx; p.y = p.ty; p.inited = true; }
    });
    var un = P.filter(function (p) { return !p.locked; }).sort(function (a, b) { return (a.zSrv - b.zSrv) || (a.i - b.i); });
    un.forEach(function (p, n) { p.rank = n + 1; });
    P.forEach(function (p) {
      if (!p.el) return;
      p.el.style.zIndex = p.dragging ? 2000 : p.locked ? 5 : 10 + (p.rank || 0);
      if (p.locked) p.el.style.filter = '';
      else if (p.dragging) p.el.style.filter = 'drop-shadow(0 8px 10px rgba(0,0,0,0.42))';
      else if (p.holder && p.holder !== me.id) p.el.style.filter = 'drop-shadow(0 0 3px ' + playerColor(p.holder, players) + ') drop-shadow(0 0 6px ' + playerColor(p.holder, players) + ')';
      else p.el.style.filter = '';
    });
    $('count').textContent = solved + ' / ' + P.length;
    renderPeople(players);
    renderCursors(players);
    if (allLocked && !doneShown) showDone(maxT, ps);
    if (val.next && val.next !== code) { $('nextBtn').hidden = false; $('nextBtn').dataset.code = val.next; }
  }
  function renderPeople(players) {
    var box = $('people'), ids = Object.keys(players);
    box.textContent = '';
    ids.forEach(function (id) {
      var pl = players[id], chip = document.createElement('span'), dot = document.createElement('i');
      chip.className = 'chip'; dot.style.background = pl.color || '#888';
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode((pl.name || '名無し') + (id === me.id ? '(あなた)' : '')));
      box.appendChild(chip);
    });
  }
  function renderCursors(players) {
    var box = $('cursors'), seen = {};
    Object.keys(players).forEach(function (id) {
      var pl = players[id];
      if (id === me.id || !pl.cur) return;
      seen[id] = true;
      var el = curEls[id];
      if (!el) {
        el = document.createElement('div'); el.className = 'cur';
        el.innerHTML = '<svg viewBox="0 0 16 16"><path d="M1 1l5 14 2.2-5.6L14 7z" fill="currentColor" stroke="#fff" stroke-width="1"/></svg><span></span>';
        box.appendChild(el); curEls[id] = el;
      }
      el.style.color = pl.color || '#888';
      var sp = el.querySelector('span'); sp.textContent = pl.name || ''; sp.style.background = pl.color || '#888';
      el.style.transform = 'translate(' + (pl.cur.x * scale) + 'px,' + (pl.cur.y * scale) + 'px)';
    });
    Object.keys(curEls).forEach(function (id) {
      if (!seen[id]) { if (curEls[id].parentNode) curEls[id].parentNode.removeChild(curEls[id]); delete curEls[id]; }
    });
  }
  function showDone(maxT, ps) {
    doneShown = true;
    totalMs = (maxT && meta) ? maxT - meta.createdAt : null;
    var tally = {}, colors = {};
    Object.keys(ps).forEach(function (k) { var s = ps[k]; if (s.locked) { var n = s.by || '名無し'; tally[n] = (tally[n] || 0) + 1; colors[n] = s.byColor || '#888'; } });
    var list = $('doneList'); list.textContent = '';
    Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).forEach(function (n) {
      var li = document.createElement('li'), dot = document.createElement('span');
      dot.className = 'chip'; var i = document.createElement('i'); i.style.background = colors[n]; dot.appendChild(i);
      dot.appendChild(document.createTextNode(n + '  ' + tally[n] + '個'));
      li.appendChild(dot); list.appendChild(li);
    });
    $('doneTitle').textContent = '完成しました。タイムは ' + (totalMs != null ? fmt(totalMs) : '') + ' です。';
    $('done').hidden = false;
    $('slots').style.opacity = '0';
  }

  /* ---------- animation loop ---------- */
  function tick() {
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (!p.el || !p.inited) continue;
      if (!p.dragging) {
        var dx = p.tx - p.x, dy = p.ty - p.y;
        if (reduceMotion || Math.abs(dx) + Math.abs(dy) < 0.4) { p.x = p.tx; p.y = p.ty; }
        else { p.x += dx * 0.35; p.y += dy * 0.35; }
      }
      var tf = 'translate(' + (p.x * scale) + 'px,' + (p.y * scale) + 'px)';
      if (tf !== p.tf) { p.el.style.transform = tf; p.tf = tf; }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- pointer handling ---------- */
  function toWorld(e) { var b = stage.getBoundingClientRect(); return { x: (e.clientX - b.left) / scale, y: (e.clientY - b.top) / scale }; }
  function pick(w) {
    var best = null, k = scale * dpr;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.locked || !p.el || !p.inited) continue;
      if (p.holder && p.holder !== me.id) continue;
      var lx = w.x - p.x, ly = w.y - p.y;
      if (lx < 0 || ly < 0 || lx >= G.pw + 2 * G.t || ly >= G.ph + 2 * G.t) continue;
      var a = p.ctx.getImageData(Math.floor(lx * k), Math.floor(ly * k), 1, 1).data[3];
      if (a > 30 && (!best || (p.rank || 0) > (best.rank || 0))) best = p;
    }
    return best;
  }
  function sendCursor(w) {
    if (!db || !joined) return;
    var n = Date.now();
    if (n - lastCur < 80) return;
    lastCur = n;
    db.ref(base + '/players/' + me.id + '/cur').set(w ? { x: r1(w.x), y: r1(w.y) } : null);
  }

  stage.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || !P.length || drag) return;
    var w = toWorld(e), p = pick(w);
    if (!p) {
      if (viewport.scrollWidth > viewport.clientWidth + 2 || viewport.scrollHeight > viewport.clientHeight + 2) {
        pan = { x: e.clientX, y: e.clientY, sl: viewport.scrollLeft, st: viewport.scrollTop, id: e.pointerId };
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      return;
    }
    e.preventDefault();
    p.dragging = true;
    var d = { p: p, dx: w.x - p.x, dy: w.y - p.y, id: e.pointerId, pending: true, up: false, timer: 0 };
    drag = d;
    p.el.style.zIndex = 2000; p.el.style.filter = 'drop-shadow(0 8px 10px rgba(0,0,0,0.42))';
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    var hr = pref(p.i).child('holder');
    hr.transaction(function (cur) { return cur ? undefined : me.id; }).then(function (res) {
      if (!res.committed) {
        p.dragging = false;
        if (drag === d) drag = null;
        var s = lastVal && lastVal.pieces && lastVal.pieces[p.i];
        if (s) { p.tx = s.x; p.ty = s.y; }
        if (lastVal) applyRoom(lastVal);
        return;
      }
      d.pending = false;
      hr.onDisconnect().set(null);
      pref(p.i).update({ z: TS });
      if (d.up) finishDrag(d);
    }).catch(function (err) { console.error(err); p.dragging = false; if (drag === d) drag = null; });
  });
  stage.addEventListener('pointermove', function (e) {
    var w = toWorld(e);
    if (pan && e.pointerId === pan.id) {
      viewport.scrollLeft = pan.sl - (e.clientX - pan.x);
      viewport.scrollTop = pan.st - (e.clientY - pan.y);
      return;
    }
    if (!drag || e.pointerId !== drag.id) { if (e.pointerType === 'mouse') sendCursor(w); return; }
    var p = drag.p, d = drag;
    p.x = Math.max(-G.t - G.pw * 0.4, Math.min(WW - G.pw * 0.6, w.x - d.dx));
    p.y = Math.max(-G.t - G.ph * 0.4, Math.min(WH - G.ph * 0.6, w.y - d.dy));
    p.tx = p.x; p.ty = p.y;
    sendCursor(w);
    if (!d.timer) {
      d.timer = setTimeout(function () {
        d.timer = 0;
        if (!d.pending && drag === d) pref(p.i).update({ x: r1(p.x), y: r1(p.y) });
      }, 50);
    }
  });
  function finishDrag(d) {
    var p = d.p;
    if (drag === d) drag = null;
    clearTimeout(d.timer); d.timer = 0;
    p.dragging = false;
    var near = Math.hypot(p.x - p.hx, p.y - p.hy) < Math.min(G.pw, G.ph) * 0.32;
    var upd = near
      ? { x: p.hx, y: p.hy, locked: true, holder: null, t: TS, by: me.name, byColor: me.color }
      : { x: r1(p.x), y: r1(p.y), holder: null };
    pref(p.i).update(upd);
    pref(p.i).child('holder').onDisconnect().cancel();
    if (near) { p.locked = true; p.tx = p.hx; p.ty = p.hy; p.el.classList.add('locked'); p.el.style.filter = ''; p.el.style.zIndex = 5; }
    else { p.tx = p.x; p.ty = p.y; }
  }
  function release(e) {
    if (pan && e.pointerId === pan.id) { pan = null; return; }
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.pending) { drag.up = true; return; }
    finishDrag(drag);
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) { lastCur = 0; sendCursor(null); } });

  /* ---------- rooms ---------- */
  function showRoomUI(on) {
    $('lobby').hidden = on; $('room').hidden = !on; $('stats').hidden = !on;
    $('subtitle').textContent = on ? 'ピースをドラッグして、正しい場所の近くで離すとはまります。' : 'みんなで同じ盤面を、同時に組み立てます。';
  }
  function createRoom(puzzleId, cols, rows) {
    var newCode = rid(6), seed = Math.floor(Math.random() * 2000000000) + 1;
    var g = makeGeo(cols, rows, seed), pieces = {}, i, R = Math.random;
    for (i = 0; i < cols * rows; i++) {
      pieces[i] = { x: r1(TX - g.t + R() * Math.max(1, TW - g.pw)), y: r1(TY - g.t + R() * Math.max(1, TH - g.ph)), z: i + 1, locked: false };
    }
    return db.ref('rooms/' + newCode).set({
      meta: { puzzleId: puzzleId, cols: cols, rows: rows, seed: seed, createdAt: TS },
      pieces: pieces
    }).then(function () { return newCode; });
  }

  function enterRoom(roomCode) {
    setMsg('つなげています…');
    code = roomCode; base = 'rooms/' + code;
    var opened = db.ref(base + '/meta').once('value');
    return opened.then(function (snap) {
      meta = snap.val();
      if (!meta) { code = null; setMsg('この部屋は見つかりませんでした。リンクが違うか、部屋が削除されています。', true); return; }
      return loadArt(findPuzzle(meta.puzzleId)).then(function (a) {
        art = a; G = makeGeo(meta.cols, meta.rows, meta.seed);
        P = [];
        for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
          P.push({ i: r * G.cols + c, r: r, c: c, hx: FX + c * G.pw - G.t, hy: FY + r * G.ph - G.t, x: 0, y: 0, tx: 0, ty: 0, locked: false, holder: null, zSrv: 0, rank: 0, dragging: false, inited: false });
        }
        doneShown = false; totalMs = null; lastVal = null;
        $('done').hidden = true; $('nextBtn').hidden = true; $('slots').style.opacity = '';
        showRoomUI(true);
        $('inviteUrl').value = location.origin + location.pathname + '?room=' + code;
        layout(); renderPieces();
        return db.ref(base + '/players').once('value').then(function (ps) {
          var used = {}, pv = ps.val() || {};
          Object.keys(pv).forEach(function (id) { if (id !== me.id) used[pv[id].color] = true; });
          var free = PALETTE.filter(function (c) { return !used[c]; });
          me.color = free.length ? free[0] : PALETTE[Math.floor(Math.random() * PALETTE.length)];
          var mine = db.ref(base + '/players/' + me.id);
          mine.set({ name: me.name, color: me.color, joined: TS });
          mine.onDisconnect().remove();
          joined = true;
          db.ref(base).on('value', function (s) { applyRoom(s.val() || {}); });
        });
      });
    }).catch(function (err) {
      console.error(err);
      showRoomUI(false);
      setMsg('つなげませんでした。しばらくしてから、ページを開き直してください。', true);
    });
  }

  /* timer */
  timerId = setInterval(function () {
    if (!meta || !meta.createdAt || !P.length) return;
    $('time').textContent = fmt(doneShown && totalMs != null ? totalMs : serverNow() - meta.createdAt);
  }, 500);

  /* ---------- lobby ---------- */
  var qs = new URLSearchParams(location.search), urlRoom = (qs.get('room') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  var joinMode = !!urlRoom;

  function buildPicks() {
    var box = $('picks'); box.textContent = '';
    var list = CFG.puzzles || [];
    if (!chosenPuzzle && list.length) chosenPuzzle = list[0].id;
    list.forEach(function (pz) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pick'; b.dataset.id = pz.id;
      b.setAttribute('aria-pressed', pz.id === chosenPuzzle ? 'true' : 'false');
      var cv = document.createElement('canvas'); cv.width = 300; cv.height = 200;
      var sp = document.createElement('span'); sp.textContent = pz.title || pz.id;
      b.appendChild(cv); b.appendChild(sp); box.appendChild(b);
      loadArt(pz).then(function (a) { cv.getContext('2d').drawImage(a, 0, 0, 300, 200); });
      b.addEventListener('click', function () {
        chosenPuzzle = pz.id;
        box.querySelectorAll('.pick').forEach(function (n) { n.setAttribute('aria-pressed', n.dataset.id === pz.id ? 'true' : 'false'); });
      });
    });
  }
  function setLobbyMode() {
    $('createOnly').style.display = joinMode ? 'none' : 'contents';
    $('go').textContent = joinMode ? 'この部屋に参加する' : '部屋を作る';
    $('lobbyTitle').textContent = joinMode ? 'パズルに参加する' : 'パズルを始める';
    $('toCreate').hidden = !joinMode;
    $('inviteBar').hidden = false;
  }
  function needName() {
    var n = $('name').value.trim().slice(0, 12);
    if (!n) { setMsg('名前を入力してください。', true); $('name').focus(); return null; }
    me.name = n; lsSet('jp_name', n);
    return n;
  }
  $('name').value = me.name;
  buildPicks(); setLobbyMode();

  $('go').addEventListener('click', function () {
    if (!needName()) return;
    if (!initFirebase()) { setMsg('Firebaseに接続できませんでした。ネットワークを確認してから、ページを開き直してください。', true); return; }
    $('go').disabled = true;
    var p;
    if (joinMode) p = enterRoom(urlRoom);
    else {
      var sz = $('size').value.split('x');
      p = createRoom(chosenPuzzle, +sz[0], +sz[1]).then(function (c) {
        history.pushState({}, '', '?room=' + c);
        return enterRoom(c);
      });
    }
    p.then(function () { $('go').disabled = false; }, function () { $('go').disabled = false; });
  });
  $('toCreate').addEventListener('click', function () { history.replaceState({}, '', location.pathname); joinMode = false; urlRoom = ''; setMsg(''); setLobbyMode(); });

  /* ---------- room controls ---------- */
  $('zoom').addEventListener('change', function () { if (G) { layout(); renderPieces(); } });
  $('peek').addEventListener('click', function () {
    var on = $('peek').getAttribute('aria-pressed') !== 'true';
    $('peek').setAttribute('aria-pressed', on ? 'true' : 'false'); $('ghost').hidden = !on;
  });
  $('copy').addEventListener('click', function () {
    var inp = $('inviteUrl');
    function fallback() { inp.focus(); inp.select(); $('copy').textContent = '選択しました'; setTimeout(function () { $('copy').textContent = 'コピー'; }, 1500); }
    try {
      navigator.clipboard.writeText(inp.value).then(function () {
        $('copy').textContent = 'コピーしました'; setTimeout(function () { $('copy').textContent = 'コピー'; }, 1500);
      }, fallback);
    } catch (e) { fallback(); }
  });
  $('again').addEventListener('click', function () {
    if (!meta) return;
    $('again').disabled = true;
    var oldCode = code;
    createRoom(meta.puzzleId, meta.cols, meta.rows).then(function (c) {
      db.ref('rooms/' + oldCode + '/next').set(c);
      db.ref(base + '/players/' + me.id).remove();
      db.ref(base).off();
      joined = false; clearRoom();
      history.pushState({}, '', '?room=' + c);
      return enterRoom(c);
    }).then(function () { $('again').disabled = false; }, function () { $('again').disabled = false; });
  });
  $('nextBtn').addEventListener('click', function () {
    var c = $('nextBtn').dataset.code; if (c) location.href = location.pathname + '?room=' + c;
  });
  function clearRoom() {
    P.forEach(function (p) { if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    P = []; lastVal = null; drag = null;
    Object.keys(curEls).forEach(function (id) { if (curEls[id].parentNode) curEls[id].parentNode.removeChild(curEls[id]); delete curEls[id]; });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (G && !drag && !$('room').hidden) { layout(); renderPieces(); } }, 200);
  });
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawSlots);
    new MutationObserver(drawSlots).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (err) {}

  /* Small screens start zoomed in so pieces are big enough to grab. */
  if (window.innerWidth < 700) $('zoom').value = '2';

  requestAnimationFrame(tick);

  /* Opening an invite link with a saved name joins straight away. */
  if (joinMode && me.name) { setMsg('名前は「' + me.name + '」で参加します。変えるときは書き換えてください。'); }
})();
