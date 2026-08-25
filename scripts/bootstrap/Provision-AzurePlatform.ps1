[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$RotateClientSecrets
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$previousVerbosePreference = $VerbosePreference
try {
  $VerbosePreference = "SilentlyContinue"
  Import-Module (Join-Path $PSScriptRoot "..\common\Repo.Common.psm1") -Force -DisableNameChecking
  Import-Module (Join-Path $PSScriptRoot "..\common\Az.Common.psm1") -Force -DisableNameChecking
} finally {
  $VerbosePreference = $previousVerbosePreference
}

$repoRoot = Get-WorkspaceRoot -StartPath $PSScriptRoot
$deployScript = Join-Path $repoRoot "scripts/azuremaps/Deploy-AzureMapsStack.ps1"
$testScript = Join-Path $repoRoot "scripts/azuremaps/Test-AzureMapsStack.ps1"
$whatIfMode = [bool]$WhatIfPreference

function Get-EnvironmentConfig {
  param([string]$Environment)

  $path = Join-Path $repoRoot ("scripts/environments/{0}.psd1" -f $Environment)
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Environment configuration file was not found: $path"
  }

  return Import-PowerShellDataFile -LiteralPath $path
}

function Ensure-ResourceGroup {
  param(
    [hashtable]$Config,
    [bool]$WhatIfMode
  )

  $exists = Invoke-Az -Arguments @(
    "group",
    "exists",
    "--name",
    $Config.ResourceGroupName
  )

  if ($exists -eq "true") {
    Write-ScriptStep "Resource group '$($Config.ResourceGroupName)' already exists."
    return
  }

  if ($WhatIfMode) {
    Write-Host "WhatIf: would create resource group '$($Config.ResourceGroupName)' in '$($Config.Location)'."
    return
  }

  $tagArguments = ConvertTo-TagArgumentList -Tags $Config.Tags
  $arguments = @(
    "group",
    "create",
    "--name",
    $Config.ResourceGroupName,
    "--location",
    $Config.Location
  )

  if ($tagArguments.Count -gt 0) {
    $arguments += @("--tags") + $tagArguments
  }

  $null = Invoke-AzJson -Arguments $arguments
}

function Ensure-StaticWebAppExists {
  param([hashtable]$Config)

  Write-ScriptStep "Validating Static Web App '$($Config.StaticWebAppName)'."
  $null = Invoke-AzJson -Arguments @(
    "staticwebapp",
    "show",
    "--name",
    $Config.StaticWebAppName,
    "--resource-group",
    $Config.StaticWebAppResourceGroupName
  )
}

function Invoke-AzureMapsDeployment {
  param(
    [string]$Environment,
    [switch]$RotateClientSecrets,
    [bool]$WhatIfMode
  )

  if ($WhatIfMode) {
    Write-Host "WhatIf: would invoke '$deployScript -Environment $Environment$(if ($RotateClientSecrets) { ' -RotateClientSecret' })' after prerequisite resources are created."
    return
  }

  Write-ScriptStep "Running Azure Maps deployment for '$Environment'."
  $arguments = @(
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $deployScript,
    "-Environment",
    $Environment
  )

  if ($RotateClientSecrets) {
    $arguments += "-RotateClientSecret"
  }

  if ($VerbosePreference -eq "Continue") {
    $arguments += "-Verbose"
  }

  $null = & powershell @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure Maps deployment script failed for '$Environment'."
  }

  if (-not $WhatIfMode) {
    $validationArguments = @(
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      $testScript,
      "-Environment",
      $Environment
    )
    if ($VerbosePreference -eq "Continue") {
      $validationArguments += "-Verbose"
    }
    Write-ScriptStep "Running Azure Maps validation for '$Environment'."
    $null = & powershell @validationArguments
    if ($LASTEXITCODE -ne 0) {
      throw "Azure Maps validation script failed for '$Environment'."
    }
  }
}

Write-ScriptSection "Azure platform bootstrap"
Write-ScriptStep "Ensuring Azure CLI prerequisites and authentication."
Ensure-AzCli
Require-AzLogin
Ensure-AzExtensionInstalled -Name "application-insights"

foreach ($environment in @("dev", "prod")) {
  Write-ScriptSection "Environment: $environment"
  Write-ScriptStep "Loading environment configuration."
  $config = Get-EnvironmentConfig -Environment $environment

  Write-ScriptStep "Target resource group: $($config.ResourceGroupName)"
  Write-ScriptStep "Target Static Web App: $($config.StaticWebAppName)"
  Write-ScriptStep "Switching Azure subscription to '$($config.SubscriptionId)'."
  Set-Subscription -SubscriptionId $config.SubscriptionId

  Write-ScriptStep "Ensuring required Azure resource providers are registered."
  Ensure-ProviderRegistered -Namespace "Microsoft.Maps"
  Ensure-ProviderRegistered -Namespace "Microsoft.ManagedIdentity"

  Write-ScriptStep "Ensuring resource group '$($config.ResourceGroupName)'."
  Ensure-ResourceGroup -Config $config -WhatIfMode $whatIfMode

  Ensure-StaticWebAppExists -Config $config

  Invoke-AzureMapsDeployment -Environment $environment -RotateClientSecrets:$RotateClientSecrets -WhatIfMode $whatIfMode
}

Write-ScriptSection "Completed"
Write-Host "Azure platform provisioning completed for dev and prod."
