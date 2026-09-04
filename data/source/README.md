# Measurement sources

Raw inputs behind any `measured` row in `client/public/data/NWMIWS_Site_Data.csv`.
Reference-only: nothing here is read at runtime. The site reads the CSVs under
`client/public/data/` only.

Both sources below are folded into the site data by
`scripts/data/ingest_measured_samples.py`, which deletes every existing row
for a site that appears in a source file and replaces it with only the
(Parameter, Year) rows the source has real samples for — a full
delete-and-replace, not a merge. That is a deliberate choice, not the
script's default caution: Ray Canale asked for it explicitly ("delete all
current data and replace with the new stuff", Gmail thread "platte data",
2026-09-04), for Platte Lake and, separately, for the seven Leelanau
Conservancy lakes. A site not covered by either source is untouched.

## platte-lake-samples-1990-2026.csv

Platte Lake (Big Platte): total phosphorus, nitrate, chlorophyll-a, and
Secchi depth, dated samples, already in the units the site renders
(micrograms per litre; feet for Secchi).

- **Received** 2026-09-04 from Ray Canale as `Platte Data for Rudy.xlsx`
  (Gmail thread "platte data").
- **Extracted** to CSV unchanged — one row per sample, no rounding, no
  filtering. Ray pre-aggregated and unit-matched this himself; the 2020-2025
  total phosphorus values are byte-for-byte identical to what was already
  live from the prior `Book2.xlsx` delivery.
- **Upstream** the Platte River Watershed monitoring record maintained by
  John Ransom at the Benzie Conservation District, distributed to the PLIA
  Research Committee.

### Coverage limits

- Total phosphorus and Secchi depth: 1990-2026 (2026 partial, through
  7/17).
- Chlorophyll-a: 1990-2011 only — no data past 2011.
- Nitrate: 2004-2008 only — a narrow window.
- Chloride: not in this file. Following the delete-and-replace instruction
  above, Platte Lake no longer has a Chloride row at all (it was previously
  simulated).

## leelanau-conservancy-samples-1990-present.csv

Big Glen, Little Glen, Little Traverse, Lime, and Cedar Lake (Leelanau),
plus North and South Lake Leelanau: total phosphorus, nitrate, and
chlorophyll-a (from the "Lab" sheet), and Secchi depth (from the "Secchi"
sheet), converted to the units the site renders (milligrams/litre to
micrograms/litre; feet used as-is).

- **Received** 2026-09-01 from Ray Canale as
  `Leelanau Conservancy All Lake Data 1990-Present.xlsx`.
- **Upstream** the Leelanau Conservancy's own long-term lake monitoring
  program.
- **Extraction judgment calls**, made because the raw workbook is
  station-level, multi-depth lab data rather than a pre-aggregated series
  like the Platte file:
  - **Surface samples only** (0 m depth) — the overwhelming majority of
    readings and the standard convention for trophic-status parameters.
    Deeper-depth readings (e.g. hypolimnion profiles) are excluded.
  - **Below-MDL results excluded**, not substituted — rows the sheet flags
    `Below MDL? = Yes` are dropped rather than imputed at the detection
    limit.
  - **Multiple sampling stations per lake are pooled** into one series:
    the sheet has "North Lake Leelanau" and "North Lake Leelanau - 2" as
    separate stations (same for South Lake Leelanau, three stations); all
    stations for a lake map to the single site name `locations.csv` uses.
  - **The "Hydrolab" sheet (continuous logger data, ~16,900 rows) is not
    used.** Ray was explicit: "Do not mess with the Hydrolab data for now."
  - Two `CHLRPHYLA` rows had a blank Units cell; both were in the same
    magnitude as the surrounding mg/L rows and were treated as mg/L.

### Known data-quality anomaly — not scrubbed

A handful of Nitrate readings are far outside the series' own range: most
Nitrate samples fall under ~300 µg/L, but a few reach 920-6250 µg/L
(South Lake Leelanau and Cedar Lake, scattered dates from 1993 to 2022).
That could be a real event (e.g. a runoff pulse) or a transcription issue
in the upstream record — it is not this repo's call to decide which, so
these values were extracted as-is rather than filtered out. A few exact
zero readings also appear (4 Nitrate, 1 TP, 1 Chlorophyll-a, 2 Secchi)
without a `Below MDL` flag; also kept as-is. Flag to Ray if these should be
corrected upstream.

### Coverage limits

Each lake x parameter combination covers whatever years that lake's own
station has real samples for — ranges vary by lake and are not identical
across the seven. Chloride is not in this source; following the
delete-and-replace instruction, these seven lakes no longer have a
Chloride row either.
