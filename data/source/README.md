# Measurement sources

Raw inputs behind any `measured` row in `client/public/data/NWMIWS_Site_Data.csv`.
Reference-only: nothing here is read at runtime. The site reads the CSVs under
`client/public/data/` only.

## platte-tp-samples-2020-2025.csv

Platte Lake total phosphorus, 99 dated samples from 2020-02-27 to 2025-11-12,
in micrograms per litre.

- **Received** 2026-08-28 from Ray Canale, as `Book2.xlsx` (Gmail thread subject `data`).
- **Extracted** to CSV unchanged — one row per sample, no rounding, no filtering.
- **Upstream** the Platte River Watershed monitoring record maintained by John Ransom
  at the Benzie Conservation District, distributed to the PLIA Research Committee.

Folded into the site data by `scripts/data/ingest_platte_tp.py`, which rolls the
samples up per year into the `Max` / `Min` / `Avg` / `Count` columns the charts read
and marks those rows `measured`.

### Coverage limits

This series is total phosphorus for **Platte Lake (Big Platte) only, 2020-2025**.
Every other row in the site data is simulated, including:

- all five parameters for the other 23 sites,
- Platte Lake for 2000-2019,
- Chloride, Chlorophyll-a, Nitrate and Secchi Depth for Platte Lake in every year,
- Little Platte Lake entirely — it does not appear in the upstream record at all.

The `Provenance` column carries that distinction per row, and the UI surfaces it, so
the two are never presented as equivalent. Do not fill gaps by interpolating; a year
with no measurement should read as simulated or not at all.
