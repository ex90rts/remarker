# Business LLM Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split model, Temperature, timeout, and prompt configuration by LLM business while retaining a provider-level general model fallback.

**Architecture:** Add normalized `businesses` settings for lookup, translation, and analysis without changing the IndexedDB schema version. Resolve an effective model at the shared type boundary, then use that resolved business configuration consistently for cache identity and API requests. Keep provider credentials and the general model at the provider level.

**Tech Stack:** TypeScript, React 19, Material UI 7, IndexedDB, Vitest

---

### Task 1: Define and test business configuration behavior

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/__tests__/prompt-template.test.ts`

- [x] **Step 1: Add failing tests for the three defaults and model fallback**

Assert lookup/translation use Temperature `0.2`, analysis uses `0.5`, every timeout is `30000`, and a blank business model resolves to the provider's general model while a non-blank override wins.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/shared/__tests__/prompt-template.test.ts`
Expected: FAIL because business configuration helpers do not exist.

- [x] **Step 3: Add the business types, defaults, normalization, and effective resolver**

Add `LlmBusinessConfig`, `LlmBusinessConfigs`, `createDefaultLlmBusinessConfigs`, and `getEffectiveLlmBusinessConfig`. Store an empty string for an optional override and resolve it to the active provider model.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/shared/__tests__/prompt-template.test.ts`
Expected: PASS.

### Task 2: Normalize legacy settings and use business settings at runtime

**Files:**
- Modify: `src/shared/repositories/db.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/shared/reading-analysis.ts`

- [x] **Step 1: Normalize old global values into the new business map**

Map a legacy Temperature to lookup and translation, preserve analysis at `0.5`, and map a legacy timeout to all three businesses. Normalize partial or invalid imported values back to safe defaults.

- [x] **Step 2: Resolve the correct business config for every API call**

Use lookup settings for word selection, translation settings for text selection, and analysis settings for reading analysis. Include the effective business model in vocabulary cache identity and persisted model identity.

- [x] **Step 3: Keep provider test/model-list timeouts internal**

Use the shared default timeout for connection tests and model-list fetching because those operations are provider setup rather than a user business.

### Task 3: Rebuild the advanced settings UI around the business tabs

**Files:**
- Modify: `src/options/pages/SettingsPage.tsx`
- Modify: `src/shared/i18n/en.ts`
- Modify: `src/shared/i18n/es.ts`
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/zh-TW.ts`

- [x] **Step 1: Rename the provider-level field to General model**

Keep model fetching and free-form entry on the provider-level field, but label it as the localized equivalent of “通用模型”.

- [x] **Step 2: Place all four business fields inside each tab**

Render fields in this order: optional model override, Temperature, timeout, prompt template. Reuse fetched model options and explain that a blank override uses the general model.

- [x] **Step 3: Preserve prompt validation and restore-default behavior**

Keep non-empty system-prompt validation tied to the relevant business tab.

### Task 4: Verify the integrated change

**Files:**
- Verify only

- [x] **Step 1: Run type checking**

Run: `npm run typecheck`
Expected: exits `0`.

- [x] **Step 2: Run all tests**

Run: `npm test`
Expected: exits `0` with all tests passing.

- [x] **Step 3: Build the extension**

Run: `npm run build`
Expected: exits `0` and content-bundle verification passes.
