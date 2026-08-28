import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import Papa from "papaparse";
import MapPanel from "./MapPanel";
import { fetchCachedCsvText } from "./utils/csvCache";

const mockAzureMapsBaseLayer = jest.fn(() => null);
const mockMapTileWarmController = jest.fn(() => null);
const mockMapContainer = jest.fn();

jest.mock("./map/AzureMapsBaseLayer", () => ({
  __esModule: true,
  default: (props) => mockAzureMapsBaseLayer(props),
}));

jest.mock("./map/MapTileWarmController", () => ({
  __esModule: true,
  default: (props) => mockMapTileWarmController(props),
}));

jest.mock("./utils/csvCache", () => ({
  fetchCachedCsvText: jest.fn(),
}));

jest.mock("papaparse", () => ({
  parse: jest.fn((_csvText, options) => {
    options.complete({ data: [] });
  }),
}));

jest.mock("react-leaflet", () => {
  const ReactModule = require("react");

  return {
    MapContainer: ({ children, ...props }) => {
      mockMapContainer(props);
      return ReactModule.createElement("div", { "data-testid": "map-container" }, children);
    },
    // forwardRef: MapPanel attaches a ref to every Marker to drive popups, and
    // a plain function component would warn on each one.
    Marker: ReactModule.forwardRef(({ children }, ref) =>
      ReactModule.createElement("div", { ref }, children)
    ),
    Popup: ({ children }) => ReactModule.createElement("div", null, children),
  };
});

jest.mock("leaflet", () => {
  const DefaultIcon = function DefaultIcon() {};
  DefaultIcon.prototype = {};
  DefaultIcon.mergeOptions = jest.fn();

  function Icon(options) {
    this.options = options;
  }

  Icon.Default = DefaultIcon;

  return {
    __esModule: true,
    default: {
      Icon,
    },
  };
});

describe("MapPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCachedCsvText.mockResolvedValue("");
  });

  test("uses the fixed road tileset without rendering a selector", async () => {
    render(<MapPanel selectedSites={[]} onMarkerClick={jest.fn()} />);

    expect(screen.queryByLabelText("Basemap")).not.toBeInTheDocument();

    await waitFor(() => {
      const lastAzureMapsBaseLayerProps = mockAzureMapsBaseLayer.mock.calls.at(-1)?.[0];
      expect(lastAzureMapsBaseLayerProps).toEqual(
        expect.objectContaining({
          tilesetId: "microsoft.base.road",
        })
      );
    });

    const lastMapTileWarmControllerProps = mockMapTileWarmController.mock.calls.at(-1)?.[0];
    expect(lastMapTileWarmControllerProps).toEqual(
      expect.objectContaining({
        isBaseLayerReady: false,
        tilesetId: "microsoft.base.road",
      })
    );
  });

  test("tells each marker apart by whether that site has real measurements", async () => {
    // Someone clicking a marker sees only that site. The site-wide banner
    // cannot tell them whether *this* lake's numbers are real, so the popup has
    // to say so per site.
    Papa.parse.mockImplementationOnce((_csvText, options) => {
      options.complete({
        data: [
          { name: "Platte Lake (Big Platte)", latitude: "44.6911", longitude: "-86.0912" },
          { name: "Bear Lake (Manistee)", latitude: "44.4406", longitude: "-86.1478" },
        ],
      });
    });

    render(
      <MapPanel
        selectedSites={[]}
        onMarkerClick={jest.fn()}
        measuredSites={new Set(["Platte Lake (Big Platte)"])}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Platte Lake (Big Platte)")).toBeInTheDocument();
    });

    expect(screen.getByText(/includes real measurements/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated - not real measurements/i)).toBeInTheDocument();
  });

  test("labels every site simulated when no measured sites are supplied", async () => {
    // Guards the default: if the prop never arrives, markers must not imply the
    // data is real.
    Papa.parse.mockImplementationOnce((_csvText, options) => {
      options.complete({
        data: [{ name: "Platte Lake (Big Platte)", latitude: "44.6911", longitude: "-86.0912" }],
      });
    });

    render(<MapPanel selectedSites={[]} onMarkerClick={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Platte Lake (Big Platte)")).toBeInTheDocument();
    });

    expect(screen.getByText(/simulated - not real measurements/i)).toBeInTheDocument();
    expect(screen.queryByText(/includes real measurements/i)).not.toBeInTheDocument();
  });

  test("does not constrain panning with max bounds", () => {
    render(<MapPanel selectedSites={[]} onMarkerClick={jest.fn()} />);

    const mapContainerProps = mockMapContainer.mock.calls.at(-1)?.[0];
    expect(mapContainerProps).toEqual(
      expect.objectContaining({
        center: [44.75, -85.85],
        zoom: 8,
        minZoom: 7,
        maxZoom: 16,
      })
    );
    expect(mapContainerProps.maxBounds).toBeUndefined();
    expect(mapContainerProps.maxBoundsViscosity).toBeUndefined();
  });
});
