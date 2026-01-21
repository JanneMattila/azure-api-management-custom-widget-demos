# DOM Widget - Parent Element Interceptor

This widget demonstrates how to access and manipulate the parent window's DOM from within an iframe (custom widget).

**⚠️ Important:** This widget requires `allow-same-origin` in the iframe sandbox attribute, or it must run on the same origin as the parent page. Without this, the browser's Same-Origin Policy will block DOM access.

## Features

- **Automatic Element Discovery**: Finds the first input field and button element located before the iframe in the parent page's DOM (searching upward)
- **Real-time Validation**: Validates textbox content against a configurable regex pattern as user types
- **Button Enable/Disable**: Automatically enables or disables the button based on validation result

## How It Works

1. Widget loads and finds its own iframe element in the parent document
2. Searches **upward** from the iframe position to find:
   - The first `<input>` or `<textarea>` element (excluding hidden/button types)
   - The first `<button>` or `<input type="button/submit">` element
3. Attaches validation handlers to the textbox (`input` and `change` events)
4. As the user types:
   - Validates content against the regex pattern
   - Enables the button if valid, disables if invalid
5. If elements are not found initially, retries every second until found

## Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `validationPattern` | Regex pattern to validate textbox content | `^ABC-\d+-DEF$` |
| `validationMessage` | Message describing the expected format | `Field must match the pattern ABC-<number>-DEF` |

## Setup and Run

```powershell
cd src/dom-widget
npm install
npm start
```

## Deployment

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

## Limitations

- Requires same-origin or `allow-same-origin` sandbox permission
- Cannot work in cross-origin iframes due to browser security
- Only finds the **first** input and button before the iframe
