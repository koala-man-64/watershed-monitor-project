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
import os
import sys
from collections import defaultdict

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_GLOB = os.path.join(REPO_ROOT, "data", "source", "*-samples-*.csv")
TARGET = os.path.join(REPO_ROOT, "client", "public", "data", "NWMIWS_Site_Data.csv")

PROVENANCE_COLUMN = "Provenance"
MEASURED = "measured"
SIMULATED = "simulated"


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

    if PROVENANCE_COLUMN not in fieldnames:
        fieldnames.append(PROVENANCE_COLUMN)

    # Build the replacement rows for every (site, parameter, year) with samples.
    new_rows = []
    for (site, parameter), by_year in sorted(by_key.items()):
        for year, values in sorted(by_year.items()):
            summary = summarize(values)
            new_rows.append({
                "Site": site,
                "SiteType": "Lake",
                "Year": year,
                "Parameter": parameter,
                "Max": repr(summary["Max"]),
                "Min": repr(summary["Min"]),
                "Avg": repr(summary["Avg"]),
                "Count": summary["Count"],
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
            result.append(row)
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
