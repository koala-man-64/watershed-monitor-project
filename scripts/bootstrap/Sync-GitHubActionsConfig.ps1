[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$Repository,
  [string]$EnvFilePath
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
$whatIfMode = [bool]$WhatIfPreference

if (-not $EnvFilePath) {
  $EnvFilePath = Join-Path $repoRoot "api/.env"
}

function Get-EnvironmentConfig {
  param([string]$Environment)

  $path = Join-Path $repoRoot ("scripts/environments/{0}.psd1" -f $Environment)
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Environment configuration file was not found: $path"
  }

  return Import-PowerShellDataFile -LiteralPath $path
}

function Get-WorkflowSecretNames {
  param(
    [string]$WorkflowPath,
    [string]$StaticWebAppTokenFallback
  )

  $content = Get-Content -Raw -LiteralPath $WorkflowPath
  Write-Verbose "Inspecting workflow file '$WorkflowPath' for managed secret names."
  $staticWebAppMatches = [regex]::Matches(
    $content,
    'azure_static_web_apps_api_token:\s*\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}'
  )

  $staticWebAppSecretName = $StaticWebAppTokenFallback
  if ($staticWebAppMatches.Count -gt 0) {
    $staticWebAppSecretName = [string]$staticWebAppMatches[0].Groups[1].Value
  }

  return @{
    StaticWebAppTokenSecretName = $staticWebAppSecretName
  }
}

function Get-EnvValue {
  param(
    [hashtable]$EnvValues,
    [string[]]$Names
  )

  foreach ($name in $Names) {
    if ($EnvValues.ContainsKey($name)) {
      $value = [string]$EnvValues[$name]
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        return $value
      }
    }
  }

  return $null
}

function Get-RequiredEnvValue {
  param(
    [hashtable]$EnvValues,
    [string]$Description,
    [string[]]$Names
  )

  $value = Get-EnvValue -EnvValues $EnvValues -Names $Names
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing $Description in '$EnvFilePath'. Add one of: $($Names -join ', ')"
  }

  return $value
}

function Get-OptionalEnvValue {
  param(
    [hashtable]$EnvValues,
    [string[]]$Names,
    [string]$DefaultValue
  )

  $value = Get-EnvValue -EnvValues $EnvValues -Names $Names
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return $value
}

function Get-StorageAccountNameFromEnv {
  param([hashtable]$EnvValues)

  $storageAccountName = Get-EnvValue -EnvValues $EnvValues -Names @("NWMIWS_STORAGE_ACCOUNT")
  if (-not [string]::IsNullOrWhiteSpace($storageAccountName)) {
    return $storageAccountName
  }

  $blobConnectionString = Get-EnvValue -EnvValues $EnvValues -Names @("BLOB_CONN")
  if ([string]::IsNullOrWhiteSpace($blobConnectionString)) {
    return $null
  }

  return [string](Get-StorageAccountNameFromConnectionString -ConnectionString $blobConnectionString)
}

function Set-RepositorySecret {
  param(
    [string]$Repo,
    [string]$Name,
    [string]$Value,
    [bool]$WhatIfMode
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Secret '$Name' resolved to an empty value."
  }

  if ($WhatIfMode) {
    Write-Host "WhatIf: would set repository secret '$Name' on '$Repo'."
    return
  }

  $null = Invoke-Gh -Arguments @(
    "secret",
    "set",
    $Name,
    "--repo",
    $Repo,
    "--body",
    $Value
  )
}

function Remove-RepositorySecret {
  param(
    [string]$Repo,
    [string]$Name,
    [bool]$WhatIfMode
  )

  if ($WhatIfMode) {
    Write-Host "WhatIf: would delete repository secret '$Name' from '$Repo'."
    return
  }

  $null = Invoke-Gh -Arguments @(
    "secret",
    "delete",
    $Name,
    "--repo",
    $Repo
  )
}

function Set-RepositoryVariable {
  param(
    [string]$Repo,
    [string]$Name,
    [string]$Value,
    [bool]$WhatIfMode
  )

  if ($null -eq $Value) {
    $Value = ""
  }

  if ($WhatIfMode) {
    Write-Host "WhatIf: would set repository variable '$Name' on '$Repo' to '$Value'."
    return
  }

  $null = Invoke-Gh -Arguments @(
    "variable",
    "set",
    $Name,
    "--repo",
    $Repo,
    "--body",
    $Value
  )
}

function Remove-RepositoryVariable {
  param(
    [string]$Repo,
    [string]$Name,
    [bool]$WhatIfMode
  )

  if ($WhatIfMode) {
    Write-Host "WhatIf: would delete repository variable '$Name' from '$Repo'."
    return
  }

  $null = Invoke-Gh -Arguments @(
    "variable",
    "delete",
    $Name,
    "--repo",
    $Repo
  )
}

function Get-RepositorySecretNames {
  param([string]$Repo)

  $results = Invoke-Gh -Arguments @(
    "secret",
    "list",
    "--repo",
    $Repo,
    "--json",
    "name"
  )

  if ([string]::IsNullOrWhiteSpace($results)) {
    return @()
  }

  return @((ConvertFrom-Json $results) | ForEach-Object { [string]$_.name })
}

function Get-RepositoryVariableNames {
  param([string]$Repo)

  $results = Invoke-Gh -Arguments @(
    "variable",
    "list",
    "--repo",
    $Repo,
    "--json",
    "name"
  )

  if ([string]::IsNullOrWhiteSpace($results)) {
    return @()
  }

  return @((ConvertFrom-Json $results) | ForEach-Object { [string]$_.name })
}

function Test-ManagedSecretName {
  param([string]$Name)

  return ($Name -like "AZURE_STATIC_WEB_APPS_API_TOKEN_*")
}

function Get-NonEmptyHashtable {
  param([System.Collections.Specialized.OrderedDictionary]$Values)

  $filtered = [ordered]@{}
  foreach ($entry in $Values.GetEnumerator()) {
    if (-not [string]::IsNullOrWhiteSpace([string]$entry.Value)) {
      $filtered[[string]$entry.Key] = [string]$entry.Value
    }
  }

  return $filtered
}

function Write-NameList {
  param(
    [string]$Label,
    [string[]]$Names
  )

  Write-Host $Label

  if (-not $Names -or $Names.Count -eq 0) {
    Write-Host "  (none)"
    return
  }

  foreach ($name in @($Names | Sort-Object -Unique)) {
    Write-Host "  - $name"
  }
}

$envValues = Import-LooseEnvFile -Path $EnvFilePath
Write-ScriptSection "GitHub Actions configuration sync"
Write-ScriptStep "Loading environment configurations."
$devConfig = Get-EnvironmentConfig -Environment "dev"
$prodConfig = Get-EnvironmentConfig -Environment "prod"

Write-ScriptStep "Ensuring GitHub CLI prerequisites and authentication."
Ensure-GhCli
Ensure-GitHubAuthentication -EnvValues $envValues

if (-not $Repository) {
  Write-ScriptStep "Resolving target GitHub repository from git remote."
  $Repository = Resolve-GitHubRepository
}

Write-ScriptStep "Target repository: $Repository"
Write-ScriptStep "Reading managed secret names from workflow definitions."
$devWorkflowSecrets = Get-WorkflowSecretNames `
  -WorkflowPath (Join-Path $repoRoot ".github/workflows/build-deploy-nwmiws-swa-dev.yml") `
  -StaticWebAppTokenFallback "AZURE_STATIC_WEB_APPS_API_TOKEN_NWMIWS_DEV"

$prodWorkflowSecrets = Get-WorkflowSecretNames `
  -WorkflowPath (Join-Path $repoRoot ".github/workflows/build-deploy-nwmiws-swa-prod.yml") `
  -StaticWebAppTokenFallback "AZURE_STATIC_WEB_APPS_API_TOKEN_NWMIWS_PROD"

Write-ScriptStep "Resolving managed secret values from the local env file."
$devStaticWebAppToken = Get-RequiredEnvValue `
  -EnvValues $envValues `
  -Description "dev Static Web Apps deployment token" `
  -Names @($devWorkflowSecrets.StaticWebAppTokenSecretName)
$prodStaticWebAppToken = Get-RequiredEnvValue `
  -EnvValues $envValues `
  -Description "prod Static Web Apps deployment token" `
  -Names @($prodWorkflowSecrets.StaticWebAppTokenSecretName)

Write-ScriptStep "Computing desired GitHub secrets and variables."
$desiredSecrets = [ordered]@{
  $devWorkflowSecrets.StaticWebAppTokenSecretName = $devStaticWebAppToken
  $prodWorkflowSecrets.StaticWebAppTokenSecretName = $prodStaticWebAppToken
}

$desiredVariables = [ordered]@{
  NWMIWS_AZURE_SUBSCRIPTION_ID = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_AZURE_SUBSCRIPTION_ID", "STATIC_CUTOVER_SUBSCRIPTION_ID") -DefaultValue ([string]$devConfig.SubscriptionId)
  NWMIWS_AZURE_TENANT_ID = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_AZURE_TENANT_ID") -DefaultValue ([string]$devConfig.TenantId)
  NWMIWS_RESOURCE_GROUP = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_RESOURCE_GROUP") -DefaultValue ([string]$devConfig.ResourceGroupName)
  NWMIWS_STORAGE_ACCOUNT = Get-StorageAccountNameFromEnv -EnvValues $envValues
  NWMIWS_STATIC_WEB_APP_DEV = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_STATIC_WEB_APP_DEV") -DefaultValue ([string]$devConfig.StaticWebAppName)
  NWMIWS_STATIC_WEB_APP_PROD = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_STATIC_WEB_APP_PROD") -DefaultValue ([string]$prodConfig.StaticWebAppName)
  NWMIWS_AZURE_MAPS_ACCOUNT_DEV = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_AZURE_MAPS_ACCOUNT_DEV") -DefaultValue ([string]$devConfig.AzureMapsAccountName)
  NWMIWS_AZURE_MAPS_ACCOUNT_PROD = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_AZURE_MAPS_ACCOUNT_PROD") -DefaultValue ([string]$prodConfig.AzureMapsAccountName)
  NWMIWS_ALLOWED_ORIGINS_DEV = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_ALLOWED_ORIGINS_DEV") -DefaultValue ([string](@($devConfig.AllowedOrigins) -join ","))
  NWMIWS_ALLOWED_ORIGINS_PROD = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_ALLOWED_ORIGINS_PROD") -DefaultValue ([string](@($prodConfig.AllowedOrigins) -join ","))
  NWMIWS_VALIDATION_BASE_URLS = Get-OptionalEnvValue -EnvValues $envValues -Names @("NWMIWS_VALIDATION_BASE_URLS", "STATIC_CUTOVER_VALIDATION_BASE_URLS") -DefaultValue $null
}

$secrets = Get-NonEmptyHashtable -Values $desiredSecrets
$variables = Get-NonEmptyHashtable -Values $desiredVariables

Write-ScriptStep "Listing existing repository secrets and variables."
$existingSecretNames = Get-RepositorySecretNames -Repo $Repository
$existingVariableNames = Get-RepositoryVariableNames -Repo $Repository
$desiredSecretNames = @($secrets.Keys)
$desiredVariableNames = @($variables.Keys)

$staleSecretNames = @(
  $existingSecretNames |
    Where-Object { (Test-ManagedSecretName -Name $_) -and $_ -notin $desiredSecretNames } |
    Sort-Object -Unique
)

$staleVariableNames = @(
  $existingVariableNames |
    Where-Object { $_ -like "NWMIWS_*" -and $_ -notin $desiredVariableNames } |
    Sort-Object -Unique
)

Write-ScriptStep "Managed GitHub names resolved."
Write-NameList -Label "Secrets to apply:" -Names $desiredSecretNames
Write-NameList -Label "Variables to apply:" -Names $desiredVariableNames
Write-NameList -Label "Managed secrets to prune:" -Names $staleSecretNames
Write-NameList -Label "Managed variables to prune:" -Names $staleVariableNames

Write-ScriptStep "Applying $($secrets.Count) secrets and $($variables.Count) variables."
foreach ($secret in $secrets.GetEnumerator()) {
  Set-RepositorySecret -Repo $Repository -Name $secret.Key -Value ([string]$secret.Value) -WhatIfMode $whatIfMode
}

foreach ($variable in $variables.GetEnumerator()) {
  Set-RepositoryVariable -Repo $Repository -Name $variable.Key -Value ([string]$variable.Value) -WhatIfMode $whatIfMode
}

foreach ($secretName in $staleSecretNames) {
  Remove-RepositorySecret -Repo $Repository -Name $secretName -WhatIfMode $whatIfMode
}

foreach ($variableName in $staleVariableNames) {
  Remove-RepositoryVariable -Repo $Repository -Name $variableName -WhatIfMode $whatIfMode
}

Write-ScriptSection "Sync summary"
Write-Host "GitHub Actions bootstrap summary"
Write-Host "  Repository:    $Repository"
Write-Host "  Secrets:       $($secrets.Count)"
Write-Host "  Variables:     $($variables.Count)"
Write-Host "  Secrets pruned:$($staleSecretNames.Count)"
Write-Host "  Vars pruned:   $($staleVariableNames.Count)"
Write-Host "  Env file used: $EnvFilePath"
