import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../server/config';
import {
  parseDonkiCme,
  parseDonkiFlr,
  parseDonkiGst,
  parseDonkiSep,
  parseOsdr,
  parseRadlab,
} from '../server/nasa/parsers';
import {
  donkiUrl,
  fetchJsonWithTimeout,
  last28DayWindow,
  osdrUrl,
  radlabUrl,
  radlabWindow,
  TOPIC_QUERIES,
} from '../server/nasa/upstream';
import type { OsdrTopic } from '../src/types';

/**
 * Records one day of real NASA data for offline demos.
 *
 * Run it with a real key in `.env`:
 *   bun run record:nasa
 *
 * Nothing is invented here: every byte written comes from a NASA response that
 * passed the same validation the server uses. If any call fails the script
 * exits non-zero and writes nothing, so a half-recorded file can never ship.
 */

const OUTPUT = path.resolve(process.cwd(), 'src/content/nasa-recorded.json');
const TOPICS: OsdrTopic[] = ['bone', 'radiation', 'immune', 'food'];

async function main(): Promise<void> {
  const config = loadConfig();
  const window = last28DayWindow(Date.now());
  const radWindow = radlabWindow(config);
  const timeout = Math.max(config.nasaFetchTimeoutMs, 9000);

  process.stdout.write(
    `Recording NASA data for ${window.start}..${window.end} with key ${
      config.nasaApiKey === 'DEMO_KEY' ? 'DEMO_KEY (rate limited!)' : 'from NASA_API_KEY'
    }\n`
  );
  if (config.nasaApiKey === 'DEMO_KEY') {
    process.stdout.write(
      'Warning: DEMO_KEY is limited to about 30 requests per hour. A real key is recommended for record:nasa.\n'
    );
  }

  const fetchJson = (url: string) => fetchJsonWithTimeout(fetch, url, timeout);
  const arrayOrThrow = (raw: unknown, label: string): unknown[] => {
    if (!Array.isArray(raw)) {
      throw new Error(`${label} did not return a JSON array`);
    }
    return raw;
  };

  const [cmeRaw, gstRaw, sepRaw, flrRaw] = await Promise.all([
    fetchJson(donkiUrl('CME', window.start, window.end, config.nasaApiKey)),
    fetchJson(donkiUrl('GST', window.start, window.end, config.nasaApiKey)),
    fetchJson(donkiUrl('SEP', window.start, window.end, config.nasaApiKey)),
    fetchJson(donkiUrl('FLR', window.start, window.end, config.nasaApiKey)),
  ]);
  arrayOrThrow(cmeRaw, 'DONKI/CME');
  arrayOrThrow(gstRaw, 'DONKI/GST');
  arrayOrThrow(sepRaw, 'DONKI/SEP');
  arrayOrThrow(flrRaw, 'DONKI/FLR');

  const cme = parseDonkiCme(cmeRaw);
  const gst = parseDonkiGst(gstRaw);
  const sep = parseDonkiSep(sepRaw);
  const flares = parseDonkiFlr(flrRaw);
  process.stdout.write(
    `DONKI: ${cme.count} CMEs, ${gst.count} geomagnetic storms, ${sep.count} solar particle events, ${flares.length} flares\n`
  );

  const radlabRaw = await fetchJson(radlabUrl(radWindow));
  const radlab = parseRadlab(radlabRaw, {
    observedWindow: radWindow,
    fetchedAt: new Date().toISOString(),
  });
  if (!radlab || radlab.sampleCount === 0) {
    throw new Error('RadLab returned no usable absorbed_dose_rate rows');
  }
  process.stdout.write(
    `RadLab: ${radlab.sampleCount} readings, peak ${radlab.peakDoseMicroGyHr} µGy/h (${radWindow.start}..${radWindow.end})\n`
  );

  const osdr: Partial<Record<OsdrTopic, unknown>> = {};
  for (const topic of TOPICS) {
    const raw = await fetchJson(osdrUrl(topic));
    const parsed = parseOsdr(raw, topic, { fetchedAt: new Date().toISOString() });
    if (parsed.studies.length === 0) {
      throw new Error(`OSDR search for "${TOPIC_QUERIES[topic]}" returned no parseable studies`);
    }
    osdr[topic] = raw;
    process.stdout.write(`OSDR ${topic}: ${parsed.studies.length} studies\n`);
  }

  const recorded = {
    recordedOn: new Date().toISOString(),
    window,
    radlabWindow: radWindow,
    donki: { cme: cmeRaw, gst: gstRaw, sep: sepRaw, flr: flrRaw },
    radlab: radlabRaw,
    osdr,
    source: 'record:nasa',
  };

  await writeFile(OUTPUT, `${JSON.stringify(recorded, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${path.relative(process.cwd(), OUTPUT)}\n`);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`record:nasa failed: ${message}\nNothing was written.\n`);
  process.exit(1);
});
