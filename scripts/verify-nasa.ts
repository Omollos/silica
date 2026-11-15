import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import factsJson from '../src/content/facts.json';
import { loadConfig } from '../server/config';
import {
  parseDonkiCme,
  parseDonkiFlr,
  parseDonkiGst,
  parseDonkiSep,
  parseOsdr,
  parseRadlab,
  pickFeaturedFlare,
} from '../server/nasa/parsers';
import { readRecordedFile } from '../server/nasa/recorded';
import { NasaSnapshotService } from '../server/nasa/snapshot';
import {
  donkiUrl,
  fetchJsonWithTimeout,
  last28DayWindow,
  osdrUrl,
  radlabUrl,
  radlabWindow,
  TOPIC_QUERIES,
} from '../server/nasa/upstream';
import type { OsdrTopic, ScienceFact } from '../src/types';

/**
 * Manual, network-using verification for the repo owner:
 *   bun run verify:nasa
 *
 * Every row is checked against the live network with the real key. The script
 * exits non-zero if any row fails, so it is safe to use before a demo.
 */

interface Row {
  check: string;
  ok: boolean;
  detail: string;
}

const rows: Row[] = [];

function record(check: string, ok: boolean, detail: string): void {
  rows.push({ check, ok, detail });
}

const FACTS = factsJson as ScienceFact[];

function curlStatus(url: string): number {
  // Some hosts block Node's fetch (or the process sits behind a proxy that only
  // curl uses). A link check is about the link, so retry with curl once.
  const result = spawnSync(
    'curl',
    ['-s', '-o', '/dev/null', '-L', '--max-time', '20', '-w', '%{http_code}', url],
    { encoding: 'utf8' }
  );
  if (result.error) return 0;
  const code = Number(String(result.stdout).trim());
  return Number.isFinite(code) ? code : 0;
}

async function httpStatus(url: string): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'SilicaStationVerify/1.0 (+NASA Space Apps)' },
    });
    return response.status;
  } catch {
    return curlStatus(url);
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrls(label: string, urls: string[]): Promise<void> {
  const unique = Array.from(new Set(urls.filter(url => /^https:\/\//.test(url))));
  for (const url of unique) {
    let status = await httpStatus(url);
    // NASA/CDN hosts occasionally time out or return a transient 5xx; retry once.
    if (status === 0 || status >= 500) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      status = await httpStatus(url);
    }
    const ok = status >= 200 && status < 300;
    record(`${label}: ${url}`, ok, `HTTP ${status || 'unreachable'}`);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const window = last28DayWindow(Date.now());
  const radWindow = radlabWindow(config);
  const timeout = Math.max(config.nasaFetchTimeoutMs, 9000);
  const fetchJson = (url: string) => fetchJsonWithTimeout(fetch, url, timeout);
  const topics: OsdrTopic[] = ['bone', 'radiation', 'immune', 'food'];

  // 1. DONKI endpoints ------------------------------------------------------
  let cme: ReturnType<typeof parseDonkiCme> | null = null;
  let gst: ReturnType<typeof parseDonkiGst> | null = null;
  let sep: ReturnType<typeof parseDonkiSep> | null = null;
  let flares: ReturnType<typeof parseDonkiFlr> = [];

  try {
    const raw = await fetchJson(donkiUrl('CME', window.start, window.end, config.nasaApiKey));
    cme = parseDonkiCme(raw);
    record('DONKI CME', Array.isArray(raw), `${cme.count} CMEs parsed`);
  } catch (error) {
    record('DONKI CME', false, String(error));
  }

  try {
    const raw = await fetchJson(donkiUrl('GST', window.start, window.end, config.nasaApiKey));
    gst = parseDonkiGst(raw);
    record('DONKI GST', Array.isArray(raw), `${gst.count} storms parsed, max Kp ${gst.maxKpIndex}`);
  } catch (error) {
    record('DONKI GST', false, String(error));
  }

  try {
    const raw = await fetchJson(donkiUrl('SEP', window.start, window.end, config.nasaApiKey));
    sep = parseDonkiSep(raw);
    record('DONKI SEP', Array.isArray(raw), `${sep.count} events parsed`);
  } catch (error) {
    record('DONKI SEP', false, String(error));
  }

  try {
    const raw = await fetchJson(donkiUrl('FLR', window.start, window.end, config.nasaApiKey));
    flares = parseDonkiFlr(raw);
    const featured = pickFeaturedFlare(flares);
    record(
      'DONKI FLR',
      Array.isArray(raw) && (flares.length === 0 || featured !== null),
      `${flares.length} flares, featured ${featured ? `class ${featured.classType}` : 'none'}`
    );
  } catch (error) {
    record('DONKI FLR', false, String(error));
  }

  // 2. RadLab ---------------------------------------------------------------
  let radlabOk = false;
  try {
    const raw = await fetchJson(radlabUrl(radWindow));
    const parsed = parseRadlab(raw, {
      observedWindow: radWindow,
      fetchedAt: new Date().toISOString(),
    });
    radlabOk = parsed !== null && parsed.sampleCount > 0;
    record(
      'OSDR RadLab window',
      radlabOk,
      parsed
        ? `${parsed.sampleCount} rows with absorbed_dose_rate, peak ${parsed.peakDoseMicroGyHr} µGy/h`
        : 'no parseable absorbed_dose_rate rows'
    );
  } catch (error) {
    record('OSDR RadLab window', false, String(error));
  }

  // 3. OSDR search per topic -----------------------------------------------
  const studyUrls: string[] = [];
  for (const topic of topics) {
    try {
      const raw = await fetchJson(osdrUrl(topic));
      const parsed = parseOsdr(raw, topic, { fetchedAt: new Date().toISOString() });
      const ok = parsed.studies.length > 0;
      studyUrls.push(...parsed.studies.map(study => study.url).slice(0, 2));
      record(
        `OSDR search (${topic})`,
        ok,
        `${parsed.studies.length} parseable studies for "${TOPIC_QUERIES[topic]}"`
      );
    } catch (error) {
      record(`OSDR search (${topic})`, false, String(error));
    }
  }

  // 4. Facts and stable links ----------------------------------------------
  await checkUrls('facts.json', FACTS.map(fact => fact.nasaSourceUrl));
  await checkUrls('stable NASA link', [
    'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    'https://visualization.osdr.nasa.gov/',
    'https://api.nasa.gov/',
  ]);
  await checkUrls('OSDR study', studyUrls);

  // 5. Production key ------------------------------------------------------
  const production = (process.env.NODE_ENV ?? 'development') === 'production';
  const demoKey = config.nasaApiKey === 'DEMO_KEY';
  record(
    'NASA_API_KEY not DEMO_KEY in production',
    production ? !demoKey : true,
    production ? (demoKey ? 'DEMO_KEY in production' : 'real key') : 'NODE_ENV is not production'
  );

  // 6. Daily snapshot builds ------------------------------------------------
  try {
    const snapshot = await new NasaSnapshotService({
      config: { ...config, nasaSnapshotDir: '' },
      nasaFetch: (url, init) => fetch(url, init),
      now: () => Date.now(),
      recorded: readRecordedFile(),
    }).get();
    const ok =
      snapshot.data.source !== 'unavailable' &&
      (snapshot.data.spaceWeather !== null || snapshot.data.flare !== null);
    record(
      'Daily snapshot builds',
      ok,
      `source=${snapshot.data.source} id=${snapshot.data.snapshotId} bonus=${snapshot.data.bonus}`
    );

    const responseUrls: string[] = snapshot.data.provenance.map(entry => entry.url);
    if (snapshot.data.flare) responseUrls.push(snapshot.data.flare.link);
    if (snapshot.data.radiation) responseUrls.push(snapshot.data.radiation.portalUrl);
    if (snapshot.data.spaceWeather?.latestCme) {
      responseUrls.push(snapshot.data.spaceWeather.latestCme.link);
    }
    if (snapshot.data.spaceWeather?.latestGst) {
      responseUrls.push(snapshot.data.spaceWeather.latestGst.link);
    }
    await checkUrls('server response link', responseUrls);
  } catch (error) {
    record('Daily snapshot builds', false, String(error));
  }

  // Print the table --------------------------------------------------------
  const width = Math.max(...rows.map(row => row.check.length));
  for (const row of rows) {
    process.stdout.write(
      `${row.ok ? 'PASS' : 'FAIL'}  ${row.check.padEnd(width)}  ${row.detail}\n`
    );
  }
  const failures = rows.filter(row => !row.ok).length;
  process.stdout.write(
    `\n${rows.length - failures}/${rows.length} checks passed${
      failures > 0 ? ` — ${failures} failed` : ''
    }\n`
  );
  if (failures > 0) process.exit(1);
}

main().catch(error => {
  process.stderr.write(`verify:nasa crashed: ${String(error)}\n`);
  process.exit(1);
});
