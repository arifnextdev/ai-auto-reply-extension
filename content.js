// AI Auto Reply - Content Script
// Shows a permanent "Reply with AI" button near the input area.
// User clicks it → collects conversation context → calls Gemini → types reply into input box.
// User reviews and sends manually.

(function () {
	"use strict";

	const LOG = (...args) => console.log("[AI Auto Reply]", ...args);
	const WARN = (...args) => console.warn("[AI Auto Reply]", ...args);
	const ERR = (...args) => console.error("[AI Auto Reply]", ...args);

	// ─── Extension Context Check ─────────────────────────────────────────────────
	let contextValid = true;

	function isContextValid() {
		try {
			if (chrome.runtime && chrome.runtime.id) return true;
		} catch (e) {}
		return false;
	}

	function handleContextInvalidated() {
		if (!contextValid) return;
		contextValid = false;
		ERR("Extension context invalidated. Please refresh this page (F5).");
		removeAIButton();
		showRefreshNotification();
	}

	function showRefreshNotification() {
		if (document.getElementById("ai-auto-reply-refresh-notice")) return;
		const notice = document.createElement("div");
		notice.id = "ai-auto-reply-refresh-notice";
		notice.style.cssText = `
			position: fixed; top: 16px; right: 16px; z-index: 999999;
			background: #ff4444; color: white; padding: 12px 20px;
			border-radius: 8px; font-family: sans-serif; font-size: 14px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer;
			max-width: 340px; line-height: 1.4;
		`;
		notice.innerHTML = `<strong>AI Auto Reply:</strong> Extension was updated. <u>Click here</u> or press <strong>F5</strong> to refresh.`;
		notice.addEventListener("click", () => location.reload());
		document.body.appendChild(notice);
	}

	async function safeSendMessage(msg) {
		if (!isContextValid()) {
			handleContextInvalidated();
			return null;
		}
		try {
			return await chrome.runtime.sendMessage(msg);
		} catch (error) {
			if (
				error.message?.includes("Extension context invalidated") ||
				error.message?.includes("disconnected")
			) {
				handleContextInvalidated();
				return null;
			}
			throw error;
		}
	}

	// ─── State ────────────────────────────────────────────────────────────────────
	let isProcessing = false;
	let platform = null;
	let currentChatId = null;

	// ─── Platform Detection ───────────────────────────────────────────────────────
	function detectPlatform() {
		const url = window.location.href;
		if (url.includes("web.whatsapp.com")) return "whatsapp";
		if (url.includes("facebook.com") || url.includes("messenger.com"))
			return "messenger";
		return null;
	}

	// ─── Selectors ────────────────────────────────────────────────────────────────

	const WA_TEXT_SELECTORS = [
		".selectable-text.copyable-text span",
		".selectable-text span",
		".copyable-text span",
		"span.selectable-text",
		'span[dir="ltr"]',
		'span[dir="rtl"]',
	];

	const WA_INPUT_SELECTORS = [
		'div[contenteditable="true"][data-tab="10"]',
		'div[contenteditable="true"][data-tab="6"]',
		'div[contenteditable="true"][data-tab="1"]',
		'footer div[contenteditable="true"]',
		'div[title="Type a message"]',
		'#main footer div[contenteditable="true"]',
		'div[contenteditable="true"][role="textbox"]',
	];

	// ─── Initialize ───────────────────────────────────────────────────────────────
	function init() {
		platform = detectPlatform();
		if (!platform) {
			LOG("Not on a supported platform, exiting.");
			return;
		}

		LOG(`Detected platform: ${platform}`);

		if (!isContextValid()) {
			handleContextInvalidated();
			return;
		}

		// Wait for the chat UI to load, then inject the button
		waitForChatUI();
	}

	// ─── Wait for Chat UI ─────────────────────────────────────────────────────────
	function waitForChatUI() {
		LOG("Waiting for chat UI to load...");

		if (platform === "messenger") {
			// Facebook/Messenger: inject button immediately (chat popups load dynamically)
			injectAIButton();
			LOG("Messenger/Facebook detected — button injected immediately.");
			return;
		}

		// WhatsApp: wait for the footer/input area
		let attempts = 0;
		const interval = setInterval(() => {
			attempts++;

			const footer =
				document.querySelector("#main footer") ||
				document.querySelector("footer");

			if (footer) {
				clearInterval(interval);
				LOG("WhatsApp chat UI found. Injecting AI button.");
				injectAIButton();
				watchForChatSwitch();
			} else if (attempts >= 120) {
				clearInterval(interval);
				WARN("Chat UI not found after 60s. Will use body observer.");
				observeBodyForChat();
			} else if (attempts % 20 === 0) {
				LOG(`Still waiting for chat UI... (${attempts}/120)`);
			}
		}, 500);
	}

	// ─── Fallback: Observe body until chat appears (WhatsApp only) ───────────────
	function observeBodyForChat() {
		const bodyObserver = new MutationObserver(() => {
			const footer =
				document.querySelector("#main footer") ||
				document.querySelector("footer");
			if (footer) {
				bodyObserver.disconnect();
				LOG("Chat UI appeared via body observer.");
				injectAIButton();
				watchForChatSwitch();
			}
		});
		bodyObserver.observe(document.body, { childList: true, subtree: true });
	}

	// ─── Watch for Chat Switches (WhatsApp) ──────────────────────────────────────
	function watchForChatSwitch() {
		const mainEl = document.querySelector("#main");
		if (!mainEl) return;

		const chatObserver = new MutationObserver(() => {
			const header = document.querySelector("#main header");
			const newChatId = header?.innerText?.trim()?.substring(0, 30) || null;

			if (newChatId && newChatId !== currentChatId) {
				currentChatId = newChatId;
				LOG(`Chat switched to: "${currentChatId}"`);
				// Re-inject button (it may have been removed by DOM change)
				setTimeout(() => injectAIButton(), 500);
			}
		});

		chatObserver.observe(mainEl, { childList: true, subtree: false });
	}

	// ─── Inject Permanent "Reply with AI" Button ─────────────────────────────────
	function injectAIButton() {
		removeAIButton();

		const btn = document.createElement("div");
		btn.id = "ai-reply-btn";
		btn.style.cssText = `
			position: fixed; bottom: 16px; right: 24px; z-index: 999999;
			background: linear-gradient(135deg, #00a884, #128c7e);
			color: white; padding: 10px 18px; border-radius: 20px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 13px; font-weight: 600; cursor: pointer;
			box-shadow: 0 3px 12px rgba(0,0,0,0.3);
			display: flex; align-items: center; gap: 6px;
			transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
			user-select: none; opacity: 0.9;
		`;
		btn.innerHTML = `<span style="font-size:16px">✨</span> Reply with AI`;

		btn.addEventListener("mouseenter", () => {
			btn.style.transform = "scale(1.05)";
			btn.style.opacity = "1";
			btn.style.boxShadow = "0 5px 18px rgba(0,0,0,0.4)";
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.transform = "scale(1)";
			btn.style.opacity = "0.9";
			btn.style.boxShadow = "0 3px 12px rgba(0,0,0,0.3)";
		});

		btn.addEventListener("click", handleReplyWithAI);

		document.body.appendChild(btn);
		LOG("Permanent 'Reply with AI' button injected.");
	}

	function removeAIButton() {
		const existing = document.getElementById("ai-reply-btn");
		if (existing) existing.remove();
	}

	// ─── Handle "Reply with AI" Click ────────────────────────────────────────────
	async function handleReplyWithAI() {
		if (isProcessing) return;
		isProcessing = true;

		const btn = document.getElementById("ai-reply-btn");
		const originalHTML = btn?.innerHTML;
		if (btn) {
			btn.innerHTML = `<span style="font-size:16px">⏳</span> Generating...`;
			btn.style.opacity = "0.6";
			btn.style.pointerEvents = "none";
		}

		try {
			// Collect the full conversation visible in the chat
			const conversationHistory = getConversationHistory(15);

			if (conversationHistory.length === 0) {
				ERR("No conversation messages found.");
				resetButton(btn, originalHTML);
				return;
			}

			// The latest message text (for the API call)
			const latestMsg = conversationHistory[conversationHistory.length - 1];
			const latestText = latestMsg?.text || "";

			if (!latestText) {
				ERR("Could not determine latest message text.");
				resetButton(btn, originalHTML);
				return;
			}

			LOG(
				`Requesting AI reply. Context: ${conversationHistory.length} messages. Latest: "${latestText.substring(0, 80)}"`,
			);

			const response = await safeSendMessage({
				type: "GET_AI_REPLY",
				text: latestText,
				platform: platform,
				history: conversationHistory,
			});

			if (response === null) {
				resetButton(btn, originalHTML);
				return;
			}

			if (!response || !response.success) {
				ERR("AI reply failed:", response?.error || "Unknown error");
				showButtonError(btn, response?.error || "Failed", originalHTML);
				return;
			}

			LOG(
				`AI reply (${response.source}): "${response.reply.substring(0, 100)}"`,
			);

			// Type into the input box (user sends manually)
			const typed = await typeReplyOnly(response.reply);
			if (typed) {
				LOG("Reply typed into input. User can review and send.");
			} else {
				ERR("Failed to type reply into input box.");
				showButtonError(btn, "Could not type reply", originalHTML);
				return;
			}
		} catch (error) {
			if (
				error.message?.includes("Extension context invalidated") ||
				error.message?.includes("disconnected")
			) {
				handleContextInvalidated();
			} else {
				ERR("Error:", error.message);
				showButtonError(btn, "Error occurred", originalHTML);
				return;
			}
		} finally {
			isProcessing = false;
			// Restore button after a short delay
			setTimeout(() => resetButton(btn, originalHTML), 500);
		}
	}

	function resetButton(btn, originalHTML) {
		if (!btn || !document.getElementById("ai-reply-btn")) return;
		btn.innerHTML =
			originalHTML || `<span style="font-size:16px">✨</span> Reply with AI`;
		btn.style.opacity = "0.9";
		btn.style.pointerEvents = "auto";
		isProcessing = false;
	}

	function showButtonError(btn, errorMsg, originalHTML) {
		if (btn) {
			btn.innerHTML = `<span style="font-size:16px">❌</span> ${errorMsg}`;
			btn.style.background = "#cc3333";
			btn.style.opacity = "1";
			btn.style.pointerEvents = "none";
		}
		setTimeout(() => {
			if (btn)
				btn.style.background = "linear-gradient(135deg, #00a884, #128c7e)";
			resetButton(btn, originalHTML);
		}, 3000);
		isProcessing = false;
	}

	// ─── Type Reply Into Input Box (NO send) ─────────────────────────────────────
	async function typeReplyOnly(replyText) {
		try {
			let inputBox = null;

			if (platform === "whatsapp") {
				for (const sel of WA_INPUT_SELECTORS) {
					inputBox = document.querySelector(sel);
					if (inputBox) break;
				}
			} else {
				// Facebook chat popup & Messenger — try multiple selectors
				const fbInputSelectors = [
					'div[contenteditable="true"][role="textbox"]',
					'div[contenteditable="true"][aria-label*="Message"]',
					'div[contenteditable="true"][aria-label*="message"]',
					'p[contenteditable="true"]',
					'div[role="main"] div[contenteditable="true"]',
					'div[contenteditable="true"]',
				];
				for (const sel of fbInputSelectors) {
					const all = document.querySelectorAll(sel);
					if (all.length > 0) {
						inputBox = all[all.length - 1];
						LOG(
							`FB input found with: ${sel} (${all.length} matches, using last)`,
						);
						break;
					}
				}
			}

			if (!inputBox) {
				ERR("Input box not found!");
				return false;
			}

			inputBox.focus();
			inputBox.click();
			await sleep(200);

			if (platform === "whatsapp") {
				inputBox.innerHTML = "";
				await sleep(50);
				document.execCommand("selectAll", false, null);
				document.execCommand("insertText", false, replyText);
			} else {
				// Facebook/Messenger: use execCommand for better compatibility
				document.execCommand("selectAll", false, null);
				document.execCommand("insertText", false, replyText);
				inputBox.dispatchEvent(new Event("input", { bubbles: true }));
			}

			return true;
		} catch (error) {
			ERR("Error typing reply:", error.message);
			return false;
		}
	}

	// ─── Extract Conversation History ────────────────────────────────────────────
	function getConversationHistory(maxMessages = 15) {
		const history = [];

		if (platform === "whatsapp") {
			const allMessages = document.querySelectorAll(
				'div.message-in, div.message-out, div[class*="message-in"], div[class*="message-out"]',
			);

			// Deduplicate elements (overlapping selectors)
			const seen = new Set();
			const unique = [];
			allMessages.forEach((msg) => {
				if (!seen.has(msg)) {
					seen.add(msg);
					unique.push(msg);
				}
			});

			const recent = unique.slice(-maxMessages);

			for (const msg of recent) {
				const text = extractWhatsAppText(msg);
				if (!text || text.length === 0) continue;

				const isIncoming =
					msg.classList.contains("message-in") ||
					msg.className.includes("message-in");

				history.push({
					role: isIncoming ? "customer" : "you",
					text: text,
				});
			}
		} else {
			// Facebook chat popup & Messenger
			// Try multiple container selectors
			let messageDivs = [];

			// Method 1: div[role="row"] (messenger.com)
			const rows = document.querySelectorAll('div[role="row"]');
			if (rows.length > 0) {
				for (const row of rows) {
					const md = row.querySelector('div[dir="auto"]');
					if (md && md.innerText?.trim()) messageDivs.push(md);
				}
			}

			// Method 2: Facebook chat popup — all div[dir="auto"] inside message-like containers
			if (messageDivs.length === 0) {
				const allDirAuto = document.querySelectorAll('div[dir="auto"]');
				for (const el of allDirAuto) {
					const text = el.innerText?.trim();
					// Filter: must have text, not be too long (skip page content), skip very short (<2 chars)
					if (text && text.length >= 2 && text.length < 500) {
						// Check if it's inside a chat-like container (not main page content)
						const parent = el.closest(
							'[role="dialog"], [role="complementary"], [aria-label*="chat"], [aria-label*="Chat"], [class*="chat"], [data-testid]',
						);
						if (parent) {
							messageDivs.push(el);
						}
					}
				}
			}

			// Method 3: Broadest fallback — find all spans/divs with dir="auto" that look like messages
			if (messageDivs.length === 0) {
				const allText = document.querySelectorAll(
					'span[dir="auto"], div[dir="auto"]',
				);
				for (const el of allText) {
					const text = el.innerText?.trim();
					if (text && text.length >= 2 && text.length < 500) {
						messageDivs.push(el);
					}
				}
			}

			const recent = messageDivs.slice(-maxMessages);

			for (const md of recent) {
				const text = md.innerText?.trim();
				if (!text) continue;

				// Determine if outgoing by checking bubble background color
				const bubble = md.closest("div[class]");
				let isOutgoing = false;
				if (bubble) {
					const bgColor = window.getComputedStyle(bubble).backgroundColor;
					isOutgoing = isOutgoingBubbleColor(bgColor);
				}

				history.push({
					role: isOutgoing ? "you" : "customer",
					text: text,
				});
			}
		}

		LOG(`Conversation history collected: ${history.length} messages`);
		return history;
	}

	// ─── Extract Text from WhatsApp Message ──────────────────────────────────────
	function extractWhatsAppText(messageEl) {
		if (!messageEl) return "";

		for (const sel of WA_TEXT_SELECTORS) {
			const textEls = messageEl.querySelectorAll(sel);
			if (textEls.length > 0) {
				const text = Array.from(textEls)
					.map((el) => el.innerText?.trim())
					.filter((t) => t && t.length > 0)
					.join(" ");
				if (text) return text;
			}
		}

		// Fallback: strip timestamp from innerText
		const rawText = messageEl.innerText?.trim() || "";
		const lines = rawText.split("\n").filter((l) => l.trim());
		if (lines.length > 1) {
			const lastLine = lines[lines.length - 1].trim();
			if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(lastLine)) {
				lines.pop();
			}
		}
		return lines.join(" ").trim();
	}

	// ─── Messenger Helpers ───────────────────────────────────────────────────────
	function isOutgoingBubbleColor(bgColor) {
		if (!bgColor || bgColor === "transparent" || bgColor === "rgba(0, 0, 0, 0)")
			return false;
		const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (!match) return false;
		const [, r, g, b] = match.map(Number);
		return b > 150 && b > r && b > g;
	}

	// ─── Utility ──────────────────────────────────────────────────────────────────
	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// ─── Start ────────────────────────────────────────────────────────────────────
	LOG("Content script loaded.");
	init();
})();
