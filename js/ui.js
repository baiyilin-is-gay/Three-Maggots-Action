/* =========================================================
   ui.js — 界面逻辑：大厅 / 商店 / HUD / 结算 / 弹层
   ========================================================= */
'use strict';

const UI = {
  currentScreen: 'title',
  selectedMap: 0,
  selectedDiff: 0,
  selectedWorm: 0,
  _hudCache: {},
  ARMOR_VALUE: { 1: 600, 2: 1800, 3: 4200 },
  knifeMode: false,
  exactCredits: false,

  /** 虫币显示：默认缩写，点击后精确 */
  creditText(n) {
    return this.exactCredits ? fmt(n) : fmtMoney(n);
  },

  /** 战备 = 武器 + 护甲 + 战术配件的价值总和（《三角洲行动》式准入指标）；跑刀模式按 0 计 */
  gearScore(save, wormId) {
    if (this.knifeMode) return 0;
    const d = WORM_BY_ID[wormId] || WORMS[0];
    const wid = save.loadout?.weapons?.[wormId] || d.weapon;
    const w = WEAPONS[wid] || WEAPONS[d.weapon];
    const tier = save.loadout?.armorTier?.[wormId] || 1;
    let s = (w.value || 0) + (this.ARMOR_VALUE[tier] || 600);
    if ((save.loadout?.bonusHp?.[wormId] || 0) > 0) s += 3200;        // 腺体供能核心
    const owned = save.ownedGear || [];
    if (owned.includes('filter_mask')) s += 1500;                     // 菌丝滤面罩
    if (owned.includes('bandolier')) s += 2600;                       // 弹链背带
    if (owned.includes('scope')) s += 2200;                           // 触须瞄准镜
    if (owned.includes('radar')) s += 2000;                           // 地底声呐
    return s;
  },

  /** 战备构成，用于行前准备面板 */
  gearBreakdown(save, wormId) {
    const d = WORM_BY_ID[wormId] || WORMS[0];
    const wid = save.loadout?.weapons?.[wormId] || d.weapon;
    const w = WEAPONS[wid] || WEAPONS[d.weapon];
    const tier = save.loadout?.armorTier?.[wormId] || 1;
    const parts = [['武器', w.value || 0], ['护甲', this.ARMOR_VALUE[tier] || 600]];
    if ((save.loadout?.bonusHp?.[wormId] || 0) > 0) parts.push(['供能核心', 3200]);
    const owned = save.ownedGear || [];
    if (owned.includes('filter_mask')) parts.push(['滤面罩', 1500]);
    if (owned.includes('bandolier')) parts.push(['弹链', 2600]);
    if (owned.includes('scope')) parts.push(['瞄准镜', 2200]);
    if (owned.includes('radar')) parts.push(['声呐', 2000]);
    return parts;
  },

  canDeploy(save, map, wormId) {
    return this.gearScore(save, wormId) >= (map.minGear || 0);
  },

  gearText(save, wormId) { return '◇' + fmt(this.gearScore(save, wormId)); },

  /* ---------- 屏幕切换 ---------- */
  gotoScreen(id) {
    const cur = $('.screen.active');
    if (cur && cur.id !== 'screen-' + id) { cur.classList.remove('active'); cur.classList.add('leaving'); }
    const next = $('#screen-' + id);
    if (next) {
      next.classList.remove('leaving');
      next.classList.add('active');
    }
    this.currentScreen = id;
  },

  /* ---------- 大厅渲染 ---------- */
  syncModeButtons() {
    $$('.mode-btn').forEach(b => b.classList.toggle('active', (b.dataset.mode === 'knife') === !!this.knifeMode));
  },

  renderHangar(save) {
    this.syncModeButtons();
    setText('#hangar-credits', this.creditText(save.credits));
    const chip = $('#credit-chip');
    if (chip) chip.title = '精确：◇' + fmt(save.credits) + ' · 点击切换' + (this.exactCredits ? '为缩写' : '为精确数值');
    const op = WORMS[this.selectedWorm] || WORMS[0];
    setText('#hangar-gear', fmt(this.gearScore(save, op.id)));
    setText('#hangar-raids', save.stats.extracts + ' / ' + save.stats.raids);
    setText('#hangar-total', fmtMoney(save.stats.earned));
    this.renderWormCards(save);
    this.renderSquadExtra(save);
    this.renderMapSelect(save);
    this.renderPrep(save);
    this.updateDeployBar(save);
    // 地图锁定检查
  },

  renderWormCards(save) {
    const box = $('#worm-cards');
    box.innerHTML = '';
    WORMS.forEach((def, i) => {
      const ws = save.worms[def.id];
      const isSel = i === this.selectedWorm;
      const card = el('div', 'worm-card' + (isSel ? ' selected' : '') + (ws.downed ? ' downed' : ''));
      card.style.setProperty('--worm-color', def.color);
      const wid = this.knifeMode ? 'knife' : (save.loadout.weapons[def.id] || def.weapon);
      const wpn = WEAPONS[wid] || WEAPONS[def.weapon];
      const maxHp = this.knifeMode ? def.hp : def.hp + (save.loadout.bonusHp?.[def.id] || 0);
      const eliteA = save.loadout.eliteArmor || 0, eliteH = save.loadout.eliteHelmet || 0;
      const maxArmor = this.knifeMode ? 0
        : ((eliteA > 0 ? eliteA : def.armor + (save.loadout.bonusArmor?.[def.id] || 0)) + eliteH);
      const carry = this.knifeMode ? def.carry : def.carry + (save.loadout.carryBonus || 0);
      card.innerHTML = `
        ${isSel && !ws.downed ? '<span class="deploy-badge">本次出战</span>' : ''}
        <div class="worm-portrait"><canvas width="128" height="128" data-portrait="${def.id}"></canvas></div>
        <div class="worm-info">
          <div class="worm-name">『${def.name}』<span class="role">${def.title}</span>${ws.downed ? '<span class="med-tag">医疗舱</span>' : ''}</div>
          <div class="worm-epithet">${def.epithet}</div>
          <div class="worm-weapon"><span class="wpn-tag">${wpn.short}</span>${wpn.name}</div>
          <div class="worm-bars">
            <div class="mini-bar"><i style="width:${ws.downed ? 0 : 100}%;background:linear-gradient(90deg,${def.color2},${def.color})"></i></div>
            <div class="mini-bar armor"><i style="width:${ws.downed ? 0 : 100}%"></i></div>
          </div>
          <div class="stat-line"><span>HP ${maxHp}</span><span>甲 ${maxArmor}</span><span>负重 ${carry}kg</span><span>战备 ◇${fmt(this.gearScore(save, def.id))}</span></div>
          ${ws.downed ? `<button class="revive-btn" data-revive="${def.id}">医疗舱复苏 · ◇${fmt(UI.reviveCost(save))}</button>` : ''}
        </div>`;
      card.onclick = (e) => {
        if (e.target.closest('[data-revive]')) { UI.reviveWorm(def.id); return; }
        if (ws.downed) { this.toastModal('『' + def.name + '』在医疗舱', '先花 ◇' + fmt(this.reviveCost(save)) + ' 把它拼回来，才能派它出战。'); return; }
        this.selectedWorm = i;
        save.activeWorm = def.id;
        Game.persist();
        this.renderHangar(save);
        Audio2.play('ui');
      };
      box.appendChild(card);
    });
    // 头像动画（全局只跑一个循环，避免重复渲染时叠加）
    if (this._portraitRAF) return;
    this._portraitRAF = true;
    const startT = performance.now();
    const anim = () => {
      if (this.currentScreen !== 'hangar') { this._portraitRAF = false; return; }
      const t = (performance.now() - startT) / 1000;
      for (const cv of $$('[data-portrait]')) {
        const d = WORM_BY_ID[cv.dataset.portrait];
        if (d && cv.isConnected) Render.drawWormPortrait(cv, d, t * 1.2);
      }
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  },

  /** 复活费用：虫币不足时按现有虫币收取（医疗舱不赶尽杀绝） */
  reviveCost(save) { return Math.min(BAL.REVIVE_COST, Math.max(0, save.credits)); },

  reviveWorm(id) {
    const save = Game.save;
    if (!save.worms[id].downed) return;
    const cost = this.reviveCost(save);
    if (save.credits < BAL.REVIVE_COST && save.credits <= 0) {
      this.toastModal('医疗舱', '你连一个虫币都没有了。<br>去随便搜一趟，带点东西回来，医疗舱才肯动手。');
      return;
    }
    save.credits -= cost;
    save.worms[id].downed = false;
    Game.persist();
    Audio2.play('rare');
    this.renderHangar(save);
    const d = WORM_BY_ID[id];
    this.toastModal('复苏完成', `「${d.name}」从医疗舱里爬了出来，缝合线还没拆。<br>花费 ◇${fmt(cost)}。它说下不为例。`);
  },

  renderSquadExtra(save) {
    const box = $('#squad-extra');
    if (!box) return;
    const d = WORMS[this.selectedWorm] || WORMS[0];
    const downed = save.worms[d.id].downed;
    const knife = this.knifeMode;
    const wid = knife ? 'knife' : (save.loadout.weapons[d.id] || d.weapon);
    const wpn = WEAPONS[wid] || WEAPONS[d.weapon];
    const hp = knife ? d.hp : d.hp + (save.loadout.bonusHp?.[d.id] || 0);
    const eliteA = save.loadout.eliteArmor || 0, eliteH = save.loadout.eliteHelmet || 0;
    const armor = knife ? 0
      : ((eliteA > 0 ? eliteA : d.armor + (save.loadout.bonusArmor?.[d.id] || 0)) + eliteH);
    const carry = knife ? d.carry : d.carry + (save.loadout.carryBonus || 0);
    const dps = Math.round(wpn.rpm / 60 * wpn.w * (wpn.pellets || 1));
    const tip = this._tip || (this._tip = TIPS[Math.floor(Math.random() * TIPS.length)]);
    const aliveN = WORMS.filter(x => !save.worms[x.id].downed).length;
    box.innerHTML = `
      <div class="squad-summary">
        <div class="ss-cell"><b>${downed ? '—' : hp}</b><small>干员生命</small></div>
        <div class="ss-cell"><b>${downed ? '—' : armor}</b><small>干员护甲</small></div>
        <div class="ss-cell"><b>${downed ? '—' : carry}</b><small>负重上限</small></div>
        <div class="ss-cell"><b>${downed ? '—' : fmt(dps)}</b><small>理论DPS</small></div>
      </div>
      <div class="squad-intel"><b>今日情报 · 可用 ${aliveN}/3</b>${tip}</div>`;
  },

  renderMapSelect(save) {
    const box = $('#map-list');
    box.innerHTML = '';
    const gear = this.gearScore(save, (WORMS[this.selectedWorm] || WORMS[0]).id);
    MAPS.forEach((m, i) => {
      const locked = !save.unlockedMaps.includes(m.id);
      const gearOk = this.knifeMode || gear >= (m.minGear || 0);
      const card = el('div', 'map-card' + (i === this.selectedMap ? ' selected' : '') + (locked ? ' locked' : ''));
      card.innerHTML = `
        <div class="map-card-name">${m.name}${locked ? ' <span class="lock">🔒 需累计撤离 ' + m.unlock + ' 次</span>' : ''}</div>
        <div class="map-card-desc">${m.desc}</div>
        <div class="map-card-tags">
          <span class="tag ${m.tagCls}">威胁 ${m.diff}</span>
          <span class="tag lv">推荐 Lv.${m.recLv}</span>
          <span class="tag ${gearOk ? 'gear-ok' : 'gear-bad'}">${this.knifeMode ? '跑刀 · 无视准入' : '准入 ◇' + fmt(m.minGear || 0)}</span>
        </div>`;
      card.onclick = () => {
        if (locked) { this.toastModal('区域未解锁', '完成更多行动以解锁「' + m.name + '」。'); return; }
        this.selectedMap = i;
        this.renderMapSelect(save);
        this.renderBrief(save);
        this.updateDeployBar(save);
        Audio2.play('ui');
      };
      box.appendChild(card);
    });
    this.renderBrief(save);
  },

  renderBrief(save) {
    const m = MAPS[this.selectedMap];
    const box = $('#map-brief');
    const diff = DIFFICULTIES[this.selectedDiff];
    const comp = Object.entries(m.enemies).map(([k, v]) => {
      const n = Math.max(1, Math.round(v * diff.enemyMul * .72));
      return { k, name: ENEMIES[k].name, n, color: ENEMIES[k].color };
    });
    const maxN = Math.max(...comp.map(c => c.n), 1);
    const bars = comp.map(c => `
      <div class="threat-row"><span class="tn">${c.name}</span>
        <i class="tb"><b style="width:${Math.round(c.n / maxN * 100)}%;background:${c.color}"></b></i>
        <em>×${c.n}</em></div>`).join('');
    const tips = m.tips.map(t => `<li>${t}</li>`).join('');
    const gear = this.gearScore(save, (WORMS[this.selectedWorm] || WORMS[0]).id);
    const ok = this.knifeMode || gear >= (m.minGear || 0);
    const gearRow = this.knifeMode
      ? `战备 <b class="gear-ok">◇0</b> · <b class="gear-ok">跑刀无视准入</b> · 仅一把蛆刀 · 带出物资价值 <b class="gear-ok">+25%</b>`
      : `战备 <b class="${ok ? 'gear-ok' : 'gear-warn'}">◇${fmt(m.minGear || 0)}</b> · 当前出战干员 <b class="${ok ? 'gear-ok' : 'gear-warn'}">◇${fmt(gear)}</b>${ok ? '' : '<span class="gear-warn">（不足，去军械库强化装备，或切跑刀）</span>'}`;
    box.innerHTML = `
      <div class="brief-row"><span class="brief-k">简报</span><span class="brief-v">${m.brief}</span></div>
      <div class="brief-row"><span class="brief-k">准入</span><span class="brief-v">${gearRow}</span></div>
      <div class="brief-row"><span class="brief-k">威胁组成</span><span class="brief-v">
        <div class="threat-list">${bars}${m.boss ? '<div class="threat-row boss"><span class="tn">巢母 · BOSS</span><i class="tb"><b style="width:100%"></b></i><em>×1</em></div>' : ''}</div>
      </span></div>
      <div class="brief-row"><span class="brief-k">撤离</span><span class="brief-v">${m.extractPts} 个撤离点 · 时限 ${fmtTime(m.time)} · 物资密度 ×${m.lootDensity}</span></div>
      <div class="brief-row"><span class="brief-k">情报</span><span class="brief-v"><ul class="tip-list">${tips}</ul></span></div>`;
    // 难度按钮（只作用于难度行）
    $$('#difficulty-row .diff-btn').forEach(b => b.classList.toggle('active', +b.dataset.diff === this.selectedDiff));
  },

  renderPrep(save) {
    const box = $('#loadout-list');
    box.innerHTML = '';
    const worm = WORMS[this.selectedWorm];
    const knife = this.knifeMode;
    const wid = knife ? 'knife' : (save.loadout.weapons[worm.id] || worm.weapon);
    const wpn = WEAPONS[wid];
    const eliteA = save.loadout.eliteArmor || 0, eliteH = save.loadout.eliteHelmet || 0;
    const armorRows = (eliteA || eliteH) ? [
      ...(eliteA ? [{ ico: '🛡', nm: '七级甲 · 母巢外壳', qty: '耐久 ' + eliteA }] : []),
      ...(eliteH ? [{ ico: '⛑', nm: '七级头 · 巢母颅骨', qty: '耐久 ' + eliteH }] : [])
    ] : [{
      ico: '🛡', nm: '甲壳护甲 · ' + (save.loadout.armorTier?.[worm.id] || 1) + ' 型',
      qty: '甲 ' + (worm.armor + (save.loadout.bonusArmor?.[worm.id] || 0))
    }];
    const rows = knife ? [
      { ico: '▮', nm: '蛆刀「最后一口」', qty: '近战' },
      { ico: '🛡', nm: '无护甲（跑刀）', qty: '甲 0' },
      { ico: '▣', nm: '战备值', qty: '◇0' },
      { ico: '◈', nm: '安全箱（死亡保护）', qty: '3 格' },
      { ico: '✚', nm: '无消耗品', qty: '× 0' },
      { ico: '✹', nm: '无手雷', qty: '× 0' },
      { ico: '◌', nm: '无烟雾', qty: '× 0' }
    ] : [
      { ico: '▮', nm: wpn.name, qty: wpn.short },
      { ico: '▮', nm: '额外备弹（交易行）', qty: '× ' + (save.ammo || 0) + ' 发' },
      ...armorRows,
      { ico: '▣', nm: '战备值（武器 + 护甲 + 配件）', qty: '◇' + fmt(this.gearScore(save, worm.id)) },
      { ico: '◈', nm: '安全箱（死亡保护）', qty: '3 格' },
      { ico: '✚', nm: '战地医疗包', qty: '× ' + (save.consumables.medkit || 0) },
      { ico: '✹', nm: '浓缩手雷', qty: '× ' + (save.consumables.grenade || 0) },
      { ico: '◌', nm: '菌孢烟雾弹', qty: '× ' + (save.consumables.smoke || 0) }
    ];
    for (const r of rows) {
      const d = el('div', 'lo-item');
      d.innerHTML = `<span class="lo-ico">${r.ico}</span><span class="lo-name">${r.nm}</span><span class="lo-qty">${r.qty}</span>`;
      box.appendChild(d);
    }
    // 仓库
    const stash = save.stash || [];
    const cap = save.stashCap || 40;
    const total = stash.reduce((a, b) => a + (b.value || ITEMS_BY_ID[b.id]?.value || 0), 0);
    const sb = $('#stash-list');
    sb.innerHTML = '';
    if (!stash.length) {
      sb.innerHTML = '<div class="stash-empty">仓库空着。<br>带出的物资会自动入库，回来在这儿出售换虫币。</div>';
    } else {
      const sorted = stash.slice().sort((a, b) => b.value - a.value);
      sorted.slice(0, 8).forEach(it => {
        const def = ITEMS_BY_ID[it.id];
        if (!def) return;
        const row = el('div', 'stash-row');
        row.innerHTML = `<span class="dot" style="background:${RARITY[def.rarity].color};box-shadow:0 0 6px ${RARITY[def.rarity].color}"></span>
          <span class="nm">${def.name}</span><span class="vl">◇${fmt(it.value)}</span>`;
        sb.appendChild(row);
      });
      if (sorted.length > 8) sb.appendChild(el('div', 'stash-more', '还有 ' + (sorted.length - 8) + ' 件…'));
    }
    const summary = el('div', 'stash-summary');
    summary.innerHTML = `<span>仓库 <b>${stash.length}</b> / ${cap} 格</span><span>估值 <b>◇${fmtMoney(total)}</b></span>`;
    sb.appendChild(summary);
    const manage = el('button', 'btn btn-primary stash-manage', '管理仓库 / 出售');
    manage.onclick = () => UI.openStash(save);
    sb.appendChild(manage);
  },

  /* ---------- 仓库 ---------- */
  openStash(save) {
    this._sellAllArmed = false;
    const body = $('#modal-body');
    const render = () => {
      const items = (save.stash || []).slice().sort((a, b) => b.value - a.value);
      const total = items.reduce((s, i) => s + i.value, 0);
      const cap = save.stashCap || 40;
      let html = `<div class="stash-hd">
        <div>仓库 <b>${items.length}</b> / ${cap} 格</div>
        <div>总估值 <b>◇${fmtMoney(total)}</b></div>
      </div>`;
      if (!items.length) {
        html += '<div class="stash-empty big">仓库是空的。<br>带物资成功撤离（或安全箱保住）后会自动入库。</div>';
      } else {
        html += '<div class="stash-grid">';
        items.forEach(it => {
          const def = ITEMS_BY_ID[it.id] || { name: '未知物资', rarity: 0 };
          html += `<div class="stash-item">
            <span class="si-r" style="color:${RARITY[def.rarity].color}">${RARITY[def.rarity].name}</span>
            <span class="si-n">${def.name}</span>
            <span class="si-v">◇${fmt(it.value)}</span>
            <button class="btn btn-ghost si-sell">出售</button>
          </div>`;
        });
        html += '</div>';
      }
      if (items.length >= cap) {
        html += `<div class="stash-warn">仓库已满：再带出的物资会直接折现。可去军械库买「仓库扩容」。</div>`;
      }
      html += `<div class="stash-actions">
        <button class="btn btn-primary" id="stash-sell-all" ${items.length ? '' : 'disabled'}>${this._sellAllArmed ? '再点一次确认出售全部' : '全部出售 ◇' + fmtMoney(total)}</button>
        <button class="btn btn-ghost" id="stash-close">关闭</button>
      </div>`;
      body.innerHTML = html;

      $$('.si-sell').forEach((b, idx) => {
        b.onclick = () => {
          const item = items[idx];
          if (!item) return;
          this._sellAllArmed = false;
          const pos = save.stash.indexOf(item);
          if (pos < 0) return;
          save.stash.splice(pos, 1);
          save.credits += item.value;
          save.stats.earned += item.value;
          Game.persist();
          Audio2.play('rare');
          this.renderHangar(save);
          render();
        };
      });
      const all = $('#stash-sell-all');
      if (all) all.onclick = () => {
        if (!items.length) return;
        if (!this._sellAllArmed) { this._sellAllArmed = true; render(); return; }
        const sum = save.stash.reduce((s, i) => s + i.value, 0);
        save.credits += sum;
        save.stats.earned += sum;
        save.stash = [];
        this._sellAllArmed = false;
        Game.persist();
        Audio2.play('rare');
        this.renderHangar(save);
        render();
      };
      const close = $('#stash-close');
      if (close) close.onclick = () => this.hideModal();
    };
    render();
    $('#modal-title').textContent = '仓库 · 战利品';
    this.showModal();
  },

  /* ---------- 交易行 ---------- */
  marketDay() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  },
  mkHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  },
  ensureMarket(save) {
    const day = this.marketDay();
    if (!save.market || save.market.day !== day) {
      save.market = { day, seed: 1, bought: {} };
      Game.persist();
    }
    if (!save.market.bought) save.market.bought = {};
  },
  mkKey(save) { return save.market.day + ':' + save.market.seed; },
  mkMul(save, id, salt, lo, hi) {
    return lo + this.mkHash(this.mkKey(save) + '|' + salt + '|' + id) * (hi - lo);
  },
  mkPrice(base, save, id, salt, lo, hi) {
    return Math.max(1, Math.round(base * this.mkMul(save, id, salt, lo, hi) / 5) * 5);
  },
  mkTrend(mul) {
    if (mul > 1.08) return '<b class="mk-up">▲</b>';
    if (mul < .95) return '<b class="mk-down">▼</b>';
    return '<b class="mk-flat">–</b>';
  },
  mkStock(save, id, max) {
    return 1 + Math.floor(this.mkHash(this.mkKey(save) + '|stock|' + id) * max);
  },
  mkLeft(save, id, max) {
    return Math.max(0, this.mkStock(save, id, max) - (save.market.bought[id] || 0));
  },
  mkSellPrice(save, item) {
    return Math.max(1, Math.round((item.value || 0) * this.mkMul(save, item.id, 'sell', .85, 1.15) / 5) * 5);
  },
  marketLoot(save) {
    const pool = ITEMS.filter(i => i.rarity >= 1).slice().sort((a, b) => a.id.localeCompare(b.id));
    if (!pool.length) return [];
    const start = (save.market.seed - 1) % pool.length;
    return Array.from({ length: Math.min(6, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
  },

  marketBuy(save, kind, id) {
    const worm = WORMS[this.selectedWorm] || WORMS[0];
    const left = (max) => this.mkLeft(save, id, max);
    const take = () => { save.market.bought[id] = (save.market.bought[id] || 0) + 1; };
    if (kind === 'weapon') {
      const w = WEAPONS[id];
      if (!w) return '未知武器';
      if (save.ownedWeapons.includes(id)) return '这把枪已经在你库里了';
      const price = this.mkPrice(w.price, save, id, 'buy', .9, 1.15);
      if (left(2) <= 0) return '本轮已经售罄，等刷新';
      if (save.credits < price) return '虫币不足';
      save.credits -= price;
      save.ownedWeapons.push(id);
      save.loadout.weapons[worm.id] = id;
      take();
      Game.persist(); Audio2.play('rare');
      this.renderHangar(save);
      return `已买下 ${w.name}，并装备给『${worm.name}』`;
    }
    if (kind === 'armor') {
      const g = SHOP_ITEMS.find(x => x.id === id);
      if (!g) return '未知护甲';
      if ((save.loadout.eliteArmor || 0) > 0) return '已经装备七级甲，不需要再买护甲';
      const tier = id === 'armor3' ? 3 : 2;
      const cur = save.loadout.armorTier[worm.id] || 1;
      if (cur >= tier) return '已经装备同级或更高的护甲';
      const price = this.mkPrice(g.price, save, id, 'buy', .9, 1.15);
      if (left(2) <= 0) return '本轮已经售罄，等刷新';
      if (save.credits < price) return '虫币不足';
      save.credits -= price;
      save.loadout.armorTier[worm.id] = tier;
      save.loadout.bonusArmor[worm.id] = g.effect.armor;
      take();
      Game.persist(); Audio2.play('rare');
      this.renderHangar(save);
      return `『${worm.name}』换上了 ${g.name}`;
    }
    if (kind === 'ammo') {
      const a = MARKET_AMMO.find(x => x.id === id);
      if (!a) return '未知弹药';
      if ((save.ammo || 0) + a.rounds > 600) return '额外弹药上限 600 发';
      const price = this.mkPrice(a.price, save, id, 'buy', .85, 1.15);
      if (left(6) <= 0) return '本轮已经售罄，等刷新';
      if (save.credits < price) return '虫币不足';
      save.credits -= price;
      save.ammo = (save.ammo || 0) + a.rounds;
      take();
      Game.persist(); Audio2.play('rare');
      this.renderHangar(save);
      return `弹药 +${a.rounds} 发（当前 ${save.ammo} / 600）`;
    }
    if (kind === 'consumable') {
      const g = SHOP_ITEMS.find(x => x.id === id);
      const key = g && g.effect && g.effect.consumable;
      const cap = { medkit: 3, grenade: 6, smoke: 3 }[key];
      if (!key || !cap) return '未知消耗品';
      if ((save.consumables[key] || 0) >= cap) return '这类消耗品已经带满了';
      const price = this.mkPrice(g.price, save, id, 'buy', .85, 1.15);
      if (left(5) <= 0) return '本轮已经售罄，等刷新';
      if (save.credits < price) return '虫币不足';
      save.credits -= price;
      save.consumables[key] = (save.consumables[key] || 0) + 1;
      take();
      Game.persist(); Audio2.play('rare');
      this.renderHangar(save);
      return `${g.name} +1（${save.consumables[key]} / ${cap}）`;
    }
    if (kind === 'loot') {
      const base = ITEMS.find(x => x.id === id);
      if (!base) return '未知物资';
      if ((save.stash || []).length >= (save.stashCap || 40)) return '仓库已满，先卖点东西';
      const price = this.mkPrice(base.value, save, id, 'buy', 1.0, 1.3);
      if (left(4) <= 0) return '本轮已经售罄，等刷新';
      if (save.credits < price) return '虫币不足';
      save.credits -= price;
      save.stash.push({ id: base.id, value: base.value });
      take();
      Game.persist(); Audio2.play('rare');
      this.renderHangar(save);
      return `${base.name} 已存入仓库（估值 ◇${fmt(base.value)}）`;
    }
    return '未知操作';
  },

  openMarket(save) {
    this.ensureMarket(save);
    if (!this._mkTab) this._mkTab = 'weapon';
    this._mkMsg = '';
    this._mkSellAll = false;
    const body = $('#modal-body');
    const render = () => {
      const worm = WORMS[this.selectedWorm] || WORMS[0];
      let sellItems = [];
      const tabs = [
        ['weapon', '枪械'], ['armor', '护甲'], ['ammo', '弹药'],
        ['consumable', '消耗品'], ['loot', '变卖物'], ['sell', '出售']
      ];
      let html = `<div class="mk-head">
        <div class="mk-balance" title="精确：◇${fmt(save.credits)} · 点击切换精确 / 缩写">虫币 <b>◇${this.creditText(save.credits)}</b></div>
        <div class="mk-day">行情 #${save.market.seed} · 每日 0 点换价 · 库存有限</div>
        <button class="btn btn-ghost" id="mk-refresh" ${save.credits >= 300 ? '' : 'disabled'}>刷新行情 ◇300</button>
      </div>`;
      html += '<div class="shop-tabs">' + tabs.map(([id, n]) =>
        `<button class="shop-tab mk-tab${this._mkTab === id ? ' active' : ''}" data-tab="${id}">${n}</button>`).join('') + '</div>';
      if (this._mkMsg) html += `<div class="mk-msg">${this._mkMsg}</div>`;
      html += '<div class="shop-grid mk-grid">';

      const card = (title, sub, desc, base, salt, maxStock, kind, id, disabled, label, extra) => {        const price = this.mkPrice(base, save, id, salt, kind === 'loot' ? 1.0 : (kind === 'ammo' || kind === 'consumable' ? .85 : .9), kind === 'loot' ? 1.3 : (kind === 'ammo' || kind === 'consumable' ? 1.15 : 1.15));
        const mul = this.mkMul(save, id, salt, kind === 'loot' ? 1.0 : .85, 1.3);
        const left = this.mkLeft(save, id, maxStock);
        const off = disabled || left <= 0 || save.credits < price;
        const lab = disabled ? label : left <= 0 ? '售罄' : save.credits < price ? '虫币不足' : '购买';
        html += `<div class="shop-item mk-card">
          <div class="shop-item-name">${title}<small>${sub}</small></div>
          <div class="shop-item-desc">${desc}${extra || ''}</div>
          <div class="mk-foot">
            <span class="mk-price">◇${fmtMoney(price)} ${this.mkTrend(mul)}</span>
            <span class="mk-stock">库存 ${left}</span>
            <button class="btn btn-primary mk-buy" data-kind="${kind}" data-id="${id}" ${off ? 'disabled' : ''}>${lab}</button>
          </div>
        </div>`;
      };

      if (this._mkTab === 'weapon') {
        for (const id in WEAPONS) {
          const w = WEAPONS[id];
          if (w.hidden) continue;
          const owned = save.ownedWeapons.includes(id);
          card(w.name, w.short, w.desc, w.price, 'buy', 2, 'weapon', id, owned, '已拥有');
        }
      } else if (this._mkTab === 'armor') {
        for (const g of SHOP_ITEMS.filter(x => x.id === 'armor2' || x.id === 'armor3')) {
          const tier = g.id === 'armor3' ? 3 : 2;
          const cur = save.loadout.armorTier[worm.id] || 1;
          const elite = (save.loadout.eliteArmor || 0) > 0;
          card(g.name, '甲 +' + g.effect.armor, g.desc, g.price, 'buy', 2, 'armor', g.id, cur >= tier || elite, elite ? '七级甲已装备' : '已装备');
        }
      } else if (this._mkTab === 'ammo') {
        for (const a of MARKET_AMMO) {
          const full = (save.ammo || 0) + a.rounds > 600;
          card(a.name, a.rounds + ' 发', a.desc, a.price, 'buy', 6, 'ammo', a.id, full, '已达上限',
            `<br><span class="mk-sub">当前额外备弹 ${save.ammo || 0} / 600 发</span>`);
        }
      } else if (this._mkTab === 'consumable') {
        const caps = { medkit: 3, grenade: 6, smoke: 3 };
        for (const g of SHOP_ITEMS.filter(x => x.cat === 'consumable' && caps[x.effect && x.effect.consumable])) {
          const key = g.effect.consumable;
          const cur = save.consumables[key] || 0;
          card(g.name, '持有 ' + cur + ' / ' + caps[key], g.desc, g.price, 'buy', 5, 'consumable', g.id, cur >= caps[key], '已带满');
        }
      } else if (this._mkTab === 'loot') {
        for (const it of this.marketLoot(save)) {
          const r = RARITY[it.rarity];
          card(it.name, r.name + ' · 变卖物', it.desc, it.value, 'buy', 4, 'loot', it.id, false, '购买',
            `<br><span class="mk-sub">买下后存入仓库，可等行情再卖</span>`);
        }
      } else {
        const items = (save.stash || []).slice().sort((a, b) => this.mkSellPrice(save, b) - this.mkSellPrice(save, a));
        sellItems = items;
        if (!items.length) {
          html += '<div class="stash-empty big">仓库里没有可卖的东西。<br>先带点物资回来，或者等行情好的时候。</div>';
        } else {
          html += '<div class="mk-sell-list">';
          items.forEach((it, idx) => {
            const def = ITEMS_BY_ID[it.id] || { name: '未知物资', rarity: 0 };
            const price = this.mkSellPrice(save, it);
            html += `<div class="mk-sell-row">
              <span class="r" style="color:${RARITY[def.rarity].color}">${RARITY[def.rarity].name}</span>
              <span class="nm">${def.name}</span>
              <span class="mk-price">◇${fmtMoney(price)}</span>
              <button class="btn btn-ghost mk-sell" data-idx="${idx}">出售</button>
            </div>`;
          });
          html += '</div>';
          const total = items.reduce((s, it) => s + this.mkSellPrice(save, it), 0);
          html += `<div class="mk-actions"><button class="btn btn-primary" id="mk-sell-all">${this._mkSellAll ? '再点一次确认全部出售' : '全部按行情出售 ◇' + fmtMoney(total)}</button></div>`;
        }
      }
      html += '</div>';
      body.innerHTML = html;

      $$('.mk-tab').forEach(b => b.onclick = () => { this._mkTab = b.dataset.tab; this._mkMsg = ''; this._mkSellAll = false; render(); });
      const rf = $('#mk-refresh');
      if (rf) rf.onclick = () => {
        if (save.credits < 300) return;
        save.credits -= 300;
        save.market.seed++;
        save.market.bought = {};
        this._mkSellAll = false;
        this._mkMsg = '行情已刷新，库存重新上架。';
        Game.persist(); Audio2.play('ui_big');
        this.renderHangar(save);
        render();
      };
      $$('.mk-buy').forEach(b => b.onclick = () => {
        this._mkMsg = this.marketBuy(save, b.dataset.kind, b.dataset.id);
        render();
      });
      const bal = document.querySelector('.mk-balance');
      if (bal) bal.onclick = () => {
        this.exactCredits = !this.exactCredits;
        Audio2.play('ui');
        this.renderHangar(save);
        render();
      };
      $$('.mk-sell').forEach((b, idx) => b.onclick = () => {
        const item = sellItems[idx];
        if (!item) return;
        const price = this.mkSellPrice(save, item);
        const pos = save.stash.indexOf(item);
        if (pos < 0) return;
        save.stash.splice(pos, 1);
        save.credits += price;
        save.stats.earned += price;
        this._mkMsg = `已按行情出售，+◇${fmtMoney(price)}`;
        this._mkSellAll = false;
        Game.persist(); Audio2.play('rare');
        this.renderHangar(save);
        render();
      });
      const all = $('#mk-sell-all');
      if (all) all.onclick = () => {
        if (!sellItems.length) return;
        if (!this._mkSellAll) { this._mkSellAll = true; render(); return; }
        const sum = sellItems.reduce((s, it) => s + this.mkSellPrice(save, it), 0);
        save.credits += sum;
        save.stats.earned += sum;
        save.stash = [];
        this._mkSellAll = false;
        this._mkMsg = `清空仓库，+◇${fmtMoney(sum)}`;
        Game.persist(); Audio2.play('rare');
        this.renderHangar(save);
        render();
      };
    };
    render();
    $('#modal-title').textContent = '交易行 · 黑市菌毯';
    this.showModal();
  },

  /* ---------- 兑换码 ---------- */
  codeHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  },

  redeem(save, raw) {
    const code = (raw || '').trim().toLowerCase();
    if (!code) return { ok: false, msg: '请输入兑换码' };
    const hash = this.codeHash(code);
    const def = REDEEM_CODES[hash];
    if (!def) return { ok: false, msg: '兑换码无效' };
    save.redeemed = save.redeemed || [];
    if (save.redeemed.includes(hash)) return { ok: false, msg: '这个兑换码已经用过了' };

    save.redeemed.push(hash);
    const rewards = [];
    if (def.kind === 'million') {
      // 百万补贴：只发虫币
      save.credits += 1000000;
      rewards.push('虫币 ◇' + fmtMoney(1000000));
      Game.persist();
      Audio2.play('rare');
      this.renderHangar(save);
      return { ok: true, rewards };
    }

    save.credits += 99999;
    rewards.push('虫币 ◇99,999');

    save.loadout.eliteArmor = 1150;
    save.loadout.eliteHelmet = 750;
    rewards.push('七级甲 · 耐久 1150');
    rewards.push('七级头 · 耐久 750');

    save.stashCap = Math.max(save.stashCap || 40, 99);
    rewards.push('超级背包 · 仓库 99 格');

    const pool = Object.keys(WEAPONS).filter(id => !WEAPONS[id].hidden && !save.ownedWeapons.includes(id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const got = pool.slice(0, 5);
    for (const id of got) save.ownedWeapons.push(id);
    if (got.length) {
      rewards.push('随机枪械 ×' + got.length + '：' + got.map(id => WEAPONS[id].name).join('、'));
    } else {
      save.credits += 5000;
      rewards.push('枪械已全收集，折算 ◇5,000');
    }

    Game.persist();
    Audio2.play('rare');
    this.renderHangar(save);
    return { ok: true, rewards };
  },

  openRedeem(save) {
    const body = $('#modal-body');
    body.innerHTML = `
      <div class="redeem">
        <p class="redeem-lead">输入兑换码领取补给。每个码每份存档限用一次。</p>
        <div class="redeem-row">
          <input id="redeem-input" class="redeem-input" maxlength="40" placeholder="输入兑换码"
                 autocomplete="off" spellcheck="false">
          <button id="redeem-btn" class="btn btn-primary">兑换</button>
        </div>
        <div id="redeem-result" class="redeem-result"></div>
        <p class="redeem-note">兑换码由活动 / 发放渠道提供，游戏内不展示。</p>
      </div>`;
    $('#modal-title').textContent = '兑换码';
    this.showModal();

    const input = $('#redeem-input');
    const box = $('#redeem-result');
    if (input) setTimeout(() => input.focus(), 30);
    const doRedeem = () => {
      const r = this.redeem(save, input.value);
      if (r.ok) {
        box.className = 'redeem-result ok';
        box.innerHTML = '<div class="redeem-ok">兑换成功</div><ul>' +
          r.rewards.map(x => `<li>${x}</li>`).join('') + '</ul>';
        input.value = '';
      } else {
        box.className = 'redeem-result bad';
        box.textContent = r.msg;
      }
    };
    $('#redeem-btn').onclick = doRedeem;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doRedeem(); }
    };
  },

  updateDeployBar(save) {
    const m = MAPS[this.selectedMap];
    const d = DIFFICULTIES[this.selectedDiff];
    setText('#deploy-map-name', m.name);
    const op = WORMS[this.selectedWorm] || WORMS[0];
    const opDown = save.worms[op.id].downed;
    const aliveN = WORMS.filter(x => !save.worms[x.id].downed).length;
    const gear = this.gearScore(save, op.id); // 跑刀模式为 0
    const gearOk = this.knifeMode || gear >= (m.minGear || 0);
    if (this.knifeMode) {
      $('#deploy-meta').innerHTML =
        `跑刀模式 · 出战 <b style="color:${op.color}">『${op.name}』</b> · ` +
        `战备 <b class="gear-ok">◇0</b> · <b class="gear-ok">无视准入</b> · 仅一把蛆刀 · 物资 <b class="gear-ok">+25%</b>` +
        ` · 可用 ${aliveN}/3` +
        (opDown && aliveN > 0 ? ' · <b style="color:#ff8a7d">该干员在医疗舱，请换一条</b>' : '');
    } else {
      $('#deploy-meta').innerHTML =
        `单人渗透 · 出战 <b style="color:${op.color}">『${op.name}』</b> · ` +
        `战备 <b class="${gearOk ? 'gear-ok' : 'gear-warn'}">◇${fmt(gear)}</b>` +
        `<span style="color:#59615a"> / 准入 </span><b class="${gearOk ? 'gear-ok' : 'gear-warn'}">◇${fmt(m.minGear || 0)}</b>` +
        ` · 可用 ${aliveN}/3 · 预计回收 <b>◇${fmt(Math.round(2800 * m.lootDensity * d.lootMul))}</b>` +
        (gearOk ? '' : ' · <b class="gear-warn">战备不足，可去军械库强化或切跑刀</b>') +
        (opDown && aliveN > 0 ? ' · <b style="color:#ff8a7d">该干员在医疗舱，请换一条</b>' : '');
    }
    $('#btn-deploy').disabled = aliveN === 0 || opDown;
    $('#btn-deploy').classList.toggle('warn', !gearOk);
  },

  /* ---------- 商店 ---------- */
  openShop(save, onBuy) {
    this._shopTab = 'gear';
    const body = $('#modal-body');
    const render = () => {
      const tabs = [['gear', '装备 / 强化'], ['consumable', '消耗品'], ['weapon', '武器更换']];
      let html = '<div class="shop-tabs">' + tabs.map(([id, n]) => `<button class="shop-tab${this._shopTab === id ? ' active' : ''}" data-tab="${id}">${n}</button>`).join('') + '</div>';
      html += '<div class="shop-grid">';
      if (this._shopTab === 'weapon') {
        const worm = WORMS[this.selectedWorm];
        for (const wid in WEAPONS) {
          const w = WEAPONS[wid];
          if (w.hidden) continue;
          const owned = save.ownedWeapons.includes(wid) || w.id === 'pistol';
          const equipped = (save.loadout.weapons[worm.id] || worm.weapon) === wid;
          html += `<div class="shop-item${equipped ? ' owned' : ''}">
            <div class="shop-item-name">${w.name}<small>${w.short}</small></div>
            <div class="shop-item-desc">${w.desc}</div>
            ${statBars(w)}
            <div class="shop-buy">
              <span class="shop-price">${owned ? (equipped ? '已装备' : '已拥有') : '◇ ' + fmtMoney(w.price)}</span>
              <button class="btn btn-primary shop-act" data-act="${owned ? (equipped ? '' : 'equip') : 'buyweapon'}" data-id="${wid}" ${equipped ? 'disabled' : ''}>${equipped ? '装备中' : owned ? '装备' : '购买'}</button>
            </div></div>`;
        }
      } else {
        html += `<div class="shop-note">当前装配对象：<b style="color:${WORMS[this.selectedWorm].color}">『${WORMS[this.selectedWorm].name}』</b> · 护甲/生命类强化作用于该干员；仓库扩容为账号通用；消耗品在行动中按 1 / 2 / G 使用</div>`;
        for (const it of SHOP_ITEMS.filter(s => s.cat === this._shopTab)) {
          let price = it.price, note = '', owned = false;
          if ((save.ownedGear || []).includes(it.id)) { owned = true; note = '已获得'; }
          if (it.effect && it.effect.armor && (save.loadout.eliteArmor || 0) > 0) { owned = true; note = '七级甲已装备'; }
          if (it.cat === 'consumable') {
            const own = save.consumables[it.effect.consumable] || 0;
            if (own >= 5) { owned = true; note = '已满'; }
            else note = '持有 ×' + own;
          }
          html += `<div class="shop-item${owned ? ' owned' : ''}">
            <div class="shop-item-name">${it.ico} ${it.name}<small>${note}</small></div>
            <div class="shop-item-desc">${it.desc}${it.effect && it.effect.stashCap ? `<br><span style="color:#8fb2ff">当前容量 ${save.stashCap || 40} 格</span>` : ''}</div>
            <div class="shop-buy">
              <span class="shop-price">${owned ? '—' : '◇ ' + fmtMoney(price)}</span>
              <button class="btn btn-primary shop-act" data-act="buy" data-id="${it.id}" ${owned ? 'disabled' : ''}>${owned ? '已持有' : '购买'}</button>
            </div></div>`;
        }
      }
      html += '</div>';
      body.innerHTML = html;
      $$('.shop-tab').forEach(t => t.onclick = () => { this._shopTab = t.dataset.tab; render(); Audio2.play('ui'); });
      $$('.shop-act').forEach(b => b.onclick = () => {
        const act = b.dataset.act, id = b.dataset.id;
        if (!act) return;
        if (act === 'buyweapon' && buyWeapon(save, id, onBuy)) render();
        if (act === 'equip') { save.loadout.weapons[WORMS[this.selectedWorm].id] = id; onBuy(); render(); Audio2.play('ui_big'); }
        if (act === 'buy') { if (buyItem(save, id, onBuy)) render(); }
      });
    };
    render();
    $('#modal-title').textContent = '军械库 · 特勤处物资处';
    this.showModal();

    function statBars(w) {
      const s = w.stats;
      let h = '<div class="shop-stats">';
      for (const k in s) {
        const v = clamp(s[k] / (k === '伤害' ? 130 : k === '射速' ? 1100 : k === '弹匣' ? 40 : 100), 0, 1);
        h += `<div class="shop-stat"><span>${k}</span><i><b style="width:${v * 100}%"></b></i><em style="font-style:normal;color:#59615a;width:26px;text-align:right">${s[k]}</em></div>`;
      }
      return h + '</div>';
    }

    function buyWeapon(save, wid, onBuy) {
      const w = WEAPONS[wid];
      if (save.credits < w.price) { UI.toastModal('虫币不足', `需要 ◇${fmtMoney(w.price)}，当前 ◇${fmtMoney(save.credits)}。去行动里多刮点回来。`); return false; }
      save.credits -= w.price;
      save.ownedWeapons.push(wid);
      save.loadout.weapons[WORMS[UI.selectedWorm].id] = wid;
      Audio2.play('rare');
      onBuy();
      return true;
    }
    function buyItem(save, id, onBuy) {
      const it = SHOP_ITEMS.find(s => s.id === id);
      if (!it) return false;
      if (it.effect && it.effect.armor && (save.loadout.eliteArmor || 0) > 0) {
        UI.toastModal('已经够硬了', '七级甲已经穿在身上，再买普通护甲没有意义。');
        return false;
      }
      if (save.credits < it.price) { UI.toastModal('虫币不足', `需要 ◇${fmt(it.price)}，当前 ◇${fmtMoney(save.credits)}。`); return false; }
      save.credits -= it.price;
      if (it.cat === 'consumable') {
        save.consumables[it.effect.consumable] = (save.consumables[it.effect.consumable] || 0) + 1;
      } else {
        applyGear(save, it);
        save.ownedGear = save.ownedGear || [];
        if (!save.ownedGear.includes(it.id)) save.ownedGear.push(it.id);
      }
      Audio2.play('rare');
      onBuy();
      return true;
    }
    function applyGear(save, it) {
      const worm = WORMS[UI.selectedWorm];
      if (it.effect.armor) {
        const cur = save.loadout.bonusArmor[worm.id] || 0;
        if (cur >= it.effect.armor) return;
        save.loadout.bonusArmor[worm.id] = it.effect.armor;
        save.loadout.armorTier[worm.id] = it.id === 'armor3' ? 3 : 2;
      }
      if (it.effect.hp) save.loadout.bonusHp[worm.id] = (save.loadout.bonusHp[worm.id] || 0) + it.effect.hp;
      if (it.effect.carry) save.loadout.carryBonus = (save.loadout.carryBonus || 0) + it.effect.carry;
      if (it.effect.ammoMul) save.loadout.ammoBonus = Math.min(.6, (save.loadout.ammoBonus || 0) + it.effect.ammoMul);
      if (it.effect.acidResist) save.loadout.acidResist = (save.loadout.acidResist || 0) + it.effect.acidResist;
      if (it.effect.radar) save.loadout.radar = true;
      if (it.effect.accuracy) save.loadout.accuracy = (save.loadout.accuracy || 0) + it.effect.accuracy;
      if (it.effect.stashCap) save.stashCap = (save.stashCap || 40) + it.effect.stashCap;
    }
  },

  /* ---------- 结算 ---------- */
  renderResult(data) {
    const card = $('.result-card');
    const banner = $('#result-banner');
    card.classList.toggle('fail', !data.success);
    banner.textContent = data.success ? '撤离成功' : (data.reason === 'timeout' ? '行动超时' : '渗透失败');
    $('#result-sub').textContent = data.success ? 'OPERATION COMPLETE · 物资已入库' : (data.reason === 'timeout' ? 'OPERATION TIMEOUT · 物资已遗失' : 'OPERATOR DOWN · 物资已遗失');
    const s = data.stats;
    $('#result-stats').innerHTML = `
      <div class="rs-row"><span>行动区域</span><b>${data.mapName}</b></div>
      <div class="rs-row"><span>威胁等级</span><b>${data.diffName}</b></div>
      <div class="rs-row"><span>行动用时</span><b>${fmtTime(s.duration)}</b></div>
      <div class="rs-row"><span>击杀</span><b>${s.kills}</b></div>
      <div class="rs-row"><span>造成伤害</span><b>${fmt(s.dmg)}</b></div>
      <div class="rs-row"><span>搜刮容器</span><b>${s.containers}</b></div>
      ${data.knife ? '<div class="rs-row"><span>跑刀模式</span><b>战备 0 · 物资 +25%</b></div>' : ''}
      ${data.contract ? `<div class="rs-row ${data.contract.done ? 'good' : ''}"><span>契约 · ${data.contract.name}</span><b>${data.contract.done ? '+ ◇' + fmt(data.contract.got) : '未完成'}</b></div>` : ''}
      <div class="rs-row"><span>${data.success ? '带出物资' : '安全箱带出'}</span><b>◇ ${fmt(s.lootValue)}</b></div>
      <div class="rs-row good"><span>已入库</span><b>◇ ${fmt(s.storedValue || 0)} · ${s.storedCount || 0} 件</b></div>
      ${s.overflow ? `<div class="rs-row"><span>仓库已满 · 自动出售</span><b>◇ ${fmt(s.overflow)}</b></div>` : ''}
      ${data.success ? '' : `<div class="rs-row bad"><span>遗留在战区</span><b>- ◇ ${fmt(s.lost || 0)}</b></div>`}
      <div class="rs-row hl"><span>本次入账</span><b>+ ◇ ${fmtMoney(s.earned)}</b></div>
      <div class="rs-row"><span>仓库现况</span><b>${s.stashCount || 0} / ${s.stashCap || 40} 格</b></div>
      <div class="rs-row"><span>剩余虫币</span><b>◇ ${fmtMoney(s.credits)}</b></div>`;
    const list = $('#result-loot-list');
    list.innerHTML = '';
    const head = document.querySelector('.rl-head');
    if (head) head.innerHTML = `${data.success ? '战利品清单' : '安全箱清单'} <span id="rl-total"></span>`;
    if (!data.loot.length) list.innerHTML = data.success
      ? '<div class="stash-empty" style="padding:4px">什么都没带回来。<br>至少人还在。</div>'
      : '<div class="stash-empty" style="padding:4px">什么都没带回来。<br>人也没回来。</div>';
    data.loot.forEach(it => {
      const def = ITEMS_BY_ID[it.id] || { name: it.name || '未知物资', rarity: 0, value: it.value || 0 };
      const row = el('div', 'rl-row');
      row.innerHTML = `<span><span class="r" style="color:${RARITY[def.rarity].color}">${RARITY[def.rarity].name}</span>${def.name}</span><span class="v">◇${fmt(it.value || def.value)}</span>`;
      list.appendChild(row);
    });
    $('#rl-total').textContent = '◇ ' + fmt(s.lootValue);
    // 小队状态
    const oldSq = $('.result-squad');
    if (oldSq) oldSq.remove();
    if (data.squad) {
      const sq = data.squad.map(m => `<span class="sq-chip${m.alive ? '' : ' dead'}" style="--c:${m.color}">
        <i class="sq-dot"></i>${m.name}<em>${m.alive ? '存活' : '阵亡'} · ${m.kills}杀</em></span>`).join('');
      const wrap = el('div', 'result-squad', sq);
      $('#result-flavor').parentNode.insertBefore(wrap, $('#result-flavor'));
    }
    const flavor = data.success
      ? pick(LINES.extract_ok) + ' 物资已进仓库，回大厅点「仓库」出售换虫币。'
      : (data.reason === 'timeout' ? '时限到了，你留在原地。腐殖层不埋葬尸体，它消化。' : pick(LINES.death) + ' 白蛆会来处理剩下的部分。')
        + (data.safeKept ? ` 安全箱保住了 ${data.safeKept} 件物资，已放进仓库。` : ' 安全箱被撬开了，什么都没剩。');
    $('#result-flavor').textContent = flavor;
    const note = $('#result-medbay');
    if (note) note.remove();
    if (data.medbay) {
      const n = el('div', 'result-medbay', '✚ 医疗舱：' + data.medbay);
      $('#result-flavor').parentNode.insertBefore(n, $('#result-flavor').nextSibling);
    }
  },

  /* ---------- HUD ---------- */
  initHud(g) {
    setText('#hud-map', g.mapCfg.short);
    setText('#hud-diff', DIFFICULTIES[g.diffIdx].name);
    setText('#hud-mode', g.knife ? ' · 跑刀' : '');
    setText('#hud-objective', g.knife
      ? '跑刀模式：战备 0，只有一把蛆刀。搜刮物资，避开硬仗，撤离带出。'
      : (g.mapCfg.boss ? '搜刮物资，可选：击杀巢母。找到撤离点并撤离。' : '搜刮物资，避开或清理白蛆巡逻队，找到撤离点撤离。'));
    $('#hud-timer').className = 'hud-timer';
    // 单人渗透：隐藏小队条
    const strip = $('#hud-squad');
    if (strip) strip.innerHTML = '';
    this._hudCache = {};
  },

  updateHud(g) {
    const w = g.active;
    if (!w) return;
    // 准星每帧跟随
    const ch = $('#crosshair');
    ch.style.left = g.mouseScreen.x + 'px';
    ch.style.top = g.mouseScreen.y + 'px';
    ch.classList.toggle('hit', g.hitMarkerT > 0);
    // 其余 HUD 节流到 ~16Hz
    if (g.time - (this._hudT || 0) < .06) return;
    this._hudT = g.time;
    const C = this._hudCache;
    // 计时
    const tStr = fmtTime(g.timeLeft);
    if (C.t !== tStr) {
      C.t = tStr;
      setText('#hud-timer', tStr);
      $('#hud-timer').classList.toggle('warn', g.timeLeft < 60);
      $('#hud-timer').classList.toggle('crit', g.timeLeft < 20);
    }
    $('#hud-timer-bar').style.width = clamp(g.timeLeft / g.mapCfg.time * 100, 0, 100) + '%';
    // 生命护甲
    const hpPct = clamp(w.hp / w.maxHp * 100, 0, 100);
    $('#hud-hp').style.width = hpPct + '%';
    $('#hud-hp').className = 'hp-fill' + (hpPct < 30 ? ' low' : hpPct < 60 ? ' mid' : '');
    $('#hud-armor').style.width = clamp(w.armor / Math.max(1, w.maxArmor) * 100, 0, 100) + '%';
    setText('#hud-hp-text', Math.ceil(w.hp) + ' / ' + w.maxHp);
    setText('#hud-worm-name', w.def.name + ' · ' + w.def.title);
    // 弹药（跑刀模式显示 ∞）
    const isKnife = w.weapon.type === 'knife';
    setText('#hud-mag', isKnife ? '∞' : w.mag);
    setText('#hud-reserve', isKnife ? '近战' : w.reserve);
    $('#hud-mag').classList.toggle('empty', !isKnife && w.mag === 0);
    setText('#hud-weapon', w.weapon.name);
    const rh = $('#hud-reload');
    if (isKnife) { rh.textContent = '蛆刀 · 无需换弹'; rh.classList.remove('active'); }
    else if (w.reloading) { rh.textContent = '换弹中… ' + w.reloadT.toFixed(1) + 's'; rh.classList.add('active'); }
    else if (w.mag === 0 && w.reserve === 0) { rh.textContent = '弹药耗尽'; rh.classList.add('active'); }
    else { rh.textContent = w.mag <= w.magMax * .25 ? '按 R 换弹' : ''; rh.classList.toggle('active', w.mag <= w.magMax * .25); }
    // 技能
    const ab = $('#hud-ability');
    const cdPct = w.abilityCd / w.def.ability.cd;
    $('#hud-ability-cd').style.transform = 'scaleX(' + clamp(cdPct, 0, 1) + ')';
    $('#hud-ability-name').textContent = (w.abilityCd > 0 ? w.def.ability.cd.toFixed(0) + 's · ' : '') + w.def.ability.name;
    ab.style.borderColor = w.abilityCd > 0 ? '' : w.def.color;
    setText('#hud-grenade-n', g.consumables.grenade || 0);
    // 搜刮价值
    setText('#hud-loot', '◇ ' + fmt(g.lootValue));
    setText('#hud-loot-count', g.lootList.length + ' 件物资 · ' + g.squadWeight.toFixed(1) + ' kg');
    // 小队条
    // 小队条（单人渗透时为隐藏的空条）
    for (const chip of $$('#hud-squad .squad-chip')) {
      const ww = g.worms.find(x => x.id === chip.dataset.wid);
      if (!ww) continue;
      chip.classList.toggle('active', ww === w);
      chip.classList.toggle('downed', !ww.alive);
      const bar = chip.querySelector('.sc-hp i');
      if (bar) {
        bar.style.width = clamp(ww.hp / ww.maxHp * 100, 0, 100) + '%';
        bar.style.background = ww === w ? w.def.color : (ww.hp / ww.maxHp < .3 ? '#ff4a3d' : '#9aa392');
      }
    }
    // 准星
    const chEl = $('#crosshair');
    chEl.classList.toggle('hit', g.hitMarkerT > 0);
    // 撤离
    const z = g.nearestExtract;
    const ex = $('#extract-box');
    if (z) {
      const d = Math.round(dist(w.x, w.y, z.x, z.y) / 10);
      setText('#extract-dist', z.paid && !z.active ? '需支付 ◇' + fmt(z.cost) + ' · ' + d + 'm' : d + 'm · ' + z.label);
      const ready = g.inExtract != null;
      ex.classList.toggle('ready', ready);
      $('#extract-progress').style.width = (z.progress * 100) + '%';
      setText('#extract-hint', ready ? (g.channeling ? '撤离中…保持位置' : '按住 F 开始撤离') : '抵达撤离区后按住 F');
    } else {
      $('#extract-box').classList.remove('ready');
      setText('#extract-dist', '—');
      $('#extract-progress').style.width = '0%';
    }

    // —— 交互提示 ——
    const hint = $('#interact-hint');
    let hintText = null;
    let nearC = null, nearD = 78;
    for (const c of g.containers) {
      if (c.done) continue;
      const d = dist(w.x, w.y, c.x, c.y);
      if (d < nearD) { nearD = d; nearC = c; }
    }
    if (nearC) {
      const def = CONTAINERS.find(x => x.id === nearC.id);
      hintText = '搜刮 ' + (def ? def.name : '容器');
    } else if (z && dist(w.x, w.y, z.x, z.y) < z.r + 24 && !g.channeling) {
      hintText = '按住 F 开始撤离读秒';
    } else {
      let nearI = null, ndI = 56;
      for (const it of g.groundItems) {
        const d = dist(w.x, w.y, it.x, it.y);
        if (d < ndI) { ndI = d; nearI = it; }
      }
      if (nearI) {
        const idef = ITEMS_BY_ID[nearI.id];
        hintText = '拾取 ' + (idef ? idef.name : '物资') + ' ◇' + fmt(nearI.value);
      }
    }
    hint.classList.toggle('show', !!hintText);
    if (hintText) setText('#interact-text', hintText);

    // —— 撤离大倒计时（跟随角色上方，而不是固定在屏幕中央） ——
    const cu = $('#channel-ui');
    if (g.channeling && z) {
      cu.classList.add('show');
      const rem = Math.max(1, Math.ceil((1 - z.progress) * BAL.CHANNEL_TIME));
      setText('#channel-num', rem);
      $('#cr-fg').style.strokeDashoffset = (1 - z.progress) * 276.5;
      const sp = g.camera.worldToScreen(w.x, w.y - 46);
      cu.style.left = clamp(sp.x, 90, Render.W - 90) + 'px';
      cu.style.top = clamp(sp.y - 90, 120, Render.H - 160) + 'px';
    } else cu.classList.remove('show');

    // —— 行动契约 ——
    if (g.contract) {
      const pr = this.contractProgress(g, g.contract);
      const el2 = $('#hud-contract');
      const txt = `<span class="ct-tag">契约</span>${g.contract.name} · ${g.contract.desc}<span class="ct-prog">${pr.cur}/${pr.max}</span><span class="ct-bonus">◇${fmt(g.contract.bonus)}</span>`;
      if (C.contract !== txt) { C.contract = txt; el2.innerHTML = txt; }
      el2.classList.toggle('done', pr.done);
    }

    // —— 目标统计 ——
    const stat = (g.kills || 0) + ' 击杀 / ' + (g.containersOpened || 0) + ' 容器';
    if (C.stat !== stat) { C.stat = stat; setText('#hud-stat', '· ' + stat); }
  },

  contractProgress(g, c) {
    switch (c.id) {
      case 'epic': return { cur: Math.min(1, g.lootList.filter(i => i.rarity === 2).length), max: 1, done: g.lootList.some(i => i.rarity === 2) };
      case 'kill': return { cur: Math.min(g.kills, 8), max: 8, done: g.kills >= 8 };
      case 'search': return { cur: Math.min(g.containersOpened, 10), max: 10, done: g.containersOpened >= 10 };
      case 'intact': { const w = g.active; const ok = !!(w && w.alive && w.hp >= w.maxHp * .6); return { cur: ok ? 1 : 0, max: 1, done: ok }; }
      case 'boss': return { cur: g.boss && !g.boss.alive ? 1 : 0, max: 1, done: !!(g.boss && !g.boss.alive) };
      case 'greedy': return { cur: Math.min(g.lootValue, 5000), max: 5000, done: g.lootValue >= 5000 };
    }
    return { cur: 0, max: 1, done: false };
  },

  /* ---------- 消息 ---------- */
  feed(g, text, kind = '') {
    const box = $('#event-feed');
    const d = el('div', 'feed-item ' + kind, esc(text));
    box.appendChild(d);
    while (box.children.length > 6) box.removeChild(box.firstChild);
    setTimeout(() => { d.style.transition = 'opacity .4s,transform .4s'; d.style.opacity = '0'; d.style.transform = 'translateY(-6px)'; setTimeout(() => d.remove(), 450); }, 4200);
  },
  toast(g, text, size = '') {
    const t = $('#center-toast');
    t.textContent = text;
    t.className = 'center-toast show ' + size;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.classList.remove('show'); }, 1600);
  },
  subtitle(text, dur = 3800) {
    const s = $('#subtitle');
    s.textContent = text;
    s.classList.add('show');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => s.classList.remove('show'), dur);
  },

  /* ---------- 弹层 ---------- */
  showModal() { $('#modal').classList.add('show'); },
  hideModal() { $('#modal').classList.remove('show'); },
  toastModal(title, body) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = `<div style="font-family:var(--font-cn);font-size:13px;line-height:2;color:#a7b09f">${body}</div>
      <div style="text-align:right;margin-top:18px"><button class="btn btn-primary" onclick="UI.hideModal()">知道了</button></div>`;
    this.showModal();
  },

  showHelp() {
    $('#modal-title').textContent = '操作手册 · 特勤处';
    $('#modal-body').innerHTML = `
      <div class="help-section">
        <h3>行动目标（单人渗透）</h3>
        <p>在大厅选一条蛆 → 进入战区 → 搜刮物资 → 在时限内抵达撤离点并按住 <kbd>F</kbd> 读秒 → 带出的物资折算成虫币。<br>
        没有队友，阵亡即本次行动结束；除安全箱内的物资外全部丢失。</p>
        <div class="help-grid">
          <div><b>WASD</b>移动。Shift 是技能，不是冲刺。</div>
          <div><b>鼠标 / 左键</b>瞄准与射击，右键不使用。</div>
          <div><b>E</b>搜刮容器 / 拾取地面物资 / 拉闸。</div>
          <div><b>F</b>在撤离区按住读秒，离开或被打断都会重置。</div>
          <div><b>R</b>换弹，<b>G</b>投掷手雷，<b>1</b>医疗包，<b>2</b>烟雾。</div>
          <div><b>Tab</b>查看物资清单，<b>ESC</b>暂停。</div>
          <div><b>Alt+Enter</b>全屏 / 退出全屏，<b>M</b>静音。</div>
          <div><b>单人</b>：死亡后该蛆进医疗舱，换一条或付费复苏。</div>
        </div>
        <h3>三条蛆（每次只派一条）</h3>
        <ul>
          <li><b>老绿 · 突击手</b>：AR-77 突击步枪。技能「战地急救」回复 38 生命并补甲。最稳的一条，适合正面推进。</li>
          <li><b>小黄 · 侦察兵</b>：S-9 冲锋枪，移速最快、负重最低。技能「疾行」短距加速，适合抢点、绕后、逃跑。</li>
          <li><b>大紫 · 重装兵</b>：SG-12 霰弹枪，血厚甲厚。技能「硬壳」6 秒减伤 55%，适合堵门和拆巢母。</li>
        </ul>
        <h3>开始行动</h3>
        <p>点「开始行动」或按回车会先弹出<b>确认出发</b>：核对地图、干员、模式、战备、额外备弹与消耗品，确认后才进图。
        在确认层里再按一次回车也可以确认；「再想想」或 ESC 取消。</p>
        <h3>战备与准入</h3>
        <p>战备 = 武器 + 护甲 + 战术配件的价值总和，显示在大厅顶栏。每张地图有<b>准入战备</b>，
        不够就无法进场（例如虫巢核心需要 ◇4200）。想进更危险的区域，先去军械库换更好的武器与护甲，
        或者换一条战备更高的蛆。</p>
        <h3>跑刀模式</h3>
        <p>在战区面板切到「跑刀」：<b>战备按 0 计</b>，无视所有地图的准入战备；只带一把蛆刀，
        无护甲、无消耗品、不享受已购装备加成，但带出的物资价值 <b>+25%</b>。
        适合没钱的时候翻本，也适合练胆子。</p>
        <h3>搜刮与负重</h3>
        <p>物资分三档稀有度，越稀有越值钱。负重超过上限时移动速度下降。地面上的发光点是散落物资，靠近自动拾取。</p>
        <h3>保险箱与医疗舱</h3>
        <p>阵亡时稀有度最高的 3 件物资会进入安全箱保住，其余全部丢失。阵亡的蛆需要回大厅花虫币复苏；三条全躺时特勤处会垫付一次医疗费。</p>
        <h3>仓库与出售</h3>
        <p>带出的物资（包括安全箱保住的）会进入仓库，每件占 1 格，初始 40 格。回大厅点顶栏「仓库」或右侧「管理仓库 / 出售」，
        可以单件出售或一键出售换虫币。仓库满了以后再带出的物资会自动折现；军械库有「仓库扩容」。</p>
        <h3>交易行</h3>
        <p>顶栏「交易行」：买枪械、护甲、弹药、消耗品、变卖物；也可以按行情出售仓库物资。
        价格每天 0 点自动换，库存有限；花 ◇300 可手动刷新一轮行情。
        弹药是额外备弹（上限 600 发），部署时一次性带入，撤离或阵亡都不返还。</p>
        <h3>物价</h3>
        <p>装备、消耗品、弹药价格 <b>×100</b>；新档注册 <b>◇99 万</b>，旧档首次启动一次性补 99 万。
        战备值与地图准入不变，物资回收价也保持原样。</p>
        <h3>虫币显示</h3>
        <p>虫币到达 <b>10 万</b> 起用 <b>K</b>（如 100K），<b>100 万</b> 起用 <b>M</b>（如 1.23M），<b>10 亿</b> 起用 <b>B</b>（如 1B）。
        只影响显示，实际数值不变。</p>
        <h3>兑换码</h3>
        <p>顶栏「兑换码」输入活动发放的兑换码，可领取补给。每个码每份存档限用一次；游戏内不展示可用码。</p>
        <h3>存档</h3>
        <p>存档在 exe 旁边的 <b>ThreeGrubs-data\profile</b>，和这个文件夹绑定。换电脑 / 换目录时把整个
        ThreeGrubs-data 一起拷走；<b>只拷 exe 会被当成新存档</b>。也可以在这里导出 / 导入 JSON 存档。</p>
        <div class="save-actions">
          <button class="btn btn-ghost" id="save-export">导出存档</button>
          <label class="btn btn-ghost" for="save-import-file">导入存档</label>
          <input type="file" id="save-import-file" accept="application/json,.json" style="display:none">
        </div>
      </div>`;
    this.showModal();
    const ex = $('#save-export');
    if (ex) ex.onclick = () => this.exportSave();
    const im = $('#save-import-file');
    if (im) im.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) this.importSave(f);
    };
  },

  exportSave() {
    try {
      const blob = new Blob([JSON.stringify(Game.save, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'three-grubs-save-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      this.toastModal('存档已导出', 'JSON 文件在下载目录。换电脑后在「操作 → 存档」里导入即可。');
    } catch (e) {
      this.toastModal('导出失败', '浏览器阻止了下载：' + e.message);
    }
  },

  importSave(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.stats || !data.worms) throw new Error('不是有效的存档文件');
        const def = SAVE_DEFAULT();
        const s = Object.assign(def, data);
        s.stats = Object.assign(def.stats, data.stats || {});
        s.loadout = Object.assign(def.loadout, data.loadout || {});
        s.consumables = Object.assign(def.consumables, data.consumables || {});
        s.worms = Object.assign(def.worms, data.worms || {});
        if (!s.market) s.market = { day: 0, seed: 1, bought: {} };
        Game.save = s;
        Game.persist();
        this.hideModal();
        this.renderHangar(Game.save);
        this.toastModal('存档已导入', `虫币 ◇${fmtMoney(s.credits)} · 行动 ${s.stats.raids} 次 · 仓库 ${(s.stash || []).length} 件。`);
      } catch (e) {
        this.toastModal('导入失败', '文件不是有效的《三个蛆行动》存档：' + e.message);
      }
    };
    reader.onerror = () => this.toastModal('导入失败', '读不了这个文件。');
    reader.readAsText(file);
  },

  showDeath(g) { }
};
