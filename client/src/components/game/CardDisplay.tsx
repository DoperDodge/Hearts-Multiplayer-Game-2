import React from 'react';
import { Card, Suit, SUIT_SYMBOL, RANK_SHORT } from '@shared/game-types';
import { useSettingsStore } from '../../store/settingsStore';

interface CardDisplayProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  small?: boolean;
  onClick?: () => void;
  className?: string;
}

const SUIT_COLORS: Record<Suit, string> = {
  [Suit.HEARTS]: '#e94560', [Suit.DIAMONDS]: '#e94560',
  [Suit.CLUBS]: '#2d2d3d', [Suit.SPADES]: '#2d2d3d',
};

const CB_SUIT_COLORS: Record<Suit, string> = {
  [Suit.HEARTS]: '#d55e00', [Suit.DIAMONDS]: '#009e73',
  [Suit.CLUBS]: '#0072b2', [Suit.SPADES]: '#cc79a7',
};

// Extra shape markers for color-blind mode
const CB_SUIT_MARKERS: Record<Suit, string> = {
  [Suit.HEARTS]: 'H', [Suit.DIAMONDS]: 'D',
  [Suit.CLUBS]: 'C', [Suit.SPADES]: 'S',
};

export function CardDisplay({ card, faceDown = false, selected = false, disabled = false, highlighted = false, small = false, onClick, className = '' }: CardDisplayProps) {
  const { colorBlindMode, cardSize: sizeSetting } = useSettingsStore();

  // Determine actual size: use small prop override, or settings-based
  const effectiveSmall = small || sizeSetting === 'small';
  const effectiveLarge = !small && sizeSetting === 'large';

  const w = effectiveSmall ? 'w-[50px]' : effectiveLarge ? 'w-[90px]' : 'w-[70px]';
  const h = effectiveSmall ? 'h-[72px]' : effectiveLarge ? 'h-[130px]' : 'h-[100px]';
  const fontSize = effectiveSmall ? 'text-[10px]' : effectiveLarge ? 'text-[18px]' : 'text-[14px]';
  const suitSize = effectiveSmall ? 'text-[16px]' : effectiveLarge ? 'text-[28px]' : 'text-[22px]';

  if (faceDown || !card) {
    return (
      <div className={`${w} ${h} rounded border-2 border-pixel-panel flex items-center justify-center bg-gradient-to-br from-pixel-panel to-[#0a2540] ${className}`}>
        <div className="w-[80%] h-[80%] rounded-sm opacity-30" style={{ background: 'repeating-conic-gradient(var(--color-accent) 0% 25%, transparent 0% 50%) 50% / 10px 10px' }} />
      </div>
    );
  }

  const suitColor = colorBlindMode ? CB_SUIT_COLORS[card.suit] : SUIT_COLORS[card.suit];
  const suitSymbol = SUIT_SYMBOL[card.suit];
  const rankStr = RANK_SHORT[card.rank];
  const cbMarker = colorBlindMode ? CB_SUIT_MARKERS[card.suit] : '';

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`card-display ${w} ${h} rounded border-2 flex flex-col items-center justify-between p-1
        font-pixel transition-all duration-150 select-none relative
        ${disabled ? 'opacity-40 cursor-not-allowed border-gray-400' : 'cursor-pointer border-[#bbb]'}
        ${selected ? 'translate-y-[-16px] shadow-[0_0_0_3px_var(--color-gold)] z-20' : ''}
        ${highlighted ? 'shadow-[0_0_12px_var(--color-gold)]' : ''}
        ${!disabled && !selected ? 'hover:translate-y-[-8px] hover:shadow-lg hover:z-10' : ''}
        ${className}`}
      style={{ backgroundColor: '#f5f0e8', background: 'linear-gradient(135deg, #faf7f0, #f0ebe0)', color: suitColor }}
    >
      <div className="self-start leading-tight">
        <div className={`${fontSize} font-bold`}>{rankStr}</div>
        <div className={effectiveSmall ? 'text-[10px]' : 'text-[12px]'} style={{ marginTop: '-2px' }}>
          {suitSymbol}{cbMarker && <span className="text-[8px] ml-0.5">{cbMarker}</span>}
        </div>
      </div>
      <div className={`${suitSize} leading-none`}>{suitSymbol}</div>
      <div className="self-end leading-tight rotate-180">
        <div className={`${fontSize} font-bold`}>{rankStr}</div>
        <div className={effectiveSmall ? 'text-[10px]' : 'text-[12px]'} style={{ marginTop: '-2px' }}>
          {suitSymbol}{cbMarker && <span className="text-[8px] ml-0.5">{cbMarker}</span>}
        </div>
      </div>
    </div>
  );
}
