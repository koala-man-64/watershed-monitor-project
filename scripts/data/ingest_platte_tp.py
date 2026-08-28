"""Fold the measured Platte Lake total-phosphorus series into the static site data.

The site ships pre-aggregated yearly rollups (one row per Site x Parameter x Year).
The lab series we receive is individual dated samples, so this script does the
rollup and writes the result over the matching rows, marking them `measured`.
Every other row is marked `simulated`.

Source: data/source/platte-tp-samples-2020-2025.csv - see the README beside it.

Re-run after dropping in a refreshed source file; the script is idempotent and
only touches rows for the years present in the source.

    python scripts/data/ingest_platte_tp.py
    python scripts/data/ingest_platte_tp.py --check   # report, write nothing
"""

import argparse
import csv
import os
import sys
from collections import defaultdict

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(REPO_ROOT, "data", "source", "platte-tp-samples-2020-2025.csv")
TARGET = os.path.join(REPO_ROOT, "client", "public", "data", "NWMIWS_Site_Data.csv")

# Must match locations.csv:name byte-for-byte - the site name is the join key.
SITE = "Platte Lake (Big Platte)"
PARAMETER = "Total Phosphorus"

PROVENANCE_COLUMN = "Provenance"
MEASURED = "measured"
SIMULATED = "simulated"


def read_samples(path):
    """Return {year: [value, ...]} from the dated sample series."""
    by_year = defaultdict(list)
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            date = (row.get("SampleDate") or "").strip()
            raw = (row.get("TotalPhosphorus_ugL") or "").strip()
            if not date or not raw:
                continue
            by_year[date[:4]].append(float(raw))
    return by_year


def summarize(values):
    """Collapse a year of samples into the columns the site renders."""
    return {
        "Max": max(values),
        "Min": min(values),
        "Avg": sum(values) / len(values),
        "Count": len(values),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report without writing")
    args = parser.parse_args()

    by_year = read_samples(SOURCE)
    if not by_year:
        print("no samples found in %s" % SOURCE, file=sys.stderr)
        return 1

    with open(TARGET, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    if PROVENANCE_COLUMN not in fieldnames:
        fieldnames.append(PROVENANCE_COLUMN)

    updated = []
    for row in rows:
        row.setdefault(PROVENANCE_COLUMN, "")
        target_row = row["Site"] == SITE and row["Parameter"] == PARAMETER
        stats = by_year.get(row["Year"]) if target_row else None

        if stats is None:
            row[PROVENANCE_COLUMN] = SIMULATED
            continue

        summary = summarize(stats)
        row.update({key: repr(value) if isinstance(value, float) else value
                    for key, value in summary.items()})
        row[PROVENANCE_COLUMN] = MEASURED
        updated.append((row["Year"], summary))

    missing = sorted(set(by_year) - {year for year, _ in updated})
    if missing:
        # The site only charts years that already exist as rows; a source year with
        # no matching row would be silently dropped, so say so rather than hide it.
        print("WARNING: no row to update for year(s): %s" % ", ".join(missing), file=sys.stderr)

    for year, summary in sorted(updated):
        print("%s  n=%-3d min=%-7.3f avg=%-7.3f max=%.3f"
              % (year, summary["Count"], summary["Min"], summary["Avg"], summary["Max"]))
    print("\n%d row(s) marked %s; %d marked %s"
          % (len(updated), MEASURED, len(rows) - len(updated), SIMULATED))

    if args.check:
        print("--check: nothing written")
        return 0

    with open(TARGET, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print("wrote %s" % TARGET)
    return 0


if __name__ == "__main__":
    sys.exit(main())
