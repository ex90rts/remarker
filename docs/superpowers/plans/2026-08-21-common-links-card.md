# Common Links Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable, persisted common-links card to the right of Today's Review on the Footprints page, with background page-title lookup and at most ten links.

**Architecture:** Store normalized links in `AppSettings.ui.commonLinks` so they participate in the existing settings backup without appearing on the Settings page. The Footprints card edits all links together in one modal dialog and sends focused runtime messages; the service worker owns persistence and guarded cross-origin title fetching. Shared pure helpers define defaults, normalization, URL validation, and HTML-title extraction.

**Tech Stack:** React 19, Material UI 7, TypeScript, Chrome Manifest V3 service worker, IndexedDB settings repository, Vitest.

---

### Task 1: Common-link domain model and persistence

**Files:**
- Create: `src/shared/common-links.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/repositories/db.ts`
- Test: `src/shared/__tests__/common-links.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Cover the seven ordered defaults, HTTP(S)-only URL validation, ten-link truncation, malformed-entry filtering, and `<title>` extraction/entity decoding.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/shared/__tests__/common-links.test.ts`

Expected: FAIL because `../common-links` does not exist.

- [ ] **Step 3: Add the shared model and helpers**

Define:

```ts
export interface CommonLink { url: string; text: string }
export const MAX_COMMON_LINKS = 10;
export const DEFAULT_COMMON_LINKS: CommonLink[] = [/* seven product defaults */];
export function isValidCommonLinkUrl(value: string): boolean;
export function normalizeCommonLinks(value: unknown): CommonLink[];
export function extractHtmlTitle(html: string): string | undefined;
```

Add `commonLinks: CommonLink[]` to `UiPreferences`, initialize it in `DEFAULT_SETTINGS`, and normalize legacy or malformed settings with `normalizeCommonLinks` in `normalizeSettings`.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/shared/__tests__/common-links.test.ts`

Expected: PASS.

### Task 2: Focused service-worker messages

**Files:**
- Modify: `src/shared/messages.ts`
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Add minimal runtime contracts**

Add messages equivalent to:

```ts
| { type: "UPDATE_COMMON_LINKS"; links: CommonLink[] }
| { type: "FETCH_LINK_TITLE"; url: string }
```

- [ ] **Step 2: Persist links without stale whole-settings writes**

For `UPDATE_COMMON_LINKS`, load the latest settings, replace only `ui.commonLinks`, save normalized settings, and return the persisted list.

- [ ] **Step 3: Implement guarded background title lookup**

Validate HTTP(S), fetch with omitted credentials and an abort timeout, reject non-HTML responses, read only a bounded leading response segment, extract the title through the shared helper, and return `{ title?: string }`. Lookup failures should return no title rather than disrupting editing.

### Task 3: Footprints-page card, configuration, and layout

**Files:**
- Modify: `src/options/App.tsx`
- Modify: `src/options/pages/FootprintsPage.tsx`
- Modify: `src/shared/i18n/en.ts`
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/zh-TW.ts`
- Modify: `src/shared/i18n/es.ts`

- [ ] **Step 1: Pass common-link settings into Footprints**

Pass `overview.settings.ui.commonLinks` into `FootprintsTab`; save through `UPDATE_COMMON_LINKS` and call the existing `reload` path after success.

- [ ] **Step 2: Build the compact card**

Place `CommonLinksCard` after `TodayReviewCard`. Its header shows the localized title on the left and a gear `IconButton` on the right; its body renders safe external links and an empty state.

- [ ] **Step 3: Build in-card configuration**

Open a card-owned Material UI modal dialog from the gear. Render all controlled URL/text rows together with delete actions, add-row support up to ten, URL validation, cancel/save actions, and a loading affordance during title lookup. On URL blur, send `FETCH_LINK_TITLE` and fill an empty text field when a title is returned.

Each row also exposes a native HTML drag handle plus accessible move-up and move-down buttons. Reordering updates only the modal draft array until the user saves, and the existing ordered `commonLinks` array persists the result without a schema change.

- [ ] **Step 4: Rebalance the summary row**

Change the heatmap from four rows to five, keep cells compact, narrow Today's Review from 248px to about 198px, and give the new card a compact fixed width. Preserve stacked responsive behavior at narrow widths.

- [ ] **Step 5: Add all locale copy**

Add card title, URL/text labels, add/delete/save/cancel, maximum-count, invalid-URL, and empty-state copy to all four locale files.

### Task 4: Verification and requirement review

**Files:**
- Verify all modified files

- [ ] **Step 1: Run type checking**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Build the extension**

Run: `npm run build`

Expected: TypeScript, both Vite builds, and content-bundle verification all exit 0.

- [ ] **Step 4: Review the final diff against the specification**

Confirm: card order is heatmap → review → common links; heatmap is five rows; review width is about 20% smaller; defaults match the requested seven links; config is card-owned; title lookup is background GET on URL blur; links are editable/deletable and capped at ten; all locale shapes remain consistent.
