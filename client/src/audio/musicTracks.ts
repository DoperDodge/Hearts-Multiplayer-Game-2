// ============================================================
// PIXEL HEARTS — Music Track Definitions
// Add new .mp3 files to client/public/music/ and register them here.
// ============================================================

export interface MusicTrack {
  id: string;
  name: string;
  /** null means procedural (MusicGenerator), otherwise path to .mp3 in public/ */
  file: string | null;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'main-theme', name: 'Main Theme (Chiptune)', file: null },
  // To add a new track, place the .mp3 in client/public/music/ and add an entry:
  // { id: 'chill-vibes', name: 'Chill Vibes', file: '/music/chill-vibes.mp3' },
];

export function getTrackById(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find(t => t.id === id);
}
