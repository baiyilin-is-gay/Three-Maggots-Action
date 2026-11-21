/* =========================================================
   main.js — 启动与固定步长循环
   ========================================================= */
'use strict';

(function () {
  const FIXED = 1 / 120;

  function boot() {
    Game.init();
    Game.lastT = performance.now();
    Game._acc = 0;

    function frame(ts) {
      requestAnimationFrame(frame);
      if (Game.state !== 'raid' || !Game.g) {
        Game.lastT = ts;
        Input.endFrame();
        return;
      }
      let dt = (ts - Game.lastT) / 1000;
      Game.lastT = ts;
      if (dt > .1) dt = .1;
      if (dt <= 0) return;
      const g = Game.g;
      if (g.paused) { Game.renderRaid(g, 0); Input.endFrame(); return; }
      Game._acc += dt;
      let steps = 0;
      while (Game._acc >= FIXED && steps < 6) {
        Game.simulate(g, FIXED);
        Game._acc -= FIXED;
        steps++;
        if (g.ended) { Game._acc = 0; break; }
      }
      if (steps >= 6) Game._acc = 0;
      Game.renderRaid(g, dt);
      Audio2.updateMusic(dt);
    }
    requestAnimationFrame(frame);

    // 防止页面失去焦点后时间跳变
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) Game.lastT = performance.now();
    });

    // 移动端兜底提示
    if ('ontouchstart' in window && innerWidth < 900) {
      setTimeout(() => {
        if (Game.state === 'title') {
          UI.toastModal('建议使用键鼠', '《三个蛆行动》需要键盘与鼠标：WASD 移动、鼠标瞄准、左键射击。手机端体验不佳。');
        }
      }, 600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
