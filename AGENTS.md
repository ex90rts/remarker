# AGENTS.md

## Project Overview

Remarker is a Chrome Manifest V3 browser extension for foreign-language reading and learning. It lets users highlight useful passages, ask an OpenAI-compatible LLM to explain selected words or translate selected text, automatically save word lookups to a vocabulary list, and restore saved highlights and vocabulary markers when the user revisits a page.

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
- `src/background/service-worker.ts` owns extension messages, LLM calls, pronunciation lookup, vocabulary/explanation merging, and IndexedDB writes.
- `src/options/App.tsx` owns the management page: highlights, vocabulary, settings, import/export, toast feedback, and about content.
- `src/shared/types.ts` is the source of truth for persisted records and settings.
- `src/shared/messages.ts` is the runtime message contract between content scripts, popup/options, and the service worker.
- `src/shared/repositories/db.ts` normalizes settings and wraps IndexedDB access.
- `src/shared/i18n/*` contains UI copy. Add new user-visible management-page copy to all locale files.

## Product Rules

- Prompt validation requires `{{task}}`, `{{selection}}`, and `{{context}}`.
- The UI language is also the LLM translation target language.
- Word lookups are automatically saved to the vocabulary list.
- Page restore must be conservative: if a saved text anchor cannot be uniquely matched, do not insert a marker in the wrong place.
- Vocabulary underlines must use saved anchor information, not full-page word scanning.

## UI Rules

- The management page uses Material UI and lucide-react icons.
- Use the custom centered Toast component for management-page success/error feedback. Do not use browser alerts for normal operations.
- Keep table actions centered when the column is an action column.
- Highlights and vocabulary tables share the configured records page size.
- Prefer compact, utilitarian management UI. Avoid landing-page patterns in operational views.

## Data And Export Rules

- Highlight and vocabulary Markdown exports live in the relevant table action bars, not in Settings.
- Backup JSON excludes sensitive settings by default.
- Import/export should preserve the current record shapes without forcing migrations unless the schema changes.

## Safety Notes

- Never revert unrelated user changes in the working tree.
- Add optional fields to persisted records without bumping IndexedDB schema when old records can remain valid.
- Keep LLM API keys out of content scripts and page DOM. The service worker should read settings and make model requests.
- When adding settings, normalize missing or invalid values in `normalizeSettings`.

<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
