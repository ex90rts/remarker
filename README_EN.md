[简体中文](README.md) | [English](README_EN.md)

# ReMarker — AI Reading Assistant and Vocabulary Builder

ReMarker is a Chrome extension for people who read deeply on the web and learn foreign languages. While reading an article, you can select text at any time to copy it, search for it, hear its pronunciation, look it up, translate it, add a note, or highlight it. The management page keeps the resulting highlights, notes, vocabulary, translations, and page footprints organized in one place, while spaced repetition based on the forgetting curve helps you review vocabulary.

<div align="center">Install from <a href="https://chromewebstore.google.com/detail/remarker/hdmpdmamklhjagiogicgcfcdpfiilecn" target="_blank">Chrome Web Store</a></div>

<br />

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-01.webp" alt="ReMarker reading tools" width="80%" style="border: 1px solid #ddd; padding: 4px; display: inline-block; border-radius: 4px;">
</div>

<br />

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-04.webp" alt="ReMarker management page" width="80%" style="border: 1px solid #ddd; padding: 4px; display: inline-block; border-radius: 4px;">
</div>

## Features

- Reading toolbar: copy or Google-search any selection; pronounce and explain words; translate or highlight longer text in five colors.
- Contextual AI: explain words and translate passages with surrounding page context through an OpenAI-compatible model, with results displayed as they stream in.
- Highlights and notes: restore highlights when revisiting a page, change their color, attach notes, and manage them from one place.
- Vocabulary and translations: save word lookups automatically, keep translation history, restore vocabulary underlines, and replay pronunciation.
- Spaced repetition: review due words with flip cards and rate them as unfamiliar, hesitant, or skilled. The extension badge and popup show the due count.
- Learning activity: see six months of highlight, vocabulary, and translation activity together with today's review progress.
- Footprints: collect pages with highlights or lookups, or add pages manually; filter, star, archive, and reopen them from the management page.
- Export and backup: export highlights, vocabulary, and translations as Obsidian or Notion Markdown; import full JSON backups or create full and incremental JSON exports. Sensitive settings are excluded by default.
- Reading controls: enable ReMarker globally or per site, choose whether copied lookup panels close automatically, and use a content UI that follows the system dark-mode preference.
- Multilingual UI: English, Simplified Chinese, Traditional Chinese, and Spanish. The UI language is also the target language for AI results.

## Settings

The Settings page provides:

- Usage preferences, including the interface language, default highlight color, and records per page.
- LLM configuration in BYOK mode (BYOK means Bring Your Own Key: the extension does not provide an LLM service, so you configure your own API key and model).
  - Presets for DeepSeek, OpenRouter, Gemini, Z.ai/GLM, Alibaba DashScope, and ByteDance Volcengine, plus custom OpenAI-compatible endpoints.
  - Separate API key and model settings for each provider, request temperature and timeout, and a connection test.
  - Separate prompt templates for word lookup and translation.
- JSON import and export for backups and data migration.

## Data and Privacy

ReMarker stores durable reading data and settings locally in IndexedDB; lightweight startup and site state use Chrome local storage. There is no built-in online sync.

The API key is used only by the extension service worker. It is never inserted into the page DOM or sent to any third-party server. When you perform an AI lookup or translation, the selected text and surrounding context are sent to the provider you configured. JSON exports include API keys only when you explicitly choose to include sensitive settings.

## Tech Stack

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI management page
- Plain TypeScript content script with Shadow DOM
- IndexedDB and Chrome local storage
- Vitest

## Contributing and Custom Development

If you encounter a problem or have a suggestion, feel free to submit an Issue or Pull Request. You are also welcome to fork the project for custom development. For general vibe coding, the project's `AGENTS.md` provides enough context to focus on the feature you want to build. The following commands can be run manually:

```sh
# Install dependencies. Node.js 18+ is required locally.
npm install

# Run the type check
npm run typecheck

# Build the extension
npm run build
```

The build output is written to `dist/`. Open Chrome's extensions page, enable Developer mode, choose **Load unpacked**, and select that directory to load or reload the extension.

## Roadmap

- Cross-device sync for highlights, vocabulary, and settings.
