import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import ChartPanel from "./plots/ChartPanel";
import {
  buildComparisonChart,
  buildTrendChart,
  defaultColors,
  filterRowsForConfig,
} from "./plots/chartBuilders";
import { downloadPlotData } from "./plots/download";
import { cycleTrendSite } from "./plots/plotConfigs";
import { describeProvenance } from "./utils/provenance";
import { applyOutlierView, describeOutlierView } from "./utils/outliers";

function getParameterUnit(infoData, cfg) {
  const entry = cfg?.parameter && infoData ? infoData[cfg.parameter] : null;
  return entry?.Unit ? String(entry.Unit).trim() : "";
}

/**
 * One sentence under a chart covering both where its values came from and what
 * the outlier setting did to them.
 *
 * The outlier half counts from `sourceData` rather than the plotted rows: a row
 * excluded outright takes its own flag count with it, and "0 excluded" is
 * exactly the wrong thing to tell someone who just excluded something.
 */
function buildNotice(plottedRows, sourceRows, cfg, excludeOutliers) {
  if (!cfg) {
    return null;
  }

  const parts = [
    describeProvenance(filterRowsForConfig(plottedRows, cfg)),
    describeOutlierView(filterRowsForConfig(sourceRows, cfg), excludeOutliers),
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : null;
}

function buildChartForConfig(rawData, cfg, unit) {
  if (!cfg) {
    return null;
  }

  return cfg.chartType === "trend"
    ? buildTrendChart(rawData, cfg, defaultColors, unit)
    : buildComparisonChart(rawData, cfg, defaultColors, unit);
}

function Plots({
  plotConfigs = [],
  setPlotConfigs,
  rawData = [],
  infoData = {},
  loading = false,
}) {
  const cfg1 = plotConfigs[0] || null;
  const cfg2 = plotConfigs[1] || null;
  // Off by default. The samples are real readings until someone with the raw
  // record says otherwise, so hiding them has to be the reader's choice rather
  // than something the site does quietly on their behalf.
  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const sourceData = Array.isArray(rawData) ? rawData : [];
  const normalizedData = useMemo(
    () => applyOutlierView(sourceData, excludeOutliers),
    [sourceData, excludeOutliers]
  );
  const unit1 = getParameterUnit(infoData, cfg1);
  const unit2 = getParameterUnit(infoData, cfg2);

  const chart1 = useMemo(
    () => buildChartForConfig(normalizedData, cfg1, unit1),
    [normalizedData, cfg1, unit1]
  );
  const chart2 = useMemo(
    () => buildChartForConfig(normalizedData, cfg2, unit2),
    [normalizedData, cfg2, unit2]
  );

  // Label each plot with the provenance of the rows it actually draws, so a
  // measured series is never read as simulated (or the reverse) off the
  // site-wide banner alone.
  const notice1 = useMemo(
    () => buildNotice(normalizedData, sourceData, cfg1, excludeOutliers),
    [normalizedData, sourceData, cfg1, excludeOutliers]
  );
  const notice2 = useMemo(
    () => buildNotice(normalizedData, sourceData, cfg2, excludeOutliers),
    [normalizedData, sourceData, cfg2, excludeOutliers]
  );

  const handleTrendNavigation = (slot, step) => {
    if (typeof setPlotConfigs !== "function") {
      return;
    }

    setPlotConfigs((prev) => cycleTrendSite(prev, slot, step));
  };

  const getNavigationProps = (cfg, slot) => {
    if (!cfg || cfg.chartType !== "trend") {
      return null;
    }

    const selectedSites = Array.isArray(cfg.selectedSites) ? cfg.selectedSites : [];
    if (selectedSites.length === 0) {
      return null;
    }

    return {
      prev: () => handleTrendNavigation(slot, -1),
      next: () => handleTrendNavigation(slot, 1),
      hasMultipleSites: selectedSites.length > 1,
    };
  };

  if (loading) {
    return (
      <section className="plots">
        <div className="plots-container">
          <p>Loading data...</p>
        </div>
      </section>
    );
  }

  return (
    <div
      className="plots-container"
      style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
    >
      <div className="plots-toolbar">
        <label className="outlier-toggle">
          <input
            type="checkbox"
            checked={excludeOutliers}
            onChange={(event) => setExcludeOutliers(event.target.checked)}
          />
          <span>Exclude statistical outliers</span>
        </label>
        <span className="outlier-toggle-help">
          Samples far outside their own lake and parameter&apos;s range. Flagged when the
          data is prepared, not recalculated here.
        </span>
      </div>

      <ChartPanel
        chartObj={chart1}
        cfg={cfg1}
        slotLabel="Plot 1"
        notice={notice1}
        onDownload={
          cfg1 ? () => downloadPlotData(normalizedData, cfg1) : undefined
        }
        nav={getNavigationProps(cfg1, 0)}
      />
      <ChartPanel
        chartObj={chart2}
        cfg={cfg2}
        slotLabel="Plot 2"
        notice={notice2}
        onDownload={
          cfg2 ? () => downloadPlotData(normalizedData, cfg2) : undefined
        }
        nav={getNavigationProps(cfg2, 1)}
      />
    </div>
  );
}

Plots.propTypes = {
  plotConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      selectedSites: PropTypes.arrayOf(PropTypes.string).isRequired,
      parameter: PropTypes.string.isRequired,
      chartType: PropTypes.oneOf(["trend", "comparison"]).isRequired,
      startYear: PropTypes.number.isRequired,
      endYear: PropTypes.number.isRequired,
      trendIndex: PropTypes.number,
    })
  ).isRequired,
  setPlotConfigs: PropTypes.func.isRequired,
  rawData: PropTypes.arrayOf(PropTypes.object),
  infoData: PropTypes.objectOf(PropTypes.object),
  loading: PropTypes.bool,
};

Plots.defaultProps = {
  rawData: [],
  infoData: {},
  loading: false,
};

export default Plots;
