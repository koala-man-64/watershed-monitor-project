import { PROVENANCE } from "../siteContent";

/**
 * Provenance helpers.
 *
 * The dataset mixes a small measured series with simulated values for
 * everything else. A single site-wide banner cannot convey that safely — a
 * visitor looking at one chart or one marker needs to know about *that* data.
 * These helpers keep the per-chart and per-marker labels driven by the rows
 * themselves rather than a hardcoded list that could drift from the CSV.
 */

function isMeasured(row) {
  return String(row?.Provenance || "").trim() === PROVENANCE.MEASURED;
}

/** Count measured vs simulated rows in an already-filtered set. */
export function summarizeProvenance(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const measured = list.filter(isMeasured).length;

  return {
    measured,
    simulated: list.length - measured,
    total: list.length,
  };
}

/**
 * Sentence describing where a chart's values came from, or null when there is
 * nothing plotted. Returned as plain text so callers can place it wherever
 * suits; ChartPanel renders it in its existing `notice` slot.
 */
export function describeProvenance(rows = []) {
  const { measured, simulated, total } = summarizeProvenance(rows);

  if (total === 0) {
    return null;
  }

  if (simulated === 0) {
    return "Measured data — real laboratory measurements.";
  }

  if (measured === 0) {
    return "Simulated data — these values are illustrative and are not real measurements.";
  }

  return (
    `Mixed data — ${measured} of ${total} plotted values are real measurements; ` +
    "the remaining values are simulated."
  );
}

/**
 * Names of sites with at least one measured row, for labelling map markers.
 * Returns a Set so lookups in the marker loop stay O(1).
 */
export function measuredSiteNames(rows = []) {
  const names = new Set();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (isMeasured(row) && row?.Site) {
      names.add(String(row.Site).trim());
    }
  });

  return names;
}
