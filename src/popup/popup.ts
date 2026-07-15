import "./popup.css";
import { detectBrowserLanguage, getMessages } from "../shared/i18n";
import type { Messages, SupportedLanguage } from "../shared/i18n";

const globalEnabledInput = document.querySelector<HTMLInputElement>("#globalEnabled");
const siteEnabledInput = document.querySelector<HTMLInputElement>("#siteEnabled");
const statusText = document.querySelector<HTMLElement>("#statusText");
const addFootprintButton = document.querySelector<HTMLButtonElement>("#addFootprint");
const openOptionsButton = document.querySelector<HTMLButtonElement>("#openOptions");
const globalEnabledLabel = document.querySelector<HTMLElement>("#globalEnabledLabel");
const siteEnabledLabel = document.querySelector<HTMLElement>("#siteEnabledLabel");

let currentHostname = "";
let currentTabUrl = "";
let currentTabTitle = "";
let footprintAdded = false;
let globalEnabled = true;
let disabledSites: string[] = [];
let t: Messages = getMessages(detectBrowserLanguage());

init().catch((error) => {
  if (statusText) statusText.textContent = error instanceof Error ? error.message : t.popup.failed;
});

async function init(): Promise<void> {
  await loadMessages();
  applyMessages();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab.url ?? "";
  currentTabTitle = tab.title ?? "";
  currentHostname = currentTabUrl ? new URL(currentTabUrl).hostname.toLowerCase() : "";

  const cache = await chrome.storage.local.get(["globalEnabled", "disabledSites"]);
  globalEnabled = cache.globalEnabled ?? true;
  disabledSites = Array.isArray(cache.disabledSites) ? cache.disabledSites : [];
  footprintAdded = await checkFootprintAdded();

  if (globalEnabledInput) globalEnabledInput.checked = globalEnabled;
  if (siteEnabledInput) {
    siteEnabledInput.checked = currentHostname
      ? !disabledSites.includes(currentHostname)
      : false;
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

  openOptionsButton?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
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

async function loadMessages(): Promise<void> {
  const settings = await chrome.runtime
    .sendMessage({ type: "GET_SETTINGS" })
    .then((response: { ok: boolean; result?: { ui?: { language?: SupportedLanguage } } }) => response.result)
    .catch(() => undefined);
  t = getMessages(settings?.ui?.language ?? detectBrowserLanguage());
}

function applyMessages(): void {
  if (statusText) statusText.textContent = t.popup.loading;
  if (globalEnabledLabel) globalEnabledLabel.textContent = t.popup.enableExtension;
  if (siteEnabledLabel) siteEnabledLabel.textContent = t.popup.enableCurrentSite;
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
