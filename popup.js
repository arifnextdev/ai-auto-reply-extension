// AI Auto Reply - Popup Script

const DEFAULT_SETTINGS = {
	enabled: false,
	apiKey: "",
	systemPrompt:
		"You are a helpful customer support assistant. Reply politely and briefly to the following customer message.",
	replyDelay: 3,
	keywordRules: [],
	webhookUrl: "",
};

// DOM Elements
const toggleAutoReply = document.getElementById("toggleAutoReply");
const statusBanner = document.getElementById("statusBanner");
const statusText = document.getElementById("statusText");
const apiKeyInput = document.getElementById("apiKey");
const systemPromptInput = document.getElementById("systemPrompt");
const replyDelayInput = document.getElementById("replyDelay");
const delayValue = document.getElementById("delayValue");
const keywordRulesContainer = document.getElementById("keywordRules");
const btnAddRule = document.getElementById("btnAddRule");
const webhookUrlInput = document.getElementById("webhookUrl");
const btnSave = document.getElementById("btnSave");
const saveFeedback = document.getElementById("saveFeedback");

// Initialize popup
document.addEventListener("DOMContentLoaded", loadSettings);

// Toggle auto reply — immediately save and notify content scripts
toggleAutoReply.addEventListener("change", () => {
	const newState = toggleAutoReply.checked;
	updateStatusBanner(newState);

	// Save toggle state immediately (don't require clicking Save)
	chrome.storage.local.set({ enabled: newState }, () => {
		console.log("[AI Auto Reply] Toggle saved:", newState);

		// Notify all WhatsApp/Messenger tabs about the change
		chrome.tabs.query({}, (tabs) => {
			for (const tab of tabs) {
				if (
					tab.url &&
					(tab.url.includes("web.whatsapp.com") ||
						tab.url.includes("facebook.com/messages") ||
						tab.url.includes("messenger.com"))
				) {
					chrome.tabs
						.sendMessage(tab.id, {
							type: "SETTINGS_UPDATED",
							settings: {
								enabled: newState,
								replyDelay: parseInt(replyDelayInput.value, 10),
							},
						})
						.catch(() => {});
				}
			}
		});
	});
});

// Reply delay slider
replyDelayInput.addEventListener("input", () => {
	delayValue.textContent = `${replyDelayInput.value}s`;
});

// Add keyword rule
btnAddRule.addEventListener("click", () => {
	addKeywordRuleRow("", "");
});

// Collapsible sections
document.querySelectorAll(".collapsible-header").forEach((header) => {
	header.addEventListener("click", () => {
		const section = header.parentElement;
		section.classList.toggle("open");
	});
});

// Save settings
btnSave.addEventListener("click", saveSettings);

/**
 * Load settings from chrome.storage.local
 */
function loadSettings() {
	chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
		toggleAutoReply.checked = settings.enabled;
		updateStatusBanner(settings.enabled);
		apiKeyInput.value = settings.apiKey;
		systemPromptInput.value = settings.systemPrompt;
		replyDelayInput.value = settings.replyDelay;
		delayValue.textContent = `${settings.replyDelay}s`;
		webhookUrlInput.value = settings.webhookUrl;

		// Load keyword rules
		keywordRulesContainer.innerHTML = "";
		if (settings.keywordRules && settings.keywordRules.length > 0) {
			settings.keywordRules.forEach((rule) => {
				addKeywordRuleRow(rule.keyword, rule.reply);
			});
		}
	});
}

/**
 * Save settings to chrome.storage.local
 */
function saveSettings() {
	const keywordRules = getKeywordRules();

	const settings = {
		enabled: toggleAutoReply.checked,
		apiKey: apiKeyInput.value.trim(),
		systemPrompt:
			systemPromptInput.value.trim() || DEFAULT_SETTINGS.systemPrompt,
		replyDelay: parseInt(replyDelayInput.value, 10),
		keywordRules: keywordRules,
		webhookUrl: webhookUrlInput.value.trim(),
	};

	chrome.storage.local.set(settings, () => {
		// Show save feedback
		saveFeedback.classList.add("show");
		setTimeout(() => saveFeedback.classList.remove("show"), 2000);

		// Notify content scripts about settings change
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]) {
				chrome.tabs
					.sendMessage(tabs[0].id, {
						type: "SETTINGS_UPDATED",
						settings: settings,
					})
					.catch(() => {
						// Tab might not have content script loaded
						console.log("[AI Auto Reply] Could not notify content script");
					});
			}
		});

		console.log("[AI Auto Reply] Settings saved:", {
			...settings,
			apiKey: "***",
		});
	});
}

/**
 * Update status banner appearance
 */
function updateStatusBanner(isEnabled) {
	if (isEnabled) {
		statusBanner.className = "status-banner active";
		statusText.textContent = "Auto Reply is ON";
	} else {
		statusBanner.className = "status-banner inactive";
		statusText.textContent = "Auto Reply is OFF";
	}
}

/**
 * Add a keyword rule row to the UI
 */
function addKeywordRuleRow(keyword, reply) {
	const row = document.createElement("div");
	row.className = "keyword-rule";
	row.innerHTML = `
    <input type="text" class="keyword-input" placeholder="Keyword" value="${escapeHtml(keyword)}">
    <input type="text" class="reply-input" placeholder="Auto reply text" value="${escapeHtml(reply)}">
    <button class="btn-remove-rule" title="Remove rule">&times;</button>
  `;

	row.querySelector(".btn-remove-rule").addEventListener("click", () => {
		row.remove();
	});

	keywordRulesContainer.appendChild(row);
}

/**
 * Get all keyword rules from the UI
 */
function getKeywordRules() {
	const rules = [];
	const rows = keywordRulesContainer.querySelectorAll(".keyword-rule");
	rows.forEach((row) => {
		const keyword = row.querySelector(".keyword-input").value.trim();
		const reply = row.querySelector(".reply-input").value.trim();
		if (keyword && reply) {
			rules.push({ keyword, reply });
		}
	});
	return rules;
}

/**
 * Escape HTML to prevent XSS in dynamic content
 */
function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}
