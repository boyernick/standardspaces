/**
 * Thin structured logger. Writes one JSON line per call on Vercel so the
 * runtime logs UI and `vercel logs` render as key/value rather than an
 * opaque string. Falls back to `console` formatting in dev for
 * readability. Once Sentry is wired up, `log.error` becomes the natural
 * hook for `captureException`.
 *
 * Usage:
 *   log.info("spot.published", { spotId, city });
 *   log.warn("scraper.fallback", { reason: "cloudflare_block" });
 *   log.error("publish.failed", err, { recommendationId });
 */

type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

const isDev = process.env.NODE_ENV !== "production";

function emit(level: Level, msg: string, fields?: Fields, err?: unknown) {
  const entry: Fields = { level, msg, ...fields };
  if (err instanceof Error) {
    entry.err = { name: err.name, message: err.message, stack: err.stack };
  } else if (err !== undefined) {
    entry.err = err;
  }

  // In dev, colorless but readable: "[level] msg { ...fields }".
  // In prod (Vercel), one JSON object per line so log aggregators and
  // the Vercel UI can parse fields out.
  const sink =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (isDev) {
    sink(`[${level}] ${msg}`, fields ?? "", err instanceof Error ? err : "");
  } else {
    sink(JSON.stringify(entry));
  }
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  /**
   * `err` is the exception/cause, `fields` is additional context.
   * Both optional so `log.error("msg")` is valid.
   */
  error: (msg: string, err?: unknown, fields?: Fields) =>
    emit("error", msg, fields, err),
};
