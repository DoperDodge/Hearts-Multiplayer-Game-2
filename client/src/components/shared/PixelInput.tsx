import React from 'react';
export function PixelInput({ value, onChange, placeholder, maxLength, className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; className?: string }) {
  return <input className={`pixel-input ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} spellCheck={false} autoComplete="off" />;
}
