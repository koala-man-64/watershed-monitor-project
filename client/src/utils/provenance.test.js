/* eslint-env jest */
import {
  describeProvenance,
  measuredSiteNames,
  summarizeProvenance,
} from "./provenance";

const measured = (site, year) => ({
  Site: site,
  Year: String(year),
  Parameter: "Total Phosphorus",
  Provenance: "measured",
});

const simulated = (site, year) => ({
  Site: site,
  Year: String(year),
  Parameter: "Total Phosphorus",
  Provenance: "simulated",
});

describe("summarizeProvenance", () => {
  it("counts measured and simulated rows", () => {
    const rows = [measured("Platte", 2020), simulated("Bear", 2020), simulated("Bear", 2021)];

    expect(summarizeProvenance(rows)).toEqual({ measured: 1, simulated: 2, total: 3 });
  });

  it("treats a missing or unrecognised value as simulated", () => {
    // Fail safe: an unlabelled row must never be presented as a real
    // measurement, so anything that is not exactly "measured" counts as
    // simulated rather than being trusted.
    const rows = [{ Site: "Bear" }, { Site: "Bear", Provenance: "" }, { Site: "Bear", Provenance: "real" }];

    expect(summarizeProvenance(rows)).toEqual({ measured: 0, simulated: 3, total: 3 });
  });

  it("tolerates a non-array input", () => {
    expect(summarizeProvenance(undefined)).toEqual({ measured: 0, simulated: 0, total: 0 });
  });
});

describe("describeProvenance", () => {
  it("returns null when nothing is plotted", () => {
    expect(describeProvenance([])).toBeNull();
  });

  it("names an all-measured plot as real", () => {
    expect(describeProvenance([measured("Platte", 2020)])).toMatch(/real laboratory measurements/i);
  });

  it("stays silent on an all-simulated plot", () => {
    // The site-wide banner already says everything is simulated by default, so
    // repeating it per chart was noise. Only departures from that default get a
    // notice.
    expect(describeProvenance([simulated("Bear", 2020)])).toBeNull();
  });

  it("quantifies a mixed plot rather than rounding to one label", () => {
    // A trend line spanning 2019-2021 for Platte is part real, part synthetic.
    // Calling the whole thing either "measured" or "simulated" would mislead.
    const rows = [simulated("Platte", 2019), measured("Platte", 2020), measured("Platte", 2021)];

    expect(describeProvenance(rows)).toMatch(/2 of 3 plotted values are real measurements/i);
  });
});

describe("measuredSiteNames", () => {
  it("returns only sites holding at least one measured row", () => {
    const rows = [measured("Platte", 2020), simulated("Platte", 2019), simulated("Bear", 2020)];
    const names = measuredSiteNames(rows);

    expect(names.has("Platte")).toBe(true);
    expect(names.has("Bear")).toBe(false);
    expect(names.size).toBe(1);
  });

  it("returns an empty set when no rows are measured", () => {
    expect(measuredSiteNames([simulated("Bear", 2020)]).size).toBe(0);
  });
});
