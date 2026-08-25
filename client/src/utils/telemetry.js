/**
 * Telemetry seams.
 *
 * The Application Insights resources for this project were retired on
 * 2026-08-25, along with their connection strings, so there is nothing for a
 * provider SDK to talk to. The `@microsoft/applicationinsights-web` dependency
 * was removed with them.
 *
 * The instrumentation points themselves are kept. There are 21 of them across
 * the map, chart, download and CSV-cache modules, several covered by tests that
 * assert the error paths report. Deleting the calls would cost that coverage
 * and make re-adding observability a 21-site change.
 *
 * With no sink registered every `track*` call is inert and returns false. To
 * turn telemetry back on, provision a provider and call
 * `registerTelemetrySink()` once during start-up; nothing else has to change.
 */

let sink = null;
let initialized = false;

function serializeValue(value) {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function normalizeProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .map(([key, value]) => [key, serializeValue(value)])
      .filter(([, value]) => value !== undefined)
  );
}

/**
 * Register a telemetry provider. Expects an object with any of
 * `trackEvent(name, properties, measurements)`,
 * `trackException(error, properties)` and
 * `trackMetric(name, value, properties)`.
 */
export function registerTelemetrySink(nextSink) {
  sink = nextSink || null;
  initialized = Boolean(sink);
  return sink;
}

export function initializeTelemetry() {
  initialized = Boolean(sink);
  return sink;
}

export function isTelemetryEnabled() {
  return Boolean(sink);
}

export function trackEvent(name, properties = {}, measurements) {
  if (!sink || typeof sink.trackEvent !== "function" || !name) {
    return false;
  }

  sink.trackEvent(name, normalizeProperties(properties), measurements);
  return true;
}

export function trackException(error, properties = {}) {
  if (!sink || typeof sink.trackException !== "function" || !error) {
    return false;
  }

  const exception =
    error instanceof Error ? error : new Error(serializeValue(error) || "Unknown error");

  sink.trackException(exception, normalizeProperties(properties));
  return true;
}

export function trackMetric(name, value, properties = {}) {
  if (
    !sink ||
    typeof sink.trackMetric !== "function" ||
    !name ||
    !Number.isFinite(value)
  ) {
    return false;
  }

  sink.trackMetric(name, value, normalizeProperties(properties));
  return true;
}

export function trackWebVital(metric) {
  if (!metric || !metric.name || !Number.isFinite(metric.value)) {
    return false;
  }

  return trackMetric(metric.name, metric.value, {
    id: metric.id,
    navigationType: metric.navigationType,
    rating: metric.rating,
    delta: Number.isFinite(metric.delta) ? metric.delta : undefined,
  });
}

export function resetTelemetryForTests() {
  sink = null;
  initialized = false;
}

export function isTelemetryInitialized() {
  return initialized;
}
