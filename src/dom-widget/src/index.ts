import {getValues, Secrets} from "@azure/api-management-custom-widgets-tools"
import {valuesDefault, Values} from "./values"

class App {
  public readonly values: Values
  private textboxElement: HTMLInputElement | HTMLTextAreaElement | null = null
  private buttonElement: HTMLButtonElement | HTMLInputElement | null = null
  private statusElement: HTMLElement | null = null
  private retryIntervalId: number | null = null
  private isInitialized: boolean = false

  constructor(
    public readonly secrets: Secrets,
  ) {
    this.values = getValues(valuesDefault)
    this.statusElement = document.getElementById("status")

    this.initializeWidget()
  }

  private initializeWidget(): void {
    // Display configured values
    this.updateDisplay("validationPattern", this.values.validationPattern)
    this.updateDisplay("validationMessage", this.values.validationMessage)

    // Try to find elements in parent window
    this.findParentElements()
  }

  private updateDisplay(id: string, value: string): void {
    const element = document.getElementById(`values.${id}`)
    if (element) element.textContent = value
  }

  private findParentElements(): void {
    try {
      // Attempt to access parent window's document
      const parentDoc = window.parent.document

      // Find the iframe element that contains this widget
      const iframes = parentDoc.getElementsByTagName('iframe')
      let ourIframe: HTMLIFrameElement | null = null
      
      for (let i = 0; i < iframes.length; i++) {
        try {
          if (iframes[i].contentWindow === window) {
            ourIframe = iframes[i]
            break
          }
        } catch (e) {
          // Skip iframes we can't access
        }
      }

      if (!ourIframe) {
        this.showStatus("✗ Could not find our iframe in parent document", "error")
        this.startRetryInterval()
        return
      }

      this.showStatus(`✓ Found our iframe element`, "success")

      // Search upward from the iframe to find the first input and button
      const found = this.findElementsBeforeIframe(ourIframe, parentDoc)
      
      if (!found) {
        this.startRetryInterval()
      } else {
        this.stopRetryInterval()
      }

    } catch (error) {
      // Cross-origin or sandbox restriction
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.showStatus(`✗ Cannot access parent DOM: ${errorMessage}`, "error")
      this.showStatus("This widget requires 'allow-same-origin' in iframe sandbox or same-origin pages.", "warning", true)
    }
  }

  private startRetryInterval(): void {
    if (this.retryIntervalId !== null) return // Already running
    
    this.showStatus("⏳ Will retry finding elements every second...", "info", true)
    
    this.retryIntervalId = window.setInterval(() => {
      this.showStatus("🔄 Retrying element search...", "info", true)
      this.findParentElements()
    }, 1000)
  }

  private stopRetryInterval(): void {
    if (this.retryIntervalId !== null) {
      window.clearInterval(this.retryIntervalId)
      this.retryIntervalId = null
      this.showStatus("✓ Retry interval stopped - elements found", "success", true)
    }
  }

  private findElementsBeforeIframe(iframe: HTMLIFrameElement, parentDoc: Document): boolean {
    // Collect all elements before the iframe by traversing the DOM in document order
    const elementsBeforeIframe: Element[] = []
    
    // Walk through previous siblings and their descendants
    let sibling = iframe.previousElementSibling
    while (sibling) {
      this.collectElementsInOrder(sibling, elementsBeforeIframe)
      sibling = sibling.previousElementSibling
    }

    // Also check parent's previous siblings (walk up the tree)
    let parent = iframe.parentElement
    while (parent && parent !== parentDoc.body) {
      let parentSibling = parent.previousElementSibling
      while (parentSibling) {
        this.collectElementsInOrder(parentSibling, elementsBeforeIframe)
        parentSibling = parentSibling.previousElementSibling
      }
      parent = parent.parentElement
    }

    // Find all inputs and buttons with their positions
    let foundTextbox: { element: HTMLInputElement | HTMLTextAreaElement, index: number } | null = null
    let foundButton: { element: HTMLButtonElement | HTMLInputElement, index: number } | null = null

    for (let i = 0; i < elementsBeforeIframe.length; i++) {
      const el = elementsBeforeIframe[i]
      
      // Check for input/textarea
      if (!foundTextbox && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        const inputEl = el as HTMLInputElement | HTMLTextAreaElement
        // Skip hidden inputs and buttons
        if (inputEl.type !== 'hidden' && inputEl.type !== 'button' && inputEl.type !== 'submit') {
          foundTextbox = { element: inputEl, index: i }
        }
      }
      
      // Check for button
      if (!foundButton && (el.tagName === 'BUTTON' || 
          (el.tagName === 'INPUT' && ((el as HTMLInputElement).type === 'button' || (el as HTMLInputElement).type === 'submit')))) {
        foundButton = { element: el as HTMLButtonElement | HTMLInputElement, index: i }
      }
    }

    // Validate that textbox comes before button in document order
    if (foundTextbox && foundButton) {
      if (foundTextbox.index > foundButton.index) {
        this.showStatus("✗ Textbox must appear before button in the page", "error", true)
        return false
      }
    }

    // Set the elements
    if (foundTextbox) {
      this.textboxElement = foundTextbox.element
      const id = this.textboxElement.id || this.textboxElement.name || '(no id)'
      this.showStatus(`✓ Found input: ${this.textboxElement.tagName.toLowerCase()}#${id}`, "success", true)
    } else {
      this.showStatus("✗ No input field found before iframe", "error", true)
      return false
    }

    if (foundButton) {
      this.buttonElement = foundButton.element
      const id = this.buttonElement.id || (this.buttonElement as HTMLInputElement).name || '(no id)'
      this.showStatus(`✓ Found button: ${this.buttonElement.tagName.toLowerCase()}#${id}`, "success", true)
    } else {
      this.showStatus("✗ No button found before iframe", "error", true)
      return false
    }

    // Both elements found and in correct order
    if (!this.isInitialized) {
      this.isInitialized = true
      this.setupTextboxValidation()
    }
    
    return true
  }

  private collectElementsInOrder(element: Element, collection: Element[]): void {
    // Add element first, then children (document order)
    collection.push(element)
    const children = element.children
    for (let i = 0; i < children.length; i++) {
      this.collectElementsInOrder(children[i], collection)
    }
  }

  private setupTextboxValidation(): void {
    if (!this.textboxElement || !this.buttonElement) return

    // Initially disable button and validate current value
    this.validateAndUpdateButton()

    // Add input event listener for real-time validation
    this.textboxElement.addEventListener("input", () => this.validateAndUpdateButton())
    this.textboxElement.addEventListener("change", () => this.validateAndUpdateButton())

    this.showStatus("✓ Textbox validation handler attached - button will be enabled when validation passes", "success", true)
  }

  private validateAndUpdateButton(): void {
    if (!this.textboxElement || !this.buttonElement) return

    const value = this.textboxElement.value
    const pattern = new RegExp(this.values.validationPattern)
    const isValid = pattern.test(value)

    // Enable or disable the button based on validation
    this.buttonElement.disabled = !isValid

    // Update button styling
    if (isValid) {
      this.buttonElement.style.opacity = "1"
      this.buttonElement.style.cursor = "pointer"
    } else {
      this.buttonElement.style.opacity = "0.5"
      this.buttonElement.style.cursor = "not-allowed"
    }
  }

  private showStatus(message: string, type: "success" | "error" | "warning" | "info", append: boolean = false): void {
    if (!this.statusElement) return

    const entry = document.createElement("div")
    entry.className = `status-entry status-${type}`
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`

    if (append) {
      this.statusElement.appendChild(entry)
    } else {
      this.statusElement.innerHTML = ""
      this.statusElement.appendChild(entry)
    }
  }

  private showValidationResult(message: string, isValid: boolean): void {
    const resultElement = document.getElementById("validation-result")
    if (resultElement) {
      resultElement.textContent = message
      resultElement.className = `validation-result ${isValid ? "valid" : "invalid"}`
      resultElement.style.display = "block"
    }
  }
}

export default App
