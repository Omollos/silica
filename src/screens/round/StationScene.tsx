import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GameState, SkyState } from '../../types';
import { playClick } from '../../audio/sfx';
import { useSettingsStore } from '../../store/settingsStore';
import { CommandBay3D, InspectId } from '../../three/CommandBay3D';

interface StationSceneProps {
  gameState: GameState;
  sky: SkyState;
  lastChoiceId: string | null;
  currentEventType?: string;
  fullScreen?: boolean;
  rightPanelOpen?: boolean;
  showAllHud?: boolean;
  topHeader?: React.ReactNode;
  vitalsHud?: React.ReactNode;
  sidePanel?: React.ReactNode;
}

export const StationScene: React.FC<StationSceneProps> = ({
  gameState,
  sky,
  lastChoiceId,
  currentEventType,
  fullScreen = false,
  rightPanelOpen = false,
  showAllHud = true,
  topHeader,
  vitalsHud,
  sidePanel,
}) => {
  const [inspected, setInspected] = useState<InspectId | null>(null);
  const sfxEnabled = useSettingsStore(s => s.sfxEnabled);

  const {
    round,
    power,
    powerCap,
    oxygen,
    moonDirt,
    shield,
    sick,
    queue,
    trace,
    lastResults,
    status,
  } = gameState;

  const isNight = sky === 'night' || sky === 'flare';
  const hasBatteryExpansion = powerCap > 100;
  const shieldLayers = shield >= 30 ? 2 : shield >= 15 ? 1 : 0;
  const panelsDusty = (() => {
    let dusty = false;
    for (const t of trace) {
      if (t.choiceId === 'clean_skip') dusty = true;
      if (t.choiceId === 'clean_yes') dusty = false;
    }
    return dusty;
  })();
  const roverOut =
    currentEventType === 'dig_ice' ||
    lastChoiceId === 'ice_send' ||
    queue.some(q => q.choiceId === 'ice_send');
  const greenhouseActive =
    lastChoiceId === 'delay_greenhouse' ||
    queue.some(q => q.choiceId === 'delay_greenhouse') ||
    trace.some(t => t.choiceId === 'delay_greenhouse');

  const inspectInfo: Record<InspectId, { title: string; text: string }> = {
    earth: {
      title: 'Planet Earth',
      text: 'Home is 384,400 km away! Supply rockets need days to arrive, so our station must think ahead.',
    },
    dirt: {
      title: `Moon Dirt Pile (${moonDirt} units)`,
      text: 'Scientists call moon dirt "regolith." Crew walk right outside to harvest it for Air, Roof Shield shutters, or Battery bricks.',
    },
    solar: {
      title: panelsDusty ? 'Solar Wing (Dusty!)' : 'Solar Wing (Clean)',
      text: isNight
        ? 'Solar panels make 0 power during Lunar Night (Rounds 5–9). Wait for Sun return in Round 10!'
        : panelsDusty
        ? 'Static lunar dust is blocking sunlight! Eng. Leo must walk outside and sweep the panels clean so solar power stays strong.'
        : 'Outdoor solar wings generate +30 power every sunny round while keeping static dust brushed off.',
    },
    battery: {
      title: `Battery Bank (${power}/${powerCap})`,
      text: hasBatteryExpansion
        ? 'Battery Box expansion online! Extra storage helps survive Lunar Night without hitting 0 power.'
        : 'Never let batteries hit 0—air scrubbers shut off and oxygen drops twice as fast!',
    },
    dome: {
      title: 'Open-Airlock Command Bay & Crew (Maya, Leo, Priya, Sam)',
      text: sick
        ? 'Med. Sam says Eng. Leo caught a chill and came back inside shivering! Keep cabin heating ON or run Treat Sick Astronaut.'
        : shieldLayers > 0
        ? `Crew moves between the Command Bay and Moon surface through the sliding Airlock, guarded by ${Math.min(30, shield)}/30 roof armor.`
        : 'Astronauts step outside through the sliding Airlock onto Shackleton Crater and return inside for briefings or shelter.',
    },
    oxygen: {
      title: `Oxygen Tanks (${oxygen}/100)`,
      text: `The crew breathes 12 oxygen every round (about ${Math.floor(oxygen / 12)} rounds left at normal rate). Untreated sickness drains extra air (-6 O2/rd)!`,
    },
    greenhouse: {
      title: greenhouseActive
        ? 'CSA Hydroponic Greenhouse (Growing!)'
        : 'CSA Hydroponic Greenhouse Pod',
      text: greenhouseActive
        ? 'Sci. Priya walks right outside into the emerald grow dome where lunar greens convert CO2 into breathable oxygen!'
        : 'Sitting right outside the Airlock: inspired by the Canadian Space Agency to grow nutritious greens in closed-loop lunar domes.',
    },
    rover: {
      title: 'Shackleton Ice Rover',
      text: roverOut
        ? 'Cmdr. Maya stepped outside as rover headlights scan shadowed crater walls for frozen water-ice crystals!'
        : 'Patrolling near the crater rim outside. In icy crater missions, it mines frozen water for extra oxygen.',
    },
  };

  const toggleInspect = (id: InspectId) => {
    playClick(sfxEnabled);
    setInspected(prev => (prev === id ? null : id));
  };

  const floatingPopups = lastResults.slice(0, 2).map((res, i) => {
    const parts: string[] = [];
    if (res.delta.oxygen)
      parts.push(`${res.delta.oxygen > 0 ? '+' : ''}${res.delta.oxygen} O2`);
    if (res.delta.power)
      parts.push(`${res.delta.power > 0 ? '+' : ''}${res.delta.power} P`);
    if (res.delta.shield) parts.push(`+${res.delta.shield} Shield`);
    if (res.delta.health)
      parts.push(`${res.delta.health > 0 ? '+' : ''}${res.delta.health} Health`);
    return {
      key: `${round}-${res.sourceRound}-${i}`,
      label: parts.join(' · ') || res.choiceLabel,
      positive:
        (res.delta.oxygen ?? 0) > 0 ||
        (res.delta.power ?? 0) > 0 ||
        (res.delta.shield ?? 0) > 0 ||
        (res.delta.health ?? 0) > 0,
    };
  });

  if (fullScreen) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#050914] text-slate-100 select-none">
        {/* Full-Screen Interactive 3D Command Bay & Lunar Outpost (Bay + Moon camera default) */}
        <div className="absolute inset-0 z-0">
          <CommandBay3D
            gameState={gameState}
            sky={sky}
            lastChoiceId={lastChoiceId}
            currentEventType={currentEventType}
            inspected={inspected}
            cameraPreset="overview"
            rightPanelOpen={rightPanelOpen && showAllHud}
            onInspect={toggleInspect}
          />
        </div>

        {/* Floating Perimeter HUD */}
        <div className="relative z-10 w-full h-full pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 gap-2">
          {topHeader && <div className="shrink-0">{topHeader}</div>}

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row justify-between gap-2.5 sm:gap-3">
            {/* Left Stage Overlay */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col justify-between gap-2">
              {showAllHud && (
                <div className="space-y-2 w-full max-w-[920px]">
                  {vitalsHud}

                  {floatingPopups.length > 0 && status === 'playing' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {floatingPopups.map(pop => (
                        <motion.div
                          key={pop.key}
                          initial={{ opacity: 0, y: 6, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold shadow-lg ${
                            pop.positive
                              ? 'bg-emerald-950/95 border-emerald-400/70 text-emerald-200'
                              : 'bg-rose-950/95 border-rose-400/70 text-rose-200'
                          }`}
                        >
                          {pop.label}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Optional direct-click 3D object tooltip (only appears if player clicks a 3D mesh) */}
              {showAllHud && inspected && (
                <div className="max-w-[680px] pointer-events-auto">
                  <div className="px-3.5 py-2.5 rounded-xl bg-[#070b14]/94 border border-sky-400/50 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm shadow-xl">
                    <div>
                      <strong className="text-sky-300 mr-2">
                        {inspectInfo[inspected].title}:
                      </strong>
                      <span className="text-slate-100">
                        {inspectInfo[inspected].text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspected(null)}
                      className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Collapsible Mission Panel */}
            {showAllHud && rightPanelOpen && sidePanel && (
              <div className="w-full lg:w-[365px] xl:w-[395px] shrink-0 max-h-[45vh] lg:max-h-full overflow-y-auto pointer-events-auto pr-0.5">
                {sidePanel}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/85 bg-[#050914] shadow-2xl">
      {floatingPopups.length > 0 && status === 'playing' && (
        <div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-wrap justify-end gap-1.5">
          {floatingPopups.map(pop => (
            <motion.div
              key={pop.key}
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24 }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold shadow-lg ${
                pop.positive
                  ? 'bg-emerald-950/95 border-emerald-400/70 text-emerald-200'
                  : 'bg-rose-950/95 border-rose-400/70 text-rose-200'
              }`}
            >
              {pop.label}
            </motion.div>
          ))}
        </div>
      )}

      {/* Inline 3D Viewport for Mission Report */}
      <div className="w-full h-[350px] sm:h-[420px] lg:h-[470px]">
        <CommandBay3D
          gameState={gameState}
          sky={sky}
          lastChoiceId={lastChoiceId}
          currentEventType={currentEventType}
          inspected={inspected}
          cameraPreset="overview"
          rightPanelOpen={false}
          onInspect={toggleInspect}
        />
      </div>

      {/* Interactive Base Inspector Detail Drawer (when 3D mesh is clicked directly) */}
      {inspected && (
        <div className="px-4 py-2.5 bg-slate-900/95 border-t border-sky-400/40 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <div>
            <strong className="text-sky-300 mr-2">
              {inspectInfo[inspected].title}:
            </strong>
            <span className="text-slate-100">
              {inspectInfo[inspected].text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setInspected(null)}
            className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
