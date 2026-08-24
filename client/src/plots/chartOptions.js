import { Chart, registerables } from "chart.js";
import {
  BoxAndWiskers,
  BoxPlotController,
  Violin,
  ViolinController,
} from "@sgratzl/chartjs-chart-boxplot";

Chart.register(
  ...registerables,
  BoxPlotController,
  ViolinController,
  BoxAndWiskers,
  Violin
);

Chart.defaults.font.family =
  'Lato, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
Chart.defaults.color = "#37474f";

function getFontScale() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 1;
  }

  try {
    const rootStyle = getComputedStyle(document.documentElement);
    const raw = rootStyle.getPropertyValue("--font-scale");
    const scale = parseFloat(raw);
    return Number.isFinite(scale) ? scale : 1;
  } catch {
    return 1;
  }
}

export const chartFontScale = getFontScale();
export const chartFontFamily = Chart.defaults.font.family;

Chart.defaults.font.size = 12 * chartFontScale;

const countFontPx = 14 * chartFontScale;
const countFont = `700 ${countFontPx - 4}px ${chartFontFamily}`;

const countPlugin = {
  id: "countPlugin",
  afterDatasetsDraw(chart) {
    const dataset = chart.data?.datasets?.[0];
    if (!dataset) {
      return;
    }

    const counts = dataset.customCounts || [];
    const meta = chart.getDatasetMeta(0);
    const ctx = chart.ctx;
    const options = chart.options?.plugins?.countPlugin || {};
    const baseOffset = Number.isFinite(options.offset) ? options.offset : 10;

    ctx.save();
    meta.data.forEach((element, index) => {
      const count = counts[index];
      if (count == null) {
        return;
      }

      const position = element.tooltipPosition ? element.tooltipPosition() : element;
      ctx.fillStyle = options.color || "#37474f";
      ctx.textAlign = "center";
      ctx.font = options.font || countFont;
      ctx.fillText(String(count), position.x, position.y - baseOffset);
    });
    ctx.restore();
  },
};

Chart.register(countPlugin);

export function computeYRangeForChart(chartObj) {
  try {
    const dataset = chartObj?.data?.datasets?.[0];
    if (!dataset) {
      return null;
    }

    if (chartObj.type === "d3line") {
      const values = dataset.data
        .map((datum) => Number(datum))
        .filter((value) => Number.isFinite(value));
      const band = Array.isArray(dataset.band) ? dataset.band : [];
      const mins = band
        .map((entry) => Number(entry?.min))
        .filter((value) => Number.isFinite(value));
      const maxs = band
        .map((entry) => Number(entry?.max))
        .filter((value) => Number.isFinite(value));

      const lows = mins.length ? mins : values;
      const highs = maxs.length ? maxs : values;
      if (!lows.length || !highs.length) {
        return null;
      }

      return {
        min: Math.min(...lows),
        max: Math.max(...highs),
      };
    }

    const values = dataset.data
      .map((datum) => Number(datum))
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return null;
    }

    return {
      min: 0,
      max: Math.max(...values),
    };
  } catch {
    return null;
  }
}

export function getPaddedYDomain(chartObj, { floorAtZero = false } = {}) {
  const range = computeYRangeForChart(chartObj);
  if (!range) {
    return undefined;
  }

  const span = range.max - range.min;
  let pad = span * 0.1;
  if (!Number.isFinite(pad) || pad === 0) {
    pad = 1;
  }

  return {
    min: floorAtZero ? Math.max(0, range.min - pad) : range.min - pad,
    max: range.max + pad,
  };
}

// Only reachable via the <ReactChart> fallback in ChartPanel, which no chart
// type currently uses. Kept inert rather than deleted so this change does not
// have to touch package.json / package-lock.json.
export function makeOptions(parameterLabel, chartObj) {
  const range = computeYRangeForChart(chartObj);
  let yMin;
  let yMax;

  if (range) {
    const span = range.max - range.min;
    let pad = Number(span) * 0.16;
    if (!Number.isFinite(pad) || pad === 0) {
      pad = Math.max(Math.abs(range.max) * 0.02, 0.1);
    }

    if (chartObj.type === "boxplot") {
      yMin = Math.floor(range.min - pad);
      yMax = Math.ceil(range.max + pad * 2);
    } else {
      yMin = Math.floor(range.min);
      yMax = Math.ceil(range.max + pad * 2);
    }

    if (range.min >= 0 && yMin < 0 && span < 0.5) {
      yMin = 0;
    }
  }

  const isBoxplot = chartObj?.type === "boxplot";

  return {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 200,
    animation: false,
    responsiveAnimationDuration: 0,
    animations: { colors: false, x: { duration: 0 }, y: { duration: 0 } },
    interaction: { mode: "nearest", intersect: true },
    layout: { padding: { top: 12 } },
    scales: {
      y: {
        beginAtZero: !isBoxplot,
        min: isBoxplot && Number.isFinite(yMin) ? yMin : undefined,
        max: isBoxplot && Number.isFinite(yMax) ? yMax : undefined,
        suggestedMin: !isBoxplot && Number.isFinite(yMin) ? Math.max(0, yMin) : undefined,
        suggestedMax: !isBoxplot && Number.isFinite(yMax) ? yMax : undefined,
        grace: !isBoxplot ? "10%" : 0,
        ticks: {
          color: "#37474f",
          precision: 0,
          includeBounds: true,
        },
        grid: { color: "#e5e7eb", tickColor: "#e5e7eb" },
        title: { display: false, text: "" },
      },
      x: {
        offset: true,
        ticks: {
          color: "#37474f",
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          autoSkipPadding: 8,
          padding: 10,
        },
        grid: { color: "#e5e7eb", tickColor: "#e5e7eb" },
      },
    },
    plugins: {
      legend: { display: false },
      countPlugin: {
        gapAboveWhisker: 16 * chartFontScale,
        offset: 10 * chartFontScale,
        font: countFont,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.chart.config.type === "boxplot") {
              const raw = ctx.raw || {};
              const formatValue = (value) =>
                Number.isFinite(value)
                  ? Number(value)
                      .toFixed(3)
                      .replace(/\.0+$/, "")
                      .replace(/\.([^0]*)0+$/, ".$1")
                  : "--";
              const lines = [];
              const series = ctx.dataset?.label || parameterLabel || "";

              if (series) {
                lines.push(series);
              }

              lines.push(`Min: ${formatValue(raw.min)}`);
              if (Number.isFinite(raw.q1)) {
                lines.push(`Q1 (25%): ${formatValue(raw.q1)}`);
              }
              lines.push(`Median: ${formatValue(raw.median)}`);
              if (Number.isFinite(raw.mean)) {
                lines.push(`Mean: ${formatValue(raw.mean)}`);
              }
              if (Number.isFinite(raw.q3)) {
                lines.push(`Q3 (75%): ${formatValue(raw.q3)}`);
              }
              lines.push(`Max: ${formatValue(raw.max)}`);
              return lines;
            }

            const value = ctx.parsed?.y ?? ctx.parsed;
            return `${ctx.dataset?.label ?? ""}: ${value}`;
          },
        },
      },
    },
  };
}
