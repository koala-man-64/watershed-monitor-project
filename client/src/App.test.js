/* eslint-env jest */
/* eslint-disable react/prop-types */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

jest.mock(
  "react-router-dom",
  () => {
    const React = require("react");

    return {
      BrowserRouter: ({ children }) => <>{children}</>,
      Routes: ({ children }) => <>{children}</>,
      Route: ({ element }) => element,
      Navigate: () => null,
      Link: ({ children, to = "/", ...props }) => (
        <a href={to} {...props}>
          {children}
        </a>
      ),
    };
  },
  { virtual: true }
);

jest.mock("./FiltersPanel", () => {
  const React = require("react");

  return function MockFiltersPanel({
    updateEnabled,
    onDataLoaded,
    onUpdatePlot1,
  }) {
    React.useEffect(() => {
      onDataLoaded({
        rawData: [
          {
            Site: "Lake Alpha",
            Parameter: "Total Phosphorus",
            Year: "2020",
            Avg: "1.2",
            Min: "1.0",
            Max: "1.4",
            Count: "3",
          },
        ],
      });
    }, [onDataLoaded]);

    return (
      <div>
        <div data-testid="filters-panel-state">
          {updateEnabled ? "enabled" : "disabled"}
        </div>
        <button
          type="button"
          onClick={() =>
            onUpdatePlot1({
              selectedSites: ["Lake Alpha", "Lake Beta"],
              parameter: "Total Phosphorus",
              startYear: 2020,
              endYear: 2021,
              chartType: "trend",
            })
          }
        >
          Mock Update Plot 1
        </button>
      </div>
    );
  };
});

jest.mock("./MapPanel", () => {
  const React = require("react");
  return function MockMapPanel() {
    return <div data-testid="map-panel" />;
  };
});

jest.mock("./Plots", () => {
  const React = require("react");
  return function MockPlots({ plotConfigs, loading }) {
    return (
      <div>
        <div>plots view</div>
        <div data-testid="plots-loading">{loading ? "loading" : "loaded"}</div>
        <pre data-testid="plots-props">{JSON.stringify(plotConfigs)}</pre>
      </div>
    );
  };
});

test("clicking the header title returns the user to the welcome entry state", () => {
  render(<App />);

  expect(screen.getByText(/welcome to the nw michigan water quality database/i)).toBeInTheDocument();
  expect(screen.getByTestId("filters-panel-state")).toHaveTextContent("disabled");

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  expect(screen.queryByText(/welcome to the nw michigan water quality database/i)).not.toBeInTheDocument();
  expect(screen.getByText(/plots view/i)).toBeInTheDocument();
  expect(screen.getByTestId("filters-panel-state")).toHaveTextContent("enabled");

  fireEvent.click(screen.getByRole("link", { name: /home/i }));

  expect(screen.getByText(/welcome to the nw michigan water quality database/i)).toBeInTheDocument();
  expect(screen.queryByText(/plots view/i)).not.toBeInTheDocument();
  expect(screen.getByTestId("filters-panel-state")).toHaveTextContent("disabled");
});

test("clicking the back button returns the user to the welcome entry state", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  expect(screen.getByText(/plots view/i)).toBeInTheDocument();
  expect(screen.getByTestId("filters-panel-state")).toHaveTextContent("enabled");

  fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

  expect(screen.getByText(/welcome to the nw michigan water quality database/i)).toBeInTheDocument();
  expect(screen.queryByText(/plots view/i)).not.toBeInTheDocument();
  expect(screen.getByTestId("filters-panel-state")).toHaveTextContent("disabled");
});

test("updating plot 1 stores a normalized trend config", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  fireEvent.click(screen.getByRole("button", { name: /mock update plot 1/i }));

  expect(screen.getByTestId("plots-loading")).toHaveTextContent("loaded");

  const plotConfigs = JSON.parse(screen.getByTestId("plots-props").textContent);
  expect(plotConfigs).toHaveLength(2);
  expect(plotConfigs[0]).toMatchObject({
    selectedSites: ["Lake Alpha", "Lake Beta"],
    parameter: "Total Phosphorus",
    chartType: "trend",
    trendIndex: 1,
  });
  expect(plotConfigs[1]).toBeNull();
});

test("the demonstration notice is visible on the welcome view and the plots view", () => {
  render(<App />);

  // The dataset mixes one measured series with simulated values everywhere
  // else, so the banner has to say both halves - a blanket "all simulated"
  // would be wrong, and staying silent about the rest would be worse.
  expect(screen.getByRole("note")).toHaveTextContent(/values are simulated except/i);
  expect(screen.getByRole("note")).toHaveTextContent(
    /platte lake \(big platte\) and the seven leelanau conservancy lakes/i
  );

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  expect(screen.getByText(/plots view/i)).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent(/values are simulated except/i);
  expect(screen.getByRole("note")).toHaveTextContent(
    /platte lake \(big platte\) and the seven leelanau conservancy lakes/i
  );
});

test("the welcome page no longer publishes an individual contact", () => {
  render(<App />);

  expect(screen.queryByText(/john ransom/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/benziecd\.org/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/231-882-4391/i)).not.toBeInTheDocument();
});
