(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var PALETTE = ['#f08a8a', '#6fa3e0', '#6cc3a0', '#f2b54e', '#b58ee0', '#4fb7c9', '#f29ac8', '#8a9bb5'];
  var CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
  var HINTS_PER_ROOM = 3;
  var FW = 960, FH = 640; /* the picture is always cut at this size, in "world" units */

  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function rid(n) { var s = '', i; for (i = 0; i < n; i++) s += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length)); return s; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60); }
  function setMsg(t, err) { var m = $('lobbyMsg'); m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* Board layout in world units. Every player sees the same world scaled to their screen,
     so positions can be shared as plain numbers. The tray grows with the piece count. */
  function makeLayout(cols, rows) {
    var n = cols * rows, WW = 1240;
    var L = { WW: WW, FX: (WW - FW) / 2, FY: 36 };
    L.TX = 16; L.TY = L.FY + FH + 44; L.TW = WW - 32; L.TH = Math.round(220 + n * 1.7);
    L.WH = L.TY + L.TH + 16;
    return L;
  }

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
    var g = c.getContext('2d'), R = rng(7), i;
    var sky = g.createLinearGradient(0, 0, 0, 380);
    sky.addColorStop(0, '#5f9fe6'); sky.addColorStop(1, '#cfe6fb');
    g.fillStyle = sky; g.fillRect(0, 0, FW, FH);
    function cloud(x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      [[0, 0, 34], [30, -14, 30], [62, -4, 36], [92, 6, 26], [40, 12, 30]].forEach(function (b) { g.beginPath(); g.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, 7); g.fill(); });
    }
    cloud(90, 110, 1.3); cloud(560, 70, 1.0); cloud(760, 170, 1.5); cloud(330, 210, 0.8);
    var sea = g.createLinearGradient(0, 330, 0, 470);
    sea.addColorStop(0, '#2f78c4'); sea.addColorStop(1, '#8cc6ef');
    g.fillStyle = sea; g.fillRect(0, 330, FW, 140);
    for (i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + R() * 0.4) + ')'; g.fillRect(R() * FW, 340 + R() * 120, 12 + R() * 30, 2); }
    g.fillStyle = '#4f8f6a';
    g.beginPath(); g.moveTo(560, 334); g.quadraticCurveTo(650, 280, 760, 330); g.lineTo(560, 334); g.fill();
    g.fillStyle = '#fff'; g.fillRect(690, 262, 14, 50); g.fillStyle = '#e05f5f'; g.fillRect(688, 254, 18, 10);
    var sand = g.createLinearGradient(0, 460, 0, FH);
    sand.addColorStop(0, '#f6e7c4'); sand.addColorStop(1, '#ecd3a0');
    g.fillStyle = sand; g.beginPath(); g.moveTo(0, 470);
    for (var x = 0; x <= FW; x += 20) g.lineTo(x, 468 + Math.sin(x * 0.02) * 6);
    g.lineTo(FW, FH); g.lineTo(0, FH); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath();
    for (x = 0; x <= FW; x += 20) g.lineTo(x, 470 + Math.sin(x * 0.02) * 6);
    g.stroke();
    function shell(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.closePath(); g.fill(); }
    shell(180, 560, 16, '#f7b8b8'); shell(420, 600, 12, '#fff3e0'); shell(820, 570, 18, '#f9d27a');
    /* a small squid friend on the beach */
    g.save(); g.translate(610, 520); g.scale(1.6, 1.6);
    g.fillStyle = '#fff'; g.strokeStyle = '#6fa3e0'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(0, -30); g.bezierCurveTo(-18, -28, -20, 0, -12, 6); g.lineTo(-16, 26); g.lineTo(-6, 12); g.lineTo(-2, 28); g.lineTo(2, 12); g.lineTo(6, 28); g.lineTo(10, 12); g.lineTo(16, 26); g.lineTo(12, 6); g.bezierCurveTo(20, 0, 18, -28, 0, -30); g.fill(); g.stroke();
    g.fillStyle = '#2d4569'; g.beginPath(); g.arc(-6, -8, 2.2, 0, 7); g.arc(6, -8, 2.2, 0, 7); g.fill();
    g.fillStyle = '#f4a9b4'; g.beginPath(); g.ellipse(-10, -2, 2.6, 1.5, 0, 0, 7); g.ellipse(10, -2, 2.6, 1.5, 0, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = '#2d4569'; g.lineWidth = 2;
    [[250, 120], [276, 132], [470, 150]].forEach(function (b) { g.beginPath(); g.moveTo(b[0] - 8, b[1]); g.quadraticCurveTo(b[0] - 4, b[1] - 5, b[0], b[1]); g.quadraticCurveTo(b[0] + 4, b[1] - 5, b[0] + 8, b[1]); g.stroke(); });
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
        /* keep the picture's own detail (up to 2.5x the board size) so zoomed pieces stay sharp */
        var s = Math.max(FW / img.width, FH / img.height), up = Math.max(1, Math.min(1 / s, 2.5));
        var CW = Math.round(FW * up), CH = Math.round(FH * up);
        var c = document.createElement('canvas'); c.width = CW; c.height = CH;
        var g = c.getContext('2d'), w = img.width * s * up, h = img.height * s * up;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, (CW - w) / 2, (CH - h) / 2, w, h);
        done(c);
      };
      img.onerror = function () { done(makeSampleArt()); };
      img.src = puzzle.src;
    });
  }
  function puzzleIndex(id) {
    var list = CFG.puzzles || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return 0;
  }
  function findPuzzle(id) { var list = CFG.puzzles || []; return list[puzzleIndex(id)] || { id: 'sample', title: 'サンプル', src: null }; }
  function puzzleLabel(id) { return { num: '#' + pad2(puzzleIndex(id) + 1), title: findPuzzle(id).title || '' }; }

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
    var dx = x1 - x0, dy = y1 - y0, Ln = Math.hypot(dx, dy), nx = dy / Ln, ny = -dx / Ln;
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
  var code = null, base = '', meta = null, G = null, L = null, art = null, P = [], scale = 1;
  var lastVal = null, drag = null, pan = null, doneShown = false, lastCur = 0;
  var curEls = {}, totalMs = null, joined = false, hintTimer = 0, hintPiece = null;
  var chosenPuzzle = null, chosenSize = '8x6', chosenRotate = true;
  var SHADOW = 'drop-shadow(0 2px 3px rgba(45,69,105,0.35))';
  var LIFT = 'drop-shadow(0 10px 12px rgba(45,69,105,0.38))';

  function pref(i) { return db.ref(base + '/pieces/' + i); }

  /* ---------- layout & rendering ---------- */
  function place(el, x, y, w, h) { var s = el.style; s.left = (x * scale) + 'px'; s.top = (y * scale) + 'px'; s.width = (w * scale) + 'px'; s.height = (h * scale) + 'px'; }
  function layout() {
    var vw = viewport.clientWidth || 320, z = +$('zoom').value || 1;
    var fit = vw / L.WW;
    if (window.innerWidth > 1100) fit = Math.min(fit, Math.max(320, window.innerHeight - 110) / L.WH);
    scale = fit * z;
    stage.style.width = (L.WW * scale) + 'px';
    stage.style.height = (L.WH * scale) + 'px';
    place($('frameZone'), L.FX - 20, L.FY - 20, FW + 40, FH + 40);
    place($('trayZone'), L.TX, L.TY, L.TW, L.TH);
    place($('frame'), L.FX, L.FY, FW, FH);
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
    ctx.strokeStyle = 'rgba(111,163,224,0.55)';
    ctx.lineWidth = 1.2 / scale;
    for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      ctx.save(); ctx.translate(c * G.pw, r * G.ph);
      var path = piecePath(G, r, c, 0, 0);
      if (hintPiece && hintPiece.r === r && hintPiece.c === c) { ctx.fillStyle = 'rgba(242,193,78,0.45)'; ctx.fill(path); }
      ctx.stroke(path); ctx.restore();
    }
  }
  function renderPieces() {
    var k = scale * dpr, t = G.t, pw = G.pw, ph = G.ph, sw = pw + 2 * t, sh = ph + 2 * t;
    P.forEach(function (p) { if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    var pad = document.createElement('canvas');
    pad.width = Math.ceil((FW + 2 * t) * k); pad.height = Math.ceil((FH + 2 * t) * k);
    var pg = pad.getContext('2d'); pg.imageSmoothingQuality = 'high';
    pg.drawImage(art, t * k, t * k, FW * k, FH * k);
    P.forEach(function (p) {
      var cv = document.createElement('canvas');
      cv.width = Math.ceil(sw * k); cv.height = Math.ceil(sh * k);
      cv.style.width = (sw * scale) + 'px'; cv.style.height = (sh * scale) + 'px';
      cv.className = 'piece';
      var ctx = cv.getContext('2d', { willReadFrequently: true }), path = piecePath(G, p.r, p.c, t, t);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.save(); ctx.clip(path);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(pad, p.c * pw * k, p.r * ph * k, sw * k, sh * k, 0, 0, sw * k, sh * k);
      ctx.restore();
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(45,69,105,0.35)'; ctx.lineWidth = 1.2 / scale; ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.6 / scale; ctx.stroke(path);
      p.el = cv; p.ctx = ctx; p.tf = '';
      if (hintPiece === p) cv.classList.add('hinted');
      stage.appendChild(cv);
    });
    if (lastVal) applyRoom(lastVal);
  }

  /* ---------- applying the shared state ---------- */
  function playerColor(id, players) { return players && players[id] && players[id].color || '#8a9bb5'; }
  function applyRoom(val) {
    lastVal = val;
    if (!val.pieces || !P.length) return;
    var ps = val.pieces, players = val.players || {}, allLocked = true, maxT = 0, solved = 0;
    P.forEach(function (p) {
      var s = ps[p.i];
      if (!s) { allLocked = false; return; }
      p.holder = s.holder || null;
      p.zSrv = s.z || 0;
      setRot(p, s.locked ? 0 : (s.rot || 0));
      if (s.locked) {
        p.locked = true; p.tx = p.hx; p.ty = p.hy; solved++;
        if (s.t && s.t > maxT) maxT = s.t;
        if (hintPiece === p) clearHint();
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
      if (p.locked) p.el.style.filter = 'none';
      else if (p.dragging) p.el.style.filter = LIFT;
      else if (p.holder && p.holder !== me.id) { var col = playerColor(p.holder, players); p.el.style.filter = 'drop-shadow(0 0 3px ' + col + ') drop-shadow(0 0 7px ' + col + ')'; }
      else p.el.style.filter = SHADOW;
    });
    var n = P.length, pct = n ? Math.floor(solved * 100 / n) : 0;
    $('pct').firstChild.nodeValue = pct;
    $('barFill').style.width = pct + '%';
    $('left').firstChild.nodeValue = n - solved;
    renderPeople(players);
    renderCursors(players);
    if (allLocked) showDone(maxT, ps, players);
    if (val.next && val.next !== code) { $('nextBtn').hidden = false; $('nextBtn').dataset.code = val.next; }
  }
  function renderPeople(players) {
    var box = $('people');
    box.textContent = '';
    Object.keys(players).forEach(function (id) {
      var pl = players[id], chip = document.createElement('span'), dot = document.createElement('i');
      chip.className = 'person'; dot.style.background = pl.color || '#8a9bb5';
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
      el.style.color = pl.color || '#8a9bb5';
      var sp = el.querySelector('span'); sp.textContent = pl.name || ''; sp.style.background = pl.color || '#8a9bb5';
      el.style.transform = 'translate(' + (pl.cur.x * scale) + 'px,' + (pl.cur.y * scale) + 'px)';
    });
    Object.keys(curEls).forEach(function (id) {
      if (!seen[id]) { if (curEls[id].parentNode) curEls[id].parentNode.removeChild(curEls[id]); delete curEls[id]; }
    });
  }
  function showDone(maxT, ps, players) {
    doneShown = true;
    totalMs = (maxT && meta) ? Math.max(0, maxT - meta.createdAt) : null;
    var tally = {}, colors = {};
    Object.keys(ps).forEach(function (k) { var s = ps[k]; if (s.locked) { var nm = s.by || '名無し'; tally[nm] = (tally[nm] || 0) + 1; colors[nm] = s.byColor || '#8a9bb5'; } });
    var list = $('doneList'); list.textContent = '';
    Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).forEach(function (nm) {
      var li = document.createElement('li'), dot = document.createElement('span'), b = document.createElement('b');
      dot.className = 'person'; var i = document.createElement('i'); i.style.background = colors[nm]; dot.appendChild(i);
      dot.appendChild(document.createTextNode(nm));
      b.textContent = tally[nm] + 'ピース';
      li.appendChild(dot); li.appendChild(b); list.appendChild(li);
    });
    var people = Object.keys(tally).length;
    $('doneTime').textContent = (totalMs != null ? 'タイム ' + fmt(totalMs) + '。' : '') + people + '人ではめました。';
    $('done').hidden = false;
    $('slots').style.opacity = '0';
    $('hint').disabled = true;
  }

  /* ---------- rotation (quarter turns, 0 = upright) ---------- */
  function setRot(p, rot) {
    if (p.rot === undefined) { p.rot = rot; p.ang = p.angT = rot * 90; return; }
    var d = ((rot - p.rot) % 4 + 4) % 4;
    if (!d) return;
    if (d === 3) d = -1;
    p.rot = rot; p.angT += d * 90;
  }
  function pieceSize() { return { w: G.pw + 2 * G.t, h: G.ph + 2 * G.t }; }

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
      if (p.ang !== p.angT) { var da = p.angT - p.ang; p.ang = (reduceMotion || Math.abs(da) < 0.5) ? p.angT : p.ang + da * 0.3; }
      var tf = 'translate(' + (p.x * scale) + 'px,' + (p.y * scale) + 'px)' + (p.ang ? ' rotate(' + p.ang + 'deg)' : '');
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
      var sz = pieceSize(), cx = p.x + sz.w / 2, cy = p.y + sz.h / 2;
      var th = -(p.angT || 0) * Math.PI / 180, ox = w.x - cx, oy = w.y - cy;
      var lx = ox * Math.cos(th) - oy * Math.sin(th) + sz.w / 2, ly = ox * Math.sin(th) + oy * Math.cos(th) + sz.h / 2;
      if (lx < 0 || ly < 0 || lx >= G.pw + 2 * G.t || ly >= G.ph + 2 * G.t) continue;
      var a = p.ctx.getImageData(Math.floor(lx * k), Math.floor(ly * k), 1, 1).data[3];
      if (a > 30 && (!best || (p.rank || 0) > (best.rank || 0))) best = p;
    }
    return best;
  }
  function sendCursor(w) {
    if (!db || !joined) return;
    var n = Date.now();
    if (w && n - lastCur < 80) return;
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
    var d = { p: p, dx: w.x - p.x, dy: w.y - p.y, id: e.pointerId, pending: true, up: false, timer: 0, sx: e.clientX, sy: e.clientY, moved: false };
    drag = d;
    p.el.style.zIndex = 2000; p.el.style.filter = LIFT;
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
    if (pan && e.pointerId === pan.id) {
      viewport.scrollLeft = pan.sl - (e.clientX - pan.x);
      viewport.scrollTop = pan.st - (e.clientY - pan.y);
      return;
    }
    var w = toWorld(e);
    if (!drag || e.pointerId !== drag.id) { if (e.pointerType === 'mouse') sendCursor(w); return; }
    var p = drag.p, d = drag;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    p.x = Math.max(-G.t - G.pw * 0.4, Math.min(L.WW - G.pw * 0.6, w.x - d.dx));
    p.y = Math.max(-G.t - G.ph * 0.4, Math.min(L.WH - G.ph * 0.6, w.y - d.dy));
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
    if (!d.moved && meta && meta.rotate) {
      /* a tap turns the piece a quarter clockwise */
      setRot(p, (p.rot + 1) % 4);
      pref(p.i).update({ rot: p.rot, holder: null });
      pref(p.i).child('holder').onDisconnect().cancel();
      p.el.style.filter = SHADOW;
      return;
    }
    var near = !p.rot && Math.hypot(p.x - p.hx, p.y - p.hy) < Math.min(G.pw, G.ph) * 0.32;
    var upd = near
      ? { x: p.hx, y: p.hy, rot: 0, locked: true, holder: null, t: TS, by: me.name, byColor: me.color }
      : { x: r1(p.x), y: r1(p.y), holder: null };
    pref(p.i).update(upd);
    pref(p.i).child('holder').onDisconnect().cancel();
    if (near) { p.locked = true; p.tx = p.hx; p.ty = p.hy; p.el.style.filter = 'none'; p.el.style.zIndex = 5; if (hintPiece === p) clearHint(); }
    else { p.tx = p.x; p.ty = p.y; p.el.style.filter = SHADOW; }
  }
  function release(e) {
    if (pan && e.pointerId === pan.id) { pan = null; return; }
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.pending) { drag.up = true; return; }
    finishDrag(drag);
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) sendCursor(null); });

  /* ---------- hints (each person gets 3 per room) ---------- */
  function hintsLeft() { var v = lsGet('jp_hint_' + code); return v === null ? HINTS_PER_ROOM : Math.max(0, +v || 0); }
  function showHintCount() { var n = hintsLeft(); $('hintCount').textContent = n; $('hint').disabled = n <= 0 || doneShown; }
  function clearHint() {
    clearTimeout(hintTimer);
    if (hintPiece && hintPiece.el) hintPiece.el.classList.remove('hinted');
    hintPiece = null; drawSlots();
  }
  $('hint').addEventListener('click', function () {
    if (!P.length || hintsLeft() <= 0) return;
    var cands = P.filter(function (p) { return !p.locked && !(p.holder && p.holder !== me.id); });
    if (!cands.length) return;
    clearHint();
    var p = cands[Math.floor(Math.random() * cands.length)];
    hintPiece = p; p.el.classList.add('hinted'); drawSlots();
    lsSet('jp_hint_' + code, String(hintsLeft() - 1)); showHintCount();
    if (viewport.scrollWidth > viewport.clientWidth + 2 || viewport.scrollHeight > viewport.clientHeight + 2) {
      viewport.scrollTo({ left: p.x * scale - viewport.clientWidth / 2, top: p.y * scale - viewport.clientHeight / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    hintTimer = setTimeout(clearHint, 4000);
  });

  /* ---------- rooms ---------- */
  function showRoomUI(on) {
    $('lobby').hidden = on; $('room').hidden = !on; $('right').hidden = !on;
    if (!on) $('peekWin').hidden = true;
    $('app').classList.toggle('lobby-mode', !on);
    $('navHome').setAttribute('aria-current', on ? 'false' : 'page');
    $('navPuzzle').setAttribute('aria-current', on ? 'page' : 'false');
    if (on) $('navHome').removeAttribute('aria-current'); else $('navPuzzle').removeAttribute('aria-current');
  }
  function createRoom(puzzleId, cols, rows, rotate) {
    var newCode = rid(6), seed = Math.floor(Math.random() * 2000000000) + 1;
    var g = makeGeo(cols, rows, seed), lay = makeLayout(cols, rows), pieces = {}, i, R = Math.random;
    var sw = g.pw + 2 * g.t, sh = g.ph + 2 * g.t;
    var x0 = lay.TX + 8, y0 = lay.TY + 26, xr = Math.max(1, lay.TW - 16 - sw), yr = Math.max(1, lay.TH - 34 - sh);
    for (i = 0; i < cols * rows; i++) pieces[i] = { x: r1(x0 + R() * xr), y: r1(y0 + R() * yr), z: i + 1, locked: false, rot: rotate ? Math.floor(R() * 4) : 0 };
    return db.ref('rooms/' + newCode).set({
      meta: { puzzleId: puzzleId, cols: cols, rows: rows, seed: seed, createdAt: TS, v: 2, rotate: !!rotate },
      pieces: pieces
    }).then(function () { return newCode; });
  }

  function enterRoom(roomCode) {
    setMsg('つなげています…');
    code = roomCode; base = 'rooms/' + code;
    return db.ref(base + '/meta').once('value').then(function (snap) {
      meta = snap.val();
      if (!meta) { code = null; setMsg('この部屋は見つかりませんでした。リンクが違うか、部屋が削除されています。', true); return; }
      lsSet('jp_last', roomCode);
      return loadArt(findPuzzle(meta.puzzleId)).then(function (a) {
        art = a; G = makeGeo(meta.cols, meta.rows, meta.seed); L = makeLayout(meta.cols, meta.rows);
        P = [];
        for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
          P.push({ i: r * G.cols + c, r: r, c: c, hx: L.FX + c * G.pw - G.t, hy: L.FY + r * G.ph - G.t, x: 0, y: 0, tx: 0, ty: 0, locked: false, holder: null, zSrv: 0, rank: 0, dragging: false, inited: false });
        }
        doneShown = false; totalMs = null; lastVal = null; hintPiece = null;
        $('done').hidden = true; $('nextBtn').hidden = true; $('slots').style.opacity = '';
        var lab = puzzleLabel(meta.puzzleId), pn = $('puzzleName');
        pn.textContent = ''; var b = document.createElement('b'); b.textContent = lab.num;
        pn.appendChild(b); pn.appendChild(document.createTextNode(' ' + lab.title + '・' + (meta.cols * meta.rows) + 'ピース' + (meta.rotate ? '・向きバラバラ' : '')));
        $('rotateTip').hidden = !meta.rotate;
        showRoomUI(true); setMsg('');
        $('inviteUrl').value = location.origin + location.pathname + '?room=' + code;
        showHintCount();
        layout(); renderPieces();
        $('ghostToggle').checked = !!peekState.ghost; $('ghost').hidden = !peekState.ghost;
        showPeek(!!peekState.open);
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
  function leaveRoom() {
    if (code && db) {
      db.ref(base).off();
      db.ref(base + '/players/' + me.id).remove();
    }
    joined = false; clearHint(); clearRoom(); code = null; meta = null; G = null;
    history.pushState({}, '', location.pathname);
    joinMode = false; urlRoom = '';
    showRoomUI(false); setLobbyMode();
  }
  function clearRoom() {
    P.forEach(function (p) { if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    P = []; lastVal = null; drag = null;
    Object.keys(curEls).forEach(function (id) { if (curEls[id].parentNode) curEls[id].parentNode.removeChild(curEls[id]); delete curEls[id]; });
  }

  setInterval(function () {
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
    list.forEach(function (pz, idx) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pick'; b.dataset.id = pz.id;
      b.setAttribute('aria-pressed', pz.id === chosenPuzzle ? 'true' : 'false');
      var cv = document.createElement('canvas'); cv.width = 300; cv.height = 200;
      var sp = document.createElement('span'), num = document.createElement('b');
      num.textContent = '#' + pad2(idx + 1); sp.appendChild(num); sp.appendChild(document.createTextNode(pz.title || pz.id));
      b.appendChild(cv); b.appendChild(sp); box.appendChild(b);
      loadArt(pz).then(function (a) { cv.getContext('2d').drawImage(a, 0, 0, 300, 200); });
      b.addEventListener('click', function () {
        chosenPuzzle = pz.id;
        box.querySelectorAll('.pick').forEach(function (n) { n.setAttribute('aria-pressed', n.dataset.id === pz.id ? 'true' : 'false'); });
      });
    });
  }
  $('rotates').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    chosenRotate = b.dataset.rotate === '1';
    $('rotates').querySelectorAll('button').forEach(function (n) { n.setAttribute('aria-pressed', n === b ? 'true' : 'false'); });
  });
  $('sizes').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    chosenSize = b.dataset.size;
    $('sizes').querySelectorAll('button').forEach(function (n) { n.setAttribute('aria-pressed', n === b ? 'true' : 'false'); });
  });
  function setLobbyMode() {
    $('createOnly').hidden = joinMode;
    $('goText').textContent = joinMode ? 'この部屋に参加する' : '部屋をつくる';
    $('lobbyTitle').textContent = joinMode ? '招待されたパズルに参加する' : 'みんなでパズルをはじめる';
    $('toCreate').hidden = !joinMode;
    var last = lsGet('jp_last');
    $('resume').hidden = joinMode || !last;
  }
  function needName() {
    var n = $('name').value.trim().slice(0, 12);
    if (!n) { setMsg('名前を入力してください。', true); $('name').focus(); return null; }
    me.name = n; lsSet('jp_name', n);
    return n;
  }
  function busy(p) { $('go').disabled = true; $('resume').disabled = true; p.then(done, done); function done() { $('go').disabled = false; $('resume').disabled = false; } }
  function ready() {
    if (!needName()) return false;
    if (!initFirebase()) { setMsg('Firebaseに接続できませんでした。ネットワークを確認してから、ページを開き直してください。', true); return false; }
    return true;
  }
  $('name').value = me.name;
  showRoomUI(false); buildPicks(); setLobbyMode();

  $('go').addEventListener('click', function () {
    if (!ready()) return;
    if (joinMode) { busy(enterRoom(urlRoom)); return; }
    var sz = chosenSize.split('x');
    busy(createRoom(chosenPuzzle, +sz[0], +sz[1], chosenRotate).then(function (c) {
      history.pushState({}, '', '?room=' + c);
      return enterRoom(c);
    }));
  });
  $('resume').addEventListener('click', function () {
    var last = lsGet('jp_last'); if (!last || !ready()) return;
    history.pushState({}, '', '?room=' + last);
    busy(enterRoom(last));
  });
  $('toCreate').addEventListener('click', function () { history.replaceState({}, '', location.pathname); joinMode = false; urlRoom = ''; setMsg(''); setLobbyMode(); });
  $('navHome').addEventListener('click', function () { if (code) leaveRoom(); });
  $('navPuzzle').addEventListener('click', function () {
    if (code) return;
    if (!$('resume').hidden) $('resume').click(); else $('go').focus();
  });

  /* ---------- room controls ---------- */
  $('zoom').addEventListener('change', function () { if (G) { layout(); renderPieces(); } });
  /* ---------- floating reference picture (per viewer; remembers where you left it) ---------- */
  var PEEK_SIZES = [180, 260, 360, 500];
  var peekState = (function () { try { return JSON.parse(lsGet('jp_peek') || '{}') || {}; } catch (e) { return {}; } })();
  function savePeek() { lsSet('jp_peek', JSON.stringify(peekState)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function peekSize() { return peekState.size == null ? (window.innerWidth < 700 ? 0 : 1) : clamp(peekState.size, 0, PEEK_SIZES.length - 1); }
  function drawPeek() {
    if (!art) return;
    var w = Math.min(PEEK_SIZES[peekSize()], window.innerWidth - 40), h = Math.round(w * FH / FW), cv = $('peekCanvas');
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(art, 0, 0, cv.width, cv.height);
    $('peekSmaller').disabled = peekSize() === 0;
    $('peekBigger').disabled = peekSize() === PEEK_SIZES.length - 1;
  }
  function placePeek() {
    var win = $('peekWin'), W = win.offsetWidth, H = win.offsetHeight, x = peekState.x, y = peekState.y;
    if (x == null || y == null) { x = window.innerWidth < 700 ? window.innerWidth - W - 16 : 16; y = window.innerHeight - H - 16; }
    x = clamp(x, 8, Math.max(8, window.innerWidth - W - 8));
    y = clamp(y, 8, Math.max(8, window.innerHeight - H - 8));
    win.style.left = x + 'px'; win.style.top = y + 'px';
  }
  function showPeek(on) {
    $('peekWin').hidden = !on;
    $('peek').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('peekQuick').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { drawPeek(); placePeek(); }
  }
  $('peek').addEventListener('click', function () {
    peekState.open = $('peekWin').hidden; savePeek(); showPeek(peekState.open);
  });
  $('peekQuick').addEventListener('click', function () { $('peek').click(); });
  $('peekClose').addEventListener('click', function () { peekState.open = false; savePeek(); showPeek(false); $('peek').focus(); });
  $('peekSmaller').addEventListener('click', function () { peekState.size = Math.max(0, peekSize() - 1); savePeek(); drawPeek(); placePeek(); });
  $('peekBigger').addEventListener('click', function () { peekState.size = Math.min(PEEK_SIZES.length - 1, peekSize() + 1); savePeek(); drawPeek(); placePeek(); });
  $('ghostToggle').addEventListener('change', function () { peekState.ghost = this.checked; savePeek(); $('ghost').hidden = !this.checked; });
  (function dragPeek() {
    var win = $('peekWin'), d = null;
    win.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('button, label, input')) return;
      d = { id: e.pointerId, dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop };
      try { win.setPointerCapture(e.pointerId); } catch (err) {}
      win.classList.add('dragging'); e.preventDefault();
    });
    win.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      peekState.x = e.clientX - d.dx; peekState.y = e.clientY - d.dy; placePeek();
    });
    function end(e) { if (!d || e.pointerId !== d.id) return; d = null; win.classList.remove('dragging'); peekState.x = win.offsetLeft; peekState.y = win.offsetTop; savePeek(); }
    win.addEventListener('pointerup', end); win.addEventListener('pointercancel', end);
  })();
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('peekWin').hidden) $('peekClose').click(); });
  $('copy').addEventListener('click', function () {
    var inp = $('inviteUrl'), btn = $('copy');
    function say(t) { btn.textContent = t; setTimeout(function () { btn.textContent = 'コピー'; }, 1500); }
    function fallback() { inp.focus(); inp.select(); say('選択しました'); }
    try { navigator.clipboard.writeText(inp.value).then(function () { say('コピーしました'); }, fallback); } catch (e) { fallback(); }
  });
  $('again').addEventListener('click', function () {
    if (!meta) return;
    $('again').disabled = true;
    var oldCode = code, m = meta;
    createRoom(m.puzzleId, m.cols, m.rows, m.rotate).then(function (c) {
      db.ref('rooms/' + oldCode + '/next').set(c);
      db.ref(base).off();
      db.ref(base + '/players/' + me.id).remove();
      joined = false; clearHint(); clearRoom();
      history.pushState({}, '', '?room=' + c);
      return enterRoom(c);
    }).then(function () { $('again').disabled = false; }, function () { $('again').disabled = false; });
  });
  $('nextBtn').addEventListener('click', function () {
    var c = $('nextBtn').dataset.code; if (c) location.href = location.pathname + '?room=' + c;
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (G && !drag && code) { layout(); renderPieces(); }
      if (!$('peekWin').hidden) { drawPeek(); placePeek(); }
    }, 200);
  });

  if (window.innerWidth < 700) $('zoom').value = '2';
  requestAnimationFrame(tick);
  if (joinMode && me.name) setMsg('名前は「' + me.name + '」で参加します。変えるときは書き換えてください。');
})();
