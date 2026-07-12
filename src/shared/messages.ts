import type {
  AppSettings,
  ExplanationRecord,
  HighlightColor,
  HighlightRecord,
  HighlightStatus,
  TextAnchor,
  VocabularyRecord
} from "./types";

export type RuntimeMessage =
  | { type: "GET_HIGHLIGHTS_FOR_URL"; urlKey: string }
  | { type: "GET_WORD_EXPLANATIONS_FOR_URL"; urlKey: string }
  | { type: "GET_VOCABULARY_FOR_URL"; urlKey: string }
  | { type: "SAVE_HIGHLIGHT"; record: HighlightRecord }
  | { type: "UPDATE_HIGHLIGHT_STATUS"; id: string; status: HighlightStatus }
  | { type: "UPDATE_HIGHLIGHT_COLOR"; id: string; color: HighlightColor }
  | { type: "DELETE_HIGHLIGHT"; id: string }
  | { type: "SAVE_VOCABULARY"; record: VocabularyRecord }
  | { type: "DELETE_VOCABULARY"; id: string }
  | {
      type: "EXPLAIN_SELECTION";
      selectionKind: "word" | "text";
      selectedText: string;
      context: string;
      sourceUrl: string;
      sourceTitle: string;
      anchor?: TextAnchor;
      forceRefresh?: boolean;
    }
  | { type: "GET_PRONUNCIATION"; word: string }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: AppSettings }
  | { type: "OPEN_SETTINGS_PAGE" }
  | { type: "LIST_ALL_DATA" }
  | {
      type: "IMPORT_SNAPSHOT";
      snapshot: {
        settings?: AppSettings;
        highlights?: HighlightRecord[];
        vocabulary?: VocabularyRecord[];
        explanations?: ExplanationRecord[];
      };
    }
  | { type: "DELETE_EXPLANATION"; id: string }
  | { type: "CLEAR_EXPLANATIONS" };

export interface PronunciationResult {
  provider: "merriam-webster" | "free-dictionary" | "speech-synthesis";
  audioUrl?: string;
}

export interface ListAllDataResult {
  highlights: HighlightRecord[];
  vocabulary: VocabularyRecord[];
  settings: AppSettings;
}
