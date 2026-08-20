import { isSingleEnglishWord } from "./word";
import type { PronunciationResult, RuntimeMessage } from "./messages";

const YOUDAO_PRONUNCIATION_ENDPOINT = "http://dict.youdao.com/dictvoice";

let activePronunciation: HTMLAudioElement | undefined;

export function getPronunciationAudioUrl(word: string): string | undefined {
  const normalizedWord = word.trim();
  if (!isSingleEnglishWord(normalizedWord)) return undefined;

  return `${YOUDAO_PRONUNCIATION_ENDPOINT}?audio=${encodeURIComponent(normalizedWord)}&type=2`;
}

export async function playPronunciation(word: string): Promise<void> {
  const audioUrl = getPronunciationAudioUrl(word);
  if (!audioUrl) return;

  const message: RuntimeMessage = {
    type: "GET_YOUDAO_PRONUNCIATION",
    word,
  };
  const response = await chrome.runtime.sendMessage(message) as {
    ok: boolean;
    result?: PronunciationResult;
    error?: string;
  };
  if (!response?.ok) {
    throw new Error(response?.error ?? "Unable to load pronunciation audio.");
  }

  const playableUrl = response.result?.audioDataUrl ?? response.result?.audioUrl;
  if (!playableUrl) throw new Error("Pronunciation audio is unavailable.");

  activePronunciation?.pause();
  const audio = new Audio(playableUrl);
  activePronunciation = audio;
  await audio.play();
}
