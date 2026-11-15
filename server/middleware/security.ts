import type { RequestHandler } from 'express';
import helmet from 'helmet';
import type { AppConfig } from '../config';

/**
 * CSP tuned for this app: same-origin Vite assets, Tailwind's inline styles,
 * Google Fonts used by index.html, and a WebGL canvas. No third-party scripts.
 * Verified against the production build and recorded in docs/backend/decisions.md.
 */
export interface SecurityHeaderOptions {
  /** Vite's dev React-refresh preamble is an inline module script. */
  allowInlineScripts?: boolean;
}

export function securityHeaders(options: SecurityHeaderOptions = {}): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: options.allowInlineScripts ? ["'self'", "'unsafe-inline'"] : ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  });
}

/**
 * The app is served from the same origin as its API, so by default no CORS
 * headers are emitted at all. If CORS_ORIGINS is set, allow only those origins
 * for GET, PUT and OPTIONS.
 */
export function corsMiddleware(origins: string[]): RequestHandler {
  if (origins.length === 0) {
    return (_req, _res, next) => next();
  }
  const allowed = new Set(origins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }
    }
    next();
  };
}

export function buildSecurityMiddleware(config: AppConfig): RequestHandler[] {
  return [
    // Production stays strict; development needs Vite's inline refresh preamble.
    securityHeaders({ allowInlineScripts: config.nodeEnv !== 'production' }),
    corsMiddleware(config.corsOrigins),
  ];
}