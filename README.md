# AI Auto Reply - Chrome Extension

AI-powered smart replies for **WhatsApp Web** and **Facebook Messenger** using Google Gemini API.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

## Features

- **Semi-Auto Reply Mode** - Click "✨ Reply with AI" button to generate contextual replies
- **Multi-Platform Support** - Works with WhatsApp Web, Facebook Messenger, and Facebook chat popups
- **Conversation Context** - Sends up to 15 recent messages to Gemini for contextual replies
- **Keyword Rules** - Set up automatic replies for specific keywords/phrases
- **Custom System Prompt** - Personalize AI behavior and tone
- **Webhook Integration** - Send conversation data to external CRM/systems
- **Smart Input Detection** - Automatically finds and types into chat input boxes

## Installation

### Method 1: Load Unpacked (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `ai-auto-reply-extension` folder
5. The extension icon should appear in your toolbar

### Method 2: Chrome Web Store (Future)

*Coming soon*

## Setup

1. **Get a Gemini API Key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key

2. **Configure Extension:**
   - Click the extension icon in Chrome toolbar
   - Paste your Gemini API Key
   - Toggle "Enable Auto Reply" ON
   - Customize settings (optional)

3. **Start Using:**
   - Open WhatsApp Web or Facebook Messenger
   - You'll see a green "✨ Reply with AI" button at bottom-right
   - Click it anytime to generate a contextual reply

## How It Works

### Semi-Auto Mode

1. **Click the button** → Extension collects conversation history
2. **AI analyzes context** → Sends to Gemini API with full conversation
3. **Reply typed** → AI-generated text appears in input box
4. **You review & send** → Manually press Enter to send

### Conversation Context Format

The extension sends conversation history to Gemini in this structured format:

```
ROLE: You are a helpful customer support assistant...

CONVERSATION HISTORY (most recent messages, in order):
────────────────────────────────────
👤 Customer: Hello, do you have this in stock?
🤖 You: Yes, we have it available. Would you like to order?
👤 Customer: How much is shipping?
────────────────────────────────────

TASK: The customer's latest message is: "How much is shipping?"
Write a natural reply based on the full conversation above.

RULES:
- Reply in the SAME LANGUAGE the customer is using
- Keep it brief and conversational (1-3 sentences)
- Be contextually relevant to what was discussed
- Do NOT include any label, prefix, or emoji at the start
- Just output the reply text, nothing else
```

## Configuration Options

### Settings Tab

| Setting | Description |
|---------|-------------|
| **Gemini API Key** | Your Google Gemini API key (required) |
| **System Prompt** | Customize AI personality and behavior |
| **Reply Delay** | Seconds to wait before typing (legacy setting) |

### Keyword Rules

Set up automatic replies for common queries:

| Keyword | Auto-Reply |
|---------|-----------|
| "price" | "Our prices start at $10. What are you looking for?" |
| "hours" | "We're open 9AM-6PM daily" |
| "hello" | "Hi there! How can I help you today?" |

### Webhook Settings

Send conversation data to external systems:
- **Webhook URL** - Your endpoint to receive message data
- **Trigger** - Sends data when AI reply is generated

## Supported Platforms

| Platform | URL Pattern | Status |
|----------|-------------|--------|
| WhatsApp Web | `https://web.whatsapp.com/*` | ✅ Full support |
| Facebook Messenger | `https://www.messenger.com/*` | ✅ Full support |
| Facebook Chat Popup | `https://www.facebook.com/*` | ✅ Full support |

## Technical Details

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Popup UI   │────▶│ Background   │────▶│  Gemini API     │
│  (settings) │     │  (service    │     │  (Google AI)    │
└─────────────┘     │   worker)    │     └─────────────────┘
       │            └──────────────┘              ▲
       │                   ▲                      │
       ▼                   │                      │
┌─────────────┐           │              ┌──────┴──────────┐
│ Content     │───────────┘              │  Reply Text     │
│ Script      │  (GET_AI_REPLY)          │  (typed to UI)  │
│ (WhatsApp/  │◀──────────────────────────┘                 │
│  Facebook)  │                                           │
└─────────────┘                                           │
       ▲                                                  │
       │                                                  │
       └──────────────────────────────────────────────────┘
```

### File Structure

```
ai-auto-reply-extension/
├── manifest.json       # Extension manifest (v3)
├── background.js       # Service worker - API calls, webhooks
├── content.js          # Content script - UI injection, chat detection
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── styles.css          # Popup styling
├── icons/
│   ├── icon16.png      # Toolbar icon (16x16)
│   ├── icon48.png      # Extension icon (48x48)
│   └── icon128.png     # Store icon (128x128)
└── README.md           # This file
```

### Permissions

- `storage` - Save settings locally
- `activeTab` - Access current tab for debugging
- `scripting` - Inject content scripts
- `tabs` - Query and message all tabs
- `host_permissions`:
  - `web.whatsapp.com/*` - WhatsApp Web access
  - `facebook.com/*` - Facebook Messenger access
  - `messenger.com/*` - Messenger access
  - `generativelanguage.googleapis.com/*` - Gemini API

## Troubleshooting

### Extension not working on Facebook

1. Make sure you're on `facebook.com` (not `messenger.com`)
2. Open a chat popup by clicking a conversation
3. Look for the green "✨ Reply with AI" button at bottom-right
4. If missing, refresh the page (F5)

### "Extension context invalidated" error

1. Extension was updated/reloaded
2. **Solution:** Refresh the page (F5)

### "Could not type reply" error

1. Click inside the chat input box first
2. Then click "Reply with AI" button
3. If still failing, try refreshing the page

### No API key configured

1. Click extension icon in toolbar
2. Enter your Gemini API key in the settings
3. Toggle "Enable Auto Reply" ON
4. Refresh WhatsApp/Messenger page

## Development

### Local Development

1. Clone or download the extension folder
2. Load unpacked in Chrome (see Installation)
3. Edit files and reload extension to test changes

### Console Debugging

Open browser console (F12 → Console) and filter by `[AI Auto Reply]` to see debug logs.

### Common Debug Commands

```javascript
// Check if content script loaded
console.log('[AI Auto Reply]', 'Manual test');

// Find input box manually
document.querySelectorAll('div[contenteditable="true"]');
```

## Privacy & Security

- **API Key Storage:** Your Gemini API key is stored locally in Chrome's storage (not sent to any server)
- **Conversation Data:** Messages are sent to Google's Gemini API for generating replies
- **Webhook Data:** Only sent if you configure a webhook URL
- **No Analytics:** Extension does not track usage or send analytics

## License

MIT License - Feel free to modify and distribute.

## Changelog

### v1.0.0
- Initial release
- WhatsApp Web support
- Facebook Messenger support
- Facebook chat popup support
- Semi-auto "Reply with AI" button
- Conversation context for Gemini
- Keyword rules
- Webhook integration
- Custom system prompts

## Support

For issues or feature requests:
1. Check the Troubleshooting section above
2. Review console logs for error messages
3. Ensure API key is valid and has quota remaining

---

**Made with ❤️ for smarter conversations**
