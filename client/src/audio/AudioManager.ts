// ============================================================
// PIXEL HEARTS — Audio Manager
// Bridges settings store ↔ music generator + SFX player
// ============================================================

import { musicGenerator } from './MusicGenerator';
import { sfx, SFXName } from './SoundEffects';
import { useSettingsStore } from '../store/settingsStore';

class AudioManager {
  private initialized = false;
  private musicStarted = false;

  /**
   * Initialize audio on first user interaction (required by browsers).
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.syncFromStore();

    // Subscribe to setting changes
    useSettingsStore.subscribe((state, prev) => {
      if (
        state.masterVolume !== prev.masterVolume ||
        state.musicVolume !== prev.musicVolume ||
        state.sfxVolume !== prev.sfxVolume ||
        state.muted !== prev.muted
      ) {
        this.syncFromStore();
      }
    });
  }

  private syncFromStore(): void {
    const { masterVolume, musicVolume, sfxVolume, muted } = useSettingsStore.getState();

    if (muted) {
      musicGenerator.volume = 0;
      sfx.muted = true;
    } else {
      musicGenerator.volume = masterVolume * musicVolume;
      sfx.volume = masterVolume * sfxVolume;
      sfx.muted = false;
    }
  }

  /**
   * Start background music.
   */
  startMusic(): void {
    if (this.musicStarted) return;
    const { muted } = useSettingsStore.getState();
    if (muted) return;
    this.musicStarted = true;
    musicGenerator.start();
  }

  /**
   * Stop background music.
   */
  stopMusic(): void {
    this.musicStarted = false;
    musicGenerator.stop();
  }

  /**
   * Toggle music on/off.
   */
  toggleMusic(): void {
    if (this.musicStarted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  get isMusicPlaying(): boolean {
    return this.musicStarted;
  }

  /**
   * Play a sound effect.
   */
  playSFX(name: SFXName): void {
    sfx.play(name);
  }
}

export const audioManager = new AudioManager();
