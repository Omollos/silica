import React from 'react';
import { StationIcon } from '../ui/icons';
import { ResourceDelta } from '../types';

interface ResultLineProps {
  label: string;
  delta: ResourceDelta;
  icon: string;
}

export const ResultLine: React.FC<ResultLineProps> = ({ label, delta, icon }) => {
  const parts: string[] = [];

  if (delta.power) parts.push(`${delta.power > 0 ? '+' : ''}${delta.power} power`);
  if (delta.oxygen) parts.push(`${delta.oxygen > 0 ? '+' : ''}${delta.oxygen} O2`);
  if (delta.health) parts.push(`${delta.health > 0 ? '+' : ''}${delta.health} health`);
  if (delta.moonDirt) parts.push(`${delta.moonDirt > 0 ? '+' : ''}${delta.moonDirt} dirt`);
  if (delta.shield) parts.push(`${delta.shield > 0 ? '+' : ''}${delta.shield} shield`);

  const isNegative = Object.values(delta).some(v => v !== undefined && v < 0);

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm">
      <StationIcon name={icon as any} className="w-4 h-4 shrink-0" />
      <span className="text-slate-300">{label}:</span>
      <span className={isNegative ? 'text-rose-300 font-semibold' : 'text-emerald-300 font-semibold'}>
        {parts.join(', ')}
      </span>
    </div>
  );
};