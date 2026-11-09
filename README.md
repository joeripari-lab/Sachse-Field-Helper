# Sachse Construction — Superintendent Field Assistant (Manifest V3)

A high-contrast, jobsite-ready browser Side Panel extension styled strictly to the **Sachse Construction Brand Guidelines** (Page 9 Crest Overlay Specification & Page 11 Color Spectrum). Replaces the legacy `Scotts_Assistant.ps1` WinForms script for superintendents working in **Procore**, **PlanGrid / Autodesk Build**, **Outlook / Gmail**, and **Microsoft Copilot**.

## Sachse Brand Alignment
- **Official Crest**: Embedded vector Sachse Crest in the `Structural Blue` header following the *Overlay on Dark/Green Imagery* specification (`#949300` Field Green outer border, `#B7BF10` Foundation Green field, `#FFFFFF` inner frame and S-curve).
- **Primary Color Palette**:
  - **Structural Blue** (`#0B3B4A`) — Primary headers, accordion bars, and action buttons
  - **Foundation Green** (`#B7BF10`) — Brand rules, active category tabs, custom badges, and focus rings
  - **Base Black** (`#2B2623` / Pantone Black C2) — High-contrast body copy and neutral tint scale
- **Secondary Color Palette**:
  - **Iron Teal** (`#007F6F`) — Card accent borders and `"Copied!"` confirmation state
  - **Field Green** (`#949300`) — Variable drawer accents and token highlights
  - **Evergreen** (`#245B4E`), **Steel Blue** (`#48848D`), **Shaded Green** (`#5B6135`), and **Stone Gray** (`#8E9191`)

## Files Included
- [manifest.json](file:///c:/Users/jripari/Git-Sachse/Sachse%20Field%20Helper/manifest.json) — Manifest V3 configuration (`sidePanel`, `clipboardWrite`, `storage`).
- [background.js](file:///c:/Users/jripari/Git-Sachse/Sachse%20Field%20Helper/background.js) — Service worker configuring `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
- [sidepanel.html](file:///c:/Users/jripari/Git-Sachse/Sachse%20Field%20Helper/sidepanel.html) — Main side panel layout with the Sachse Crest SVG, sticky search, category tabs, global jobsite variable drawer, and custom template builder.
- [sidepanel.css](file:///c:/Users/jripari/Git-Sachse/Sachse%20Field%20Helper/sidepanel.css) — Full Sachse Construction color spectrum and architectural typography.
- [sidepanel.js](file:///c:/Users/jripari/Git-Sachse/Sachse%20Field%20Helper/sidepanel.js) — Dynamic `{{Token}}` hydration, one-click clipboard copy, instant search, and `chrome.storage` persistence.
- [data/prompts.json](file:///c:/Users/jripari/Git-Sachse/Sachse%20Field%20Helper/data/prompts.json) — Complete prompt library across all 5 superintendent categories plus all original `Scotts_Assistant.ps1` templates.
