import React, { useState } from 'react';
import { motion } from 'motion/react';
import { getRoundView } from '../../engine';
import { SCENARIO } from '../../engine/events';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { playClick } from '../../audio/sfx';
import { Bar } from '../../ui/Bar';
import { AstronautFace } from '../../ui/AstronautFace';
import { SpeakerButton } from '../../ui/SpeakerButton';
import { DetailTap } from '../../ui/DetailTap';
import { StationIcon } from '../../ui/icons';
import { StationScene } from './StationScene';
import { CrewComms } from './CrewComms';
import { ResultLine } from './ResultLine';
import { ChoiceButton } from './ChoiceButton';
import { MissionOutcomeModal } from './MissionOutcomeModal';

interface RoundScreenProps {
  onOpenLibrary: () => void;
}

export const RoundScreen: React.FC<RoundScreenProps> = ({ onOpenLibrary }) => {
  const gameState = useGameStore(s => s.gameState);
  const lastChoiceId = useGameStore(s => s.lastChoiceId);
  const lastDeltas = useGameStore(s => s.lastDeltas);
  const outcomeModalOpen = useGameStore(s => s.outcomeModalOpen);
  const choose = useGameStore(s => s.choose);
  const openMissionReport = useGameStore(s => s.openMissionReport);
  const setOutcomeModalOpen = useGameStore(s => s.setOutcomeModalOpen);
  const retrySameScenario = useGameStore(s => s.retrySameScenario);
  const retryNewScenario = useGameStore(s => s.retryNewScenario);
  const goToTitle = useGameStore(s => s.goToTitle);
  const sfxEnabled = useSettingsStore(s => s.sfxEnabled);

  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [zenMode, setZenMode] = useState(false);

  const isEnded = gameState.status !== 'playing';
  const view = getRoundView(gameState);
  const currentSlot = gameState.roundSchedule.find(
    s => s.round === gameState.round
  );

  const speechParts = [
    `Round ${view.round} of ${view.maxRounds}.`,
    view.situation.short,
    view.warning ? `Heads up: ${view.warning.short}` : '',
    ...view.lastResults.map(
      r => `From round ${r.sourceRound}: ${r.reason.short}`
    ),
  ].filter(Boolean);

  const topHeader = (
    <header className="pointer-events-auto rounded-xl bg-[#070b14]/90 border border-slate-700/80 px-3 py-1.5 shadow-xl flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={goToTitle}
          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
        >
          ← Back
        </button>
        <span className="font-display text-base sm:text-lg font-bold text-white whitespace-nowrap shrink-0">
          {SCENARIO.meta.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {!zenMode && (
          <>
            <SpeakerButton text={speechParts.join(' ')} />
            <button
              type="button"
              onClick={onOpenLibrary}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/45 text-xs font-semibold text-sky-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              Science Library
            </button>
            {isEnded ? (
              <button
                type="button"
                onClick={() => {
                  playClick(sfxEnabled);
                  setOutcomeModalOpen(true);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                  gameState.status === 'lost'
                    ? 'bg-rose-500/25 hover:bg-rose-500/35 border-rose-400/70 text-rose-100'
                    : 'bg-emerald-500/25 hover:bg-emerald-500/35 border-emerald-400/70 text-emerald-100'
                }`}
              >
                {gameState.status === 'lost'
                  ? 'Mission Failed · Result'
                  : 'Mission Completed · Result'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playClick(sfxEnabled);
                  setSidePanelOpen(prev => !prev);
                }}
                aria-expanded={sidePanelOpen}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-xs font-semibold text-amber-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                {sidePanelOpen ? 'Hide Mission' : 'Show Mission'}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => {
            playClick(sfxEnabled);
            setZenMode(prev => !prev);
          }}
          aria-pressed={zenMode}
          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800/95 hover:bg-slate-700 border border-slate-600/80 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
        >
          {zenMode ? 'Show HUD' : 'Full 3D'}
        </button>
      </div>
    </header>
  );

  const vitalsHud = (
    <section
      aria-label="Station supplies and crew status"
      className="pointer-events-auto grid grid-cols-2 md:grid-cols-4 gap-2"
    >
      <Bar
        label="Power"
        value={gameState.power}
        max={gameState.powerCap}
        icon="power"
        tone="power"
        delta={lastDeltas?.power}
        note={gameState.power === 0 ? 'At 0! Air off!' : undefined}
      />
      <Bar
        label="Oxygen"
        value={gameState.oxygen}
        max={gameState.oxygenCap}
        icon="oxygen"
        tone="oxygen"
        delta={lastDeltas?.oxygen}
        note={
          gameState.oxygen <= 30
            ? 'Critical! Make Air!'
            : gameState.sick
            ? 'Sick stress -6/rd'
            : undefined
        }
      />
      <Bar
        label="Health"
        value={gameState.health}
        max={gameState.healthCap}
        icon="health"
        tone="health"
        delta={lastDeltas?.health}
        note={gameState.sick ? 'Sick! -5 health/rd' : undefined}
      />
      <AstronautFace
        health={gameState.health}
        oxygen={gameState.oxygen}
        sick={gameState.sick}
        sky={view.sky}
        status={gameState.status}
      />
    </section>
  );

  const sidePanel = (
    <aside className="space-y-2.5">
      {/* Critical Life-Support Danger Banner */}
      {(gameState.oxygen <= 30 || gameState.health <= 30 || gameState.power === 0) && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-950/92 border border-rose-400/75 px-3.5 py-2.5 flex items-start gap-2.5 shadow-xl"
        >
          <span className="text-rose-300 shrink-0 mt-0.5">
            <StationIcon name="warning" className="w-4 h-4" />
          </span>
          <p className="text-xs sm:text-sm font-bold text-rose-100 leading-snug">
            {gameState.power === 0
              ? 'BLACKOUT! Power is at 0—air machines stopped (-15 extra O₂/rd)!'
              : gameState.health <= 30
              ? `DANGER: Crew health at ${gameState.health}%! Heal, shelter, or keep heat ON!`
              : `DANGER: Oxygen at ${gameState.oxygen}%! Produce Air or crew will suffocate!`}
          </p>
        </div>
      )}

      {/* 2-Round Warning (Blinks to draw immediate attention) */}
      {view.warning && (
        <div
          role="alert"
          className="warning-blink rounded-2xl bg-[#191205]/95 border-2 border-amber-400/80 px-3.5 py-2.5 flex items-start justify-between gap-2 shadow-xl"
        >
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-amber-300 shrink-0 mt-0.5">
              <StationIcon name="warning" className="w-4 h-4" />
            </span>
            <p className="text-xs sm:text-sm font-extrabold text-amber-100 leading-snug">
              {view.warning.short}
            </p>
          </div>
          <DetailTap promptLabel="Why?" detailText={view.warning.detail} />
        </div>
      )}

      {/* Landed Delayed Results */}
      <ResultLine
        lastResults={view.lastResults}
        scheduledEventMessage={view.scheduledEventMessage}
      />

      {/* Side Decision Panel */}
      <motion.section
        key={view.round}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="rounded-2xl bg-[#070b14]/92 border border-slate-700/85 p-3.5 sm:p-4 space-y-3 shadow-2xl"
      >
        <div className="space-y-1.5">
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-sky-300 leading-tight tabular-nums">
            Round {view.round}/{view.maxRounds}
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
            {view.situation.short}
          </h2>
        </div>

        <div className="space-y-2">
          {view.choices.map((choice, idx) => (
            <ChoiceButton
              key={choice.id}
              choice={choice}
              onSelect={choose}
              showArrow={view.showTutorialArrow && idx === 0}
            />
          ))}
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <DetailTap
              promptLabel="What is moon dirt?"
              shortText={SCENARIO.meta.moonDirtNote.short}
              detailText={SCENARIO.meta.moonDirtNote.detail}
            />
            <DetailTap
              promptLabel="More Info"
              shortText={view.title.detail}
              detailText={view.situation.detail}
            />
          </div>
          <CrewComms gameState={gameState} sky={view.sky} />
        </div>
      </motion.section>
    </aside>
  );

  return (
    <>
      <StationScene
        gameState={gameState}
        sky={isEnded ? (gameState.status === 'lost' ? 'night' : 'resupply') : view.sky}
        lastChoiceId={lastChoiceId}
        currentEventType={currentSlot?.eventType}
        fullScreen
        rightPanelOpen={sidePanelOpen && !isEnded}
        showAllHud={!zenMode}
        topHeader={topHeader}
        vitalsHud={vitalsHud}
        sidePanel={isEnded ? undefined : sidePanel}
      />

      {isEnded && outcomeModalOpen && (
        <MissionOutcomeModal
          gameState={gameState}
          sky={gameState.status === 'lost' ? 'night' : 'resupply'}
          onViewReport={openMissionReport}
          onRetrySame={retrySameScenario}
          onRetryNew={retryNewScenario}
          onGoToTitle={goToTitle}
          onDismiss={() => {
            playClick(sfxEnabled);
            setOutcomeModalOpen(false);
          }}
        />
      )}
    </>
  );
};
