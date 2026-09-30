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

  /* Songs stream through an <audio> element (light on phone memory even for long songs);
     Web Audio is used only for the volume, which iPhones don't allow on <audio> directly. */
  var ctx = null, master = null, current = null, playing = false, unlocked = false, pending = false;

  function trackById(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return null; }
  function level() { return state.muted ? 0 : Math.pow(state.vol / 100, 2) * 0.9; }
  function setMsg(t) { $('bgmMsg').textContent = t; }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = level();
      master.connect(ctx.destination);
    } catch (e) { ctx = null; master = null; }
    return ctx;
  }
  function ramp(param, to, secs) {
    var now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + secs);
  }

  function release(node, secs) {
    if (!node) return;
    var a = node.audio;
    function done() { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) {} }
    if (node.gain && ctx) { ramp(node.gain.gain, 0, secs); setTimeout(done, secs * 1000 + 60); }
    else done();
  }

  function start() {
    var t = trackById(state.track);
    if (!t) return;
    ensureCtx();
    unlockAudio();
    pending = false;
    var old = current;
    var a = new Audio();
    a.preload = 'auto';
    a.loop = !(typeof t.loopEnd === 'number');
    a.src = t.src;
    var node = { audio: a, gain: null, id: t.id };
    if (ctx) {
      try {
        var srcNode = ctx.createMediaElementSource(a), g = ctx.createGain();
        g.gain.value = 0;
        srcNode.connect(g); g.connect(master);
        node.gain = g;
      } catch (e) { node.gain = null; }
    }
    if (!node.gain) a.volume = level();
    if (typeof t.loopEnd === 'number') {
      var ls = typeof t.loopStart === 'number' ? t.loopStart : 0;
      a.addEventListener('timeupdate', function () { if (a.currentTime >= t.loopEnd) a.currentTime = ls; });
      a.addEventListener('ended', function () { a.currentTime = ls; a.play().catch(function () {}); });
    }
    a.addEventListener('waiting', function () { if (current === node) setMsg('「' + t.title + '」を読み込んでいます…'); });
    a.addEventListener('playing', function () { if (current === node) setMsg('♪ ' + t.title); });
    a.addEventListener('error', function () {
      if (current !== node) return;
      playing = false; current = null; render();
      setMsg('「' + t.title + '」を読み込めませんでした。');
    });
    current = node;
    playing = true; render();
    setMsg('「' + t.title + '」を読み込んでいます…');
    release(old, 0.8);
    var p = a.play();
    if (node.gain) ramp(node.gain.gain, 1, 1.2);
    if (p && p.catch) p.catch(function (err) {
      if (current !== node) return;
      if (err && err.name === 'NotAllowedError') {
        /* the browser wants a tap first: try again on the next one */
        pending = true; setMsg('画面をタップすると、BGMが流れます。');
      } else if (err && err.name !== 'AbortError') {
        playing = false; current = null; render();
        setMsg('「' + t.title + '」を再生できませんでした。');
      }
    });
  }
  function stop() {
    playing = false; pending = false;
    release(current, 0.5);
    current = null;
    render();
    setMsg('BGMは自分の画面だけで流れます。');
  }
  function applyLevel() {
    lsSet('jp_bgm_vol', String(state.vol)); lsSet('jp_bgm_muted', state.muted ? '1' : '0');
    if (master && ctx) ramp(master.gain, level(), 0.15);
    if (current && !current.gain) current.audio.volume = level();
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
  /* Browsers (iPhone especially) only let a page make sound inside a real tap, click or key press.
     touchend / click / keydown / mousedown are the events every browser accepts for that. */
  function unlockAudio() {
    if (!ctx) return;
    try {
      var buf = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = buf; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
  }
  /* Browsers (iPhone especially) only let a page make sound inside a real tap, click or key press. */
  function onGesture(e) {
    if (document.hidden) return;
    var inBgmUi = e.target && e.target.closest && e.target.closest('#bgmPanel, #quickMute, #navBgm');
    if (!unlocked) {
      unlocked = true;
      ensureCtx(); unlockAudio();
      if (!inBgmUi && state.on && !state.muted) start();
      return;
    }
    if (pending && playing && !inBgmUi) { start(); return; }
    if (ctx && playing && ctx.state !== 'running') unlockAudio();
    if (current && playing && current.audio.paused) current.audio.play().catch(function () {});
  }
  ['touchend', 'click', 'keydown', 'mousedown'].forEach(function (n) { document.addEventListener(n, onGesture, true); });

  /* Pause while the tab is in the background. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (current) current.audio.pause();
      if (ctx) ctx.suspend();
      return;
    }
    if (!playing || !current) return;
    if (ctx) ctx.resume();
    current.audio.play().catch(function () { pending = true; });
  });
})();
