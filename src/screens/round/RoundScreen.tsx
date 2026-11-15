import React from 'react';
import { getRoundView, submitChoice } from '../engine';
import { useGameStore } from '../store/gameStore';
import { StationScene } from '../round/StationScene';
import { CrewComms } from '../round/CrewComms';
import { EventBanner } from '../round/EventBanner';
import { ChoiceButton } from '../round/ChoiceButton';
import { ResultLine } from '../round/ResultLine';
import { SpeakerButton } from '../ui/SpeakerButton';
import { ScienceLibraryModal } from '../ui/ScienceLibraryModal';

interface RoundScreenProps {
  onOpenLibrary: () => void;
}

export const RoundScreen: React.FC<RoundScreenProps> = ({ onOpenLibrary }) => {
  const gameState = useGameStore(s => s.gameState);
  const lastChoiceId = useGameStore(s => s.lastChoiceId);
  const lastDeltas = useGameStore(s => s.lastDeltas);
  const choose = useGameStore(s => s.choose);

  const roundView = getRoundView(gameState);

  const speechText = `${roundView.title.short}. ${roundView.situation.detail}`;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 px-4 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Round {roundView.round} / {roundView.maxRounds}
            </h1>
            <p className="text-sm text-slate-400">
              {roundView.chapterTitle} · Chapter {roundView.chapter}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SpeakerButton text={speechText} label="Read Aloud" />
            <button
              type="button"
              onClick={onOpenLibrary}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-xs sm:text-sm font-semibold text-sky-200 cursor-pointer whitespace-nowrap"
            >
              Science Library
            </button>
          </div>
        </div>

        <StationScene
          gameState={gameState}
          sky={roundView.sky}
          lastChoiceId={lastChoiceId}
        />

        <CrewComms
          power={gameState.power}
          oxygen={gameState.oxygen}
          health={gameState.health}
          moonDirt={gameState.moonDirt}
        />

        <EventBanner
          title={roundView.title}
          situation={roundView.situation}
          warning={roundView.warning}
        />

        {roundView.lastResults.length > 0 && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Last Round Results
            </h3>
            <div className="space-y-1">
              {roundView.lastResults.map((result, idx) => (
                <ResultLine
                  key={idx}
                  label={result.choiceLabel}
                  delta={result.delta}
                  icon={result.icon}
                />
              ))}
            </div>
          </div>
        )}

        {roundView.scheduledEventMessage && (
          <div className="rounded-2xl bg-amber-950/50 border-2 border-amber-500/75 p-4">
            <h3 className="font-display text-lg font-bold text-amber-200 mb-1">
              Event
            </h3>
            <p className="text-sm text-amber-100 font-semibold">
              {roundView.scheduledEventMessage.short}
            </p>
            <p className="text-xs text-amber-200/80 mt-1">
              {roundView.scheduledEventMessage.detail}
            </p>
          </div>
        )}

        {roundView.upkeepSummary && (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/75 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Upkeep Summary
            </h3>
            <p className="text-sm text-slate-200">
              {roundView.upkeepSummary}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold text-white">
            Make Your Choice
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {roundView.choices.map(choice => (
              <ChoiceButton
                key={choice.id}
                id={choice.id}
                icon={choice.icon}
                label={choice.label}
                costLabel={choice.costLabel}
                why={choice.why}
                disabled={choice.disabled}
                disabledReason={choice.disabledReason}
                onClick={choose}
              />
            ))}
          </div>
        </div>

        {roundView.showTutorialArrow && (
          <div className="text-center text-sm text-sky-300 font-semibold">
            👆 Choose an option above to begin your mission
          </div>
        )}
      </div>
    </div>
  );
};