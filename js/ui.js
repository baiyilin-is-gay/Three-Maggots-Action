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

  /** 战备 = 武器 + 护甲 + 战术配件的价值总和（《三角洲行动》式准入指标） */
  gearScore(save, wormId) {
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
  renderHangar(save) {
    setText('#hangar-credits', fmt(save.credits));
    const op = WORMS[this.selectedWorm] || WORMS[0];
    setText('#hangar-gear', fmt(this.gearScore(save, op.id)));
    setText('#hangar-raids', save.stats.extracts + ' / ' + save.stats.raids);
    setText('#hangar-total', fmtK(save.stats.earned));
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
      const wid = save.loadout.weapons[def.id] || def.weapon;
      const wpn = WEAPONS[wid] || WEAPONS[def.weapon];
      const maxHp = def.hp + (save.loadout.bonusHp?.[def.id] || 0);
      const maxArmor = def.armor + (save.loadout.bonusArmor?.[def.id] || 0);
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
          <div class="stat-line"><span>HP ${maxHp}</span><span>甲 ${maxArmor}</span><span>负重 ${def.carry + (save.loadout.carryBonus || 0)}kg</span><span>战备 ◇${fmt(this.gearScore(save, def.id))}</span></div>
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
    const wid = save.loadout.weapons[d.id] || d.weapon;
    const wpn = WEAPONS[wid] || WEAPONS[d.weapon];
    const hp = d.hp + (save.loadout.bonusHp?.[d.id] || 0);
    const armor = d.armor + (save.loadout.bonusArmor?.[d.id] || 0);
    const carry = d.carry + (save.loadout.carryBonus || 0);
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
      const gearOk = gear >= (m.minGear || 0);
      const card = el('div', 'map-card' + (i === this.selectedMap ? ' selected' : '') + (locked ? ' locked' : ''));
      card.innerHTML = `
        <div class="map-card-name">${m.name}${locked ? ' <span class="lock">🔒 需累计撤离 ' + m.unlock + ' 次</span>' : ''}</div>
        <div class="map-card-desc">${m.desc}</div>
        <div class="map-card-tags">
          <span class="tag ${m.tagCls}">威胁 ${m.diff}</span>
          <span class="tag lv">推荐 Lv.${m.recLv}</span>
          <span class="tag ${gearOk ? 'gear-ok' : 'gear-bad'}">准入 ◇${fmt(m.minGear || 0)}</span>
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
    const ok = gear >= (m.minGear || 0);
    box.innerHTML = `
      <div class="brief-row"><span class="brief-k">简报</span><span class="brief-v">${m.brief}</span></div>
      <div class="brief-row"><span class="brief-k">准入</span><span class="brief-v">战备 <b class="${ok ? 'gear-ok' : 'gear-warn'}">◇${fmt(m.minGear || 0)}</b> · 当前出战干员 <b class="${ok ? 'gear-ok' : 'gear-warn'}">◇${fmt(gear)}</b>${ok ? '' : '<span class="gear-warn">（不足，去军械库强化装备）</span>'}</span></div>
      <div class="brief-row"><span class="brief-k">威胁组成</span><span class="brief-v">
        <div class="threat-list">${bars}${m.boss ? '<div class="threat-row boss"><span class="tn">巢母 · BOSS</span><i class="tb"><b style="width:100%"></b></i><em>×1</em></div>' : ''}</div>
      </span></div>
      <div class="brief-row"><span class="brief-k">撤离</span><span class="brief-v">${m.extractPts} 个撤离点 · 时限 ${fmtTime(m.time)} · 物资密度 ×${m.lootDensity}</span></div>
      <div class="brief-row"><span class="brief-k">情报</span><span class="brief-v"><ul class="tip-list">${tips}</ul></span></div>`;
    // 难度按钮
    $$('.diff-btn').forEach(b => b.classList.toggle('active', +b.dataset.diff === this.selectedDiff));
  },

  renderPrep(save) {
    const box = $('#loadout-list');
    box.innerHTML = '';
    const worm = WORMS[this.selectedWorm];
    const wid = save.loadout.weapons[worm.id] || worm.weapon;
    const wpn = WEAPONS[wid];
    const rows = [
      { ico: '▮', nm: wpn.name, qty: wpn.short },
      { ico: '🛡', nm: '甲壳护甲 · ' + (save.loadout.armorTier?.[worm.id] || 1) + ' 型', qty: '甲 ' + (worm.armor + (save.loadout.bonusArmor?.[worm.id] || 0)) },
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
    const sb = $('#stash-list');
    sb.innerHTML = '';
    if (!stash.length) {
      sb.innerHTML = '<div class="stash-empty">仓库空着。<br>带回来的物资会在结算时自动折算成虫币。</div>';
    } else {
      stash.slice(0, 40).forEach(it => {
        const def = ITEMS_BY_ID[it.id];
        if (!def) return;
        const row = el('div', 'stash-row');
        row.innerHTML = `<span class="dot" style="background:${RARITY[def.rarity].color};box-shadow:0 0 6px ${RARITY[def.rarity].color}"></span>
          <span class="nm">${def.name}</span><span class="vl">◇${fmt(def.value)}</span>`;
        sb.appendChild(row);
      });
    }
    const total = stash.reduce((a, b) => a + (ITEMS_BY_ID[b.id]?.value || 0), 0);
    const totalEl = el('div', 'stash-row');
    totalEl.innerHTML = `<span class="dot" style="background:transparent"></span><span class="nm" style="color:#7f887c">合计估值</span><span class="vl">◇${fmt(total)}</span>`;
    if (stash.length) sb.appendChild(totalEl);
  },

  updateDeployBar(save) {
    const m = MAPS[this.selectedMap];
    const d = DIFFICULTIES[this.selectedDiff];
    setText('#deploy-map-name', m.name);
    const op = WORMS[this.selectedWorm] || WORMS[0];
    const opDown = save.worms[op.id].downed;
    const aliveN = WORMS.filter(x => !save.worms[x.id].downed).length;
    const gear = this.gearScore(save, op.id);
    const gearOk = gear >= (m.minGear || 0);
    $('#deploy-meta').innerHTML =
      `单人渗透 · 出战 <b style="color:${op.color}">『${op.name}』</b> · ` +
      `战备 <b class="${gearOk ? 'gear-ok' : 'gear-warn'}">◇${fmt(gear)}</b>` +
      `<span style="color:#59615a"> / 准入 </span><b class="${gearOk ? 'gear-ok' : 'gear-warn'}">◇${fmt(m.minGear || 0)}</b>` +
      ` · 可用 ${aliveN}/3 · 预计回收 <b>◇${fmt(Math.round(2800 * m.lootDensity * d.lootMul))}</b>` +
      (gearOk ? '' : ' · <b class="gear-warn">战备不足，去军械库强化</b>') +
      (opDown && aliveN > 0 ? ' · <b style="color:#ff8a7d">该干员在医疗舱，请换一条</b>' : '');
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
          const owned = save.ownedWeapons.includes(wid) || w.id === 'pistol';
          const equipped = (save.loadout.weapons[worm.id] || worm.weapon) === wid;
          html += `<div class="shop-item${equipped ? ' owned' : ''}">
            <div class="shop-item-name">${w.name}<small>${w.short}</small></div>
            <div class="shop-item-desc">${w.desc}</div>
            ${statBars(w)}
            <div class="shop-buy">
              <span class="shop-price">${owned ? (equipped ? '已装备' : '已拥有') : '◇ ' + fmt(w.value)}</span>
              <button class="btn btn-primary shop-act" data-act="${owned ? (equipped ? '' : 'equip') : 'buyweapon'}" data-id="${wid}" ${equipped ? 'disabled' : ''}>${equipped ? '装备中' : owned ? '装备' : '购买'}</button>
            </div></div>`;
        }
      } else {
        html += `<div class="shop-note">当前装配对象：<b style="color:${WORMS[this.selectedWorm].color}">『${WORMS[this.selectedWorm].name}』</b> · 装备强化为永久生效，消耗品在行动中按 1 / 2 / G 使用</div>`;
        for (const it of SHOP_ITEMS.filter(s => s.cat === this._shopTab)) {
          let price = it.price, note = '', owned = false;
          if ((save.ownedGear || []).includes(it.id)) { owned = true; note = '已获得'; }
          if (it.cat === 'consumable') {
            const own = save.consumables[it.effect.consumable] || 0;
            if (own >= 5) { owned = true; note = '已满'; }
            else note = '持有 ×' + own;
          }
          html += `<div class="shop-item${owned ? ' owned' : ''}">
            <div class="shop-item-name">${it.ico} ${it.name}<small>${note}</small></div>
            <div class="shop-item-desc">${it.desc}</div>
            <div class="shop-buy">
              <span class="shop-price">${owned ? '—' : '◇ ' + fmt(price)}</span>
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
      if (save.credits < w.value) { UI.toastModal('虫币不足', `需要 ◇${fmt(w.value)}，当前 ◇${fmt(save.credits)}。去行动里多刮点回来。`); return false; }
      save.credits -= w.value;
      save.ownedWeapons.push(wid);
      save.loadout.weapons[WORMS[UI.selectedWorm].id] = wid;
      Audio2.play('rare');
      onBuy();
      return true;
    }
    function buyItem(save, id, onBuy) {
      const it = SHOP_ITEMS.find(s => s.id === id);
      if (!it) return false;
      if (save.credits < it.price) { UI.toastModal('虫币不足', `需要 ◇${fmt(it.price)}，当前 ◇${fmt(save.credits)}。`); return false; }
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
      ${data.contract ? `<div class="rs-row ${data.contract.done ? 'good' : ''}"><span>契约 · ${data.contract.name}</span><b>${data.contract.done ? '+ ◇' + fmt(data.contract.got) : '未完成'}</b></div>` : ''}
      <div class="rs-row ${data.success ? 'good' : ''}"><span>${data.success ? '带出物资' : '安全箱带出'}</span><b>◇ ${fmt(s.lootValue)}</b></div>
      ${data.success ? '' : `<div class="rs-row bad"><span>遗留在战区</span><b>- ◇ ${fmt(s.lost || 0)}</b></div>`}
      <div class="rs-row hl"><span>${data.success ? '本次收入' : '本次回收'}</span><b>${data.success ? '+' : '+'} ◇ ${fmt(s.earned)}</b></div>
      <div class="rs-row"><span>剩余虫币</span><b>◇ ${fmt(s.credits)}</b></div>`;
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
      ? pick(LINES.extract_ok) + ' ' + pick([...FLAVOR_FACTS])
      : (data.reason === 'timeout' ? '时限到了，你留在原地。腐殖层不埋葬尸体，它消化。' : pick(LINES.death) + ' 白蛆会来处理剩下的部分。')
        + (data.safeKept ? ` 安全箱保住了 ${data.safeKept} 件物资，其余的留在了腐殖层。` : ' 安全箱被撬开了，什么都没剩。');
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
    setText('#hud-objective', g.mapCfg.boss ? '搜刮物资，可选：击杀巢母。找到撤离点并撤离。' : '搜刮物资，避开或清理白蛆巡逻队，找到撤离点撤离。');
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
    // 弹药
    setText('#hud-mag', w.mag);
    setText('#hud-reserve', w.reserve);
    $('#hud-mag').classList.toggle('empty', w.mag === 0);
    setText('#hud-weapon', w.weapon.name);
    const rh = $('#hud-reload');
    if (w.reloading) { rh.textContent = '换弹中… ' + w.reloadT.toFixed(1) + 's'; rh.classList.add('active'); }
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
          <div><b>M</b>静音。</div>
          <div><b>单人</b>：死亡后该蛆进医疗舱，换一条或付费复苏。</div>
        </div>
        <h3>三条蛆（每次只派一条）</h3>
        <ul>
          <li><b>老绿 · 突击手</b>：AR-77 突击步枪。技能「战地急救」回复 38 生命并补甲。最稳的一条，适合正面推进。</li>
          <li><b>小黄 · 侦察兵</b>：S-9 冲锋枪，移速最快、负重最低。技能「疾行」短距加速，适合抢点、绕后、逃跑。</li>
          <li><b>大紫 · 重装兵</b>：SG-12 霰弹枪，血厚甲厚。技能「硬壳」6 秒减伤 55%，适合堵门和拆巢母。</li>
        </ul>
        <h3>战备与准入</h3>
        <p>战备 = 武器 + 护甲 + 战术配件的价值总和，显示在大厅顶栏。每张地图有<b>准入战备</b>，
        不够就无法进场（例如虫巢核心需要 ◇4200）。想进更危险的区域，先去军械库换更好的武器与护甲，
        或者换一条战备更高的蛆。</p>
        <h3>搜刮与负重</h3>
        <p>物资分三档稀有度，越稀有越值钱。负重超过上限时移动速度下降。地面上的发光点是散落物资，靠近自动拾取。</p>
        <h3>保险箱与医疗舱</h3>
        <p>阵亡时稀有度最高的 3 件物资会进入安全箱保住，其余全部丢失。阵亡的蛆需要回大厅花虫币复苏；三条全躺时特勤处会垫付一次医疗费。</p>
      </div>`;
    this.showModal();
  },

  showDeath(g) { }
};
