import { z } from 'zod';

/**
 * Upstream NASA payload schemas. Every field is optional because DONKI, OSDR
 * and RadLab all omit fields freely; the parsers then drop items that cannot
 * produce an honest, complete record. Extra fields are allowed: NASA adds
 * columns without warning.
 */

const shortText = z.string().max(256);
const longText = z.string().max(20_000);
const linkText = z.string().max(2048);

export const donkiCmeItemSchema = z
  .object({
    activityID: shortText.optional(),
    startTime: shortText.optional(),
    note: longText.optional(),
    link: linkText.optional(),
    // Validated element-by-element in the parser: a malformed nested array must
    // not throw away an otherwise usable CME record.
    cmeAnalyses: z.unknown().optional(),
  })
  .passthrough();

export const donkiGstItemSchema = z
  .object({
    gstID: shortText.optional(),
    startTime: shortText.optional(),
    link: linkText.optional(),
    allKpIndex: z.unknown().optional(),
  })
  .passthrough();

export const donkiSepItemSchema = z
  .object({
    sepID: shortText.optional(),
    eventTime: shortText.optional(),
    link: linkText.optional(),
  })
  .passthrough();

export const donkiFlrItemSchema = z
  .object({
    flrID: shortText.optional(),
    beginTime: shortText.optional(),
    peakTime: shortText.optional(),
    endTime: shortText.nullable().optional(),
    classType: shortText.optional(),
    sourceLocation: shortText.optional(),
    activeRegionNum: z.number().finite().nullable().optional(),
    link: linkText.optional(),
  })
  .passthrough();

export const radlabRawSchema = z.object({
  columns: z.array(z.string().max(128)).min(1).max(64),
  // Cells are validated individually in the parser: RadLab returns NaN and
  // mixed types, and one bad cell must not discard the whole recording.
  data: z.array(z.array(z.unknown())).max(100_000),
});

export const osdrHitSchema = z
  .object({
    _id: shortText.optional(),
    _source: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const osdrSearchSchema = z.object({
  hits: z
    .object({
      total: z.union([z.number(), z.object({ value: z.number() }).passthrough()]).optional(),
      hits: z.array(osdrHitSchema).max(100).optional(),
    })
    .passthrough()
    .optional(),
});

/** Shape of `src/content/nasa-recorded.json`, written only by record:nasa. */
export const recordedFileSchema = z.object({
  recordedOn: z.string().min(10).max(40),
  window: z.object({
    start: z.string().min(10).max(40),
    end: z.string().min(10).max(40),
  }),
  radlabWindow: z
    .object({
      start: z.string().min(10).max(40),
      end: z.string().min(10).max(40),
    })
    .optional(),
  donki: z.object({
    cme: z.unknown(),
    gst: z.unknown(),
    sep: z.unknown(),
    flr: z.unknown(),
  }),
  radlab: z.unknown().nullable().optional(),
  osdr: z.record(z.string(), z.unknown()).optional(),
});

export const bonusSchema = z.union([z.literal(0), z.literal(5), z.literal(10)]);
export const dataSourceSchema = z.enum(['live', 'recorded', 'fallback']);
const dateText = z.string().min(10).max(40);

export const textPairSchema = z.object({
  short: z.string().max(400),
  detail: z.string().max(800),
});

export const flareSchema = z
  .object({
    id: z.string().min(1).max(128),
    beginTime: dateText,
    peakTime: dateText.nullable(),
    classType: z.string().min(1).max(32),
    classLabel: z.string().min(1).max(2),
    tier: z.enum(['mild', 'medium', 'strong']),
    sourceLocation: z.string().max(64).nullable(),
    link: z.string().max(2048),
    kid: textPairSchema,
  })
  .passthrough();

export const spaceWeatherSchema = z
  .object({
    source: dataSourceSchema,
    windowStart: z.string().max(40),
    windowEnd: z.string().max(40),
    fetchedAt: dateText,
    activityLevel: z.enum(['Quiet', 'Elevated', 'Storm Watch']),
    recommendedFlareBonus: bonusSchema,
    cmeCount: z.number().int().min(0),
    maxCmeSpeedKmS: z.number().min(0),
    gstCount: z.number().int().min(0),
    maxKpIndex: z.number().min(0).max(9),
    sepCount: z.number().int().min(0),
    latestCme: z
      .object({
        id: z.string(),
        startTime: z.string(),
        speedKmS: z.number().nullable(),
        note: z.string(),
        link: z.string(),
      })
      .passthrough()
      .nullable(),
    latestGst: z
      .object({
        id: z.string(),
        startTime: z.string(),
        kpIndex: z.number(),
        link: z.string(),
      })
      .passthrough()
      .nullable(),
    kidBrief: z.string().max(400),
    recordedOn: z.string().max(40).optional(),
    note: z.string().max(300).optional(),
  })
  .passthrough();

export const radlabSummarySchema = z
  .object({
    source: dataSourceSchema,
    spacecraft: z.string().max(120),
    instruments: z.array(z.string().max(64)).max(16),
    sampleCount: z.number().int().min(0),
    avgDoseMicroGyHr: z.number().min(0),
    minDoseMicroGyHr: z.number().min(0),
    peakDoseMicroGyHr: z.number().min(0),
    samples: z
      .array(
        z
          .object({
            timestamp: z.string().max(40),
            instrumentId: z.string().max(64),
            absorbedDoseRate: z.number(),
            flux: z.number().nullable(),
          })
          .passthrough()
      )
      .max(16),
    kidTakeaway: z.string().max(600),
    portalUrl: z.string().max(2048),
    observedWindow: z.object({ start: z.string().max(40), end: z.string().max(40) }),
    fetchedAt: dateText,
    recordedOn: z.string().max(40).optional(),
    note: z.string().max(300).optional(),
  })
  .passthrough();

export const provenanceSchema = z.object({
  dataset: z.string().min(1).max(80),
  url: z.string().max(2048),
  window: z.string().max(120),
  fetchedAt: dateText,
});

export const snapshotFileSchema = z
  .object({
    snapshotId: z.string().min(10).max(10),
    generatedAt: dateText,
    source: z.enum(['live', 'recorded', 'fallback', 'unavailable']),
    bonus: bonusSchema,
    spaceWeather: spaceWeatherSchema.nullable(),
    flare: flareSchema.nullable(),
    radiation: radlabSummarySchema.nullable(),
    provenance: z.array(provenanceSchema).max(20),
    recordedOn: z.string().max(40).optional(),
    note: z.string().max(300).optional(),
  })
  .passthrough();

export type RecordedFile = z.infer<typeof recordedFileSchema>;
