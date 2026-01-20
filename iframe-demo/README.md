# IFrame to Parent Communication Demo

This demo illustrates how an iframe can communicate with its parent page, comparing two approaches:

1. **postMessage** - The safe, cross-origin compatible method
2. **Direct DOM access** - Restricted by same-origin policy and sandbox attributes

## Running the Demo

```bash
cd iframe-demo
npx serve .
```

Then open `http://localhost:3000` in your browser.

## How It Works

### postMessage (Recommended)

The iframe sends messages to the parent using `window.parent.postMessage()`:

```javascript
// In iframe
window.parent.postMessage({ action: 'updateText', text: 'Hello!' }, '*');

// In parent - listen for messages
window.addEventListener('message', (event) => {
  // Always validate origin in production!
  // if (event.origin !== 'https://trusted-domain.com') return;
  
  if (event.data.action === 'updateText') {
    document.getElementById('myElement').textContent = event.data.text;
  }
});
```

### Direct DOM Access (Restricted)

The iframe attempts to directly manipulate the parent's DOM:

```javascript
// In iframe - only works without sandbox or with allow-same-origin
window.parent.document.getElementById('myElement').textContent = 'Hello!';
```

## Sandbox Attribute Behavior

| Sandbox Setting | postMessage | Direct DOM Access |
|-----------------|-------------|-------------------|
| No sandbox | ✅ Works | ✅ Works |
| `allow-scripts` only | ✅ Works | ❌ Blocked |
| `allow-scripts allow-same-origin` | ✅ Works | ✅ Works |

## Key Takeaways

- **postMessage** always works regardless of sandbox or origin restrictions
- **Direct DOM access** requires either no sandbox or `allow-same-origin` in the sandbox attribute
- Azure API Management custom widgets use `postMessage` internally (via the SDK) because widgets run in sandboxed iframes
- Always validate `event.origin` in production when using postMessage for security

## Files

- `index.html` - Parent page with updatable content and message log
- `iframe.html` - Child page with buttons demonstrating both communication methods
