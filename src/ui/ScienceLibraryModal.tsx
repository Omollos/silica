import React, { useEffect } from 'react';
import factsData from '../content/facts.json';
import { ScienceFact } from '../types';

interface ScienceLibraryModalProps {
  onClose: () => void;
}

const facts: ScienceFact[] = factsData;

export const ScienceLibraryModal: React.FC<ScienceLibraryModalProps> = ({
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="science-library-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#070b14] border border-sky-400/50 p-5 sm:p-7 shadow-2xl">
        <header className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300">
              Mission science
            </p>
            <h2
              id="science-library-title"
              className="font-display text-2xl sm:text-3xl font-extrabold text-white"
            >
              Science Library
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {facts.map(fact => (
            <article
              key={fact.id}
              className="rounded-xl bg-slate-900/80 border border-slate-700 p-4 space-y-2"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                {fact.topic}
              </p>
              <h3 className="font-bold text-white">{fact.title}</h3>
              <p className="text-sm text-slate-200 leading-relaxed">
                {fact.kidSummary}
              </p>
              <details className="text-sm text-slate-300">
                <summary className="cursor-pointer font-semibold text-slate-200">
                  Explore the science
                </summary>
                <p className="mt-2 leading-relaxed">{fact.scienceDetail}</p>
              </details>
              <a
                href={fact.nasaSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2"
              >
                Source: {fact.nasaSourceName}
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};