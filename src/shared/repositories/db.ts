import type {
  AppSettings,
  ExplanationRecord,
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
  normalizeLlmProvider,
  normalizeLlmProviderConfig,
  normalizeRecordsPageSize
} from "../types";

const DB_NAME = "remarker";

type StoreName = "settings" | "highlights" | "vocabulary" | "explanations" | "siteSettings";

let dbPromise: Promise<IDBDatabase> | undefined;

export function openRemarkerDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("highlights")) {
        const store = db.createObjectStore("highlights", { keyPath: "id" });
        store.createIndex("urlKey", "urlKey", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains("vocabulary")) {
        const store = db.createObjectStore("vocabulary", { keyPath: "id" });
        store.createIndex("normalizedWord", "normalizedWord", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("explanations")) {
        const store = db.createObjectStore("explanations", { keyPath: "id" });
        store.createIndex("cacheKey", "cacheKey", { unique: true });
        store.createIndex("createdAt", "createdAt", { unique: false });
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

export async function getSiteSettings(): Promise<SiteSetting[]> {
  return getAllFromStore<SiteSetting>("siteSettings");
}

export async function saveSiteSetting(setting: SiteSetting): Promise<void> {
  await putInStore("siteSettings", setting);
}

export async function importSnapshot(snapshot: {
  settings?: AppSettings;
  highlights?: HighlightRecord[];
  vocabulary?: VocabularyRecord[];
  explanations?: ExplanationRecord[];
  siteSettings?: SiteSetting[];
}): Promise<void> {
  if (snapshot.settings) await saveSettings(snapshot.settings);
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
    promptTemplate: incomingLlm?.promptTemplate ?? getDefaultPromptTemplate()
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
