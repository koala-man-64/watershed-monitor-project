# Production Static Data Validation Runbook

Use this runbook after a dev or prod deployment to verify the application is serving its tracked CSV assets directly from the Static Web App.

## Prerequisites

- `STATIC_DATA_VALIDATION_BASE_URLS` populated in `.env` or `.env.local`
- Or a deployed application base URL such as `https://<app>.azurestaticapps.net` passed with `--base-url`
- Python 3.9+ available locally

## Safe validation command

```bash
python scripts/validate_static_data.py
```

Expected result:

```text
static data validation passed for 2 site(s)
```

To validate a single site directly:

```bash
python scripts/validate_static_data.py --base-url https://<app>.azurestaticapps.net
```

## What the script verifies

1. For every configured site, `GET /data/NWMIWS_Site_Data.csv` returns `200`.
2. For every configured site, `GET /data/info.csv` returns `200`.
3. For every configured site, `GET /data/locations.csv` returns `200`.
4. All three responses include `Content-Type: text/csv`.
5. All three responses include the expected `Cache-Control` header.
6. A request for a missing CSV returns `404`.

## Failure signals

- `HTTP 404` for an expected file: bad deployment artifact or missing tracked data file.
- Wrong `Content-Type`: static hosting metadata regression.
- Missing or incorrect `Cache-Control`: Static Web Apps config regression.
- `HTTP 5xx`: deployment or platform issue.

## Recommended telemetry to inspect

- Browser exceptions related to static CSV fetches.
- Application Insights page views, `plot_updated`, and `data_downloaded` events.
- Client-side download or chart render failures after the deployment.

## Rollback trigger

Rollback if the static validation fails twice against the same deployment, or if the UI cannot load site filters, map locations, or plots from the deployed static datasets.
