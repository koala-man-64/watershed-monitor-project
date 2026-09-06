/**
 * Outlier view helpers.
 *
 * `NWMIWS_Site_Data.csv` carries each yearly summary twice: the plain columns
 * cover every sample, and the `*ExOutliers` columns cover the same year with
 * outlier samples dropped. The threshold is applied at ingest time, where the
 * individual samples still exist - see `scripts/data/ingest_measured_samples.py`
 * for the rule and `data/source/README.md` for why it is drawn where it is.
 *
 * These helpers only choose between the two sets. They never re-derive a
 * threshold in the browser: a yearly Min/Avg/Max cannot tell you which samples
 * produced it, so any client-side rule would be guessing at data it cannot see.
 */

/** Plain column -> the equivalent column with outliers excluded. */
const EX_OUTLIER_COLUMNS = Object.freeze({
  Max: "MaxExOutliers",
  Min: "MinExOutliers",
  Avg: "AvgExOutliers",
  Count: "CountExOutliers",
});

function toCount(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** How many samples the ingest flagged across an already-filtered row set. */
export function countExcludedSamples(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (total, row) => total + toCount(row?.OutliersRemoved),
    0
  );
}

/**
 * Swap each row onto its outlier-free summary, or return the rows untouched.
 *
 * A row whose every sample was an outlier has no outlier-free summary to show
 * (`CountExOutliers` is 0), so it is dropped rather than plotted as a hole in
 * the series. Same for a row missing the columns entirely - a malformed row is
 * worth losing, not worth rendering as NaN.
 */
export function applyOutlierView(rows = [], excludeOutliers = false) {
  const list = Array.isArray(rows) ? rows : [];

  if (!excludeOutliers) {
    return list;
  }

  const swapped = [];

  list.forEach((row) => {
    if (!row || toCount(row[EX_OUTLIER_COLUMNS.Count]) <= 0) {
      return;
    }

    const next = { ...row };
    let usable = true;

    Object.entries(EX_OUTLIER_COLUMNS).forEach(([plain, exOutliers]) => {
      const value = String(row[exOutliers] ?? "").trim();
      if (value === "") {
        usable = false;
        return;
      }
      next[plain] = value;
    });

    if (usable) {
      swapped.push(next);
    }
  });

  return swapped;
}

/**
 * Sentence describing what the outlier setting is doing to a chart, or null
 * when it is doing nothing worth saying.
 *
 * Deliberately says something in both directions. With outliers excluded the
 * reader needs to know values were withheld; with them included, knowing that
 * flagged samples are in the series is what makes the setting discoverable
 * rather than a control nobody has a reason to touch.
 */
export function describeOutlierView(rows = [], excludeOutliers = false) {
  const excluded = countExcludedSamples(rows);

  if (excluded === 0) {
    return null;
  }

  const samples = excluded === 1 ? "1 sample" : `${excluded} samples`;
  const outliers = excluded === 1 ? "a statistical outlier" : "statistical outliers";

  return excludeOutliers
    ? `${samples} excluded as ${outliers}.`
    : `Includes ${samples} flagged as ${outliers}.`;
}
