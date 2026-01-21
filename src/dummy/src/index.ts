import { getValues, Secrets } from "@azure/api-management-custom-widgets-tools"
import * as msal from "@azure/msal-browser"
import { valuesDefault } from "./values"

interface ApimConfig {
  aad?: {
    clientId: string
    authority: string
    allowedTenants: string[]
    clientLibrary?: string
  }
}

class App {
  public readonly values
  public request: (url: string) => Promise<Response>
  public apimConfig: ApimConfig | null = null

  private msalInstance: msal.PublicClientApplication | null = null
  private msalAccount: msal.AccountInfo | null = null
  private loginRequest: msal.PopupRequest = { scopes: ["openid"] }
  private gatewayUrl: string | null = null

  constructor(public readonly secrets: Secrets) {
    this.request = (url) =>
      fetch(
        `${secrets.managementApiUrl}${url}?api-version=${secrets.apiVersion}`,
        secrets.token ? { headers: { Authorization: secrets.token } } : undefined
      )

    this.values = getValues(valuesDefault)

    Object.entries(this.values).forEach(([key, value]) => {
      const element = document.getElementById(`values.${key}`)
      if (element) element.innerText = value
    })
    document.getElementById("message")?.setAttribute("placeholder", this.values.placeholder)
    document.getElementById("form")?.setAttribute("action", this.values.actionUrl)

    // Check if user is logged in to APIM
    if (!this.secrets.userId || !this.secrets.token) {
      // User is not logged in - show "not logged in" state
      console.log("User is not logged in to APIM Developer Portal")
      this.showNotLoggedIn()
    } else {
      // Fetch user name and update placeholder
      this.fetchUserName().then((userName) => {
        if (userName) {
          document.getElementById("message")?.setAttribute("placeholder", `Hello, ${userName}!`)
          const messageElement = document.getElementById("message") as HTMLInputElement | HTMLTextAreaElement | null
          if (messageElement) {
            messageElement.value = secrets.token || ""
          }
        }
      })

      // Fetch gateway URL from Developer Portal API
      this.fetchGatewayUrl()
    }

    // Expose methods to window for button onclick handlers
    ;(window as any).msalLogin = () => this.msalLogin()
    ;(window as any).msalLogout = () => this.msalLogout()
    ;(window as any).testAPI = () => this.testAPI()
  }

  private showNotLoggedIn(): void {
    const authStatus = document.getElementById("auth-status")
    const messageElement = document.getElementById("message") as HTMLTextAreaElement | null
    
    if (authStatus) {
      authStatus.textContent = "Not logged in to Developer Portal"
      authStatus.style.color = "orange"
    }
    if (messageElement) {
      messageElement.value = "Please log in to the Developer Portal to use this widget."
    }
  }

  private async fetchGatewayUrl(): Promise<void> {
    if (!this.secrets.userId || !this.secrets.token) {
      console.error("Cannot fetch gateway URL: userId or token not available")
      return
    }

    try {
      // Developer Portal API: /developer/users/{userId}/apis/{apiId}/hostnames
      // First, we need to get the base URL by replacing /mapi with /developer
      const developerApiUrl = this.secrets.managementApiUrl.replace("/mapi", "/developer")
      
      // Fetch hostnames for echo-api (or any API to get the gateway URL)
      const response = await fetch(
        `${developerApiUrl}/users/${this.secrets.userId}/apis/echo-api/hostnames?api-version=2022-04-01-preview`,
        { headers: { Authorization: this.secrets.token } }
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.value && data.value.length > 0) {
          // Gateway URL is in the value property of the first hostname
          this.gatewayUrl = `https://${data.value[0].value}`
          console.log("Gateway URL fetched:", this.gatewayUrl)
        }
      } else {
        console.error("Failed to fetch gateway URL, status:", response.status)
      }
    } catch (error) {
      console.error("Failed to fetch gateway URL:", error)
    }
  }

  private async fetchUserName(): Promise<string | null> {
    if (this.secrets.userId && this.secrets.token) {
      try {
        const response = await fetch(
          `${this.secrets.managementApiUrl}/users/${this.secrets.userId}?api-version=${this.secrets.apiVersion}`,
          { headers: { Authorization: this.secrets.token } }
        )
        if (response.ok) {
          const user = await response.json()
          const userName = user.properties?.firstName
            ? `${user.properties.firstName} ${user.properties.lastName || ""}`.trim()
            : user.properties?.email || "User"
          return userName
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error)
      }
    }
    return null
  }

  async initMsal(apimConfig: ApimConfig): Promise<void> {
    try {
      if (!apimConfig || !apimConfig.aad) {
        throw new Error("Invalid APIM configuration")
      }

      this.apimConfig = apimConfig
      const aad = apimConfig.aad

      // Build MSAL configuration from APIM config
      const msalConfig: msal.Configuration = {
        auth: {
          clientId: aad.clientId,
          authority: `https://${aad.authority}/${aad.allowedTenants[0]}`,
          redirectUri: window.location.origin + "/signin",
        },
        cache: {
          cacheLocation: "sessionStorage",
        },
      }

      // Initialize MSAL
      this.msalInstance = new msal.PublicClientApplication(msalConfig)
      await this.msalInstance.initialize()

      // Handle redirect promise
      const response = await this.msalInstance.handleRedirectPromise()
      if (response) {
        this.msalAccount = response.account
        // Only update UI if user is logged in to APIM
        if (this.secrets.userId && this.secrets.token) {
          this.updateUI()
        }
      } else {
        // Check if there's an account already signed in
        const accounts = this.msalInstance.getAllAccounts()
        if (accounts.length > 0) {
          this.msalAccount = accounts[0]
          // Only update UI and acquire token if user is logged in to APIM
          if (this.secrets.userId && this.secrets.token) {
            this.updateUI()
            await this.acquireTokenSilently()
          }
        }
      }

      console.log("MSAL initialized successfully")
    } catch (error) {
      console.error("Error initializing MSAL:", error)
      this.showResult(`✗ Failed to initialize MSAL: ${(error as Error).message}`, "error")
    }
  }

  private updateUI(): void {
    const loginBtn = document.getElementById("login-btn")
    const logoutBtn = document.getElementById("logout-btn")
    const testApiBtn = document.getElementById("test-api-btn")
    const authStatus = document.getElementById("auth-status")
    const userInfo = document.getElementById("user-info")
    const userName = document.getElementById("user-name")
    const userEmail = document.getElementById("user-email")

    if (this.msalAccount) {
      if (loginBtn) loginBtn.style.display = "none"
      if (logoutBtn) logoutBtn.style.display = "inline-block"
      if (testApiBtn) testApiBtn.style.display = "inline-block"
      if (authStatus) {
        authStatus.textContent = "Authenticated"
        authStatus.style.color = "green"
      }
      if (userInfo) userInfo.style.display = "block"
      if (userName) userName.textContent = this.msalAccount.name || "N/A"
      if (userEmail) userEmail.textContent = this.msalAccount.username || "N/A"
    } else {
      if (loginBtn) loginBtn.style.display = "inline-block"
      if (logoutBtn) logoutBtn.style.display = "none"
      if (testApiBtn) testApiBtn.style.display = "none"
      if (authStatus) {
        authStatus.textContent = "Not authenticated"
        authStatus.style.color = "red"
      }
      if (userInfo) userInfo.style.display = "none"
    }
  }

  private showResult(message: string, type: "success" | "error"): void {
    const resultDiv = document.getElementById("msal-result")
    if (resultDiv) {
      resultDiv.style.display = "block"
      resultDiv.className = `result ${type}`
      resultDiv.textContent = message
    }
  }

  async msalLogin(): Promise<void> {
    if (!this.msalInstance) {
      this.showResult("✗ MSAL not initialized. Please refresh the page.", "error")
      return
    }

    try {
      const response = await this.msalInstance.loginPopup(this.loginRequest)
      this.msalAccount = response.account
      this.updateUI()

      // Try to acquire token silently after login
      await this.acquireTokenSilently()

      this.showResult(`✓ Successfully signed in as ${this.msalAccount?.name}`, "success")
    } catch (error) {
      this.showResult(`✗ Login error: ${(error as Error).message}`, "error")
      console.error("Login error:", error)
    }
  }

  private async acquireTokenSilently(): Promise<msal.AuthenticationResult | null> {
    if (!this.msalInstance || !this.msalAccount) {
      return null
    }

    const tokenRequest: msal.SilentRequest = {
      scopes: this.loginRequest.scopes || [],
      account: this.msalAccount,
    }

    try {
      const tokenResponse = await this.msalInstance.acquireTokenSilent(tokenRequest)
      console.log("Token acquired silently:", tokenResponse.accessToken.substring(0, 20) + "...")
      this.showResult(`✓ Token acquired silently for ${this.msalAccount.name}`, "success")
      return tokenResponse
    } catch (error) {
      console.log("Silent token acquisition failed:", (error as Error).message)
      if (error instanceof msal.InteractionRequiredAuthError) {
        this.showResult("⚠ Silent token acquisition failed. User interaction required.", "error")
      }
      return null
    }
  }

  async msalLogout(): Promise<void> {
    if (!this.msalInstance || !this.msalAccount) {
      return
    }

    const logoutRequest: msal.EndSessionPopupRequest = {
      account: this.msalAccount,
      postLogoutRedirectUri: window.location.origin,
    }

    await this.msalInstance.logoutPopup(logoutRequest)
    this.msalAccount = null
    this.updateUI()
    this.showResult("✓ Successfully signed out", "success")
  }

  async testAPI(): Promise<void> {
    const resultDiv = document.getElementById("msal-result")
    if (resultDiv) {
      resultDiv.style.display = "block"
      resultDiv.textContent = "Testing API Call..."
    }

    try {
      if (!this.msalInstance) {
        throw new Error("MSAL not initialized. Please refresh the page.")
      }

      if (!this.msalAccount) {
        throw new Error("Not authenticated. Please sign in first.")
      }

      // Acquire token
      const tokenRequest: msal.SilentRequest = {
        scopes: this.loginRequest.scopes || [],
        account: this.msalAccount,
      }

      let tokenResponse: msal.AuthenticationResult
      try {
        tokenResponse = await this.msalInstance.acquireTokenSilent(tokenRequest)
      } catch (error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
          // Fallback to interactive method
          tokenResponse = await this.msalInstance.acquireTokenPopup(this.loginRequest)
        } else {
          throw error
        }
      }

      // Call backend API with token via Gateway
      if (!this.gatewayUrl) {
        throw new Error("Gateway URL not available. Please refresh the page.")
      }
      
      const apiUrl = `${this.gatewayUrl}/echo/resource`
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
        body: JSON.stringify({
          data: "Hello world!"
        }),
      })

      const httpStatus = response.status
      const httpStatusText = response.statusText
      const data = await response.text()

      // Build message for textarea
      const messageTextarea = document.getElementById("message") as HTMLTextAreaElement | null
      if (messageTextarea) {
        let fullMessage = `HTTP Status: ${httpStatus} ${httpStatusText}\n`
        fullMessage += `Response:\n${data}`
        messageTextarea.value = fullMessage
      }

      this.showResult(`✓ API call completed with status ${httpStatus}`, "success")
    } catch (error) {
      this.showResult(`✗ Error: ${(error as Error).message}`, "error")
      // Also update message textarea with error
      const messageTextarea = document.getElementById("message") as HTMLTextAreaElement | null
      if (messageTextarea) {
        messageTextarea.value = `Error: ${(error as Error).message}`
      }
      console.error("API call error:", error)
    }
  }
}

export default App
