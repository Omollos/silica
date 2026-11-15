import React, { useEffect } from 'react';
import { buildReport } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { useNasaDataStore } from '../../store/nasaDataStore';
import { AstronautFace } from '../../ui/AstronautFace';
import { SpeakerButton } from '../../ui/SpeakerButton';
import { DetailTap } from '../../ui/DetailTap';
import { StationIcon } from '../../ui/icons';
import { StationScene } from '../round/StationScene';
import { ReportChain } from './ReportChain';
import { WinScreen } from './WinScreen';
import { RetryButtons } from './RetryButtons';

interface MissionReportProps {
  onOpenLibrary: () => void;
}

export const MissionReport: React.FC<MissionReportProps> = ({
  onOpenLibrary,
}) => {
  const gameState = useGameStore(s => s.gameState);
  const lastChoiceId = useGameStore(s => s.lastChoiceId);
  const retrySameScenario = useGameStore(s => s.retrySameScenario);
  const retryNewScenario = useGameStore(s => s.retryNewScenario);
  const goToTitle = useGameStore(s => s.goToTitle);
  const spaceWeather = useNasaDataStore(s => s.spaceWeather);
  const radLab = useNasaDataStore(s => s.radLab);
  const preloadAll = useNasaDataStore(s => s.preloadAll);

  useEffect(() => {
    preloadAll();
  }, [preloadAll]);

  const report = buildReport(gameState);
  const isLost = report.outcome === 'lost';

  const speechText = [
    isLost
      ? `Mission ended in round ${report.roundsSurvived}. ${
          report.failureReason === 'oxygen'
            ? 'The station ran out of oxygen.'
            : 'Crew health dropped to zero.'
        }`
      : `Mission complete! Final crew health score ${report.score}.`,
    report.biggestLinkHint.short,
    report.biggestLinkHint.detail,
  ].join(' ');

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 px-4 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Black Box Mission Report
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <SpeakerButton text={speechText} label="Read Report" />
            <button
              type="button"
              onClick={onOpenLibrary}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-xs sm:text-sm font-semibold text-sky-200 cursor-pointer whitespace-nowrap"
            >
              Science Library
            </button>
          </div>
        </div>

        {/* Final Station Visual Payoff */}
        <StationScene
          gameState={gameState}
          sky={isLost ? 'night' : 'resupply'}
          lastChoiceId={lastChoiceId}
        />

        {/* Win vs Loss Summary */}
        {isLost ? (
          <div className="rounded-2xl bg-rose-950/55 border-2 border-rose-500/75 p-5 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_28px_rgba(244,63,94,0.2)]">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/25 border border-rose-400/60 text-rose-200 flex items-center justify-center shrink-0">
                <StationIcon name="warning" className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="inline-block text-[11px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/30 border border-rose-400/60 text-rose-200">
                  Mission Failed
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {report.failureReason === 'oxygen'
                    ? `Oxygen Depleted in Round ${report.roundsSurvived}`
                    : `Mission Failed in Round ${report.roundsSurvived}`}
                </h2>
                <p className="text-sm text-rose-100">
                  {report.failureReason === 'oxygen'
                    ? 'Oxygen tanks hit 0% before the resupply rocket arrived. Crew life support failed.'
                    : report.finalHealth <= 0
                    ? 'Crew health dropped to 0% from radiation, cold, or shortages.'
                    : `Crew health fell to ${report.finalHealth}%—below the 50% survival threshold at resupply check-up.`}
                </p>
              </div>
            </div>
            <AstronautFace
              health={report.finalHealth}
              oxygen={report.finalOxygen}
              sick={gameState.sick}
              sky="night"
              status="lost"
            />
          </div>
        ) : (
          <WinScreen report={report} />
        )}

        {/* Final Station Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { label: 'Rounds', value: `${report.roundsSurvived}/12`, alert: false },
            { label: 'Power', value: `${report.finalPower}`, alert: report.finalPower === 0 },
            {
              label: 'Oxygen',
              value: `${report.finalOxygen}`,
              alert: report.finalOxygen === 0 || report.failureReason === 'oxygen',
            },
            {
              label: 'Health',
              value: `${report.finalHealth}`,
              alert: report.failureReason === 'health',
            },
            { label: 'Roof Shield', value: `${Math.min(30, report.finalShield)}/30`, alert: false },
          ].map(stat => (
            <div
              key={stat.label}
              className={`rounded-xl border px-3 py-2.5 text-center ${
                stat.alert
                  ? 'bg-rose-950/45 border-rose-500/70'
                  : 'bg-slate-900/90 border-slate-700/75'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                {stat.label}
              </div>
              <div
                className={`font-mono text-lg font-bold tabular-nums mt-0.5 ${
                  stat.alert ? 'text-rose-300' : 'text-white'
                }`}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Biggest Causal Link Hint */}
        <div className="rounded-2xl bg-sky-950/35 border border-sky-400/45 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-300">
              Commander Insight
            </div>
            <p className="text-sm sm:text-base font-bold text-white">
              {report.biggestLinkHint.short}
            </p>
          </div>
          <DetailTap
            promptLabel="How to fix?"
            detailText={report.biggestLinkHint.detail}
          />
        </div>

        {/* 3-Link Causal Chain */}
        <ReportChain chainLines={report.chainLines} />

        {/* Sacrificed Resources Summary */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-700/75 p-4 space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Resources Spent This Run
          </div>
          <ul className="space-y-1 text-xs sm:text-sm text-slate-200">
            {report.sacrificedSummary.map(line => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </div>

        {/* Real NASA & CSA Data Grounding */}
        <div className="rounded-2xl bg-slate-900/85 border border-slate-700/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-300">
              Real NASA & CSA Data Behind Your Mission
            </div>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer whitespace-nowrap"
            >
              Inspect Live Data in Library →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300 leading-relaxed">
            <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-1">
              <div className="font-bold text-amber-300">NASA DONKI Solar Watch</div>
              <p>
                {spaceWeather
                  ? `Status: ${spaceWeather.activityLevel} · ${spaceWeather.cmeCount} CMEs tracked, peak Kp ${spaceWeather.maxKpIndex || 0}.`
                  : 'Tracks real coronal mass ejections & solar storms driving flare risk.'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-1">
              <div className="font-bold text-sky-300">NASA RadLab & OSDR</div>
              <p>
                {radLab
                  ? `ISS DosTel peaked at ${radLab.peakDoseMicroGyHr} µGy/hr; your station reached ${Math.min(30, report.finalShield)}/30 roof armor.`
                  : 'Measures ISS absorbed dose rates and spaceflight bone/muscle research.'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-1">
              <div className="font-bold text-emerald-300">CSA Lunar Food & STEM</div>
              <p>
                {gameState.trace.some(t => t.choiceId === 'delay_greenhouse')
                  ? 'You activated the CSA Lunar Greenhouse to grow fresh greens and recycle cabin oxygen!'
                  : 'Explores how closed-loop Moon greenhouses nourish crews and remote Earth towns.'}
              </p>
            </div>
          </div>
        </div>

        {/* Retry Buttons */}
        <RetryButtons
          onSameScenario={retrySameScenario}
          onNewScenario={retryNewScenario}
          onTitle={goToTitle}
        />
      </div>
    </div>
  );
};