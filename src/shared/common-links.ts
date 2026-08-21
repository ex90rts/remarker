export interface CommonLink {
  url: string;
  text: string;
}

export const MAX_COMMON_LINKS = 10;

export const DEFAULT_COMMON_LINKS: CommonLink[] = [
  { url: "https://techcrunch.com/", text: "TechCrunch" },
  { url: "https://openai.com/news/research/", text: "OpenAI Blog" },
  {
    url: "https://towardsdatascience.com/",
    text: "Towards Data Science",
  },
  { url: "https://huggingface.co/blog", text: "HuggingFace Blog" },
  { url: "https://claude.com/blog", text: "Claude Blog" },
  { url: "https://bair.berkeley.edu/blog/", text: "Berkeley Blog" },
];

export function isValidCommonLinkUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeCommonLinks(value: unknown): CommonLink[] {
  if (!Array.isArray(value))
    return DEFAULT_COMMON_LINKS.map((link) => ({ ...link }));

  const links: CommonLink[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Partial<CommonLink>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!isValidCommonLinkUrl(url)) continue;
    links.push({
      url,
      text: typeof record.text === "string" ? record.text.trim() : "",
    });
    if (links.length === MAX_COMMON_LINKS) break;
  }
  return links;
}

export function moveCommonLink<T extends CommonLink>(
  links: T[],
  sourceIndex: number,
  targetIndex: number,
): T[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= links.length ||
    targetIndex < 0 ||
    targetIndex >= links.length ||
    sourceIndex === targetIndex
  ) {
    return links;
  }

  const reordered = [...links];
  const [movedLink] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedLink);
  return reordered;
}

export function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/i);
  if (!match) return undefined;

  const title = decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
  return title || undefined;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (
      entity,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      named: string | undefined,
    ) => {
      if (decimal) return decodeCodePoint(Number.parseInt(decimal, 10), entity);
      if (hexadecimal)
        return decodeCodePoint(Number.parseInt(hexadecimal, 16), entity);
      return namedEntities[named?.toLowerCase() ?? ""] ?? entity;
    },
  );
}

function decodeCodePoint(codePoint: number, fallback: string): string {
  try {
    return Number.isFinite(codePoint)
      ? String.fromCodePoint(codePoint)
      : fallback;
  } catch {
    return fallback;
  }
}
