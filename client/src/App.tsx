// ============================================================
// PIXEL HEARTS — App (Screen Router + Settings Applier)
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { MainMenu } from './components/menus/MainMenu';
import { UsernameInput } from './components/menus/UsernameInput';
import { ModeSelect } from './components/menus/ModeSelect';
import { SoloConfig } from './components/menus/SoloConfig';
import { SettingsPanel } from './components/menus/SettingsPanel';
import { HowToPlay } from './components/menus/HowToPlay';
import { MultiplayerLobby } from './components/menus/MultiplayerLobby';
import { GameView } from './components/game/GameView';
import { ToastContainer } from './components/shared/Toast';
import { useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { useMultiplayerGame } from './hooks/useMultiplayerGame';
import { audioManager } from './audio/AudioManager';
import { BotDifficulty } from '@shared/game-types';

type Screen = 'mainMenu' | 'username' | 'modeSelect' | 'soloConfig' | 'multiplayer' | 'settings' | 'howToPlay' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('mainMenu');
  const { playerName } = useSettingsStore();
  const { startSoloGame, reset } = useGameStore();

  // Apply accessibility body classes when settings change
  const { colorBlindMode, highContrast, largeText, particleEffects } = useSettingsStore();

  useEffect(() => {
    const body = document.body;
    body.classList.toggle('color-blind', colorBlindMode);
    body.classList.toggle('high-contrast', highContrast);
    body.classList.toggle('large-text', largeText);
    body.classList.toggle('no-particles', !particleEffects);
  }, [colorBlindMode, highContrast, largeText, particleEffects]);

  // Initialize audio system on first user interaction
  const [audioInited, setAudioInited] = useState(false);
  useEffect(() => {
    const initAudio = () => {
      if (!audioInited) {
        audioManager.init();
        setAudioInited(true);
      }
    };
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, [audioInited]);

  useMultiplayerGame();

  const handlePlay = useCallback(() => {
    setScreen(playerName ? 'modeSelect' : 'username');
  }, [playerName]);

  const handleSoloStart = useCallback((difficulty: BotDifficulty, settings: any) => {
    startSoloGame(difficulty, settings);
    setScreen('game');
  }, [startSoloGame]);

  const handleMainMenu = useCallback(() => {
    reset();
    setScreen('mainMenu');
  }, [reset]);

  const renderScreen = () => {
    switch (screen) {
      case 'mainMenu':
        return <MainMenu onPlay={handlePlay} onSettings={() => setScreen('settings')} onHowToPlay={() => setScreen('howToPlay')} />;
      case 'username':
        return <UsernameInput onContinue={() => setScreen('modeSelect')} onBack={() => setScreen('mainMenu')} />;
      case 'modeSelect':
        return <ModeSelect onSolo={() => setScreen('soloConfig')} onMultiplayer={() => setScreen('multiplayer')} onBack={() => setScreen('mainMenu')} />;
      case 'soloConfig':
        return <SoloConfig onStart={handleSoloStart} onBack={() => setScreen('modeSelect')} />;
      case 'multiplayer':
        return <MultiplayerLobby onBack={() => setScreen('modeSelect')} onGameStart={() => setScreen('game')} />;
      case 'settings':
        return <SettingsPanel onBack={() => setScreen('mainMenu')} />;
      case 'howToPlay':
        return <HowToPlay onBack={() => setScreen('mainMenu')} />;
      case 'game':
        return <GameView onMainMenu={handleMainMenu} />;
      default:
        return <MainMenu onPlay={handlePlay} onSettings={() => setScreen('settings')} onHowToPlay={() => setScreen('howToPlay')} />;
    }
  };

  return (
    <div className="w-full h-full bg-pixel-bg">
      {renderScreen()}
      <ToastContainer />

      {/* Persistent music toggle — always visible */}
      <button
        className={`music-toggle ${audioManager.isMusicPlaying ? 'playing' : ''}`}
        onClick={() => {
          audioManager.init();
          audioManager.toggleMusic();
        }}
        title={audioManager.isMusicPlaying ? 'Pause Music' : 'Play Music'}
      >
        {audioManager.isMusicPlaying ? '♪' : '♪'}
      </button>
    </div>
  );
}
