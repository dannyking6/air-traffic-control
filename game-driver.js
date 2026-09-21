/*
 * game-driver.js — neutral offline driver for Air Traffic Control.
 * Replaces the GameSnacks developer SDK with a fully local implementation:
 * same surface, no network, no ads, local storage passthrough.
 */
(function () {
  'use strict';

  var listeners = { pause: [], resume: [], audio: [] };

  function notify(kind, value) {
    (listeners[kind] || []).slice().forEach(function (fn) {
      try { fn(value); } catch (e) { /* keep the game alive */ }
    });
  }

  var GameSnacks = {
    game: {
      ready: function () { /* no-op */ },
      firstFrameReady: function () { /* no-op */ },
      gameOver: function () { /* no-op */ },
      levelComplete: function (level) { /* no-op */ },
      onPause: function (fn) { if (typeof fn === 'function') listeners.pause.push(fn); },
      onResume: function (fn) { if (typeof fn === 'function') listeners.resume.push(fn); }
    },
    score: {
      update: function (score) { /* no-op */ }
    },
    audio: {
      isEnabled: function () { return true; },
      subscribe: function (fn) { if (typeof fn === 'function') { listeners.audio.push(fn); fn(true); } }
    },
    ad: {
      /*
       * The single most important rule for offline builds: every ad-break
       * callback the game passes in MUST be called, or the game freezes the
       * next time it fires an interstitial. We resolve immediately with a
       * benign status and never show anything.
       */
      break: function (options) {
        options = options || {};
        var o = options;
        if (o.type === 'reward') {
          if (typeof o.beforeAd === 'function') o.beforeAd();
          if (typeof o.beforeReward === 'function') {
            o.beforeReward(function showAd() {
              if (typeof o.adViewed === 'function') o.adViewed();
              if (typeof o.adBreakDone === 'function') o.adBreakDone({ type: 'reward' });
            });
          } else {
            if (typeof o.adViewed === 'function') o.adViewed();
            if (typeof o.adBreakDone === 'function') o.adBreakDone({ type: 'reward' });
          }
          if (typeof o.afterAd === 'function') o.afterAd();
        } else {
          if (typeof o.beforeAd === 'function') o.beforeAd();
          if (typeof o.afterAd === 'function') o.afterAd();
          if (typeof o.adBreakDone === 'function') o.adBreakDone({ type: o.type || 'start' });
        }
      }
    },
    storage: {
      getItem: function (key) {
        try { return window.localStorage.getItem(String(key)); } catch (e) { return null; }
      },
      setItem: function (key, value) {
        try { window.localStorage.setItem(String(key), value); } catch (e) { /* private mode */ }
      },
      removeItem: function (key) {
        try { window.localStorage.removeItem(String(key)); } catch (e) { /* private mode */ }
      },
      clear: function () {
        try { window.localStorage.clear(); } catch (e) { /* private mode */ }
      }
    }
  };

  window.GameSnacks = GameSnacks;

  /*
   * window.__wf — neutral build facade (web-game-offliner contract).
   * Lets tooling and wrappers observe and control the game without touching
   * engine internals: readiness, canvas, and pause/resume/mute controls.
   */
  var wf = {
    ready: false,
    muted: false,
    canvas: null,
    start: function () { try { cc && cc.game && cc.game.resume && cc.game.resume(); } catch (e) {} },
    pause: function () { notify('pause'); try { cc && cc.game && cc.game.pause && cc.game.pause(); } catch (e) {} },
    resume: function () { notify('resume'); try { cc && cc.game && cc.game.resume && cc.game.resume(); } catch (e) {} },
    mute: function () { wf.muted = true; notify('audio', false); },
    unmute: function () { wf.muted = false; notify('audio', true); }
  };
  Object.defineProperty(wf, 'canvas', {
    get: function () {
      var c = document.querySelector('canvas');
      return c || { width: 0, height: 0 };
    }
  });
  window.__wf = wf;

  // Readiness: the Cocos boot flow removes the #splash overlay right after
  // EVENT_AFTER_SCENE_LAUNCH — polling for it is engine-version-proof.
  var markReady = function () {
    if (wf.ready) return;
    wf.ready = true;
  };
  var readyTimer = setInterval(function () {
    try {
      var splash = document.getElementById('splash');
      var launched = window.cc && cc.director && typeof cc.director.getScene === 'function' && !!cc.director.getScene();
      if (launched && (!splash || splash.style.display === 'none')) {
        clearInterval(readyTimer); markReady();
      }
    } catch (e) { clearInterval(readyTimer); }
  }, 500);
  setTimeout(function () { clearInterval(readyTimer); }, 90000);

  // Pause/resume hooks for tab visibility, mirroring portal behaviour.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { notify('pause'); } else { notify('resume'); }
  });
})();
