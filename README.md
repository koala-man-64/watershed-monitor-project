# NW Michigan Water Quality Database

This README is split into two versions:

| Audience | Start here |
| --- | --- |
| Owners, investors, partners, and other clients | [Non-Technical Version](#non-technical-version-for-owners-investors-and-partners) |
| Developers, operators, and support staff | [Technical Version](#technical-version-for-operators-developers-and-support) |

## Non-Technical Version for Owners, Investors, and Partners

### What this application is

The NW Michigan Water Quality Database is a web application for exploring water quality data for lakes in northern Michigan. It combines mapped site locations, historical measurements, charts, and downloadable data in one place.

> **Note:** the deployed site currently serves synthetic demonstration data. All values shown in the application are simulated and are not real measurements. The application displays a persistent notice to this effect on every screen.

### What people can do with it

- Find monitoring sites on a map or from a list
- Select water-quality parameters and time ranges
- View trend charts to see how measurements change over time
- Compare conditions across multiple sites
- Download data for offline review, reporting, or analysis

### Why it matters

- It gives partners a shared view of the same dataset.
- It makes long-term trends easier to understand without working directly in raw spreadsheets.
- It helps discussions about watershed conditions, reporting, planning, and stakeholder communication start from the same information.

### What this system is not

- It is not a live field-data entry system.
- It is not designed for clients to edit or manage records directly in the browser.
- Data changes are published by the support team updating source files and redeploying the application.

### Current support contact shown in the app

The application ships a placeholder contact. No individual name, phone number, or email address is published in the UI.

TODO: replace `SUPPORT_CONTACT` and `CONTACT_DETAILS` in `client/src/siteContent.js` with the confirmed public contact — a role or team name plus a monitored shared inbox — before this site is presented as anything other than a demonstration.

## Technical Version for Operators, Developers, and Support

### System summary

- `client/` is a React single-page application.
- `client/public/data/` contains the CSV files the live site reads at runtime.
- `api/` is a managed Azure Functions API that issues short-lived Azure Maps SAS tokens.
- Azure Static Web Apps hosts the client and the managed API together.
- GitHub Actions deploys `dev` and `main` to separate Static Web Apps environments.

### Repository layout

| Path | Purpose |
| --- | --- |
| `client/` | React app, map UI, plots, static data assets, and client telemetry |
| `api/` | Azure Functions managed API for Azure Maps token brokering |
| `data/` | Reference material that is not read by the deployed app at runtime |
| `infra/azuremaps/` | Bicep templates for Azure Maps, identity, and RBAC |
| `scripts/` | PowerShell operator tooling for provisioning, validation, local setup, and GitHub configuration |
| `.github/workflows/` | Dev and prod deployment pipelines |

### How the app works

1. The browser loads the React app from Azure Static Web Apps.
2. The client reads CSV data from `/data/...` under `client/public/data/`.
3. The client caches CSV responses locally and revalidates them after the configured interval.
4. When the basemap needs Azure Maps access, the client calls `/api/maps/token`.
5. The managed API validates the request origin and returns a short-lived Azure Maps token bundle.

### Required local tooling

- Node.js 20
- npm
- PowerShell for the repo's `.ps1` scripts (`pwsh` / PowerShell 7 on Linux and macOS; `powershell.exe` on Windows)
- Azure Functions Core Tools
- Azure CLI for provisioning and validation scripts
- GitHub CLI for GitHub secret and variable sync
- Optional: Static Web Apps CLI for production-like local validation

### Runtime configuration

#### Client build variables

| Variable | Required | Notes |
| --- | --- | --- |
| `REACT_APP_PUBLIC_DATA_REVALIDATE_AFTER_MS` | No | CSV cache revalidation interval in milliseconds; defaults to `86400000` |
| `REACT_APP_PRIMARY_DATA_BLOB` | No | Defaults to `NWMIWS_Site_Data.csv` |
| `REACT_APP_INFO_DATA_BLOB` | No | Defaults to `info.csv` |
| `REACT_APP_LOCATIONS_DATA_BLOB` | No | Defaults to `locations.csv` |

#### Static Web Apps API settings

| Setting | Required | Notes |
| --- | --- | --- |
| `AZURE_TENANT_ID` | Yes | Entra tenant used by the token broker |
| `AZURE_CLIENT_ID` | Yes | Entra app client ID |
| `AZURE_CLIENT_SECRET` | Yes | Entra app client secret |
| `AZURE_MAPS_SUBSCRIPTION_ID` | Yes | Azure subscription containing the Maps account |
| `AZURE_MAPS_RESOURCE_GROUP` | Yes | Resource group for the Maps account |
| `AZURE_MAPS_ACCOUNT_NAME` | Yes | Azure Maps account name |
| `AZURE_MAPS_ACCOUNT_CLIENT_ID` | Yes | Azure Maps account client ID |
| `AZURE_MAPS_UAMI_PRINCIPAL_ID` | Yes | User-assigned managed identity principal ID |
| `AZURE_MAPS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed origins for token requests |
| `AZURE_MAPS_SAS_TTL_MINUTES` | No | Defaults to `30` |
| `AZURE_MAPS_SAS_MAX_RPS` | No | Defaults to `500` |
| `AZURE_MAPS_SAS_SIGNING_KEY` | No | Defaults to `secondaryKey`; valid values are `primaryKey`, `secondaryKey`, or `managedIdentity` |

#### GitHub Actions secrets used by deploy workflows

- `AZURE_STATIC_WEB_APPS_API_TOKEN_NWMIWS_DEV`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_NWMIWS_PROD`

### Static data operations

The deployed application currently reads these tracked files directly:

- `client/public/data/NWMIWS_Site_Data.csv`
- `client/public/data/info.csv`
- `client/public/data/locations.csv`

To publish a data refresh:

1. Replace the relevant CSV files in `client/public/data/`.
2. Commit the changes.
3. Deploy through the normal branch or workflow path.

If you redeploy the same filenames, browsers that already opened the site can continue serving cached CSV content from `localStorage` until `REACT_APP_PUBLIC_DATA_REVALIDATE_AFTER_MS` expires (`86400000` / 24 hours by default). For an immediate refresh, clear the site's stored data in the browser or publish new filenames via the `REACT_APP_*_DATA_BLOB` settings.

The workbook and other materials under `data/` are reference-only and are not read by the live site at runtime.

### Local development

#### Install dependencies

```powershell
cd client
npm ci
cd ..\api
npm ci
```

#### Client-only UI work

Use this when you do not need the live Azure Maps basemap:

```powershell
cd client
npm start
```

#### Full local app with Azure Maps basemap

Export local settings, start the Functions host, then start the React dev server.

Terminal 1:

```powershell
.\scripts\azuremaps\Export-AzureMapsLocalSettings.ps1 -Environment dev
cd api
npm start
```

Terminal 2:

```powershell
cd client
npm start
```

The export script writes `api/local.settings.json` and adds `http://localhost:3000` and `http://localhost:4280` to the local allowed-origin list.

#### Production-like local validation with Static Web Apps CLI

```powershell
.\scripts\azuremaps\Export-AzureMapsLocalSettings.ps1 -Environment dev
cd client
npm run build
cd ..
npx swa start client/build --api-location api
```

### Local verification

Run these checks before pushing changes:

```powershell
cd client
npm run lint
npm test -- --watchAll=false
npm run build
cd ..\api
npm run lint
npm test
```

### Azure Maps provisioning and operator scripts

Populate `scripts/environments/dev.psd1` and `scripts/environments/prod.psd1` with real subscription, resource, Static Web App, and Application Insights values before running the provisioning scripts.

Provision or update the Azure Maps stack:

```powershell
.\scripts\azuremaps\Deploy-AzureMapsStack.ps1 -Environment dev
```

Preview the Azure Maps change set:

```powershell
.\scripts\azuremaps\Deploy-AzureMapsStack.ps1 -Environment dev -WhatIf
```

Validate the deployed Azure Maps stack:

```powershell
.\scripts\azuremaps\Test-AzureMapsStack.ps1 -Environment dev
```

Rotate the Entra client secret and republish Static Web Apps settings:

```powershell
.\scripts\azuremaps\Deploy-AzureMapsStack.ps1 -Environment dev -RotateClientSecret
```

Remove Azure Maps-related resources and settings:

```powershell
.\scripts\azuremaps\Remove-AzureMapsStack.ps1 -Environment dev
```

Bootstrap shared Azure prerequisites for both environments:

```powershell
.\scripts\bootstrap\Provision-AzurePlatform.ps1
```

Dry run the bootstrap:

```powershell
.\scripts\bootstrap\Provision-AzurePlatform.ps1 -WhatIf
```

Sync GitHub Actions secrets and repository variables from local config:

```powershell
.\scripts\bootstrap\Sync-GitHubActionsConfig.ps1
```

Dry run the GitHub sync:

```powershell
.\scripts\bootstrap\Sync-GitHubActionsConfig.ps1 -WhatIf
```

Before running the GitHub sync script, make sure `api/.env` contains these required values:

- `AZURE_STATIC_WEB_APPS_API_TOKEN_NWMIWS_DEV`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_NWMIWS_PROD`

Additional operator detail is documented in:

- `scripts/README.md`
- `scripts/ARCHITECTURE.md`

### CI/CD

The deployment pipelines are:

- `.github/workflows/build-deploy-nwmiws-swa-dev.yml`
- `.github/workflows/build-deploy-nwmiws-swa-prod.yml`

Branch mapping:

- `dev` deploys the dev environment
- `main` deploys the prod environment

Each workflow performs:

- client dependency install
- api dependency install
- client lint
- api lint
- client unit tests
- api unit tests
- client production build
- Azure Static Web Apps deployment

### Support checklist

If you are supporting the live system, start here:

- Data looks outdated: verify the CSV files in `client/public/data/`, redeploy the client, and remember that browsers may keep serving cached CSV data from `localStorage` for up to 24 hours by default. If the update must appear immediately, clear the site's stored browser data or publish new blob filenames through the `REACT_APP_*_DATA_BLOB` settings.
- The map is failing: validate Azure Maps settings and allowed origins with `.\scripts\azuremaps\Test-AzureMapsStack.ps1 -Environment <env>`.
- Local map development is failing: rerun `.\scripts\azuremaps\Export-AzureMapsLocalSettings.ps1 -Environment <env>` and restart the API host.
- Deployment secrets look wrong: rerun `.\scripts\bootstrap\Sync-GitHubActionsConfig.ps1` after updating `api/.env`.

### VS Code shortcuts

- The `start full application` task in `.vscode/tasks.json` starts the full local workflow.
- The `Launch Full Application in Chrome` launch config in `.vscode/launch.json` exports local settings, starts the API and client, and opens the app.
