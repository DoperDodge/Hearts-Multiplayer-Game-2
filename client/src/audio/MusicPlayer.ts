// ============================================================
// PIXEL HEARTS — MP3 Music Player
// Plays .mp3 files from the public/music/ folder with looping
// ============================================================

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private _volume = 0.5;
  private currentSrc: string | null = null;

  get volume(): number { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.audio) {
      this.audio.volume = this._volume;
    }
  }

  get isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused;
  }

  play(src: string): void {
    // If already playing this track, do nothing
    if (this.audio && this.currentSrc === src && !this.audio.paused) return;

    this.stop();
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.volume = this._volume;
    this.currentSrc = src;
    this.audio.play().catch(() => {
      // Browser may block autoplay; will retry on next user interaction
    });
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
      this.currentSrc = null;
    }
  }
}

export const musicPlayer = new MusicPlayer();
