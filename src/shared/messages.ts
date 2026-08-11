import type {
  AppSettings,
  FootprintListItem,
  FootprintRecord,
  HighlightColor,
  HighlightRecord,
  HighlightStatus,
  RecordsPageSize,
  TextAnchor,
  VocabularyRecord,
} from "./types";
import type { ReviewRating } from "./review";

export type RuntimeMessage =
  | { type: "GET_HIGHLIGHTS_FOR_URL"; urlKey: string }
  | { type: "GET_VOCABULARY_FOR_URL"; urlKey: string }
  | { type: "GET_FOOTPRINT"; sourceUrl: string }
  | { type: "ADD_FOOTPRINT"; sourceUrl: string; sourceTitle: string }
  | { type: "SAVE_HIGHLIGHT"; record: HighlightRecord }
  | { type: "UPDATE_HIGHLIGHT_STATUS"; id: string; status: HighlightStatus }
  | { type: "UPDATE_HIGHLIGHT_COLOR"; id: string; color: HighlightColor }
  | { type: "UPDATE_HIGHLIGHT_NOTE"; id: string; note: string }
  | {
      type: "UPDATE_HIGHLIGHT_STATUSES";
      updates: Array<{ id: string; status: HighlightStatus }>;
    }
  | { type: "DELETE_HIGHLIGHT"; id: string }
  | { type: "SAVE_VOCABULARY"; record: VocabularyRecord }
  | { type: "UPDATE_VOCABULARY_TRANSLATION"; id: string; translation: string }
  | { type: "DELETE_VOCABULARY"; id: string }
  | { type: "GET_REVIEW_QUEUE"; now: string; limit?: number }
  | { type: "GET_REVIEW_STATUS"; now: string }
  | { type: "QUERY_HIGHLIGHTS"; query: DataQuery }
  | { type: "QUERY_VOCABULARY"; query: DataQuery }
  | { type: "QUERY_FOOTPRINTS"; query: DataQuery }
  | {
      type: "SUBMIT_VOCABULARY_REVIEW";
      id: string;
      rating: ReviewRating;
      reviewedAt: string;
    }
  | { type: "SET_FOOTPRINT_STAR"; urlKey: string; starred: boolean }
  | { type: "ARCHIVE_FOOTPRINT"; urlKey: string }
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
  | { type: "GET_PRONUNCIATION"; word: string; language?: string }
  | { type: "GET_SETTINGS" }
  | { type: "GET_OPTIONS_OVERVIEW" }
  | { type: "SAVE_SETTINGS"; settings: AppSettings }
  | { type: "TEST_LLM_CONNECTION"; settings: AppSettings }
  | { type: "OPEN_SETTINGS_PAGE" }
  | { type: "LIST_ALL_DATA" }
  | {
      type: "IMPORT_SNAPSHOT";
      snapshot: {
        settings?: AppSettings;
        highlights?: HighlightRecord[];
        vocabulary?: VocabularyRecord[];
        footprints?: FootprintRecord[];
      };
    };

export interface DataQuery {
  page: number;
  pageSize: RecordsPageSize;
  word?: string;
  context?: string;
  source?: string;
  title?: string;
  site?: string;
  color?: HighlightColor | "";
  selectionKind?: "word" | "text";
  starredOnly?: boolean;
}

export interface QueryResult<T> {
  items: T[];
  total: number;
}

export interface OptionsDataCounts {
  footprints: number;
  highlights: number;
  vocabulary: number;
  translations: number;
}

export interface OptionsOverviewResult {
  settings: AppSettings;
  counts: OptionsDataCounts;
}

export interface PronunciationResult {
  provider: "merriam-webster" | "free-dictionary" | "speech-synthesis";
  audioDataUrl?: string;
  audioUrl?: string;
  phonetic?: string;
  language: string;
}

export interface ListAllDataResult {
  footprints: FootprintListItem[];
  highlights: HighlightRecord[];
  vocabulary: VocabularyRecord[];
  settings: AppSettings;
}
