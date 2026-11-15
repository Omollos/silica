import React from 'react';
import { ScienceFact } from '../types';

interface ScienceLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_FACTS: ScienceFact[] = [
  {
    id: '1',
    topic: 'radiation',
    title: 'Solar Radiation',
    kidSummary: 'The Sun sends out energy that can be harmful in space.',
    scienceDetail: 'Solar flares release bursts of radiation that can damage electronics and harm astronauts without proper shielding.',
    nasaSourceName: 'NASA Space Weather',
    nasaSourceUrl: 'https://www.nasa.gov/spaceweather',
    relatedTerms: ['solar flare', 'radiation', 'magnetosphere'],
  },
  {
    id: '2',
    topic: 'lunar-night',
    title: 'Lunar Night',
    kidSummary: 'The Moon has very long days and nights.',
    scienceDetail: 'A lunar day lasts about 14 Earth days, followed by 14 days of night. Temperatures drop dramatically during the lunar night.',
    nasaSourceName: 'NASA Moon Facts',
    nasaSourceUrl: 'https://www.nasa.gov/moon',
    relatedTerms: ['lunar day', 'temperature', 'crater'],
  },
];

export const ScienceLibraryModal: React.FC<ScienceLibraryModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">
            Science Library
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-slate-300">
            Learn about the real science behind lunar missions and space exploration.
          </p>
          <div className="space-y-3">
            {SAMPLE_FACTS.map(fact => (
              <div
                key={fact.id}
                className="rounded-xl bg-slate-950/75 border border-slate-800 p-4"
              >
                <h3 className="font-bold text-sky-300 mb-2">
                  {fact.title}
                </h3>
                <p className="text-sm text-slate-300 mb-2">
                  {fact.kidSummary}
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  {fact.scienceDetail}
                </p>
                <div className="flex flex-wrap gap-2">
                  {fact.relatedTerms.map(term => (
                    <span
                      key={term}
                      className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300"
                    >
                      {term}
                    </span>
                  ))}
                </div>
                <a
                  href={fact.nasaSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 underline mt-2 inline-block"
                >
                  {fact.nasaSourceName} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};