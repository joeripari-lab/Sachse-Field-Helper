// sidepanel.js - DOM handling, variable injection, clipboard copy, search & custom templates

const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_ -]+?)\s*\}\}/g;

const state = {
  categories: [],
  defaultVariables: {},
  globalOverrides: {},
  cardVariableState: {}, // { [promptId]: { [tokenName]: currentValue } }
  customPrompts: [],     // Saved in chrome.storage.local & synced when possible
  activeCategory: "all",
  searchQuery: ""
};

// DOM References
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const categoryTabsEl = document.getElementById("categoryTabs");
const promptsContainerEl = document.getElementById("promptsContainer");
const globalVarsGridEl = document.getElementById("globalVarsGrid");
const applyGlobalVarsBtn = document.getElementById("applyGlobalVarsBtn");
const resetGlobalVarsBtn = document.getElementById("resetGlobalVarsBtn");

// Builder Modal References
const openBuilderBtn = document.getElementById("openBuilderBtn");
const closeBuilderBtn = document.getElementById("closeBuilderBtn");
const cancelBuilderBtn = document.getElementById("cancelBuilderBtn");
const builderModal = document.getElementById("builderModal");
const builderModalTitle = document.getElementById("builderModalTitle");
const customPromptForm = document.getElementById("customPromptForm");
const customPromptIdInput = document.getElementById("customPromptId");
const customTitleInput = document.getElementById("customTitle");
const customCategorySelect = document.getElementById("customCategory");
const customTagsInput = document.getElementById("customTags");
const customTemplateTextarea = document.getElementById("customTemplate");
const customDefaultsTextarea = document.getElementById("customDefaults");
const quickTokenBar = document.getElementById("quickTokenBar");

/**
 * Storage Helpers (uses chrome.storage.local as primary with chrome.storage.sync backup)
 */
async function loadPersistedData() {
  try {
    const localData = await chrome.storage.local.get(["customPrompts", "variableDefaults"]);
    const syncData = await chrome.storage.sync.get(["customPrompts"]);

    const customPrompts =
      (Array.isArray(localData.customPrompts) && localData.customPrompts.length > 0)
        ? localData.customPrompts
        : (Array.isArray(syncData.customPrompts) ? syncData.customPrompts : []);

    return {
      customPrompts,
      variableDefaults: localData.variableDefaults || {}
    };
  } catch (err) {
    console.warn("Storage read fallback:", err);
    return { customPrompts: [], variableDefaults: {} };
  }
}

async function saveCustomPrompts(customPrompts) {
  state.customPrompts = customPrompts;
  await chrome.storage.local.set({ customPrompts });
  try {
    await chrome.storage.sync.set({ customPrompts });
  } catch (_) {
    // Ignore sync quota warnings if user has a large custom library; local storage is authoritative
  }
}

async function saveGlobalVariableOverrides(overrides) {
  state.globalOverrides = overrides;
  await chrome.storage.local.set({ variableDefaults: overrides });
}

/**
 * Extract unique {{Token}} names from a prompt template string
 */
function extractTokens(templateStr) {
  const tokens = [];
  const seen = new Set();
  let match;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(templateStr)) !== null) {
    const tokenName = match[1].trim();
    if (!seen.has(tokenName)) {
      seen.add(tokenName);
      tokens.push(tokenName);
    }
  }
  return tokens;
}

/**
 * Hydrate {{Token}} placeholders with live values from a map
 */
function hydrateTemplate(templateStr, valuesMap) {
  return templateStr.replace(TOKEN_REGEX, (_, rawToken) => {
    const key = rawToken.trim();
    const val = valuesMap[key];
    return val !== undefined && val !== "" ? val : `{{${key}}}`;
  });
}

/**
 * Escape HTML to safely render highlighted preview
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build HTML preview with highlighted hydrated values
 */
function buildHighlightedPreviewHtml(templateStr, valuesMap) {
  let lastIndex = 0;
  let html = "";
  TOKEN_REGEX.lastIndex = 0;
  let match;

  while ((match = TOKEN_REGEX.exec(templateStr)) !== null) {
    const before = templateStr.slice(lastIndex, match.index);
    html += escapeHtml(before);

    const key = match[1].trim();
    const hydratedVal =
      valuesMap[key] !== undefined && valuesMap[key] !== ""
        ? valuesMap[key]
        : `{{${key}}}`;
    html += `<span class="token-highlight" title="{{${escapeHtml(key)}}}">${escapeHtml(hydratedVal)}</span>`;

    lastIndex = TOKEN_REGEX.lastIndex;
  }

  html += escapeHtml(templateStr.slice(lastIndex));
  return html;
}

/**
 * Initialize or retrieve variable map for a specific prompt card
 */
function getCardValues(prompt) {
  if (!state.cardVariableState[prompt.id]) {
    const tokens = extractTokens(prompt.template);
    const initial = {};
    tokens.forEach((token) => {
      initial[token] =
        (prompt.variables && prompt.variables[token] !== undefined
          ? prompt.variables[token]
          : undefined) ??
        state.globalOverrides[token] ??
        state.defaultVariables[token] ??
        "";
    });
    state.cardVariableState[prompt.id] = initial;
  }
  return state.cardVariableState[prompt.id];
}

/**
 * Combine built-in categories with user custom prompts
 */
function getMergedCategories() {
  return state.categories.map((cat) => {
    const customForCat = state.customPrompts
      .filter((cp) => cp.categoryId === cat.id)
      .map((cp) => ({ ...cp, isCustom: true }));

    const mergedPrompts = cat.prompts.map((builtIn) => {
      // Allow editing/overriding built-in templates if desired, or keep custom first
      return { ...builtIn, isCustom: false };
    });

    return {
      ...cat,
      prompts: [...customForCat, ...mergedPrompts]
    };
  });
}

/**
 * Render Global Jobsite Default Variables Drawer
 */
function renderGlobalVariablesBar() {
  const coreKeys = ["Trade", "Subcontractor", "Location", "Weather", "Issue", "Impact"];
  globalVarsGridEl.innerHTML = "";

  coreKeys.forEach((key) => {
    const fieldWrap = document.createElement("div");
    fieldWrap.className = "var-field";

    const label = document.createElement("label");
    label.className = "var-label";
    label.textContent = `{{${key}}}`;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "var-input";
    input.dataset.globalKey = key;
    input.value = state.globalOverrides[key] ?? state.defaultVariables[key] ?? "";

    fieldWrap.appendChild(label);
    fieldWrap.appendChild(input);
    globalVarsGridEl.appendChild(fieldWrap);
  });
}

/**
 * Render Top Category Filter Pills
 */
function renderCategoryTabs() {
  const merged = getMergedCategories();
  const totalCount = merged.reduce((sum, c) => sum + c.prompts.length, 0);

  categoryTabsEl.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `category-tab ${state.activeCategory === "all" ? "active" : ""}`;
  allBtn.textContent = `All (${totalCount})`;
  allBtn.addEventListener("click", () => {
    state.activeCategory = "all";
    renderCategoryTabs();
    renderPrompts();
  });
  categoryTabsEl.appendChild(allBtn);

  merged.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `category-tab ${state.activeCategory === cat.id ? "active" : ""}`;
    btn.textContent = `${cat.badge || cat.name} (${cat.prompts.length})`;
    btn.title = cat.name;
    btn.addEventListener("click", () => {
      state.activeCategory = cat.id;
      renderCategoryTabs();
      renderPrompts();
    });
    categoryTabsEl.appendChild(btn);
  });
}

/**
 * Filter and render accordion sections & prompt cards
 */
function renderPrompts() {
  const query = state.searchQuery.trim().toLowerCase();
  const mergedCategories = getMergedCategories();
  promptsContainerEl.innerHTML = "";

  let visibleCardCount = 0;

  mergedCategories.forEach((category) => {
    if (state.activeCategory !== "all" && state.activeCategory !== category.id) {
      return;
    }

    const filteredPrompts = category.prompts.filter((prompt) => {
      if (!query) return true;
      const inTitle = prompt.title.toLowerCase().includes(query);
      const inTemplate = prompt.template.toLowerCase().includes(query);
      const inTags = (prompt.tags || []).some((t) => t.toLowerCase().includes(query));
      const inCategory = category.name.toLowerCase().includes(query);
      return inTitle || inTemplate || inTags || inCategory;
    });

    if (filteredPrompts.length === 0) {
      return;
    }

    visibleCardCount += filteredPrompts.length;

    const detailsEl = document.createElement("details");
    detailsEl.className = "category-section";
    detailsEl.open = true;

    const summaryEl = document.createElement("summary");
    summaryEl.className = "category-header";
    summaryEl.innerHTML = `
      <span class="category-header-title">
        <span class="category-badge">${escapeHtml(category.badge || "CAT")}</span>
        <span>${escapeHtml(category.name)}</span>
      </span>
      <span class="category-count">${filteredPrompts.length}</span>
    `;

    const cardsWrapper = document.createElement("div");
    cardsWrapper.className = "category-cards";

    filteredPrompts.forEach((prompt) => {
      const cardEl = buildPromptCardElement(prompt, category.id);
      cardsWrapper.appendChild(cardEl);
    });

    detailsEl.appendChild(summaryEl);
    detailsEl.appendChild(cardsWrapper);
    promptsContainerEl.appendChild(detailsEl);
  });

  if (visibleCardCount === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "empty-state";
    emptyEl.innerHTML = `
      <p><strong>No matching field templates found.</strong></p>
      <p style="margin-top:4px;font-size:12px;">Try clearing your search filter or click <strong>+ Custom</strong> to build a new template.</p>
    `;
    promptsContainerEl.appendChild(emptyEl);
  }
}

/**
 * Create a single Prompt Card with inline variable inputs, live preview, and one-click copy
 */
function buildPromptCardElement(prompt, categoryId) {
  const card = document.createElement("article");
  card.className = `prompt-card ${prompt.isCustom ? "is-custom" : ""}`;

  const tokens = extractTokens(prompt.template);
  const currentValues = getCardValues(prompt);

  // Header row
  const topRow = document.createElement("div");
  topRow.className = "card-top-row";

  const titleEl = document.createElement("h3");
  titleEl.className = "card-title";
  titleEl.textContent = prompt.title;
  topRow.appendChild(titleEl);

  const metaActions = document.createElement("div");
  metaActions.className = "card-meta-actions";

  if (prompt.isCustom) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-mini";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openBuilderForEdit(prompt, categoryId));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-mini danger";
    deleteBtn.textContent = "Del";
    deleteBtn.addEventListener("click", () => handleDeleteCustomPrompt(prompt.id));

    metaActions.appendChild(editBtn);
    metaActions.appendChild(deleteBtn);
  } else {
    const cloneBtn = document.createElement("button");
    cloneBtn.type = "button";
    cloneBtn.className = "btn-mini";
    cloneBtn.title = "Customize a copy of this template";
    cloneBtn.textContent = "Clone";
    cloneBtn.addEventListener("click", () =>
      openBuilderForEdit(
        {
          ...prompt,
          id: "",
          title: `${prompt.title} (Custom)`
        },
        categoryId
      )
    );
    metaActions.appendChild(cloneBtn);
  }

  topRow.appendChild(metaActions);
  card.appendChild(topRow);

  // Tag pills
  if ((prompt.tags && prompt.tags.length > 0) || prompt.isCustom) {
    const tagList = document.createElement("div");
    tagList.className = "tag-list";

    if (prompt.isCustom) {
      const customBadge = document.createElement("span");
      customBadge.className = "tag-pill custom-pill";
      customBadge.textContent = "CUSTOM";
      tagList.appendChild(customBadge);
    }

    (prompt.tags || []).forEach((tag) => {
      const pill = document.createElement("span");
      pill.className = "tag-pill";
      pill.textContent = `#${tag}`;
      tagList.appendChild(pill);
    });

    card.appendChild(tagList);
  }

  // Preview element (created early so variable inputs can update it live)
  const previewEl = document.createElement("div");
  previewEl.className = "prompt-preview";
  previewEl.innerHTML = buildHighlightedPreviewHtml(prompt.template, currentValues);

  // Inline Variable Inputs
  if (tokens.length > 0) {
    const varsBox = document.createElement("div");
    varsBox.className = "vars-box";

    const varsHeader = document.createElement("div");
    varsHeader.className = "vars-box-header";
    varsHeader.innerHTML = `<span>Inline Variables (${tokens.length})</span>`;
    varsBox.appendChild(varsHeader);

    const varsGrid = document.createElement("div");
    varsGrid.className = "vars-grid";

    tokens.forEach((tokenName) => {
      const field = document.createElement("div");
      const valStr = currentValues[tokenName] || "";
      const isLongField =
        valStr.length > 34 ||
        ["Issue", "Impact", "ActionRequired", "Hazard"].includes(tokenName);
      field.className = `var-field ${isLongField ? "full-width" : ""}`;

      const label = document.createElement("label");
      label.className = "var-label";
      label.textContent = `{{${tokenName}}}`;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "var-input";
      input.value = valStr;
      input.placeholder = `Enter ${tokenName}...`;

      input.addEventListener("input", (e) => {
        currentValues[tokenName] = e.target.value;
        previewEl.innerHTML = buildHighlightedPreviewHtml(prompt.template, currentValues);
      });

      field.appendChild(label);
      field.appendChild(input);
      varsGrid.appendChild(field);
    });

    varsBox.appendChild(varsGrid);
    card.appendChild(varsBox);
  }

  card.appendChild(previewEl);

  // One-Click Copy Button
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-copy";
  copyBtn.textContent = "📋 Copy Hydrated Prompt";

  copyBtn.addEventListener("click", async () => {
    const hydratedText = hydrateTemplate(prompt.template, currentValues);
    try {
      await navigator.clipboard.writeText(hydratedText);
      showCopyFeedback(copyBtn);
    } catch (err) {
      console.error("Clipboard write failed:", err);
    }
  });

  card.appendChild(copyBtn);
  return card;
}

/**
 * Visual Feedback on Copy (Turns green, displays "Copied!", reverts after 1.5s)
 */
function showCopyFeedback(buttonEl) {
  if (buttonEl.dataset.copyTimerId) {
    clearTimeout(Number(buttonEl.dataset.copyTimerId));
  }
  const originalLabel = "📋 Copy Hydrated Prompt";
  buttonEl.classList.add("copied");
  buttonEl.textContent = "✓ Copied!";

  const timerId = window.setTimeout(() => {
    buttonEl.classList.remove("copied");
    buttonEl.textContent = originalLabel;
    delete buttonEl.dataset.copyTimerId;
  }, 1500);

  buttonEl.dataset.copyTimerId = String(timerId);
}

/**
 * Custom Prompt Builder Modal Logic
 */
function openBuilderForNew() {
  builderModalTitle.textContent = "New Custom Field Template";
  customPromptIdInput.value = "";
  customTitleInput.value = "";
  customCategorySelect.value =
    state.activeCategory !== "all" ? state.activeCategory : "daily-logs";
  customTagsInput.value = "";
  customTemplateTextarea.value = "";
  customDefaultsTextarea.value = "";

  builderModal.hidden = false;
  builderModal.setAttribute("aria-hidden", "false");
  customTitleInput.focus();
}

function openBuilderForEdit(prompt, categoryId) {
  builderModalTitle.textContent = prompt.id
    ? "Edit Custom Field Template"
    : "Clone & Customize Template";
  customPromptIdInput.value = prompt.id || "";
  customTitleInput.value = prompt.title || "";
  customCategorySelect.value = categoryId || prompt.categoryId || "daily-logs";
  customTagsInput.value = (prompt.tags || []).join(", ");
  customTemplateTextarea.value = prompt.template || "";

  const varsObj = prompt.variables || {};
  const defaultsLines = Object.entries(varsObj).map(([k, v]) => `${k}=${v}`);
  customDefaultsTextarea.value = defaultsLines.join("\n");

  builderModal.hidden = false;
  builderModal.setAttribute("aria-hidden", "false");
  customTitleInput.focus();
}

function closeBuilderModal() {
  builderModal.hidden = true;
  builderModal.setAttribute("aria-hidden", "true");
}

function parseKeyValueLines(rawText) {
  const map = {};
  rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key) map[key] = val;
      }
    });
  return map;
}

async function handleDeleteCustomPrompt(promptId) {
  const updated = state.customPrompts.filter((cp) => cp.id !== promptId);
  delete state.cardVariableState[promptId];
  await saveCustomPrompts(updated);
  renderCategoryTabs();
  renderPrompts();
}

/**
 * Event Listeners & Initialization
 */
searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  clearSearchBtn.hidden = state.searchQuery.length === 0;
  renderPrompts();
});

clearSearchBtn.addEventListener("click", () => {
  state.searchQuery = "";
  searchInput.value = "";
  clearSearchBtn.hidden = true;
  searchInput.focus();
  renderPrompts();
});

applyGlobalVarsBtn.addEventListener("click", async () => {
  const inputs = globalVarsGridEl.querySelectorAll("input[data-global-key]");
  const updatedOverrides = { ...state.globalOverrides };

  inputs.forEach((inp) => {
    const key = inp.dataset.globalKey;
    updatedOverrides[key] = inp.value;
  });

  await saveGlobalVariableOverrides(updatedOverrides);

  // Push updated global values into all loaded cards that use those tokens
  Object.keys(state.cardVariableState).forEach((promptId) => {
    const cardMap = state.cardVariableState[promptId];
    Object.keys(updatedOverrides).forEach((tokenKey) => {
      if (tokenKey in cardMap) {
        cardMap[tokenKey] = updatedOverrides[tokenKey];
      }
    });
  });

  renderPrompts();
});

resetGlobalVarsBtn.addEventListener("click", async () => {
  state.cardVariableState = {};
  await saveGlobalVariableOverrides({ ...state.defaultVariables });
  renderGlobalVariablesBar();
  renderPrompts();
});

openBuilderBtn.addEventListener("click", openBuilderForNew);
closeBuilderBtn.addEventListener("click", closeBuilderModal);
cancelBuilderBtn.addEventListener("click", closeBuilderModal);

quickTokenBar.addEventListener("click", (e) => {
  const chip = e.target.closest(".token-chip");
  if (!chip) return;
  const token = chip.dataset.token;
  const start = customTemplateTextarea.selectionStart;
  const end = customTemplateTextarea.selectionEnd;
  const text = customTemplateTextarea.value;
  customTemplateTextarea.value = text.slice(0, start) + token + text.slice(end);
  customTemplateTextarea.focus();
  customTemplateTextarea.selectionStart = customTemplateTextarea.selectionEnd =
    start + token.length;
});

customPromptForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const existingId = customPromptIdInput.value.trim();
  const id = existingId || `custom-${Date.now()}`;
  const title = customTitleInput.value.trim();
  const categoryId = customCategorySelect.value;
  const tags = customTagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const template = customTemplateTextarea.value.trim();
  const variables = parseKeyValueLines(customDefaultsTextarea.value);

  if (!title || !template) return;

  const newPromptObj = {
    id,
    title,
    categoryId,
    tags,
    template,
    variables
  };

  const nextCustom = existingId
    ? state.customPrompts.map((cp) => (cp.id === existingId ? newPromptObj : cp))
    : [newPromptObj, ...state.customPrompts];

  // Reset cached card state for this prompt so updated defaults take effect immediately
  delete state.cardVariableState[id];

  await saveCustomPrompts(nextCustom);
  closeBuilderModal();
  renderCategoryTabs();
  renderPrompts();
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !builderModal.hidden) {
    closeBuilderModal();
  }
});

// Bootstrap application
async function initApp() {
  try {
    const response = await fetch(chrome.runtime.getURL("data/prompts.json"));
    const data = await response.json();

    state.categories = data.categories || [];
    state.defaultVariables = data.defaultVariables || {};

    const persisted = await loadPersistedData();
    state.customPrompts = persisted.customPrompts;
    state.globalOverrides = {
      ...state.defaultVariables,
      ...persisted.variableDefaults
    };

    renderGlobalVariablesBar();
    renderCategoryTabs();
    renderPrompts();
  } catch (err) {
    console.error("Failed to initialize Superintendent Field Assistant:", err);
    promptsContainerEl.innerHTML = `
      <div class="empty-state">
        <p><strong>Error loading prompt library.</strong></p>
        <p style="font-size:12px;margin-top:4px;">Verify <code>data/prompts.json</code> is present in the extension folder.</p>
      </div>
    `;
  }
}

initApp();

