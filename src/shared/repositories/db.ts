import type {
  AppSettings,
  AudioCacheRecord,
  FootprintRecord,
  FootprintListItem,
  HighlightRecord,
  LlmProvider,
  LlmProviderConfig,
  SiteSetting,
  VocabularyRecord
} from "../types";
import type { DataQuery, QueryResult } from "../messages";
import {
  getReviewDayCutoff,
  normalizeVocabularyReview,
  scheduleVocabularyReview,
  type ReviewRating,
} from "../review";
import { detectBrowserLanguage } from "../i18n";
import { normalizeContextForStorage } from "../context";
import {
  DEFAULT_SETTINGS,
  LLM_PROVIDER_PRESETS,
  SCHEMA_VERSION,
  createDefaultLlmProviderConfigs,
  getDefaultPromptTemplate,
  isDefaultPromptTemplate,
  migrateLegacyPromptTemplate,
  normalizeLlmProvider,
  normalizeLlmProviderConfig,
  normalizeRecordsPageSize
} from "../types";

const DB_NAME = "remarker";

type StoreName =
  | "settings"
  | "highlights"
  | "vocabulary"
  | "footprints"
  | "siteSettings"
  | "audioCache";

let dbPromise: Promise<IDBDatabase> | undefined;

export function openRemarkerDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      const highlightStore = db.objectStoreNames.contains("highlights")
        ? transaction?.objectStore("highlights")
        : db.createObjectStore("highlights", { keyPath: "id" });
      if (highlightStore) {
        ensureIndex(highlightStore, "urlKey", "urlKey", { unique: false });
        ensureIndex(highlightStore, "createdAt", "createdAt", { unique: false });
        ensureIndex(highlightStore, "status", "status", { unique: false });
        ensureIndex(highlightStore, "updatedAt", "updatedAt", { unique: false });
      }

      const vocabularyStore = db.objectStoreNames.contains("vocabulary")
        ? transaction?.objectStore("vocabulary")
        : db.createObjectStore("vocabulary", { keyPath: "id" });
      if (vocabularyStore) {
        ensureIndex(vocabularyStore, "normalizedWord", "normalizedWord", {
          unique: false,
        });
        ensureIndex(vocabularyStore, "urlKey", "urlKey", { unique: false });
        ensureIndex(vocabularyStore, "cacheKey", "cacheKey", { unique: true });
        ensureIndex(vocabularyStore, "createdAt", "createdAt", { unique: false });
        ensureIndex(vocabularyStore, "updatedAt", "updatedAt", { unique: false });
        ensureIndex(vocabularyStore, "nextReviewAt", "nextReviewAt", { unique: false });
        ensureIndex(vocabularyStore, "selectionKindCreatedAt", ["selectionKind", "createdAt"], {
          unique: false,
        });
        if (event.oldVersion < 5) backfillVocabularyReview(vocabularyStore);
      }

      const footprintStore = db.objectStoreNames.contains("footprints")
        ? transaction?.objectStore("footprints")
        : db.createObjectStore("footprints", { keyPath: "urlKey" });
      if (footprintStore) {
        ensureIndex(footprintStore, "starred", "starred", { unique: false });
        ensureIndex(footprintStore, "archivedAt", "archivedAt", { unique: false });
        ensureIndex(footprintStore, "createdAt", "createdAt", { unique: false });
        ensureIndex(footprintStore, "updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("siteSettings")) {
        db.createObjectStore("siteSettings", { keyPath: "hostname" });
      }

      const audioCacheStore = db.objectStoreNames.contains("audioCache")
        ? transaction?.objectStore("audioCache")
        : db.createObjectStore("audioCache", { keyPath: "key" });
      if (audioCacheStore) {
        ensureIndex(audioCacheStore, "lastAccessedAt", "lastAccessedAt", { unique: false });
      }

      if (db.objectStoreNames.contains("explanations")) {
        db.deleteObjectStore("explanations");
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

function tx(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openRemarkerDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function ensureIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | string[],
  options?: IDBIndexParameters,
) {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options);
  }
}

function backfillVocabularyReview(store: IDBObjectStore): void {
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const record = cursor.value as VocabularyRecord;
    if ((record.selectionKind ?? "word") === "word") {
      cursor.update(normalizeVocabularyReview(record));
    }
    cursor.continue();
  };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const store = await tx(storeName, "readonly");
  return requestToPromise<T[]>(store.getAll());
}

export async function getFromStore<T>(
  storeName: StoreName,
  id: IDBValidKey,
): Promise<T | undefined> {
  const store = await tx(storeName, "readonly");
  return requestToPromise<T | undefined>(store.get(id));
}

export async function putInStore<T>(storeName: StoreName, value: T): Promise<void> {
  const store = await tx(storeName, "readwrite");
  await requestToPromise(store.put(value));
}

export async function updateVocabularyTranslation(
  id: string,
  translation: string,
): Promise<VocabularyRecord | undefined> {
  const record = await getFromStore<VocabularyRecord>("vocabulary", id);
  if (!record) return undefined;
  const updated = {
    ...record,
    translation,
    updatedAt: new Date().toISOString(),
  };
  await putInStore("vocabulary", updated);
  return normalizeVocabularyReview(updated);
}

export async function deleteFromStore(storeName: StoreName, id: IDBValidKey): Promise<void> {
  const store = await tx(storeName, "readwrite");
  await requestToPromise(store.delete(id));
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const store = await tx(storeName, "readwrite");
  await requestToPromise(store.clear());
}

export async function getSettings(): Promise<AppSettings> {
  const store = await tx("settings", "readonly");
  const row = await requestToPromise<{ key: string; value: AppSettings } | undefined>(store.get("app"));
  return normalizeSettings(row?.value);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await putInStore("settings", { key: "app", value: normalizeSettings(settings) });
}

export async function getHighlightsForUrl(urlKey: string): Promise<HighlightRecord[]> {
  const store = await tx("highlights", "readonly");
  const index = store.index("urlKey");
  return requestToPromise<HighlightRecord[]>(index.getAll(urlKey));
}

export async function getVocabularyByCacheKey(cacheKey: string): Promise<VocabularyRecord | undefined> {
  const store = await tx("vocabulary", "readonly");
  const index = store.index("cacheKey");
  const record = await requestToPromise<VocabularyRecord | undefined>(index.get(cacheKey));
  return record ? normalizeVocabularyReview(record) : undefined;
}

export async function getVocabularyForUrl(urlKey: string): Promise<VocabularyRecord[]> {
  const store = await tx("vocabulary", "readonly");
  const records = await requestToPromise<VocabularyRecord[]>(store.index("urlKey").getAll(urlKey));
  return records.map(normalizeVocabularyReview);
}

export async function getReviewQueue(now: string, limit = 100): Promise<VocabularyRecord[]> {
  const store = await tx("vocabulary", "readonly");
  const range = IDBKeyRange.upperBound(getReviewDayCutoff(now), true);
  const records = await requestToPromise<VocabularyRecord[]>(
    store.index("nextReviewAt").getAll(range),
  );
  return records
    .filter((record) => (record.selectionKind ?? "word") === "word")
    .map(normalizeVocabularyReview)
    .sort((left, right) =>
      left.nextReviewAt.localeCompare(right.nextReviewAt) ||
      left.createdAt.localeCompare(right.createdAt),
    )
    .slice(0, Math.max(1, limit));
}

export async function countDueVocabulary(now: string): Promise<number> {
  const store = await tx("vocabulary", "readonly");
  const range = IDBKeyRange.upperBound(getReviewDayCutoff(now), true);
  return requestToPromise(store.index("nextReviewAt").count(range));
}

export async function getNextVocabularyReview(): Promise<VocabularyRecord | undefined> {
  const store = await tx("vocabulary", "readonly");
  const request = store.index("nextReviewAt").openCursor();
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(undefined);
        return;
      }
      const record = cursor.value as VocabularyRecord;
      if ((record.selectionKind ?? "word") === "word") {
        resolve(normalizeVocabularyReview(record));
        return;
      }
      cursor.continue();
    };
  });
}

export async function submitVocabularyReview(
  id: string,
  rating: ReviewRating,
  reviewedAt: string,
): Promise<VocabularyRecord> {
  const store = await tx("vocabulary", "readwrite");
  const current = await requestToPromise<VocabularyRecord | undefined>(store.get(id));
  if (!current) throw new Error("Vocabulary record was not found.");
  if ((current.selectionKind ?? "word") !== "word") {
    throw new Error("Translation records cannot be reviewed.");
  }
  const updated = scheduleVocabularyReview(current, rating, reviewedAt);
  await requestToPromise(store.put(updated));
  return updated;
}

export async function getAudioCache(key: string): Promise<AudioCacheRecord | undefined> {
  return getFromStore<AudioCacheRecord>("audioCache", key);
}

export async function saveAudioCache(record: AudioCacheRecord): Promise<void> {
  await putInStore("audioCache", record);
}

export async function deleteAudioCache(key: string): Promise<void> {
  await deleteFromStore("audioCache", key);
}

export async function updateHighlightStatuses(
  updates: Array<{ id: string; status: HighlightRecord["status"] }>,
): Promise<HighlightRecord[]> {
  const store = await tx("highlights", "readwrite");
  const updatedRecords: HighlightRecord[] = [];
  const updatedAt = new Date().toISOString();
  for (const update of updates) {
    const current = await requestToPromise<HighlightRecord | undefined>(
      store.get(update.id),
    );
    if (!current) continue;
    const updated = { ...current, status: update.status, updatedAt };
    await requestToPromise(store.put(updated));
    updatedRecords.push(updated);
  }
  return updatedRecords;
}

export function queryHighlights(query: DataQuery): Promise<QueryResult<HighlightRecord>> {
  return queryStoreByCreatedAt<HighlightRecord>("highlights", query, (record) =>
    includesQuery(record.selectedText, query.word) &&
    includesQuery(`${record.sourceTitle} ${record.sourceUrl}`, query.source) &&
    (!query.color || record.color === query.color),
  );
}

export async function queryVocabulary(
  query: DataQuery,
): Promise<QueryResult<VocabularyRecord>> {
  const selectionKind = query.selectionKind ?? "word";
  const result = await queryStoreByCreatedAt<VocabularyRecord>(
    "vocabulary",
    query,
    (record) =>
      (record.selectionKind ?? "word") === selectionKind &&
      includesQuery(record.word, query.word) &&
      includesQuery(record.contextSentence, query.context) &&
      includesQuery(`${record.sourceTitle} ${record.sourceUrl}`, query.source),
    "selectionKindCreatedAt",
    IDBKeyRange.bound([selectionKind, ""], [selectionKind, "\uffff"]),
  );
  return { ...result, items: result.items.map(normalizeVocabularyReview) };
}

export async function queryFootprints(query: DataQuery): Promise<QueryResult<FootprintListItem>> {
  const result = await queryStoreByCreatedAt<FootprintRecord>("footprints", query, (record) =>
    !record.archivedAt &&
    (!query.starredOnly || record.starred) &&
    includesQuery(record.sourceTitle || record.sourceUrl, query.title) &&
    includesQuery(record.siteName, query.site) &&
    includesQuery(`${record.sourceTitle} ${record.siteName} ${record.sourceUrl}`, query.source),
  );
  const items = await Promise.all(result.items.map(async (record) => {
    const [highlightCount, lookupCount] = await Promise.all([
      countByIndex("highlights", "urlKey", record.urlKey),
      countByIndex("vocabulary", "urlKey", record.urlKey),
    ]);
    return {
      ...record,
      browsedAt: record.updatedAt || record.createdAt,
      highlightCount,
      lookupCount,
    };
  }));
  return { items, total: result.total };
}

async function countByIndex(
  storeName: "highlights" | "vocabulary",
  indexName: "urlKey",
  key: IDBValidKey,
): Promise<number> {
  const store = await tx(storeName, "readonly");
  return requestToPromise(store.index(indexName).count(key));
}

export async function getOptionsDataCounts(): Promise<{
  footprints: number;
  highlights: number;
  vocabulary: number;
  translations: number;
}> {
  const [footprints, highlights, vocabulary, translations] = await Promise.all([
    countUnarchivedFootprints(),
    countStore("highlights"),
    countVocabularyByKind("word"),
    countVocabularyByKind("text"),
  ]);
  return { footprints, highlights, vocabulary, translations };
}

async function countStore(storeName: "highlights"): Promise<number> {
  const store = await tx(storeName, "readonly");
  return requestToPromise(store.count());
}

async function countVocabularyByKind(
  selectionKind: "word" | "text",
): Promise<number> {
  const store = await tx("vocabulary", "readonly");
  const range = IDBKeyRange.bound(
    [selectionKind, ""],
    [selectionKind, "\uffff"],
  );
  return requestToPromise(store.index("selectionKindCreatedAt").count(range));
}

async function countUnarchivedFootprints(): Promise<number> {
  const store = await tx("footprints", "readonly");
  const [total, archived] = await Promise.all([
    requestToPromise(store.count()),
    requestToPromise(store.index("archivedAt").count()),
  ]);
  return total - archived;
}

async function queryStoreByCreatedAt<T extends { createdAt: string }>(
  storeName: "highlights" | "vocabulary" | "footprints",
  query: DataQuery,
  matches: (record: T) => boolean,
  indexName = "createdAt",
  range: IDBKeyRange | null = null,
): Promise<QueryResult<T>> {
  const store = await tx(storeName, "readonly");
  const index = store.index(indexName);
  const start = Math.max(0, query.page) * query.pageSize;
  const items: T[] = [];
  let total = 0;
  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor(range, "prev");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const record = cursor.value as T;
      if (matches(record)) {
        if (total >= start && items.length < query.pageSize) items.push(record);
        total += 1;
      }
      cursor.continue();
    };
  });
  return { items, total };
}

function includesQuery(value: string | undefined, query: string | undefined): boolean {
  const normalized = query?.trim().toLocaleLowerCase();
  return !normalized || (value ?? "").toLocaleLowerCase().includes(normalized);
}

export async function getFootprint(urlKey: string): Promise<FootprintRecord | undefined> {
  return getFromStore<FootprintRecord>("footprints", urlKey);
}

export async function getAllFootprints(): Promise<FootprintRecord[]> {
  return getAllFromStore<FootprintRecord>("footprints");
}

export async function getSiteSettings(): Promise<SiteSetting[]> {
  return getAllFromStore<SiteSetting>("siteSettings");
}

export async function saveSiteSetting(setting: SiteSetting): Promise<void> {
  await putInStore("siteSettings", setting);
}

export async function importSnapshot(snapshot: {
  settings?: AppSettings;
  footprints?: FootprintRecord[];
  highlights?: HighlightRecord[];
  vocabulary?: VocabularyRecord[];
  siteSettings?: SiteSetting[];
}): Promise<void> {
  if (snapshot.settings) await saveSettings(snapshot.settings);
  for (const record of snapshot.footprints ?? []) await putInStore("footprints", record);
  for (const record of snapshot.highlights ?? []) await putInStore("highlights", record);
  for (const record of snapshot.vocabulary ?? []) {
    const incoming = normalizeVocabularyReview({
      ...record,
      contextSentence: normalizeContextForStorage(record.contextSentence),
    });
    const current = await getFromStore<VocabularyRecord>("vocabulary", incoming.id);
    if (!current || current.updatedAt <= incoming.updatedAt) {
      await putInStore("vocabulary", incoming);
    }
  }
  for (const record of snapshot.siteSettings ?? []) await saveSiteSetting(record);
}

type LegacyLlmConfig = Partial<AppSettings["llm"]> & {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  promptTemplate?: string;
  providers?: Partial<Record<LlmProvider, Partial<LlmProviderConfig>>>;
};

function normalizeSettings(settings: AppSettings | undefined): AppSettings {
  const language = settings?.ui?.language ?? detectBrowserLanguage();
  const incomingLlm = settings?.llm as LegacyLlmConfig | undefined;
  const provider = normalizeLlmProvider(incomingLlm?.provider);
  const providers = createDefaultLlmProviderConfigs();

  for (const preset of LLM_PROVIDER_PRESETS) {
    providers[preset.value] = normalizeLlmProviderConfig(
      preset.value,
      incomingLlm?.providers?.[preset.value],
    );
  }

  if (incomingLlm && !incomingLlm.providers) {
    providers[provider] = normalizeLlmProviderConfig(provider, {
      baseUrl: incomingLlm.baseUrl,
      apiKey: incomingLlm.apiKey,
      model: incomingLlm.model,
    });
  }

  const llm: AppSettings["llm"] = {
    provider,
    providers,
    temperature: incomingLlm?.temperature ?? DEFAULT_SETTINGS.llm.temperature,
    timeoutMs: incomingLlm?.timeoutMs ?? DEFAULT_SETTINGS.llm.timeoutMs,
    lookupPromptTemplate: normalizePromptTemplate(
      "lookup",
      incomingLlm?.lookupPromptTemplate,
      incomingLlm?.promptTemplate,
      language,
    ),
    translationPromptTemplate: normalizePromptTemplate(
      "translation",
      incomingLlm?.translationPromptTemplate,
      incomingLlm?.promptTemplate,
      language,
    ),
  };

  return {
    llm,
    pronunciation: { ...DEFAULT_SETTINGS.pronunciation, ...(settings?.pronunciation ?? {}) },
    ui: {
      ...DEFAULT_SETTINGS.ui,
      language,
      ...(settings?.ui ?? {}),
      recordsPageSize: normalizeRecordsPageSize(settings?.ui?.recordsPageSize)
    },
    export: { ...DEFAULT_SETTINGS.export, ...(settings?.export ?? {}) },
  };
}

function normalizePromptTemplate(
  type: "lookup" | "translation",
  promptTemplate: string | undefined,
  legacyPromptTemplate: string | undefined,
  language: AppSettings["ui"]["language"],
): string {
  if (promptTemplate) {
    return isDefaultPromptTemplate(type, promptTemplate)
      ? getDefaultPromptTemplate(type, language)
      : promptTemplate;
  }
  return migrateLegacyPromptTemplate(type, legacyPromptTemplate, language);
}
