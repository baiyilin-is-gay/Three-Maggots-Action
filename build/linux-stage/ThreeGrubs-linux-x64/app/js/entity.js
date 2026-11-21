/* =========================================================
   entity.js — 蛆虫 / 敌人 / 弹道 / 智能与寻路
   ========================================================= */
'use strict';

/* =========================================================
   空间查询与寻路
   ========================================================= */
const AI = {
  fields: {},       // 目标 -> {dist, sx, sy, t}
  fieldTimer: 0,

  buildField(map, sx, sy) {
    const W = map.w, H = map.h;
    const distArr = new Int16Array(W * H).fill(0);
    const tx = clamp(Math.floor(sx / map.TS), 0, W - 1);
    const ty = clamp(Math.floor(sy / map.TS), 0, H - 1);
    const q = new Int32Array(W * H);
    let head = 0, tail = 0;
    if (map.get(tx, ty) === 0) {
      // 卡墙里：找最近的地面
      let found = false;
      for (let r = 1; r < 6 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
          if (map.get(tx + dx, ty + dy) === 1) { found = true; q[tail++] = (ty + dy) * W + (tx + dx); distArr[(ty + dy) * W + (tx + dx)] = 1; }
        }
      }
      if (!found) return null;
    } else {
      q[tail++] = ty * W + tx; distArr[ty * W + tx] = 1;
    }
    while (head < tail) {
      const idx = q[head++];
      const cx = idx % W, cy = (idx / W) | 0;
      const d = distArr[idx];
      const nb = [idx + 1, idx - 1, idx + W, idx - W];
      for (let k = 0; k < 4; k++) {
        const ni = nb[k];
        if (ni < 0 || ni >= W * H) continue;
        if (distArr[ni] !== 0) continue;
        if (map.tiles[ni] === 0) continue;
        distArr[ni] = d + 1;
        q[tail++] = ni;
      }
    }
    return distArr;
  },

  rebuild(g) {
    this.fields = {};
    for (const w of g.worms) if (w.alive) {
      const f = this.buildField(g.map, w.x, w.y);
      if (f) this.fields[w.id] = f;
    }
  },

  /** 敌人沿流场移动；返回方向 {x,y} */
  steer(g, e) {
    const map = g.map, W = map.w;
    const tx = clamp(Math.floor(e.x / map.TS), 0, W - 1);
    const ty = clamp(Math.floor(e.y / map.TS), 0, map.h - 1);
    let best = null, bestD = Infinity;
    for (const wid in this.fields) {
      const f = this.fields[wid];
      const d = f[ty * W + tx];
      if (d > 0 && d < bestD) { bestD = d; best = f; }
    }
    if (!best) {
      // 无流场：直线
      const t = e.target;
      if (t) { const a = angleTo(e.x, e.y, t.x, t.y); return { x: Math.cos(a), y: Math.sin(a), d: 999 }; }
      return { x: 0, y: 0, d: 999 };
    }
    const cur = best[ty * W + tx];
    let bx = 0, by = 0, bd = cur;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dx, dy] of opts) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
      if (map.get(nx, ny) === 0) continue;
      const nd = best[ny * W + nx];
      if (nd > 0 && nd < bd) { bd = nd; bx = dx; by = dy; }
    }
    if (bx === 0 && by === 0) {
      const t = e.target;
      if (t) { const a = angleTo(e.x, e.y, t.x, t.y); return { x: Math.cos(a), y: Math.sin(a), d: cur }; }
      return { x: 0, y: 0, d: cur };
    }
    const len = Math.hypot(bx, by);
    return { x: bx / len, y: by / len, d: cur };
  },

  hasLOS(g, x1, y1, x2, y2, maxDist) {
    const map = g.map;
    const d = dist(x1, y1, x2, y2);
    if (maxDist && d > maxDist) return false;
    const steps = Math.ceil(d / 14);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (map.isWallAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }
};

/* =========================================================
   碰撞
   ========================================================= */
const Collide = {
  resolveCircle(map, x, y, r) {
    const TS = map.TS;
    let nx = x, ny = y;
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor((nx - r) / TS), x1 = Math.floor((nx + r) / TS);
      const y0 = Math.floor((ny - r) / TS), y1 = Math.floor((ny + r) / TS);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (map.get(tx, ty) !== 0) continue;
          const cx = clamp(nx, tx * TS, (tx + 1) * TS);
          const cy = clamp(ny, ty * TS, (ty + 1) * TS);
          const dx = nx - cx, dy = ny - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < r * r) {
            let d = Math.sqrt(d2);
            if (d < .0001) {
              // 圆心在方块内：推向最近边
              const left = nx - tx * TS, right = (tx + 1) * TS - nx, top = ny - ty * TS, bottom = (ty + 1) * TS - ny;
              const m = Math.min(left, right, top, bottom);
              if (m === left) nx = tx * TS - r;
              else if (m === right) nx = (tx + 1) * TS + r;
              else if (m === top) ny = ty * TS - r;
              else ny = (ty + 1) * TS + r;
            } else {
              const push = (r - d) / d;
              nx += dx * push; ny += dy * push;
            }
          }
        }
      }
    }
    return { x: nx, y: ny };
  },
  /** 线段与圆相交，返回 t∈[0,1] 或 -1 */
  segCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-9) return dist2(x1, y1, cx, cy) <= r * r ? 0 : -1;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
    if (t1 >= 0 && t1 <= 1) return t1;
    if (t2 >= 0 && t2 <= 1) return t2;
    return -1;
  },
  /** 射线与地图墙：返回距离比例 t（1 表示未命中） */
  rayWall(g, x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    const steps = Math.ceil(d / 8);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (g.map.isWallAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return Math.max(0, (i - 1) / steps);
    }
    return 1;
  }
};

/* =========================================================
   Worm（蛆虫角色）
   ========================================================= */
class Worm {
  constructor(def, x, y, isPlayer, game) {
    this.id = def.id;
    this.def = def;
    this.game = game;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.radius = 15;
    this.isPlayer = isPlayer;
    this.alive = true;
    this.maxHp = def.hp + (game.meta.bonusHp?.[def.id] || 0);
    this.hp = this.maxHp;
    this.maxArmor = def.armor + (game.loadout.armorBonus?.[def.id] || 0);
    this.armor = this.maxArmor;
    this.speed = def.speed;
    this.carry = def.carry + (game.loadout.carryBonus || 0);
    this.aim = rnd(0, TAU);
    this.hurtT = 0;
    this.shieldT = 0;
    this.dashT = 0;
    this.recoilKick = 0;
    this.invuln = 0;

    // 武器
    const wid = game.loadout.weapons?.[def.id] || def.weapon;
    this.weaponDef = WEAPONS[wid] || WEAPONS[def.weapon];
    const ammoMul = 1 + (game.loadout.ammoBonus || 0);
    this.mag = this.weaponDef.mag;
    this.reserve = Math.round(this.weaponDef.mag * 5 * ammoMul);
    this.magMax = this.weaponDef.mag;
    this.fireCd = 0;
    this.reloadT = 0;
    this.reloading = false;
    this.spreadHeat = 0;
    this.shotsFired = 0;

    // 技能
    this.abilityCd = 0;

    // 虫子身体
    this.segs = [];
    for (let i = 0; i < 9; i++) this.segs.push({ x: x - i * 7, y: y, px: x - i * 7, py: y });
    this.wiggle = rnd(0, TAU);
    this.moving = 0;
    this.trail = [];
    this.stepT = 0;

    // 队友 AI
    this.aiState = 'follow';
    this.aiTarget = null;
    this.aiThink = rnd(0, .4);
    this.aiStrafe = rndSign();
    this.aiStrafeT = 0;
    this.bark = null;

    // 统计
    this.kills = 0;
    this.dmgDealt = 0;
    this.downedAt = null;
  }

  get weapon() { return this.weaponDef; }

  update(dt, g) {
    if (!this.alive) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.recoilKick = Math.max(0, this.recoilKick - dt * 9);
    this.spreadHeat = Math.max(0, this.spreadHeat - dt * 4);

    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    if (this.fireCd > 0) this.fireCd -= dt;

    if (this.isPlayer) this.updatePlayer(dt, g);
    else this.updateAlly(dt, g);

    this.updateBody(dt, g);
    if (this.stepT > 0) this.stepT -= dt;
  }

  /* ---------- 玩家操控 ---------- */
  updatePlayer(dt, g) {
    const inp = g.inputState;
    let mx = 0, my = 0;
    if (inp.up) my -= 1;
    if (inp.down) my += 1;
    if (inp.left) mx -= 1;
    if (inp.right) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }

    // 负重减速
    const loadRatio = g.squadWeight / this.carry;
    let spd = this.speed;
    if (loadRatio > 1) spd *= clamp(1 - (loadRatio - 1) * .35, .45, 1);
    if (this.dashT > 0) spd *= 2.2;
    if (this.reloading) spd *= .78;
    if (g.slowMul) spd *= g.slowMul;

    this.vx = lerp(this.vx, mx * spd, 1 - Math.exp(-14 * dt));
    this.vy = lerp(this.vy, my * spd, 1 - Math.exp(-14 * dt));
    this.moving = len > 0 ? 1 : 0;

    const r = Collide.resolveCircle(g.map, this.x + this.vx * dt, this.y + this.vy * dt, this.radius);
    this.x = r.x; this.y = r.y;

    // 瞄准
    const m = g.mouseWorld;
    this.aim = dampAngle(this.aim, angleTo(this.x, this.y, m.x, m.y), 26, dt);

    // 脚步灰尘
    this.stepT -= dt;
    if (this.moving && this.stepT <= 0) {
      this.stepT = this.dashT > 0 ? .05 : .14;
      g.particles.spawn({
        x: this.x + rnd(-6, 6), y: this.y + rnd(-2, 4), vx: -this.vx * .08 + rnd(-14, 14), vy: -this.vy * .08 + rnd(-14, 14),
        life: .32, maxLife: .32, size: 2.2, color: 'rgba(150,160,130,.35)', drag: .9
      });
    }

    // 射击/换弹
    if (inp.fire && !this.reloading) this.tryFire(g);
    if (inp.reload) this.startReload();
    // 自动换弹
    if (this.mag <= 0 && !this.reloading && this.reserve > 0 && !inp.fire) this.startReload();
  }

  /* ---------- 队友 AI ---------- */
  updateAlly(dt, g) {
    const P = g.active;
    this.aiThink -= dt;
    if (this.aiThink <= 0) {
      this.aiThink = .22 + Math.random() * .16;
      this.thinkAlly(g);
    }
    let tx = this.x, ty = this.y;
    const enemy = this.aiTarget;
    const pd = P && P.alive ? dist(this.x, this.y, P.x, P.y) : 0;

    if (enemy && enemy.alive && dist(this.x, this.y, enemy.x, enemy.y) < 520 && AI.hasLOS(g, this.x, this.y, enemy.x, enemy.y, 560)) {
      // 保持距离 + 侧移
      const d = dist(this.x, this.y, enemy.x, enemy.y);
      const a = angleTo(this.x, this.y, enemy.x, enemy.y);
      const want = this.def.id === 'purple' ? 90 : this.def.id === 'green' ? 190 : 150;
      let move = 0;
      if (d > want + 30) move = 1; else if (d < want - 40) move = -1;
      this.aiStrafeT -= dt;
      if (this.aiStrafeT <= 0) { this.aiStrafeT = rnd(.8, 1.8); this.aiStrafe = rndSign(); }
      tx = this.x + Math.cos(a) * move * 100 + Math.cos(a + Math.PI / 2) * this.aiStrafe * 70;
      ty = this.y + Math.sin(a) * move * 100 + Math.sin(a + Math.PI / 2) * this.aiStrafe * 70;
      this.aim = dampAngle(this.aim, a, 18, dt);
      if (d < this.weapon.range && this.mag > 0 && !this.reloading) {
        // 稍稍提前量
        this.tryFire(g, true);
      }
      if (this.mag <= 0 && !this.reloading) this.startReload();
    } else {
      // 跟随
      if (P && P.alive) {
        const followDist = 110;
        if (pd > followDist + 60) { tx = P.x + rnd(-30, 30); ty = P.y + rnd(-30, 30); }
        else if (pd > followDist) { tx = P.x; ty = P.y; }
        this.aim = dampAngle(this.aim, P.aim + rnd(-.3, .3), 6, dt);
      }
      if (this.mag < this.magMax * .5 && this.reserve > 0 && !this.reloading) this.startReload();
    }
    const a = angleTo(this.x, this.y, tx, ty);
    const d = dist(this.x, this.y, tx, ty);
    const spd = this.speed * (d > 20 ? 1 : 0);
    this.vx = lerp(this.vx, Math.cos(a) * spd, 1 - Math.exp(-10 * dt));
    this.vy = lerp(this.vy, Math.sin(a) * spd, 1 - Math.exp(-10 * dt));
    this.moving = spd > 5 ? 1 : 0;
    const r = Collide.resolveCircle(g.map, this.x + this.vx * dt, this.y + this.vy * dt, this.radius);
    this.x = r.x; this.y = r.y;
  }

  thinkAlly(g) {
    let best = null, bd = Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < 560 && d < bd && AI.hasLOS(g, this.x, this.y, e.x, e.y, 600)) { bd = d; best = e; }
    }
    this.aiTarget = best;
    // 玩家不动且敌人在附近时，主动一点
    if (!best && g.active && g.active.alive) {
      const P = g.active;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const d = dist(P.x, P.y, e.x, e.y);
        if (d < 300) { this.aiTarget = e; break; }
      }
    }
  }

  /* ---------- 武器 ---------- */
  tryFire(g, isAlly = false) {
    if (this.fireCd > 0 || this.reloading) return false;
    if (this.mag <= 0) { if (this.reserve > 0) this.startReload(); else Audio2.play('empty', { vol: .6 }); return false; }
    const W = this.weapon;
    this.mag--;
    this.fireCd = 60 / W.rpm;
    this.shotsFired++;
    this.recoilKick = 1;
    this.spreadHeat = Math.min(2.2, this.spreadHeat + .35);

    // 后坐力导致镜头轻震
    if (!isAlly) Shake.add(W.recoil * .5, .05);

    const spreadBase = W.spread * (Math.PI / 180) * (1 - (g.loadout?.accuracy || 0));
    const heat = this.spreadHeat * spreadBase * .6;
    const pellets = W.pellets;
    for (let i = 0; i < pellets; i++) {
      let a = this.aim + rnd(-spreadBase - heat, spreadBase + heat);
      if (this.moving) a += rnd(-.03, .03);
      const speed = W.speed;
      const bx = this.x + Math.cos(this.aim) * 22;
      const by = this.y + Math.sin(this.aim) * 22;
      g.bullets.push({
        x: bx, y: by, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: W.range / speed, dmg: W.w * (this.def.id === 'green' ? 1.06 : 1),
        kind: 'player', owner: this, pen: W.pen, color: isAlly ? 'rgba(255,235,170,.75)' : 'rgba(255,246,190,.92)',
        ranged: W.type === 'shotgun' ? 140 : 900, spreadA: a
      });
    }
    // 枪口粒子 + 光照
    g.particles.burst(this.x + Math.cos(this.aim) * 26, this.y + Math.sin(this.aim) * 26, 3, {
      color: '#ffd98a', lifeMin: .06, lifeMax: .16, size: 2.4, angle: this.aim, spread: .35, speedMin: 60, speedMax: 240, glow: true, kind: 'spark'
    });
    g.flashes.push({ x: this.x + Math.cos(this.aim) * 30, y: this.y + Math.sin(this.aim) * 30, r: 100, life: .07, maxLife: .07 });
    // 枪声（队友音量低）
    Audio2.play(W.sound, { vol: isAlly ? .45 : 1 });
    // 抛壳
    if (W.type !== 'shotgun' || Math.random() < .5) {
      g.particles.spawn({
        x: this.x + Math.cos(this.aim) * 12, y: this.y + Math.sin(this.aim) * 12,
        vx: Math.cos(this.aim + Math.PI / 2) * rnd(30, 70) - this.vx * .2,
        vy: Math.sin(this.aim + Math.PI / 2) * rnd(30, 70) - this.vy * .2,
        life: .5, maxLife: .5, size: 1.6, color: '#c9a24a', grav: 260, kind: 'dot'
      });
    }
    if (this.mag <= 0) { if (this.reserve > 0) setTimeout(() => { if (this.alive) this.startReload(); }, 120); else Audio2.play('empty', { vol: .4 }); }
    return true;
  }

  startReload() {
    if (this.reloading || this.mag >= this.magMax || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = this.weapon.reload * (this.def.id === 'green' ? .88 : 1);
    Audio2.play('reload');
    if (this.game) this.game.logEvent('换弹 · ' + this.def.name, 'cyan');
  }
  finishReload() {
    const need = this.magMax - this.mag;
    const take = Math.min(need, this.reserve);
    this.mag += take; this.reserve -= take;
    this.reloading = false; this.reloadT = 0;
    Audio2.play('reload_done');
  }

  /* ---------- 技能 ---------- */
  useAbility(g) {
    if (this.abilityCd > 0 || !this.alive) return false;
    const id = this.def.id;
    if (id === 'green') {
      if (this.hp >= this.maxHp && this.armor >= this.maxArmor) { g.toast('生命与护甲已满', 'small'); return false; }
      this.hp = Math.min(this.maxHp, this.hp + 38);
      this.armor = Math.min(this.maxArmor, this.armor + Math.round(this.maxArmor * .3));
      g.popup(this.x, this.y - 30, '+38', '#b8f24a', 15);
      g.particles.burst(this.x, this.y, 16, { color: '#b8f24a', lifeMin: .3, lifeMax: .7, size: 2.6, speedMin: 30, speedMax: 120, glow: true, kind: 'ring' });
      this.abilityCd = this.def.ability.cd;
      this.invuln = .4;
      Audio2.play('ability');
      g.logEvent('老绿：止血带比遗书便宜。', 'gold');
      g.subtitle('老绿：止血带比遗书便宜。');
      return true;
    }
    if (id === 'yellow') {
      this.dashT = 1.1;
      this.invuln = .18;
      this.abilityCd = this.def.ability.cd;
      g.particles.burst(this.x, this.y, 14, { color: '#ffd24a', lifeMin: .2, lifeMax: .5, size: 2.4, speedMin: 80, speedMax: 200, glow: true, kind: 'streak' });
      Audio2.play('ability');
      g.logEvent('小黄：跟上，别踩我刚踩过的——算了。', 'gold');
      g.subtitle('小黄：跟上，别踩我刚踩过的——算了。');
      return true;
    }
    if (id === 'purple') {
      this.shieldT = 6;
      this.abilityCd = this.def.ability.cd;
      g.toast('硬壳展开', 'small');
      g.particles.burst(this.x, this.y, 22, { color: '#b98bff', lifeMin: .3, lifeMax: .8, size: 3, speedMin: 50, speedMax: 170, glow: true, kind: 'ring' });
      Audio2.play('ability');
      Shake.add(3, .18);
      g.logEvent('大紫：壳撑十秒，够你们跑。', 'gold');
      g.subtitle('大紫：壳撑十秒，够你们跑。');
      return true;
    }
    return false;
  }

  /* ---------- 受伤 ---------- */
  takeDamage(dmg, src, opt = {}) {
    if (!this.alive || this.invuln > 0) return;
    const g = this.game;
    let mul = 1;
    if (this.shieldT > 0) mul *= .45;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * .6);
      this.armor -= absorbed;
      dmg -= absorbed;
      mul *= .8;
    }
    const final = Math.max(1, Math.round(dmg * mul));
    this.hp -= final;
    this.hurtT = .22;
    this.invuln = opt.noInvuln ? 0 : .06;
    if (opt.knock && this.shieldT <= 0) {
      const a = opt.knockA || angleTo(src ? src.x : this.x, src ? src.y : this.y, this.x, this.y);
      this.x += Math.cos(a) * (opt.knock || 10);
      this.y += Math.sin(a) * (opt.knock || 10);
    }
    if (g) {
      g.onWormHurt(this, final, src);
      if (this.hp <= 0) { this.hp = 0; this.die(); }
    }
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.downedAt = this.game ? this.game.time : 0;
    const g = this.game;
    if (!g) return;
    g.particles.burst(this.x, this.y, 40, {
      color: this.def.color, lifeMin: .4, lifeMax: 1.4, size: 3.4, speedMin: 40, speedMax: 260,
      drag: .93, grav: 120, glow: true
    });
    g.particles.burst(this.x, this.y, 20, {
      color: '#5a1a10', lifeMin: .3, lifeMax: .9, size: 3, speedMin: 30, speedMax: 180, grav: 260
    });
    Audio2.play('enemy_down', { vol: .8 });
    Shake.add(9, .5);
    g.hurtFlash = .5;
    g.onWormDowned(this);
  }

  /* ---------- 身体链 ---------- */
  updateBody(dt, g) {
    this.wiggle += dt * (this.moving ? 9 : 3.5);
    const S = this.segs;
    S[0].x = this.x; S[0].y = this.y;
    const spacing = 8.6;
    const spd = Math.hypot(this.vx, this.vy);
    const moving = spd > 14;
    // 尾巴朝向：移动时指向速度反方向，静止时指向瞄准反方向
    const backA = moving ? Math.atan2(-this.vy, -this.vx) : this.aim + Math.PI;
    const k = 1 - Math.exp(-24 * dt);
    const amp = moving ? .62 : .34;
    for (let i = 1; i < S.length; i++) {
      const p = S[i - 1], s = S[i];
      const wave = Math.sin(this.wiggle - i * .85) * amp;
      const a = backA + wave;
      const tx = p.x + Math.cos(a) * spacing;
      const ty = p.y + Math.sin(a) * spacing;
      s.x = lerp(s.x, tx, k);
      s.y = lerp(s.y, ty, k);
      if (g && g.map.isWallAt(s.x, s.y)) {
        const r = Collide.resolveCircle(g.map, s.x, s.y, 6);
        s.x = r.x; s.y = r.y;
      }
    }
  }
}

/* =========================================================
   Enemy（白蛆军团）
   ========================================================= */
class Enemy {
  constructor(typeId, x, y, game, opt = {}) {
    const def = ENEMIES[typeId];
    this.def = def;
    this.game = game;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.spawnX = x; this.spawnY = y;
    this.radius = def.radius;
    this.maxHp = Math.round(def.hp * (opt.hpMul || 1));
    this.hp = this.maxHp;
    this.speed = def.speed;
    this.alive = true;
    this.state = 'idle';
    this.stateT = rnd(0, 2);
    this.aim = rnd(0, TAU);
    this.hurtT = 0;
    this.attackCd = rnd(0, def.atkCd || 1);
    this.alertT = 0;
    this.target = null;
    this.seed = rnd(0, 100);
    this.segs = [];
    for (let i = 0; i < 6; i++) this.segs.push({ x: x - i * 6, y: y });
    this.wiggle = rnd(0, TAU);
    this.moving = 0;
    this.marked = false;
    this.charge = 0;
    this.chargeCd = 0;
    this.patrolA = rnd(0, TAU);
    this.patrolT = rnd(1, 4);
    this.lastSeen = null;
    this.searchT = 0;
    this.wanderT = rnd(.5, 2.5);
    this.wanderMoving = 0;
    this.visible = true;
    this.dmgMul = opt.dmgMul || 1;
    this.healT = 0;
    this.summonT = 0;
    this.isBoss = !!def.boss;
    this.spawnAnim = 1;
  }

  update(dt, g) {
    if (!this.alive) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.alertT = Math.max(0, this.alertT - dt);
    this.spawnAnim = Math.max(0, this.spawnAnim - dt * 2);
    this.attackCd -= dt;
    this.chargeCd -= dt;
    this.stateT -= dt;
    this.aiUpdate(dt, g);
    this.updateBody(dt, g);
  }

  aiUpdate(dt, g) {
    const def = this.def;
    // 视野：寻找最近可攻击的玩家方单位
    const targets = g.worms.filter(w => w.alive);
    let best = null, bestD = Infinity, visible = false;
    for (const w of targets) {
      const d = dist(this.x, this.y, w.x, w.y);
      if (d < bestD && d < def.sense && AI.hasLOS(g, this.x, this.y, w.x, w.y, def.sense)) {
        best = w; bestD = d; visible = true;
      }
    }
    if (!visible && this.state !== 'chase') {
      // 用最近的单位做搜索目标
      let nd = Infinity;
      for (const w of targets) { const d = dist(this.x, this.y, w.x, w.y); if (d < nd) { nd = d; best = w; } }
    }

    if (visible) {
      this.target = best;
      this.lastSeen = { x: best.x, y: best.y };
      if (this.state !== 'chase') {
        this.state = 'chase';
        this.alertT = 1.2;
        if (Math.random() < .25) Audio2.play('alert', { vol: .35 });
        g.onEnemyAlert(this);
      }
      this.searchT = 4;
    } else if (this.state === 'chase') {
      this.searchT -= dt;
      if (this.searchT <= 0) { this.state = 'search'; this.stateT = 3.5; }
    }

    const T = this.target;
    switch (def.kind) {
      case 'ranged': this.aiRanged(dt, g, T, bestD, visible); break;
      case 'melee': this.aiMelee(dt, g, T, bestD, visible); break;
      case 'charger': this.aiCharger(dt, g, T, bestD, visible); break;
      case 'boss': this.aiBoss(dt, g, T, bestD, visible); break;
    }
    // 移动
    this.applyMovement(dt, g);
    // 侍从治疗光环
    if (def.healAura) {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = 1.5;
        for (const e of g.enemies) {
          if (!e.alive || e === this) continue;
          if (dist(e.x, e.y, this.x, this.y) < 220 && e.hp < e.maxHp) {
            e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .08);
            g.particles.spawn({ x: e.x + rnd(-8, 8), y: e.y + rnd(-8, 8), vx: 0, vy: -30, life: .5, maxLife: .5, size: 2, color: '#e0b8ff', glow: true });
          }
        }
      }
    }
  }

  aiRanged(dt, g, T, d, visible) {
    const def = this.def;
    if (!T) { this.wander(dt, g); return; }
    const wantA = angleTo(this.x, this.y, T.x, T.y);
    this.aim = dampAngle(this.aim, wantA, 7, dt);
    if (visible) {
      const want = def.atkRange * .72;
      if (d > want) this.moveDir = angleTo(this.x, this.y, T.x, T.y);
      else if (d < want * .55) this.moveDir = angleTo(T.x, T.y, this.x, this.y);
      else {
        // 侧移拉扯
        this.stateT -= dt;
        if (this.stateT <= 0) { this.stateT = rnd(.8, 1.8); this.strafeDir = rndSign(); }
        this.moveDir = wantA + Math.PI / 2 * (this.strafeDir || 1);
      }
      this.moving = 1;
      if (this.attackCd <= 0 && d < def.atkRange && AI.hasLOS(g, this.x, this.y, T.x, T.y, def.atkRange + 40)) {
        this.attackCd = def.atkCd + rnd(-.15, .35);
        this.shootAcid(g, T);
      }
    } else if (this.state === 'search' || this.state === 'chase') {
      this.moveDir = angleTo(this.x, this.y, this.lastSeen?.x ?? T.x, this.lastSeen?.y ?? T.y);
      this.moving = 1;
    } else this.wander(dt, g);
  }

  aiMelee(dt, g, T, d, visible) {
    const def = this.def;
    if (!T) { this.wander(dt, g); return; }
    this.aim = dampAngle(this.aim, angleTo(this.x, this.y, T.x, T.y), 8, dt);
    if (visible || this.state === 'chase') {
      this.moveDir = angleTo(this.x, this.y, T.x, T.y);
      this.moving = 1;
      if (visible && d < def.atkRange && this.attackCd <= 0) {
        this.attackCd = def.atkCd;
        this.meleeHit(g, T);
      }
    } else this.wander(dt, g);
  }

  aiCharger(dt, g, T, d, visible) {
    const def = this.def;
    if (!T) { this.wander(dt, g); return; }
    const a = angleTo(this.x, this.y, T.x, T.y);
    this.aim = dampAngle(this.aim, a, this.charge > 0 ? 2 : 4, dt);
    if (this.charge > 0) {
      this.charge -= dt;
      this.moveDir = this.chargeA;
      this.speedMul = 4.6;
      this.moving = 1;
      // 冲撞
      if (d < this.radius + T.radius) {
        T.takeDamage(def.dmg * this.dmgMul, this, { knock: 26, knockA: a });
        this.charge = 0; this.speedMul = 1;
        this.attackCd = 1.4;
        Shake.add(6, .3);
      }
      return;
    }
    this.speedMul = 1;
    if (visible) {
      if (d < 300 && this.chargeCd <= 0 && AI.hasLOS(g, this.x, this.y, T.x, T.y, 320)) {
        this.charge = .75;
        this.chargeA = a;
        this.chargeCd = 3.4;
        Audio2.play('spit', { vol: .5 });
        g.logEvent(def.name + ' 开始冲锋！', 'red');
      } else if (d < 380) {
        this.moveDir = a; this.moving = 1;
      } else this.moveDir = a, this.moving = 1;
    } else if (this.state === 'chase' || this.state === 'search') {
      this.moveDir = a; this.moving = 1;
    } else this.wander(dt, g);
  }

  aiBoss(dt, g, T, d, visible) {
    const def = this.def;
    if (!T) return;
    this.aim = dampAngle(this.aim, angleTo(this.x, this.y, T.x, T.y), 2.4, dt);
    this.moving = 1;
    this.moveDir = angleTo(this.x, this.y, T.x, T.y);
    this.speedMul = d < 160 ? .2 : 1;
    // 远程酸弹
    if (this.attackCd <= 0 && d < def.atkRange && visible) {
      this.attackCd = def.atkCd;
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i - (n - 1) / 2) * .16;
        g.bullets.push({
          x: this.x + Math.cos(a) * 50, y: this.y + Math.sin(a) * 50,
          vx: Math.cos(a) * def.bulletSpeed, vy: Math.sin(a) * def.bulletSpeed,
          life: 1.8, dmg: def.dmg * this.dmgMul, kind: 'acid', owner: this, bio: true
        });
      }
      Audio2.play('spit', { vol: .7 });
    }
    // 召唤侍从
    this.summonT -= dt;
    if (this.summonT <= 0) {
      this.summonT = 9;
      let n = 0;
      for (const e of g.enemies) if (e.alive && e.def.id === 'attendant') n++;
      if (n < 6) {
        for (let i = 0; i < 2; i++) {
          const a = rnd(0, TAU);
          g.spawnEnemy('attendant', this.x + Math.cos(a) * 80, this.y + Math.sin(a) * 80);
        }
        g.logEvent('巢母吐出了新的侍从', 'red');
        g.toast('巢母正在产卵', 'small');
      }
    }
  }

  wander(dt, g) {
    this.moving = 0;
    if (this.state === 'idle' || this.state === 'search') {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        if (this.wanderMoving > 0) { this.wanderMoving = 0; this.wanderT = rnd(.8, 2.2); }
        else { this.wanderMoving = 1; this.wanderT = rnd(.5, 1.2); this.moveDir = rnd(0, TAU); }
      }
      if (this.wanderMoving > 0) {
        // 撞墙就换方向
        const ahead = { x: this.x + Math.cos(this.moveDir) * 28, y: this.y + Math.sin(this.moveDir) * 28 };
        if (g.map.isWallAt(ahead.x, ahead.y)) this.moveDir += Math.PI * rnd(.6, 1.4);
        this.moving = 1;
      }
      this.aim += Math.sin(this.wiggle * .3) * dt * .6;
    }
  }

  meleeHit(g, T) {
    const a = angleTo(this.x, this.y, T.x, T.y);
    T.takeDamage(this.def.dmg * this.dmgMul, this, { knock: 12, knockA: a });
    g.particles.burst((this.x + T.x) / 2, (this.y + T.y) / 2, 8, {
      color: '#ffd9b0', lifeMin: .1, lifeMax: .3, size: 2, angle: a, spread: .8, speedMin: 40, speedMax: 160
    });
    Audio2.play('hit', { vol: .5 });
  }

  shootAcid(g, T) {
    const def = this.def;
    const a = angleTo(this.x, this.y, T.x, T.y) + rnd(-.06, .06);
    const speed = def.bulletSpeed;
    // 预测
    const t = dist(this.x, this.y, T.x, T.y) / speed;
    const px = T.x + T.vx * t * .6, py = T.y + T.vy * t * .6;
    const aimA = angleTo(this.x, this.y, px, py) + rnd(-.05, .05);
    g.bullets.push({
      x: this.x + Math.cos(aimA) * (this.radius + 6), y: this.y + Math.sin(aimA) * (this.radius + 6),
      vx: Math.cos(aimA) * speed, vy: Math.sin(aimA) * speed,
      life: 1.6, dmg: def.dmg * this.dmgMul, kind: 'acid', owner: this, bio: true
    });
    const tipX = this.x + Math.cos(a) * (this.radius + 10), tipY = this.y + Math.sin(a) * (this.radius + 10);
    g.particles.burst(tipX, tipY, 5, { color: '#c8f24a', lifeMin: .12, lifeMax: .35, size: 2.2, angle: a, spread: .5, speedMin: 40, speedMax: 140, glow: true });
    Audio2.play('spit', { vol: .45 });
  }

  applyMovement(dt, g) {
    if (this.moving && this.moveDir != null) {
      const spd = this.speed * (this.speedMul || 1) * (this.state === 'chase' ? 1.12 : 1);
      this.vx = lerp(this.vx, Math.cos(this.moveDir) * spd, 1 - Math.exp(-8 * dt));
      this.vy = lerp(this.vy, Math.sin(this.moveDir) * spd, 1 - Math.exp(-8 * dt));
    } else {
      this.vx *= Math.exp(-8 * dt); this.vy *= Math.exp(-8 * dt);
    }
    // 敌人之间轻推
    for (const e of g.enemies) {
      if (e === this || !e.alive) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      const minD = this.radius + e.radius;
      if (d < minD && d > .01) {
        const push = (minD - d) / d * .5;
        this.x += (this.x - e.x) * push * dt * 8;
        this.y += (this.y - e.y) * push * dt * 8;
      }
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const r = Collide.resolveCircle(g.map, nx, ny, this.radius);
    this.x = r.x; this.y = r.y;
    // 半径限制在可用区域
    this.x = clamp(this.x, 20, g.map.px - 20);
    this.y = clamp(this.y, 20, g.map.py - 20);
  }

  updateBody(dt, g) {
    this.wiggle += dt * (this.moving ? 8 : 2.4);
    const S = this.segs;
    S[0].x = this.x; S[0].y = this.y;
    const sp = this.radius * .62;
    const spd = Math.hypot(this.vx, this.vy);
    const moving = spd > 10;
    const backA = moving ? Math.atan2(-this.vy, -this.vx) : this.aim + Math.PI;
    const k = 1 - Math.exp(-18 * dt);
    for (let i = 1; i < S.length; i++) {
      const p = S[i - 1], s = S[i];
      const a = backA + Math.sin(this.wiggle - i * .9) * (moving ? .5 : .22);
      s.x = lerp(s.x, p.x + Math.cos(a) * sp, k);
      s.y = lerp(s.y, p.y + Math.sin(a) * sp, k);
    }
  }

  takeDamage(dmg, src, opt = {}) {
    if (!this.alive) return;
    dmg = Math.max(1, dmg);
    if (this.def.armor) dmg *= (1 - this.def.armor);
    this.hp -= dmg;
    this.hurtT = .12;
    this.alertT = Math.max(this.alertT, .6);
    if (this.state === 'idle') { this.state = 'chase'; this.target = src; }
    if (this.hp <= 0) this.die(src);
    return dmg;
  }

  die(src) {
    if (!this.alive) return;
    this.alive = false;
    const g = this.game;
    g.particles.burst(this.x, this.y, this.isBoss ? 80 : 20, {
      color: this.def.color, lifeMin: .3, lifeMax: 1.1, size: this.isBoss ? 4 : 2.8,
      speedMin: 40, speedMax: 220, drag: .92, grav: 80, glow: true
    });
    g.particles.burst(this.x, this.y, this.isBoss ? 50 : 12, {
      color: '#7a2418', lifeMin: .3, lifeMax: .9, size: 3, speedMin: 30, speedMax: 180, grav: 220
    });
    Audio2.play('enemy_down', { vol: this.isBoss ? 1 : .6 });
    if (this.isBoss) {
      Shake.add(18, 1.2);
      g.onBossKilled(this);
    } else {
      Shake.add(3, .12);
    }
    g.onEnemyKilled(this, src);
  }
}
