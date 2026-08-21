# Options Page Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the oversized options-page `App.tsx` into focused management-page modules while preserving all behavior.

**Architecture:** Keep `App.tsx` as the application shell and navigation coordinator. Move each management view into its own module, place reusable React UI in `components.tsx`, shared hooks in `hooks.ts`, shared contracts in `types.ts`, and reusable non-React helpers in `utils.ts`.

**Tech Stack:** React 19, Material UI 7, TypeScript, Chrome Extension APIs, Vitest.

---

### Task 1: Establish shared options-page modules

**Files:**
- Create: `src/options/types.ts`
- Create: `src/options/utils.ts`
- Create: `src/options/hooks.ts`
- Create: `src/options/components.tsx`
- Modify: `src/options/App.tsx`

- [ ] Move cross-page callback and navigation types into `types.ts`.
- [ ] Move reusable non-JSX helpers and Chrome message handling into `utils.ts`.
- [ ] Move reusable server-query hooks into `hooks.ts`.
- [ ] Move shared table controls, confirmation controls, Toast, common styles, and context rendering into `components.tsx`.
- [ ] Run `npm run typecheck`; expect exit code 0.

### Task 2: Split management pages by responsibility

**Files:**
- Create: `src/options/pages/FootprintsPage.tsx`
- Create: `src/options/pages/HighlightsPage.tsx`
- Create: `src/options/pages/VocabularyPage.tsx`
- Create: `src/options/pages/SettingsPage.tsx`
- Create: `src/options/pages/AboutPage.tsx`
- Modify: `src/options/App.tsx`

- [ ] Move the activity summary and footprints table into `FootprintsPage.tsx`.
- [ ] Move highlights, highlight details, and reading-analysis dialog into `HighlightsPage.tsx`.
- [ ] Move vocabulary/translation tables and review flow into `VocabularyPage.tsx`.
- [ ] Move settings forms, onboarding copy, import/export, and provider controls into `SettingsPage.tsx`.
- [ ] Move release and project information into `AboutPage.tsx`.
- [ ] Import the page components from `App.tsx`, leaving only app-level state, sidebar navigation, and page orchestration.

### Task 3: Verify behavior-preserving refactor

**Files:**
- Test: `src/shared/__tests__/*.test.ts`

- [ ] Run `npm run typecheck`; expect exit code 0.
- [ ] Run `npm test`; expect all existing tests to pass.
- [ ] Run `npm run build`; expect both extension bundles and bundle verification to succeed.
- [ ] Run `git diff --check`; expect no whitespace errors.
- [ ] Confirm `App.tsx` is materially smaller and each new page file has one clear management-page responsibility.
