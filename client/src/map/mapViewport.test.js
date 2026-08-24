import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_BOUNDS_VISCOSITY,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  NW_MICHIGAN_MAX_BOUNDS,
} from "./mapViewport";

describe("mapViewport", () => {
  test("exports the bounded NW Michigan viewport configuration", () => {
    expect(MAP_DEFAULT_CENTER).toEqual([44.75, -85.85]);
    expect(MAP_DEFAULT_ZOOM).toBe(8);
    expect(MAP_MIN_ZOOM).toBe(7);
    expect(MAP_MAX_ZOOM).toBe(16);
    expect(MAP_MAX_BOUNDS_VISCOSITY).toBe(0.8);
    expect(NW_MICHIGAN_MAX_BOUNDS).toEqual([
      [44.14, -86.4],
      [45.4, -84.95],
    ]);
  });
});
