import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMON_LINKS,
  MAX_COMMON_LINKS,
  extractHtmlTitle,
  isValidCommonLinkUrl,
  moveCommonLink,
  normalizeCommonLinks,
} from "../common-links";

describe("common links", () => {
  it("ships the requested defaults in order", () => {
    expect(DEFAULT_COMMON_LINKS).toEqual([
      { url: "https://techcrunch.com/", text: "TechCrunch" },
      {
        url: "https://openai.com/news/research/",
        text: "OpenAI Blog",
      },
      {
        url: "https://towardsdatascience.com/",
        text: "Towards Data Science",
      },
      { url: "https://huggingface.co/blog", text: "HuggingFace Blog" },
      { url: "https://claude.com/blog", text: "Claude Blog" },
      {
        url: "https://bair.berkeley.edu/blog/",
        text: "Berkeley Blog",
      },
    ]);
  });

  it("accepts only absolute HTTP(S) URLs", () => {
    expect(isValidCommonLinkUrl("https://example.com/path")).toBe(true);
    expect(isValidCommonLinkUrl("http://localhost:3000")).toBe(true);
    expect(isValidCommonLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isValidCommonLinkUrl("example.com")).toBe(false);
    expect(isValidCommonLinkUrl(" ")).toBe(false);
  });

  it("normalizes malformed input and limits the result to ten links", () => {
    const links = Array.from({ length: MAX_COMMON_LINKS + 3 }, (_, index) => ({
      url: ` https://example.com/${index} `,
      text: ` Link ${index} `,
    }));
    links.splice(2, 0, {
      url: "javascript:alert(1)",
      text: "Unsafe",
    });

    expect(normalizeCommonLinks(links)).toEqual(
      Array.from({ length: MAX_COMMON_LINKS }, (_, index) => ({
        url: `https://example.com/${index}`,
        text: `Link ${index}`,
      })),
    );
    expect(normalizeCommonLinks(undefined)).toEqual(DEFAULT_COMMON_LINKS);
  });

  it("extracts, collapses, and decodes an HTML title", () => {
    expect(
      extractHtmlTitle(`
        <!doctype html>
        <html><head><title>  Research &amp; Safety &#8212; OpenAI  </title></head></html>
      `),
    ).toBe("Research & Safety — OpenAI");
    expect(
      extractHtmlTitle("<html><body>No title</body></html>"),
    ).toBeUndefined();
  });

  it("moves links in either direction without mutating the source", () => {
    const links = DEFAULT_COMMON_LINKS.slice(0, 3);

    expect(moveCommonLink(links, 0, 2)).toEqual([links[1], links[2], links[0]]);
    expect(moveCommonLink(links, 2, 0)).toEqual([links[2], links[0], links[1]]);
    expect(links).toEqual(DEFAULT_COMMON_LINKS.slice(0, 3));
    expect(moveCommonLink(links, -1, 1)).toBe(links);
  });
});
