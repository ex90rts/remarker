import { describe, expect, it } from "vitest";
import { getPronunciationAudioUrl } from "../pronunciation";

describe("pronunciation audio", () => {
  it("builds the Youdao MP3 URL", () => {
    expect(getPronunciationAudioUrl(" architecture ")).toBe(
      "http://dict.youdao.com/dictvoice?audio=architecture&type=2",
    );
  });

  it("encodes supported compound English words", () => {
    expect(getPronunciationAudioUrl("state-of-the-art")).toBe(
      "http://dict.youdao.com/dictvoice?audio=state-of-the-art&type=2",
    );
  });

  it("does not create pronunciation URLs for non-English entries", () => {
    expect(getPronunciationAudioUrl("词汇")).toBeUndefined();
    expect(getPronunciationAudioUrl("hello world")).toBeUndefined();
  });
});
