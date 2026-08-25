/* eslint-env jest */
import {
  initializeTelemetry,
  isTelemetryEnabled,
  registerTelemetrySink,
  resetTelemetryForTests,
  trackEvent,
  trackException,
  trackMetric,
  trackWebVital,
} from "./telemetry";

describe("telemetry", () => {
  afterEach(() => {
    resetTelemetryForTests();
  });

  it("is inert when no sink is registered", () => {
    expect(initializeTelemetry()).toBeNull();
    expect(isTelemetryEnabled()).toBe(false);
    expect(trackEvent("plot_updated", { slot: 1 })).toBe(false);
    expect(trackException(new Error("boom"))).toBe(false);
    expect(trackMetric("CLS", 0.01)).toBe(false);
  });

  it("forwards to a registered sink with stringified properties", () => {
    const sink = {
      trackEvent: jest.fn(),
      trackException: jest.fn(),
      trackMetric: jest.fn(),
    };
    registerTelemetrySink(sink);

    expect(isTelemetryEnabled()).toBe(true);

    expect(trackEvent("plot_updated", { slot: 1 })).toBe(true);
    expect(sink.trackEvent).toHaveBeenCalledWith(
      "plot_updated",
      expect.objectContaining({ slot: "1" }),
      undefined
    );

    expect(trackException(new Error("boom"), { source: "test" })).toBe(true);
    expect(sink.trackException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: "test" })
    );

    expect(trackMetric("CLS", 0.01, { rating: "good" })).toBe(true);
    expect(sink.trackMetric).toHaveBeenCalledWith(
      "CLS",
      0.01,
      expect.objectContaining({ rating: "good" })
    );
  });

  it("wraps a non-Error value before reporting it", () => {
    const sink = { trackException: jest.fn() };
    registerTelemetrySink(sink);

    expect(trackException("plain string failure")).toBe(true);
    const [reported] = sink.trackException.mock.calls[0];
    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe("plain string failure");
  });

  it("drops web vitals that carry no finite value", () => {
    const sink = { trackMetric: jest.fn() };
    registerTelemetrySink(sink);

    expect(trackWebVital({ name: "CLS", value: Number.NaN })).toBe(false);
    expect(trackWebVital({ value: 1 })).toBe(false);
    expect(sink.trackMetric).not.toHaveBeenCalled();

    expect(trackWebVital({ name: "CLS", value: 0.02, rating: "good" })).toBe(true);
    expect(sink.trackMetric).toHaveBeenCalledWith(
      "CLS",
      0.02,
      expect.objectContaining({ rating: "good" })
    );
  });

  it("stops forwarding once the sink is cleared", () => {
    const sink = { trackEvent: jest.fn() };
    registerTelemetrySink(sink);
    expect(trackEvent("first")).toBe(true);

    registerTelemetrySink(null);
    expect(isTelemetryEnabled()).toBe(false);
    expect(trackEvent("second")).toBe(false);
    expect(sink.trackEvent).toHaveBeenCalledTimes(1);
  });
});
