import React, { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { TitleScreen } from './screens/title/TitleScreen';
import { RoundScreen } from './screens/round/RoundScreen';
import { MissionReport } from './screens/end/MissionReport';
import { ScienceLibraryModal } from './ui/ScienceLibraryModal';

export default function App() {
  const screen = useGameStore(s => s.screen);
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#070b14]">
      {screen === 'title' && (
        <TitleScreen onOpenLibrary={() => setLibraryOpen(true)} />
      )}
      {screen === 'playing' && (
        <RoundScreen onOpenLibrary={() => setLibraryOpen(true)} />
      )}
      {screen === 'end' && (
        <MissionReport onOpenLibrary={() => setLibraryOpen(true)} />
      )}

      <ScienceLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
      />
    </main>
  );
}