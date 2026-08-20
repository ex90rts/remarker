# Fetch LLM Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type an LLM model name or fetch and select one from the configured OpenAI-compatible provider.

**Architecture:** Add a small shared parser for the standard models response, expose a runtime message handled by the service worker so API keys and cross-origin requests stay out of page UI code, and render the model field with MUI `Autocomplete` in `freeSolo` mode. Reuse the existing settings state and Toast error channel.

**Tech Stack:** TypeScript, React, Material UI 7, Chrome MV3 runtime messaging, Vitest.

---

### Task 1: Model-list response parser

**Files:**
- Create: `src/shared/llm-models.ts`
- Test: `src/shared/__tests__/llm-models.test.ts`

- [x] Write tests covering standard `{ data: [{ id }] }`, duplicate/blank IDs, and malformed responses.
- [x] Run `npm test -- src/shared/__tests__/llm-models.test.ts` and confirm the tests fail before implementation.
- [x] Implement endpoint construction and a strict, sorted, deduplicated model-ID parser.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Service-worker models request

**Files:**
- Modify: `src/shared/messages.ts`
- Modify: `src/background/service-worker.ts`

- [x] Add a `GET_LLM_MODELS` runtime message carrying the unsaved settings form value.
- [x] Validate Base URL and API Key, call `GET {baseUrl}/models` with Bearer authentication and the configured timeout, and reuse the existing HTTP error parser.
- [x] Return parsed model IDs; emit explicit timeout, network, malformed-response, and empty-list errors.

### Task 3: Editable model selector and fetch action

**Files:**
- Modify: `src/options/App.tsx`
- Modify: `src/shared/i18n/en.ts`
- Modify: `src/shared/i18n/es.ts`
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/zh-TW.ts`

- [x] Extend `SettingsField` with an optional right-aligned label action.
- [x] Add model-list/loading state and validate Base URL/API Key before sending `GET_LLM_MODELS`.
- [x] Add localized loading, success, incomplete-configuration, empty-list, and request-failure messages.
- [x] Replace the model `TextField` with a controlled `Autocomplete` using `freeSolo`, preserving arbitrary manual model input.
- [x] Render “获取模型” as the label-row action and disable it while the request is active.

### Task 4: Verification

**Files:**
- Verify all modified files.

- [x] Run `npm test` and confirm all tests pass.
- [x] Run `npm run typecheck` and confirm it exits successfully.
- [x] Run `npm run build` and confirm both extension bundles build and content-bundle verification passes.
- [x] Run `git diff --check` and confirm no whitespace errors.
