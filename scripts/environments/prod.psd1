@{
  SubscriptionId = "eabd0bb1-8f36-4f27-ad86-8b33e02aaeb9"
  TenantId = "355ae10d-1fc8-4e87-bb01-7822419d7c3b"
  ResourceGroupName = "nwmiws-rg"
  Location = "eastus"
  StaticWebAppName = "nwmiws-prod"
  StaticWebAppResourceGroupName = "nwmiws-rg"
  AzureMapsAccountName = "nwmiws-prod-maps"
  ManagedIdentityName = "nwmiws-prod-maps-uami"
  AppRegistrationDisplayName = "nwmiws-azure-maps-prod"
  AllowedOrigins = @(
    "https://ambitious-coast-0a9902a1e.6.azurestaticapps.net"
  )
  SasTtlMinutes = 30
  SasMaxRps = 500
  SasSigningKey = "secondaryKey"
  DisableLocalAuth = $false
  Tags = @{
    Application = "nw-michigan-watershed"
    Environment = "prod"
    ManagedBy = "PowerShell"
  }
}
