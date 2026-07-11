export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createContextHash(context: string): Promise<string> {
  return sha256Hex(context.trim().replace(/\s+/g, " "));
}

export async function createExplanationCacheKey(input: {
  selectedText: string;
  context: string;
  model: string;
  selectionKind: "word" | "text";
  promptTemplate: string;
  targetLanguage: string;
}): Promise<{ cacheKey: string; contextHash: string }> {
  const normalizedText = input.selectedText.trim().replace(/\s+/g, " ");
  const normalizedPromptTemplate = input.promptTemplate.trim().replace(/\s+/g, " ");
  const normalizedTargetLanguage = input.targetLanguage.trim().replace(/\s+/g, " ");
  const contextHash = await createContextHash(input.context);
  const cacheKey = await sha256Hex(
    `${input.selectionKind}\n${normalizedText}\n${contextHash}\n${input.model}\n${normalizedPromptTemplate}\n${normalizedTargetLanguage}`
  );
  return { cacheKey, contextHash };
}
