// ============================================================
// PIXEL HEARTS — Procedural Chiptune Music Generator
// Creates a chill, jazzy lo-fi loop inspired by Balatro's vibe
// Uses Web Audio API — no external files needed
// ============================================================

type NoteFreq = number;

// Jazz-influenced chord progression in C minor:
// Cm7 → Ab7 → Fm7 → G7 (i7 → VI7 → iv7 → V7)
const CHORDS: NoteFreq[][] = [
  [130.81, 155.56, 196.00, 233.08], // Cm7:  C3  Eb3  G3  Bb3
  [207.65, 261.63, 311.13, 369.99], // AbM7: Ab3 C4   Eb4 G4
  [174.61, 207.65, 261.63, 311.13], // Fm7:  F3  Ab3  C4  Eb4
  [196.00, 246.94, 293.66, 349.23], // G7:   G3  B3   D4  F4
];

// Melodic notes that work over the progression (C natural minor / Bb major)
const MELODY_NOTES: NoteFreq[][] = [
  [523.25, 466.16, 392.00, 349.23, 311.13], // over Cm7
  [523.25, 466.16, 415.30, 392.00, 311.13], // over AbM7
  [523.25, 466.16, 392.00, 349.23, 311.13], // over Fm7
  [587.33, 523.25, 493.88, 392.00, 349.23], // over G7
];

const BASS_NOTES: NoteFreq[] = [
  65.41, // C2
  103.83, // Ab2
  87.31, // F2
  98.00, // G2
];

// Pentatonic-ish melody patterns (scale degree indices)
const MELODY_PATTERNS = [
  [0, 2, 1, 3, 2, 4, 3, 1],
  [2, 0, 3, 1, 4, 2, 1, 0],
  [1, 3, 0, 2, 4, 1, 3, 2],
  [0, 1, 2, 3, 2, 1, 0, 4],
  [3, 2, 4, 1, 0, 2, 3, 1],
  [4, 3, 2, 1, 0, 1, 2, 3],
];

export class MusicGenerator {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private nextNoteTime = 0;
  private currentChord = 0;
  private beatInChord = 0;
  private schedulerTimer: number | null = null;
  private patternIndex = 0;
  private melodyStep = 0;
  private _volume = 0.5;
  private activeNodes: Set<AudioNode> = new Set();

  // Tempo: ~85 BPM for that chill lo-fi feel
  private tempo = 85;
  private beatsPerChord = 8;
  private get beatDuration() { return 60.0 / this.tempo; }

  get volume(): number { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this._volume * 0.18, this.ctx!.currentTime, 0.1);
    }
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;

    if (!this.ctx) {
      this.ctx = new AudioContext();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._volume * 0.18;
    this.masterGain.connect(this.ctx.destination);

    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.currentChord = 0;
    this.beatInChord = 0;
    this.melodyStep = 0;
    this.patternIndex = 0;

    this.schedule();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.3);
    }
    // Clean up after fade
    setTimeout(() => {
      for (const node of this.activeNodes) {
        try { (node as OscillatorNode).stop?.(); } catch {}
      }
      this.activeNodes.clear();
    }, 500);
  }

  private schedule(): void {
    if (!this.isPlaying || !this.ctx) return;

    // Schedule notes ahead of time (lookahead)
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      this.scheduleNotes(this.nextNoteTime);
      this.advance();
    }

    this.schedulerTimer = window.setTimeout(() => this.schedule(), 50);
  }

  private advance(): void {
    this.nextNoteTime += this.beatDuration;
    this.beatInChord++;
    this.melodyStep++;

    if (this.beatInChord >= this.beatsPerChord) {
      this.beatInChord = 0;
      this.currentChord = (this.currentChord + 1) % CHORDS.length;
    }

    if (this.melodyStep >= MELODY_PATTERNS[this.patternIndex].length) {
      this.melodyStep = 0;
      this.patternIndex = (this.patternIndex + 1) % MELODY_PATTERNS.length;
    }
  }

  private scheduleNotes(time: number): void {
    // ── Pad (sustained chord tones) — every chord change
    if (this.beatInChord === 0) {
      this.playPad(time, CHORDS[this.currentChord], this.beatsPerChord * this.beatDuration);
    }

    // ── Bass — beats 0 and 4
    if (this.beatInChord === 0 || this.beatInChord === 4) {
      const bassNote = BASS_NOTES[this.currentChord];
      const octaveShift = this.beatInChord === 4 ? 1.5 : 1;
      this.playBass(time, bassNote * octaveShift, this.beatDuration * 1.8);
    }

    // ── Melody — play on most beats with some rests for breathing room
    const shouldPlayMelody = this.beatInChord !== 3 && this.beatInChord !== 7;
    if (shouldPlayMelody) {
      const pattern = MELODY_PATTERNS[this.patternIndex];
      const noteIdx = pattern[this.melodyStep % pattern.length];
      const freq = MELODY_NOTES[this.currentChord][noteIdx];

      // Slight humanization: random timing offset and velocity
      const timeOffset = (Math.random() - 0.5) * 0.02;
      const velocity = 0.6 + Math.random() * 0.4;

      this.playMelody(time + timeOffset, freq, this.beatDuration * 0.7, velocity);
    }

    // ── Hi-hat rhythm — every beat with accents
    this.playHihat(time, this.beatInChord % 2 === 0 ? 0.3 : 0.15);

    // ── Snare-like hit on beats 2 and 6
    if (this.beatInChord === 2 || this.beatInChord === 6) {
      this.playSnare(time + 0.001);
    }
  }

  private playPad(time: number, freqs: NoteFreq[], duration: number): void {
    if (!this.ctx || !this.masterGain) return;

    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.value = freq;
      // Slight detune for warmth
      osc.detune.value = (Math.random() - 0.5) * 8;

      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 1;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.3);
      gain.gain.setValueAtTime(0.08, time + duration - 0.5);
      gain.gain.linearRampToValueAtTime(0, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration + 0.1);

      this.trackNode(osc);
    }
  }

  private playBass(time: number, freq: NoteFreq, duration: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.1);

    this.trackNode(osc);
  }

  private playMelody(time: number, freq: NoteFreq, duration: number, velocity: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Alternate between square and triangle for variety
    osc.type = Math.random() > 0.3 ? 'square' : 'triangle';
    osc.frequency.value = freq;

    // Slight pitch slide for expressiveness
    osc.frequency.setValueAtTime(freq * 0.98, time);
    osc.frequency.linearRampToValueAtTime(freq, time + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + duration);
    filter.Q.value = 3;

    const vol = 0.12 * velocity;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.02);
    gain.gain.setValueAtTime(vol * 0.7, time + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.1);

    this.trackNode(osc);
  }

  private playHihat(time: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Noise-based hi-hat using multiple high-frequency oscillators
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 8000;

    gain.gain.setValueAtTime(volume * 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    // Create noise-like sound with detuned oscillators
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 6000 + Math.random() * 4000;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 0.08);
      this.trackNode(osc);
    }

    filter.connect(gain);
    gain.connect(this.masterGain);
  }

  private playSnare(time: number): void {
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 200 + Math.random() * 8000;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 0.15);
      this.trackNode(osc);
    }

    // Tonal body
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(180, time);
    body.frequency.exponentialRampToValueAtTime(80, time + 0.05);
    bodyGain.gain.setValueAtTime(0.1, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    body.start(time);
    body.stop(time + 0.1);
    this.trackNode(body);

    filter.connect(gain);
    gain.connect(this.masterGain);
  }

  private trackNode(node: OscillatorNode): void {
    this.activeNodes.add(node);
    node.onended = () => this.activeNodes.delete(node);
  }
}

// Singleton
export const musicGenerator = new MusicGenerator();
