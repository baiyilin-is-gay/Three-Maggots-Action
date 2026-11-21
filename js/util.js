/* =========================================================
   util.js — 数学 / 随机 / 输入 / 存储 / DOM 小工具
   ========================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = lerp;
const invLerp = (a, b, v) => (v - a) / (b - a || 1);
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const dist = (x1, y1, x2, y2) => Math.sqrt(dist2(x1, y1, x2, y2));
const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
const angleDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const approach = (cur, target, step) => cur < target ? Math.min(cur + step, target) : Math.max(cur - step, target);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutQuad = t => 1 - (1 - t) * (1 - t);
const easeInOutQuad = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a || 1), 0, 1); return t * t * (3 - 2 * t); };
const pick = arr => arr[(Math.random() * arr.length) | 0];
const chance = p => Math.random() < p;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const rndSign = () => Math.random() < .5 ? -1 : 1;

/** 可复现随机数（mulberry32），用于地图生成 */
function RNG(seed) {
  let a = seed >>> 0 || 1;
  const f = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a2, b) => a2 + f() * (b - a2);
  f.int = (a2, b) => Math.floor(a2 + f() * (b - a2 + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  return f;
}

/** 字符串哈希（稳定） */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
/** 二维整数哈希 -> [0,1) */
function hash2(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = (h ^ (h >>> 13)) | 0; h = Math.imul(h, 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 平滑值噪声 */
function noise2(x, y, salt = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, salt), b = hash2(xi + 1, yi, salt);
  const c = hash2(xi, yi + 1, salt), d = hash2(xi + 1, yi + 1, salt);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** 数字格式化：1234567 -> 1,234,567 */
function fmt(n) {
  n = Math.round(n);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/** 紧凑数字 12.3k */
function fmtK(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return fmt(n);
}

/** 虫币格式：10 万起 K，100 万起 M，10 亿起 B（内部数值不变，仅显示） */
function fmtMoney(n) {
  n = Number(n) || 0;
  const abs = Math.abs(n);
  const cut = (div, suffix) => {
    const v = Math.floor((abs / div) * 100) / 100;
    const s = v.toFixed(2).replace(/\.?0+$/, '') || '0';
    return (n < 0 ? '-' : '') + s + suffix;
  };
  if (abs >= 1e9) return cut(1e9, 'B');
  if (abs >= 1e6) return cut(1e6, 'M');
  if (abs >= 1e5) return cut(1e3, 'K');
  return fmt(n);
}
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function setText(sel, txt) { const e = typeof sel === 'string' ? $(sel) : sel; if (e && e.textContent !== String(txt)) e.textContent = txt; }
function show(sel, on = true) { const e = typeof sel === 'string' ? $(sel) : sel; if (e) e.classList.toggle('show', on); }
function poll(cond, fn, timeout = 3000) { /* 简易等待 */ }

/* ------------------------- 存储 ------------------------- */
const SAVE_KEY = 'three_grubs_save_v1';
const Store = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { console.warn('存档读取失败', e); return null; }
  },
  save(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
    catch (e) { console.warn('存档写入失败', e); return false; }
  },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
};

/* ------------------------- 输入 ------------------------- */
const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false, clicked: false },
  wheel: 0,
  init(canvas) {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); this.keys[k] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.mouse.down = false; });
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.mouse.rdown = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  },
  key(k) { return !!this.keys[k]; },
  hit(k) { return !!this.pressed[k]; },
  endFrame() { this.pressed = Object.create(null); this.mouse.clicked = false; this.wheel = 0; },
  pressedKeys() { return Object.keys(this.pressed); }
};

/* ------------------------- 粒子系统 ------------------------- */
class Particles {
  constructor(max = 1400) { this.max = max; this.list = []; }
  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 2, color: '#fff',
      drag: 0.94, grav: 0, glow: false, shrink: true, rot: 0, vr: 0, kind: 'dot', alpha: 1
    }, o));
  }
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.angle != null ? opt.angle + rnd(-(opt.spread || TAU / 2), opt.spread || TAU / 2) : rnd(0, TAU);
      const sp = rnd(opt.speedMin || 20, opt.speedMax || 160);
      this.spawn(Object.assign({}, opt, {
        x: x + rnd(-(opt.jitter || 0), opt.jitter || 0),
        y: y + rnd(-(opt.jitter || 0), opt.jitter || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rnd(opt.lifeMin || .2, opt.lifeMax || .6)
      }));
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy *= p.drag; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      const t = clamp(p.life / p.maxLife, 0, 1);
      const a = t * (p.alpha != null ? p.alpha : 1);
      if (a <= 0.01) continue;
      const s = (p.shrink ? t : 1) * p.size;
      if (p.kind === 'spark' || p.kind === 'streak') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-s * 2, -s * .35, s * 3, s * .7); ctx.restore();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(.7, s * .4);
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 4 * (1 - t) + 2, 0, TAU); ctx.stroke();
      } else {
        // 光晕：用两层半透明圆代替昂贵的 shadowBlur
        if (p.glow && s > 1.4) {
          ctx.globalAlpha = a * .22;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, s * 2.6, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.4, s), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/* ------------------------- 页面震动 ------------------------- */
const Shake = {
  t: 0, mag: 0, x: 0, y: 0,
  add(mag, time = .25) { this.mag = Math.max(this.mag, mag); this.t = Math.max(this.t, time); },
  update(dt) {
    if (this.t > 0) {
      this.t -= dt;
      const k = this.mag * Math.max(0, this.t) * 2;
      this.x = rnd(-k, k); this.y = rnd(-k, k);
      if (this.t <= 0) { this.mag = 0; this.x = this.y = 0; }
    }
  }
};

/* ------------------------- 摄像机 ------------------------- */
class Camera {
  constructor() { this.x = 0; this.y = 0; this.w = 1280; this.h = 720; this.zoom = 1; this.targetZoom = 1; this.shakeX = 0; this.shakeY = 0; this.dead = 0; }
  follow(tx, ty, dt, smooth = 9) {
    const k = 1 - Math.exp(-smooth * dt);
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, k);
  }
  apply(ctx) {
    ctx.translate(Math.round(this.w / 2 - this.x * this.zoom), Math.round(this.h / 2 - this.y * this.zoom));
    ctx.scale(this.zoom, this.zoom);
  }
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.w / 2) / this.zoom + this.x,
      y: (sy - this.h / 2) / this.zoom + this.y
    };
  }
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.w / 2,
      y: (wy - this.y) * this.zoom + this.h / 2
    };
  }
  visible(wx, wy, r = 0) {
    const s = this.worldToScreen(wx, wy);
    return s.x > -r - 60 && s.x < this.w + r + 60 && s.y > -r - 60 && s.y < this.h + r + 60;
  }
}

/* ------------------------- 环形缓冲事件日志 ------------------------- */
class Ring {
  constructor(n = 80) { this.n = n; this.a = []; }
  push(v) { this.a.push(v); if (this.a.length > this.n) this.a.shift(); }
}

/* ------------------------- 简单缓动相机辅助 ------------------------- */
function dampAngle(cur, target, lambda, dt) { return cur + angleDiff(cur, target) * (1 - Math.exp(-lambda * dt)); }
