import React, { useState, useEffect } from 'react';
import { PixelButton } from '../shared/PixelButton';
import { PixelPanel } from '../shared/PixelPanel';
import { PixelInput } from '../shared/PixelInput';
import { useLobbyStore } from '../../store/lobbyStore';
import { wsClient } from '../../network/WebSocketClient';
import { BotDifficulty, MoonScoringVariant, GameSettings } from '@shared/game-types';
import { DEFAULT_SCORE_LIMIT } from '@shared/constants';
import { useSettingsStore } from '../../store/settingsStore';
import { audioManager } from '../../audio/AudioManager';

const defaultGameSettings: GameSettings = {
  scoreLimit: DEFAULT_SCORE_LIMIT, jackOfDiamonds: false, moonScoringVariant: MoonScoringVariant.ADD_TO_OTHERS,
  noPointsOnFirstTrick: false, queenBreaksHearts: true, botDifficulty: BotDifficulty.MEDIUM,
  turnTimeout: 60000, animationSpeed: 'normal',
  tenOfClubs: false, bloodHearts: false, noPassing: false, queenFrenzy: false, krakenKing: false,
  blindPass: false, mustBleed: false, reverseTrickWin: false, heartsAlwaysLead: false, doubleTrouble: false,
};

function GameSettingsPanel({ settings, onChange, readOnly }: { settings: GameSettings; onChange: (s: GameSettings) => void; readOnly?: boolean }) {
  const scoreLimits = [50, 75, 100, 150, 200];
  const toggle = (key: keyof GameSettings) => {
    if (readOnly) return;
    onChange({ ...settings, [key]: !settings[key] });
  };

  const variants: { key: keyof GameSettings; label: string; desc: string; color: string }[] = [
    { key: 'jackOfDiamonds', label: '♦J = −10 pts', desc: 'Jack of Diamonds', color: 'text-pixel-gold' },
    { key: 'tenOfClubs', label: '♣10 = +10 pts', desc: 'Ten of Clubs Bomb', color: 'text-pixel-green' },
    { key: 'bloodHearts', label: '♥ = 2 pts each', desc: 'Blood Hearts', color: 'text-pixel-accent' },
    { key: 'noPassing', label: 'No Passing', desc: 'Skip all pass phases', color: 'text-pixel-muted' },
    { key: 'queenFrenzy', label: 'Queens = +6 pts', desc: 'Queen Frenzy', color: 'text-purple-400' },
    { key: 'krakenKing', label: '♠K = +17 pts', desc: 'Kraken King', color: 'text-red-400' },
  ];

  const modifiers: { key: keyof GameSettings; label: string; desc: string; color: string }[] = [
    { key: 'blindPass', label: 'Blind Pass', desc: 'Cards auto-picked', color: 'text-blue-400' },
    { key: 'mustBleed', label: 'Must Bleed', desc: 'Void? Dump penalties', color: 'text-pixel-accent' },
    { key: 'reverseTrickWin', label: 'Reverse Win', desc: 'Low card wins', color: 'text-yellow-400' },
    { key: 'heartsAlwaysLead', label: 'Free Lead', desc: 'Lead hearts anytime', color: 'text-pink-400' },
    { key: 'doubleTrouble', label: 'Double Trouble', desc: 'Even tricks ×2', color: 'text-orange-400' },
  ];

  const handlePartyMode = () => {
    if (readOnly) return;
    onChange({ ...settings, jackOfDiamonds: true, tenOfClubs: true, bloodHearts: true, noPassing: true, queenFrenzy: true, krakenKing: true, blindPass: true, mustBleed: true, reverseTrickWin: true, heartsAlwaysLead: true, doubleTrouble: true, scoreLimit: 200 });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[7px] font-pixel text-pixel-muted mb-1 uppercase">Score Limit</label>
        <div className="flex gap-1 flex-wrap">
          {scoreLimits.map(limit => (
            <button key={limit} onClick={() => !readOnly && onChange({ ...settings, scoreLimit: limit })}
              className={`font-pixel text-[7px] px-2 py-1 border-2 transition-all ${settings.scoreLimit === limit ? 'border-pixel-gold text-pixel-gold bg-pixel-panel' : 'border-pixel-panel text-pixel-muted hover:border-pixel-muted'} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
              {limit}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[7px] font-pixel text-pixel-muted mb-1 uppercase">Variants</label>
        <div className="flex flex-col gap-0.5">
          {variants.map(v => (
            <label key={v.key} className={`flex items-center gap-2 py-0.5 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={!!settings[v.key]} onChange={() => toggle(v.key)} disabled={readOnly} className="w-3 h-3 accent-pixel-gold" />
              <div>
                <span className={`font-pixel text-[7px] ${settings[v.key] ? v.color : 'text-pixel-text'}`}>{v.label}</span>
                <span className="font-pixel text-[5px] text-pixel-muted ml-1">{v.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[7px] font-pixel text-pixel-muted mb-1 uppercase">Game Modifiers</label>
        <div className="flex flex-col gap-0.5">
          {modifiers.map(v => (
            <label key={v.key} className={`flex items-center gap-2 py-0.5 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={!!settings[v.key]} onChange={() => toggle(v.key)} disabled={readOnly} className="w-3 h-3 accent-pixel-gold" />
              <div>
                <span className={`font-pixel text-[7px] ${settings[v.key] ? v.color : 'text-pixel-text'}`}>{v.label}</span>
                <span className="font-pixel text-[5px] text-pixel-muted ml-1">{v.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[7px] font-pixel text-pixel-muted mb-1 uppercase">Moon Scoring</label>
        <div className="flex gap-1 flex-wrap">
          {([
            { v: MoonScoringVariant.ADD_TO_OTHERS, l: '+26 Others' },
            { v: MoonScoringVariant.SUBTRACT_FROM_SELF, l: '-26 Self' },
          ] as const).map(opt => (
            <button key={opt.v} onClick={() => !readOnly && onChange({ ...settings, moonScoringVariant: opt.v })}
              className={`font-pixel text-[6px] px-2 py-1 border-2 ${settings.moonScoringVariant === opt.v ? 'border-pixel-gold text-pixel-gold' : 'border-pixel-panel text-pixel-muted'} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>
      {!readOnly && (
        <div className="flex gap-1">
          <PixelButton variant="gold" size="sm" onClick={handlePartyMode}>PARTY MODE</PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => onChange({ ...defaultGameSettings })}>RESET</PixelButton>
        </div>
      )}
    </div>
  );
}

export function MultiplayerLobby({ onBack, onGameStart }: { onBack: () => void; onGameStart: () => void }) {
  const { connected, rooms, currentRoomId, currentRoomPlayers, currentRoomSettings, hostId, myPlayerId, chatMessages } = useLobbyStore();
  const { playerName, playerAvatar } = useSettingsStore();
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [chatText, setChatText] = useState('');
  const [createSettings, setCreateSettings] = useState<GameSettings>({ ...defaultGameSettings });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!wsClient.isConnected()) wsClient.connect();
    const unsubs = [
      wsClient.on('LOBBY_STATE', (msg: any) => useLobbyStore.getState().setRooms(msg.rooms)),
      wsClient.on('ROOM_JOINED', (msg: any) => { useLobbyStore.getState().joinRoom(msg.roomId, msg.players, msg.settings, msg.yourPlayerId); audioManager.playSFX('player_join'); }),
      wsClient.on('ROOM_UPDATED', (msg: any) => useLobbyStore.getState().updateRoom(msg.players, msg.hostId)),
      wsClient.on('ROOM_SETTINGS_UPDATED', (msg: any) => useLobbyStore.getState().updateSettings(msg.settings)),
      wsClient.on('GAME_STARTED', () => onGameStart()),
      wsClient.on('CHAT_BROADCAST', (msg: any) => { useLobbyStore.getState().addChatMessage(msg); audioManager.playSFX('chat_message'); }),
    ];
    const unsubC = wsClient.onConnect(() => { useLobbyStore.getState().setConnected(true); wsClient.send({ type: 'SET_PLAYER_INFO', name: playerName || 'Player', avatar: playerAvatar }); wsClient.send({ type: 'JOIN_LOBBY' }); });
    const unsubD = wsClient.onDisconnect(() => useLobbyStore.getState().setConnected(false));
    if (wsClient.isConnected()) { useLobbyStore.getState().setConnected(true); wsClient.send({ type: 'SET_PLAYER_INFO', name: playerName || 'Player', avatar: playerAvatar }); wsClient.send({ type: 'JOIN_LOBBY' }); }
    return () => { unsubs.forEach(u => u()); unsubC(); unsubD(); };
  }, []);

  const handleCreateRoom = () => {
    wsClient.send({ type: 'CREATE_ROOM', roomName: roomName || `${playerName}'s Room`, password: password || undefined,
      settings: createSettings,
      botBackfill: true });
    setShowCreate(false);
    setCreateSettings({ ...defaultGameSettings });
  };

  const handleSettingsChange = (newSettings: GameSettings) => {
    if (hostId === myPlayerId && currentRoomSettings) {
      wsClient.send({ type: 'UPDATE_ROOM_SETTINGS', settings: newSettings });
    }
  };

  if (currentRoomId) {
    const isHost = hostId === myPlayerId;
    const allReady = currentRoomPlayers.filter(p => !p.isBot).every(p => p.isReady);
    const me = currentRoomPlayers.find(p => p.id === myPlayerId);
    const roomSettings = currentRoomSettings || defaultGameSettings;

    const activeVariants: string[] = [];
    if (roomSettings.jackOfDiamonds) activeVariants.push('♦J−10');
    if (roomSettings.tenOfClubs) activeVariants.push('♣10+10');
    if (roomSettings.bloodHearts) activeVariants.push('♥×2');
    if (roomSettings.noPassing) activeVariants.push('No Pass');
    if (roomSettings.queenFrenzy) activeVariants.push('Q+6');
    if (roomSettings.krakenKing) activeVariants.push('♠K+17');
    if (roomSettings.blindPass) activeVariants.push('Blind');
    if (roomSettings.mustBleed) activeVariants.push('Bleed');
    if (roomSettings.reverseTrickWin) activeVariants.push('Rev');
    if (roomSettings.heartsAlwaysLead) activeVariants.push('Free♥');
    if (roomSettings.doubleTrouble) activeVariants.push('×2');

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
        <PixelPanel className="w-full max-w-[500px]" title="Game Room">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[0,1,2,3].map(i => { const player = currentRoomPlayers[i]; return (
              <div key={i} className={`pixel-panel border-2 px-3 py-2 flex items-center gap-2 ${player ? (player.isReady ? 'border-pixel-green' : 'border-pixel-panel') : 'border-pixel-bg opacity-50'}`}>
                {player ? (<><span className="text-[14px]">{player.isBot ? '🤖' : '👤'}</span><div><div className="font-pixel text-[8px] text-pixel-text truncate max-w-[100px]">{player.name}{player.isHost && ' 👑'}</div><div className={`font-pixel text-[7px] ${player.isReady ? 'text-pixel-green' : 'text-pixel-muted'}`}>{player.isReady ? 'Ready' : 'Not Ready'}</div></div></>) : (<span className="font-pixel text-[8px] text-pixel-muted animate-pulse-slow">Waiting...</span>)}
              </div>); })}
          </div>

          {/* Settings summary / editor */}
          <div className="mb-3 pixel-panel border-2 border-pixel-panel px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-pixel text-[7px] text-pixel-muted uppercase">Game Settings</span>
              <div className="flex gap-1 items-center">
                <span className="font-pixel text-[6px] text-pixel-gold">Score: {roomSettings.scoreLimit}</span>
                {isHost && (
                  <button onClick={() => setShowSettings(!showSettings)}
                    className="font-pixel text-[6px] text-pixel-gold border border-pixel-gold px-1 hover:bg-pixel-panel">
                    {showSettings ? 'HIDE' : 'EDIT'}
                  </button>
                )}
              </div>
            </div>
            {activeVariants.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {activeVariants.map(v => (
                  <span key={v} className="font-pixel text-[6px] bg-pixel-bg text-pixel-accent px-1 py-0.5 border border-pixel-panel">{v}</span>
                ))}
              </div>
            ) : (
              <span className="font-pixel text-[6px] text-pixel-muted">Standard rules</span>
            )}
            {showSettings && isHost && (
              <div className="mt-2 pt-2 border-t border-pixel-panel">
                <GameSettingsPanel settings={roomSettings} onChange={handleSettingsChange} />
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="bg-pixel-bg border-2 border-pixel-panel h-[80px] overflow-y-auto p-2 mb-2">
              {chatMessages.map((msg, i) => (<div key={i} className="font-pixel text-[6px] mb-1"><span className="text-pixel-gold">{msg.fromName}: </span><span className="text-pixel-text">{msg.text}</span></div>))}
            </div>
            <div className="flex gap-2">
              <PixelInput value={chatText} onChange={setChatText} placeholder="Chat..." className="flex-1" />
              <PixelButton variant="secondary" size="sm" onClick={() => { if (chatText.trim()) { wsClient.send({ type: 'CHAT_MESSAGE', text: chatText.trim() }); setChatText(''); } }}>SEND</PixelButton>
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            <PixelButton variant="secondary" size="sm" onClick={() => { wsClient.send({ type: 'LEAVE_ROOM' }); useLobbyStore.getState().leaveRoom(); audioManager.playSFX('player_leave'); }}>LEAVE</PixelButton>
            <div className="flex gap-2">
              <PixelButton variant={me?.isReady ? 'green' : 'secondary'} size="sm" onClick={() => wsClient.send({ type: 'SET_READY', ready: !me?.isReady })}>{me?.isReady ? '✓ READY' : 'READY UP'}</PixelButton>
              {isHost && <PixelButton variant="primary" size="sm" onClick={() => wsClient.send({ type: 'START_GAME' })} disabled={!allReady}>START</PixelButton>}
            </div>
          </div>
        </PixelPanel>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-pixel-green' : 'bg-pixel-accent'}`} />
        <span className="font-pixel text-[7px] text-pixel-muted">{connected ? 'Connected' : 'Connecting...'}</span>
      </div>
      <PixelPanel className="w-full max-w-[500px]" title="Multiplayer Lobby">
        {showCreate ? (
          <div className="mb-4">
            <div className="flex flex-col gap-2 mb-3">
              <PixelInput value={roomName} onChange={setRoomName} placeholder="Room name..." />
              <PixelInput value={password} onChange={setPassword} placeholder="Password (optional)" />
            </div>
            <div className="mb-3 pixel-panel border-2 border-pixel-panel px-3 py-2">
              <label className="block text-[7px] font-pixel text-pixel-muted mb-2 uppercase">Game Settings</label>
              <GameSettingsPanel settings={createSettings} onChange={setCreateSettings} />
            </div>
            <div className="flex gap-2">
              <PixelButton variant="secondary" size="sm" onClick={() => { setShowCreate(false); setCreateSettings({ ...defaultGameSettings }); }}>CANCEL</PixelButton>
              <PixelButton variant="gold" size="sm" onClick={handleCreateRoom}>CREATE</PixelButton>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mb-4"><PixelButton variant="gold" size="sm" onClick={() => setShowCreate(true)}>+ CREATE ROOM</PixelButton></div>
        )}
        <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2">
          {rooms.length === 0 ? (
            <div className="font-pixel text-[8px] text-pixel-muted text-center py-6">No rooms available. Create one!</div>
          ) : rooms.map(room => (
            <div key={room.id} className="pixel-panel flex items-center justify-between px-3 py-2 border-2 border-pixel-bg">
              <div>
                <div className="font-pixel text-[8px] text-pixel-text">{room.name}</div>
                <div className="font-pixel text-[7px] text-pixel-muted">{room.playerCount}/{room.maxPlayers} players{room.hasPassword ? ' 🔒' : ''}{room.status !== 'WAITING' ? ` (${room.status})` : ''}</div>
              </div>
              <PixelButton variant="green" size="sm" onClick={() => wsClient.send({ type: 'JOIN_ROOM', roomId: room.id })} disabled={room.playerCount >= room.maxPlayers || room.status !== 'WAITING'}>JOIN</PixelButton>
            </div>
          ))}
        </div>
      </PixelPanel>
      <PixelButton variant="secondary" size="sm" onClick={onBack}>← BACK</PixelButton>
    </div>
  );
}
