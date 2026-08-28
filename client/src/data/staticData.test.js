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

  it("is a complete site x parameter x year grid with no duplicates", () => {
    const years = new Set(rows.map((row) => row.Year));
    const sites = new Set(rows.map((row) => row.Site));

    expect(rows).toHaveLength(sites.size * PARAMETERS.length * years.size);

    const keys = rows.map((row) => `${row.Site}|${row.Parameter}|${row.Year}`);
    expect(new Set(keys).size).toBe(rows.length);
  });

  it("labels every row as measured or simulated", () => {
    // The UI decides what to tell visitors from this column alone. A blank or
    // unrecognised value would silently render as simulated, quietly
    // mislabelling real data - so require an explicit, known value everywhere.
    const values = [...new Set(rows.map((row) => row.Provenance))].sort();

    expect(values.every((value) => ["measured", "simulated"].includes(value))).toBe(true);
  });

  it("marks the measured Platte phosphorus series and nothing else", () => {
    const measured = rows.filter((row) => row.Provenance === "measured");

    // Guards against a re-run of the ingest script quietly widening its blast
    // radius: only this one site/parameter/year window is real today.
    expect(
      measured.every(
        (row) =>
          row.Site === "Platte Lake (Big Platte)" && row.Parameter === "Total Phosphorus"
      )
    ).toBe(true);

    expect(measured.map((row) => row.Year).sort()).toEqual([
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
    ]);
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
