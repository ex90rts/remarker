import type { Messages } from "./types";

export const zhTW: Messages = {
  languageName: "中文繁體",
  common: {
    appName: "Remarker",
    refresh: "重新整理",
    created: "建立於",
    copied: "已複製",
    copy: "複製",
    cancel: "取消",
    delete: "刪除",
    empty: "空",
    openSource: "開啟來源"
  },
  popup: {
    loading: "載入中",
    failed: "失敗",
    noSite: "無站點",
    enableExtension: "啟用外掛",
    enableCurrentSite: "啟用目前站點",
    openManagementPage: "開啟管理頁面"
  },
  content: {
    copy: "複製",
    speak: "發音",
    explain: "解釋",
    saveWord: "加入生字表",
    translate: "翻譯",
    splitHighlight: "拆分標記",
    highlight: "標記",
    highlightColor: "標記：{{color}}",
    changeToColor: "改為 {{color}}",
    delete: "刪除",
    explaining: "解釋中",
    explainingProgress: "解釋中...",
    explanation: "解釋",
    translating: "翻譯中",
    translatingProgress: "翻譯中...",
    translation: "翻譯",
    regenerate: "重新取得",
    copyExplanation: "複製解釋",
    close: "關閉",
    copied: "已複製",
    savedHighlights: "已儲存 {{count}} 條標記。"
  },
  options: {
    tabs: {
      highlights: "標記",
      vocabulary: "生字表",
      explanations: "查詞記錄",
      settings: "設定"
    },
    columns: {
      highlightedText: "標記文字",
      source: "來源",
      status: "狀態",
      color: "顏色",
      actions: "操作",
      word: "單字",
      context: "上下文",
      audio: "發音"
    },
    filters: {
      allColors: "全部顏色",
      reset: "重置"
    },
    actions: {
      copyHighlightedText: "複製標記文字",
      deleteHighlight: "刪除標記",
      expandTranslation: "展開解釋",
      collapseTranslation: "收合解釋",
      speakWord: "播放 {{word}} 發音",
      deleteVocabularyItem: "刪除生字",
      copyExplanation: "複製解釋",
      deleteExplanation: "刪除解釋",
      export: "匯出",
      clearCache: "清除快取",
      exportJson: "匯出 JSON",
      exportMarkdown: "匯出 Markdown",
      importJson: "匯入 JSON",
      saveSettings: "儲存設定",
      restoreDefault: "恢復預設"
    },
    confirmations: {
      deleteHighlight: "刪除這條標記？",
      deleteVocabularyItem: "刪除這個生字？",
      deleteExplanation: "刪除這條查詞記錄？",
      clearExplanations: "清除所有查詞記錄？"
    },
    settings: {
      llm: "大型語言模型",
      baseUrl: "Base URL",
      apiKey: "API Key",
      model: "模型",
      temperature: "Temperature",
      timeoutMs: "逾時時間 ms",
      promptTemplate: "提示詞模板",
      promptTemplateHelp: "可用變數：{{task}}、{{selection}}、{{context}}",
      behavior: "行為",
      autoCloseLookupPanelOnCopy: "查詞彈窗複製後自動關閉",
      language: "語言",
      languageHelp: "所選語言為介面語言，同時為大型語言模型翻譯的目標語言。",
      pronunciation: "發音",
      merriamWebsterApiKey: "Merriam-Webster API Key",
      preferences: "偏好",
      enableExtensionGlobally: "啟用全域頁面標記",
      defaultHighlightColor: "預設標記顏色",
      disabledSites: "停用站點",
      disabledSitesHelp: "每行一個 hostname，例如：example.com",
      importExport: "匯入 / 匯出",
      includeSensitiveConfig: "JSON 匯出包含敏感設定"
    },
    notices: {
      settingsSaved: "設定已儲存。",
      jsonImported: "JSON 已匯入。",
      dataRefreshed: "資料已重新整理。",
      highlightDeleted: "標記已刪除。",
      vocabularyDeleted: "生字已刪除。",
      copied: "已複製。",
      jsonExported: "JSON 已匯出。",
      markdownExported: "Markdown 已匯出。",
      promptRestored: "已恢復預設提示詞。",
      pronunciationStarted: "已開始播放發音。"
    },
    errors: {
      promptTemplateMissingVariables: "提示詞模板缺少必要變數：{{variables}}"
    },
    statusDescriptions: {
      active: "這條標記已在來源頁面恢復。",
      not_found: "來源頁面中找不到儲存的文字錨點。",
      ambiguous: "來源頁面中符合多個位置，無法安全恢復。",
      pending: "這條標記尚未在來源頁面完成恢復確認。"
    },
    export: {
      explanationsTitle: "查詞記錄",
      exported: "匯出時間",
      source: "來源",
      model: "模型",
      untitled: "未命名"
    }
  }
};
