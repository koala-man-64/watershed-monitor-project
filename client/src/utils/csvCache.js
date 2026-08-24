import { trackException } from "./telemetry";
import { DEFAULT_DATA_REVALIDATE_AFTER_MS } from "../config/dataSources";

// v3: info.csv gained a Unit column; bump forces revalidation of cached copies.
const CSV_CACHE_PREFIX = "nwmiws:csv-cache:v3:";

function cacheKeyFor(url) {
  return `${CSV_CACHE_PREFIX}${url}`;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function readCachedEntry(url) {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(cacheKeyFor(url));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.text !== "string") {
      return null;
    }

    return {
      text: parsed.text,
      etag: typeof parsed.etag === "string" ? parsed.etag : null,
      lastModified:
        typeof parsed.lastModified === "string" ? parsed.lastModified : null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : null,
    };
  } catch (error) {
    return null;
  }
}

function writeCachedEntry(url, entry) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(cacheKeyFor(url), JSON.stringify(entry));
  } catch (error) {
    // Ignore storage quota / private mode failures and keep the fetch path working.
  }
}

async function requestLatestText(url, cachedEntry) {
  const headers = {};
  if (cachedEntry?.etag) {
    headers["If-None-Match"] = cachedEntry.etag;
  }
  if (cachedEntry?.lastModified) {
    headers["If-Modified-Since"] = cachedEntry.lastModified;
  }

  const response = await fetch(url, {
    cache: "no-cache",
    headers,
  });

  if (response.status === 304 && cachedEntry?.text != null) {
    writeCachedEntry(url, {
      ...cachedEntry,
      etag: response.headers.get("etag") || cachedEntry.etag,
      lastModified:
        response.headers.get("last-modified") || cachedEntry.lastModified,
      updatedAt: Date.now(),
    });
    return cachedEntry.text;
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} for ${url}`);
    error.name = "ReadCsvHttpError";
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  writeCachedEntry(url, {
    text,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    updatedAt: Date.now(),
  });
  return text;
}

function resolveRevalidateAfterMs(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return DEFAULT_DATA_REVALIDATE_AFTER_MS;
}

function isEntryFresh(cachedEntry, revalidateAfterMs) {
  if (revalidateAfterMs <= 0) {
    return false;
  }

  const updatedAt = Number(cachedEntry?.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return false;
  }

  return Date.now() - updatedAt < revalidateAfterMs;
}

function parseUrl(url) {
  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    return new URL(String(url), origin);
  } catch (error) {
    return null;
  }
}

function resolveDataSource(url) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return "unknown";
  }
  return parsed.pathname.startsWith("/data/") ? "static" : "unknown";
}

function resolveBlobName(url) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return "";
  }

  const tail = parsed.pathname.split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(tail);
  } catch (error) {
    return tail;
  }
}

function buildTelemetryProperties(url, cacheHit, status) {
  const dataSource = resolveDataSource(url);
  const properties = {
    url,
    dataSource,
    blobName: resolveBlobName(url),
    cacheHit: Boolean(cacheHit),
  };

  if (status != null) {
    properties.status = status;
  }
  return properties;
}

export async function fetchCachedCsvText(url, { onFreshText, revalidateAfterMs } = {}) {
  const cachedEntry = readCachedEntry(url);
  const hasCachedEntry = cachedEntry?.text != null;
  const staleAfterMs = resolveRevalidateAfterMs(revalidateAfterMs);

  if (hasCachedEntry && isEntryFresh(cachedEntry, staleAfterMs)) {
    return cachedEntry.text;
  }

  const networkRequest = requestLatestText(url, cachedEntry)
    .then((latestText) => {
      if (
        hasCachedEntry &&
        latestText !== cachedEntry.text &&
        typeof onFreshText === "function"
      ) {
        onFreshText(latestText);
      }
      return latestText;
    })
    .catch((error) => {
      const telemetryProperties = {
        ...buildTelemetryProperties(url, hasCachedEntry, error?.status),
        cachedFallback: hasCachedEntry,
      };
      trackException(error, telemetryProperties);

      if (hasCachedEntry) {
        console.warn(`Using cached CSV after fetch failed for ${url}`, error);
        return cachedEntry.text;
      }
      throw error;
    });

  if (hasCachedEntry) {
    void networkRequest;
    return cachedEntry.text;
  }

  return networkRequest;
}

export function readCachedCsvText(url) {
  return readCachedEntry(url)?.text ?? null;
}
