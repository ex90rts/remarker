import type {
  AppSettings,
  ExplanationRecord,
  FootprintRecord,
  HighlightRecord,
  LlmProvider,
  LlmProviderConfig,
  SiteSetting,
  VocabularyRecord
} from "../types";
import { detectBrowserLanguage } from "../i18n";
import {
  DEFAULT_SETTINGS,
  LLM_PROVIDER_PRESETS,
  SCHEMA_VERSION,
  createDefaultLlmProviderConfigs,
  getDefaultPromptTemplate,
  isDefaultPromptTemplate,
  normalizeLlmProvider,
  normalizeLlmProviderConfig,
  normalizeRecordsPageSize
} from "../types";

const DB_NAME = "remarker";

type StoreName =
  | "settings"
  | "highlights"
  | "vocabulary"
  | "explanations"
  | "footprints"
  | "siteSettings";

let dbPromise: Promise<IDBDatabase> | undefined;

export function openRemarkerDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

    request.onupgradeneeded = () => {
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
      }

      const vocabularyStore = db.objectStoreNames.contains("vocabulary")
        ? transaction?.objectStore("vocabulary")
        : db.createObjectStore("vocabulary", { keyPath: "id" });
      if (vocabularyStore) {
        ensureIndex(vocabularyStore, "normalizedWord", "normalizedWord", {
          unique: false,
        });
        ensureIndex(vocabularyStore, "urlKey", "urlKey", { unique: false });
        ensureIndex(vocabularyStore, "createdAt", "createdAt", { unique: false });
      }

      const explanationStore = db.objectStoreNames.contains("explanations")
        ? transaction?.objectStore("explanations")
        : db.createObjectStore("explanations", { keyPath: "id" });
      if (explanationStore) {
        ensureIndex(explanationStore, "cacheKey", "cacheKey", { unique: true });
        ensureIndex(explanationStore, "urlKey", "urlKey", { unique: false });
        ensureIndex(explanationStore, "createdAt", "createdAt", { unique: false });
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
  keyPath: string,
  options?: IDBIndexParameters,
) {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options);
  }
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

export async function getExplanationByCacheKey(cacheKey: string): Promise<ExplanationRecord | undefined> {
  const store = await tx("explanations", "readonly");
  const index = store.index("cacheKey");
  return requestToPromise<ExplanationRecord | undefined>(index.get(cacheKey));
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
  explanations?: ExplanationRecord[];
  siteSettings?: SiteSetting[];
}): Promise<void> {
  if (snapshot.settings) await saveSettings(snapshot.settings);
  for (const record of snapshot.footprints ?? []) await putInStore("footprints", record);
  for (const record of snapshot.highlights ?? []) await putInStore("highlights", record);
  for (const record of snapshot.vocabulary ?? []) await putInStore("vocabulary", record);
  for (const record of snapshot.explanations ?? []) await putInStore("explanations", record);
  for (const record of snapshot.siteSettings ?? []) await saveSiteSetting(record);
}

type LegacyLlmConfig = Partial<AppSettings["llm"]> & {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
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
    promptTemplate:
      incomingLlm?.promptTemplate &&
      !isDefaultPromptTemplate(incomingLlm.promptTemplate)
        ? incomingLlm.promptTemplate
        : getDefaultPromptTemplate(language)
  };

  return {
    llm,
    pronunciation: { ...DEFAULT_SETTINGS.pronunciation, ...(settings?.pronunciation ?? {}) },
    ui: {
      ...DEFAULT_SETTINGS.ui,
      language,
      ...(settings?.ui ?? {}),
      recordsPageSize: normalizeRecordsPageSize(settings?.ui?.recordsPageSize)
    }
  };
}
