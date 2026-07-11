export const en = {
  languageName: "English",
  common: {
    appName: "Remarker",
    refresh: "Refresh",
    created: "Created",
    copied: "Copied",
    copy: "Copy",
    cancel: "Cancel",
    delete: "Delete",
    empty: "Empty",
    openSource: "Open source"
  },
  popup: {
    loading: "Loading",
    failed: "Failed",
    noSite: "No site",
    enableExtension: "Enable extension",
    enableCurrentSite: "Enable current site",
    openManagementPage: "Open management page"
  },
  content: {
    copy: "Copy",
    speak: "Speak",
    explain: "Explain",
    saveWord: "Save word",
    translate: "Translate",
    splitHighlight: "Split highlight",
    highlight: "Highlight",
    highlightColor: "Highlight {{color}}",
    changeToColor: "Change to {{color}}",
    delete: "Delete",
    explaining: "Explaining",
    explainingProgress: "Explaining...",
    explanation: "Explanation",
    translating: "Translating",
    translatingProgress: "Translating...",
    translation: "Translation",
    regenerate: "Regenerate",
    copyExplanation: "Copy explanation",
    close: "Close",
    copied: "Copied",
    savedHighlights: "Saved {{count}} highlight{{plural}}."
  },
  options: {
    tabs: {
      highlights: "Highlights",
      vocabulary: "Vocabulary",
      explanations: "Lookup Records",
      settings: "Settings"
    },
    columns: {
      highlightedText: "Highlighted Text",
      source: "Source",
      status: "Status",
      color: "Color",
      actions: "Actions",
      word: "Word",
      context: "Context",
      audio: "Audio"
    },
    filters: {
      allColors: "All colors",
      reset: "Reset"
    },
    actions: {
      copyHighlightedText: "Copy highlighted text",
      deleteHighlight: "Delete highlight",
      expandTranslation: "Expand translation",
      collapseTranslation: "Collapse translation",
      speakWord: "Speak {{word}}",
      deleteVocabularyItem: "Delete vocabulary item",
      copyExplanation: "Copy explanation",
      deleteExplanation: "Delete explanation",
      export: "Export",
      clearCache: "Clear Cache",
      exportJson: "Export JSON",
      exportMarkdown: "Export Markdown",
      importJson: "Import JSON",
      saveSettings: "Save settings",
      restoreDefault: "Restore default"
    },
    confirmations: {
      deleteHighlight: "Delete this highlight?",
      deleteVocabularyItem: "Delete this vocabulary item?",
      deleteExplanation: "Delete this lookup record?",
      clearExplanations: "Clear all lookup records?"
    },
    settings: {
      llm: "LLM",
      baseUrl: "Base URL",
      apiKey: "API Key",
      model: "Model",
      temperature: "Temperature",
      timeoutMs: "Timeout ms",
      promptTemplate: "Prompt template",
      promptTemplateHelp: "Available variables: {{task}}, {{selection}}, {{context}}",
      behavior: "Behavior",
      autoCloseLookupPanelOnCopy: "Automatically close lookup popup after copying",
      language: "Language",
      languageHelp: "The selected language is used for the interface and as the LLM translation target language.",
      pronunciation: "Pronunciation",
      merriamWebsterApiKey: "Merriam-Webster API Key",
      preferences: "Preferences",
      enableExtensionGlobally: "Enable page highlighting globally",
      defaultHighlightColor: "Default highlight color",
      disabledSites: "Disabled sites",
      disabledSitesHelp: "One hostname per line, for example: example.com",
      importExport: "Import / Export",
      includeSensitiveConfig: "Include sensitive configuration in JSON export"
    },
    notices: {
      settingsSaved: "Settings saved.",
      jsonImported: "JSON imported.",
      dataRefreshed: "Data refreshed.",
      highlightDeleted: "Highlight deleted.",
      vocabularyDeleted: "Vocabulary item deleted.",
      copied: "Copied.",
      jsonExported: "JSON exported.",
      markdownExported: "Markdown exported.",
      promptRestored: "Default prompt restored.",
      pronunciationStarted: "Pronunciation started."
    },
    errors: {
      promptTemplateMissingVariables: "Prompt template is missing required variables: {{variables}}"
    },
    statusDescriptions: {
      active: "This highlight was restored on the source page.",
      not_found: "The saved text anchor was not found on the source page.",
      ambiguous: "The saved text anchor matched multiple places on the source page.",
      pending: "This highlight has not been restored on a source page yet."
    },
    export: {
      explanationsTitle: "Lookup Records",
      exported: "Exported",
      source: "Source",
      model: "Model",
      untitled: "Untitled"
    }
  }
} as const;
