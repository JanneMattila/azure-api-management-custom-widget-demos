# Dummy widget

Here is a simple demo widget for Azure API Management Developer Portal.
It shows how to get user information and call an API.
For more information, see
[Extend the developer portal with custom widgets](https://learn.microsoft.com/en-us/azure/api-management/developer-portal-extend-custom-functionality).

## Setup and deployment

Originally created:

```powershell
npx @azure/api-management-custom-widgets-scaffolder
```

To run the widget locally:

```powershell
npm install
npm start
```

To deploy using the officially supported way:

```powershell
npm run deploy
```

To deploy using a custom script based on Azure PowerShell and 
[Azure API Management Developer Portal Import and Export scripts](https://github.com/JanneMattila/azure-api-management-developer-portal-import-and-export-scripts):

```powershell
# Remember to build first
npm run build

# Custom way
./deploy.ps1 -APIMName <apim-name> -ResourceGroupName <resource-group-name> -WidgetFolder ./dist -PublishPortal
```

The above requires that you have logged in to Azure PowerShell using `Connect-AzAccount` and selected the right subscription.
