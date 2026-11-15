import React from 'react';
import { TextPair } from '../types';

interface EventBannerProps {
  title: TextPair;
  situation: TextPair;
  warning?: TextPair | null;
}

export const EventBanner: React.FC<EventBannerProps> = ({ title, situation, warning }) => {
  return (
    <div className="space-y-3">
      {warning && (
        <div className="rounded-2xl bg-amber-950/50 border-2 border-amber-500/75 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">⚠️</span>
            <h3 className="font-display text-lg font-bold text-amber-200">
              Warning
            </h3>
          </div>
          <p className="text-sm text-amber-100 font-semibold">
            {warning.short}
          </p>
          <p className="text-xs text-amber-200/80 mt-1">
            {warning.detail}
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4">
        <h2 className="font-display text-2xl font-extrabold text-white mb-2">
          {title.short}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          {situation.detail}
        </p>
      </div>
    </div>
  );
};