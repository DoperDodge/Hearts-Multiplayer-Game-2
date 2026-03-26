import React, { useState } from 'react';
import { Trick, SUIT_SYMBOL, RANK_SHORT } from '@shared/game-types';
import { PlayerData } from '../../store/gameStore';

export function TrickHistory({ tricks, players }: { tricks: Trick[]; players: PlayerData[] }) {
  const [expanded, setExpanded] = useState(false);

  if (tricks.length === 0) return null;

  const getName = (id: string) => players.find(p => p.id === id)?.name || '?';

  return (
    <div className="absolute top-[40px] right-2 z-20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="font-pixel text-[7px] text-pixel-muted bg-pixel-surface/80 border-2 border-pixel-panel px-2 py-1 hover:text-pixel-gold hover:border-pixel-gold transition-all"
      >
        📜 {tricks.length} {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="mt-1 bg-pixel-surface/95 border-2 border-pixel-panel p-2 max-h-[300px] overflow-y-auto w-[200px] animate-fade-in">
          {[...tricks].reverse().map((trick, idx) => (
            <div key={idx} className="mb-2 pb-2 border-b border-pixel-bg last:border-0">
              <div className="font-pixel text-[6px] text-pixel-gold mb-1">
                Trick {tricks.length - idx} → {getName(trick.winnerId || '')}
              </div>
              <div className="flex flex-wrap gap-1">
                {trick.cards.map((tc, ci) => (
                  <span key={ci} className="font-pixel text-[7px]" style={{
                    color: tc.card.suit === 'HEARTS' || tc.card.suit === 'DIAMONDS' ? 'var(--color-hearts)' : 'var(--color-text)'
                  }}>
                    {RANK_SHORT[tc.card.rank]}{SUIT_SYMBOL[tc.card.suit]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
