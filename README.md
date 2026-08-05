[English](README.md) | [简体中文](README.zh-CN.md)

# ReMarker — AI Reading Assistant and Vocabulary Builder

ReMarker is a local-first Chrome extension for focused web reading and language learning. Select text to copy, search, pronounce, explain, translate, or highlight it; ReMarker keeps the resulting highlights, notes, vocabulary, translations, and page footprints organized for later review.

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-01.webp" alt="ReMarker reading tools" width="80%" style="border: 1px solid #ddd; padding: 4px; display: inline-block; border-radius: 4px;">
</div>

<br />

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-04.webp" alt="ReMarker management page" width="80%" style="border: 1px solid #ddd; padding: 4px; display: inline-block; border-radius: 4px;">
</div>

**Install it via the Chrome Web Store**: https://chromewebstore.google.com/detail/remarker/hdmpdmamklhjagiogicgcfcdpfiilecn

## Features

- Reading toolbar: copy or Google-search any selection; pronounce and explain words; translate or highlight longer text in five colors.
- Contextual AI: explain words and translate passages with surrounding page context through an OpenAI-compatible model.
- Highlights and notes: restore highlights when revisiting a page, change their color, attach notes, and manage them from one place.
- Vocabulary and translations: save word lookups automatically, keep translation history, restore vocabulary underlines, and replay pronunciation.
- Spaced repetition: review due words with flip cards and rate them as unfamiliar, hesitant, or skilled. The extension badge and popup show the due count.
- Learning activity: see six months of highlight, vocabulary, and translation activity together with today's review progress.
- Footprints: collect pages with highlights or lookups, or add pages manually; filter, star, archive, and reopen them from the management page.
- Export and backup: export highlights, vocabulary, and translations as Obsidian or Notion Markdown; import full JSON backups or create full and incremental exports.
- Reading controls: enable ReMarker globally or per site, choose whether copied lookup panels close automatically, and use a content UI that follows the system dark-mode preference.
- Multilingual UI: English, Simplified Chinese, Traditional Chinese, and Spanish. The UI language is also the target language for AI results.

## Local Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

The build output is written to `dist/`. Open Chrome's extensions page, enable Developer mode, choose **Load unpacked**, and select that directory.

## Configuration

The Settings page provides:

- Provider presets for DeepSeek, OpenRouter, Gemini, Z.ai/GLM, Alibaba DashScope, and ByteDance Volcengine, plus custom OpenAI-compatible endpoints.
- Per-provider API key and model configuration, request temperature and timeout, and a connection test.
- Separate prompt templates for word lookup and translation.
- An optional Merriam-Webster API key, default highlight color, interface language, and table page size.

Each prompt template must include:

```txt
{{selection}}
{{context}}
```

Pronunciation uses Merriam-Webster audio, Free Dictionary audio, and browser speech synthesis as fallbacks. Retrieved pronunciation data is cached locally when available.

## Data and Privacy

ReMarker stores durable reading data and settings locally in IndexedDB; lightweight startup and site state use Chrome local storage. There is no built-in online sync.

The API key is used by the extension service worker and is never inserted into the page DOM. AI lookup and translation send the selected text and surrounding context to the provider you configure. JSON exports include API keys only when you explicitly choose to include sensitive settings.

## Tech Stack

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI management page
- Plain TypeScript content script with Shadow DOM
- IndexedDB and Chrome local storage
- Vitest

## Roadmap

- Cross-device sync for highlights, vocabulary, and settings.
