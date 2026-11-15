import React from 'react';

interface BarProps {
  value: number;
  max: number;
  label: string;
  color?: string;
}

export const Bar: React.FC<BarProps> = ({ value, max, label, color = 'bg-sky-400' }) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-400">{label}</span>
        <span className="text-white">{value}/{max}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};