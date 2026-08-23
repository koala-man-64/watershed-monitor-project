const DEFAULT_COLORS = [
  "#37474f",
  "#6faecb",
  "#90a4ae",
  "#b0c4d6",
  "#5f7d95",
  "#a5b8c8",
  "#adb5bd",
];

const round3 = (value) =>
  Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;

function wrapLabel(label, maxChars = 12) {
  if (!label) {
    return label;
  }

  const words = String(label).split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    if (`${line} ${word}`.trim().length <= maxChars) {
      line = line ? `${line} ${word}` : word;
      return;
    }

    if (line) {
      lines.push(line);
    }

    line = word;
  });

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [String(label)];
}

export const defaultColors = DEFAULT_COLORS;

export function getTrendSite(cfg = {}) {
  const selectedSites = Array.isArray(cfg.selectedSites) ? cfg.selectedSites : [];
  if (selectedSites.length === 0) {
    return null;
  }

  const count = selectedSites.length;
  let index = Number.isFinite(cfg.trendIndex) ? cfg.trendIndex : count - 1;
  index = ((index % count) + count) % count;

  return selectedSites[index] || selectedSites[count - 1];
}

export function filterRowsForConfig(rawData = [], cfg = {}) {
  const {
    parameter,
    startYear,
    endYear,
    chartType = "comparison",
  } = cfg;
  const selectedSites = Array.isArray(cfg.selectedSites) ? cfg.selectedSites : [];
  const trendSite = chartType === "trend" ? getTrendSite(cfg) : null;

  return rawData.filter((row) => {
    const rowParam = row?.Parameter ? String(row.Parameter).trim() : "";
    const rowSite = row?.Site ? String(row.Site).trim() : "";
    const yearNum = parseInt(row?.Year, 10);

    if (rowParam !== parameter || !Number.isFinite(yearNum)) {
      return false;
    }

    if (startYear != null && yearNum < startYear) {
      return false;
    }

    if (endYear != null && yearNum > endYear) {
      return false;
    }

    if (chartType === "trend") {
      return Boolean(trendSite) && rowSite === trendSite;
    }

    return selectedSites.includes(rowSite);
  });
}

export function buildTrendChart(rawData, cfg, palette = defaultColors) {
  const parameter = cfg?.parameter;
  const site = getTrendSite(cfg);
  const filtered = filterRowsForConfig(rawData, { ...cfg, chartType: "trend" });

  const groupAvgs = {};
  const groupMins = {};
  const groupMaxs = {};
  const countByYear = {};

  filtered.forEach((row) => {
    const year = row.Year;
    const avgVal = round3(parseFloat(row.Avg));
    const minVal = round3(parseFloat(row.Min));
    const maxVal = round3(parseFloat(row.Max));
    const count = parseInt(row.Count, 10);

    if (Number.isFinite(avgVal)) {
      (groupAvgs[year] ||= []).push(avgVal);
    }
    if (Number.isFinite(minVal)) {
      (groupMins[year] ||= []).push(minVal);
    }
    if (Number.isFinite(maxVal)) {
      (groupMaxs[year] ||= []).push(maxVal);
    }
    if (Number.isFinite(count)) {
      countByYear[year] = (countByYear[year] || 0) + count;
    }
  });

  const sortedYears = Array.from(
    new Set([
      ...Object.keys(groupAvgs),
      ...Object.keys(groupMins),
      ...Object.keys(groupMaxs),
    ])
  ).sort((left, right) => +left - +right);

  const labels = [];
  const avgs = [];
  const band = [];
  const counts = [];

  sortedYears.forEach((year) => {
    const averages = groupAvgs[year] || [];
    if (!averages.length) {
      return;
    }

    const meanAvg = averages.reduce((sum, value) => sum + value, 0) / averages.length;

    const minValues = groupMins[year] || [];
    const maxValues = groupMaxs[year] || [];
    const minVal = minValues.length ? Math.min(...minValues) : meanAvg;
    const maxVal = maxValues.length ? Math.max(...maxValues) : meanAvg;

    labels.push(year);
    avgs.push(round3(meanAvg));
    band.push({ min: round3(minVal), max: round3(maxVal) });
    counts.push(countByYear[year] || 0);
  });

  return {
    title: site ? `${parameter} Trend for ${site}` : "Trend",
    subtitle: parameter ? `${parameter} by year` : "",
    type: "d3line",
    xAxisLabel: "Year",
    yAxisLabel: parameter || "",
    data: {
      labels,
      datasets: [
        {
          label: parameter,
          data: avgs,
          band,
          backgroundColor: palette[0],
          borderColor: palette[0],
          customCounts: counts,
        },
      ],
    },
  };
}

export function buildComparisonChart(rawData, cfg, palette = defaultColors) {
  const parameter = cfg?.parameter;
  const selectedSites = Array.isArray(cfg?.selectedSites) ? cfg.selectedSites : [];
  const filtered = filterRowsForConfig(rawData, { ...cfg, chartType: "comparison" });

  const groups = {};
  const countsBySite = {};

  filtered.forEach((row) => {
    const site = row?.Site ? String(row.Site).trim() : "";
    const avgVal = round3(parseFloat(row.Avg));
    const count = parseInt(row.Count, 10);

    if (!site || !Number.isFinite(avgVal)) {
      return;
    }

    (groups[site] ||= []).push(avgVal);
    countsBySite[site] = (countsBySite[site] || 0) + (Number.isFinite(count) ? count : 0);
  });

  const sites = Object.keys(groups);
  const values = sites.map((site) => {
    const averages = groups[site];
    const mean = averages.reduce((sum, value) => sum + value, 0) / averages.length;
    return round3(mean);
  });
  const counts = sites.map((site) => countsBySite[site] || 0);

  return {
    title: `${parameter} Comparison by Site`,
    subtitle: `Selected lakes (n): ${new Set(selectedSites).size}`,
    type: "d3bar",
    xAxisLabel: "Site",
    yAxisLabel: parameter || "",
    data: {
      labels: sites.map((site) => wrapLabel(site, 10)),
      datasets: [
        {
          label: parameter,
          data: values,
          backgroundColor: sites.map((_, index) => palette[index % palette.length]),
          customCounts: counts,
        },
      ],
    },
  };
}
