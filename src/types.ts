export type IconName =
  | 'power'
  | 'oxygen'
  | 'health'
  | 'dirt'
  | 'heater'
  | 'air'
  | 'shield'
  | 'build'
  | 'moon'
  | 'sun'
  | 'flare'
  | 'ship'
  | 'clean'
  | 'treat'
  | 'exercise'
  | 'rover'
  | 'leak'
  | 'shelter'
  | 'warning'
  | 'check';

export type SkyState = 'day' | 'night' | 'flare' | 'dawn' | 'resupply';

export type DifficultyMode = 'cadet' | 'standard' | 'commander';

export interface MissionBadge {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

export interface TextPair {
  short: string;
  detail: string;
}

export interface ResourceDelta {
  power?: number;
  powerCap?: number;
  oxygen?: number;
  health?: number;
  moonDirt?: number;
  shield?: number;
  sick?: boolean;
  dustPenalty?: number;
  flareHalf?: boolean;
}

export interface ChoiceDefinition {
  id: string;
  icon: IconName;
  label: TextPair;
  costLabel: string;
  why: TextPair;
  immediate: ResourceDelta;
  delayed: ResourceDelta;
  delayedReason: TextPair;
  teaches?: string;
}

export interface RoundDefinition {
  round: number;
  chapter: number;
  chapterTitle: string;
  title: TextPair;
  situation: TextPair;
  sky: SkyState;
  warning?: TextPair;
  choices: ChoiceDefinition[];
  isTutorialArrow?: boolean;
}

export interface QueuedConsequence {
  id: string;
  sourceRound: number;
  dueRound: number;
  choiceId: string;
  choiceLabel: string;
  icon: IconName;
  delta: ResourceDelta;
  reason: TextPair;
}

export interface TraceEntry {
  round: number;
  stageTitle: string;
  choiceId: string;
  choiceLabel: string;
  icon: IconName;
  costLabel: string;
  immediateApplied: ResourceDelta;
  delayedScheduled: ResourceDelta;
  delayedReason: string;
  consequencesLanded: {
    sourceRound: number;
    choiceLabel: string;
    icon: IconName;
    reason: TextPair;
    delta: ResourceDelta;
  }[];
  scheduledEventNote?: string;
  endPower: number;
  endOxygen: number;
  endHealth: number;
  endMoonDirt: number;
}

export interface GameState {
  runId: string;
  seed: number;
  difficulty: DifficultyMode;
  round: number;
  maxRounds: number;
  power: number;
  powerCap: number;
  oxygen: number;
  oxygenCap: number;
  health: number;
  healthCap: number;
  moonDirt: number;
  shield: number;
  sick: boolean;
  dustDebuffRounds: number;
  queue: QueuedConsequence[];
  trace: TraceEntry[];
  lastResults: {
    sourceRound: number;
    choiceLabel: string;
    icon: IconName;
    reason: TextPair;
    delta: ResourceDelta;
  }[];
  scheduledEventMessage: TextPair | null;
  upkeepSummary: string | null;
  status: 'playing' | 'won' | 'partial' | 'lost';
  failureReason: 'oxygen' | 'health' | null;
  roundSchedule: RoundScheduleSlot[];
  liveFlareBonus?: number;
}

export interface RoundScheduleSlot {
  round: number;
  eventType:
    | 'moon_dirt_1'
    | 'heating'
    | 'moon_dirt_2'
    | 'clean_panels'
    | 'moon_dirt_3'
    | 'supply_delay'
    | 'heating_or_treat'
    | 'solar_flare'
    | 'exercise'
    | 'dig_ice'
    | 'air_leak';
  sky: SkyState;
  warningKey?: 'night_soon' | 'delay_soon' | 'flare_soon' | 'leak_soon';
}

export interface RoundView {
  round: number;
  maxRounds: number;
  chapter: number;
  chapterTitle: string;
  sky: SkyState;
  isNight: boolean;
  title: TextPair;
  situation: TextPair;
  warning: TextPair | null;
  choices: (ChoiceDefinition & { disabled: boolean; disabledReason?: string })[];
  showTutorialArrow: boolean;
  countdownDots: {
    roundsAway: 1 | 2 | 3;
    items: QueuedConsequence[];
  }[];
  lastResults: GameState['lastResults'];
  scheduledEventMessage: TextPair | null;
  upkeepSummary: string | null;
}

export interface ReportChainLink {
  round: number;
  icon: IconName;
  actionShort: string;
  costShort: string;
  consequenceShort: string;
  detail: string;
  impactScore: number;
}

export interface MissionReport {
  runId: string;
  seed: number;
  outcome: 'won' | 'partial' | 'lost';
  failureReason: 'oxygen' | 'health' | null;
  roundsSurvived: number;
  finalPower: number;
  finalOxygen: number;
  finalHealth: number;
  finalMoonDirt: number;
  finalShield: number;
  score: number;
  chainLines: ReportChainLink[];
  sacrificedSummary: string[];
  biggestLinkHint: TextPair;
  checkupApplied: {
    sourceRound: number;
    choiceLabel: string;
    reason: TextPair;
    delta: ResourceDelta;
  }[];
  badges: MissionBadge[];
}

export interface ScienceFact {
  id: string;
  topic: string;
  title: string;
  kidSummary: string;
  scienceDetail: string;
  nasaSourceName: string;
  nasaSourceUrl: string;
  relatedTerms: string[];
  /** ISO date (YYYY-MM-DD) on which the link was last checked by a human/script. */
  verifiedOn?: string;
  /** "dataset" when the link is the primary data source, "article" for a NASA/CSA page. */
  sourceKind?: 'dataset' | 'article';
}

export interface ScenarioData {
  meta: {
    title: string;
    subtitle: TextPair;
    location: TextPair;
    moonDirtNote: TextPair;
    powerAtZeroRule: TextPair;
    darkPeriodNote: string;
  };
  chapters: {
    id: number;
    title: string;
    rounds: string;
    summary: string;
  }[];
  warnings: Record<string, TextPair>;
  events: Record<string, {
    title: TextPair;
    situation: TextPair;
    choices: ChoiceDefinition[];
  }>;
  scheduledOutcomes: {
    flareHit: TextPair;
    resupplyArrived: TextPair;
    powerZeroPenalty: TextPair;
  };
}

export type OsdrTopic = 'bone' | 'radiation' | 'immune' | 'food';

export type NasaDataSource = 'live' | 'recorded' | 'fallback';

export interface NasaSpaceWeather {
  source: NasaDataSource;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
  activityLevel: 'Quiet' | 'Elevated' | 'Storm Watch';
  recommendedFlareBonus: number;
  cmeCount: number;
  maxCmeSpeedKmS: number;
  gstCount: number;
  maxKpIndex: number;
  sepCount: number;
  latestCme: {
    id: string;
    startTime: string;
    speedKmS: number | null;
    note: string;
    link: string;
  } | null;
  latestGst: {
    id: string;
    startTime: string;
    kpIndex: number;
    link: string;
  } | null;
  kidBrief: string;
  /** ISO date of the real recording when source is "recorded". */
  recordedOn?: string;
  /** Short, calm explanation when the payload is recorded or neutral. */
  note?: string;
}

export interface RadLabSample {
  timestamp: string;
  instrumentId: string;
  absorbedDoseRate: number;
  flux: number | null;
}

export interface RadLabSummary {
  source: NasaDataSource;
  spacecraft: string;
  instruments: string[];
  sampleCount: number;
  avgDoseMicroGyHr: number;
  minDoseMicroGyHr: number;
  peakDoseMicroGyHr: number;
  samples: RadLabSample[];
  kidTakeaway: string;
  portalUrl: string;
  /** The real recording window this reading came from. It is never live. */
  observedWindow: { start: string; end: string };
  fetchedAt: string;
  recordedOn?: string;
  note?: string;
}

export interface OsdrStudy {
  accession: string;
  title: string;
  organism: string;
  flightProgram: string;
  summary: string;
  url: string;
}

export interface OsdrResponse {
  source: NasaDataSource;
  topic: OsdrTopic;
  totalHits: number;
  studies: OsdrStudy[];
  fetchedAt: string;
  recordedOn?: string;
  note?: string;
}

/** A real DONKI solar flare record (FLR). Presentation only: it never changes damage. */
export interface NasaFlare {
  id: string;
  beginTime: string;
  peakTime: string | null;
  classType: string;
  classLabel: string;
  tier: 'mild' | 'medium' | 'strong';
  sourceLocation: string | null;
  link: string;
  kid: TextPair;
}

export interface NasaFlareWindow {
  source: NasaDataSource;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
  featured: NasaFlare | null;
  counts: { c: number; m: number; x: number };
  flares: NasaFlare[];
  recordedOn?: string;
  note?: string;
}

export interface NasaProvenance {
  dataset: string;
  url: string;
  window: string;
  fetchedAt: string;
}

/**
 * One whole UTC day of NASA mission data. Everyone who plays on the same UTC
 * day receives this exact object, so a classroom shares one scenario and a
 * same-day retry can never change difficulty.
 */
export interface NasaSnapshot {
  snapshotId: string;
  generatedAt: string;
  source: NasaDataSource | 'unavailable';
  bonus: 0 | 5 | 10;
  spaceWeather: NasaSpaceWeather | null;
  flare: NasaFlare | null;
  radiation: RadLabSummary | null;
  provenance: NasaProvenance[];
  /** ISO date of the real recording when source is "recorded". */
  recordedOn?: string;
  note?: string;
}
