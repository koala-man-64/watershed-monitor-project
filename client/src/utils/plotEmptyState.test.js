/* eslint-env jest */
import { getNoDataMessage, getUnconfiguredPlotMessage } from "./plotEmptyState";

describe("getNoDataMessage", () => {
  it("defaults to the site-selection prompt before the user has made any selections", () => {
    expect(getNoDataMessage()).toBe("Select one or more sites on map");
  });

  it("prompts the user to select sites when none are selected", () => {
    expect(
      getNoDataMessage({
        selectedSites: [],
        parameter: "Chloride",
      })
    ).toBe("Select one or more sites on map");
  });

  it("prompts the user to select a parameter when sites are selected but parameter is missing", () => {
    expect(
      getNoDataMessage({
        selectedSites: ["Duck Lake"],
        parameter: "",
      })
    ).toBe("Select Parameter");
  });

  it("shows the no-data selection message when site and parameter are selected but no rows match", () => {
    expect(
      getNoDataMessage({
        selectedSites: ["Duck Lake"],
        parameter: "Chloride",
      })
    ).toBe("No Data Available for Site, Year, and Parameter Selections");
  });
});

describe("getUnconfiguredPlotMessage", () => {
  it("names the matching Update button for the slot", () => {
    expect(getUnconfiguredPlotMessage("Plot 2")).toBe(
      "No plot configured yet. Choose your filters, then press Update Plot 2."
    );
  });

  it("does not claim sites are unselected when the slot is simply unconfigured", () => {
    expect(getUnconfiguredPlotMessage("Plot 2")).not.toMatch(/select .*sites/i);
  });

  it("falls back to a generic prompt without a slot label", () => {
    expect(getUnconfiguredPlotMessage()).toBe(
      "No plot configured yet. Choose your filters, then press an Update Plot button."
    );
  });
});
