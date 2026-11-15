import { useState } from 'react';
import { MissionReport } from './screens/end/MissionReport';
import { RoundScreen } from './screens/round/RoundScreen';
import { TitleScreen } from './screens/title/TitleScreen';
import { useGameStore } from './store/gameStore';
import { ScienceLibraryModal } from './ui/ScienceLibraryModal';

export function App() {
  const screen = useGameStore(state => state.screen);
  const [scienceLibraryOpen, setScienceLibraryOpen] = useState(false);

  return (
    <>
      {screen === 'title' ? (
        <TitleScreen onOpenLibrary={() => setScienceLibraryOpen(true)} />
      ) : screen === 'playing' ? (
        <RoundScreen onOpenLibrary={() => setScienceLibraryOpen(true)} />
      ) : (
        <MissionReport onOpenLibrary={() => setScienceLibraryOpen(true)} />
      )}
      {scienceLibraryOpen && (
        <ScienceLibraryModal onClose={() => setScienceLibraryOpen(false)} />
      )}
    </>
  );
}

export default App;
