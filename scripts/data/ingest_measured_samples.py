"""Replace a site's rows in the static site data with real measured samples.

Unlike a patch-in-place ingest, this deletes every existing row for each site
that appears in a source file and writes back only rows for the
(Parameter, Year) combinations the source actually has samples for. That
matches how the data owner (Ray Canale) asked for it: "delete all current
data and replace with the new stuff" for Platte Lake and, separately, for
the seven Leelanau Conservancy lakes (Gmail thread "platte data", 2026-09-04).

A source file with no full-year footprint (e.g. Chlorophyll-a stopping in
2011) simply produces no rows for the years it doesn't cover - there is no
attempt to backfill those years with anything, simulated or otherwise, once
a site is in scope of this script. See data/source/README.md for what each
source covers and the judgment calls made extracting it.

Source CSV schema (one row per dated sample, already in the target units):
    Site,Parameter,SampleDate,Value

Re-run after dropping in a refreshed source file; the script is idempotent -
it always rebuilds a site's block from scratch rather than accumulating.

    python scripts/data/ingest_measured_samples.py
    python scripts/data/ingest_measured_samples.py --check   # report, write nothing
"""

import argparse
import csv
import glob
import math
import os
import sys
from collections import defaultdict

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_GLOB = os.path.join(REPO_ROOT, "data", "source", "*-samples-*.csv")
TARGET = os.path.join(REPO_ROOT, "client", "public", "data", "NWMIWS_Site_Data.csv")

PROVENANCE_COLUMN = "Provenance"
MEASURED = "measured"
SIMULATED = "simulated"

# Columns carrying the same yearly summary with outlier samples excluded, so
# the site can offer both views without the browser needing sample-level data.
OUTLIER_COLUMNS = [
    "MaxExOutliers",
    "MinExOutliers",
    "AvgExOutliers",
    "CountExOutliers",
    "OutliersRemoved",
]

# Outlier rule: Tukey's fence on log10 values, applied per (site, parameter)
# series across all its years.
#
# Log scale because nutrient concentrations are right-skewed - a fence on raw
# values treats an ordinary late-summer phosphorus reading on a clear lake
# (12-18 ug/L against a median of 4) as an outlier, which discards real
# seasonal signal rather than errors.
#
# The outer multiplier (3.0, "far out") rather than the usual 1.5: at 1.5 the
# rule flags 58 samples including legitimate spring nitrate peaks, at 3.0 it
# flags 6 - the values that stand apart from their own series rather than the
# upper end of it.
OUTLIER_IQR_MULTIPLIER = 3.0

# Secchi Depth is deliberately excluded. It measures water clarity, not a
# concentration: its high tail is the clearest days on record (North Lake
# Leelanau's best-ever 41 ft reading), so an upper fence would discard the
# best data as though it were error. Nothing in the record suggests a Secchi
# transcription problem to detect, and inventing a rule for one would be
# speculative.
OUTLIER_PARAMETERS = frozenset({"Total Phosphorus", "Nitrate", "Chlorophyll-a"})

# Quartiles from a handful of points are noise. Every current series has 118+
# samples, so this only guards future sources with a thin record.
MIN_SAMPLES_FOR_FENCE = 12


def read_sources(paths):
    """Return {(site, parameter): {year: [value, ...]}} across all source files."""
    by_key = defaultdict(lambda: defaultdict(list))
    for path in paths:
        with open(path, newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                site = (row.get("Site") or "").strip()
                parameter = (row.get("Parameter") or "").strip()
                date = (row.get("SampleDate") or "").strip()
                raw = (row.get("Value") or "").strip()
                if not site or not parameter or not date or not raw:
                    continue
                by_key[(site, parameter)][date[:4]].append(float(raw))
    return by_key


def summarize(values):
    """Collapse a year of samples into the columns the site renders."""
    lo = min(values)
    hi = max(values)
    # sum(values) / len(values) can land a few ULPs outside [lo, hi] when
    # every sample is identical (e.g. six 3.8 readings averaging to
    # 3.7999999999999994) - clamp rather than let a floating-point artifact
    # violate min <= avg <= max on an otherwise-correct row.
    avg = min(max(sum(values) / len(values), lo), hi)
    return {
        "Max": hi,
        "Min": lo,
        "Avg": avg,
        "Count": len(values),
    }


def quantile(sorted_values, fraction):
    """Linear-interpolation quantile, matching the usual boxplot convention."""
    position = (len(sorted_values) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * (position - lower)


def outlier_fence(parameter, values):
    """Upper cutoff above which a sample counts as an outlier, or None.

    None means "do not judge this series": a parameter the rule deliberately
    ignores, too few samples for stable quartiles, or too few positive values
    to work on a log scale. Callers must treat None as "no outliers", never as
    a fence of zero.
    """
    if parameter not in OUTLIER_PARAMETERS or len(values) < MIN_SAMPLES_FOR_FENCE:
        return None

    # A zero reading is real data (and kept in the series), but log10(0) is
    # undefined, so the fence is derived from the positive values only.
    positive = sorted(math.log10(value) for value in values if value > 0)
    if len(positive) < MIN_SAMPLES_FOR_FENCE:
        return None

    q1 = quantile(positive, 0.25)
    q3 = quantile(positive, 0.75)
    return 10 ** (q3 + OUTLIER_IQR_MULTIPLIER * (q3 - q1))


def split_outliers(values, fence):
    """Partition a year's samples into (kept, removed) against the fence."""
    if fence is None:
        return list(values), []
    kept = [value for value in values if value <= fence]
    removed = [value for value in values if value > fence]
    return kept, removed


def backfill_outlier_columns(row):
    """Give a row this script did not rebuild the outlier columns anyway.

    Rows for sites with no source file (today: the simulated ones) are carried
    through untouched, but the file has to stay rectangular. No sample-level
    data exists for them, so nothing was examined and nothing was removed -
    the outlier-free view is simply the row itself.
    """
    filled = dict(row)
    filled.setdefault("MaxExOutliers", row.get("Max", ""))
    filled.setdefault("MinExOutliers", row.get("Min", ""))
    filled.setdefault("AvgExOutliers", row.get("Avg", ""))
    filled.setdefault("CountExOutliers", row.get("Count", ""))
    filled.setdefault("OutliersRemoved", 0)
    for column in OUTLIER_COLUMNS:
        if filled.get(column) in (None, ""):
            if column == "OutliersRemoved":
                filled[column] = 0
            elif column == "CountExOutliers":
                filled[column] = row.get("Count", "")
            else:
                filled[column] = row.get(column.replace("ExOutliers", ""), "")
    return filled


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="report without writing")
    args = parser.parse_args()

    source_paths = sorted(glob.glob(SOURCE_GLOB))
    if not source_paths:
        print("no source files matched %s" % SOURCE_GLOB, file=sys.stderr)
        return 1

    by_key = read_sources(source_paths)
    if not by_key:
        print("no samples found in %s" % ", ".join(source_paths), file=sys.stderr)
        return 1

    sites_in_scope = {site for site, _parameter in by_key}

    with open(TARGET, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    for column in OUTLIER_COLUMNS:
        if column not in fieldnames:
            fieldnames.append(column)
    # Provenance stays the last column: it labels the row, the outlier columns
    # are part of the summary that precedes it.
    if PROVENANCE_COLUMN in fieldnames:
        fieldnames.remove(PROVENANCE_COLUMN)
    fieldnames.append(PROVENANCE_COLUMN)

    # Build the replacement rows for every (site, parameter, year) with samples.
    new_rows = []
    outlier_log = []
    for (site, parameter), by_year in sorted(by_key.items()):
        # One fence per series, derived from every year at once - a single
        # year rarely holds enough samples for a stable quartile.
        all_values = [value for values in by_year.values() for value in values]
        fence = outlier_fence(parameter, all_values)

        for year, values in sorted(by_year.items()):
            summary = summarize(values)
            kept, removed = split_outliers(values, fence)
            clean = summarize(kept) if kept else None
            for value in sorted(removed, reverse=True):
                outlier_log.append((site, parameter, year, value, fence))

            new_rows.append({
                "Site": site,
                "SiteType": "Lake",
                "Year": year,
                "Parameter": parameter,
                "Max": repr(summary["Max"]),
                "Min": repr(summary["Min"]),
                "Avg": repr(summary["Avg"]),
                "Count": summary["Count"],
                # A year whose every sample was an outlier has no honest
                # summary to show: the count is 0 and the stats stay blank, so
                # the site drops the row rather than plotting a hollow point.
                "MaxExOutliers": repr(clean["Max"]) if clean else "",
                "MinExOutliers": repr(clean["Min"]) if clean else "",
                "AvgExOutliers": repr(clean["Avg"]) if clean else "",
                "CountExOutliers": clean["Count"] if clean else 0,
                "OutliersRemoved": len(removed),
                PROVENANCE_COLUMN: MEASURED,
            })

    # Rebuild the file: keep every row for a site untouched unless that site
    # appears in a source file, in which case its entire existing block -
    # every parameter, every year, `measured` or `simulated` - is dropped and
    # spliced back in (at the same position) from new_rows.
    new_rows_by_site = defaultdict(list)
    for row in new_rows:
        new_rows_by_site[row["Site"]].append(row)

    result = []
    inserted_sites = set()
    for row in rows:
        if row["Site"] not in sites_in_scope:
            result.append(backfill_outlier_columns(row))
            continue
        if row["Site"] not in inserted_sites:
            result.extend(new_rows_by_site[row["Site"]])
            inserted_sites.add(row["Site"])

    # A site that appears in a source file but had no existing rows (brand
    # new site) gets its block appended at the end.
    for site in sorted(sites_in_scope - inserted_sites):
        result.extend(new_rows_by_site[site])

    removed_count = sum(1 for row in rows if row["Site"] in sites_in_scope)

    for (site, parameter), by_year in sorted(by_key.items()):
        years = sorted(by_year)
        print("%-28s %-18s %d row(s), %s-%s" % (site, parameter, len(years), years[0], years[-1]))

    print("\n%d existing row(s) removed across %d site(s); %d new measured row(s) written"
          % (removed_count, len(sites_in_scope), len(new_rows)))

    if outlier_log:
        print("")
        print("%d sample(s) flagged as outliers (log10 Tukey fence, k=%s):"
              % (len(outlier_log), OUTLIER_IQR_MULTIPLIER))
        for site, parameter, year, value, fence in sorted(outlier_log):
            print("  %-26s %-17s %s  %10.4g  (fence %.4g)"
                  % (site, parameter, year, value, fence))
    else:
        print("")
        print("no samples flagged as outliers")

    if args.check:
        print("--check: nothing written")
        return 0

    with open(TARGET, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(result)
    print("wrote %s" % TARGET)
    return 0


if __name__ == "__main__":
    sys.exit(main())
