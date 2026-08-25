[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet("dev", "prod")]
  [string]$Environment
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$previousVerbosePreference = $VerbosePreference
try {
  $VerbosePreference = "SilentlyContinue"
  Import-Module (Join-Path $PSScriptRoot "..\common\Az.Common.psm1") -Force -DisableNameChecking
  Import-Module (Join-Path $PSScriptRoot "..\common\Repo.Common.psm1") -Force -DisableNameChecking
} finally {
  $VerbosePreference = $previousVerbosePreference
}

$contributorRoleDefinitionId = "b24988ac-6180-42a0-ab88-20f7382dd24c"
$azureMapsDataReaderRoleDefinitionId = "423170ca-a8f6-4b0f-8487-9e4eb8f49bfa"
$repoRoot = Get-WorkspaceRoot -StartPath $PSScriptRoot
$environmentPath = Join-Path $repoRoot ("scripts/environments/{0}.psd1" -f $Environment)

function Get-EnvironmentConfig {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Environment configuration file was not found: $Path"
  }

  return Import-PowerShellDataFile -LiteralPath $Path
}

function ConvertTo-SettingHashtable {
  param([object]$InputObject)

  $settings = @{}
  if ($null -eq $InputObject) {
    return $settings
  }

  if ($InputObject -is [System.Collections.IDictionary]) {
    foreach ($key in $InputObject.Keys) {
      $settings[[string]$key] = [string]$InputObject[$key]
    }
    return $settings
  }

  if ($InputObject.PSObject.Properties.Match("properties").Count -gt 0) {
    $properties = $InputObject.properties
    if ($properties -is [System.Collections.IDictionary]) {
      foreach ($key in $properties.Keys) {
        $settings[[string]$key] = [string]$properties[$key]
      }
      return $settings
    }

    foreach ($property in $properties.PSObject.Properties) {
      $settings[[string]$property.Name] = [string]$property.Value
    }
    return $settings
  }

  foreach ($item in (ConvertTo-ArrayCompat -InputObject $InputObject)) {
    if (
      $null -ne $item -and
      $item.PSObject.Properties.Match("name").Count -gt 0 -and
      $item.name
    ) {
      $value = if ($item.PSObject.Properties.Match("value").Count -gt 0) { $item.value } else { $null }
      if (
        $null -eq $value -and
        $item.PSObject.Properties.Match("properties").Count -gt 0 -and
        $item.properties.PSObject.Properties.Match("value").Count -gt 0
      ) {
        $value = $item.properties.value
      }

      $settings[[string]$item.name] = [string]$value
    }
  }

  return $settings
}

Write-ScriptSection "Azure Maps validation ($Environment)"
Write-ScriptStep "Loading environment configuration from '$environmentPath'."
$config = Get-EnvironmentConfig -Path $environmentPath

Write-ScriptStep "Ensuring Azure CLI prerequisites and authentication."
Ensure-AzCli
Require-AzLogin
Write-ScriptStep "Switching Azure subscription to '$($config.SubscriptionId)'."
Set-Subscription -SubscriptionId $config.SubscriptionId

$issues = [System.Collections.Generic.List[string]]::new()

Write-ScriptStep "Checking prerequisite cloud resources."
$staticWebApp = Invoke-AzJson -Arguments @(
  "staticwebapp",
  "show",
  "--name",
  $config.StaticWebAppName,
  "--resource-group",
  $config.StaticWebAppResourceGroupName
) -AllowFailure
if (-not $staticWebApp) {
  $issues.Add("Static Web App '$($config.StaticWebAppName)' was not found.")
}

$mapsAccount = Invoke-AzJson -Arguments @(
  "maps",
  "account",
  "show",
  "--name",
  $config.AzureMapsAccountName,
  "--resource-group",
  $config.ResourceGroupName
) -AllowFailure
if (-not $mapsAccount) {
  $issues.Add("Azure Maps account '$($config.AzureMapsAccountName)' was not found.")
}

$managedIdentity = Invoke-AzJson -Arguments @(
  "identity",
  "show",
  "--name",
  $config.ManagedIdentityName,
  "--resource-group",
  $config.ResourceGroupName
) -AllowFailure
if (-not $managedIdentity) {
  $issues.Add("Managed identity '$($config.ManagedIdentityName)' was not found.")
}

if ($mapsAccount) {
  Write-ScriptStep "Validating Azure Maps account configuration."
  if ([string]$mapsAccount.kind -ne "Gen2") {
    $issues.Add("Azure Maps account kind is '$($mapsAccount.kind)' instead of 'Gen2'.")
  }

  if ([string]$mapsAccount.sku.name -ne "G2") {
    $issues.Add("Azure Maps account SKU is '$($mapsAccount.sku.name)' instead of 'G2'.")
  }

  $mapsAccountResource = Invoke-AzJson -Arguments @(
    "resource",
    "show",
    "--ids",
    $mapsAccount.id,
    "--api-version",
    "2023-06-01"
  ) -AllowFailure

  $configuredOrigins = @()
  $mapsProperties = if ($mapsAccountResource) { $mapsAccountResource.properties } else { $mapsAccount.properties }
  if (
    $null -ne $mapsProperties -and
    $mapsProperties.PSObject.Properties.Match("cors").Count -gt 0 -and
    $null -ne $mapsProperties.cors -and
    $mapsProperties.cors.PSObject.Properties.Match("corsRules").Count -gt 0 -and
    @($mapsProperties.cors.corsRules).Count -gt 0
  ) {
    $configuredOrigins = @($mapsProperties.cors.corsRules[0].allowedOrigins)
  }

  $expectedOrigins = @($config.AllowedOrigins)
  $configuredOriginsValue = [string](@($configuredOrigins | Sort-Object) -join ",")
  $expectedOriginsValue = [string](@($expectedOrigins | Sort-Object) -join ",")
  if ($configuredOriginsValue -ne $expectedOriginsValue) {
    $issues.Add("Azure Maps allowed origins do not match the environment configuration.")
  }
}

if ($mapsAccount -and $managedIdentity) {
  Write-ScriptStep "Validating managed identity role assignments."
  $dataReaderAssignments = @(ConvertTo-ArrayCompat -InputObject (Invoke-AzJson -Arguments @(
      "role",
      "assignment",
      "list",
      "--assignee-object-id",
      $managedIdentity.principalId,
      "--role",
      $azureMapsDataReaderRoleDefinitionId,
      "--scope",
      $mapsAccount.id
    )))

  if ($dataReaderAssignments.Count -eq 0) {
    $issues.Add("The managed identity does not have Azure Maps Data Reader on the Maps account.")
  }
}

Write-ScriptStep "Validating Entra application and service principal."
$entraApps = @(ConvertTo-ArrayCompat -InputObject (Invoke-AzJson -Arguments @("ad", "app", "list", "--display-name", $config.AppRegistrationDisplayName)))
$matchingApps = @($entraApps | Where-Object { $_.displayName -eq $config.AppRegistrationDisplayName })
if ($matchingApps.Count -ne 1) {
  $issues.Add("Expected exactly one Entra application named '$($config.AppRegistrationDisplayName)'.")
}

$appRegistration = if ($matchingApps.Count -eq 1) { $matchingApps[0] } else { $null }
$servicePrincipal = $null
if ($appRegistration) {
  $servicePrincipal = Invoke-AzJson -Arguments @("ad", "sp", "show", "--id", $appRegistration.appId) -AllowFailure
  if (-not $servicePrincipal) {
    $issues.Add("The service principal for '$($config.AppRegistrationDisplayName)' was not found.")
  }
}

if ($mapsAccount -and $servicePrincipal) {
  Write-ScriptStep "Validating Contributor role assignment for the Entra app."
  $contributorAssignments = @(ConvertTo-ArrayCompat -InputObject (Invoke-AzJson -Arguments @(
      "role",
      "assignment",
      "list",
      "--assignee-object-id",
      $servicePrincipal.id,
      "--role",
      $contributorRoleDefinitionId,
      "--scope",
      $mapsAccount.id
    )))

  if ($contributorAssignments.Count -eq 0) {
    $issues.Add("The Azure Maps Entra application does not have Contributor on the Maps account.")
  }
}

Write-ScriptStep "Validating Static Web App application settings."
$settings = ConvertTo-SettingHashtable -InputObject (Invoke-AzJson -Arguments @(
    "staticwebapp",
    "appsettings",
    "list",
    "--name",
    $config.StaticWebAppName,
    "--resource-group",
    $config.StaticWebAppResourceGroupName
  ))

$requiredAppSettings = [ordered]@{
  AZURE_TENANT_ID = [string]$config.TenantId
  AZURE_MAPS_SUBSCRIPTION_ID = [string]$config.SubscriptionId
  AZURE_MAPS_RESOURCE_GROUP = [string]$config.ResourceGroupName
  AZURE_MAPS_ACCOUNT_NAME = [string]$config.AzureMapsAccountName
  AZURE_MAPS_ALLOWED_ORIGINS = [string](@($config.AllowedOrigins) -join ",")
  AZURE_MAPS_SAS_TTL_MINUTES = [string]$config.SasTtlMinutes
  AZURE_MAPS_SAS_MAX_RPS = [string]$config.SasMaxRps
  AZURE_MAPS_SAS_SIGNING_KEY = [string]$config.SasSigningKey
}

foreach ($setting in $requiredAppSettings.GetEnumerator()) {
  if (-not $settings.ContainsKey($setting.Key)) {
    $issues.Add("Static Web App setting '$($setting.Key)' is missing.")
    continue
  }

  if ([string]$settings[$setting.Key] -ne [string]$setting.Value) {
    $issues.Add("Static Web App setting '$($setting.Key)' does not match the expected value.")
  }
}

foreach ($sensitiveSetting in @("AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_MAPS_ACCOUNT_CLIENT_ID", "AZURE_MAPS_UAMI_PRINCIPAL_ID")) {
  if (-not $settings.ContainsKey($sensitiveSetting) -or [string]::IsNullOrWhiteSpace([string]$settings[$sensitiveSetting])) {
    $issues.Add("Static Web App setting '$sensitiveSetting' is missing or empty.")
  }
}

if ($mapsAccount -and $settings.ContainsKey("AZURE_MAPS_ACCOUNT_CLIENT_ID")) {
  if ([string]$settings.AZURE_MAPS_ACCOUNT_CLIENT_ID -ne [string]$mapsAccount.properties.uniqueId) {
    $issues.Add("Static Web App AZURE_MAPS_ACCOUNT_CLIENT_ID does not match the Azure Maps account unique ID.")
  }
}

if ($managedIdentity -and $settings.ContainsKey("AZURE_MAPS_UAMI_PRINCIPAL_ID")) {
  if ([string]$settings.AZURE_MAPS_UAMI_PRINCIPAL_ID -ne [string]$managedIdentity.principalId) {
    $issues.Add("Static Web App AZURE_MAPS_UAMI_PRINCIPAL_ID does not match the managed identity principal ID.")
  }
}

if ($issues.Count -gt 0) {
  Write-Host "Azure Maps validation failed:" -ForegroundColor Red
  foreach ($issue in $issues) {
    Write-Host "  - $issue" -ForegroundColor Red
  }
  throw "Azure Maps validation failed with $($issues.Count) issue(s)."
}

Write-ScriptSection "Validation summary"
Write-Host "Azure Maps validation passed for '$Environment'."
