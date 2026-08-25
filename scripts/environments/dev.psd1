@{
  SubscriptionId = "eabd0bb1-8f36-4f27-ad86-8b33e02aaeb9"
  TenantId = "355ae10d-1fc8-4e87-bb01-7822419d7c3b"
  ResourceGroupName = "nwmiws-rg"
  Location = "eastus"
  StaticWebAppName = "nwmiws-dev"
  StaticWebAppResourceGroupName = "nwmiws-rg"
  AzureMapsAccountName = "nwmiws-dev-maps"
  ManagedIdentityName = "nwmiws-dev-maps-uami"
  AppRegistrationDisplayName = "nwmiws-azure-maps-dev"
  AllowedOrigins = @(
    "http://localhost:4280"
    "https://nice-ocean-0f03a230f.6.azurestaticapps.net"
  )
  SasTtlMinutes = 30
  SasMaxRps = 500
  SasSigningKey = "secondaryKey"
  DisableLocalAuth = $false
  Tags = @{
    Application = "nw-michigan-watershed"
    Environment = "dev"
    ManagedBy = "PowerShell"
  }
}
