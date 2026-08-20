# AGENTS.md

## Project Overview

Remarker is a Chrome Manifest V3 browser extension for foreign-language reading and learning. It lets users highlight useful passages, ask an OpenAI-compatible LLM to explain selected words or translate selected text, automatically save word lookups to a vocabulary list, keep a page footprint list, and restore saved highlights and vocabulary markers when the user revisits a page.

## Tech Stack

- Build: Vite + TypeScript
- Options page: React + Material UI
- Content script: plain TypeScript DOM APIs + Shadow DOM
- Popup: plain HTML/CSS/TypeScript
- Background: Manifest V3 service worker
- Storage: IndexedDB for durable app data, `chrome.storage.local` for lightweight startup/site state
- Tests: Vitest

## Common Commands

Run commands from the project root:

```sh
npm run typecheck
npm test
npm run build
```

Use `npm run build` before considering larger UI or extension-behavior changes complete.

## Discovery Rules

- Prefer codebase-memory MCP graph tools when this repository is indexed.
- If the graph is unavailable or incomplete, use `rg` and `rg --files`.
- Read existing local patterns before adding abstractions.
- Keep changes scoped. This project has several moving pieces, so avoid broad refactors unless the user explicitly asks for them.

## Architecture Notes

- `src/content/index.ts` owns page selection, floating toolbar/panel UI, highlight wrapping, lookup underlines, text anchors, and page restore behavior.
- `src/background/service-worker.ts` owns extension messages, LLM calls, pronunciation lookup, footprint aggregation, vocabulary persistence, and IndexedDB writes.
- `src/options/App.tsx` owns the management page: footprints, highlights, vocabulary, settings, import/export, toast feedback, and about content.
- `src/popup/popup.ts` owns quick reading controls: global enablement, current-site enablement, lookup-popup auto-close, add-to-footprints, and management-page launch.
- `src/shared/types.ts` is the source of truth for persisted records and settings.
- `src/shared/messages.ts` is the runtime message contract between content scripts, popup/options, and the service worker.
- `src/shared/repositories/db.ts` normalizes settings and wraps IndexedDB access.
- `src/shared/i18n/*` contains UI copy. Add new user-visible management-page copy to all locale files.

## Product Rules

- Prompt validation requires `{{selection}}`, and `{{context}}`.
- The UI language is also the LLM translation target language.
- Word lookups are automatically saved to the vocabulary list.
- Word lookup records and lookup results must only be persisted in `vocabulary`; do not add an `explanations` store or parallel lookup table.
- Text translations are displayed immediately and are not persisted.
- Pages enter footprints when the user saves a highlight, creates a word lookup, or manually adds the current page from the popup.
- Footprints are unique by normalized URL key, sorted by creation time descending in the management page, and support star/archive actions.
- Page restore must be conservative: if a saved text anchor cannot be uniquely matched, do not insert a marker in the wrong place.
- Vocabulary underlines should first use saved anchor information; context-sentence fallback is allowed for lookup records when anchor matching fails or is ambiguous.

## UI Rules

- The management page uses Material UI and lucide-react icons.
- Use the custom centered Toast component for management-page success/error feedback. Do not use browser alerts for normal operations.
- Keep table actions centered when the column is an action column.
- Highlights and vocabulary tables share the configured records page size.
- Footprints, highlights, and vocabulary tables share the configured records page size.
- Prefer compact, utilitarian management UI. Avoid landing-page patterns in operational views.

## Data And Export Rules

- Highlight and vocabulary Markdown exports live in the relevant table action bars, not in Settings.
- Backup JSON excludes sensitive settings by default.
- Backup JSON includes footprints, highlights, vocabulary, and settings.
- Import/export should preserve the current record shapes without forcing migrations unless the schema changes.

## Safety Notes

- Never revert unrelated user changes in the working tree.
- Add optional fields to persisted records without bumping IndexedDB schema when old records can remain valid.
- Keep LLM API keys out of content scripts and page DOM. The service worker should read settings and make model requests.
- When adding settings, normalize missing or invalid values in `normalizeSettings`.
