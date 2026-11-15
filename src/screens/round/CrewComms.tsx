import React from 'react';
import { Bar } from '../ui/Bar';

interface CrewCommsProps {
  power: number;
  oxygen: number;
  health: number;
  moonDirt: number;
}

export const CrewComms: React.FC<CrewCommsProps> = ({ power, oxygen, health, moonDirt }) => {
  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 space-y-3">
      <h3 className="font-display text-lg font-bold text-white">
        Crew Status
      </h3>
      <div className="space-y-2">
        <Bar value={power} max={100} label="Power" color="bg-amber-400" />
        <Bar value={oxygen} max={85} label="Oxygen" color="bg-sky-400" />
        <Bar value={health} max={100} label="Health" color="bg-rose-400" />
        <Bar value={moonDirt} max={50} label="Moon Dirt" color="bg-slate-400" />
      </div>
    </div>
  );
};