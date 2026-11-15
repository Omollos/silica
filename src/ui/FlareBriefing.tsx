import React from 'react';
import { KID_TEXT, formatKidDate, truthLabel } from '../shared/nasa/kidText';
import { useGameStore } from '../store/gameStore';
import { useNasaDataStore } from '../store/nasaDataStore';
import { DetailTap } from './DetailTap';
import { StationIcon } from './icons';

interface FlareBriefingProps {
  round: number;
}

/**
 * A short, real "NASA saw this flare" line for the round 6 warning and the
 * round 8 flare screen. It reads only the snapshot this run is pinned to, and
 * renders nothing at all when there is no real flare to show.
 */
export const FlareBriefing: React.FC<FlareBriefingProps> = ({ round }) => {
  const snapshot = useNasaDataStore(s => s.snapshot);
  const pinnedSnapshotId = useGameStore(s => s.pinnedSnapshotId);

  if (round !== 6 && round !== 8) return null;
  if (!snapshot || snapshot.snapshotId !== pinnedSnapshotId) return null;

  const flare = snapshot.flare;
  if (!flare) return null;

  const date = formatKidDate(flare.peakTime ?? flare.beginTime);
  const truth = truthLabel(snapshot.source, snapshot.recordedOn);

  return (
    <div className="rounded-xl bg-slate-950/85 border border-amber-400/40 px-3 py-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-amber-300 shrink-0" aria-hidden="true">
          <StationIcon name="sun" className="w-4 h-4" />
        </span>
        <span className="font-bold text-amber-200">{KID_TEXT.flare.label}</span>
        <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/50 font-mono font-bold text-amber-100 tabular-nums">
          {KID_TEXT.flare.badge.replace('{classLabel}', flare.classLabel)}
        </span>
        {date && <span className="text-slate-400">{date}</span>}
      </div>
      <p className="text-xs sm:text-sm text-slate-100 leading-snug">{flare.kid.short}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {truth ? (
          <span className="text-[11px] text-slate-400">{truth}</span>
        ) : (
          <span />
        )}
        <DetailTap promptLabel="Why?" detailText={flare.kid.detail} />
      </div>
    </div>
  );
};
