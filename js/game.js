/* =========================================================
   game.js — 主控：存档 / 行动状态机 / 循环 / 战斗结算 / 撤离
   ========================================================= */
'use strict';

const SAVE_DEFAULT = () => ({
  version: 1,
  economyV2: true,
  credits: BAL.START_CREDITS,
  worms: { green: { downed: false }, yellow: { downed: false }, purple: { downed: false } },
  loadout: {
    weapons: { green: 'rifle77', yellow: 'smg9', purple: 'shot12' },
    armorTier: { green: 1, yellow: 1, purple: 1 },
    bonusArmor: { green: 0, yellow: 0, purple: 0 },
    bonusHp: { green: 0, yellow: 0, purple: 0 },
    eliteArmor: 0, eliteHelmet: 0,
    carryBonus: 0, ammoBonus: 0, acidResist: 0, radar: false, accuracy: 0
  },
  consumables: { medkit: 2, grenade: 2, smoke: 1 },
  ownedWeapons: ['rifle77', 'smg9', 'shot12'],
  ownedGear: [],
  activeWorm: 'green',
  stash: [],
  stashCap: 40,
  ammo: 0,
  market: { day: 0, seed: 1, bought: {} },
  redeemed: [],
  unlockedMaps: ['pipes'],
  stats: { raids: 0, extracts: 0, kills: 0, earned: 0, loot: 0, best: 0, bossKills: 0 },
  welcomed: false,
  lastMap: 0, lastDiff: 0
});

const Game = {
  save: null,
  state: 'title',          // title | hangar | raid | result
  g: null,
  raf: 0,
  lastT: 0,
  _acc: 0,
  titleT: 0,

  init() {
    const loaded = Store.load();
    this.save = loaded || SAVE_DEFAULT();
    // 物价 ×100 版本：老存档一次性补 99 万
    if (loaded && !this.save.economyV2) {
      this.save.credits = (this.save.credits || 0) + 990000;
      this.save.economyV2 = true;
    }
    // 迁移/补全
    const def = SAVE_DEFAULT();
    for (const k in def) if (this.save[k] === undefined) this.save[k] = def[k];
    for (const k in def.loadout) if (this.save.loadout[k] === undefined) this.save.loadout[k] = def.loadout[k];
    for (const k in def.stats) if (this.save.stats[k] === undefined) this.save.stats[k] = def.stats[k];
    if (this.save.activeWorm === undefined) this.save.activeWorm = def.activeWorm;
    if (!this.save.stash) this.save.stash = [];
    if (this.save.stashCap === undefined) this.save.stashCap = def.stashCap;
    if (this.save.ammo === undefined) this.save.ammo = 0;
    if (!this.save.market) this.save.market = { day: 0, seed: 1, bought: {} };
    if (!this.save.redeemed) this.save.redeemed = [];
    if (this.save.loadout.eliteArmor === undefined) this.save.loadout.eliteArmor = 0;
    if (this.save.loadout.eliteHelmet === undefined) this.save.loadout.eliteHelmet = 0;
    this.persist();
    Render.init($('#game-canvas'));
    Input.init($('#game-canvas'));
    this.bindUI();
    this.startTitle();
  },

  persist() { Store.save(this.save); },

  /* =========================================================
     标题画面
     ========================================================= */
  startTitle() {
    this.state = 'title';
    UI.gotoScreen('title');
    Audio2.init();
    const tc = $('#title-canvas');
    const tctx = tc.getContext('2d');
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tc.width = innerWidth * dpr; tc.height = innerHeight * dpr;
      tc.style.width = innerWidth + 'px'; tc.style.height = innerHeight + 'px';
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    this.titleT = 0;
    const titleLoop = (ts) => {
      if (this.state !== 'title') return;
      const t = ts / 1000;
      this.titleT = t;
      tctx.setTransform(Math.min(devicePixelRatio || 1, 2), 0, 0, Math.min(devicePixelRatio || 1, 2), 0, 0);
      Render.drawTitleScene(tctx, innerWidth, innerHeight, t, WORMS);
      requestAnimationFrame(titleLoop);
    };
    requestAnimationFrame(titleLoop);
    // 存档信息
    const s = this.save;
    $('#title-save-info').textContent = `档案：已行动 ${s.stats.raids} 次 / 撤离 ${s.stats.extracts} 次 / 虫币 ◇${fmt(s.credits)}`;
    Audio2.startMusic('menu');
  },

  /* =========================================================
     大厅
     ========================================================= */
  gotoHangar() {
    this.state = 'hangar';
    UI.gotoScreen('hangar');
    Audio2.stopMusic();
    Audio2.startMusic('menu');
    UI._tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    // 出战干员：优先沿用上次选择，若在医疗舱则换一条可用的
    let sel = WORMS.findIndex(w => w.id === this.save.activeWorm);
    if (sel < 0 || this.save.worms[WORMS[sel].id].downed) {
      sel = WORMS.findIndex(w => !this.save.worms[w.id].downed);
      if (sel < 0) sel = 0;
    }
    UI.selectedWorm = sel;
    UI.selectedMap = this.save.lastMap != null ? this.save.lastMap : 0;
    UI.selectedDiff = this.save.lastDiff != null ? this.save.lastDiff : 0;
    if (!this.save.unlockedMaps.includes(MAPS[UI.selectedMap].id)) UI.selectedMap = 0;
    UI.renderHangar(this.save);
    setText('#prep-note', '保险箱默认开启 · 点击角色切换');
    if (!this.save.welcomed) {
      this.save.welcomed = true;
      this.persist();
      setTimeout(() => {
        if (this.state !== 'hangar' || $('#modal').classList.contains('show')) return;
        UI.toastModal('欢迎加入「三个蛆行动」',
          `三条特勤蛆，每次只派一条单独渗透——没有队友，倒下就是行动结束。<br><br>
          <b style="color:#b8f24a">① 选</b>：在大厅点选这次出战的蛆，装备与强化各自独立。<br>
          <b style="color:#ffb02e">② 搜</b>：靠近箱子按 <kbd>E</kbd>，发光的东西可以直接捡。<br>
          <b style="color:#59e3c8">③ 打</b>：白蛆巡逻队会先开火。<kbd>左键</kbd>射击，<kbd>R</kbd>换弹，<kbd>Shift</kbd>技能，<kbd>G</kbd>手雷。<br>
          <b style="color:#ffd93d">④ 撤</b>：找到撤离点，按住 <kbd>F</kbd> 读秒完成撤离。<br><br>
          每张地图有<b>准入战备</b>（武器+护甲+配件的价值总和），不够进不去，先在大厅看一眼顶栏的「战备」。
          阵亡或超时：除安全箱里的 3 件物资外，全部丢失；这次带的那条蛆要进医疗舱才能再用。
          带出的物资会先进仓库，回大厅点「仓库」出售换虫币。`);
      }, 400);
    }
  },

  /* =========================================================
     开始行动
     ========================================================= */
  /** 返回不能出发的原因（没有则 null） */
  deployBlock() {
    const save = this.save;
    const mapCfg = MAPS[UI.selectedMap];
    const alive = WORMS.filter(w => !save.worms[w.id].downed);
    if (!alive.length) {
      return { title: '全员在医疗舱', body: '三条蛆都躺在医疗舱里。先复苏一条，或者重置档案。' };
    }
    let op = WORMS[UI.selectedWorm];
    if (!op || save.worms[op.id].downed) op = alive[0];
    const knife = !!UI.knifeMode;
    const gear = knife ? 0 : UI.gearScore(save, op.id);
    if (!knife && gear < (mapCfg.minGear || 0)) {
      return {
        title: '战备不足',
        body: `「${mapCfg.short}」准入战备 <b style="color:#ffb02e">◇${fmt(mapCfg.minGear)}</b>，当前「${op.name}」战备 <b style="color:#ff8a7d">◇${fmt(gear)}</b>。<br><br>
        提升方式：军械库购买更好的武器、护甲 Ⅱ/Ⅲ 型或战术配件；也可以换一条战备更高的蛆。<br>
        或者切到「跑刀」模式：战备 0，只带一把蛆刀，物资 +25%。`
      };
    }
    return null;
  },

  /** 部署前的二次确认 */
  askDeploy() {
    if (this.state !== 'hangar' || this.g) return;
    const modal = document.getElementById('modal');
    if (modal && modal.classList.contains('show')) return;
    const block = this.deployBlock();
    if (block) { UI.toastModal(block.title, block.body); return; }
    const save = this.save;
    const mapCfg = MAPS[UI.selectedMap];
    const diff = DIFFICULTIES[UI.selectedDiff];
    const alive = WORMS.filter(w => !save.worms[w.id].downed);
    let op = WORMS[UI.selectedWorm];
    if (!op || save.worms[op.id].downed) op = alive[0];
    const knife = !!UI.knifeMode;
    const gear = knife ? 0 : UI.gearScore(save, op.id);
    const cons = save.consumables || {};
    const ammo = save.ammo || 0;

    UI.hideModal();
    $('#modal-title').textContent = '确认出发';
    $('#modal-body').innerHTML = `
      <div class="deploy-confirm">
        <div class="dc-head"><b>${mapCfg.name}</b><span>${diff.name}</span></div>
        <div class="dc-grid">
          <div><span>出战干员</span><b style="color:${op.color}">『${op.name}』</b></div>
          <div><span>行动模式</span><b>${knife ? '跑刀' : '常规'}</b></div>
          <div><span>战备</span><b>${knife ? '◇0（无视准入）' : '◇' + fmt(gear)}</b></div>
          <div><span>额外备弹</span><b>${knife ? '不适用' : ammo + ' 发'}</b></div>
          <div><span>消耗品</span><b>${knife ? '无' : `医疗包×${cons.medkit || 0} · 手雷×${cons.grenade || 0} · 烟雾×${cons.smoke || 0}`}</b></div>
          <div><span>仓库</span><b>${(save.stash || []).length} / ${save.stashCap || 40} 格</b></div>
        </div>
        <p class="dc-warn">${knife
          ? '跑刀模式：只带一把蛆刀，无护甲、无消耗品；带出物资价值 +25%。阵亡或超时仍会损失安全箱以外的物资。'
          : '阵亡或超时：除安全箱里的 3 件物资外全部丢失，出战的蛆将进入医疗舱。'}</p>
        <div class="dc-actions">
          <button class="btn btn-primary" id="dc-confirm">确认出发</button>
          <button class="btn btn-ghost" id="dc-cancel">再想想</button>
        </div>
      </div>`;
    UI.showModal();
    setTimeout(() => { const b = $('#dc-confirm'); if (b) b.focus(); }, 40);
    $('#dc-confirm').onclick = () => {
      UI.hideModal();
      Audio2.play('ui_big');
      this.startRaid();
    };
    $('#dc-cancel').onclick = () => UI.hideModal();
  },

  startRaid() {
    if (this.state === 'raid') return;
    const save = this.save;
    const mapCfg = MAPS[UI.selectedMap];
    const diffIdx = UI.selectedDiff;
    const diff = DIFFICULTIES[diffIdx];
    const block = this.deployBlock();
    if (block) { UI.toastModal(block.title, block.body); return; }
    const knifeMode = !!UI.knifeMode;
    // 单人渗透：只能带一条蛆进场
    const aliveWorms = WORMS.filter(w => !save.worms[w.id].downed);
    let operator = WORMS[UI.selectedWorm];
    if (!operator || save.worms[operator.id].downed) {
      operator = aliveWorms[0];
      UI.selectedWorm = WORMS.indexOf(operator);
    }

    Audio2.init(); Audio2.resume();
    this.state = 'raid';
    UI.gotoScreen('raid');
    Audio2.startMusic('raid');
    // 清理上一次行动遗留的遮罩
    UI.hideModal();
    $('#raid-paused').classList.remove('show');
    $('#inventory-overlay').classList.remove('show');
    $('#channel-ui').classList.remove('show');
    $('#interact-hint').classList.remove('show');
    $('#boss-bar').classList.remove('show');
    $('#event-feed').innerHTML = '';
    $('#subtitle').classList.remove('show');
    $('#center-toast').classList.remove('show');

    const world = MapGen.generate(mapCfg, diffIdx + 1);
    const g = {
      map: world.map, mapCfg, diff, diffIdx,
      knife: knifeMode,
      spawn: world.spawn, extracts: world.extracts, containers: world.containers,
      props: world.props, puddles: world.puddles,
      enemies: [], bullets: [], acids: [], grenades: [], smokes: [],
      groundItems: [], particles: new Particles(1800), popups: [], flashes: [],
      worms: [], active: null,
      camera: new Camera(),
      time: 0, timeLeft: mapCfg.time,
      explored: new Uint8Array(world.map.w * world.map.h),
      lootList: [], lootValue: 0, squadWeight: 0,
      consumables: knifeMode ? { medkit: 0, grenade: 0, smoke: 0 } : Object.assign({}, save.consumables),
      containersOpened: 0, kills: 0, dmgDealt: 0,
      hurtFlash: 0, collectFlash: 0, hitMarkerT: 0,
      mouseWorld: { x: 0, y: 0 }, mouseScreen: { x: 0, y: 0 },
      inputState: { up: false, down: false, left: false, right: false, fire: false, reload: false },
      paused: false, invOpen: false, ended: false,
      inExtract: null, channeling: false, channelT: 0, nearestExtract: null,
      boss: null, bossSpawned: false, bossSpawn: world.bossSpawn,
      slowMul: 1, noise: 0, fHeld: false,
      time0: performance.now()
    };
    // 引用存档中的装备加成
    g.meta = save;
    g.loadout = save.loadout;
    // —— 状态对象上的回调桥接（实体层通过 g.xxx 调用） ——
    g.popup = (x, y, t, c, s) => Game.popup(x, y, t, c, s);
    g.feed = (t, k) => UI.feed(g, t, k);
    g.toast = (t, s) => UI.toast(g, t, s);
    g.subtitle = (t, d) => UI.subtitle(t, d);
    g.logEvent = (t, k) => UI.feed(g, t, k);
    g.onWormHurt = (w, d, s) => Game.onWormHurt(w, d, s);
    g.onWormDowned = w => Game.onWormDowned(w);
    g.onEnemyAlert = e => Game.onEnemyAlert(e);
    g.onEnemyKilled = (e, s) => Game.onEnemyKilled(e, s);
    g.onBossKilled = b => Game.onBossKilled(b);
    g.spawnEnemy = (t, x, y) => Game.spawnEnemy(t, x, y, g);
    this.g = g;
    // 相机
    g.camera.w = Render.W; g.camera.h = Render.H;
    g.camera.x = world.spawn.x; g.camera.y = world.spawn.y;

    // 行动契约
    const pool = CONTRACTS.filter(c => !c.onlyBoss || mapCfg.boss);
    g.contract = pick(pool);

    // 生成蛆虫：单人渗透，只带选中的一条
    const pw = new Worm(operator, world.spawn.x, world.spawn.y, true, g);
    g.worms.push(pw);
    g.active = pw;
    g.operator = operator;
    save.activeWorm = operator.id;
    // 交易行买的弹药：部署时一次性带入（跑刀无枪，不消耗）
    if (!knifeMode && (save.ammo || 0) > 0) {
      pw.reserve += save.ammo;
      this.feed('额外备弹 +' + save.ammo + ' 发', 'cyan');
      save.ammo = 0;
    }
    this.persist();

    // 敌人
    for (const sp of world.enemySpawns) this.spawnEnemy(sp.type, sp.x, sp.y, g);
    // 接触发式提示
    this.subtitle(pick(SUBTITLES.start));
    if (knifeMode) {
      this.feed('跑刀模式 · 战备 0 · 只带一把蛆刀', 'gold');
      this.feed('跑刀加成：带出物资价值 +25%', 'gold');
    } else {
      this.feed('单人渗透 · ' + operator.name + ' 已进入 ' + mapCfg.short, 'cyan');
    }
    this.feed('目标：搜刮物资，撤离带出', '');
    setTimeout(() => {
      if (this.state !== 'raid') return;
      this.subtitle(knifeMode
        ? operator.name + '：刀在嘴里，货在别人箱子里。'
        : operator.name + '：只有我一个。别指望有人来拉你。');
    }, 4200);

    UI.initHud(g);
    // BOSS 提前提示
    if (mapCfg.boss) {
      setTimeout(() => { if (this.state === 'raid') { this.feed('侦测到大型生命信号 · 巢母在深处呼吸', 'red'); this.subtitle(pick(SUBTITLES.boss)); } }, 2500);
    }
    // 首次教程提示
    setTimeout(() => { if (this.state === 'raid' && g.time < 8) this.subtitle('靠近箱子按 E 搜刮，发光的东西可以直接捡。撤离点按住 F。', 5000); }, 8000);
    this.lastT = performance.now();
    this._acc = 0;
  },

  spawnEnemy(type, x, y, g) {
    g = g || this.g;
    const diff = g.diff;
    const e = new Enemy(type, x, y, g, {
      hpMul: type === 'queen' ? 1 + (g.diffIdx) * .2 : 1 + (g.diffIdx - 1) * .18,
      dmgMul: diff.dmgMul * (type === 'queen' ? 1.1 : 1)
    });
    if (type === 'queen') { e.isBoss = true; g.boss = e; }
    g.enemies.push(e);
    return e;
  },

  spawnBoss() {
    const g = this.g;
    if (g.bossSpawned || !g.bossSpawn) return;
    g.bossSpawned = true;
    const b = this.spawnEnemy('queen', g.bossSpawn.x, g.bossSpawn.y, g);
    b.summonT = 2;
    Shake.add(14, 1);
    this.feed('巢母苏醒了', 'red');
    this.toast('巢母苏醒', '');
    Audio2.play('fail', { vol: .35 });
    $('#boss-bar').classList.add('show');
    setText('#boss-name', '巢母 · ' + g.mapCfg.short);
  },

  /* =========================================================
     主循环
     ========================================================= */
  loop(ts) {
    Game.raf = requestAnimationFrame(Game.loop);
    const now = ts;
    let dt = (now - Game.lastT) / 1000;
    Game.lastT = now;
    if (dt > .1) dt = .1;
    if (Game.state === 'raid' && Game.g) {
      if (!Game.g.paused) Game.simulate(Game.g, dt);
      Game.renderRaid(Game.g, dt);
    }
    Input.endFrame();
  },

  simulate(g, dt) {
    g.time += dt;
    if (g.timeLeft > 0) g.timeLeft -= dt;
    g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.2);
    g.collectFlash = Math.max(0, g.collectFlash - dt * 2.6);
    g.hitMarkerT = Math.max(0, g.hitMarkerT - dt * 3);
    if (g.slowMul < 1) g.slowMul = Math.min(1, g.slowMul + dt * 1.5);

    this.handleInput(g, dt);
    this.updateMouse(g);

    // 视野探索
    this.explore(g);

    // 蛆虫
    for (const w of g.worms) if (w.alive) w.update(dt, g);
    // 敌人（AI 周期性刷新流场与标记）
    const aiTick = Math.floor(g.time / .35);
    if (aiTick !== this._aiTick) {
      this._aiTick = aiTick;
      AI.rebuild(g);
      const act = g.active;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const pd = act && act.alive ? dist(e.x, e.y, act.x, act.y) : 9999;
        if (!e.marked && pd < 660) {
          if (pd < 240 || AI.hasLOS(g, e.x, e.y, act.x, act.y, 680)) e.marked = true;
        }
      }
    }
    for (const e of g.enemies) if (e.alive) e.update(dt, g);

    // BOSS 触发：靠近大房间
    if (g.mapCfg.boss && !g.bossSpawned) {
      if (g.active && g.active.alive) {
        const d = dist(g.active.x, g.active.y, g.bossSpawn.x, g.bossSpawn.y);
        if (d < 460 || g.time > 145) this.spawnBoss();
      }
    }

    this.updateBullets(g, dt);
    this.updateAcids(g, dt);
    this.updateGrenades(g, dt);
    this.updateSmokes(g, dt);
    this.updateGroundItems(g, dt);
    this.updateExtraction(g, dt);
    this.updateRadar(g, dt);

    // 粒子/飘字/闪光
    g.particles.update(dt);
    for (let i = g.popups.length - 1; i >= 0; i--) {
      const p = g.popups[i];
      p.life -= dt; p.y -= 34 * dt; p.x += (p.vx || 0) * dt;
      if (p.life <= 0) g.popups.splice(i, 1);
    }
    for (let i = g.flashes.length - 1; i >= 0; i--) {
      g.flashes[i].life -= dt;
      if (g.flashes[i].life <= 0) g.flashes.splice(i, 1);
    }
    Shake.update(dt);

    // 相机
    const cam = g.camera;
    cam.w = Render.W; cam.h = Render.H;
    const a = g.active;
    if (a && a.alive) {
      // 朝鼠标方向偏移
      const offX = clamp((g.mouseScreen.x - Render.W / 2) * .22, -110, 110);
      const offY = clamp((g.mouseScreen.y - Render.H / 2) * .22, -80, 80);
      const z = clamp(Render.W / 1500, .82, 1.15);
      cam.zoom = lerp(cam.zoom, z, 1 - Math.exp(-4 * dt));
      cam.follow(a.x + offX / cam.zoom, a.y + offY / cam.zoom, dt, 7);
    }
    cam.shakeX = Shake.x; cam.shakeY = Shake.y;

    // HUD 在渲染阶段更新（节流），这里只做必要的战斗状态检查

    // 结束条件
    if (!g.ended) {
      if (!g.worms.some(w => w.alive)) this.endRaid(false, 'wipe');
      else if (g.timeLeft <= 0) this.endRaid(false, 'timeout');
    }
    // 清理「单次按下」状态：一次按键只触发一次，避免连触发
    Input.endFrame();
  },

  updateMouse(g) {
    const m = Input.mouse;
    g.mouseScreen.x = m.x; g.mouseScreen.y = m.y;
    const w = g.camera.screenToWorld(m.x + Shake.x, m.y + Shake.y);
    g.mouseWorld.x = w.x; g.mouseWorld.y = w.y;
  },

  handleInput(g, dt) {
    const K = Input.keys;
    const I = g.inputState;
    I.up = !!K['w'] || !!K['arrowup'];
    I.down = !!K['s'] || !!K['arrowdown'];
    I.left = !!K['a'] || !!K['arrowleft'];
    I.right = !!K['d'] || !!K['arrowright'];
    I.fire = Input.mouse.down;
    I.reload = Input.hit('r');
    const a = g.active;
    if (!a || !a.alive) return;
    if (Input.hit('shift')) a.useAbility(g);
    if (Input.hit('q')) this.cycleWorm();
    if (Input.hit('g')) this.throwGrenade(g, a);
    if (Input.hit('1')) this.useConsumable(g, 'medkit');
    if (Input.hit('2')) this.useConsumable(g, 'smoke');
    if (Input.hit('e')) this.interact(g, a);
    if (Input.hit('tab')) this.toggleInventory(g);
    if (Input.hit('m')) this.toggleMute();
    if (Input.hit('escape')) {
      if (g.invOpen) this.toggleInventory(g);
      else this.togglePause(g);
    }
    // 按住 F 撤离（读秒在 updateExtraction 里推进）
    g.fHeld = !!K['f'];
  },

  cycleWorm() {
    const g = this.g;
    const alive = g.worms.filter(w => w.alive);
    if (alive.length <= 1) {
      this.feed('单人渗透：没有可切换的队友', '');
      return;
    }
    const idx = alive.indexOf(g.active);
    const next = alive[(idx + 1) % alive.length];
    this.setActive(next);
    Audio2.play('swap');
    this.feed('切换 → 『' + next.def.name + '』', 'cyan');
  },

  setActive(w) {
    const g = this.g;
    if (!w || !w.alive) return;
    g.active = w;
    w.isPlayer = true;
    g.channeling = false; g.channelT = 0;
    this.feed('『' + w.def.name + '』接管行动', '');
  },

  /* ---------- 交互 ---------- */
  interact(g, a) {
    // 最近的容器
    let best = null, bd = 70;
    for (const c of g.containers) {
      if (c.done) continue;
      const d = dist(a.x, a.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { this.openContainer(g, best); return; }
    // 地面物品
    let gi = null, gd = 60;
    for (const it of g.groundItems) {
      const d = dist(a.x, a.y, it.x, it.y);
      if (d < gd) { gd = d; gi = it; }
    }
    if (gi) { this.pickupGround(g, gi); return; }
    // 撤离点（E 也接受）
    if (g.inExtract) { this.feed('撤离区：按住 F 读秒', 'cyan'); return; }
    this.feed('附近没有可交互的东西', '');
  },

  openContainer(g, c) {
    if (c.done) return;
    c.done = true; c.opened = true;
    g.containersOpened++;
    // 稀有度掷
    const r = Math.random();
    let rar = 0;
    if (r < c.rar[2]) rar = 2; else if (r < c.rar[1] + c.rar[2]) rar = 1;
    const items = [];
    for (let i = 0; i < c.rolls; i++) {
      let rr = rar;
      if (i > 0) {
        const r2 = Math.random();
        rr = r2 < c.rar[2] * .5 ? 2 : r2 < c.rar[1] + c.rar[2] * .5 ? 1 : 0;
      }
      items.push(this.rollItem(g, rr));
    }
    c.loot = items;
    // 直接收入背包；超出负重部分掉地上
    for (const it of items) this.collectItem(g, it);
    Audio2.play(rar === 2 ? 'epic' : rar === 1 ? 'rare' : 'pickup');
    g.collectFlash = .5;
    if (items.length) {
      this.feed('搜刮 ' + c.id + ' · ' + items.map(i => ITEMS_BY_ID[i.id].name).join('、'), rar === 2 ? 'gold' : rar === 1 ? 'cyan' : '');
    }
    UI.hudRefresh = true;
  },

  rollItem(g, rarity) {
    const pool = ITEMS.filter(i => i.rarity === rarity);
    const base = pick(pool);
    const knifeMul = g.knife ? 1.25 : 1;
    const it = { id: base.id, rarity: base.rarity, value: Math.round(base.value * rnd(.7, .95) * (g.diff.lootMul) * .7 * knifeMul) };
    return it;
  },

  collectItem(g, it) {
    const def = ITEMS_BY_ID[it.id];
    const wt = weightOf(it);
    g.lootList.push(it);
    g.lootValue += it.value;
    g.squadWeight += wt;
    g.popup(g.active.x + rnd(-10, 10), g.active.y - 26, '+' + def.name, RARITY[it.rarity].color, 12);
  },

  pickupGround(g, it) {
    const idx = g.groundItems.indexOf(it);
    if (idx >= 0) g.groundItems.splice(idx, 1);
    this.collectItem(g, it);
    Audio2.play(it.rarity === 2 ? 'epic' : it.rarity === 1 ? 'rare' : 'pickup', { vol: .8 });
    this.feed('拾取 ' + ITEMS_BY_ID[it.id].name + ' ◇' + fmt(it.value), it.rarity > 0 ? 'gold' : '');
    g.collectFlash = .35;
  },

  useConsumable(g, kind) {
    const a = g.active;
    if (!a || !a.alive) return;
    if (kind === 'medkit') {
      if (!g.consumables.medkit) { this.feed('没有医疗包了', 'red'); return; }
      if (a.hp >= a.maxHp) { this.feed('生命已满，省着点', ''); return; }
      g.consumables.medkit--;
      a.hp = Math.min(a.maxHp, a.hp + 50);
      a.invuln = .35;
      g.popup(a.x, a.y - 30, '+50', '#b8f24a', 15);
      g.particles.burst(a.x, a.y, 12, { color: '#b8f24a', lifeMin: .3, lifeMax: .6, size: 2.2, speedMin: 20, speedMax: 90, glow: true });
      Audio2.play('ability', { vol: .7 });
      this.feed('使用战地医疗包 +50', 'cyan');
    } else if (kind === 'smoke') {
      if (!g.consumables.smoke) { this.feed('没有烟雾弹了', 'red'); return; }
      g.consumables.smoke--;
      const target = g.mouseWorld;
      const a2 = angleTo(a.x, a.y, target.x, target.y);
      const d = clamp(dist(a.x, a.y, target.x, target.y), 60, 320);
      const sx = a.x + Math.cos(a2) * d, sy = a.y + Math.sin(a2) * d;
      g.smokes.push({ x: sx, y: sy, r: 130, life: 8, maxLife: 8, seed: rnd(0, 100) });
      Audio2.play('grenade_throw', { vol: .8 });
      this.feed('菌孢烟雾弹已投掷', 'cyan');
    }
  },

  throwGrenade(g, a) {
    if (!g.consumables.grenade) { this.feed('没有手雷了', 'red'); return; }
    g.consumables.grenade--;
    const target = g.mouseWorld;
    const ang = angleTo(a.x, a.y, target.x, target.y);
    const dd = clamp(dist(a.x, a.y, target.x, target.y), 60, 420);
    const sx = a.x + Math.cos(ang) * 22, sy = a.y + Math.sin(ang) * 22;
    g.grenades.push({
      x: sx, y: sy, sx, sy,
      tx: a.x + Math.cos(ang) * dd, ty: a.y + Math.sin(ang) * dd,
      t: 0, dur: clamp(dd / 520, .35, .75), fuse: .85, fuseMax: .85,
      spin: 0, height: 0, owner: a
    });
    Audio2.play('grenade_throw');
    this.feed('投出手雷', '');
  },

  /* ---------- 撤离 ---------- */
  updateExtraction(g, dt) {
    const a = g.active;
    let inside = null;
    if (a && a.alive) {
      for (const z of g.extracts) {
        if (z.done) continue;
        if (dist(a.x, a.y, z.x, z.y) < z.r) { inside = z; break; }
      }
    }
    g.inExtract = inside;
    // 最近撤离点
    let near = null, nd = Infinity;
    if (a && a.alive) {
      for (const z of g.extracts) {
        if (z.done) continue;
        const d = dist(a.x, a.y, z.x, z.y);
        if (d < nd) { nd = d; near = z; }
      }
    }
    g.nearestExtract = near;
    if (!inside) {
      if (g.channeling) { g.channeling = false; this.feed('撤离中断', 'red'); }
      for (const z of g.extracts) if (!z.done) z.progress = Math.max(0, z.progress - dt * 1.5);
      g.channelT = 0;
      return;
    }
    if (inside.done) return;
    // 按住 F 才读秒
    if (!g.fHeld) {
      if (g.channeling) {
        g.channeling = false;
        this.feed('撤离中断 · 进度开始回退', 'red');
      }
      inside.progress = Math.max(0, inside.progress - dt * .7);
      return;
    }
    // 付费撤离：进入时结算一次
    if (inside.paid && !inside.paidDone) {
      if (this.save.credits >= inside.cost) {
        this.save.credits -= inside.cost;
        inside.paidDone = true;
        this.persist();
        this.feed('支付 ◇' + fmt(inside.cost) + ' · 撤离通道开启', 'gold');
      } else {
        if (!g._payWarned) {
          g._payWarned = true;
          this.feed('虫币不足 ◇' + fmt(inside.cost) + '，无法使用付费撤离', 'red');
          setTimeout(() => { g._payWarned = false; }, 4000);
        }
        return;
      }
    }
    if (!g.channeling) {
      g.channeling = true;
      g.channelT = inside.progress * BAL.CHANNEL_TIME;
      this.feed('撤离倒计时开始 · 保持在撤离区', 'cyan');
      Audio2.play('extract_go', { vol: .5 });
    }
    const before = Math.floor(g.channelT);
    g.channelT += dt;
    inside.progress = clamp(g.channelT / BAL.CHANNEL_TIME, 0, 1);
    if (Math.floor(g.channelT) !== before) Audio2.play('extract_tick', { vol: .45 });
    if (inside.progress >= 1) this.finishExtract(g, inside);
  },

  finishExtract(g, z) {
    if (g.ended) return;
    z.done = true;
    g.ended = true;
    this.endRaid(true, 'extract');
  },

  /* ---------- 子弹 / 酸液 / 手雷 ---------- */
  updateBullets(g, dt) {
    const bl = g.bullets;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      b.life -= dt;
      if (b.life <= 0) { bl.splice(i, 1); continue; }
      const px = b.x, py = b.y;
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      // 命中墙
      const tWall = Collide.rayWall(g, px, py, nx, ny);
      let hitT = tWall, hitEnt = null;
      if (b.kind === 'player') {
        for (const e of g.enemies) {
          if (!e.alive) continue;
          const t = Collide.segCircle(px, py, nx, ny, e.x, e.y, e.radius + 2);
          if (t >= 0 && t < hitT) { hitT = t; hitEnt = e; }
        }
      } else {
        for (const w of g.worms) {
          if (!w.alive) continue;
          const t = Collide.segCircle(px, py, nx, ny, w.x, w.y, w.radius + 2);
          if (t >= 0 && t < hitT) { hitT = t; hitEnt = w; }
        }
      }
      const hx = px + (nx - px) * hitT, hy = py + (ny - py) * hitT;
      if (hitEnt) {
        if (b.kind === 'player') {
          const dmg = b.dmg * rnd(.9, 1.1);
          const dealt = hitEnt.takeDamage(dmg, b.owner, {});
          g.dmgDealt += dealt || dmg;
          g.hitMarkerT = .18;
          g.popup(hx, hy - 8, Math.round(dealt || dmg), '#ffe9a0', 12);
          g.particles.burst(hx, hy, 6, {
            color: '#ffd9a0', lifeMin: .1, lifeMax: .35, size: 2, angle: Math.atan2(b.vy, b.vx) + Math.PI, spread: .9, speedMin: 40, speedMax: 180
          });
          Audio2.play('hit', { vol: .25 });
          if (b.owner && b.owner.alive) b.owner.dmgDealt += dealt || dmg;
        } else {
          hitEnt.takeDamage(b.dmg, b.owner, { knock: 4 });
          g.particles.burst(hx, hy, 5, { color: b.kind === 'acid' ? '#c8f24a' : '#ffb0a0', lifeMin: .1, lifeMax: .3, size: 2, speedMin: 30, speedMax: 120 });
          Audio2.play('hurt', { vol: .35 });
          // 酸液命中处留下腐蚀滩
          if (b.kind === 'acid' && Math.random() < .55) this.addAcidPool(g, hx, hy, b.owner);
        }
        bl.splice(i, 1);
        continue;
      }
      if (hitT < 1) {
        // 打墙
        g.particles.burst(hx, hy, 4, {
          color: '#cfd6c0', lifeMin: .1, lifeMax: .3, size: 1.8, angle: Math.atan2(b.vy, b.vx) + Math.PI, spread: 1, speedMin: 30, speedMax: 150, kind: 'spark'
        });
        if (b.kind === 'player') Audio2.play('hit_wall', { vol: .08 });
        if (b.kind === 'acid' && Math.random() < .4) this.addAcidPool(g, hx, hy, b.owner);
        bl.splice(i, 1);
        continue;
      }
      b.x = nx; b.y = ny;
      // 酸液飞行拖尾
      if (b.kind === 'acid' && Math.random() < .35) {
        g.particles.spawn({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: .3, maxLife: .3, size: 2, color: '#c8f24a', glow: true });
      }
    }
  },

  addAcidPool(g, x, y, owner) {
    if (g.acids.length > 40) g.acids.shift();
    g.acids.push({
      x: x + rnd(-10, 10), y: y + rnd(-10, 10), r: rnd(28, 42),
      life: 6, dmgT: .3, owner, ph: rnd(0, 6)
    });
  },

  updateAcids(g, dt) {
    for (let i = g.acids.length - 1; i >= 0; i--) {
      const a = g.acids[i];
      a.life -= dt;
      if (a.life <= 0) { g.acids.splice(i, 1); continue; }
      a.dmgT -= dt;
      if (a.dmgT <= 0) {
        a.dmgT = .6;
        const resist = (this.g && this.g.knife) ? 0 : (this.save.loadout.acidResist || 0);
        for (const w of g.worms) {
          if (!w.alive) continue;
          if (dist(w.x, w.y, a.x, a.y) < a.r + w.radius) {
            w.takeDamage(7 * (1 - resist), a.owner, {});
            if (w === g.active) g.slowMul = .72;
          }
        }
      }
    }
  },

  updateGrenades(g, dt) {
    for (let i = g.grenades.length - 1; i >= 0; i--) {
      const gr = g.grenades[i];
      gr.t += dt;
      const p = clamp(gr.t / gr.dur, 0, 1);
      const e = easeOutCubic(p);
      gr.x = lerp(gr.sx, gr.tx, e);
      gr.y = lerp(gr.sy, gr.ty, e);
      gr.height = Math.sin(p * Math.PI) * 46;
      gr.spin += dt * 14;
      gr.fuse -= dt;
      // 拖尾
      if (Math.random() < .6) g.particles.spawn({ x: gr.x, y: gr.y - gr.height, vx: 0, vy: 0, life: .25, maxLife: .25, size: 1.4, color: '#ffd98a' });
      if (gr.fuse <= 0) {
        this.explode(g, gr.x, gr.y, BAL.GRENADE_RADIUS, BAL.GRENADE_DMG, gr.owner);
        g.grenades.splice(i, 1);
      }
    }
  },

  explode(g, x, y, radius, dmg, owner) {
    Audio2.play('explode');
    Shake.add(12, .45);
    g.flashes.push({ x, y, r: radius * 2, life: .3, maxLife: .3 });
    g.particles.burst(x, y, 46, {
      color: '#ffb45a', lifeMin: .2, lifeMax: .7, size: 3.4, speedMin: 60, speedMax: 340, drag: .92, glow: true, kind: 'spark'
    });
    g.particles.burst(x, y, 24, { color: '#5c4a38', lifeMin: .4, lifeMax: 1.2, size: 4, speedMin: 20, speedMax: 160, drag: .9, grav: -20 });
    g.particles.spawn({ x, y, vx: 0, vy: 0, life: .4, maxLife: .4, size: 10, color: '#ffd9a0', kind: 'ring', glow: true });
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < radius + e.radius) {
        const falloff = 1 - clamp((d - e.radius) / radius, 0, 1) * .6;
        const dealt = e.takeDamage(dmg * falloff, owner, {});
        g.dmgDealt += dealt || 0;
        g.popup(e.x, e.y - 16, Math.round(dealt || dmg * falloff), '#ffb45a', 13);
      }
    }
    for (const w of g.worms) {
      if (!w.alive) continue;
      const d = dist(x, y, w.x, w.y);
      if (d < radius * .7 + w.radius) w.takeDamage(dmg * .35, null, { knock: 18 });
    }
  },

  updateSmokes(g, dt) {
    for (let i = g.smokes.length - 1; i >= 0; i--) {
      const s = g.smokes[i];
      s.life -= dt;
      if (s.life <= 0) g.smokes.splice(i, 1);
    }
  },

  updateGroundItems(g, dt) {
    // 自动拾取
    const a = g.active;
    if (!a || !a.alive) return;
    for (let i = g.groundItems.length - 1; i >= 0; i--) {
      const it = g.groundItems[i];
      it.ph = (it.ph || 0) + dt;
      if (dist(a.x, a.y, it.x, it.y) < 34) {
        this.pickupGround(g, it);
      }
    }
  },

  updateRadar(g, dt) {
    if (!this.save.loadout.radar || g.knife) return;
    this._radarT = (this._radarT || 0) + dt;
    if (this._radarT > 12) {
      this._radarT = 0;
      const a = g.active;
      let n = 0;
      for (const e of g.enemies) {
        if (e.alive && dist(e.x, e.y, a.x, a.y) < 520) { e.marked = true; n++; }
      }
      if (n) this.feed('地底声呐：标记 ' + n + ' 个生命信号', 'cyan');
    }
  },

  explore(g) {
    const TS = g.map.TS, W = g.map.w;
    const a = g.active;
    if (!a) return;
    const cx = Math.floor(a.x / TS), cy = Math.floor(a.y / TS);
    const R = 8;
    let changed = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= g.map.h) continue;
      if (dx * dx + dy * dy > R * R) continue;
      const i = y * W + x;
      if (!g.explored[i]) { g.explored[i] = 1; changed++; }
    }
    if (changed) g.exploredV = (g.exploredV || 0) + 1;
  },

  /* ---------- 事件回调 ---------- */
  onWormHurt(w, dmg, src) {
    const g = this.g;
    g.hurtFlash = Math.min(.8, g.hurtFlash + .35);
    Shake.add(4, .16);
    Audio2.play('hurt', { vol: .5 });
    if (w === g.active && g.channeling) {
      g.channeling = false; g.channelT = 0;
      if (g.inExtract) g.inExtract.progress *= .5;
      this.feed('撤离被打断！', 'red');
    }
    if (w === g.active && w.hp / w.maxHp < .3 && !this._lowHpSaid) {
      this._lowHpSaid = true;
      this.subtitle(pick(SUBTITLES.low_hp));
      this.feed(pick(LINES.low_hp), 'red');
      setTimeout(() => { this._lowHpSaid = false; }, 12000);
    }
  },

  onWormDowned(w) {
    const g = this.g;
    this.feed('『' + w.def.name + '』倒下了', 'red');
    this.subtitle(pick(SUBTITLES.death));
    if (w === g.active) {
      const alive = g.worms.filter(x => x.alive);
      if (alive.length) {
        this.setActive(alive[0]);
        this.toast('『' + w.def.name + '』阵亡', 'small');
      } else {
        this.toast('渗透失败', '');
      }
    } else {
      this.toast('『' + w.def.name + '』阵亡', 'small');
    }
  },

  onEnemyAlert(e) { },
  onEnemyKilled(e, src) {
    const g = this.g;
    g.kills++;
    if (src && src.hp !== undefined) src.kills = (src.kills || 0) + 1;
    this.save.stats.kills++;
    // 掉落
    if (Math.random() < .35) {
      const r = Math.random();
      const rar = r < .08 ? 2 : r < .38 ? 1 : 0;
      const it = this.rollItem(g, rar);
      g.groundItems.push({ x: e.x + rnd(-14, 14), y: e.y + rnd(-14, 14), id: it.id, rarity: it.rarity, value: it.value, ph: rnd(0, 6) });
    }
    // 小概率掉消耗品（跑刀模式不补给）
    if (!g.knife && Math.random() < .18) {
      const kind = Math.random() < .5 ? 'medkit' : 'grenade';
      g.consumables[kind] = (g.consumables[kind] || 0) + 1;
      this.feed('缴获 ' + (kind === 'medkit' ? '战地医疗包' : '浓缩手雷') + ' ×1', 'cyan');
    }
    if (e.def.boss) { }
  },

  onBossKilled(b) {
    const g = this.g;
    this.save.stats.bossKills++;
    this.feed('巢母已被击杀 · 有机物停止溢出', 'gold');
    this.toast('巢母已消灭', '');
    // 掉落史诗
    for (let i = 0; i < 3; i++) {
      const it = this.rollItem(g, 2);
      g.groundItems.push({ x: b.x + rnd(-50, 50), y: b.y + rnd(-50, 50), id: it.id, rarity: it.rarity, value: it.value, ph: rnd(0, 6) });
    }
    if (!g.knife) g.consumables.grenade += 2;
    setTimeout(() => { $('#boss-bar').classList.remove('show'); }, 2500);
    this.subtitle('大紫：拆完了。这就是它呼吸的地方？');
  },

  /* ---------- 渲染 ---------- */
  renderRaid(g, dt) {
    Render.ensureSize();
    const cam = g.camera;
    Render.drawWorld(g);
    UI.updateHud(g);
    // 小地图
    const mm = $('#minimap');
    if (mm) Render.drawMinimap(mm.getContext('2d'), g, mm.width, mm.height);
  },

  /* ---------- 结束行动 ---------- */
  endRaid(success, reason) {
    const g = this.g;
    if (g._ending) return;
    g._ending = true;
    g.ended = true;
    g.paused = true;
    const save = this.save;
    save.stats.raids++;
    // 安全箱：阵亡时保留 3 件最稀有
    let loot = g.lootList.slice();
    let keptLoot = [];
    let lostValue = 0;
    if (!success) {
      loot.sort((a, b) => b.rarity - a.rarity || b.value - a.value);
      keptLoot = loot.slice(0, BAL.SAFE_SLOTS);
      const lost = loot.slice(BAL.SAFE_SLOTS);
      lostValue = lost.reduce((a, b) => a + b.value, 0);
      loot = keptLoot;
    }
    const lootValue = loot.reduce((a, b) => a + b.value, 0);
    // 入库：仓库有空位就存进去，满了的部分直接折现
    const stashCap = save.stashCap || 40;
    let storedValue = 0, storedCount = 0, overflowValue = 0;
    for (const it of loot) {
      if (save.stash.length < stashCap) {
        save.stash.push({ id: it.id, value: it.value });
        storedValue += it.value;
        storedCount++;
      } else {
        overflowValue += it.value;
      }
    }
    // 阵亡处理
    const dead = g.worms.filter(w => !w.alive).map(w => w.def.id);
    for (const id of dead) save.worms[id].downed = true;
    let revived = [];
    // 收入：物资本身不直接变成虫币，回大厅出售；仓库溢出才自动折现
    let earned = overflowValue;
    let contractDone = false, contractBonus = 0;
    save.credits += overflowValue;
    save.stats.earned += overflowValue;
    if (success) {
      save.stats.extracts++;
      save.stats.loot += lootValue;
      save.stats.best = Math.max(save.stats.best, lootValue);
      // 解锁地图（按累计撤离次数）
      for (const m of MAPS) {
        if (!save.unlockedMaps.includes(m.id) && save.stats.extracts >= m.unlock) save.unlockedMaps.push(m.id);
      }
      // 行动契约
      if (g.contract && g.contract.check(g)) {
        contractDone = true;
        contractBonus = g.contract.bonus;
        save.credits += contractBonus;
        save.stats.earned += contractBonus;
        earned += contractBonus;
      }
    } else {
      // 医疗费：救活一条（随机/最贵的）
      const downedIds = WORMS.filter(w => save.worms[w.id].downed).map(w => w.id);
      if (downedIds.length >= 3) {
        // 全灭：自动复活一条，扣医疗费
        const cheapest = downedIds[0];
        save.worms[cheapest].downed = false;
        save.credits = Math.max(0, save.credits - BAL.REVIVE_COST);
        revived.push(WORM_BY_ID[cheapest].name);
      }
      save.stats.loot += lootValue;
    }
    if (success && !g.knife) {
      save.consumables = Object.assign({}, g.consumables);
    }
    // 地图解锁的提示
    const beforeMaps = save.unlockedMaps.length;
    save.lastMap = UI.selectedMap; save.lastDiff = UI.selectedDiff;
    this.persist();
    // 医疗舱说明
    let medbay = '';
    if (revived.length) {
      medbay = `全员在医疗舱。特勤处从战利品里扣了 ◇${fmt(BAL.REVIVE_COST)} 医疗费，把「${revived[0]}」拼了回来；其余成员可在准备界面付费复苏。`;
    } else if (!success) {
      medbay = dead.length ? '这次出战的蛆已被送进医疗舱，可在准备界面付费复苏。' : '';
    }
    this.medbayNote = medbay;
    // 结算画面
    const lootForDisplay = success ? loot : keptLoot;
    UI.gotoScreen('result');
    UI.renderResult({
      success, reason,
      knife: !!g.knife,
      mapName: g.mapCfg.name, diffName: g.diff.name,
      stats: {
        duration: g.time, kills: g.kills, dmg: Math.round(g.dmgDealt),
        containers: g.containersOpened, lootValue: lootValue,
        lost: lostValue, earned, credits: save.credits,
        storedValue, storedCount, overflow: overflowValue,
        stashCount: save.stash.length, stashCap
      },
      loot: lootForDisplay,
      squad: g.worms.map(w => ({ name: w.def.name, color: w.def.color, alive: w.alive, kills: w.kills })),
      safeKept: success ? 0 : keptLoot.length,
      medbay,
      contract: g.contract ? { name: g.contract.name, desc: g.contract.desc, bonus: g.contract.bonus, done: contractDone, got: contractBonus } : null
    });
    if (success) {
      Audio2.play('success');
      setTimeout(() => { if (save.unlockedMaps.length > beforeMaps) UI.toastModal('新区域解锁', '特勤处批准了新的行动区域，返回大厅查看。'); }, 1200);
    } else {
      Audio2.play('fail');
    }
    Audio2.stopMusic();
    setTimeout(() => {
      if (this.state === 'result' || this.state === 'raid') {
        this.g = null;
        this.state = 'result';
      }
    }, 120);
  },

  toggleMute() {
    const on = Audio2.toggleMute();
    const btn = $('#btn-mute');
    if (btn) btn.textContent = on ? '音效 开' : '音效 关';
    if (this.g) this.feed(on ? '音效已开启' : '音效已关闭', '');
  },

  /* ---------- 全屏 ---------- */
  toggleFullscreen() {
    const doc = document;
    const el = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (el) {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      try { exit.call(doc); } catch (e) { }
      return;
    }
    const root = doc.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) {
      if (this.g) this.feed('当前浏览器不支持全屏，请按 F11', 'red');
      return;
    }
    try {
      const p = req.call(root);
      if (p && p.catch) p.catch(() => { if (this.g) this.feed('浏览器拒绝了全屏，请按 F11', 'red'); });
    } catch (e) {
      if (this.g) this.feed('全屏失败，请按 F11', 'red');
    }
  },

  syncFullscreenUI() {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    for (const sel of ['#btn-fullscreen', '#btn-hangar-fullscreen']) {
      const b = $(sel);
      if (b) b.textContent = on ? '退出全屏' : '全屏';
    }
  },

  onFullscreenChange() {
    this.syncFullscreenUI();
    Render.resize(true);
    if (this.state === 'raid' && this.g) this.renderRaid(this.g, 0);
  },

  togglePause(g) {
    g.paused = !g.paused;
    $('#raid-paused').classList.toggle('show', g.paused);
    if (g.paused) { Input.mouse.down = false; }
  },

  toggleInventory(g) {
    g.invOpen = !g.invOpen;
    if (g.invOpen) {
      const grid = $('#inv-grid');
      grid.innerHTML = '';
      if (!g.lootList.length) grid.innerHTML = '<div style="grid-column:1/3;color:#7f887c;font-size:11px;line-height:1.8">还没有搜到任何东西。<br>靠近箱子按 E。</div>';
      const sorted = g.lootList.slice().sort((a, b) => b.value - a.value);
      for (const it of sorted) {
        const def = ITEMS_BY_ID[it.id];
        const row = el('div', 'inv-row');
        row.style.borderLeftColor = RARITY[def.rarity].color;
        row.innerHTML = `<span class="nm">${def.name}</span><span class="vl">◇${fmt(it.value)}</span>`;
        grid.appendChild(row);
      }
      $('#inv-total').textContent = '合计 ◇ ' + fmt(g.lootValue) + ' · ' + g.squadWeight.toFixed(1) + ' kg';
      $('#inventory-overlay').classList.add('show');
    } else $('#inventory-overlay').classList.remove('show');
  },

  /* ---------- 小工具 ---------- */
  feed(text, kind) { if (this.g) UI.feed(this.g, text, kind); },
  toast(text, size) { if (this.g) UI.toast(this.g, text, size); },
  subtitle(text, dur) { UI.subtitle(text, dur); },
  popup(x, y, text, color, size) {
    if (!this.g) return;
    this.g.popups.push({ x, y, text: String(text), color, size: size || 13, life: .9, maxLife: .9, vx: rnd(-8, 8) });
    while (this.g.popups.length > 40) this.g.popups.shift();
  },

  /* ---------- 事件绑定 ---------- */
  bindUI() {
    $('#btn-start').onclick = () => { Audio2.init(); Audio2.resume(); Audio2.play('ui_big'); this.gotoHangar(); };
    $('#btn-title-help').onclick = () => UI.showHelp();
    $('#btn-hangar-shop').onclick = () => {
      UI.openShop(this.save, () => { this.persist(); UI.renderHangar(this.save); });
    };
    $('#btn-hangar-help').onclick = () => UI.showHelp();
    $('#btn-hangar-stash').onclick = () => UI.openStash(this.save);
    $('#btn-hangar-market').onclick = () => UI.openMarket(this.save);
    $('#btn-hangar-redeem').onclick = () => UI.openRedeem(this.save);
    $('#credit-chip').onclick = () => {
      UI.exactCredits = !UI.exactCredits;
      Audio2.play('ui');
      UI.renderHangar(this.save);
    };
    $('#btn-mute').onclick = () => this.toggleMute();
    $('#btn-hangar-reset').onclick = () => {
      UI.toastModal('重置档案', '这会清空所有虫币、装备与仓库记录，无法恢复。<br><br>' +
        '<button class="btn btn-primary" onclick="Game.doReset()">确认重置</button>');
    };
    $('#btn-deploy').onclick = () => { if (this.state !== 'raid') { Audio2.play('ui'); this.askDeploy(); } };
    $$('#difficulty-row .diff-btn').forEach(b => b.onclick = () => {
      UI.selectedDiff = +b.dataset.diff;
      UI.renderBrief(this.save);
      UI.updateDeployBar(this.save);
      Audio2.play('ui');
    });
    $$('.mode-btn').forEach(b => b.onclick = () => {
      UI.knifeMode = b.dataset.mode === 'knife';
      UI.syncModeButtons();
      Audio2.play('ui');
      UI.renderHangar(this.save);
    });
    $('#modal-close').onclick = () => UI.hideModal();
    $('#modal').onclick = (e) => { if (e.target.id === 'modal') UI.hideModal(); };
    $('#btn-resume').onclick = () => { if (this.g) this.togglePause(this.g); };
    $('#btn-abandon').onclick = () => {
      if (this.g) { this.g.paused = false; $('#raid-paused').classList.remove('show'); this.abandonRaid(); }
    };
    $('#btn-result-continue').onclick = () => {
      Audio2.play('ui_big');
      this.gotoHangar();
    };
    // 全屏
    $('#btn-fullscreen').onclick = () => this.toggleFullscreen();
    $('#btn-hangar-fullscreen').onclick = () => this.toggleFullscreen();
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    window.addEventListener('keydown', e => {
      if (e.altKey && (e.key === 'Enter' || e.code === 'NumpadEnter')) {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
    this.syncFullscreenUI();
    // 回车：确认出发弹层里再按一次回车 = 确认
    window.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.altKey) return;
      const btn = document.getElementById('dc-confirm');
      const modal = document.getElementById('modal');
      if (btn && modal && modal.classList.contains('show')) {
        e.preventDefault();
        btn.click();
      }
    });
    // ESC 关闭弹层
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && UI.currentScreen === 'hangar') UI.hideModal();
    });
    // 回车开始行动（大厅）；Alt+Enter 是全屏，不能触发开始
    window.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.altKey) {
        const modal = document.getElementById('modal');
        if (this.state === 'hangar') {
          if (!modal || !modal.classList.contains('show')) { Audio2.play('ui'); this.askDeploy(); }
        }
        else if (this.state === 'title') { Audio2.play('ui_big'); this.gotoHangar(); }
        else if (this.state === 'result') this.gotoHangar();
      }
    });
  },

  doReset() {
    Store.clear();
    this.save = SAVE_DEFAULT();
    this.persist();
    UI.hideModal();
    this.gotoHangar();
    UI.toastModal('档案已重置', '新的三条蛆已经就位。别浪费它们。');
  },

  abandonRaid() {
    const g = this.g;
    if (!g) return;
    g.ended = true;
    const save = this.save;
    save.stats.raids++;
    save.stats.earned += 0;
    // 撤退视为失败但没有阵亡惩罚
    this.persist();
    UI.gotoScreen('hangar');
    this.state = 'hangar';
    this.g = null;
    Audio2.stopMusic();
    Audio2.startMusic('menu');
    UI.renderHangar(this.save);
    this.feed('已放弃行动，物资全部遗失。', 'red');
  }
};

/** 撤离读秒逻辑（抽出来避免 updateExtraction 过长） */
function z_channelTick(game, g, z, dt) {
  g.channelT += dt;
  z.progress = clamp(g.channelT / BAL.CHANNEL_TIME, 0, 1);
  if (Math.floor((g.channelT - dt)) !== Math.floor(g.channelT)) {
    Audio2.play('extract_tick', { vol: .4 });
  }
  if (z.progress >= 1) game.finishExtract(g, z);
}

/** 物资重量（kg）：按稀有度与价值估算 */
function weightOf(it) {
  const base = [1.5, 2.9, 4.8][it.rarity] || 1.5;
  return base * (0.85 + (it.value % 97) / 300);
}
