/* eslint-env jest */
/* eslint-env node */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const DATA_DIR = path.join(__dirname, "..", "..", "public", "data");

function readCsv(name) {
  const text = fs.readFileSync(path.join(DATA_DIR, name), "utf8");
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data;
}

const PARAMETERS = [
  "Chloride",
  "Chlorophyll-a",
  "Nitrate",
  "Secchi Depth",
  "Total Phosphorus",
];

function readHeader(name) {
  const text = fs.readFileSync(path.join(DATA_DIR, name), "utf8");
  return text.split(/\r?\n/)[0].split(",");
}

describe("static data files", () => {
  const rows = readCsv("NWMIWS_Site_Data.csv");
  const locations = readCsv("locations.csv");

  it("uses the same site names in the measurement and location files", () => {
    // A mismatch here is silent in the UI: the site appears in the dropdown
    // with no map marker, or a marker that can never be selected.
    const dataSites = [...new Set(rows.map((row) => row.Site))].sort();
    const locationSites = [...new Set(locations.map((row) => row.name))].sort();

    expect(dataSites).toEqual(locationSites);
    expect(dataSites).toHaveLength(24);
  });

  it("exposes exactly the expected parameter labels", () => {
    expect([...new Set(rows.map((row) => row.Parameter))].sort()).toEqual(PARAMETERS);
  });

  it("has no duplicate site x parameter x year rows", () => {
    const keys = rows.map((row) => `${row.Site}|${row.Parameter}|${row.Year}`);
    expect(new Set(keys).size).toBe(rows.length);
  });

  it("is a complete site x parameter x year grid for every site with no measured data", () => {
    // A measured site's coverage is whatever real samples exist for it - real
    // records are ragged by nature (a parameter added partway through, a
    // series that stops early) and are asserted individually below. A site
    // with no measured data at all has no such excuse: it is entirely
    // synthetic filler, so a gap there would mean the generator silently
    // dropped a year, not that a limnologist didn't sample that year.
    const measuredSites = new Set(
      rows.filter((row) => row.Provenance === "measured").map((row) => row.Site)
    );
    const simulatedOnly = rows.filter((row) => !measuredSites.has(row.Site));

    const years = new Set(simulatedOnly.map((row) => row.Year));
    const sites = new Set(simulatedOnly.map((row) => row.Site));

    expect(simulatedOnly).toHaveLength(sites.size * PARAMETERS.length * years.size);
  });

  it("labels every row as measured or simulated", () => {
    // The UI decides what to tell visitors from this column alone. A blank or
    // unrecognised value would silently render as simulated, quietly
    // mislabelling real data - so require an explicit, known value everywhere.
    const values = [...new Set(rows.map((row) => row.Provenance))].sort();

    expect(values.every((value) => ["measured", "simulated"].includes(value))).toBe(true);
  });

  it("marks exactly Platte and the seven Leelanau Conservancy lakes as measured", () => {
    // Guards against a re-run of the ingest script quietly widening or
    // narrowing its blast radius: these 8 sites (Ray's 2026-09-04
    // delete-and-replace) should be measured everywhere they have a row, and
    // no other site should ever be measured.
    const REAL_DATA_SITES = new Set([
      "Platte Lake (Big Platte)",
      "Big Glen Lake",
      "Little Glen Lake",
      "Little Traverse Lake",
      "Lime Lake",
      "Cedar Lake (Leelanau)",
      "North Lake Leelanau",
      "South Lake Leelanau",
    ]);

    const forRealSites = rows.filter((row) => REAL_DATA_SITES.has(row.Site));
    const forOtherSites = rows.filter((row) => !REAL_DATA_SITES.has(row.Site));

    expect(forRealSites.length).toBeGreaterThan(0);
    expect(forRealSites.every((row) => row.Provenance === "measured")).toBe(true);
    expect(forOtherSites.every((row) => row.Provenance === "simulated")).toBe(true);
  });

  it("has the exact column set the cache version was bumped for", () => {
    // This assertion exists to fail loudly when a column is added or renamed.
    // A cached CSV is served for a whole day without revalidating, so a shape
    // change needs CSV_CACHE_PREFIX in utils/csvCache.js bumped in the same
    // change - otherwise returning visitors keep the old columns and whatever
    // reads a new one reports "nothing here" instead of breaking visibly.
    // That is exactly how the outlier toggle shipped greyed out.
    //
    // If this test fails: update the list, then bump CSV_CACHE_PREFIX.
    expect(readHeader("NWMIWS_Site_Data.csv")).toEqual([
      "Site",
      "SiteType",
      "Year",
      "Parameter",
      "Max",
      "Min",
      "Avg",
      "Count",
      "MaxExOutliers",
      "MinExOutliers",
      "AvgExOutliers",
      "CountExOutliers",
      "OutliersRemoved",
      "Provenance",
    ]);
  });

  it("carries an outlier-free summary on every row", () => {
    // The site swaps whole column sets at once (see utils/outliers.js), so a
    // row missing any one of them silently disappears from the outlier-free
    // view instead of failing loudly here.
    const columns = [
      "MaxExOutliers",
      "MinExOutliers",
      "AvgExOutliers",
      "CountExOutliers",
      "OutliersRemoved",
    ];
    const missing = rows.filter((row) =>
      columns.some((column) => row[column] === undefined)
    );

    expect(missing).toEqual([]);
  });

  it("accounts for every sample as either kept or removed", () => {
    // Count = CountExOutliers + OutliersRemoved on every row, measured or not.
    // A row that loses samples without recording them is the failure mode that
    // would let the two views disagree about how much data exists.
    const unbalanced = rows.filter((row) => {
      const kept = Number(row.CountExOutliers);
      const removed = Number(row.OutliersRemoved);
      return !Number.isInteger(kept) || !Number.isInteger(removed)
        || kept + removed !== Number(row.Count);
    });

    expect(unbalanced).toEqual([]);
  });

  it("has sane numerics on every outlier-free summary", () => {
    const bad = rows.filter((row) => {
      const kept = Number(row.CountExOutliers);

      if (kept === 0) {
        // Nothing left to summarise: the stats must be blank, not zero, so the
        // site drops the row rather than plotting it at the origin.
        return row.MaxExOutliers !== "" || row.MinExOutliers !== "" || row.AvgExOutliers !== "";
      }

      const max = Number(row.MaxExOutliers);
      const min = Number(row.MinExOutliers);
      const avg = Number(row.AvgExOutliers);

      return (
        !Number.isFinite(max) ||
        !Number.isFinite(min) ||
        !Number.isFinite(avg) ||
        !(min <= avg && avg <= max)
      );
    });

    expect(bad).toEqual([]);
  });

  it("only ever lowers an average by excluding outliers", () => {
    // The fence is one-sided (an upper cutoff), so dropping samples can only
    // pull an average down. A row that rose would mean the ingest removed
    // something from the bottom of the series - the opposite of the rule.
    const raised = rows
      .filter((row) => Number(row.OutliersRemoved) > 0)
      .filter((row) => Number(row.AvgExOutliers) >= Number(row.Avg));

    expect(raised).toEqual([]);
  });

  it("never flags a Secchi Depth or simulated sample as an outlier", () => {
    // Secchi is water clarity, not a concentration: its high tail is the
    // clearest days on record, so the ingest deliberately leaves it alone.
    // Simulated rows have no samples to judge in the first place.
    const wrong = rows.filter(
      (row) =>
        Number(row.OutliersRemoved) > 0 &&
        (row.Parameter === "Secchi Depth" || row.Provenance !== "measured")
    );

    expect(wrong).toEqual([]);
  });

  it("has sane numerics on every row", () => {
    const bad = rows.filter((row) => {
      const max = Number(row.Max);
      const min = Number(row.Min);
      const avg = Number(row.Avg);
      const count = Number(row.Count);

      return (
        !Number.isFinite(max) ||
        !Number.isFinite(min) ||
        !Number.isFinite(avg) ||
        !(min <= avg && avg <= max) ||
        !Number.isInteger(count) ||
        count <= 0
      );
    });

    expect(bad).toEqual([]);
  });
});
