# Settings Card Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Settings into three independently actionable cards and remove obsolete pronunciation configuration now that Youdao audio is fixed.

**Architecture:** Keep one local settings draft but persist only the slice owned by the clicked card, preventing preference saves from persisting unfinished LLM edits and vice versa. Remove pronunciation settings from the persisted schema and normalize legacy backups by ignoring that obsolete property; route English pronunciation through the existing cached Youdao path.

**Tech Stack:** React 19, Material UI 7.2, TypeScript, Chrome Manifest V3, IndexedDB, Vitest

---

### Task 1: Remove pronunciation configuration

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/repositories/db.ts`
- Modify: `src/shared/export.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/shared/__tests__/export.test.ts`
- Modify: `README.md`

- [x] Remove `PronunciationConfig`, its default value, normalization, export sanitization, tests, and Merriam-Webster request logic.
- [x] Route current English audio through cached Youdao and remove obsolete provider branches.

### Task 2: Build three independent settings cards

**Files:**
- Modify: `src/options/App.tsx`

- [x] Put language, page size, highlight color, and disabled sites in the first “Usage preferences” card.
- [x] Put all provider, connection test, model, generation, and prompt controls in the second “LLM configuration” card.
- [x] Put backup export, incremental export, and import actions in the third “Import / Export” card.
- [x] Give preferences and LLM cards independent save handlers that persist only their owned settings slice.

### Task 3: Update localized copy

**Files:**
- Modify: `src/shared/i18n/en.ts`
- Modify: `src/shared/i18n/es.ts`
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/zh-TW.ts`

- [x] Remove pronunciation labels and rename the two configuration card headings in every locale.

### Task 4: Verify

- [x] Run `npm test` and confirm all tests pass.
- [x] Run `npm run typecheck` and confirm exit code 0.
- [x] Run `npm run build` and confirm all extension bundles pass verification.
