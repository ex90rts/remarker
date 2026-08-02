import "./popup.css";
import { detectBrowserLanguage, getMessages } from "../shared/i18n";
import { interpolate } from "../shared/i18n";
import type { Messages, SupportedLanguage } from "../shared/i18n";
import type { AppSettings } from "../shared/types";

const globalEnabledInput = document.querySelector<HTMLInputElement>("#globalEnabled");
const siteEnabledInput = document.querySelector<HTMLInputElement>("#siteEnabled");
const autoCloseLookupPanelOnCopyInput = document.querySelector<HTMLInputElement>(
  "#autoCloseLookupPanelOnCopy",
);
const statusText = document.querySelector<HTMLElement>("#statusText");
const addFootprintButton = document.querySelector<HTMLButtonElement>("#addFootprint");
const openOptionsButton = document.querySelector<HTMLButtonElement>("#openOptions");
const openReviewButton = document.querySelector<HTMLButtonElement>("#openReview");
const globalEnabledLabel = document.querySelector<HTMLElement>("#globalEnabledLabel");
const siteEnabledLabel = document.querySelector<HTMLElement>("#siteEnabledLabel");
const autoCloseLookupPanelOnCopyLabel = document.querySelector<HTMLElement>(
  "#autoCloseLookupPanelOnCopyLabel",
);

let currentHostname = "";
let currentTabUrl = "";
let currentTabTitle = "";
let footprintAdded = false;
let globalEnabled = true;
let disabledSites: string[] = [];
let currentSettings: AppSettings | undefined;
let t: Messages = getMessages(detectBrowserLanguage());

init().catch((error) => {
  if (statusText) statusText.textContent = error instanceof Error ? error.message : t.popup.failed;
});

async function init(): Promise<void> {
  await loadSettingsAndMessages();
  applyMessages();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab.url ?? "";
  currentTabTitle = tab.title ?? "";
  currentHostname = currentTabUrl ? new URL(currentTabUrl).hostname.toLowerCase() : "";

  const cache = await chrome.storage.local.get(["globalEnabled", "disabledSites"]);
  globalEnabled = cache.globalEnabled ?? true;
  disabledSites = Array.isArray(cache.disabledSites) ? cache.disabledSites : [];
  footprintAdded = await checkFootprintAdded();
  const reviewStatus = await chrome.runtime
    .sendMessage({ type: "GET_REVIEW_STATUS", now: new Date().toISOString() })
    .then((response: { ok: boolean; result?: { dueCount: number } }) => response.result)
    .catch(() => undefined);
  const dueCount = reviewStatus?.dueCount ?? 0;
  if (openReviewButton) {
    openReviewButton.hidden = dueCount === 0;
    openReviewButton.textContent = dueCount
      ? `${interpolate(t.popup.reviewDue, { count: dueCount })} · ${t.popup.openReview}`
      : t.popup.openReview;
  }

  if (globalEnabledInput) globalEnabledInput.checked = globalEnabled;
  if (siteEnabledInput) {
    siteEnabledInput.checked = currentHostname
      ? !disabledSites.includes(currentHostname)
      : false;
  }
  if (autoCloseLookupPanelOnCopyInput) {
    autoCloseLookupPanelOnCopyInput.checked = Boolean(
      currentSettings?.ui.autoCloseLookupPanelOnCopy,
    );
  }
  if (statusText) statusText.textContent = currentHostname || t.popup.noSite;
  updateSiteEnabledState();
  updateAddFootprintButton();

  globalEnabledInput?.addEventListener("change", async () => {
    globalEnabled = Boolean(globalEnabledInput.checked);
    updateSiteEnabledState();
    await chrome.storage.local.set({ globalEnabled });
  });

  siteEnabledInput?.addEventListener("change", async () => {
    const next = new Set<string>(disabledSites);
    if (siteEnabledInput.checked) next.delete(currentHostname);
    else next.add(currentHostname);
    disabledSites = Array.from(next);
    await chrome.storage.local.set({ disabledSites });
  });

  autoCloseLookupPanelOnCopyInput?.addEventListener("change", async () => {
    if (!currentSettings) return;
    currentSettings = {
      ...currentSettings,
      ui: {
        ...currentSettings.ui,
        autoCloseLookupPanelOnCopy: Boolean(
          autoCloseLookupPanelOnCopyInput.checked,
        ),
      },
    };
    await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      settings: currentSettings,
    });
  });

  openOptionsButton?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  openReviewButton?.addEventListener("click", () => {
    void chrome.tabs.create({
      url: chrome.runtime.getURL("options.html#vocabulary-review"),
    });
  });

  addFootprintButton?.addEventListener("click", async () => {
    if (footprintAdded || !currentTabUrl) return;
    await chrome.runtime.sendMessage({
      type: "ADD_FOOTPRINT",
      sourceUrl: currentTabUrl,
      sourceTitle: currentTabTitle,
    });
    footprintAdded = true;
    updateAddFootprintButton();
  });
}

async function loadSettingsAndMessages(): Promise<void> {
  currentSettings = await chrome.runtime
    .sendMessage({ type: "GET_SETTINGS" })
    .then(
      (response: { ok: boolean; result?: AppSettings }) => response.result,
    )
    .catch(() => undefined);
  t = getMessages(
    (currentSettings?.ui?.language as SupportedLanguage | undefined) ??
      detectBrowserLanguage(),
  );
}

function applyMessages(): void {
  if (statusText) statusText.textContent = t.popup.loading;
  if (globalEnabledLabel) globalEnabledLabel.textContent = t.popup.enableExtension;
  if (siteEnabledLabel) siteEnabledLabel.textContent = t.popup.enableCurrentSite;
  if (autoCloseLookupPanelOnCopyLabel) {
    autoCloseLookupPanelOnCopyLabel.textContent =
      t.options.settings.autoCloseLookupPanelOnCopy;
  }
  if (openOptionsButton) openOptionsButton.textContent = t.popup.managePage;
  updateSiteEnabledState();
  updateAddFootprintButton();
}

async function checkFootprintAdded(): Promise<boolean> {
  if (!currentTabUrl) return false;
  const response = await chrome.runtime
    .sendMessage({
      type: "GET_FOOTPRINT",
      sourceUrl: currentTabUrl,
    })
    .then((result: { ok: boolean; result?: unknown }) => result.result)
    .catch(() => undefined);
  return Boolean(response);
}

function updateAddFootprintButton(): void {
  if (!addFootprintButton) return;
  addFootprintButton.disabled = footprintAdded || !currentTabUrl;
  addFootprintButton.textContent = footprintAdded
    ? t.popup.addedFootprint
    : t.popup.addFootprint;
}

function updateSiteEnabledState(): void {
  if (!siteEnabledInput) return;
  siteEnabledInput.disabled = !globalEnabled || !currentHostname;
}
