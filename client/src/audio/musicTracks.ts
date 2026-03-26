// ============================================================
// PIXEL HEARTS — Music Track Definitions
// Auto-detects .mp3 files from client/public/music/ at build time.
// Just drop new .mp3 files in that folder — no manual editing needed.
// ============================================================

export interface MusicTrack {
  id: string;
  name: string;
  /** null means procedural (MusicGenerator), otherwise path to .mp3 in public/ */
  file: string | null;
}

// Auto-discover .mp3 files from public/music/ at build time via Vite's import.meta.glob
const musicFiles = import.meta.glob('/public/music/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Build track list: Main Theme first, then all discovered .mp3 files
const fileEntries: MusicTrack[] = Object.entries(musicFiles).map(([path, url]) => {
  // Extract filename without extension for display name
  const filename = path.split('/').pop()?.replace(/\.mp3$/, '') || 'Unknown';
  const id = filename.toLowerCase().replace(/\s+/g, '-');
  return { id, name: filename, file: url };
});

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'main-theme', name: 'Main Theme (Chiptune)', file: null },
  ...fileEntries,
];

export function getTrackById(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find(t => t.id === id);
}
