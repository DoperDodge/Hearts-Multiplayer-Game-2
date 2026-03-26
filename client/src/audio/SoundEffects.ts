// ============================================================
// PIXEL HEARTS — Sound Effects (Web Audio API chiptune SFX)
// ============================================================

export type SFXName =
  | 'card_play' | 'card_slide' | 'card_flip' | 'card_deal'
  | 'trick_win' | 'trick_lose'
  | 'hearts_break' | 'queen_played' | 'shoot_moon'
  | 'game_win' | 'game_lose'
  | 'button_click' | 'button_hover'
  | 'player_join' | 'player_leave'
  | 'your_turn' | 'timer_warning' | 'error'
  | 'chat_message' | 'pass_confirm';

class SFXPlayer {
  private ctx: AudioContext | null = null;
  private _volume = 0.8;
  private _muted = false;

  get volume(): number { return this._volume; }
  set volume(v: number) { this._volume = Math.max(0, Math.min(1, v)); }

  get muted(): boolean { return this._muted; }
  set muted(v: boolean) { this._muted = v; }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  play(name: SFXName): void {
    if (this._muted || this._volume <= 0) return;
    try {
      const ctx = this.getCtx();
      switch (name) {
        case 'card_play': this.cardPlay(ctx); break;
        case 'card_slide': this.cardSlide(ctx); break;
        case 'card_flip': this.cardFlip(ctx); break;
        case 'card_deal': this.cardDeal(ctx); break;
        case 'trick_win': this.trickWin(ctx); break;
        case 'trick_lose': this.trickLose(ctx); break;
        case 'hearts_break': this.heartsBreak(ctx); break;
        case 'queen_played': this.queenPlayed(ctx); break;
        case 'shoot_moon': this.shootMoon(ctx); break;
        case 'game_win': this.gameWin(ctx); break;
        case 'game_lose': this.gameLose(ctx); break;
        case 'button_click': this.buttonClick(ctx); break;
        case 'button_hover': this.buttonHover(ctx); break;
        case 'player_join': this.playerJoin(ctx); break;
        case 'player_leave': this.playerLeave(ctx); break;
        case 'your_turn': this.yourTurn(ctx); break;
        case 'timer_warning': this.timerWarning(ctx); break;
        case 'error': this.errorSound(ctx); break;
        case 'chat_message': this.chatMessage(ctx); break;
        case 'pass_confirm': this.passConfirm(ctx); break;
      }
    } catch { /* ignore audio errors */ }
  }

  private vol(ctx: AudioContext): GainNode {
    const g = ctx.createGain();
    g.gain.value = this._volume * 0.3;
    g.connect(ctx.destination);
    return g;
  }

  private tone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType, dest: AudioNode, startTime?: number): void {
    const t = startTime ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private noise(ctx: AudioContext, duration: number, dest: AudioNode, startTime?: number): void {
    const t = startTime ?? ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.01, t + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(t);
  }

  // ── Individual SFX ────────────────────────────────────

  private cardPlay(ctx: AudioContext): void {
    const g = this.vol(ctx);
    this.noise(ctx, 0.06, g);
    this.tone(ctx, 300, 0.08, 'triangle', g);
  }

  private cardSlide(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.15);
    env.gain.setValueAtTime(0.3, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(env); env.connect(g);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  }

  private cardFlip(ctx: AudioContext): void {
    const g = this.vol(ctx);
    this.noise(ctx, 0.04, g);
    this.tone(ctx, 800, 0.05, 'square', g);
  }

  private cardDeal(ctx: AudioContext): void {
    const g = this.vol(ctx);
    g.gain.value = this._volume * 0.15;
    this.noise(ctx, 0.03, g);
    this.tone(ctx, 500, 0.04, 'triangle', g);
  }

  private trickWin(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 523, 0.1, 'square', g, t);
    this.tone(ctx, 659, 0.1, 'square', g, t + 0.08);
    this.tone(ctx, 784, 0.15, 'square', g, t + 0.16);
  }

  private trickLose(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 300, 0.15, 'triangle', g, t);
    this.tone(ctx, 250, 0.2, 'triangle', g, t + 0.12);
  }

  private heartsBreak(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    // Glass shatter noise
    this.noise(ctx, 0.3, g);
    // Descending tone
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.4);
    env.gain.setValueAtTime(0.4, t);
    env.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc.connect(env); env.connect(g);
    osc.start(t); osc.stop(t + 0.5);
  }

  private queenPlayed(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    // Dramatic sting
    this.tone(ctx, 200, 0.3, 'sawtooth', g, t);
    this.tone(ctx, 150, 0.4, 'sawtooth', g, t + 0.05);
    this.tone(ctx, 250, 0.25, 'square', g, t + 0.1);
  }

  private shootMoon(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => {
      this.tone(ctx, f, 0.2, 'square', g, t + i * 0.12);
    });
  }

  private gameWin(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    const notes = [523, 587, 659, 784, 880, 1047];
    notes.forEach((f, i) => {
      this.tone(ctx, f, 0.25, 'square', g, t + i * 0.15);
    });
  }

  private gameLose(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 300, 0.3, 'triangle', g, t);
    this.tone(ctx, 250, 0.3, 'triangle', g, t + 0.25);
    this.tone(ctx, 200, 0.5, 'triangle', g, t + 0.5);
  }

  private buttonClick(ctx: AudioContext): void {
    const g = this.vol(ctx);
    g.gain.value = this._volume * 0.2;
    this.tone(ctx, 800, 0.05, 'square', g);
  }

  private buttonHover(ctx: AudioContext): void {
    const g = this.vol(ctx);
    g.gain.value = this._volume * 0.1;
    this.tone(ctx, 600, 0.03, 'triangle', g);
  }

  private playerJoin(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 440, 0.1, 'triangle', g, t);
    this.tone(ctx, 660, 0.15, 'triangle', g, t + 0.08);
  }

  private playerLeave(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 440, 0.1, 'triangle', g, t);
    this.tone(ctx, 330, 0.2, 'triangle', g, t + 0.08);
  }

  private yourTurn(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 880, 0.08, 'square', g, t);
    this.tone(ctx, 1100, 0.08, 'square', g, t + 0.1);
    this.tone(ctx, 880, 0.12, 'square', g, t + 0.2);
  }

  private timerWarning(ctx: AudioContext): void {
    const g = this.vol(ctx);
    this.tone(ctx, 1000, 0.05, 'square', g);
  }

  private errorSound(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 200, 0.15, 'sawtooth', g, t);
    this.tone(ctx, 150, 0.15, 'sawtooth', g, t + 0.08);
  }

  private chatMessage(ctx: AudioContext): void {
    const g = this.vol(ctx);
    g.gain.value = this._volume * 0.12;
    this.tone(ctx, 1200, 0.04, 'triangle', g);
  }

  private passConfirm(ctx: AudioContext): void {
    const g = this.vol(ctx);
    const t = ctx.currentTime;
    this.tone(ctx, 600, 0.08, 'square', g, t);
    this.tone(ctx, 800, 0.1, 'square', g, t + 0.06);
  }
}

export const sfx = new SFXPlayer();
