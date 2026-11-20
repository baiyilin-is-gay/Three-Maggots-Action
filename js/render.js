/* =========================================================
   render.js — 所有绘制：场景、虫体、敌人、武器、特效、小地图
   ========================================================= */
'use strict';

const Render = {
  ctx: null,
  canvas: null,
  dpr: 1,
  lightCanvas: null,
  lightCtx: null,
  vignette: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.lightCanvas.width = Math.ceil(w / 3);
    this.lightCanvas.height = Math.ceil(h / 3);
    this.W = w; this.H = h;
  },

  /* ---------- 场景 ---------- */
  drawWorld(g) {
    const ctx = this.ctx, cam = g.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g.map.palette.fog || '#080a08';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    ctx.translate(Shake.x, Shake.y);
    cam.apply(ctx);
    this.drawFloor(g, cam);
    this.drawWalls(g, cam);

    // 地面贴花：撤离点、菌毯
    for (const z of g.extracts) if (cam.visible(z.x, z.y, z.r + 60)) this.drawExtract(ctx, z, g.time);
    for (const p of g.puddles) if (cam.visible(p.x, p.y, p.r + 20)) this.drawPuddle(ctx, p, g.time);
    for (const pr of g.props) if (cam.visible(pr.x, pr.y, 70)) this.drawProp(ctx, pr);

    // 物资容器
    for (const c of g.containers) if (!c.done && cam.visible(c.x, c.y, 70)) this.drawContainer(ctx, c, g.time);
    // 掉落物
    for (const it of g.groundItems) if (cam.visible(it.x, it.y, 40)) this.drawGroundItem(ctx, it, g.time);

    // 敌人
    for (const e of g.enemies) if (e.alive && cam.visible(e.x, e.y, 140)) this.drawEnemy(ctx, e, g.time);
    // 蛆虫（队友 -> 玩家，玩家在最上层）
    for (const w of g.worms) if (w.alive && w !== g.active) this.drawWorm(ctx, w, g);
    if (g.active && g.active.alive) this.drawWorm(ctx, g.active, g);

    // 弹道 / 手雷 / 酸液
    for (const b of g.bullets) if (cam.visible(b.x, b.y, 60)) this.drawBullet(ctx, b);
    for (const b of g.acids) if (cam.visible(b.x, b.y, b.r + 20)) this.drawAcid(ctx, b, g.time);
    for (const gr of g.grenades) if (cam.visible(gr.x, gr.y, 40)) this.drawGrenade(ctx, gr);
    for (const s of g.smokes) if (cam.visible(s.x, s.y, s.r + 40)) this.drawSmoke(ctx, s, g.time);

    // 粒子
    g.particles.draw(ctx);

    // 伤害数字
    this.drawPopups(ctx, g.popups);

    ctx.restore();
    this.drawLighting(g);
    this.drawScreenEffects(g);
  },

  drawFloor(g, cam) {
    const ctx = this.ctx, TS = BAL.TILE, map = g.map, tex = map.floorTex;
    const z = cam.zoom;
    let vx = cam.x - this.W / 2 / z - 80, vy = cam.y - this.H / 2 / z - 80;
    let vw = this.W / z + 160, vh = this.H / z + 160;
    vx = clamp(vx, 0, map.px - 1); vy = clamp(vy, 0, map.py - 1);
    vw = Math.min(vw, map.px - vx); vh = Math.min(vh, map.py - vy);
    if (vw <= 0 || vh <= 0) return;
    ctx.drawImage(tex, vx, vy, vw, vh, vx, vy, vw, vh);
  },

  drawWalls(g, cam) {
    // 墙体已烘焙进 map.floorTex，这里保留空实现（供旧调用）
  },

  drawPuddle(ctx, p, time) {
    const wob = Math.sin(time * .8 + p.ph) * 2;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = .28;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r + wob, p.r * .68 + wob * .5, p.rot, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawProp(ctx, pr) {
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.rot);
    if (pr.type === 'pipe') {
      ctx.fillStyle = '#2b3227';
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h);
      ctx.fillStyle = '#3c4535';
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, 4);
      ctx.fillStyle = '#1d221b';
      ctx.fillRect(-pr.w / 2, pr.h / 2 - 3, pr.w, 3);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#4a5440';
        ctx.fillRect(-pr.w / 2 + i * pr.w / 3 + 3, -pr.h / 2 - 2, 5, pr.h + 4);
      }
    } else if (pr.type === 'bone') {
      ctx.strokeStyle = '#8b8672'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-pr.w / 2, 0); ctx.lineTo(pr.w / 2, 0); ctx.stroke();
      ctx.fillStyle = '#a09a84';
      ctx.beginPath(); ctx.arc(-pr.w / 2, 0, 3.5, 0, TAU); ctx.arc(pr.w / 2, 0, 3.5, 0, TAU); ctx.fill();
    } else if (pr.type === 'moss') {
      ctx.fillStyle = 'rgba(110,150,80,.16)';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, rr = pr.w * (0.6 + hash2(i, pr.seed, 3) * .5);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr * .7);
      }
      ctx.closePath(); ctx.fill();
    } else if (pr.type === 'skull') {
      ctx.fillStyle = '#b8b29a';
      ctx.beginPath(); ctx.arc(0, 0, pr.w * .35, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a261e';
      ctx.beginPath(); ctx.arc(-pr.w * .12, -2, 2.6, 0, TAU); ctx.arc(pr.w * .12, -2, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8b29a';
      ctx.fillRect(-pr.w * .18, pr.w * .22, pr.w * .36, pr.h * .3);
    } else if (pr.type === 'cable') {
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-pr.w / 2, 0);
      for (let i = 1; i <= 6; i++) ctx.lineTo(-pr.w / 2 + pr.w * i / 6, Math.sin(i * 1.7 + pr.seed) * 5);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawExtract(ctx, z, time) {
    const pulse = .5 + .5 * Math.sin(time * 2.2);
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.globalAlpha = .18 + pulse * .12;
    ctx.fillStyle = z.active ? '#b8f24a' : '#ffb02e';
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = .8;
    ctx.strokeStyle = z.active ? '#b8f24a' : '#ffb02e';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 24;
    ctx.beginPath(); ctx.arc(0, 0, z.r - 4, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // 内部方向标记
    ctx.globalAlpha = .5 + pulse * .3;
    ctx.beginPath(); ctx.arc(0, 0, z.r * .4, 0, TAU); ctx.stroke();
    // 顶部箭头
    ctx.fillStyle = z.active ? '#b8f24a' : '#ffb02e';
    ctx.globalAlpha = .85;
    ctx.beginPath();
    const bob = Math.sin(time * 3) * 4;
    ctx.moveTo(0, -z.r * .55 + bob); ctx.lineTo(-14, -z.r * .55 - 16 + bob); ctx.lineTo(14, -z.r * .55 - 16 + bob);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .9;
    ctx.font = 'bold 12px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = z.active ? '#d7ffa0' : '#ffd27a';
    ctx.fillText(z.label || '撤离点', 0, z.r + 20);
    if (z.cost) ctx.fillText('◇ ' + fmt(z.cost), 0, z.r + 36);
    ctx.restore();
  },

  drawContainer(ctx, c, time) {
    const bob = Math.sin(time * 1.8 + c.ph) * 1.2;
    const r = c.r || 15;
    ctx.save(); ctx.translate(c.x, c.y + bob);
    // 地面光环
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.6);
    glow.addColorStop(0, RARITY[c.maxRarity || 0].glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.fill();
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(2, r * .7, r * 1.05, r * .42, 0, 0, TAU); ctx.fill();
    // 箱体
    ctx.fillStyle = '#141813';
    ctx.strokeStyle = c.color || '#8ea25a';
    ctx.lineWidth = 1.6;
    this.roundRect(ctx, -r, -r * .85, r * 2, r * 1.7, 2.5);
    ctx.fill(); ctx.stroke();
    // 箱盖
    ctx.fillStyle = c.color || '#8ea25a';
    ctx.globalAlpha = .8;
    this.roundRect(ctx, -r, -r * .85, r * 2, r * .55, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 金属条
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(-r * .55, -r * .3, 2.5, r * 1.1);
    ctx.fillRect(r * .45, -r * .3, 2.5, r * 1.1);
    // 锁扣
    ctx.fillStyle = c.color || '#8ea25a';
    ctx.fillRect(-2.5, -r * .32, 5, 5);
    // 已搜
    if (c.opened) {
      ctx.strokeStyle = 'rgba(150,160,140,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-r * .45, -r * .25); ctx.lineTo(r * .45, r * .35); ctx.moveTo(r * .45, -r * .25); ctx.lineTo(-r * .45, r * .35); ctx.stroke();
    }
    ctx.restore();
  },

  drawGroundItem(ctx, it, time) {
    const bob = Math.sin(time * 3 + (it.ph || 0)) * 3;
    const col = RARITY[it.rarity].color;
    ctx.save(); ctx.translate(it.x, it.y + bob);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    g.addColorStop(0, RARITY[it.rarity].glow); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); ctx.stroke();
    ctx.restore();
  },

  /* ---------- 蛆虫 ---------- */
  drawWorm(ctx, w, g) {
    const S = w.segs;
    if (!S || S.length < 2) return;
    const baseR = w.radius || 14;
    const flash = w.hurtT > 0 ? (Math.sin(w.hurtT * 60) > 0 ? 1 : 0) : 0;
    const active = w === g.active;

    // 地面影子
    ctx.save();
    ctx.globalAlpha = .3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      ctx.moveTo(s.x + baseR * .8, s.y + baseR * .7);
      ctx.arc(s.x + baseR * .3, s.y + baseR * .6, baseR * .75 * (1 - i / S.length * .45), 0, TAU);
    }
    ctx.fill();
    ctx.restore();

    // 角色光晕（让主角在黑暗中可读）
    ctx.save();
    const tint = w.def.color;
    const halo = ctx.createRadialGradient(w.x, w.y, baseR * .4, w.x, w.y, baseR * 3.6);
    halo.addColorStop(0, 'rgba(255,255,255,.10)');
    halo.addColorStop(.45, w.def.id === 'green' ? 'rgba(184,242,74,.10)' : w.def.id === 'yellow' ? 'rgba(255,210,74,.10)' : 'rgba(185,139,255,.10)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(w.x, w.y, baseR * 3.6, 0, TAU); ctx.fill();
    ctx.restore();

    // 选择环
    if (active) {
      ctx.save();
      ctx.strokeStyle = w.def.color; ctx.globalAlpha = .35 + .15 * Math.sin(g.time * 4);
      ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -g.time * 30;
      ctx.beginPath(); ctx.arc(w.x, w.y, baseR + 12, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // 身体：从尾到头
    const bodyCol = flash ? '#ffffff' : w.def.color;
    const bodyCol2 = flash ? '#ffffff' : w.def.color2;
    const dark = w.def.colorDark;
    for (let i = S.length - 1; i >= 1; i--) {
      const s = S[i];
      const t = i / (S.length - 1);
      const r = baseR * (1 - t * .62);
      // 外圈深色
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(s.x, s.y, r + 1.6, 0, TAU); ctx.fill();
      // 主体双层
      ctx.fillStyle = bodyCol2;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = bodyCol;
      ctx.beginPath(); ctx.arc(s.x - r * .22, s.y - r * .26, r * .7, 0, TAU); ctx.fill();
      // 环节
      if (i % 2 === 0) {
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(s.x, s.y, r * .82, w.aim - 1.4, w.aim + 1.4); ctx.stroke();
      }
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,.30)';
      ctx.beginPath(); ctx.ellipse(s.x - r * .32, s.y - r * .36, r * .3, r * .16, -0.6 + w.aim, 0, TAU); ctx.fill();
    }

    // 头部
    const h = S[0];
    const hr = baseR * 1.06;
    const ex = Math.cos(w.aim), ey = Math.sin(w.aim);
    const px = -ey, py = ex;
    const hg = ctx.createRadialGradient(h.x - hr * .4, h.y - hr * .45, hr * .2, h.x, h.y, hr);
    hg.addColorStop(0, flash ? '#fff' : w.def.color);
    hg.addColorStop(.7, flash ? '#fff' : w.def.color2);
    hg.addColorStop(1, dark);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.stroke();

    // 装备（先画，避免遮住眼睛）
    this.drawWormGear(ctx, w, h, hr, ex, ey, px, py);

    // 眼睛（朝瞄准方向）
    const eyeD = hr * .5;
    for (const side of [-1, 1]) {
      const exx = h.x + ex * eyeD * .7 + px * side * hr * .38;
      const eyy = h.y + ey * eyeD * .7 + py * side * hr * .38;
      ctx.fillStyle = '#f4f7e8';
      ctx.beginPath(); ctx.arc(exx, eyy, hr * .24, 0, TAU); ctx.fill();
      ctx.fillStyle = '#12140f';
      ctx.beginPath(); ctx.arc(exx + ex * 1.6, eyy + ey * 1.6, hr * .12, 0, TAU); ctx.fill();
    }
    // 嘴
    ctx.strokeStyle = 'rgba(30,20,10,.6)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(h.x + ex * hr * .5, h.y + ey * hr * .5, hr * .3, w.aim - .5, w.aim + .5); ctx.stroke();

    // 武器
    this.drawWormWeapon(ctx, w, h, hr, ex, ey, px, py);

    // 姓名（仅队友）
    if (!active) {
      ctx.save();
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = w.def.color;
      ctx.globalAlpha = .9;
      ctx.fillText('『' + w.def.name + '』', w.x, w.y - baseR - 16);
      ctx.restore();
    }
    // 低血量提示
    if (w.hp < w.maxHp * .3 && w.alive) {
      ctx.save();
      ctx.globalAlpha = .6 + .4 * Math.sin(g.time * 8);
      ctx.fillStyle = '#ff4a3d';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', w.x, w.y - baseR - 22);
      ctx.restore();
    }
  },

  drawWormGear(ctx, w, h, hr, ex, ey, px, py) {
    const id = w.def.id;
    ctx.save();
    if (id === 'green') {
      // 军需官：头盔 + 天线 + 腰包
      ctx.fillStyle = '#55673c';
      ctx.beginPath(); ctx.arc(h.x - ex * hr * .1, h.y - ey * hr * .1, hr * .8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b7f4a';
      ctx.beginPath(); ctx.arc(h.x - ex * hr * .22, h.y - ey * hr * .22, hr * .56, 0, TAU); ctx.fill();
      // 头盔高光边
      ctx.strokeStyle = 'rgba(200,240,150,.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(h.x - ex * hr * .1, h.y - ey * hr * .1, hr * .8, w.aim - 2.4, w.aim - .9); ctx.stroke();
      ctx.strokeStyle = '#9fb46a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(h.x + px * hr * .7, h.y + py * hr * .7);
      ctx.lineTo(h.x + px * hr * .7 - ex * 2, h.y + py * hr * .7 - ey * 2 - 14); ctx.stroke();
      ctx.fillStyle = '#b8f24a';
      ctx.beginPath(); ctx.arc(h.x + px * hr * .7 - ex * 2, h.y + py * hr * .7 - ey * 2 - 15, 2.2, 0, TAU); ctx.fill();
      // 战术眼镜（朝向侧）
      ctx.fillStyle = 'rgba(150,255,220,.35)';
      ctx.fillRect(h.x + ex * hr * .32 - px * hr * .5, h.y + ey * hr * .32 - py * hr * .5, 8, 7);
    } else if (id === 'yellow') {
      // 侦察兵：头巾 + 单目镜 + 小旗
      ctx.fillStyle = '#b8890e';
      ctx.beginPath(); ctx.arc(h.x - ex * hr * .25, h.y - ey * hr * .25, hr * .9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(h.x - ex * hr * .3, h.y - ey * hr * .3, hr * .72, 0, TAU); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(h.x + ex * hr * .5 + px * hr * .32, h.y + ey * hr * .5 + py * hr * .32, hr * .26, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,255,200,.8)';
      ctx.beginPath(); ctx.arc(h.x + ex * hr * .5 + px * hr * .32, h.y + ey * hr * .5 + py * hr * .32, hr * .16, 0, TAU); ctx.fill();
      // 尾巴飘带
      const t = w.segs[w.segs.length - 1];
      ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(t.x + Math.sin(performance.now() / 200) * 10, t.y + 10, t.x + Math.sin(performance.now() / 160) * 16, t.y + 22);
      ctx.stroke();
    } else {
      // 重装：厚重甲片 + 肩甲 + 铆钉
      ctx.fillStyle = '#4a3570';
      ctx.beginPath(); ctx.arc(h.x - ex * hr * .1, h.y - ey * hr * .1, hr * .95, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + .5;
        ctx.fillStyle = '#7c5ab8';
        ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * hr * .9, h.y + Math.sin(a) * hr * .9, hr * .28, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1d40';
        ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * hr * .9, h.y + Math.sin(a) * hr * .9, hr * .12, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(220,180,255,.5)';
      ctx.fillRect(h.x + ex * hr * .4 - px * hr * .45, h.y + ey * hr * .4 - py * hr * .45, 9, 5);
    }
    // 护盾特效
    if (w.shieldT > 0) {
      ctx.strokeStyle = 'rgba(190,150,255,' + (.35 + .25 * Math.sin(performance.now() / 90)) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w.x, w.y, (w.radius || 14) + 11, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(190,150,255,.15)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(w.x, w.y, (w.radius || 14) + 11, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  },

  drawWormWeapon(ctx, w, h, hr, ex, ey, px, py) {
    if (!w.weapon) return;
    const type = w.weapon.type;
    const kick = w.recoilKick || 0;
    const gx = h.x + ex * (hr * .6 - kick * 3), gy = h.y + ey * (hr * .6 - kick * 3);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(w.aim);
    ctx.fillStyle = '#20241d';
    ctx.strokeStyle = '#3d4536';
    ctx.lineWidth = 1;
    if (type === 'shotgun') {
      ctx.fillRect(-6, -4, 26, 8);
      ctx.fillStyle = '#333b2c'; ctx.fillRect(4, -5.5, 16, 3);
      ctx.fillStyle = '#5a4630'; ctx.fillRect(-10, -3, 6, 6);
    } else if (type === 'rifle' || type === 'dmr') {
      ctx.fillRect(-6, -3, 28, 6);
      ctx.fillStyle = '#333b2c'; ctx.fillRect(6, -2, 14, 2);
      ctx.fillStyle = '#2b3225'; ctx.fillRect(-2, 2, 5, 7);
      if (type === 'dmr') { ctx.fillStyle = '#333'; ctx.fillRect(2, -8, 12, 4); }
    } else if (type === 'smg') {
      ctx.fillRect(-5, -3, 18, 6);
      ctx.fillStyle = '#333b2c'; ctx.fillRect(2, 2, 4, 6);
    } else {
      ctx.fillRect(-4, -2.5, 14, 5);
    }
    // 枪口火光
    if (kick > .5) {
      const l = 8 + kick * 12;
      ctx.fillStyle = 'rgba(255,230,140,' + (.5 + kick * .5) + ')';
      ctx.beginPath();
      ctx.moveTo(20, -4 * kick); ctx.lineTo(20 + l, 0); ctx.lineTo(20, 4 * kick);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,220,.9)';
      ctx.beginPath(); ctx.arc(20, 0, 2.5 * kick, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  /* ---------- 敌人 ---------- */
  drawEnemy(ctx, e, time) {
    if (!isFinite(e.x) || !isFinite(e.y)) return;
    const d = e.def;
    const r = d.radius;
    const flash = e.hurtT > 0;
    const S = e.segs || [];
    for (const s of S) { if (!isFinite(s.x) || !isFinite(s.y)) { s.x = e.x; s.y = e.y; } }
    ctx.save();
    // 影子
    ctx.globalAlpha = .3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(e.x + 3, e.y + 5, r * .9, r * .6, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // 身体节段（白蛆也一样是蛆）——纯色双层填充，避免逐段渐变开销
    for (let i = S.length - 1; i >= 1; i--) {
      const s = S[i], t = i / S.length;
      const rr = r * (1 - t * .5);
      ctx.fillStyle = flash ? '#ffffff' : d.colorDark;
      ctx.beginPath(); ctx.arc(s.x, s.y, rr + 1.2, 0, TAU); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : d.color2;
      ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : d.color;
      ctx.beginPath(); ctx.arc(s.x - rr * .2, s.y - rr * .26, rr * .68, 0, TAU); ctx.fill();
    }
    const hr = r;
    ctx.fillStyle = flash ? '#ffffff' : d.colorDark;
    ctx.beginPath(); ctx.arc(e.x, e.y, hr + 1.5, 0, TAU); ctx.fill();
    const hg = ctx.createRadialGradient(e.x - hr * .35, e.y - hr * .4, hr * .15, e.x, e.y, hr);
    hg.addColorStop(0, flash ? '#fff' : d.color);
    hg.addColorStop(.7, flash ? '#fff' : d.color2);
    hg.addColorStop(1, d.colorDark);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(e.x, e.y, hr, 0, TAU); ctx.fill();

    // 甲壳冲撞兽：背甲
    if (d.id === 'brute') {
      ctx.strokeStyle = '#6b573e'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, hr * (.9 - i * .22), e.aim - 1.1, e.aim + 1.1);
        ctx.stroke();
      }
      ctx.fillStyle = '#8e7a60';
      for (let i = 0; i < 5; i++) {
        const a = e.aim - .8 + i * .4;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * hr * .8, e.y + Math.sin(a) * hr * .8);
        ctx.lineTo(e.x + Math.cos(a) * (hr + 8), e.y + Math.sin(a) * (hr + 8));
        ctx.lineWidth = 3; ctx.strokeStyle = '#b09a7c'; ctx.stroke();
      }
    }
    // 喷吐者：背囊
    if (d.id === 'spitter') {
      const pu = 1 + Math.sin(time * 3 + e.seed) * .08;
      ctx.fillStyle = 'rgba(190,255,70,.5)';
      ctx.beginPath(); ctx.arc(e.x - Math.cos(e.aim) * hr * .4, e.y - Math.sin(e.aim) * hr * .4, hr * .7 * pu, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(230,255,140,.8)';
      ctx.beginPath(); ctx.arc(e.x - Math.cos(e.aim) * hr * .4, e.y - Math.sin(e.aim) * hr * .4, hr * .35 * pu, 0, TAU); ctx.fill();
    }
    // 侍从：光环
    if (d.healAura) {
      ctx.strokeStyle = 'rgba(220,150,255,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, hr + 9 + Math.sin(time * 2) * 3, 0, TAU); ctx.stroke();
    }
    // 眼睛
    const ex = Math.cos(e.aim), ey = Math.sin(e.aim), px = -ey, py = ex;
    for (const side of [-1, 1]) {
      const exx = e.x + ex * hr * .5 + px * side * hr * .34;
      const eyy = e.y + ey * hr * .5 + py * side * hr * .34;
      ctx.fillStyle = '#1a1a14';
      ctx.beginPath(); ctx.arc(exx, eyy, hr * .22, 0, TAU); ctx.fill();
      ctx.fillStyle = d.colorEye || '#ff4a3d';
      ctx.shadowColor = d.colorEye || '#ff4a3d'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(exx, eyy, hr * .11, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 血条
    if (e.hp < e.maxHp) {
      const wbar = r * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(e.x - wbar / 2, e.y - r - 13, wbar, 4);
      ctx.fillStyle = d.boss ? '#ff5a8a' : '#ff6a4a';
      ctx.fillRect(e.x - wbar / 2, e.y - r - 13, wbar * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
    // 警觉标记
    if (e.state === 'chase' && e.alertT > 0) {
      ctx.fillStyle = '#ff4a3d';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', e.x, e.y - r - 20);
    }
    if (e.state === 'search') {
      ctx.fillStyle = 'rgba(255,176,46,.85)';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', e.x, e.y - r - 20);
    }
    ctx.restore();
  },

  /* ---------- 弹药 ---------- */
  drawBullet(ctx, b) {
    if (b.kind === 'enemy' || b.kind === 'acid') {
      const col = b.kind === 'acid' ? '#c8f24a' : '#ff8a5a';
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = b.kind === 'acid' ? 5 : 2.5;
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * .012, b.y - b.vy * .012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.kind === 'acid' ? 4 : 2, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = b.color || 'rgba(255,240,170,.9)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = b.color || 'rgba(255,230,150,.8)'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * .018, b.y - b.vy * .018);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  },
  drawAcid(ctx, b, time) {
    const fade = clamp(b.life / 2.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = .55 * fade;
    // 有机形状的三团重叠液面
    for (let i = 0; i < 3; i++) {
      const a = b.ph + i * 2.1 + Math.sin(time * 1.3 + i) * .18;
      const rr = b.r * (0.68 + i * .12);
      const ox = Math.cos(a) * b.r * .28, oy = Math.sin(a) * b.r * .2;
      const g = ctx.createRadialGradient(b.x + ox, b.y + oy, 0, b.x + ox, b.y + oy, rr);
      g.addColorStop(0, 'rgba(160,230,50,.5)');
      g.addColorStop(.7, 'rgba(120,190,40,.30)');
      g.addColorStop(1, 'rgba(90,150,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x + ox, b.y + oy, rr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = .3 * fade;
    ctx.strokeStyle = 'rgba(200,255,90,.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .95, 0, TAU); ctx.stroke();
    // 冒泡
    ctx.globalAlpha = .5 * fade;
    ctx.fillStyle = 'rgba(210,255,120,.8)';
    for (let i = 0; i < 3; i++) {
      const bp = (time * .5 + i * .37) % 1;
      const bx = b.x + Math.cos(b.ph + i * 2.4) * b.r * .5;
      const by = b.y + Math.sin(b.ph + i * 2.4) * b.r * .35 - bp * 6;
      ctx.beginPath(); ctx.arc(bx, by, 1.4 * (1 - bp), 0, TAU); ctx.fill();
    }
    ctx.restore();
  },
  drawGrenade(ctx, gr) {
    const t = gr.fuse / gr.fuseMax;
    ctx.save();
    ctx.translate(gr.x, gr.y - (gr.height || 0));
    // 落点指示
    ctx.strokeStyle = 'rgba(255,120,90,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, (gr.height || 0), 7, 0, TAU); ctx.stroke();
    ctx.rotate(gr.spin || 0);
    ctx.fillStyle = t < .33 ? '#ff6a4a' : '#3c4a2a';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(-2, -7, 4, 4);
    if (t < .33 && Math.sin(t * 90) > 0) {
      ctx.fillStyle = '#ff4a3d'; ctx.shadowColor = '#ff4a3d'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  },
  drawSmoke(ctx, s, time) {
    const a = clamp(s.life / s.maxLife, 0, 1) * .5;
    for (let i = 0; i < 7; i++) {
      const off = hash2(i, s.seed, 5);
      const px = s.x + Math.cos(off * TAU + time * .3) * s.r * .55;
      const py = s.y + Math.sin(off * TAU + time * .24) * s.r * .4;
      ctx.fillStyle = 'rgba(120,150,110,' + (a * (.5 + off * .5)) + ')';
      ctx.beginPath(); ctx.arc(px, py, s.r * (.35 + off * .35), 0, TAU); ctx.fill();
    }
  },

  /* ---------- 光照与屏幕效果 ---------- */
  drawLighting(g) {
    const lc = this.lightCtx, lw = this.lightCanvas.width, lh = this.lightCanvas.height;
    const cam = g.camera;
    const dark = g.map.palette.deco === 'flesh' ? .82 : .76;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = 'rgba(3,5,4,' + dark + ')';
    lc.fillRect(0, 0, lw, lh);

    // 挖出光照区域
    lc.globalCompositeOperation = 'destination-out';
    const drawLight = (wx, wy, radius, strength) => {
      const sx = (wx - cam.x) * cam.zoom + this.W / 2;
      const sy = (wy - cam.y) * cam.zoom + this.H / 2;
      const r = radius * cam.zoom / 3;
      const x = sx / 3, y = sy / 3;
      const grd = lc.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
      grd.addColorStop(.55, 'rgba(0,0,0,' + strength * .75 + ')');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = grd;
      lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
    };
    // 手电筒锥形（朝向鼠标）
    const w = g.active;
    if (w && w.alive) {
      drawLight(w.x, w.y, 430, 1);
      // 锥形
      const sx = (w.x - cam.x) * cam.zoom + this.W / 2, sy = (w.y - cam.y) * cam.zoom + this.H / 2;
      lc.save();
      lc.translate(sx / 3, sy / 3);
      lc.rotate(w.aim);
      const coneLen = 680 * cam.zoom / 3, coneW = 560 * cam.zoom / 3;
      const cg = lc.createLinearGradient(0, 0, coneLen, 0);
      cg.addColorStop(0, 'rgba(0,0,0,.9)');
      cg.addColorStop(.6, 'rgba(0,0,0,.5)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = cg;
      lc.beginPath(); lc.moveTo(0, 0); lc.lineTo(coneLen, -coneW * .5); lc.lineTo(coneLen, coneW * .5); lc.closePath(); lc.fill();
      lc.restore();
    }
    // 其他光源：撤离点、掉落物、爆炸、燃烧
    for (const z of g.extracts) drawLight(z.x, z.y, z.r * 1.8, .6);
    for (const it of g.groundItems) drawLight(it.x, it.y, 90, .35);
    for (const c of g.containers) if (!c.done) drawLight(c.x, c.y, 120, .28);
    for (const e of g.enemies) if (e.alive && e.state === 'chase') drawLight(e.x, e.y, 60, .18);
    for (const f of g.flashes) drawLight(f.x, f.y, f.r * (f.life / f.maxLife), .9);

    lc.globalCompositeOperation = 'source-over';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.lightCanvas, 0, 0, this.W, this.H);
  },

  drawScreenEffects(g) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 手电筒的暖色叠加
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = .1;
    const w = g.active;
    if (w && w.alive) {
      const s = g.camera.worldToScreen(w.x, w.y);
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 380);
      grd.addColorStop(0, 'rgba(220,255,170,.8)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
    // 低血屏幕边缘
    if (w && w.alive && w.hp / w.maxHp < .3) {
      ctx.save();
      ctx.globalAlpha = .18 + .1 * Math.sin(g.time * 6);
      const grd = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * .25, this.W / 2, this.H / 2, this.H * .75);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(180,20,10,.9)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
    // 伤害闪红
    if (g.hurtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(g.hurtFlash * .8, 0, .28);
      const grd = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * .25, this.W / 2, this.H / 2, this.H * .8);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(255,30,20,.95)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
    // 采集白闪
    if (g.collectFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(g.collectFlash * .5, 0, .35);
      ctx.fillStyle = 'rgba(200,255,160,1)';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
  },

  drawPopups(ctx, pops) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of pops) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = 'bold ' + (p.size || 13) + 'px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  },

  /* ---------- 小地图 ---------- */
  drawMinimap(mctx, g, W, H) {
    const map = g.map;
    const s = Math.min(W / (map.w * BAL.TILE), H / (map.h * BAL.TILE));
    const ox = (W - map.w * BAL.TILE * s) / 2, oy = (H - map.h * BAL.TILE * s) / 2;
    const TS = BAL.TILE;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.fillStyle = 'rgba(4,6,4,.9)';
    mctx.fillRect(0, 0, W, H);
    // 静态层缓存（探索进度变化时重建）
    const key = 'mm_' + (g.exploredV || 0);
    if (this._mmKey !== key) {
      this._mmKey = key;
      if (!this._mmTex) this._mmTex = document.createElement('canvas');
      const c = this._mmTex;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const mc = c.getContext('2d');
      mc.clearRect(0, 0, W, H);
      // 地面
      for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
          if (map.tiles[y * map.w + x] === 0) continue;
          if (!g.explored[y * map.w + x]) continue;
          mc.fillStyle = 'rgba(96,112,82,.30)';
          mc.fillRect(ox + x * TS * s, oy + y * TS * s, TS * s + .6, TS * s + .6);
        }
      }
      // 墙体轮廓（提高可读性）
      for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
          if (map.tiles[y * map.w + x] !== 0) continue;
          if (!g.explored[y * map.w + x]) continue;
          const nearFloor = (map.get(x + 1, y) !== 0) || (map.get(x - 1, y) !== 0) || (map.get(x, y + 1) !== 0) || (map.get(x, y - 1) !== 0);
          if (!nearFloor) continue;
          mc.fillStyle = 'rgba(18,24,16,.92)';
          mc.fillRect(ox + x * TS * s, oy + y * TS * s, TS * s + .6, TS * s + .6);
        }
      }
    }
    mctx.drawImage(this._mmTex, 0, 0);
    // 撤离点
    for (const z of g.extracts) {
      const zx = ox + z.x * s, zy = oy + z.y * s;
      mctx.fillStyle = z.done ? '#5ee08a' : z.active ? '#b8f24a' : '#ffb02e';
      mctx.beginPath(); mctx.arc(zx, zy, 3.4, 0, TAU); mctx.fill();
      mctx.strokeStyle = mctx.fillStyle; mctx.globalAlpha = .4 + .5 * Math.sin(g.time * 3);
      mctx.beginPath(); mctx.arc(zx, zy, 6.5, 0, TAU); mctx.stroke();
      mctx.globalAlpha = 1;
    }
    // 未探索容器不显示；已探索显示
    for (const c of g.containers) {
      if (c.done) continue;
      const tx = Math.floor(c.x / TS), ty = Math.floor(c.y / TS);
      if (!g.explored[ty * map.w + tx]) continue;
      mctx.fillStyle = 'rgba(255,215,90,.55)';
      mctx.fillRect(ox + c.x * s - 1, oy + c.y * s - 1, 2, 2);
    }
    // 敌人
    for (const e of g.enemies) {
      if (!e.alive || !e.marked) continue;
      mctx.fillStyle = e.def.boss ? '#ff4a8a' : '#ff4a3d';
      mctx.beginPath(); mctx.arc(ox + e.x * s, oy + e.y * s, e.def.boss ? 4 : 2.2, 0, TAU); mctx.fill();
    }
    // 队友
    for (const w of g.worms) {
      if (!w.alive) continue;
      mctx.fillStyle = w === g.active ? '#ffffff' : w.def.color;
      mctx.beginPath(); mctx.arc(ox + w.x * s, oy + w.y * s, w === g.active ? 3 : 2.2, 0, TAU); mctx.fill();
      if (w === g.active) {
        mctx.strokeStyle = 'rgba(255,255,255,.6)'; mctx.lineWidth = 1;
        mctx.beginPath(); mctx.arc(ox + w.x * s, oy + w.y * s, 6, 0, TAU); mctx.stroke();
      }
    }
    // 视野矩形
    mctx.strokeStyle = 'rgba(200,255,160,.25)'; mctx.lineWidth = 1;
    const vw = this.W / g.camera.zoom * s, vh = this.H / g.camera.zoom * s;
    mctx.strokeRect(ox + g.camera.x * s - vw / 2, oy + g.camera.y * s - vh / 2, vw, vh);
    // 最近撤离点方位箭头
    const a = g.active;
    if (a && a.alive && g.nearestExtract) {
      const z = g.nearestExtract;
      const sx = ox + a.x * s, sy = oy + a.y * s;
      const ang = Math.atan2(z.y - a.y, z.x - a.x);
      const px = sx + Math.cos(ang) * 20, py = sy + Math.sin(ang) * 20;
      mctx.save();
      mctx.translate(px, py); mctx.rotate(ang);
      mctx.fillStyle = 'rgba(184,242,74,.85)';
      mctx.beginPath(); mctx.moveTo(5, 0); mctx.lineTo(-3, 3); mctx.lineTo(-3, -3); mctx.closePath(); mctx.fill();
      mctx.restore();
      mctx.fillStyle = 'rgba(184,242,74,.75)';
      mctx.font = '9px "JetBrains Mono", monospace';
      mctx.textAlign = 'center';
      mctx.fillText(Math.round(dist(a.x, a.y, z.x, z.y) / 10) + 'm', px, py - 8);
    }
    // 边框
    mctx.strokeStyle = 'rgba(184,242,74,.2)';
    mctx.strokeRect(.5, .5, W - 1, H - 1);
  },

  /* ---------- 角色头像（大厅用） ---------- */
  drawWormPortrait(canvas, def, t) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // 背景网纹
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < w; i += 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    const cx = w / 2 - 6, cy = h / 2 + 4;
    const wig = Math.sin(t * 2.5) * .35;
    // 身体
    for (let i = 6; i >= 1; i--) {
      const p = i / 6;
      const px = cx - 20 - p * 22, py = cy + 10 + Math.sin(t * 2.2 + i) * 5 + p * 3;
      const r = 13 * (1 - p * .5);
      ctx.fillStyle = def.colorDark;
      ctx.beginPath(); ctx.arc(px, py, r + 2, 0, TAU); ctx.fill();
      const gr = ctx.createRadialGradient(px - r * .3, py - r * .35, r * .1, px, py, r);
      gr.addColorStop(0, def.color); gr.addColorStop(.7, def.color2); gr.addColorStop(1, def.colorDark);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    }
    // 头
    const hr = 23;
    const ay = Math.sin(t * 2.5) * .2 + .2;
    const hx = cx + Math.cos(ay) * 4, hy = cy + Math.sin(ay) * 4;
    const hg = ctx.createRadialGradient(hx - hr * .4, hy - hr * .45, hr * .2, hx, hy, hr);
    hg.addColorStop(0, def.color); hg.addColorStop(.7, def.color2); hg.addColorStop(1, def.colorDark);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.strokeStyle = def.colorDark; ctx.lineWidth = 2.5; ctx.stroke();
    // 眼睛
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#f6f9ea';
      ctx.beginPath(); ctx.arc(hx + 10 + s * 3, hy - 3 + s * 6, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#101208';
      ctx.beginPath(); ctx.arc(hx + 12 + s * 3, hy - 2 + s * 6, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(hx + 11 + s * 3, hy - 3 + s * 6, 1.2, 0, TAU); ctx.fill();
    }
    // 装备点缀
    if (def.id === 'green') {
      ctx.fillStyle = '#46583a';
      ctx.beginPath(); ctx.arc(hx - 5, hy - 6, hr * .8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8fa05e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx + 6, hy - 16); ctx.lineTo(hx + 12, hy - 34); ctx.stroke();
      ctx.fillStyle = '#b8f24a';
      ctx.beginPath(); ctx.arc(hx + 12, hy - 35, 3, 0, TAU); ctx.fill();
    } else if (def.id === 'yellow') {
      ctx.fillStyle = '#c99a12';
      ctx.beginPath(); ctx.arc(hx - 4, hy - 8, hr * .85, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(hx - 6, hy - 10, hr * .68, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1c1c14';
      ctx.beginPath(); ctx.arc(hx + 12, hy - 8, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(110,255,200,.9)';
      ctx.beginPath(); ctx.arc(hx + 12, hy - 8, 3.2, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#4d3574';
      ctx.beginPath(); ctx.arc(hx - 4, hy - 5, hr * .95, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + .6;
        ctx.fillStyle = '#7c5ab8';
        ctx.beginPath(); ctx.arc(hx + Math.cos(a) * hr * .95, hy + Math.sin(a) * hr * .95, 5.5, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(230,200,255,.6)';
      ctx.fillRect(hx + 8, hy - 9, 12, 6);
    }
  },

  /* ---------- 标题画面背景 ---------- */
  drawTitleScene(tctx, W, H, t, worms) {
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    // 背景
    const bg = tctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#060a07'); bg.addColorStop(.5, '#0a100b'); bg.addColorStop(1, '#040604');
    tctx.fillStyle = bg; tctx.fillRect(0, 0, W, H);
    // 光柱
    tctx.save();
    tctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = W * (.25 + i * .25) + Math.sin(t * .3 + i) * 40;
      const g = tctx.createLinearGradient(x, 0, x, H);
      g.addColorStop(0, 'rgba(120,200,80,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      tctx.fillStyle = g;
      tctx.beginPath(); tctx.moveTo(x - 60, 0); tctx.lineTo(x + 60, 0); tctx.lineTo(x + 180, H); tctx.lineTo(x - 180, H); tctx.closePath(); tctx.fill();
    }
    tctx.restore();
    // 地面网格
    tctx.save();
    tctx.strokeStyle = 'rgba(120,160,80,.06)'; tctx.lineWidth = 1;
    const horizon = H * .62;
    for (let i = 0; i < 14; i++) {
      const y = horizon + Math.pow(i / 14, 1.8) * (H - horizon);
      tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(W, y); tctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      tctx.beginPath();
      tctx.moveTo(W / 2 + i * 40, horizon);
      tctx.lineTo(W / 2 + i * 220, H);
      tctx.stroke();
    }
    tctx.restore();
    // 三条巨型蛆影
    for (let i = 0; i < worms.length; i++) {
      const def = worms[i];
      const bx = W * (.18 + i * .3), by = horizon + 120 + i % 2 * 40;
      tctx.save();
      tctx.globalAlpha = .13;
      tctx.translate(bx, by);
      const wob = Math.sin(t * 1.4 + i * 2) * 8;
      tctx.fillStyle = def.color;
      for (let k = 7; k >= 0; k--) {
        const p = k / 7;
        const rx = Math.sin(t * 1.2 + k * .7 + i) * (10 + p * 26);
        const ry = -p * 120 + wob * p;
        tctx.beginPath();
        tctx.arc(rx, ry, 26 * (1 - p * .6), 0, TAU);
        tctx.fill();
      }
      tctx.restore();
    }
    // 浮尘
    tctx.save();
    for (let i = 0; i < 60; i++) {
      const hx = hash2(i, 1, 11), hy = hash2(i, 2, 11);
      const px = (hx * W + t * (6 + hx * 10)) % W;
      const py = (hy * H + Math.sin(t * .5 + i) * 20 + t * 4) % H;
      tctx.globalAlpha = .08 + hx * .2;
      tctx.fillStyle = def2(hy);
      tctx.fillRect(px, py, 1.6, 1.6);
    }
    tctx.restore();
    function def2(h) { return h > .7 ? '#c8e87a' : '#6f8a5a'; }
    // 扫描线
    tctx.save();
    tctx.globalAlpha = .05;
    for (let y = 0; y < H; y += 4) { tctx.fillStyle = '#000'; tctx.fillRect(0, y, W, 1); }
    tctx.restore();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};
