// ============================================================
// PIXEL HEARTS — Audio Manager
// Bridges settings store ↔ music generator + MP3 player + SFX
// ============================================================

import { musicGenerator } from './MusicGenerator';
import { musicPlayer } from './MusicPlayer';
import { sfx, SFXName } from './SoundEffects';
import { useSettingsStore } from '../store/settingsStore';
import { getTrackById } from './musicTracks';

class AudioManager {
  private initialized = false;
  private musicStarted = false;
  private currentTrackId: string | null = null;

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
      if (state.musicTrack !== prev.musicTrack) {
        this.switchTrack(state.musicTrack);
      }
    });
  }

  private syncFromStore(): void {
    const { masterVolume, musicVolume, sfxVolume, muted } = useSettingsStore.getState();

    if (muted) {
      musicGenerator.volume = 0;
      musicPlayer.volume = 0;
      sfx.muted = true;
    } else {
      musicGenerator.volume = masterVolume * musicVolume;
      musicPlayer.volume = masterVolume * musicVolume;
      sfx.volume = masterVolume * sfxVolume;
      sfx.muted = false;
    }
  }

  private switchTrack(trackId: string): void {
    if (!this.musicStarted) {
      this.currentTrackId = trackId;
      return;
    }

    // Stop whichever is currently playing
    musicGenerator.stop();
    musicPlayer.stop();

    const track = getTrackById(trackId);
    this.currentTrackId = trackId;

    if (!track || track.file === null) {
      // Procedural music
      musicGenerator.start();
    } else {
      musicPlayer.play(track.file);
    }
  }

  /**
   * Start background music.
   */
  startMusic(): void {
    if (this.musicStarted) return;
    const { muted, musicTrack } = useSettingsStore.getState();
    if (muted) return;
    this.musicStarted = true;
    this.currentTrackId = musicTrack;

    const track = getTrackById(musicTrack);
    if (!track || track.file === null) {
      musicGenerator.start();
    } else {
      musicPlayer.play(track.file);
    }
  }

  /**
   * Stop background music.
   */
  stopMusic(): void {
    this.musicStarted = false;
    musicGenerator.stop();
    musicPlayer.stop();
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
