# Script Architecture

## Summary

The `scripts/` folder is the project's operator tooling layer. These scripts do not serve user traffic and are not part of the React app or the managed API runtime. They exist to provision Azure Maps support, validate that infrastructure, export cloud settings into local development, and keep GitHub deployment configuration aligned with Azure.

The directory is intentionally split by responsibility:

| Path | Responsibility |
| --- | --- |
| `scripts/azuremaps/` | Azure Maps-specific operator entrypoints |
| `scripts/bootstrap/` | Cross-cutting bootstrap entrypoints that compose other scripts |
| `scripts/common/` | Shared PowerShell helper modules |
| `scripts/environments/` | Shared environment configuration consumed by all entrypoints |

The infrastructure definition itself stays in `infra/azuremaps/`. The PowerShell scripts orchestrate Azure CLI, GitHub CLI, and local file generation around that IaC.

## Entry Points

### `scripts/azuremaps/Deploy-AzureMapsStack.ps1`

Primary Azure Maps provisioning entrypoint.

- Reads one environment definition from `scripts/environments/<env>.psd1`
- Deploys `infra/azuremaps/main.bicep`
- Ensures the Entra application and service principal exist
- Ensures role assignments exist on the Azure Maps account
- Writes required Static Web Apps application settings

This is the script that turns the repo's Azure Maps definition into a working cloud deployment.

### `scripts/azuremaps/Test-AzureMapsStack.ps1`

Azure Maps validation entrypoint.

- Checks that the Azure Maps account and managed identity exist
- Verifies the Maps account kind, SKU, and allowed origins
- Verifies role assignments and required Static Web Apps settings

This is the post-deploy safety check. It is read-only and exists to catch drift or incomplete provisioning.

### `scripts/azuremaps/Remove-AzureMapsStack.ps1`

Azure Maps teardown entrypoint.

- Deletes Azure Maps-related Static Web Apps settings
- Deletes the Azure Maps account
- Deletes the managed identity
- Optionally deletes the Entra application

This is the cleanup path when the Azure Maps integration needs to be removed.

### `scripts/azuremaps/Export-AzureMapsLocalSettings.ps1`

Local development export entrypoint.

- Reads the current Azure Maps broker settings from the target Static Web App
- Writes `api/local.settings.json`
- Merges in local browser origins for `localhost:3000` and `localhost:4280`

This is the bridge between deployed cloud configuration and the local Functions host. It is what allows the basemap token broker to run locally with real Azure Maps settings.

### `scripts/bootstrap/Provision-AzurePlatform.ps1`

Higher-level Azure bootstrap entrypoint.

- Ensures shared Azure prerequisites exist for `dev` and `prod`
- Calls the Azure Maps deploy script
- Calls the Azure Maps test script after deployment

This script exists so an operator can bootstrap the broader Azure platform without manually sequencing every lower-level script.

### `scripts/bootstrap/Sync-GitHubActionsConfig.ps1`

Higher-level GitHub bootstrap entrypoint.

- Reads workflow secret names from the GitHub Actions YAML
- Reads required GitHub secret values from the local `.env` file
- Reads optional repository variable overrides from the local `.env` file
- Writes GitHub repository secrets and variables
- Prunes stale managed secrets and variables

This is the bridge between the local operator bootstrap file and the GitHub Actions deployment pipeline.

## Shared Modules

### `scripts/common/Az.Common.psm1`

Azure and PowerShell utility module used by the Azure-facing scripts.

- Wraps Azure CLI execution and JSON conversion
- Handles provider registration and Bicep availability
- Provides tag helpers, naming helpers, and secret masking

This keeps Azure CLI behavior consistent across deploy, test, remove, export, and bootstrap flows.

### `scripts/common/Repo.Common.psm1`

Repository and GitHub utility module used by the bootstrap and local-support scripts.

- Resolves the workspace root from any script location
- Parses loose `.env` files
- Wraps GitHub CLI authentication and commands

This keeps repo-relative path handling and GitHub operations consistent.

## Environment Configuration

### `scripts/environments/dev.psd1`
### `scripts/environments/prod.psd1`

These files are the shared environment contracts for the script layer.

They define:

- Azure subscription and tenant IDs
- resource group names
- Static Web App names
- Application Insights names
- Azure Maps account and managed identity names
- allowed origins and SAS settings

Every entrypoint script depends on these files. They are the single source of truth for environment-specific operator behavior.

## How The Flows Fit Together

### 1. Cloud deployment flow

1. An operator runs `scripts/bootstrap/Provision-AzurePlatform.ps1` or calls the Azure Maps deploy script directly.
2. The bootstrap script ensures shared Azure prerequisites exist.
3. `Deploy-AzureMapsStack.ps1` deploys the Bicep, identity, app registration, role assignments, and SWA settings.
4. `Test-AzureMapsStack.ps1` validates the result.

This is the main delivery path for the Azure Maps feature.

### 2. Local basemap development flow

1. An operator or VS Code task runs `scripts/azuremaps/Export-AzureMapsLocalSettings.ps1`.
2. The script reads the live SWA application settings for the selected environment.
3. The script writes `api/local.settings.json`.
4. The local Functions host reads that file and can issue Azure Maps SAS tokens.
5. The React dev server calls `/api/maps/token`, and the basemap works locally.

This is the only script flow that feeds the day-to-day local developer loop.

### 3. GitHub deployment configuration flow

1. An operator runs `scripts/bootstrap/Sync-GitHubActionsConfig.ps1`.
2. The script reads the expected secret names from the workflow YAML.
3. The script reads the required secret values from `api/.env` and applies any optional repo-local overrides.
4. The script updates GitHub repository secrets and variables.

This keeps CI/CD aligned with the locally curated deployment credentials and environment metadata.

### 4. Teardown flow

1. An operator runs `scripts/azuremaps/Remove-AzureMapsStack.ps1`.
2. The script removes Azure Maps-related SWA settings and cloud resources.
3. The Entra application is removed unless the caller explicitly keeps it.

This is the reverse path of the Azure Maps provisioning flow.

## Operational Boundaries

- `infra/azuremaps/` defines the Azure resources.
- `scripts/azuremaps/` applies, validates, exports, or removes the Azure Maps integration.
- `scripts/bootstrap/` coordinates broader workflows across environments and external systems.
- `scripts/common/` contains implementation detail, not operator entrypoints.
- `scripts/environments/` is configuration, not executable logic.

## When These Scripts Run

- Manual operator runs for deploy, validate, remove, and bootstrap work
- Local developer startup for the export script
- VS Code task or launch integration for the local export path

They are not invoked by the React app at runtime, and they are not part of normal end-user request handling.

## Prerequisites

- Azure CLI for all Azure-facing scripts
- GitHub CLI for `Sync-GitHubActionsConfig.ps1`
- Azure Functions Core Tools for the local API startup that consumes `api/local.settings.json`
- Azure login for scripts that query or mutate Azure
- GitHub authentication for scripts that update repo secrets or variables

## Safety Notes

- `Deploy-AzureMapsStack.ps1`, `Provision-AzurePlatform.ps1`, and `Sync-GitHubActionsConfig.ps1` support `-WhatIf`
- `Remove-AzureMapsStack.ps1` is destructive
- `Export-AzureMapsLocalSettings.ps1` writes a secret-bearing local settings file and should not be committed

## Evidence

- `scripts/azuremaps/Deploy-AzureMapsStack.ps1`
- `scripts/azuremaps/Test-AzureMapsStack.ps1`
- `scripts/azuremaps/Remove-AzureMapsStack.ps1`
- `scripts/azuremaps/Export-AzureMapsLocalSettings.ps1`
- `scripts/bootstrap/Provision-AzurePlatform.ps1`
- `scripts/bootstrap/Sync-GitHubActionsConfig.ps1`
- `scripts/common/Az.Common.psm1`
- `scripts/common/Repo.Common.psm1`
- `scripts/environments/dev.psd1`
- `scripts/environments/prod.psd1`
- `infra/azuremaps/main.bicep`
