/* =========================================================
   data.js — 游戏数据表（角色 / 武器 / 敌人 / 地图 / 物资 / 文案）
   ========================================================= */
'use strict';

const BAL = {
  TILE: 40,
  START_CREDITS: 1500,
  CARRY_BASE: 28,          // 基础负重 kg
  SLOW_OVERLOAD: 1.35,     // 超重的移速倍率
  EXTRACT_NEED: 1.0,       // 进入撤离区后需要保持的秒数
  CHANNEL_TIME: 5.0,       // 撤离读秒
  GRENADE_DMG: 95,
  GRENADE_RADIUS: 132,
  SAFE_SLOTS: 3,           // 安全箱槽位
  REVIVE_COST: 350
};

/* ------------------------- 武器 ------------------------- */
// w: 伤害  rpm: 射速  mag: 弹匣  reload: 换弹秒  spread: 散布(度)  pellets: 弹丸
// range: 伤害衰减距离  speed: 弹速  pen: 穿甲  recoil: 后坐  sound: 音效  value: 售价
const WEAPONS = {
  rifle77: {
    id: 'rifle77', name: 'AR-77「钻地虎」', short: '突击步枪', type: 'rifle',
    w: 26, rpm: 620, mag: 30, reload: 2.0, spread: 1.9, pellets: 1, range: 780, speed: 2400,
    pen: 1.0, recoil: 1.6, sound: 'shot_rifle', value: 2400, auto: true,
    desc: '军需处标准配发，枪管上的螺纹用来开罐头，也能用来开路。',
    stats: { 伤害: 26, 射速: 620, 精准: 74, 机动: 62, 弹匣: 30 }
  },
  ar90: {
    id: 'ar90', name: 'AR-90「回响」', short: '突击步枪', type: 'rifle',
    w: 31, rpm: 520, mag: 32, reload: 2.2, spread: 1.45, pellets: 1, range: 860, speed: 2600,
    pen: 1.15, recoil: 2.0, sound: 'shot_rifle', value: 4200, auto: true,
    desc: '每一枪都在管道里多响一次。贵，但回声从不撒谎。',
    stats: { 伤害: 31, 射速: 520, 精准: 84, 机动: 58, 弹匣: 32 }
  },
  ak_grub: {
    id: 'ak_grub', name: 'AK-3「啃骨者」', short: '突击步枪', type: 'rifle',
    w: 34, rpm: 560, mag: 30, reload: 2.3, spread: 2.4, pellets: 1, range: 740, speed: 2400,
    pen: 1.05, recoil: 2.6, sound: 'shot_rifle', value: 3000, auto: true,
    desc: '后坐力大到能把你往后推半步，正好用来退进掩体。',
    stats: { 伤害: 34, 射速: 560, 精准: 66, 机动: 60, 弹匣: 30 }
  },
  smg9: {
    id: 'smg9', name: 'S-9「管道吹风」', short: '冲锋枪', type: 'smg',
    w: 15, rpm: 1050, mag: 40, reload: 1.55, spread: 3.0, pellets: 1, range: 520, speed: 2100,
    pen: 0.85, recoil: 1.0, sound: 'shot_smg', value: 2000, auto: true,
    desc: '射速快到能把整条管道的回声用光。弹药消耗同理。',
    stats: { 伤害: 15, 射速: 1050, 精准: 56, 机动: 88, 弹匣: 40 }
  },
  smg12: {
    id: 'smg12', name: 'S-12「蜂群」', short: '冲锋枪', type: 'smg',
    w: 12, rpm: 1250, mag: 36, reload: 1.5, spread: 3.4, pellets: 1, range: 470, speed: 2100,
    pen: 0.8, recoil: 0.9, sound: 'shot_smg', value: 3400, auto: true,
    desc: '扣下扳机，弹匣像受惊的蜂群一样倾巢而出。',
    stats: { 伤害: 12, 射速: 1250, 精准: 52, 机动: 92, 弹匣: 36 }
  },
  nailgun: {
    id: 'nailgun', name: 'N-50「钝针」', short: '钉枪', type: 'nail',
    w: 9, rpm: 900, mag: 50, reload: 1.8, spread: 2.2, pellets: 1, range: 540, speed: 2200,
    pen: 0.7, recoil: 0.5, sound: 'shot_smg', value: 1800, auto: true,
    desc: '工兵遗物。打不死人，但能把人钉在墙上慢慢想。',
    stats: { 伤害: 9, 射速: 900, 精准: 64, 机动: 96, 弹匣: 50 }
  },
  shot12: {
    id: 'shot12', name: 'SG-12「碎壳」', short: '霰弹枪', type: 'shotgun',
    w: 15, rpm: 78, mag: 6, reload: 2.6, spread: 9.5, pellets: 8, range: 330, speed: 1900,
    pen: 0.55, recoil: 5.2, sound: 'shot_shotgun', value: 2600, auto: false,
    desc: '八颗铅弹一起出门，通常只有三颗回来。',
    stats: { 伤害: 120, 射速: 78, 精准: 30, 机动: 46, 弹匣: 6 }
  },
  auto_shot: {
    id: 'auto_shot', name: 'AS-8「清道夫」', short: '自动霰弹枪', type: 'shotgun',
    w: 11, rpm: 210, mag: 8, reload: 2.9, spread: 7.5, pellets: 6, range: 360, speed: 1900,
    pen: 0.6, recoil: 3.4, sound: 'shot_shotgun', value: 5200, auto: true,
    desc: '连发霰弹。维修手册最后一页写着：别在管道里用。',
    stats: { 伤害: 66, 射速: 210, 精准: 38, 机动: 44, 弹匣: 8 }
  },
  dmr5: {
    id: 'dmr5', name: 'DMR-5「长触须」', short: '精确射手步枪', type: 'dmr',
    w: 58, rpm: 190, mag: 10, reload: 2.4, spread: 0.7, pellets: 1, range: 1150, speed: 3200,
    pen: 1.4, recoil: 4.0, sound: 'shot_sniper', value: 3600, auto: false,
    desc: '从钟楼上往下看，白蛆只是慢动作的白色标点。',
    stats: { 伤害: 58, 射速: 190, 精准: 96, 机动: 40, 弹匣: 10 }
  },
  sniper: {
    id: 'sniper', name: 'SR-11「守夜人」', short: '栓动狙击枪', type: 'sniper',
    w: 115, rpm: 42, mag: 5, reload: 3.0, spread: .4, pellets: 1, range: 1500, speed: 3600,
    pen: 1.7, recoil: 7.5, sound: 'shot_sniper', value: 6000, auto: false,
    desc: '一枪，一个念头，一次换弹。它守的不是夜，是你背后的门。',
    stats: { 伤害: 115, 射速: 42, 精准: 99, 机动: 30, 弹匣: 5 }
  },
  lmg9: {
    id: 'lmg9', name: 'LMG-9「绞肉机」', short: '轻机枪', type: 'lmg',
    w: 21, rpm: 700, mag: 75, reload: 3.4, spread: 2.6, pellets: 1, range: 760, speed: 2400,
    pen: 1.1, recoil: 2.2, sound: 'shot_rifle', value: 4800, auto: true,
    desc: '七十五发，够把一条走廊犁两遍。背它的人通常不跑。',
    stats: { 伤害: 21, 射速: 700, 精准: 60, 机动: 34, 弹匣: 75 }
  },
  pistol: {
    id: 'pistol', name: 'P-3「最后一句」', short: '手枪', type: 'pistol',
    w: 19, rpm: 300, mag: 12, reload: 1.2, spread: 2.4, pellets: 1, range: 460, speed: 2000,
    pen: 0.8, recoil: 1.6, sound: 'shot_smg', value: 400, auto: false,
    desc: '配发给每个还没死透的人。',
    stats: { 伤害: 19, 射速: 300, 精准: 60, 机动: 95, 弹匣: 12 }
  }
};

/* ------------------------- 蛆虫角色 ------------------------- */
const WORMS = [
  {
    id: 'green', name: '老绿', color: '#9ad42f', color2: '#5d8f12', colorDark: '#33510a',
    title: '突击手', epithet: '腐殖层军需官', role: '突击 / 火力',
    hp: 130, armor: 70, speed: 205, carry: 32, weapon: 'rifle77',
    ability: { name: '战地急救', key: 'SHIFT', cd: 22, desc: '原地注射：回复 38 点生命，并按最大生命的 30% 补充护甲。' },
    bd: '前军需官，把每颗子弹都记在账上，包括欠死人的。',
    quote: '「止血带比遗书便宜。」',
    stats: { 火力: 78, 生存: 72, 机动: 62, 搜刮: 70 }
  },
  {
    id: 'yellow', name: '小黄', color: '#ffd24a', color2: '#d99a12', colorDark: '#7a5306',
    title: '侦察兵', epithet: '管道侦察兵', role: '侦察 / 机动',
    hp: 105, armor: 45, speed: 245, carry: 28, weapon: 'smg9',
    ability: { name: '疾行', key: 'SHIFT', cd: 9, desc: '1.1 秒内移速提升 120%，并短暂免疫减速；途中射击不减速。' },
    bd: '嘴比腿快，腿比子弹快，消息比两者都快。',
    quote: '「跟上，别踩我刚踩过的——算了。」',
    stats: { 火力: 58, 生存: 48, 机动: 96, 搜刮: 88 }
  },
  {
    id: 'purple', name: '大紫', color: '#b98bff', color2: '#7c4fd0', colorDark: '#3d2470',
    title: '重装兵', epithet: '重装爆破手', role: '重装 / 爆破',
    hp: 175, armor: 110, speed: 172, carry: 40, weapon: 'shot12',
    ability: { name: '硬壳', key: 'SHIFT', cd: 26, desc: '展开硬化甲壳 6 秒：减伤 55%，免疫击退，可撞开敌人。' },
    bd: '拆过虫巢三号门，也拆过自己人两回。',
    quote: '「壳撑十秒，够你们跑。」',
    stats: { 火力: 88, 生存: 95, 机动: 40, 搜刮: 52 }
  }
];
const WORM_BY_ID = Object.fromEntries(WORMS.map(w => [w.id, w]));

/* ------------------------- 敌人 ------------------------- */
const ENEMIES = {
  scout: {
    id: 'scout', name: '白蛆哨兵', kind: 'ranged', hp: 55, speed: 92, radius: 15,
    color: '#e8e6d8', color2: '#a9a894', colorDark: '#5c5b4e',
    sense: 460, atkRange: 380, atkCd: 1.35, dmg: 9, bulletSpeed: 520,
    value: 0, xp: 1, colorEye: '#ff5a3c', score: 25,
    desc: '沿管壁巡游，有动静先缩头，再吹哨叫人。它不敢打，哨子敢。'
  },
  worker: {
    id: 'worker', name: '白蛆工兵', kind: 'melee', hp: 110, speed: 108, radius: 17,
    color: '#dcd8c4', color2: '#9b9680', colorDark: '#4f4c3e',
    sense: 350, atkRange: 44, atkCd: 1.1, dmg: 14,
    value: 0, xp: 1, colorEye: '#ffb03a', score: 30,
    desc: '扛着有机水泥补通道，被惊动就用泥浆糊你的枪口。别在它干活时靠近。'
  },
  spitter: {
    id: 'spitter', name: '酸性喷吐者', kind: 'ranged', hp: 80, speed: 76, radius: 19,
    color: '#7fe0b0', color2: '#3f9a76', colorDark: '#1d4a3a',
    sense: 520, atkRange: 420, atkCd: 2.1, dmg: 12, bulletSpeed: 380, acid: true,
    value: 0, xp: 2, colorEye: '#d6ff3a', score: 45,
    desc: '体内存消化液，隔十步喷你一脸。落地成滩，踩上去鞋底先走。'
  },
  brute: {
    id: 'brute', name: '甲壳冲撞兽', kind: 'charger', hp: 320, speed: 82, radius: 26,
    color: '#c9b7a0', color2: '#8e7a60', colorDark: '#4a3d2c',
    sense: 480, atkRange: 60, atkCd: 1.6, dmg: 26, chargeSpeed: 460, armor: 0.45,
    value: 0, xp: 4, colorEye: '#ff3a2a', score: 110,
    desc: '低伏冲锋，护甲厚到子弹只刮出白痕。转身慢，绕背才划算。'
  },
  attendant: {
    id: 'attendant', name: '巢母侍从', kind: 'ranged', hp: 180, speed: 118, radius: 20,
    color: '#e0b8ff', color2: '#a06ad0', colorDark: '#4a2a70',
    sense: 560, atkRange: 330, atkCd: 1.0, dmg: 11, bulletSpeed: 620, healAura: true,
    value: 0, xp: 3, colorEye: '#ff5aff', score: 70,
    desc: '只在虫巢核心出没，护着母体边打边愈合。要打就快，不然别打。'
  },
  queen: {
    id: 'queen', name: '巢母 · 第九消化腔', kind: 'boss', hp: 3000, speed: 62, radius: 60,
    color: '#ff9ad0', color2: '#b03a7a', colorDark: '#4a0f2c',
    sense: 900, atkRange: 560, atkCd: 1.6, dmg: 18, bulletSpeed: 400,
    value: 0, xp: 20, colorEye: '#fff05a', score: 1200, boss: true,
    desc: '有机物正从这里溢出，母体在深处呼吸。它不是在战斗，它是在进食。'
  }
};

/* ------------------------- 地图 ------------------------- */
const MAPS = [
  {
    id: 'pipes', name: '腐败管道 · 东三环', short: '腐败管道',
    diff: '低', tagCls: 'easy', recLv: '1-5', level: 1, unlock: 0, minGear: 0,
    w: 86, h: 62, time: 300, seed: 1131,
    enemies: { scout: 8, worker: 7, spitter: 5, brute: 1 },
    extractPts: 2, lootDensity: 1.0, boss: false,
    palette: {
      floor: ['#2c322a', '#313730', '#272c25'], floorLine: '#15180f',
      wall: ['#4a5140', '#3c4234', '#30362a'], wallTop: '#5f6850',
      accent: '#9fb46a', fog: '#080a07', deco: 'pipe'
    },
    desc: '半塌的排污主干管，白蛆巡逻稀，物资也薄。',
    brief: '管道承压结构大面积失效，管壁长满滑腻的菌膜。白蛆的换岗间隙只有七分钟——够你钻进去，也够你出不来。撤退点老旧，但还能用。',
    danger: 1, tips: ['敌人密度最低，适合熟悉单人渗透流程', '拐角多，霰弹枪和手雷更好用', '常规难度下几乎没有重甲单位']
  },
  {
    id: 'city', name: '黏菌废都 · 钟楼区', short: '黏菌废都',
    diff: '中', tagCls: 'mid', recLv: '6-12', level: 2, unlock: 2, minGear: 2600,
    w: 96, h: 70, time: 330, seed: 2247,
    enemies: { scout: 10, worker: 8, spitter: 8, brute: 4 },
    extractPts: 3, lootDensity: 1.25, boss: false,
    palette: {
      floor: ['#2e3537', '#333a3c', '#282f31'], floorLine: '#121718',
      wall: ['#4f5759', '#41484a', '#333a3c'], wallTop: '#657072',
      accent: '#7fd6c2', fog: '#070b0b', deco: 'moss'
    },
    desc: '菌毯覆盖的旧城区，高处能看见枪口，也容易被看见。',
    brief: '钟楼区的菌毯还在扩张，踩上去会变慢。街区之间被坍塌的楼板切碎，视野开阔但也意味着——你被看见的时候，已经被瞄准了。',
    danger: 2, tips: ['中距离交火多，带一把精确射手步枪', '菌毯会减速，注意脚下', '物资密度高，值得多搜两栋楼']
  },
  {
    id: 'yard', name: '锈蚀货场 · 七号堆场', short: '锈蚀货场',
    diff: '中', tagCls: 'mid', recLv: '6-14', level: 2, unlock: 3, minGear: 3000,
    w: 92, h: 66, time: 320, seed: 4419,
    enemies: { scout: 9, worker: 7, brute: 5, spitter: 5 },
    extractPts: 3, lootDensity: 1.2, boss: false,
    palette: {
      floor: ['#3a2f26', '#403428', '#332a22'], floorLine: '#1a120c',
      wall: ['#6b4f38', '#573f2d', '#452f21'], wallTop: '#7d5d42',
      accent: '#d08a4a', fog: '#090604', deco: 'rust'
    },
    desc: '废弃的有机货柜堆场，锈水漫过脚踝，白蛆在这里搬运不知名的货。',
    brief: '七号堆场的货柜堆到快顶住洞顶，锈水在缝隙里晃。冲撞兽喜欢从货柜后面直接撞出来——听声音，别听脚步。',
    danger: 2, tips: ['货柜之间视野短，霰弹枪与冲锋枪更顺手', '冲撞兽会从转角冲出，别贴着货柜走', '物资箱多，但撤离点分散']
  },
  {
    id: 'nest', name: '虫巢核心 · 第九消化腔', short: '虫巢核心',
    diff: '高', tagCls: 'hard', recLv: '13-20', level: 3, unlock: 5, minGear: 4200,
    w: 100, h: 76, time: 360, seed: 3373,
    enemies: { scout: 9, worker: 6, spitter: 10, brute: 6, attendant: 4 },
    extractPts: 3, lootDensity: 1.6, boss: true,
    palette: {
      floor: ['#332631', '#382a35', '#2c2129'], floorLine: '#160d12',
      wall: ['#5c4352', '#4a3644', '#392a35'], wallTop: '#6e5163',
      accent: '#e07ab4', fog: '#0a0408', deco: 'flesh'
    },
    desc: '有机物正从这里溢出，母体在深处呼吸。',
    brief: '第九消化腔是整个虫巢的心脏。巢母在这里呼吸，每一次呼吸都会吐出新的侍从。带够弹匣，或者带够遗言。',
    danger: 3, tips: ['巢母会持续召唤侍从，优先清理小怪', '重甲单位多，穿甲武器收益高', '撤离点分散，提前规划路线']
  },
  {
    id: 'chapel', name: '白骨圣堂 · 捐躯者中殿', short: '白骨圣堂',
    diff: '高', tagCls: 'hard', recLv: '15-24', level: 3, unlock: 7, minGear: 5500,
    w: 98, h: 74, time: 370, seed: 5531,
    enemies: { scout: 14, spitter: 9, brute: 6, attendant: 3 },
    extractPts: 2, lootDensity: 1.35, boss: false,
    palette: {
      floor: ['#33322c', '#383730', '#2c2b26'], floorLine: '#17160f',
      wall: ['#6a6656', '#545040', '#403c30'], wallTop: '#7d7866',
      accent: '#cfc7a8', fog: '#080806', deco: 'bone'
    },
    desc: '用历代阵亡者的甲壳砌成的圣堂，长明灯还亮着，灯油是别的东西。',
    brief: '圣堂的中殿没有掩体，只有一排排甲壳长椅。白蛆把最准的哨兵放在高台上，把最重的冲撞兽放在门口。要么快，要么别进去。',
    danger: 3, tips: ['长直走廊多，狙击枪与精确射手步枪强势', '高台哨兵先清，否则一路被点', '只有 2 个撤离点，路线要提前定']
  },
  {
    id: 'heart', name: '母巢心室 · 溢流层', short: '母巢心室',
    diff: '崩坏', tagCls: 'hard', recLv: '25+', level: 4, unlock: 11, minGear: 7000,
    w: 104, h: 80, time: 400, seed: 6673,
    enemies: { scout: 11, spitter: 12, brute: 8, attendant: 7 },
    extractPts: 3, lootDensity: 1.8, boss: true,
    palette: {
      floor: ['#2f1a24', '#35202b', '#27141d'], floorLine: '#14070c',
      wall: ['#60303f', '#4a2431', '#381a25'], wallTop: '#723a4c',
      accent: '#ff6fa8', fog: '#0d0307', deco: 'vein'
    },
    desc: '虫巢再往下，心室在搏动。这里的空气是甜的，甜得不对劲。',
    brief: '溢流层的有机物浓到能把灯光吸掉。心室壁会随着母体的心跳舒张，通道每隔一阵就变窄。白蛆在这里不是巡逻，是朝圣。',
    danger: 4, tips: ['物资最肥，但敌人密度与伤害都最高', '两只巢母侍从会互相治疗，先拆治疗再打母体', '心跳间隙通道会收缩，别在窄道里恋战']
  }
];
const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));

/* ------------------------- 难度 ------------------------- */
const DIFFICULTIES = [
  { id: 'normal', name: '常规行动', enemyMul: 1.0, dmgMul: 1.0, lootMul: 1.0, timeMul: 1.0, color: '#b8f24a' },
  { id: 'danger', name: '危险行动', enemyMul: 1.35, dmgMul: 1.25, lootMul: 1.15, timeMul: 1.0, color: '#ffb02e' },
  { id: 'secret', name: '绝密行动', enemyMul: 1.75, dmgMul: 1.55, lootMul: 1.35, timeMul: 1.0, color: '#ff4a3d' }
];

/* ------------------------- 物资 ------------------------- */
// rarity: 0 普通 1 稀有 2 史诗   slot: 占格（重量 kg 由 slot*2 决定）
const ITEMS = [
  { id: 'crystal', name: '黏菌结晶', rarity: 0, value: 180, desc: '舔一口能止血，舔两口能致幻。' },
  { id: 'mag', name: '锈蚀弹匣', rarity: 0, value: 220, desc: '压进去一半会卡壳，另一半看运气。' },
  { id: 'battery', name: '潮湿电池组', rarity: 0, value: 320, desc: '还能亮，就是握着有点麻。' },
  { id: 'bandage', name: '腐叶绷带卷', rarity: 0, value: 140, desc: '从上一任使用者身上解下来的。' },
  { id: 'filter', name: '菌丝滤芯', rarity: 1, value: 650, desc: '过滤毒气，不过滤谎话。' },
  { id: 'plate', name: '甲壳护板', rarity: 1, value: 880, desc: '白蛆的背壳，敲下来还能响。' },
  { id: 'wax', name: '巢蜡密封剂', rarity: 1, value: 540, desc: '封得住管道，封不住嘴。' },
  { id: 'enzyme', name: '浓缩消化酶', rarity: 1, value: 1150, desc: '别洒。洒了它就把你消化掉。' },
  { id: 'core', name: '虫巢核心碎片', rarity: 2, value: 3800, desc: '还在跳。它记得自己属于谁。' },
  { id: 'gland', name: '腺体供能囊', rarity: 2, value: 2400, desc: '整支小队的枪，靠它一次心跳。' },
  { id: 'token', name: '白蛆军团令符', rarity: 2, value: 1650, desc: '敌人的敌人不一定是朋友，但值钱。' },
  { id: 'slime', name: '原始黏液样本', rarity: 2, value: 3200, desc: '腐殖层第一次呼吸留下的东西。' }
];
const ITEMS_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const RARITY = [
  { name: '普通', color: '#b9c1b0', glow: 'rgba(185,193,176,.3)' },
  { name: '稀有', color: '#5ec8ff', glow: 'rgba(94,200,255,.45)' },
  { name: '史诗', color: '#d08bff', glow: 'rgba(208,139,255,.55)' }
];

// 容器类型
const CONTAINERS = [
  { id: 'crate', name: '补给箱', slots: [1, 2], weight: 1.0, rar: [0.86, 0.13, 0.01], color: '#8ea25a' },
  { id: 'medical', name: '医药箱', slots: [1, 2], weight: 0.9, rar: [0.7, 0.26, 0.04], color: '#59e3c8' },
  { id: 'ammo', name: '弹药箱', slots: [1, 2], weight: 0.9, rar: [0.82, 0.17, 0.01], color: '#ffb02e' },
  { id: 'tool', name: '工具箱', slots: [1, 2], weight: 1.1, rar: [0.8, 0.18, 0.02], color: '#9aa3b2' },
  { id: 'server', name: '电子终端', slots: [1, 2], weight: 1.2, rar: [0.55, 0.36, 0.09], color: '#6fa8ff' },
  { id: 'safe', name: '保险箱', slots: [2, 3], weight: 1.15, rar: [0.3, 0.48, 0.22], color: '#ffd93d', locked: true },
  { id: 'egg', name: '虫卵囊', slots: [1, 2], weight: 1.1, rar: [0.58, 0.3, 0.12], color: '#d86fa8' }
];

/* ------------------------- 商店 ------------------------- */
const SHOP_ITEMS = [
  { id: 'armor2', name: '甲壳护甲 · Ⅱ型', cat: 'gear', price: 1800, ico: '🛡', desc: '整片黏菌甲壳压制而成，比上一件多扛两发。', effect: { armor: 35 } },
  { id: 'armor3', name: '甲壳护甲 · Ⅲ型', cat: 'gear', price: 4200, ico: '🛡', desc: '三层叠加，代价是你要多背五公斤。', effect: { armor: 70 } },
  { id: 'gland_core', name: '腺体供能核心', cat: 'gear', price: 3200, ico: '♥', desc: '心跳一次，供能一次。最大生命 +20。', effect: { hp: 20 } },
  { id: 'filter_mask', name: '菌丝滤面罩', cat: 'gear', price: 1500, ico: '☣', desc: '酸性环境伤害降低 35%。', effect: { acidResist: .35 } },
  { id: 'bandolier', name: '弹链背带', cat: 'gear', price: 2600, ico: '⁝', desc: '备弹量 +50%，负重 +6kg。', effect: { ammoMul: .5, carry: 6 } },
  { id: 'scope', name: '触须瞄准镜', cat: 'gear', price: 2200, ico: '◎', desc: '远程精准 +15%，但近战抬枪慢一点。', effect: { accuracy: .15 } },
  { id: 'radar', name: '地底声呐', cat: 'gear', price: 2000, ico: '≋', desc: '每隔 25 秒在战术地图上标记周围敌人。', effect: { radar: true } },
  { id: 'stash1', name: '仓库扩容 · 小型', cat: 'gear', price: 2500, ico: '▤', desc: '仓库容量 +20 格（账号通用）。', effect: { stashCap: 20 } },
  { id: 'stash2', name: '仓库扩容 · 中型', cat: 'gear', price: 4500, ico: '▤', desc: '仓库容量 +30 格（账号通用）。', effect: { stashCap: 30 } },
  { id: 'stash3', name: '仓库扩容 · 大型', cat: 'gear', price: 7000, ico: '▤', desc: '仓库容量 +50 格（账号通用）。', effect: { stashCap: 50 } },
  { id: 'medkit', name: '战地医疗包', cat: 'consumable', price: 500, ico: '✚', desc: '行动中按 1 使用，回复 45 点生命。上限 3 个。', effect: { consumable: 'medkit' } },
  { id: 'grenade', name: '浓缩手雷', cat: 'consumable', price: 350, ico: '✹', desc: '按 G 投出，爆炸伤害 95。上限 6 枚。', effect: { consumable: 'grenade' } },
  { id: 'smoke', name: '菌孢烟雾弹', cat: 'consumable', price: 400, ico: '◌', desc: '按 2 投出，遮挡敌方视野 8 秒。上限 3 枚。', effect: { consumable: 'smoke' } },
  { id: 'refill', name: '弹药补给', cat: 'consumable', price: 200, ico: '▮', desc: '行动开始时所有弹匣填满，备弹 +40%。', effect: { consumable: 'refill' } }
];

/* ------------------------- 文案池 ------------------------- */
const LINES = {
  load: ['正在钻入腐殖层……', '物资清单已上传，别丢。'],
  death: ['你被消化了一半。', '回收失败，重量归零。'],
  extract_ok: ['舱门关闭，先别吐。', '撤离成功，账已记上。'],
  extract_fail: ['撤离点已失效，自行解释。', '时限到了，你留在原地。'],
  low_hp: ['血量偏低，还能爬。', '止血带用完了，聊点别的。'],
  teammate_down: ['队友已阵亡，位置腾出来了。'],
  full: ['背包已满，良心还有空。'],
  over: ['行动超时。腐殖层不埋葬尸体，它消化。']
};
const TIPS = [
  '白蛆军团今日在主干管第三闸口集结，数量约三个小队。建议绕行，或带够手雷。',
  '黏菌废都钟楼区菌毯扩张，踩上去会变慢。当地商人拒绝对此负责。',
  '腐败管道东三环的巡逻班次改了，换岗间隙有七分钟空档。别问消息来源。',
  '有机物溢出浓度上升，虫巢核心消化腔正在外扩。撤离窗口比昨日短四十秒。',
  '有队伍从第九消化腔带回一块核心碎片，三人只剩一人。买家已加价。',
  '今日风向朝南，酸性喷吐者射程增加。咽喉不适者建议改走地下。'
];

const SUBTITLES = {
  start: [
    '单独渗透。没有队友，没有第二次机会。',
    '三条蛆轮着上，这次轮到你。',
    '腐殖层不会记得你，但账本会。'
  ],
  low_hp: ['老绿：止血带比遗书便宜。', '小黄：我还能跑，就是腿有点软。', '大紫：壳裂了，但还没穿。'],
  boss: ['小黄：那玩意儿在呼吸……', '大紫：拆它。', '老绿：先打腿，再打头，最后打报告。'],
  extract: ['老绿：撤离点到了，别贪。', '小黄：舱门开的时候别吐在货舱里。'],
  death: ['小黄：我的份额……记得寄给我妈。']
};

/* ------------------------- 行动契约 ------------------------- */
const CONTRACTS = [
  { id: 'epic', name: '回收史诗', desc: '带出至少 1 件史诗物资', bonus: 900, check: g => g.lootList.some(i => i.rarity === 2) },
  { id: 'kill', name: '清理白蛆', desc: '击杀 8 个白蛆单位', bonus: 650, check: g => g.kills >= 8 },
  { id: 'search', name: '彻底搜刮', desc: '搜刮 10 个容器', bonus: 550, check: g => g.containersOpened >= 10 },
  { id: 'intact', name: '完整回收', desc: '撤离时生命高于 60%', bonus: 750, check: g => g.active && g.active.alive && g.active.hp >= g.active.maxHp * .6 },
  { id: 'boss', name: '斩首行动', desc: '击杀巢母', bonus: 2200, onlyBoss: true, check: g => g.boss && !g.boss.alive },
  { id: 'greedy', name: '贪得无厌', desc: '带出总价值 ◇5000 以上的物资', bonus: 1000, check: g => g.lootValue >= 5000 }
];

/* 随机风味情报（加载/结算） */
const FLAVOR_FACTS = [
  '腐殖层第七次有机物溢出后，地下王国就再没恢复过市政。',
  '所有撤离舱都配备呕吐袋，这是后勤唯一没削减的预算。',
  '白蛆没有军衔，它们用啃过的骨头排列顺序。',
  '虫币的背面印着一根管子，没人知道为什么。',
  '特勤处把阵亡抚恤金折算成物资重量发放，多退少补。',
  '老绿的账本第七页写着三个名字，被血糊住了。',
  '有人说虫巢核心深处有一面墙，墙上刻着所有失踪小队的花名册。'
];
