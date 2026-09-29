/* BGM player and the blinking girl in the background. Everything here is per viewer:
   music choice, volume and mute are remembered in this browser only. */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var TRACKS = CFG.bgm || [];
  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------------- blink ---------------- */
  (function blink() {
    var el = $('blink');
    if (!el) return;
    function close(ms, then) { el.classList.add('on'); setTimeout(function () { el.classList.remove('on'); if (then) then(); }, ms); }
    function next() {
      setTimeout(function () {
        if (document.hidden) { next(); return; }
        if (Math.random() < 0.2) close(110, function () { setTimeout(function () { close(110, next); }, 170); });
        else close(130, next);
      }, 2400 + Math.random() * 3800);
    }
    var img = new Image();
    img.onload = next;
    img.src = el.src;
  })();

  /* ---------------- music ---------------- */
  var state = {
    track: lsGet('jp_bgm_track') || (TRACKS[0] && TRACKS[0].id) || '',
    vol: lsGet('jp_bgm_vol') !== null ? Math.max(0, Math.min(100, +lsGet('jp_bgm_vol') || 0)) : 40,
    muted: lsGet('jp_bgm_muted') === '1',
    on: lsGet('jp_bgm_on') !== '0'
  };
  if (!TRACKS.some(function (t) { return t.id === state.track; }) && TRACKS[0]) state.track = TRACKS[0].id;

  var ctx = null, master = null, current = null, buffers = {}, loading = {}, playing = false, unlocked = false, loadToken = 0;

  function trackById(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return null; }
  function level() { return state.muted ? 0 : Math.pow(state.vol / 100, 2) * 0.9; }
  function setMsg(t) { $('bgmMsg').textContent = t; }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
    return ctx;
  }
  function decode(ab) {
    return new Promise(function (resolve, reject) {
      var p = ctx.decodeAudioData(ab, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  function load(t) {
    if (buffers[t.id]) return Promise.resolve(buffers[t.id]);
    if (loading[t.id]) return loading[t.id];
    loading[t.id] = fetch(t.src).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(decode).then(function (buf) {
      /* keep only the most recent track in memory */
      buffers = {}; buffers[t.id] = buf; delete loading[t.id];
      return buf;
    }, function (err) { delete loading[t.id]; throw err; });
    return loading[t.id];
  }

  function fadeOutAndStop(node, secs) {
    if (!node) return;
    var now = ctx.currentTime;
    try {
      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(node.gain.gain.value, now);
      node.gain.gain.linearRampToValueAtTime(0, now + secs);
      node.src.stop(now + secs + 0.05);
    } catch (e) {}
  }

  function start() {
    if (!ensureCtx()) { setMsg('このブラウザではBGMを再生できません。'); return; }
    var t = trackById(state.track);
    if (!t) return;
    if (ctx.state === 'suspended') ctx.resume();
    var token = ++loadToken;
    playing = true; render();
    if (!buffers[t.id]) setMsg('「' + t.title + '」を読み込んでいます…');
    load(t).then(function (buf) {
      if (token !== loadToken || !playing) return;
      fadeOutAndStop(current, 0.8);
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      var ls = typeof t.loopStart === 'number' ? t.loopStart : 0;
      var le = typeof t.loopEnd === 'number' ? Math.min(t.loopEnd, buf.duration) : buf.duration;
      if (le > ls) { src.loopStart = ls; src.loopEnd = le; }
      g.gain.value = 0;
      src.connect(g); g.connect(master);
      src.start(0, ls);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
      current = { src: src, gain: g, id: t.id };
      setMsg('♪ ' + t.title);
    }, function () {
      if (token !== loadToken) return;
      playing = false; render();
      setMsg('「' + t.title + '」を読み込めませんでした。');
    });
  }
  function stop() {
    loadToken++;
    playing = false;
    if (ctx) fadeOutAndStop(current, 0.5);
    current = null;
    render();
    setMsg('BGMは自分の画面だけで流れます。');
  }
  function applyLevel() {
    lsSet('jp_bgm_vol', String(state.vol)); lsSet('jp_bgm_muted', state.muted ? '1' : '0');
    if (master) {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(level(), now + 0.15);
    }
    render();
  }

  /* ---------------- UI ---------------- */
  function icon(btn, id) { var u = btn.querySelector('use'); if (u) u.setAttribute('href', id); }
  function render() {
    var list = $('tracks');
    list.querySelectorAll('.track').forEach(function (b) {
      var on = b.dataset.id === state.track;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('i').textContent = on && playing ? '♪' : '';
    });
    var pb = $('bgmPlay');
    icon(pb, playing ? '#i-pause' : '#i-play');
    pb.querySelector('span').textContent = playing ? '停止' : '再生';
    var mb = $('bgmMute'), qm = $('quickMute');
    mb.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
    icon(mb, state.muted ? '#i-mute' : '#i-sound');
    mb.querySelector('span').textContent = state.muted ? 'ミュート中' : 'ミュート';
    mb.title = state.muted ? '音を戻す' : '音を消す';
    var silent = state.muted || !playing;
    qm.setAttribute('aria-pressed', silent ? 'false' : 'true');
    icon(qm, silent ? '#i-mute' : '#i-sound');
    qm.setAttribute('aria-label', silent ? 'BGMを流す' : 'BGMを消す');
    $('vol').value = state.vol;
    $('volOut').textContent = state.vol;
  }
  function buildList() {
    var list = $('tracks');
    list.textContent = '';
    TRACKS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'track'; b.dataset.id = t.id;
      var i = document.createElement('i'); b.appendChild(i);
      b.appendChild(document.createTextNode(t.title));
      b.addEventListener('click', function () {
        unlocked = true;
        state.track = t.id; lsSet('jp_bgm_track', t.id);
        state.on = true; lsSet('jp_bgm_on', '1');
        if (state.muted) { state.muted = false; applyLevel(); }
        start();
      });
      list.appendChild(b);
    });
  }

  function togglePanel(open) {
    var p = $('bgmPanel'), nav = $('navBgm');
    var show = typeof open === 'boolean' ? open : p.hidden;
    p.hidden = !show;
    nav.setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  if (!TRACKS.length) { $('navBgm').hidden = true; $('quickMute').hidden = true; return; }
  buildList(); render();

  $('navBgm').addEventListener('click', function () { togglePanel(); });
  $('bgmClose').addEventListener('click', function () { togglePanel(false); $('navBgm').focus(); });
  $('bgmPlay').addEventListener('click', function () {
    unlocked = true;
    if (playing) { state.on = false; lsSet('jp_bgm_on', '0'); stop(); }
    else { state.on = true; lsSet('jp_bgm_on', '1'); start(); }
  });
  $('bgmMute').addEventListener('click', function () { state.muted = !state.muted; applyLevel(); });
  $('vol').addEventListener('input', function () {
    state.vol = +this.value;
    if (state.muted && state.vol > 0) state.muted = false;
    applyLevel();
  });
  $('quickMute').addEventListener('click', function () {
    unlocked = true;
    if (!playing) { state.on = true; lsSet('jp_bgm_on', '1'); if (state.muted) { state.muted = false; applyLevel(); } start(); return; }
    state.muted = !state.muted; applyLevel();
  });

  /* Browsers only allow sound after the viewer does something, so music starts on the first tap or key. */
  function firstGesture(e) {
    if (unlocked) return cleanup();
    if (e.target && e.target.closest && e.target.closest('#bgmPanel, #quickMute')) return cleanup();
    unlocked = true;
    cleanup();
    if (state.on && !state.muted) start();
    else ensureCtx();
  }
  /* pointerup/touchend (not pointerdown) are what phones accept as permission to play sound */
  var GESTURES = ['pointerup', 'touchend', 'keydown', 'click'];
  function cleanup() { GESTURES.forEach(function (n) { document.removeEventListener(n, firstGesture, true); }); }
  GESTURES.forEach(function (n) { document.addEventListener(n, firstGesture, true); });
  /* if the audio engine was created too early and is still asleep, wake it on the next tap */
  ['pointerup', 'touchend', 'keydown'].forEach(function (n) {
    document.addEventListener(n, function () { if (ctx && playing && ctx.state === 'suspended' && !document.hidden) ctx.resume(); }, true);
  });

  /* Pause while the tab is in the background. */
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (playing) ctx.resume();
  });
})();
