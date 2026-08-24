/* eslint-env jest */
import {
  buildComparisonChart,
  buildTrendChart,
  defaultColors,
  filterRowsForConfig,
  formatParameterAxisLabel,
  getTrendSite,
} from "./chartBuilders";

const rawData = [
  {
    Site: "Lake Alpha",
    Parameter: "Total Phosphorus",
    Year: "2020",
    Avg: "1",
    Min: "0.5",
    Max: "1.5",
    Count: "2",
  },
  {
    Site: "Lake Alpha",
    Parameter: "Total Phosphorus",
    Year: "2020",
    Avg: "3",
    Min: "2.5",
    Max: "3.5",
    Count: "1",
  },
  {
    Site: "Lake Alpha",
    Parameter: "Total Phosphorus",
    Year: "2021",
    Avg: "4",
    Min: "3",
    Max: "5",
    Count: "4",
  },
  {
    Site: "Lake Beta",
    Parameter: "Total Phosphorus",
    Year: "2020",
    Avg: "2",
    Min: "1.5",
    Max: "2.5",
    Count: "5",
  },
  {
    Site: "Lake Beta",
    Parameter: "Total Phosphorus",
    Year: "2021",
    Avg: "6",
    Min: "5.5",
    Max: "6.5",
    Count: "6",
  },
  {
    Site: "Lake Gamma",
    Parameter: "Chlorophyll-a",
    Year: "2021",
    Avg: "7",
    Min: "6.5",
    Max: "7.5",
    Count: "2",
  },
];

describe("chartBuilders", () => {
  it("selects the configured trend site and filters rows accordingly", () => {
    const cfg = {
      selectedSites: ["Lake Alpha", "Lake Beta"],
      trendIndex: 0,
      parameter: "Total Phosphorus",
      chartType: "trend",
      startYear: 2020,
      endYear: 2021,
    };

    expect(getTrendSite(cfg)).toBe("Lake Alpha");
    expect(filterRowsForConfig(rawData, cfg)).toHaveLength(3);
  });

  it("builds a trend chart with yearly aggregates and count overlays", () => {
    const chart = buildTrendChart(rawData, {
      selectedSites: ["Lake Alpha", "Lake Beta"],
      trendIndex: 0,
      parameter: "Total Phosphorus",
      chartType: "trend",
      startYear: 2020,
      endYear: 2021,
    });

    expect(chart.title).toBe("Total Phosphorus Trend for Lake Alpha");
    expect(chart.type).toBe("d3line");
    expect(chart.xAxisLabel).toBe("Year");
    expect(chart.yAxisLabel).toBe("Total Phosphorus");
    expect(chart.data.labels).toEqual(["2020", "2021"]);
    expect(chart.data.datasets[0].customCounts).toEqual([3, 4]);
    expect(chart.data.datasets[0].data).toEqual([2, 4]);
    expect(chart.data.datasets[0].band).toEqual([
      { min: 0.5, max: 3.5 },
      { min: 3, max: 5 },
    ]);
  });

  it("builds a comparison chart across the selected sites", () => {
    const chart = buildComparisonChart(rawData, {
      selectedSites: ["Lake Alpha", "Lake Beta"],
      parameter: "Total Phosphorus",
      chartType: "comparison",
      startYear: 2020,
      endYear: 2021,
    });

    expect(chart.title).toBe("Total Phosphorus Comparison by Site");
    expect(chart.type).toBe("d3bar");
    expect(chart.xAxisLabel).toBe("Site");
    expect(chart.yAxisLabel).toBe("Total Phosphorus");
    expect(chart.subtitle).toBe("Selected lakes (n): 2");
    expect(chart.data.datasets[0].data).toEqual([2.667, 4]);
    expect(chart.data.datasets[0].customCounts).toEqual([7, 11]);
    expect(chart.data.labels).toEqual([["Lake Alpha"], ["Lake Beta"]]);
  });

  it("formats the y axis label with a unit when one is provided", () => {
    expect(formatParameterAxisLabel("Total Phosphorus", "µg/L")).toBe(
      "Total Phosphorus (µg/L)"
    );
    expect(formatParameterAxisLabel("Total Phosphorus", "")).toBe("Total Phosphorus");
    expect(formatParameterAxisLabel("", "µg/L")).toBe("");

    const cfg = {
      selectedSites: ["Lake Alpha", "Lake Beta"],
      trendIndex: 0,
      parameter: "Total Phosphorus",
      startYear: 2020,
      endYear: 2021,
    };

    const trend = buildTrendChart(
      rawData,
      { ...cfg, chartType: "trend" },
      defaultColors,
      "µg/L"
    );
    expect(trend.yAxisLabel).toBe("Total Phosphorus (µg/L)");

    const comparison = buildComparisonChart(
      rawData,
      { ...cfg, chartType: "comparison" },
      defaultColors,
      "µg/L"
    );
    expect(comparison.yAxisLabel).toBe("Total Phosphorus (µg/L)");
  });
});
