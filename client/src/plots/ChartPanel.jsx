import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import * as d3 from "d3";
import { Chart as ReactChart } from "react-chartjs-2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faDownload,
  faHashtag,
} from "@fortawesome/free-solid-svg-icons";
import { getNoDataMessage, getUnconfiguredPlotMessage } from "../utils/plotEmptyState";
import useElementSize from "./useElementSize";
import {
  chartFontFamily,
  chartFontScale,
  computeYRangeForChart,
  getPaddedYDomain,
  makeOptions,
} from "./chartOptions";

function formatMetricValue(value) {
  return Number.isFinite(value)
    ? Number(value).toFixed(3).replace(/\.0+$/, "").replace(/\.([^0]*)0+$/, ".$1")
    : "--";
}

const labelItemType = PropTypes.oneOfType([
  PropTypes.string,
  PropTypes.number,
  PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
]);

function D3Line({
  labels,
  values,
  band = [],
  counts = [],
  color = "#37474f",
  yDomain,
  width,
  height,
  xLabel,
  yLabel,
}) {
  const [hover, setHover] = useState(null);
  const margin = {
    top: 20,
    right: 14,
    bottom: 34 + (xLabel ? 20 * chartFontScale : 0),
    left: 54 + (yLabel ? 20 * chartFontScale : 0),
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <D3LineInner
          labels={labels}
          values={values}
          band={band}
          counts={counts}
          color={color}
          yDomain={yDomain}
          margin={margin}
          width={width}
          height={height}
          xLabel={xLabel}
          yLabel={yLabel}
          onHover={(event, index, stats, label) => {
            setHover({
              x: event.clientX,
              y: event.clientY,
              label: Array.isArray(label) ? label.join(" ") : String(label),
              stats,
            });
          }}
          onLeave={() => setHover(null)}
        />
      </svg>
      {hover ? (
        <>
          <span
            role="tooltip"
            style={{
              position: "fixed",
              left: hover.x,
              top: Math.max(8, hover.y - 12),
              transform: "translate(-50%, -100%)",
              background: "rgba(31, 41, 55, 0.98)",
              color: "#fff",
              fontSize: 14 * chartFontScale,
              padding: "8px 10px",
              borderRadius: 6,
              pointerEvents: "none",
              zIndex: 999999,
              boxShadow: "0 6px 18px rgba(0,0,0,.28)",
              display: "grid",
              gridTemplateColumns: "auto auto",
              columnGap: 10,
              rowGap: 2,
              whiteSpace: "nowrap",
            }}
          >
            <strong style={{ gridColumn: "1 / -1", marginBottom: 4, fontWeight: 900 }}>
              {hover.label}
            </strong>
            <span style={{ textAlign: "right" }}>Max:</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatMetricValue(hover.stats.max)}
            </span>
            <span style={{ textAlign: "right" }}>Avg:</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatMetricValue(hover.stats.value)}
            </span>
            <span style={{ textAlign: "right" }}>Min:</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatMetricValue(hover.stats.min)}
            </span>
            {Number.isFinite(hover.stats.count) ? (
              <>
                <span style={{ textAlign: "right" }}>Samples:</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {hover.stats.count}
                </span>
              </>
            ) : null}
          </span>
          <span
            style={{
              position: "fixed",
              left: hover.x,
              top: Math.max(8, hover.y - 12),
              transform: "translate(-50%, -2px)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid rgba(31, 41, 55, 0.98)",
              pointerEvents: "none",
              zIndex: 999999,
            }}
          />
        </>
      ) : null}
    </div>
  );
}

D3Line.propTypes = {
  labels: PropTypes.arrayOf(labelItemType).isRequired,
  values: PropTypes.arrayOf(PropTypes.number).isRequired,
  band: PropTypes.arrayOf(
    PropTypes.shape({ min: PropTypes.number, max: PropTypes.number })
  ),
  counts: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
  ),
  color: PropTypes.string,
  yDomain: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
};

D3Line.defaultProps = {
  band: [],
  counts: [],
  color: "#37474f",
  yDomain: undefined,
  xLabel: "",
  yLabel: "",
};


function D3Bar({
  labels,
  values,
  counts = [],
  color = "#37474f",
  yDomain,
  width,
  height,
  xLabel,
  yLabel,
}) {
  const margin = {
    // Site names sit inside the bars, so the axis only needs room for its title.
    top: 16,
    right: 12,
    bottom: 22 + (xLabel ? 20 * chartFontScale : 0),
    left: 52 + (yLabel ? 20 * chartFontScale : 0),
  };
  const [hover, setHover] = useState(null);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <D3BarInner
          labels={labels}
          values={values}
          counts={counts}
          color={color}
          yDomain={yDomain}
          margin={margin}
          width={width}
          height={height}
          xLabel={xLabel}
          yLabel={yLabel}
          onHover={(event, _, value, label) => {
            setHover({
              x: event.clientX,
              y: event.clientY,
              label: Array.isArray(label) ? label.join(" ") : String(label),
              value,
            });
          }}
          onLeave={() => setHover(null)}
        />
      </svg>
      {hover ? (
        <>
          <span
            role="tooltip"
            style={{
              position: "fixed",
              left: hover.x,
              top: Math.max(8, hover.y - 12),
              transform: "translate(-50%, -100%)",
              background: "rgba(31, 41, 55, 0.98)",
              color: "#fff",
              fontSize: 14 * chartFontScale,
              padding: "8px 10px",
              borderRadius: 6,
              pointerEvents: "none",
              zIndex: 999999,
              boxShadow: "0 6px 18px rgba(0,0,0,.28)",
              display: "inline-flex",
              flexDirection: "column",
              gap: 2,
              whiteSpace: "nowrap",
            }}
          >
            <strong style={{ marginBottom: 4, fontWeight: 900 }}>{hover.label}</strong>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatMetricValue(hover.value)}
            </span>
          </span>
          <span
            style={{
              position: "fixed",
              left: hover.x,
              top: Math.max(8, hover.y - 12),
              transform: "translate(-50%, -2px)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid rgba(31, 41, 55, 0.98)",
              pointerEvents: "none",
              zIndex: 999999,
            }}
          />
        </>
      ) : null}
    </div>
  );
}

D3Bar.propTypes = {
  labels: PropTypes.arrayOf(labelItemType).isRequired,
  values: PropTypes.arrayOf(PropTypes.number).isRequired,
  counts: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
  ),
  color: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  yDomain: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
};

D3Bar.defaultProps = {
  counts: [],
  color: "#37474f",
  yDomain: undefined,
  xLabel: "",
  yLabel: "",
};

function AxisTitles({ xLabel, yLabel, innerW, innerH, margin }) {
  const titleStyle = { pointerEvents: "none", userSelect: "none" };

  return (
    <>
      {xLabel ? (
        <text
          x={innerW / 2}
          y={innerH + margin.bottom - 6}
          textAnchor="middle"
          fontSize={13 * chartFontScale}
          fontWeight="600"
          fill="#37474f"
          fontFamily={chartFontFamily}
          style={titleStyle}
        >
          {xLabel}
        </text>
      ) : null}
      {yLabel ? (
        <text
          transform="rotate(-90)"
          x={-innerH / 2}
          y={-margin.left + 14}
          textAnchor="middle"
          fontSize={13 * chartFontScale}
          fontWeight="600"
          fill="#37474f"
          fontFamily={chartFontFamily}
          style={titleStyle}
        >
          {yLabel}
        </text>
      ) : null}
    </>
  );
}

AxisTitles.propTypes = {
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
  innerW: PropTypes.number.isRequired,
  innerH: PropTypes.number.isRequired,
  margin: PropTypes.shape({
    bottom: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
  }).isRequired,
};

AxisTitles.defaultProps = {
  xLabel: "",
  yLabel: "",
};

function D3BarInner({
  labels,
  values,
  counts,
  color,
  yDomain,
  margin,
  width,
  height,
  xLabel,
  yLabel,
  onHover,
  onLeave,
}) {
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const domainMin = Number.isFinite(yDomain?.min) ? yDomain.min : 0;
  const domainMax = Number.isFinite(yDomain?.max)
    ? yDomain.max
    : Math.max(...values, 1);
  const y = d3.scaleLinear().domain([domainMin, domainMax]).nice().range([innerH, 0]);
  const labelKeys = labels.map(String);
  const x = d3.scaleBand().domain(labelKeys).range([0, innerW]).padding(0.2);
  const ticks = y.ticks(Math.max(2, Math.floor(innerH / 60)));
  const barWidth = Math.max(8, Math.min(48, x.bandwidth()));
  // Rotated in-bar labels occupy roughly one line-height of horizontal space,
  // so cap the font by the band pitch or neighbouring labels collide.
  const barLabelSize = Math.max(
    8,
    Math.min(12 * chartFontScale, (x.bandwidth() - 2) / 1.2)
  );

  return (
    <g transform={`translate(${margin.left},${margin.top})`}>
      <AxisTitles
        xLabel={xLabel}
        yLabel={yLabel}
        innerW={innerW}
        innerH={innerH}
        margin={margin}
      />
      {ticks.map((tick) => {
        const py = y(tick);
        return (
          <g key={`tick-${tick}`} transform={`translate(0,${py})`} shapeRendering="crispEdges">
            <line x1={0} x2={innerW} stroke="#e5e7eb" strokeWidth={0.75} />
            <text
              x={-10}
              y={3}
              textAnchor="end"
              fontSize={14 * chartFontScale}
              fill="#37474f"
              fontFamily={chartFontFamily}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {values.map((value, index) => {
        const label = labelKeys[index];
        const xBand = x(label) ?? 0;
        const x0 = xBand + (x.bandwidth() - barWidth) / 2;
        const barHeight = Math.max(0, innerH - y(value));
        const top = y(value);
        const centerX = x0 + barWidth / 2;
        const fillColor = Array.isArray(color) ? color[index % color.length] : color;

        return (
          <g
            key={`bar-${index}`}
            onMouseEnter={(event) => onHover?.(event, index, value, labels[index])}
            onMouseMove={(event) => onHover?.(event, index, value, labels[index])}
            onMouseLeave={onLeave}
          >
            <rect
              x={x0}
              y={top}
              width={barWidth}
              height={barHeight}
              fill={fillColor}
              opacity={0.9}
              shapeRendering="crispEdges"
            />
            {(() => {
              const raw = labels[index];
              const text = Array.isArray(raw) ? raw.join(" ") : String(raw ?? "");
              if (!text) {
                return null;
              }

              // Rough advance width for this face at this size; good enough to
              // decide whether the string clears the bar.
              const textLength = text.length * barLabelSize * 0.55;
              const fitsInside = textLength + 14 <= barHeight;
              const anchorY = fitsInside ? innerH - 8 : top - 8;

              return (
                <text
                  x={centerX}
                  y={anchorY}
                  textAnchor="start"
                  transform={`rotate(-90, ${centerX}, ${anchorY})`}
                  fontSize={barLabelSize}
                  fontFamily={chartFontFamily}
                  fill={fitsInside ? "#ffffff" : "#37474f"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {text}
                </text>
              );
            })()}
            {Number.isFinite(counts?.[index]) ? (
              <text
                x={centerX}
                y={top - 10 * chartFontScale}
                textAnchor="middle"
                fontSize={14 * chartFontScale}
                fontWeight="700"
                fill="#37474f"
                fontFamily={chartFontFamily}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {counts[index]}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

D3BarInner.propTypes = {
  labels: PropTypes.arrayOf(labelItemType).isRequired,
  values: PropTypes.arrayOf(PropTypes.number).isRequired,
  counts: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
  ),
  color: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)])
    .isRequired,
  yDomain: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  margin: PropTypes.shape({
    top: PropTypes.number.isRequired,
    right: PropTypes.number.isRequired,
    bottom: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
  }).isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
  onHover: PropTypes.func,
  onLeave: PropTypes.func,
};

D3BarInner.defaultProps = {
  counts: [],
  yDomain: undefined,
  xLabel: "",
  yLabel: "",
  onHover: undefined,
  onLeave: undefined,
};

function D3LineInner({
  labels,
  values,
  band,
  counts,
  color,
  yDomain,
  margin,
  width,
  height,
  xLabel,
  yLabel,
  onHover,
  onLeave,
}) {
  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = Math.max(10, height - margin.top - margin.bottom);

  const bandMins = band.map((entry) => Number(entry?.min)).filter(Number.isFinite);
  const bandMaxs = band.map((entry) => Number(entry?.max)).filter(Number.isFinite);
  const dataMin = d3.min([...values, ...bandMins]);
  const dataMax = d3.max([...values, ...bandMaxs]);
  const domainMin = Number.isFinite(yDomain?.min) ? yDomain.min : dataMin ?? 0;
  const domainMax = Number.isFinite(yDomain?.max) ? yDomain.max : dataMax ?? 1;

  const y = d3.scaleLinear().domain([domainMin, domainMax]).nice().range([innerH, 0]);
  const labelKeys = labels.map(String);
  const x = d3.scalePoint().domain(labelKeys).range([0, innerW]).padding(0.5);
  const ticks = y.ticks(Math.max(2, Math.min(8, Math.floor(innerH / 44))));

  // Adaptive x-label thinning: never overlap, whatever the year count or width.
  const labelPx = 42 * chartFontScale;
  const maxLabels = Math.max(1, Math.floor(innerW / labelPx));
  const labelStep = Math.max(1, Math.ceil(labelKeys.length / maxLabels));

  const cx = (index) => x(labelKeys[index]) ?? 0;
  const hitW = labelKeys.length > 1 ? innerW / labelKeys.length : innerW;

  const areaPath =
    band.length === values.length && band.length > 1
      ? d3
          .area()
          .defined((entry) => Number.isFinite(entry?.min) && Number.isFinite(entry?.max))
          .x((_, index) => cx(index))
          .y0((entry) => y(entry.min))
          .y1((entry) => y(entry.max))(band)
      : null;

  const linePath =
    values.length > 1
      ? d3
          .line()
          .defined((value) => Number.isFinite(value))
          .x((_, index) => cx(index))
          .y((value) => y(value))(values)
      : null;

  return (
    <g transform={`translate(${margin.left},${margin.top})`}>
      <AxisTitles
        xLabel={xLabel}
        yLabel={yLabel}
        innerW={innerW}
        innerH={innerH}
        margin={margin}
      />
      {ticks.map((tick) => (
        <g key={`tick-${tick}`} transform={`translate(0,${y(tick)})`} shapeRendering="crispEdges">
          <line x1={0} x2={innerW} stroke="#e5e7eb" strokeWidth={0.75} />
          <text
            x={-10}
            y={4}
            textAnchor="end"
            fontSize={13 * chartFontScale}
            fill="#37474f"
            fontFamily={chartFontFamily}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {tick}
          </text>
        </g>
      ))}

      {areaPath ? <path d={areaPath} fill={color} opacity={0.18} stroke="none" /> : null}

      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {labelKeys.map((label, index) =>
        index % labelStep === 0 ? (
          <text
            key={`xlabel-${label}`}
            x={cx(index)}
            y={innerH + 20 * chartFontScale}
            textAnchor="middle"
            fontSize={13 * chartFontScale}
            fill="#37474f"
            fontFamily={chartFontFamily}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {Array.isArray(labels[index]) ? labels[index].join(" ") : labels[index]}
          </text>
        ) : null
      )}

      {values.map((value, index) => {
        if (!Number.isFinite(value)) {
          return null;
        }

        const entry = band[index] || {};
        const count = counts?.[index];
        const showCount = Number.isFinite(count) && index % labelStep === 0;
        const topY = Number.isFinite(entry.max) ? y(entry.max) : y(value);
        const stats = { value, min: entry.min, max: entry.max, count };

        return (
          <g
            key={`point-${labelKeys[index]}`}
            onMouseEnter={(event) => onHover?.(event, index, stats, labels[index])}
            onMouseMove={(event) => onHover?.(event, index, stats, labels[index])}
            onMouseLeave={onLeave}
          >
            {/* Full-height transparent hit target: hover works anywhere in the column. */}
            <rect
              x={cx(index) - hitW / 2}
              y={0}
              width={hitW}
              height={innerH}
              fill="transparent"
            />
            <circle cx={cx(index)} cy={y(value)} r={3.5} fill={color} />
            {showCount ? (
              <text
                x={cx(index)}
                y={topY - 8 * chartFontScale}
                textAnchor="middle"
                fontSize={12 * chartFontScale}
                fontWeight="700"
                fill="#37474f"
                fontFamily={chartFontFamily}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {count}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

D3LineInner.propTypes = {
  labels: PropTypes.arrayOf(labelItemType).isRequired,
  values: PropTypes.arrayOf(PropTypes.number).isRequired,
  band: PropTypes.arrayOf(
    PropTypes.shape({ min: PropTypes.number, max: PropTypes.number })
  ),
  counts: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
  ),
  color: PropTypes.string.isRequired,
  yDomain: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  margin: PropTypes.shape({
    top: PropTypes.number.isRequired,
    right: PropTypes.number.isRequired,
    bottom: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
  }).isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
  onHover: PropTypes.func,
  onLeave: PropTypes.func,
};

D3LineInner.defaultProps = {
  band: [],
  counts: [],
  yDomain: undefined,
  xLabel: "",
  yLabel: "",
  onHover: undefined,
  onLeave: undefined,
};


function IconWithTooltip({ icon, label, onClick, active = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef(null);

  const recalc = () => {
    const el = btnRef.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  };

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    recalc();
    const onScroll = () => recalc();
    const onResize = () => recalc();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize, true);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize, true);
    };
  }, [open]);

  const handleKeyDown = (event) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <span
      ref={btnRef}
      role="button"
      aria-label={label}
      title={label}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : active ? 1 : 0.9,
      }}
    >
      <FontAwesomeIcon icon={icon} />
      {open && !disabled ? (
        <>
          <span
            style={{
              position: "fixed",
              left: pos.x,
              top: Math.max(8, pos.y - 12),
              transform: "translate(-50%, -100%)",
              background: "rgba(31, 41, 55, 0.98)",
              color: "#fff",
              fontSize: 12 * chartFontScale,
              lineHeight: 1.2,
              padding: "6px 8px",
              borderRadius: 6,
              pointerEvents: "none",
              zIndex: 999999,
              whiteSpace: "nowrap",
              boxShadow: "0 6px 18px rgba(0,0,0,.28)",
            }}
          >
            {label}
          </span>
          <span
            style={{
              position: "fixed",
              left: pos.x,
              top: Math.max(8, pos.y - 12),
              transform: "translate(-50%, -2px)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid rgba(31, 41, 55, 0.98)",
              pointerEvents: "none",
              zIndex: 999999,
            }}
          />
        </>
      ) : null}
    </span>
  );
}

IconWithTooltip.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]).isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
};

IconWithTooltip.defaultProps = {
  onClick: undefined,
  active: false,
  disabled: false,
};

function ChartPanel({ chartObj, cfg, slotLabel, notice, onDownload, nav }) {
  const [containerRef, size] = useElementSize();
  const [showCounts, setShowCounts] = useState(false);

  // Never gate rendering on measurement. If the container has not been measured
  // yet (no ResizeObserver, hidden tab, non-compositing host) fall back to the
  // historical 800x400 viewBox, which CSS then scales to fit. Worst case is the
  // old behaviour; best case is a pixel-accurate, undistorted chart.
  const plotWidth = size.width > 0 ? size.width : 800;
  const plotHeight = size.height > 0 ? size.height : 400;

  const chartData = useMemo(() => {
    if (!chartObj) {
      return null;
    }

    const datasets = chartObj.data.datasets.map((dataset) => {
      const counts = dataset.customCounts || [];
      return {
        ...dataset,
        customCounts: showCounts ? counts : counts.map(() => null),
      };
    });

    return {
      ...chartObj.data,
      datasets,
    };
  }, [chartObj, showCounts]);

  const options = useMemo(
    () => makeOptions(cfg?.parameter, chartObj),
    [cfg?.parameter, chartObj]
  );

  const navControls =
    nav && nav.hasMultipleSites ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <IconWithTooltip icon={faArrowLeft} label="Previous site" onClick={nav.prev} />
        <IconWithTooltip icon={faArrowRight} label="Next site" onClick={nav.next} />
      </span>
    ) : null;

  const titleText = chartObj?.title
    ? `${slotLabel} - ${chartObj.title}`
    : `${slotLabel}${cfg?.parameter ? `: ${cfg.parameter}` : ""}`;
  const headerTitle =
    titleText.length > 80 ? `${titleText.slice(0, 79)}...` : titleText;

  const buildDownloadIcon = () =>
    onDownload ? (
      <IconWithTooltip icon={faDownload} label="Download raw data" onClick={onDownload} />
    ) : null;

  if (!cfg) {
    return (
      <div className="plot-panel plot-panel-empty">
        <div
          className="plot-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h4
            style={{
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexGrow: 1,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {chartObj?.title ? `${slotLabel} - ${chartObj.title}` : slotLabel}
          </h4>
          <div className="plot-icons" style={{ opacity: 0.4 }} />
        </div>
        <div className="plot-content">
          <div className="no-plot-message">{getUnconfiguredPlotMessage(slotLabel)}</div>
        </div>
      </div>
    );
  }

  if (!chartObj || !chartObj.data?.labels?.length) {
    return (
      <div className="plot-panel">
        <div
          className="plot-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h4
            style={{
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexGrow: 1,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {slotLabel}: {cfg.parameter}
          </h4>
          <div className="plot-icons" style={{ display: "flex", gap: 12 }}>
            {buildDownloadIcon()}
          </div>
        </div>
        {notice ? <div className="plot-notice">{notice}</div> : null}
        <div className="plot-content">
          <div className="no-plot-message">{getNoDataMessage(cfg)}</div>
        </div>
      </div>
    );
  }

  const chartKey = `${chartObj.type}-${cfg.parameter}-${cfg.chartType}-${chartObj.data.labels.length}-${showCounts}`;
  const yDomain =
    chartObj.type === "d3bar"
      ? getPaddedYDomain(chartObj, { floorAtZero: true })
      : getPaddedYDomain(chartObj);
  const range = computeYRangeForChart(chartObj);
  const d3BarDomain =
    yDomain ||
    (range
      ? {
          min: Math.max(0, range.min),
          max: range.max,
        }
      : undefined);

  return (
    <div className="plot-panel">
      <div
        className="plot-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          <h4
            style={{
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: "0 1 auto",
              minWidth: 0,
            }}
            title={titleText}
          >
            {headerTitle}
          </h4>
          {navControls}
        </div>
        <div className="plot-icons" style={{ display: "flex", gap: 12, alignItems: "center", opacity: 0.9 }}>
          {buildDownloadIcon()}
          <IconWithTooltip
            icon={faHashtag}
            label={showCounts ? "Hide counts" : "Show counts"}
            onClick={() => setShowCounts((prev) => !prev)}
            active={showCounts}
          />
        </div>
      </div>
      {notice ? <div className="plot-notice">{notice}</div> : null}
      <div className="plot-content" ref={containerRef} style={{ position: "relative", flex: 1 }}>
        {chartObj.type === "d3line" ? (
          <D3Line
            key={chartKey}
            labels={chartObj.data.labels}
            values={chartData.datasets[0].data}
            band={chartData.datasets[0].band || []}
            counts={chartData.datasets[0].customCounts || []}
            color={chartData.datasets[0].borderColor || "#37474f"}
            yDomain={yDomain}
            width={plotWidth}
            height={plotHeight}
            xLabel={chartObj.xAxisLabel || ""}
            yLabel={chartObj.yAxisLabel || ""}
          />
        ) : chartObj.type === "d3bar" ? (
          <D3Bar
            key={chartKey}
            labels={chartObj.data.labels}
            values={chartData.datasets[0].data}
            counts={chartData.datasets[0].customCounts || []}
            color={chartData.datasets[0].backgroundColor || "#37474f"}
            yDomain={d3BarDomain}
            width={plotWidth}
            height={plotHeight}
            xLabel={chartObj.xAxisLabel || ""}
            yLabel={chartObj.yAxisLabel || ""}
          />
        ) : (
          <ReactChart
            key={chartKey}
            datasetIdKey={`${cfg.parameter}-${chartObj.type}`}
            type={chartObj.type}
            data={chartData}
            options={options}
            updateMode="none"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
    </div>
  );
}

ChartPanel.propTypes = {
  chartObj: PropTypes.object,
  cfg: PropTypes.object,
  slotLabel: PropTypes.string.isRequired,
  notice: PropTypes.node,
  onDownload: PropTypes.func,
  nav: PropTypes.shape({
    prev: PropTypes.func,
    next: PropTypes.func,
    hasMultipleSites: PropTypes.bool,
  }),
};

ChartPanel.defaultProps = {
  chartObj: null,
  cfg: null,
  notice: null,
  onDownload: undefined,
  nav: null,
};

export default ChartPanel;
