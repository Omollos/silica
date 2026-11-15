import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import kidJson from '../src/content/nasaKid.json';

/**
 * Guards the two rules that keep NASA text safe for a 7-12 year old:
 *   1. every curated string is short (no sentence over 15 words) and free of
 *      frightening words;
 *   2. no child-facing component renders raw NASA free text (`.note`,
 *      `.summary`, "Study Description").
 *
 * Run with `bun run check:kid-text`; also imported by the test suite.
 */

const MAX_WORDS = 15;
const BANNED = /\b(dead|died|dying|killed|deadly|kill|kills|danger zone)\b/i;

const CHILD_FACING_FILES = [
  'src/ui/ScienceLibraryModal.tsx',
  'src/ui/FlareBriefing.tsx',
  'src/screens/round/CrewComms.tsx',
  'src/screens/round/EventBanner.tsx',
  'src/screens/end/MissionReport.tsx',
  'src/screens/title/TitleScreen.tsx',
];

const RAW_FIELD_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /\{[^}]*\.note\b[^}]*\}/, why: 'renders a raw .note field' },
  { pattern: /\{[^}]*\.summary\b[^}]*\}/, why: 'renders a raw .summary field' },
  { pattern: /Study Description/, why: 'mentions Study Description' },
  { pattern: /Study Protocol Description/, why: 'mentions Study Protocol Description' },
];

function collectStrings(value: unknown, prefix = ''): { key: string; text: string }[] {
  if (typeof value === 'string') return [{ key: prefix || 'root', text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${prefix}[${index}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      collectStrings(item, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [];
}

function wordCount(sentence: string): number {
  const normalized = sentence.replace(/\{[^}]*\}/g, 'VALUE');
  return normalized.trim().split(/\s+/).filter(Boolean).length;
}

export function checkKidText(): string[] {
  const problems: string[] = [];

  for (const entry of collectStrings(kidJson)) {
    if (BANNED.test(entry.text)) {
      problems.push(`${entry.key}: banned word in "${entry.text}"`);
    }
    const sentences = entry.text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const words = wordCount(sentence);
      if (words > MAX_WORDS) {
        problems.push(
          `${entry.key}: ${words} words (max ${MAX_WORDS}) in "${sentence.trim()}"`
        );
      }
    }
  }

  for (const relative of CHILD_FACING_FILES) {
    let source: string;
    try {
      source = readFileSync(path.resolve(process.cwd(), relative), 'utf8');
    } catch {
      continue;
    }
    for (const { pattern, why } of RAW_FIELD_PATTERNS) {
      if (pattern.test(source)) {
        problems.push(`${relative}: ${why}`);
      }
    }
  }

  return problems;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const problems = checkKidText();
  if (problems.length === 0) {
    process.stdout.write('Kid text OK: all strings are short and child-safe.\n');
  } else {
    for (const problem of problems) process.stdout.write(`FAIL  ${problem}\n`);
    process.exit(1);
  }
}
