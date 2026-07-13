---
layout: default
title: Privacy Policy for Remarker
description: Privacy policy for the Remarker browser extension.
permalink: /users/privacy/
---

# Privacy Policy for Remarker

Remarker is a browser extension for web reading, highlighting, contextual AI word lookup, vocabulary saving, and local study-note management.

## Data Handled by the Extension

Remarker may process the following data to provide its features:

- Selected text and surrounding page context, used for AI word lookup or translation.
- Page URLs and page titles, used to restore highlights and vocabulary marks on previously visited pages.
- User-created highlights, vocabulary records, lookup results, and extension settings.
- Optional API keys entered by the user for OpenAI-compatible LLM providers or dictionary services.

## Local Storage

By default, Remarker stores highlights, vocabulary, settings, cached lookup results, and site preferences locally in the user's browser using IndexedDB and Chrome local storage.

The developer does not operate a server that collects or stores this data.

## External Requests

When the user starts an AI lookup or translation, Remarker sends the selected text, surrounding context, and prompt content to the LLM endpoint configured by the user. This may be a third-party OpenAI-compatible provider selected by the user.

When the user requests pronunciation, Remarker may request audio or dictionary data from Merriam-Webster or Free Dictionary.

## Data Sharing

Remarker does not sell user data, does not use user data for advertising, and does not transfer user data for profiling or marketing.

Data is shared only when necessary to provide user-requested features, such as sending selected text to the user-configured LLM provider or requesting pronunciation audio.

## Remote Code

Remarker does not load or execute remote JavaScript or WebAssembly. All extension code is packaged with the extension.

## Data Deletion

Users can delete highlights, vocabulary records, lookup records, and settings from the extension interface. Users can also remove all locally stored extension data by uninstalling the extension or clearing extension storage in the browser.

## Contact

For privacy questions, contact the developer through the support channel listed on the Chrome Web Store page.
