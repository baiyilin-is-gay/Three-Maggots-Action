/* =========================================================
   audio.js — 纯 WebAudio 程序化音效（无外部资源）
   ========================================================= */
'use strict';

const Audio2 = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  enabled: true,
  musicOn: true,
  _musicTimer: 0,
  _musicStep: 0,
  _buffers: {},
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = .55; this.master.connect(this.ctx.destination);
      // 轻微压缩，避免枪声叠加爆音
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .14;
      comp.connect(this.master);
      this.bus = comp;
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = .85; this.sfxGain.connect(comp);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = .16; this.musicGain.connect(comp);
      this.noiseBuf = this._makeNoise(1.2);
    } catch (e) { console.warn('音频初始化失败', e); this.enabled = false; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? .55 : 0; },
  toggleMute() { this.setEnabled(!this.enabled); return this.enabled; },
  _makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  _noise(dur, filterType = 'lowpass', freq = 1200, q = 1, gain = .4, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t); src.stop(t + dur + .02);
    return { src, f, g };
  },
  _osc(type, f0, f1, dur, gain = .2, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.sfxGain); o.start(t); o.stop(t + dur + .02);
    return o;
  },
  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    const v = opt.vol != null ? opt.vol : 1;
    switch (name) {
      case 'shot_rifle': {
        this._noise(.13, 'lowpass', 3200, .8, .5 * v);
        this._osc('square', 190, 55, .1, .2 * v);
        this._noise(.05, 'highpass', 2400, .7, .18 * v);
        break;
      }
      case 'shot_smg': {
        this._noise(.09, 'lowpass', 4200, .9, .34 * v);
        this._osc('square', 260, 80, .06, .13 * v);
        break;
      }
      case 'shot_shotgun': {
        this._noise(.30, 'lowpass', 2200, .7, .62 * v);
        this._osc('sawtooth', 140, 40, .22, .24 * v);
        this._noise(.12, 'highpass', 1800, .7, .22 * v);
        break;
      }
      case 'shot_sniper': {
        this._noise(.4, 'lowpass', 1800, .6, .6 * v);
        this._osc('sawtooth', 120, 32, .3, .26 * v);
        break;
      }
      case 'shot_enemy': {
        this._noise(.12, 'bandpass', 1400, 1.2, .22 * v);
        this._osc('square', 300, 110, .07, .08 * v);
        break;
      }
      case 'hit': { this._noise(.07, 'bandpass', 900, 2, .3 * v); this._osc('triangle', 340, 120, .06, .1 * v); break; }
      case 'hit_wall': { this._noise(.06, 'highpass', 3600, 1, .16 * v); break; }
      case 'hurt': { this._osc('sawtooth', 180, 70, .2, .22 * v); this._noise(.15, 'lowpass', 700, 1, .2 * v); break; }
      case 'reload': { this._noise(.04, 'bandpass', 2000, 3, .2 * v); this._noise(.05, 'bandpass', 1500, 3, .18 * v); break; }
      case 'reload_done': { this._osc('triangle', 520, 700, .06, .12 * v); this._noise(.05, 'bandpass', 2600, 3, .16 * v); break; }
      case 'empty': { this._osc('square', 900, 700, .04, .08 * v); break; }
      case 'pickup': { this._osc('sine', 660, 990, .1, .12 * v); this._osc('sine', 990, 1320, .1, .09 * v, .06); break; }
      case 'rare': { [523, 659, 784, 1046].forEach((f, i) => this._osc('triangle', f, f * 1.01, .2, .1 * v, i * .07)); break; }
      case 'epic': { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this._osc('triangle', f, f * 1.01, .3, .11 * v, i * .06)); break; }
      case 'grenade_throw': { this._noise(.2, 'bandpass', 700, 1, .12 * v); break; }
      case 'explode': {
        this._noise(.7, 'lowpass', 700, .6, .7 * v);
        this._osc('sawtooth', 90, 24, .5, .35 * v);
        this._noise(.2, 'highpass', 1500, .6, .25 * v);
        break;
      }
      case 'ability': { this._osc('sine', 300, 900, .25, .14 * v); this._osc('triangle', 450, 1300, .3, .08 * v, .05); break; }
      case 'skill_ready': { this._osc('sine', 880, 1320, .12, .09 * v); break; }
      case 'swap': { this._noise(.1, 'bandpass', 600, 2, .16 * v); this._osc('triangle', 420, 620, .1, .1 * v); break; }
      case 'enemy_down': { this._osc('sawtooth', 260, 60, .3, .16 * v); this._noise(.25, 'lowpass', 900, 1, .2 * v); break; }
      case 'alert': { this._osc('square', 440, 660, .1, .1 * v); this._osc('square', 660, 880, .1, .1 * v, .12); break; }
      case 'spit': { this._noise(.18, 'bandpass', 500, 2, .2 * v); this._osc('sine', 220, 90, .18, .1 * v); break; }
      case 'extract_tick': { this._osc('sine', 700, 700, .04, .08 * v); break; }
      case 'extract_go': { [392, 523, 659, 784].forEach((f, i) => this._osc('triangle', f, f, .25, .12 * v, i * .09)); break; }
      case 'success': { [523, 659, 784, 1046, 1318].forEach((f, i) => this._osc('triangle', f, f, .4, .13 * v, i * .1)); break; }
      case 'fail': { [392, 330, 262, 196].forEach((f, i) => this._osc('sawtooth', f, f * .98, .5, .12 * v, i * .18)); break; }
      case 'ui': { this._osc('sine', 1200, 900, .03, .05 * v); break; }
      case 'ui_big': { this._osc('triangle', 300, 600, .12, .1 * v); break; }
      case 'door': { this._noise(.3, 'lowpass', 400, 1, .25 * v); this._osc('sawtooth', 120, 70, .3, .12 * v); break; }
      case 'switch': { this._noise(.06, 'bandpass', 1200, 4, .25 * v); this._osc('square', 500, 300, .07, .1 * v); break; }
      case 'shell': { this._noise(.08, 'highpass', 5000, 1, .09 * v); break; }
    }
  },
  // ---- 低频环境音乐（简单脉冲序列，营造地底氛围）----
  startMusic(mood = 'raid') {
    if (!this.ctx) return;
    this._mood = mood;
    this._musicStep = 0;
    this._musicAcc = 0;
    this._musicOn = true;
  },
  stopMusic() { this._musicOn = false; },
  updateMusic(dt) {
    if (!this._musicOn || !this.ctx || !this.enabled || !this.musicOn) return;
    this._musicAcc += dt;
    const bpm = this._mood === 'raid' ? 92 : 68;
    const stepDur = 60 / bpm / 2;
    while (this._musicAcc > stepDur) {
      this._musicAcc -= stepDur;
      this._musicTick(this._musicStep++);
    }
  },
  _musicTick(step) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const s = step % 16;
    const scale = this._mood === 'raid' ? [0, 3, 5, 7, 10] : [0, 2, 3, 7, 8];
    const root = this._mood === 'raid' ? 55 : 43.65;
    const seq = this._mood === 'raid'
      ? [0, null, null, 2, null, 1, null, null, 0, null, 3, null, null, 2, null, null]
      : [0, null, null, null, 2, null, null, null, 3, null, null, null, 1, null, null, null];
    const note = seq[s];
    if (note !== null && note !== undefined) {
      const f = root * Math.pow(2, scale[note % scale.length] / 12);
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .02);
      g.gain.exponentialRampToValueAtTime(.001, t + 1.4);
      const f2 = this.ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 420;
      o.connect(f2).connect(g).connect(this.musicGain);
      o.start(t); o.stop(t + 1.5);
    }
    // 打击/氛围噪声
    if (s === 0 || s === 8) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + .25);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
      src.connect(f).connect(g).connect(this.musicGain); src.start(t); src.stop(t + .3);
    }
    if (s === 12 && this._mood === 'raid') {
      this.ctx.createOscillator && (() => {
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = root * 4;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
        o.connect(g).connect(this.musicGain); o.start(t); o.stop(t + .55);
      })();
    }
  }
};
