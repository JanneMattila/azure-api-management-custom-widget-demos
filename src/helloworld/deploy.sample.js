const { deployNodeJS } = require("@azure/api-management-custom-widgets-tools")

const serviceInformation = {
	"resourceId": "subscriptions/<guid>/resourceGroups/<rg>/providers/Microsoft.ApiManagement/service/<service>",
	"managementApiEndpoint": "https://management.azure.com"
}
const name = "helloworld"
const fallbackConfigPath = "./static/config.msapim.json"

deployNodeJS(serviceInformation, name, fallbackConfigPath)
