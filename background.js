// background.js - Manifest V3 Service Worker

const DEFAULT_PROMPTS_URL = chrome.runtime.getURL("data/prompts.json");

// Configure the extension action icon to toggle/open the Side Panel on click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set sidePanel behavior:", error));

// Seed storage or handle lifecycle events on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

    if (details.reason === "install") {
      const response = await fetch(DEFAULT_PROMPTS_URL);
      const data = await response.json();
      const existing = await chrome.storage.local.get(["customPrompts", "variableDefaults"]);

      if (!existing.customPrompts) {
        await chrome.storage.local.set({ customPrompts: [] });
      }
      if (!existing.variableDefaults) {
        await chrome.storage.local.set({ variableDefaults: data.defaultVariables || {} });
      }
    }
  } catch (err) {
    console.error("Initialization error in background service worker:", err);
  }
});

