Param (
    [Parameter(Mandatory = $true, HelpMessage = "Resource group of API MAnagement")] 
    [string] $ResourceGroupName,

    [Parameter(Mandatory = $true, HelpMessage = "API Management Name")] 
    [string] $APIMName,

    [Parameter(HelpMessage = "Widget folder")] 
    [string] $WidgetFolder = "$PSScriptRoot\dist",

    [switch] $PublishPortal
)

$ErrorActionPreference = "Stop"
$apiVersion = "2024-05-01"

"Deploying widget from folder: $WidgetFolder"
$WidgetFolder = (Resolve-Path $WidgetFolder).Path
$configurationFile = Join-Path -Path $WidgetFolder -ChildPath "config.msapim.json"

if ($false -eq (Test-Path $WidgetFolder)) {
    throw "Widget folder path was not found: $WidgetFolder"
}

if ($false -eq (Test-Path $configurationFile)) {
    throw "Configuration file was not found: $configurationFile"
}

$configuration = Get-Content -Path $configurationFile | ConvertFrom-Json
$componentName = $configuration.name
"Component name: $componentName"

$apiManagement = Get-AzApiManagement -ResourceGroupName $ResourceGroupName -Name $APIMName
$developerPortalEndpoint = "https://$APIMName.developer.azure-api.net"

if ($null -ne $apiManagement.DeveloperPortalHostnameConfiguration) {
    # Custom domain name defined
    $developerPortalEndpoint = "https://" + $apiManagement.DeveloperPortalHostnameConfiguration.Hostname
    $developerPortalEndpoint
}

$ctx = Get-AzContext
$ctx.Subscription.Id

$baseUri = "subscriptions/$($ctx.Subscription.Id)/resourceGroups/$ResourceGroupName/providers/Microsoft.ApiManagement/service/$APIMName"
$baseUri

"Preparing storage connection"
$storage = (Invoke-AzRestMethod -Path "$baseUri/portalSettings/mediaContent/listSecrets?api-version=$apiVersion" -Method POST).Content | ConvertFrom-Json
$containerSasUrl = [System.Uri] $storage.containerSasUrl
$storageAccountName = $containerSasUrl.Host.Split('.')[0]
$sasToken = $containerSasUrl.Query
$contentContainer = $containerSasUrl.GetComponents([UriComponents]::Path, [UriFormat]::SafeUnescaped)

$storageContext = New-AzStorageContext -StorageAccountName $storageAccountName -SasToken $sasToken
Set-AzCurrentStorageAccount -Context $storageContext

"Uploading files"
$stringIndex = ($WidgetFolder + "\").Length

Write-Host "Uploading file: $configurationFile"
Set-AzStorageBlobContent -File $configurationFile -Blob "custom-widgets/configs/$componentName/config.msapim.json" -Container $contentContainer -Force

Get-ChildItem -File -Recurse $WidgetFolder `
| ForEach-Object { 
    $name = "custom-widgets/data/" + $componentName + "/" + $_.FullName.Substring($stringIndex).Replace("\","/")
    Write-Host "Uploading file: $name"
    Set-AzStorageBlobContent -File $_.FullName -Blob $name -Container $contentContainer -Force
}

if (-not $PublishPortal) {
    "Skipping developer portal publish"
    return
}

"Publishing developer portal"
$revision = [DateTime]::UtcNow.ToString("yyyyMMddHHmm")
$data = @{
    properties = @{
        description = "Migration $revision"
        isCurrent   = $true
    }
}
$body = ConvertTo-Json $data
$publishResponse = Invoke-AzRestMethod -Path "$baseUri/portalRevisions/$($revision)?api-version=$apiVersion" -Method PUT -Payload $body
$publishResponse

if (201 -eq $publishResponse.StatusCode) {
    "Developer portal publish is pending and will complete asynchronously"
    return
}

if (202 -eq $publishResponse.StatusCode) {
    "Developer portal published successfully"
    return
}

throw "Could not publish developer portal"
