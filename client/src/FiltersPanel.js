// /client/src/FiltersPanel.js
import React, { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import SearchableMultiSelect from "./SearchableMultiselect.jsx";
import PropTypes from "prop-types";
import { DATA_BLOBS, buildDataUrl } from "./config/dataSources";
import { fetchCachedCsvText } from "./utils/csvCache";
import { trackEvent } from "./utils/telemetry";

/**
 * FiltersPanel
 * - Manages local UI state for filters
 * - Notifies parent via onFiltersChange from user actions
 * - Loads static CSV assets through the cached fetch path and shares parsed data up via onDataLoaded
 */
function FiltersPanel({
  selectedSites = [],
  onFiltersChange = () => {},
  onUpdatePlot1 = () => {},
  onUpdatePlot2 = () => {},
  onDataLoaded = () => {}, // lift data up
  resetSignal = 0,
  /**
   * Whether the Update Plot buttons should be enabled.  When false
   * the buttons are disabled and a helpful tooltip is shown on hover
   * instructing the user to click Continue on the home panel first.
   */
  updateEnabled = true,
}) {
  // Options loaded from CSV
  const [sites, setSites] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  // Local UI state
  const [filters, setFilters] = useState({
    selectedSites: [],
    parameter: "",
    startYear: null,
    endYear: null,
    chartType: "trend",
  });

  // Guard to ensure CSV-based year initialization runs once
  const didInitYearsRef = useRef(false);
  const lastResetSignalRef = useRef(resetSignal);

  // Keep latest onDataLoaded without depending on function identity in effects
  const onDataLoadedRef = useRef(onDataLoaded);
  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  const onFiltersChangeRef = useRef(onFiltersChange);
  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange;
  }, [onFiltersChange]);

  /**
   * Keep local selectedSites in sync with parent prop (no parent updates here).
   */
  useEffect(() => {
    if (!Array.isArray(selectedSites)) return;
    setFilters((prev) => {
      const sameLength = prev.selectedSites.length === selectedSites.length;
      const sameOrder =
        sameLength && prev.selectedSites.every((v, i) => v === selectedSites[i]);
      return sameOrder ? prev : { ...prev, selectedSites };
    });
  }, [selectedSites]);

  useEffect(() => {
    if (lastResetSignalRef.current === resetSignal) {
      return;
    }

    lastResetSignalRef.current = resetSignal;

    const minYear = availableYears[0] ?? null;
    const maxYear = availableYears[availableYears.length - 1] ?? null;
    const nextFilters = {
      selectedSites: [],
      parameter: "",
      startYear: minYear,
      endYear: maxYear,
      chartType: "trend",
    };

    setFilters(nextFilters);
    onFiltersChange(nextFilters);
  }, [availableYears, onFiltersChange, resetSignal]);

  /**
   * Fetch CSV(s) once, populate options, initialize years, and
   * bubble up the parsed data to App via onDataLoaded.
   */
  useEffect(() => {
    const dataUrl = buildDataUrl(DATA_BLOBS.main);
    const infoUrl = buildDataUrl(DATA_BLOBS.info);

    let cancelled = false;

    let latestDataCsvText = "";
    let latestInfoCsvText = "";

    const applyLoadedCsvs = () => {
      if (cancelled || !latestDataCsvText) {
        return;
      }

      let dataRows = [];
      Papa.parse(latestDataCsvText, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data }) => (dataRows = data),
      });

      let infoRows = [];
      if (latestInfoCsvText) {
        Papa.parse(latestInfoCsvText, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data }) => (infoRows = data),
        });
      }

      const infoMap = {};
      for (const r of infoRows || []) {
        const key = r?.Parameter ? String(r.Parameter).trim() : "";
        if (key) infoMap[key] = r;
      }

      const allSites = dataRows.map((r) => r.Site).filter(Boolean);
      const allParameters = dataRows.map((r) => r.Parameter).filter(Boolean);
      const uniqueSites = [...new Set(allSites)].sort((a, b) => a.localeCompare(b));
      const uniqueParameters = [...new Set(allParameters)].sort((a, b) => a.localeCompare(b));

      const yearsNum = dataRows
        .map((row) => parseInt(row.Year, 10))
        .filter((y) => Number.isFinite(y));
      const uniqueYears = [...new Set(yearsNum)].sort((a, b) => a - b);
      const min = uniqueYears[0];
      const max = uniqueYears[uniqueYears.length - 1];

      setSites(uniqueSites);
      setParameters(uniqueParameters);
      setAvailableYears(uniqueYears);

      if (!didInitYearsRef.current && uniqueYears.length) {
        didInitYearsRef.current = true;
        setFilters((prev) => ({
          ...prev,
          startYear: prev.startYear ?? min,
          endYear: prev.endYear ?? max,
        }));
        onFiltersChangeRef.current({ startYear: min, endYear: max });
      }

      onDataLoadedRef.current?.({ rawData: dataRows, infoData: infoMap });
    };

    const handleDataCsv = (csvText) => {
      latestDataCsvText = csvText;
      applyLoadedCsvs();
    };

    const handleInfoCsv = (csvText) => {
      latestInfoCsvText = csvText || "";
      if (latestDataCsvText) {
        applyLoadedCsvs();
      }
    };

    fetchCachedCsvText(dataUrl, { onFreshText: handleDataCsv })
      .then(handleDataCsv)
      .catch((err) => {
        console.error("Error loading data CSV:", err);
        if (!cancelled) {
          onDataLoadedRef.current?.({ rawData: [], infoData: {} });
        }
      });

    fetchCachedCsvText(infoUrl, { onFreshText: handleInfoCsv })
      .then(handleInfoCsv)
      .catch((err) => {
        console.error("Error loading info CSV:", err);
        handleInfoCsv("");
      });

    return () => {
      cancelled = true;
    };
  }, []); // run once

  // ---------------- Handlers (user-initiated; safe to notify parent) ----------------
  const handleSitesChange = (updated) => {
    setFilters((prev) => ({ ...prev, selectedSites: updated }));
    onFiltersChange({ selectedSites: updated });
    trackEvent("site_selected", {
      selectedSiteCount: updated.length,
      chartType: filters.chartType,
      parameter: filters.parameter || "unselected",
    });
  };

  const handleStartYearChange = (e) => {
    const newStart = parseInt(e.target.value, 10);
    if (!Number.isFinite(newStart)) return;
    const currentEnd = filters.endYear;
    const nextEnd = currentEnd != null && newStart <= currentEnd ? currentEnd : newStart;
    setFilters((prev) => ({ ...prev, startYear: newStart, endYear: nextEnd }));
    onFiltersChange({ startYear: newStart, endYear: nextEnd });
  };

  const handleEndYearChange = (e) => {
    const rawEnd = parseInt(e.target.value, 10);
    if (!Number.isFinite(rawEnd)) return;
    const start = filters.startYear;
    const nextEnd = start != null ? Math.max(rawEnd, start) : rawEnd;
    setFilters((prev) => ({ ...prev, endYear: nextEnd }));
    onFiltersChange({ startYear: start ?? nextEnd, endYear: nextEnd });
  };

  const handleParameterChange = (e) => {
    const parameter = e.target.value;
    setFilters((prev) => ({ ...prev, parameter }));
    onFiltersChange({ parameter });
  };

  const handleChartTypeChange = (e) => {
    const chartType = e.target.value;
    setFilters((prev) => ({ ...prev, chartType }));
    onFiltersChange({ chartType });
  };

  const disabledHint = "Click Continue in the welcome panel to enable plotting.";

  const trackPlotUpdate = (slot) => {
    trackEvent("plot_updated", {
      slot,
      chartType: filters.chartType,
      parameter: filters.parameter || "unselected",
      selectedSiteCount: filters.selectedSites.length,
      startYear: filters.startYear,
      endYear: filters.endYear,
    });
  };

  return (
    <div className="filters" style={{ overflowY: "auto" }}>
      <div className="filters-controls">
        {/* Sites (multi-select) - always visible */}
        <div className="filter-group site-group">
          <SearchableMultiSelect
            label="Sites"
            options={sites}
            selected={filters.selectedSites}
            onChange={handleSitesChange}
            placeholder="Search sites..."
            maxPanelHeight={320}
            className="w-full"
          />
        </div>

        {/* Render other filter controls only when updateEnabled is true. */}
        {updateEnabled && (
          <>
            {/* Start Year */}
            <div className="filter-group">
              <div className="filter-dropdown filter-dropdown-centered">
                <label className="sms-label">Start Year</label>
                <select
                  value={filters.startYear ?? ""}
                  onChange={handleStartYearChange}
                  className="year-select"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* End Year */}
            <div className="filter-group">
              <div className="filter-dropdown filter-dropdown-centered">
                <label className="sms-label">End Year</label>
                <select
                  value={filters.endYear ?? ""}
                  onChange={handleEndYearChange}
                  className="year-select"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parameter */}
            <div className="filter-group">
              <div className="filter-dropdown filter-dropdown-centered">
                <label className="sms-label">Parameter</label>
                <select
                  value={filters.parameter}
                  onChange={handleParameterChange}
                  className="year-select"
                >
                  <option value="" disabled>
                    Select parameter...
                  </option>
                  {parameters.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chart Type */}
            <div className="filter-group">
              <div className="filter-dropdown filter-dropdown-centered">
                <label className="sms-label">Chart Type</label>
                <select
                  value={filters.chartType}
                  onChange={handleChartTypeChange}
                  className="year-select"
                >
                  <option value="trend">Trend</option>
                  <option value="comparison">Comparison</option>
                </select>
              </div>
            </div>
          </>
        )}

        {updateEnabled && (
          <div className="filter-group filter-buttons">
            <button
              type="button"
              className="reset-btn"
              onClick={() => {
              trackPlotUpdate("plot1");
              onUpdatePlot1(filters);
              }}
              disabled={!updateEnabled}
              title={!updateEnabled ? disabledHint : "Update the left plot with current filters"}
          >
              Update Plot 1
            </button>

            <button
              type="button"
              className="reset-btn"
              onClick={() => {
              trackPlotUpdate("plot2");
              onUpdatePlot2(filters);
              }}
              disabled={!updateEnabled}
              title={!updateEnabled ? disabledHint : "Update the right plot with current filters"}
          >
              Update Plot 2
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
FiltersPanel.propTypes = {
  selectedSites: PropTypes.arrayOf(PropTypes.string).isRequired,
  onFiltersChange: PropTypes.func.isRequired,
  onUpdatePlot1: PropTypes.func.isRequired,
  onUpdatePlot2: PropTypes.func.isRequired,
  onDataLoaded: PropTypes.func, // lifted data
  resetSignal: PropTypes.number,
  /** Whether the Update Plot buttons should be enabled */
  updateEnabled: PropTypes.bool,
};

export default FiltersPanel;
