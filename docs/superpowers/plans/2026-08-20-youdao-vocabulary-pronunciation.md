# Youdao Vocabulary Pronunciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every pronunciation action on the Vocabulary page with a shared Youdao MP3 player and hide pronunciation controls for non-English entries.

**Architecture:** Add one shared browser-side utility that validates English words, constructs the encoded Youdao dictionary voice URL, and plays it with `Audio`. Reuse the existing `isSingleEnglishWord` predicate in both the utility and the Vocabulary table/review render paths so UI policy and playback validation stay consistent.

**Tech Stack:** TypeScript, React, Material UI, Vitest, Chrome Manifest V3

---

### Task 1: Shared pronunciation utility

**Files:**
- Create: `src/shared/pronunciation.ts`
- Create: `src/shared/__tests__/pronunciation.test.ts`

- [x] **Step 1: Write URL and validation tests**

Test that an English word produces `http://dict.youdao.com/dictvoice?audio=...&type=2`, reserved characters are encoded, and non-English text is rejected.

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/shared/__tests__/pronunciation.test.ts`

Expected: FAIL because the utility module does not exist.

- [x] **Step 3: Implement the minimal shared utility**

Expose `getPronunciationAudioUrl(word)` and `playPronunciation(word)`. Keep URL construction in one place, validate with `isSingleEnglishWord`, and propagate `HTMLMediaElement.play()` failures to the existing action error handler.

- [x] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/shared/__tests__/pronunciation.test.ts`

Expected: all pronunciation utility tests pass.

### Task 2: Vocabulary UI integration

**Files:**
- Modify: `src/options/App.tsx`

- [x] **Step 1: Replace the Vocabulary table playback action**

Call `playPronunciation(item.word)` and render its audio cell/button only when `isSingleEnglishWord(item.word)` is true. Preserve the table column for stable alignment.

- [x] **Step 2: Replace the Vocabulary review playback action**

Call the same utility and omit the speak button for non-English review records.

- [x] **Step 3: Remove obsolete options-page pronunciation messaging**

Remove `PronunciationResult` and the local `speakWord` helper from `App.tsx`; leave the background pronunciation contract intact because content-script lookup and vocabulary enrichment still use it.

### Task 3: Verification

**Files:**
- Verify: `src/shared/pronunciation.ts`
- Verify: `src/options/App.tsx`

- [x] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all tests pass.

- [x] **Step 2: Run TypeScript validation**

Run: `npm run typecheck`

Expected: exit code 0.

- [x] **Step 3: Build the extension**

Run: `npm run build`

Expected: all Vite builds and the content-bundle verification succeed.

### Task 4: Persist Youdao audio in the existing IndexedDB cache

**Files:**
- Modify: `src/shared/messages.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/pronunciation.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/shared/__tests__/pronunciation.test.ts`

- [x] **Step 1: Add a dedicated runtime request for Youdao audio**

Add `GET_YOUDAO_PRONUNCIATION` to the shared message contract and allow `youdao` as an audio-cache provider without changing the existing lookup-enrichment fallback order.

- [x] **Step 2: Fetch and cache the MP3 in the service worker**

Use the existing normalized cache-key, Blob size limit, `getAudioCache`, `saveAudioCache`, and Blob-to-data-URL paths. Return cached Blob data on repeat requests and update `lastAccessedAt`.

- [x] **Step 3: Make the shared player request cached audio**

Have `playPronunciation` ask the service worker for the cached result, prefer `audioDataUrl`, and retain `audioUrl` only as the existing network fallback.

- [x] **Step 4: Verify the cache integration**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests, TypeScript validation, Vite builds, and bundle verification pass.
