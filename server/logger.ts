export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  level: LogLevel;
  /** Injectable sink so tests can capture output without touching stdout. */
  sink?: (line: string) => void;
}

/**
 * One JSON object per line. Callers only pass non-identifying fields: this
 * logger never receives IP addresses, request bodies, query strings or names.
 */
export function createLogger(options: LoggerOptions): Logger {
  const threshold = LEVEL_WEIGHT[options.level];
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));

  const emit = (level: Exclude<LogLevel, 'silent'>, message: string, fields?: LogFields) => {
    if (LEVEL_WEIGHT[level] < threshold) return;
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: message,
    };
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) entry[key] = value;
      }
    }
    try {
      sink(JSON.stringify(entry));
    } catch {
      // Logging must never crash a request.
    }
  };

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
  };
}

export const silentLogger: Logger = createLogger({ level: 'silent', sink: () => undefined });
