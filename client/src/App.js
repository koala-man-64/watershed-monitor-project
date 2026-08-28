import React, { useCallback, useMemo, useRef, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import PropTypes from "prop-types";
import "./App.css";
import trendPlotIcon from "./trend_plot_icon.png";
import comparisonPlotIcon from "./comparison_plot_icon.png";
import DemoBanner from "./DemoBanner";
import FiltersPanel from "./FiltersPanel";
import Header from "./Header";
import Plots from "./Plots";
import MapPanel from "./MapPanel";
import { upsertPlotConfig } from "./plots/plotConfigs";
import { APP_TITLE, SUPPORT_CONTACT } from "./siteContent";
import { measuredSiteNames } from "./utils/provenance";

function FilterMapPanel({
  filters,
  onFiltersChange,
  onUpdatePlot1,
  onUpdatePlot2,
  onDataLoaded,
  resetSignal,
  measuredSites,
  trendSingleSite = false,
  updateEnabled = false,
}) {
  const containerRef = useRef(null);

  const handleMarkerClick = (siteName) => {
    const nextSelected = filters.selectedSites.includes(siteName)
      ? filters.selectedSites.filter((name) => name !== siteName)
      : [...filters.selectedSites, siteName];

    onFiltersChange({ selectedSites: nextSelected });
  };

  return (
    <div ref={containerRef} className="filter-map-panel">
      <FiltersPanel
        selectedSites={filters.selectedSites}
        onFiltersChange={onFiltersChange}
        onUpdatePlot1={onUpdatePlot1}
        onUpdatePlot2={onUpdatePlot2}
        onDataLoaded={onDataLoaded}
        resetSignal={resetSignal}
        trendSingleSite={trendSingleSite}
        updateEnabled={updateEnabled}
      />

      <section className="map">
        <MapPanel
          selectedSites={filters.selectedSites}
          onMarkerClick={handleMarkerClick}
          measuredSites={measuredSites}
        />
      </section>
    </div>
  );
}

FilterMapPanel.propTypes = {
  filters: PropTypes.shape({
    selectedSites: PropTypes.arrayOf(PropTypes.string).isRequired,
    startYear: PropTypes.number,
    endYear: PropTypes.number,
    parameter: PropTypes.string,
    chartType: PropTypes.oneOf(["trend", "comparison"]),
  }).isRequired,
  onFiltersChange: PropTypes.func.isRequired,
  onUpdatePlot1: PropTypes.func.isRequired,
  onUpdatePlot2: PropTypes.func.isRequired,
  onDataLoaded: PropTypes.func,
  resetSignal: PropTypes.number.isRequired,
  measuredSites: PropTypes.instanceOf(Set),
  trendSingleSite: PropTypes.bool,
  updateEnabled: PropTypes.bool,
};

function WelcomePanel({ onContinue }) {
  return (
    <div className="plots" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <h1
          style={{
            marginTop: 0,
            marginBottom: 12,
            fontSize: 28,
            fontFamily: "Lora, Georgia, serif",
            color: "var(--color-secondary)",
          }}
        >
          Welcome to the {APP_TITLE}!
        </h1>

        <p
          style={{
            marginBottom: 10,
            lineHeight: 1.5,
            fontSize: "calc(1em * var(--font-scale, 1))",
          }}
        >
          This demonstration site shows how water quality data for lakes in northern
          Michigan can be retrieved, displayed, and downloaded. Click the markers on the
          map or use the Sites list to see which sites are included.
        </p>
        <p
          style={{
            marginBottom: 10,
            lineHeight: 1.5,
            fontSize: "calc(1em * var(--font-scale, 1))",
          }}
        >
          Five parameters (measurements) are available for each lake: Chloride,
          Chlorophyll-a, Nitrate, Secchi Depth, and Total Phosphorus. Values are reported
          once per site per year, as a yearly average together with the minimum and
          maximum recorded that year.
        </p>
        <p
          style={{
            marginBottom: 10,
            lineHeight: 1.5,
            fontSize: "calc(1em * var(--font-scale, 1))",
          }}
        >
          Data can be displayed as <strong>Trend</strong> lines{" "}
          <img src={trendPlotIcon} alt="Trend plot icon" /> that show how a parameter
          changes over time. This allows you to determine if a parameter is increasing
          or decreasing. You can compare the trend of a single parameter for two different
          sites or compare two different parameters for the same site.
        </p>
        <p
          style={{
            marginBottom: 10,
            lineHeight: 1.5,
            fontSize: "calc(1em * var(--font-scale, 1))",
          }}
        >
          Data can also be displayed as a bar graph{" "}
          <img src={comparisonPlotIcon} alt="Comparison plot icon" /> to <strong>Compare</strong>{" "}
          the average value of one parameter across the sites you have selected. This
          allows you to attain an overview of conditions on a more regional basis.
        </p>
        <p
          style={{
            marginBottom: 10,
            lineHeight: 1.5,
            fontSize: "calc(1em * var(--font-scale, 1))",
          }}
        >
          Click the Continue button below to proceed to the database. There you will be
          able to select one or more sites, select the parameter, select the time
          interval, and choose between <strong>Trend</strong> and <strong>Comparison</strong> options.
        </p>
        <p
          style={{
            marginBottom: 10,
            lineHeight: 1.5,
            fontSize: "calc(1em * var(--font-scale, 1))",
          }}
        >
          This is a demonstration site built by the {SUPPORT_CONTACT.organization}. A
          published contact address will be added here once it is confirmed.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          type="button"
          className="reset-btn welcome-continue-button"
          onClick={onContinue}
          style={{ marginLeft: "auto" }}
          title="Enable plotting and show the charts panel"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

WelcomePanel.propTypes = {
  onContinue: PropTypes.func.isRequired,
};

function createInitialFilters() {
  return {
    selectedSites: [],
    startYear: null,
    endYear: null,
    parameter: "",
    chartType: "trend",
  };
}

function App() {
  const [filters, setFilters] = useState(createInitialFilters);
  const [plotConfigs, setPlotConfigs] = useState([]);
  const [rawData, setRawData] = useState(null);
  const [infoData, setInfoData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const [updateEnabled, setUpdateEnabled] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  // Derived from the loaded rows rather than hardcoded, so the map labelling
  // follows the CSV automatically as measured coverage grows.
  const measuredSites = useMemo(() => measuredSiteNames(rawData || []), [rawData]);

  const onFiltersChange = useCallback((partialOrFull) => {
    setFilters((prev) => ({ ...prev, ...partialOrFull }));
  }, []);

  const handleDataLoaded = useCallback(({ rawData: nextRawData, infoData: nextInfoData }) => {
    setRawData(Array.isArray(nextRawData) ? nextRawData : []);
    setInfoData(nextInfoData && typeof nextInfoData === "object" ? nextInfoData : {});
    setLoading(false);
  }, []);

  const resetToWelcome = useCallback(() => {
    setFilters(createInitialFilters());
    setPlotConfigs([]);
    setShowWelcome(true);
    setUpdateEnabled(false);
    setResetSignal((current) => current + 1);
  }, []);

  const handlePlotUpdate = useCallback((slot, plotFilters) => {
    setPlotConfigs((prev) => upsertPlotConfig(prev, slot, plotFilters));
  }, []);

  const handleUpdatePlot1 = useCallback((plotFilters) => {
    handlePlotUpdate(0, plotFilters);
  }, [handlePlotUpdate]);

  const handleUpdatePlot2 = useCallback((plotFilters) => {
    handlePlotUpdate(1, plotFilters);
  }, [handlePlotUpdate]);

  const rightSide = showWelcome ? (
    <WelcomePanel
      onContinue={() => {
        setShowWelcome(false);
        setUpdateEnabled(true);
      }}
    />
  ) : (
    <div className="plots-view">
      <Plots
        plotConfigs={plotConfigs}
        setPlotConfigs={setPlotConfigs}
        rawData={rawData}
        infoData={infoData}
        loading={loading}
      />

      <div className="plots-footer-actions">
        <button
          type="button"
          className="reset-btn plots-footer-button plots-footer-button-back"
          onClick={resetToWelcome}
          title="Return to the welcome page"
        >
          Back
        </button>
      </div>
    </div>
  );

  return (
    <Router>
      <div className="app">
        <Header onHomeClick={resetToWelcome} />
        <DemoBanner />
        <div className="app-content">
          <Routes>
            <Route
              path="/"
              element={
                <div className="main">
                  <div className="left">
                    <FilterMapPanel
                      filters={filters}
                      onFiltersChange={onFiltersChange}
                      onUpdatePlot1={handleUpdatePlot1}
                      onUpdatePlot2={handleUpdatePlot2}
                      onDataLoaded={handleDataLoaded}
                      resetSignal={resetSignal}
                      measuredSites={measuredSites}
                      trendSingleSite={false}
                      updateEnabled={updateEnabled}
                    />
                  </div>

                  <div className="right">{rightSide}</div>
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
