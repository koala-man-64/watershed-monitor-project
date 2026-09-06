/* eslint-env jest */
import {
  applyOutlierView,
  countExcludedSamples,
  describeOutlierView,
} from "./outliers";

function row(overrides = {}) {
  return {
    Site: "Big Glen Lake",
    Parameter: "Total Phosphorus",
    Year: "2004",
    Max: "43.4",
    Min: "1.2",
    Avg: "6.3",
    Count: "29",
    MaxExOutliers: "12.1",
    MinExOutliers: "1.2",
    AvgExOutliers: "4.96",
    CountExOutliers: "28",
    OutliersRemoved: "1",
    Provenance: "measured",
    ...overrides,
  };
}

describe("applyOutlierView", () => {
  it("returns the rows untouched when outliers are included", () => {
    const rows = [row()];

    expect(applyOutlierView(rows, false)).toBe(rows);
  });

  it("swaps the summary columns onto their outlier-free equivalents", () => {
    const [swapped] = applyOutlierView([row()], true);

    expect(swapped).toMatchObject({
      Max: "12.1",
      Min: "1.2",
      Avg: "4.96",
      Count: "28",
    });
  });

  it("keeps the columns the charts do not read", () => {
    // Provenance drives a separate notice and OutliersRemoved drives this
    // one, so losing either in the swap would silently change what the page
    // tells the reader about the same chart.
    const [swapped] = applyOutlierView([row()], true);

    expect(swapped.Provenance).toBe("measured");
    expect(swapped.OutliersRemoved).toBe("1");
    expect(swapped.Site).toBe("Big Glen Lake");
  });

  it("leaves the original rows unmutated", () => {
    const rows = [row()];
    applyOutlierView(rows, true);

    expect(rows[0].Avg).toBe("6.3");
  });

  it("drops a year whose every sample was an outlier", () => {
    // Plotting it would mean drawing a point from no samples at all.
    const rows = [
      row(),
      row({ Year: "2005", CountExOutliers: "0", AvgExOutliers: "", MaxExOutliers: "" }),
    ];

    const swapped = applyOutlierView(rows, true);

    expect(swapped).toHaveLength(1);
    expect(swapped[0].Year).toBe("2004");
  });

  it("drops a row missing the outlier columns rather than plotting NaN", () => {
    const rows = [row({ AvgExOutliers: "" })];

    expect(applyOutlierView(rows, true)).toEqual([]);
  });

  it("survives junk input", () => {
    expect(applyOutlierView(null, true)).toEqual([]);
    expect(applyOutlierView(undefined, false)).toEqual([]);
    expect(applyOutlierView([null], true)).toEqual([]);
  });
});

describe("countExcludedSamples", () => {
  it("sums the flag counts across rows", () => {
    expect(countExcludedSamples([row(), row({ OutliersRemoved: "2" })])).toBe(3);
  });

  it("treats a blank or unparseable count as zero", () => {
    expect(countExcludedSamples([row({ OutliersRemoved: "" })])).toBe(0);
    expect(countExcludedSamples([row({ OutliersRemoved: "n/a" })])).toBe(0);
  });
});

describe("describeOutlierView", () => {
  it("says nothing when the chart has no flagged samples", () => {
    const clean = [row({ OutliersRemoved: "0" })];

    expect(describeOutlierView(clean, true)).toBeNull();
    expect(describeOutlierView(clean, false)).toBeNull();
  });

  it("reports what was withheld when outliers are excluded", () => {
    expect(describeOutlierView([row()], true)).toBe(
      "1 sample excluded as a statistical outlier."
    );
  });

  it("reports what is present when outliers are included", () => {
    // Without this the setting is invisible: nothing on screen would tell a
    // reader the chart contains anything the toggle would act on.
    expect(describeOutlierView([row({ OutliersRemoved: "2" })], false)).toBe(
      "Includes 2 samples flagged as statistical outliers."
    );
  });
});
