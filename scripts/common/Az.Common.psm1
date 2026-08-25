Set-StrictMode -Version Latest

$script:AzCliCommandPath = $null

function ConvertFrom-JsonCompat {
  [CmdletBinding()]
  param(
    [AllowEmptyString()]
    [string]$Json,

    [int]$Depth = 20
  )

  if ([string]::IsNullOrWhiteSpace($Json)) {
    return $null
  }

  if ($PSVersionTable.PSVersion.Major -ge 6) {
    return $Json | ConvertFrom-Json -Depth $Depth
  }

  return $Json | ConvertFrom-Json
}

function ConvertTo-JsonCompat {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object]$InputObject,

    [int]$Depth = 20
  )

  return $InputObject | ConvertTo-Json -Depth $Depth
}

function ConvertTo-ArrayCompat {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object]$InputObject
  )

  if ($null -eq $InputObject) {
    return @()
  }

  if ($InputObject -is [System.Array]) {
    return @($InputObject)
  }

  return @($InputObject)
}

function Ensure-AzCli {
  if (-not (Get-AzCliCommandPath)) {
    throw "Azure CLI is required but was not found on PATH."
  }
}

function Get-AzCliCommandPath {
  if ($script:AzCliCommandPath) {
    return $script:AzCliCommandPath
  }

  $command = Get-Command az -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    return $null
  }

  $script:AzCliCommandPath = $command.Source
  return $script:AzCliCommandPath
}

function Invoke-Az {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments,

    [switch]$AllowFailure
  )

  $effectiveArguments = @($Arguments)
  if (-not ($effectiveArguments -contains "--only-show-errors")) {
    $effectiveArguments += "--only-show-errors"
  }

  Write-Verbose ("Running Azure CLI: az {0}" -f ($effectiveArguments -join " "))

  $azCliCommandPath = Get-AzCliCommandPath
  if (-not $azCliCommandPath) {
    throw "Azure CLI is required but was not found on PATH."
  }

  $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("nwmiws-az-" + [System.Guid]::NewGuid() + ".stdout")
  $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("nwmiws-az-" + [System.Guid]::NewGuid() + ".stderr")
  try {
    $process = Start-Process `
      -FilePath $azCliCommandPath `
      -ArgumentList $effectiveArguments `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath
    $exitCode = $process.ExitCode
  } finally {
    $stdout = ""
    $stderr = ""

    if (Test-Path -LiteralPath $stdoutPath) {
      $stdoutContent = Get-Content -LiteralPath $stdoutPath -Raw
      if ($null -ne $stdoutContent) {
        $stdout = ([string]$stdoutContent).Trim()
      }

      Remove-Item -LiteralPath $stdoutPath -Force -WhatIf:$false
    }

    if (Test-Path -LiteralPath $stderrPath) {
      $stderrContent = Get-Content -LiteralPath $stderrPath -Raw
      if ($null -ne $stderrContent) {
        $stderr = ([string]$stderrContent).Trim()
      }

      Remove-Item -LiteralPath $stderrPath -Force -WhatIf:$false
    }
  }

  if (-not $AllowFailure -and $exitCode -ne 0) {
    $renderedSections = @(@($stderr, $stdout) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $renderedOutput = if ($renderedSections.Count -gt 0) {
      $renderedSections -join [System.Environment]::NewLine
    } else {
      "<no output>"
    }
    throw "Azure CLI command failed: az $($effectiveArguments -join ' ')`n$renderedOutput"
  }

  if ($AllowFailure -and $exitCode -ne 0) {
    Write-Verbose ("Azure CLI returned exit code {0} for allowed-failure call." -f $exitCode)
    return $null
  }

  Write-Verbose ("Azure CLI completed with exit code {0}." -f $exitCode)
  return $stdout
}

function Invoke-AzJson {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments,

    [switch]$AllowFailure
  )

  $effectiveArguments = @($Arguments)
  if (-not ($effectiveArguments -contains "--output") -and -not ($effectiveArguments -contains "-o")) {
    $effectiveArguments += @("--output", "json")
  }

  $json = Invoke-Az -Arguments $effectiveArguments -AllowFailure:$AllowFailure
  if ([string]::IsNullOrWhiteSpace($json)) {
    return $null
  }

  return ConvertFrom-JsonCompat -Json $json -Depth 20
}

function Require-AzLogin {
  try {
    Write-Verbose "Validating Azure CLI authentication."
    $null = Invoke-AzJson -Arguments @("account", "show")
  } catch {
    $message = $_.Exception.Message
    if (
      $message -match "az login" -or
      $message -match "Please run 'az login'" -or
      $message -match "No subscriptions found"
    ) {
      throw "Azure CLI is not logged in. Run 'az login' and retry."
    }

    throw
  }
}

function Ensure-ProviderRegistered {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string]$Namespace
  )

  $provider = Invoke-AzJson -Arguments @("provider", "show", "--namespace", $Namespace)
  if ($provider.registrationState -eq "Registered") {
    Write-Verbose "Azure resource provider '$Namespace' is already registered."
    return
  }

  Write-Host "Registering Azure resource provider '$Namespace'..."
  $null = Invoke-Az -Arguments @("provider", "register", "--namespace", $Namespace, "--wait")
}

function Ensure-BicepAvailable {
  try {
    $null = Invoke-Az -Arguments @("bicep", "version")
    Write-Verbose "Azure CLI Bicep support is already available."
  } catch {
    Write-Host "Installing Azure CLI Bicep support..."
    $null = Invoke-Az -Arguments @("bicep", "install")
  }
}

function Ensure-AzExtensionInstalled {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string]$Name
  )

  $extension = Invoke-Az -Arguments @("extension", "show", "--name", $Name) -AllowFailure
  if ($null -ne $extension) {
    Write-Verbose "Azure CLI extension '$Name' is already installed."
    return
  }

  Write-Host "Installing Azure CLI extension '$Name'..."
  $null = Invoke-Az -Arguments @("extension", "add", "--name", $Name, "--upgrade")
}

function Set-Subscription {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string]$SubscriptionId
  )

  Write-Verbose "Setting Azure CLI subscription to '$SubscriptionId'."
  $null = Invoke-Az -Arguments @("account", "set", "--subscription", $SubscriptionId)
}

function Mask-Secret {
  [CmdletBinding()]
  param(
    [AllowEmptyString()]
    [string]$Secret
  )

  if ([string]::IsNullOrEmpty($Secret)) {
    return "<empty>"
  }

  if ($Secret.Length -le 4) {
    return "*" * $Secret.Length
  }

  return ("*" * ($Secret.Length - 4)) + $Secret.Substring($Secret.Length - 4)
}

function New-TemporaryJsonFile {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object]$InputObject
  )

  $path = Join-Path ([System.IO.Path]::GetTempPath()) ("nwmiws-" + [System.Guid]::NewGuid() + ".json")
  ConvertTo-JsonCompat -InputObject $InputObject -Depth 20 | Set-Content -LiteralPath $path -Encoding utf8 -WhatIf:$false
  return $path
}

function ConvertTo-TagArgumentList {
  [CmdletBinding()]
  param(
    [hashtable]$Tags
  )

  if ($null -eq $Tags -or $Tags.Count -eq 0) {
    return @()
  }

  return @($Tags.GetEnumerator() | Sort-Object Key | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value })
}

function Get-StorageAccountNameFromConnectionString {
  [CmdletBinding()]
  param(
    [AllowEmptyString()]
    [string]$ConnectionString
  )

  if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    return $null
  }

  if ($ConnectionString -match 'AccountName=([^;]+)') {
    return [string]$matches[1]
  }

  return $null
}

Export-ModuleMember -Function ConvertFrom-JsonCompat, ConvertTo-ArrayCompat, ConvertTo-JsonCompat, ConvertTo-TagArgumentList, Ensure-AzCli, Ensure-AzExtensionInstalled, Ensure-BicepAvailable, Ensure-ProviderRegistered, Get-StorageAccountNameFromConnectionString, Invoke-Az, Invoke-AzJson, Mask-Secret, New-TemporaryJsonFile, Require-AzLogin, Set-Subscription
