// ============================================================
// PIXEL HEARTS — Settings Store (all settings functional)
// ============================================================

import { create } from 'zustand';

export type AnimationSpeed = 'slow' | 'normal' | 'fast' | 'instant';

/** Returns a multiplier for animation/delay durations based on speed setting */
export function getSpeedMultiplier(speed: AnimationSpeed): number {
  switch (speed) {
    case 'slow': return 2.0;
    case 'normal': return 1.0;
    case 'fast': return 0.4;
    case 'instant': return 0.01;
  }
}

interface SettingsStore {
  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;

  // Gameplay
  animationSpeed: AnimationSpeed;
  autoSortHand: boolean;
  cardSize: 'small' | 'medium' | 'large';
  confirmPlay: boolean;

  // Display
  showTrickHistory: boolean;
  screenShake: boolean;
  particleEffects: boolean;

  // Accessibility
  colorBlindMode: boolean;
  highContrast: boolean;
  largeText: boolean;

  // Player info
  playerName: string;
  playerAvatar: number;

  // Computed
  getSpeedMultiplier: () => number;

  // Actions
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  toggleMute: (v?: boolean) => void;
  setAnimationSpeed: (s: AnimationSpeed) => void;
  setAutoSortHand: (v: boolean) => void;
  setCardSize: (s: 'small' | 'medium' | 'large') => void;
  setConfirmPlay: (v: boolean) => void;
  setShowTrickHistory: (v: boolean) => void;
  setScreenShake: (v: boolean) => void;
  setParticleEffects: (v: boolean) => void;
  setColorBlindMode: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setLargeText: (v: boolean) => void;
  setPlayerName: (n: string) => void;
  setPlayerAvatar: (a: number) => void;
}

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(`pixelhearts_${key}`); return v === null ? fallback : JSON.parse(v) as T; } catch { return fallback; }
}

function save(key: string, value: any): void {
  try { localStorage.setItem(`pixelhearts_${key}`, JSON.stringify(value)); } catch {}
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  masterVolume: load('masterVolume', 0.7),
  sfxVolume: load('sfxVolume', 0.8),
  musicVolume: load('musicVolume', 0.5),
  muted: load('muted', false),
  animationSpeed: load('animationSpeed', 'normal' as AnimationSpeed),
  autoSortHand: load('autoSortHand', true),
  cardSize: load('cardSize', 'medium'),
  confirmPlay: load('confirmPlay', false),
  showTrickHistory: load('showTrickHistory', true),
  screenShake: load('screenShake', true),
  particleEffects: load('particleEffects', true),
  colorBlindMode: load('colorBlindMode', false),
  highContrast: load('highContrast', false),
  largeText: load('largeText', false),
  playerName: load('name', ''),
  playerAvatar: load('avatar', 0),

  getSpeedMultiplier: () => getSpeedMultiplier(get().animationSpeed),

  setMasterVolume: (v) => { save('masterVolume', v); set({ masterVolume: v }); },
  setSfxVolume: (v) => { save('sfxVolume', v); set({ sfxVolume: v }); },
  setMusicVolume: (v) => { save('musicVolume', v); set({ musicVolume: v }); },
  toggleMute: (v) => set((s) => { const m = v !== undefined ? v : !s.muted; save('muted', m); return { muted: m }; }),
  setAnimationSpeed: (s) => { save('animationSpeed', s); set({ animationSpeed: s }); },
  setAutoSortHand: (v) => { save('autoSortHand', v); set({ autoSortHand: v }); },
  setCardSize: (s) => { save('cardSize', s); set({ cardSize: s }); },
  setConfirmPlay: (v) => { save('confirmPlay', v); set({ confirmPlay: v }); },
  setShowTrickHistory: (v) => { save('showTrickHistory', v); set({ showTrickHistory: v }); },
  setScreenShake: (v) => { save('screenShake', v); set({ screenShake: v }); },
  setParticleEffects: (v) => { save('particleEffects', v); set({ particleEffects: v }); },
  setColorBlindMode: (v) => { save('colorBlindMode', v); set({ colorBlindMode: v }); },
  setHighContrast: (v) => { save('highContrast', v); set({ highContrast: v }); },
  setLargeText: (v) => { save('largeText', v); set({ largeText: v }); },
  setPlayerName: (n) => { save('name', n); set({ playerName: n }); },
  setPlayerAvatar: (a) => { save('avatar', a); set({ playerAvatar: a }); },
}));
