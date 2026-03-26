import React from 'react';

export function PixelPanel({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={`pixel-panel ${className}`}>
      {title && <div className="text-[10px] text-pixel-gold font-pixel mb-3 uppercase tracking-wider">{title}</div>}
      {children}
    </div>
  );
}
