/* =========================================================
   mapgen.js — 程序化地图：房间 + 走廊 + 主题纹理 + 布点
   ========================================================= */
'use strict';

class GameMap {
  constructor(cfg) {
    this.cfg = cfg;
    this.w = cfg.w; this.h = cfg.h;
    this.TS = BAL.TILE;
    this.px = this.w * this.TS;
    this.py = this.h * this.TS;
    this.palette = cfg.palette;
    this.tiles = new Uint8Array(this.w * this.h); // 1=地面 0=墙
    this.rooms = [];
    this.seed = cfg.seed;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.tiles[y * this.w + x];
  }
  set(x, y, v) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[y * this.w + x] = v;
  }
  walkableRect(x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, 1);
  }
  isWallAt(wx, wy) { return this.get(Math.floor(wx / this.TS), Math.floor(wy / this.TS)) === 0; }
  solidAtTile(tx, ty) { return this.get(tx, ty) === 0; }
  randomFloorPoint(rng, margin = 2) {
    for (let i = 0; i < 400; i++) {
      const tx = rng.int(margin, this.w - 1 - margin);
      const ty = rng.int(margin, this.h - 1 - margin);
      if (this.get(tx, ty) === 1) return { x: (tx + .5) * this.TS, y: (ty + .5) * this.TS, tx, ty };
    }
    return { x: this.px / 2, y: this.py / 2, tx: this.w >> 1, ty: this.h >> 1 };
  }
  roomAt(tx, ty) {
    for (const r of this.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
    return null;
  }
}

const MapGen = {
  generate(cfg, diff) {
    const rng = RNG(cfg.seed + diff * 7717);
    const map = new GameMap(cfg);
    const W = map.w, H = map.h;
    // 全墙
    map.tiles.fill(0);

    // BSP 切分
    const root = { x: 2, y: 2, w: W - 4, h: H - 4 };
    const leaves = [];
    const split = (node, depth) => {
      const minSize = 9;
      if (depth <= 0 || (node.w < minSize * 2 && node.h < minSize * 2)) { leaves.push(node); return; }
      const canH = node.h >= minSize * 2, canV = node.w >= minSize * 2;
      let horiz;
      if (canH && canV) horiz = node.w / node.h > 1.25 ? false : node.h / node.w > 1.25 ? true : rng.chance(.5);
      else horiz = canH;
      if (horiz) {
        const cut = rng.int(node.y + minSize, node.y + node.h - minSize);
        split({ x: node.x, y: node.y, w: node.w, h: cut - node.y }, depth - 1);
        split({ x: node.x, y: cut, w: node.w, h: node.y + node.h - cut }, depth - 1);
      } else {
        const cut = rng.int(node.x + minSize, node.x + node.w - minSize);
        split({ x: node.x, y: node.y, w: cut - node.x, h: node.h }, depth - 1);
        split({ x: cut, y: node.y, w: node.x + node.w - cut, h: node.h }, depth - 1);
      }
    };
    split(root, 6);

    // 在叶子里挖房间
    for (const leaf of leaves) {
      const pad = 2;
      const minW = 6, minH = 6;
      const rw = Math.max(minW, Math.min(leaf.w - pad * 2, rng.int(minW, Math.max(minW, leaf.w - pad * 2))));
      const rh = Math.max(minH, Math.min(leaf.h - pad * 2, rng.int(minH, Math.max(minH, leaf.h - pad * 2))));
      const rx = leaf.x + rng.int(1, Math.max(1, leaf.w - rw - 1));
      const ry = leaf.y + rng.int(1, Math.max(1, leaf.h - rh - 1));
      const room = { x: rx, y: ry, w: rw, h: rh, cx: (rx + rw / 2) | 0, cy: (ry + rh / 2) | 0, kind: 'normal' };
      map.walkableRect(rx, ry, rw, rh);
      map.rooms.push(room);
    }

    // 走廊连接：按 BSP 邻接 + 随机环路
    const doCorridor = (a, b, width = 2) => {
      const ax = a.cx, ay = a.cy, bx = b.cx, by = b.cy;
      if (rng.chance(.5)) {
        this.hCorr(map, ax, bx, ay, width);
        this.vCorr(map, ay, by, bx, width);
      } else {
        this.vCorr(map, ay, by, ax, width);
        this.hCorr(map, ax, bx, by, width);
      }
    };
    const connectOrder = map.rooms.slice().sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    for (let i = 0; i < connectOrder.length - 1; i++) doCorridor(connectOrder[i], connectOrder[i + 1], 2);
    for (let i = 0; i < Math.floor(map.rooms.length * .8); i++) {
      const a = rng.pick(map.rooms), b = rng.pick(map.rooms);
      if (a !== b && dist(a.cx, a.cy, b.cx, b.cy) < 26) doCorridor(a, b, 2);
    }
    // 中心大房间
    const bigRoom = map.rooms.reduce((p, c) => (c.w * c.h > p.w * p.h ? c : p), map.rooms[0]);
    bigRoom.kind = 'big';
    // 房间内加柱子
    for (const r of map.rooms) {
      if (r.w >= 10 && r.h >= 8 && rng.chance(.4)) {
        const px = r.x + (r.w >> 1), py = r.y + (r.h >> 1);
        map.set(px, py, 0);
        if (r.w >= 12) { map.set(px - 1, py, 0); }
      }
    }
    // 边界加固
    for (let x = 0; x < W; x++) { map.set(x, 0, 0); map.set(x, 1, 0); map.set(x, H - 1, 0); map.set(x, H - 2, 0); }
    for (let y = 0; y < H; y++) { map.set(0, y, 0); map.set(1, y, 0); map.set(W - 1, y, 0); map.set(W - 2, y, 0); }

    // 连通性修复：从最大房间 BFS，把不可达地面填回墙（避免卡在孤岛）
    this.pruneUnreachable(map, bigRoom);

    // 生成纹理
    Texture.buildFloor(map, rng);

    // 标签/兴趣点
    const spawnRoom = map.rooms.reduce((best, r) => {
      const d = dist(r.cx, r.cy, bigRoom.cx, bigRoom.cy);
      return (d > best.d && d < 999) ? { d, r } : best;
    }, { d: 0, r: map.rooms[0] }).r;
    const spawn = { x: (spawnRoom.cx + .5) * map.TS, y: (spawnRoom.cy + .5) * map.TS };
    spawnRoom.kind = 'spawn';

    // 撤离点：挑离出生点最远的几个房间
    const far = map.rooms.slice().sort((a, b) => dist(b.cx, b.cy, spawnRoom.cx, spawnRoom.cy) - dist(a.cx, a.cy, spawnRoom.cx, spawnRoom.cy));
    const extractRooms = [];
    for (const r of far) {
      if (extractRooms.length >= (cfg.extractPts || 2)) break;
      if (r === spawnRoom) continue;
      if (dist(r.cx, r.cy, spawnRoom.cx, spawnRoom.cy) < 22) continue;
      if (extractRooms.some(e => dist(e.cx, e.cy, r.cx, r.cy) < 22)) continue;
      extractRooms.push(r);
    }
    const extracts = extractRooms.map((r, i) => {
      const isPaid = i === 0 && extractRooms.length > 1 && rng.chance(.42);
      return {
        id: 'ex' + i,
        x: (r.cx + .5) * map.TS, y: (r.cy + .5) * map.TS,
        r: 58, active: !isPaid, paid: isPaid, cost: isPaid ? rng.int(5, 12) * 100 : 0,
        label: isPaid ? '付费撤离' : '常规撤离', room: r, progress: 0, channeling: false, channelT: 0, done: false
      };
    });

    // 容器
    const containers = [];
    const count = Math.round(map.rooms.length * 1.55 * (cfg.lootDensity || 1) * (1 + (diff - 1) * .12));
    const kinds = ['crate', 'crate', 'crate', 'ammo', 'medical', 'tool', 'server', 'safe', 'egg'];
    for (let i = 0; i < count; i++) {
      const p = map.randomFloorPoint(rng, 1);
      if (dist(p.x, p.y, spawn.x, spawn.y) < 160) continue;
      if (containers.some(c => dist(c.x, c.y, p.x, p.y) < 70)) continue;
      const r = map.roomAt(p.tx, p.ty);
      let kd = rng.pick(kinds);
      const deco = map.palette.deco;
      if (deco === 'flesh' || deco === 'vein') kd = rng.chance(.55) ? 'egg' : kd;
      if (kd === 'safe' && !rng.chance(.35)) kd = 'server';
      if (kd === 'egg' && deco !== 'flesh' && deco !== 'vein' && !rng.chance(.25)) kd = 'medical';
      containers.push(this.makeContainer(kd, p.x, p.y, rng));
    }
    // 保证每个撤离房间至少一个高价值容器
    for (const z of extracts) {
      if (!containers.some(c => dist(c.x, c.y, z.x, z.y) < 200)) {
        containers.push(this.makeContainer(rng.chance(.5) ? 'safe' : 'server', z.x + rng.range(-50, 50), z.y + rng.range(-50, 50), rng));
      }
    }

    // 敌人出生点
    const enemySpawns = [];
    const enemyDefs = {};
    for (const k in cfg.enemies) enemyDefs[k] = cfg.enemies[k];
    for (const k in enemyDefs) {
      // 单人渗透：敌人总数按 0.72 缩放（原本是三人小队的量）
      const n = Math.max(1, Math.round(enemyDefs[k] * DIFFICULTIES[diff - 1].enemyMul * 0.72));
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 40; tries++) {
          const p = map.randomFloorPoint(rng, 2);
          if (dist(p.x, p.y, spawn.x, spawn.y) < 560) continue;
          if (extracts.some(z => dist(p.x, p.y, z.x, z.y) < 240)) continue;
          enemySpawns.push({ type: k, x: p.x, y: p.y });
          break;
        }
      }
    }
    // BOSS
    let bossSpawn = null;
    if (cfg.boss) {
      bossSpawn = { x: (bigRoom.cx + .5) * map.TS, y: (bigRoom.cy + .5) * map.TS };
      // 清空 BOSS 周围
      for (const z of extracts) { /* keep */ }
    }

    // 道具/装饰
    const props = [];
    const propKinds = map.palette.deco === 'flesh' ? ['bone', 'bone', 'moss', 'cable'] : ['pipe', 'pipe', 'bone', 'moss', 'cable', 'skull'];
    for (let i = 0; i < Math.floor(map.rooms.length * 2.4); i++) {
      const p = map.randomFloorPoint(rng, 1);
      props.push({
        type: rng.pick(propKinds), x: p.x, y: p.y,
        w: rng.range(26, 70), h: rng.range(10, 22), rot: rng.range(0, TAU), seed: rng() * 100
      });
    }
    // 水洼/酸液
    const puddles = [];
    for (let i = 0; i < Math.floor(map.rooms.length * 1.2); i++) {
      const p = map.randomFloorPoint(rng, 1);
      puddles.push({
        x: p.x, y: p.y, r: rng.range(22, 60), rot: rng.range(0, TAU), ph: rng() * 10,
        color: map.palette.deco === 'flesh' ? 'rgba(120,20,50,.5)' : rng.chance(.5) ? 'rgba(60,80,30,.45)' : 'rgba(30,50,50,.4)'
      });
    }

    return {
      map, spawn, extracts, containers, enemySpawns, bossSpawn, props, puddles,
      rooms: map.rooms, bigRoom
    };
  },

  hCorr(map, x1, x2, y, width) {
    const a = Math.min(x1, x2), b = Math.max(x1, x2);
    for (let x = a; x <= b; x++) for (let w = 0; w < width; w++) map.set(x, y + w, 1);
  },
  vCorr(map, y1, y2, x, width) {
    const a = Math.min(y1, y2), b = Math.max(y1, y2);
    for (let y = a; y <= b; y++) for (let w = 0; w < width; w++) map.set(x + w, y, 1);
  },

  pruneUnreachable(map, startRoom) {
    const W = map.w, H = map.h;
    const seen = new Uint8Array(W * H);
    const q = [startRoom.cy * W + startRoom.cx];
    seen[q[0]] = 1;
    while (q.length) {
      const idx = q.pop();
      const x = idx % W, y = (idx / W) | 0;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (seen[ni] || map.tiles[ni] === 0) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    // 把不可达的地面填成墙（保留少量作为视觉）
    for (let i = 0; i < W * H; i++) if (map.tiles[i] === 1 && !seen[i]) map.tiles[i] = 0;
  },

  makeContainer(kindId, x, y, rng) {
    const def = CONTAINERS.find(c => c.id === kindId) || CONTAINERS[0];
    return {
      id: kindId, x, y, r: 15, done: false, opened: false,
      color: def.color, ph: rng() * 10, maxRarity: 0,
      rolls: rng.int(def.slots[0], def.slots[1]),
      rar: def.rar, lock: def.locked
    };
  }
};

/* =========================================================
   Texture — 离屏预渲染地面纹理（性能关键）
   ========================================================= */
const Texture = {
  buildFloor(map, rng) {
    const TS = BAL.TILE, W = map.w * TS, H = map.h * TS;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const pal = map.palette;
    // 底色
    ctx.fillStyle = pal.floor[0];
    ctx.fillRect(0, 0, W, H);
    // 瓷砖
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.get(x, y) === 0) {
          // 墙位置也铺暗色，避免缝隙
          ctx.fillStyle = '#101310';
          ctx.fillRect(x * TS, y * TS, TS, TS);
          continue;
        }
        const h = hash2(x, y, map.seed);
        const h2 = hash2(x, y, map.seed + 91);
        const col = pal.floor[Math.floor(h * pal.floor.length)];
        ctx.fillStyle = col;
        ctx.fillRect(x * TS, y * TS, TS, TS);
        // 砖缝
        ctx.strokeStyle = 'rgba(0,0,0,.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * TS + .5, y * TS + .5, TS - 1, TS - 1);
        // 噪点
        if (h2 > .55) {
          ctx.fillStyle = 'rgba(0,0,0,' + (.06 + h2 * .12) + ')';
          const n = 2 + (h2 * 4 | 0);
          for (let i = 0; i < n; i++) {
            const nx = x * TS + hash2(x * 7 + i, y, 3) * TS;
            const ny = y * TS + hash2(x, y * 7 + i, 5) * TS;
            ctx.fillRect(nx, ny, 2 + hash2(i, x, 9) * 4, 2);
          }
        }
        // 高光
        if (h < .12) {
          ctx.fillStyle = 'rgba(255,255,255,.025)';
          ctx.fillRect(x * TS + 2, y * TS + 2, TS - 4, TS - 4);
        }
      }
    }
    // 大范围污渍
    for (let i = 0; i < Math.floor(map.w * map.h * .06); i++) {
      const x = rng() * W, y = rng() * H;
      const r = 20 + rng() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const hh = rng();
      g.addColorStop(0, hh > .5 ? 'rgba(0,0,0,.15)' : 'rgba(120,140,60,.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    // 主题细节
    const deco = pal.deco;
    if (deco === 'pipe') {
      for (let i = 0; i < map.w; i += 6) {
        ctx.fillStyle = 'rgba(255,200,120,.03)';
        ctx.fillRect(i * TS, 0, 3, H);
      }
      for (let i = 0; i < 40; i++) {
        const x = rng() * W, y = rng() * H;
        ctx.fillStyle = 'rgba(140,80,30,.10)';
        ctx.beginPath(); ctx.ellipse(x, y, 20 + rng() * 40, 10 + rng() * 20, rng() * TAU, 0, TAU); ctx.fill();
      }
    } else if (deco === 'moss') {
      for (let i = 0; i < 260; i++) {
        const x = rng() * W, y = rng() * H;
        const r = 6 + rng() * 24;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(110,180,120,.10)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      // 菌丝
      for (let i = 0; i < 120; i++) {
        const x = rng() * W, y = rng() * H;
        ctx.strokeStyle = 'rgba(150,200,150,.07)';
        ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) ctx.lineTo(x + rng.range(-18, 18), y + rng.range(-18, 18));
        ctx.stroke();
      }
    } else if (deco === 'flesh') {
      for (let i = 0; i < 70; i++) {
        const x = rng() * W, y = rng() * H;
        const r = 30 + rng() * 80;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(160,40,80,.09)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * .7, rng() * TAU, 0, TAU); ctx.fill();
      }
      // 血管
      for (let i = 0; i < 90; i++) {
        let x = rng() * W, y = rng() * H;
        ctx.strokeStyle = 'rgba(140,30,50,.12)'; ctx.lineWidth = 1 + rng() * 1.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += rng.range(-30, 30); y += rng.range(-20, 30);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (deco === 'rust') {
      // 锈水渍与铆钉
      for (let i = 0; i < 160; i++) {
        const x = rng() * W, y = rng() * H;
        const r = 8 + rng() * 46;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rng() > .5 ? 'rgba(170,90,40,.13)' : 'rgba(90,50,20,.14)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * .6, rng() * TAU, 0, TAU); ctx.fill();
      }
      // 铆钉阵列
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(rng() * W / 40) * 40 + 8, y = Math.floor(rng() * H / 40) * 40 + 8 + rng() * 20;
        ctx.fillStyle = 'rgba(230,180,120,.16)';
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.arc(x + .6, y + .8, 1.8, 0, TAU); ctx.fill();
      }
      // 油污条纹
      for (let i = 0; i < 26; i++) {
        const x = rng() * W, y = rng() * H;
        ctx.strokeStyle = 'rgba(20,14,8,.20)'; ctx.lineWidth = 2 + rng() * 5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-90, 90), y + rng.range(10, 60)); ctx.stroke();
      }
    } else if (deco === 'bone') {
      // 骨屑与裂纹
      for (let i = 0; i < 220; i++) {
        const x = rng() * W, y = rng() * H;
        const len = 3 + rng() * 9;
        ctx.strokeStyle = 'rgba(220,210,180,.10)'; ctx.lineWidth = 1 + rng();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + rng.range(-3, 3)); ctx.stroke();
      }
      for (let i = 0; i < 60; i++) {
        let x = rng() * W, y = rng() * H;
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += rng.range(-24, 24); y += rng.range(-16, 16); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // 跪拜用的甲壳板
      for (let i = 0; i < 40; i++) {
        const x = rng() * W, y = rng() * H;
        ctx.strokeStyle = 'rgba(200,190,160,.10)'; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, 12 + rng() * 18, 8 + rng() * 10);
      }
    } else if (deco === 'vein') {
      // 搏动的心室壁
      for (let i = 0; i < 90; i++) {
        const x = rng() * W, y = rng() * H;
        const r = 20 + rng() * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(200,30,90,.10)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * .65, rng() * TAU, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 130; i++) {
        let x = rng() * W, y = rng() * H;
        ctx.strokeStyle = 'rgba(255,80,140,.14)'; ctx.lineWidth = 1 + rng() * 2.2;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x += rng.range(-36, 36); y += rng.range(-24, 36); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // 黏液点
      for (let i = 0; i < 120; i++) {
        const x = rng() * W, y = rng() * H;
        ctx.fillStyle = 'rgba(255,150,200,.10)';
        ctx.beginPath(); ctx.arc(x, y, 1 + rng() * 3, 0, TAU); ctx.fill();
      }
    }
    // 边缘暗角（每块区域）
    this.paintWalls(ctx, map);
    map.floorTex = c;
  },

  /** 一次性把墙体烘焙进静态纹理（避免每帧重绘数万个小矩形） */
  paintWalls(ctx, map) {
    const TS = BAL.TILE, W = map.w, H = map.h;
    const pal = map.palette;
    // 地面环境光遮蔽
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (map.get(x, y) === 0) continue;
        const px = x * TS, py = y * TS;
        if (map.get(x, y - 1) === 0) {
          ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.fillRect(px, py, TS, 4);
          ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(px, py + 4, TS, 4);
        }
        if (map.get(x - 1, y) === 0) {
          ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(px, py, 4, TS);
          ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(px + 4, py, 4, TS);
        }
      }
    }
    // 墙体
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (map.get(x, y) !== 0) continue;
        const px = x * TS, py = y * TS;
        const near = map.get(x + 1, y) !== 0 || map.get(x - 1, y) !== 0 || map.get(x, y + 1) !== 0 || map.get(x, y - 1) !== 0;
        if (!near) { ctx.fillStyle = '#0d100d'; ctx.fillRect(px, py, TS, TS); continue; }
        const h = hash2(x, y, 7);
        ctx.fillStyle = pal.wall[(h * 3) | 0];
        ctx.fillRect(px, py, TS, TS);
        ctx.fillStyle = 'rgba(0,0,0,.16)';
        ctx.fillRect(px, py + TS * .5, TS, 1.5);
        ctx.fillRect(px + TS * .52, py, 1.5, TS);
        if (map.get(x, y - 1) !== 0) {
          ctx.fillStyle = pal.wallTop;
          ctx.globalAlpha = .85; ctx.fillRect(px, py, TS, 4);
          ctx.globalAlpha = .35; ctx.fillRect(px, py + 4, TS, 2);
          ctx.globalAlpha = 1;
        }
        if (map.get(x - 1, y) !== 0) { ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(px, py, 3, TS); }
        if (map.get(x + 1, y) !== 0) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px + TS - 3, py, 3, TS); }
        if (map.get(x, y + 1) !== 0 || map.get(x + 1, y) !== 0) {
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          if (map.get(x, y + 1) !== 0) ctx.fillRect(px, py + TS - 2, TS, 2);
          if (map.get(x + 1, y) !== 0) ctx.fillRect(px + TS - 2, py, 2, TS);
        }
        if (h > .78) {
          ctx.fillStyle = 'rgba(0,0,0,.22)';
          ctx.fillRect(px + h * 20, py + 8 + h * 12, 4 + h * 10, 3);
        }
        if (h < .18) {
          ctx.fillStyle = pal.accent; ctx.globalAlpha = .13;
          ctx.fillRect(px + 5, py + 5, TS - 10, TS - 10); ctx.globalAlpha = 1;
        }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, map.px, map.py);
  }
};
