import React, { useEffect, useState } from 'react';
import factsJson from '../content/facts.json';
import scenarioJson from '../content/scenario.json';
import { OsdrTopic, ScienceFact, ScenarioData } from '../types';
import { useNasaDataStore } from '../store/nasaDataStore';
import {
  KID_TEXT,
  NASA_ATTRIBUTION,
  calmLine,
  formatKidDate,
  radiationWindowLabel,
  studyKidSummary,
  truthLabel,
} from '../shared/nasa/kidText';
import { GrownUpLink } from './GrownUpLink';
import { ScienceBadge } from './ScienceBadge';

const FACTS = factsJson as ScienceFact[];
const SCENARIO = scenarioJson as unknown as ScenarioData;

type LibraryTab = 'topics' | 'live' | 'csa';

interface ScienceLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

const OSDR_TOPICS: { id: OsdrTopic; label: string }[] = [
  { id: 'bone', label: 'Bones & Muscles' },
  { id: 'radiation', label: 'Radiation' },
  { id: 'immune', label: 'Immune Health' },
  { id: 'food', label: 'Space Crops' },
];

function badgeKind(
  source: 'live' | 'recorded' | 'fallback' | 'unavailable' | undefined
): 'live' | 'recorded' | 'offline' {
  if (source === 'live') return 'live';
  if (source === 'recorded') return 'recorded';
  return 'offline';
}

function speedWord(speedKmS: number): string {
  if (speedKmS >= 1000) return 'very fast';
  if (speedKmS >= 650) return 'fast';
  return 'moderate';
}

export const ScienceLibraryModal: React.FC<ScienceLibraryModalProps> = ({
  open,
  onClose,
}) => {
  const [tab, setTab] = useState<LibraryTab>('topics');
  const [expandedId, setExpandedId] = useState<string | null>(FACTS[0]?.id ?? null);

  const snapshot = useNasaDataStore(s => s.snapshot);
  const radLabFallback = useNasaDataStore(s => s.radLab);
  const osdrTopic = useNasaDataStore(s => s.osdrTopic);
  const osdrCache = useNasaDataStore(s => s.osdrCache);
  const osdrLoading = useNasaDataStore(s => s.osdrLoading);
  const preloadAll = useNasaDataStore(s => s.preloadAll);
  const fetchOsdr = useNasaDataStore(s => s.fetchOsdr);

  useEffect(() => {
    if (open) preloadAll();
  }, [open, preloadAll]);

  if (!open) return null;

  const currentOsdr = osdrCache[osdrTopic];
  const spaceWeather = snapshot?.spaceWeather ?? null;
  const radiation = snapshot?.radiation ?? radLabFallback;
  const flare = snapshot?.flare ?? null;
  const observedDate = radiation
    ? formatKidDate(radiation.observedWindow.start)
    : null;
  const weatherTruth = spaceWeather
    ? truthLabel(spaceWeather.source, spaceWeather.recordedOn)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="science-library-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h2
              id="science-library-title"
              className="font-display text-xl sm:text-2xl font-bold text-white"
            >
              NASA & CSA Space Science Library
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Today's NASA briefing · ISS radiation recording · OSDR studies · CSA food
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>

        <div className="px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-900/95">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
            {[
              { id: 'topics' as const, label: 'Science Topics' },
              { id: 'live' as const, label: "Today's NASA Data" },
              { id: 'csa' as const, label: 'CSA Lunar Food' },
            ].map(item => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-sky-400 text-slate-950 font-bold shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {tab === 'topics' && (
            <>
              <div className="rounded-xl bg-amber-500/10 border border-amber-400/35 px-4 py-3 text-xs sm:text-sm text-amber-100">
                <strong className="font-semibold text-amber-300">Mission Time Note: </strong>
                {SCENARIO.meta.darkPeriodNote}
              </div>

              {FACTS.map(fact => {
                const isOpen = expandedId === fact.id;
                const isNasaFact = fact.id.startsWith('fact-') && !fact.id.startsWith('fact-csa');
                return (
                  <div
                    key={fact.id}
                    className="rounded-xl bg-slate-800/70 border border-slate-700/80 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : fact.id)}
                      className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-800 transition-colors cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-sky-300">{fact.topic}</div>
                        <div className="font-display text-base sm:text-lg font-bold text-white">
                          {fact.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {fact.verifiedOn && (
                            <span className="text-[11px] text-slate-400">
                              Checked {formatKidDate(fact.verifiedOn)}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {isNasaFact ? 'NASA source' : 'CSA source'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 whitespace-nowrap shrink-0">
                        {isOpen ? 'Less' : 'Read'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-700/60 space-y-3">
                        <p className="text-sm sm:text-base text-slate-100 leading-relaxed">
                          {fact.kidSummary}
                        </p>
                        <div className="rounded-lg bg-slate-900/90 border border-slate-700/70 p-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                          <span className="font-semibold text-sky-300">Deep Science: </span>
                          {fact.scienceDetail}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                          <span>{fact.relatedTerms.join(' · ')}</span>
                          <GrownUpLink
                            href={fact.nasaSourceUrl}
                            className="font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
                          >
                            Source: {fact.nasaSourceName} →
                          </GrownUpLink>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {tab === 'live' && (
            <div className="space-y-5">
              {/* 1. Today's NASA space weather */}
              <section className="rounded-2xl bg-slate-800/65 border border-slate-700/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      NASA Space Weather (Last 28 Days)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real solar eruptions and storms. Today's numbers set the round 8 flare bonus.
                    </p>
                  </div>
                  {spaceWeather && (
                    <ScienceBadge
                      kind={badgeKind(spaceWeather.source)}
                      date={formatKidDate(spaceWeather.recordedOn)}
                    />
                  )}
                </div>

                {spaceWeather ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Solar status</div>
                        <div className="font-display text-base font-bold text-amber-300 mt-0.5">
                          {spaceWeather.activityLevel}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Eruptions seen</div>
                        <div className="font-mono text-base font-bold text-white tabular-nums mt-0.5">
                          {spaceWeather.cmeCount}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Fastest eruption</div>
                        <div className="font-mono text-base font-bold text-sky-300 tabular-nums mt-0.5">
                          {spaceWeather.maxCmeSpeedKmS
                            ? `${spaceWeather.maxCmeSpeedKmS} km/s`
                            : '—'}
                        </div>
                        {spaceWeather.maxCmeSpeedKmS > 0 && (
                          <div className="text-[11px] text-slate-400">
                            {speedWord(spaceWeather.maxCmeSpeedKmS)}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Storm strength</div>
                        <div className="font-mono text-base font-bold text-rose-300 tabular-nums mt-0.5">
                          Kp {spaceWeather.maxKpIndex}
                        </div>
                        <div className="text-[11px] text-slate-400">Kp 5 or more is stormy</div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-100 leading-relaxed">
                      {spaceWeather.kidBrief}
                    </p>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {snapshot ? `Snapshot ${snapshot.snapshotId}` : 'No snapshot'}
                        {weatherTruth ? ` · ${weatherTruth}` : ''}
                        {spaceWeather.fetchedAt
                          ? ` · Checked ${formatKidDate(spaceWeather.fetchedAt)}`
                          : ''}
                      </span>
                      <GrownUpLink
                        href="https://ccmc.gsfc.nasa.gov/tools/DONKI/"
                        className="font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
                      >
                        See NASA's space weather tool →
                      </GrownUpLink>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-200">{KID_TEXT.calm.weather}</p>
                )}
              </section>

              {/* 2. Real solar flare used by this mission */}
              <section className="rounded-2xl bg-slate-800/65 border border-slate-700/80 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-white">
                    Real NASA Solar Flare
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {snapshot && flare && (
                      <ScienceBadge
                        kind={badgeKind(snapshot.source)}
                        date={formatKidDate(snapshot.recordedOn)}
                      />
                    )}
                    {flare && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-300/50 font-mono text-xs font-bold text-amber-100">
                        {KID_TEXT.flare.badge.replace('{classLabel}', flare.classLabel)}
                      </span>
                    )}
                  </div>
                </div>
                {flare ? (
                  <>
                    <p className="text-sm text-slate-100 leading-relaxed">{flare.kid.short}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{flare.kid.detail}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        {formatKidDate(flare.peakTime ?? flare.beginTime)} ·{' '}
                        {flare.sourceLocation ? `Sun spot ${flare.sourceLocation}` : 'Sun'}
                      </span>
                      <GrownUpLink
                        href={flare.link}
                        className="font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
                      >
                        See the flare record →
                      </GrownUpLink>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-200">{KID_TEXT.calm.weather}</p>
                )}
              </section>

              {/* 3. RadLab: a real recording, never called live */}
              <section className="rounded-2xl bg-slate-800/65 border border-slate-700/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      NASA RadLab · ISS Radiation Recording
                    </h3>
                    <p className="text-xs text-slate-400">
                      A real two-hour recording from Space Station sensors. Not a live
                      reading.
                    </p>
                  </div>
                  <ScienceBadge
                    kind={radiation && radiation.sampleCount > 0 ? 'recorded' : 'offline'}
                    date={observedDate}
                  />
                </div>

                {radiation && radiation.sampleCount > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-sky-200">
                      {radiationWindowLabel(radiation.observedWindow.start)}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Detectors</div>
                        <div className="font-mono text-sm font-bold text-white mt-0.5">
                          {radiation.instruments.join(' / ') || 'DosTel'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Lowest dose</div>
                        <div className="font-mono text-base font-bold text-emerald-300 tabular-nums mt-0.5">
                          {radiation.minDoseMicroGyHr} µGy/h
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Average dose</div>
                        <div className="font-mono text-base font-bold text-sky-300 tabular-nums mt-0.5">
                          {radiation.avgDoseMicroGyHr} µGy/h
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-900/90 border border-slate-700/70 p-3">
                        <div className="text-xs text-slate-400">Peak dose</div>
                        <div className="font-mono text-base font-bold text-amber-300 tabular-nums mt-0.5">
                          {radiation.peakDoseMicroGyHr} µGy/h
                        </div>
                        <div className="text-[11px] text-slate-400">microgray per hour</div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-100 leading-relaxed">
                      {radiation.kidTakeaway}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                      {radiation.samples.slice(0, 3).map((sample, index) => (
                        <div
                          key={`${sample.timestamp}-${index}`}
                          className="rounded-lg bg-slate-950/75 border border-slate-800 px-3 py-2 text-slate-300"
                        >
                          <div className="text-slate-400">
                            {sample.instrumentId} · {sample.timestamp.slice(11, 16)} UTC
                          </div>
                          <div className="text-amber-200 font-bold mt-0.5">
                            {sample.absorbedDoseRate} µGy/hr
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                      <span>
                        {radiation.sampleCount} readings ·{' '}
                        {radiation.recordedOn
                          ? `Recorded ${formatKidDate(radiation.recordedOn)}`
                          : 'Recorded NASA data'}
                      </span>
                      <GrownUpLink
                        href={radiation.portalUrl}
                        className="font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
                      >
                        Explore the RadLab portal →
                      </GrownUpLink>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-200">{calmLine('radiation')}</p>
                )}
              </section>

              {/* 4. OSDR studies: curated kid line, titles only for grown-ups */}
              <section className="rounded-2xl bg-slate-800/65 border border-slate-700/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      NASA OSDR Space Biology Studies
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real NASA experiments behind the station's health and food choices.
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                    {OSDR_TOPICS.map(topic => {
                      const active = osdrTopic === topic.id;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => void fetchOsdr(topic.id)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-emerald-400 text-slate-950 font-bold'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {topic.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {osdrLoading && (
                  <p className="text-xs text-slate-300">Opening NASA's study shelf…</p>
                )}

                <div className="rounded-xl bg-slate-900/90 border border-slate-700/75 p-3 space-y-2">
                  <p className="text-sm text-slate-100 leading-relaxed">
                    {studyKidSummary(osdrTopic)}
                  </p>
                  {currentOsdr ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <ScienceBadge
                        kind={badgeKind(currentOsdr.source)}
                        date={formatKidDate(currentOsdr.recordedOn)}
                      />
                      <span>
                        {currentOsdr.totalHits}{' '}
                        {currentOsdr.totalHits === 1 ? 'NASA study matches' : 'NASA studies match'}{' '}
                        this topic
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">{KID_TEXT.studies.offline}</p>
                  )}

                  {currentOsdr && currentOsdr.studies.length > 0 && (
                    <details className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
                      <summary className="text-xs font-semibold text-slate-300 cursor-pointer">
                        {KID_TEXT.badges.forGrownUps}
                      </summary>
                      <ul className="mt-2 space-y-2 text-xs text-slate-300">
                        {currentOsdr.studies.map(study => (
                          <li key={study.accession} className="space-y-1">
                            <div className="font-mono text-[11px] text-sky-300">
                              {study.accession} · {study.flightProgram} · {study.organism}
                            </div>
                            <div className="text-slate-100 font-semibold leading-snug">
                              {study.title}
                            </div>
                            <GrownUpLink
                              href={study.url}
                              className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer"
                            >
                              Open study →
                            </GrownUpLink>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'csa' && (
            <div className="space-y-4">
              <section className="rounded-2xl bg-emerald-950/25 border border-emerald-400/35 p-5 space-y-3">
                <div className="text-xs font-semibold text-emerald-300">
                  Canadian Space Agency (CSA) · Space & Earth Dual Benefit
                </div>
                <h3 className="font-display text-xl font-bold text-white">
                  Food Production on the Moon and in Remote Areas
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed">
                  Sending fresh lettuce, tomatoes, and berries from Earth to Shackleton Crater
                  is slow and heavy—especially when a resupply ship is delayed in Round 6. The
                  Canadian Space Agency explores closed-loop greenhouses that grow fresh food
                  on the Moon while helping remote Northern communities on Earth grow healthy
                  crops year-round.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="rounded-xl bg-slate-900/90 border border-slate-700/75 p-3.5 space-y-1">
                    <div className="text-xs font-bold text-emerald-300">1. Plants Make Oxygen</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      In Silica Station, choosing{' '}
                      <strong className="text-white">Grow Greenhouse Greens (CSA)</strong> in
                      Round 6 costs 5 power now and returns +32 oxygen and +6 health later!
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-900/90 border border-slate-700/75 p-3.5 space-y-1">
                    <div className="text-xs font-bold text-sky-300">2. Controlled Environments</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Hydroponic and aeroponic racks recycle water and use tuned LED grow lights
                      to survive two-week lunar nights.
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-900/90 border border-slate-700/75 p-3.5 space-y-1">
                    <div className="text-xs font-bold text-amber-300">3. Earth & Northern Impact</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Through the Deep Space Food Challenge, CSA teams deploy cold-climate
                      container farms in Arctic and remote regions.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-slate-800/65 border border-slate-700/80 p-4 space-y-3">
                <h4 className="font-display text-base font-bold text-white">
                  CSA Resources for Youth, Classrooms & Clubs (Ages 7–12)
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Explore CSA's free bilingual educator toolkits connecting space agriculture,
                  astronaut nutrition, and hands-on STEM experiments.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                  <GrownUpLink
                    href="https://www.asc-csa.gc.ca/eng/astronauts/living-in-space/eating-in-space.asp"
                    className="font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2 cursor-pointer"
                  >
                    CSA food in space →
                  </GrownUpLink>
                  <GrownUpLink
                    href="https://www.asc-csa.gc.ca/eng/educators/resources/"
                    className="font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer"
                  >
                    CSA STEM & youth resources →
                  </GrownUpLink>
                </div>
              </section>
            </div>
          )}

          <p className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            {NASA_ATTRIBUTION}
          </p>
        </div>
      </div>
    </div>
  );
};
