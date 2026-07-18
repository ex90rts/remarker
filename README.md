[English](README.md) | [简体中文](README.zh-CN.md)

# ReMarker - AI Reading Assistant and Vocabulary Builder

ReMarker is a local-first Chrome extension for deep web reading, language learning, contextual AI word lookup, and personal study notes. It lets readers highlight important passages, explain unfamiliar words and phrases with an OpenAI-compatible model, save vocabulary automatically, keep a page footprint list, and restore highlights and vocabulary underlines when revisiting the same page.

ReMarker is useful for students, researchers, engineers, and language learners who read foreign-language articles, documentation, essays, papers, or long-form web content and want a private, repeatable workflow for understanding, collecting, and reviewing what they read.

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-01.webp" alt="截图" width="80%">
</div>

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-04.webp" alt="截图" width="80%">
</div>

## Why ReMarker

- It connects reading and vocabulary learning in one flow instead of splitting highlights, dictionary lookup, and review into separate tools.
- It explains words and phrases using the surrounding sentence or paragraph, so the answer is grounded in the page you are reading.
- It automatically turns AI lookup results into vocabulary records, reducing manual note taking.
- It restores previous highlights and vocabulary marks on page revisit, making web reading cumulative.
- It keeps pages that have been highlighted, looked up, or manually added in one footprint list.
- It keeps the database local by default and makes export explicit.

## Core Features

- Web page highlights: Highlight and save important passages on web pages, then view, filter, delete, and export them from the options page.
- Contextual AI word lookup: Select a word or phrase and call an OpenAI-compatible LLM to explain its meaning based on the surrounding context.
- Automatic vocabulary list: Save lookup results as vocabulary records automatically, including source URL, page title, context sentence, and explanation.
- Page revisit restoration: Reopen a page to restore previous highlights and vocabulary underlines, with vocabulary lookup results available in place.
- Footprints: View pages that were highlighted, looked up, or manually added, with page title, site name, creation time, highlight count, vocabulary count, star, and archive actions.
- Popup quick controls: Toggle global page highlighting and lookup, toggle the current site, enable automatic lookup-popup closing after copy, add the current page to footprints, and open the management page.
- Pronunciation fallback chain: Use Merriam-Webster audio, Free Dictionary audio, and browser speech synthesis as fallbacks.
- Data import and export: Export highlights and vocabulary to Markdown, and import or export key app data as JSON.
- Multilingual interface: Use the UI language as the target language for AI word lookups and translations.
- Site-level control: Enable or disable ReMarker per site and keep reading preferences configurable.

## Installation and Local Development

Install dependencies:

```sh
npm install
```

Type check:

```sh
npm run typecheck
```

Run tests:

```sh
npm test
```

Build the extension:

```sh
npm run build
```

The build output is written to `dist/`. To load ReMarker locally, open the Chrome extensions page, enable developer mode, choose "Load unpacked", and select the `dist/` directory.

## Configuration

Configure the following in the Settings page:

- LLM provider preset or custom OpenAI-compatible endpoint.
- OpenAI-compatible `baseUrl`.
- API key.
- Model name.
- `temperature`.
- Request timeout.
- Prompt template.
- Merriam-Webster API key.
- Default highlight color.
- Page size for highlights and vocabulary.
- Disabled site list and import/export preferences.

Configure quick reading behavior in the extension popup:

- Global page highlighting and word lookup.
- Current-site page highlighting and word lookup.
- Automatically close the lookup popup after copying.
- Add the current page to footprints.

Provider presets currently include DeepSeek, OpenRouter, Gemini, Z.ai/GLM, Alibaba DashScope, ByteDance Volcengine, and custom OpenAI-compatible endpoints.

The prompt template must include these variables:

```txt
{{task}}
{{selection}}
{{context}}
```

## Data and Privacy

ReMarker is local-first: footprints, highlights, vocabulary, translation records, and settings are stored in the browser's IndexedDB by default. The LLM API key is read and used by the extension background service worker and is not written into the page DOM.

When an AI lookup or translation is requested, the selected text and surrounding context are sent to the configured LLM endpoint so the model can answer in context. JSON exports exclude sensitive configuration by default and include it only when the user explicitly opts in.

## FAQ

### What is ReMarker?

ReMarker is a Chrome-compatible browser extension for highlighting web pages, explaining selected words or phrases with AI, saving vocabulary, and restoring reading notes when pages are revisited.

### Who is ReMarker for?

ReMarker is for language learners, researchers, students, developers, and heavy web readers who want to turn online reading into a searchable study and review workflow.

### Does ReMarker require an AI provider?

AI word lookup and translation require a configured OpenAI-compatible provider or custom endpoint. Highlighting, local records, and export workflows are part of the extension itself.

### Where does ReMarker store data?

ReMarker stores app data locally in browser IndexedDB by default. Users can export footprints, highlights, vocabulary, translations, and selected app data when needed.

### Which languages does ReMarker support?

The interface supports English, Simplified Chinese, Traditional Chinese, and Spanish. The selected interface language is also used as the target language for AI word lookups and translations.

## Tech Stack

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI options page
- Plain TypeScript content script with Shadow DOM
- IndexedDB local storage
- Vitest

## Roadmap

- Add a vocabulary review schedule based on the forgetting curve, turning the vocabulary list from a lookup log into a sustainable learning tool.
- Online sync: Support syncing highlights and vocabulary across devices.
